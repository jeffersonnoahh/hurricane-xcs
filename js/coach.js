/* ══════════════════════════════════════════════════════════════════════
   COACH (js/coach.js + css/coach.css)
   One screen that tells a seller how they are doing and what to do today,
   or tells a leader how the team is doing and who needs help.

   Data (all read only, nothing is written to Firebase from here):
     scores / activities   dashboard records (app.js globals allData/allActs)
     config/teams          live roster (TM)
     coach/crm             CRM summary per seller, written every 30 min by
                           .github/scripts/coach_crm.py (Sentaris WhatsApp chats)
   AI: POST /api/coach (functions/api/coach.js) → command center → Claude.

   Who is looking: the phone owner saved by Form Closing (localStorage
   hx-closing-me = "sp|team" or "@leader|TeamA,TeamB"). No owner yet → picker.
   "Lihat orang lain" views someone else without changing the phone owner.
   Only per phone convenience goes to localStorage (ticked to do items).
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__hxCoach) return;
  window.__hxCoach = true;

  var D = document, W = window;
  var ME_KEY = 'hx-closing-me', LEAD = '@leader';
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var ORG_LEAD = { maria: 'Maria', calvin: 'Calvin' };
  var CRM = null, crmListening = false;
  var view = null;          // {leader:true, teams:[..]} | {sp, team}
  var stack = [];           // back navigation (leader → member)
  var aiCache = {};

  /* ── small helpers ─────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function roster() { try { return TM || {}; } catch (e) { return {}; } }
  function scores() { try { return allData || {}; } catch (e) { return {}; } }
  function acts() { try { return allActs || {}; } catch (e) { return {}; } }
  function list(v) { return Array.isArray(v) ? v.filter(Boolean) : v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean) : []; }
  function thr() { try { return _warnThresh || {}; } catch (e) { return {}; } }
  function T() { var t = thr(); return { rev: t.rev || 50000000, chats: t.chats || 7, calls: t.calls || 7, fups: t.fups || 15 }; }
  function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function rpS(n) { n = Math.round(n || 0); if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1).replace('.', ',') + ' M'; if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1).replace('.', ',') + ' jt'; if (n >= 1e3) return 'Rp ' + Math.round(n / 1e3) + ' rb'; return 'Rp ' + n; }
  function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0; }
  function one(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }
  function org() { try { return typeof W.DATA_NS === 'string' ? W.DATA_NS : ''; } catch (e) { return ''; } }
  function isExcluded(sp) {
    if (/shopee|tokopedia|tiktok|lazada|blibli/i.test(String(sp || ''))) return true;
    try { if (_isActExcluded(sp)) return true; } catch (e) { }
    try { if (_isWarnExcluded(sp)) return true; } catch (e) { }
    return false;
  }
  function isLeaderName(sp) { try { return _isLeader(sp); } catch (e) { return false; } }
  function median(a) { a = a.filter(function (x) { return x != null && !isNaN(x); }).sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : null; }
  function deadlineHour() { var h = parseInt((W._cfgDeadline || 14), 10); return isNaN(h) ? 14 : h; }

  /* ── who ───────────────────────────────────────────────────────── */
  function leadBase(t) { return String(t || '').replace(/\s+[A-Z]$/, ''); }
  function leadName(t) { return ORG_LEAD[org()] || leadBase(t); }
  function leaderGroups() {
    var out = [], idx = {};
    Object.keys(roster()).forEach(function (t) { var k = leadName(t); if (!(k in idx)) { idx[k] = out.length; out.push({ name: k, teams: [] }); } out[idx[k]].teams.push(t); });
    return out;
  }
  function members(team) { return ((roster()[team] || {}).m || []).filter(function (sp) { return sp && !isExcluded(sp) && !isLeaderName(sp); }); }
  function teamOf(sp) { var R = roster(), n = norm(sp); for (var t in R) if (((R[t] || {}).m || []).some(function (m) { return norm(m) === n; })) return t; return ''; }
  function owner() {
    var v = store(ME_KEY); if (!v) return null; var p = v.split('|');
    if (p[0] === LEAD) {
      var ts = String(p[1] || '').split(',').filter(Boolean);
      if (!ts.length) return null;
      var g = leaderGroups().filter(function (x) { return x.name === leadName(ts[0]); })[0];
      return { leader: true, teams: g ? g.teams.slice() : ts };
    }
    var team = p[1] && roster()[p[1]] ? p[1] : teamOf(p[0]);
    return team ? { sp: p[0], team: team } : null;
  }

  /* ── record matching (same idea as the Warning page) ───────────── */
  function resolver() {
    var byKey = {}, byName = {};
    Object.keys(roster()).forEach(function (t) {
      ((roster()[t] || {}).m || []).forEach(function (sp) {
        var k = sp + '|' + t; byKey[norm(sp) + '|' + norm(t)] = k;
        var n = norm(sp); byName[n] = byName[n] === undefined ? k : null;
      });
    });
    return function (sp, team) { return byKey[norm(sp) + '|' + norm(team)] || byName[norm(sp)] || null; };
  }

  /* one pass over the records → per person stats for this month and the last 7 days */
  function buildStats() {
    var now = new Date(), today = dkey(now);
    var mFrom = dkey(new Date(now.getFullYear(), now.getMonth(), 1));
    var yest = addDays(now, -1);
    var wTo = dkey(yest), wFrom = dkey(addDays(yest, -6));
    // days whose report is already due (report for day D is due D+1 at the deadline hour)
    var due = [];
    for (var i = 1; i <= 7; i++) {
      var d = addDays(now, -i);
      if (i === 1 && now.getHours() < deadlineHour()) continue;
      due.push(dkey(d));
    }
    var res = resolver(), S = {};
    function get(k) {
      if (!S[k]) { var p = k.split('|'); S[k] = { sp: p[0], team: p[1], m: { rev: 0, closes: 0, td: 0, cross: 0, upsell: 0, chats: 0, calls: 0, fups: 0, ids: {} }, w: { chats: 0, calls: 0, fups: 0, days: {}, late: 0 }, today: { rev: 0, closes: 0, ids: {} } }; }
      return S[k];
    }
    var sc = scores();
    Object.keys(sc).forEach(function (k) {
      if (k < mFrom || k > today) return;
      list(sc[k]).forEach(function (e, i) {
        if (typeof e !== 'object') return;
        var key = res(e.sp, e.team); if (!key) return;
        var s = get(key), id = e.orderId || e.ts || (k + ':' + i), types = Array.isArray(e.saleType) ? e.saleType : [];
        s.m.rev += +e.revenue || 0;
        if (!s.m.ids[id]) { s.m.ids[id] = 1; s.m.closes++; if (types.indexOf('testdrive') >= 0) s.m.td++; }
        if (types.indexOf('cross') >= 0) s.m.cross++;
        if (types.indexOf('upsell') >= 0) s.m.upsell++;
        if (k === today) { s.today.rev += +e.revenue || 0; if (!s.today.ids[id]) { s.today.ids[id] = 1; s.today.closes++; } }
      });
    });
    var ac = acts();
    Object.keys(ac).forEach(function (k) {
      var inM = k >= mFrom && k <= today, inW = k >= wFrom && k <= wTo;
      if (!inM && !inW) return;
      list(ac[k]).forEach(function (a) {
        if (typeof a !== 'object') return;
        var key = res(a.sp, a.team); if (!key) return;
        var s = get(key);
        if (inM) { s.m.chats += +a.chats || 0; s.m.calls += +a.calls || 0; s.m.fups += +a.fups || 0; }
        if (inW) { s.w.chats += +a.chats || 0; s.w.calls += +a.calls || 0; s.w.fups += +a.fups || 0; s.w.days[k] = 1; if (a.isLate) s.w.late++; }
      });
    });
    return { S: S, due: due, dayOfMonth: now.getDate(), daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), month: BLN[now.getMonth()] + ' ' + now.getFullYear() };
  }

  function crmFor(sp, team) {
    if (!CRM || !CRM.sellers) return null;
    var hit = null;
    Object.keys(CRM.sellers).forEach(function (k) { var v = CRM.sellers[k]; if (v && norm(v.sp) === norm(sp) && norm(v.team) === norm(team)) hit = v; });
    if (hit) return hit;
    Object.keys(CRM.sellers).forEach(function (k) { var v = CRM.sellers[k]; if (!hit && v && norm(v.sp) === norm(sp)) hit = v; });
    return hit;
  }

  /* ── evaluation of one seller ───────────────────────────────────── */
  function evaluate(sp, team, ST) {
    var t = T(), s = ST.S[sp + '|' + team] || { m: { rev: 0, closes: 0, td: 0, cross: 0, upsell: 0, chats: 0, calls: 0, fups: 0 }, w: { chats: 0, calls: 0, fups: 0, days: {}, late: 0 }, today: { rev: 0, closes: 0 } };
    var days = Object.keys(s.w.days).length || 0;
    var missed = ST.due.filter(function (d) { return !s.w.days[d]; }).length;
    var avg = { chats: days ? s.w.chats / days : 0, calls: days ? s.w.calls / days : 0, fups: days ? s.w.fups / days : 0 };
    var cb = Math.min(100, pct(s.w.calls, s.w.chats)), cbMonth = Math.min(100, pct(s.m.calls, s.m.chats));
    var cr = s.m.chats ? s.m.closes / s.m.chats * 100 : 0;
    var paceTarget = t.rev * ST.dayOfMonth / ST.daysInMonth;
    var ticket = s.m.closes ? s.m.rev / s.m.closes : 0;
    var crm = crmFor(sp, team);

    // team comparison
    var peers = members(team).map(function (m) { var x = ST.S[m + '|' + team]; return x || null; }).filter(Boolean);
    var tCr = median(peers.filter(function (x) { return x.m.chats >= 20; }).map(function (x) { return x.m.closes / x.m.chats * 100; }));
    var tCb = median(peers.filter(function (x) { return x.w.chats >= 10; }).map(function (x) { return Math.min(100, x.w.calls / x.w.chats * 100); }));
    var tTicket = median(peers.filter(function (x) { return x.m.closes; }).map(function (x) { return x.m.rev / x.m.closes; }));
    var tTd = peers.some(function (x) { return x.m.td > 0; });

    // score out of 100
    function part(v, target, w) { return Math.max(0, Math.min(1, target > 0 ? v / target : 1)) * w; }
    var score = Math.round(
      part(s.m.rev, paceTarget, 30) +
      part(avg.calls, t.calls, 18) +
      part(avg.chats, t.chats, 12) +
      part(avg.fups, t.fups, 12) +
      part(cb, 50, 13) +
      part(ST.due.length - missed, ST.due.length || 1, 10) +
      (crm && crm.c ? part(Math.max(0, 6 - (crm.c.waiting2h || 0)), 6, 5) : 5)
    );

    var gaps = [];   // {sev 0..1, t: title, why: explanation, todo: action}
    if (missed >= 2) gaps.push({ sev: Math.min(1, missed / 4), k: 'report', t: 'Laporan bolong ' + missed + ' hari', why: 'Dari ' + ST.due.length + ' hari terakhir, ' + missed + ' hari tidak ada laporan Calls & Follow Up. Tanpa laporan, kerja kamu tidak kelihatan.', todo: 'Isi laporan Calls & Follow Up setiap hari, paling lambat jam ' + deadlineHour() + ':00 besoknya' });
    if (days && avg.calls < t.calls) gaps.push({ sev: 1 - avg.calls / t.calls, k: 'calls', t: 'Telepon kurang', why: 'Rata rata ' + one(avg.calls) + ' telepon per hari, standar minimal ' + t.calls + '. Telepon adalah jalan tercepat dari chat ke closing.', todo: 'Telepon balik minimal ' + t.calls + ' customer hari ini' });
    if (s.w.chats >= 10 && cb < 30) gaps.push({ sev: 0.9 - cb / 100, k: 'cb', t: 'Callback rendah (' + cb + '%)', why: 'Dari setiap 10 chat, cuma ' + Math.round(cb / 10) + ' yang kamu telepon' + (tCb != null ? ' (tim kamu ' + Math.round(tCb) + '%)' : '') + '. Lead yang tidak ditelepon cepat dingin.', todo: 'Telepon setiap chat baru dalam 1 jam pertama' });
    if (days && avg.chats < t.chats) gaps.push({ sev: (1 - avg.chats / t.chats) * 0.7, k: 'chats', t: 'Chat masuk sedikit', why: 'Rata rata ' + one(avg.chats) + ' chat per hari (standar ' + t.chats + '). Bisa karena iklan sepi atau chat lama tidak digarap.', todo: 'Cek iklan kamu bersama leader dan sapa ulang chat lama' });
    if (days && avg.fups < t.fups) gaps.push({ sev: (1 - avg.fups / t.fups) * 0.8, k: 'fups', t: 'Follow up kurang', why: 'Rata rata ' + one(avg.fups) + ' follow up per hari, standar ' + t.fups + '. Banyak closing datang di follow up ke 3 sampai 5.', todo: 'Follow up ' + t.fups + ' customer lama yang belum beli' });
    if (s.m.chats >= 20 && tCr != null && cr < tCr * 0.8) gaps.push({ sev: Math.min(0.9, 1 - cr / Math.max(tCr, 0.1)), k: 'cr', t: 'Closing rate di bawah tim', why: 'Closing rate kamu ' + one(cr) + '%, median tim ' + one(tCr) + '%. Chat sudah ada, yang bocor di cara closing.', todo: 'Ajak customer test drive dan tanya langsung apa yang bikin ragu' });
    if (s.m.rev < paceTarget * 0.85) {
      var gap = paceTarget - s.m.rev, tk = ticket || tTicket || 3000000;
      gaps.push({ sev: Math.min(1, gap / paceTarget) * 0.95, k: 'rev', t: 'Omzet di bawah jalur', why: 'Omzet bulan ini ' + rpS(s.m.rev) + ', seharusnya sekitar ' + rpS(paceTarget) + ' di tanggal ' + ST.dayOfMonth + ' (target ' + rpS(t.rev) + '/bulan). Kurang ' + rpS(gap) + ', kira kira ' + Math.max(1, Math.ceil(gap / tk)) + ' closing lagi.', todo: 'Kejar ' + Math.max(1, Math.ceil(gap / tk / Math.max(1, ST.daysInMonth - ST.dayOfMonth + 1) * 2) / 2).toString().replace('.', ',') + ' closing per hari sampai akhir bulan' });
    }
    if (!s.m.td && tTd && s.m.chats >= 15) gaps.push({ sev: 0.35, k: 'td', t: 'Belum ada test drive', why: 'Bulan ini belum ada closing lewat test drive, padahal rekan setim sudah.', todo: 'Tawarkan test drive ke 3 customer yang masih ragu' });
    if (crm && crm.c) {
      if ((crm.c.waiting2h || 0) >= 3) gaps.push({ sev: Math.min(1, crm.c.waiting2h / 10), k: 'wait', t: crm.c.waiting2h + ' customer menunggu balasan', why: 'Di CRM ada ' + crm.c.waiting2h + ' chat yang pesan terakhirnya dari customer dan belum dibalas lebih dari 2 jam.', todo: 'Balas semua chat yang menunggu sebelum mulai chat baru' });
      if (crm.c.replyMed != null && crm.c.replyMed > 15 && (crm.c.replyN || 0) >= 5) gaps.push({ sev: Math.min(0.8, crm.c.replyMed / 120), k: 'speed', t: 'Balas chat lambat (' + crm.c.replyMed + ' menit)', why: 'Rata rata kamu butuh ' + crm.c.replyMed + ' menit untuk membalas. Customer yang dibalas di bawah 5 menit jauh lebih sering beli.', todo: 'Targetkan balas chat di bawah 5 menit' });
    }
    gaps.sort(function (a, b) { return b.sev - a.sev; });

    var good = [];
    if (s.m.rev >= paceTarget) good.push('Omzet di atas jalur target');
    if (days && avg.calls >= t.calls) good.push('Telepon sudah sesuai standar');
    if (s.w.chats >= 10 && cb >= 50) good.push(cb >= 100 ? 'Semua chat ditelepon balik' : 'Callback ' + cb + '%, mantap');
    if (s.m.chats >= 20 && tCr != null && cr >= tCr * 1.2) good.push('Closing rate di atas tim');
    if (ST.due.length && !missed) good.push('Laporan rapi tiap hari');
    if (crm && crm.c && crm.c.replyMed != null && crm.c.replyMed <= 5 && crm.c.replyN >= 5) good.push('Balas chat cepat (' + crm.c.replyMed + ' menit)');

    return { sp: sp, team: team, s: s, days: days, missed: missed, avg: avg, cb: cb, cbMonth: cbMonth, cr: cr, paceTarget: paceTarget, ticket: ticket, score: score, gaps: gaps, good: good, crm: crm, tCr: tCr, tCb: tCb, t: t, ST: ST };
  }

  function tone(score) { return score >= 80 ? { c: 'g', l: 'Kondisi bagus' } : score >= 60 ? { c: 'y', l: 'Perlu dorongan' } : { c: 'r', l: 'Butuh perhatian' }; }

  /* ── to do list ─────────────────────────────────────────────────── */
  var KLBL = { reply: 'Balas', push: 'Dorong closing', fup: 'Follow up' };
  var SLBL = { hot: 'Hot', warm: 'Warm', td: 'Test drive', baru: 'Baru', cold: 'Cold', complaint: 'Komplain', cek: 'Pengecekan', luar: 'Luar kota', other: '' };
  function ago(h) { return h < 1 ? Math.max(1, Math.round(h * 60)) + ' menit' : h < 48 ? Math.round(h) + ' jam' : Math.round(h / 24) + ' hari'; }
  function todos(ev) {
    var out = [];
    ((ev.crm && ev.crm.t) || []).slice(0, 8).forEach(function (x) {
      var why = x.k === 'reply' ? 'menunggu balasan ' + ago(x.h) : x.k === 'push' ? 'lead ' + (SLBL[x.s] || '') + ', sepi ' + ago(x.h) : 'tidak membalas ' + ago(x.h);
      out.push({ id: 'c:' + x.k + ':' + x.n + ':' + x.w, crm: true, hot: x.s === 'hot' || x.s === 'td' || x.s === 'warm', t: KLBL[x.k] + ' ' + x.n + (x.w ? ' (…' + x.w + ')' : ''), sub: why + (x.s && SLBL[x.s] && x.k !== 'push' ? ' · ' + SLBL[x.s] : '') });
    });
    ev.gaps.slice(0, 4).forEach(function (g) { out.push({ id: 'g:' + g.k, t: g.todo, sub: g.t }); });
    if (!out.length) out.push({ id: 'g:keep', t: 'Pertahankan ritme: balas cepat, telepon, follow up', sub: 'Semua indikator aman' });
    return out;
  }
  function doneKey(who) { return 'hx-coach-done|' + dkey(new Date()) + '|' + who; }
  function doneSet(who) { try { return JSON.parse(store(doneKey(who)) || '{}') || {}; } catch (e) { return {}; } }

  /* ── AI ─────────────────────────────────────────────────────────── */
  function sellerCtx(ev) {
    var s = ev.s, L = [];
    L.push('SALES: ' + ev.sp + ' (tim ' + ev.team + '), ' + ev.ST.month + ', tanggal ' + ev.ST.dayOfMonth + ' dari ' + ev.ST.daysInMonth + '.');
    L.push('Skor kondisi: ' + ev.score + '/100 (' + tone(ev.score).l + ').');
    L.push('Bulan ini: omzet ' + rpS(s.m.rev) + ' (jalur target ' + rpS(ev.paceTarget) + ', target bulan ' + rpS(ev.t.rev) + '), ' + s.m.closes + ' closing, ' + s.m.td + ' lewat test drive, ' + s.m.cross + ' cross sell, ' + s.m.upsell + ' upsell, ' + s.m.chats + ' chat, closing rate ' + one(ev.cr) + '%' + (ev.tCr != null ? ' (median tim ' + one(ev.tCr) + '%)' : '') + '.');
    L.push('7 hari terakhir (per hari lapor): ' + one(ev.avg.chats) + ' chat, ' + one(ev.avg.calls) + ' telepon, ' + one(ev.avg.fups) + ' follow up. Standar: ' + ev.t.chats + ' chat, ' + ev.t.calls + ' telepon, ' + ev.t.fups + ' follow up. Callback ' + ev.cb + '%' + (ev.tCb != null ? ' (tim ' + Math.round(ev.tCb) + '%)' : '') + '. Laporan bolong ' + ev.missed + ' hari, telat ' + s.w.late + ' kali.');
    if (s.today.closes) L.push('Hari ini sudah ' + s.today.closes + ' closing (' + rpS(s.today.rev) + ').');
    if (ev.crm && ev.crm.c) {
      var c = ev.crm.c;
      L.push('CRM WhatsApp 7 hari: ' + c.chats7 + ' chat aktif, ' + c.new7 + ' customer baru, ' + c.waiting + ' menunggu balasan (' + c.waiting2h + ' lebih dari 2 jam), lead hot ' + c.hot + ', warm ' + c.warm + ', test drive ' + c.td + ', sudah beli ' + c.bought7 + ', dead ' + c.dead7 + (c.replyMed != null ? ', kecepatan balas median ' + c.replyMed + ' menit' : '') + '.');
      var tk = (ev.crm.t || []).slice(0, 6).map(function (x) { return x.n + ' (' + (SLBL[x.s] || x.s) + ', ' + (x.k === 'reply' ? 'menunggu balasan ' : x.k === 'push' ? 'sepi ' : 'belum membalas ') + ago(x.h) + ')'; });
      if (tk.length) L.push('Customer prioritas: ' + tk.join('; ') + '.');
    } else L.push('CRM: belum ada data.');
    if (ev.gaps.length) L.push('Temuan sistem: ' + ev.gaps.slice(0, 5).map(function (g) { return g.t; }).join('; ') + '.');
    if (ev.good.length) L.push('Yang sudah bagus: ' + ev.good.join('; ') + '.');
    return L.join('\n');
  }
  function teamCtx(tv) {
    var L = ['TIM: ' + tv.name + ' (' + tv.teams.join(', ') + '), ' + tv.ST.month + ', tanggal ' + tv.ST.dayOfMonth + '.'];
    L.push('Total bulan ini: omzet ' + rpS(tv.rev) + ', ' + tv.closes + ' closing, ' + tv.chats + ' chat, closing rate ' + one(tv.cr) + '%, callback 7 hari ' + tv.cb + '%. Belum lapor kemarin: ' + (tv.notReported.join(', ') || 'tidak ada') + '.');
    tv.evs.forEach(function (ev) {
      L.push('- ' + ev.sp + ': skor ' + ev.score + ', omzet ' + rpS(ev.s.m.rev) + ', ' + ev.s.m.closes + ' closing, telepon ' + one(ev.avg.calls) + '/hari, callback ' + ev.cb + '%' + (ev.crm && ev.crm.c ? ', ' + ev.crm.c.waiting2h + ' chat menunggu >2 jam' : '') + (ev.gaps[0] ? ', masalah utama: ' + ev.gaps[0].t : '') + '.');
    });
    return L.join('\n').slice(0, 5800);
  }
  function aiFmt(txt) {
    var h = '', inList = false;
    esc(txt).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n').forEach(function (ln) {
      var m = ln.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (m) { if (!inList) { h += '<ul>'; inList = true; } h += '<li>' + m[1] + '</li>'; return; }
      if (inList) { h += '</ul>'; inList = false; }
      ln = ln.replace(/^#+\s*/, '').trim();
      if (ln) h += '<p>' + ln + '</p>';
    });
    return h + (inList ? '</ul>' : '');
  }
  function askAI(mode, ctx, box) {
    var key = mode + '|' + ctx;
    if (aiCache[key]) { box.innerHTML = aiFmt(aiCache[key]); return; }
    box.innerHTML = '<div class="hxco-think"><span class="hxco-spin"></span> Coach AI sedang membaca data kamu…</div>';
    fetch('/api/coach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: mode, ctx: ctx }) })
      .then(function (r) { return r.json().catch(function () { return { error: 'HTTP ' + r.status }; }); })
      .then(function (j) {
        if (!j || j.error || !j.text) { box.innerHTML = '<div class="hxco-err">AI belum bisa dipakai: ' + esc((j && j.error) || 'tidak ada jawaban') + '. Coba lagi sebentar.</div>'; return; }
        aiCache[key] = j.text; box.innerHTML = aiFmt(j.text);
      })
      .catch(function () { box.innerHTML = '<div class="hxco-err">Tidak tersambung ke AI. Cek sinyal lalu coba lagi.</div>'; });
  }

  /* ── rendering ──────────────────────────────────────────────────── */
  var ov, sh, body;
  function ensureDom() {
    if (sh) return;
    ov = D.createElement('div'); ov.className = 'hxco-overlay';
    sh = D.createElement('section'); sh.className = 'hxco-sheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Coach');
    sh.innerHTML = '<div class="hxco-handle"></div><div class="hxco-body"></div>';
    D.body.append(ov, sh);
    body = sh.querySelector('.hxco-body');
    ov.addEventListener('click', close);
    sh.addEventListener('click', onClick);
    sh.addEventListener('change', onChange);
  }
  function open(v) {
    ensureDom(); listenCRM();
    stack = [];
    view = v || owner();
    D.documentElement.classList.add('hxco-lock');
    ov.classList.add('on'); sh.classList.add('on');
    render();
  }
  function close() {
    if (!sh) return;
    ov.classList.remove('on'); sh.classList.remove('on');
    D.documentElement.classList.remove('hxco-lock');
  }
  function isOpen() { return !!(sh && sh.classList.contains('on')); }

  function head(kick, title, sub, back) {
    return '<div class="hxco-head">' + (back ? '<button class="hxco-back" data-act="back" aria-label="Kembali">‹</button>' : '') +
      '<div class="hxco-ht"><div class="hxco-kick">' + esc(kick) + '</div><h3>' + esc(title) + '</h3>' + (sub ? '<div class="hxco-sub">' + sub + '</div>' : '') + '</div>' +
      '<button class="hxco-x" data-act="close" aria-label="Tutup">×</button></div>';
  }
  function crmStamp() {
    if (!CRM || !CRM.updatedAt) return '<span class="hxco-mut">CRM belum tersambung</span>';
    var m = Math.round((Date.now() - CRM.updatedAt) / 60000);
    return '<span class="hxco-mut">CRM diperbarui ' + (m < 1 ? 'barusan' : m < 60 ? m + ' menit lalu' : Math.round(m / 60) + ' jam lalu') + '</span>';
  }
  function render() {
    if (!body) return;
    var y = body.scrollTop;
    if (!view) body.innerHTML = renderPicker(true);
    else if (view.leader) body.innerHTML = renderTeam(view);
    else body.innerHTML = renderSeller(view.sp, view.team);
    body.scrollTop = y;
  }

  function renderPicker(first) {
    var h = head('COACH', first ? 'Ini HP siapa?' : 'Lihat orang lain', first ? 'Pilih sekali saja. HP ini akan diingat (sama dengan Form Closing).' : 'Hanya untuk melihat, pemilik HP tidak berubah.', !first);
    h += '<div class="hxco-sec">LEADER</div><div class="hxco-chips">';
    leaderGroups().forEach(function (g) { h += '<button class="hxco-chip lead" data-act="pickLead" data-teams="' + esc(g.teams.join(',')) + '">Leader ' + esc(g.name) + '</button>'; });
    h += '</div>';
    Object.keys(roster()).forEach(function (t) {
      var ms = members(t); if (!ms.length) return;
      h += '<div class="hxco-sec">' + esc(t) + '</div><div class="hxco-chips">';
      ms.forEach(function (sp) { h += '<button class="hxco-chip" data-act="pickSp" data-sp="' + esc(sp) + '" data-team="' + esc(t) + '">' + esc(sp) + '</button>'; });
      h += '</div>';
    });
    return h + '<div class="hxco-pad"></div>';
  }

  function ring(score) {
    var tn = tone(score), r = 34, c = 2 * Math.PI * r, off = c * (1 - score / 100);
    return '<div class="hxco-ring ' + tn.c + '"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="' + r + '" class="bg"/><circle cx="40" cy="40" r="' + r + '" class="fg" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><b>' + score + '</b></div>';
  }
  function meter(label, val, target, unit, fmt) {
    var p = target > 0 ? Math.min(100, Math.round(val / target * 100)) : 100;
    var c = p >= 100 ? 'g' : p >= 70 ? 'y' : 'r';
    return '<div class="hxco-meter"><div class="hxco-ml"><span>' + label + '</span><b>' + (fmt ? fmt(val) : one(val)) + '<i> / ' + (fmt ? fmt(target) : target) + (unit || '') + '</i></b></div><div class="hxco-bar"><span class="' + c + '" style="width:' + p + '%"></span></div></div>';
  }
  function todoHtml(items, who) {
    var done = doneSet(who), n = 0;
    var h = items.map(function (x) {
      var ok = !!done[x.id]; if (ok) n++;
      return '<label class="hxco-todo' + (ok ? ' done' : '') + (x.hot ? ' hot' : '') + '"><input type="checkbox" data-who="' + esc(who) + '" data-id="' + esc(x.id) + '"' + (ok ? ' checked' : '') + '><span class="hxco-tk"></span><span class="hxco-tt"><b>' + esc(x.t) + '</b><small>' + esc(x.sub || '') + '</small></span></label>';
    }).join('');
    return '<div class="hxco-sec">TO DO HARI INI <span class="hxco-cnt">' + n + '/' + items.length + '</span></div><div class="hxco-card hxco-todos">' + h + '</div>';
  }

  function renderSeller(sp, team) {
    var ST = buildStats(), ev = evaluate(sp, team, ST), tn = tone(ev.score), s = ev.s, me = owner();
    var mine = me && !me.leader && norm(me.sp) === norm(sp);
    var h = head('COACH · ' + team.toUpperCase(), sp, crmStamp(), stack.length > 0);
    h += '<div class="hxco-card hxco-hero ' + tn.c + '">' + ring(ev.score) + '<div><div class="hxco-tone">' + tn.l + '</div><div class="hxco-hsub">' +
      (ev.gaps[0] ? 'Paling perlu dibenahi: <b>' + esc(ev.gaps[0].t.toLowerCase()) + '</b>' : 'Semua indikator aman. Pertahankan!') + '</div></div></div>';

    h += todoHtml(todos(ev), sp + '|' + team);

    h += '<div class="hxco-sec">KENAPA SKOR SEGINI</div><div class="hxco-card">';
    if (ev.gaps.length) ev.gaps.slice(0, 5).forEach(function (g) { h += '<div class="hxco-gap"><i class="' + (g.sev >= 0.5 ? 'r' : 'y') + '"></i><div><b>' + esc(g.t) + '</b><p>' + esc(g.why) + '</p></div></div>'; });
    else h += '<div class="hxco-gap"><i class="g"></i><div><b>Tidak ada yang kurang</b><p>Telepon, follow up, laporan dan omzet semuanya sesuai jalur.</p></div></div>';
    if (ev.good.length) h += '<div class="hxco-good">' + ev.good.map(function (x) { return '<span>✓ ' + esc(x) + '</span>'; }).join('') + '</div>';
    h += '</div>';

    h += '<div class="hxco-sec">ANGKA KAMU</div><div class="hxco-card">';
    h += meter('Omzet bulan ini', s.m.rev, Math.round(ev.paceTarget), '', rpS);
    h += meter('Telepon / hari (7 hari)', ev.avg.calls, ev.t.calls);
    h += meter('Chat / hari (7 hari)', ev.avg.chats, ev.t.chats);
    h += meter('Follow up / hari (7 hari)', ev.avg.fups, ev.t.fups);
    h += '<div class="hxco-grid">' +
      stat(s.m.closes, 'closing bulan ini') + stat(one(ev.cr) + '%', 'closing rate' + (ev.tCr != null ? ' · tim ' + one(ev.tCr) + '%' : '')) +
      stat(ev.cb + '%', 'callback 7 hari' + (ev.tCb != null ? ' · tim ' + Math.round(ev.tCb) + '%' : '')) + stat(s.m.td, 'closing test drive') +
      stat(ev.ticket ? rpS(ev.ticket) : '-', 'rata rata per closing') + stat(ev.missed, 'hari belum lapor') + '</div></div>';

    if (ev.crm && ev.crm.c) {
      var c = ev.crm.c;
      h += '<div class="hxco-sec">WHATSAPP (CRM) 7 HARI</div><div class="hxco-card"><div class="hxco-grid">' +
        stat(c.chats7, 'chat aktif') + stat(c.waiting2h, 'menunggu > 2 jam', c.waiting2h >= 3 ? 'r' : '') + stat(c.replyMed != null ? c.replyMed + ' mnt' : '-', 'kecepatan balas', c.replyMed > 15 ? 'y' : '') +
        stat(c.hot + c.warm + c.td, 'lead hot/warm/test') + stat(c.new7, 'customer baru') + stat(c.bought7, 'sudah beli') + '</div>' +
        (ev.crm.acc && ev.crm.acc.length ? '<div class="hxco-mut hxco-acc">Akun WA: ' + esc(ev.crm.acc.join(', ')) + '</div>' : '') + '</div>';
    }

    h += '<div class="hxco-sec">COACH AI</div><div class="hxco-card hxco-ai" id="hxcoAi"><p class="hxco-mut">Minta AI membaca semua angka di atas dan menyusun rencana hari ini untuk ' + esc(sp) + '.</p><button class="hxco-btn" data-act="ai" data-mode="seller">Tanya Coach AI</button></div>';
    h += '<div class="hxco-foot">' + (mine ? 'HP ini milik ' + esc(sp) + '. ' : '') + '<button class="hxco-link" data-act="other">Lihat orang lain</button>' + (mine ? ' · <button class="hxco-link" data-act="reset">Bukan HP saya</button>' : '') + '</div><div class="hxco-pad"></div>';
    return h;
  }
  function stat(v, l, c) { return '<div class="hxco-stat' + (c ? ' ' + c : '') + '"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }

  function teamView(v) {
    var ST = buildStats(), name = leadName(v.teams[0]), evs = [];
    v.teams.forEach(function (t) { members(t).forEach(function (sp) { evs.push(evaluate(sp, t, ST)); }); });
    evs.sort(function (a, b) { return a.score - b.score; });
    var rev = 0, closes = 0, chats = 0, wch = 0, wca = 0, y = dkey(addDays(new Date(), -1)), notRep = [];
    evs.forEach(function (ev) {
      rev += ev.s.m.rev; closes += ev.s.m.closes; chats += ev.s.m.chats; wch += ev.s.w.chats; wca += ev.s.w.calls;
      if (ST.due.indexOf(y) >= 0 && !ev.s.w.days[y]) notRep.push(ev.sp);
    });
    return { name: name, teams: v.teams, ST: ST, evs: evs, rev: rev, closes: closes, chats: chats, cr: chats ? closes / chats * 100 : 0, cb: Math.min(100, pct(wca, wch)), notReported: notRep };
  }
  function renderTeam(v) {
    var tv = teamView(v);
    var avgScore = tv.evs.length ? Math.round(tv.evs.reduce(function (a, e) { return a + e.score; }, 0) / tv.evs.length) : 0, tn = tone(avgScore);
    var h = head('COACH · LEADER', 'Tim ' + tv.name, esc(tv.teams.join(' + ')) + ' · ' + crmStamp(), false);
    var weak = tv.evs.filter(function (e) { return e.score < 60; });
    h += '<div class="hxco-card hxco-hero ' + tn.c + '">' + ring(avgScore) + '<div><div class="hxco-tone">' + tn.l + '</div><div class="hxco-hsub">' +
      (weak.length ? '<b>' + weak.length + ' dari ' + tv.evs.length + '</b> anggota butuh perhatian' : 'Semua anggota dalam kondisi aman') + '</div></div></div>';

    // leader to do
    var items = [];
    tv.notReported.forEach(function (sp) { items.push({ id: 'rep:' + sp, t: 'Ingatkan ' + sp + ' isi laporan kemarin', sub: 'Belum ada laporan Calls & Follow Up' }); });
    tv.evs.forEach(function (ev) {
      if (ev.crm && ev.crm.c && ev.crm.c.waiting2h >= 5) items.push({ id: 'wait:' + ev.sp, hot: true, t: 'Cek ' + ev.sp + ': ' + ev.crm.c.waiting2h + ' customer belum dibalas', sub: 'Menunggu lebih dari 2 jam di WhatsApp' });
    });
    weak.slice(0, 4).forEach(function (ev) { if (ev.gaps[0]) items.push({ id: 'help:' + ev.sp, t: 'Bantu ' + ev.sp + ': ' + ev.gaps[0].t.toLowerCase(), sub: ev.gaps[0].todo }); });
    var star = tv.evs.slice().sort(function (a, b) { return b.score - a.score; })[0];
    if (star && weak.length && star.score >= 80) items.push({ id: 'star:' + star.sp, t: 'Minta ' + star.sp + ' berbagi cara closing ke tim', sub: 'Skor tertinggi di tim (' + star.score + ')' });
    if (!items.length) items.push({ id: 'ok', t: 'Tim aman. Pantau chat masuk dan jaga ritme', sub: 'Tidak ada tanda bahaya hari ini' });
    h += todoHtml(items, '@team|' + tv.teams.join(','));

    h += '<div class="hxco-sec">ANGKA TIM BULAN INI</div><div class="hxco-card"><div class="hxco-grid">' +
      stat(rpS(tv.rev), 'omzet') + stat(tv.closes, 'closing') + stat(one(tv.cr) + '%', 'closing rate') +
      stat(tv.cb + '%', 'callback 7 hari', tv.cb < 30 ? 'r' : '') + stat(tv.chats, 'chat') + stat(tv.notReported.length, 'belum lapor kemarin', tv.notReported.length ? 'y' : '') + '</div></div>';

    h += '<div class="hxco-sec">ANGGOTA <span class="hxco-cnt">tap untuk detail</span></div><div class="hxco-card hxco-mem">';
    tv.evs.forEach(function (ev) {
      var t2 = tone(ev.score);
      h += '<button class="hxco-row" data-act="member" data-sp="' + esc(ev.sp) + '" data-team="' + esc(ev.team) + '"><span class="hxco-pill ' + t2.c + '">' + ev.score + '</span><span class="hxco-rt"><b>' + esc(ev.sp) + (tv.teams.length > 1 ? ' <i>' + esc(ev.team) + '</i>' : '') + '</b><small>' +
        esc(ev.gaps[0] ? ev.gaps[0].t : 'Aman') + ' · ' + rpS(ev.s.m.rev) + (ev.crm && ev.crm.c && ev.crm.c.waiting2h ? ' · ' + ev.crm.c.waiting2h + ' menunggu' : '') + '</small></span><span class="hxco-chev">›</span></button>';
    });
    h += '</div>';

    var un = [];
    if (CRM && CRM.unmatched) Object.keys(CRM.unmatched).forEach(function (k) { var u = CRM.unmatched[k]; if (u && u.team && tv.teams.indexOf(u.team) >= 0) un.push(u); });
    if (un.length) h += '<div class="hxco-sec">AKUN WA BELUM TERHUBUNG</div><div class="hxco-card"><p class="hxco-mut">Akun CRM ini belum cocok dengan nama di roster, jadi belum masuk evaluasi siapa pun: ' + un.map(function (u) { return '<b>' + esc(String(u.name).split('|')[0]) + '</b> (' + u.c.chats7 + ' chat, ' + u.c.waiting2h + ' menunggu)'; }).join(', ') + '.</p></div>';

    h += '<div class="hxco-sec">COACH AI</div><div class="hxco-card hxco-ai" id="hxcoAi"><p class="hxco-mut">Minta AI merangkum kondisi tim dan siapa yang perlu dibantu hari ini.</p><button class="hxco-btn" data-act="ai" data-mode="team">Tanya Coach AI</button></div>';
    h += '<div class="hxco-foot"><button class="hxco-link" data-act="other">Lihat orang lain</button> · <button class="hxco-link" data-act="reset">Bukan HP saya</button></div><div class="hxco-pad"></div>';
    return h;
  }

  /* ── events ─────────────────────────────────────────────────────── */
  function onClick(e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'close') return close();
    if (a === 'back') { view = stack.pop() || owner(); body.scrollTop = 0; return render(); }
    if (a === 'pickSp' || a === 'pickLead') {
      var nv = a === 'pickSp' ? { sp: b.getAttribute('data-sp'), team: b.getAttribute('data-team') } : { leader: true, teams: b.getAttribute('data-teams').split(',') };
      if (!view && !owner()) store(ME_KEY, nv.leader ? LEAD + '|' + nv.teams.join(',') : nv.sp + '|' + nv.team);   // first time: this phone's owner
      view = nv; body.scrollTop = 0; refreshCard(); return render();
    }
    if (a === 'other') { stack.push(view); view = null; body.scrollTop = 0; body.innerHTML = renderPicker(false); return; }
    if (a === 'reset') { store(ME_KEY, null); view = null; stack = []; refreshCard(); body.scrollTop = 0; return render(); }
    if (a === 'member') { stack.push(view); view = { sp: b.getAttribute('data-sp'), team: b.getAttribute('data-team') }; body.scrollTop = 0; return render(); }
    if (a === 'ai') {
      var box = D.getElementById('hxcoAi'); if (!box) return;
      if (view.leader) askAI('team', teamCtx(teamView(view)), box);
      else askAI('seller', sellerCtx(evaluate(view.sp, view.team, buildStats())), box);
    }
  }
  // tick a to do: update in place (no repaint, WebKit would swallow the next tap)
  function onChange(e) {
    var cb = e.target; if (!cb || cb.type !== 'checkbox' || !cb.getAttribute('data-id')) return;
    var who = cb.getAttribute('data-who'), id = cb.getAttribute('data-id'), d = doneSet(who);
    if (cb.checked) d[id] = 1; else delete d[id];
    store(doneKey(who), JSON.stringify(d));
    var row = cb.closest('.hxco-todo'); if (row) row.classList.toggle('done', cb.checked);
    var card = cb.closest('.hxco-todos'), cnt = card && card.previousElementSibling && card.previousElementSibling.querySelector('.hxco-cnt');
    if (cnt) cnt.textContent = card.querySelectorAll('input:checked').length + '/' + card.querySelectorAll('input').length;
  }

  /* ── CRM listener (only once someone opens Coach or the card shows) ── */
  function listenCRM() {
    if (crmListening || !W.db || !W.db.ref) return;
    crmListening = true;
    try {
      W.db.ref('coach/crm').on('value', function (snap) { CRM = snap.val() || null; refreshCard(); if (isOpen()) render(); });
    } catch (e) { crmListening = false; }
  }

  /* ── entry points: card on the dashboard + button in the More sheet ── */
  var card;
  function refreshCard() {
    if (!card) return;
    var me = owner(), txt = 'Evaluasi kamu dan to do hari ini', sc = '';
    try {
      if (me && me.leader) { var tv = teamView(me); var a = tv.evs.length ? Math.round(tv.evs.reduce(function (x, e) { return x + e.score; }, 0) / tv.evs.length) : 0; sc = a; txt = 'Tim ' + tv.name + ': ' + tone(a).l.toLowerCase() + (tv.evs.filter(function (e) { return e.score < 60; }).length ? ', ' + tv.evs.filter(function (e) { return e.score < 60; }).length + ' anggota butuh bantuan' : ''); }
      else if (me) { var ev = evaluate(me.sp, me.team, buildStats()); sc = ev.score; txt = me.sp + ': ' + (ev.gaps[0] ? ev.gaps[0].t.toLowerCase() : tone(ev.score).l.toLowerCase()) + (ev.gaps[0] && ev.gaps[0].k !== 'wait' && ev.crm && ev.crm.c && ev.crm.c.waiting2h ? ' · ' + ev.crm.c.waiting2h + ' chat menunggu' : ''); }
    } catch (e) { }
    var tn = sc === '' ? null : tone(sc);
    card.innerHTML = '<span class="hxco-ci ' + (tn ? tn.c : '') + '">' + (sc === '' ? '◎' : sc) + '</span><span class="hxco-ct"><b>Coach</b><small>' + esc(txt) + '</small></span><span class="hxco-chev">›</span>';
  }
  var rT = 0;
  function scheduleRefresh() { clearTimeout(rT); rT = setTimeout(function () { refreshCard(); if (isOpen()) { var a = D.activeElement; if (!a || !sh.contains(a) || a.type !== 'checkbox') render(); } }, 400); }

  function mount() {
    var host = D.getElementById('dashboardContainer');
    if (host && !card) {
      card = D.createElement('button'); card.type = 'button'; card.className = 'hxco-card-entry';
      card.addEventListener('click', function () { open(); });
      var anchor = D.getElementById('homeOmsetHero');
      if (anchor && anchor.parentNode === host) host.insertBefore(card, anchor); else host.insertBefore(card, host.firstChild);
      refreshCard();
    }
    var grid = D.querySelector('.premium-more-grid');
    if (grid && !grid.querySelector('[data-coach]')) {
      var b = D.createElement('button'); b.type = 'button'; b.setAttribute('data-coach', '1');
      b.innerHTML = '<i></i><span>Coach</span>';
      b.addEventListener('click', function () { D.body.classList.remove('premium-more-open'); open(); });
      grid.insertBefore(b, grid.firstChild);
    }
    // keep the card live: app.js calls renderAll() on every data change
    if (typeof W.renderAll === 'function' && !W.renderAll.__coach) {
      var orig = W.renderAll;
      W.renderAll = function () { var r = orig.apply(this, arguments); scheduleRefresh(); return r; };
      W.renderAll.__coach = true;
    }
    if (W.db) listenCRM();
    return !!card && !!grid;
  }
  var tries = 0;
  (function boot() { if (mount() || ++tries > 40) return; setTimeout(boot, 250); })();
  D.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) close(); });

  W.HXCoach = { open: open, close: close, _evaluate: function (sp, team) { return evaluate(sp, team, buildStats()); } };
})();
