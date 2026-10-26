/* ══════════════════════════════════════════════════════════════════════
   FX STARS — "Peta bintang": seluruh sales bulan ini sebagai langit malam.

   HANYA MEMBACA. Tidak pernah menulis ke Firebase, tidak mengubah allData,
   tidak membungkus fungsi app.js. Semua angka bulanan (omset & closing per
   sales, peringkat "N dari nSellers", total tim, total bulan) dari
   HX.monthAgg — sama persis dengan Wrapped, kartu sales & pecah omset.
   Dari app.js hanya dibaca: TM (roster), monthActBySP (aktivitas), gE()
   (omset tanggal yang dilihat).

   Pintu masuk  Tombol kaca "Peta bintang" di baris judul halaman
                Salespeople (desktop: kapsul di ujung kanan judul; HP:
                baris lebar di bawah judul — muat sampai 320px).
   Panggung     Layar penuh hitam pekat milik sendiri (canvas 2D, DPR maks
                2). Tiap sales aktif bulan ini = bintang; besar ~ akar omset
                bulan berjalan, inti terang + pancaran = ada closing hari ini.
                Bintang dikelompokkan per tim jadi rasi (garis tipis = pohon
                rentang minimum antar anggota), pusat rasi di elips lebar
                (urut omset tim, searah jarum jam). Channel (Tokopedia,
                Shopee, TikTok, …) jadi rasi "Channel" yang lebih redup;
                team lead tidak digambar. Sales yang sudah keluar tapi
                punya omset bulan ini = bintang padam "keluar" di tim
                lamanya. Label tim = omset tim resmi (HX.monthAgg: sama
                dengan Monthly Recap / Wrapped / Salespeople — termasuk
                channel, team lead, yang sudah keluar); rinciannya di
                subjudul saat rasi dibuka. Kelip dan hanyut halus HANYA di
                dalam panggung ini, bukan latar halaman.
   Interaksi    Ketuk rasi / label tim → kamera terbang (jalur zoom optimal
                van Wijk–Nuij) ke rasi itu, nama + omset muncul. Ketuk
                bintang → kartu kaca kecil (nama, tim, omset, peringkat,
                hari ini) + "Buka detail" (tutup panggung → openSPMonth).
                Ketuk ruang kosong / tombol Semua tim / Back → zoom keluar.
                Satu jari = geser (dengan pantulan di tepi + lemparan),
                dua jari = cubit-zoom (Pointer Events; touch-action:none
                hanya di panggung). Desktop: roda / cubit trackpad, hover
                memberi nama, panah kiri/kanan pindah rasi. "Putar tur"
                menerbangkan kamera ke tiap rasi satu kali lalu kembali.
   Live         HX 'sales' saat terbuka → bintang penjualnya menyala
                (kilatan + gelombang cincin), tumbuh ke ukuran barunya,
                angka tim/pusat bergulir naik, kabar singkat di atas.
   Kinerja      rAF hanya saat terbuka & terlihat; 60 fps saat bergerak,
                30 fps untuk kelip. Diam ~6 dtk (HP lemah ~4 dtk) → kelip &
                hanyut melambat lalu berhenti, loop tidur (0 rAF) sampai
                ada sentuhan / penjualan / kamera. Pancaran = sprite kanvas kecil yang
                dirender sekali (tanpa shadowBlur per frame). Label DOM
                hanya ditulis saat kamera berubah.
   Protokol     <html>.hx-overlay-open selama terbuka (HX.busy() → true),
                halaman di belakang dikunci tanpa loncat; tutup lewat X,
                Escape, tombol Back Android (history.pushState; dua tingkat:
                rasi → semua → tutup; dibersihkan di semua jalur tutup).
                Gestur memakai <html>.hx-gesture (satu pemilik gestur).
   Kurangi Gerak  Tanpa kelip/hanyut/kilatan, kamera melompat, digambar
                hanya saat perlu.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  if (W.__hxStars) return;
  W.__hxStars = true;
  var HX = W.HX;
  if (!HX || typeof HX.on !== 'function' || typeof HX.monthAgg !== 'function' || !W.HTMLCanvasElement) return;

  /* ── utilitas ─────────────────────────────────────────────────────── */
  var hasPE = !!W.PointerEvent;
  var cosh = Math.cosh || function (x) { var e = Math.exp(x); return (e + 1 / e) / 2; };
  var sinh = Math.sinh || function (x) { var e = Math.exp(x); return (e - 1 / e) / 2; };
  var tanh = Math.tanh || function (x) { var e = Math.exp(2 * x); return (e - 1) / (e + 1); };
  var imul = Math.imul || function (a, b) { return (a * b) | 0; };
  function now() { return W.performance && performance.now ? performance.now() : Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function easeOut3(t) { t = 1 - t; return 1 - t * t * t; }
  function easeInOut3(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutBack(t) { var c = 1.25, d = t - 1; return 1 + (c + 1) * d * d * d + c * d * d; }
  function reduced() { try { return !!HX.reduced(); } catch (e) { return false; } }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mS(n) { return 'Rp ' + HX.money(n); }
  function mF(n) { return HX.moneyFull(n); }
  function two(n) { return n < 10 ? '0' + n : String(n); }
  function mono(t) {
    try { if (typeof W.teamMono === 'function') return W.teamMono(t); } catch (e) { }
    try { if (typeof teamMono === 'function') return teamMono(t); } catch (e) { }
    return String(t || '').slice(0, 2).toUpperCase();
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = imul(a ^ (a >>> 15), 1 | a);
      t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }
  function lsGet(k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { W.localStorage.setItem(k, v); } catch (e) { } }
  function svg(p, cls) { return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + p + '</svg>'; }

  var ICON = '<path class="hxs-ic-l" d="M4.6 17.4L9.6 11.2L15.6 14.2L19 6"/>' +
    '<circle class="hxs-ic-d" cx="4.6" cy="17.4" r="1.45"/><circle class="hxs-ic-d" cx="9.6" cy="11.2" r="1.7"/>' +
    '<circle class="hxs-ic-d" cx="15.6" cy="14.2" r="1.35"/>' +
    '<path class="hxs-ic-s" d="M19 1.9l.95 3.15L23.1 6l-3.15.95L19 10.1l-.95-3.15L14.9 6l3.15-.95z"/>';
  var CHEV_R = '<path d="M9 5.5l6.5 6.5L9 18.5"/>';
  var CHEV_L = '<path d="M15 5.5L8.5 12l6.5 6.5"/>';
  var XI = '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>';
  var PLAY = '<path d="M8 5.8v12.4L18 12z"/>';
  var STOP = '<path d="M7 7h10v10H7z"/>';

  /* ── data (dibaca, tidak pernah ditulis) ─────────────────────────── */
  // SEMUA angka bulanan = HX.monthAgg (fx-core), hitungan yang SAMA dengan
  // Wrapped, kartu sales & pecah omset: peringkat sales + penyebutnya
  // (nSellers), omset & closing per sales (digabung per nama, lintas tim;
  // yang sudah keluar tetap di tim lamanya), total tim (TERMASUK channel &
  // team lead) dan total bulan (= monthRev). Selain itu hanya dibaca hal per
  // HARI (omset tanggal yang dilihat) dan laporan aktivitas (anggota roster
  // tanpa omset bulan ini tetap jadi bintang redup bila sudah lapor).
  // Satu orang = satu bintang (kunci per nama, sama dengan monthAgg).
  var CH = '@ch';
  var sim = {}, simDay = {}, simTot = 0;          // _simulateSale: hanya di panggung ini
  function rkey(sp, team) {
    try { if (typeof rosterKey === 'function') { var k = rosterKey(sp, team); if (k) return k; } } catch (e) { }
    return sp + '|' + team;
  }
  function nrm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function keyTeam(k) { return k.slice(k.lastIndexOf('|') + 1); }
  function keySp(k) { return k.slice(0, k.lastIndexOf('|')); }
  // nama → {sp, team} roster SEKARANG (tim pertama, urutan sama dengan monthAgg)
  function rosterByName() {
    var out = {};
    try {
      Object.keys(TM || {}).forEach(function (t) {
        ((TM[t] && TM[t].m) || []).forEach(function (sp) { if (sp && !out[nrm(sp)]) out[nrm(sp)] = { sp: sp, team: t }; });
      });
    } catch (e) { }
    return out;
  }
  function readModel() {
    var vd, live = true;
    try { vd = od(vOff); live = vOff === 0; } catch (e) { vd = new Date(); }
    var agg = HX.monthAgg(vd.getFullYear(), vd.getMonth());
    var ros = rosterByName(), act = {}, actBy = {}, dayBy = {}, dayTot = simTot, ents = [];
    try { act = monthActBySP(vd) || {}; } catch (e) { }
    Object.keys(act).forEach(function (k) {
      var a = act[k] || {}, n = nrm(keySp(k));
      actBy[n] = (actBy[n] || 0) + (+a.chats || 0) + (+a.calls || 0) + (+a.fups || 0);
    });
    try { ents = gE() || []; } catch (e) { try { ents = allData[HX.dayKey(vd)] || []; } catch (e2) { } }
    ents.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var v = +e.revenue || 0, n = nrm(e.sp);
      dayTot += v; dayBy[n] = (dayBy[n] || 0) + v;
    });
    var list = [], byName = {}, teamTot = {}, teamCh = {}, teamLead = {}, top = null;
    function addTo(map, t, v) { if (v) map[t] = (map[t] || 0) + v; }
    // tim = tim versi monthAgg (tim roster sekarang; yang sudah keluar: tim
    // record terakhir; channel: tim tempat omsetnya dihitung)
    function star(sp, team, ch, mtd, cls, rank) {
      var n = nrm(sp), r = ros[n], name = r ? r.sp : sp, t = team || (r ? r.team : ''), key = name + '|' + t;
      if (byName[n] || (!ch && !t)) return;
      byName[n] = key;
      list.push({ key: key, sp: name, team: t, cl: ch ? CH : t, ch: ch, mtd: mtd + (sim[key] || 0), today: (dayBy[n] || 0) + (simDay[key] || 0),
        acts: actBy[n] || 0, cls: cls, rank: rank, left: !r });
      if (!ch && rank === 1) top = key;
    }
    agg.sellers.forEach(function (s) { star(s.sp, s.team, false, +s.revenue || 0, +s.closes || 0, s.rank); });
    // channel: diurutkan di antara channel saja (tidak pernah di peringkat sales)
    var chs = agg.channels.filter(function (c) { return +c.revenue > 0; });
    chs.forEach(function (c, i) { star(c.sp, c.team, true, +c.revenue, +c.closes || 0, i + 1); });
    // anggota roster tanpa omset bulan ini tapi sudah lapor aktivitas: bintang redup
    Object.keys(ros).forEach(function (n) {
      var r = ros[n];
      if (byName[n] || HX.isLeader(r.sp)) return;
      if (!(actBy[n] > 0) && !(dayBy[n] > 0) && !(sim[r.sp + '|' + r.team] > 0)) return;
      star(r.sp, r.team, HX.isChannel(r.sp), 0, 0, 0);
    });
    agg.teams.forEach(function (x) { teamTot[x.team] = +x.revenue || 0; addTo(teamCh, x.team, +x.revenueChannels || 0); });
    agg.leaders.forEach(function (l) { addTo(teamLead, l.team, +l.revenue || 0); });
    // penjualan simulasi (tes) ikut total timnya
    Object.keys(sim).forEach(function (k) {
      var t = keyTeam(k), sp = keySp(k);
      addTo(teamTot, t, sim[k]);
      if (HX.isChannel(sp)) addTo(teamCh, t, sim[k]);
      else if (HX.isLeader(sp)) addTo(teamLead, t, sim[k]);
    });
    var mon = vd.toLocaleDateString('id-ID', { month: 'long' });
    return {
      list: list, byName: byName, total: agg.total + simTot, dayTot: dayTot, nSell: agg.nSellers, nCh: chs.length, top: top, live: live,
      teamTot: teamTot, teamCh: teamCh, teamLead: teamLead,
      mon: mon, monY: mon + ' ' + vd.getFullYear(),
      dayLbl: live ? 'Hari ini' : vd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    };
  }
  // bintang untuk penjualan (sp, team): per nama, sama dengan peta
  function starKey(sp, team) {
    var m = S && S.model, k = m && m.byName ? m.byName[nrm(sp)] : null;
    if (k) return k;
    var r = rosterByName()[nrm(sp)];
    return r ? r.sp + '|' + r.team : rkey(sp, team);
  }

  /* ── sprite pancaran (dirender sekali) ───────────────────────────── */
  var SPR = null;
  function radial(size, stops) {
    var c = D.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'), h = size / 2, g = x.createRadialGradient(h, h, 0, h, h, h);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }
  function halo(rgb) {
    return radial(128, [[0, 'rgba(' + rgb + ',.46)'], [0.14, 'rgba(' + rgb + ',.26)'], [0.32, 'rgba(' + rgb + ',.10)'],
      [0.6, 'rgba(' + rgb + ',.028)'], [1, 'rgba(' + rgb + ',0)']]);
  }
  function sprites() {
    if (SPR) return SPR;
    var core = radial(96, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(250,255,251,1)'], [0.37, 'rgba(222,255,232,.78)'],
      [0.5, 'rgba(150,245,180,.26)'], [0.72, 'rgba(70,215,110,.07)'], [1, 'rgba(48,209,88,0)']]);
    var spike = D.createElement('canvas'); spike.width = spike.height = 160;
    var x = spike.getContext('2d');
    [[0, 80, 160, 80], [80, 0, 80, 160]].forEach(function (l) {
      var g = x.createLinearGradient(l[0], l[1], l[2], l[3]);
      g.addColorStop(0, 'rgba(200,255,220,0)'); g.addColorStop(0.42, 'rgba(210,255,225,.35)');
      g.addColorStop(0.5, 'rgba(240,255,245,.95)'); g.addColorStop(0.58, 'rgba(210,255,225,.35)'); g.addColorStop(1, 'rgba(200,255,220,0)');
      x.fillStyle = g;
      if (l[1] === l[3]) x.fillRect(0, 79.2, 160, 1.6); else x.fillRect(79.2, 0, 1.6, 160);
    });
    SPR = { core: core, spike: spike, g: halo('48,209,88'), y: halo('255,212,38'), c: halo('150,176,205') };
    return SPR;
  }

  /* ── debu bintang jauh (pola berulang, dirender sekali) ──────────── */
  function dustTile(size, n, seed, rMin, rMax, aMin, aMax) {
    var c = D.createElement('canvas'), dpr = S.dpr;
    c.width = c.height = Math.round(size * dpr);
    var x = c.getContext('2d'), r = rng(seed);
    x.scale(dpr, dpr);
    for (var i = 0; i < n; i++) {
      var px = r() * size, py = r() * size, rr = rMin + (rMax - rMin) * Math.pow(r(), 2.2), a = aMin + (aMax - aMin) * r();
      var tint = r();
      x.fillStyle = tint < 0.18 ? 'rgba(190,255,215,' + a + ')' : tint < 0.3 ? 'rgba(200,215,255,' + a + ')' : 'rgba(255,255,255,' + a + ')';
      x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.fill();
    }
    return c;
  }

  /* ── tata letak: rasi (filotaksis + pohon rentang) & elips galaksi ─ */
  var R_MIN = 2.3, R_MAX = 10, SPACING = 25, MINSEP = 25, GOLD = 2.39996323;
  function slotOffset(c, i, salt) {
    var rr = rng(hash(c.id + '#' + i + (salt || '')));
    var rad = i === 0 ? SPACING * 0.28 * rr() : SPACING * Math.sqrt(i + 0.5) * (0.86 + 0.28 * rr());
    var ang = c.rot + i * GOLD + (rr() - 0.5) * 0.7;
    return [rad * Math.cos(ang), rad * Math.sin(ang)];
  }
  function clearOf(c, x, y, skip) {
    for (var k = 0; k < c.stars.length; k++) {
      var o = c.stars[k];
      if (o === skip || o.ox == null) continue;
      var dx = o.ox - x, dy = o.oy - y;
      if (dx * dx + dy * dy < MINSEP * MINSEP) return false;
    }
    return true;
  }
  function placeNew(c, s) {
    var i = c.stars.length - 1;
    for (var tries = 0; tries < 24; tries++) {
      var o = slotOffset(c, i + Math.floor(tries / 3), tries ? 's' + tries : '');
      if (clearOf(c, o[0], o[1], s) || tries === 23) { s.ox = o[0]; s.oy = o[1]; return; }
    }
  }
  function layoutCluster(c) {
    var n = c.stars.length;
    c.stars.forEach(function (s, i) { var o = n === 1 ? [0, 0] : slotOffset(c, i); s.ox = o[0]; s.oy = o[1]; });
    for (var it = 0; it < 18; it++) {
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
        var A = c.stars[a], B = c.stars[b], dx = B.ox - A.ox, dy = B.oy - A.oy, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (d < MINSEP) { var p = (MINSEP - d) / 2 / d; A.ox -= dx * p; A.oy -= dy * p; B.ox += dx * p; B.oy += dy * p; }
      }
    }
    // pusatkan pada kotak pembatas
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    c.stars.forEach(function (s) { x0 = Math.min(x0, s.ox); x1 = Math.max(x1, s.ox); y0 = Math.min(y0, s.oy); y1 = Math.max(y1, s.oy); });
    var mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    c.stars.forEach(function (s) { s.ox -= mx; s.oy -= my; });
  }
  function clusterGeom(c) {
    var m = 0, y0 = 0, y1 = 0, x0 = 0, x1 = 0;
    c.stars.forEach(function (s) {
      m = Math.max(m, Math.sqrt(s.ox * s.ox + s.oy * s.oy));
      x0 = Math.min(x0, s.ox); x1 = Math.max(x1, s.ox); y0 = Math.min(y0, s.oy); y1 = Math.max(y1, s.oy);
    });
    c.R = m + R_MAX + 6;
    c.x0 = x0; c.x1 = x1; c.y0 = y0; c.y1 = y1;
    // pohon rentang minimum (Prim) → garis rasi
    var n = c.stars.length, inT = [true], best = [], from = [], edges = [];
    for (var i = 1; i < n; i++) { inT[i] = false; best[i] = 1e18; from[i] = 0; }
    var last = 0;
    for (var k = 1; k < n; k++) {
      var bi = -1;
      for (var j = 1; j < n; j++) {
        if (inT[j]) continue;
        var dx = c.stars[j].ox - c.stars[last].ox, dy = c.stars[j].oy - c.stars[last].oy, d = dx * dx + dy * dy;
        if (d < best[j]) { best[j] = d; from[j] = last; }
        if (bi < 0 || best[j] < best[bi]) bi = j;
      }
      inT[bi] = true; last = bi;
      edges.push([c.stars[from[bi]], c.stars[bi]]);
    }
    c.edges = edges;
  }
  // keliling elips (Ramanujan) dibagi jari-jari a
  function perimK(k) { return Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k))); }
  function layoutRing() {
    var cs = S.corder, n = cs.length, vw = S.vw, vh = S.vh;
    S.ring = null;
    if (!n) return;
    cs.forEach(function (c) { clusterGeom(c); });
    if (n === 1) { cs[0].cx = 0; cs[0].cy = 0; return; }
    var aw = vw - 32, ah = vh - S.topH - S.footH;
    var k = clamp(ah / aw * 0.92, 0.5, 1.75), gap = 30;
    var need = 0; cs.forEach(function (c) { need += 2 * c.R + gap; });
    var maxR = 0; cs.forEach(function (c) { maxR = Math.max(maxR, c.R); });
    var a = Math.max(need / perimK(k), (maxR + 46) / Math.min(1, k), n === 2 ? maxR + 20 : 0);
    var start = k >= 1 ? -Math.PI / 2 : Math.PI;   // ujung sumbu panjang
    var N = 360, th = [], L = [];
    for (var it = 0; it < 40; it++) {
      var b = a * k, acc = 0, px = a * Math.cos(start), py = b * Math.sin(start);
      th.length = 0; L.length = 0;
      for (var i = 0; i <= N; i++) {
        var t = start + i / N * Math.PI * 2, x = a * Math.cos(t), y = b * Math.sin(t);
        acc += Math.sqrt((x - px) * (x - px) + (y - py) * (y - py)); px = x; py = y;
        th.push(t); L.push(acc);
      }
      var tot = L[N], u = 0, ok = true;
      for (var ci = 0; ci < n; ci++) {
        var c = cs[ci];
        if (ci > 0) u += cs[ci - 1].R + gap + c.R;     // rasi 0 tepat di titik awal
        var pos = u / need * tot, lo = 0, hi = N;
        while (lo < hi) { var mid = (lo + hi) >> 1; if (L[mid] < pos) lo = mid + 1; else hi = mid; }
        c.cx = a * Math.cos(th[lo]); c.cy = b * Math.sin(th[lo]);
      }
      for (var p = 0; p < n && ok; p++) {
        var P = cs[p];
        if (Math.sqrt(P.cx * P.cx + P.cy * P.cy) - P.R < 40) ok = false;
        for (var q = p + 1; q < n && ok; q++) {
          var Q = cs[q], dd = Math.sqrt((P.cx - Q.cx) * (P.cx - Q.cx) + (P.cy - Q.cy) * (P.cy - Q.cy));
          if (dd < P.R + Q.R + gap * 0.55) ok = false;
        }
      }
      if (ok) break;
      a *= 1.06;
    }
    S.ring = { a: a, b: a * k };
  }

  /* ── kamera ───────────────────────────────────────────────────────── */
  // jalur zoom optimal (van Wijk & Nuij 2003): [ux, uy, w] w = lebar layar dalam satuan dunia
  function interpZoom(p0, p1) {
    var rho = Math.SQRT2, rho2 = 2, rho4 = 4;
    var ux0 = p0[0], uy0 = p0[1], w0 = p0[2], ux1 = p1[0], uy1 = p1[1], w1 = p1[2];
    var dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, f, S2;
    if (d2 < 1e-9) {
      S2 = Math.log(w1 / w0) / rho;
      f = function (t) { return [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(rho * t * S2)]; };
    } else {
      var d1 = Math.sqrt(d2),
        b0 = (w1 * w1 - w0 * w0 + rho4 * d2) / (2 * w0 * rho2 * d1),
        b1 = (w1 * w1 - w0 * w0 - rho4 * d2) / (2 * w1 * rho2 * d1),
        r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0),
        r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S2 = (r1 - r0) / rho;
      f = function (t) {
        var s = t * S2, c0 = cosh(r0), u = w0 / (rho2 * d1) * (c0 * tanh(rho * s + r0) - sinh(r0));
        return [ux0 + u * dx, uy0 + u * dy, w0 * c0 / cosh(rho * s + r0)];
      };
    }
    f.duration = Math.abs(S2) * 1000;
    return f;
  }
  // zoom terdekat: 7x tampilan semua tim, minimal sedekat zoom rasi di HP kecil
  function zHi() { return Math.max(S.z0 * 7, 5); }
  function setCam(c) { S.cam.x = c.x; S.cam.y = c.y; S.cam.z = c.z; S.labsDirty = true; }
  function flyTo(tc, dur, done) {
    S.fling = null;
    S.lastAct = now();
    if (reduced()) { S.anim = null; setCam(tc); if (done) done(); kick(); return; }
    var c = S.cam, vw = S.vw;
    var I = interpZoom([c.x, c.y, vw / c.z], [tc.x, tc.y, vw / tc.z]);
    var big = Math.abs(Math.log(tc.z / c.z)) > 0.25 || Math.abs(tc.x - c.x) * c.z > vw * 0.4;
    S.anim = { t0: now(), d: dur || (big ? clamp(I.duration * 0.62, 560, 1150) : 380), I: I, end: tc, done: done || null };
    kick();
  }
  function stepCam(t) {
    var a = S.anim;
    if (!a) return false;
    var p = clamp((t - a.t0) / a.d, 0, 1), v = a.I((a.ease || easeInOut3)(p));
    S.cam.x = v[0]; S.cam.y = v[1]; S.cam.z = S.vw / v[2]; S.labsDirty = true;
    if (p >= 1) { setCam(a.end); S.anim = null; if (a.done) a.done(); }
    return true;
  }
  // kamera yang menaruh kotak dunia r ke area layar ar
  function fit(r, ar, zMin, zMax) {
    var z = Math.min(ar.w / Math.max(1, r.w), ar.h / Math.max(1, r.h));
    z = clamp(z, zMin || 0.05, zMax || 99);
    return {
      x: r.x + r.w / 2 - (ar.x + ar.w / 2 - S.vw / 2) / z,
      y: r.y + r.h / 2 - (ar.y + ar.h / 2 - S.vh / 2) / z, z: z
    };
  }
  function homeCam() {
    var cs = S.corder, vw = S.vw, vh = S.vh;
    var ar = { x: 12, y: S.topH + 2, w: vw - 24, h: vh - S.topH - S.footH - 4 };
    var x0 = -60, x1 = 60, y0 = -30, y1 = 30;
    cs.forEach(function (c) { x0 = Math.min(x0, c.cx + c.x0 - R_MAX); x1 = Math.max(x1, c.cx + c.x1 + R_MAX); y0 = Math.min(y0, c.cy + c.y0 - R_MAX); y1 = Math.max(y1, c.cy + c.y1 + R_MAX); });
    S.bounds = { x0: x0, x1: x1, y0: y0, y1: y1 };
    var cam = fit({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, ar, 0.2, 2.1);
    for (var it = 0; it < 3; it++) {
      var z = cam.z, ox = vw / 2 - cam.x * z, oy = vh / 2 - cam.y * z, ss = clamp(z, 0.72, 1.12);
      var X0 = x0, X1 = x1, Y0 = y0, Y1 = y1;
      cs.forEach(function (c) {
        if (!c.el) return;
        var A = teamAnchor(c, c.side || 'b', z, ox, oy, ss, false), r = boxAt(A.x, A.y, c.lw, c.lh, A.al);
        X0 = Math.min(X0, (r.x - ox) / z); X1 = Math.max(X1, (r.x + r.w - ox) / z);
        Y0 = Math.min(Y0, (r.y - oy) / z); Y1 = Math.max(Y1, (r.y + r.h - oy) / z);
      });
      cam = fit({ x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 }, ar, 0.2, 2.1);
    }
    S.z0 = cam.z;
    S.sBase = clamp(cam.z, 0.72, 1.12);
    S.home = cam;
    return cam;
  }
  function focusCamFor(c) {
    var vw = S.vw, vh = S.vh, side = S.sel && cardRight(), card = S.sel && !side ? cardH() + 22 : 0;
    var ar = { x: 18, y: S.topH + 18, w: vw - 36 - (side ? cardW() : 0), h: vh - S.topH - 18 - Math.max(30, card) };
    var padX = vw < 360 ? 44 : 58, padTop = 26, padBot = 46;
    var z = Math.min((ar.w - 2 * padX) / Math.max(1, c.x1 - c.x0), (ar.h - padTop - padBot) / Math.max(1, c.y1 - c.y0));
    z = clamp(z, S.z0 * 1.7, Math.max(S.z0 * 4.6, 3.4));
    var cx = c.cx + (c.x0 + c.x1) / 2, cy = c.cy + (c.y0 + c.y1) / 2 + (padBot - padTop) / 2 / z;
    return { x: cx - (ar.x + ar.w / 2 - vw / 2) / z, y: cy - (ar.y + ar.h / 2 - vh / 2) / z, z: z };
  }

  /* ── keadaan panggung ─────────────────────────────────────────────── */
  var S = null;        // null = tertutup
  var raf = 0, lastFrame = 0, frameNo = 0;
  var H = { depth: 0, tok: '', wait: null, timer: 0 };
  var entryBtn = null, entrySubAt = 0, entryTimer = 0, reopenBlockUntil = 0;

  function q(sel) { return S.root.querySelector(sel); }
  function cardH() { var e = S && S.card; return e ? e.offsetHeight || 190 : 0; }
  // kartu: di HP menempel di bawah, di layar lebar (≥900px) di kanan bawah
  function cardRight() { return S.vw >= 900; }
  function cardW() { return 364; }

  function buildDom(m) {
    var root = D.createElement('div');
    root.className = 'hxs';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Peta bintang');
    root.setAttribute('tabindex', '-1');
    var desk = !W.matchMedia || W.matchMedia('(hover:hover) and (pointer:fine)').matches;
    root.innerHTML =
      '<div class="hxs-top">' +
      '<button type="button" class="hxs-btn hxs-back" aria-label="Kembali ke semua tim">' + svg(CHEV_L) + '<span>Semua tim</span></button>' +
      '<div class="hxs-title"><div class="hxs-t1"></div><div class="hxs-t2"></div></div>' +
      '<button type="button" class="hxs-btn hxs-x" aria-label="Tutup peta bintang">' + svg(XI) + '</button></div>' +
      '<div class="hxs-stage"><canvas class="hxs-cv" aria-hidden="true"></canvas>' +
      '<div class="hxs-core" aria-hidden="true"><div class="hxs-core-in"><span class="hxs-core-l"></span><span class="hxs-core-v"></span><span class="hxs-core-s"></span></div></div>' +
      '<div class="hxs-labs"></div></div>' +
      '<button type="button" class="hxs-toast" aria-live="polite"></button>' +
      '<div class="hxs-foot">' +
      '<div class="hxs-hint">' + (desk ? 'Klik rasi untuk mendekat · gulir untuk zoom' : 'Ketuk rasi untuk mendekat · cubit untuk zoom') + '</div>' +
      '<div class="hxs-frow"><div class="hxs-legend"><span class="hxs-lg-a"><i class="hxs-dot hxs-dot-s"></i><i class="hxs-dot hxs-dot-l"></i>Besar = omset bulan ini</span>' +
      '<span class="hxs-lg-b"><i class="hxs-dot hxs-dot-b"></i>Terang = closing ' + (m.live ? 'hari ini' : 'tgl ' + esc(m.dayLbl)) + '</span></div>' +
      '<button type="button" class="hxs-btn hxs-tour" aria-label="Putar tur rasi">' + svg(PLAY, 'hxs-tour-p') + svg(STOP, 'hxs-tour-s') + '<span>Putar tur</span></button>' +
      '</div></div>' +
      '<div class="hxs-tourbar" aria-hidden="true"><i></i></div>' +
      '<div class="hxs-card" role="group" aria-label="Detail sales">' +
      '<div class="hxs-c-top"><span class="hxs-c-team"></span>' +
      '<button type="button" class="hxs-c-x" aria-label="Tutup kartu">' + svg(XI) + '</button></div>' +
      '<div class="hxs-c-name"></div>' +
      '<div class="hxs-c-l hxs-c-ml"></div><div class="hxs-c-mtd"></div>' +
      '<div class="hxs-c-row"><div class="hxs-c-cell"><span class="hxs-c-l">Peringkat</span><b class="hxs-c-rank"></b></div>' +
      '<div class="hxs-c-cell"><span class="hxs-c-l hxs-c-dl"></span><b class="hxs-c-day"></b></div>' +
      '<div class="hxs-c-cell"><span class="hxs-c-l hxs-c-sl">Porsi tim</span><b class="hxs-c-share"></b></div></div>' +
      '<button type="button" class="hxs-c-go"><span>Buka detail</span>' + svg(CHEV_R) + '</button>' +
      '<div class="hxs-c-note"></div></div>';
    return root;
  }

  /* ── bintang & rasi dari model ────────────────────────────────────── */
  function mkStar(d, born) {
    var r = rng(hash(d.key));
    return {
      key: d.key, sp: d.sp, team: d.team, cl: d.cl, ch: d.ch, left: !!d.left, mtd: d.mtd, today: d.today, acts: d.acts, rank: d.rank,
      ox: null, oy: null, x: 0, y: 0, r: R_MIN, rd: 0, rv: 0, born: born,
      p1: r() * 6.28, p2: r() * 6.28, p3: r() * 6.28, tw: 0.7 + r() * 0.9, fx: 0.18 + r() * 0.12, fy: 0.15 + r() * 0.12,
      flash: 0, lab: null, labTxt: '', lw: 0, lh: 0, gone: 0, sx: 0, sy: 0, rs: 0
    };
  }
  function mkCluster(id) {
    var r = rng(hash('c' + id));
    return { id: id, name: id === CH ? 'Channel' : id, mono: id === CH ? 'CH' : mono(id), stars: [], edges: [], rot: r() * 6.28,
      mtd: 0, today: 0, shown: 0, tw: null, cx: 0, cy: 0, R: 30, dim: 1, dimT: 1, el: null, lw: 0, lh: 0, side: 'b', lvl: 0, lineT0: 0 };
  }
  function applyModel(m, intro) {
    var t = now(), byKey = {}, changed = false;
    S.model = m;
    var maxM = 0;
    m.list.forEach(function (d) { maxM = Math.max(maxM, d.mtd); });
    S.maxM = maxM;
    m.list.forEach(function (d) { byKey[d.key] = d; });
    // hilang dari model (mis. data dihapus) → pudar keluar
    S.order.forEach(function (s) { if (!byKey[s.key] && !s.gone) { s.gone = t; changed = true; } });
    var fresh = [];
    m.list.forEach(function (d) {
      var s = S.stars[d.key];
      if (!s || s.gone) {
        if (s && s.gone) { s.gone = 0; return upd(s, d); }
        s = S.stars[d.key] = mkStar(d, t);
        S.order.push(s);
        fresh.push(s);
        changed = true;
      }
      upd(s, d);
    });
    function upd(s, d) {
      s.mtd = d.mtd; s.today = d.today; s.acts = d.acts; s.rank = d.rank; s.left = !!d.left;
      s.r = d.mtd > 0 ? R_MIN + (R_MAX - R_MIN) * Math.sqrt(d.mtd / Math.max(1, maxM)) : 1.55;
    }
    // rasi
    var newCl = false;
    fresh.forEach(function (s) {
      var c = S.clusters[s.cl];
      if (!c) { c = S.clusters[s.cl] = mkCluster(s.cl); S.corder.push(c); newCl = true; }
      c.stars.push(s);
    });
    // label tim = omset tim resmi (sama dengan layar lain: termasuk channel,
    // team lead & yang sudah keluar); rasi Channel = jumlah bintangnya
    S.corder.forEach(function (c) {
      var sum = 0;
      c.mtd = 0; c.today = 0; c.n = 0; c.nLeft = 0;
      c.stars.forEach(function (s) { if (!s.gone) { sum += s.mtd; c.today += s.today; c.n++; if (s.left) c.nLeft++; } });
      var tt = c.id !== CH && m.teamTot ? m.teamTot[c.id] : null;
      c.mtd = tt != null && tt >= sum ? tt : sum;
      c.chRev = c.id !== CH && m.teamCh ? m.teamCh[c.id] || 0 : 0;
      c.leadRev = c.id !== CH && m.teamLead ? m.teamLead[c.id] || 0 : 0;
      if (c.id === CH) {
        var tl = [];
        c.stars.forEach(function (s) { if (!s.gone && s.team && tl.indexOf(s.team) < 0) tl.push(s.team); });
        c.teams = tl;
      }
    });
    if (intro || newCl) {
      // urut: tim omset terbesar dulu (searah jarum jam dari atas), Channel paling akhir
      S.corder.sort(function (a, b) { return (a.id === CH) - (b.id === CH) || b.mtd - a.mtd; });
      S.corder.forEach(function (c) {
        c.stars.sort(function (a, b) { return b.mtd - a.mtd; });
        layoutCluster(c);
      });
      S.needRing = true;
    } else if (fresh.length) {
      fresh.forEach(function (s) { placeNew(S.clusters[s.cl], s); });
      S.corder.forEach(function (c) { clusterGeom(c); });
    }
    S.order.forEach(function (s) { var c = S.clusters[s.cl]; s.x = c.cx + s.ox; s.y = c.cy + s.oy; });
    if (intro) S.corder.forEach(function (c) { c.shown = 0; });
    // angka bergulir: tim & pusat
    S.corder.forEach(function (c) { tweenNum(c, c.mtd, intro ? 1100 : 900, intro ? 350 : 0); });
    tweenNum(S.coreNum, m.total, intro ? 1300 : 900, intro ? 200 : 0);
    tweenNum(S.dayNum, m.dayTot, intro ? 1300 : 900, intro ? 200 : 0);
    if (changed) S.labsDirty = true;
    return fresh;
  }
  function tweenNum(o, to, dur, delay) {
    if (o.shown === to && !o.tw) return;
    if (reduced()) { o.shown = to; o.to = to; o.tw = null; o.txtDirty = true; return; }
    o.to = to;
    o.tw = { from: o.shown, to: to, t0: now() + (delay || 0), d: dur };
  }
  function stepNum(o, t) {
    var w = o.tw; if (!w) return false;
    var p = clamp((t - w.t0) / w.d, 0, 1);
    o.shown = w.from + (w.to - w.from) * easeOut3(p);
    if (p >= 1) { o.shown = w.to; o.tw = null; }
    o.txtDirty = true;
    return true;
  }
  function placeAll() {
    S.order.forEach(function (s) { var c = S.clusters[s.cl]; s.x = c.cx + s.ox; s.y = c.cy + s.oy; });
  }

  /* ── label DOM (tim, nama, pusat) ─────────────────────────────────── */
  function ensureTeamLabels() {
    var box = S.labs;
    S.corder.forEach(function (c) {
      if (!c.el) {
        var b = D.createElement('button');
        b.type = 'button';
        b.className = 'hxs-tl' + (c.id === CH ? ' hxs-tl-ch' : '');
        b.innerHTML = '<span class="hxs-tl-a"><span class="hxs-mono">' + esc(c.mono) + '</span><span class="hxs-tl-n">' + esc(c.name) + '</span></span><span class="hxs-tl-v"></span>';
        b.addEventListener('click', function (e) { e.stopPropagation(); userAct(); if (S.mode === 'focus' && S.focus === c.id) return; focusCluster(c.id); });
        box.appendChild(b);
        c.el = b; c.vEl = b.querySelector('.hxs-tl-v'); c.txtDirty = true;
      }
    });
    // ukur tiga tingkat detail dengan angka akhir (angka bergulir tidak menggeser
    // label: dipusatkan lewat translate %)
    S.corder.forEach(function (c) { c.vEl.textContent = mS(c.mtd); });
    LV.forEach(function (cls, i) {
      S.corder.forEach(function (c) { c.el.classList.remove('is-compact', 'is-mini'); if (cls) c.el.classList.add(cls); });
      S.corder.forEach(function (c) { (c.dims || (c.dims = []))[i] = [c.el.offsetWidth, c.el.offsetHeight]; });
    });
    S.corder.forEach(function (c) { setLevel(c, c.lvl || 0, true); });
    paintTeamText(true);
  }
  var LV = ['', 'is-compact', 'is-mini'];
  function setLevel(c, l, force) {
    if (c.lvl === l && !force) return;
    c.lvl = l;
    c.el.classList.remove('is-compact', 'is-mini');
    if (LV[l]) c.el.classList.add(LV[l]);
    c.lw = c.dims[l][0]; c.lh = c.dims[l][1];
  }
  function paintTeamText(force) {
    S.corder.forEach(function (c) {
      if (!c.el || (!c.txtDirty && !force)) return;
      c.txtDirty = false;
      c.vEl.textContent = mS(c.shown);
      var av = Math.round(c.mtd) + '|' + c.n + '|' + c.nLeft;
      if (c.ariaV === av) return;
      c.ariaV = av;
      c.el.setAttribute('aria-label', (c.id === CH ? 'Channel' : 'Team ' + c.name) + ', ' + mF(Math.round(c.mtd)) + ', ' +
        (c.id === CH ? c.n + ' channel' : (c.n - (c.nLeft || 0)) + ' sales' + (c.nLeft ? ', ' + c.nLeft + ' sudah keluar' : '')));
    });
    var k = S.coreNum, dn = S.dayNum;
    if ((k.txtDirty || force) && !S.empty) { k.txtDirty = false; S.coreV.textContent = mS(k.shown); }
    if ((dn.txtDirty || force) && !S.empty) {
      dn.txtDirty = false;
      S.coreS.innerHTML = dn.to > 0 || dn.shown > 0 ? '<b>+' + esc(mS(dn.shown)) + '</b> ' + esc(S.model.live ? 'hari ini' : 'pada ' + S.model.dayLbl) : '';
    }
  }
  function nameLabel(s) {
    if (!s.lab) {
      var b = D.createElement('button');
      b.type = 'button';
      b.className = 'hxs-nm';
      b.innerHTML = '<span class="hxs-nm-n"></span><span class="hxs-nm-v"></span>';
      b.addEventListener('click', function (e) { e.stopPropagation(); userAct(); tapStar(s); });
      S.labs.appendChild(b);
      s.lab = b; s.labOn = false; s.labX = s.labY = -1;
    }
    var txt = s.sp + '|' + Math.round(s.mtd) + '|' + (s.today > 0) + '|' + s.left;
    if (s.labTxt !== txt) {
      s.labTxt = txt;
      s.lab.firstChild.textContent = s.sp;
      s.lab.lastChild.textContent = (s.mtd > 0 ? mS(s.mtd) : 'aktif') + (s.left ? ' · keluar' : '');
      s.lab.classList.toggle('is-today', s.today > 0);
      s.lab.classList.toggle('is-left', !!s.left);
      s.lab.setAttribute('aria-label', s.sp + ', ' + (s.mtd > 0 ? mF(Math.round(s.mtd)) : 'belum ada omset') + (s.left ? ', sudah keluar dari tim' : ''));
      s.lw = s.lab.offsetWidth; s.lh = s.lab.offsetHeight;
    }
    return s.lab;
  }
  var ALIGN = { b: ' translate(-50%,0)', t: ' translate(-50%,-100%)', r: ' translate(0,-50%)', l: ' translate(-100%,-50%)', c: ' translate(-50%,-50%)' };
  function setPos(el, o, x, y, al) {
    x = Math.round(x); y = Math.round(y);
    if (o.px === x && o.py === y && o.al === al) return;
    o.px = x; o.py = y; o.al = al;
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)' + (al ? ALIGN[al] : '');
  }
  function setOn(el, o, on) {
    if (o.on === on) return;
    o.on = on;
    el.classList.toggle('is-on', on);
  }
  function overlap(a, b) { return a.x < b.x + b.w + 3 && b.x < a.x + a.w + 3 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2; }
  // kotak (x,y,w,h) label dari titik jangkar + perataan
  function boxAt(x, y, w, h, al) {
    if (al === 'b') return { x: x - w / 2, y: y, w: w, h: h };
    if (al === 't') return { x: x - w / 2, y: y - h, w: w, h: h };
    if (al === 'r') return { x: x, y: y - h / 2, w: w, h: h };
    return { x: x - w, y: y - h / 2, w: w, h: h };
  }
  // jangkar label tim pada kamera (z, ox, oy); sisi b/t/r/l = bawah/atas/kanan/kiri rasi
  function teamAnchor(c, side, z, ox, oy, ss, clampX) {
    var maxRs = R_MAX * ss + 3, x, y;
    if (side === 'b' || side === 't') {
      x = (c.cx + (c.x0 + c.x1) / 2) * z + ox;
      y = side === 'b' ? (c.cy + c.y1) * z + oy + maxRs + 7 : (c.cy + c.y0) * z + oy - maxRs - 7;
      if (clampX) x = clamp(x, 6 + c.lw / 2, S.vw - 6 - c.lw / 2);
    } else {
      y = (c.cy + (c.y0 + c.y1) / 2) * z + oy;
      x = side === 'r' ? (c.cx + c.x1) * z + ox + maxRs + 8 : (c.cx + c.x0) * z + ox - maxRs - 8;
    }
    return { x: x, y: y, al: side };
  }
  function placeLabels() {
    S.labsDirty = false;
    var t = now(), z = S.cam.z, vw = S.vw, vh = S.vh, ox = vw / 2 - S.cam.x * z, oy = vh / 2 - S.cam.y * z;
    var zr = z / S.z0, ss = S.sBase * Math.pow(zr, 0.55), ov = clamp((1.3 - zr) / 0.3, 0, 1);
    // pusat galaksi
    var co = S.coreO || (S.coreO = {});
    setPos(S.core, co, ox, oy, 'c');
    var cop = S.empty ? 1 : Math.round(ov * 50) / 50;
    if (co.op !== cop) { co.op = cop; S.core.style.opacity = cop; S.core.style.visibility = cop > 0 ? '' : 'hidden'; }
    // label tim
    var placed = [];
    S.corder.forEach(function (c) {
      var o = c.lo || (c.lo = {});
      var hide = !c.n || (S.mode === 'focus' && S.focus === c.id);
      var A = teamAnchor(c, c.side, z, ox, oy, ss, zr < 1.25), r = boxAt(A.x, A.y, c.lw, c.lh, A.al);
      // di luar layar, atau menyelinap di bawah bar atas (bertumpuk dengan judul)
      var off = r.x > vw || r.x + r.w < 0 || r.y > vh || r.y + r.h < 0 || r.y < S.topH - 8;
      setPos(c.el, o, A.x, A.y, A.al);
      var dimmed = S.mode === 'focus' && S.focus !== c.id;
      if (o.dim !== dimmed) { o.dim = dimmed; c.el.classList.toggle('is-dim', dimmed); }
      var lit = S.rm || t > c.lineT0 + 120;
      if (!lit) S.labsDirty = true;          // belum waktunya: cek lagi frame berikut
      setOn(c.el, o, lit && !hide && !off);
      if (!hide && !off) placed.push(r);
    });
    // nama bintang
    var want = [], showAll = S.mode === 'focus' || zr >= 1.9;
    S.order.forEach(function (s) {
      if (s.gone) { if (s.lab) setOn(s.lab, s.lo || (s.lo = {}), false); return; }
      var vis = S.mode === 'focus' ? s.cl === S.focus : showAll;
      if (s === S.sel || s === S.hover) vis = true;
      s.sx0 = s.x * z + ox; s.sy0 = s.y * z + oy;
      if (vis && (s.sx0 < -40 || s.sx0 > vw + 40 || s.sy0 < -40 || s.sy0 > vh + 40)) vis = false;
      if (vis) want.push(s);
      else if (s.lab) setOn(s.lab, s.lo || (s.lo = {}), false);
    });
    want.sort(function (a, b) { return (b === S.sel) - (a === S.sel) || (b === S.hover) - (a === S.hover) || b.mtd - a.mtd; });
    var disks = [];
    S.order.forEach(function (s) { if (!s.gone) { var rs = s.r * ss + 1; disks.push({ x: s.sx0 - rs, y: s.sy0 - rs, w: rs * 2, h: rs * 2, s: s }); } });
    var topLim = S.topH - 2, botLim = vh - (S.sel && !cardRight() ? cardH() + 18 : 6);
    want.forEach(function (s) {
      var el = nameLabel(s), o = s.lo || (s.lo = {});
      var rs = s.r * ss, w = s.lw, h = s.lh, cands = [
        [s.sx0, s.sy0 + rs + 5, 'b'], [s.sx0, s.sy0 - rs - 5, 't'], [s.sx0 + rs + 7, s.sy0, 'r'], [s.sx0 - rs - 7, s.sy0, 'l']];
      var pick = null, pa = null;
      for (var k = 0; k < cands.length && !pick; k++) {
        var r = boxAt(cands[k][0], cands[k][1], w, h, cands[k][2]), bad = r.y < topLim || r.y + h > botLim || r.x < 2 || r.x + w > vw - 2;
        for (var j = 0; j < placed.length && !bad; j++) if (overlap(r, placed[j])) bad = true;
        for (var m = 0; m < disks.length && !bad; m++) if (disks[m].s !== s && overlap(r, disks[m])) bad = true;
        if (!bad) { pick = r; pa = cands[k]; }
      }
      if (!pick && (s === S.sel || s === S.hover)) { pa = cands[0]; pick = boxAt(pa[0], pa[1], w, h, 'b'); }
      if (pick) { placed.push(pick); setPos(el, o, pa[0], pa[1], pa[2]); }
      if (o.sel !== (s === S.sel)) { o.sel = s === S.sel; el.classList.toggle('is-sel', o.sel); }
      setOn(el, o, !!pick && S.introDone);
    });
  }
  // tempat label tim di tampilan semua tim: 4 sisi x 3 tingkat detail, tidak
  // boleh menutupi rasi mana pun, angka pusat, bar atas/kaki, atau label lain.
  function teamLabelSides() {
    var z = S.home.z, vw = S.vw, vh = S.vh, ox = vw / 2 - S.home.x * z, oy = vh / 2 - S.home.y * z;
    var ss = S.sBase, rects = [], disks = [];
    S.corder.forEach(function (c) {
      disks.push({ x: (c.cx + c.x0) * z + ox - 5, y: (c.cy + c.y0) * z + oy - 5, w: (c.x1 - c.x0) * z + 10, h: (c.y1 - c.y0) * z + 10 });
    });
    if (!S.empty) { var cw = Math.max(S.core.offsetWidth, S.vw >= 700 ? 170 : 140), chh = Math.max(S.core.offsetHeight, 70); disks.push({ x: ox - cw / 2, y: oy - chh / 2, w: cw, h: chh }); }
    function cost(r) {
      var k = 0;
      if (r.y < S.topH - 2) k += 1e6 + (S.topH - r.y) * r.w;
      if (r.y + r.h > vh - S.footH + 4) k += 1e6 + (r.y + r.h - vh + S.footH) * r.w;
      if (r.x < 4 || r.x + r.w > vw - 4) k += 1e6;
      var L = rects.concat(disks);
      for (var i = 0; i < L.length; i++) {
        var o = L[i];
        if (overlap(r, o)) k += 1e5 + Math.max(1, (Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x)) * (Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y)));
      }
      return k;
    }
    S.corder.forEach(function (c) {
      var pv = c.cy > -4 ? 'b' : 't', ph = c.cx > 0 ? 'r' : 'l';
      var sides = [pv, pv === 'b' ? 't' : 'b', ph, ph === 'r' ? 'l' : 'r'];
      var best = null;
      for (var l = 0; l < LV.length && !(best && best.k === 0); l++) {
        setLevel(c, l);
        for (var i = 0; i < sides.length; i++) {
          var A = teamAnchor(c, sides[i], z, ox, oy, ss, true), r = boxAt(A.x, A.y, c.lw, c.lh, A.al), k = cost(r) + l * 2 + i;
          if (!best || k < best.k) best = { k: k, side: sides[i], l: l, r: r };
          if (k < 100) { best.k = 0; break; }
        }
      }
      setLevel(c, best.l);
      c.side = best.side;
      rects.push(best.r);
    });
  }

  /* ── menggambar ───────────────────────────────────────────────────── */
  function ellipsePath(ctx, x, y, a, b) {
    ctx.beginPath();
    if (ctx.ellipse) ctx.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
    else { ctx.save(); ctx.translate(x, y); ctx.scale(a, b); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.restore(); }
  }
  function draw(t) {
    var ctx = S.ctx, vw = S.vw, vh = S.vh, z = S.cam.z, dpr = S.dpr, sp = SPR, rm = S.rm;
    // jam suasana (kelip, hanyut, debu): berjalan hanya selama ada aktivitas
    // dan melambat sampai berhenti saat diam (lihat loop)
    var tt = rm ? 0 : S.clock / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    var ox = vw / 2 - S.cam.x * z, oy = vh / 2 - S.cam.y * z;
    var zr = z / S.z0, ss = S.sBase * Math.pow(zr, 0.55), ov = clamp((1.3 - zr) / 0.3, 0, 1);
    var intro = rm ? 1 : clamp((t - S.t0) / 900, 0, 1);
    // debu jauh: dua lapis paralaks, hanyut sangat pelan (satu isi pola per lapis)
    var Wd = vw * dpr, Hd = vh * dpr;
    for (var L = 0; L < S.dust.length; L++) {
      var d = S.dust[L], par = d.par, sc = 1 + (zr - 1) * par * 0.5;
      var dx = (-(S.cam.x - S.home.x) * z * par + tt * d.vx) % d.size, dy = (-(S.cam.y - S.home.y) * z * par + tt * d.vy) % d.size;
      var offX = Wd / 2 * (1 - sc) + dx * dpr * sc, offY = Hd / 2 * (1 - sc) + dy * dpr * sc;
      ctx.setTransform(sc, 0, 0, sc, offX, offY);
      ctx.globalAlpha = d.a * (0.3 + 0.7 * intro);
      ctx.fillStyle = d.pat;
      ctx.fillRect(-offX / sc, -offY / sc, Wd / sc, Hd / sc);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // orbit galaksi
    if (S.ring && ov > 0) {
      ctx.globalAlpha = 0.085 * ov * intro;
      ctx.strokeStyle = '#a8f0c0';
      ctx.lineWidth = 1;
      ellipsePath(ctx, ox, oy, S.ring.a * z, S.ring.b * z);
      ctx.stroke();
    }
    // posisi layar + hanyut
    var drift = rm ? 0 : 1;
    var order = S.order;
    for (var i = 0; i < order.length; i++) {
      var s = order[i];
      s.sx = s.x * z + ox + drift * (Math.sin(tt * s.fx + s.p1) * 1.1 + Math.sin(tt * 0.07 + s.p2) * 0.5);
      s.sy = s.y * z + oy + drift * (Math.cos(tt * s.fy + s.p2) * 1.1 + Math.cos(tt * 0.06 + s.p3) * 0.5);
      var ap = rm ? 1 : clamp((t - s.born) / 640, 0, 1);
      var gone = s.gone ? clamp(1 - (t - s.gone) / 600, 0, 1) : 1;
      s.app = ap; s.alpha = clamp((t - s.born) / 320, 0, 1) * gone;
      s.rs = Math.max(0, s.rd) * ss * (rm ? 1 : easeOutBack(ap)) * (0.4 + 0.6 * gone);
    }
    // garis rasi
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.85;
    for (var ci = 0; ci < S.corder.length; ci++) {
      var c = S.corder[ci], E = c.edges;
      if (!E.length) continue;
      var base = c.id === CH ? 0.13 : 0.2;
      var foc = S.mode === 'focus' && S.focus === c.id;
      var a = (foc ? 0.42 : base) * c.dim;
      if (S.hoverCl === c.id && S.mode !== 'focus') a = Math.max(a, 0.34);
      if (a < 0.01) continue;
      ctx.globalAlpha = a;
      ctx.strokeStyle = c.id === CH ? '#b8c8dc' : '#b4f5c8';
      ctx.beginPath();
      for (var e = 0; e < E.length; e++) {
        var A = E[e][0], B = E[e][1];
        if (A.gone || B.gone) continue;
        var lp = rm ? 1 : clamp((t - c.lineT0 - e * 70) / 460, 0, 1);
        if (lp <= 0) continue;
        var ex = B.sx - A.sx, ey = B.sy - A.sy, dl = Math.sqrt(ex * ex + ey * ey);
        if (dl < 1) continue;
        var ga = (A.rs + 3.5) / dl, gb = (B.rs + 3.5) / dl;
        if (ga + gb >= 1) continue;
        var e0 = ga, e1 = ga + (1 - gb - ga) * easeOut3(lp);
        ctx.moveTo(A.sx + ex * e0, A.sy + ey * e0);
        ctx.lineTo(A.sx + ex * e1, A.sy + ey * e1);
      }
      ctx.stroke();
    }
    // bintang (aditif)
    ctx.globalCompositeOperation = 'lighter';
    for (var k = 0; k < order.length; k++) {
      var st = order[k];
      if (st.alpha <= 0.005 || st.rs <= 0.05) continue;
      var cl = S.clusters[st.cl], dim = cl ? cl.dim : 1;
      var today = st.today > 0, hot = st.flash, left = st.left;
      var tw = rm || left ? 1 : (today ? 0.86 + 0.14 * Math.sin(tt * st.tw * 1.6 + st.p3) : 0.92 + 0.08 * Math.sin(tt * st.tw + st.p3));
      var hr = st.rs * (st.mtd > 0 ? (today ? 5.4 : 3.7) : 2.8) * (1 + hot * 0.9);
      if (st.sx + hr < 0 || st.sx - hr > vw || st.sy + hr < 0 || st.sy - hr > vh) continue;
      // sudah keluar: bintang padam (abu dingin, redup, tanpa kelip)
      var spr = st.key === S.model.top ? sp.y : st.ch || left ? sp.c : sp.g;
      var ha = (st.mtd > 0 ? (today ? 0.95 : 0.62) : 0.34) * (st.ch ? 0.6 : 1) * (left ? 0.45 : 1);
      ctx.globalAlpha = clamp(ha * tw * dim * st.alpha + hot * 0.5, 0, 1);
      ctx.drawImage(spr, st.sx - hr, st.sy - hr, hr * 2, hr * 2);
      if ((today && !st.ch && st.rs > 2.2) || hot > 0.02) {
        var sk = st.rs * (7.5 + hot * 4.5);
        ctx.globalAlpha = clamp((today && !st.ch ? 0.24 * tw : 0) * dim * st.alpha + hot * 0.85, 0, 1);
        ctx.drawImage(sp.spike, st.sx - sk, st.sy - sk, sk * 2, sk * 2);
      }
      var cr = st.rs / 0.33 * (1 + hot * 0.35);
      var ca = (st.mtd > 0 ? (today ? 1 : 0.82) : 0.5) * (st.ch ? 0.8 : 1) * (left ? 0.5 : 1);
      ctx.globalAlpha = clamp(ca * dim * st.alpha * (0.94 + 0.06 * tw), 0, 1);
      ctx.drawImage(sp.core, st.sx - cr, st.sy - cr, cr * 2, cr * 2);
    }
    // kilatan penjualan baru
    var F = S.flares;
    for (var f = F.length - 1; f >= 0; f--) {
      var fl = F[f], p = (t - fl.t0) / 1700;
      if (p >= 1) { F.splice(f, 1); continue; }
      if (p < 0) continue;
      var s2 = fl.s, rr = s2.rs || 3;
      ctx.globalAlpha = 0.9 * Math.pow(1 - p, 2);
      var br = rr * (2.2 + 9 * easeOut3(p)) / 0.33 * 0.32;
      ctx.drawImage(sp.core, s2.sx - br, s2.sy - br, br * 2, br * 2);
      ctx.globalCompositeOperation = 'source-over';
      for (var w = 0; w < 2; w++) {
        var pw = clamp((t - fl.t0 - w * 190) / 1500, 0, 1);
        if (pw <= 0 || pw >= 1) continue;
        ctx.globalAlpha = (w ? 0.28 : 0.6) * (1 - pw);
        ctx.strokeStyle = '#30d158';
        ctx.lineWidth = 1.5 * (1 - pw) + 0.4;
        ctx.beginPath(); ctx.arc(s2.sx, s2.sy, rr + 6 + (w ? 44 : 78) * easeOut3(pw), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'lighter';
    }
    ctx.globalCompositeOperation = 'source-over';
    // cincin pilihan / hover
    var sel = S.sel;
    if (sel && !sel.gone) {
      var sp2 = rm ? 1 : easeOut3(clamp((t - S.selT0) / 380, 0, 1));
      ctx.globalAlpha = 0.9 * sp2;
      ctx.strokeStyle = '#30d158';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(sel.sx, sel.sy, sel.rs + 7 + 10 * (1 - sp2), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.22 * sp2;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sel.sx, sel.sy, sel.rs + 13 + 14 * (1 - sp2), 0, Math.PI * 2); ctx.stroke();
    }
    if (S.hover && S.hover !== sel) {
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = '#d8ffe4';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(S.hover.sx, S.hover.sy, S.hover.rs + 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ── loop ─────────────────────────────────────────────────────────── */
  function busyAnim(t) {
    if (S.anim || S.fling || S.G || S.flares.length) return true;
    if (!S.introDone || (S.tour && S.tour.on)) return true;
    for (var i = 0; i < S.order.length; i++) {
      var s = S.order[i];
      if (Math.abs(s.rd - s.r) > 0.01 || Math.abs(s.rv) > 0.01 || s.flash > 0.01 || (s.gone && t - s.gone < 700) || t - s.born < 700) return true;
    }
    for (var j = 0; j < S.corder.length; j++) {
      var c = S.corder[j];
      if (c.tw || Math.abs(c.dim - c.dimT) > 0.01) return true;
      if (!S.rm && c.edges.length && t < c.lineT0 + c.edges.length * 70 + 480) return true;   // garis masih tergambar
    }
    if (S.sel && !S.rm && t - S.selT0 < 420) return true;                                       // cincin pilihan
    return !!(S.coreNum.tw || S.dayNum.tw);
  }
  function kick() {
    if (!S || raf || S.hidden) return;
    if (S.idle) { S.idle = false; lastFrame = 0; }     // bangun dari diam: dt mulai 0
    raf = requestAnimationFrame(loop);
  }
  // aktivitas (sentuhan, kamera, penjualan baru, kartu): suasana hidup lagi
  function wake() { if (!S) return; S.lastAct = now(); kick(); }
  // Diam 4,5 dtk (HP lemah 2,5 dtk): kelip & hanyut melambat ~1,4 dtk sampai
  // berhenti, frame terakhir tetap di layar, rAF tidak diminta lagi.
  function idleLimit() { return HX.tier === 'low' ? 2500 : 4500; }
  function loop() {
    raf = 0;
    if (!S || S.hidden) return;
    if (!S.rm && reduced()) { syncPrefs(); return; }   // browser tanpa event 'change'
    var t = now(), dt = Math.min(64, t - (lastFrame || t));
    lastFrame = t;
    var moving = stepCam(t);
    stepFling(dt);
    // pegas jari-jari bintang (sedikit memantul saat tumbuh)
    var k = dt / 1000;
    S.order.forEach(function (s) {
      if (S.rm) { s.rd = s.r; s.rv = 0; s.flash = 0; return; }
      var fz = 150, dz = 15;
      s.rv += ((s.r - s.rd) * fz - s.rv * dz) * k;
      s.rd += s.rv * k;
      if (Math.abs(s.r - s.rd) < 0.005 && Math.abs(s.rv) < 0.005) { s.rd = s.r; s.rv = 0; }
      if (s.flash > 0) s.flash = Math.max(0, s.flash - dt / 1400);
    });
    S.corder.forEach(function (c) {
      c.dimT = S.mode === 'focus' && S.focus !== c.id ? 0.28 : 1;
      if (S.rm) c.dim = c.dimT; else c.dim += (c.dimT - c.dim) * (1 - Math.exp(-dt / 150));
      stepNum(c, t);
    });
    stepNum(S.coreNum, t);
    stepNum(S.dayNum, t);
    if (!S.introDone && (S.rm || t - S.t0 > S.introLen)) { S.introDone = true; S.labsDirty = true; }
    if (S.hoverPt && !S.G) hoverTest();
    var busy = busyAnim(t) || !!S.G;
    // suasana: naik cepat saat ada aktivitas, turun pelan saat diam; jam
    // suasana maju sebanding (smoothstep) → kelip melambat lalu membeku mulus
    var live = !S.rm && (busy || moving || t - S.lastAct < idleLimit());
    var a0 = S.amb;
    if (S.rm) S.amb = 0;
    else if (live) S.amb = Math.min(1, S.amb + dt / 450);
    else S.amb = Math.max(0, S.amb - dt / 1400);
    S.clock += dt * S.amb * S.amb * (3 - 2 * S.amb);
    if (a0 > 0 && S.amb === 0) S.forceDraw = true;       // frame penutup
    frameNo++;
    if (S.rm || busy || moving || (S.amb > 0 && (frameNo & 1)) || S.forceDraw || S.labsDirty) {
      S.forceDraw = false;
      draw(t);
      if (S.labsDirty) placeLabels();
      paintTeamText(false);
      var pf = S.perf, dtw = now() - t;
      pf.n++; pf.t += dtw; if (dtw > pf.max) pf.max = dtw;
    }
    S.perf.loops++;
    // tenang: tidak ada gerak, suasana sudah berhenti → loop tidur sampai kick()
    if (!busy && !moving && !live && S.amb <= 0 && !S.forceDraw && !S.labsDirty) { S.idle = true; S.perf.sleeps++; return; }
    kick();
  }
  function redraw() { if (!S) return; S.forceDraw = true; wake(); }

  /* ── gestur ───────────────────────────────────────────────────────── */
  function toWorld(sx, sy) { return { x: (sx - S.vw / 2) / S.cam.z + S.cam.x, y: (sy - S.vh / 2) / S.cam.z + S.cam.y }; }
  function hitStar(sx, sy, slop) {
    var best = null, bd = 1e9;
    S.order.forEach(function (s) {
      if (s.gone || s.alpha < 0.3) return;
      var dx = s.sx - sx, dy = s.sy - sy, d = Math.sqrt(dx * dx + dy * dy), lim = Math.max(slop, s.rs + 9);
      if (d <= lim && d - s.rs < bd) { bd = d - s.rs; best = s; }
    });
    return best;
  }
  function hitCluster(sx, sy) {
    var w = toWorld(sx, sy), best = null, bd = 1e9, slop = 14 / S.cam.z;
    S.corder.forEach(function (c) {
      if (!c.n) return;
      var mx = c.cx + (c.x0 + c.x1) / 2, my = c.cy + (c.y0 + c.y1) / 2;
      var rx = (c.x1 - c.x0) / 2 + R_MAX + 8 + slop, ry = (c.y1 - c.y0) / 2 + R_MAX + 8 + slop;
      var dx = (w.x - mx) / rx, dy = (w.y - my) / ry, d = dx * dx + dy * dy;
      if (d <= 1 && d < bd) { bd = d; best = c; }
    });
    return best;
  }
  function gestureTaken() { return R.classList.contains('hx-gesture') && !(S.G && S.G.claimed); }
  function claim() { if (S.G && !S.G.claimed) { S.G.claimed = true; R.classList.add('hx-gesture'); } }
  function unclaim() { if (S && S.G && S.G.claimed) R.classList.remove('hx-gesture'); }
  function ptsArr() { var a = []; for (var k in S.pts) a.push(S.pts[k]); return a; }
  function onDown(e) {
    if (!S || S.closing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (gestureTaken()) return;
    wake();
    S.pts[e.pointerId] = { id: e.pointerId, x: e.clientX, y: e.clientY };
    var P = ptsArr();
    stopTour();
    if (P.length === 1) {
      S.G = { mode: 'pending', id: e.pointerId, sx: e.clientX, sy: e.clientY, t0: now(), cam0: { x: S.cam.x, y: S.cam.y, z: S.cam.z }, hist: [], type: e.pointerType, claimed: false, onLab: !!(e.target && e.target.closest && e.target.closest('.hxs-tl,.hxs-nm')) };
    } else if (P.length === 2 && S.G) {
      startPinch(P);
    }
  }
  function startPinch(P) {
    var G = S.G;
    G.mode = 'pinch';
    claim();
    S.anim = null; S.fling = null;
    capture(P[0].id); capture(P[1].id);
    var mx = (P[0].x + P[1].x) / 2, my = (P[0].y + P[1].y) / 2;
    G.d0 = Math.max(10, Math.sqrt((P[0].x - P[1].x) * (P[0].x - P[1].x) + (P[0].y - P[1].y) * (P[0].y - P[1].y)));
    G.z0 = S.cam.z; G.w = toWorld(mx, my);
    leaveFocusForFree();
  }
  function capture(id) { try { S.stage.setPointerCapture(id); } catch (e) { } }
  function onMove(e) {
    if (!S) return;
    if (!S.pts[e.pointerId]) {
      if (e.pointerType === 'mouse' && !S.G) { S.hoverPt = { x: e.clientX, y: e.clientY }; wake(); }
      return;
    }
    var p = S.pts[e.pointerId];
    S.lastAct = now();
    p.x = e.clientX; p.y = e.clientY;
    var G = S.G;
    if (!G) return;
    if (G.mode === 'pending') {
      var dx = p.x - G.sx, dy = p.y - G.sy, slop = G.type === 'mouse' ? 4 : 9;
      if (dx * dx + dy * dy < slop * slop) return;
      G.mode = 'pan'; claim(); capture(p.id);
      S.anim = null; S.fling = null;
      G.sx = p.x; G.sy = p.y; G.cam0 = { x: S.cam.x, y: S.cam.y, z: S.cam.z };
      S.hover = null;
      if (S.mode === 'focus') leaveFocusForFree();
    }
    if (G.mode === 'pan' && p.id === G.id) {
      var ddx = p.x - G.sx, ddy = p.y - G.sy, z = S.cam.z;
      var nx = G.cam0.x - ddx / z, ny = G.cam0.y - ddy / z;
      S.cam.x = rubber(nx, S.bounds.x0, S.bounds.x1, z); S.cam.y = rubber(ny, S.bounds.y0, S.bounds.y1, z);
      S.labsDirty = true;
      var t = now();
      G.hist.push([t, p.x, p.y]);
      while (G.hist.length > 2 && t - G.hist[0][0] > 90) G.hist.shift();
      if (S.rm) redraw();
    } else if (G.mode === 'pinch') {
      var P = ptsArr();
      if (P.length < 2) return;
      var mx = (P[0].x + P[1].x) / 2, my = (P[0].y + P[1].y) / 2;
      var d = Math.sqrt((P[0].x - P[1].x) * (P[0].x - P[1].x) + (P[0].y - P[1].y) * (P[0].y - P[1].y));
      var nz = G.z0 * d / G.d0, lo = S.z0 * 0.8, hi = zHi();
      if (nz < lo) nz = lo - (lo - nz) * 0.25;
      if (nz > hi) nz = hi + (nz - hi) * 0.25;
      nz = clamp(nz, S.z0 * 0.5, zHi() * 1.3);
      S.cam.z = nz;
      S.cam.x = G.w.x - (mx - S.vw / 2) / nz; S.cam.y = G.w.y - (my - S.vh / 2) / nz;
      S.labsDirty = true;
      if (S.rm) redraw();
    }
  }
  function rubber(v, a, b, z) {
    var lim = 120 / z;
    if (v < a) return a - lim * (1 - 1 / ((a - v) / lim * 0.55 + 1));
    if (v > b) return b + lim * (1 - 1 / ((v - b) / lim * 0.55 + 1));
    return v;
  }
  function onUp(e) {
    if (!S || !S.pts[e.pointerId]) return;
    var G = S.G, wasPending = G && G.mode === 'pending', P;
    delete S.pts[e.pointerId];
    P = ptsArr();
    if (!G) return;
    if (G.mode === 'pinch' && P.length === 1) {
      // sisa satu jari: lanjut geser dari posisi sekarang
      G.mode = 'pan'; G.id = P[0].id; G.sx = P[0].x; G.sy = P[0].y; G.cam0 = { x: S.cam.x, y: S.cam.y, z: S.cam.z }; G.hist = [];
      return;
    }
    if (P.length) return;
    var dur = now() - G.t0;
    if (wasPending && e.type === 'pointerup') {
      endGesture();
      if (!G.onLab && dur < 650) tapAt(e.clientX, e.clientY);
      return;
    }
    if (G.mode === 'pan' && G.hist.length >= 2 && !S.rm) {
      var h0 = G.hist[0], h1 = G.hist[G.hist.length - 1], ht = Math.max(16, h1[0] - h0[0]);
      if (now() - h1[0] < 80) {
        var vx = (h1[1] - h0[1]) / ht, vy = (h1[2] - h0[2]) / ht;
        if (vx * vx + vy * vy > 0.04) S.fling = { vx: clamp(vx, -4, 4), vy: clamp(vy, -4, 4) };
      }
    }
    endGesture();
    if (!S.fling) settle();
    kick();
  }
  function endGesture() { unclaim(); if (S) { S.G = null; } }
  function onCancel(e) {
    if (!S) return;
    if (e && e.pointerId != null) { if (!S.pts[e.pointerId]) return; delete S.pts[e.pointerId]; if (ptsArr().length) return; }
    else S.pts = {};
    var had = S.G && S.G.mode !== 'pending';
    endGesture();
    if (had) settle();
  }
  function stepFling(dt) {
    var f = S.fling;
    if (!f) return;
    var z = S.cam.z, b = S.bounds;
    S.cam.x -= f.vx * dt / z; S.cam.y -= f.vy * dt / z;
    var out = S.cam.x < b.x0 || S.cam.x > b.x1 || S.cam.y < b.y0 || S.cam.y > b.y1;
    var decay = Math.exp(-dt / (out ? 70 : 320));
    f.vx *= decay; f.vy *= decay;
    S.labsDirty = true;
    if (f.vx * f.vx + f.vy * f.vy < 0.0004) { S.fling = null; settle(); }
  }
  // setelah gestur: kembali ke batas, atau ke tampilan semua tim
  function settle() {
    if (!S) return;
    var zr = S.cam.z / S.z0;
    if (zr < 1.12) { if (S.mode !== 'overview') goOverview(); else flyTo(S.home, 420); return; }
    if (S.mode === 'overview') { S.mode = 'free'; histTo(2); modeUI(); }
    var b = S.bounds, c = S.cam, tz = clamp(c.z, S.z0, zHi());
    var tx = clamp(c.x, b.x0, b.x1), ty = clamp(c.y, b.y0, b.y1);
    // layar kosong (mis. zoom ke pusat galaksi): bawa rasi terdekat ke tengah
    var hw = S.vw / 2 / tz, hh = (S.vh / 2 - S.topH / 2) / tz, any = false, near = null, nd = 1e18;
    S.order.forEach(function (s) {
      if (s.gone) return;
      if (Math.abs(s.x - tx) < hw - 12 / tz && Math.abs(s.y - ty) < hh - 12 / tz) any = true;
    });
    if (!any) {
      S.corder.forEach(function (cl) {
        if (!cl.n) return;
        var mx = cl.cx + (cl.x0 + cl.x1) / 2, my = cl.cy + (cl.y0 + cl.y1) / 2, d = (mx - tx) * (mx - tx) + (my - ty) * (my - ty);
        if (d < nd) { nd = d; near = cl; }
      });
      if (near) {
        var f = focusCamFor(near);
        flyTo({ x: f.x, y: f.y, z: Math.min(tz, f.z) }, 640);
        S.labsDirty = true;
        return;
      }
    }
    if (tx !== c.x || ty !== c.y || tz !== c.z) flyTo({ x: tx, y: ty, z: tz }, 360);
    S.labsDirty = true;
  }
  function onWheel(e) {
    if (!S) return;
    e.preventDefault();
    stopTour(); userAct();
    var dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1);
    var f = Math.exp(-dy * (e.ctrlKey ? 0.011 : 0.0016));
    var nz = clamp(S.cam.z * f, S.z0 * 0.9, zHi());
    var w = toWorld(e.clientX, e.clientY);
    S.anim = null; S.fling = null;
    S.cam.z = nz; S.cam.x = w.x - (e.clientX - S.vw / 2) / nz; S.cam.y = w.y - (e.clientY - S.vh / 2) / nz;
    S.labsDirty = true;
    if (S.mode === 'focus' && Math.abs(Math.log(f)) > 0.001) leaveFocusForFree();
    clearTimeout(S.wheelT);
    S.wheelT = setTimeout(settle, 220);
    redraw();
  }
  function hoverTest() {
    var p = S.hoverPt; S.hoverPt = null;
    if (!p) return;
    var s = hitStar(p.x, p.y, 10), c = s ? null : hitCluster(p.x, p.y);
    var h = s || null, hc = c ? c.id : (s ? s.cl : null);
    if (S.mode === 'focus' && s && s.cl !== S.focus) h = s;
    S.stage.style.cursor = (s || c) ? 'pointer' : (S.mode === 'overview' ? 'default' : 'grab');
    if (h !== S.hover || hc !== S.hoverCl) { S.hover = h; S.hoverCl = hc; S.labsDirty = true; S.forceDraw = true; }
  }

  /* ── aksi ─────────────────────────────────────────────────────────── */
  function userAct() {
    if (!S || S.hintGone) return;
    S.hintGone = true;
    S.root.classList.add('hint-off');
    lsSet('hxs_hint', '1');
  }
  function tapAt(x, y) {
    userAct();
    var s = hitStar(x, y, S.mode === 'overview' ? 12 : 22);
    if (S.mode === 'overview') {
      var c = s ? S.clusters[s.cl] : hitCluster(x, y);
      if (c) focusCluster(c.id, null);
      else if (S.sel) selectStar(null);
      return;
    }
    if (s) { tapStar(s); return; }
    var c2 = hitCluster(x, y);
    if (S.sel) { selectStar(null); return; }
    if (c2 && !(S.mode === 'focus' && S.focus === c2.id)) { focusCluster(c2.id, null); return; }
    goOverview();
  }
  function tapStar(s) {
    if (S.mode !== 'focus' || S.focus !== s.cl) focusCluster(s.cl, s);
    else selectStar(s === S.sel ? null : s);
  }
  function focusCluster(id, star) {
    var c = S.clusters[id];
    if (!c || !c.n) return;
    var first = S.mode === 'overview';
    S.mode = 'focus'; S.focus = id;
    if (first) histTo(2);
    if (star) selectStar(star, true); else if (S.sel && S.sel.cl !== id) selectStar(null, true);
    modeUI();
    vibrate(6);
    flyTo(focusCamFor(c));
    S.labsDirty = true;
  }
  function leaveFocusForFree() {
    if (S.mode !== 'focus') return;
    S.mode = 'free'; S.focus = null;
    modeUI();
    S.labsDirty = true;
  }
  function goOverview(fromPop) {
    if (!S) return;
    stopTour();
    selectStar(null, true);
    S.mode = 'overview'; S.focus = null;
    if (!fromPop) histTo(1);
    modeUI();
    flyTo(S.home);
    S.labsDirty = true;
  }
  function selectStar(s, quiet) {
    if (!S) return;
    if (S.sel === s) return;
    S.sel = s;
    S.selT0 = now();
    S.labsDirty = true;
    var card = S.card;
    if (!s) { card.classList.remove('is-on'); S.root.classList.remove('card-on'); redraw(); return; }
    paintCard(s);
    card.classList.add('is-on');
    S.root.classList.add('card-on');
    if (!quiet) vibrate(5);
    // rasi dibingkai ulang di atas kartu, lalu bintangnya dipastikan terlihat
    if (!quiet) {
      if (S.mode === 'focus' && S.focus === s.cl) flyTo(focusCamFor(S.clusters[s.cl]), 460);
      else ensureVisible(s);
    }
    redraw();
  }
  function ensureVisible(s) {
    var z = S.cam.z, sy = s.y * z + S.vh / 2 - S.cam.y * z, sx = s.x * z + S.vw / 2 - S.cam.x * z;
    var side = cardRight(), top = S.topH + 30, bot = S.vh - (side ? 0 : cardH()) - 64, dy = 0, dx = 0, rgt = S.vw - 50 - (side ? cardW() : 0);
    if (sy > bot) dy = sy - bot; else if (sy < top) dy = sy - top;
    if (sx < 50) dx = sx - 50; else if (sx > rgt) dx = sx - rgt;
    if (dx || dy) flyTo({ x: S.cam.x + dx / z, y: S.cam.y + dy / z, z: z }, 420);
  }
  function paintCard(s) {
    var m = S.model, c = S.clusters[s.cl], C = S.card;
    var team = (s.ch ? 'Channel · ' : '') + (s.team ? 'Team ' + s.team : '') + (s.left ? ' · sudah keluar' : '');
    C.querySelector('.hxs-c-team').innerHTML = '<span class="hxs-mono">' + esc(s.ch ? 'CH' : mono(s.team)) + '</span>' + esc(team);
    C.querySelector('.hxs-c-name').textContent = s.sp;
    C.querySelector('.hxs-c-ml').textContent = 'Omset ' + m.mon;
    C.classList.toggle('is-left', !!s.left);
    C.querySelector('.hxs-c-mtd').textContent = mF(Math.round(s.mtd));
    var rk = C.querySelector('.hxs-c-rank');
    var of = s.ch ? m.nCh : m.nSell;
    rk.innerHTML = s.rank ? two(s.rank) + '<small> dari ' + of + '</small>' : '<small>belum ada omset</small>';
    rk.classList.toggle('is-top', !s.ch && s.rank === 1);
    C.querySelector('.hxs-c-dl').textContent = m.dayLbl;
    var dEl = C.querySelector('.hxs-c-day');
    dEl.textContent = s.today > 0 ? '+' + mS(s.today) : s.left ? '—' : (m.live ? 'Belum closing' : 'Tidak ada');
    C.querySelector('.hxs-c-note').textContent = s.left ? 'Sudah keluar dari tim. Omset ' + m.mon + ' tetap dihitung di ' + (s.ch ? 'Channel' : 'Team ' + s.team) + '.' : '';
    dEl.classList.toggle('is-up', s.today > 0);
    var sh = c && c.mtd > 0 ? Math.round(s.mtd / c.mtd * 100) : 0;
    C.querySelector('.hxs-c-sl').textContent = s.ch ? 'Porsi channel' : 'Porsi tim';
    C.querySelector('.hxs-c-share').textContent = c && c.n > 1 ? sh + '%' : '100%';
  }
  // subjudul rasi yang dibuka: total resmi tim + apa saja isinya, supaya
  // selisih dengan jumlah bintang di rasi itu terjelaskan (channel ada di
  // rasi Channel, team lead tidak digambar). Tiga versi: panjang → ringkas.
  function focusSub(c) {
    var full = mF(Math.round(c.mtd)), short = mS(c.mtd), L = [];
    if (c.id === CH) {
      var tl = (c.teams || []).join(' & '), n = c.n + ' channel';
      if (tl) {
        L.push([full, n, 'dihitung di tim ' + tl], [short, n, 'dihitung di tim ' + tl], [short, 'dihitung di tim ' + tl], [short, 'tim ' + tl]);
      }
      L.push([short, n]);
    } else {
      var nS = (c.n - (c.nLeft || 0)) + ' sales', nCh = 0, k = c.nLeft ? c.nLeft + ' keluar' : null;
      S.order.forEach(function (s) { if (s.ch && !s.gone && s.team === c.id) nCh++; });
      var chA = c.chRev > 0 ? 'channel ' + mS(c.chRev) : null, chB = c.chRev > 0 ? (nCh ? nCh + ' channel' : 'channel') : null;
      var ldA = c.leadRev > 0 ? 'lead ' + mS(c.leadRev) : null, ldB = c.leadRev > 0 ? 'lead' : null;
      L.push([full, nS, k, chA, ldA], [short, nS, k, chA, ldA], [short, nS, k, chB, ldB]);
    }
    return L.map(function (p) { return esc(p.filter(Boolean).join(' · ')); });
  }
  function modeUI() {
    if (!S) return;
    var r = S.root, m = S.model, foc = S.mode === 'focus' ? S.clusters[S.focus] : null;
    r.classList.toggle('is-zoomed', S.mode !== 'overview');
    var t1, t2;
    var alts = null;
    if (foc) {
      t1 = '<span class="hxs-mono">' + esc(foc.mono) + '</span>' + esc(foc.id === CH ? 'Channel' : 'Team ' + foc.name);
      alts = focusSub(foc);
      t2 = alts[0];
    } else {
      t1 = 'Peta Bintang';
      var n = m.nSell + m.nCh, nc = 0;
      S.corder.forEach(function (c) { if (c.n) nc++; });
      t2 = esc(m.monY) + ' · ' + S.order.filter(function (s) { return !s.gone; }).length + ' bintang · ' + nc + ' rasi';
      void n;
    }
    var key = t1 + t2 + S.vw;
    if (S.titleKey === key) return;
    S.titleKey = key;
    S.t1.innerHTML = t1; S.t2.innerHTML = t2;
    // rincian terlalu panjang untuk layar ini: versi yang lebih ringkas
    for (var ai = 1; alts && ai < alts.length && S.t2.scrollWidth > S.t2.clientWidth + 1; ai++) S.t2.innerHTML = alts[ai];
    if (!S.rm && S.t1.parentNode.animate) {
      try { S.t1.parentNode.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' }); } catch (e) { }
    }
  }
  function toast(html, star) {
    if (!S) return;
    var el = S.toastEl;
    el.innerHTML = html;
    el.classList.remove('is-on'); void el.offsetWidth; el.classList.add('is-on');
    el.onclick = function (e) { e.stopPropagation(); el.classList.remove('is-on'); if (star && !star.gone) tapStar(star); };
    clearTimeout(S.toastT);
    S.toastT = setTimeout(function () { if (S) el.classList.remove('is-on'); }, 4200);
  }

  /* ── tur otomatis (sekali putaran, lalu kembali) ─────────────────── */
  function startTour() {
    if (!S || (S.tour && S.tour.on)) return;
    var list = S.corder.filter(function (c) { return c.n; });
    if (!list.length) return;
    userAct();
    selectStar(null, true);
    S.tour = { on: true, list: list, i: -1, t: 0 };
    S.root.classList.add('is-tour');
    S.tourBtn.setAttribute('aria-label', 'Hentikan tur');
    S.tourBtn.lastChild.textContent = 'Hentikan';
    nextTour();
  }
  function nextTour() {
    var T = S && S.tour;
    if (!T || !T.on) return;
    T.i++;
    if (T.i >= T.list.length) { stopTour(); goOverview(); return; }
    focusCluster(T.list[T.i].id, null);
    var bar = S.tourBar.firstChild, dwell = S.rm ? 3000 : 3400;
    bar.style.transition = 'none'; bar.style.transform = 'scaleX(' + (T.i / T.list.length) + ')';
    void bar.offsetWidth;
    bar.style.transition = 'transform ' + dwell + 'ms linear';
    bar.style.transform = 'scaleX(' + ((T.i + 1) / T.list.length) + ')';
    T.t = setTimeout(nextTour, dwell);
  }
  function stopTour() {
    var T = S && S.tour;
    if (!T || !T.on) return;
    T.on = false;
    clearTimeout(T.t);
    S.root.classList.remove('is-tour');
    S.tourBtn.setAttribute('aria-label', 'Putar tur rasi');
    S.tourBtn.lastChild.textContent = 'Putar tur';
  }

  /* ── riwayat: Back Android = satu tingkat keluar ─────────────────── */
  function histTo(d) {
    if (!S) return;
    if (d > H.depth) {
      try { while (H.depth < d) { H.depth++; history.pushState({ hxStars: H.tok, d: H.depth }, ''); } } catch (e) { }
    } else if (d < H.depth) {
      var n = H.depth - d; H.depth = d;
      H.wait = (H.wait || 0) + 1;
      try { history.go(-n); } catch (e) { H.wait--; }
    }
  }
  function onPop() {
    if (H.wait > 0) {
      H.wait--;
      if (!H.wait && H.after) { var f = H.after; H.after = null; clearTimeout(H.timer); f(); }
      return;
    }
    if (!S || S.closing) return;
    var st = history.state, d = st && st.hxStars === H.tok ? st.d : 0;
    if (d >= H.depth) return;
    H.depth = d;
    if (d <= 0) close('pop');
    else goOverview(true);
  }
  W.addEventListener('popstate', onPop);
  // dimuat ulang saat panggung terbuka: entri kita tersisa tanpa panggung
  try { if (history.state && history.state.hxStars) history.replaceState(null, ''); } catch (e) { }

  /* ── buka / tutup ─────────────────────────────────────────────────── */
  // kunci halaman di belakang (lebar scrollbar diganti padding: tanpa loncat).
  // Dilepas hanya kalau tidak ada panggung baru (buka-tutup cepat).
  var lockPR = '';
  function lockPage() {
    if (!R.classList.contains('hxs-lock')) {
      var sbw = W.innerWidth - R.clientWidth;
      lockPR = R.style.paddingRight;
      if (sbw > 0) R.style.paddingRight = sbw + 'px';
    }
    R.classList.add('hx-overlay-open', 'hxs-lock');
  }
  function unlockPage() {
    if (S) return;
    R.classList.remove('hx-overlay-open', 'hxs-lock');
    R.style.paddingRight = lockPR;
  }
  function measure() {
    var r = S.root.getBoundingClientRect();
    S.vw = Math.max(200, Math.round(r.width || W.innerWidth));
    S.vh = Math.max(240, Math.round(r.height || W.innerHeight));
    var top = S.root.querySelector('.hxs-top'), foot = S.root.querySelector('.hxs-foot');
    S.topH = top ? top.offsetHeight : 64;
    S.footH = foot ? foot.offsetHeight + 6 : 60;
    S.toastEl.style.top = (S.topH - 12) + 'px';
    var dpr = Math.min(W.devicePixelRatio || 1, HX.tier === 'low' ? 1.5 : 2);
    S.dpr = dpr;
    S.cv.width = Math.round(S.vw * dpr); S.cv.height = Math.round(S.vh * dpr);
    S.cv.style.width = S.vw + 'px'; S.cv.style.height = S.vh + 'px';
  }
  function makeDust() {
    var area = S.vw * S.vh, few = HX.tier === 'low';
    S.dust = [];
    // dua ukuran ubin yang tidak sebanding → pengulangan pola tidak terlihat
    S.dust.push({ pat: S.ctx.createPattern(dustTile(480, few ? 70 : 100, 7, 0.35, 0.95, 0.05, 0.32), 'repeat'), par: 0.05, a: 1, vx: -0.9, vy: 0.35, size: 480 });
    if (!few && area > 0) S.dust.push({ pat: S.ctx.createPattern(dustTile(347, 10, 11, 0.7, 1.25, 0.12, 0.4), 'repeat'), par: 0.13, a: 1, vx: -1.6, vy: 0.6, size: 347 });
  }
  function relayout(keepView) {
    S.needRing = false;
    measure();
    makeDust();
    layoutRing();
    placeAll();
    ensureTeamLabels();
    // sisi label butuh kamera rumah, kamera rumah butuh label → dua putaran
    S.corder.forEach(function (c) { c.side = c.cy > -4 ? 'b' : 't'; });
    homeCam();
    teamLabelSides();
    homeCam();
    teamLabelSides();
    homeCam();
    if (!keepView || S.mode === 'overview') setCam(S.home);
    else if (S.mode === 'focus') setCam(focusCamFor(S.clusters[S.focus]));
    else setCam({ x: clamp(S.cam.x, S.bounds.x0, S.bounds.x1), y: clamp(S.cam.y, S.bounds.y0, S.bounds.y1), z: clamp(S.cam.z, S.z0, zHi()) });
    S.labsDirty = true;
    S.forceDraw = true;
  }
  function open(opts) {
    if (S) return;
    // layar penuh modul lain sedang terbuka: jangan menumpuk (hxs-lock = milik kita yang sedang memudar)
    if (R.classList.contains('hx-overlay-open') && !R.classList.contains('hxs-lock')) return;
    opts = opts || {};
    if (now() < reopenBlockUntil || H.wait > 0) {
      // 'back' dari sesi sebelumnya masih di jalan: buka setelah selesai
      setTimeout(function () { open(opts); }, 160);
      return;
    }
    var m = readModel();
    sprites();
    var root = buildDom(m);
    D.body.appendChild(root);
    var rm = reduced();
    S = {
      root: root, stage: root.querySelector('.hxs-stage'), cv: root.querySelector('.hxs-cv'),
      labs: root.querySelector('.hxs-labs'), core: root.querySelector('.hxs-core'), coreV: root.querySelector('.hxs-core-v'),
      t1: root.querySelector('.hxs-t1'), t2: root.querySelector('.hxs-t2'), card: root.querySelector('.hxs-card'),
      toastEl: root.querySelector('.hxs-toast'), tourBtn: root.querySelector('.hxs-tour'), tourBar: root.querySelector('.hxs-tourbar'),
      stars: {}, order: [], clusters: {}, corder: [], flares: [], pts: {}, G: null, anim: null, fling: null,
      cam: { x: 0, y: 0, z: 1 }, mode: 'overview', focus: null, sel: null, hover: null, hoverCl: null,
      rm: rm, t0: now(), introLen: rm ? 0 : 1900, perf: { n: 0, t: 0, max: 0, loops: 0, sleeps: 0 }, clock: 0, amb: rm ? 0 : 1, lastAct: now(), idle: false, introDone: rm, coreNum: { shown: 0, tw: null }, dayNum: { shown: 0, to: 0, tw: null },
      prevFocus: D.activeElement, origin: opts.origin || null, hintGone: !!lsGet('hxs_hint'), hidden: !!D.hidden
    };
    S.ctx = S.cv.getContext('2d');
    if (S.hintGone) root.classList.add('hint-off');
    root.querySelector('.hxs-core-l').textContent = 'Omset ' + m.mon;
    S.coreS = root.querySelector('.hxs-core-s');
    lockPage();
    H.tok = 'hxs' + Date.now(); H.depth = 0;
    histTo(1);

    applyModel(m, true);
    S.empty = !S.order.length;
    root.classList.toggle('is-empty', S.empty);
    if (S.empty) {
      S.core.querySelector('.hxs-core-l').textContent = 'Belum ada bintang';
      S.coreV.textContent = m.mon;
      S.coreS.textContent = 'Bintang muncul begitu ada closing atau laporan aktivitas.';
    }
    relayout(false);
    // urutan menyala: menyapu elips searah jarum jam, bintang besar dulu dalam tiap rasi
    var seq = 0, total = S.order.length || 1, t0 = S.t0;
    S.corder.forEach(function (c) {
      c.stars.forEach(function (s) {
        s.born = rm ? 0 : t0 + 260 + (seq / total) * 820;
        seq++;
      });
      var last = 0; c.stars.forEach(function (s) { last = Math.max(last, s.born); });
      c.lineT0 = rm ? 0 : last + 160;
    });
    if (!rm) {
      // dolly: mulai sedikit lebih dekat ke pusat, mundur ke tampilan semua tim
      setCam({ x: S.home.x, y: S.home.y, z: S.home.z * 1.32 });
      S.anim = { t0: now() + 60, d: 1600, I: interpZoom([S.cam.x, S.cam.y, S.vw / S.cam.z], [S.home.x, S.home.y, S.vw / S.home.z]), end: S.home, done: null, ease: easeOut3 };
    }
    modeUI();
    paintTeamText(true);
    bind();
    void root.offsetWidth;
    root.classList.add('is-in');
    try { root.focus({ preventScroll: true }); } catch (e) { try { root.focus(); } catch (e2) { } }
    lastFrame = 0;
    kick();
  }
  function close(how, after) {
    if (!S || S.closing) return;
    var s = S;
    s.closing = true;
    stopTour();
    clearTimeout(s.toastT); clearTimeout(s.wheelT);
    if (s.G && s.G.claimed) R.classList.remove('hx-gesture');
    unbind();
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    var d = H.depth;
    H.depth = 0;
    if (how !== 'pop' && d > 0) {
      H.wait = (H.wait || 0) + 1;
      if (after) {
        H.after = after;
        H.timer = setTimeout(function () { var f = H.after; H.after = null; if (f) f(); }, 700);
      }
      try { history.go(-d); } catch (e) { H.wait = 0; }
    } else if (after) setTimeout(after, 0);
    if (how !== 'pop' && d > 0) reopenBlockUntil = now() + 120;
    var done = function () {
      if (s.done) return;
      s.done = true;
      if (s.root.parentNode) s.root.parentNode.removeChild(s.root);
      unlockPage();
      if (!after) { try { var f = s.prevFocus; if (f && f.focus && D.body.contains(f)) f.focus({ preventScroll: true }); } catch (e) { } }
    };
    S = null;
    sim = {}; simDay = {}; simTot = 0;
    if (s.rm) { done(); return; }
    s.root.classList.remove('is-in');
    s.root.classList.add('is-out');
    s.root.style.pointerEvents = 'none';
    setTimeout(done, 300);
  }

  /* ── event ────────────────────────────────────────────────────────── */
  var B = {};
  function bind() {
    var st = S.stage, root = S.root;
    B.down = onDown; B.move = onMove; B.up = onUp; B.cancel = onCancel;
    if (hasPE) {
      st.addEventListener('pointerdown', B.down);
      st.addEventListener('pointermove', B.move);
      st.addEventListener('pointerup', B.up);
      st.addEventListener('pointercancel', B.cancel);
      st.addEventListener('lostpointercapture', B.lost = function (e) { if (S && S.G && S.G.mode !== 'pending') onCancel(e); });
      st.addEventListener('pointerleave', B.leave = function (e) { if (e.pointerType === 'mouse' && S && !S.G && (S.hover || S.hoverCl)) { S.hover = null; S.hoverCl = null; S.labsDirty = true; redraw(); } });
    } else {
      st.addEventListener('click', B.click = function (e) { if (!e.target.closest('.hxs-tl,.hxs-nm')) tapAt(e.clientX, e.clientY); });
    }
    st.addEventListener('wheel', B.wheel = onWheel, { passive: false });
    st.addEventListener('contextmenu', B.ctx = function (e) { e.preventDefault(); });
    root.addEventListener('touchmove', B.tm = function (e) { e.preventDefault(); }, { passive: false });
    root.querySelector('.hxs-x').addEventListener('click', function (e) { e.stopPropagation(); close('x'); });
    root.querySelector('.hxs-back').addEventListener('click', function (e) { e.stopPropagation(); goOverview(); });
    root.querySelector('.hxs-c-x').addEventListener('click', function (e) { e.stopPropagation(); selectStar(null); });
    root.querySelector('.hxs-c-go').addEventListener('click', function (e) {
      e.stopPropagation();
      var s = S && S.sel;
      if (!s || s.left) return;
      var sp = s.sp, team = s.team;
      close('detail', function () { try { if (typeof W.openSPMonth === 'function') W.openSPMonth(sp, team); } catch (er) { console.warn('[fx-stars] openSPMonth', er); } });
    });
    S.tourBtn.addEventListener('click', function (e) { e.stopPropagation(); if (S.tour && S.tour.on) { stopTour(); goOverview(); } else startTour(); });
    W.addEventListener('keydown', B.key = onKey, true);
    W.addEventListener('resize', B.resize = onResize);
    W.addEventListener('orientationchange', B.resize);
    W.addEventListener('blur', B.blur = function () { if (S) onCancel(); });
    D.addEventListener('visibilitychange', B.vis = function () {
      if (!S) return;
      S.hidden = D.hidden;
      if (D.hidden) { onCancel(); if (raf) { cancelAnimationFrame(raf); raf = 0; } }
      else { lastFrame = 0; redraw(); }
    });
  }
  function unbind() {
    W.removeEventListener('keydown', B.key, true);
    W.removeEventListener('resize', B.resize);
    W.removeEventListener('orientationchange', B.resize);
    W.removeEventListener('blur', B.blur);
    D.removeEventListener('visibilitychange', B.vis);
  }
  function onResize() {
    if (!S) return;
    clearTimeout(S.rsT);
    S.rsT = setTimeout(function () { if (!S) return; S.anim = null; S.fling = null; relayout(true); modeUI(); wake(); }, 120);
  }
  function focusables() {
    var l = S.root.querySelectorAll('button'), out = [];
    for (var i = 0; i < l.length; i++) {
      var b = l[i];
      if (b.offsetParent === null) continue;
      var cs = getComputedStyle(b);
      if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity < 0.05) continue;
      out.push(b);
    }
    return out;
  }
  function onKey(e) {
    if (!S) return;
    wake();
    var k = e.key;
    if (k === 'Escape' || k === 'Esc') {
      e.preventDefault(); e.stopPropagation();
      if (S.tour && S.tour.on) { stopTour(); goOverview(); }
      else if (S.sel) selectStar(null);
      else if (S.mode !== 'overview') goOverview();
      else close('esc');
      return;
    }
    if (k === 'Tab') {
      var f = focusables();
      if (!f.length) return;
      var i = f.indexOf(D.activeElement);
      if (e.shiftKey ? i <= 0 : i === f.length - 1 || i < 0) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      return;
    }
    var tgt = e.target;
    if (tgt && /^(INPUT|SELECT|TEXTAREA)$/.test(tgt.tagName)) return;
    if (k === 'ArrowRight' || k === 'ArrowLeft') {
      var list = S.corder.filter(function (c) { return c.n; });
      if (!list.length) return;
      e.preventDefault();
      stopTour();
      var cur = S.mode === 'focus' ? list.indexOf(S.clusters[S.focus]) : -1;
      var nx = cur < 0 ? (k === 'ArrowRight' ? 0 : list.length - 1) : (cur + (k === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
      focusCluster(list[nx].id, null);
    } else if (k === '+' || k === '=' || k === '-' || k === '_') {
      e.preventDefault();
      var f2 = (k === '-' || k === '_') ? 1 / 1.35 : 1.35, nz = clamp(S.cam.z * f2, S.z0, zHi());
      flyTo({ x: S.cam.x, y: S.cam.y, z: nz }, 300, settle);
      if (S.mode === 'focus') leaveFocusForFree();
    }
  }

  /* ── live: penjualan baru saat panggung terbuka ──────────────────── */
  HX.on('sales', function (arr) {
    if (!S || !arr || !arr.length) return;
    arr.forEach(function (s) {
      if (!s || !s.sim) return;
      var k = starKey(s.sp, s.team), v = +s.revenue || 0;
      sim[k] = (sim[k] || 0) + v; simDay[k] = (simDay[k] || 0) + v; simTot += v;
    });
    refresh();
    var hit = [], sum = 0;
    arr.forEach(function (s) {
      sum += +s.revenue || 0;
      var st = S.stars[starKey(s.sp, s.team)];
      if (st && !st.gone && hit.indexOf(st) < 0) hit.push(st);
    });
    var t = now();
    hit.slice(0, 12).forEach(function (st, i) {
      var c = S.clusters[st.cl];
      if (S.rm) return;
      var at = t + i * 150;
      if (t - st.born < 600) at = Math.max(at, st.born + 300);
      S.flares.push({ s: st, t0: at });
      setTimeout(function () { if (S && S.stars[st.key] === st) { st.flash = 1; st.rv += 18; } }, at - t);
      if (c && c.el) { c.el.classList.remove('is-pulse'); void c.el.offsetWidth; c.el.classList.add('is-pulse'); }
    });
    if (S.sel && hit.indexOf(S.sel) >= 0) paintCard(S.sel);
    S.lastAct = now();
    var one = arr.length === 1 ? arr[0] : null;
    if (one) {
      toast('<i class="hxs-live"></i><b>' + esc(one.sp) + '</b><span>baru saja closing</span><em>+' + esc(mS(+one.revenue || 0)) + '</em>', hit[0] || null);
    } else {
      toast('<i class="hxs-live"></i><b>' + arr.length + ' closing baru</b><em>+' + esc(mS(sum)) + '</em>', null);
    }
    kick();
  });
  function refresh() {
    if (!S) return;
    var fresh = applyModel(readModel(), false);
    if (S.needRing) { S.needRing = false; relayout(true); }
    else if (fresh.length) { ensureTeamLabels(); placeAll(); }
    fresh.forEach(function (s) { s.born = now(); });
    if (S.sel) {
      if (S.sel.gone) selectStar(null, true); else paintCard(S.sel);
    }
    var wasEmpty = S.empty;
    S.empty = !S.order.some(function (s) { return !s.gone; });
    if (wasEmpty && !S.empty) { S.root.classList.remove('is-empty'); S.core.querySelector('.hxs-core-l').textContent = 'Omset ' + S.model.mon; S.coreS.textContent = ''; paintTeamText(true); }
    modeUI();
    S.labsDirty = true;
    kick();
  }
  var rT = 0;
  HX.on('render', function () {
    if (S) { clearTimeout(rT); rT = setTimeout(refresh, 260); }
    ensureEntry();
  });
  // Kurangi Gerak dinyalakan saat panggung terbuka: semua gerak langsung selesai
  HX.on('prefs', syncPrefs);
  function syncPrefs() {
    if (!S) return;
    S.rm = reduced();
    if (S.rm) {
      if (S.anim) { setCam(S.anim.end); var f = S.anim.done; S.anim = null; if (f) f(); }
      S.fling = null; S.flares.length = 0; stopTour();
      S.introDone = true;
      S.order.forEach(function (s) { s.born = 0; s.rd = s.r; s.rv = 0; s.flash = 0; });
      S.corder.forEach(function (c) { c.lineT0 = 0; if (c.tw) { c.shown = c.tw.to; c.tw = null; c.txtDirty = true; } });
      [S.coreNum, S.dayNum].forEach(function (o) { if (o.tw) { o.shown = o.tw.to; o.tw = null; o.txtDirty = true; } });
      S.labsDirty = true;
    }
    lastFrame = 0;
    redraw();
  }

  /* ── pintu masuk di halaman Salespeople ──────────────────────────── */
  function spPageOn() { var p = D.getElementById('page-salespeople'); return !!(p && p.classList.contains('active')); }
  function ensureEntry() {
    var sl = D.querySelector('#page-salespeople .sl');
    if (!sl) return;
    if (!entryBtn || entryBtn.parentNode !== sl) {
      if (!entryBtn) {
        entryBtn = D.createElement('button');
        entryBtn.type = 'button';
        entryBtn.className = 'hxs-entry';
        entryBtn.setAttribute('aria-label', 'Buka peta bintang');
        entryBtn.innerHTML = '<span class="hxs-entry-ic">' + svg(ICON) + '</span>' +
          '<span class="hxs-entry-tx"><span class="hxs-entry-t">Peta bintang</span><span class="hxs-entry-s"></span></span>' +
          svg(CHEV_R, 'hxs-entry-chev');
        entryBtn.addEventListener('click', function (e) { e.stopPropagation(); vibrate(6); open({ origin: entryBtn }); });
      }
      sl.classList.add('hxs-host');
      sl.appendChild(entryBtn);
      entrySubAt = 0;
    }
    if (!spPageOn()) return;
    var t = now();
    if (t - entrySubAt < 2000) { if (!entryTimer) entryTimer = setTimeout(function () { entryTimer = 0; ensureEntry(); }, 2100); return; }
    entrySubAt = t;
    try {
      var m = readModel(), cl = {};
      m.list.forEach(function (s) { cl[s.cl] = 1; });
      var n = m.list.length;
      entryBtn.querySelector('.hxs-entry-s').textContent = n ? n + ' bintang · ' + Object.keys(cl).length + ' rasi · ' + m.mon : 'Langit tim bulan ini';
    } catch (e) { }
  }
  HX.on('page', function (p) { if (p && p.id === 'page-salespeople') { entrySubAt = 0; ensureEntry(); } });
  HX.on('ready', ensureEntry);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', ensureEntry); else ensureEntry();

  // untuk tes / modul lain (hanya baca)
  HX.stars = {
    open: function (o) { open(o); },
    close: function () { close('api'); },
    isOpen: function () { return !!S; },
    _state: function () {
      if (!S) return null;
      return {
        mode: S.mode, focus: S.focus, sel: S.sel ? S.sel.key : null, cam: { x: S.cam.x, y: S.cam.y, z: S.cam.z }, z0: S.z0, home: S.home,
        vw: S.vw, vh: S.vh, depth: H.depth, intro: S.introDone, n: S.order.length, perf: S.perf, raf: !!raf, dpr: S.dpr, amb: S.amb, idle: !!S.idle, clock: S.clock,
        busy: { anim: !!S.anim, fling: !!S.fling, G: !!S.G, flares: S.flares.length, tour: !!(S.tour && S.tour.on), core: !!S.coreNum.tw, day: !!S.dayNum.tw,
          stars: S.order.filter(function (s) { var t = now(); return Math.abs(s.rd - s.r) > 0.01 || Math.abs(s.rv) > 0.01 || s.flash > 0.01 || (s.gone && t - s.gone < 700) || t - s.born < 700; }).length,
          cl: S.corder.filter(function (c) { return c.tw || Math.abs(c.dim - c.dimT) > 0.01; }).length },
        stars: S.order.map(function (s) { return { key: s.key, cl: s.cl, left: !!s.left, ch: !!s.ch, sx: s.x * S.cam.z + S.vw / 2 - S.cam.x * S.cam.z, sy: s.y * S.cam.z + S.vh / 2 - S.cam.y * S.cam.z, r: s.r, rd: s.rd, rs: s.rs, mtd: s.mtd, today: s.today, rank: s.rank }; }),
        clusters: S.corder.map(function (c) { return { id: c.id, n: c.n, nLeft: c.nLeft || 0, mtd: c.mtd, chRev: c.chRev || 0, leadRev: c.leadRev || 0, cx: c.cx * S.cam.z + S.vw / 2 - S.cam.x * S.cam.z, cy: c.cy * S.cam.z + S.vh / 2 - S.cam.y * S.cam.z, side: c.side, lvl: c.lvl }; })
      };
    }
  };
})();
