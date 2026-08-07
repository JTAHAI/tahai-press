import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DIST } from '../scripts/lib/content.mjs';

const read = (file) => fs.readFileSync(path.join(DIST, file), 'utf8');

test('Data Desk preserves source, accessible table, download, and no-script narrative', () => {
  const html = read('data/meeting-attendance/index.html');
  assert.match(html, /Accessible table/);
  assert.match(html, /<caption>Public meeting attendance/);
  assert.match(html, /Download source CSV/);
  assert.match(html, /Methodology/);
  assert.equal(fs.existsSync(path.join(DIST, 'downloads/meeting-attendance.csv')), true);
});

test('Maps Desk uses explicit location fallbacks rather than inferred map facts', () => {
  const html = read('maps/civic-meeting-sites/index.html');
  assert.match(html, /Civic Hall/);
  assert.match(html, /100 Main Street/);
  assert.match(html, /No location is inferred from article text/);
  assert.doesNotMatch(html, /maplibre|google maps|leaflet/i);
});

test('developing coverage retains timestamped, pinned, source-linked update history', () => {
  const html = read('developing/civic-meeting-coverage/index.html');
  assert.match(html, /Pinned update/);
  assert.match(html, /What changed/);
  assert.match(html, /sample-meeting-record/);
  assert.match(html, /Updates continue/);
});
