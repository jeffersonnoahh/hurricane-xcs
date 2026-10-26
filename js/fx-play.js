/* ══════════════════════════════════════════════════════════════════════
   FX PLAY — tiga mainan sentuh. HANYA MEMBACA data (allData, vOff) dan
   memanggil prevDay()/nextDay() — fungsi yang sama dengan tombol ‹ › di
   header. Tidak pernah menulis ke Firebase, tidak memanggil fungsi simpan.

   1. TAHAN UNTUK MEMBELAH OMSET  (#liveOmsetBig, halaman Dashboard)
      Tekan & tahan 500 ms (jari bergeser < 8 px; sama dengan tekan-lama
      bawaan HP, jadi jari yang sekadar berhenti sebelum menggulir tidak
      membukanya). Garis hijau tipis "mengisi" di bawah angka selama ditahan;
      lalu halaman di sekitarnya meredup, angka terangkat ke panel kaca
      padat di atas kartu hero dan MEMBELAH: satu batang per tim untuk
      bulan yang ditampilkan hero, terbesar dulu. Angka tim = omzet tim dari
      hitungan bulanan BERSAMA HX.monthAgg (seluruh bulan, channel ikut
      tim, sales digabung per nama — sama dengan Wrapped, kartu, peta
      bintang). Jumlahnya PERSIS angka hero (monthAgg.total = monthRev),
      dan diperiksa ulang terhadap monthRev(od(vOff)).
      Sambil tetap menahan, geser jari ke baris tim → lensa pilih + detail
      tim (closing, sales teratas + peringkat bulanannya "#5 dari 29",
      porsi channel) di baris atas. Lepas → batang mengalir
      kembali ke angka. Android: satu getar pendek saat terbuka. Jentik
      cepat ke ATAS sesaat setelah panel terbuka = mau menggulir: panel
      menutup dan guliran diserahkan ke browser.
   2. GESER ANTAR HARI  (Dashboard, jari/pena)
      Kanan = hari sebelumnya (prevDay), kiri = hari berikutnya (nextDay;
      di hari ini memantul tanpa berubah). Isi halaman mengikuti jari;
      chip kaca di tepi menunjukkan hari tujuan + omsetnya dan cincinnya
      terisi menuju ambang. > 28% lebar layar atau jentikan cepat = pindah:
      isi meluncur keluar, app menggambar hari baru, isi meluncur masuk dari
      sisi lain (angka bergulir lewat motion.js). Bukan di grafik hero (milik
      scrub grafik), bukan di elemen yang bisa digeser mendatar (riwayat 30
      hari, tabel), bukan di laci/modal, bukan 24 px dari tepi layar (geser-
      kembali iOS). Pindah hari lewat tombol ‹ ›, kotak riwayat, kalender
      atau panah keyboard ← → juga meluncur masuk dari arah yang benar.
   3. KARTU KACA MIRING  (.kpi-card .goal-card .spc .ins-kpi-card .omset-hero)
      Tekan-tahan atau tekan-geser → kartu miring ke arah jari dalam 3D
      (maks ±5°, transform saja) dengan kilau cahaya yang mengikuti jari;
      lepas → memantul balik. Geser tegak > 10 px = menggulir (batal).
      Ketukan biasa tetap membuka kartu. Desktop: miring halus saat disorot
      mouse — cahaya kursor motion.js (--mx/--my di background) tetap jalan.

   Satu gestur pada satu waktu: kelas 'hx-gesture' di <html> (protokol modul
   fx). Prioritas zona: grafik (scrub) > tahan-membelah > geser > miring.
   Kurangi Gerak: tidak ada yang bergerak — panel/chip hanya memudar, ganti
   hari = pudar silang, kartu tidak miring.

   Uji (hanya membaca): HX.play.state() · HX.play.model() ·
   HX.play.openSplit() / closeSplit() · HX.play.go(-1|1)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__hxPlay) return;
  window.__hxPlay = true;

  var D = document, R = D.documentElement, W = window;

  /* ── batas & ambang ─────────────────────────────────────────────────── */
  var HOLD_MS = 500;        // tahan sebelum membelah (= tekan-lama bawaan HP)
  var ESC_MS = 800;         // sesaat setelah panel terbuka, jentikan ke atas…
  var ESC_V = 0.45;         // …lebih cepat dari ini (px/ms)…
  var ESC_DY = 24;          // …sejauh ini = menggulir, bukan memeriksa baris
  var HOLD_SLOP = 8;        // jari boleh bergeser < 8 px selama menahan
  var EDGE = 24;            // tepi layar = geser-kembali iOS, bukan milik kita
  var SWIPE_GO = 10;        // mulai geser mendatar setelah 10 px
  var COMMIT = 0.28;        // > 28% lebar layar = pindah hari
  var FLICK = 0.45;         // px/ms — jentikan cepat juga pindah
  var SCROLL_Y = 10;        // gerak tegak > 10 px = menggulir
  var TILT_MS = 140;        // tekan diam sebentar → kartu miring
  var LONG_TAP = 450;       // tekan lebih lama dari ini bukan "ketukan"

  var TILT_SEL = '.kpi-card,.goal-card,.spc,.ins-kpi-card,.omset-hero';
  // tidak ada mainan yang mulai di sini
  var NO_START = 'input,select,textarea,[contenteditable],.mo,.cal-overlay,.premium-entry-drawer,' +
    '.premium-form-overlay,.premium-more-overlay,.premium-more-sheet,.hx-sp-actions,.ref-chart,[data-hx-nogesture]';

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  /* ── alat kecil ─────────────────────────────────────────────────────── */
  function hx() { return W.HX || {}; }
  function $(id) { return D.getElementById(id); }
  function now() { return W.performance && performance.now ? performance.now() : Date.now(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var mqRM = W.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { var h = hx(); if (h.reduced) return h.reduced(); return !!(mqRM && mqRM.matches); }
  var mqHover = W.matchMedia ? matchMedia('(hover: hover) and (pointer: fine)') : null;
  function busy() { var h = hx(); try { return !!(h.busy && h.busy()); } catch (e) { return false; } }
  function taken() { return R.classList.contains('hx-gesture'); }
  var mine = false;
  function claim() { if (!mine) { mine = true; R.classList.add('hx-gesture'); } }
  function unclaim() { if (mine) { mine = false; R.classList.remove('hx-gesture'); } }
  function anim(el, kf, o) {
    if (!el || !el.animate) return null;
    try { return el.animate(kf, o); } catch (e) { return null; }
  }
  // getar: hanya Android (iPhone tidak punya navigator.vibrate — diam, visual saja)
  function buzz(p) {
    try {
      var ua = navigator.userActivation;
      if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(p);
    } catch (e) { }
  }

  /* ── baca app.js (variabel global, hanya dibaca) ────────────────────── */
  function off() { try { return vOff; } catch (e) { return 0; } }
  function dayAt(o) { try { return od(o); } catch (e) { var d = new Date(); d.setDate(d.getDate() + o); return d; } }
  function keyOf(d) {
    try { return dk(d); } catch (e) { }
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  function ready() { try { return Object.keys(data()).length > 0; } catch (e) { return false; } }
  function money(n) { var h = hx(); if (h.money) return h.money(n); return String(Math.round(n)); }
  function moneyFull(n) { var h = hx(); if (h.moneyFull) return h.moneyFull(n); return 'Rp ' + Math.round(n).toLocaleString('id-ID'); }
  function mono(t) {
    try { if (typeof teamMono === 'function') { var m = teamMono(t); if (m) return m; } } catch (e) { }
    var w = String(t || '').trim().split(/\s+/);
    return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] || '').charAt(1))).toUpperCase();
  }
  function dashOn() { var p = $('page-dashboard'); return !!(p && p.classList.contains('active')); }
  function pct(v) {
    if (v > 0 && v < 0.05) return '<0,1%';
    return (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + '%';
  }
  // batas layar yang benar-benar terlihat: di bawah header, di atas nav bawah HP
  function chromeBox() {
    var top = 0, bot = W.innerHeight;
    var h = D.querySelector('header');
    if (h) { var hr = h.getBoundingClientRect(); if (hr.height && hr.bottom > 0) top = Math.max(top, hr.bottom); }
    var nw = D.querySelector('.nav-wrapper');
    if (nw) {
      var r = nw.getBoundingClientRect();
      if (r.height) {
        if (r.top > W.innerHeight / 2) bot = Math.min(bot, r.top);
        else if (r.bottom > top && r.top < top + 4) top = r.bottom;   // nav di atas (desktop, sticky)
      }
    }
    // tombol SALE bulat menonjol di atas nav bawah HP
    var fab = D.querySelector('.premium-add-fab');
    if (fab) { var fr = fab.getBoundingClientRect(); if (fr.height && fr.top > W.innerHeight / 2 && fr.top < bot) bot = fr.top; }
    return { top: top, bottom: bot };
  }
  // kotak TEKS (bukan kotak blok selebar kartu)
  function textBox(el) {
    try {
      var rg = D.createRange();
      rg.selectNodeContents(el);
      var rs = rg.getClientRects(), b = rg.getBoundingClientRect();
      if (b.width > 0) return { left: b.left, top: b.top, width: b.width, height: b.height, bottom: b.bottom, lines: rs.length };
    } catch (e) { }
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom, lines: 1 };
  }
  // elemen yang bisa digeser mendatar (riwayat 30 hari, tabel, strip status)
  function hScroll(t, stop) {
    var n = t;
    while (n && n !== stop && n.nodeType === 1) {
      if (n.scrollWidth > n.clientWidth + 1) {
        var ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
      n = n.parentElement;
    }
    return false;
  }

  /* ══ SESI POINTER — satu jari, satu pemilik ═══════════════════════════
     P.mode: null (belum diputuskan) | 'hold' | 'swipe' | 'tilt'          */
  var P = null;
  var supUntil = 0;    // telan klik yang menyusul gestur (geser / tahan)

  function onDown(e) {
    supUntil = 0;
    if (!e.isPrimary) { if (P) finish('cancel'); return; }       // jari kedua: cubit-zoom menang
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (P) finish('cancel');
    if (taken() || R.classList.contains('hx-overlay-open')) return;
    var t = e.target;
    if (!t || t.nodeType !== 1 || !t.closest || t.closest(NO_START)) return;
    if (busy()) return;
    var touch = e.pointerType !== 'mouse';
    var s = {
      id: e.pointerId, touch: touch, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      t0: now(), mode: null, smp: [[now(), e.clientX, e.clientY]], hold: false, swipe: false, card: null, cap: null, adj: 0, maxd: 0
    };
    var dash = dashOn(), num = $('liveOmsetBig');
    var onNum = !!(num && num.contains(t));
    if (dash && onNum && ready()) s.hold = true;
    var cont = $('dashboardContainer');
    if (dash && touch && !zoomed() && cont && cont.contains(t) && e.clientX > EDGE && e.clientX < W.innerWidth - EDGE && !hScroll(t, cont)) s.swipe = true;
    if (touch && !reduced()) {
      var c = t.closest(TILT_SEL);
      if (c && !onNum) s.card = c;
    }
    if (!s.hold && !s.swipe && !s.card) return;
    P = s;
    if (T && T.kind === 'hover') tiltRelease();       // tekan mouse = kaca kembali datar
    if (s.card) s.card.classList.add('hxp-nosel');
    if (s.hold) {
      s.tHold = setTimeout(holdOpen, HOLD_MS);
      s.tCharge = setTimeout(chargeStart, 80);
    }
    if (s.card) s.tTilt = setTimeout(function () { if (P === s && !s.mode) tiltEngage(); }, TILT_MS);
  }

  function onMove(e) {
    var s = P;
    if (!s || e.pointerId !== s.id) { if (e.pointerType === 'mouse') hoverMove(e); return; }
    s.x = e.clientX; s.y = e.clientY;
    s.smp.push([now(), s.x, s.y]);
    if (s.smp.length > 10) s.smp.shift();
    var dx = s.x - s.x0, dy = s.y - s.y0, ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax > s.maxd) s.maxd = ax;
    if (ay > s.maxd) s.maxd = ay;
    if (!s.mode) {
      if (s.hold && (ax > HOLD_SLOP || ay > HOLD_SLOP)) holdDrop(s);
      if (s.swipe && ax > SWIPE_GO && ax > ay * 1.3) { swipeEngage(dx, false); return; }
      if (ay > SCROLL_Y && ay >= ax) { abandon(); return; }                 // tegak = menggulir
      if (s.card && !s.swipe && ax > 10) tiltEngage();                       // tekan-geser kartu
      if (!s.hold && !s.swipe && !s.card) abandon();
      return;
    }
    if (s.mode === 'hold') {
      if (holdEscape(s)) { finish('scroll'); return; }   // P lepas → touchmove tidak dicegah → browser menggulir
      splitInspect(s.x, s.y);
      if (S && S.hot >= 0) s.everHot = true;
      return;
    }
    if (s.mode === 'swipe') { swipeFrame(); return; }
    if (s.mode === 'tilt') {
      if (ay > SCROLL_Y && ay > ax) { finish('cancel'); return; }
      if (s.swipe && ax > 64 && ax > ay * 1.3) { tiltRelease(); s.mode = null; swipeEngage(dx, true); return; }
      tiltAim(s.x, s.y);
    }
  }
  function onUp(e) { if (P && e.pointerId === P.id) finish('up'); }
  function onCancel(e) { if (P && e.pointerId === P.id) finish('cancel'); }

  function clearTimers(s) { clearTimeout(s.tHold); clearTimeout(s.tCharge); clearTimeout(s.tTilt); s.tHold = s.tCharge = s.tTilt = 0; }
  function abandon() {
    var s = P; if (!s) return;
    P = null;
    clearTimers(s);
    chargeEnd();
    if (s.card) s.card.classList.remove('hxp-nosel');
  }
  function finish(why) {
    var s = P; if (!s) return;
    P = null;
    clearTimers(s);
    chargeEnd();
    if (s.card) s.card.classList.remove('hxp-nosel');
    var dur = now() - s.t0, mode = s.mode;
    if (mode === 'hold') { splitClose(); supUntil = now() + 500; }
    else if (mode === 'swipe') { swipeRelease(s, why === 'up'); supUntil = now() + 500; }
    else if (mode === 'tilt') {
      tiltRelease();
      if (why === 'up' && (dur > LONG_TAP || s.maxd > 10)) supUntil = now() + 500;
    }
    if (s.cap) { var c = s.cap; s.cap = null; try { if (c.hasPointerCapture && c.hasPointerCapture(s.id)) c.releasePointerCapture(s.id); } catch (e) { } }
    if (mode !== 'swipe') unclaim();            // geser melepas sendiri setelah animasinya selesai
  }
  function capture(el, s) {
    try { el.setPointerCapture(s.id); s.cap = el; } catch (e) { }
  }

  /* ══ 1. OMSET TERBELAH PER TIM ════════════════════════════════════════ */
  var CH = null;      // garis isi-tahan
  var S = null;       // panel yang terbuka
  var SX = null;      // panel yang sedang menutup

  function chargeStart() {
    var s = P; if (!s || !s.hold || s.mode) return;
    var num = $('liveOmsetBig'); if (!num) return;
    var r = textBox(num);
    if (!(r.width > 0)) return;
    var el = D.createElement('div');
    el.className = 'hxp-charge';
    el.setAttribute('aria-hidden', 'true');
    el.style.left = Math.round(r.left) + 'px';
    el.style.top = Math.round(r.bottom + 5) + 'px';
    el.style.width = Math.round(r.width) + 'px';
    D.body.appendChild(el);
    CH = el;
    var left = Math.max(60, HOLD_MS - (now() - s.t0));
    if (reduced() || !el.animate) { el.style.opacity = '.9'; el.style.transform = 'none'; return; }
    anim(el, [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(.3)', opacity: 1, offset: 0.25 }, { transform: 'scaleX(1)', opacity: 1 }],
      { duration: left, easing: 'linear', fill: 'forwards' });
  }
  function chargeEnd() {
    var el = CH; if (!el) return;
    CH = null;
    var a = anim(el, [{ opacity: parseFloat(getComputedStyle(el).opacity) || 0 }, { opacity: 0 }], { duration: 150, easing: 'ease-out', fill: 'forwards' });
    var kill = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    if (a) { a.onfinish = kill; setTimeout(kill, 400); } else kill();
  }

  function holdDrop(s) {
    s.hold = false;
    clearTimeout(s.tHold); clearTimeout(s.tCharge); s.tHold = s.tCharge = 0;
    chargeEnd();
  }
  function holdOpen() {
    var s = P;
    if (!s || s.mode || !s.hold) return;
    if (taken() || !dashOn() || busy()) { holdDrop(s); return; }
    var M = model();
    if (!M || !M.rows.length) { holdDrop(s); return; }
    s.mode = 'hold';
    s.swipe = false;
    s.openAt = now(); s.ox = s.x; s.oy = s.y;
    clearTimeout(s.tTilt);
    claim();
    capture($('liveOmsetBig'), s);
    splitOpen(M);
    chargeEnd();
    buzz(10);
  }

  // Jari berhenti sebentar di angka lalu menggulir: panel sudah terbuka, tapi
  // jentikan cepat ke ATAS (menjauh dari baris tim, yang ada di bawah angka)
  // sesaat setelahnya (atau kapan saja selama belum ada baris yang disentuh)
  // = niat menggulir. Tutup panel & serahkan ke browser. Memeriksa baris =
  // gerak pelan; ke bawah tidak pernah dianggap menggulir.
  function holdEscape(s) {
    if (!s.touch || !s.openAt || (s.everHot && now() - s.openAt > ESC_MS)) return false;
    var dy = s.y - s.oy, dx = s.x - s.ox;
    if (dy > -ESC_DY || -dy < Math.abs(dx) * 1.5) return false;
    return velY(s) < -ESC_V;
  }
  function velY(s) {
    var a = s.smp, n = a.length;
    if (n < 3) return 0;
    var t1 = a[n - 1][0], i = n - 2;
    while (i > 0 && t1 - a[i - 1][0] <= 100) i--;
    var dt = t1 - a[i][0];
    if (dt < 30 || dt > 160) return 0;
    return (a[n - 1][2] - a[i][2]) / dt;
  }

  // Omset bulan yang ditampilkan hero, per tim — dari hitungan bulanan
  // BERSAMA (HX.monthAgg, fx-core.js), jadi angka tim, closing, sales
  // teratas & peringkatnya sama persis dengan Wrapped / kartu / peta bintang.
  // Hero = SELURUH bulan (monthRev(od(vOff))), jadi monthAgg tanpa batas
  // tanggal. Omzet tim TERMASUK channel (Tokopedia, Shopee, …) dan team lead;
  // "teratas" hanya sales yang diperingkat (bukan channel, bukan lead).
  function model() {
    var vd = dayAt(off()), y = vd.getFullYear(), m0 = vd.getMonth(), mo = m0 + 1;
    var h = hx(), A = null;
    try { if (h.monthAgg) A = h.monthAgg(y, m0); } catch (e) { A = null; }
    if (!A) return { y: y, m: mo, total: 0, rows: [], key: y + '-' + mo, nSellers: 0 };
    var total = A.total, list = [];
    A.teams.forEach(function (t) {
      var top = null;
      for (var i = 0; i < t.members.length; i++) if (t.members[i].rank) { top = t.members[i]; break; }   // urut omzet; lead tanpa peringkat
      list.push({
        team: String(t.team == null ? '' : t.team).trim() || 'Tanpa tim',
        rev: t.revenue, units: t.closes, chan: t.revenueChannels,
        top: top ? top.sp : '', topRev: top ? top.revenue : 0, topRank: top ? top.rank : 0
      });
    });
    // pengaman: bandingkan dengan fungsi asli hero. Data aneh (mis. revenue
    // berupa teks) → selisihnya jadi baris sendiri, jumlah tetap = hero.
    try {
      if (typeof monthRev === 'function') {
        var hv = monthRev(vd);
        if (typeof hv === 'number' && isFinite(hv) && Math.abs(hv - total) >= 1) {
          list.push({ team: 'Penyesuaian', rev: hv - total, units: 0, chan: 0, top: '', topRev: 0, topRank: 0, adj: true });
          total = hv;
        }
      }
    } catch (e) { }
    list = list.filter(function (g) { return g.rev !== 0; });
    list.sort(function (a, b) { return b.rev - a.rev; });
    list.forEach(function (g, i) {
      g.share = total > 0 ? Math.max(0, g.rev) / total : 0;
      g.rank = i;
    });
    return { y: y, m: mo, total: total, rows: list, key: y + '-' + mo, nSellers: A.nSellers };
  }
  // terlalu banyak baris untuk layar: dua terkecil digabung jadi "Tim lain"
  function mergeTail(rows) {
    var a = rows[rows.length - 2], b = rows[rows.length - 1];
    var rest = a.rest ? a : { team: 'Tim lain', rest: true, rev: 0, units: 0, chan: 0, members: [], share: 0, top: '', topRev: -Infinity, topRank: 0 };
    var out = rows.slice(0, rows.length - 2);
    [a, b].forEach(function (g) {
      if (g === rest) return;
      rest.rev += g.rev; rest.units += g.units; rest.chan += g.chan || 0; rest.share += g.share;
      rest.members.push(g.team);
      if (g.top && g.topRev > rest.topRev) { rest.topRev = g.topRev; rest.top = g.top; rest.topRank = g.topRank; }
    });
    out.push(rest);
    return out;
  }

  function splitOpen(M) {
    splitKill();
    var hero = $('homeOmsetHero'), num = $('liveOmsetBig');
    if (!hero || !num) return;
    var hr = hero.getBoundingClientRect(), nb = textBox(num);
    var cb = chromeBox(), room = cb.bottom - cb.top - 20;
    // layar pendek (HP mendatar) = ukuran ringkas, walau lebar seperti desktop
    var tight = room < 360, desk = W.innerWidth >= 769 && !tight;
    var pad = desk ? 26 : (hr.width < 300 || tight ? 14 : 18);
    var kickH = 14, totFs = desk ? 34 : (hr.width < 300 || tight ? 22 : 26), totH = Math.round(totFs * 1.12);
    var gA = desk ? 8 : (tight ? 4 : 6), gStack = desk ? 18 : (tight ? 10 : 14), stackH = 6, gRows = desk ? 18 : (tight ? 8 : 14);
    var fixedH = pad + kickH + gA + totH + gStack + stackH + gRows + pad - 6;
    var rowH = desk ? 44 : 38, minRow = tight ? 28 : 30, l1h = desk ? 26 : 22, comfy = desk ? 36 : 32;
    var rows = M.rows.slice(), n = rows.length;
    // 1) muat mulai dari atas kartu hero (baris boleh dirapatkan sampai 'comfy')
    var topH = Math.max(hr.top, cb.top + 10), fromHero = cb.bottom - 10 - topH;
    var fit = Math.floor((fromHero - fixedH) / n);
    if (fit >= comfy) rowH = Math.min(rowH, fit);
    else {
      // 2) tidak muat: panel boleh naik (sampai di bawah header), baris dirapatkan
      rowH = Math.max(minRow, Math.min(comfy + 2, Math.floor((room - fixedH) / n)));
      // 3) masih tidak muat: tim terkecil digabung jadi "Tim lain"
      while (rows.length > 2 && fixedH + rows.length * rowH > room) rows = mergeTail(rows);
    }
    var needH = fixedH + rows.length * rowH;
    var H = needH, top = hr.top;
    // muat di kartu hero yang terlihat utuh → tutup kartu itu persis
    if (needH <= hr.height && hr.top >= cb.top + 4 && hr.bottom <= cb.bottom - 4) H = hr.height;
    if (top < cb.top + 10) top = cb.top + 10;
    if (top + H > cb.bottom - 10) top = Math.max(cb.top + 10, cb.bottom - 10 - H);
    var left = hr.left, wid = hr.width, inner = wid - pad * 2;

    var cs = getComputedStyle(num), heroFs = parseFloat(cs.fontSize) || 36, heroLs = parseFloat(cs.letterSpacing) || 0;
    var rad = getComputedStyle(hero).borderTopLeftRadius || '28px';

    var el = D.createElement('div');
    el.className = 'hxp-split' + (desk ? ' is-desk' : '');
    el.setAttribute('aria-hidden', 'true');
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    el.style.width = Math.round(wid) + 'px';
    el.style.height = Math.round(H) + 'px';
    el.style.borderRadius = rad;

    var monthTxt = BULAN[M.m - 1] + ' ' + M.y;
    var stackTop = pad + kickH + gA + totH + gStack, rowsTop = stackTop + stackH + gRows;
    var html = '<div class="hxp-head" style="top:' + pad + 'px;left:' + pad + 'px;right:' + pad + 'px">' +
      '<div class="hxp-kick"><span class="hxp-kick-a">' + esc(monthTxt) + ' · ' + M.rows.length + ' tim</span>' +
      '<span class="hxp-kick-h">geser untuk detail</span><span class="hxp-kick-b"></span></div></div>' +
      '<div class="hxp-totw" style="left:' + pad + 'px;top:' + (pad + kickH + gA) + 'px;height:' + totH + 'px;line-height:' + totH + 'px">' +
      '<span class="hxp-total" style="font-size:' + totFs + 'px;letter-spacing:' + (heroLs * totFs / heroFs).toFixed(2) + 'px">' + esc(moneyFull(M.total)) + '</span></div>' +
      '<div class="hxp-body"><div class="hxp-stack" style="left:' + pad + 'px;width:' + inner + 'px;top:' + stackTop + 'px">';
    var cum = 0;
    rows.forEach(function (g, i) {
      var w = Math.max(0, g.share * inner);
      html += '<i class="hxp-seg' + (i === 0 && !g.rest ? ' is-top' : '') + '" style="left:' + (cum * inner).toFixed(1) + 'px;width:' + Math.max(1, w - (i < rows.length - 1 ? 2 : 0)).toFixed(1) + 'px;opacity:' + (i === 0 ? 1 : Math.max(.42, 1 - i * .09)).toFixed(2) + '"></i>';
      cum += g.share;
    });
    html += '</div><div class="hxp-rows" style="left:' + pad + 'px;width:' + inner + 'px;top:' + rowsTop + 'px">' +
      '<div class="hxp-lens" style="height:' + rowH + 'px"></div>';
    rows.forEach(function (g, i) {
      var cls = 'hxp-row' + (i === 0 && !g.rest ? ' is-top' : '') + (g.rev < 0 ? ' is-neg' : '') + (g.rest ? ' is-rest' : '');
      var chip = g.rest ? '+' + g.members.length : g.adj ? '±' : mono(g.team);
      var amt = (g.rev < 0 ? '-' : '') + money(Math.abs(g.rev));
      var l1top = Math.max(0, Math.round((rowH - l1h - 9) / 2));
      html += '<div class="' + cls + '" style="height:' + rowH + 'px">' +
        '<div class="hxp-l1" style="padding-top:' + l1top + 'px;height:' + l1h + 'px"><span class="hxp-chip">' + esc(chip) + '</span>' +
        '<span class="hxp-name">' + esc(g.team) + '</span><span class="hxp-amt">' + esc(amt) + '</span>' +
        '<span class="hxp-pct">' + pct(g.share * 100) + '</span></div>' +
        '<span class="hxp-track" style="top:' + (l1top + l1h + 4) + 'px"><i class="hxp-fill" style="width:' + (g.share * 100).toFixed(3) + '%"></i></span></div>';
    });
    html += '</div></div>';
    el.innerHTML = html;
    // tirai: halaman di antara header & nav bawah meredup (padat, tanpa blur),
    // jadi tepi teks halaman di sudut panel / kartu target di bawahnya tidak
    // "mengintip" — panel benar-benar terangkat di atas halaman
    var scrim = D.createElement('div');
    scrim.className = 'hxp-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    scrim.style.top = Math.max(0, Math.round(cb.top)) + 'px';
    D.body.appendChild(scrim);
    D.body.appendChild(el);
    // layar sempit (SE 320 px): petunjuk dipendekkan dulu, lalu disembunyikan,
    // supaya "OKTOBER 2026 · 9 TIM" tidak terpotong
    var ka = el.querySelector('.hxp-kick-a'), kh = el.querySelector('.hxp-kick-h');
    if (ka && kh && ka.scrollWidth > ka.clientWidth + 1) {
      kh.textContent = 'geser';
      ka.style.right = (kh.offsetWidth + 12) + 'px';
      if (ka.scrollWidth > ka.clientWidth + 1) { kh.style.display = 'none'; ka.style.right = '0px'; }
    }

    var st = {
      el: el, scrim: scrim, M: M, rows: rows, rowH: rowH, pad: pad, inner: inner, left: left, wid: wid, top: top,
      rowsTop: top + rowsTop, hot: -1, flip: null, anims: [],
      kickB: el.querySelector('.hxp-kick-b'), lens: el.querySelector('.hxp-lens'),
      total: el.querySelector('.hxp-total'), body: el.querySelector('.hxp-body')
    };
    S = st;
    if (!anim(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: reduced() ? 160 : 220, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })) scrim.style.opacity = '1';
    if (reduced() || !el.animate) {
      anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      return;
    }

    // angka terangkat: salinan total mulai TEPAT di atas angka hero (ukuran
    // & posisi sama), lalu mengecil ke kepala panel
    var tb = textBox(st.total);
    var fromT = null;
    if (nb.lines <= 1 && tb.width > 0 && nb.width > 0) {
      var sc = nb.width / tb.width;
      var fdx = nb.left - tb.left, fdy = (nb.top + nb.height / 2) - (tb.top + tb.height / 2);
      fromT = 'translate3d(' + fdx.toFixed(1) + 'px,' + fdy.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
      st.fromT = fromT;
      st.flip = anim(st.total, [{ transform: fromT }, { transform: 'translate3d(0,0,0) scale(1)' }],
        { duration: 540, delay: 90, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    }
    // panel menjadi padat DULU (salinan total diam tepat di atas angka hero),
    // baru angkanya terangkat — tidak ada dua angka yang terlihat bersamaan
    anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 110, easing: 'cubic-bezier(.2,.7,.3,1)' });
    anim(el.querySelector('.hxp-head'), [{ opacity: 0, transform: 'translate3d(0,-4px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
      { duration: 280, delay: 170, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    // angka "dituang" ke satu batang, lalu batang itu retak per tim. Batang
    // baru muncul SETELAH salinan angka melewatinya (angka naik dari bawah
    // garis batang) — tidak ada bingkai di mana batang mencoret angka.
    var stack = el.querySelector('.hxp-stack');
    anim(stack, [{ transform: 'scaleX(0)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }],
      { duration: 240, delay: fromT ? 290 : 90, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    // tiap potongan jatuh dari batang ke barisnya (pegas, berurutan)
    var segs = el.querySelectorAll('.hxp-seg'), rowEls = el.querySelectorAll('.hxp-row');
    var stackMid = stackTop + stackH / 2, cumx = 0;
    var gap = rows.length > 7 ? 32 : 40;
    for (var i = 0; i < rowEls.length; i++) {
      var g = rows[i], row = rowEls[i];
      var fill = row.querySelector('.hxp-fill'), track = row.querySelector('.hxp-track'), l1 = row.querySelector('.hxp-l1');
      var trackMid = rowsTop + i * rowH + (parseFloat(track.style.top) || 0) + 1.5;
      var px = cumx * inner, py = stackMid - trackMid;
      cumx += g.share;
      var dl = (fromT ? 330 : 300) + i * gap;
      var T0 = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)';
      anim(fill, [{ transform: T0, opacity: 0 }, { transform: T0, opacity: 1, offset: 0.02 }, { transform: 'translate3d(0,0,0)', opacity: 1 }],
        { duration: 540, delay: dl, easing: 'cubic-bezier(.3,1.32,.5,1)', fill: 'backwards' });
      if (segs[i]) anim(segs[i], [{ opacity: parseFloat(segs[i].style.opacity) || 1 }, { opacity: .4 }], { duration: 260, delay: dl, easing: 'ease-out', fill: 'forwards' });
      anim(track, [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: dl + 60, easing: 'ease-out', fill: 'backwards' });
      anim(l1, [{ opacity: 0, transform: 'translate3d(0,5px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
        { duration: 320, delay: dl + 150, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
    }
  }

  // sambil menahan: baris di bawah jari = lensa + detail tim di baris atas
  function splitInspect(x, y) {
    var st = S; if (!st) return;
    var i = Math.floor((y - st.rowsTop) / st.rowH);
    if (x < st.left - 24 || x > st.left + st.wid + 24 || i < 0 || i >= st.rows.length) i = -1;
    if (i === st.hot) return;
    var rows = st.el.querySelectorAll('.hxp-row');
    if (st.hot >= 0 && rows[st.hot]) rows[st.hot].classList.remove('is-hot');
    st.hot = i;
    if (i < 0) { st.el.classList.remove('has-hot'); return; }
    rows[i].classList.add('is-hot');
    st.lens.style.transform = 'translate3d(0,' + (i * st.rowH) + 'px,0)';
    st.kickB.innerHTML = detailFit(st, i);
    st.el.classList.add('has-hot');
  }
  // Baris detail tim di kepala panel, dari yang paling lengkap ke yang paling
  // ringkas. SATU tingkat untuk semua baris tim di panel ini (bentuk baris
  // tidak berganti-ganti saat jari berpindah baris): tingkat terlengkap yang
  // muat satu baris untuk SEMUA tim, diukur sekali saat baris pertama
  // disentuh. Baris yang tetap tidak muat turun sendiri. SE 320 px tidak
  // memotong nama sales di tengah. Peringkat = peringkat bulanan bersama
  // (HX.monthAgg), menempel pada nama (dalam kurung) — bukan peringkat tim.
  function detailVariants(st, i) {
    var g = st.rows[i], n = st.M.nSellers || 0, vs;
    var cl = g.units ? '<b>' + g.units + '</b> closing' : '';
    if (g.adj) vs = [['selisih data']];
    else if (g.rest) vs = [[cl, esc(g.members.join(', '))], [esc(g.members.join(', '))]];
    else {
      var who = g.top ? 'teratas ' + esc(g.top) : '';
      var rc = 'hxp-k-rk' + (g.topRank === 1 ? ' is-1' : '');
      var rk = g.top && g.topRank && n ? ' <span class="' + rc + '">(#' + g.topRank + ' dari ' + n + ')</span>' : '';
      var rk1 = g.top && g.topRank ? ' <span class="' + rc + '">(#' + g.topRank + ')</span>' : '';
      var amt = g.top ? ' ' + esc(money(g.topRev)) : '';
      var ch = g.chan > 0 ? 'channel ' + esc(money(g.chan)) : '';
      vs = [[cl, who + amt + rk, ch], [cl, who + amt + rk], [cl, who + rk], [who + rk], [who + rk1], [who || cl]];
    }
    var head = '<span class="hxp-k-team">' + esc(g.team) + '</span>';
    return {
      team: !g.adj && !g.rest,
      html: vs.map(function (v) { return head + v.filter(Boolean).map(function (b) { return ' · ' + b; }).join(''); })
    };
  }
  function fits(k, html) { k.innerHTML = html; return k.scrollWidth <= k.clientWidth + 1; }
  function detailFit(st, i) {
    var memo = st.det || (st.det = { lv: -1, html: {}, all: null }), k = st.kickB, j;
    if (memo.html[i] != null) return memo.html[i];
    var all = memo.all;
    if (!all) { all = memo.all = []; for (j = 0; j < st.rows.length; j++) all.push(detailVariants(st, j)); }
    if (memo.lv < 0) {
      var L = 0, top = 0;
      all.forEach(function (d) { if (d.team) top = Math.max(top, d.html.length - 1); });
      for (; L < top; L++) {
        var ok = true;
        for (j = 0; j < all.length && ok; j++) if (all[j].team && !fits(k, all[j].html[L])) ok = false;
        if (ok) break;
      }
      memo.lv = L;
    }
    var vs = all[i].html, out = '';
    for (j = all[i].team ? Math.min(memo.lv, vs.length - 1) : 0; j < vs.length; j++) {
      out = vs[j];
      if (fits(k, out)) break;
    }
    memo.html[i] = out;
    return out;
  }

  function splitClose() {
    var st = S; if (!st) return;
    S = null;
    SX = st;
    var el = st.el, sc = st.scrim;
    var kill = function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      if (sc && sc.parentNode) sc.parentNode.removeChild(sc);
      if (SX === st) SX = null;
    };
    // tirai terangkat bersama panel (opasitas saja)
    var rm = reduced();
    var sa = sc && anim(sc, rm ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1 }, { opacity: 1, offset: .18 }, { opacity: 0 }],
      { duration: rm ? 150 : 330, easing: 'ease-out', fill: 'forwards' });
    if (sc && !sa) sc.style.opacity = '0';
    if (reduced() || !el.animate) {
      var a0 = anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'ease-out', fill: 'forwards' });
      if (a0) { a0.onfinish = kill; setTimeout(kill, 500); } else kill();
      return;
    }
    // baris & batang mengalir kembali KE angka
    var num = $('liveOmsetBig'), nb = num ? textBox(num) : null;
    var ox = nb ? (nb.left + nb.width / 2 - st.left) : st.wid / 2;
    var oy = nb ? (nb.top + nb.height / 2 - st.top) : 0;
    st.body.style.transformOrigin = ox.toFixed(0) + 'px ' + oy.toFixed(0) + 'px';
    anim(st.body, [{ transform: 'scale(1)' }, { transform: 'scale(.3)' }], { duration: 260, easing: 'cubic-bezier(.5,0,.75,.4)', fill: 'forwards' });
    anim(st.body, [{ opacity: 1 }, { opacity: 0 }], { duration: 150, easing: 'cubic-bezier(.3,0,.6,1)', fill: 'forwards' });
    anim(el.querySelector('.hxp-head'), [{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
    // total kembali ke posisi & ukuran angka hero (lalu panel memudar, angka asli tampil di tempat yang sama)
    if (st.flip && st.fromT) {
      var ps = st.flip.playState;
      if (ps === 'running' || ps === 'pending') {
        // dilepas sebelum angka selesai terangkat: putar balik dari titik itu (tanpa lompatan)
        try { st.flip.playbackRate = -1.9; } catch (e) { }
      } else {
        anim(st.total, [{ transform: 'translate3d(0,0,0) scale(1)' }, { transform: st.fromT }],
          { duration: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      }
    }
    var a = anim(el, [{ opacity: 1 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: 330, easing: 'linear', fill: 'forwards' });
    if (a) a.onfinish = kill;
    setTimeout(kill, 700);
  }
  // tutup seketika (panel baru dibuka saat yang lama masih menutup, ganti halaman)
  function splitKill() {
    var a = SX, b = S;
    SX = null; S = null;
    [a, b].forEach(function (st) {
      if (!st) return;
      if (st.el.parentNode) st.el.parentNode.removeChild(st.el);
      if (st.scrim && st.scrim.parentNode) st.scrim.parentNode.removeChild(st.scrim);
    });
  }
  // data baru masuk saat panel terbuka: angka & batang ikut diperbarui
  function splitLive() {
    var st = S; if (!st) return;
    var M = model();
    if (M.key !== st.M.key || M.rows.length !== st.M.rows.length || M.total === st.M.total) return;
    if (st.rows.length !== M.rows.length) return;                       // ada baris gabungan: biarkan
    for (var i = 0; i < M.rows.length; i++) if (M.rows[i].team !== st.rows[i].team) return;   // urutan berubah: biarkan
    st.M = M; st.rows = M.rows;
    st.total.textContent = moneyFull(M.total);
    var rowEls = st.el.querySelectorAll('.hxp-row'), segs = st.el.querySelectorAll('.hxp-seg'), cum = 0;
    M.rows.forEach(function (g, i) {
      var r = rowEls[i]; if (!r) return;
      r.querySelector('.hxp-amt').textContent = (g.rev < 0 ? '-' : '') + money(Math.abs(g.rev));
      r.querySelector('.hxp-pct').textContent = pct(g.share * 100);
      r.querySelector('.hxp-fill').style.width = (g.share * 100).toFixed(3) + '%';
      if (segs[i]) {
        segs[i].style.left = (cum * st.inner).toFixed(1) + 'px';
        segs[i].style.width = Math.max(1, g.share * st.inner - (i < M.rows.length - 1 ? 2 : 0)).toFixed(1) + 'px';
      }
      cum += g.share;
    });
    st.det = null;                                                       // detail tim dihitung ulang
    if (st.hot >= 0 && st.rows[st.hot]) st.kickB.innerHTML = detailFit(st, st.hot);
  }

  // iPhone/Android: setelah panel terbuka, geser jari tidak boleh menggulir halaman.
  // Listener non-pasif HANYA di angka hero (area kecil) — gulir di tempat lain tetap pasif.
  function bindNumber() {
    var num = $('liveOmsetBig');
    if (!num || num.__hxp) return;
    num.__hxp = true;
    num.addEventListener('touchmove', function (e) {
      if (P && P.mode === 'hold' && e.cancelable) e.preventDefault();
    }, { passive: false });
  }

  /* ══ 2. GESER ANTAR HARI ══════════════════════════════════════════════ */
  var SW = null;        // geser yang sedang berjalan (termasuk animasi lepas)
  var swRaf = 0;
  var selfNav = false;  // ganti hari oleh geseran ini — jangan dianimasikan dua kali
  var lastOff = null, lastPageAt = 0, slideAnim = null;

  function canGo(dir) { var o = off(); return dir < 0 ? o > -365 : o < 0; }
  function dayLabel(o) {
    if (o === 0) return 'Hari ini';
    if (o === -1) return 'Kemarin';
    var d = dayAt(o);
    return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN[d.getMonth()];
  }
  function dayRev(o) {
    var arr = data()[keyOf(dayAt(o))] || [], s = 0;
    for (var i = 0; i < arr.length; i++) if (arr[i]) s += (+arr[i].revenue || 0);
    return s;
  }
  function rubber(dx, w) {
    var a = Math.abs(dx), v = (1 - 1 / (a * 0.55 / w + 1)) * w * 0.34;
    return dx < 0 ? -v : v;
  }

  function swipeEngage(dx, fromTilt) {
    var s = P;
    if (!s) return;
    if ((taken() && !mine) || SW) { abandon(); return; }
    holdDrop(s);
    clearTimeout(s.tTilt); s.tTilt = 0;
    var cont = $('dashboardContainer');
    if (!cont) { abandon(); return; }
    s.mode = 'swipe';
    claim();
    capture(cont, s);
    // isi mulai dari posisinya sekarang (tanpa lompatan)
    s.adj = fromTilt ? dx : (dx > 0 ? SWIPE_GO : -SWIPE_GO);
    if (slideAnim) { try { slideAnim.cancel(); } catch (e) { } slideAnim = null; }
    var cb = chromeBox();
    SW = { cont: cont, w: W.innerWidth, x: 0, dir: 0, chip: null, armed: false, mid: (cb.top + cb.bottom) / 2, busy: false };
    cont.style.transition = 'none';
    cont.style.willChange = 'transform';
    swipeFrame();
  }
  function swipeFrame() { if (!swRaf) swRaf = requestAnimationFrame(swipeDraw); }
  function swipeDraw() {
    swRaf = 0;
    var s = P;
    if (!s || s.mode !== 'swipe' || !SW || SW.busy) return;
    var dx = s.x - s.x0 - s.adj;
    var dir = dx > 0 ? -1 : 1, ok = canGo(dir), w = SW.w;
    var x = reduced() ? 0 : (ok ? dx * 0.9 : rubber(dx, w));
    SW.x = x;
    SW.cont.style.transform = 'translate3d(' + x.toFixed(1) + 'px,0,0)';
    chipShow(ok && dx !== 0 ? dir : 0, Math.abs(dx) / (COMMIT * w));
  }
  function velocity(s) {
    var a = s.smp, n = a.length;
    if (n < 2) return 0;
    var t1 = a[n - 1][0], i = n - 2;
    while (i > 0 && t1 - a[i][0] < 90) i--;
    var dt = t1 - a[i][0];
    if (dt <= 0 || t1 - a[i][0] > 220 || now() - t1 > 120) return 0;
    return (a[n - 1][1] - a[i][1]) / dt;
  }
  function swipeRelease(s, up) {
    if (swRaf) { cancelAnimationFrame(swRaf); swRaf = 0; }
    if (!SW) { unclaim(); return; }
    var dx = s.x - s.x0 - s.adj, dir = dx > 0 ? -1 : 1, w = SW.w, v = velocity(s);
    var commit = up && canGo(dir) && (Math.abs(dx) > COMMIT * w ||
      (Math.abs(v) > FLICK && (v > 0) === (dx > 0) && Math.abs(dx) > 28));
    if (commit) swipeCommit(dir, v); else swipeBack();
  }
  function swipeBack() {
    var sw = SW, c = sw.cont;
    sw.busy = true;
    chipHide(false);
    if (!sw.x || reduced()) { swipeClean(); return; }
    c.style.transition = 'transform 460ms cubic-bezier(.3,1.32,.5,1)';
    c.style.transform = 'translate3d(0px,0,0)';
    setTimeout(swipeClean, 480);
  }
  function swipeCommit(dir, v) {
    var sw = SW, c = sw.cont, w = sw.w, sign = dir < 0 ? 1 : -1;
    sw.busy = true;
    buzz(8);
    chipHide(true);
    // pengaman: tab di latar (rAF berhenti) — isi tidak boleh tertinggal transparan
    setTimeout(function () { if (SW === sw) { if (!sw.went) go(dir); swipeClean(); } }, 1600);
    if (reduced()) {
      c.style.transition = 'opacity 110ms linear';
      c.style.opacity = '0';
      setTimeout(function () {
        if (SW !== sw) return;
        sw.went = true;
        go(dir);
        c.style.transition = 'opacity 200ms ease-out';
        c.style.opacity = '1';
        setTimeout(swipeClean, 220);
      }, 120);
      return;
    }
    var rem = Math.max(0, w - Math.abs(sw.x)), sp = Math.max(Math.abs(v), 1.7);
    var dur = Math.round(clamp(rem / sp, 120, 230)), fade = Math.round(dur * 0.6), t0 = now();
    // isi memudar lebih cepat dari luncurannya: begitu tak terlihat, app sudah
    // boleh menggambar hari baru (HP lambat: render tersembunyi di balik luncuran)
    c.style.transition = 'transform ' + dur + 'ms cubic-bezier(.4,0,.9,.6),opacity ' + fade + 'ms linear';
    c.style.transform = 'translate3d(' + (sign * w) + 'px,0,0)';
    c.style.opacity = '0';
    setTimeout(function () {
      if (SW !== sw) return;
      sw.went = true;
      go(dir);                                    // app menggambar hari baru (sinkron)
      setTimeout(function () {
        if (SW !== sw) return;
        c.style.transition = 'none';
        c.style.transform = 'translate3d(' + (-sign * w * 0.3).toFixed(0) + 'px,0,0)';
        c.style.opacity = '0';
        void c.offsetWidth;
        requestAnimationFrame(function () {
          if (SW !== sw) return;
          c.style.transition = 'transform 520ms cubic-bezier(.22,1,.36,1),opacity 300ms cubic-bezier(.2,.7,.3,1)';
          c.style.transform = 'translate3d(0px,0,0)';
          c.style.opacity = '1';
          setTimeout(swipeClean, 540);
        });
      }, Math.max(0, dur + 10 - (now() - t0)));
    }, fade + 16);
  }
  function go(dir) {
    selfNav = true;
    try { if (dir < 0) { if (typeof prevDay === 'function') prevDay(); } else if (typeof nextDay === 'function') nextDay(); }
    catch (e) { console.warn('[fx-play] ganti hari', e); }
    selfNav = false;
    lastOff = off();
  }
  function swipeClean() {
    var sw = SW; if (!sw) return;
    SW = null;
    var c = sw.cont;
    c.style.transition = ''; c.style.transform = ''; c.style.opacity = ''; c.style.willChange = '';
    chipHide(false, true);
    if (!P || !P.mode) unclaim();
  }

  // chip kaca di tepi: hari tujuan + omsetnya, cincin terisi menuju ambang
  var CIRC = 100.53;   // 2π × 16
  function chipShow(dir, p) {
    var sw = SW; if (!sw) return;
    if (!dir || p < 0.06) { chipHide(false); return; }
    var ch = sw.chip;
    if (!ch || ch.dir !== dir) {
      if (ch && ch.el.parentNode) ch.el.parentNode.removeChild(ch.el);
      var o = off() + dir, rev = dayRev(o);
      var el = D.createElement('div');
      el.className = 'hxp-day' + (dir > 0 ? ' is-r' : '');
      el.setAttribute('aria-hidden', 'true');
      var path = dir < 0 ? 'M20.2 12.4 14.6 18l5.6 5.6' : 'M15.8 12.4 21.4 18l-5.6 5.6';
      el.innerHTML = '<svg viewBox="0 0 36 36"><circle class="t" cx="18" cy="18" r="16"/>' +
        '<circle class="p" cx="18" cy="18" r="16" transform="rotate(-90 18 18)" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '"/>' +
        '<path class="c" d="' + path + '"/></svg>' +
        '<span class="hxp-day-tx"><span class="hxp-day-d">' + esc(dayLabel(o)) + '</span>' +
        '<span class="hxp-day-v">' + (rev ? 'Rp ' + esc(money(rev)) : 'Rp 0') + '</span></span>';
      D.body.appendChild(el);
      var cw = el.offsetWidth || 150;
      el.style.top = Math.round(sw.mid - 26) + 'px';
      el.style.left = dir < 0 ? '12px' : Math.round(W.innerWidth - 12 - cw) + 'px';
      ch = sw.chip = { el: el, dir: dir, cw: cw, ring: el.querySelector('.p'), armed: false };
    }
    var q = clamp(p, 0, 1), e = 1 - Math.pow(1 - clamp(p / 0.75, 0, 1), 3);
    ch.el.style.opacity = Math.min(1, p * 2.2).toFixed(3);
    if (!reduced()) {
      var hid = -(ch.cw + 14) * (1 - e) * (dir < 0 ? 1 : -1);
      ch.el.style.transform = 'translate3d(' + hid.toFixed(1) + 'px,0,0) scale(' + (ch.armed ? 1.04 : 1) + ')';
    }
    ch.ring.setAttribute('stroke-dashoffset', (CIRC * (1 - q)).toFixed(2));
    var arm = p >= 1;
    if (arm !== ch.armed) {
      ch.armed = arm;
      ch.el.classList.toggle('is-armed', arm);
    }
  }
  function chipHide(commit, now_) {
    var sw = SW, ch = sw && sw.chip;
    if (!ch) {
      // chip milik geseran yang sudah selesai (swipeClean)
      if (now_) { var olds = D.querySelectorAll('.hxp-day'); for (var i = 0; i < olds.length; i++) if (!olds[i].__fade) olds[i].parentNode.removeChild(olds[i]); }
      return;
    }
    if (!commit && !now_ && !sw.busy) {
      // jari kembali ke tengah: sembunyikan tanpa membuang (bisa muncul lagi)
      ch.el.style.opacity = '0';
      return;
    }
    sw.chip = null;
    var el = ch.el;
    el.__fade = true;
    var kill = function () { if (el.parentNode) el.parentNode.removeChild(el); };
    if (reduced() || !el.animate) { kill(); return; }
    var o = parseFloat(el.style.opacity) || 0;
    var a = commit
      ? anim(el, [{ opacity: o, transform: el.style.transform || 'none' }, { opacity: 0, transform: 'translate3d(0,0,0) scale(1.12)' }], { duration: 260, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })
      : anim(el, [{ opacity: o }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
    if (a) a.onfinish = kill;
    setTimeout(kill, 400);
  }

  // pindah hari lewat tombol ‹ ›, kotak riwayat, kalender, panah keyboard:
  // isi meluncur masuk dari arah yang benar (lama = dari kiri)
  function onRender() {
    var o = off();
    if (lastOff === null) { lastOff = o; return; }
    if (o === lastOff) return;
    var dirOld = o < lastOff ? -1 : 1;
    lastOff = o;
    if (selfNav || SW || !dashOn() || now() - lastPageAt < 600 || D.hidden) return;
    var c = $('dashboardContainer'); if (!c) return;
    if (slideAnim) { try { slideAnim.cancel(); } catch (e) { } }
    if (reduced() || !c.animate) {
      slideAnim = anim(c, [{ opacity: 0.35 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
      return;
    }
    var from = (dirOld < 0 ? -1 : 1) * Math.min(64, W.innerWidth * 0.12);
    slideAnim = anim(c, [{ transform: 'translate3d(' + from.toFixed(0) + 'px,0,0)', opacity: 0.2 }, { transform: 'translate3d(0,0,0)', opacity: 1 }],
      { duration: 440, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
  function onKey(e) {
    if (e.key === 'Escape') { if (P) finish('cancel'); return; }
    if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.defaultPrevented || !dashOn() || taken() || SW || R.classList.contains('hx-overlay-open') || busy()) return;
    var a = D.activeElement;
    if (a && a !== D.body && a !== R && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
    if (a && a.isContentEditable) return;
    var dir = e.key === 'ArrowLeft' ? -1 : 1;
    if (!canGo(dir)) {
      var c = $('dashboardContainer');
      if (c && !reduced()) anim(c, [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-14px,0,0)', offset: .3 }, { transform: 'translate3d(0,0,0)' }],
        { duration: 380, easing: 'cubic-bezier(.3,1.3,.5,1)' });
      return;
    }
    e.preventDefault();
    if (dir < 0) prevDay(); else nextDay();
  }

  /* ══ 3. KARTU KACA MIRING ═════════════════════════════════════════════ */
  var T = null;
  function tiltEngage() {
    var s = P;
    if (!s || !s.card || s.mode) return;
    if ((taken() && !mine) || !s.card.isConnected) { s.card.classList.remove('hxp-nosel'); s.card = null; return; }
    s.mode = 'tilt';
    claim();
    tiltStart(s.card, 'touch');
    tiltAim(s.x, s.y);
  }
  function tiltStart(card, kind) {
    if (T && T.card === card) { T.kind = kind; return; }
    if (T) tiltRelease();
    var r = card.getBoundingClientRect();
    var wq = Math.max(r.width, 140);
    var max = kind === 'touch' ? clamp(5 * 300 / wq, 1.6, 5) : clamp(2.4 * 300 / wq, 0.8, 2.4);
    var lift = (kind === 'hover' && /(^|\s)(spc|kpi-card)(\s|$)/.test(card.className)) ? -3 : 0;
    var t = T = { card: card, kind: kind, r: r, max: max, lift: lift, tx: 0.5, ty: 0.5, raf: 0, glare: null, gi: null, t0: now() };
    // kartu tanpa posisi (.ins-kpi-card): relative SEMENTARA untuk lapisan kilau
    if (!card.__hxpPos && getComputedStyle(card).position === 'static') { card.style.position = 'relative'; card.__hxpPos = true; }
    card.style.willChange = 'transform';
    card.style.transition = 'transform ' + (kind === 'touch' ? 220 : 300) + 'ms cubic-bezier(.2,.8,.2,1)';
    t.ease = setTimeout(function () { if (T === t) card.style.transition = 'transform ' + (kind === 'touch' ? 90 : 160) + 'ms linear'; }, kind === 'touch' ? 230 : 300);
    if (kind === 'touch') {
      var gl = D.createElement('span');
      gl.className = 'hxp-glare';
      gl.setAttribute('aria-hidden', 'true');
      var gs = Math.round(Math.max(r.width, r.height) * 1.5);
      gl.innerHTML = '<i style="width:' + gs + 'px;height:' + gs + 'px;margin:' + (-gs / 2) + 'px 0 0 ' + (-gs / 2) + 'px"></i>';
      card.appendChild(gl);
      t.glare = gl; t.gi = gl.firstChild;
      void gl.offsetWidth;
      gl.classList.add('on');
    }
  }
  function tiltAim(x, y) {
    var t = T; if (!t) return;
    t.tx = clamp((x - t.r.left) / t.r.width, 0, 1);
    t.ty = clamp((y - t.r.top) / t.r.height, 0, 1);
    if (!t.raf) t.raf = requestAnimationFrame(tiltDraw);
  }
  function tiltDraw() {
    var t = T; if (!t) return;
    t.raf = 0;
    var ry = (t.tx - 0.5) * 2 * t.max, rx = -(t.ty - 0.5) * 2 * t.max;
    t.card.style.transform = 'perspective(900px) translate3d(0,' + t.lift + 'px,0) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)' +
      (t.kind === 'touch' ? ' scale3d(.975,.975,1)' : '');
    if (t.gi) t.gi.style.transform = 'translate3d(' + (t.tx * t.r.width).toFixed(1) + 'px,' + (t.ty * t.r.height).toFixed(1) + 'px,0)';
  }
  function tiltRelease() {
    var t = T; if (!t) return;
    T = null;
    if (t.raf) cancelAnimationFrame(t.raf);
    clearTimeout(t.ease);
    var c = t.card;
    c.style.transition = 'transform 680ms cubic-bezier(.3,1.55,.5,1)';
    c.style.transform = 'perspective(900px) translate3d(0,0,0) rotateX(0deg) rotateY(0deg)' + (t.kind === 'touch' ? ' scale3d(1,1,1)' : '');
    if (t.glare) t.glare.classList.remove('on');
    setTimeout(function () {
      if (t.glare && t.glare.parentNode) t.glare.parentNode.removeChild(t.glare);
      if (T && T.card === c) return;          // kartu yang sama dimiringkan lagi
      c.style.transition = ''; c.style.transform = ''; c.style.willChange = '';
      if (c.__hxpPos) { c.style.position = ''; c.__hxpPos = false; }
    }, 700);
  }
  // desktop: miring halus mengikuti kursor
  function hoverMove(e) {
    if (!mqHover || !mqHover.matches) return;
    if (P || taken() || reduced() || SW) { if (T && T.kind === 'hover') tiltRelease(); return; }
    var t = e.target, c = (t && t.nodeType === 1 && t.closest) ? t.closest(TILT_SEL) : null;
    if (c && t.closest(NO_START)) c = null;
    if (!c) { if (T && T.kind === 'hover') tiltRelease(); return; }
    if (!T || T.card !== c) tiltStart(c, 'hover');
    tiltAim(e.clientX, e.clientY);
  }

  /* ── zoom cubit: halaman diperbesar = tidak ada geser hari, browser bebas
     menggeser tampilan ke segala arah (lihat html.hxp-zoomed di css) ──── */
  var VV = W.visualViewport;
  function zoomed() { return R.classList.contains('hxp-zoomed'); }
  function zoomCheck() {
    var z = !!(VV && VV.scale > 1.01);
    if (z !== zoomed()) R.classList.toggle('hxp-zoomed', z);
  }
  if (VV && VV.addEventListener) { VV.addEventListener('resize', zoomCheck); zoomCheck(); }

  /* ── pengaman: akhiri gestur di setiap jalan keluar ────────────────── */
  function stopAll() {
    if (P) finish('cancel');
    if (T && T.kind === 'hover') tiltRelease();
  }
  D.addEventListener('pointerdown', onDown, { passive: true });
  D.addEventListener('pointermove', onMove, { passive: true });
  D.addEventListener('pointerup', onUp, { passive: true });
  D.addEventListener('pointercancel', onCancel, { passive: true });
  D.addEventListener('lostpointercapture', function (e) {
    var s = P;
    if (s && e.pointerId === s.id && s.cap && e.target === s.cap) { s.cap = null; finish('cancel'); }
  }, true);
  D.addEventListener('pointerout', function (e) {
    if (e.pointerType === 'mouse' && !e.relatedTarget && T && T.kind === 'hover') tiltRelease();
  }, { passive: true });
  // Android: menu tekan-lama tidak boleh muncul di permukaan gestur
  D.addEventListener('contextmenu', function (e) {
    var s = P, t = e.target;
    if (!s || !s.touch || !t || t.nodeType !== 1) return;
    var num = $('liveOmsetBig');
    if (s.mode || (s.card && s.card.contains(t)) || (s.hold && num && num.contains(t))) e.preventDefault();
  });
  // klik yang menyusul geseran / tahan tidak boleh membuka apa-apa
  D.addEventListener('click', function (e) {
    if (supUntil && now() < supUntil) { supUntil = 0; e.stopPropagation(); e.preventDefault(); }
  }, true);
  D.addEventListener('keydown', onKey);
  D.addEventListener('visibilitychange', function () { if (D.hidden) stopAll(); });
  W.addEventListener('blur', stopAll);
  W.addEventListener('resize', function () { if (P && P.mode === 'hold') finish('cancel'); });
  W.addEventListener('orientationchange', stopAll);
  W.addEventListener('scroll', function () {
    if (T && T.kind === 'hover') tiltRelease();
    if (P && !P.touch && P.mode === 'hold') finish('cancel');
  }, { passive: true });

  function hookHX() {
    var h = W.HX;
    if (!h || !h.on || h.__hxpHooked) return !!(h && h.__hxpHooked);
    h.__hxpHooked = true;
    h.on('render', function () {
      bindNumber();
      // kartu yang sedang dimiringkan dibangun ulang app.js → selesai
      if (T && !T.card.isConnected) {
        if (P && P.mode === 'tilt') finish('cancel'); else T = null;
      }
      splitLive();
      onRender();
    });
    h.on('page', function () {
      lastPageAt = now();
      if (P) finish('cancel');
      splitKill();
      if (T) tiltRelease();
    });
    h.play = {
      state: function () {
        return {
          pointer: P ? { mode: P.mode, hold: P.hold, swipe: P.swipe, card: !!P.card } : null,
          split: S ? { rows: S.rows.map(function (g) { return { team: g.team, rev: g.rev, share: g.share }; }), total: S.M.total, rowH: S.rowH, hot: S.hot } : null,
          swipe: SW ? { x: SW.x, busy: SW.busy } : null,
          tilt: T ? { kind: T.kind, cls: T.card.className } : null,
          gesture: taken(), mine: mine
        };
      },
      model: model,
      openSplit: function () { var M = model(); if (M.rows.length) splitOpen(M); return !!S; },
      closeSplit: function () { splitClose(); },
      go: function (dir) { if (canGo(dir)) go(dir); }
    };
    return true;
  }
  if (!hookHX()) {
    var tries = 0, iv = setInterval(function () { if (hookHX() || ++tries > 40) clearInterval(iv); }, 250);
  }
  bindNumber();
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', bindNumber);
})();
