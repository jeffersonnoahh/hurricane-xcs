// HURRICANE XCS — widget iPhone (app Scriptable)
// Angka langsung dari Firebase dashboard (HANYA MEMBACA, tidak pernah menulis).
// Ukuran: kecil · sedang · besar · layar kunci (persegi panjang / satu baris / lingkaran).
// Ketuk widget = buka dashboard. iOS yang menentukan jadwal pembaruan (biasanya ±15–60 menit).
// Versi 2026-11-03

const DB = 'https://hurricane-scorecard-default-rtdb.firebaseio.com'
const NS = ''                                   // '' = Hurricane · 'maria/' · 'calvin/'
const BRAND = 'HURRICANE'
const DASH = 'https://hurricane-xcs.pages.dev/'
const CHANNELS = ['tokopedia', 'shopee', 'shopee live', 'live tiktok', 'tiktok']
const NOT_SALES = ['agung', 'valen', 'livia', 'melda', 'sales 1']   // team lead / admin / tes
const CACHE = 'hurricane-widget-cache.json'

const C = {
  bg: new Color('#000000'), card: new Color('#141416'), text: new Color('#f5f5f7'),
  dim: new Color('#8e8e93'), faint: new Color('#3a3a3c'), green: new Color('#30d158'),
  gold: new Color('#ffd426'), red: new Color('#ff453a')
}
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/* ── angka & tanggal ─────────────────────────────────────────────── */
function fdec(c) { const w = Math.floor(c / 100), f = c % 100; return f ? w + ',' + String(f).padStart(2, '0') : String(w) }
function rp(n) {                                // sama dengan dashboard: 109,27jt · 3,36M · 850rb
  n = +n || 0; const a = Math.abs(n), s = n < 0 ? '-' : ''
  if (a >= 999995000) return s + fdec(Math.round(a / 1e7)) + 'M'
  if (a >= 999500) return s + fdec(Math.round(a / 1e4)) + 'jt'
  if (a >= 1000) return s + Math.round(a / 1e3) + 'rb'
  return String(Math.round(n))
}
function p2(n) { return String(n).padStart(2, '0') }
function wibNow() { return new Date(Date.now() + 7 * 3600e3) }          // baca dengan getUTC*
function key(d) { return d.getUTCFullYear() + '-' + p2(d.getUTCMonth() + 1) + '-' + p2(d.getUTCDate()) }
function addDays(d, n) { return new Date(d.getTime() + n * 864e5) }
function list(v) { return Array.isArray(v) ? v.filter(Boolean) : v && typeof v === 'object' ? Object.keys(v).map(k => v[k]).filter(Boolean) : [] }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase() }
function isPerson(sp) { const n = norm(sp); return !!n && CHANNELS.indexOf(n) < 0 && NOT_SALES.indexOf(n) < 0 }

/* ── data ────────────────────────────────────────────────────────── */
async function getJSON(path) {
  const r = new Request(DB + '/' + NS + path)
  r.timeoutInterval = 20
  const j = await r.loadJSON()
  // Firebase menolak (mis. HTTP 400 {"error":…}) → anggap gagal, supaya angka terakhir yang benar tetap dipakai
  const code = r.response && r.response.statusCode
  if ((code && code >= 400) || (j && typeof j === 'object' && !Array.isArray(j) && j.error)) throw new Error('Firebase ' + (code || '') + ' ' + (j && j.error || ''))
  return j
}
async function load() {
  const now = wibNow(), K = key(now)
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate()
  const monthStart = K.slice(0, 8) + '01'
  const pm = new Date(Date.UTC(y, m - 1, 1)), pmDays = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const prevStart = key(pm), prevSame = key(new Date(Date.UTC(y, m - 1, Math.min(d, pmDays))))
  const chartStart = key(addDays(now, -13))
  const start = prevStart < chartStart ? prevStart : chartStart
  const q = 'scores.json?orderBy=' + encodeURIComponent('"$key"') + '&startAt=' + encodeURIComponent('"' + start + '"') + '&endAt=' + encodeURIComponent('"' + K + '"')
  const [scores, target] = await Promise.all([getJSON(q), getJSON('config/revTarget.json').catch(() => null)])
  const days = {}, people = {}
  let todayCloses = 0
  Object.keys(scores || {}).forEach(k => {
    list(scores[k]).forEach(e => {
      const rev = +e.revenue || 0
      days[k] = (days[k] || 0) + rev
      if (k === K) {
        todayCloses += +e.units || 1
        if (isPerson(e.sp)) { const n = String(e.sp).trim(); people[n] = (people[n] || 0) + rev }
      }
    })
  })
  const sum = (a, b) => Object.keys(days).filter(k => k >= a && k <= b).reduce((s, k) => s + days[k], 0)
  const month = sum(monthStart, K), prev = sum(prevStart, prevSame)
  const series = []
  for (let i = 13; i >= 0; i--) { const k = key(addDays(now, -i)); series.push({ k: k, v: days[k] || 0 }) }
  const top = Object.keys(people).map(n => ({ n: n, v: people[n] })).sort((a, b) => b.v - a.v).slice(0, 5)
  return {
    at: Date.now(), K: K, today: days[K] || 0, target: +target || 150e6, todayCloses: todayCloses,
    month: month, prev: prev, delta: prev > 0 ? month / prev - 1 : null,
    monthLabel: BLN[m] + ' ' + y, prevLabel: '1–' + Math.min(d, pmDays) + ' ' + BLN[pm.getUTCMonth()],
    series: series, top: top
  }
}
function cachePath() { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), CACHE) }
async function data() {
  try {
    const x = await load()
    try { FileManager.local().writeString(cachePath(), JSON.stringify(x)) } catch (e) { }
    return x
  } catch (e) {
    try {
      const fm = FileManager.local(), p = cachePath()
      if (fm.fileExists(p)) { const x = JSON.parse(fm.readString(p)); x.stale = true; return x }
    } catch (er) { }
    return null
  }
}

/* ── ukuran widget menurut lebar layar (pt) ────────────────────────── */
function dims() {
  let W = 390
  try { const s = Device.screenSize(); W = Math.min(s.width, s.height) } catch (e) { }
  if (W >= 428) return { s: 170, m: 364, lh: 382 }
  if (W >= 414) return { s: 169, m: 360, lh: 379 }
  if (W >= 390) return { s: 158, m: 338, lh: 354 }
  if (W >= 375) return { s: 155, m: 329, lh: 345 }
  return { s: 148, m: 321, lh: 324 }
}

/* ── gambar kecil (progress & grafik) ────────────────────────────── */
function bar(w, h, frac, color) {
  const dc = new DrawContext()
  dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true
  const bg = new Path(); bg.addRoundedRect(new Rect(0, 0, w, h), h / 2, h / 2)
  dc.addPath(bg); dc.setFillColor(C.faint); dc.fillPath()
  const f = Math.max(0, Math.min(1, frac))
  if (f > 0) {
    const fg = new Path(); fg.addRoundedRect(new Rect(0, 0, Math.max(h, w * f), h), h / 2, h / 2)
    dc.addPath(fg); dc.setFillColor(color); dc.fillPath()
  }
  return dc.getImage()
}
function chart(w, h, series, target) {
  const dc = new DrawContext()
  dc.size = new Size(w, h); dc.opaque = false; dc.respectScreenScale = true
  const max = Math.max(target || 0, ...series.map(s => s.v), 1), n = series.length, gap = 4
  const bw = (w - gap * (n - 1)) / n
  if (target) {                                   // garis target harian
    const ty = h - (target / max) * h
    const tl = new Path(); tl.addRect(new Rect(0, Math.max(0, ty - 0.5), w, 1))
    dc.addPath(tl); dc.setFillColor(new Color('#ffd426', 0.55)); dc.fillPath()
  }
  series.forEach((s, i) => {
    const bh = s.v > 0 ? Math.max(3, (s.v / max) * h) : 2
    const x = i * (bw + gap), last = i === n - 1
    const p = new Path(); p.addRoundedRect(new Rect(x, h - bh, bw, bh), Math.min(3, bw / 2), Math.min(3, bw / 2))
    dc.addPath(p)
    dc.setFillColor(s.v <= 0 ? C.faint : last ? C.green : (target && s.v >= target ? C.gold : new Color('#30d158', 0.42)))
    dc.fillPath()
  })
  return dc.getImage()
}

/* ── potongan tampilan ───────────────────────────────────────────── */
function txt(stack, s, size, color, weight, opts) {
  const t = stack.addText(s)
  t.font = weight === 'heavy' ? Font.heavySystemFont(size) : weight === 'bold' ? Font.boldSystemFont(size) : weight === 'semi' ? Font.semiboldSystemFont(size) : Font.mediumSystemFont(size)
  t.textColor = color
  t.lineLimit = 1
  if (opts && opts.shrink) t.minimumScaleFactor = opts.shrink
  return t
}
function header(w, x, small) {
  const h = w.addStack(); h.layoutHorizontally(); h.centerAlignContent()
  const dot = h.addStack(); dot.size = new Size(7, 7); dot.cornerRadius = 3.5
  dot.backgroundColor = x && !x.stale ? C.green : C.dim
  h.addSpacer(5)
  txt(h, BRAND, small ? 10 : 11, C.gold, 'heavy')
  h.addSpacer()
  if (x) txt(h, (x.stale ? 'offline · ' : '') + timeLabel(x.at), small ? 9 : 10, C.dim, 'medium')
}
function timeLabel(ms) { const d = new Date(ms + 7 * 3600e3); return p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()) }
function todayBlock(s, x, big, barW) {
  txt(s, 'OMZET HARI INI', 9, C.dim, 'semi')
  s.addSpacer(2)
  txt(s, 'Rp ' + rp(x.today), big, C.text, 'heavy', { shrink: 0.5 })
  s.addSpacer(6)
  const pct = x.target ? x.today / x.target : 0
  s.addImage(bar(barW, 6, pct, pct >= 1 ? C.gold : C.green)).imageSize = new Size(barW, 6)
  s.addSpacer(4)
  const r = s.addStack(); r.layoutHorizontally()
  txt(r, Math.round(pct * 100) + '%', 11, pct >= 1 ? C.gold : C.green, 'bold')
  txt(r, ' dari ' + rp(x.target) + ' · ' + x.todayCloses + ' closing', 11, C.dim, 'medium', { shrink: 0.7 })
}
function monthLine(s, x, size) {
  const r = s.addStack(); r.layoutHorizontally(); r.centerAlignContent()
  txt(r, 'Bulan ini ', size, C.dim, 'medium')
  txt(r, 'Rp ' + rp(x.month), size, C.text, 'bold', { shrink: 0.7 })
  if (x.delta != null) {
    const up = x.delta >= 0
    txt(r, '  ' + (up ? '▲' : '▼') + Math.abs(Math.round(x.delta * 100)) + '%', size, up ? C.green : C.red, 'bold')
  }
}
function topList(s, x, n, size) {
  txt(s, 'TOP HARI INI', 9, C.dim, 'semi')
  s.addSpacer(4)
  if (!x.top.length) { txt(s, 'Belum ada closing', size, C.dim, 'medium'); return }
  x.top.slice(0, n).forEach((t, i) => {
    const r = s.addStack(); r.layoutHorizontally(); r.centerAlignContent()
    txt(r, String(i + 1).padStart(2, '0') + ' ', size, i === 0 ? C.gold : C.dim, 'bold')
    txt(r, t.n, size, C.text, 'semi', { shrink: 0.7 })
    r.addSpacer()
    txt(r, rp(t.v), size, C.green, 'bold')
    if (i < n - 1) s.addSpacer(3)
  })
}

/* ── widget per ukuran ───────────────────────────────────────────── */
function build(family, x) {
  const w = new ListWidget()
  w.url = DASH
  w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000)
  if (String(family).indexOf('accessory') !== 0) w.backgroundColor = C.bg   // layar kunci: latar dari iOS

  if (family === 'accessoryInline') {
    w.addText(x ? 'Rp ' + rp(x.today) + ' · ' + Math.round(x.today / x.target * 100) + '% target' : 'Hurricane: tidak ada data')
    return w
  }
  if (family === 'accessoryCircular') {
    // teks langsung di widget (rata tengah tidak berlaku untuk teks di dalam stack)
    w.addAccessoryWidgetBackground = true
    const t1 = w.addText(x ? Math.round(x.today / x.target * 100) + '%' : '—'); t1.font = Font.boldSystemFont(16); t1.lineLimit = 1; t1.minimumScaleFactor = 0.6; t1.centerAlignText()
    const t2 = w.addText(x ? rp(x.today) : ''); t2.font = Font.mediumSystemFont(9); t2.lineLimit = 1; t2.minimumScaleFactor = 0.6; t2.centerAlignText()
    return w
  }
  if (family === 'accessoryRectangular') {
    const a = w.addText(BRAND + (x ? ' · ' + Math.round(x.today / x.target * 100) + '%' : '')); a.font = Font.heavySystemFont(11); a.lineLimit = 1
    const b = w.addText(x ? 'Rp ' + rp(x.today) + ' hari ini' : 'Tidak ada data'); b.font = Font.boldSystemFont(15); b.lineLimit = 1; b.minimumScaleFactor = 0.6
    const c = w.addText(x ? 'Bulan Rp ' + rp(x.month) + (x.delta != null ? (x.delta >= 0 ? ' ▲' : ' ▼') + Math.abs(Math.round(x.delta * 100)) + '%' : '') : ''); c.font = Font.mediumSystemFont(11); c.lineLimit = 1; c.minimumScaleFactor = 0.7
    return w
  }

  const small = family === 'small', D = dims()
  w.setPadding(small ? 13 : 15, small ? 14 : 16, small ? 12 : 14, small ? 14 : 16)
  header(w, x, small)
  if (!x) { w.addSpacer(); txt(w, 'Tidak bisa memuat data. Coba lagi nanti.', 12, C.dim, 'medium'); w.addSpacer(); return w }
  w.addSpacer(small ? 8 : 10)

  if (small) {
    todayBlock(w, x, 26, D.s - 28)
    w.addSpacer()
    monthLine(w, x, 10)
    return w
  }
  if (family === 'medium') {
    const row = w.addStack(); row.layoutHorizontally(); row.topAlignContent()
    const left = row.addStack(); left.layoutVertically(); left.size = new Size(150, 0)
    todayBlock(left, x, 26, 146)
    left.addSpacer(8)
    monthLine(left, x, 10)
    row.addSpacer(14)
    const right = row.addStack(); right.layoutVertically()
    topList(right, x, 3, 11)
    w.addSpacer()
    return w
  }
  // besar (large / extraLarge) — tinggi menyesuaikan HP: Pro Max/Plus/Duo muat 5 nama + grafik 60 pt
  const roomy = D.lh >= 379, cw = D.m - 32, gh = roomy ? 60 : 46
  todayBlock(w, x, roomy ? 34 : 30, cw)
  w.addSpacer(roomy ? 12 : 9)
  monthLine(w, x, 12)
  txt(w, 'vs ' + x.prevLabel + ' (hari yang sama) Rp ' + rp(x.prev), 10, C.dim, 'medium', { shrink: 0.7 })
  w.addSpacer(roomy ? 12 : 9)
  txt(w, '14 HARI TERAKHIR', 9, C.dim, 'semi')
  w.addSpacer(5)
  w.addImage(chart(cw, gh, x.series, x.target)).imageSize = new Size(cw, gh)
  w.addSpacer(roomy ? 12 : 9)
  topList(w, x, roomy ? 5 : 4, 12)
  w.addSpacer()
  return w
}

const x = await data()
const family = config.widgetFamily || (args.widgetParameter || 'medium')
const widget = build(family, x)
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  // dijalankan dari app: tampilkan pratinjau
  if (family === 'small') await widget.presentSmall()
  else if (family === 'large') await widget.presentLarge()
  else await widget.presentMedium()
}
Script.complete()
