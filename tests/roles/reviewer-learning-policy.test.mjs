import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import ts from 'typescript';

async function importTypeScript(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);
}

const roles = await importTypeScript('../../src/lib/roles.ts');
const effectiveRoles = await importTypeScript('../../src/server/effective-user-role.ts');

function firestore(profile) {
  return {
    doc(path) {
      assert.equal(path, 'users/reviewer-1');
      return {
        async get() {
          return profile === undefined
            ? { exists: false, data: () => undefined }
            : { exists: true, data: () => profile };
        },
      };
    },
  };
}

describe('reviewer learning and role policy', () => {
  it('treats students and reviewers as learners without treating staff as learners', () => {
    assert.equal(roles.isLearnerRole('student'), true);
    assert.equal(roles.isLearnerRole('reviewer'), true);
    assert.equal(roles.isLearnerRole('teacher'), false);
    assert.equal(roles.isLearnerRole('editor'), false);
    assert.equal(roles.isLearnerRole('admin'), false);
  });

  it('uses an existing reviewer profile instead of a stale privileged token role', () => {
    assert.equal(roles.resolveCurrentRole('admin', 'reviewer', true), 'reviewer');
    assert.equal(roles.resolveCurrentRole('teacher', 'reviewer', true), 'reviewer');
  });

  it('falls back to claims only when the profile does not exist', () => {
    assert.equal(roles.resolveCurrentRole('reviewer', null, false), 'reviewer');
  });

  it('never auto-creates a student profile for a reviewer claim', () => {
    assert.equal(roles.shouldAutoCreateStudentProfile('reviewer'), false);
    assert.equal(roles.shouldAutoCreateStudentProfile('student'), true);
    assert.equal(roles.shouldAutoCreateStudentProfile(undefined), true);
  });

  it('resolves the server role from the current profile when it exists', async () => {
    assert.equal(
      await effectiveRoles.getEffectiveUserRole(
        firestore({ role: 'reviewer' }),
        'reviewer-1',
        'admin',
      ),
      'reviewer',
    );
  });

  it('fails closed for an invalid existing profile role', async () => {
    assert.equal(
      await effectiveRoles.getEffectiveUserRole(
        firestore({ role: 'unexpected' }),
        'reviewer-1',
        'admin',
      ),
      null,
    );
  });

  it('uses a valid token role only when the profile is missing', async () => {
    assert.equal(
      await effectiveRoles.getEffectiveUserRole(
        firestore(undefined),
        'reviewer-1',
        'reviewer',
      ),
      'reviewer',
    );
  });
});
