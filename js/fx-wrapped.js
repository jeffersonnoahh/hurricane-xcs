/* ══════════════════════════════════════════════════════════════════════
   FX WRAPPED — cerita bulanan bergaya "Wrapped" (lihat css/fx-wrapped.css).
   HANYA MEMBACA allData / TM. Tidak pernah menulis ke Firebase, allData,
   atau fungsi tulis app.js. Satu-satunya yang disimpan: localStorage
   (petunjuk sudah dilihat, undangan bulan ini sudah tampil) — semua lewat
   try/catch, aplikasi tetap jalan tanpa itu.

   Tiga cerita (7–9 slide, layar penuh hitam pekat):
     SALES     omset + closing · hari terbaik · penjualan terbesar · produk
               andalan · perjalanan peringkat · vs bulan lalu · kontribusi di
               team · catatan · ringkasan
     TEAM      omset · MVP · hari terbaik · produk · peringkat anggota ·
               vs bulan lalu · ringkasan
     HURRICANE omset · bulan ke bulan (rekor?) · total closing · hari
               terbaik · top 5 sales · team terbaik · produk terlaris ·
               penjualan terbesar · ringkasan
   Semua angka bulan (omset, closing, peringkat "dari N sales", total tim,
   hari terbaik, penjualan terbesar, produk andalan) = HX.monthAgg — sama
   dengan pecah omset, kartu sales dan peta bintang. Channel (Tokopedia/
   Shopee/TikTok) dan team lead (_LEADERS) masuk omzet tim tetapi tidak
   masuk peringkat sales; channel tampil terpisah sebagai "Channel".

   Pintu masuk:
     a) tombol "Wrapped <Bulan>" di baris aksi modal sales (HX.spAction,
        order 10). Bulan = bulan Monthly Recap bila dibuka dari sana, selain
        itu bulan berjalan — tanggal 1–3: bulan lalu.
     b) tombol "Wrapped <Bulan>" di kepala Monthly Recap → pilih Hurricane
        atau salah satu team.
     c) tanggal 1–3, sekali per HP per bulan: kapsul "Wrapped Oktober sudah
        siap" (ketuk = cerita Hurricane).

   Penampil: segmen progres, maju otomatis ±5 dtk, ketuk kanan = lanjut,
   ketuk kiri = kembali, tahan = jeda, geser bawah = tutup, tombol X,
   Escape, tombol Back Android (history.pushState + popstate). Selama
   terbuka <html> diberi 'hx-overlay-open' (HX.busy() → true) dan halaman
   di belakang dikunci. Kurangi Gerak: slide statis, pindah manual.

   Uji (konsol): HX.wrapped.seller('gabriel','Valen',2026,9)
                 HX.wrapped.team('Valen',2026,9) · HX.wrapped.company(2026,9)
                 HX.wrapped.chooser(2026,9) · HX.wrapped.invite(true)
   (bulan 0–11 seperti Date)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  // nama dashboard (Hurricane XCS / Maria Team / Calvin Team) — dari fx-core
  function BRAND() { return (window.HX && HX.brand) || 'Hurricane XCS'; }
  function BRAND_S() { return (window.HX && HX.brandShort) || 'Hurricane'; }

  var HX = window.HX;
  if (!HX || HX.wrapped) return;
  var D = document, R = D.documentElement, W = window;
  var API = HX.wrapped = { _now: null };

  /* ── kalender & format ──────────────────────────────────────────── */
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function now() { return API._now ? new Date(API._now) : new Date(); }
  function perf() { return W.performance && performance.now ? performance.now() : Date.now(); }
  function mnorm(y, m) { while (m < 0) { m += 12; y--; } while (m > 11) { m -= 12; y++; } return { y: y, m: m }; }
  function daysIn(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function keyOf(y, m, d) {
    try { if (typeof dk === 'function') return dk(new Date(y, m, d)); } catch (e) { }
    return y + '-' + pad(m + 1) + '-' + pad(d);
  }
  function mkOf(y, m) { return y + '-' + pad(m + 1); }
  // hari terakhir yang sudah lewat/berjalan di bulan itu (0 = bulan depan)
  function lastDay(y, m) {
    var t = now(), ty = t.getFullYear(), tm = t.getMonth();
    if (y > ty || (y === ty && m > tm)) return 0;
    if (y === ty && m === tm) return t.getDate();
    return daysIn(y, m);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // emoji tidak pernah ditampilkan (nama tim/lencana dari modul lain)
  function noEmoji(s) {
    return String(s == null ? '' : s)
      .replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]/g, '')
      .replace(/[\u2600-\u27bf\u2b00-\u2bff\ufe0f\u200d]/g, '')
      .replace(/\s{2,}/g, ' ').trim();
  }
  function cap(s) { s = String(s == null ? '' : s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function grp(i) { return String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function fmtNum(v, d) {
    var f = Math.pow(10, d), s = (Math.round(v * f) / f).toFixed(d), p = s.split('.');
    return grp(p[0]) + (d ? ',' + p[1] : '');
  }
  // sama dengan fRp app.js: 850rb · 189,73jt · 5jt · 2,95M (M = miliar)
  function split(n) {
    var a = Math.abs(Math.round(+n || 0)), c;
    if (a >= 999995000) { c = Math.round(a / 1e7); return { v: c / 100, d: c % 100 ? 2 : 0, word: 'miliar' }; }
    if (a >= 999500) { c = Math.round(a / 1e4); return { v: c / 100, d: c % 100 ? 2 : 0, word: 'juta' }; }
    if (a >= 1000) return { v: Math.round(a / 1e3), d: 0, word: 'ribu' };
    return { v: a, d: 0, word: '' };
  }
  function short(n) { return HX.money(n); }
  // label kolom sempit: 842jt · 58,2jt · 2,99M
  function compact(n) {
    var a = Math.abs(n);
    if (a >= 999995000) return fmtNum(Math.round(a / 1e7) / 100, 2) + 'M';
    if (a >= 99.5e6) return Math.round(a / 1e6) + 'jt';
    if (a >= 9.95e6) return fmtNum(Math.round(a / 1e5) / 10, 1) + 'jt';
    return short(a);
  }
  function full(n) { return HX.moneyFull(n); }
  function dLong(y, m, d) { return HARI[new Date(y, m, d).getDay()] + ', ' + d + ' ' + BULAN[m]; }
  function mkLabel(mk, y) {
    if (!mk) return '';
    var p = mk.split('-'), yy = +p[0], mm = +p[1] - 1;
    return BULAN[mm] + (yy !== y ? ' ' + yy : '');
  }
  function pctTxt(r) {
    var v = Math.round(r * 1000) / 10, a = Math.abs(v);
    var s = a >= 10 ? String(Math.round(a)) : String(a).replace('.', ',');
    return (v > 0 ? '+' : v < 0 ? '\u2212' : '') + s + '%';
  }
  function chName(n) {
    return String(n).trim().split(/\s+/).map(function (w) { var l = w.toLowerCase(); return l === 'tiktok' ? 'TikTok' : l.charAt(0).toUpperCase() + l.slice(1); }).join(' ');
  }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  function mono(t) {
    try { if (typeof teamMono === 'function') return teamMono(t) || ''; } catch (e) { }
    var w = String(t || '').trim().split(/\s+/);
    return ((w[0] || '').charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] || '').charAt(1))).toUpperCase();
  }
  function lsGet(k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { W.localStorage.setItem(k, v); } catch (e) { } }

  /* ── data: SATU hitungan bulanan bersama (HX.monthAgg, js/fx-core.js) ──
     Semua angka bulan — omset & closing (sales, tim, perusahaan), peringkat
     dan penyebut "dari N sales", hari terbaik, penjualan terbesar dan produk
     andalan seorang sales, total & urutan tim, bulan-bulan sebelumnya —
     berasal dari HX.monthAgg: angka yang sama dengan pecah omset, kartu
     sales dan peta bintang. Aturannya ada di sana: sales digabung per NAMA
     lintas tim (record 'Kristus A' milik Arfin ikut Christ A), tim = tim
     roster sekarang (yang sudah keluar: tim record terakhir), channel dan
     team lead masuk omzet tim tetapi tidak pernah diperingkat.
     Record per tanggal di bawah HANYA untuk deret (jam bulan, batang harian,
     titik closing, produk & penjualan terbesar tim/perusahaan); tiap record
     memakai tim versi monthAgg, jadi jumlahnya selalu = total tim bersama.
     Objek monthAgg dipakai bersama modul lain: di sini TIDAK PERNAH diubah. */
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  function teams() { try { return TM || {}; } catch (e) { return {}; } }
  function agg(y, m, upto) { return HX.monthAgg(y, m, upto); }
  function nm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function teamIn(A, t) { for (var i = 0; i < A.teams.length; i++) if (A.teams[i].team === t) return A.teams[i]; return null; }
  function chanIn(A, k) { for (var i = 0; i < A.channels.length; i++) if (nm(A.channels[i].sp) === k) return A.channels[i]; return null; }
  // omset satu nama di agregat (sales, team lead atau channel)
  function revIn(A, k) { var s = A.get(k); if (s) return s.revenue; var c = chanIn(A, k); return c ? c.revenue : 0; }
  // anggota tim yang diperingkat (tanpa team lead), urut peringkat bulanan
  function rankedMembers(T) {
    return T ? T.members.filter(function (s) { return !!s.rank; }).sort(function (a, b) { return a.rank - b.rank; }) : [];
  }
  // salinan ringan untuk slide (objek monthAgg tidak disentuh)
  function sv(s) { return { sp: s.sp, team: s.team, r: s.revenue, u: s.closes, rank: s.rank }; }
  function tv(T) { var mem = rankedMembers(T); return { name: T.team, r: T.revenue, u: T.closes, people: mem.length, top: mem[0] ? sv(mem[0]) : null }; }
  // nama tim dari luar (pemilih, konsol) -> nama tim di agregat / roster
  function resolveTeam(A, t) {
    t = String(t == null ? '' : t).trim();
    if (teamIn(A, t)) return t;
    var lt = t.toLowerCase(), T = teams(), i;
    for (i = 0; i < A.teams.length; i++) if (A.teams[i].team.toLowerCase() === lt) return A.teams[i].team;
    for (var n in T) if (n.toLowerCase() === lt) return n;
    return t;
  }

  // semua penjualan bulan itu (urut tanggal, lalu urutan record — sama dengan
  // monthAgg), tim = tim versi monthAgg; ex = tidak diperingkat
  function monthList(y, m, A) {
    var Dd = data(), n = daysIn(y, m), out = [], chT = {};
    A.channels.forEach(function (c) { chT[nm(c.sp)] = c.team; });
    for (var d = 1; d <= n; d++) {
      var arr = Dd[keyOf(y, m, d)];
      if (!arr || !arr.length) continue;
      for (var i = 0; i < arr.length; i++) {
        var e = arr[i];
        if (!e || typeof e !== 'object') continue;
        var raw = String(e.sp == null ? '' : e.sp).trim(), k = nm(raw), s = A.get(raw);
        out.push({
          sp: s ? s.sp : raw, k: k,
          team: s ? s.team : (Object.prototype.hasOwnProperty.call(chT, k) ? chT[k] : String(e.team == null ? '' : e.team).trim()),
          prod: noEmoji(e.prod || ''), u: +e.units || 1, r: +e.revenue || 0, d: d, ts: +e.ts || 0,
          ex: !(s && s.rank)
        });
      }
    }
    return out;
  }
  function monthHasSales(y, m) { return agg(y, m).closes > 0; }
  function sellerHasSales(sp, y, m) { var s = agg(y, m).get(sp); return !!(s && s.revenue > 0); }

  // Riwayat bulan ke bulan (kolom 6 bulan, rekor, "sepanjang masa"): monthAgg
  // setiap bulan yang punya data, jadi bulan lalu = angka modul lain juga.
  function hist() {
    var Dd = data(), seen = {}, co = {}, sp = {}, tm = {}, spDay = {}, spBig = {};
    Object.keys(Dd).forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(k)) seen[k.slice(0, 7)] = 1; });
    Object.keys(seen).forEach(function (mk) {
      var A = agg(+mk.slice(0, 4), +mk.slice(5, 7) - 1);
      if (!A.closes) return;
      co[mk] = A.total;
      A.teams.forEach(function (t) { (tm[t.team] || (tm[t.team] = {}))[mk] = t.revenue; });
      A.sellers.concat(A.leaders).forEach(function (s) {
        var k = s.key || nm(s.sp);
        (sp[k] || (sp[k] = {}))[mk] = s.revenue;
        (spDay[k] || (spDay[k] = {}))[mk] = s.best ? s.best.revenue : 0;
        (spBig[k] || (spBig[k] = {}))[mk] = s.biggest ? s.biggest.revenue : 0;
      });
      A.channels.forEach(function (c) { var k = nm(c.sp); (sp[k] || (sp[k] = {}))[mk] = c.revenue; });
    });
    return { co: co, sp: sp, tm: tm, spDay: spDay, spBig: spBig };
  }
  function maxBefore(map, mk) {
    var best = 0, at = null;
    for (var k in map) if (k < mk && map[k] > best) { best = map[k]; at = k; }
    return { v: best, at: at };
  }

  // satu tanggal: closing, transaksi, sales (diperingkat) terbanyak, produk
  function dayInfo(list, d, r) {
    var dl = list.filter(function (x) { return x.d === d; }), u = 0, pr = {}, sm = {}, top = null, k;
    dl.forEach(function (x) {
      u += x.u;
      if (x.prod) pr[x.prod] = (pr[x.prod] || 0) + x.r;
      if (x.ex) return;
      var s = sm[x.k] || (sm[x.k] = { sp: x.sp, r: 0, u: 0 });
      s.r += x.r; s.u += x.u;
    });
    for (k in sm) {
      var s = sm[k];
      if (!top || s.r > top.r || (s.r === top.r && (s.u > top.u || (s.u === top.u && s.sp < top.sp)))) top = s;
    }
    return { d: d, r: r, u: u, tx: dl.length, top: top, prods: Object.keys(pr).sort(function (a, b) { return pr[b] - pr[a]; }) };
  }
  // deret dari record: harian, hari terbaik, produk, penjualan terbesar
  // (aturan seri sama dengan monthAgg: yang PERTAMA tercatat menang)
  function summarize(S, list) {
    var o = { r: 0, u: 0, tx: list.length, days: zeros(S.n), du: zeros(S.n), prods: [], big: null, active: 0, best: null };
    var pm = {};
    list.forEach(function (x) {
      o.r += x.r; o.u += x.u; o.days[x.d - 1] += x.r; o.du[x.d - 1] += x.u;
      if (x.prod) { var p = pm[x.prod] || (pm[x.prod] = { name: x.prod, r: 0, u: 0 }); p.r += x.r; p.u += x.u; }
      if (!o.big || x.r > o.big.r) o.big = x;
    });
    for (var k in pm) o.prods.push(pm[k]);
    o.prods.sort(function (a, b) { return b.r - a.r || b.u - a.u; });
    var bi = -1;
    o.days.forEach(function (v, i) { if (v > 0) o.active++; if (v > 0 && (bi < 0 || v > o.days[bi])) bi = i; });
    if (bi >= 0) o.best = dayInfo(list, bi + 1, o.days[bi]);
    return o;
  }
  function dayOf(key) { var d = +String(key || '').slice(8, 10); return d > 0 ? d : 0; }
  // angka bulan seorang sales = angka monthAgg (deret harian tetap dari record)
  function sellerFromAgg(o, s, list) {
    o.r = s.revenue; o.u = s.closes; o.active = s.activeDays;
    var bd = s.best && dayOf(s.best.date);
    o.best = bd ? dayInfo(list, bd, s.best.revenue) : null;
    var g = s.biggest, hit = null, gd = g ? dayOf(g.date) : 0;
    if (g && g.revenue > 0) {
      for (var i = 0; i < list.length && !hit; i++) {
        var x = list[i];
        if (x.r === g.revenue && x.d === gd && (!g.ts || x.ts === g.ts)) hit = x;
      }
      o.big = hit || { sp: s.sp, k: s.key, team: s.team, prod: noEmoji(g.prod || ''), u: 1, r: g.revenue, d: gd || 1, ts: g.ts || 0 };
    } else o.big = null;
    var P = s.prods || {};
    o.prods = Object.keys(P).filter(function (pn) { return pn && pn !== 'undefined' && pn !== 'null'; }).map(function (pn) {
      return { name: noEmoji(pn), r: P[pn].revenue, u: P[pn].units, top: pn === s.topProd ? 1 : 0 };
    }).sort(function (a, b) { return b.r - a.r || b.top - a.top || b.u - a.u; });
  }
  function base(y, m) {
    var n = daysIn(y, m), last = lastDay(y, m), A = agg(y, m);
    return { y: y, m: m, n: n, last: last || n, partial: last > 0 && last < n, A: A, L: monthList(y, m, A), H: hist(), mk: mkOf(y, m), label: 'Wrapped ' + BULAN[m] + ' ' + y };
  }
  // bulan berjalan dibandingkan dengan PERIODE YANG SAMA bulan lalu
  // (pick(agregat) -> omset yang dibandingkan)
  function prevCompare(S, pick) {
    var p = mnorm(S.y, S.m - 1), lim = Math.min(S.last, daysIn(p.y, p.m));
    var fullR = pick(agg(p.y, p.m)), same = pick(agg(p.y, p.m, lim));
    var baseR = S.partial ? same : fullR;
    return { y: p.y, m: p.m, full: fullR, same: same, base: baseR, lim: lim, delta: baseR > 0 ? (S.o.r - baseR) / baseR : null };
  }
  function colsOf(S, map) {
    var out = [];
    for (var i = 5; i >= 0; i--) {
      var mm = mnorm(S.y, S.m - i), mk = mkOf(mm.y, mm.m);
      out.push({ y: mm.y, m: mm.m, r: i === 0 ? S.o.r : (map[mk] || 0), cur: i === 0, partial: i === 0 && S.partial });
    }
    // buang bulan kosong di depan (sales baru), sisakan minimal 2 kolom
    while (out.length > 2 && !out[0].r) out.shift();
    return out;
  }
  function recordOf(S, map) {
    var pb = maxBefore(map, S.mk), cur = S.o.r, above = 0, cnt = 0;
    for (var k in map) { if (k === S.mk) continue; if (map[k] > 0) cnt++; if (map[k] > cur) above++; }
    return { isRecord: pb.v > 0 && cur > pb.v, prev: pb, rankAll: above + 1, months: cnt + 1, first: pb.v === 0 };
  }

  function statsCompany(y, m) {
    var S = base(y, m), A = S.A;
    S.kind = 'company'; S.title = BRAND();
    S.o = summarize(S, S.L);
    S.o.r = A.total; S.o.u = A.closes;            // = monthRev bulan itu
    S.ranked = A.sellers.map(sv); S.field = A.nSellers;
    S.channel = { r: 0, names: [] };
    A.channels.forEach(function (c) { S.channel.r += c.revenue; var n = chName(c.sp); if (S.channel.names.indexOf(n) < 0) S.channel.names.push(n); });
    S.teams = A.teams.map(tv);
    S.prev = prevCompare(S, function (X) { return X.total; });
    S.cols = colsOf(S, S.H.co); S.rec = recordOf(S, S.H.co);
    S.avgSale = S.o.tx ? S.o.r / S.o.tx : 0;
    return S;
  }
  function statsTeam(team, y, m) {
    var S = base(y, m), A = S.A;
    team = resolveTeam(A, team);
    S.kind = 'team'; S.team = team; S.title = 'Team ' + noEmoji(team);
    var T = teamIn(A, team);
    S.o = summarize(S, S.L.filter(function (x) { return x.team === team; }));
    // omzet tim = sales + team lead + channel (sama dengan semua modul)
    if (T) { S.o.r = T.revenue; S.o.u = T.closes; }
    S.members = rankedMembers(T).map(sv);
    S.others = [];
    var ld = 0;
    if (T) T.members.forEach(function (s) { if (!s.rank) ld += s.revenue; });
    if (T && T.revenueChannels > 0) S.others.push({ name: 'Channel', r: T.revenueChannels });
    if (ld > 0) S.others.push({ name: 'Team lead', r: ld });
    S.mvp = S.members[0] || null;
    S.teams = A.teams.map(tv);
    S.teamRank = T ? A.teams.indexOf(T) + 1 : 0; S.teamCount = A.teams.length;
    S.share = A.total > 0 ? S.o.r / A.total : 0;
    S.prev = prevCompare(S, function (X) { var t = teamIn(X, team); return t ? t.revenue : 0; });
    var map = S.H.tm[team] || {};
    S.cols = colsOf(S, map); S.rec = recordOf(S, map);
    S.avgSale = S.o.tx ? S.o.r / S.o.tx : 0;
    return S;
  }
  // peringkat di akhir minggu (7/14/21/28) dan di hari terakhir: monthAgg
  // sampai tanggal itu (tersimpan per render); titik akhir = peringkat bulan
  function journey(S) {
    var cps = [];
    [7, 14, 21, 28].forEach(function (c) { if (c < S.last) cps.push(c); });
    cps.push(S.last);
    var pts = cps.map(function (c) {
      var X = agg(S.y, S.m, c), me = X.get(S.sp);
      return { d: c, rank: me && me.rank ? me.rank : 0, field: X.nSellers };
    });
    var L = pts[pts.length - 1];
    if (S.rank > 0) { L.rank = S.rank; L.field = S.field; }
    if (!L.rank) return null;
    var start = pts[0].rank || (pts[0].field + 1), end = L.rank;
    return { pts: pts, start: start, end: end, climb: start - end };
  }
  function statsSeller(sp, team, y, m) {
    var S = base(y, m), A = S.A;
    sp = String(sp == null ? '' : sp).trim();
    var k = nm(sp), s = A.get(sp), ch = s ? null : chanIn(A, k);
    S.kind = 'seller'; S.sp = s ? s.sp : sp; S.title = cap(S.sp);
    var ML = S.L.filter(function (x) { return x.k === k; });
    S.o = summarize(S, ML);
    if (s) sellerFromAgg(S.o, s, ML);
    else if (ch) { S.o.r = ch.revenue; S.o.u = ch.closes; }
    S.team = s ? s.team : ch ? ch.team : String(team == null ? '' : team).trim();
    S.excluded = !(s && s.rank);                 // channel & team lead: di luar peringkat
    S.field = A.nSellers;
    S.rank = s && s.rank ? s.rank : 0;
    var T = teamIn(A, S.team), tm = rankedMembers(T);
    S.teamTotal = T ? T.revenue : S.o.r;          // omzet tim, termasuk channel & team lead
    S.share = S.teamTotal > 0 ? Math.min(1, S.o.r / S.teamTotal) : 0;
    S.teamField = tm.length; S.teamRank = s ? tm.indexOf(s) + 1 : 0;
    S.jr = S.excluded ? null : journey(S);
    S.prev = prevCompare(S, function (X) { return revIn(X, k); });
    var map = S.H.sp[k] || {};
    S.cols = colsOf(S, map); S.rec = recordOf(S, map);
    S.pBestDay = maxBefore(S.H.spDay[k] || {}, S.mk);
    S.pBig = maxBefore(S.H.spBig[k] || {}, S.mk);
    // rentetan hari berturut-turut dengan closing
    var run = 0, bestRun = { len: 0, from: 0, to: 0 };
    for (var i = 0; i < S.last; i++) {
      if (S.o.days[i] > 0) { run++; if (run > bestRun.len) bestRun = { len: run, from: i + 2 - run, to: i + 1 }; } else run = 0;
    }
    S.streak = bestRun;
    // posisi penjualan terbesar di antara semua penjualan Hurricane bulan ini
    if (S.o.big) { var below = 0; S.L.forEach(function (x) { if (x.r < S.o.big.r) below++; }); S.pctBig = S.L.length > 1 ? below / (S.L.length - 1) : 1; }
    S.records = recordsSeller(S);
    return S;
  }

  // Lencana fx-badges (HX.badges) adalah status LIVE hari ini: hanya dipakai
  // untuk cerita bulan berjalan, dan yang dobel dengan catatan sendiri dilewati.
  var BADGE_OK = { beruntun: 1, rekor: 1, terbesar: 1, hattrick: 1, 'juara-hari': 1 };
  function extBadges(S, have) {
    var out = [], t = now();
    if (S.y !== t.getFullYear() || S.m !== t.getMonth()) return out;
    var src = HX.badges, r = null;
    if (typeof src !== 'function') return out;
    try { r = src(S.sp, S.team); } catch (e) { r = null; }
    if (!Array.isArray(r)) return out;
    r.forEach(function (b) {
      if (!b || !BADGE_OK[b.id]) return;
      if (b.id === 'beruntun' && have.streak) return;
      if (b.id === 'rekor' && have.bestDay) return;
      var lbl = noEmoji(b.label), det = noEmoji(b.detail || '');
      if (lbl) out.push({ i: 'star', g: b.id === 'juara-hari' ? 'juara' : b.id, t: lbl, s: det, gold: b.tone === 'gold' });
    });
    return out;
  }
  function glyph(id, fb) {
    try { if (HX.badges && typeof HX.badges.icon === 'function') { var s = HX.badges.icon(id); if (s) return s; } } catch (e) { }
    return IC[fb] || IC.star;
  }
  function recordsSeller(S) {
    var L = [], o = S.o, have = {};
    if (S.rank === 1) L.push({ i: 'medal', g: 'juara', t: 'Sales #1 ' + BRAND_S(), s: 'Omset tertinggi dari ' + S.field + ' sales', gold: 1 });
    else if (S.rank && S.rank <= 5) L.push({ i: 'medal', t: 'Masuk 5 besar ' + BRAND_S(), s: 'Peringkat ' + S.rank + ' dari ' + S.field + ' sales' });
    if (S.teamRank === 1 && S.teamField > 1) L.push({ i: 'medal', g: 'juara', t: 'Nomor 1 di Team ' + noEmoji(S.team), s: 'Di atas ' + (S.teamField - 1) + ' rekan satu tim' });
    if (S.rec.isRecord) L.push({ i: 'star', g: 'rekor', t: 'Bulan terbaikmu sejauh ini', s: 'Melewati ' + mkLabel(S.rec.prev.at, S.y) + ' (' + short(S.rec.prev.v) + ')' });
    if (S.pBestDay.v > 0 && o.best && o.best.r > S.pBestDay.v) { have.bestDay = 1; L.push({ i: 'cal', t: 'Hari terbaik sepanjang masa', s: short(o.best.r) + ' pada ' + o.best.d + ' ' + BLN[S.m] }); }
    if (S.pBig.v > 0 && o.big && o.big.r > S.pBig.v) L.push({ i: 'tag', g: 'terbesar', t: 'Penjualan terbesar sepanjang karier', s: short(o.big.r) + (o.big.prod ? ' \u00b7 ' + o.big.prod : '') });
    if (S.jr && S.jr.climb >= 3) L.push({ i: 'up', t: 'Naik ' + S.jr.climb + ' peringkat', s: 'Dari #' + S.jr.start + ' ke #' + S.jr.end + ' dalam sebulan' });
    if (S.streak.len >= 3) { have.streak = 1; L.push({ i: 'bolt', g: 'beruntun', t: S.streak.len + ' hari berturut-turut closing', s: S.streak.from + '\u2013' + S.streak.to + ' ' + BULAN[S.m] }); }
    L = L.concat(extBadges(S, have));
    if (L.length < 3 && o.active) L.push({ i: 'cal', t: 'Closing di ' + o.active + ' dari ' + S.last + ' hari', s: o.tx + ' transaksi \u00b7 ' + o.u + ' unit' });
    // satu judul satu kali
    var seen = {};
    return L.filter(function (x) { var k = x.t.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 5);
  }

  /* ── ikon garis (tanpa emoji) ───────────────────────────────────── */
  function svg(p, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + p + '</svg>'; }
  var IC = {
    ring: svg('<path d="M12 3a9 9 0 0 1 9 9"/><path d="M21 12a9 9 0 0 1-9 9" opacity=".6"/><path d="M12 21a9 9 0 0 1-9-9" opacity=".38"/><path d="M3 12a9 9 0 0 1 9-9" opacity=".22"/><path d="M10.2 8.9v6.2l4.9-3.1z" fill="currentColor" stroke="none"/>'),
    x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    l: svg('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),
    r: svg('<path d="M9.5 5.5L16 12l-6.5 6.5"/>'),
    star: svg('<path d="M12 3.8l2.5 5.1 5.6.8-4.05 3.95.95 5.6L12 16.6l-5 2.65.95-5.6L3.9 9.7l5.6-.8z"/>'),
    up: svg('<path d="M4 16.5l5.2-5.2 3.8 3.8L20 8"/><path d="M14.5 8H20v5.5"/>'),
    cal: svg('<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10.5h16M9 3.5v4M15 3.5v4"/>'),
    bolt: svg('<path d="M13.2 3.5L5.5 13.2h5.6l-1 7.3 7.9-9.9h-5.7z"/>'),
    tag: svg('<path d="M3.8 12.6V4.2h8.4l8 8-8.4 8.4z"/><circle cx="8.2" cy="8.6" r="1.3"/>'),
    medal: svg('<path d="M5 20.5v-6h4.6v6M9.6 20.5V9h4.8v11.5M14.4 20.5V12.5H19v8"/><path d="M3.5 20.5h17"/>'),
    save: svg('<path d="M12 4v10.5M7.5 10l4.5 4.5 4.5-4.5M5 19.5h14"/>'),
    replay: svg('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4.6h4.6"/>'),
    tapR: svg('<rect x="6" y="2.8" width="12" height="18.4" rx="2.8"/><rect x="12.6" y="4.4" width="3.9" height="15.2" rx="1.4" fill="currentColor" stroke="none" opacity=".6"/>'),
    tapL: svg('<rect x="6" y="2.8" width="12" height="18.4" rx="2.8"/><rect x="7.5" y="4.4" width="3.9" height="15.2" rx="1.4" fill="currentColor" stroke="none" opacity=".6"/>'),
    hold: svg('<circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7.6" opacity=".45"/>'),
    down: svg('<path d="M12 4.5v13M6.5 12l5.5 5.5 5.5-5.5"/>'),
    grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>')
  };

  /* ── animasi: WAAPI (transform/opacity) + tween angka/garis ─────── */
  var EASE = 'cubic-bezier(.22,1,.36,1)', SPRING = 'cubic-bezier(.34,1.42,.64,1)';
  var CAN = !!(R.animate);
  function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
  function easeQuart(p) { return 1 - Math.pow(1 - p, 4); }
  function easeIO(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function linear(p) { return p; }

  // satu rAF untuk semua tween; berhenti sendiri bila kosong / jeda
  var TW = { list: [], raf: 0, paused: false, at: 0 };
  function twKick() { if (!TW.raf && !TW.paused && TW.list.length) TW.raf = requestAnimationFrame(twTick); }
  function twTick() {
    TW.raf = 0;
    var t = perf(), cur = TW.list; TW.list = [];
    for (var i = 0; i < cur.length; i++) {
      var w = cur[i];
      if (w.dead) continue;
      var p = (t - w.s) / w.d;
      if (p < 0) { TW.list.push(w); continue; }
      if (p >= 1) { try { w.fn(1); } catch (e) { } continue; }
      try { w.fn(w.e(p)); } catch (e) { }
      TW.list.push(w);
    }
    twKick();
  }
  function twPause() { if (TW.paused) return; TW.paused = true; TW.at = perf(); if (TW.raf) { cancelAnimationFrame(TW.raf); TW.raf = 0; } }
  function twResume() {
    if (!TW.paused) return;
    var dt = perf() - TW.at; TW.list.forEach(function (w) { w.s += dt; });
    TW.paused = false; twKick();
  }

  function Fx(instant) { this.instant = !!instant || !CAN; this.anims = []; this.tws = []; }
  Fx.prototype.a = function (el, frames, o) {
    if (this.instant || !el || !el.animate) return null;
    o = o || {};
    var a;
    try { a = el.animate(frames, { duration: o.d || 600, delay: o.delay || 0, easing: o.e || EASE, fill: 'both' }); } catch (e) { return null; }
    this.anims.push(a);
    if (V && V.isP) { try { a.pause(); a._hxp = 1; } catch (e) { } }
    return a;
  };
  Fx.prototype.tw = function (d, delay, fn, e) {
    if (this.instant) { fn(1); return; }
    fn(0);
    var w = { s: (TW.paused ? TW.at : perf()) + (delay || 0), d: d, fn: fn, e: e || easeOut };
    this.tws.push(w); TW.list.push(w); twKick();
  };
  Fx.prototype.pause = function () { this.anims.forEach(function (a) { try { if (a.playState === 'running') { a.pause(); a._hxp = 1; } } catch (e) { } }); };
  Fx.prototype.resume = function () { this.anims.forEach(function (a) { try { if (a._hxp && a.playState === 'paused') a.play(); a._hxp = 0; } catch (e) { } }); };
  Fx.prototype.end = function () {
    this.anims.forEach(function (a) { try { a.finish(); } catch (e) { } });
    this.tws.forEach(function (w) { if (!w.dead) { w.dead = true; try { w.fn(1); } catch (e) { } } });
    this.anims = []; this.tws = [];
  };
  Fx.prototype.up = function (el, delay, dist) { return this.a(el, [{ opacity: 0, transform: 'translateY(' + (dist || 16) + 'px)' }, { opacity: 1, transform: 'translateY(0)' }], { d: 760, delay: delay }); };
  Fx.prototype.fade = function (el, delay, d) { return this.a(el, [{ opacity: 0 }, { opacity: 1 }], { d: d || 520, delay: delay, e: 'ease-out' }); };
  Fx.prototype.mask = function (el, delay) { return this.a(el, [{ transform: 'translateY(112%)' }, { transform: 'translateY(0)' }], { d: 900, delay: delay, e: 'cubic-bezier(.19,1,.22,1)' }); };
  Fx.prototype.pop = function (el, delay) { return this.a(el, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { d: 560, delay: delay, e: SPRING }); };
  Fx.prototype.grow = function (el, delay, axis, d) {
    var k = axis === 'y' ? 'scaleY' : 'scaleX';
    return this.a(el, [{ transform: k + '(0)' }, { transform: k + '(1)' }], { d: d || 950, delay: delay, e: EASE });
  };
  Fx.prototype.each = function (list, kind, delay, step) {
    for (var i = 0; i < (list ? list.length : 0); i++) this[kind](list[i], delay + i * step);
  };
  // angka menghitung naik; lebar dikunci ke lebar akhir (tidak "menari")
  Fx.prototype.count = function (el, v, d, dur, delay) {
    if (!el) return;
    if (!this.instant) { var w = el.getBoundingClientRect().width; if (w) el.style.minWidth = Math.ceil(w) + 'px'; }
    this.tw(dur || 1500, delay || 0, function (p) { el.textContent = fmtNum(v * p, d || 0); }, easeQuart);
  };

  function q(el, x) { return el.querySelector('[data-x="' + x + '"]'); }
  function qa(el, sel) { return el.querySelectorAll(sel); }

  /* ── potongan HTML slide ────────────────────────────────────────── */
  function kick(t, x) { return '<div class="hxw-k" data-x="' + (x || 'k') + '"><i></i>' + esc(t) + '</div>'; }
  function maskH(t, cls, x) { return '<h2 class="' + cls + '" data-x="' + (x || 'h') + '"><span class="hxw-m"><span>' + esc(t) + '</span></span></h2>'; }
  function money(n, x, cls) {
    var s = split(n);
    return '<div class="hxw-n' + (cls ? ' ' + cls : '') + '" data-x="' + (x || 'n') + '"><span class="hxw-cur">Rp</span><span class="hxw-v" data-v="' + s.v + '" data-d="' + s.d + '">' + fmtNum(s.v, s.d) + '</span>' + (s.word ? '<span class="hxw-u">' + s.word + '</span>' : '') + '</div>';
  }
  function countMoney(fx, el, dur, delay) {
    var v = el && el.querySelector('.hxw-v');
    if (v) fx.count(v, +v.getAttribute('data-v'), +v.getAttribute('data-d'), dur, delay);
  }
  function stat(v, l) { return '<div class="hxw-st"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }
  function chip(team) { var m = mono(team); return m ? '<span class="hxw-mono">' + esc(m) + '</span>' : ''; }

  // jam bulan: satu garis per tanggal, panjang = omset hari itu
  function dialHTML(S, days) {
    var n = S.n, max = 0, best = -1, i, h = '';
    for (i = 0; i < n; i++) if (days[i] > max) { max = days[i]; best = i; }
    for (i = 0; i < n; i++) {
      var v = days[i], fut = i + 1 > S.last;
      var cls = fut ? 'f' : v > 0 ? (i === best ? 'b' : 'h') : 'e';
      var L = v > 0 ? 0.24 + 0.76 * Math.sqrt(v / max) : 0.1;
      h += '<i class="hxw-t ' + cls + '" style="transform:rotate(' + (i / n * 360).toFixed(2) + 'deg)"><b style="height:' + (L * 44).toFixed(1) + '%"></b></i>';
    }
    return '<div class="hxw-dial" data-x="dial"><div class="hxw-sweep" data-x="sweep"></div>' + h +
      '<div class="hxw-dial-c" data-x="dc"><b>' + BLN[S.m].toUpperCase() + '</b><span>' + S.y + '</span></div></div>';
  }
  function layoutDial(el) {
    var viz = q(el, 'viz'), dial = q(el, 'dial');
    if (!viz || !dial) return;
    var w = viz.clientWidth, h = viz.clientHeight;
    var size = Math.max(90, Math.min(w * 0.84, h * 0.98, 340));
    dial.style.width = dial.style.height = Math.round(size) + 'px';
    var n = dial.querySelectorAll('.hxw-t').length || 30;
    var tw = Math.max(2, Math.min(7, 2 * Math.PI * size * 0.28 / n * 0.5));
    dial.style.setProperty('--tw', tw.toFixed(1) + 'px');
  }
  function animDial(el, fx, delay) {
    var t = qa(el, '.hxw-t b'), n = t.length;
    fx.a(q(el, 'sweep'), [{ opacity: 0, transform: 'rotate(0deg)' }, { opacity: 1, transform: 'rotate(120deg)', offset: .2 }, { opacity: .9, transform: 'rotate(300deg)', offset: .8 }, { opacity: 0, transform: 'rotate(360deg)' }], { d: 1500, delay: delay, e: 'cubic-bezier(.45,.05,.35,1)' });
    for (var i = 0; i < n; i++) {
      var p = i / n, dl = delay + 80 + easeIO(p) * 1200;
      fx.a(t[i], [{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1 }], { d: 520, delay: dl, e: EASE });
    }
    fx.up(q(el, 'dc'), delay + 500, 8);
  }

  // batang harian
  function barsHTML(S, days, bestIdx, callTxt) {
    var max = 1, i, h = '';
    for (i = 0; i < days.length; i++) if (days[i] > max) max = days[i];
    for (i = 0; i < S.n; i++) {
      var v = days[i], fut = i + 1 > S.last;
      h += '<span class="hxw-db' + (i === bestIdx ? ' b' : '') + (fut ? ' f' : '') + '"><b style="height:' + (v > 0 ? Math.max(3, v / max * 100) : 1.4).toFixed(1) + '%"></b></span>';
    }
    var left = (bestIdx + 0.5) / S.n * 100, al = left < 16 ? 'l' : left > 84 ? 'r' : 'c';
    var call = bestIdx >= 0 ? '<div class="hxw-call ' + al + '" data-x="call" style="left:' + left.toFixed(2) + '%;bottom:' + Math.min(100, days[bestIdx] / max * 100).toFixed(1) + '%"><span>' + esc(callTxt) + '</span></div>' : '';
    return '<div class="hxw-days" data-x="days">' + h + call + '</div>' +
      '<div class="hxw-dx"><span>1 ' + BLN[S.m] + '</span><span>' + Math.round(S.n / 2) + '</span><span>' + S.n + ' ' + BLN[S.m] + '</span></div>';
  }
  function animBars(el, fx, delay) {
    var b = qa(el, '.hxw-db b'), n = b.length;
    for (var i = 0; i < n; i++) fx.a(b[i], [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { d: 700, delay: delay + i * (700 / n), e: EASE });
    var cl = q(el, 'call');
    fx.a(cl && cl.firstChild, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { d: 520, delay: delay + 900, e: EASE });
  }

  // daftar peringkat dengan batang
  function rankHTML(rows, x, cls) {
    var max = 1; rows.forEach(function (r) { if (r.r > max) max = r.r; });
    return '<div class="hxw-rank' + (cls ? ' ' + cls : '') + '" data-x="' + (x || 'rank') + '">' + rows.map(function (r) {
      return '<div class="hxw-rr' + (r.cls ? ' ' + r.cls : '') + '"><span class="hxw-rn">' + esc(r.no) + '</span>' +
        '<div class="hxw-rm"><div class="hxw-rt"><span class="nm">' + (r.chip || '') + '<span class="tx">' + esc(r.name) + '</span>' + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span>' +
        '<span class="vl">' + esc(r.val) + '</span></div><div class="hxw-rb"><b style="width:' + Math.max(1.5, r.r / max * 100).toFixed(1) + '%"></b></div></div></div>';
    }).join('') + '</div>';
  }
  function animRank(el, fx, delay, x) {
    var rows = qa(q(el, x || 'rank') || el, '.hxw-rr');
    for (var i = 0; i < rows.length; i++) {
      fx.up(rows[i], delay + i * 85, 12);
      fx.grow(rows[i].querySelector('.hxw-rb b'), delay + 120 + i * 85, 'x', 1000);
    }
  }

  // kolom bulan ke bulan
  function colsHTML(S) {
    var cols = S.cols, max = 1, recI = -1, best = 0;
    cols.forEach(function (c, i) { if (c.r > max) max = c.r; if (c.r > best) { best = c.r; recI = i; } });
    if (!(S.rec && S.rec.isRecord)) recI = -1;
    return '<div class="hxw-cols" data-x="cols">' + cols.map(function (c, i) {
      return '<div class="hxw-col' + (c.cur ? ' cur' : '') + '">' +
        '<span class="v">' + (i === recI ? '<em>Rekor</em>' : '') + (c.r ? esc(compact(c.r)) : '\u2014') + '</span>' +
        '<div class="bar"><b style="height:' + (c.r ? Math.max(2, c.r / max * 100) : 0.8).toFixed(1) + '%"></b></div>' +
        '<span class="m">' + BLN[c.m] + (c.partial ? '<small>1\u2013' + S.last + '</small>' : '') + '</span></div>';
    }).join('') + '</div>';
  }
  function animCols(el, fx, delay) {
    var c = qa(el, '.hxw-col');
    for (var i = 0; i < c.length; i++) {
      fx.grow(c[i].querySelector('.bar b'), delay + i * 110, 'y', 1000);
      fx.up(c[i].querySelector('.v'), delay + 380 + i * 110, 8);
    }
  }

  /* ── slide ───────────────────────────────────────────────────────── */
  function coverMeta(S) {
    if (S.kind === 'seller') {
      var r = S.rank ? '<span class="dot"></span>' + (S.rank === 1 ? '<span class="gold">#1</span>' : '#' + S.rank) + ' dari ' + S.field + ' sales' : '';
      return chip(S.team) + '<span>Team ' + esc(noEmoji(S.team)) + '</span>' + r;
    }
    if (S.kind === 'team') return chip(S.team) + '<span>' + (S.teamRank === 1 ? '<span class="gold">#1</span>' : '#' + S.teamRank) + ' dari ' + S.teamCount + ' tim</span><span class="dot"></span>' + S.members.length + ' sales';
    return '<span>Seluruh tim</span><span class="dot"></span>' + S.field + ' sales<span class="dot"></span>' + S.teams.length + ' tim';
  }
  function periodLbl(S, pre) { return pre + ' ' + (S.partial ? '1\u2013' + S.last + ' ' + BULAN[S.m] : BULAN[S.m]); }

  var SL = {};
  SL.cover = function (S) {
    return {
      id: 'cover', dur: 6400,
      html: function () {
        return kick(S.label) + maskH(S.title, 'hxw-name' + (S.title.length > 12 ? ' long' : '')) +
          '<div class="hxw-meta" data-x="meta">' + coverMeta(S) + '</div>' +
          '<div class="hxw-viz hxw-c" data-x="viz">' + dialHTML(S, S.o.days) + '</div>' +
          '<div class="hxw-lbl" data-x="lbl">' + esc(periodLbl(S, 'Omset')) + '</div>' + money(S.o.r) +
          '<div class="hxw-full" data-x="full">' + esc(full(S.o.r)) + '</div>' +
          '<div class="hxw-stats" data-x="stats">' + stat(S.o.u, 'closing') + stat(S.o.tx, 'transaksi') + stat(S.o.active, 'hari aktif') + '</div>';
      },
      play: function (el, fx) {
        layoutDial(el);
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 120);
        fx.up(q(el, 'meta'), 420); animDial(el, fx, 380);
        fx.up(q(el, 'lbl'), 900); fx.up(q(el, 'n'), 960); countMoney(fx, q(el, 'n'), 1700, 1000);
        fx.fade(q(el, 'full'), 1700);
        fx.each(q(el, 'stats').children, 'up', 1900, 110);
      }
    };
  };
  SL.best = function (S) {
    var b = S.o.best, sub;
    if (S.kind === 'seller') sub = b.u + ' closing hari itu' + (b.prods.length ? ' \u00b7 ' + b.prods.slice(0, 2).join(', ') : '');
    else sub = b.u + ' closing' + (b.top ? ' \u00b7 terbanyak dari ' + cap(b.top.sp) + ' (' + short(b.top.r) + ')' : '');
    return {
      id: 'best', dur: 5600,
      html: function () {
        return kick('Hari terbaik') + maskH(dLong(S.y, S.m, b.d), 'hxw-h') + money(b.r) +
          '<p class="hxw-p" data-x="p">' + esc(sub) + '</p>' +
          '<div class="hxw-viz hxw-bot" data-x="viz">' + barsHTML(S, S.o.days, b.d - 1, b.d + ' ' + BLN[S.m]) + '</div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100);
        fx.up(q(el, 'n'), 260); countMoney(fx, q(el, 'n'), 1300, 300);
        fx.up(q(el, 'p'), 600); animBars(el, fx, 500);
        fx.fade(el.querySelector('.hxw-dx'), 900);
      }
    };
  };
  SL.big = function (S) {
    var g = S.o.big, who, foot, pct;
    if (S.kind === 'seller') {
      who = g.u + ' unit \u00b7 Team ' + noEmoji(g.team || S.team);
      pct = S.pctBig || 0;
      foot = pct >= 0.995 ? 'Penjualan terbesar ' + BRAND_S() + ' bulan ini' : 'Lebih besar dari ' + Math.round(pct * 100) + '% penjualan ' + BRAND_S() + ' bulan ini';
    } else {
      who = cap(g.sp) + ' \u00b7 ' + (S.kind === 'company' ? 'Team ' + noEmoji(g.team) + ' \u00b7 ' : '') + g.u + ' unit';
      var x = S.avgSale > 0 ? g.r / S.avgSale : 1;
      pct = Math.min(1, 1 / Math.max(1, x));
      foot = (x >= 1.95 ? fmtNum(x, x >= 10 ? 0 : 1) + '\u00d7 rata-rata penjualan (' + short(S.avgSale) + ')' : 'Rata-rata penjualan ' + short(S.avgSale));
    }
    return {
      id: 'big', dur: 5600,
      html: function () {
        return kick('Penjualan terbesar') +
          '<div class="hxw-viz hxw-c" data-x="viz"><div class="hxw-ticket" data-x="ticket"><div class="hxw-sheen" data-x="sheen"></div>' +
          '<div class="tk-top"><span class="tk-prod">' + esc(g.prod || 'Penjualan') + '</span><span class="tk-date">' + g.d + ' ' + BLN[S.m] + ' ' + S.y + '</span></div>' +
          money(g.r, 'n', 'in-ticket') +
          '<div class="tk-who">' + esc(who) + '</div><div class="tk-cut"><i></i></div>' +
          '<div class="tk-foot" data-x="foot"><span>' + esc(foot) + '</span>' +
          (S.kind === 'seller' ? '<div class="hxw-pct"><b data-x="pf" style="width:' + (pct * 100).toFixed(1) + '%"></b><i data-x="pm" style="left:' + (pct * 100).toFixed(1) + '%"></i></div>' : '') + '</div></div></div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0);
        fx.a(q(el, 'ticket'), [{ opacity: 0, transform: 'translateY(46px) scale(.94)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { d: 900, delay: 120, e: EASE });
        countMoney(fx, q(el, 'n'), 1400, 380);
        fx.a(q(el, 'sheen'), [{ transform: 'translateX(-120%) skewX(-18deg)', opacity: 1 }, { transform: 'translateX(260%) skewX(-18deg)', opacity: 1 }], { d: 1300, delay: 1250, e: 'cubic-bezier(.4,0,.2,1)' });
        var pf = q(el, 'pf'); if (pf) fx.grow(pf, 1200, 'x', 1100);
        var pm = q(el, 'pm');
        if (pm) fx.a(pm, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { d: 520, delay: 2100, e: SPRING });
        fx.up(q(el, 'foot').querySelector('span'), 1100, 8);
      }
    };
  };
  SL.product = function (S) {
    var p = S.o.prods[0], share = S.o.r > 0 ? p.r / S.o.r : 0;
    var rows = S.o.prods.slice(0, S.kind === 'company' ? 5 : 4).map(function (x, i) {
      return { no: pad(i + 1), name: x.name, sub: x.u + ' unit', val: short(x.r), r: x.r, cls: i === 0 ? 'hi' : '' };
    });
    var who = S.kind === 'seller' ? 'omsetmu' : S.kind === 'team' ? 'omset tim' : 'omset ' + BRAND_S();
    return {
      id: 'product', dur: 5600,
      html: function () {
        return kick(S.kind === 'company' ? 'Produk terlaris' : 'Produk andalan') + maskH(p.name, 'hxw-name prod' + (p.name.length > 12 ? ' long' : '')) +
          '<p class="hxw-p" data-x="p"><b>' + p.u + ' unit</b> \u00b7 ' + esc(short(p.r)) + ' \u00b7 ' + Math.round(share * 100) + '% ' + who + '</p>' +
          '<div class="hxw-viz hxw-c" data-x="viz">' + rankHTML(rows, 'rank', rows.length <= 5 ? 'lg' : '') + '</div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100);
        fx.up(q(el, 'p'), 420); animRank(el, fx, 600);
      }
    };
  };
  SL.journey = function (S) {
    var j = S.jr, head;
    var all1 = j.pts.every(function (p) { return p.rank === 1; });
    if (all1) head = 'Di puncak sepanjang bulan';
    else if (j.end === 1 && j.start === 1) head = 'Kembali ke puncak';
    else if (j.end === 1) head = 'Naik ke puncak';
    else if (j.climb > 0) head = 'Naik ' + j.climb + ' peringkat';
    else if (j.climb < 0) head = 'Turun ' + (-j.climb) + ' peringkat';
    else head = 'Stabil di #' + j.end;
    return {
      id: 'journey', dur: 6200,
      html: function () {
        return kick('Perjalanan peringkat') + maskH(head, 'hxw-h') +
          '<div class="hxw-viz" data-x="viz"><div class="hxw-jr" data-x="jr"></div></div>' +
          '<div class="hxw-final" data-x="fin"><span class="big' + (j.end === 1 ? ' gold' : '') + '">#<span data-x="fr">' + j.end + '</span></span>' +
          '<span class="tx">dari ' + S.field + ' sales<br>' + (S.partial ? 'per ' + S.last + ' ' + BULAN[S.m] : 'akhir ' + BULAN[S.m]) + '</span></div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100);
        drawJourney(q(el, 'jr'), S, fx, 420);
        fx.up(q(el, 'fin'), 1500);
        var fr = q(el, 'fr');
        if (fr && j.start !== j.end) fx.tw(1300, 1600, function (p) { fr.textContent = String(Math.round(j.start + (j.end - j.start) * p)); }, easeOut);
      }
    };
  };
  function drawJourney(box, S, fx, delay) {
    if (!box) return;
    var w = box.clientWidth, h = box.clientHeight;
    if (w < 60 || h < 60) return;
    var j = S.jr, pts = j.pts, worst = 1;
    pts.forEach(function (p) { worst = Math.max(worst, p.rank || (p.field + 1)); });
    var hi = Math.max(worst + 1, 3), padL = 40, padR = 22, padT = 26, padB = 30;
    function X(i) { return padL + (pts.length === 1 ? 0.5 : i / (pts.length - 1)) * (w - padL - padR); }
    function Y(r) { return padT + (r - 1) / (hi - 1) * (h - padT - padB); }
    var grid = '', lines = [1, Math.round((1 + hi) / 2), hi];
    lines.forEach(function (r, i) {
      if (i === 1 && (r === 1 || r === hi)) return;
      grid += '<line x1="' + padL + '" x2="' + (w - padR) + '" y1="' + Y(r).toFixed(1) + '" y2="' + Y(r).toFixed(1) + '" class="g"/>';
    });
    var d = '';
    pts.forEach(function (p, i) { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.rank || p.field + 1).toFixed(1); });
    box.innerHTML = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' + grid +
      '<path class="glow" d="' + d + '"/><path class="ln" d="' + d + '"/></svg>' +
      lines.filter(function (r, i) { return !(i === 1 && (r === 1 || r === hi)); }).map(function (r) {
        return '<span class="ax" style="top:' + Y(r).toFixed(1) + 'px">#' + r + '</span>';
      }).join('') +
      pts.map(function (p, i) {
        var last = i === pts.length - 1, r = p.rank, rv = r || p.field + 1;
        var pv = i > 0 ? (pts[i - 1].rank || pts[i - 1].field + 1) : null, nv = i < pts.length - 1 ? (pts[i + 1].rank || pts[i + 1].field + 1) : null;
        var below = !last && rv > 1 && (pv === null || pv < rv) && (nv === null || nv < rv);
        return '<span class="jp' + (last ? ' end' : '') + (below ? ' below' : '') + (!r ? ' none' : '') + (r === 1 ? ' one' : '') + '" style="left:' + X(i).toFixed(1) + 'px;top:' + Y(r || p.field + 1).toFixed(1) + 'px"><i></i><em>' + (r ? '#' + r : '\u2014') + '</em></span>' +
          '<span class="dl" style="left:' + X(i).toFixed(1) + 'px">' + p.d + ' ' + BLN[S.m] + '</span>';
      }).join('');
    var paths = box.querySelectorAll('path'), dur = 1500;
    for (var k = 0; k < paths.length; k++) (function (pth) {
      var len = 0; try { len = pth.getTotalLength(); } catch (e) { }
      if (!len || fx.instant) return;
      pth.style.strokeDasharray = len + ' ' + len;
      fx.tw(dur, delay, function (p) { pth.style.strokeDashoffset = String(len * (1 - p)); }, easeIO);
    })(paths[k]);
    var dots = box.querySelectorAll('.jp');
    for (var i = 0; i < dots.length; i++) {
      var t = delay + easeInv(pts.length === 1 ? 1 : i / (pts.length - 1)) * dur;
      fx.a(dots[i], [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { d: 520, delay: t - 60, e: SPRING });
    }
    fx.each(box.querySelectorAll('.dl,.ax'), 'fade', delay, 40);
  }
  // waktu (0..1) saat easeIO mencapai x — titik muncul tepat saat garis tiba
  function easeInv(x) { var lo = 0, hi = 1; for (var i = 0; i < 18; i++) { var mid = (lo + hi) / 2; if (easeIO(mid) < x) lo = mid; else hi = mid; } return (lo + hi) / 2; }

  SL.vs = function (S) {
    var P = S.prev, rec = S.rec, d = P.delta, head, big, cls = '';
    var who = S.kind === 'seller' ? 'mu' : S.kind === 'team' ? ' Team ' + noEmoji(S.team) : ' ' + BRAND_S();
    if (rec.isRecord) head = S.kind === 'company' ? 'Rekor baru ' + BRAND_S() : 'Bulan terbaik' + who + ' sejauh ini';
    else if (rec.first) head = S.kind === 'seller' ? 'Bulan pertamamu tercatat' : 'Bulan pertama tercatat';
    else if (d === null) head = 'Kembali mencetak omset';
    else if (rec.rankAll === 2 && rec.months >= 3) head = 'Bulan terbaik ke-2' + (S.kind === 'seller' ? 'mu' : '');
    else head = d >= 0 ? 'Lebih tinggi dari ' + BULAN[P.m] : 'Lebih rendah dari ' + BULAN[P.m];
    if (d === null) big = '<span class="hxw-pc">' + esc(short(S.o.r)) + '</span>';
    else { cls = d >= 0 ? 'pos' : 'neg'; big = '<span class="hxw-pc ' + cls + '" data-x="pc">' + pctTxt(d) + '</span>'; }
    var lim = S.partial ? ' 1\u2013' + P.lim : '';
    var note = d === null ? '' : BULAN[S.m] + (S.partial ? ' 1\u2013' + S.last : '') + ': ' + short(S.o.r) + ' \u00b7 ' + BULAN[P.m] + lim + ': ' + short(P.base);
    return {
      id: 'vs', dur: 5800,
      html: function () {
        return kick(d === null ? 'Bulan ke bulan' : 'Dibanding ' + BULAN[P.m]) +
          '<div class="hxw-pcw" data-x="pcw">' + big + '</div>' + maskH(head, 'hxw-h' + (rec.isRecord ? ' rec' : '')) +
          (note ? '<p class="hxw-p" data-x="p">' + esc(note) + '</p>' : '') +
          '<div class="hxw-viz hxw-bot" data-x="viz">' + colsHTML(S) + '</div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0);
        fx.a(q(el, 'pcw'), [{ opacity: 0, transform: 'translateY(24px) scale(.92)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { d: 900, delay: 120, e: EASE });
        var pc = q(el, 'pc');
        if (pc && d !== null) {
          var v = Math.abs(Math.round(d * 1000) / 10), sg = d > 0 ? '+' : d < 0 ? '\u2212' : '';
          var dec = v >= 10 ? 0 : 1;
          fx.tw(1300, 200, function (p) { pc.textContent = sg + fmtNum(v * p, dec) + '%'; }, easeQuart);
        }
        fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 420);
        fx.up(q(el, 'p'), 700); animCols(el, fx, 600);
      }
    };
  };
  SL.share = function (S) {
    var head = S.teamRank === 1 ? '#1 di Team ' + noEmoji(S.team) : '#' + S.teamRank + ' di Team ' + noEmoji(S.team);
    var C = 2 * Math.PI * 52, p = S.share;
    return {
      id: 'share', dur: 5400,
      html: function () {
        return kick('Kontribusi di Team ' + noEmoji(S.team)) +
          '<div class="hxw-viz hxw-c" data-x="viz"><div class="hxw-donut" data-x="donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="trk" cx="60" cy="60" r="52"/>' +
          '<circle class="arc" data-x="arc" cx="60" cy="60" r="52" transform="rotate(-90 60 60)" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - p)).toFixed(2) + '"/></svg>' +
          '<div class="c"><b><span data-x="sp">' + Math.round(p * 100) + '</span><small>%</small></b><span>omset tim</span></div></div></div>' +
          '<h2 class="hxw-h" data-x="h"><span class="hxw-m"><span>' + (S.teamRank === 1 ? '<span class="gold">#1</span>' + esc(head.slice(2)) : esc(head)) + '</span></span></h2>' +
          '<p class="hxw-p" data-x="p">' + esc(short(S.o.r) + ' dari ' + short(S.teamTotal) + ' omset tim \u00b7 ' + S.teamField + ' sales') + '</p>';
      },
      play: function (el, fx) {
        var viz = q(el, 'viz'), dn = q(el, 'donut');
        if (viz && dn) { var s = Math.max(120, Math.min(viz.clientWidth * 0.72, viz.clientHeight * 0.96, 300)); dn.style.width = dn.style.height = Math.round(s) + 'px'; }
        fx.up(q(el, 'k'), 0);
        fx.a(dn, [{ opacity: 0, transform: 'scale(.86) rotate(-30deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { d: 1000, delay: 80, e: EASE });
        var arc = q(el, 'arc'), spn = q(el, 'sp');
        fx.tw(1500, 300, function (t) { arc.setAttribute('stroke-dashoffset', (C * (1 - p * t)).toFixed(2)); spn.textContent = String(Math.round(p * 100 * t)); }, easeIO);
        fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 900); fx.up(q(el, 'p'), 1150);
      }
    };
  };
  SL.records = function (S) {
    return {
      id: 'records', dur: 6000,
      html: function () {
        return kick('Catatan ' + BULAN[S.m]) + maskH(S.records.length > 1 ? 'Yang kamu cetak bulan ini' : 'Yang kamu cetak', 'hxw-h') +
          '<div class="hxw-viz hxw-tp" data-x="viz"><div class="hxw-recs">' + S.records.map(function (r) {
            return '<div class="hxw-rec' + (r.gold ? ' gold' : '') + '"><i>' + (r.g ? glyph(r.g, r.i) : (IC[r.i] || IC.star)) + '</i><div><b>' + esc(r.t) + '</b>' + (r.s ? '<span>' + esc(r.s) + '</span>' : '') + '</div></div>';
          }).join('') + '</div></div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100);
        var rows = qa(el, '.hxw-rec');
        for (var i = 0; i < rows.length; i++) {
          fx.a(rows[i], [{ opacity: 0, transform: 'translateX(26px)' }, { opacity: 1, transform: 'translateX(0)' }], { d: 760, delay: 420 + i * 170, e: EASE });
          fx.pop(rows[i].querySelector('i'), 520 + i * 170);
        }
      }
    };
  };
  // team: MVP
  // team: MVP + podium tiga besar
  function podiumHTML(list) {
    var top = list.slice(0, 3), order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
    var max = top[0].r || 1;
    return '<div class="hxw-pod" data-x="pod">' + order.map(function (i) {
      var x = top[i], h = Math.max(26, x.r / max * 100).toFixed(1);
      return '<div class="pc pr' + (i + 1) + '"><div class="bw"><div class="bar" style="height:' + h + '%"><b>' + (i + 1) + '</b></div>' +
        '<div class="lab" style="bottom:' + h + '%"><span class="nm">' + esc(cap(x.sp)) + '</span><span class="vl">' + esc(short(x.r)) + '</span></div></div></div>';
    }).join('') + '</div>';
  }
  SL.mvp = function (S) {
    var m = S.mvp, tot = S.o.r || 1;
    return {
      id: 'mvp', dur: 5800,
      html: function () {
        return kick('MVP Team ' + noEmoji(S.team)) + maskH(cap(m.sp), 'hxw-name' + (m.sp.length > 12 ? ' long' : '')) + money(m.r) +
          '<p class="hxw-p" data-x="p">' + Math.round(m.r / tot * 100) + '% omset tim \u00b7 ' + m.u + ' closing' + (S.members.length > 1 ? ' \u00b7 unggul ' + esc(short(m.r - S.members[1].r)) + ' dari #2' : '') + '</p>' +
          '<div class="hxw-viz hxw-bot" data-x="viz">' + podiumHTML(S.members) + '</div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100);
        fx.up(q(el, 'n'), 300); countMoney(fx, q(el, 'n'), 1300, 340); fx.up(q(el, 'p'), 650);
        var pcs = qa(el, '.hxw-pod .pc'), n = pcs.length;
        // naik berurutan: #3, #2, lalu #1 paling akhir
        for (var i = 0; i < n; i++) {
          var rk = +(pcs[i].className.match(/pr(\d)/) || [0, 1])[1], dl = 700 + (n - rk) * 260;
          fx.grow(pcs[i].querySelector('.bar'), dl, 'y', 900);
          fx.up(pcs[i].querySelector('.lab'), dl + 520, 10);
        }
      }
    };
  };
  SL.members = function (S) {
    var rows = S.members.slice(0, 7).map(function (s, i) {
      return { no: pad(i + 1), name: cap(s.sp), sub: s.u + ' closing', val: short(s.r), r: s.r, cls: i === 0 ? 'hi one' : '' };
    });
    var more = S.members.length - rows.length;
    S.others.forEach(function (o) { rows.push({ no: '\u2014', name: o.name, sub: 'di luar peringkat', val: short(o.r), r: o.r, cls: 'dim' }); });
    return {
      id: 'members', dur: 6000,
      html: function () {
        return kick('Peringkat anggota') + maskH(S.members.length + ' sales mencetak omset', 'hxw-h') +
          '<div class="hxw-viz ' + (rows.length <= 5 ? 'hxw-c' : 'hxw-tp') + '" data-x="viz">' + rankHTML(rows, 'rank', rows.length <= 5 ? 'lg' : '') + (more > 0 ? '<div class="hxw-more">dan ' + more + ' sales lainnya</div>' : '') + '</div>';
      },
      play: function (el, fx) { fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100); animRank(el, fx, 380); }
    };
  };
  // Hurricane: total closing sebagai titik per tanggal
  SL.closings = function (S) {
    var perDay = S.o.active ? S.o.u / S.o.active : 0;
    return {
      id: 'closings', dur: 5800,
      html: function () {
        return kick('Total closing') +
          '<div class="hxw-n big-count" data-x="n"><span class="hxw-v" data-v="' + S.o.u + '" data-d="0">' + fmtNum(S.o.u, 0) + '</span><span class="hxw-u">closing</span></div>' +
          '<p class="hxw-p" data-x="p">' + S.o.tx + ' transaksi \u00b7 rata-rata ' + fmtNum(perDay, 1) + ' closing per hari aktif \u00b7 ' + S.o.active + ' hari aktif</p>' +
          '<div class="hxw-viz hxw-bot" data-x="viz"><div class="hxw-dots" data-x="dots"></div><div class="hxw-cap" data-x="cap"></div></div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.up(q(el, 'n'), 80); countMoney(fx, q(el, 'n'), 1500, 140); fx.up(q(el, 'p'), 400);
        drawDots(q(el, 'dots'), q(el, 'cap'), S, fx, 450);
      }
    };
  };
  function drawDots(box, capEl, S, fx, delay) {
    if (!box) return;
    var w = box.clientWidth, h = box.clientHeight;
    if (w < 60 || h < 40) return;
    var dpr = Math.min(2, W.devicePixelRatio || 1), c = D.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); c.style.width = w + 'px'; c.style.height = h + 'px';
    box.appendChild(c);
    var g = c.getContext('2d');
    if (!g) return;
    g.scale(dpr, dpr);
    var n = S.n, du = S.o.du, maxU = 1, i;
    for (i = 0; i < n; i++) if (du[i] > maxU) maxU = du[i];
    var colW = w / n, dot = Math.max(2, Math.min(colW * 0.56, 6.5)), step = dot + Math.max(1.2, dot * 0.42);
    var rows = Math.max(4, Math.floor((h - 4) / step)), k = Math.max(1, Math.ceil(maxU / rows));
    var cnt = du.map(function (u) { return Math.ceil(u / k); });
    var bestI = S.o.best ? S.o.best.d - 1 : -1;
    if (capEl) capEl.textContent = (k === 1 ? '1 titik = 1 closing' : '1 titik = ' + k + ' closing') + ' \u00b7 per tanggal';
    function draw(p) {
      g.clearRect(0, 0, w, h);
      var bat = [[], []];
      for (var d = 0; d < n; d++) {
        var cx = (d + 0.5) * colW;
        if (d + 1 > S.last) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(cx - dot / 2, h - dot, dot, dot * 0.5); continue; }
        var t0 = d / n * 0.5, qv = Math.max(0, Math.min(1, (p - t0) / 0.5)), show = Math.round(cnt[d] * easeOut(qv));
        for (var j = 0; j < show; j++) bat[d === bestI ? 1 : 0].push(cx, h - dot / 2 - j * step);
      }
      [['rgba(48,209,88,.72)', bat[0]], ['#7dffa3', bat[1]]].forEach(function (b) {
        var a = b[1]; if (!a.length) return;
        g.fillStyle = b[0]; g.beginPath();
        for (var z = 0; z < a.length; z += 2) { g.moveTo(a[z] + dot / 2, a[z + 1]); g.arc(a[z], a[z + 1], dot / 2, 0, 6.2832); }
        g.fill();
      });
    }
    fx.tw(1700, delay, draw, linear);
    fx.fade(capEl, delay + 900);
  }
  SL.top5 = function (S) {
    var rows = S.ranked.slice(0, 5).map(function (s, i) {
      return { no: pad(i + 1), name: cap(s.sp), sub: 'Team ' + noEmoji(s.team), chip: chip(s.team), val: short(s.r), r: s.r, cls: i === 0 ? 'hi one' : '' };
    });
    var ch = S.channel.r > 0 ? '<div class="hxw-more">Channel (' + esc(S.channel.names.join(', ')) + ') ' + esc(short(S.channel.r)) + ' \u00b7 di luar peringkat</div>' : '';
    return {
      id: 'top5', dur: 6000,
      html: function () {
        var t = S.ranked[0];
        return kick('Top 5 sales') + maskH(cap(t.sp) + ' memimpin', 'hxw-h') +
          '<p class="hxw-p" data-x="p">' + esc(short(t.r) + ' \u00b7 ' + t.u + ' closing \u00b7 dari ' + S.field + ' sales') + '</p>' +
          '<div class="hxw-viz hxw-c" data-x="viz">' + rankHTML(rows, 'rank', 'lg') + ch + '</div>';
      },
      play: function (el, fx) { fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100); fx.up(q(el, 'p'), 360); animRank(el, fx, 480); fx.fade(el.querySelector('.hxw-more'), 1300); }
    };
  };
  SL.topteam = function (S) {
    var t = S.teams[0];
    var rows = S.teams.slice(0, 5).map(function (x, i) {
      return { no: pad(i + 1), name: 'Team ' + noEmoji(x.name), chip: chip(x.name), sub: x.top ? 'MVP ' + cap(x.top.sp) : '', val: short(x.r), r: x.r, cls: i === 0 ? 'hi one' : '' };
    });
    return {
      id: 'topteam', dur: 6000,
      html: function () {
        return kick('Tim terbaik') + maskH('Team ' + noEmoji(t.name), 'hxw-name' + (t.name.length > 8 ? ' long' : '')) + money(t.r) +
          '<p class="hxw-p" data-x="p">' + Math.round(t.r / (S.o.r || 1) * 100) + '% omset ' + BRAND_S() + (t.top ? ' \u00b7 MVP ' + esc(cap(t.top.sp)) : '') + '</p>' +
          '<div class="hxw-viz hxw-tp" data-x="viz">' + rankHTML(rows, 'rank') + (S.teams.length > 5 ? '<div class="hxw-more">dan ' + (S.teams.length - 5) + ' tim lainnya</div>' : '') + '</div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 100);
        fx.up(q(el, 'n'), 280); countMoney(fx, q(el, 'n'), 1300, 320); fx.up(q(el, 'p'), 560); animRank(el, fx, 700);
      }
    };
  };
  function tilesOf(S) {
    var o = S.o, T = [];
    T.push({ l: 'Omset', v: short(o.r), s: S.partial ? '1\u2013' + S.last + ' ' + BLN[S.m] : BULAN[S.m] });
    T.push({ l: 'Closing', v: String(o.u), s: o.tx + ' transaksi' });
    if (S.kind === 'seller') {
      T.push({ l: 'Peringkat', v: S.rank ? '#' + S.rank : '\u2014', s: S.rank ? 'dari ' + S.field + ' sales' : 'di luar peringkat', gold: S.rank === 1 });
      T.push({ l: 'Hari terbaik', v: o.best ? o.best.d + ' ' + BLN[S.m] : '\u2014', s: o.best ? short(o.best.r) : '' });
      T.push({ l: 'Terbesar', v: o.big ? short(o.big.r) : '\u2014', s: o.big ? o.big.prod : '' });
      T.push({ l: 'Andalan', v: o.prods[0] ? o.prods[0].name : '\u2014', s: o.prods[0] ? o.prods[0].u + ' unit' : '', txt: 1 });
    } else if (S.kind === 'team') {
      T.push({ l: 'Peringkat', v: '#' + S.teamRank, s: 'dari ' + S.teamCount + ' tim', gold: S.teamRank === 1 });
      T.push({ l: 'MVP', v: S.mvp ? cap(S.mvp.sp) : '\u2014', s: S.mvp ? short(S.mvp.r) : '', txt: 1 });
      T.push({ l: 'Hari terbaik', v: o.best ? o.best.d + ' ' + BLN[S.m] : '\u2014', s: o.best ? short(o.best.r) : '' });
      T.push({ l: 'Andalan', v: o.prods[0] ? o.prods[0].name : '\u2014', s: o.prods[0] ? o.prods[0].u + ' unit' : '', txt: 1 });
    } else {
      var t1 = S.ranked[0], tt = S.teams[0];
      T.push({ l: 'Sales #1', v: t1 ? cap(t1.sp) : '\u2014', s: t1 ? short(t1.r) : '', txt: 1, gold: !!t1 });
      T.push({ l: 'Team #1', v: tt ? noEmoji(tt.name) : '\u2014', s: tt ? short(tt.r) : '', txt: 1 });
      T.push({ l: 'Hari terbaik', v: o.best ? o.best.d + ' ' + BLN[S.m] : '\u2014', s: o.best ? short(o.best.r) : '' });
      T.push({ l: 'Terlaris', v: o.prods[0] ? o.prods[0].name : '\u2014', s: o.prods[0] ? o.prods[0].u + ' unit' : '', txt: 1 });
    }
    return T;
  }
  SL.summary = function (S, st) {
    var T = tilesOf(S);
    return {
      id: 'summary', dur: 5000, last: true,
      html: function () {
        return kick(S.label) + maskH(S.title, 'hxw-name sm' + (S.title.length > 12 ? ' long' : '')) +
          '<div class="hxw-meta" data-x="meta">' + coverMeta(S) + '</div>' +
          '<div class="hxw-viz hxw-tp" data-x="viz"><div class="hxw-grid" data-x="grid">' + T.map(function (t) {
            return '<div class="hxw-tile' + (t.gold ? ' gold' : '') + (t.txt ? ' txt' : '') + '"><span class="l">' + esc(t.l) + '</span><b>' + esc(t.v) + '</b>' + (t.s ? '<small>' + esc(t.s) + '</small>' : '') + '</div>';
          }).join('') + '</div></div>' +
          '<div class="hxw-acts" data-x="acts"><button type="button" class="hxw-btn pri" data-act="save">' + IC.save + '<span>Simpan gambar</span></button>' +
          '<button type="button" class="hxw-btn" data-act="replay" aria-label="Putar ulang">' + IC.replay + '<span>Putar ulang</span></button>' +
          (st.fromChooser ? '<button type="button" class="hxw-btn ic" data-act="chooser" aria-label="Cerita lain">' + IC.grid + '</button>' : '') + '</div>';
      },
      play: function (el, fx) {
        fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 80); fx.up(q(el, 'meta'), 300);
        var t = qa(el, '.hxw-tile');
        for (var i = 0; i < t.length; i++) fx.a(t[i], [{ opacity: 0, transform: 'translateY(18px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { d: 760, delay: 380 + i * 80, e: EASE });
        fx.up(q(el, 'acts'), 900);
        // gambar share disiapkan SETELAH animasi masuk selesai (canvas berat)
        var v = V;
        setTimeout(function () { if (V === v && V.story === st) prepImage(st); }, fx.instant ? 300 : 1800);
      }
    };
  };

  /* ── susunan cerita ─────────────────────────────────────────────── */
  function storySeller(sp, team, y, m) {
    var S = statsSeller(sp, team, y, m), st = { kind: 'seller', S: S, slides: [] };
    if (!S.o.tx) return null;
    var s = st.slides;
    s.push(SL.cover(S));
    if (S.o.best) s.push(SL.best(S));
    if (S.o.big) s.push(SL.big(S));
    if (S.o.prods.length) s.push(SL.product(S));
    if (S.jr && S.jr.pts.length >= 2) s.push(SL.journey(S));
    s.push(SL.vs(S));
    if (S.teamField > 1 && S.share > 0 && !S.excluded) s.push(SL.share(S));
    if (S.records.length) s.push(SL.records(S));
    s.push(SL.summary(S, st));
    return st;
  }
  function storyTeam(team, y, m) {
    var S = statsTeam(team, y, m), st = { kind: 'team', S: S, slides: [] };
    if (!S.o.tx) return null;
    var s = st.slides;
    s.push(SL.cover(S));
    if (S.mvp) s.push(SL.mvp(S));
    if (S.o.best) s.push(SL.best(S));
    if (S.o.prods.length) s.push(SL.product(S));
    if (S.members.length > 1) s.push(SL.members(S));
    s.push(SL.vs(S));
    if (S.o.big && s.length < 7) s.push(SL.big(S));
    s.push(SL.summary(S, st));
    return st;
  }
  function storyCompany(y, m) {
    var S = statsCompany(y, m), st = { kind: 'company', S: S, slides: [] };
    if (!S.o.tx) return null;
    var s = st.slides;
    s.push(SL.cover(S));
    s.push(SL.vs(S));
    s.push(SL.closings(S));
    if (S.o.best) s.push(SL.best(S));
    if (S.ranked.length) s.push(SL.top5(S));
    if (S.teams.length) s.push(SL.topteam(S));
    if (S.o.prods.length) s.push(SL.product(S));
    if (S.o.big) s.push(SL.big(S));
    s.push(SL.summary(S, st));
    return st;
  }

  /* ── penampil cerita (layar penuh) ──────────────────────────────── */
  var V = null, skipPops = 0, popBound = false;
  function isReduced() { return HX.reduced() || !CAN; }
  // Label kanan atas: 'Gabriel · Oktober 2026'. Di layar sempit (iPhone SE
  // 320px, kartu HP miring) dipendekkan bertahap tanpa elipsis:
  // 'Gabriel · Okt 2026' -> 'Okt 2026'. Bulan selalu tetap terlihat.
  function fitTag() {
    if (!V || !V.tag) return;
    var el = V.tag, c;
    if (V.mode === 'story' && V.story) {
      var S = V.story.S, nm = V.story.kind === 'company' ? '' : S.title + ' \u00b7 ';
      c = [nm + BULAN[S.m] + ' ' + S.y, nm + BLN[S.m] + ' ' + S.y, BULAN[S.m] + ' ' + S.y, BLN[S.m] + ' ' + S.y];
    } else if (V.mode === 'chooser' && V.chM != null) c = [BULAN[V.chM] + ' ' + V.chY, BLN[V.chM] + ' ' + V.chY];
    else return;
    el.title = c[0];
    for (var i = 0; i < c.length; i++) {
      el.textContent = c[i];
      if (el.scrollWidth <= el.clientWidth + 1) return;
    }
  }
  function layout() {
    if (!V) return;
    var vw = W.innerWidth, vh = W.innerHeight, desk = vw >= 720 && vh >= 540, land = !desk && vw > vh * 1.15;
    var w, h;
    if (desk) { h = Math.min(vh - 48, 900); w = Math.round(h * 9 / 16); V.card.style.width = w + 'px'; V.card.style.height = Math.round(h) + 'px'; }
    // HP miring: kartu tegak di tengah, bukan tata letak melar selebar layar
    else if (land) { h = vh; w = Math.min(vw, Math.round(vh * 0.86)); V.card.style.width = w + 'px'; V.card.style.height = h + 'px'; }
    else { w = vw; h = vh; V.card.style.width = ''; V.card.style.height = ''; }
    var u = Math.min(w, h / 1.7) / 100;
    V.root.style.setProperty('--u', u.toFixed(3) + 'px');
    V.root.style.setProperty('--cw', Math.round(w) + 'px');
    V.root.classList.toggle('is-desk', desk);
    V.root.classList.toggle('is-land', land);
    V.root.classList.toggle('is-short', h / w < 1.62);
    fitTag();
  }
  function build() {
    var root = D.createElement('div');
    root.className = 'hxw';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('tabindex', '-1');
    root.innerHTML =
      '<div class="hxw-card" data-x="card">' +
        '<div class="hxw-slides" data-x="slides" aria-live="polite"></div>' +
        '<div class="hxw-top" data-x="top"><div class="hxw-segs" data-x="segs"></div>' +
          '<div class="hxw-bar"><span class="hxw-brand"><i></i>' + esc(BRAND().toUpperCase()) + '</span><span class="hxw-tag" data-x="tag"></span>' +
          '<button type="button" class="hxw-x" data-act="close" aria-label="Tutup">' + IC.x + '</button></div></div>' +
        '<div class="hxw-hint" data-x="hint"></div>' +
        '<div class="hxw-coach" data-x="coach" data-act="coach"></div>' +
        '<div class="hxw-sheet" data-x="sheet"></div>' +
      '</div>' +
      '<button type="button" class="hxw-nav prev" data-act="prev" aria-label="Sebelumnya">' + IC.l + '</button>' +
      '<button type="button" class="hxw-nav next" data-act="next" aria-label="Berikutnya">' + IC.r + '</button>';
    return root;
  }
  function openViewer(origin) {
    if (V) return V;
    var root = build();
    V = {
      root: root, card: q(root, 'card'), slides: q(root, 'slides'), segs: q(root, 'segs'), tag: q(root, 'tag'),
      hint: q(root, 'hint'), coach: q(root, 'coach'), sheet: q(root, 'sheet'), i: -1, story: null, cur: null, prog: null,
      paused: {}, isP: false, focus: D.activeElement, hist: false, tok: 'hxw' + Date.now()
    };
    D.body.appendChild(root);
    layout();
    // kunci halaman di belakang (lebar scrollbar diganti padding: tanpa loncat)
    var sbw = W.innerWidth - R.clientWidth;
    V.pr = R.style.paddingRight;
    if (sbw > 0) R.style.paddingRight = sbw + 'px';
    R.classList.add('hx-overlay-open', 'hxw-lock');
    bind();
    try { W.history.pushState({ hxw: V.tok }, ''); V.hist = true; } catch (e) { }
    // muncul dari tombol yang diketuk
    if (!isReduced()) {
      var o = 'center';
      if (origin && origin.getBoundingClientRect) {
        var b = origin.getBoundingClientRect(), c = V.card.getBoundingClientRect();
        o = Math.round(b.left + b.width / 2 - c.left) + 'px ' + Math.round(b.top + b.height / 2 - c.top) + 'px';
      }
      V.card.style.transformOrigin = o;
      root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
      V.card.animate([{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 520, easing: EASE });
    }
    try { root.focus({ preventScroll: true }); } catch (e) { try { root.focus(); } catch (er) { } }
    return V;
  }
  function closeViewer(how) {
    if (!V || V.closing) return;
    var v = V; v.closing = true;
    if (v.cur) v.cur.fx.end();
    if (v.prog) { try { v.prog.cancel(); } catch (e) { } v.prog = null; }
    TW.list = []; TW.paused = false;
    if (how !== 'pop' && v.hist) {
      v.hist = false;
      try { if (W.history.state && W.history.state.hxw === v.tok) { skipPops++; W.history.back(); } } catch (e) { }
    }
    unbind();
    var done = function () {
      if (v.root.parentNode) v.root.parentNode.removeChild(v.root);
      if (v.url) { try { URL.revokeObjectURL(v.url); } catch (e) { } }
      R.classList.remove('hx-overlay-open', 'hxw-lock', 'hx-gesture');
      R.style.paddingRight = v.pr || '';
      try { if (v.focus && v.focus.focus && D.body.contains(v.focus)) v.focus.focus({ preventScroll: true }); } catch (e) { }
    };
    V = null;
    if (isReduced() || !v.root.animate) { done(); return; }
    var cs = W.getComputedStyle(v.card).transform;
    var from = cs && cs !== 'none' ? cs : 'translateY(0) scale(1)';
    v.root.style.pointerEvents = 'none';
    v.card.animate([{ transform: from, opacity: 1 }, { transform: 'translateY(' + (how === 'swipe' ? '60%' : '28px') + ') scale(.94)', opacity: 0 }], { duration: how === 'swipe' ? 300 : 260, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    var a = v.root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 40, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = done;
    setTimeout(done, 700);
  }

  function setPause(reason, on) {
    if (!V) return;
    V.paused[reason] = !!on;
    var p = false; for (var k in V.paused) if (V.paused[k]) p = true;
    if (p === V.isP) return;
    V.isP = p;
    V.root.classList.toggle('is-paused', p && !!V.paused.hold);
    if (p) { if (V.prog) try { V.prog.pause(); } catch (e) { } if (V.cur) V.cur.fx.pause(); twPause(); }
    else {
      if (V.prog) try { if (V.prog.playState === 'paused') V.prog.play(); } catch (e) { }
      if (V.cur) V.cur.fx.resume(); twResume();
    }
  }
  function segBars(n) {
    var h = '';
    for (var i = 0; i < n; i++) h += '<span class="hxw-seg"><i></i></span>';
    V.segs.innerHTML = h;
    V.segEls = V.segs.querySelectorAll('.hxw-seg i');
  }
  function runProgress(i, dur) {
    if (V.prog) { try { V.prog.cancel(); } catch (e) { } V.prog = null; }
    var segs = V.segEls;
    for (var j = 0; j < segs.length; j++) segs[j].style.transform = j < i ? 'scaleX(1)' : 'scaleX(0)';
    var bar = segs[i];
    if (!bar) return;
    if (isReduced()) { bar.style.transform = 'scaleX(1)'; return; }
    var a = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: dur, easing: 'linear', fill: 'forwards' });
    V.prog = a;
    var v = V;
    a.onfinish = function () {
      if (V !== v || v.prog !== a) return;
      bar.style.transform = 'scaleX(1)';
      if (v.i < v.story.slides.length - 1) go(v.i + 1, 1);
    };
    if (V.isP) a.pause();
  }
  function startStory(st, fromChooser) {
    if (!V) return;
    st.fromChooser = !!fromChooser;
    V.story = st; V.mode = 'story';
    V.root.classList.remove('is-chooser');
    fitTag();
    V.root.setAttribute('aria-label', st.S.label + ' \u2014 ' + st.S.title);
    V.img = null; V.imgP = null;
    segBars(st.slides.length);
    go(0, 1);
    showHint();
  }
  function go(i, dir) {
    if (!V || !V.story) return;
    var st = V.story;
    i = Math.max(0, Math.min(st.slides.length - 1, i));
    closeSheet();
    var old = V.cur, inst = isReduced();
    if (old) old.fx.end();
    var sl = st.slides[i], el = D.createElement('div');
    el.className = 'hxw-slide hxw-s-' + sl.id;
    el.innerHTML = sl.html();
    V.slides.appendChild(el);
    var fx = new Fx(inst);
    V.cur = { el: el, fx: fx, i: i, sl: sl };
    V.i = i;
    try { sl.play(el, fx); } catch (e) { console.warn('[wrapped] slide ' + sl.id, e); }
    if (old && old.el.parentNode) {
      var oe = old.el;
      if (inst || !oe.animate) oe.parentNode.removeChild(oe);
      else {
        oe.style.pointerEvents = 'none';
        var ao = oe.animate([{ opacity: 1, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: 'translateX(' + (dir < 0 ? 18 : -18) + 'px) scale(.985)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' });
        ao.onfinish = function () { if (oe.parentNode) oe.parentNode.removeChild(oe); };
        setTimeout(function () { if (oe.parentNode) oe.parentNode.removeChild(oe); }, 600);
      }
    }
    if (!inst && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: old ? 320 : 200, delay: old ? 90 : 0, easing: 'ease-out', fill: 'backwards' });
    else if (inst && old && el.animate) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'linear', fill: 'backwards' });
    runProgress(i, sl.dur || 5200);
    V.root.classList.toggle('at-first', i === 0);
    V.root.classList.toggle('at-last', i === st.slides.length - 1);
    if (V.isP) fx.pause();
  }
  function next() { if (V && V.story && V.i < V.story.slides.length - 1) go(V.i + 1, 1); else if (V && V.story) bump(1); }
  function prev() { if (V && V.story) { if (V.i > 0) go(V.i - 1, -1); else go(0, -1); } }
  // di ujung: kartu sedikit "mentok", tidak keluar
  function bump(dir) {
    if (!V || isReduced() || !V.card.animate) return;
    V.card.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(' + (dir * -10) + 'px)' }, { transform: 'translateX(0)' }], { duration: 320, easing: EASE });
  }
  // petunjuk sekali per HP: lapisan "coach mark" (cerita dijeda di detik 0)
  function showHint() {
    if (!V || lsGet('hxw_hint')) return;
    lsSet('hxw_hint', '1');
    var red = isReduced();
    function row(ic, b, t) { return '<div class="row"><i>' + ic + '</i><span><b>' + b + '</b> ' + t + '</span></div>'; }
    V.coach.innerHTML = '<div class="hxw-coach-in">' +
      row(IC.tapR, 'Ketuk kanan', 'untuk lanjut') + row(IC.tapL, 'Ketuk kiri', 'untuk kembali') +
      (red ? row(IC.cal, 'Pindah manual', '\u2014 cerita tidak berjalan sendiri') : row(IC.hold, 'Tahan', 'untuk jeda')) +
      row(IC.down, 'Geser ke bawah', 'untuk tutup') +
      '<span class="hxw-btn pri">Mulai</span></div>';
    V.coach.className = 'hxw-coach on';
    V.root.classList.add('is-coach');
    setPause('coach', true);
    if (!red && V.coach.animate) {
      V.coach.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
      var rows = V.coach.querySelectorAll('.row,.hxw-btn');
      for (var i = 0; i < rows.length; i++) rows[i].animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 560, delay: 120 + i * 70, easing: EASE, fill: 'backwards' });
      var v = V;
      V.coachT = setTimeout(function () { if (V === v) hideCoach(); }, 5200);
    }
  }
  function hideCoach() {
    if (!V || !/\bon\b/.test(V.coach.className)) return;
    clearTimeout(V.coachT);
    var c = V.coach, v = V;
    var fin = function () { c.className = 'hxw-coach'; c.innerHTML = ''; v.root.classList.remove('is-coach'); if (V === v) setPause('coach', false); };
    if (isReduced() || !c.animate) { fin(); return; }
    c.style.pointerEvents = 'none';
    var a = c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = function () { c.style.pointerEvents = ''; fin(); try { a.cancel(); } catch (e) { } };
  }

  /* ── pemilih cerita (dari Monthly Recap) ────────────────────────── */
  function showChooser(y, m) {
    if (!V) return;
    var S = statsCompany(y, m);
    V.mode = 'chooser'; V.story = null; V.chY = y; V.chM = m;
    if (V.cur) { V.cur.fx.end(); if (V.cur.el.parentNode) V.cur.el.parentNode.removeChild(V.cur.el); V.cur = null; }
    if (V.prog) { try { V.prog.cancel(); } catch (e) { } V.prog = null; }
    V.segs.innerHTML = ''; V.segEls = [];
    V.root.classList.add('is-chooser');
    V.root.classList.remove('at-first', 'at-last');
    fitTag();
    V.root.setAttribute('aria-label', 'Wrapped ' + BULAN[m] + ' ' + y);
    var max = 1; S.teams.forEach(function (t) { if (t.r > max) max = t.r; });
    var el = D.createElement('div');
    el.className = 'hxw-slide hxw-chooser';
    el.innerHTML = kick('Wrapped ' + BULAN[m] + ' ' + y) + maskH('Pilih cerita', 'hxw-h') +
      '<div class="hxw-chs" data-x="list">' +
      '<button type="button" class="hxw-opt main" data-act="company"><span class="ring">' + IC.ring + '</span><span class="tx"><b>' + esc(BRAND()) + '</b><small>Seluruh tim \u00b7 ' + S.field + ' sales \u00b7 ' + S.teams.length + ' tim</small></span><span class="vl">' + esc(short(S.o.r)) + '</span></button>' +
      '<div class="hxw-chl">Per tim</div>' +
      S.teams.map(function (t, i) {
        return '<button type="button" class="hxw-opt" data-act="team" data-team="' + esc(t.name) + '">' + chip(t.name) + '<span class="tx"><b>Team ' + esc(noEmoji(t.name)) + '</b><small>' + (i === 0 ? '<span class="gold">#1</span> \u00b7 ' : '#' + (i + 1) + ' \u00b7 ') + t.people + ' sales</small></span>' +
          '<span class="vl">' + esc(short(t.r)) + '<i style="width:' + (t.r / max * 100).toFixed(1) + '%"></i></span></button>';
      }).join('') + '</div>';
    V.slides.appendChild(el);
    var fx = new Fx(isReduced());
    V.cur = { el: el, fx: fx, i: -1, sl: null };
    fx.up(q(el, 'k'), 0); fx.mask(q(el, 'h').querySelector('.hxw-m > span'), 60);
    var opts = el.querySelectorAll('.hxw-opt,.hxw-chl');
    for (var i = 0; i < opts.length; i++) fx.up(opts[i], 200 + i * 55, 14);
  }

  /* ── gambar story 1080×1920 (canvas 2D, digambar sendiri) ───────── */
  var FG = "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  var FM = "'Space Mono', ui-monospace, Menlo, Consolas, monospace";
  function fontsReady() {
    var f = D.fonts;
    if (!f || !f.load) return Promise.resolve();
    var all = Promise.all(['800 120px', '700 60px', '500 40px'].map(function (s) { return f.load(s + " 'Space Grotesk'"); })
      .concat(['700 30px', '400 30px'].map(function (s) { return f.load(s + " 'Space Mono'"); }))).catch(function () { });
    return Promise.race([all, new Promise(function (r) { setTimeout(r, 1500); })]);
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  // teks berjarak huruf (ctx.letterSpacing belum ada di Safari lama)
  function track(g, t, x, y, sp, font, color, align) {
    g.font = font; g.fillStyle = color;
    var w = 0, i;
    for (i = 0; i < t.length; i++) w += g.measureText(t[i]).width + (i < t.length - 1 ? sp : 0);
    var cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    for (i = 0; i < t.length; i++) { g.fillText(t[i], cx, y); cx += g.measureText(t[i]).width + sp; }
    return w;
  }
  function fit(g, t, maxW, size, weight, fam, min) {
    var s = size;
    g.font = weight + ' ' + s + 'px ' + fam;
    while (s > (min || 20) && g.measureText(t).width > maxW) { s -= 2; g.font = weight + ' ' + s + 'px ' + fam; }
    if (g.measureText(t).width > maxW) {
      while (t.length > 2 && g.measureText(t + '\u2026').width > maxW) t = t.slice(0, -1);
      t += '\u2026';
    }
    return { t: t, s: s };
  }
  function subLine(S) {
    if (S.kind === 'seller') return 'Team ' + noEmoji(S.team) + (S.rank ? '  \u00b7  #' + S.rank + ' dari ' + S.field + ' sales' : '');
    if (S.kind === 'team') return '#' + S.teamRank + ' dari ' + S.teamCount + ' tim  \u00b7  ' + S.members.length + ' sales';
    return 'Seluruh tim  \u00b7  ' + S.field + ' sales  \u00b7  ' + S.teams.length + ' tim';
  }
  function drawImage(st) {
    var S = st.S, c = D.createElement('canvas');
    c.width = 1080; c.height = 1920;
    var g = c.getContext('2d');
    if (!g) return null;
    var X0 = 88, X1 = 992, TX = '#f5f5f7', DIM = 'rgba(235,235,245,.58)', FAINT = 'rgba(235,235,245,.34)', GR = '#30d158';
    g.fillStyle = '#000'; g.fillRect(0, 0, 1080, 1920);
    g.textBaseline = 'alphabetic';
    // kepala
    g.fillStyle = GR; rr(g, X0, 118, 24, 24, 7); g.fill();
    track(g, BRAND().toUpperCase(), X0 + 42, 140, 6, '700 28px ' + FM, TX, 'left');
    track(g, 'WRAPPED', X1, 140, 6, '700 28px ' + FM, DIM, 'right');
    var hl = g.createLinearGradient(X0, 0, X1, 0);
    hl.addColorStop(0, 'rgba(255,255,255,.16)'); hl.addColorStop(1, 'rgba(255,255,255,.03)');
    g.fillStyle = hl; g.fillRect(X0, 186, X1 - X0, 2);
    // bulan + nama
    track(g, (BULAN[S.m] + ' ' + S.y + (S.partial ? '  \u00b7  1\u2013' + S.last : '')).toUpperCase(), X0, 280, 8, '700 32px ' + FM, GR, 'left');
    var tt = fit(g, S.title, X1 - X0, 146, 800, FG, 70), y = 280 + 26 + tt.s * 0.84;
    g.font = '800 ' + tt.s + 'px ' + FG; g.fillStyle = TX; g.fillText(tt.t, X0 - 4, y);
    y += 64;
    g.font = '500 36px ' + FG; g.fillStyle = DIM; g.fillText(fit(g, subLine(S), X1 - X0, 36, 500, FG, 24).t, X0, y);
    // jam bulan
    var Rr = 196, r0 = Rr * 0.5, cx = 540, cy = y + 52 + Rr, n = S.n, days = S.o.days, max = 0, bi = -1, i;
    for (i = 0; i < n; i++) if (days[i] > max) { max = days[i]; bi = i; }
    var tw = Math.max(6, Math.min(14, 2 * Math.PI * r0 / n * 0.52));
    g.lineCap = 'round';
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 - Math.PI / 2, v = days[i], fut = i + 1 > S.last;
      var L = v > 0 ? (0.24 + 0.76 * Math.sqrt(v / max)) * (Rr - r0) : (Rr - r0) * 0.1;
      g.strokeStyle = fut ? 'rgba(255,255,255,.07)' : v > 0 ? (i === bi ? '#7dffa3' : 'rgba(48,209,88,' + (0.45 + 0.5 * Math.sqrt(v / max)).toFixed(2) + ')') : 'rgba(255,255,255,.16)';
      g.lineWidth = tw;
      if (i === bi) { g.shadowColor = 'rgba(48,209,88,.85)'; g.shadowBlur = 26; }
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (r0 + tw / 2), cy + Math.sin(a) * (r0 + tw / 2));
      g.lineTo(cx + Math.cos(a) * (r0 + Math.max(tw / 2 + 1, L - tw / 2)), cy + Math.sin(a) * (r0 + Math.max(tw / 2 + 1, L - tw / 2)));
      g.stroke(); g.shadowBlur = 0; g.shadowColor = 'transparent';
    }
    g.textAlign = 'center';
    g.font = '800 56px ' + FG; g.fillStyle = TX; g.fillText(BLN[S.m].toUpperCase(), cx, cy + 8);
    track(g, String(S.y), cx, cy + 50, 6, '700 24px ' + FM, FAINT, 'center');
    g.textAlign = 'left';
    // omset
    y = cy + Rr + 84;
    track(g, (S.partial ? 'OMSET 1\u2013' + S.last + ' ' + BLN[S.m] : 'OMSET ' + BULAN[S.m]).toUpperCase(), X0, y, 6, '700 26px ' + FM, DIM, 'left');
    var sp = split(S.o.r), num = fmtNum(sp.v, sp.d), ns = 184;
    g.font = '600 52px ' + FG; var rpW = g.measureText('Rp').width + 16, uW = g.measureText(sp.word).width + 18;
    g.font = '800 ' + ns + 'px ' + FG;
    while (ns > 110 && rpW + g.measureText(num).width + uW > X1 - X0) { ns -= 6; g.font = '800 ' + ns + 'px ' + FG; }
    y += Math.round(ns * 0.86) + 22;
    g.font = '600 52px ' + FG; g.fillStyle = DIM; g.fillText('Rp', X0, y);
    g.font = '800 ' + ns + 'px ' + FG; g.fillStyle = TX; g.fillText(num, X0 + rpW, y);
    var nw = g.measureText(num).width;
    g.font = '600 52px ' + FG; g.fillStyle = DIM; g.fillText(sp.word, X0 + rpW + nw + 18, y);
    y += 56;
    track(g, full(S.o.r), X0, y, 2, '400 30px ' + FM, FAINT, 'left');
    var gl = g.createLinearGradient(X0, 0, X1, 0);
    gl.addColorStop(0, GR); gl.addColorStop(0.55, 'rgba(48,209,88,.35)'); gl.addColorStop(1, 'rgba(48,209,88,0)');
    g.fillStyle = gl; g.fillRect(X0, y + 30, X1 - X0, 3);
    // kotak angka: omset sudah di atas, kotak pertama = dibanding bulan lalu
    var T = tilesOf(S).slice(1), P = S.prev;
    T.unshift(P.delta === null
      ? { l: 'Bulan lalu', v: '\u2014', s: 'belum ada omset' }
      : { l: 'vs ' + BLN[P.m] + (S.partial ? ' 1\u2013' + P.lim : ''), v: pctTxt(P.delta), s: short(P.base), col: P.delta >= 0 ? GR : '#ff453a' });
    var gx = 24, tw2 = (X1 - X0 - gx) / 2, th = 138, gap = 18, gy = y + 66;
    var maxRows = Math.max(1, Math.floor((1800 - gy + gap) / (th + gap)));
    T = T.slice(0, maxRows * 2);
    for (i = 0; i < T.length; i++) {
      var col = i % 2, row = Math.floor(i / 2), tx = X0 + col * (tw2 + gx), ty = gy + row * (th + gap), t = T[i];
      var bg = g.createLinearGradient(0, ty, 0, ty + th);
      bg.addColorStop(0, 'rgba(255,255,255,.075)'); bg.addColorStop(1, 'rgba(255,255,255,.03)');
      rr(g, tx, ty, tw2, th, 26); g.fillStyle = bg; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.09)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(tx + 26, ty + 1, tw2 - 52, 1.5);
      track(g, t.l.toUpperCase(), tx + 28, ty + 44, 4, '700 21px ' + FM, FAINT, 'left');
      var vf = fit(g, t.v, tw2 - 56, t.txt ? 44 : 50, 700, FG, 28);
      g.font = '700 ' + vf.s + 'px ' + FG; g.fillStyle = t.col || (t.gold ? '#ffd426' : TX); g.fillText(vf.t, tx + 28, ty + 96);
      if (t.s) { var sf = fit(g, t.s, tw2 - 56, 25, 500, FG, 18); g.font = '500 ' + sf.s + 'px ' + FG; g.fillStyle = DIM; g.fillText(sf.t, tx + 28, ty + 126); }
    }
    // kaki
    track(g, BRAND().toUpperCase() + ' \u00b7 PERFORMANCE', X0, 1856, 4, '700 22px ' + FM, FAINT, 'left');
    var dt = now();
    track(g, ('DIBUAT ' + dt.getDate() + ' ' + BLN[dt.getMonth()] + ' ' + dt.getFullYear()).toUpperCase(), X1, 1856, 4, '700 22px ' + FM, FAINT, 'right');
    return c;
  }
  function fileName(S) {
    var who = S.kind === 'seller' ? S.sp : S.kind === 'team' ? 'team-' + S.team : BRAND_S();
    return ('wrapped-' + who + '-' + S.mk).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-') + '.png';
  }
  function toBlob(c) {
    return new Promise(function (res) {
      if (c.toBlob) c.toBlob(function (b) { res(b); }, 'image/png');
      else {
        try {
          var d = c.toDataURL('image/png'), bin = atob(d.split(',')[1]), u = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
          res(new Blob([u], { type: 'image/png' }));
        } catch (e) { res(null); }
      }
    });
  }
  // gambar disiapkan saat slide ringkasan tampil, supaya navigator.share
  // bisa dipanggil LANGSUNG di dalam ketukan (Safari menolak share async)
  function prepImage(st) {
    if (!V || V.story !== st || V.imgP) return V && V.imgP;
    var v = V;
    v.imgP = fontsReady().then(function () {
      var c = drawImage(st);
      return c ? toBlob(c) : null;
    }).then(function (b) {
      if (!b) return null;
      var f = null, name = fileName(st.S);
      try { f = new File([b], name, { type: 'image/png' }); } catch (e) { f = null; }
      v.img = { blob: b, file: f, name: name };
      return v.img;
    }).catch(function () { return null; });
    return v.imgP;
  }
  function canShareFile(f) {
    try { return !!(f && navigator.canShare && navigator.share && navigator.canShare({ files: [f] })); } catch (e) { return false; }
  }
  function saveImage(btn) {
    if (!V || !V.story) return;
    var v = V, st = v.story;
    var go2 = function (img) {
      if (!img || V !== v) { if (V === v) toastIn('Gambar gagal dibuat'); return; }
      if (canShareFile(img.file)) {
        setPause('share', true);
        var p;
        try { p = navigator.share({ files: [img.file], title: st.S.label + ' \u2014 ' + st.S.title }); } catch (e) { p = Promise.reject(e); }
        p.then(function () { setPause('share', false); }, function (e) {
          setPause('share', false);
          if (e && e.name === 'AbortError') return;     // dibatalkan pengguna
          showSheet(img);
        });
        return;
      }
      showSheet(img);
    };
    if (v.img) { go2(v.img); return; }
    if (btn) btn.classList.add('busy');
    prepImage(st).then(function (img) { if (btn) btn.classList.remove('busy'); go2(img); });
  }
  // cadangan: pratinjau di dalam cerita + unduh / buka tab baru
  function showSheet(img) {
    if (!V) return;
    if (V.url) { try { URL.revokeObjectURL(V.url); } catch (e) { } }
    V.url = URL.createObjectURL(img.blob);
    var touch = ('ontouchstart' in W) || (navigator.maxTouchPoints > 0);
    V.sheet.innerHTML = '<div class="hxw-sh-in"><img alt="Wrapped" src="' + V.url + '">' +
      '<p>' + (touch ? 'Tekan lama gambar, lalu pilih Simpan.' : 'Gambar story 1080\u00d71920.') + '</p>' +
      '<div class="hxw-acts"><a class="hxw-btn pri" href="' + V.url + '" download="' + esc(img.name) + '">' + IC.save + '<span>Unduh</span></a>' +
      '<a class="hxw-btn" href="' + V.url + '" target="_blank" rel="noopener">Buka di tab baru</a>' +
      '<button type="button" class="hxw-btn ic" data-act="sheet-close" aria-label="Tutup pratinjau">' + IC.x + '</button></div></div>';
    V.sheet.className = 'hxw-sheet on';
    setPause('sheet', true);
    if (!isReduced() && V.sheet.animate) V.sheet.firstChild.animate([{ opacity: 0, transform: 'translateY(30px) scale(.97)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 420, easing: EASE });
  }
  function closeSheet() {
    if (!V || !V.sheet.className.match(/\bon\b/)) return;
    V.sheet.className = 'hxw-sheet'; V.sheet.innerHTML = '';
    setPause('sheet', false);
  }
  function toastIn(t) {
    if (!V) return;
    V.hint.textContent = t; V.hint.className = 'hxw-hint on';
    var h = V.hint; setTimeout(function () { h.className = 'hxw-hint'; }, 2400);
  }

  /* ── gestur & tombol ────────────────────────────────────────────── */
  var G = null;
  function onDown(e) {
    if (!V || V.closing || V.mode !== 'story') return;
    if (e.button) return;
    // jari kedua (cubit/zoom): gestur yang sedang jalan tidak lagi dihitung ketuk/tahan
    if (G) { if (e.pointerId !== G.id) { G.multi = true; clearTimeout(G.timer); } return; }
    if (e.isPrimary === false) return;
    var t = e.target;
    if (t && t.closest && t.closest('button,a,.hxw-sheet.on,.hxw-coach.on')) return;
    if (/\bon\b/.test(V.coach.className)) return;
    if (R.classList.contains('hx-gesture')) return;      // gestur modul lain sedang aktif
    G = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: perf(), dx: 0, dy: 0, held: false, drag: false, hor: false };
    R.classList.add('hx-gesture');
    try { V.card.setPointerCapture(e.pointerId); } catch (er) { }
    G.timer = setTimeout(function () { if (G && !G.drag) { G.held = true; setPause('hold', true); } }, 230);
  }
  function onMove(e) {
    if (!G || e.pointerId !== G.id || !V || (G.multi && !G.drag)) return;
    G.dx = e.clientX - G.x0; G.dy = e.clientY - G.y0;
    if (V.zoom) return;          // dizoom: geseran milik browser (pan), bukan tutup/pindah
    var ax = Math.abs(G.dx), ay = Math.abs(G.dy);
    if (!G.drag && !G.hor && G.dy > 12 && ay > ax * 1.15) {
      G.drag = true; clearTimeout(G.timer); setPause('drag', true);
      V.root.classList.add('is-drag');
    }
    if (!G.drag && !G.hor && ax > 16 && ax > ay * 1.3) { G.hor = true; clearTimeout(G.timer); }
    if (G.drag) {
      var dy = Math.max(0, G.dy), k = Math.min(1, dy / 600);
      V.card.style.transform = 'translateY(' + dy.toFixed(1) + 'px) scale(' + (1 - k * 0.1).toFixed(4) + ')';
      V.root.style.backgroundColor = 'rgba(0,0,0,' + (1 - k * 0.7).toFixed(3) + ')';
    }
  }
  function endG(cancel) {
    var g = G; G = null;
    R.classList.remove('hx-gesture');
    if (!g || !V) return;
    clearTimeout(g.timer);
    if (g.multi) cancel = true;
    try { V.card.releasePointerCapture(g.id); } catch (er) { }
    if (g.drag) {
      V.root.classList.remove('is-drag');
      var dt = Math.max(1, perf() - g.t0), vy = g.dy / dt;
      if (!cancel && (g.dy > 120 || (vy > 0.6 && g.dy > 60))) { closeViewer('swipe'); return; }
      var c = V.card, from = c.style.transform;
      c.style.transform = ''; V.root.style.backgroundColor = '';
      if (from && c.animate && !isReduced()) c.animate([{ transform: from }, { transform: 'translateY(0) scale(1)' }], { duration: 420, easing: SPRING });
      setPause('drag', false);
      return;
    }
    if (g.held) { setPause('hold', false); return; }
    if (cancel) return;
    if (g.hor) { if (g.dx < 0) next(); else prev(); return; }
    if (Math.abs(g.dx) > 14 || Math.abs(g.dy) > 14) return;
    var r = V.card.getBoundingClientRect();
    if (g.x0 - r.left < r.width * 0.32) prev(); else next();
  }
  function onUp(e) { if (G && e.pointerId === G.id) endG(false); }
  function onCancel(e) { if (G && (!e || e.pointerId === G.id)) endG(true); }
  // Setiap pointerdown di cerita ditandai; klik berikutnya milik gestur itu.
  // Chrome kadang mengirim klik TANPA pointerdown (ketuk saat layar dizoom
  // setelah digeser): klik seperti itu diperlakukan sebagai ketuk kiri/kanan.
  function onAnyDown() { if (V) V.ptr = true; }
  function onAnyCancel() { if (V) V.ptr = false; }     // pointer batal = tidak ada klik
  function onClick(e) {
    if (!V) return;
    var seen = V.ptr; V.ptr = false;
    var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b) {
      var t = e.target;
      if (seen || V.closing || V.mode !== 'story' || !t || !t.closest || !t.closest('.hxw-slides') || t.closest('button,a')) return;
      if (/\bon\b/.test(V.sheet.className) || /\bon\b/.test(V.coach.className)) return;
      var r = V.card.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.32) prev(); else next();
      return;
    }
    var act = b.getAttribute('data-act');
    if (act === 'close') { e.preventDefault(); closeViewer('x'); }
    else if (act === 'prev') { e.preventDefault(); prev(); }
    else if (act === 'next') { e.preventDefault(); next(); }
    else if (act === 'save') { e.preventDefault(); saveImage(b); }
    else if (act === 'replay') { e.preventDefault(); go(0, -1); }
    else if (act === 'chooser') { e.preventDefault(); showChooser(V.story.S.y, V.story.S.m); }
    else if (act === 'sheet-close') { e.preventDefault(); closeSheet(); }
    else if (act === 'coach') { e.preventDefault(); hideCoach(); }
    else if (act === 'company') { e.preventDefault(); var s1 = storyCompany(V.chY, V.chM); if (s1) startStory(s1, true); }
    else if (act === 'team') { e.preventDefault(); var s2 = storyTeam(b.getAttribute('data-team'), V.chY, V.chM); if (s2) startStory(s2, true); }
  }
  function onKey(e) {
    if (!V) return;
    var k = e.key;
    if (k === 'Escape' || k === 'Esc') {
      e.preventDefault(); e.stopPropagation();
      if (V.sheet.className.match(/\bon\b/)) closeSheet(); else if (/\bon\b/.test(V.coach.className)) hideCoach(); else closeViewer('key');
      return;
    }
    if (k === 'Tab') {
      // fokus tetap di dalam cerita
      var f = [].filter.call(V.root.querySelectorAll('button,a[href]'), function (x) { return x.offsetParent !== null; });
      if (!f.length) { e.preventDefault(); return; }
      var at = f.indexOf(D.activeElement);
      if (e.shiftKey ? at <= 0 : at === f.length - 1 || at < 0) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      return;
    }
    if (V.mode !== 'story') return;
    var t = e.target;
    if (k === 'ArrowRight' || ((k === ' ' || k === 'Spacebar') && !(t && /^(BUTTON|A)$/.test(t.tagName)))) { e.preventDefault(); e.stopPropagation(); next(); }
    else if (k === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); prev(); }
  }
  function onVis() { if (V) setPause('hidden', D.hidden); }
  // Dicubit (zoom > 1): cerita dijeda dan geser satu jari menggeser tampilan
  // untuk membaca (bukan menutup / pindah slide); ketuk kiri/kanan tetap
  // pindah slide. Zoom kembali normal = cerita lanjut.
  function onZoom() {
    if (!V) return;
    var vv = W.visualViewport, z = !!(vv && vv.scale > 1.01);
    if (z === !!V.zoom) return;
    V.zoom = z;
    if (z && G) endG(true);
    V.root.classList.toggle('is-zoom', z);
    setPause('zoom', z);
  }
  function onBlur() { if (G) endG(true); }
  var rsT = 0;
  function onResize() {
    clearTimeout(rsT);
    rsT = setTimeout(function () {
      if (!V || V.zoom) return;
      layout();
      // ukur ulang slide aktif (jam, garis peringkat, kanvas) tanpa animasi
      if (V.mode === 'story' && V.cur && V.cur.sl) {
        var sl = V.cur.sl, el = V.cur.el;
        V.cur.fx.end();
        el.innerHTML = sl.html();
        var fx = new Fx(true); V.cur.fx = fx;
        try { sl.play(el, fx); } catch (e) { }
      }
    }, 160);
  }
  function onTouchMove(e) { if (e.touches && e.touches.length === 1 && V && V.mode === 'story' && !V.zoom) e.preventDefault(); }
  function onCtx(e) { if (V && V.mode === 'story' && !(e.target && e.target.closest && e.target.closest('.hxw-sheet img'))) e.preventDefault(); }
  function onPop() {
    if (skipPops > 0) { skipPops--; return; }
    if (V && V.hist) { V.hist = false; closeViewer('pop'); }
  }
  function bind() {
    var c = V.card;
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onCancel);
    c.addEventListener('lostpointercapture', onCancel);
    c.addEventListener('contextmenu', onCtx);
    c.addEventListener('touchmove', onTouchMove, { passive: false });
    V.root.addEventListener('click', onClick);
    V.root.addEventListener('pointerdown', onAnyDown, true);
    V.root.addEventListener('pointercancel', onAnyCancel, true);
    W.addEventListener('keydown', onKey, true);
    D.addEventListener('visibilitychange', onVis);
    W.addEventListener('blur', onBlur);
    W.addEventListener('resize', onResize);
    if (W.visualViewport) W.visualViewport.addEventListener('resize', onZoom);
    W.addEventListener('orientationchange', onResize);
    if (!popBound) { popBound = true; W.addEventListener('popstate', onPop); }
    onZoom();
  }
  function unbind() {
    if (G) endG(true);
    W.removeEventListener('keydown', onKey, true);
    D.removeEventListener('visibilitychange', onVis);
    W.removeEventListener('blur', onBlur);
    W.removeEventListener('resize', onResize);
    if (W.visualViewport) W.visualViewport.removeEventListener('resize', onZoom);
    W.removeEventListener('orientationchange', onResize);
  }

  /* ── pintu masuk ────────────────────────────────────────────────── */
  // bulan "yang relevan": Monthly Recap yang sedang dilihat, kalau tidak
  // bulan berjalan; tanggal 1–3 menawarkan bulan lalu
  function recapMonth() {
    try { if (typeof mYear === 'number' && typeof mMonth === 'number') return { y: mYear, m: mMonth }; } catch (e) { }
    return null;
  }
  function onMonthlyPage() { var p = D.getElementById('page-monthly'); return !!(p && p.classList.contains('active')); }
  function ctxMonth() {
    if (onMonthlyPage()) { var r = recapMonth(); if (r) return r; }
    var t = now();
    return t.getDate() <= 3 ? mnorm(t.getFullYear(), t.getMonth() - 1) : { y: t.getFullYear(), m: t.getMonth() };
  }
  function monthWord(c) { return BULAN[c.m] + (c.y !== now().getFullYear() ? ' ' + c.y : ''); }

  function open(st, origin) {
    if (!st) return false;
    var fresh = !V;
    openViewer(origin);
    if (!fresh && V.cur) { V.cur.fx.end(); }
    startStory(st, false);
    return true;
  }
  API.seller = function (sp, team, y, m, origin) {
    var c = (y == null) ? ctxMonth() : { y: y, m: m };
    return open(storySeller(sp, team, c.y, c.m), origin);
  };
  API.team = function (team, y, m, origin) {
    var c = (y == null) ? ctxMonth() : { y: y, m: m };
    return open(storyTeam(team, c.y, c.m), origin);
  };
  API.company = function (y, m, origin) {
    var c = (y == null) ? ctxMonth() : { y: y, m: m };
    return open(storyCompany(c.y, c.m), origin);
  };
  API.chooser = function (y, m, origin) {
    var c = (y == null) ? ctxMonth() : { y: y, m: m };
    if (!monthHasSales(c.y, c.m)) return false;
    openViewer(origin);
    showChooser(c.y, c.m);
    return true;
  };
  API.close = function () { closeViewer('api'); };
  API.isOpen = function () { return !!V; };
  API.state = function () { return V ? { mode: V.mode, i: V.i, n: V.story ? V.story.slides.length : 0, ids: V.story ? V.story.slides.map(function (s) { return s.id; }) : [], paused: V.isP, kind: V.story ? V.story.kind : null } : null; };
  API.go = function (i) { if (V && V.story) go(i, 1); };
  API.next = function () { next(); };
  API.prev = function () { prev(); };
  API.pause = function (on) { setPause('api', on !== false); };
  API.stats = { seller: statsSeller, team: statsTeam, company: statsCompany };
  API.image = function () { return V && V.story ? fontsReady().then(function () { return drawImage(V.story); }) : Promise.resolve(null); };
  API.ctxMonth = ctxMonth;

  // a) baris aksi modal sales
  HX.spAction({
    id: 'wrapped', order: 10, icon: IC.ring,
    get label() { return 'Wrapped ' + monthWord(ctxMonth()); },
    show: function (sp) {
      if (HX.isChannel(sp)) return false;
      var c = ctxMonth();
      return sellerHasSales(sp, c.y, c.m);
    },
    run: function (sp, team) {
      var c = ctxMonth(), b = D.querySelector('#spMo .hx-sp-act[data-act="wrapped"]');
      API.seller(sp, team, c.y, c.m, b);
    }
  });

  // b) tombol di kepala Monthly Recap
  var mBtnSheen = false;
  function ensureMonthlyBtn() {
    var pg = D.getElementById('page-monthly');
    if (!pg) return;
    var host = pg.querySelector('.premium-monthly-head > div') || pg.querySelector('#monthlyControlRow');
    if (!host) return;
    var b = D.getElementById('hxwMonthBtn');
    if (!b) {
      b = D.createElement('button');
      b.type = 'button'; b.id = 'hxwMonthBtn'; b.className = 'hxw-mbtn';
      b.innerHTML = '<span class="ic">' + IC.ring + '</span><span class="tx"></span><span class="ch">' + IC.r + '</span><i class="sh"></i>';
      b.addEventListener('click', function () {
        var c = recapMonth() || ctxMonth();
        API.chooser(c.y, c.m, b);
      });
    }
    if (b.parentNode !== host) host.appendChild(b);
    var c = recapMonth() || ctxMonth(), lbl = 'Wrapped ' + monthWord(c);
    var tx = b.querySelector('.tx');
    if (tx.textContent !== lbl) tx.textContent = lbl;
    var has = monthHasSales(c.y, c.m);
    if (b.hidden === has) b.hidden = !has;
  }
  var mObs = null;
  function watchMonthLabel() {
    if (mObs || !W.MutationObserver) return;
    var l = D.getElementById('monthLabel');
    if (!l) return;
    mObs = new MutationObserver(function () { ensureMonthlyBtn(); });
    mObs.observe(l, { childList: true, characterData: true, subtree: true });
  }
  function sheenOnce() {
    if (mBtnSheen || isReduced()) return;
    var b = D.getElementById('hxwMonthBtn');
    if (!b || b.hidden || !b.offsetParent) return;
    mBtnSheen = true;
    var s = b.querySelector('.sh');
    if (s && s.animate) s.animate([{ transform: 'translateX(-100%) skewX(-20deg)', opacity: 1 }, { transform: 'translateX(420%) skewX(-20deg)', opacity: 1 }], { duration: 1100, delay: 1500, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
  }

  // c) undangan tanggal 1–3, sekali per HP per bulan
  var inv = null;
  function inviteMonth() { var t = now(); return mnorm(t.getFullYear(), t.getMonth() - 1); }
  function canInvite() {
    if (HX.busy()) return false;
    var isl = D.querySelector('.hxl-island');
    if (isl && isl.getBoundingClientRect().height > 0 && W.getComputedStyle(isl).opacity !== '0' && W.getComputedStyle(isl).visibility !== 'hidden') return false;
    var p = D.querySelector('.page.active');
    if (p && p.classList.contains('lg-enter')) return false;
    return true;
  }
  function showInvite(force) {
    var t = now(), c = inviteMonth(), key = 'hxw_inv_' + mkOf(c.y, c.m);
    if (!force && (t.getDate() > 3 || lsGet(key))) return false;
    if (!monthHasSales(c.y, c.m) || inv) return false;
    var tries = 0;
    (function attempt() {
      if (inv) return;
      if (!force && !canInvite()) { if (++tries < 24) setTimeout(attempt, 2500); return; }
      lsSet(key, '1');
      inv = D.createElement('div');
      inv.className = 'hxw-inv';
      inv.setAttribute('role', 'button');
      inv.setAttribute('tabindex', '0');
      inv.setAttribute('aria-label', 'Wrapped ' + BULAN[c.m] + ' sudah siap');
      inv.innerHTML = '<span class="ic">' + IC.ring + '</span><span class="tx"><b>Wrapped ' + BULAN[c.m] + ' sudah siap</b><small>Cerita bulan lalu ' + esc(BRAND()) + '</small></span>' +
        '<button type="button" class="x" aria-label="Tutup">' + IC.x + '</button><i class="tmr"></i>';
      var hdr = D.querySelector('header');
      var top = hdr ? Math.max(8, Math.round(hdr.getBoundingClientRect().bottom) + 10) : 12;
      inv.style.top = top + 'px';
      D.body.appendChild(inv);
      var el = inv, timer = null, gone = false, y0 = null;
      var hide = function (up) {
        if (gone) return; gone = true; clearTimeout(timer);
        var fin = function () { if (el.parentNode) el.parentNode.removeChild(el); if (inv === el) inv = null; };
        if (isReduced() || !el.animate) { fin(); return; }
        var a = el.animate([{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(' + (up ? -26 : -10) + 'px) scale(.96)' }], { duration: 260, easing: 'ease-in', fill: 'forwards' });
        a.onfinish = fin; setTimeout(fin, 600);
      };
      var tm = el.querySelector('.tmr'), bar = null;
      if (!isReduced() && el.animate) {
        el.animate([{ opacity: 0, transform: 'translateY(-22px) scale(.92)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 620, easing: SPRING });
        bar = tm.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 9000, delay: 600, easing: 'linear', fill: 'both' });
        bar.onfinish = function () { hide(false); };
      } else timer = setTimeout(function () { hide(false); }, 9000);
      el.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.x')) { e.stopPropagation(); hide(true); return; }
        hide(false);
        API.company(c.y, c.m, el);
      });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hide(false); API.company(c.y, c.m, el); } });
      el.addEventListener('pointerdown', function (e) { y0 = e.clientY; });
      el.addEventListener('pointerup', function (e) { if (y0 !== null && e.clientY - y0 < -24) hide(true); y0 = null; });
      el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && bar) bar.pause(); });
      el.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && bar && bar.playState === 'paused') bar.play(); });
    })();
    return true;
  }
  API.invite = function (force) { return showInvite(!!force); };

  // render terjadi tiap data masuk: kerjakan hanya saat Monthly Recap tampil
  HX.on('render', function () { if (onMonthlyPage()) { ensureMonthlyBtn(); watchMonthLabel(); } });
  HX.on('page', function (p) { if (p && p.id === 'page-monthly') { ensureMonthlyBtn(); watchMonthLabel(); sheenOnce(); } });
  var invited = false;
  HX.on('ready', function () {
    ensureMonthlyBtn(); watchMonthLabel();
    if (!invited) { invited = true; setTimeout(function () { showInvite(false); }, 3800); }
  });
  // 'ready' bisa saja sudah lewat sebelum modul ini terdaftar
  setTimeout(function () {
    if (invited) return;
    try { if (Object.keys(data()).length && window._cfgTeamsLoaded) { invited = true; showInvite(false); } } catch (e) { }
  }, 9000);
  if (D.readyState !== 'loading') setTimeout(function () { ensureMonthlyBtn(); watchMonthLabel(); }, 0);
  else D.addEventListener('DOMContentLoaded', function () { ensureMonthlyBtn(); watchMonthLabel(); });
})();
