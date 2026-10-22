import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../../src/lib/course-learning-plan.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { buildCourseLearningPlan: plan } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const input = { interests: 'cybersecurity', careerGoals: 'industrial', experienceLevel: 'beginner', language: 'English' };
const course = (id, changes = {}) => ({
  id, slug: id, status: 'PUBLISHED', title: 'Security basics', description: 'Learn security',
  category: 'Cybersecurity', level: 'Beginner', price: 'Free', ...changes,
});

test('matches published courses only; excludes unknown status, higher levels and unrelated courses', () => {
  const result = plan(input, [
    course('draft', { status: 'DRAFT' }), course('legacy', { status: undefined }),
    course('advanced', { level: 'Advanced' }), course('unknown-level', { level: 'Other' }),
    course('other', { title: 'Cooking', description: 'Food preparation', category: 'Food' }),
    course('security'), course('security'),
  ]);
  assert.deepEqual(result.courses.map(c => c.id), ['security']);
  assert.match(result.description, /not AI-generated/);
  assert.match(result.description, /Courses may have fees/);
});

test('Arabic interests match English catalog and produce Arabic guidance', () => {
  const result = plan({ ...input, interests: 'الأمن السيبراني', language: 'Arabic' }, [course('security')]);
  assert.equal(result.courses.length, 1);
  assert.match(result.description, /ليست مولّدة بالذكاء الاصطناعي/);
  assert.ok(result.description.includes('Security basics'), 'original catalog titles are preserved');
});

test('unavailable topics give an honest empty result rather than invented courses', () => {
  const result = plan(input, [course('network', { title: 'Networking', category: 'Networks', description: 'TCP/IP' })]);
  assert.equal(result.courses.length, 0);
  assert.match(result.description, /No courses currently match/);
  assert.equal(plan(input, []).courses.length, 0);
});

test('paths are deterministic, foundation-first and limited to five courses', () => {
  const catalog = [
    course('z', { level: 'Advanced' }), course('y', { level: 'Intermediate' }),
    ...['f', 'e', 'd', 'c', 'b', 'a'].map(id => course(id)),
  ];
  const advanced = { ...input, experienceLevel: 'advanced' };
  assert.deepEqual(plan(advanced, catalog), plan(advanced, [...catalog].reverse()));
  assert.deepEqual(plan(advanced, catalog).courses.map(c => c.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(plan(advanced, catalog.slice(0, 3)).courses.map(c => c.level), ['Beginner', 'Intermediate', 'Advanced']);
});

test('invalid and oversized inputs are rejected', () => {
  for (const changes of [{ interests: ' ' }, { careerGoals: '' }, { interests: 'a'.repeat(301) },
    { careerGoals: 'x'.repeat(1001) }, { experienceLevel: 'expert' }, { language: 'Other' }]) {
    assert.throws(() => plan({ ...input, ...changes }, []), /INVALID_PLAN_INPUT/);
  }
});

test('planner UI has no AI action and preserves published queries and save shape', async () => {
  const page = await readFile(new URL('../../src/app/(app)/learning-path/page.tsx', import.meta.url), 'utf8');
  assert.ok(!page.includes('@/ai/'));
  assert.ok(!page.includes('generatePersonalizedLearningPath'));
  assert.ok(page.includes("where('status', '==', 'PUBLISHED')"));
  assert.ok(page.includes('saveLearningPath(user.uid, { title: result.title, description: result.description })'));
  assert.ok(page.includes('!result.courses.length'));
});
