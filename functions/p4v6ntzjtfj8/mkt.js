// Apex market data proxy (Cloudflare Pages Function).
// Browsers can't call Yahoo Finance directly (no CORS), so this fetches it server-side and caches for 60s.
// Only allow-listed symbols, so it can't be used as an open proxy.
const ALLOW = { '^JKSE': 'IHSG', 'IDR=X': 'USD/IDR' };
const STOOQ = { '^JKSE': '^jkse', 'IDR=X': 'usdidr' };

function json(body, status = 200, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
    },
  });
}

async function yahoo(sym, range, interval) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=${range}&interval=${interval}&includePrePost=false`;
  const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', accept: 'application/json' } });
  if (!r.ok) throw new Error('yahoo ' + r.status);
  const j = await r.json();
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res || !res.meta) throw new Error('yahoo empty');
  const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
  const ts = res.timestamp || [];
  const pts = [];
  (q.close || []).forEach((v, i) => { if (v != null) pts.push([ts[i], Math.round(v * 100) / 100]); });
  return { meta: res.meta, pts };
}

async function stooq(sym) {
  const r = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(STOOQ[sym] || sym.toLowerCase())}&f=sd2t2ohlc&h&e=csv`);
  if (!r.ok) throw new Error('stooq ' + r.status);
  const lines = (await r.text()).trim().split('\n');
  const v = (lines[1] || '').split(',');
  const close = parseFloat(v[6]), open = parseFloat(v[3]);
  if (!close) throw new Error('stooq empty');
  return { price: close, prevClose: open, high: parseFloat(v[4]), low: parseFloat(v[5]), open, day: [], week: [], state: 'unknown', time: Date.now() / 1000, src: 'stooq' };
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const sym = url.searchParams.get('s') || '^JKSE';
  if (!ALLOW[sym]) return json({ error: 'symbol not allowed' }, 400);
  const cache = caches.default;
  const key = new Request(`${url.origin}${url.pathname}?s=${encodeURIComponent(sym)}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  let out;
  try {
    const [d, w] = await Promise.all([yahoo(sym, '1d', '5m'), yahoo(sym, '5d', '30m').catch(() => null)]);
    const m = d.meta, now = Date.now() / 1000, reg = m.currentTradingPeriod && m.currentTradingPeriod.regular;
    out = {
      name: ALLOW[sym], price: m.regularMarketPrice, prevClose: m.chartPreviousClose || m.previousClose,
      high: m.regularMarketDayHigh, low: m.regularMarketDayLow, open: d.pts.length ? d.pts[0][1] : null,
      day: d.pts, week: w ? w.pts : [],
      state: reg && now >= reg.start && now <= reg.end ? 'open' : 'closed',
      time: m.regularMarketTime, src: 'yahoo',
    };
  } catch (e) {
    try { out = Object.assign({ name: ALLOW[sym] }, await stooq(sym)); }
    catch (e2) { return json({ error: 'market data unavailable' }, 502); }
  }
  const res = json(out, 200, 60);
  await cache.put(key, res.clone());
  return res;
}
