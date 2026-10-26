/* ══════════════════════════════════════════════════════════════════════
   FX PACE — batang target yang BERLOMBA DENGAN JAM (kartu target Dashboard)

   Yang ditambahkan ke kartu target (markup statis di index.html; app.js
   hanya mengisi lebar #goalFill dan teks #goalPct, jadi elemen di sini
   tidak hilang saat render ulang):
     1. GARIS JALUR putih tipis di batang = posisi hari normal pada menit
        ini: target x share(sekarang). share(t) = median (28 hari lengkap
        terakhir) dari bagian omzet AKHIR hari itu yang sudah tercatat
        sebelum jam t. Pembilang hanya entri yang dicatat di hari yang sama
        (ts dalam WIB = tanggal kunci); penyebut = omzet akhir hari itu
        (termasuk yang dicatat belakangan). Kotak 15 menit, dihitung sekali
        per hari. Cek data Okt 2026: ±14% jam 12, ±26% jam 13, ±37% jam 14,
        ±65% jam 16.
     2. SATU baris di bawah batang: "Di depan jalur +Rp 35jt" /
        "Tertinggal Rp 8jt dari jalur" (hanya angka yang berwarna). Tidak
        pernah "pasti tembus": target hanya tercapai ±5 dari 26 hari.
     3. TAKIK 25/50/75% yang menyala saat dilewati (live: kilau singkat +
        riak kecil di wallpaper lewat HX 'ripple').
     4. PUTARAN KEDUA lewat 100%: lapisan lebih terang dari kiri selebar
        kelebihannya (126% -> 26%), kilau sekali saat muncul, dan baris
        "Target tembus 15:13 · penjualan Hendri".
   Garis jalur & baris hanya untuk HARI INI (vOff === 0).

   HANYA MEMBACA. Tidak pernah menulis ke Firebase, tidak memanggil fungsi
   simpan apa pun. Tidak ada loop tanpa henti: pengatur waktu per menit
   hanya jalan selama kartu terlihat, tab aktif, dan Dashboard terbuka.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HX = window.HX;
  if (!HX || !HX.on || HX.__pace) return;
  HX.__pace = true;

  var WIB_MS = 7 * 3600e3, DAY_MS = 864e5, MIN_MS = 6e4;
  var BIN = 15, BINS = 96, LOOKBACK = 28, MIN_DAYS = 7;
  var NOTCHES = [25, 50, 75];
  var root = document.documentElement;

  /* ── variabel global app.js (let — bukan properti window) ───────────── */
  function viewOff() { try { return vOff; } catch (e) { return 0; } }
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  function viewKey() { try { return dk(od(vOff)); } catch (e) { return HX.todayKey(); } }
  function hasData() { var d = data(); for (var k in d) return true; return false; }
  // Target asli (config/revTarget) dimuat SETELAH data; sebelum itu app.js
  // masih memakai bawaan Rp70jt — jangan tampilkan jalur dari target palsu.
  function ready() { return hasData() && !!window._cfgTeamsLoaded; }
  function dashActive() {
    var p = document.getElementById('page-dashboard');
    return !!(p && p.classList.contains('active'));
  }
  function reduced() { return HX.reduced(); }

  /* ── kurva "hari normal" ──────────────────────────────────────────── */
  function keyDay(key) {
    var p = String(key).split('-');
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY_MS);
  }
  function dayKey(n) { return new Date(n * DAY_MS).toISOString().slice(0, 10); }
  function wibMinOf(ts) { return Math.floor(((ts + WIB_MS) % DAY_MS) / MIN_MS); }
  function nowWibMin() { return ((Date.now() + WIB_MS) % DAY_MS) / MIN_MS; }

  // E[j] = median bagian omzet akhir hari yang tercatat sebelum menit j*15
  function buildCurve(todayKey) {
    var D = data(), t0 = keyDay(todayKey), cols = [];
    for (var i = 1; i <= LOOKBACK; i++) {
      var dn = t0 - i, arr = D[dayKey(dn)];
      if (!arr || !arr.length) continue;
      var tot = 0, bins = [];
      for (var b = 0; b < BINS; b++) bins.push(0);
      for (var k = 0; k < arr.length; k++) {
        var e = arr[k];
        if (!e) continue;
        var r = +e.revenue || 0, ts = +e.ts || 0;
        tot += r;
        if (!ts || Math.floor((ts + WIB_MS) / DAY_MS) !== dn) continue;   // dicatat di hari lain
        bins[Math.min(BINS - 1, Math.floor(wibMinOf(ts) / BIN))] += r;
      }
      if (!(tot > 0)) continue;
      var cum = [0], c = 0;
      for (b = 0; b < BINS; b++) { c += bins[b]; cum.push(c / tot); }
      cols.push(cum);
    }
    if (cols.length < MIN_DAYS) return null;
    var E = [], prev = 0;
    for (var j = 0; j <= BINS; j++) {
      var v = cols.map(function (cl) { return cl[j]; }).sort(function (a, b) { return a - b; });
      var n = v.length, m = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
      prev = Math.max(prev, Math.min(1, Math.max(0, m)));   // monoton, 0..1
      E.push(prev);
    }
    return { e: E, days: cols.length };
  }
  var cv = { key: null, ref: null, val: null };
  function curve() {
    var key = HX.todayKey(), D = data();
    // sekali per hari; kalau gagal (data belum cukup) coba lagi saat data berganti
    if (cv.key === key && (cv.val || cv.ref === D)) return cv.val;
    cv.key = key; cv.ref = D; cv.val = buildCurve(key);
    return cv.val;
  }
  function shareAt(c, min) {
    var E = c.e, x = Math.max(0, Math.min(BINS * BIN, min)) / BIN;
    var j = Math.min(BINS - 1, Math.floor(x)), f = x - j;
    return E[j] + (E[j + 1] - E[j]) * f;
  }

  /* ── format ───────────────────────────────────────────────────────── */
  function jt(n) {
    n = Math.abs(Math.round(n));
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',').replace(/,0$/, '') + 'M';
    if (n >= 9.95e6) return Math.round(n / 1e6) + 'jt';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '') + 'jt';
    if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
    return String(n);
  }
  function hhmm(min) {
    min = Math.floor(min);
    return String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) { return '&#' + ch.charCodeAt(0) + ';'; });
  }
  function who(sp) { sp = String(sp == null ? '' : sp).trim(); return sp.charAt(0).toUpperCase() + sp.slice(1); }

  /* ── DOM ──────────────────────────────────────────────────────────── */
  var els = null;
  function mk(tag, cls) {
    var n = document.createElement(tag);
    n.className = cls;
    return n;
  }
  function build() {
    if (els && els.fill.isConnected && els.tickW.parentNode === els.bar) return true;
    var fill = document.getElementById('goalFill');
    var bar = fill && fill.parentElement;
    var card = bar && bar.closest('.goal-card');
    var row = bar && bar.closest('.goal-progress-row');
    if (!card || !row) return false;
    bar.classList.add('hxp-bar');
    card.classList.add('hxp-card');
    var lap = mk('span', 'hxp-lap'), sweep = mk('span', 'hxp-sweep');
    lap.appendChild(sweep);
    var tickW = mk('span', 'hxp-tickw'), tick = mk('span', 'hxp-tick');
    tickW.appendChild(tick);
    var notch = {};
    var frag = document.createDocumentFragment();
    frag.appendChild(lap);
    NOTCHES.forEach(function (m) {
      var n = mk('span', 'hxp-notch');
      n.style.left = m + '%';
      notch[m] = n;
      frag.appendChild(n);
    });
    frag.appendChild(tickW);
    [lap, tickW].concat(NOTCHES.map(function (m) { return notch[m]; }))
      .forEach(function (n) { n.setAttribute('aria-hidden', 'true'); });
    bar.appendChild(frag);
    var line = mk('div', 'hxp-line');
    line.innerHTML = '<span class="hxp-glyph" aria-hidden="true"></span><span class="hxp-txt"></span>';
    row.parentNode.insertBefore(line, row.nextSibling);
    els = {
      card: card, bar: bar, fill: fill, lap: lap, sweep: sweep, tickW: tickW, tick: tick,
      notch: notch, line: line, txt: line.lastChild, amt: null
    };
    watchFill();
    if (io) { io.disconnect(); io.observe(bar); }
    return true;
  }

  /* ── keadaan ──────────────────────────────────────────────────────── */
  var st = {
    on: false, lapOn: false, view: null, inView: false, seen: false,
    introDone: false, hold: false, introT: 0,
    tickP: null, lapW: -1, lineSig: null, amt: null, title: null, entAt: -1e9
  };

  function setTick(p) {
    if (st.hold) return;                      // intro sedang menahan garis di kiri
    p = Math.round(p * 1000) / 1000;
    if (p === st.tickP) return;
    st.tickP = p;
    els.tickW.style.transform = 'translate3d(' + p + '%,0,0)';
  }
  // pindah posisi TANPA meluncur (garis tak terlihat / mulai intro)
  function jump(node, prop, val) {
    node.classList.add('hxp-snap');
    node.style[prop] = val;
    void node.offsetWidth;
    node.classList.remove('hxp-snap');
  }

  // angka bergulir singkat di baris (hanya elemen milik modul ini)
  var roll = { raf: 0, t: 0, cur: 0 };
  function stopRoll() {
    if (roll.raf) cancelAnimationFrame(roll.raf);
    clearTimeout(roll.t);
    roll.raf = 0; roll.t = 0;
  }
  function amtText(v) { return (st.sign || '') + 'Rp ' + jt(v); }
  function setAmt(to, from) {
    var el = els.amt;
    if (!el) return;
    stopRoll();
    if (from == null || from === to || reduced() || document.hidden || amtText(from) === amtText(to)) {
      roll.cur = to;
      el.textContent = amtText(to);
      return;
    }
    var t0 = performance.now(), dur = from === 0 ? 900 : 480;
    function fr(now) {
      var t = Math.max(0, Math.min(1, (now - t0) / dur));
      roll.cur = from + (to - from) * (1 - Math.pow(1 - t, 3));
      el.textContent = amtText(roll.cur);
      if (t < 1) roll.raf = requestAnimationFrame(fr); else { roll.raf = 0; clearTimeout(roll.t); }
    }
    roll.raf = requestAnimationFrame(fr);
    // pengaman: rAF berhenti (tab di latar) -> jangan tinggalkan angka antara
    roll.t = setTimeout(function () { stopRoll(); roll.cur = to; el.textContent = amtText(to); }, dur + 300);
  }

  // isi baris: s = {kind, amt?, time?, who?}
  function renderLine(s, rollFrom) {
    var sig = s.kind + '|' + (s.time || '') + '|' + (s.who || '');
    if (sig !== st.lineSig) {
      st.lineSig = sig;
      var html;
      st.sign = s.kind === 'up' ? '+' : '';
      if (s.kind === 'up') html = 'Di depan jalur <b class="hxp-amt"></b>';
      else if (s.kind === 'dn') html = 'Tertinggal <b class="hxp-amt"></b> dari jalur';
      else if (s.kind === 'even') html = 'Tepat di jalur hari normal';
      else if (s.kind === 'zero') html = 'Jam segini hari normal masih Rp 0';
      else if (s.time) html = 'Target tembus <b class="hxp-time">' + esc(s.time) + '</b>' +
        (s.who ? ' <span class="hxp-dot">·</span> penjualan ' + esc(s.who) : '');
      else html = 'Target hari ini tembus';
      els.txt.innerHTML = html;
      els.amt = els.txt.querySelector('.hxp-amt');
      els.line.className = 'hxp-line hxp-' + s.kind;
      st.amt = null;
    }
    if (els.amt && s.amt != null) {
      var from = rollFrom != null ? rollFrom : (st.amt == null ? null : (roll.raf ? roll.cur : st.amt));
      st.amt = s.amt;
      setAmt(s.amt, from);
    }
  }

  // penjualan yang membuat omzet hari ini melewati target
  var cx = { ref: null, len: -1, T: 0, val: null };
  function crossing(list, T) {
    if (cx.ref === list && cx.len === list.length && cx.T === T) return cx.val;
    var s = list.filter(function (e) { return e && +e.ts; }).sort(function (a, b) { return a.ts - b.ts; });
    var cum = 0, val = null;
    for (var i = 0; i < s.length; i++) {
      cum += +s[i].revenue || 0;
      if (cum >= T) { val = { time: hhmm(wibMinOf(+s[i].ts)), who: who(s[i].sp) }; break; }
    }
    cx = { ref: list, len: list.length, T: T, val: val };
    return val;
  }

  /* ── pembaruan (setiap render, tiap menit, saat terlihat lagi) ────── */
  function update(opt) {
    if (!build()) return;
    opt = opt || {};
    var ok = ready(), T = HX.target(), v = viewOff();
    var list = data()[viewKey()] || [];
    var rev = 0;
    for (var i = 0; i < list.length; i++) if (list[i]) rev += +list[i].revenue || 0;
    var pct = ok && T > 0 ? rev / T * 100 : 0;

    // takik: menyala kalau sudah dilewati (hari yang sedang dilihat)
    NOTCHES.forEach(function (m) {
      var n = els.notch[m], lit = ok && pct >= m;
      if (n.classList.contains('lit') !== lit) n.classList.toggle('lit', lit);
    });

    // putaran kedua (lewat 100%)
    var lapW = ok && pct > 100 ? Math.min(100, pct - 100) : 0;
    lapW = Math.round(lapW * 100) / 100;
    var lapOn = lapW > 0;
    if (lapOn !== st.lapOn) { st.lapOn = lapOn; els.lap.classList.toggle('on', lapOn); }
    if (lapW !== st.lapW) {
      // muncul dari keadaan mati: mulai dari 0 lalu berlari dari kiri
      if (st.lapW <= 0 && lapOn) jump(els.lap, 'width', '0%');
      if (lapOn || st.lapW > 0) els.lap.style.width = lapW + '%';
      st.lapW = lapW;
    }

    // jalur & baris: hanya hari ini
    var today = ok && v === 0 && T > 0;
    if (st.view !== v) {
      var back = st.view !== null && v === 0;
      st.view = v;
      if (back) arm();                        // kembali ke HARI INI: garis meluncur lagi
    }
    var c = today ? curve() : null;
    var share = c ? shareAt(c, nowWibMin()) : 0;
    var hit = today && rev >= T;
    var on = today && (!!c || hit);
    if (on !== st.on) {
      st.on = on;
      els.card.classList.toggle('hxp-on', on);
      els.card.classList.toggle('hxp-tick-on', on && !!c);
    } else if (els.card.classList.contains('hxp-tick-on') !== (on && !!c)) {
      els.card.classList.toggle('hxp-tick-on', on && !!c);
    }
    if (!on) return;

    // tetap di dalam ujung bulat batang (jam 00–09 jalurnya 0%)
    if (c) setTick(Math.max(0.8, Math.min(99.4, share * 100)));
    var s;
    if (hit) {
      var x = crossing(list, T);
      s = x ? { kind: 'hit', time: x.time, who: x.who } : { kind: 'hit' };
    } else {
      var pace = T * share, d = rev - pace;
      if (share < 0.005 && rev <= 0) s = { kind: 'zero' };
      else if (Math.abs(d) < T * 0.01) s = { kind: 'even' };
      else s = d > 0 ? { kind: 'up', amt: d } : { kind: 'dn', amt: -d };
    }
    if (!st.hold) renderLine(s, opt.intro && s.amt != null ? 0 : null);
    if (c) {
      var title = 'Jalur = posisi hari normal pada jam ini (median ' + c.days + ' hari terakhir): Rp ' +
        jt(T * share) + ' dari target Rp ' + jt(T);
      if (title !== st.title) { st.title = title; els.line.title = title; }
    }
    if (!st.introDone) startIntro();
  }

  /* ── intro: garis meluncur dari kiri sekali per kunjungan halaman ──── */
  // waktu (0..1) saat kurva lg-ease motion.js — cubic-bezier(.22,1,.36,1) —
  // mencapai kemajuan y (untuk menyalakan takik tepat saat batang lewat)
  function easeTime(y) {
    var lo = 0, hi = 1, s = 0.5;
    for (var i = 0; i < 24; i++) {
      s = (lo + hi) / 2;
      var by = 3 * (1 - s) * (1 - s) * s + 3 * (1 - s) * s * s + s * s * s;
      if (by < y) lo = s; else hi = s;
    }
    return 3 * (1 - s) * (1 - s) * s * 0.22 + 3 * (1 - s) * s * s * 0.36 + s * s * s;
  }
  var FILL_DELAY = 300, FILL_DUR = 1150;      // .lg-enter .goal-bar-fill.lg-in di glass.css
  function filling() {
    return els.fill.classList.contains('lg-in') && performance.now() - st.entAt < FILL_DELAY + FILL_DUR;
  }
  // "bersiap" (sekali per kunjungan): garis diparkir di kiri & tak terlihat,
  // baris dan putaran kedua menunggu — SEBELUM kartu terlihat. Kalau baru
  // diparkir saat kartu sudah tampil, posisi akhirnya sempat terlihat lalu
  // melompat ke kiri (terutama di HP: kartu digulir masuk pelan-pelan).
  function snapAll(fn) {
    var ns = [els.tickW, els.tick, els.lap, els.line];
    ns.forEach(function (n) { n.classList.add('hxp-snap'); });
    fn();
    void els.card.offsetWidth;
    ns.forEach(function (n) { n.classList.remove('hxp-snap'); });
  }
  function arm() {
    if (!els) return;
    clearTimeout(st.introT);
    st.introT = 0;
    st.introDone = false;
    if (reduced()) { release(); return; }
    if (st.hold) return;
    st.hold = true;
    snapAll(function () {
      els.card.classList.add('hxp-intro');
      els.tickW.style.transform = 'translate3d(0%,0,0)';
    });
    st.tickP = 0;
  }
  function release() {
    if (!st.hold) return;
    st.hold = false;
    els.card.classList.remove('hxp-intro');
  }
  // batang benar-benar terlihat SEKARANG (di atas bar navigasi bawah HP)?
  // Catatan IntersectionObserver bisa basi: data pertama mendorong kartu ke
  // bawah layar di tugas yang sama, sebelum observer sempat melapor.
  function barOnScreen() {
    var b = els.bar.getBoundingClientRect();
    if (!b.width) return false;
    var lim = innerHeight, nw = document.querySelector('.nav-wrapper');
    if (nw) {
      var q = nw.getBoundingClientRect();
      if (q.height && q.top > innerHeight / 2 && q.top < lim) lim = q.top;
    }
    return b.top >= 0 && b.bottom <= lim - 6;
  }
  function startIntro() {
    if (st.introDone || st.introT || !els || !st.on || !st.seen || !dashActive()) return;
    if (root.classList.contains('lg-loading') || !barOnScreen()) return;
    if (!st.hold) { st.introDone = true; return; }   // Kurangi Gerak: semua sudah di tempatnya
    // batang sedang diisi animasi masuk motion.js -> garis berangkat saat
    // isiannya hampir selesai; selain itu langsung (kartu baru digulir masuk)
    var lead = 160;
    if (filling()) lead = Math.max(lead, st.entAt + FILL_DELAY + easeTime(0.94) * FILL_DUR - performance.now());
    st.introT = setTimeout(function () {
      st.introT = 0;
      st.introDone = true;
      release();
      st.lineSig = null;                      // tulis ulang baris -> angka bergulir dari 0
      update({ intro: true });
      if (st.lapOn) sweep(720);
    }, lead);
  }

  // takik menyala berurutan saat batang motion.js mengisi (masuk halaman)
  var seqT = [];
  function notchSequence() {
    seqT.forEach(clearTimeout);
    seqT = [];
    if (reduced()) return;
    var w = parseFloat(els.fill.style.width) || 0;
    NOTCHES.forEach(function (m) {
      var n = els.notch[m];
      n.classList.remove('hxp-wait');
      if (!n.classList.contains('lit') || !(w >= m)) return;
      n.classList.add('hxp-wait');
      seqT.push(setTimeout(function () {
        n.classList.remove('hxp-wait');
        flare(n, 'hxp-flare-s');
      }, FILL_DELAY + easeTime(m / w) * FILL_DUR));
    });
  }
  function watchFill() {
    if (!window.MutationObserver || els.fill.__hxp) return;
    els.fill.__hxp = true;
    new MutationObserver(function (recs) {
      if (!els.fill.classList.contains('lg-in')) return;
      var started = recs.some(function (r) { return !/(^|\s)lg-in(\s|$)/.test(r.oldValue || ''); });
      if (!started) return;
      st.entAt = performance.now();
      notchSequence();
      startIntro();
    }).observe(els.fill, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }

  function flare(n, cls) {
    n.classList.remove('hxp-flare', 'hxp-flare-s');
    void n.offsetWidth;
    n.classList.add(cls);
    clearTimeout(n.__hxpT);
    n.__hxpT = setTimeout(function () { n.classList.remove(cls); }, 1300);
  }
  function sweep(delay) {
    if (reduced() || !st.lapOn) return;
    var s = els.sweep;
    s.classList.remove('go');
    s.style.animationDelay = (delay || 0) + 'ms';
    void s.offsetWidth;
    s.classList.add('go');
    clearTimeout(s.__hxpT);
    s.__hxpT = setTimeout(function () { s.classList.remove('go'); }, (delay || 0) + 1500);
  }

  /* ── pengatur waktu per menit (hanya saat terlihat) ───────────────── */
  var timer = 0;
  function running() { return !!els && st.on && st.inView && !document.hidden && dashActive(); }
  function schedule() {
    if (!running()) { clearTimeout(timer); timer = 0; return; }
    if (timer) return;
    var ms = MIN_MS - (Date.now() % MIN_MS) + 120;
    timer = setTimeout(function () { timer = 0; update(); schedule(); }, ms);
  }

  // diamati: BATANGNYA (bukan kartu), dengan tepi bawah dikurangi tinggi
  // bar navigasi HP — "terlihat" = batang utuh di atas navigasi
  var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      st.inView = en.isIntersecting;
      st.seen = en.isIntersecting && en.intersectionRatio >= 0.99;
    });
    if (st.inView) update();
    if (st.seen) startIntro();
    schedule();
  }, { threshold: [0, 1], rootMargin: '0px 0px -90px 0px' }) : null;
  if (!io) { st.inView = true; st.seen = true; }

  /* ── event ────────────────────────────────────────────────────────── */
  HX.on('render', function () { update(); schedule(); });
  HX.on('ready', function () { update(); schedule(); });
  HX.on('page', function (p) {
    if (p && p.id === 'page-dashboard' && p.from !== 'page-dashboard') arm();
    if (els) update();
    schedule();
  });
  HX.on('goal', function (g) {
    if (!g || !build() || viewOff() !== 0) return;
    if (g.pct >= 100) { sweep(450); return; }
    var n = els.notch[g.pct];
    if (!n) return;
    n.classList.remove('hxp-wait');
    n.classList.add('lit');
    flare(n, 'hxp-flare');
    if (!reduced() && st.inView && dashActive()) {
      var r = els.bar.getBoundingClientRect();
      HX.emit('ripple', { x: r.left + r.width * g.pct / 100, y: r.top + r.height / 2, power: 0.4 });
    }
  });
  HX.on('prefs', function () {
    if (!els || !reduced()) return;
    clearTimeout(st.introT); st.introT = 0; st.introDone = true;
    release(); update();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && els) update();
    schedule();
  });
  // skeleton selesai tanpa animasi masuk (Kurangi Gerak / kartu di luar layar)
  if (window.MutationObserver) {
    new MutationObserver(function () { if (!root.classList.contains('lg-loading') && els) startIntro(); })
      .observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  // untuk tes: baca keadaan (tidak mengubah apa pun)
  HX.pace = {
    state: function () {
      var c = cv.val;
      return {
        on: st.on, lapOn: st.lapOn, lapW: st.lapW, tickP: st.tickP, line: els ? els.line.textContent : null,
        kind: st.lineSig, days: c ? c.days : 0, share: c ? shareAt(c, nowWibMin()) : null, intro: st.introDone, hold: st.hold,
        seen: st.seen, inView: st.inView, onScreen: els ? barOnScreen() : null, timer: !!timer
      };
    },
    curve: function (rebuild) { if (rebuild) cv.key = null; var c = curve(); return c ? c.e.slice() : null; }
  };

  function boot() { if (build()) { arm(); update(); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
