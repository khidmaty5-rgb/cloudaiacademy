import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

import ts from 'typescript';

const source = await readFile(
  new URL('../../src/server/journal-access.ts', import.meta.url),
  'utf8',
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const policy = await import(
  `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`
);

function firestoreProfile({ exists = true, role, error } = {}) {
  return {
    doc(path) {
      assert.match(path, /^users\/[^/]+$/);
      return {
        async get() {
          if (error) throw error;
          return {
            exists,
            data: () => (exists ? { role } : undefined),
          };
        },
      };
    },
  };
}

describe('Journal reviewer access policy', () => {
  it('treats the current profile role as authoritative over stale token claims', async () => {
    const role = await policy.getEffectiveJournalRole(
      firestoreProfile({ role: 'student' }),
      'former-editor',
      'admin',
    );

    assert.equal(role, 'student');
    assert.equal(policy.isJournalEditorialStaff(role), false);
  });

  it('does not fall back to a privileged claim when an existing profile role is invalid', async () => {
    const role = await policy.getEffectiveJournalRole(
      firestoreProfile({ role: 'unexpected-role' }),
      'invalid-profile',
      'editor',
    );

    assert.equal(role, undefined);
    assert.equal(policy.isJournalEditorialStaff(role), false);
  });

  it('falls back to a valid token role only when the profile does not exist', async () => {
    const role = await policy.getEffectiveJournalRole(
      firestoreProfile({ exists: false }),
      'legacy-editor',
      'editor',
    );

    assert.equal(role, 'editor');
    assert.equal(policy.isJournalEditorialStaff(role), true);
  });

  it('allows editorial staff only for current admin and editor roles', () => {
    assert.equal(policy.isJournalEditorialStaff('admin'), true);
    assert.equal(policy.isJournalEditorialStaff('editor'), true);
    assert.equal(policy.isJournalEditorialStaff('reviewer'), false);
    assert.equal(policy.isJournalEditorialStaff('teacher'), false);
    assert.equal(policy.isJournalEditorialStaff('student'), false);
  });

  it('fails closed when the authoritative profile lookup fails', async () => {
    await assert.rejects(
      policy.getEffectiveJournalRole(
        firestoreProfile({ error: new Error('profile lookup failed') }),
        'editor-user',
        'editor',
      ),
      /profile lookup failed/,
    );
  });
});
