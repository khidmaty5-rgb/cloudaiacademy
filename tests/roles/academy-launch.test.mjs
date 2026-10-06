import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditLaunch } from '../../scripts/template/launch-policy.mjs';
const clean = { identity: { name: 'Example Academy', siteUrl: 'https://learn.example.org', contactEmail: 'hello@example.org', journalEmail: 'journal@example.org' },
  expectedProject: 'example-academy-123', firebaseTarget: 'example-academy-123', clientProject: 'example-academy-123', serverProject: 'example-academy-123' };
test('independent academy passes only with aligned explicit project IDs', () => {
  assert.deepEqual(auditLaunch(clean), []);
  for (const key of ['expectedProject', 'firebaseTarget', 'clientProject', 'serverProject']) {
    assert.ok(auditLaunch({ ...clean, [key]: undefined }).length, key);
    assert.ok(auditLaunch({ ...clean, [key]: 'different-project' }).length, key);
  }
});
test('new academy cannot accidentally use CloudAI production in any target', () => {
  for (const key of ['expectedProject', 'firebaseTarget', 'clientProject', 'serverProject']) {
    assert.ok(auditLaunch({ ...clean, [key]: 'studio-3170120655-4bab7' }).some(error => error.includes('CloudAI production')));
  }
});
test('new academy must replace copied identity and contact destinations', () => {
  for (const patch of [{ name: 'CloudAI Academy' }, { siteUrl: 'https://www.cloudaiacademy.ca' }, { contactEmail: 'INFO@cloudaiacademy.ca' }, { journalEmail: 'journal@cloudaiacademy.ca' }]) {
    assert.ok(auditLaunch({ ...clean, identity: { ...clean.identity, ...patch } }).length);
  }
});
test('explicit existing academy mode permits matching production but not mismatch', () => {
  const project = 'studio-3170120655-4bab7';
  assert.deepEqual(auditLaunch({ ...clean, newAcademy: false, expectedProject: project, firebaseTarget: project, clientProject: project, serverProject: project }), []);
  assert.ok(auditLaunch({ ...clean, newAcademy: false, serverProject: 'wrong-project' }).length);
});
