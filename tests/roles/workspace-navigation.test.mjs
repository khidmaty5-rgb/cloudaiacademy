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
const capabilitiesUrl = encodeModule(await readFile(new URL('../../src/lib/capabilities.ts', import.meta.url), 'utf8'));
const capabilities = await import(capabilitiesUrl);
const nav = await import(encodeModule(source.replaceAll('@/lib/route-access', policyUrl).replaceAll('@/lib/capabilities', capabilitiesUrl)));

describe('workspace navigation contracts', () => {
  it('contextual workspaces preserve discoverability and isolate tools', () => {
    for (const role of policy.allAuthenticatedRoles) {
      const links = nav.navigationForRole(role);
      const workspaces = nav.availableWorkspaces(links);
      const reachable = new Set(workspaces.flatMap(id => nav.contextualNavigation(links, id)).map(link => link.href));
      assert.deepEqual([...reachable].sort(), links.map(link => link.href).sort());
      for (const id of workspaces) {
        assert.ok(nav.workspaceLabels[id].en && nav.workspaceLabels[id].ar);
        for (const link of nav.contextualNavigation(links, id)) assert.ok(!nav.workspaceForLink(link) || nav.workspaceForLink(link) === id);
      }
    }
    assert.deepEqual(nav.availableWorkspaces(nav.navigationForRole('reviewer')), ['reviewing', 'learning']);
    assert.ok(!nav.availableWorkspaces(nav.navigationForRole('student')).includes('administration'));
  });
  it('capabilities preserve every existing destination and do not grant staff learner access', () => {
    for (const role of policy.allAuthenticatedRoles) {
      const before = nav.workspaceLinks.filter(link => link.roles.includes(role) && policy.canRoleAccessPath(role, link.href)).map(link => link.href).sort();
      assert.deepEqual(nav.navigationForRole(role).map(link => link.href).sort(), before);
      assert.equal(capabilities.hasCapability(role, 'learning.access'), ['student', 'reviewer'].includes(role));
      assert.equal(capabilities.hasCapability(role, 'learning.certificates'), ['student', 'reviewer'].includes(role));
      assert.equal(capabilities.hasCapability(role, 'journal.review'), ['reviewer', 'editor', 'admin'].includes(role));
      assert.equal(new Set(capabilities.capabilitiesForRole(role)).size, capabilities.capabilitiesForRole(role).length);
    }
  });
  it('prioritizes the primary workspace and separates teaching from learning', () => {
    const first = { admin: 'Academy management', teacher: 'Teaching & communications', editor: 'Editorial', reviewer: 'Peer review', student: 'Learning' };
    for (const role of policy.allAuthenticatedRoles) assert.equal(nav.navigationForRole(role)[0].section.en, first[role]);
    for (const role of ['teacher', 'admin']) {
      for (const link of nav.navigationForRole(role).filter(link => link.href.startsWith('/teacher/'))) assert.equal(link.section.en, 'Teaching & communications');
    }
  });
  it('Telegram visibility and new/legacy route access agree for all roles', () => {
    for (const role of policy.allAuthenticatedRoles) {
      const allowed = role === 'teacher' || role === 'admin';
      assert.equal(nav.navigationForRole(role).some(link => link.href === '/teacher/telegram'), allowed);
      assert.equal(policy.canRoleAccessPath(role, '/teacher/telegram'), allowed);
      assert.equal(policy.canRoleAccessPath(role, '/dashboard/telegram'), allowed);
      assert.ok(!nav.navigationForRole(role).some(link => link.href === '/dashboard/telegram'));
    }
  });
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
      for (const href of ['/journal/my-submissions', '/courses']) {
        assert.ok(links.some(link => link.href === href), `${role}: ${href}`);
      }
    }
    for (const role of policy.allAuthenticatedRoles) assert.ok(nav.navigationForRole(role).some(link => link.href === '/profile'));
    assert.ok(!nav.navigationForRole('editor').some(link => link.href === '/admin/users'));
  });
  it('highlights the most specific destination without confusing route prefixes', () => {
    const links = nav.navigationForRole('reviewer');
    assert.equal(nav.activeWorkspaceLink('/teacher/telegram', nav.navigationForRole('teacher'))?.href, '/teacher/telegram');
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
