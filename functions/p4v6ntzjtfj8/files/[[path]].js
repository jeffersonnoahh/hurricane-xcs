// Apex attachment storage (photos / PDFs) on Cloudflare R2.
// Files arrive already encrypted on the phone; this only stores bytes.
// Each sync id is claimed by its first uploader: later requests must send the same token (only the owner's devices can derive it).
const MAX = 30 * 1024 * 1024;
const ok = (body, status = 200, type = 'application/json') => new Response(body, { status, headers: { 'content-type': type, 'cache-control': 'no-store' } });
const err = (msg, status) => ok(JSON.stringify({ error: msg }), status);

async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequest({ request, env, params }) {
  const B = env.APEX_FILES;
  if (!B) return err('storage not set up', 503);
  const parts = [].concat(params.path || []);
  const id = parts[0] || '', fid = parts[1] || '';
  if (!/^[a-f0-9]{16,64}$/.test(id)) return err('bad id', 400);
  const token = request.headers.get('x-apex-token') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) return err('no token', 401);
  const th = await sha(token);
  const own = await B.get(id + '/.owner');
  if (own) { if ((await own.text()) !== th) return err('forbidden', 403); }
  else if (request.method === 'PUT') await B.put(id + '/.owner', th);
  else return err('not found', 404);

  if (!fid) { // list file ids
    if (request.method !== 'GET') return err('method', 405);
    const out = []; let cursor;
    do { const l = await B.list({ prefix: id + '/f', cursor }); l.objects.forEach((o) => out.push(o.key.slice(id.length + 1))); cursor = l.truncated ? l.cursor : null; } while (cursor);
    return ok(JSON.stringify(out));
  }
  if (!/^f[a-z0-9]{4,40}$/.test(fid)) return err('bad file', 400);
  const key = id + '/' + fid;
  if (request.method === 'PUT') {
    const len = +(request.headers.get('content-length') || 0);
    if (len > MAX) return err('too big', 413);
    await B.put(key, request.body);
    return ok('{"ok":true}');
  }
  if (request.method === 'GET') {
    const o = await B.get(key);
    return o ? new Response(o.body, { headers: { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' } }) : err('not found', 404);
  }
  if (request.method === 'DELETE') { await B.delete(key); return ok('{"ok":true}'); }
  return err('method', 405);
}
