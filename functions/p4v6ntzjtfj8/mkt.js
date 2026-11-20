// Apex market data proxy (Cloudflare Pages Function).
// Browsers can't call Yahoo Finance directly (no CORS), so this fetches it server-side and caches for 60s.
// Only allow-listed symbols, so it can't be used as an open proxy.
const ALLOW = { '^JKSE': 'IHSG', 'IDR=X': 'USD/IDR' };
const STOOQ = { '^JKSE': '^jkse', 'IDR=X': 'usdidr' };
// Travel currencies to rupiah (for card payments abroad, e.g. Paspor BCA in Japan).
['JPY', 'SGD', 'MYR', 'THB', 'KRW', 'CNY', 'HKD', 'TWD', 'AUD', 'EUR', 'GBP', 'CHF', 'SAR', 'AED'].forEach((c) => { ALLOW[c + 'IDR=X'] = c + '/IDR'; STOOQ[c + 'IDR=X'] = c.toLowerCase() + 'idr'; });

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

// Fresh second opinions for currency pairs (Yahoo's IDR=X quote sometimes freezes for hours).
async function stooqFresh(sym) {
  const r = await fetch(`https://stooq.com/q/l/?s=${encodeURIComponent(STOOQ[sym] || sym.toLowerCase())}&f=sd2t2ohlc&h&e=csv`);
  if (!r.ok) throw new Error('stooq ' + r.status);
  const v = ((await r.text()).trim().split('\n')[1] || '').split(',');
  const close = parseFloat(v[6]); if (!close || !v[1] || !v[2]) throw new Error('stooq empty');
  // Stooq times are Warsaw time (CET, UTC+1 in winter / UTC+2 in summer); take UTC+1, close enough to rank freshness.
  const t = Date.parse(v[1] + 'T' + v[2] + '+01:00') / 1000;
  return { price: close, time: t, src: 'stooq' };
}
async function geckoFresh(cur) {
  const c = cur.toLowerCase();
  const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr,${c}&include_last_updated_at=true`, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('gecko ' + r.status);
  const t = (await r.json()).tether; if (!t || !t.idr || !t[c]) throw new Error('gecko empty');
  return { price: Math.round(t.idr / t[c] * 100) / 100, time: t.last_updated_at || Date.now() / 1000, src: 'coingecko' };
}
function weekdayFxOpen(now) { const d = new Date(now * 1000), wd = d.getUTCDay(), h = d.getUTCHours(); return !(wd === 6 || (wd === 0 && h < 21) || (wd === 5 && h >= 22)); }

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
    // Currency pair with a frozen Yahoo quote during the trading week: use the freshest of Stooq / CoinGecko.
    if (/IDR=X$/.test(sym) && weekdayFxOpen(now) && now - (m.regularMarketTime || 0) > 30 * 60) {
      const cur = sym === 'IDR=X' ? 'USD' : sym.slice(0, 3);
      const errs = [];
      const alts = (await Promise.all([stooqFresh(sym).catch((e) => { errs.push(String(e && e.message || e)); return null; }), geckoFresh(cur).catch((e) => { errs.push(String(e && e.message || e)); return null; })])).filter(Boolean);
      out.check = { yahooAgeMin: Math.round((now - (m.regularMarketTime || 0)) / 60), alts: alts.map((x) => x.src + ' ' + x.price + ' @' + x.time), errs };
      const best = alts.sort((a, b) => b.time - a.time)[0];
      if (best && best.time > (m.regularMarketTime || 0)) {
        out.price = best.price; out.time = best.time; out.src = best.src; out.stale = 'yahoo';
        out.day = out.day.concat([[Math.round(best.time), best.price]]);
        out.high = Math.max(out.high || best.price, best.price); out.low = Math.min(out.low || best.price, best.price);
      }
    }
  } catch (e) {
    try { out = Object.assign({ name: ALLOW[sym] }, await stooq(sym)); }
    catch (e2) { return json({ error: 'market data unavailable' }, 502); }
  }
  const res = json(out, 200, 60);
  await cache.put(key, res.clone());
  return res;
}
