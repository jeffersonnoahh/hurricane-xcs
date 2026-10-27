/* ══════════════════════════════════════════════════════════════════════
   MOTION — detail kecil yang membuat dashboard terasa premium:
     1. angka yang BERGULIR saat nilainya berubah (omset, closing, target)
        1b. angka hero (#liveOmsetBig, #mOmsetBig) = ODOMETER per digit,
            mulai dari angka terakhir dilihat di HP ini + lencana "+Rp 5,78jt"
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
   amati. Odometer hero memakai prinsip yang sama: teks asli final dan
   transparan, pitanya di lapisan .hx-odo yang menumpang di kartu hero
   (bukan di dalam elemen angka). Gayanya disuntik sekali (#hx-odo-css).
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
  // Format singkat app.js fRp (2026-10): '850rb' · '189,73jt' · '5jt' ·
  // '2,95M' (M = MILIAR) · '500' — koma = desimal. Bentuk lama ('189.73M' =
  // juta, '850k') sengaja TIDAK dibaca (null = tidak bergulir): 'M' lama
  // berarti juta, membacanya sebagai miliar menggulir angka 1000x salah.
  function parseShortMoney(s) {
    var m = /^(\d+)(?:,(\d{1,2}))?(rb|jt|M)?$/.exec(s);
    if (!m || (m[2] && !m[3])) return null;
    return +(m[1] + '.' + (m[2] || '0')) * (m[3] === 'M' ? 1e9 : m[3] === 'jt' ? 1e6 : m[3] === 'rb' ? 1e3 : 1);
  }
  var rpShort = false;   // gaya teks "Rp …" yang TERAKHIR dibaca parseRp
  function parseRp(s) {
    var m = /^Rp\s?([\d.]+)$/.exec(s);
    if (m) { rpShort = false; return +m[1].replace(/\./g, ''); }
    m = /^Rp\s?(\S+)$/.exec(s);
    // "Rp 190M" tanpa koma = format LAMA reference-dashboard.js (190 JUTA) —
    // jangan dibaca sebagai 190 miliar. "Rp 2,95M" tetap terbaca.
    var v = (m && !/^\d+M$/.test(m[1])) ? parseShortMoney(m[1]) : null;
    if (v !== null) rpShort = true;
    return v;
  }
  var KINDS = {
    // "Rp 2.934.582.749" (fFull, titik = ribuan) ATAU di HP "Rp 2,95M" /
    // "Rp 189,73jt" (fRp + "Rp "). Getter: roll() mengambil KINDS[kind] SEKALI
    // di awal tiap guliran, tepat sesudah parse() teks tujuannya — jadi angka
    // antaranya ditulis dengan gaya yang sama dengan teks tujuan itu.
    get rp() {
      var short = rpShort;
      return { parse: parseRp, fmt: function (n) { return short ? 'Rp ' + fmtShort(n) : fmtRp(n); } };
    },
    // "189,73jt" / "850rb" / "2,95M" / "500" (fRp)
    short: {
      parse: parseShortMoney,
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
    var s = live[el.id], cb = null;
    if (s) {
      if (s.raf) cancelAnimationFrame(s.raf);
      if (s.timer) clearTimeout(s.timer);
      s.raf = 0; s.timer = 0;
      cb = s.done; s.done = null;
    }
    el.classList.remove('lg-rolling');
    el.removeAttribute('data-lg');
    if (cb) { try { cb(); } catch (e) { } }
  }

  // fmt (opsional) menimpa KINDS[kind].fmt — dipakai angka hero yang di HP
  // tampil singkat ("Rp 2,95M"). done (opsional) dipanggil sekali saat selesai.
  function roll(el, kind, dur, from, to, fmt, done) {
    var K = KINDS[kind];
    if (fmt) K = { parse: K.parse, fmt: fmt };
    var s = live[el.id] || (live[el.id] = {});
    s.to = to; s.done = done || null;
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
    // KINDS[kind] dibaca ulang setiap kali (KINDS.rp = getter yang mencatat
    // gaya teks terakhir — jangan disimpan di sini, lihat KINDS)
    var kind = TARGETS[id][0], dur = TARGETS[id][1];
    var last = KINDS[kind].parse(el.textContent.trim());
    new MutationObserver(function () {
      var to = KINDS[kind].parse(el.textContent.trim());
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

  /* ── 1b. ODOMETER — angka hero (#liveOmsetBig, #mOmsetBig) ───────────
     Tiap digit adalah pita vertikal yang berputar ke angka tujuannya,
     bergiliran dari kanan ke kiri (titik pemisah ribuan diam), di jendela
     yang dipotong pas di TINTA angka (tepi atas/bawah memudar), dengan
     blur gerak VERTIKAL saat cepat (salinan pita ber-filter SVG yang
     saling-silang dengan pita tajam), cahaya hijau saat mendarat, dan
     mendarat lembut (sedikit lewat lalu kembali). Prinsipnya sama dengan data-lg:
     teks ASLI tidak pernah ditulis ulang — langsung berisi nilai final,
     disembunyikan sesaat lewat .lg-rolling dengan data-lg kosong. Pita
     digambar di lapisan .hx-odo DI DALAM kartu hero (bukan di dalam elemen
     angka: subtree-nya diamati skrip lain), gaya hurufnya disalin dari
     elemen, lalu posisinya DIPERIKSA huruf per huruf terhadap teks asli.
     Meleset (> 1,5px mendatar / 0,75px tegak: font lain, baris patah lain)
     = batal, pakai guliran lama. Saat membuka halaman, guliran mulai dari angka yang TERAKHIR
     dilihat di HP ini (localStorage 'hx-last-omset' {month, value}) —
     yang bergulir adalah berita nyata; belum ada catatan bulan ini: dari 0.
     Penjualan baru saat layar terbuka: lencana "+Rp 5,78jt" naik & pudar. */
  var HERO = { liveOmsetBig: 1, mOmsetBig: 1 };
  var HERO_IDS = ['liveOmsetBig', 'mOmsetBig'];
  var SEEN_KEY = 'hx-last-omset';
  var heroes = {};        // id -> { el, shown, odo, after, pending, queued }
  var opening = null;     // halaman yang sedang dibuka showPage (sampai enterPage jalan)
  var RE_FULL = /^Rp\s?(\d{1,3}(?:\.\d{3})*)$/;          // "Rp 2.954.212.749"
  var RE_OLD = /^Rp\s?(\d+(?:\.\d+)?)([KMB])$/;           // dulu di HP: "Rp 3.0B" (M = juta)
  var RE_NEW = /^Rp\s?(\d+)(?:,(\d{1,2}))?(rb|jt|M)$/;    // sekarang di HP: "Rp 2,95M" (M = miliar)
  var OLD_U = { K: 1e3, M: 1e6, B: 1e9 }, NEW_U = { rb: 1e3, jt: 1e6, M: 1e9 };

  function ym(y, m) { return y + '-' + (m < 10 ? '0' : '') + m; }
  function thisMonth() { var d = new Date(); return ym(d.getFullYear(), d.getMonth() + 1); }
  // bulan yang sedang ditampilkan hero
  function heroCtx(id) {
    try {
      if (id === 'mOmsetBig') return ym(mYear, mMonth + 1);
      var d = od(vOff);
      return ym(d.getFullYear(), d.getMonth() + 1);
    } catch (e) { return '?'; }
  }
  function heroData(id) {
    try {
      if (!dataReady()) return null;
      return monthRev(id === 'mOmsetBig' ? new Date(mYear, mMonth, 1) : od(vOff));
    } catch (e) { return null; }
  }
  // Nilai PERSIS di balik teks hero. Bentuk lengkap dibaca langsung; bentuk
  // singkat di HP dicocokkan dengan total bulan itu dari data — supaya
  // pergantian bentuk teks tidak dikira penjualan baru, dan "Rp 190M" yang
  // ambigu (190 juta gaya lama / 190 miliar gaya baru) tidak salah baca.
  function heroValue(id, text) {
    var m = RE_FULL.exec(text);
    if (m) return +m[1].replace(/\./g, '');
    var c = [];
    if ((m = RE_OLD.exec(text))) c.push(+m[1] * OLD_U[m[2]], OLD_U[m[2]] * (m[1].indexOf('.') < 0 ? 1 : .1));
    if ((m = RE_NEW.exec(text))) c.push(+(m[1] + '.' + (m[2] || '0')) * NEW_U[m[3]], NEW_U[m[3]] * (m[2] ? Math.pow(10, -m[2].length) : 1));
    var d = c.length ? heroData(id) : null;
    // rupiah utuh, sama dengan bentuk lengkap: record berkoma (revenue 1.375) tidak
    // boleh jadi selisih palsu '−Rp 0' antara hero Dashboard dan Monthly
    for (var i = 0; i < c.length; i += 2) if (d !== null && Math.abs(d - c[i]) <= c[i + 1] * .51 + 1) return Math.round(d);
    return null;
  }
  function oldCompact(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }
  // fungsi format yang menghasilkan PERSIS gaya teks hero saat ini (null = tidak tahu)
  function heroFmt(text, v) {
    if (RE_FULL.test(text)) return fmtRp;
    var fs = [];
    try { if (window.HXChart && typeof HXChart.short === 'function') fs.push(HXChart.short); } catch (e) { }
    fs.push(fmtShort, oldCompact);
    for (var i = 0; i < fs.length; i++) {
      try {
        if ('Rp ' + fs[i](Math.round(v)) === text) {
          return (function (f) { return function (n) { return 'Rp ' + f(Math.round(n)); }; })(fs[i]);
        }
      } catch (e) { }
    }
    return null;
  }
  function seenGet(month) {
    try {
      var o = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
      return (o && o.month === month && typeof o.value === 'number' && o.value >= 0) ? o.value : null;
    } catch (e) { return null; }
  }
  function seenSet(month, v) {
    if (month !== thisMonth() || typeof v !== 'number' || !(v >= 0) || !dataReady()) return;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify({ month: month, value: v })); } catch (e) { }
  }
  function isShown(el) {
    if (root.classList.contains('hx-overlay-open')) return false;   // layar penuh fx-* menutupinya
    var pg = el && el.closest ? el.closest('.page') : null;
    return !!el && (!pg || pg.classList.contains('active')) && el.getClientRects().length > 0;
  }
  function heroRead(h) {
    var text = h.el.textContent.trim();
    return { text: text, v: heroValue(h.id, text), ctx: heroCtx(h.id), real: dataReady() };
  }
  // catat "sudah dilihat" — hanya angka yang benar-benar tampil di layar
  function heroSeen(h) {
    var s = h && h.shown;
    if (!s || !s.real || s.v === null || !isShown(h.el)) return;
    if (h.odo) seenSet(h.odo.ctx, h.odo.to); else seenSet(s.ctx, s.v);
  }
  function heroSeenAll() { HERO_IDS.forEach(function (id) { if (heroes[id]) heroSeen(heroes[id]); }); }

  function watchHero(id) {
    var el = document.getElementById(id);
    if (!el || el.__lgRoll) return;
    el.__lgRoll = true;
    var h = heroes[id] = { id: id, el: el, shown: null, odo: null, after: null, pending: false, queued: false };
    h.shown = heroRead(h);
    new MutationObserver(function () { heroChanged(h); })
      .observe(el, { childList: true, characterData: true, subtree: true });
  }
  function heroChanged(h) {
    var el = h.el, prev = h.shown, now = heroRead(h);
    h.shown = now;
    if (now.v === null) { heroStop(h); return; }
    var o = h.odo;
    if (o) {
      if (now.text === o.toText && now.ctx === o.ctx) return;           // render ulang, teks sama
      if (now.v === o.to && now.ctx === o.ctx) { heroRoll(h, o.from, now, o.mode, o.badge); return; } // bentuk teks lain, nilai sama
      h.pending = true;                                                  // nilai baru: susul setelah mendarat
      return;
    }
    var cl = live[el.id];
    if (cl && cl.raf) {                                                  // guliran cadangan sedang jalan
      if (now.v !== cl.to) roll(el, 'rp', 700, cl.cur, now.v, heroFmt(now.text, now.v), cl.done);
      return;
    }
    if (opening || h.queued) return;               // halaman sedang dibuka: enterPage yang menggulir
    if (!now.real || !isShown(el) || document.hidden) return;   // tidak terlihat = tidak dicatat "dilihat"
    if (REDUCED) {
      // Kurangi Gerak: angka langsung final, tanpa odometer. Data baru tetap
      // diberi tahu lewat lencana selisih yang hanya memudar (tanpa gerak).
      if (prev && prev.real && prev.v !== null && prev.ctx === now.ctx && now.v !== prev.v) heroBadge(h, now.v - prev.v);
      heroSeen(h);
      return;
    }
    // data pertama: skeleton membuat teks transparan — matikan dulu
    if (!loadingDone) endLoading();
    var from, mode, badge = true;
    if (!prev || !prev.real || prev.v === null) {                       // data pertama masuk
      from = seenGet(now.ctx);
      mode = from === null ? 'zero' : 'enter';
      if (from === null) { from = 0; badge = false; }
    } else if (prev.ctx !== now.ctx) { from = prev.v; mode = 'nav'; badge = false; }   // ganti bulan
    else { from = prev.v; mode = 'live'; }                               // data baru
    if (from === now.v) { heroSeen(h); return; }
    heroRoll(h, from, now, mode, badge);
  }
  // halaman hero dibuka: satu frame kemudian (skrip lain sempat mengganti
  // bentuk teks, mis. "Rp 2,95M" di HP), gulir dari angka terakhir dilihat
  function heroEnter(id) {
    var h = heroes[id];
    if (!h || h.queued) return;
    h.queued = true;
    var ran = false;
    function go() {
      if (ran) return;
      ran = true; h.queued = false;
      var cl = live[h.id];
      if (h.odo || (cl && cl.raf)) return;
      var now = heroRead(h);
      h.shown = now;
      if (now.v === null || !now.real || !isShown(h.el) || document.hidden) return;
      if (REDUCED) { heroSeen(h); return; }
      var seen = seenGet(now.ctx), from = seen === null ? 0 : seen;
      if (from === now.v) { heroSeen(h); return; }
      heroRoll(h, from, now, seen === null ? 'zero' : 'enter', seen !== null);
    }
    requestAnimationFrame(go);
    setTimeout(go, 250);          // rAF bisa tertahan (tab di latar)
  }
  // kembali dari layar kunci / tab lain: ada penjualan selama tidak dilihat?
  function heroWake() {
    if (REDUCED || document.hidden) return;
    HERO_IDS.forEach(function (id) {
      var h = heroes[id], cl = h && live[id];
      if (!h || h.odo || h.queued || (cl && cl.raf) || !isShown(h.el)) return;
      var now = heroRead(h);
      h.shown = now;
      if (now.v === null || !now.real) return;
      var seen = seenGet(now.ctx);
      if (seen === null || seen === now.v) return;
      heroRoll(h, seen, now, 'enter', true);
    });
  }
  function heroRoll(h, from, now, mode, badge) {
    var el = h.el, F = heroFmt(now.text, now.v), delta = now.v - from, o = null;
    heroStop(h);
    // lencana lama (guliran sebelumnya) minggir dulu — angka bisa memanjang ke tempatnya
    var ob = el.parentElement && el.parentElement.querySelector('.hx-odo-dl');
    if (ob) ob.parentNode.removeChild(ob);
    // dari 0: semua digit muncul dari kosong ("Rp " saja), bukan dari "Rp 0"
    var fromText = F ? (mode === 'zero' ? now.text.replace(/\d[\s\S]*$/, '') : F(from)) : '';
    if (F) o = odoStart(el, from, fromText, now, mode);
    if (o && o.none) {               // teks singkat sama persis (mis. 2,95M -> 2,95M): tanpa guliran
      if (badge) heroBadge(h, delta);
      heroSeen(h);
      return;
    }
    if (o) {
      o.badge = badge;
      h.odo = o;
      o.onDone = function () { heroDone(h, o); };
      o.timer = setTimeout(o.onDone, o.total + 900);   // pengaman
      if (badge) o.badgeT = setTimeout(function () { heroBadge(h, delta); }, o.landAt);
      return;
    }
    // bentuk teks tidak dikenal: angka antara tidak bisa ditulis dengan gaya
    // yang sama (bentuk lengkap terpotong di HP) — angka final langsung
    if (!F) {
      if (badge) heroBadge(h, delta);
      heroSeen(h);
      return;
    }
    // cadangan: guliran lama lewat data-lg
    var dur = mode === 'zero' ? 1150 : mode === 'live' ? 700 : 900;
    roll(el, 'rp', dur, from, now.v, F, function () { heroSeen(h); });
    if (badge) setTimeout(function () { heroBadge(h, delta); }, dur * .75);
  }
  // semua digit sudah mendarat (huruf lapisan kini teks biasa, persis teks
  // asli). Cahaya pendaratan memudar di BELAKANG huruf lapisan; sesudah itu
  // lapisan dibuang dan teks asli tampil — tukar tanpa beda satu piksel pun.
  function heroDone(h, o) {
    if (h.odo !== o) return;
    h.odo = null;
    clearTimeout(o.timer);
    // pita yang belum mendarat (pengaman waktu habis) dibuang; yang sedang memudar dibiarkan
    var ws = o.box.querySelectorAll('.hx-odo-w:not(.out)');
    for (var i = 0; i < ws.length; i++) ws[i].parentNode.removeChild(ws[i]);
    var sl = o.box.querySelectorAll('.hx-odo-s');
    for (i = 0; i < sl.length; i++) {
      if (sl[i].classList.contains('hx-odo-x')) sl[i].style.visibility = 'hidden';   // digit/pemisah yang hilang
      else sl[i].classList.add('on');
    }
    if (h.after) odoRemove(h.after);
    h.after = o;
    o.afterT = setTimeout(function () {
      if (h.after !== o) return;
      var cl = live[h.id];
      if (!h.odo && !(cl && cl.raf)) { h.el.classList.remove('lg-rolling'); h.el.removeAttribute('data-lg'); }
      // teks asli sudah tampil di bawahnya: lapisan memudar 140ms (selisih
      // sub-piksel tata letak inline-block di Safari tidak pernah terlihat)
      var end = function () { if (h.after === o) h.after = null; odoRemove(o); };
      try {
        var fo = o.box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'linear', fill: 'forwards' });
        o.anims.push(fo);
        fo.onfinish = end;
        o.afterT = setTimeout(end, 400);
      } catch (e) { end(); }
    }, 480);
    heroSeen(h);
    if (h.pending) {
      h.pending = false;
      var now = h.shown;
      if (now && now.v !== null && now.real && (now.v !== o.to || now.ctx !== o.ctx) &&
          isShown(h.el) && !document.hidden && !REDUCED) {
        heroRoll(h, o.to, now, now.ctx === o.ctx ? 'live' : 'nav', now.ctx === o.ctx);
      }
    }
  }
  function odoRemove(o) {
    clearTimeout(o.timer); clearTimeout(o.afterT); clearTimeout(o.badgeT);
    for (var i = 0; i < o.anims.length; i++) { try { o.anims[i].onfinish = null; o.anims[i].cancel(); } catch (e) { } }
    if (o.box.parentNode) o.box.parentNode.removeChild(o.box);
  }
  // potong sekarang juga: nilai final langsung tampil
  function heroStop(h) {
    var o = h.odo;
    h.odo = null; h.pending = false;
    if (o) odoRemove(o);
    if (h.after) { odoRemove(h.after); h.after = null; }
    var cl = live[h.id];
    if (cl && cl.raf) finish(h.el);
    h.el.classList.remove('lg-rolling');
    h.el.removeAttribute('data-lg');
  }
  function heroCutAll() {
    HERO_IDS.forEach(function (id) {
      var h = heroes[id];
      if (!h) return;
      if (h.odo || h.after) heroStop(h);
      var p = h.el.parentElement, b = p && p.querySelector('.hx-odo-dl');
      if (b) b.parentNode.removeChild(b);
    });
  }

  function isD(c) { return c >= '0' && c <= '9'; }
  function px(v) { return parseFloat(v) || 0; }
  function borderBoxW(cs) {
    var w = px(cs.width);
    return cs.boxSizing === 'border-box' ? w :
      w + px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);
  }
  function mk(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  // Susun teks "dari" dan "ke". Bagian bulat rata KANAN, desimal (sesudah
  // koma, bentuk singkat "2,95M") rata KIRI — "2,99M" -> "3M": 2 jadi 3,
  // ",99" hilang. Digit lawan digit = pita; pemisah yang sama = diam;
  // kelebihan = muncul (grow) / hilang (shrink). Satuan beda ("999,9jt" ->
  // "1M") = null: pakai guliran lama.
  function odoAlign(fs, ts) {
    var p = 0;
    while (p < fs.length && p < ts.length && fs[p] === ts[p] && !isD(ts[p])) p++;
    var fb = fs.slice(p), tb = ts.slice(p), fe = fb.length, te = tb.length;
    while (fe > 0 && !isD(fb[fe - 1])) fe--;
    while (te > 0 && !isD(tb[te - 1])) te--;
    var fsx = fb.slice(fe), tsx = tb.slice(te);
    if (fsx && fsx !== tsx) return null;
    fb = fb.slice(0, fe); tb = tb.slice(0, te);
    if (!tb || !isD(tb[0]) || (fb && !isD(fb[0]))) return null;
    var fc = fb.indexOf(','), tc = tb.indexOf(',');
    var out = odoPair(fc < 0 ? fb : fb.slice(0, fc), tc < 0 ? tb : tb.slice(0, tc), -1);
    if (out && (fc >= 0 || tc >= 0)) {
      out.push(fc < 0 ? { c: ',', grow: 1 } : tc < 0 ? { c: ',', shrink: 1 } : { c: ',' });
      var dec = odoPair(fc < 0 ? '' : fb.slice(fc + 1), tc < 0 ? '' : tb.slice(tc + 1), 1);
      out = dec ? out.concat(dec) : null;
    }
    if (!out) return null;
    if (tsx) out.push(fsx ? { c: tsx } : { c: tsx, grow: 1 });
    return { pre: ts.slice(0, p), body: out };
  }
  // pasangkan huruf teks a dengan teks b: rata kanan (side -1) / kiri (side 1)
  function odoPair(a, b, side) {
    var out = [], n = Math.max(a.length, b.length);
    for (var k = 0; k < n; k++) {
      var i = side < 0 ? a.length - 1 - k : k, j = side < 0 ? b.length - 1 - k : k;
      var x = i >= 0 && i < a.length ? a[i] : null, y = j >= 0 && j < b.length ? b[j] : null, t;
      if (x !== null && y !== null) {
        if (isD(x) && isD(y)) t = { d: 1, a: +x, b: +y };
        else if (x === y) t = { c: y };
        else return null;
      } else if (y !== null) t = isD(y) ? { d: 1, a: null, b: +y, grow: 1 } : { c: y, grow: 1 };
      else t = isD(x) ? { d: 1, a: +x, b: null, shrink: 1 } : { c: x, shrink: 1 };
      if (side < 0) out.unshift(t); else out.push(t);
    }
    return out;
  }
  // angka yang dilewati satu pita, dari awal sampai akhir (null = kosong)
  function odoSeq(a, b, steps, dir) {
    var s = [a], end = b === null ? a + dir * (steps - 1) : b;
    for (var k = 1; k <= steps; k++) {
      if (b === null && k === steps) { s.push(null); break; }
      s.push(((end - dir * (steps - k)) % 10 + 10) % 10);
    }
    return s;
  }
  var ODO_COPY = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant-numeric',
    'font-variant-ligatures', 'font-variant-caps', 'font-feature-settings', 'font-variation-settings', 'font-kerning',
    'font-optical-sizing', 'font-synthesis', 'font-size-adjust', 'letter-spacing', 'word-spacing', 'line-height',
    'text-transform', 'text-align', 'text-indent', 'white-space', 'overflow-wrap', 'word-break', 'text-rendering',
    'direction', '-webkit-font-smoothing', '-moz-osx-font-smoothing', 'padding-top', 'padding-right',
    'padding-bottom', 'padding-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'];
  // [durasi satu pita ms, jeda antar digit ms] per jenis guliran
  var ODO_T = { zero: [1250, 34], enter: [1100, 48], live: [900, 52], nav: [760, 30] };

  // kelas perangkat untuk odometer. iPhone dihitung minimal 'mid': Safari iOS
  // tidak memberi deviceMemory dan membatasi hardwareConcurrency, padahal GPU-nya kuat.
  function odoTier() {
    var t = (window.HX && HX.tier) || 'high';
    if (t === 'low' && /iPhone|iPad|iPod/.test(navigator.userAgent || '') &&
        !(navigator.connection && navigator.connection.saveData)) t = 'mid';
    return t;
  }
  // filter SVG blur VERTIKAL saja (stdDeviation "0 y"), satu per ukuran huruf.
  // Filter ada di salinan pita yang hanya digeser transform — digambar sekali,
  // bukan per frame. '' = gagal dibuat (odometer jalan tanpa blur).
  function odoBlur(fs) {
    var d = Math.round(Math.max(1.5, Math.min(7, fs * .07)) * 2) / 2;
    var id = 'hx-odo-vb' + String(d).replace('.', '_');
    if (document.getElementById(id)) return id;
    try {
      var NS = 'http://www.w3.org/2000/svg', svg = document.getElementById('hx-odo-svg');
      if (!svg) {
        svg = document.createElementNS(NS, 'svg');
        svg.id = 'hx-odo-svg';
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
        document.body.appendChild(svg);
      }
      var f = document.createElementNS(NS, 'filter');
      f.id = id;
      f.setAttribute('x', '-10%'); f.setAttribute('y', '-10%');
      f.setAttribute('width', '120%'); f.setAttribute('height', '120%');
      f.setAttribute('color-interpolation-filters', 'sRGB');
      var g = document.createElementNS(NS, 'feGaussianBlur');
      g.setAttribute('stdDeviation', '0 ' + d);
      f.appendChild(g);
      svg.appendChild(f);
      return id;
    } catch (e) { return ''; }
  }
  // Tinggi TINTA angka (bukan tinggi baris), per font, dari canvas
  // measureText: a = tinggi tinta di atas garis dasar, d = di bawahnya,
  // A/D = ascent/descent font (kotak teks Range). Jendela pita dipotong pas
  // di tinta + sedikit ruang: saat berguling yang terlihat hanya potongan
  // angka masuk/keluar yang memudar, bukan tumpukan dua angka utuh.
  // Gagal / angka aneh -> perkiraan aman (0,76em, jendela sedikit longgar).
  var inkCache = {};
  function digitInk(cs) {
    var fs = px(cs.fontSize), key = cs.fontStyle + '|' + cs.fontWeight + '|' + cs.fontSize + '|' + cs.fontFamily;
    if (inkCache[key]) return inkCache[key];
    var r = { a: .76 * fs, d: .03 * fs, A: 0, D: 0 };
    try {
      var c = document.createElement('canvas').getContext('2d');
      c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      var m = c.measureText('0123456789'), a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
      if (a > .55 * fs && a < .9 * fs && d > -.1 * fs && d < .12 * fs) { r.a = a; r.d = Math.max(0, d); }
      if (m.fontBoundingBoxAscent > .5 * fs && m.fontBoundingBoxDescent >= 0) { r.A = m.fontBoundingBoxAscent; r.D = m.fontBoundingBoxDescent; }
    } catch (e) { }
    return (inkCache[key] = r);
  }
  function odoStart(el, from, fromText, now, mode) {
    var box = null;
    try {
      if (!el.animate) return null;
      var tn = el.firstChild, toText = now.text;
      if (!tn || tn.nodeType !== 3 || el.childNodes.length !== 1 || tn.data !== toText) return null;
      var hero = el.parentElement;
      if (!hero || getComputedStyle(hero).position === 'static') return null;
      var al = odoAlign(fromText, toText);
      if (!al) return null;
      var dir = now.v >= from ? 1 : -1, body = al.body, i, pos = 0, fI = '', tI = '', moving = 0;
      for (i = body.length - 1; i >= 0; i--) if (body[i].d) body[i].pos = pos++;
      body.forEach(function (t) { if (t.d) { if (t.a !== null) fI += t.a; if (t.b !== null) tI += t.b; } });
      var fN = +fI || 0, tN = +tI || 0;
      // langkah tiap pita: digit yang tidak berubah diam; dari 0 (bulan
      // baru) digit kanan berputar lebih banyak — terasa "menghitung"
      body.forEach(function (t) {
        if (!t.d) { if (t.grow || t.shrink) moving++; return; }
        var p10 = Math.pow(10, t.pos), chg = Math.abs(Math.floor(tN / p10) - Math.floor(fN / p10));
        if (t.a !== null && t.b !== null) {
          var base = dir > 0 ? (t.b - t.a + 10) % 10 : (t.a - t.b + 10) % 10;
          t.steps = base + 10 * (mode === 'zero' && chg >= 10 ? (t.pos < 2 ? 2 : 1) : 0);
        } else if (t.a === null) t.steps = mode === 'zero' ? t.b + 1 + (t.pos < 4 ? 10 : 0) : 1;
        else t.steps = 1;
        if (t.steps) moving++;
      });
      if (!moving) return { none: true };

      var cs = getComputedStyle(el);
      var color = el.classList.contains('lg-rolling') ? (el.style.getPropertyValue('--lg-c') || '#fff') : cs.color;
      var tier = odoTier();
      // blur gerak: salinan pita yang diburamkan VERTIKAL (filter SVG), jalan
      // sinkron dengan pita tajam; keduanya saling-silang menurut kecepatan
      var vb = (tier === 'low' || mode === 'nav') ? '' : odoBlur(px(cs.fontSize));
      var glow = mode !== 'nav';
      box = mk('div', 'hx-odo');
      box.setAttribute('aria-hidden', 'true');
      var st = box.style;
      ODO_COPY.forEach(function (p) { var v = cs.getPropertyValue(p); if (v) st.setProperty(p, v); });
      st.color = color;
      st.setProperty('--hx-odo-c', color);
      st.boxSizing = 'border-box';
      var W = borderBoxW(cs);
      if (!(W > 0)) return null;
      st.width = W + 'px'; st.left = '0px'; st.top = '0px';
      // satu baris? -> nowrap: angka yang sedang memanjang tidak pindah baris
      var rg = document.createRange();
      rg.selectNodeContents(tn);
      var rs = rg.getClientRects(), tops = {}, nl = 0;
      for (i = 0; i < rs.length; i++) { var tk = Math.round(rs[i].top); if (!tops[tk]) { tops[tk] = 1; nl++; } }
      if (nl <= 1) st.whiteSpace = 'nowrap';

      var map = [], slots = [], run = '';
      var txt = function (par, s) {
        var n = document.createTextNode(s);
        par.appendChild(n);
        for (var q = 0; q < s.length; q++) map.push([n, q]);
      };
      if (al.pre) txt(box, al.pre);
      var num = mk('span', 'hx-odo-n', box);
      var flush = function () { if (run) { txt(num, run); run = ''; } };
      body.forEach(function (t) {
        if (!t.d && !t.grow && !t.shrink) { run += t.c; return; }
        if (t.d && !t.steps) { run += String(t.b); return; }
        flush();
        var sp = mk('span', 'hx-odo-s' + (t.shrink ? ' hx-odo-x' : ''), num), sl = { t: t, sp: sp };
        if (!t.d) {                                   // pemisah yang muncul / hilang
          sp.className = 'hx-odo-s hx-odo-t' + (t.shrink ? ' hx-odo-x' : '');
          if (t.grow) txt(sp, t.c); else sp.appendChild(document.createTextNode(t.c));
        } else {
          if (t.b !== null) txt(sp, String(t.b)); else sp.appendChild(document.createTextNode(String(t.a)));
          if (glow && t.b !== null) sl.gl = mk('span', 'hx-odo-gl', sp);
          var w = sl.w = mk('span', 'hx-odo-w' + (tier === 'low' ? '' : ' fade'), sp);
          sl.m = mk('span', 'hx-odo-m', w);
          var seq = odoSeq(t.a, t.b, t.steps, dir);
          if (dir < 0) seq.reverse();
          var html = seq.map(function (x) { return '<i>' + (x === null ? '\u00a0' : x) + '</i>'; }).join('');
          sl.n = seq.length;
          // Pita dipasang supaya angka TUJUAN tepat di posisi tata letak saat
          // transform = 0 (naik: pita digantung dari bawah; turun: dari atas).
          // Diam di transform 0 = digambar persis seperti teks asli; transform
          // pecahan piksel di akhir membuat Chrome menggeser lapisan 1px.
          var rc = 'hx-odo-r' + (dir > 0 ? ' up' : '');
          if (vb && t.steps >= 2) { sl.b = mk('span', rc + ' b', sl.m); sl.b.innerHTML = html; sl.b.style.filter = 'url(#' + vb + ')'; }
          sl.r = mk('span', rc, sl.m);
          sl.r.innerHTML = html;
        }
        slots.push(sl);
      });
      flush();
      hero.appendChild(box);

      var er = el.getBoundingClientRect(), b0 = box.getBoundingClientRect(), sc = er.width / W;
      if (!(sc > .5 && sc < 2)) return odoFail(box, 'scale');
      slots.forEach(function (s) { if (s.t.grow || s.t.shrink) s.nat = s.sp.getBoundingClientRect().width / sc; });
      slots.forEach(function (s) { if (s.t.shrink) s.sp.style.width = '0px'; });
      st.left = (er.left - b0.left) / sc + 'px';
      st.top = (er.top - b0.top) / sc + 'px';
      // PERIKSA: setiap huruf lapisan harus tepat di atas huruf aslinya
      if (map.length !== toText.length) return odoFail(box, 'map');
      var b1 = box.getBoundingClientRect();
      if (Math.abs(b1.left - er.left) > .5 || Math.abs(b1.top - er.top) > .5) return odoFail(box, 'box', [b1.left, b1.top, er.left, er.top]);
      var r2 = document.createRange();
      for (i = 0; i < map.length; i++) {
        rg.setStart(tn, i); rg.setEnd(tn, i + 1);
        r2.setStart(map[i][0], map[i][1]); r2.setEnd(map[i][0], map[i][1] + 1);
        var x = rg.getBoundingClientRect(), y = r2.getBoundingClientRect();
        // Toleransi 1,5px: WebKit membulatkan kotak huruf teks biasa ke piksel
        // penuh (huruf di inline-block tetap pecahan), juga saat halaman masih
        // diskalakan animasi masuk. Salah font / baris patah lain meleset jauh
        // lebih besar dari itu. Kecocokan piksel sebenarnya diuji terpisah.
        if (Math.abs(x.left - y.left) > 1.5 || Math.abs(x.top - y.top) > .75 || Math.abs(x.right - y.right) > 1.5) return odoFail(box, 'char ' + i, [x.left, x.top, x.right, y.left, y.top, y.right]);
      }
      for (i = 0; i < slots.length; i++) {
        var s0 = slots[i];
        if (!s0.r) continue;
        s0.step = s0.r.getBoundingClientRect().height / sc / s0.n;
        if (!(s0.step > 0)) return odoFail(box, 'step');
      }
      // Jendela pita = tinta angka + ruang mg (tepi yang memudar). Garis
      // dasar diukur dengan penanda kosong 0x0 di baris lapisan (tidak
      // mengubah tata letak). Semua slot satu baris, satu font -> satu nilai,
      // dipasang sebagai variabel CSS di lapisan. Tidak masuk akal = jendela lama.
      var ws0 = null;
      for (i = 0; i < slots.length && !ws0; i++) if (slots[i].w) ws0 = slots[i];
      if (ws0) {
        var ink = digitInk(cs), fz = px(cs.fontSize), mg = Math.max(3, fz * .14);
        var pb = mk('span', '', num);
        pb.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline';
        var base = pb.getBoundingClientRect().bottom, sr = ws0.sp.getBoundingClientRect();
        num.removeChild(pb);
        var wt = (base - sr.top) / sc - ink.a - mg, wb = (sr.bottom - base) / sc - ink.d - mg;
        if (wt > -.35 * fz && wt < .45 * fz && wb > -.35 * fz && wb < .45 * fz) {
          st.setProperty('--hx-wt', wt.toFixed(2) + 'px');
          st.setProperty('--hx-wb', wb.toFixed(2) + 'px');
          st.setProperty('--hx-wf', mg.toFixed(2) + 'px');
          st.setProperty('--hx-gy', ((wt - wb) / 2).toFixed(2) + 'px');
        }
      }

      // teks asli disembunyikan (data-lg kosong = ::after kosong)
      el.style.setProperty('--lg-c', color);
      el.setAttribute('data-lg', '');
      el.classList.add('lg-rolling');

      var T = ODO_T[mode] || ODO_T.live, dur = T[0], stg = T[1];
      var o = { box: box, anims: [], left: 0, from: from, to: now.v, toText: toText, ctx: now.ctx, mode: mode };
      var E1 = 'cubic-bezier(.3,0,.12,1)', E2 = 'cubic-bezier(.4,0,.3,1)';
      // pita mendarat: angka biasa (tata letak = teks asli) muncul di bawahnya
      // dan pita memudar 160ms di atasnya. Lapisan GPU bisa digambar ±1
      // piksel perangkat dari teks biasa; pudar silang membuat selisih itu
      // terbaca sebagai "fokus", bukan lompatan.
      var settle = function (s) {
        return function () {
          if (s.t.shrink) {
            s.sp.style.visibility = 'hidden';
            if (s.w && s.w.parentNode) s.w.parentNode.removeChild(s.w);
          } else {
            s.sp.classList.add('on');
            if (s.w) {
              s.w.classList.add('out');
              try {
                var fa = s.w.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
                o.anims.push(fa);
                fa.onfinish = function () { if (s.w.parentNode) s.w.parentNode.removeChild(s.w); };
              } catch (e) { if (s.w.parentNode) s.w.parentNode.removeChild(s.w); }
            }
          }
          if (--o.left === 0 && o.onDone) o.onDone();
        };
      };
      var last = 0, idx = 0;
      for (i = slots.length - 1; i >= 0; i--) {         // kanan -> kiri
        var s = slots[i], dl = idx++ * stg;
        last = dl;
        if (s.t.grow || s.t.shrink) {
          // dari 0 (bulan baru): tata letak final sejak frame pertama, digit
          // muncul dari kosong — lebar tidak dianimasikan (huruf tidak tumpang tindih)
          if (mode !== 'zero') o.anims.push(s.sp.animate(s.t.grow ? [{ width: '0px' }, { width: s.nat + 'px' }] : [{ width: s.nat + 'px' }, { width: '0px' }],
            { duration: dur * .62, delay: dl, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }));
          if (!s.t.d) o.anims.push(s.sp.animate(s.t.grow ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
            { duration: dur * .5, delay: dl + (s.t.grow ? dur * .12 : 0), easing: 'ease-out', fill: 'both' }));
        }
        if (!s.r) continue;
        var y0 = dir * (s.n - 1) * s.step, y1 = 0;
        // lewat sedikit, lalu kembali — tetap di dalam ruang tepi jendela (mg)
        var os = -dir * Math.min(.06, .025 + .005 * s.t.steps) * s.step;
        var kf = [
          { transform: 'translate3d(0,' + y0 + 'px,0)', easing: E1 },
          { offset: .8, transform: 'translate3d(0,' + (y1 + os) + 'px,0)', easing: E2 },
          { transform: 'translate3d(0,' + y1 + 'px,0)' }
        ];
        var a = s.r.animate(kf, { duration: dur, delay: dl, fill: 'both' });
        a.onfinish = settle(s);
        o.anims.push(a);
        o.left++;
        // blur gerak: kecepatan pita memuncak di ±16% durasi (kurva E1), di
        // atas rata-rata dari ±7% sampai ±36%. Di jendela itu salinan buram
        // menggantikan pita tajam; pita tajam kembali sebelum mendarat. Pita
        // pendek (1-2 langkah) hampir tidak buram — memang lambat.
        if (s.b) {
          var bk = .82 * Math.min(1, (s.t.steps - 1) / 5), lo = 1 - .72 * bk;
          o.anims.push(s.b.animate(kf, { duration: dur, delay: dl, fill: 'both' }));
          o.anims.push(s.b.animate([{ opacity: 0 }, { opacity: bk, offset: .1 }, { opacity: bk, offset: .26 }, { opacity: 0, offset: .48 }, { opacity: 0 }],
            { duration: dur, delay: dl, fill: 'both' }));
          o.anims.push(s.r.animate([{ opacity: 1 }, { opacity: lo, offset: .1 }, { opacity: lo, offset: .26 }, { opacity: 1, offset: .48 }, { opacity: 1 }],
            { duration: dur, delay: dl, fill: 'both' }));
        }
        if (s.t.steps >= 2 && tier !== 'low') {
          o.anims.push(s.m.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(1.1)', offset: .22 }, { transform: 'scaleY(1)', offset: .6 }, { transform: 'scaleY(1)' }],
            { duration: dur, delay: dl, easing: 'ease-in-out', fill: 'both' }));
        }
        if (s.gl) {
          o.anims.push(s.gl.animate([
            { opacity: 0, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(.6)', offset: .52 },
            { opacity: 1, transform: 'scale(1)', offset: .74 }, { opacity: 0, transform: 'scale(1.35)' }
          ], { duration: dur + 420, delay: dl, fill: 'both' }));
        }
      }
      o.total = last + dur;
      o.landAt = last + dur * .72;
      if (!o.left) setTimeout(function () { if (o.onDone) o.onDone(); }, o.total);
      return o;
    } catch (e) {
      return odoFail(box, 'error', String(e && e.message));
    }
  }
  // batal: lapisan dibuang, guliran lama dipakai. Alasannya dicatat di
  // window.__lgOdoWhy (hanya kalau array itu dibuat — alat tes, bukan untuk app)
  function odoFail(box, why, info) {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    try { if (window.__lgOdoWhy) window.__lgOdoWhy.push([why, info]); } catch (e) { }
    return null;
  }

  // "+Rp 5,78jt" — format singkat app.js (fRp: 850rb · 23,45jt · 2,95M).
  // Cadangan kalau fRp masih gaya lama: aturan yang sama, ditulis di sini.
  function idShort(n) {
    n = Math.round(n);
    try { var f = fmtShort(n); if (/^\d+(?:,\d{1,2})?(?:rb|jt|M)$|^\d{1,3}$/.test(f)) return f; } catch (e) { }
    var dec = function (c) { var w = Math.floor(c / 100), r = c % 100; return r ? w + ',' + (r < 10 ? '0' : '') + r : String(w); };
    if (n >= 999995000) return dec(Math.round(n / 1e7)) + 'M';
    if (n >= 999500) return dec(Math.round(n / 1e4)) + 'jt';
    if (n >= 1000) return Math.round(n / 1e3) + 'rb';
    return String(n);
  }
  // lencana selisih di samping angka hero (atau di atasnya kalau tidak muat)
  function heroBadge(h, delta) {
    var el = h.el, hero = el.parentElement, tn = el.firstChild;
    if (!delta || !hero || !tn || tn.nodeType !== 3 || !tn.length || !isShown(el) || document.hidden) return;
    var old = hero.querySelector('.hx-odo-dl');
    if (old) old.parentNode.removeChild(old);
    var b = mk('span', 'hx-odo-dl' + (delta < 0 ? ' neg' : ''));
    b.setAttribute('aria-hidden', 'true');
    b.textContent = (delta > 0 ? '+' : '\u2212') + 'Rp ' + idShort(Math.abs(delta));
    var cs = getComputedStyle(el), fs = px(cs.fontSize);
    b.style.fontFamily = cs.fontFamily;
    b.style.fontSize = Math.round(Math.max(11, Math.min(15, fs * .21)) * 10) / 10 + 'px';
    hero.appendChild(b);
    // semua ukuran di bawah dalam px CSS kartu hero (asal = tepi dalam border)
    var hcs = getComputedStyle(hero), hr = hero.getBoundingClientRect(), sc = hr.width / borderBoxW(hcs) || 1;
    var LX = function (v) { return (v - hr.left) / sc - hero.clientLeft; };
    var TY = function (v) { return (v - hr.top) / sc - hero.clientTop; };
    var rg = document.createRange();
    rg.setStart(tn, tn.length - 1); rg.setEnd(tn, tn.length);
    var lr = rg.getBoundingClientRect();
    rg.setStart(tn, 0);
    var left = LX(rg.getBoundingClientRect().left), right = LX(lr.right);
    // garis dasar & tinta angka: kotak Range = ascent+descent font
    var ink = digitInk(cs), lh = lr.height / sc;
    var base = TY(lr.top) + (ink.A && Math.abs(ink.A + ink.D - lh) <= 2 ? ink.A : lh * .8);
    var inkTop = base - ink.a, bw = b.offsetWidth, bh = b.offsetHeight;
    var cw = hero.clientWidth, padL = px(hcs.paddingLeft), padR = px(hcs.paddingRight), padT = px(hcs.paddingTop);
    var gap = Math.max(10, fs * .16), g = Math.max(6, fs * .11), x, y, rise;
    if (right + gap + bw <= cw - Math.min(padR, Math.max(8, padR / 2))) {   // di kanan angka, sejajar tengah tinta
      x = right + gap; y = base - ink.a / 2 - bh / 2; rise = 12;
      b.style.transformOrigin = '0 50%';
    } else {
      // di atas ujung angka, di celah antara baris judul (label, tombol
      // "View watchlist" + garisnya) dan tinta angka. Celah sempit di ujung
      // kanan (HP) -> geser ke kiri tombol, tetap di atas angka.
      var obs = [];
      var take = function (n) {
        var r = n.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (!n.children.length || /^(A|BUTTON)$/.test(n.tagName)) obs.push({ l: LX(r.left), r: LX(r.right), b: TY(r.bottom) });
        else for (var k = 0; k < n.children.length; k++) take(n.children[k]);
      };
      for (var sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) take(sib);
      var topFor = function (x1) {
        var t = padT;
        obs.forEach(function (o) { if (o.r > x1 - bw - 6 && o.l < x1 + 6) t = Math.max(t, o.b); });
        return t;
      };
      var fits = function (t) { return inkTop - g - bh >= t + 6; };
      var x1 = Math.min(right, cw - padR), t = topFor(x1);
      if (!fits(t)) {
        var lim = x1;
        obs.forEach(function (o) { if (o.r > x1 - bw - 6 && o.l < x1 + 6 && o.b > inkTop - g - bh - 6) lim = Math.min(lim, o.l - 10); });
        if (lim < x1 && lim - bw >= Math.max(padL, left + (right - left) * .3) && fits(topFor(lim))) { x1 = lim; t = topFor(lim); }
      }
      x = x1 - bw;
      y = Math.min(Math.max(t + 3, inkTop - g - bh), inkTop - 2 - bh);
      rise = Math.max(3, Math.min(10, y - t - 2));
      b.style.transformOrigin = '100% 100%';
    }
    b.style.left = x + 'px';
    b.style.top = y + 'px';
    var kf = REDUCED ? [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: .74 }, { opacity: 0 }] : [
      { opacity: 0, transform: 'translate3d(0,8px,0) scale(.86)', easing: 'cubic-bezier(.2,1.25,.4,1)' },
      { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', offset: .13 },
      { opacity: 1, transform: 'translate3d(0,-3px,0) scale(1)', offset: .7, easing: 'cubic-bezier(.45,0,.6,1)' },
      { opacity: 0, transform: 'translate3d(0,' + (-rise) + 'px,0) scale(.97)' }
    ];
    var gone = function () { if (b.parentNode) b.parentNode.removeChild(b); };
    try { b.animate(kf, { duration: 2700, fill: 'both' }).onfinish = gone; } catch (e) { b.style.opacity = '1'; }
    setTimeout(gone, 3200);
  }
  function odoCss() {
    if (document.getElementById('hx-odo-css')) return;
    var st = document.createElement('style');
    st.id = 'hx-odo-css';
    st.textContent =
      '.hx-odo{position:absolute;z-index:1;margin:0;pointer-events:none;-webkit-user-select:none;user-select:none;' +
        'background:none;border-style:solid;border-color:transparent;box-shadow:none;text-shadow:none}' +
      '.hx-odo-n{white-space:nowrap}' +
      '.hx-odo-s{display:inline-block;position:relative;vertical-align:baseline;color:transparent}' +
      '.hx-odo-s.on,.hx-odo-t{color:inherit}' +
      // jendela pita = tinta angka + ruang --hx-wf (diukur di odoStart:
      // --hx-wt/--hx-wb = jarak dari tepi atas/bawah slot); tepi atas/bawah
      // memudar di ruang itu. Cadangan: kotak baris +.06em (cara lama).
      '.hx-odo-w{position:absolute;left:-.32em;right:-.32em;top:var(--hx-wt,-.06em);bottom:var(--hx-wb,-.06em);overflow:hidden}' +
      '.hx-odo-w.fade{-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 var(--hx-wf,.2em),#000 calc(100% - var(--hx-wf,.2em)),transparent 100%);' +
        'mask-image:linear-gradient(180deg,transparent 0,#000 var(--hx-wf,.2em),#000 calc(100% - var(--hx-wf,.2em)),transparent 100%)}' +
      '.hx-odo-m{position:absolute;left:0;top:0;right:0;bottom:0}' +
      '.hx-odo-r{position:absolute;left:.32em;top:calc(-1 * var(--hx-wt,-.06em));color:var(--hx-odo-c,#fff);text-align:left;white-space:pre}' +
      '.hx-odo-r>i{display:block;font:inherit}' +
      '.hx-odo-r.up{top:auto;bottom:calc(-1 * var(--hx-wb,-.06em))}' +
      // salinan buram: putih kehijauan tipis (hijau "cair" hanya di gerak)
      '.hx-odo-r.b{opacity:0;color:#d9ffe4}' +
      // cahaya pendaratan DI BELAKANG angka (z-index -1 di dalam lapisan)
      '.hx-odo-gl{position:absolute;z-index:-1;left:50%;top:50%;width:1.7em;height:1.25em;margin:calc(-.62em + var(--hx-gy,0px)) 0 0 -.85em;border-radius:50%;opacity:0;' +
        'background:radial-gradient(closest-side,rgba(48,209,88,.32),rgba(48,209,88,.09) 58%,rgba(48,209,88,0))}' +
      '.hx-odo-dl{position:absolute;z-index:3;left:0;top:0;pointer-events:none;white-space:nowrap;opacity:0;' +
        'font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:.01em;line-height:1;padding:.38em .68em .36em;border-radius:999px;' +
        'color:#46e06d;background:linear-gradient(180deg,rgba(48,209,88,.22),rgba(48,209,88,.08)),rgba(9,20,13,.9);' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,.16),inset 0 0 0 1px rgba(48,209,88,.4),0 8px 22px -8px rgba(48,209,88,.55)}' +
      '.hx-odo-dl.neg{color:#ff6b62;background:linear-gradient(180deg,rgba(255,69,58,.2),rgba(255,69,58,.07)),rgba(22,10,10,.9);' +
        'box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 0 0 0 1px rgba(255,69,58,.4),0 8px 22px -8px rgba(255,69,58,.45)}' +
      // target harian tembus: lapisan di DALAM kartu (terpotong sudutnya)
      '.hx-win{position:absolute;top:0;right:0;bottom:0;left:0;z-index:2;pointer-events:none;overflow:hidden;border-radius:inherit}' +
      '.hx-win>canvas{position:absolute;top:0;left:0;pointer-events:none}' +
      '.hx-win-rim{position:absolute;top:0;right:0;bottom:0;left:0;border-radius:inherit;opacity:0;' +
        'box-shadow:inset 0 0 0 1px rgba(48,209,88,.62),inset 0 1px 0 rgba(255,255,255,.2),inset 0 0 36px -6px rgba(48,209,88,.3)}';
    (document.head || document.documentElement).appendChild(st);
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
  }

  /* ── 5. animasi masuk halaman ─────────────────────────────────────── */
  // .lg-enter hanya terpasang ±2 detik setelah halaman dibuka. Di luar jendela
  // itu, render ulang dari Firebase dan grafik yang digambar ulang tiap 15
  // detik (reference-dashboard.js) TIDAK beranimasi ulang.
  // Yang beranimasi hanya elemen bertanda .lg-in: yang ADA dan TERLIHAT di
  // layar saat halaman dibuka (kartu di bawah layar / di balik bar navigasi
  // HP langsung tampil diam — hemat GPU). Kalau Firebase merender ulang di
  // tengah animasi, elemen baru melanjutkan dari titik yang sama (lanjut()),
  // bukan berkedip hilang lalu mulai lagi.
  var ENTER_MS = 2400;
  var IN_SEL = '.spc,.kpi-card,.ins-kpi-card,.hday,.wl-row,.nr-item,.lbi,.mk,.warn-crit-card,' +
               '.sp-lookup-card,.spg-team-hdr,.pi,.ref-chart-line,.ref-chart-area,.ref-chart-dot,.goal-bar-fill';
  var ENTER_ROLL = {
    'page-dashboard': ['liveOmsetBig', 'K1', 'K2', 'totalRev', 'goalPct'],
    'page-monthly': ['mOmsetBig']
  };
  // batas bawah layar yang benar-benar terlihat (di atas bar navigasi bawah HP)
  function fold() {
    var lim = innerHeight, nw = document.querySelector('.nav-wrapper');
    if (nw) {
      var r = nw.getBoundingClientRect();
      if (r.height && r.top > innerHeight / 2 && r.top < lim) lim = r.top;
    }
    return lim;
  }
  function onScreen(list, lim) {
    var out = [], rs = list.map(function (n) { return n.isConnected ? n.getBoundingClientRect() : null; });
    // tinggi/lebar 0 = di dalam tampilan yang tersembunyi (mis. tab Product)
    for (var i = 0; i < list.length; i++) if (rs[i] && rs[i].top < lim && (rs[i].width || rs[i].height)) out.push(list[i]);
    return out;
  }
  function endEnter(page) {
    clearTimeout(page.__lgEnterT);
    if (page.__lgMO) { page.__lgMO.disconnect(); page.__lgMO = null; }
    page.classList.remove('lg-enter');
    (page.__lgIn || []).forEach(function (n) { n.classList.remove('lg-in'); n.style.animationDelay = ''; });
    page.__lgIn = [];
  }
  // render ulang di dalam jendela: tandai elemen pengganti dan beri delay
  // negatif (= delay aslinya - waktu yang sudah berjalan) supaya animasinya
  // menyambung tanpa kedip.
  function lanjut(page) {
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function (recs) {
      var add = [];
      recs.forEach(function (r) {
        for (var i = 0; i < r.addedNodes.length; i++) {
          var n = r.addedNodes[i];
          if (n.nodeType !== 1) continue;
          if (n.matches(IN_SEL)) add.push(n);
          var q = n.querySelectorAll(IN_SEL);
          for (var j = 0; j < q.length; j++) add.push(q[j]);
        }
      });
      if (!add.length) return;
      var pick = onScreen(add, fold());
      if (!pick.length) return;
      var gone = (performance.now() - page.__lgAt) / 1000;
      pick.forEach(function (n) { n.classList.add('lg-in'); });
      var all = pick.slice();
      pick.forEach(function (n) {
        if (n.classList.contains('wl-row')) all.push.apply(all, n.querySelectorAll('.wl-spark path'));
      });
      var d = all.map(function (n) { return parseFloat(getComputedStyle(n).animationDelay) || 0; });
      all.forEach(function (n, i) {
        n.style.animationDelay = (d[i] - gone).toFixed(3) + 's';
        page.__lgIn.push(n);
      });
    });
    mo.observe(page, { childList: true, subtree: true });
    page.__lgMO = mo;
  }
  function enterPage(id, rollFromZero) {
    var page = document.getElementById(id);
    if (!page || REDUCED) return;
    endEnter(page);
    void page.offsetWidth;                       // mulai ulang animasi CSS
    var pick = onScreen(Array.prototype.slice.call(page.querySelectorAll(IN_SEL)), fold());
    pick.forEach(function (n) { n.classList.add('lg-in'); });
    page.__lgIn = pick;
    // animasi CSS mulai di frame berikutnya, bukan sekarang — di HP lambat
    // selisihnya bisa ratusan ms. Waktu frame itu yang dipakai lanjut().
    var at = page.__lgAt = performance.now();
    requestAnimationFrame(function (ts) { if (page.__lgAt === at) page.__lgAt = ts; });
    page.classList.add('lg-enter');
    page.__lgEnterT = setTimeout(function () { endEnter(page); }, ENTER_MS);
    lanjut(page);
    sheen(page);
    if (rollFromZero && !document.hidden) {
      (ENTER_ROLL[id] || []).forEach(function (eid) {
        // angka hero: odometer dari angka TERAKHIR dilihat (bukan dari 0)
        if (HERO[eid] && heroes[eid]) { heroEnter(eid); return; }
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
        // kartu di dalam panel (mis. baris peringkat): panel luarnya juga
        // ikut, supaya cahayanya tidak membeku di posisi lama
        var cs = [], n = p.c;
        while (n) { cs.push(n); n = n.parentElement ? n.parentElement.closest(SPOT) : null; }
        var bs = cs.map(function (c) { return c.getBoundingClientRect(); });
        cs.forEach(function (c, i) {
          c.style.setProperty('--mx', (p.x - bs[i].left) + 'px');
          c.style.setProperty('--my', (p.y - bs[i].top) + 'px');
        });
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

  /* ── 3. target harian tembus: jawaban kecil DI KARTU target ──────────
     Hanya untuk penyeberangan LANGSUNG (HX 'goal' pct >= 100 saat aplikasi
     terbuka). Membuka aplikasi berjam-jam sesudah target tembus tidak
     merayakan apa pun — kartunya sendiri sudah bercerita (fx-pace:
     "Target tembus 15:13 · penjualan Hendri").
     Momen utamanya = banner fx-live di atas layar. Kartu menjawab SESUDAH
     banner pergi (mata tidak ditarik ke dua ujung layar sekaligus): cahaya
     menyusuri batang sampai ujungnya, percikan hijau halus dari ujung
     batang, tepi kartu menyala hijau sebentar. Semuanya DI DALAM kartu
     (lapisan absolut yang ikut terpotong sudut kartu, di bawah header dan
     navigasi) — tidak pernah di atas modal, form, atau layar penuh
     (HX.busy()). Belum terlihat (halaman lain, kartu tergulir keluar,
     melihat hari lain, animasi masuk halaman masih jalan, tab di latar):
     ditunda sampai terlihat, paling lama 5 menit. Sekali sehari per HP
     ('lg-target-<tgl>'). Kurangi Gerak: hanya tepi kartu memudar. */
  function dayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  var CELE_WAIT = 700, CELE_POLL = 300, CELE_TTL = 5 * 60 * 1000;
  // jeda tenang sebelum mulai, menurut penghalang terakhir: sesudah banner
  // pergi; sesudah modal/form tertutup (fx-live mencoba lagi tiap 700ms —
  // banner-nya harus sempat muncul duluan); sesudah kartu mulai terlihat
  var CELE_QUIET = { start: 700, banner: 450, busy: 1000, view: 350 };
  var cele = null;            // { key, at, quiet, why, t }
  var celeMem = {};
  function celeKey() { return 'lg-target-' + dayKey(); }
  function celeDone(key) {
    if (celeMem[key]) return true;
    try { return !!localStorage.getItem(key); } catch (e) { return false; }
  }
  function celeMark(key) {
    celeMem[key] = 1;
    try { localStorage.setItem(key, '1'); } catch (e) { }
  }
  function celeArm(g) {
    if (!g || !(g.pct >= 100)) return;
    var key = celeKey();
    if ((cele && cele.key === key) || celeDone(key)) return;
    if (cele) clearTimeout(cele.t);
    cele = { key: key, at: Date.now(), quiet: 0, why: 'start', t: 0 };
    cele.t = setTimeout(celeCheck, CELE_WAIT);
  }
  // batang target utuh di layar: di bawah header lengket, di atas navigasi bawah HP
  function barInView(bar) {
    var r = bar.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    var top = 0, hd = document.querySelector('header');
    if (hd) {
      var p = getComputedStyle(hd).position;
      if (p === 'fixed' || p === 'sticky' || p === '-webkit-sticky') top = Math.max(0, hd.getBoundingClientRect().bottom);
    }
    return r.top >= top && r.bottom <= fold();
  }
  // null = siap; selain itu = alasan menunggu
  function celeBlock(card) {
    if (window.HX && HX.busy && HX.busy()) return 'busy';
    if (document.querySelector('.hxl-banner')) return 'banner';      // momen utama masih tampil
    var dash = document.getElementById('page-dashboard');
    if (!dash || !dash.classList.contains('active') || dash.classList.contains('lg-enter')) return 'view';
    var bar = card && card.querySelector('.goal-bar');
    if (!bar || !barInView(bar)) return 'view';
    return null;
  }
  function celeCheck() {
    var c = cele;
    if (!c) return;
    clearTimeout(c.t); c.t = 0;
    var now = Date.now();
    if (c.key !== celeKey() || now - c.at > CELE_TTL || celeDone(c.key)) { cele = null; return; }
    if (now - c.at < CELE_WAIT) { c.t = setTimeout(celeCheck, CELE_WAIT - (now - c.at)); return; }
    if (document.hidden) { c.quiet = 0; return; }                   // visibilitychange memanggil lagi
    if (!loadingDone) { c.quiet = 0; c.t = setTimeout(celeCheck, CELE_POLL); return; }
    var today = true;
    try { if (typeof vOff !== 'undefined' && vOff !== 0) today = false; } catch (e) { }
    var card = document.querySelector('#page-dashboard .goal-card');
    if (today) {
      // data dikoreksi, hari ini ternyata belum 100%: tidak ada yang dirayakan
      var g = document.getElementById('goalPct');
      if (g && !(parseInt(g.textContent, 10) >= 100)) { cele = null; return; }
    }
    var why = today ? celeBlock(card) : 'view';
    if (why) { c.quiet = 0; c.why = why; c.t = setTimeout(celeCheck, CELE_POLL); return; }
    if (!c.quiet) c.quiet = now;
    var need = CELE_QUIET[c.why] || 700;
    if (now - c.quiet < need) { c.t = setTimeout(celeCheck, Math.min(CELE_POLL, need - (now - c.quiet) + 16)); return; }
    cele = null;
    celeMark(c.key);
    celePlay(card);
  }
  // nama lama — dipanggil dari beberapa tempat: hanya memeriksa yang tertunda
  function maybeCelebrate() { celeCheck(); }

  function celePlay(card) {
    var bar = card.querySelector('.goal-bar');
    var fill = document.getElementById('goalFill');
    var cr = card.getBoundingClientRect(), br = bar.getBoundingClientRect();
    var fr = fill && bar.contains(fill) ? fill.getBoundingClientRect() : null;
    var hx = fr && fr.width ? Math.min(fr.right, br.right) : br.right, hy = br.top + br.height / 2;
    buzz([14, 50, 14, 50, 28]);
    // modul fx-* boleh ikut: HX 'celebrate' {x, y} = ujung batang (px layar)
    try { if (window.HX && HX.emit) HX.emit('celebrate', { x: hx, y: hy }); } catch (e) { }
    var old = card.querySelector('.hx-win');
    if (old) old.parentNode.removeChild(old);
    var fx = mk('span', 'hx-win');
    fx.setAttribute('aria-hidden', 'true');
    var rim = mk('i', 'hx-win-rim', fx);
    card.appendChild(fx);
    var gone = function () { if (fx.parentNode) fx.parentNode.removeChild(fx); };
    try {
      var ra = rim.animate(REDUCED
        ? [{ opacity: 0 }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .6 }, { opacity: 0 }]
        : [{ opacity: 0 }, { opacity: 1, offset: .18 }, { opacity: .5, offset: .55 }, { opacity: 0 }],
        { duration: REDUCED ? 1600 : 2000, delay: REDUCED ? 0 : 480, easing: 'ease-out', fill: 'both' });
      ra.onfinish = gone;
    } catch (e) { }
    if (!REDUCED) {
      try { celeSparks(fx, card, cr, br, hx, hy); } catch (e) { }
    }
    setTimeout(gone, 3000);   // pengaman
  }
  // Cahaya menyusuri batang (0-560ms) -> mekar kecil di ujungnya -> 10-20
  // percikan hijau halus (garis pendek, bukan kertas konfeti) naik dan
  // memudar, ±2,2 detik. Canvas seukuran kartu, di dalam kartu.
  function celeSparks(fx, card, cr, br, hx, hy) {
    var W = card.clientWidth, H = card.clientHeight;
    if (!(W > 0 && H > 0) || !card.offsetWidth) return;
    var sc = cr.width / card.offsetWidth || 1;
    var X = function (v) { return (v - cr.left) / sc - card.clientLeft; };
    var Y = function (v) { return (v - cr.top) / sc - card.clientTop; };
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var cv = mk('canvas', '', fx);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    var x0 = X(br.left), ox = X(hx), oy = Y(hy), bh = Math.max(4, br.height / sc);
    var low = odoTier() === 'low', N = low ? 10 : 20;
    var COLORS = ['#30d158', '#5ef08a', '#c8fbd6'];
    var P = [], i;
    for (i = 0; i < N; i++) {
      // ke atas, condong ke kiri (ujung batang dekat tepi kanan kartu)
      var a = -Math.PI / 2 + (Math.random() - .62) * Math.PI * .9;
      var v = 55 + Math.random() * 125;
      P.push({
        x: ox - Math.random() * 5, y: oy + (Math.random() - .5) * bh * .6,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        born: 520 + Math.random() * 300, life: 620 + Math.random() * 560,
        w: .9 + Math.random() * .9, c: COLORS[i % COLORS.length]
      });
    }
    var END = 0;
    P.forEach(function (p) { END = Math.max(END, p.born + p.life); });
    var SW = 560, t0 = 0, prev = 0, raf = 0, dead = false;
    var stop = function () { dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; };
    function draw(now) {
      raf = 0;
      if (dead || !cv.parentNode) return;
      if (!t0) { t0 = now; prev = now; }
      var t = now - t0, dt = Math.min(.05, Math.max(0, (now - prev) / 1000));
      prev = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      // 1. cahaya menyusuri batang, dipotong di batang
      if (t < SW + 120 && ox > x0) {
        var k = Math.min(1, t / SW), e = 1 - Math.pow(1 - k, 3);
        var len = ox - x0, band = Math.max(28, len * .22), cx = x0 - band / 2 + (len + band / 2) * e;
        var al = (t < 80 ? t / 80 : 1) * (t > SW ? Math.max(0, 1 - (t - SW) / 120) : 1);
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, oy - bh / 2 - 1, len, bh + 2); ctx.clip();
        var gr = ctx.createLinearGradient(cx - band / 2, 0, cx + band / 2, 0);
        gr.addColorStop(0, 'rgba(200,251,214,0)');
        gr.addColorStop(.6, 'rgba(200,251,214,' + (.75 * al).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(200,251,214,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(cx - band / 2, oy - bh / 2 - 1, band, bh + 2);
        ctx.restore();
      }
      // 2. mekar kecil di ujung batang
      if (t > SW - 60 && t < SW + 640) {
        var q = (t - (SW - 60)) / 700, rr = 6 + 20 * Math.sqrt(q), ba = .5 * Math.sin(Math.PI * Math.min(1, q * 1.15));
        var rg = ctx.createRadialGradient(ox, oy, 0, ox, oy, rr);
        rg.addColorStop(0, 'rgba(94,240,138,' + ba.toFixed(3) + ')');
        rg.addColorStop(1, 'rgba(48,209,88,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(ox - rr, oy - rr, rr * 2, rr * 2);
      }
      // 3. percikan: garis pendek searah gerak, gravitasi ringan
      ctx.lineCap = 'round';
      var drag = Math.pow(.25, dt);
      for (var n = 0; n < P.length; n++) {
        var p = P[n], age = t - p.born;
        if (age < 0 || age > p.life) continue;
        p.vy += 150 * dt; p.vx *= drag; p.vy *= drag;
        p.x += p.vx * dt; p.y += p.vy * dt;
        var f = 1 - age / p.life, alpha = Math.pow(f, 1.4) * (age < 90 ? age / 90 : 1);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = p.c;
        ctx.lineWidth = p.w;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * .045, p.y - p.vy * .045);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (t < END) raf = requestAnimationFrame(draw);
      else { stop(); if (cv.parentNode) cv.parentNode.removeChild(cv); }
    }
    raf = requestAnimationFrame(draw);
    setTimeout(function () { stop(); if (cv.parentNode) cv.parentNode.removeChild(cv); }, END + 600);   // pengaman
  }

  /* ── pasang tanpa menyentuh app.js ────────────────────────────────── */
  function hook() {
    odoCss();
    Object.keys(TARGETS).forEach(function (id) { if (HERO[id]) watchHero(id); else watchValue(id); });

    // target harian tembus: HANYA penyeberangan langsung (lihat bagian 3)
    if (window.HX && HX.on && !hook.__goal) { hook.__goal = true; HX.on('goal', celeArm); }
    if (typeof window.showPage === 'function' && !window.showPage.__lgm) {
      var origShow = window.showPage;
      window.showPage = keepMarkers(origShow, function (p) {
        // Halaman yang sudah terbuka (tab aktif diketuk lagi, tombol "+ Sale")
        // tidak diputar ulang. Tombol "+ Sale" dari halaman lain membuka form
        // di atas Dashboard — animasi di balik blur form itu juga dilewati.
        // Microtask jalan sebelum layar digambar, jadi tidak ada kedip.
        var pg = document.getElementById('page-' + p);
        var was = !!(pg && pg.classList.contains('active'));
        // render di dalam showPage mengganti teks hero: biar enterPage (yang
        // tahu angka terakhir dilihat) yang menggulir, bukan pengamat teks
        if (!was) opening = 'page-' + p;
        var r;
        try { r = origShow.apply(this, arguments); }
        finally {
          if (!was) Promise.resolve().then(function () {
            opening = null;
            if (!document.body.classList.contains('premium-form-open')) enterPage('page-' + p, true);
            if (REDUCED) heroSeenAll();
          });
        }
        navPill();
        if (cele) setTimeout(celeCheck, 60);
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
      var rt = 0, rw = innerWidth;
      window.addEventListener('resize', function () {
        clearTimeout(rt); rt = setTimeout(navPill, 120);
        // lebar berubah (putar HP, jendela diubah): huruf pindah tempat —
        // odometer dipotong, angka final langsung tampil. Tinggi saja yang
        // berubah (bilah alamat HP muncul/hilang) tidak mengganggu.
        if (innerWidth !== rw) { rw = innerWidth; heroCutAll(); }
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(navPill);
      document.addEventListener('visibilitychange', function () {
        // ke latar: angka hero yang tampil = "terakhir dilihat"
        if (document.hidden) { heroSeenAll(); return; }
        setTimeout(celeCheck, 400);
        // kembali: penjualan selama tidak dilihat bergulir dari angka lama
        setTimeout(heroWake, 350);
      });
      // layar penuh fx-* (replay, wrapped, kartu, peta bintang) ditutup:
      // penjualan yang masuk selama itu bergulir dari angka terakhir dilihat
      if (window.MutationObserver) {
        var ovl = root.classList.contains('hx-overlay-open');
        new MutationObserver(function () {
          var o = root.classList.contains('hx-overlay-open');
          if (o === ovl) return;
          ovl = o;
          if (!o) { setTimeout(heroWake, 380); if (cele) setTimeout(celeCheck, 60); }
        }).observe(root, { attributes: true, attributeFilter: ['class'] });
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook);
  else hook();
  setTimeout(hook, 900);     // setelah skrip lain selesai membungkus fungsi yang sama
})();
