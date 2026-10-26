/* ══════════════════════════════════════════════════════════════════════
   MOTION — detail kecil yang membuat dashboard terasa premium:
     1. angka yang BERGULIR saat nilainya berubah (omset, closing, target)
     2. SKELETON berkilau saat data Firebase belum masuk (bukan "Rp 0")
     3. SATU perayaan per hari: saat target harian tercapai
     4. GETAR halus di HP (Android) saat simpan berhasil / gagal
   Semua mati otomatis kalau "Kurangi Gerak" (Reduce Motion) aktif.
   File TERPISAH — app.js tidak disentuh. Fungsi asli hanya dibungkus.

   PENTING — angka bergulir TIDAK menulis ulang teks asli elemen.
   premium-ui.js membaca teks #K1 #K2 #goalPct, dan reference-dashboard.js
   mengamati #liveOmsetBig lalu MENGGAMBAR ULANG GRAFIK hero setiap kali
   teksnya berubah (MutationObserver childList+characterData, TANPA
   attributes). Kalau teks asli ditulis 60x per detik, grafik ikut digambar
   ulang 60x per detik dan mereka membaca nilai setengah jalan. Jadi teks
   asli langsung berisi nilai FINAL; angka antaranya digambar lewat atribut
   data-lg + ::after (lihat .lg-rolling di glass.css), yang tidak mereka
   amati.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  // diikuti terus: kalau "Kurangi Gerak" dinyalakan di tengah jalan, langsung berlaku
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var REDUCED = !!(mq && mq.matches);
  if (mq) {
    var onMq = function (e) { REDUCED = e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  }

  /* ── 4. getar ─────────────────────────────────────────────────────── */
  // Chrome Android menolak navigator.vibrate sebelum halaman pernah disentuh.
  function canBuzz() {
    var ua = navigator.userActivation;
    return !ua || ua.hasBeenActive;
  }
  function buzz(pattern) {
    try { if (navigator.vibrate && canBuzz()) navigator.vibrate(pattern); } catch (e) { }
  }
  // Bungkus fungsi milik skrip lain TANPA menghapus penanda mereka
  // (watchlist.js memeriksa showPage.__wl). Tanpa ini kedua skrip saling
  // membungkus ulang, dan Watchlist dirender dua kali tiap kali dibuka.
  function keepMarkers(from, to) {
    for (var k in from) {
      if (Object.prototype.hasOwnProperty.call(from, k)) to[k] = from[k];
    }
    return to;
  }

  /* ── 1. angka bergulir ────────────────────────────────────────────── */
  // format persis sama dengan app.js (pakai fungsi aslinya kalau ada)
  function fmtRp(n) {
    n = Math.round(n);
    return (typeof fFull === 'function') ? fFull(n) : 'Rp ' + n.toLocaleString('id-ID');
  }
  function fmtShort(n) {
    n = Math.round(n);
    return (typeof fRp === 'function') ? fRp(n) : String(n);
  }
  var KINDS = {
    // "Rp 2.934.582.749" — titik = pemisah ribuan
    rp: {
      parse: function (s) { var m = /^Rp\s?([\d.]+)$/.exec(s); return m ? +m[1].replace(/\./g, '') : null; },
      fmt: fmtRp
    },
    // "170.10M" / "850k" / "500" — titik = desimal (fRp)
    short: {
      parse: function (s) {
        var m = /^(\d+(?:\.\d+)?)(M|k)?$/.exec(s);
        return m ? +m[1] * (m[2] === 'M' ? 1e6 : m[2] === 'k' ? 1e3 : 1) : null;
      },
      fmt: fmtShort
    },
    int: {
      parse: function (s) { return /^\d+$/.test(s) ? +s : null; },
      fmt: function (n) { return String(Math.round(n)); }
    },
    pct: {
      parse: function (s) { var m = /^(\d+)%$/.exec(s); return m ? +m[1] : null; },
      fmt: function (n) { return Math.round(n) + '%'; }
    }
  };
  // id elemen -> [jenis format, durasi ms]
  var TARGETS = {
    liveOmsetBig: ['rp', 700], mOmsetBig: ['rp', 700],
    totalRev: ['rp', 520], K2c: ['rp', 520], K2: ['short', 520],
    K1: ['int', 460], goalPct: ['pct', 460]
  };
  var live = {};   // id -> { cur, raf, timer }

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function finish(el) {
    var s = live[el.id];
    if (s) {
      if (s.raf) cancelAnimationFrame(s.raf);
      if (s.timer) clearTimeout(s.timer);
      s.raf = 0; s.timer = 0;
    }
    el.classList.remove('lg-rolling');
    el.removeAttribute('data-lg');
  }

  function roll(el, kind, dur, from, to) {
    var K = KINDS[kind];
    var s = live[el.id] || (live[el.id] = {});
    if (!el.classList.contains('lg-rolling')) {
      // warna asli diambil SEBELUM teks asli dibuat transparan
      el.style.setProperty('--lg-c', getComputedStyle(el).color);
    }
    if (s.raf) cancelAnimationFrame(s.raf);
    if (s.timer) clearTimeout(s.timer);
    el.setAttribute('data-lg', K.fmt(from));
    el.classList.add('lg-rolling');
    s.cur = from;
    var t0 = performance.now();
    function frame(now) {
      // Stempel waktu rAF = awal frame, bisa SEBELUM t0 -> t negatif ->
      // satu frame menampilkan angka di bawah nilai awal ("Rp -57.917.652").
      var t = Math.max(0, Math.min(1, (now - t0) / dur));
      s.cur = from + (to - from) * easeOut(t);
      el.setAttribute('data-lg', K.fmt(s.cur));
      if (t < 1) s.raf = requestAnimationFrame(frame);
      else finish(el);
    }
    s.raf = requestAnimationFrame(frame);
    // Pengaman: kalau requestAnimationFrame berhenti (tab di latar, browser
    // hemat daya), jangan biarkan nilai lama tertinggal di layar.
    s.timer = setTimeout(function () { finish(el); }, dur + 300);
  }

  function watchValue(id) {
    var el = document.getElementById(id);
    if (!el || el.__lgRoll) return;
    el.__lgRoll = true;
    var kind = TARGETS[id][0], dur = TARGETS[id][1], K = KINDS[kind];
    var last = K.parse(el.textContent.trim());
    new MutationObserver(function () {
      var to = K.parse(el.textContent.trim());
      var s = live[id];
      var from = (s && s.raf) ? s.cur : last;
      last = to;
      if (to === null) { finish(el); return; }
      if (from === null || from === to || REDUCED || document.hidden) return;
      // Data pertama masuk saat skeleton masih menyala. Skeleton membuat teks
      // transparan, dan roll() menyimpan warna teks — jadi tanpa ini angka
      // bergulir dengan warna transparan: kosong ±1 detik di setiap pembukaan.
      if (!loadingDone && dataReady()) endLoading();
      // dari 0 (data pertama masuk) sedikit lebih lama — terasa "menghitung"
      roll(el, kind, from === 0 ? dur + 280 : dur, from, to);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  /* ── 2. skeleton saat memuat ──────────────────────────────────────── */
  function dataReady() {
    try { return typeof allData !== 'undefined' && !!allData && Object.keys(allData).length > 0; }
    catch (e) { return false; }
  }
  var loadingDone = false;
  function endLoading() {
    if (loadingDone) return;
    loadingDone = true;
    root.classList.remove('lg-loading');
    // kartu-kartu baru saja dibuat dari data pertama -> beri animasi masuk
    var act = document.querySelector('.page.active');
    if (act) enterPage(act.id, false);
    setTimeout(maybeCelebrate, 900);
  }

  /* ── 5. animasi masuk halaman ─────────────────────────────────────── */
  // .lg-enter hanya terpasang ±2 detik setelah halaman dibuka. Di luar jendela
  // itu, render ulang dari Firebase dan grafik yang digambar ulang tiap 15
  // detik (reference-dashboard.js) TIDAK beranimasi ulang.
  var ENTER_MS = 2000;
  var ENTER_ROLL = {
    'page-dashboard': ['liveOmsetBig', 'K1', 'K2', 'totalRev', 'goalPct'],
    'page-monthly': ['mOmsetBig']
  };
  function enterPage(id, rollFromZero) {
    var page = document.getElementById(id);
    if (!page || REDUCED) return;
    page.classList.remove('lg-enter');
    void page.offsetWidth;                       // mulai ulang animasi CSS
    page.classList.add('lg-enter');
    clearTimeout(page.__lgEnterT);
    page.__lgEnterT = setTimeout(function () { page.classList.remove('lg-enter'); }, ENTER_MS);
    sheen(page);
    if (rollFromZero && !document.hidden) {
      (ENTER_ROLL[id] || []).forEach(function (eid) {
        var el = document.getElementById(eid);
        if (!el || !TARGETS[eid]) return;
        var kind = TARGETS[eid][0], to = KINDS[kind].parse(el.textContent.trim());
        if (to === null || to <= 0) return;
        roll(el, kind, (eid === 'liveOmsetBig' || eid === 'mOmsetBig') ? 1150 : 820, 0, to);
      });
    }
  }
  // kilau cahaya yang menyapu kaca hero satu kali
  function sheen(page) {
    var hero = page.querySelector('.omset-hero');
    if (!hero) return;
    var s = hero.querySelector(':scope > .lg-sheen');
    if (!s) {
      s = document.createElement('span');
      s.className = 'lg-sheen';
      s.setAttribute('aria-hidden', 'true');
      hero.appendChild(s);
    }
    s.classList.remove('go');
    void s.offsetWidth;
    s.classList.add('go');
  }

  /* ── 6. kapsul kaca yang MENGALIR di antara tab (desktop) ─────────── */
  var DESKTOP = window.matchMedia ? matchMedia('(min-width:769px)') : null;
  function navPill() {
    var bar = document.querySelector('.nav-bar');
    if (!bar) return;
    var pill = bar.querySelector(':scope > .lg-nav-pill');
    if (!DESKTOP || !DESKTOP.matches) {
      root.classList.remove('lg-has-pill');
      if (pill) pill.style.opacity = '0';
      return;
    }
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'lg-nav-pill';
      pill.setAttribute('aria-hidden', 'true');
      bar.insertBefore(pill, bar.firstChild);
      pill.__first = true;
    }
    var a = bar.querySelector('.nav-tab.active[data-page]') || bar.querySelector('.nav-tab.active');
    if (!a || !a.offsetWidth) { pill.style.opacity = '0'; return; }
    var br = bar.getBoundingClientRect(), r = a.getBoundingClientRect();
    var x = r.left - br.left + bar.scrollLeft, y = r.top - br.top + bar.scrollTop;
    if (pill.__first) {                          // posisi pertama: muncul tanpa meluncur
      pill.style.transition = 'none';
      pill.__first = false;
      requestAnimationFrame(function () { pill.style.transition = ''; });
    }
    pill.style.width = r.width + 'px';
    pill.style.height = r.height + 'px';
    pill.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    pill.style.opacity = '1';
    root.classList.add('lg-has-pill');
  }

  /* ── 7. cahaya mengikuti kursor di atas kaca (hanya perangkat mouse) ─ */
  if (window.matchMedia && matchMedia('(hover:hover)').matches) {
    var SPOT = '.spc,.kpi-card,.goal-card,.omset-hero,.ins-kpi-card,.ins-panel,.wl-panel,.lbi,.act-form,' +
               '.panel:not(.premium-entry-drawer)';
    var pend = null, sraf = 0;
    document.addEventListener('pointermove', function (e) {
      var c = e.target && e.target.closest ? e.target.closest(SPOT) : null;
      if (!c) return;
      pend = { c: c, x: e.clientX, y: e.clientY };
      if (sraf) return;
      sraf = requestAnimationFrame(function () {
        sraf = 0;
        var p = pend; if (!p) return;
        var b = p.c.getBoundingClientRect();
        p.c.style.setProperty('--mx', (p.x - b.left) + 'px');
        p.c.style.setProperty('--my', (p.y - b.top) + 'px');
      });
    }, { passive: true });
  }
  if (!dataReady()) {
    root.classList.add('lg-loading');
    var poll = setInterval(function () { if (dataReady()) { clearInterval(poll); endLoading(); } }, 120);
    // Pengaman: offline / Firebase lambat — jangan sembunyikan angka selamanya
    setTimeout(function () { clearInterval(poll); endLoading(); }, 9000);
  } else {
    loadingDone = true;
  }

  /* ── 3. satu perayaan per hari: target harian tercapai ───────────── */
  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function cardVisible(card) {
    var r = card.getBoundingClientRect();
    var shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return r.height > 0 && shown >= r.height * 0.5;
  }
  function maybeCelebrate() {
    if (!loadingDone) return;
    // Target asli (config/revTarget, mis. Rp150jt) belum dimuat -> app.js masih
    // memakai bawaan Rp70jt, jadi "100%" bisa palsu. Tunggu config dulu.
    if (!window._cfgTeamsLoaded) return;
    var g = document.getElementById('goalPct');
    if (!g || !(parseInt(g.textContent, 10) >= 100)) return;
    try { if (typeof vOff !== 'undefined' && vOff !== 0) return; } catch (e) { }   // hanya untuk HARI INI
    var dash = document.getElementById('page-dashboard');
    if (!dash || !dash.classList.contains('active')) return;
    var key = 'lg-target-' + dayKey();
    try { if (localStorage.getItem(key)) return; } catch (e) { return; }
    var card = document.querySelector('#page-dashboard .goal-card');
    // Jatah sekali-sehari HANYA dipakai kalau benar-benar terlihat: tab di
    // latar, layar terkunci, atau kartu tergulir keluar -> coba lagi nanti
    // (lihat pendengar visibilitychange & scroll di hook()).
    if (document.hidden || !card || !cardVisible(card)) return;
    try { localStorage.setItem(key, '1'); } catch (e) { return; }
    card.classList.add('lg-goal-hit');
    setTimeout(function () { card.classList.remove('lg-goal-hit'); }, 2600);
    buzz([14, 50, 14, 50, 28]);
    if (!REDUCED) sparks(card);
  }

  // percikan halus warna Hurricane (hijau, kuning, putih) dari batang target
  function sparks(card) {
    var r = card.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.className = 'lg-sparks';
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    // ukuran tampilan = ukuran gambar. 100vh di CSS = viewport BESAR di HP
    // (bilah alamat tersembunyi), jadi percikan akan meregang & bergeser.
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);
    var bar = card.querySelector('.goal-bar') || card;
    var b = bar.getBoundingClientRect();
    var ox = b.left + b.width * 0.85, oy = b.top + b.height / 2;
    var COLORS = ['#30d158', '#46e06d', '#ffd426', '#ffffff'];
    var P = [];
    for (var i = 0; i < 64; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      var v = 3 + Math.random() * 6.5;
      P.push({
        x: ox + (Math.random() - 0.5) * b.width * 0.5, y: oy,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: 2 + Math.random() * 3, h: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        c: COLORS[i % COLORS.length], life: 1
      });
    }
    var t0 = performance.now(), DUR = 1700, raf = 0;
    function draw(now) {
      var t = (now - t0) / DUR;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      P.forEach(function (p) {
        p.vy += 0.22; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < 1) raf = requestAnimationFrame(draw); else cv.remove();
    }
    raf = requestAnimationFrame(draw);
    setTimeout(function () { cancelAnimationFrame(raf); cv.remove(); }, DUR + 400);   // pengaman
  }

  /* ── pasang tanpa menyentuh app.js ────────────────────────────────── */
  function hook() {
    Object.keys(TARGETS).forEach(watchValue);

    var g = document.getElementById('goalPct');
    if (g && !g.__lgCele) {
      g.__lgCele = true;
      new MutationObserver(function () { setTimeout(maybeCelebrate, 600); })
        .observe(g, { childList: true, characterData: true, subtree: true });
    }
    if (typeof window.showPage === 'function' && !window.showPage.__lgm) {
      var origShow = window.showPage;
      window.showPage = keepMarkers(origShow, function (p) {
        var r = origShow.apply(this, arguments);
        navPill();
        enterPage('page-' + p, true);
        if (p === 'dashboard') setTimeout(maybeCelebrate, 500);
        return r;
      });
      window.showPage.__lgm = true;
    }
    if (typeof window.showToast === 'function' && !window.showToast.__lg) {
      var origToast = window.showToast;
      window.showToast = keepMarkers(origToast, function (msg, type) {
        if (type === 'success') buzz(12);
        else if (type === 'error') buzz([20, 60, 20]);
        return origToast.apply(this, arguments);
      });
      window.showToast.__lg = true;
    }
    navPill();
    // perayaan yang tertunda (tab di latar / kartu tidak terlihat) dicoba lagi
    if (!hook.__listening) {
      hook.__listening = true;
      var rt = 0;
      window.addEventListener('resize', function () {
        clearTimeout(rt); rt = setTimeout(navPill, 120);
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(navPill);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) setTimeout(maybeCelebrate, 400);
      });
      var lastScroll = 0;
      window.addEventListener('scroll', function () {
        var now = Date.now();
        if (now - lastScroll < 400) return;
        lastScroll = now;
        maybeCelebrate();
      }, { passive: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
  setTimeout(hook, 900);     // setelah skrip lain selesai membungkus fungsi yang sama
})();
