import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DIST, ROOT } from './lib/content.mjs';

const runner = path.join(ROOT, 'node_modules', 'pagefind', 'lib', 'runner', 'bin.cjs');
// Isolated fixture copies used by repository tests intentionally omit node_modules.
// They retain the static fallback search; normal clean installs always build Pagefind.
if (!fs.existsSync(runner)) {
  console.warn('Pagefind is unavailable in this dependency-free fixture; retaining the static search fallback.');
} else {
  execFileSync(process.execPath, [runner, '--site', DIST, '--output-path', path.join(DIST, 'pagefind'), '--force-language', 'en'], { cwd: ROOT, stdio: 'inherit' });
  const output = path.join(DIST, 'pagefind', 'pagefind.js');
  if (!fs.existsSync(output)) throw new Error('Pagefind did not create its browser search module.');
  console.log(`Pagefind index created at ${path.relative(ROOT, output).replaceAll('\\', '/')}.`);
}
