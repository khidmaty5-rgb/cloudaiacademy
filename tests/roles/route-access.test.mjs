import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../../src/lib/route-access.ts', import.meta.url), 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const policy = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`);

describe('client route access matrix', () => {
  it('routes every role to its own workspace', () => {
    assert.equal(policy.roleHomePath('student'), '/dashboard');
    assert.equal(policy.roleHomePath('reviewer'), '/reviewer');
    assert.equal(policy.roleHomePath('teacher'), '/teacher/dashboard');
    assert.equal(policy.roleHomePath('editor'), '/admin/journal');
    assert.equal(policy.roleHomePath('admin'), '/admin/dashboard');
  });

  it('keeps administrator-only pages restricted', () => {
    for (const role of ['student', 'reviewer', 'teacher', 'editor']) {
      assert.equal(policy.canRoleAccessPath(role, '/admin/users'), false);
    }
    assert.equal(policy.canRoleAccessPath('admin', '/admin/users'), true);
  });

  it('allows only the intended shared staff areas', () => {
    assert.equal(policy.canRoleAccessPath('teacher', '/admin/dashboard'), true);
    assert.equal(policy.canRoleAccessPath('teacher', '/admin/courses/edit/cloud-101'), true);
    assert.equal(policy.canRoleAccessPath('editor', '/admin/journal'), true);
    assert.equal(policy.canRoleAccessPath('reviewer', '/reviewer'), true);
    assert.equal(policy.canRoleAccessPath('student', '/reviewer'), false);
  });

  it('keeps learner workspaces limited to learner roles', () => {
    for (const path of ['/dashboard', '/learning-path', '/certificates']) {
      assert.equal(policy.canRoleAccessPath('student', path), true);
      assert.equal(policy.canRoleAccessPath('reviewer', path), true);
      assert.equal(policy.canRoleAccessPath('teacher', path), false);
      assert.equal(policy.canRoleAccessPath('editor', path), false);
      assert.equal(policy.canRoleAccessPath('admin', path), false);
    }
  });

  it('allows every signed-in role to manage a profile and view lessons', () => {
    for (const role of policy.allAuthenticatedRoles) {
      assert.equal(policy.canRoleAccessPath(role, '/profile'), true);
      assert.equal(policy.canRoleAccessPath(role, '/learn/cloud-101'), true);
    }
  });
});
