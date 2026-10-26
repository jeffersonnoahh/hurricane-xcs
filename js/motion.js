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
  var REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ── 4. getar ─────────────────────────────────────────────────────── */
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { }
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
      var t = Math.min(1, (now - t0) / dur);
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
    setTimeout(maybeCelebrate, 900);
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
  function maybeCelebrate() {
    if (!loadingDone) return;
    var g = document.getElementById('goalPct');
    if (!g || !(parseInt(g.textContent, 10) >= 100)) return;
    try { if (typeof vOff !== 'undefined' && vOff !== 0) return; } catch (e) { }   // hanya untuk HARI INI
    var dash = document.getElementById('page-dashboard');
    if (!dash || !dash.classList.contains('active')) return;                      // tunggu sampai terlihat
    var key = 'lg-target-' + dayKey();
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); }
    catch (e) { return; }                                                       // tanpa storage: jangan berulang
    var card = document.querySelector('#page-dashboard .goal-card');
    if (card) {
      card.classList.add('lg-goal-hit');
      setTimeout(function () { card.classList.remove('lg-goal-hit'); }, 2600);
    }
    buzz([14, 50, 14, 50, 28]);
    if (!REDUCED && card) sparks(card);
  }

  // percikan halus warna Hurricane (hijau, kuning, putih) dari batang target
  function sparks(card) {
    var r = card.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = document.createElement('canvas');
    cv.className = 'lg-sparks';
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
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
      window.showPage = function (p) {
        var r = origShow.apply(this, arguments);
        if (p === 'dashboard') setTimeout(maybeCelebrate, 500);
        return r;
      };
      window.showPage.__lgm = true;
    }
    if (typeof window.showToast === 'function' && !window.showToast.__lg) {
      var origToast = window.showToast;
      window.showToast = function (msg, type) {
        if (type === 'success') buzz(12);
        else if (type === 'error') buzz([20, 60, 20]);
        return origToast.apply(this, arguments);
      };
      window.showToast.__lg = true;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
  setTimeout(hook, 900);     // setelah skrip lain selesai membungkus fungsi yang sama
})();
