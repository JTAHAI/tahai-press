import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';
const calls = [];
const env = { PUBLIC_ORIGIN: 'https://news.example.org', OPERATOR_TOKEN: 'secret', DB: { prepare: () => ({ bind: (...args) => ({ run: async () => { calls.push(args); } }) }) } };
test('Worker accepts exact-origin contact messages without reader metadata', async () => {
  const response = await worker.fetch(new Request('https://example.org/api/contact', { method: 'POST', headers: { origin: env.PUBLIC_ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Please review this public meeting agenda.' }) }), env);
  assert.equal(response.status, 202); assert.equal(calls.length, 1); assert.equal(calls[0][1], 'contact');
});
test('Worker denies loose CORS and rejects unsafe attachment claims', async () => {
  const denied = await worker.fetch(new Request('https://example.org/api/contact', { method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify({ message: 'This message is valid but untrusted.' }) }), env);
  assert.equal(denied.status, 403);
  const attachment = await worker.fetch(new Request('https://example.org/api/attachments/validate', { method: 'POST', headers: { authorization: 'Bearer secret', 'content-type': 'application/json' }, body: JSON.stringify({ name: '../bad.pdf', content_type: 'application/pdf', bytes: 12, sha256: 'a'.repeat(64) }) }), env);
  assert.equal(attachment.status, 400);
});
