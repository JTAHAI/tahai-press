import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? files(target) : [target];
  });
}

test('generated public output excludes synthetic unpublished content and unapproved uploads', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'tahai-public-boundary-'));
  try {
    for (const entry of ['content', 'public', 'scripts']) fs.cpSync(path.join(ROOT, entry), path.join(fixture, entry), { recursive: true });
    for (const entry of ['package.json', 'package-lock.json', '.node-version']) fs.copyFileSync(path.join(ROOT, entry), path.join(fixture, entry));
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(fixture, 'node_modules'), 'junction');
    const sentinel = 'SYNTHETIC_PRIVATE_SENTINEL_20260913';
    const article = JSON.parse(fs.readFileSync(path.join(fixture, 'content', 'articles', 'sample-written-story.json')));
    Object.assign(article, { slug: 'synthetic-private-story', title: sentinel, body: sentinel, excerpt: sentinel, status: 'draft', featured_image: '/uploads/synthetic-private.txt' });
    fs.writeFileSync(path.join(fixture, 'content', 'articles', 'synthetic-private-story.json'), JSON.stringify(article));
    fs.writeFileSync(path.join(fixture, 'public', 'uploads', 'synthetic-private.txt'), sentinel);
    execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: fixture, stdio: 'pipe' });
    assert.equal(fs.existsSync(path.join(fixture, 'dist', 'uploads', 'synthetic-private.txt')), false);
    for (const file of files(path.join(fixture, 'dist'))) assert.equal(fs.readFileSync(file).includes(sentinel), false, `private sentinel leaked through ${path.relative(fixture, file)}`);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
