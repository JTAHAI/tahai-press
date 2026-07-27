import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/content.mjs';

for (const relative of ['dist', '.artifacts', 'release-proof', 'proof']) {
  fs.rmSync(path.join(ROOT, relative), { recursive: true, force: true });
}
fs.rmSync(path.join(ROOT, 'deployment/bulk-redirects.csv'), { force: true });

console.log('Removed generated build, audit, release-proof, and redirect-export artifacts.');
