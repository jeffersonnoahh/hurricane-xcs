// Tiny same-site copy of a Google Drive thumbnail, so the Design Studio page can read its pixels
// to spot look-alike photos (browsers block reading pixels of images from other sites).
// Only Drive file ids are accepted, and only small thumbnails are returned.
export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const id = u.searchParams.get('id') || '';
  if (!/^[\w-]{10,120}$/.test(id)) return new Response('bad id', { status: 400 });
  const r = await fetch(`https://drive.google.com/thumbnail?id=${id}&sz=w64`, {
    redirect: 'follow',
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.startsWith('image/')) return new Response('not found', { status: 404 });
  return new Response(r.body, {
    headers: { 'content-type': type, 'cache-control': 'public, max-age=604800, immutable' },
  });
}
