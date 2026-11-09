// Coach tab AI (Cloudflare Pages Function, POST /api/coach).
// The browser sends a short text summary of one seller (or one team); this asks
// Claude through the command center's /api/ai (server to server, so no CORS and
// no API key in the browser) and returns a short coaching message.
// Same summary within 6 hours = cached answer (no new AI cost).
const CC_AI = 'https://hurricane-cc.diamond-deposit.workers.dev/api/ai';
const MODEL = 'claude-haiku-4-5';
const MAX_CTX = 6000;

const BASE = `Kamu coach sales untuk Hurricane (aksesoris otomotif Indonesia: XCS = alat mobil, Spring Buffer = suspensi, XCSR = alat motor).
Alur jualan: Iklan Meta → chat WhatsApp → callback (telepon balik) → test drive → closing.
Gaya: Bahasa Indonesia santai tapi tegas dan memotivasi, langsung ke inti, seperti coach yang peduli.
ATURAN: jangan mengarang angka atau nama yang tidak ada di data. Jangan pakai tabel. Maksimal 170 kata.`;

const SYS = {
  seller: BASE + `
Kamu bicara langsung ke SATU sales (pakai "kamu").
Format jawaban:
1 paragraf pendek (maks 3 kalimat): kondisi dia sekarang dan SATU akar masalah terbesar.
Lalu baris "Fokus hari ini:" diikuti 3 sampai 5 poin "- " berisi aksi konkret yang bisa dikerjakan HARI INI. Sebut nama customer dari data CRM kalau ada.
Tutup dengan 1 kalimat penyemangat singkat.`,
  team: BASE + `
Kamu bicara ke LEADER tim (pakai "kamu").
Format jawaban:
1 paragraf pendek (maks 3 kalimat): kondisi tim dan bottleneck terbesar.
Lalu baris "Fokus leader hari ini:" diikuti 3 sampai 5 poin "- " berisi aksi konkret, sebut nama anggota yang perlu dibantu dan apa yang harus dicek.
Tutup dengan 1 kalimat singkat.`,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost({ request }) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
  const mode = body && body.mode === 'team' ? 'team' : 'seller';
  const ctx = String((body && body.ctx) || '').trim();
  if (ctx.length < 40) return json({ error: 'data terlalu sedikit' }, 400);
  if (ctx.length > MAX_CTX) return json({ error: 'data terlalu panjang' }, 413);

  const url = new URL(request.url);
  const cache = caches.default;
  const key = new Request(`${url.origin}/api/coach?k=${await sha(mode + '\n' + ctx)}`);
  const hit = await cache.match(key);
  if (hit) return hit;

  let res;
  try {
    const r = await fetch(CC_AI, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYS[mode], messages: [{ role: 'user', content: ctx }] }),
    });
    res = await r.json();
  } catch (e) {
    return json({ error: 'AI tidak bisa dihubungi' }, 502);
  }
  if (!res || res.error) return json({ error: (res && res.error && res.error.message) || 'AI error' }, 502);
  const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  if (!text) return json({ error: 'AI kosong' }, 502);

  const out = new Response(JSON.stringify({ text }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=21600' },
  });
  await cache.put(key, out.clone());
  return out;
}
