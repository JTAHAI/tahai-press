import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

const VERSION = '3.0.0-alpha.1';

function build() {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

function walk(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) visit(file);
      else files.push(file);
    }
  };
  visit(directory);
  return files;
}

function parseWorkflowTriggers(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const onIndex = lines.findIndex((line) => /^on:\s*$/.test(line));
  assert.ok(onIndex >= 0, 'workflow is missing an on: block');
  const triggers = new Set();
  for (let index = onIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent === 0) break;
    const trimmed = line.trim();
    const key = trimmed.match(/^([A-Za-z0-9_-]+):(?:\s*|$)/)?.[1];
    if (key) triggers.add(key);
    else if (trimmed.startsWith('- ')) triggers.add(trimmed.slice(2).trim());
  }
  return triggers;
}

test('package and lockfile stay on the same release line', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  assert.equal(pkg.version, VERSION);
  assert.equal(lock.version, VERSION);
  assert.equal(lock.packages[''].version, VERSION);
});

test('the build entry point stays thin and the renderer owns navigation grouping', () => {
  const builder = fs.readFileSync(path.join(ROOT, 'scripts', 'build.mjs'), 'utf8');
  const core = fs.readFileSync(path.join(ROOT, 'scripts', 'build-core.mjs'), 'utf8');
  assert.match(builder, /await import\('\.\/build-core\.mjs'\)/);
  assert.doesNotMatch(builder, /walk\(DIST\)|hardenHtml|navigation\.css|navigation\.js/);
  assert.match(core, /renderDesktopNavigation/);
  assert.match(core, /const assetVersion = packageInfo\.version;/);
  assert.match(core, /navigation\.css\?v=\$\{assetVersion\}/);
  assert.match(core, /navigation\.js\?v=\$\{assetVersion\}/);
});

test('every workflow is manual-only and free of bootstrap payload references', () => {
  const workflowDir = path.join(ROOT, '.github', 'workflows');
  for (const file of fs.readdirSync(workflowDir).filter((name) => name.endsWith('.yml'))) {
    const full = path.join(workflowDir, file);
    const source = fs.readFileSync(full, 'utf8');
    const triggers = parseWorkflowTriggers(source);
    assert.deepEqual([...triggers].sort(), ['workflow_dispatch'], file);
    assert.doesNotMatch(source, /\.bootstrap\//);
    assert.doesNotMatch(source, /^(?:\s{2,})?(?:pull_request_target|workflow_run|repository_dispatch|deployment_status|schedule|push|release):/m);
  }
});

test('built output keeps cache-versioned nav assets and excludes recovery artifacts', () => {
  build();
  const home = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  assert.match(home, new RegExp(`/assets/navigation\\.css\\?v=${VERSION}`));
  assert.match(home, new RegExp(`/assets/navigation\\.js\\?v=${VERSION}`));
  const files = walk(DIST).map((file) => path.relative(DIST, file).replaceAll('\\', '/'));
  assert.equal(files.some((file) => file.startsWith('.artifacts/')), false);
  assert.equal(files.some((file) => /\.zip$|\.sha256$/.test(file)), false);
});
