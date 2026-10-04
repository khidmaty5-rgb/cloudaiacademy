import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
// These source contracts supplement, not replace, browser geometry checks.
test('user cards adapt to content width and controls remain in flow', async () => {
  const source = await read('src/app/admin/users/page.tsx');
  assert.ok(source.includes('minmax(min(100%,20rem),1fr)'));
  assert.ok(!source.includes('md:grid-cols-5'));
  assert.ok(!source.includes('w-[120px]'));
  assert.ok(source.includes('break-all text-sm font-medium'));
  assert.ok(source.includes('aria-label={t.role}'));
  assert.ok(source.includes('Intl.DateTimeFormat'));
});
test('auth resolves before selecting shell without swapping public wrappers', async () => {
  const shell = await read('src/components/layout/site-shell.tsx');
  const layout = await read('src/app/(public)/layout.tsx');
  assert.ok(shell.indexOf('if (isUserLoading && workspacePage)') < shell.indexOf('if (user && workspacePage)'));
  assert.ok(shell.includes('role="status"'));
  assert.ok(!layout.includes('LearnerWorkspaceShell'));
});

test('navigation retains groups and respects disabled journal visibility', async () => {
  const source = await read('src/components/layout/workspace-shell.tsx');
  assert.ok(source.includes('key={group.key}'));
  assert.ok(!source.includes('key={`${group.key}:${pathname}'));
  assert.ok(source.includes('settings?.showJournalNav !== false'));
  assert.ok(source.includes('${link.href}'));
});

test('editorial layout is a full-width queue with collapsible issue tools', async () => {
  const source = await read('src/app/admin/journal/page.tsx');
  assert.ok(!source.includes('md:grid-cols-2'));
  assert.ok(source.includes('<details'));
  assert.ok(source.includes('ابحث بالعنوان أو المؤلف'));
  assert.ok(source.includes('statusText(s)'));
  assert.ok(source.includes('dateText(new Date(createdAt))'));
});

test('dialogs fit the viewport, scroll vertically and use logical positioning', async () => {
  for (const name of ['dialog', 'alert-dialog']) {
    const source = await read(`src/components/ui/${name}.tsx`);
    assert.ok(source.includes('w-[calc(100%-2rem)]'));
    assert.ok(source.includes('max-h-[calc(100dvh-2rem)]'));
    assert.ok(source.includes('overflow-y-auto'));
    assert.ok(source.includes('text-start'));
  }
});

test('optional landing sections wait for settings before rendering defaults', async () => {
  for (const name of ['hero', 'stats', 'features', 'faq', 'testimonials', 'pricing']) {
    const source = await read(`src/components/landing/${name}.tsx`);
    assert.match(source, /if \(settingsLoading \|\| !show\w+\) return null/);
  }
});

test('light theme body text and accent controls have at least 4.5:1 contrast', async () => {
  const css = (await read('src/app/globals.css')).split('.dark')[0];
  const color = name => {
    const match = css.match(new RegExp(`--${name}: (\\d+) (\\d+)% (\\d+)%;`));
    assert.ok(match, name);
    const h = +match[1], s = +match[2] / 100, l = +match[3] / 100;
    const a = s * Math.min(l, 1 - l);
    return [0, 8, 4].map(n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); });
  };
  const luminance = rgb => rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  assert.ok(contrast(color('accent'), color('accent-foreground')) >= 4.5);
  assert.ok(contrast(color('muted-foreground'), color('background')) >= 4.5);
  assert.ok(contrast(color('muted-foreground'), color('card')) >= 4.5);
});
