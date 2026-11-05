// KALENDER — widget iPhone gaya Hurricane (app Scriptable)
// Membaca app Kalender iPhone (termasuk Google Calendar bila akun Google sudah
// ditambahkan di Pengaturan → Apps → Calendar → Calendar Accounts).
// HANYA MEMBACA: tidak bisa menambah, mengubah atau menghapus acara.
// Ukuran: kecil · sedang · besar · layar kunci. Ketuk widget = buka Google Calendar.
// Pertama kali: jalankan script ini sekali dari app Scriptable lalu izinkan akses kalender.
// Versi 2026-11-03

const LANG = 'id'                               // 'en' = English · 'id' = Bahasa Indonesia
const OPEN = 'googlecalendar://'                // ganti 'calshow://' untuk app Kalender iPhone
const DAYS_AHEAD = 7
const C = {
  bg: new Color('#000000'), text: new Color('#f5f5f7'), dim: new Color('#8e8e93'),
  faint: new Color('#3a3a3c'), green: new Color('#30d158'), gold: new Color('#ffd426'), red: new Color('#ff453a')
}
const EN = LANG === 'en'
const HARI = EN ? ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] : ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']
const HR = EN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BLN = EN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const T = EN ? {
  cal: 'CALENDAR', today: 'TODAY', tomorrow: 'TOMORROW', allDay: 'All day', now: 'Now', untitled: '(No title)',
  none: 'No events in the next ' , noneEnd: ' days', more: ' more', then: 'Then ', noEvents: 'No events',
  perm: 'Open Scriptable, run this script once, then allow calendar access.'
} : {
  cal: 'KALENDER', today: 'HARI INI', tomorrow: 'BESOK', allDay: 'Seharian', now: 'Sekarang', untitled: '(Tanpa judul)',
  none: 'Tidak ada acara ', noneEnd: ' hari ke depan', more: ' acara lagi', then: 'Lalu ', noEvents: 'Tidak ada acara',
  perm: 'Buka app Scriptable, jalankan script ini sekali, lalu izinkan akses kalender.'
}
function dShort(d) { return EN ? HR[d.getDay()] + ', ' + BLN[d.getMonth()] + ' ' + d.getDate() : HR[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()] }

function p2(n) { return String(n).padStart(2, '0') }
function hm(d) { return p2(d.getHours()) + ':' + p2(d.getMinutes()) }
function dayStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate() }

/* ── data ────────────────────────────────────────────────────────── */
async function load() {
  const now = new Date(), t0 = dayStart(now), t1 = addDays(t0, DAYS_AHEAD + 1)
  const all = await CalendarEvent.between(t0, t1)
  const ev = all
    .filter(e => e.isAllDay ? e.endDate > t0 : e.endDate > now)          // yang sudah lewat hari ini dibuang
    .sort((a, b) => a.startDate - b.startDate)                              // acara seharian mulai 00:00 → tampil duluan di harinya
    .map(e => ({
      title: (e.title || T.untitled).trim(), start: e.startDate, end: e.endDate, allDay: e.isAllDay,
      where: e.location ? String(e.location).split('\n')[0] : '',
      color: e.calendar && e.calendar.color ? e.calendar.color : C.green
    }))
  return { now: now, ev: ev }
}
function dayLabel(d, now) {
  if (sameDay(d, now)) return T.today
  if (sameDay(d, addDays(now, 1))) return T.tomorrow
  return EN ? HARI[d.getDay()] + ', ' + BLN[d.getMonth()].toUpperCase() + ' ' + d.getDate() : HARI[d.getDay()] + ' ' + d.getDate() + ' ' + BLN[d.getMonth()].toUpperCase()
}
function when(e, now) {
  if (e.allDay) return T.allDay
  if (e.start <= now && e.end > now) return T.now
  return hm(e.start)
}
// acara yang sedang/akan berlangsung paling dekat (untuk layar kunci & jadwal refresh)
function nextEvent(x) { return x.ev.find(e => !e.allDay) || x.ev[0] || null }

/* ── potongan tampilan ───────────────────────────────────────────── */
function txt(stack, s, size, color, weight, shrink) {
  const t = stack.addText(s)
  t.font = weight === 'heavy' ? Font.heavySystemFont(size) : weight === 'bold' ? Font.boldSystemFont(size) : weight === 'semi' ? Font.semiboldSystemFont(size) : Font.mediumSystemFont(size)
  t.textColor = color
  t.lineLimit = 1
  if (shrink) t.minimumScaleFactor = shrink
  return t
}
function header(w, now, small) {
  const h = w.addStack(); h.layoutHorizontally(); h.centerAlignContent()
  const dot = h.addStack(); dot.size = new Size(7, 7); dot.cornerRadius = 3.5; dot.backgroundColor = C.green
  h.addSpacer(5)
  txt(h, T.cal, small ? 10 : 11, C.gold, 'heavy')
  h.addSpacer()
  txt(h, dShort(now), small ? 9 : 10, C.dim, 'medium')
}
function eventRow(s, e, now, size) {
  const r = s.addStack(); r.layoutHorizontally(); r.centerAlignContent()
  const bar = r.addStack(); bar.size = new Size(3, Math.round(size * 1.5)); bar.cornerRadius = 1.5; bar.backgroundColor = e.color
  r.addSpacer(7)
  const live = !e.allDay && e.start <= now && e.end > now
  const tw = r.addStack(); tw.size = new Size(Math.round(size * 4.9), 0)
  txt(tw, when(e, now), size - 1, live ? C.green : C.dim, 'bold', 0.7)
  txt(r, e.title, size, C.text, 'semi', 0.75)
  r.addSpacer()
}
function list(s, x, max, size, groups) {
  let n = 0, lastDay = ''
  for (const e of x.ev) {
    if (n >= max) break
    const lab = dayLabel(e.start < dayStart(x.now) ? x.now : e.start, x.now)   // mulai kemarin & masih berlangsung → HARI INI
    if (groups && lab !== lastDay) {
      if (lastDay) s.addSpacer(6)
      txt(s, lab, 9, lab === T.today ? C.green : C.dim, 'semi')
      s.addSpacer(4)
      lastDay = lab
    } else if (n) s.addSpacer(5)
    eventRow(s, e, x.now, size)
    n++
  }
  if (!n) { txt(s, T.none + DAYS_AHEAD + T.noneEnd, size, C.dim, 'medium', 0.7) }
  const more = x.ev.length - n
  if (more > 0) { s.addSpacer(5); txt(s, '+' + more + T.more, 10, C.dim, 'medium') }
}

/* ── widget per ukuran ───────────────────────────────────────────── */
function build(family, x, err) {
  const w = new ListWidget()
  w.url = OPEN
  const now = x ? x.now : new Date()
  const ne = x ? nextEvent(x) : null
  // perbarui saat acara berikutnya mulai/selesai, paling lambat 15 menit
  let at = Date.now() + 15 * 60e3
  if (ne && !ne.allDay) { const t = (ne.start > now ? ne.start : ne.end).getTime(); if (t > Date.now() + 60e3) at = Math.min(at, t + 30e3) }
  w.refreshAfterDate = new Date(at)
  const lock = String(family).indexOf('accessory') === 0
  if (!lock) w.backgroundColor = C.bg

  if (family === 'accessoryInline') {
    w.addText(ne ? when(ne, now) + ' ' + ne.title : T.noEvents)
    return w
  }
  if (family === 'accessoryCircular') {
    w.addAccessoryWidgetBackground = true
    const a = w.addText(HR[now.getDay()].toUpperCase()); a.font = Font.semiboldSystemFont(10); a.lineLimit = 1; a.centerAlignText()
    const b = w.addText(String(now.getDate())); b.font = Font.heavySystemFont(22); b.lineLimit = 1; b.centerAlignText()
    return w
  }
  if (family === 'accessoryRectangular') {
    const a = w.addText(ne ? dayLabel(ne.start < now ? now : ne.start, now) + ' · ' + when(ne, now) : T.cal); a.font = Font.heavySystemFont(11); a.lineLimit = 1
    const b = w.addText(ne ? ne.title : T.noEvents); b.font = Font.boldSystemFont(15); b.lineLimit = 1; b.minimumScaleFactor = 0.6
    const nx = x && ne ? x.ev[x.ev.indexOf(ne) + 1] : null
    const c = w.addText(nx ? T.then + when(nx, now) + ' ' + nx.title : ''); c.font = Font.mediumSystemFont(11); c.lineLimit = 1; c.minimumScaleFactor = 0.7
    return w
  }

  const small = family === 'small'
  w.setPadding(small ? 13 : 15, small ? 14 : 16, small ? 12 : 14, small ? 14 : 16)
  if (err) {
    header(w, now, small)
    w.addSpacer()
    txt(w, T.perm, 11, C.dim, 'medium').lineLimit = 4
    w.addSpacer()
    return w
  }
  if (small) {
    txt(w, HARI[now.getDay()], 10, C.gold, 'heavy')
    txt(w, String(now.getDate()), 34, C.text, 'heavy')
    w.addSpacer(4)
    list(w, x, 2, 11, false)
    w.addSpacer()
    return w
  }
  if (family === 'medium') {
    const row = w.addStack(); row.layoutHorizontally(); row.topAlignContent()
    const left = row.addStack(); left.layoutVertically(); left.size = new Size(92, 0)
    txt(left, HARI[now.getDay()], 11, C.gold, 'heavy')
    txt(left, String(now.getDate()), 44, C.text, 'heavy')
    txt(left, BLN[now.getMonth()] + ' ' + now.getFullYear(), 11, C.dim, 'medium')
    row.addSpacer(12)
    const right = row.addStack(); right.layoutVertically()
    list(right, x, 4, 12, true)
    w.addSpacer()
    return w
  }
  header(w, now, false)
  w.addSpacer(12)
  list(w, x, 9, 13, true)
  w.addSpacer()
  return w
}

let x = null, err = null
try { x = await load() } catch (e) { err = e }
const family = config.widgetFamily || (args.widgetParameter || 'medium')
const widget = build(family, x, err)
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  if (family === 'small') await widget.presentSmall()
  else if (family === 'large') await widget.presentLarge()
  else await widget.presentMedium()
}
Script.complete()
