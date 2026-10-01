import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { describe, it } from 'node:test';
import ts from 'typescript';

const encodeModule = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')}`;
const policyUrl = encodeModule(await readFile(new URL('../../src/lib/route-access.ts', import.meta.url), 'utf8'));
const policy = await import(policyUrl);
const source = await readFile(new URL('../../src/lib/workspace-navigation.ts', import.meta.url), 'utf8');
const nav = await import(encodeModule(source.replaceAll('@/lib/route-access', policyUrl)));

describe('workspace navigation contracts', () => {
  it('every role has its home and no forbidden or duplicate destinations', () => {
    for (const role of policy.allAuthenticatedRoles) {
      const links = nav.navigationForRole(role);
      assert.ok(links.some(link => link.href === policy.roleHomePath(role)), role);
      assert.equal(new Set(links.map(link => link.href)).size, links.length);
      for (const link of links) assert.ok(policy.canRoleAccessPath(role, link.href), `${role}: ${link.href}`);
    }
  });
  it('keeps formerly hidden learner tools and shared staff profile reachable', () => {
    for (const role of ['student', 'reviewer']) {
      const links = nav.navigationForRole(role);
      for (const href of ['/dashboard/telegram', '/journal/my-submissions', '/courses']) {
        assert.ok(links.some(link => link.href === href), `${role}: ${href}`);
      }
    }
    for (const role of policy.allAuthenticatedRoles) assert.ok(nav.navigationForRole(role).some(link => link.href === '/profile'));
    assert.ok(!nav.navigationForRole('editor').some(link => link.href === '/admin/users'));
  });
  it('highlights the most specific destination without confusing route prefixes', () => {
    const links = nav.navigationForRole('reviewer');
    assert.equal(nav.activeWorkspaceLink('/dashboard/telegram', links)?.href, '/dashboard/telegram');
    assert.equal(nav.activeWorkspaceLink('/journal/my-submissions', links)?.href, '/journal/my-submissions');
    assert.equal(nav.activeWorkspaceLink('/courses/cloud', links)?.href, '/courses');
    assert.equal(nav.activeWorkspaceLink('/courses-other', links), undefined);
  });
  it('all destinations exist and have both language labels', async () => {
    for (const link of nav.workspaceLinks) {
      assert.ok(link.label.en && link.label.ar && link.section.en && link.section.ar);
      const candidates = ['', '/(app)', '/(public)'].map(group => new URL(`../../src/app${group}${link.href}/page.tsx`, import.meta.url));
      const found = await Promise.all(candidates.map(path => access(path).then(() => true, () => false)));
      assert.ok(found.some(Boolean), `Missing route ${link.href}`);
    }
  });
});
