const MAX_BODY_BYTES = 64 * 1024;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

function cors(request, env) {
  const origin = request.headers.get('origin') || '';
  return origin && origin === env.PUBLIC_ORIGIN ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {};
}
function json(value, status = 200, headers = {}) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers } }); }
function authorized(request, env) { return Boolean(env.OPERATOR_TOKEN && request.headers.get('authorization') === `Bearer ${env.OPERATOR_TOKEN}`); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = cors(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'optional-newsroom-worker' }, 200, headers);
    if (url.pathname === '/api/contact' && request.method === 'POST') {
      if (!headers['Access-Control-Allow-Origin']) return json({ error: 'origin_not_allowed' }, 403);
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413, headers);
      const payload = await request.json().catch(() => null);
      if (!payload || typeof payload.message !== 'string' || payload.message.trim().length < 10 || payload.message.length > 8000) return json({ error: 'invalid_message' }, 400, headers);
      const id = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO inbox_messages (id, kind, body, created_at) VALUES (?, ?, ?, ?)').bind(id, 'contact', payload.message.trim(), new Date().toISOString()).run();
      return json({ accepted: true, id }, 202, headers);
    }
    if (url.pathname === '/api/attachments/validate' && request.method === 'POST') {
      if (!authorized(request, env)) return json({ error: 'unauthorized' }, 401, headers);
      const payload = await request.json().catch(() => null);
      const valid = payload && typeof payload.name === 'string' && /^[A-Za-z0-9._-]{1,160}$/.test(payload.name) && TYPES.has(payload.content_type) && Number.isInteger(payload.bytes) && payload.bytes > 0 && payload.bytes <= MAX_ATTACHMENT_BYTES && /^[a-f0-9]{64}$/i.test(payload.sha256 || '');
      return json({ valid: Boolean(valid) }, valid ? 200 : 400, headers);
    }
    return json({ error: 'not_found' }, 404, headers);
  }
};
