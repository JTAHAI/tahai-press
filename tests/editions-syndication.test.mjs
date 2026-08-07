import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DIST } from '../scripts/lib/content.mjs';

function read(relative) {
  return fs.readFileSync(path.join(DIST, relative), 'utf8');
}

test('canonical edition links to source authority and remains printable without client rendering', () => {
  const index = read('editions/index.html');
  const edition = read('editions/public-records-weekly/index.html');
  assert.match(index, /Public Records Weekly/);
  assert.match(edition, /From the editor/);
  assert.match(edition, /sample-written-story/);
  assert.match(edition, /sample-meeting-record/);
  assert.match(edition, /data-print-edition/);
});

test('newsletter desk emits a browser archive, email-safe HTML, and plain text without tracking behavior', () => {
  const archive = read('newsletters/public-records-brief/index.html');
  const email = read('newsletters/public-records-brief/email.html');
  const text = read('newsletters/public-records-brief/email.txt');
  assert.match(archive, /Download email-safe HTML/);
  assert.match(email, /Public Records Brief/);
  assert.match(email, /provider-neutral placeholder/i);
  assert.match(text, /sample-written-story/);
  assert.doesNotMatch(email, /<script\b|<form\b|<img\b|tracking\s+pixel|@font-face|utm_/i);
  assert.doesNotMatch(email, /https:\/\/(?!example\.pages\.dev)/i);
});

test('Atom, RSS, JSON Feed, and static API expose only published public content', () => {
  const atom = read('atom.xml');
  const rss = read('feed.xml');
  const jsonFeed = JSON.parse(read('feed.json'));
  const api = JSON.parse(read('api/v1/articles.json'));
  const manifest = JSON.parse(read('api/v1/manifest.json'));
  assert.match(atom, /application\/atom\+xml|<feed xmlns=/);
  assert.match(atom, /<entry>/);
  assert.match(rss, /<dc:creator>/);
  assert.equal(jsonFeed.version, 'https://jsonfeed.org/version/1.1');
  assert.equal(api.schema_version, 1);
  assert.equal(api.generated_version, JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version);
  assert.equal(api.items.length, 4);
  assert.ok(api.items.every((item) => !('editor_notes' in item) && !('review_content' in item) && item.url.startsWith('https://example.pages.dev/')));
  assert.ok(manifest.collections.some((collection) => collection.name === 'editions'));
  assert.ok(manifest.collections.some((collection) => collection.name === 'evidence'));
});
