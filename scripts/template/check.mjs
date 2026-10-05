import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const source = await readFile(new URL('../../src/lib/academy-schema.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("'zod'", JSON.stringify(import.meta.resolve('zod')));
const { academySchema } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const filename = process.argv[2] || 'academy.config.json';
const result = academySchema.safeParse(JSON.parse(await readFile(filename, 'utf8')));
if (!result.success) {
  for (const issue of result.error.issues) console.error(`${issue.path.join('.')}: ${issue.message}`);
  process.exitCode = 1;
} else {
  for (const key of ['logoPath', 'certificateLogoPath', 'certificateTemplatePath']) {
    const asset = path.resolve('public', '.' + result.data[key]);
    if (!asset.startsWith(path.resolve('public') + path.sep)) throw new Error('Asset escapes public directory');
    await access(asset);
  }
  console.log('Academy configuration and required local assets are valid.');
  console.log('This check does not verify credentials, legal content, DNS, payments, or actual role sign-ins.');
}
