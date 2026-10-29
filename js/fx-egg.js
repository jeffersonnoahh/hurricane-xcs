/* ══════════════════════════════════════════════════════════════════════
   FX EGG — telur paskah tersembunyi. TIDAK diumumkan di UI: serunya saat
   ditemukan sendiri lalu diceritakan di grup.
   HANYA MEMBACA (allData, gE, TR, msSPSelect lewat global app.js / HX).
   Tidak pernah menulis ke Firebase. localStorage hanya untuk "bulan sudah
   terbit malam ini" (per HP).

   1. Ketuk tulisan "Spring Buffer" 5×   → halaman limbung naik-turun, lalu
                                          Spring Buffer "terpasang": goyang
                                          berhenti mendadak, stabil.
   2. Ketuk produk XCS 5× (Twin Turbo,   → percikan listrik merayap di tepi
      XCS 7, Superfast, Competition …)     kartu, angka berkedip.
   3. Ketuk "XCSR" 5×                     → motor lewat sambil wheelie,
                                          bekas ban memudar.
   4. Ketuk logo Hurricane 7×             → puting beliung menyedot kartu
                                          lalu memuntahkannya kembali.
   5. HP dimiringkan (landscape) di       → dasbor mobil: spidometer omzet
      halaman Dashboard                     hari ini, takometer omzet bulan
                                          ini (garis merah = rekor bulan).
   7. Ketik "gaspol" di kotak pencarian   → mode turbo 10 detik (kata itu
                                          hilang sendiri dari kotak).
   8. Usap ↑ ↑ ↓ ↓ di header              → Hall of Fame: rekor sepanjang
      (keyboard: ↑ ↑ ↓ ↓)                   masa.
   9. Buka app jam 22.00–03.59 (jam HP)   → bulan terbit (sekali per malam
                                          per HP). Penjualan yang dicatat
                                          jam 22.00–03.59 WIB dapat cap
                                          burung hantu kecil di log harian
                                          & My Sales.

   Ketukan = pointerdown→pointerup < 450 ms, geser < 12 px, jeda antar
   ketukan ≤ 750 ms. Input/select/textarea tidak dihitung. Satu efek pada
   satu waktu. Kurangi Gerak: efek diganti pemberitahuan kecil saja.

   Uji (hanya membaca): HX.egg.fire('sbf'|'xcs'|'xcsr'|'hurricane'|
   'gaspol'|'hof'|'moon'|'cockpit') · HX.egg.hof() · HX.egg.state()
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__hxEgg) return;
  window.__hxEgg = true;

  var D = document, R = D.documentElement, W = window;
  var HX = W.HX || (W.HX = {});
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  /* ── utilitas ───────────────────────────────────────────────────── */
  function reduced() { try { return HX.reduced ? HX.reduced() : false; } catch (e) { return false; } }
  function low() { return HX.tier === 'low'; }
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { } }
  function mk(tag, cls, html) { var x = D.createElement(tag); if (cls) x.className = cls; if (html != null) x.innerHTML = html; return x; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  function list(v) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v && typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; }).filter(Boolean);
    return [];
  }
  function rp(n) { return 'Rp ' + (HX.money ? HX.money(n) : String(Math.round(n))); }
  function dLbl(key) { var p = String(key).split('-'); return (+p[2]) + ' ' + BLN[+p[1] - 1] + ' ' + p[0]; }
  function mLbl(ym) { var p = String(ym).split('-'); return BULAN[+p[1] - 1] + ' ' + p[0]; }
  function wibHour(ts) { return new Date((+ts || 0) + 7 * 3600e3).getUTCHours(); }
  function wibHm(ts) { var d = new Date((+ts || 0) + 7 * 3600e3); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); }
  function nightTs(ts) { if (!ts) return false; var h = wibHour(ts); return h >= 22 || h < 4; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function pageOn(id) { var p = D.getElementById('page-' + id); return !!(p && p.classList.contains('active')); }
  function modalOpen() {
    var mos = D.querySelectorAll('.mo');
    for (var i = 0; i < mos.length; i++) if (mos[i].style.display && mos[i].style.display !== 'none') return mos[i];
    return null;
  }

  /* jangan ganggu: form penjualan / sheet More / layar penuh modul lain /
     gestur jari / sedang mengetik / kalender. allowModal: ketukan di dalam
     modal detail sales boleh (efeknya terjadi di modal itu). */
  function blocked(allowModal) {
    var b = D.body;
    if (b && (b.classList.contains('premium-form-open') || b.classList.contains('premium-more-open'))) return true;
    if (R.classList.contains('hx-overlay-open') || R.classList.contains('hx-gesture')) return true;
    var a = D.activeElement;
    if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return true;
    var cal = D.getElementById('calOverlay');
    if (cal && cal.style.display && cal.style.display !== 'none') return true;
    return !allowModal && !!modalOpen();
  }

  /* panggung efek: modal yang terbuka, kalau tidak halaman aktif */
  function stage() {
    var mo = modalOpen();
    if (mo) { var box = mo.querySelector('.mbox') || mo.firstElementChild || mo; return { root: box, anim: box }; }
    var pg = D.querySelector('.page.active') || D.body;
    return { root: pg, anim: pg.querySelector('.container') || pg };
  }

  var CARD_SEL = '.omset-hero,.goal-card,.kpi-card,.ins-kpi-card,.omset-total-card,.spc,.lbi,.pi,.ms-profile-card,.ms-sale-card,' +
    '.ms-search-card,.sp-lookup-card,.warn-summary-card,.warn-crit-card,.wl-row,.hxy-chartcard,.hxy-detail,.hxy-hero > *,.ei,.mbox';
  function cards(max, opt) {
    opt = opt || {};
    var st = stage(), vh = W.innerHeight, vw = W.innerWidth, out = [], B = band();
    var cand = Array.prototype.slice.call(st.root.querySelectorAll(CARD_SEL));
    if (st.root.matches && st.root.matches('.mbox')) cand.unshift(st.root);
    function ok(c) {
      if (!c.getClientRects().length) return false;
      var r = c.getBoundingClientRect();
      if (r.width * r.height < 2400 || r.bottom < 8 || r.top > vh - 8 || r.right < 0 || r.left > vw) return false;
      if (opt.inBand && (r.bottom < B.top + 12 || r.top > B.bot - 12)) return false;
      if (opt.boxed && !visibleBox(c)) return false;
      for (var j = 0; j < out.length; j++) if (out[j].contains(c) || c.contains(out[j])) return false;
      return true;
    }
    for (var i = 0; i < cand.length && out.length < max; i++) if (ok(cand[i])) out.push(cand[i]);
    if (out.length < 3 && !opt.noFallback) {   // halaman tanpa kartu yang dikenal: anak langsung container
      var kids = st.anim.children;
      for (var k = 0; k < kids.length && out.length < max; k++) if (ok(kids[k])) out.push(kids[k]);
    }
    return out;
  }

  /* pita aman layar: di bawah header yang terlihat (+ baris nav di desktop),
     di atas nav bawah (HP) — supaya efek & pesan tidak menimpa tombol */
  function band() {
    var top = 0, bot = W.innerHeight, h = D.querySelector('header'), nav = D.querySelector('.nav-wrapper');
    if (h) { var r = h.getBoundingClientRect(); if (r.bottom > 0 && r.height) top = Math.max(top, r.bottom); }
    if (nav) {
      var n = nav.getBoundingClientRect();
      if (n.height && n.top < W.innerHeight / 2 && n.bottom > 0) top = Math.max(top, n.bottom);
      else if (n.height && n.top > W.innerHeight / 2) bot = Math.min(bot, n.top);
    }
    return { top: Math.round(top), bot: Math.round(bot) };
  }
  function visibleBox(c) {
    var cs = getComputedStyle(c);
    function alpha(col) { var m = /rgba?\(([^)]+)\)/.exec(col || ''); if (!m) return col && col !== 'transparent' ? 1 : 0; var p = m[1].split(','); return p.length > 3 ? parseFloat(p[3]) : 1; }
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && alpha(cs.borderTopColor) > .05) return true;
    if (alpha(cs.backgroundColor) > .05 || (cs.backgroundImage && cs.backgroundImage !== 'none')) return true;
    return cs.boxShadow && cs.boxShadow !== 'none';
  }

  /* bagian halaman yang terlihat (anak langsung container) — untuk puting beliung */
  function sections(max) {
    var st = stage(), vh = W.innerHeight, out = [], tall = false;
    if (st.root.matches && st.root.matches('.mbox')) return cards(max);
    var kids = st.anim.children;
    for (var i = 0; i < kids.length && out.length < max; i++) {
      var c = kids[i];
      if (!c.getClientRects().length) continue;
      var r = c.getBoundingClientRect();
      if (r.height < 8 || r.bottom < 0 || r.top > vh) continue;
      if (r.height > vh * 1.5) { tall = true; continue; }   // terlalu tinggi untuk satu lapisan GPU: pakai kartu di dalamnya
      out.push(c);
    }
    if (tall) {
      cards(max).forEach(function (c) {
        if (out.length >= max || c.getBoundingClientRect().height > vh * 1.5) return;
        for (var j = 0; j < out.length; j++) if (out[j].contains(c) || c.contains(out[j])) return;
        out.push(c);
      });
    }
    return out.length >= 2 ? out : cards(max).filter(function (c) { return c.getBoundingClientRect().height <= vh * 1.5; });
  }

  /* lapisan layar penuh sekali pakai */
  function layer(cls) { var L = mk('div', 'hxe-layer' + (cls ? ' ' + cls : '')); L.setAttribute('aria-hidden', 'true'); D.body.appendChild(L); return L; }
  function canvasIn(L) {
    var cv = mk('canvas'), w = W.innerWidth, h = W.innerHeight, dpr = Math.min(low() ? 1 : 2, W.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    L.appendChild(cv);
    var g = cv.getContext('2d');
    if (!g) throw new Error('canvas 2d tidak tersedia');
    g.scale(dpr, dpr);
    return { g: g, w: w, h: h };
  }

  /* pemberitahuan kecil di atas */
  var toastEl = null, toastT = 0;
  function toast(title, sub, tone) {
    if (!toastEl) { toastEl = mk('div', 'hxe-toast'); toastEl.setAttribute('role', 'status'); D.body.appendChild(toastEl); }
    if (moonL) moonL.classList.add('quiet');     // pesan bulan & pemberitahuan sama-sama di atas
    toastEl.className = 'hxe-toast tone-' + (tone || 'green');
    toastEl.innerHTML = '<b>' + esc(title) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '');
    toastEl.style.top = Math.max(band().top + 10, 12) + 'px';
    void toastEl.offsetWidth;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2800);
  }

  /* satu efek pada satu waktu */
  var running = null, lockT = 0;
  function begin(name) {
    if (running) return false;
    running = name;
    clearTimeout(lockT); lockT = setTimeout(done, 9000);     // pengaman: efek apa pun selesai < 4 dtk
    return true;
  }
  function done() {
    var was = running; running = null; clearTimeout(lockT);
    if (was && typeof checkCockpit === 'function') setTimeout(checkCockpit, 50);
  }
  function safe(fn) {
    return function () {
      try { fn.apply(null, arguments); }
      catch (e) {
        try { console.warn('[HX] egg', e); } catch (er) { }
        var ls = D.querySelectorAll('.hxe-layer:not(.hxe-turbo-l):not(.hxe-night)');
        for (var i = 0; i < ls.length; i++) ls[i].remove();
        done();
      }
    };
  }

  /* ═══ 1. SPRING BUFFER — limbung lalu stabil ═══════════════════════ */
  function fireSbf() {
    if (!begin('sbf')) return;
    if (reduced()) { toast('Spring Buffer terpasang', 'Stabil. Nggak limbung lagi.', 'green'); return setTimeout(done, 600); }
    var tg = stage().anim, r = tg.getBoundingClientRect();
    var oy = Math.max(0, Math.min(r.height, W.innerHeight * 0.55 - r.top));
    var org = '50% ' + Math.round(oy) + 'px';
    vib([30, 90, 30, 90, 30, 90, 30, 160, 90]);
    var E = 'ease-in-out';
    var a;
    try {
      a = tg.animate([
        { transform: 'translateY(0) rotate(0deg)', transformOrigin: org, easing: E },
        { transform: 'translateY(26px) rotate(-2.8deg)', transformOrigin: org, offset: .11, easing: E },
        { transform: 'translateY(-18px) rotate(2.4deg)', transformOrigin: org, offset: .24, easing: E },
        { transform: 'translateY(17px) rotate(-2.1deg)', transformOrigin: org, offset: .37, easing: E },
        { transform: 'translateY(-13px) rotate(1.7deg)', transformOrigin: org, offset: .50, easing: E },
        { transform: 'translateY(12px) rotate(-1.4deg)', transformOrigin: org, offset: .62, easing: 'cubic-bezier(.2,.9,.2,1)' },
        // klak — Spring Buffer masuk: berhenti mendadak
        { transform: 'translateY(-2px) rotate(.15deg)', transformOrigin: org, offset: .69, easing: 'ease-out' },
        { transform: 'translateY(0) rotate(0deg)', transformOrigin: org, offset: .74 },
        { transform: 'translateY(0) rotate(0deg)', transformOrigin: org }
      ], { duration: 2000 });
    } catch (e) { a = null; }
    var snap = mk('div', 'hxe-snap'); D.body.appendChild(snap);
    setTimeout(function () {
      snap.classList.add('on');
      vib([120]);
      toast('Spring Buffer terpasang', 'Stabil. Nggak limbung, nggak gasruk.', 'green');
    }, 1300);
    setTimeout(function () { snap.remove(); done(); }, 2300);
    if (!a) setTimeout(done, 2300);
  }

  /* ═══ 2. XCS — percikan listrik di tepi kartu ═════════════════════ */
  function rrPoint(b, u) {
    // titik pada keliling persegi bersudut bulat, u dalam [0,1)
    var x = b.x, y = b.y, w = b.w, h = b.h, r = b.r;
    var sw = w - 2 * r, sh = h - 2 * r, arc = Math.PI * r / 2;
    var per = 2 * sw + 2 * sh + 4 * arc;
    var d = ((u % 1) + 1) % 1 * per;
    function A(cx, cy, a0) { var t = d / arc, a = a0 + t * Math.PI / 2; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
    if (d < sw) return { x: x + r + d, y: y }; d -= sw;
    if (d < arc) return A(x + w - r, y + r, -Math.PI / 2); d -= arc;
    if (d < sh) return { x: x + w, y: y + r + d }; d -= sh;
    if (d < arc) return A(x + w - r, y + h - r, 0); d -= arc;
    if (d < sw) return { x: x + w - r - d, y: y + h }; d -= sw;
    if (d < arc) return A(x + r, y + h - r, Math.PI / 2); d -= arc;
    if (d < sh) return { x: x, y: y + h - r - d }; d -= sh;
    return A(x + r, y + r, Math.PI);
  }
  function fireXcs() {
    if (!begin('xcs')) return;
    vib([14, 40, 14, 30, 22, 60, 12, 30, 40]);
    R.classList.add('hxe-flick');
    setTimeout(function () { R.classList.remove('hxe-flick'); }, 1800);
    toast('XCS ON', 'Arus stabil. Tenaga penuh.', 'blue');
    var cs = reduced() ? [] : cards(low() ? 6 : 12, { noFallback: true, boxed: true, inBand: true });
    if (!cs.length) return setTimeout(done, 900);
    var L = layer(), C = canvasIn(L), g = C.g, B = band();
    var runs = cs.map(function (c, i) {
      var r = c.getBoundingClientRect(), rad = parseFloat(getComputedStyle(c).borderTopLeftRadius) || 0;
      rad = Math.max(2, Math.min(rad, r.width / 2 - 1, r.height / 2 - 1, 24));
      return { b: { x: r.left + .5, y: r.top + .5, w: r.width - 1, h: r.height - 1, r: rad }, s0: Math.random(), dir: i % 2 ? 1 : -1, delay: i * 70 + Math.random() * 140, lap: 900 + Math.random() * 500 };
    });
    var T = 2400, t0 = performance.now();
    function bolt(pts, width, color, alpha) {
      g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = width;
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    }
    function frame(now) {
      var t = now - t0;
      g.clearRect(0, 0, C.w, C.h);
      if (t > T) { L.remove(); done(); return; }
      var fade = t > T - 500 ? (T - t) / 500 : Math.min(1, t / 120);
      g.save(); g.beginPath(); g.rect(0, B.top, C.w, Math.max(0, B.bot - B.top)); g.clip();
      g.lineCap = 'round'; g.lineJoin = 'round';
      runs.forEach(function (run) {
        var lt = t - run.delay; if (lt < 0) return;
        var head = run.s0 + run.dir * lt / run.lap, len = .14, N = 16, pts = [];
        for (var k = 0; k <= N; k++) {
          var p = rrPoint(run.b, head - run.dir * len * (k / N)), j = k === 0 ? 0 : 3.2 * (1 - k / N * .5);
          pts.push({ x: p.x + (Math.random() - .5) * 2 * j, y: p.y + (Math.random() - .5) * 2 * j });
        }
        bolt(pts, 7, '#0a84ff', .18 * fade);
        bolt(pts, 2.6, '#64d2ff', .75 * fade);
        bolt(pts, 1.1, '#ffffff', .95 * fade);
        // cabang kecil & percikan di kepala
        if (Math.random() < .35) {
          var hp = pts[0], br = [hp], ang = Math.random() * Math.PI * 2, x = hp.x, y = hp.y;
          for (var b = 0; b < 4; b++) { x += Math.cos(ang) * 7 + (Math.random() - .5) * 6; y += Math.sin(ang) * 7 + (Math.random() - .5) * 6; br.push({ x: x, y: y }); }
          bolt(br, 1.2, '#bfe9ff', .7 * fade);
        }
        g.globalAlpha = fade; g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(pts[0].x, pts[0].y, 2.2, 0, Math.PI * 2); g.fill();
      });
      g.restore();
      g.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ═══ 3. XCSR — motor wheelie ═════════════════════════════════════ */
  var BIKE = '<svg viewBox="0 0 132 76" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
    '<g class="hxe-bike-body">' +
    '<circle cx="26" cy="58" r="15" stroke-width="3.2"/><circle cx="26" cy="58" r="4" stroke-width="2"/>' +
    '<circle cx="104" cy="58" r="15" stroke-width="3.2"/><circle cx="104" cy="58" r="4" stroke-width="2"/>' +
    '<path d="M26 58 L54 42 L84 40 L104 58" stroke-width="3"/>' +
    '<path d="M54 42 L62 58 L26 58" stroke-width="2.4"/>' +
    '<path d="M104 58 L92 28 M86 26 L98 23" stroke-width="3"/>' +
    '<path d="M48 37 Q60 33 66 36 Q76 30 88 33" stroke-width="3.4"/>' +
    '<path d="M36 50 L18 50" stroke-width="2.4"/>' +
    '<path d="M60 34 L71 15" stroke-width="4.4"/><circle cx="75" cy="10" r="6.5" fill="currentColor" stroke="none"/>' +
    '<path d="M70 18 L90 26" stroke-width="3"/><path d="M61 34 L68 48 L78 50" stroke-width="3.4"/>' +
    '</g></svg>';
  function fireXcsr() {
    if (!begin('xcsr')) return;
    vib([18, 35, 18, 35, 18, 35, 28, 25, 90]);
    toast('XCSR', 'Motor makin ngacir. Tarikan enteng.', 'green');
    if (reduced()) return setTimeout(done, 900);
    var L = layer('hxe-road'), vw = W.innerWidth, vh = W.innerHeight;
    var bw = Math.round(Math.max(110, Math.min(170, vw * .34))), bh = Math.round(bw * 76 / 132);
    var B = band(), fab = D.querySelector('.premium-add-fab'), floor = B.bot;
    if (fab && fab.getClientRects().length) { var fr = fab.getBoundingClientRect(); if (fr.top > vh / 2 && fr.top < floor) floor = fr.top; }
    var ground = Math.round(Math.min(floor - 10, vh - 18)), T = 2500;
    var rear = bw * 26 / 132, wheelB = bh * 73 / 76;      // posisi roda belakang & dasar roda dalam kotak motor
    var x0 = -bw - 20, x1 = vw + 40;
    // bekas ban
    var ns = 'http://www.w3.org/2000/svg', sv = D.createElementNS(ns, 'svg');
    sv.setAttribute('class', 'hxe-skid'); sv.setAttribute('width', vw); sv.setAttribute('height', vh);
    var p = D.createElementNS(ns, 'path'), sx = x0 + rear, ex = x1 + rear, dpath = 'M' + sx + ' ' + ground;
    for (var x = sx + 30; x <= ex; x += 30) dpath += ' L' + x + ' ' + (ground + Math.sin(x / 41) * 1.6);
    p.setAttribute('d', dpath); sv.appendChild(p); L.appendChild(sv);
    var len = ex - sx + 20;
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    var bike = mk('div', 'hxe-bike', BIKE);
    bike.style.width = bw + 'px'; bike.style.height = bh + 'px';
    bike.style.left = '0px'; bike.style.top = (ground - wheelB) + 'px';
    L.appendChild(bike);
    try {
      bike.animate([{ transform: 'translateX(' + x0 + 'px)' }, { transform: 'translateX(' + x1 + 'px)' }], { duration: T, easing: 'linear', fill: 'forwards' });
      var bd = bike.querySelector('.hxe-bike-body');
      bd.animate([
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(2deg)', offset: .14 },
        { transform: 'rotate(-19deg)', offset: .3, easing: 'ease-out' },
        { transform: 'rotate(-24deg)', offset: .5 },
        { transform: 'rotate(-17deg)', offset: .66, easing: 'ease-in' },
        { transform: 'rotate(1.5deg)', offset: .76 },
        { transform: 'rotate(-1deg)', offset: .82 },
        { transform: 'rotate(0deg)' }
      ], { duration: T, easing: 'ease-in-out', fill: 'forwards' });
      p.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: T, easing: 'linear', fill: 'forwards' });
      sv.animate([{ opacity: 1 }, { opacity: 1, offset: .78 }, { opacity: 0 }], { duration: T + 700, fill: 'forwards' });
    } catch (e) { }
    // asap knalpot
    var puffs = 0, t0 = performance.now();
    (function puff() {
      var t = performance.now() - t0; if (t > T - 200 || puffs > 14) return;
      puffs++;
      var px = x0 + (x1 - x0) * (t / T) + bw * .1, py = ground - bh * .28;
      var c = mk('i', 'hxe-puff'); c.style.left = px + 'px'; c.style.top = py + 'px'; L.appendChild(c);
      try { c.animate([{ transform: 'translate(0,0) scale(.4)', opacity: .5 }, { transform: 'translate(-34px,-14px) scale(1.6)', opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }); } catch (e) { }
      setTimeout(puff, 150);
    })();
    setTimeout(function () { L.remove(); done(); }, T + 800);
  }

  /* ═══ 4. HURRICANE — puting beliung ════════════════════════════════ */
  function fireHurricane() {
    if (!begin('hurricane')) return;
    vib([60, 40, 70, 40, 80, 40, 220]);
    if (reduced()) { toast('HURRICANE', 'Angin kencang lewat.', 'blue'); return setTimeout(done, 900); }
    var cs = sections(low() ? 8 : 14), vw = W.innerWidth, vh = W.innerHeight, cx = vw / 2, cy = vh * .46;
    var T = 2600;
    cs.forEach(function (c, i) {
      var r = c.getBoundingClientRect(), dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      var rot = (i % 2 ? 1 : -1) * (300 + (i * 47) % 160), dl = i * 40;
      try {
        c.animate([
          { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1, easing: 'cubic-bezier(.5,0,.9,.4)' },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg) scale(.04)', opacity: .15, offset: .42 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (rot * 1.4) + 'deg) scale(.04)', opacity: .15, offset: .6, easing: 'cubic-bezier(.3,1.45,.55,1)' },
          { transform: 'translate(0px,0px) rotate(0deg) scale(1)', opacity: 1 }
        ], { duration: T - dl, delay: dl });
      } catch (e) { }
    });
    var L = layer(), C = canvasIn(L), g = C.g, N = low() ? 90 : 170, ps = [];
    for (var i = 0; i < N; i++) ps.push({ v: Math.random() * 2 - 1, a: Math.random() * Math.PI * 2, w: .6 + Math.random() * .8, l: .25 + Math.random() * .35 });
    var word = mk('div', 'hxe-word', 'HURRICANE'); L.appendChild(word);
    setTimeout(function () { word.classList.add('on'); }, 900);
    var H = Math.min(vh * .62, 460), rMax = Math.min(vw * .42, 220), rMin = 10, t0 = performance.now(), last = t0;
    function frame(now) {
      var t = now - t0, dt = Math.min(48, now - last); last = now;
      g.clearRect(0, 0, C.w, C.h);
      if (t > T + 200) { L.remove(); done(); return; }
      var env = t < 400 ? t / 400 : t > T - 700 ? Math.max(0, (T + 200 - t) / 900) : 1;
      g.lineCap = 'round';
      ps.forEach(function (p) {
        var k = (1 + p.v) / 2;                              // 0 = bawah, 1 = atas (lebar)
        var rad = rMin + (rMax - rMin) * Math.pow(k, 1.35);
        var y0 = cy + p.v * H / 2 * -1;                     // v=1 di atas
        var sway = Math.sin(t / 260 + p.v * 3) * 14 * (1 - k);
        p.a += dt / 1000 * (5.5 + (1 - k) * 9) * p.w;
        var a1 = p.a, a2 = p.a - p.l;
        var front = Math.sin(a1) > 0;
        g.globalAlpha = env * (front ? .85 : .28) * (.5 + k * .5);
        g.strokeStyle = front ? '#e5f4ff' : '#64d2ff';
        g.lineWidth = front ? 1.8 : 1.1;
        g.beginPath();
        g.ellipse(cx + sway, y0, rad, rad * .26, 0, a2, a1);
        g.stroke();
      });
      g.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* riwayat: satu entri {hxe} selama Hall of Fame / dasbor mobil terbuka, supaya
     tombol Back menutupnya (pola yang sama dengan wrapped/kartu/replay) */
  var popSkip = 0;
  function histPush() { try { var tok = 'hxe' + Date.now(); history.pushState({ hxe: tok }, ''); return tok; } catch (e) { return null; } }
  function histDrop(tok) { try { if (tok && history.state && history.state.hxe === tok) { popSkip++; history.back(); } } catch (e) { } }
  var lockPr = null;
  function lock(on) {
    if (on) {
      if (lockPr === null) { lockPr = R.style.paddingRight || ''; var sbw = W.innerWidth - R.clientWidth; if (sbw > 0) R.style.paddingRight = sbw + 'px'; }
      R.classList.add('hxe-lock');
    } else if (!hofEl && !cock) {
      R.classList.remove('hxe-lock');
      if (lockPr !== null) { R.style.paddingRight = lockPr; lockPr = null; }
    }
  }

  /* ═══ 5. DASBOR MOBIL — HP dimiringkan di Dashboard ════════════════ */
  var mqLand = W.matchMedia ? W.matchMedia('(orientation: landscape) and (max-height: 540px) and (pointer: coarse)') : null;
  var cock = null, cockShut = false, cockOverlayAdded = false, cockTok = null;
  // HP benar-benar diputar — bukan jendela lebar (split-screen Android, jendela pop-up)
  function rotated() {
    var so = W.screen && screen.orientation && screen.orientation.type, land;
    if (so) land = so.indexOf('landscape') === 0;
    else land = typeof W.orientation === 'number' && Math.abs(W.orientation) === 90;
    if (!land) return false;
    var big = Math.max((W.screen && screen.width) || 0, (W.screen && screen.height) || 0);
    return !big || W.innerWidth >= big * .8;
  }
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    var n = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10;
    return n * p;
  }
  function monthTotals() {
    var D0 = data(), m = {};
    Object.keys(D0).forEach(function (k) {
      var ym = k.slice(0, 7);
      list(D0[k]).forEach(function (e) { m[ym] = (m[ym] || 0) + (+e.revenue || 0); });
    });
    return m;
  }
  function cockpitNumbers() {
    var now = new Date(), tk = HX.todayKey ? HX.todayKey() : '';
    var today = HX.todayRevenue ? HX.todayRevenue() : 0, target = (HX.target && HX.target()) || 150e6;
    var ym = tk.slice(0, 7), mt = monthTotals(), month = mt[ym] || 0, rec = 0;
    Object.keys(mt).forEach(function (k) { if (k !== ym && mt[k] > rec) rec = mt[k]; });
    var nDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var left = nDays - now.getDate();
    var closers = {};
    list(data()[tk]).forEach(function (e) { if (person(e.sp)) closers[norm(e.sp)] = 1; });
    return { today: today, target: target, month: month, rec: rec, left: left, nDays: nDays, closers: Object.keys(closers).length };
  }
  var A0 = 135, SWEEP = 270;
  function polar(cx, cy, r, deg) { var a = deg * Math.PI / 180; return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
  function arcPath(cx, cy, r, d0, d1) {
    var p0 = polar(cx, cy, r, d0), p1 = polar(cx, cy, r, d1), big = (d1 - d0) > 180 ? 1 : 0;
    return 'M' + p0.x.toFixed(1) + ' ' + p0.y.toFixed(1) + ' A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + p1.x.toFixed(1) + ' ' + p1.y.toFixed(1);
  }
  function gaugeSvg(id, max, unit, mark, markTone, zoneFrom) {
    var s = '<svg viewBox="0 0 200 200" class="hxe-gauge" id="' + id + '">';
    s += '<path d="' + arcPath(100, 100, 86, A0, A0 + SWEEP) + '" class="g-track"/>';
    if (zoneFrom != null && zoneFrom < max) s += '<path d="' + arcPath(100, 100, 86, A0 + SWEEP * zoneFrom / max, A0 + SWEEP) + '" class="g-red"/>';
    var steps = 10;
    for (var i = 0; i <= steps * 2; i++) {
      var dg = A0 + SWEEP * i / (steps * 2), major = i % 2 === 0;
      var a = polar(100, 100, major ? 74 : 79, dg), b = polar(100, 100, 85, dg);
      s += '<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" class="' + (major ? 'g-maj' : 'g-min') + '"/>';
      if (major && i % 4 === 0) {
        var t = polar(100, 100, 60, dg), v = max * i / (steps * 2) / unit;
        s += '<text x="' + t.x.toFixed(1) + '" y="' + (t.y + 4).toFixed(1) + '" class="g-num">' + (Math.round(v * 10) / 10).toString().replace('.', ',') + '</text>';
      }
    }
    if (mark != null && mark > 0 && mark <= max) {
      var m1 = polar(100, 100, 70, A0 + SWEEP * mark / max), m2 = polar(100, 100, 92, A0 + SWEEP * mark / max);
      s += '<line x1="' + m1.x.toFixed(1) + '" y1="' + m1.y.toFixed(1) + '" x2="' + m2.x.toFixed(1) + '" y2="' + m2.y.toFixed(1) + '" class="g-mark ' + markTone + '"/>';
    }
    s += '<g class="g-needle"><path d="M97 104 L100 22 L103 104 Z"/></g><circle cx="100" cy="100" r="7" class="g-hub"/>';
    s += '</svg>';
    return s;
  }
  function needle(svgId, v, max) {
    var n = cock && cock.querySelector('#' + svgId + ' .g-needle');
    if (n) n.style.transform = 'rotate(' + (SWEEP * Math.max(0, Math.min(1.02, v / max)) - SWEEP / 2) + 'deg)';
  }
  function jt(n) { return HX.money ? HX.money(n) : String(Math.round(n / 1e6)) + 'jt'; }
  function buildCockpit() {
    var N = cockpitNumbers();
    var smax = niceMax(Math.max(N.target * 1.4, N.today * 1.12));
    var tmax = niceMax(Math.max(N.rec * 1.25, N.month * 1.12));
    var su = smax >= 1e9 ? 1e9 : 1e6, tu = tmax >= 1e9 ? 1e8 : 1e7;
    var el = mk('div', 'hxe-cock');
    el.id = 'hxeCock';
    el.innerHTML =
      '<div class="ck-side">' + gaugeSvg('hxeSpeed', smax, su, N.target, 'mk-green', null) +
      '<div class="ck-cap"><b>HARI INI</b><span>×' + (su === 1e9 ? '1M' : '1jt') + '</span></div></div>' +
      '<div class="ck-mid">' +
      '<div class="ck-lights"><i class="ck-turn l"></i><span class="ck-l t">TARGET</span><span class="ck-l r">REKOR</span><i class="ck-turn r"></i></div>' +
      '<div class="ck-big"><small>OMZET HARI INI</small><b id="hxeCkToday">Rp ' + jt(N.today) + '</b></div>' +
      '<div class="ck-row"><span>BULAN INI</span><b id="hxeCkMonth">Rp ' + jt(N.month) + '</b></div>' +
      '<div class="ck-row"><span>REKOR BULAN</span><b>Rp ' + jt(N.rec) + '</b></div>' +
      '<div class="ck-fuel"><span>BBM</span><div class="ck-tank"><i id="hxeCkFuel"></i></div><em id="hxeCkLeft"></em></div>' +
      '<div class="ck-gear"><span>GIGI</span><b>D</b><em id="hxeCkClosers"></em></div>' +
      '</div>' +
      '<div class="ck-side">' + gaugeSvg('hxeTacho', tmax, tu, null, '', N.rec || null) +
      '<div class="ck-cap"><b>BULAN INI</b><span>×' + (tu === 1e8 ? '100jt' : '10jt') + '</span></div></div>' +
      '<div class="ck-hint">Putar HP tegak untuk kembali</div>';
    el.addEventListener('click', function () { cockShut = true; closeCockpit(); });
    D.body.appendChild(el);
    cock = el; cock._smax = smax; cock._tmax = tmax;
    if (!R.classList.contains('hx-overlay-open')) { R.classList.add('hx-overlay-open'); cockOverlayAdded = true; }
    lock(true);
    cockTok = histPush();
    void el.offsetWidth;
    el.classList.add('on');
    vib([40, 70, 140]);
    if (reduced()) { updateCockpit(); return; }
    // sapuan saat kunci kontak diputar
    el.classList.add('ignite');
    needle('hxeSpeed', smax, smax); needle('hxeTacho', tmax, tmax);
    setTimeout(function () { if (!cock) return; el.classList.remove('ignite'); updateCockpit(); }, 900);
  }
  function updateCockpit() {
    if (!cock) return;
    var N = cockpitNumbers();
    needle('hxeSpeed', N.today, cock._smax); needle('hxeTacho', N.month, cock._tmax);
    var q = function (id) { return cock.querySelector('#' + id); };
    if (q('hxeCkToday')) q('hxeCkToday').textContent = 'Rp ' + jt(N.today);
    if (q('hxeCkMonth')) q('hxeCkMonth').textContent = 'Rp ' + jt(N.month);
    if (q('hxeCkFuel')) q('hxeCkFuel').style.width = Math.max(4, Math.round(N.left / N.nDays * 100)) + '%';
    if (q('hxeCkLeft')) q('hxeCkLeft').textContent = N.left ? N.left + ' hari lagi' : 'hari terakhir';
    if (q('hxeCkClosers')) q('hxeCkClosers').textContent = N.closers ? N.closers + ' sales closing hari ini' : N.today > 0 ? 'closing dari channel saja' : 'belum ada closing';
    var lt = cock.querySelector('.ck-l.t'), lr = cock.querySelector('.ck-l.r');
    if (lt) lt.classList.toggle('lit', N.today >= N.target);
    if (lr) lr.classList.toggle('lit', N.rec > 0 && N.month >= N.rec);
  }
  function closeCockpit(how) {
    if (!cock) return;
    var el = cock; cock = null;
    if (how !== 'pop') histDrop(cockTok);
    cockTok = null;
    el.classList.remove('on');
    if (cockOverlayAdded) { R.classList.remove('hx-overlay-open'); cockOverlayAdded = false; }
    lock(false);
    setTimeout(function () { el.remove(); }, 320);
  }
  function checkCockpit() {
    var land = !!(mqLand && mqLand.matches) && rotated();
    var want = land && pageOn('dashboard') && !cockShut && !hofEl;
    if (!land) cockShut = false;                                // tegak lagi: boleh muncul lagi nanti
    if (want && !cock) {
      // efek lain jalan, form/modal terbuka, atau wrapped/kartu/replay sedang tampil: coba lagi sebentar lagi
      if (running || blocked(false)) {
        clearTimeout(checkCockpit._r); checkCockpit._r = setTimeout(checkCockpit, 700);
        return;
      }
      safe(buildCockpit)();
    } else if (!want && cock) closeCockpit();
  }
  if (mqLand) {
    var onMq = function () { setTimeout(checkCockpit, 120); };
    if (mqLand.addEventListener) mqLand.addEventListener('change', onMq); else if (mqLand.addListener) mqLand.addListener(onMq);
  }
  W.addEventListener('resize', function () { clearTimeout(checkCockpit._t); checkCockpit._t = setTimeout(checkCockpit, 200); });
  W.addEventListener('orientationchange', function () { setTimeout(checkCockpit, 250); });
  try { if (W.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', function () { setTimeout(checkCockpit, 250); }); } catch (e) { }

  /* ═══ 7. GASPOL — mode turbo ═══════════════════════════════════════ */
  var turboT = 0, turboL = null;
  function fireGaspol() {
    if (!begin('gaspol')) return;
    vib([15, 40, 20, 35, 25, 30, 35, 25, 50, 20, 160]);
    R.classList.remove('hxe-turbo'); void R.offsetWidth; R.classList.add('hxe-turbo');
    if (turboL) turboL.remove();
    var L = turboL = layer('hxe-turbo-l');
    L.innerHTML = '<div class="hxe-vig"></div><div class="hxe-rev"><i></i></div><div class="hxe-turbo-chip"><b>TURBO</b><span id="hxeTurboN">10</span></div>' +
      (reduced() ? '' : '<div class="hxe-gas">GASPOL!</div>');
    if (!reduced()) {
      for (var i = 0; i < (low() ? 6 : 12); i++) {
        var s = mk('i', 'hxe-speed'); s.style.top = (8 + Math.random() * 84) + '%';
        s.style.animationDelay = (Math.random() * .5).toFixed(2) + 's'; s.style.width = (30 + Math.random() * 40) + 'vw';
        L.appendChild(s);
      }
    }
    var chip = L.querySelector('.hxe-turbo-chip');
    if (chip) chip.style.top = (band().top + 10) + 'px';
    var n = 10, nEl = L.querySelector('#hxeTurboN');
    clearInterval(turboT);
    turboT = setInterval(function () {
      n--; if (nEl) nEl.textContent = n;
      if (n <= 0) {
        clearInterval(turboT);
        L.classList.add('off'); R.classList.remove('hxe-turbo');
        setTimeout(function () { L.remove(); if (turboL === L) turboL = null; }, 600);
      }
    }, 1000);
    setTimeout(done, 1800);   // efek lain boleh jalan setelah hentakan awal
  }
  function isSearch(t) {
    if (!t || t.tagName !== 'INPUT' || t.type === 'password') return false;
    if (t.type === 'search') return true;
    return /search|lookup|cari|find/i.test((t.id || '') + ' ' + (t.className || '') + ' ' + (t.getAttribute('placeholder') || ''));
  }
  D.addEventListener('input', function (e) {
    var t = e.target;
    if (!isSearch(t)) return;
    var v = String(t.value || ''), m = v.match(/gas\s*pol\s*$/i);
    if (!m) return;
    t.value = v.slice(0, m.index).replace(/\s+$/, '');
    try { t.dispatchEvent(new Event('input', { bubbles: true })); } catch (er) { }
    try { t.blur(); } catch (er) { }
    setTimeout(FIRE.gaspol, 60);
  }, true);

  /* ═══ 8. HALL OF FAME ══════════════════════════════════════════════ */
  var EXCL = ['valen', 'livia', 'melda', 'sales 1'];
  function person(sp) {
    var n = norm(sp);
    if (!n || EXCL.indexOf(n) >= 0) return false;
    if (HX.isChannel && HX.isChannel(sp)) return false;
    if (HX.isLeader && HX.isLeader(sp)) return false;
    return true;
  }
  // gabung baris satu pesanan (≤120 dtk dari baris sebelumnya, ≤150 dtk dari baris pertama) — aturan fx-badges
  function merge(rows) {
    var cl = [], cur = null;
    rows.slice().sort(function (a, b) { return (+a.ts || 0) - (+b.ts || 0); }).forEach(function (e) {
      var ts = +e.ts || 0, rev = +e.revenue || 0;
      if (cur && ts && cur.last && ts - cur.last <= 120e3 && ts - cur.first <= 150e3) { cur.rev += rev; cur.last = ts; cur.prods.push(e.prod); }
      else { cur = { first: ts, last: ts, rev: rev, prods: [e.prod] }; cl.push(cur); }
    });
    return cl;
  }
  function hofStats() {
    var D0 = data(), keys = Object.keys(D0).filter(function (k) { return /^\d{4}-\d\d-\d\d$/.test(k) && list(D0[k]).length; }).sort();
    if (!keys.length) return null;
    var names = {}, first = null, bigC = null, bestDay = null, bestSpDay = null, mostC = null;
    var mon = {}, spMon = {}, sold = {};
    keys.forEach(function (k) {
      var es = list(D0[k]), dayTot = 0, bySp = {};
      es.forEach(function (e) {
        var rev = +e.revenue || 0; dayTot += rev;
        var ym = k.slice(0, 7); mon[ym] = (mon[ym] || 0) + rev;
        if (!first || k < first.k || (k === first.k && (+e.ts || 0) < (first.ts || 0))) first = { k: k, ts: +e.ts || 0, sp: e.sp, prod: e.prod, rev: rev };
        if (!person(e.sp)) return;
        var n = norm(e.sp); names[n] = String(e.sp).trim();
        (bySp[n] = bySp[n] || []).push(e);
        var km = n + '|' + ym; spMon[km] = (spMon[km] || 0) + rev;
      });
      var allBy = {};
      es.forEach(function (e) { var n = norm(e.sp); (allBy[n] = allBy[n] || []).push(e); });
      var dayOrders = 0;
      Object.keys(allBy).forEach(function (n) { dayOrders += merge(allBy[n]).length; });
      if (!bestDay || dayTot > bestDay.rev) bestDay = { k: k, rev: dayTot, n: dayOrders };
      Object.keys(bySp).forEach(function (n) {
        var cl = merge(bySp[n]), tot = 0;
        cl.forEach(function (c) { tot += c.rev; });
        if (tot > 0) (sold[n] = sold[n] || {})[k] = 1;
        cl.forEach(function (c) { if (!bigC || c.rev > bigC.rev) bigC = { n: n, k: k, rev: c.rev, prods: c.prods }; });
        if (!bestSpDay || tot > bestSpDay.rev) bestSpDay = { n: n, k: k, rev: tot, c: cl.length };
        if (!mostC || cl.length > mostC.c || (cl.length === mostC.c && tot > mostC.rev)) mostC = { n: n, k: k, c: cl.length, rev: tot };
      });
    });
    var bestMon = null, cur = String(HX.todayKey ? HX.todayKey() : keys[keys.length - 1]).slice(0, 7);
    Object.keys(mon).forEach(function (ym) { if (!bestMon || mon[ym] > bestMon.rev) bestMon = { ym: ym, rev: mon[ym] }; });
    var bestSpMon = null;
    Object.keys(spMon).forEach(function (km) { var p = km.split('|'); if (!bestSpMon || spMon[km] > bestSpMon.rev) bestSpMon = { n: p[0], ym: p[1], rev: spMon[km] }; });
    // beruntun: hari kerja berturut-turut ada closing. Minggu tanpa closing &
    // hari tanpa penjualan sama sekali tidak memutus (sama dengan lencana Beruntun)
    var streak = null;
    Object.keys(sold).forEach(function (n) {
      var c = 0, st = null, s = sold[n];
      keys.forEach(function (k) {
        if (s[k]) { if (!c) st = k; c++; if (!streak || c > streak.c) streak = { n: n, c: c, from: st, to: k }; }
        else if (new Date(k + 'T12:00:00').getDay() !== 0) c = 0;
      });
    });
    function nm(n) { return names[n] || n; }
    function prodsTxt(p) {
      var u = []; (p || []).forEach(function (x) { if (x && u.indexOf(x) < 0) u.push(x); });
      return u.length ? (u.slice(0, 2).join(' + ') + (u.length > 2 ? ' +' + (u.length - 2) : '')) : '';
    }
    var out = [];
    if (bigC) out.push({ id: 'big', lbl: 'Closing Terbesar', val: rp(bigC.rev), who: nm(bigC.n), meta: prodsTxt(bigC.prods) + ' · ' + dLbl(bigC.k) });
    if (bestSpDay) out.push({ id: 'spday', lbl: 'Hari Terbaik Sales', val: rp(bestSpDay.rev), who: nm(bestSpDay.n), meta: bestSpDay.c + ' closing · ' + dLbl(bestSpDay.k) });
    if (bestSpMon) out.push({ id: 'spmon', lbl: 'Bulan Terbaik Sales', val: rp(bestSpMon.rev), who: nm(bestSpMon.n), meta: mLbl(bestSpMon.ym) + (bestSpMon.ym === cur ? ' · masih berjalan' : '') });
    if (streak) out.push({ id: 'streak', lbl: 'Beruntun Terpanjang', val: streak.c + ' hari', who: nm(streak.n), meta: dLbl(streak.from) + ' – ' + dLbl(streak.to) });
    if (mostC) out.push({ id: 'most', lbl: 'Closing Terbanyak Sehari', val: mostC.c + ' closing', who: nm(mostC.n), meta: rp(mostC.rev) + ' · ' + dLbl(mostC.k) });
    if (bestDay) out.push({ id: 'day', lbl: 'Hari Terbaik ' + (HX.brandShort || 'Tim'), val: rp(bestDay.rev), who: dLbl(bestDay.k), meta: bestDay.n + ' order tercatat' });
    if (bestMon) out.push({ id: 'mon', lbl: 'Bulan Terbaik ' + (HX.brandShort || 'Tim'), val: rp(bestMon.rev), who: mLbl(bestMon.ym), meta: bestMon.ym === cur ? 'masih berjalan' : 'rekor bulanan' });
    if (first) out.push({ id: 'first', lbl: 'Closing Pertama', val: dLbl(first.k), who: String(first.sp || '').trim(), meta: (first.prod || '') + ' · awal semuanya' });
    return { since: keys[0], plaques: out };
  }
  var hofEl = null, hofOverlayAdded = false, hofPrevFocus = null, hofTok = null;
  function openHof() {
    if (hofEl || blocked(false) || !begin('hof')) return;
    var S = hofStats();
    if (!S) { done(); return; }
    if (cock) closeCockpit();
    vib([20, 60, 20, 60, 120]);
    hofPrevFocus = D.activeElement;
    var el = mk('div', 'hxe-hof');
    el.id = 'hxeHof';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Hall of Fame');
    el.innerHTML =
      '<div class="hof-in">' +
      '<button class="hof-x" type="button" aria-label="Tutup">' +
      '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '<div class="hof-kick">RAHASIA · KAMU MENEMUKANNYA</div>' +
      '<h2 class="hof-title">HALL OF FAME</h2>' +
      '<div class="hof-sub">Rekor sepanjang masa ' + esc(HX.brand || 'Hurricane XCS') + ' · sejak ' + esc(dLbl(S.since)) + '</div>' +
      '<div class="hof-grid">' + S.plaques.map(function (p, i) {
        return '<div class="hof-plq" data-id="' + p.id + '" style="--i:' + i + '">' +
          '<div class="plq-lbl">' + esc(p.lbl) + '</div>' +
          '<div class="plq-val">' + esc(p.val) + '</div>' +
          '<div class="plq-who">' + esc(p.who) + '</div>' +
          '<div class="plq-meta">' + esc(p.meta) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="hof-foot">Jangan bilang siapa-siapa caranya ke sini.</div>' +
      '</div>';
    el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('.hof-x')) closeHof(); });
    D.body.appendChild(el);
    hofEl = el;
    if (!R.classList.contains('hx-overlay-open')) { R.classList.add('hx-overlay-open'); hofOverlayAdded = true; }
    lock(true);
    hofTok = histPush();
    // Tab tetap di dalam Hall of Fame (hanya satu tombol: tutup)
    el.addEventListener('keydown', function (e) { if (e.key === 'Tab') { e.preventDefault(); try { el.querySelector('.hof-x').focus(); } catch (er) { } } });
    void el.offsetWidth;
    el.classList.add('on');
    if (reduced()) el.classList.add('still');
    try { el.querySelector('.hof-x').focus({ preventScroll: true }); } catch (e) { }
    setTimeout(done, 400);
  }
  function closeHof(how) {
    if (!hofEl) return;
    var el = hofEl; hofEl = null;
    if (how !== 'pop') histDrop(hofTok);
    hofTok = null;
    el.classList.remove('on');
    if (hofOverlayAdded) { R.classList.remove('hx-overlay-open'); hofOverlayAdded = false; }
    lock(false);
    setTimeout(function () { el.remove(); }, 360);
    try { if (hofPrevFocus && hofPrevFocus.focus) hofPrevFocus.focus({ preventScroll: true }); } catch (e) { }
    setTimeout(checkCockpit, 400);
  }
  W.addEventListener('popstate', function () {
    if (popSkip > 0) { popSkip--; return; }
    if (hofEl && hofTok) { hofTok = null; closeHof('pop'); }
    else if (cock && cockTok) { cockTok = null; cockShut = true; closeCockpit('pop'); }
  });
  // keyboard (desktop): ↑ ↑ ↓ ↓ beruntun cepat (tiap tombol ≤ 350 ms), hanya
  // saat tidak ada yang fokus/terbuka — menggulir biasa tidak membukanya.
  var seqK = [];
  D.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && hofEl) { closeHof(); return; }
    if (e.key === 'Escape' && cock) { cockShut = true; closeCockpit(); return; }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    var tg = e.target;
    if (e.repeat || hofEl || cock || blocked(false) || (tg !== D.body && tg !== R && tg !== D)) { seqK = []; return; }
    var now = Date.now(), last = seqK[seqK.length - 1];
    if (last && now - last.t > 300) {
      // jeda pendek (300–800 ms) = masih menggulir: jangan mulai rangkaian bersih
      seqK = now - last.t < 800 ? [{ d: 'X', t: last.t }] : [];
    }
    seqK.push({ d: e.key === 'ArrowUp' ? 'U' : 'D', t: now });
    // ↑↑↓↓ harus berdiri sendiri: tombol panah sebelumnya ≥ 0,8 dtk sebelum ↑ pertama
    // (bagian dari rangkaian gulir ↓↓↓↑↑↓↓ tidak dihitung)
    var n = seqK.length;
    if (n >= 4 && seqK.slice(-4).map(function (x) { return x.d; }).join('') === 'UUDD') {
      var prev = seqK[n - 5];
      seqK = [];
      if (!prev) setTimeout(FIRE.hof, 0);                              // sesudah aksi gulir bawaan
    }
    if (seqK.length > 8) seqK = seqK.slice(-8);
  });
  var seqS = [];
  function swipe(dir) {
    var now = Date.now();
    seqS.push({ d: dir, t: now });
    seqS = seqS.filter(function (s) { return now - s.t < 4000; }).slice(-4);
    if (seqS.map(function (s) { return s.d; }).join('') === 'UUDD') { seqS = []; FIRE.hof(); return true; }
    return false;
  }
  var tsw = null;
  D.addEventListener('touchstart', function (e) {
    var t = e.touches && e.touches[0];
    // usap di logo + nama (header .brand) — bagian header lain tetap bisa menggulir / tarik-muat-ulang
    if (!t || e.touches.length > 1 || !e.target.closest || !e.target.closest('header .brand') || blocked(false)) { tsw = null; return; }
    tsw = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });
  D.addEventListener('touchend', function (e) {
    var s = tsw; tsw = null;
    var t = e.changedTouches && e.changedTouches[0];
    if (!s || !t) return;
    var dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Date.now() - s.t > 700 || Math.abs(dy) < 22 || Math.abs(dx) > Math.abs(dy) * .8) return;
    swipe(dy < 0 ? 'U' : 'D');
  }, { passive: true });

  /* ═══ 9. MALAM — bulan terbit + cap burung hantu ═══════════════════ */
  var MOON_KEY = 'hx-egg-moon', moonL = null, moonShown = null;
  function nightId() {
    // jam WIB, sama dengan cap burung hantu (HP di WITA/WIT tetap konsisten)
    var w = new Date(Date.now() + 7 * 3600e3), h = w.getUTCHours();
    if (!(h >= 22 || h < 4)) return null;
    if (h < 4) w = new Date(w.getTime() - 6 * 3600e3);
    return w.getUTCFullYear() + '-' + (w.getUTCMonth() + 1) + '-' + w.getUTCDate();
  }
  function fireMoon(force) {
    var id = nightId();
    if (!force && (!id || store(MOON_KEY) === id || moonShown === id)) return;
    if (running || hofEl || cock || moonL || blocked(false)) return;
    if (id) { store(MOON_KEY, id); moonShown = id; }
    var L = moonL = layer('hxe-night');      // suasana saja: tidak mengunci efek lain
    var stars = '';
    for (var i = 0; i < 10; i++) stars += '<i class="hxe-star" style="right:' + (8 + Math.random() * 150).toFixed(0) + 'px;top:' + (-14 + Math.random() * 100).toFixed(0) + 'px;animation-delay:' + (Math.random() * 1.6).toFixed(2) + 's"></i>';
    L.innerHTML = '<div class="hxe-sky">' + stars + '</div>' +
      '<div class="hxe-moon"><svg viewBox="0 0 100 100"><defs><mask id="hxeMoonM"><rect width="100" height="100" fill="#fff"/><circle cx="64" cy="40" r="34" fill="#000"/></mask></defs>' +
      '<circle cx="50" cy="50" r="38" fill="#fff6d6" mask="url(#hxeMoonM)"/></svg></div>' +
      '<div class="hxe-night-msg"><b>Masih lembur?</b><span>Closing jam segini dapat cap burung hantu.</span></div>';
    var top = band().top;
    ['.hxe-sky', '.hxe-moon'].forEach(function (s) { var e = L.querySelector(s); if (e) e.style.top = (top + 14) + 'px'; });
    var msg = L.querySelector('.hxe-night-msg'); if (msg) msg.style.top = (top + 92) + 'px';
    if (reduced()) L.classList.add('still');
    void L.offsetWidth; L.classList.add('on');
    setTimeout(function () { L.classList.add('off'); }, 5600);
    setTimeout(function () { L.remove(); moonL = null; }, 6400);
  }
  var OWL = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M3 2.6l2.3 1.7A6 6 0 0 1 8 3.8a6 6 0 0 1 2.7.5L13 2.6V9.4A5 5 0 0 1 8 14.6 5 5 0 0 1 3 9.4z" fill="currentColor"/>' +
    '<circle cx="5.9" cy="8" r="2" fill="#000"/><circle cx="10.1" cy="8" r="2" fill="#000"/><circle cx="6.2" cy="7.8" r=".8" fill="currentColor"/><circle cx="10.4" cy="7.8" r=".8" fill="currentColor"/>' +
    '<path d="M7.3 10.4L8 11.6l.7-1.2z" fill="#000"/></svg>';
  function owl(ts, withTime) {
    var s = mk('span', 'hxe-owl', OWL + (withTime ? '<em>' + wibHm(ts) + '</em>' : ''));
    s.title = 'Burung Hantu · dicatat ' + wibHm(ts) + ' WIB';
    s.setAttribute('aria-label', s.title);
    return s;
  }
  function stampLog() {
    var log = D.getElementById('entryLog');
    if (!log) return;
    var rows = log.querySelectorAll('.ei'), es;
    try { es = gE(); } catch (e) { return; }
    es = Array.isArray(es) ? es : [];
    if (rows.length !== es.length) return;
    for (var ri = 0; ri < rows.length; ri++) {
      var e = es[es.length - 1 - ri], row = rows[ri];
      if (!e || !nightTs(e.ts) || row.querySelector('.hxe-owl')) continue;
      var del = row.querySelector('.ed');
      if (del) row.insertBefore(owl(e.ts, false), del); else row.appendChild(owl(e.ts, false));
    }
  }
  function stampMySales() {
    var box = D.getElementById('msSalesList'), sel = D.getElementById('msSPSelect');
    if (!box || !sel || !sel.value) return;
    var pr = String(sel.value).split('|'), sp = pr[0], team = pr[1];
    var by = {}, D0 = data();
    Object.keys(D0).forEach(function (k) {
      list(D0[k]).forEach(function (e) { if (e.sp === sp && e.team === team) (by[k] = by[k] || []).push(e); });
    });
    var dates = Object.keys(by).sort().reverse();
    var groups = box.querySelectorAll('.ms-date-group');
    for (var gi = 0; gi < groups.length && gi < dates.length; gi++) {
      var es = by[dates[gi]].slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      var cs = groups[gi].querySelectorAll('.ms-sale-card');
      if (cs.length !== es.length) continue;
      for (var ci = 0; ci < cs.length; ci++) {
        var e = es[ci];
        if (!nightTs(e.ts) || cs[ci].querySelector('.hxe-owl')) continue;
        var meta = cs[ci].querySelector('.ms-sale-meta') || cs[ci];
        meta.appendChild(owl(e.ts, true));
      }
    }
  }
  function watch(id, fn) {
    var el = D.getElementById(id);
    if (!el || !W.MutationObserver) return;
    new MutationObserver(function () { try { fn(); } catch (e) { } }).observe(el, { childList: true });
    try { fn(); } catch (e) { }
  }

  /* ═══ ketukan ═════════════════════════════════════════════════════ */
  var RX_XCSR = /\bXCSR\b/i, RX_SBF = /SPRING\s*BUFFER|\bSBF\b/i,
    RX_XCS = /TWIN\s*TURBO|\bXCS\b|SUPERFAST|COMPETITION|ECO\s*TURBO|ECO\s*POWER|\bEV\b|ULTRA\s*BOOST|GROUND\s*WIRE/i;
  function famOf(t) {
    for (var n = t, i = 0; n && n !== D.body && i < 3; n = n.parentElement, i++) {
      var s = (n.textContent || '').replace(/\s+/g, ' ').trim();
      if (!s) continue;
      if (s.length > 34) return null;
      if (RX_XCSR.test(s)) return 'xcsr';
      if (RX_SBF.test(s)) return 'sbf';
      if (RX_XCS.test(s)) return 'xcs';
    }
    return null;
  }
  var seq = null, cool = 0;
  function count(key, need, fn) {
    var now = Date.now();
    if (!seq || seq.key !== key || now - seq.t > 750) seq = { key: key, n: 0, t: now };
    seq.n++; seq.t = now;
    if (seq.n >= need) { seq = null; if (now > cool) { cool = now + 1500; fn(); } }
  }
  function onTap(t) {
    if (!t || !t.closest) return;
    if (blocked(true)) { seq = null; return; }
    if (t.closest('input,select,textarea,option,[contenteditable="true"],.hxe-layer,.hxe-hof,.hxe-cock,.hxe-toast')) return;
    if (t.closest('.brand-logo,.brand')) return count('logo', 7, FIRE.hurricane);
    var f = famOf(t);
    if (f) return count('p:' + f, 5, function () { FIRE[f](); });
    seq = null;
  }
  var down = null;
  D.addEventListener('pointerdown', function (e) {
    if (e.button > 0 || e.isPrimary === false) { down = null; return; }
    down = { x: e.clientX, y: e.clientY, t: Date.now(), tg: e.target };
  }, true);
  D.addEventListener('pointerup', function (e) {
    var d = down; down = null;
    if (!d || Date.now() - d.t > 450) return;
    if (Math.abs(e.clientX - d.x) > 12 || Math.abs(e.clientY - d.y) > 12) return;
    onTap(d.tg);
  }, true);
  D.addEventListener('pointercancel', function () { down = null; }, true);

  /* ═══ siklus ══════════════════════════════════════════════════════ */
  var FIRE = {
    sbf: safe(fireSbf), xcs: safe(fireXcs), xcsr: safe(fireXcsr), hurricane: safe(fireHurricane), gaspol: safe(fireGaspol),
    hof: safe(openHof), moon: safe(function () { fireMoon(true); }), cockpit: safe(function () { if (!cock) buildCockpit(); })
  };
  // muat ulang / tab dibuang saat Hall of Fame terbuka: buang entri riwayat {hxe} yang basi
  // (replaceState saja tidak cukup: entri ekstranya tetap ada dan Back pertama "mati" — mundur satu langkah)
  try { if (history.state && history.state.hxe) { popSkip++; history.back(); } } catch (e) { }
  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    watch('entryLog', stampLog);
    watch('msSalesList', stampMySales);
    setTimeout(function () { safe(fireMoon)(false); }, 1800);
    checkCockpit();
  }
  if (HX.on) {
    HX.on('ready', boot);
    HX.on('render', function () { try { stampLog(); } catch (e) { } if (cock) updateCockpit(); });
    HX.on('sale', function () {
      if (!cock) return;
      var ts = cock.querySelectorAll('.ck-turn');
      for (var i = 0; i < ts.length; i++) { ts[i].classList.remove('blink'); void ts[i].offsetWidth; ts[i].classList.add('blink'); }
      vib([30, 50, 30]);
    });
    HX.on('page', function () { setTimeout(checkCockpit, 60); });
  }
  D.addEventListener('visibilitychange', function () { if (D.visibilityState === 'visible') setTimeout(function () { safe(fireMoon)(false); }, 900); });
  // cadangan bila 'ready' sudah lewat sebelum file ini dimuat
  (function wait(n) {
    var ok = false;
    try { ok = Object.keys(data()).length > 0 && !!W._cfgTeamsLoaded; } catch (e) { }
    if (ok) boot(); else if (n < 120) setTimeout(function () { wait(n + 1); }, 500);
  })(0);

  HX.egg = {
    fire: function (k) { if (FIRE[k]) FIRE[k](); },
    hof: hofStats,
    state: function () { return { running: running, hof: !!hofEl, cockpit: !!cock, turbo: R.classList.contains('hxe-turbo') }; },
    _famOf: famOf
  };
})();
