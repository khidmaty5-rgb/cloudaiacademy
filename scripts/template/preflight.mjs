import { readFile } from 'node:fs/promises';
import { auditLaunch } from './launch-policy.mjs';

const args = process.argv.slice(2);
if (args.length !== 2 || !['--new', '--existing'].includes(args[0])) {
  console.error('Usage: npm run academy:preflight -- --new EXPECTED_PROJECT_ID (or --existing for an existing academy)');
  process.exitCode = 1;
} else {
  try {
    const identity = JSON.parse(await readFile('academy.config.json', 'utf8'));
    const aliases = JSON.parse(await readFile('.firebaserc', 'utf8'));
    // Only project IDs from the process environment; never load or print .env files.
    const errors = auditLaunch({ identity, firebaseTarget: aliases.projects?.default,
      expectedProject: args[1], clientProject: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      serverProject: process.env.FIREBASE_PROJECT_ID, newAcademy: args[0] === '--new' });
    if (errors.length) { errors.forEach(error => console.error(error)); process.exitCode = 1; }
    else {
      console.log('Project isolation preflight passed. No remote services or files were changed.');
      console.log('Still required: academy:check, credential permissions, domain ownership, storage/payment isolation, backups, and real-account acceptance tests.');
    }
  } catch {
    console.error('Could not read the public academy configuration or Firebase project aliases.');
    process.exitCode = 1;
  }
}
