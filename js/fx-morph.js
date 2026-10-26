/* ══════════════════════════════════════════════════════════════════════
   FX MORPH — modal detail sales (#spMo) tumbuh dari kartu yang diketuk,
   kembali ke kartunya saat ditutup, dan di HP bisa ditarik ke bawah.

   HANYA MEMBACA. Tidak pernah menulis ke Firebase. Fungsi app.js
   (openSPModal / openSPMonth / openSPMonthly / closeSPMo / _spMoRepaint)
   hanya dibungkus (penanda skrip lain disalin); isi modal tidak diubah.

   Buka   Klik pada kartu/baris dicatat (listener capture). App menggambar
          modal seperti biasa, lalu permukaan kaca sementara (.hx-mo-ghost,
          tampilannya disalin dari .mbox) bergerak dari kotak kartu ke kotak
          lembar: FLIP translate + scale (compositor) dengan pegas, radius
          sudut dikoreksi terhadap skala. Overlay redup+blur (.hx-mo-scrim)
          memudar masuk; isi lembar muncul bertahap sedikit sesudahnya.
          Tanpa sumber (dibuka dari kode): lembar naik / muncul memantul.
   Tutup  Semua jalur (X, ketuk overlay, Escape, tombol Kembali Android,
          closeSPMo() dari mana pun): kebalikannya ke kartu kalau kartunya
          masih terlihat; kalau tidak, turun + pudar singkat. Modal baru
          disembunyikan (closeSPMo asli) di akhir animasi. Ditutup saat
          masih membuka = animasi buka diputar balik.
   Tarik  HP (lembar bawah): tarik ke bawah dari mana saja selama scroll
          lembar di paling atas. Lepas > 25% tinggi atau sentil cepat =
          tutup lewat closeSPMo; selain itu memantul kembali. Scroll di
          dalam lembar, ketukan tombol dan cubit-zoom tidak terganggu.
   Kembali  Tombol Kembali Android / Escape menutup lembar (satu entri
          riwayat selama lembar terbuka, dibersihkan di semua jalur tutup).
   Kurangi Gerak: pudar saja. Desktop: morph ya, tarik tidak.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var W = window, D = document, R = D.documentElement;
  if (W.__hxMorph) return;
  W.__hxMorph = true;
  if (typeof R.animate !== 'function') return;   // tanpa Web Animations: tampilan lama

  /* ── utilitas ─────────────────────────────────────────────────────── */
  var mqRM = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() {
    var hx = W.HX;
    if (hx && typeof hx.reduced === 'function') return !!hx.reduced();
    return !!(mqRM && mqRM.matches);
  }
  function tier() { return (W.HX && W.HX.tier) || 'high'; }
  function now() { return W.performance && performance.now ? performance.now() : Date.now(); }
  // waktu input sebenarnya (bukan saat handler jalan — di HP sibuk bisa telat
  // puluhan ms); Safari lama memakai epoch → pakai now()
  function evTime(e) {
    var t = e && e.timeStamp, n = now();
    return (t > 0 && Math.abs(n - t) < 5000) ? t : n;
  }
  function warn(e) { try { console.warn('[fx-morph]', e); } catch (x) { } }
  function keepMarkers(from, to) {
    for (var k in from) if (Object.prototype.hasOwnProperty.call(from, k)) to[k] = from[k];
    return to;
  }
  function px(n) { return (Math.round(n * 100) / 100) + 'px'; }
  function n4(n) { return Math.round(n * 10000) / 10000; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hasCls(el, c) { return !!(el && el.classList && el.classList.contains(c)); }
  // pegas teredam (respons tangga, dinormalkan ke t 0..1)
  function spring(z, w) {
    var wd = w * Math.sqrt(1 - z * z);
    return function (t) {
      if (t >= 1) return 1;
      return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
    };
  }
  // cubic-bezier sebagai fungsi (untuk keyframe yang disampel)
  function bez(x1, y1, x2, y2) {
    function c(t, a, b) { return ((1 + 3 * a - 3 * b) * t + (3 * b - 6 * a)) * t * t + 3 * a * t; }
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 22; i++) {
        var v = c(t, x1, x2);
        if (Math.abs(v - x) < 1e-5) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return c(t, y1, y2);
    };
  }
  var easeOut = bez(0.2, 0.7, 0.3, 1);
  var easeIn = bez(0.5, 0, 0.75, 0);

  /* ── keadaan ──────────────────────────────────────────────────────── */
  var mo = null, box = null, scrim = null, ghost = null;
  var st = 'closed';        // closed | opening | open | closing
  var cur = null;           // {s: sumber|null, sheet: bool}
  var anims = [];           // animasi struktur (hantu, radius, scrim, lembar)
  var cAnims = [];          // animasi isi lembar
  var closeDone = null;     // closeSPMo asli, dipanggil di akhir animasi tutup
  var closeKind = null;     // {kind:'drag', y, v} dari tarikan
  var repainting = false;   // _spMoRepaint sedang berjalan (data live)
  var drag = null;
  var suppressUntil = 0;
  var lastRel = null;       // lepas tarikan terakhir (untuk tes)

  function shown() { return !!(mo && mo.style.display && mo.style.display !== 'none'); }
  function track(a) { anims.push(a); return a; }
  function stopList(list) {
    for (var i = 0; i < list.length; i++) {
      list[i].onfinish = null;
      try { list[i].cancel(); } catch (e) { }
    }
  }
  function stopAnims() { var a = anims, c = cAnims; anims = []; cAnims = []; stopList(a); stopList(c); }
  function dropC() {
    var a = this, i = cAnims.indexOf(a);
    if (i >= 0) cAnims.splice(i, 1);
    a.onfinish = null;
    try { a.cancel(); } catch (e) { }   // keadaan akhir = keadaan asli
  }
  function removeGhost() {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
    if (mo) mo.classList.remove('hx-mo-ghosting');
  }
  function cleanup() {
    stopAnims();
    removeGhost();
    endDragFlags();
    drag = null;
    if (!mo) return;
    mo.classList.remove('hx-mo-closing');
    mo.classList.remove('hx-mo-armed');
    var s = box.style;
    s.transform = ''; s.transition = ''; s.opacity = ''; s.willChange = '';
    scrim.style.opacity = '';
  }

  /* ── geometri ─────────────────────────────────────────────────────── */
  // lembar bawah HP: menempel di bawah & selebar layar
  function isSheet(r) {
    r = r || box.getBoundingClientRect();
    var m = mo.getBoundingClientRect();
    return r.bottom >= m.bottom - 2 && r.width >= m.width - 2;
  }
  function radii4(el) {
    var cs = getComputedStyle(el);
    return [parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0,
            parseFloat(cs.borderBottomRightRadius) || 0, parseFloat(cs.borderBottomLeftRadius) || 0];
  }
  // radius terlihat (rv) dibagi skala → nilai sebelum skala; elips per sumbu
  function radiusAt(from, to, p, a, b) {
    var hx = [], vy = [];
    for (var i = 0; i < 4; i++) {
      var rv = Math.max(0, from[i] + (to[i] - from[i]) * p);
      hx.push(px(rv / a)); vy.push(px(rv / b));
    }
    return hx.join(' ') + ' / ' + vy.join(' ');
  }
  // kotak terlihat sebuah elemen (dipotong tabel geser & layar)
  function visRect(el) {
    var r = el.getBoundingClientRect();
    if (!(r.width > 4 && r.height > 4)) return null;
    var L = r.left, Rt = r.right;
    var c = el.closest ? el.closest('.tw') : null;
    if (c) { var q = c.getBoundingClientRect(); L = Math.max(L, q.left); Rt = Math.min(Rt, q.right); }
    L = Math.max(L, 0); Rt = Math.min(Rt, W.innerWidth || R.clientWidth);
    if (Rt - L < 4) return null;
    return { left: L, top: r.top, width: Rt - L, height: r.height, right: Rt, bottom: r.bottom };
  }
  function srcRadius(el, r) {
    if (el.tagName === 'TR') return [Math.min(12, r.height / 2), Math.min(12, r.height / 2), Math.min(12, r.height / 2), Math.min(12, r.height / 2)];
    if (hasCls(el, 'hxl-island')) return [r.height / 2, r.height / 2, r.height / 2, r.height / 2];
    var q = radii4(el);
    for (var i = 0; i < 4; i++) if (!(q[i] > 0)) q[i] = 12;
    return q;
  }
  // pita layar yang benar-benar terlihat (di bawah header, di atas nav HP)
  function band() {
    var top = 0, bot = W.innerHeight || R.clientHeight;
    var h = D.querySelector('header');
    if (h) {
      var hr = h.getBoundingClientRect(), hp = getComputedStyle(h).position;
      // hanya bila header benar-benar menempel di atas layar (di HP header
      // ikut ter-scroll: setelah lewat, kotaknya negatif dan bukan penutup)
      if ((hp === 'fixed' || hp === 'sticky') && hr.top <= 1 && hr.bottom > 0) top = hr.bottom;
    }
    var nv = D.querySelector('.nav-wrapper');
    if (nv) {
      var nr = nv.getBoundingClientRect();
      if (nr.height && nr.top > bot / 2 && nr.top < bot) bot = nr.top;
    }
    return { top: top, bottom: bot };
  }

  /* ── sumber: kartu / baris yang diketuk ───────────────────────────── */
  var SRC = '.spc,.lbi,.sp-lookup-card,.hxl-island,tr[data-k],[data-k],[onclick*="openSP"]';
  var last = null;
  function note(e) {
    var t = e.target;
    if (!t || t.nodeType !== 1 || !t.closest) return;
    if (mo && mo.contains(t)) return;
    var el = t.closest(SRC);
    if (!el) { last = null; return; }
    var rec = { el: el, t: now() };
    // pil "closing masuk" (fx-live) menghilang sebelum modal dibuka: ukur sekarang
    if (hasCls(el, 'hxl-island')) { var r = visRect(el); if (r) { rec.rect = r; rec.rad = srcRadius(el, r); } }
    last = rec;
  }
  function sig(el) {
    if (hasCls(el, 'spc')) return '.spc';
    if (hasCls(el, 'lbi')) return '.lbi';
    if (hasCls(el, 'sp-lookup-card')) return '.sp-lookup-card';
    return el.tagName.toLowerCase();
  }
  function takeSource(sp, team) {
    var l = last;
    last = null;
    if (!l || now() - l.t > 900) return null;
    if (!R.contains(l.el)) return l.rect ? { el: null, k: null, sel: '', page: null, rect: l.rect, rad: l.rad } : null;
    var el = l.el, k = el.getAttribute('data-k');
    if (k && k !== sp + '|' + team) return null;
    var r = visRect(el);
    if (!r) return null;
    return { el: el, k: k, sel: sig(el), page: el.closest ? el.closest('.page') : null, rect: r, rad: srcRadius(el, r) };
  }
  // kartu tujuan saat menutup: elemen yang sama, atau penggantinya (app.js
  // membangun ulang daftar lewat innerHTML) dengan data-k yang sama
  function findTarget(s) {
    if (!s) return null;
    if (s.page && !hasCls(s.page, 'active')) return null;
    var el = s.el;
    if (!el || !R.contains(el)) {
      el = null;
      if (s.k) {
        var q = s.sel + '[data-k="' + s.k.replace(/["\\]/g, '\\$&') + '"]';
        try { el = (s.page || D).querySelector(q); } catch (e) { el = null; }
      }
    }
    if (!el) return null;
    var r = visRect(el);
    if (!r) return null;
    var b = band();
    var vis = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
    if (vis < Math.min(r.height * 0.5, 60) || vis <= 0) return null;
    return { el: el, rect: r, rad: srcRadius(el, r) };
  }

  /* ── hantu (permukaan kaca yang bergerak) ─────────────────────────── */
  function makeGhost(fin) {
    removeGhost();
    var cs = getComputedStyle(box), m = mo.getBoundingClientRect();
    var g = D.createElement('div');
    g.className = 'hx-mo-ghost';
    g.setAttribute('aria-hidden', 'true');
    var s = g.style;
    s.left = px(fin.left - m.left); s.top = px(fin.top - m.top);
    s.width = px(fin.width); s.height = px(fin.height);
    s.backgroundColor = cs.backgroundColor;
    s.backgroundImage = cs.backgroundImage;
    s.boxShadow = cs.boxShadow;
    mo.insertBefore(g, box);
    ghost = g;
    mo.classList.add('hx-mo-ghosting');   // sesudah gaya disalin (getComputedStyle hidup)
    return g;
  }

  /* ── isi lembar: muncul bertahap / pudar keluar ───────────────────── */
  function units(lim) {
    var out = [];
    function add(el) {
      var r = el.getBoundingClientRect();
      if (r.height > 0 && r.top < lim) out.push(el);
    }
    for (var i = 0; i < box.children.length; i++) {
      var c = box.children[i];
      if ((c.id === 'mKPIs' || c.id === 'mProds') && c.children.length) {
        for (var j = 0; j < c.children.length; j++) add(c.children[j]);
      } else add(c);
    }
    return out;
  }
  function contentIn(lim, delay, dist) {
    var list = units(lim), step = tier() === 'low' ? 0 : 22;
    for (var i = 0; i < list.length; i++) {
      var a = list[i].animate([
        { opacity: 0, transform: 'translate3d(0,' + dist + 'px,0)' },
        { opacity: 1, transform: 'translate3d(0,0,0)' }
      ], { duration: 380, delay: delay + Math.min(i, 9) * step, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
      a.onfinish = dropC;
      cAnims.push(a);
    }
  }
  function contentOut(dur) {
    for (var i = 0; i < box.children.length; i++) {
      cAnims.push(box.children[i].animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: dur, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }));
    }
  }

  /* ── BUKA ─────────────────────────────────────────────────────────── */
  function openFx(s) {
    cleanup();
    st = 'opening';
    histPush();
    var fin = box.getBoundingClientRect();
    var sheet = isSheet(fin);
    cur = { s: s, sheet: sheet };
    if (reduced()) {
      track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear', fill: 'both' }));
      track(box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear', fill: 'both' })).onfinish = endOpen;
      return;
    }
    if (s && s.rect) morphIn(s, fin, sheet);
    else riseIn(fin, sheet);
  }
  function morphIn(s, fin, sheet) {
    var src = s.rect, dur = sheet ? 460 : 440;
    var to = radii4(box);
    var g = makeGhost(fin);
    var f = spring(0.78, 8), n = tier() === 'low' ? 14 : 24;
    var sx = src.width / fin.width, sy = src.height / fin.height;
    var dx = src.left - fin.left, dy = src.top - fin.top;
    var kf = [], kr = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n, p = f(t);
      var a = sx + (1 - sx) * p, b = sy + (1 - sy) * p;
      kf.push({
        offset: t,
        transform: 'translate(' + px(dx * (1 - p)) + ',' + px(dy * (1 - p)) + ') scale(' + n4(a) + ',' + n4(b) + ')',
        opacity: t < 0.2 ? n4(easeOut(t / 0.2)) : 1
      });
      kr.push({ offset: t, borderRadius: radiusAt(s.rad, to, clamp(p, 0, 1), a, b) });
    }
    track(g.animate(kf, { duration: dur, easing: 'linear', fill: 'both' })).onfinish = endOpen;
    track(g.animate(kr, { duration: dur, easing: 'linear', fill: 'both' }));
    track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.round(dur * 0.75), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }));
    // satu kilau cahaya menyapu kaca saat lembar mengembang (bukan di HP lemah)
    if (tier() !== 'low') {
      var sh = D.createElement('i');
      sh.className = 'hx-mo-sheen';
      g.appendChild(sh);
      track(sh.animate([
        { transform: 'translate3d(-110%,0,0) skewX(-14deg)', opacity: 0 },
        { transform: 'translate3d(40%,0,0) skewX(-14deg)', opacity: 1, offset: 0.35 },
        { transform: 'translate3d(240%,0,0) skewX(-14deg)', opacity: 0 }
      ], { duration: dur, easing: 'cubic-bezier(.3,.55,.35,1)', fill: 'both' }));
    }
    contentIn(fin.bottom, Math.round(dur * 0.34), sheet ? 16 : 12);
  }
  // dibuka tanpa kartu sumber: lembar naik (HP) / muncul memantul (desktop)
  function riseIn(fin, sheet) {
    var dur = 420, f = spring(0.8, 8), n = tier() === 'low' ? 12 : 20, kf = [];
    var y0 = sheet ? Math.min(fin.height * 0.45, 280) : 18, s0 = sheet ? 1 : 0.94;
    for (var i = 0; i <= n; i++) {
      var t = i / n, p = f(t);
      if (sheet) p = Math.min(p, 1);   // jangan terangkat dari tepi bawah
      kf.push({
        offset: t,
        transform: 'translate3d(0,' + px(y0 * (1 - p)) + ',0) scale(' + n4(s0 + (1 - s0) * p) + ')',
        opacity: t < 0.25 ? n4(easeOut(t / 0.25)) : 1
      });
    }
    track(box.animate(kf, { duration: dur, easing: 'linear', fill: 'both' })).onfinish = endOpen;
    track(scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' }));
    contentIn(fin.bottom, 70, sheet ? 14 : 10);
  }
  function endOpen() {
    if (st !== 'opening') return;
    var a = anims;
    anims = [];
    stopList(a);          // hantu/scrim/lembar sudah di keadaan akhir = keadaan asli
    removeGhost();        // latar .mbox kembali, identik dengan hantu
    st = 'open';
  }

  /* ── TUTUP ────────────────────────────────────────────────────────── */
  function closeFx(done) {
    var kind = closeKind;
    closeKind = null;
    closeDone = done;
    var was = st;
    st = 'closing';
    mo.classList.add('hx-mo-closing');
    histAfterClose();
    if (drag) springBackNow();
    if (was === 'opening' && !kind && reverseOpen()) return;
    stopAnims();
    removeGhost();
    if (reduced()) return fadeOut();
    if (kind && kind.kind === 'drag') return slideOut(kind);
    var t = findTarget(cur && cur.s);
    if (t) return morphOut(t);
    dropOut();
  }
  // ditutup saat masih membuka: putar balik semua animasi buka
  function reverseOpen() {
    var all = anims.concat(cAnims), main = null, mt = -1;
    if (!all.length) return false;
    for (var i = 0; i < all.length; i++) {
      var a = all[i], t = a.currentTime || 0;
      a.onfinish = null;
      if (t > mt) { mt = t; main = a; }
      try { a.reverse(); } catch (e) { return false; }
    }
    main.onfinish = finishClose;
    return true;
  }
  function finishClose() {
    var d = closeDone;
    closeDone = null;
    if (d) { try { d(); } catch (e) { warn(e); } }
    cleanup();
    if (shown()) { st = 'open'; return; }
    st = 'closed';
    cur = null;
  }
  // kembali ke kartunya
  function morphOut(t) {
    var fin = box.getBoundingClientRect(), from = radii4(box);
    var g = makeGhost(fin);
    contentOut(120);
    var dst = t.rect, dur = cur && cur.sheet ? 420 : 400;
    var f = bez(0.36, 0, 0.12, 1), n = tier() === 'low' ? 14 : 22;
    var sx = dst.width / fin.width, sy = dst.height / fin.height;
    var dx = dst.left - fin.left, dy = dst.top - fin.top;
    var kf = [], kr = [];
    for (var i = 0; i <= n; i++) {
      var tt = i / n, p = f(tt);
      var a = 1 + (sx - 1) * p, b = 1 + (sy - 1) * p;
      kf.push({
        offset: tt,
        transform: 'translate(' + px(dx * p) + ',' + px(dy * p) + ') scale(' + n4(a) + ',' + n4(b) + ')',
        opacity: tt <= 0.5 ? 1 : n4(1 - easeIn(clamp((tt - 0.5) / 0.45, 0, 1)))
      });
      kr.push({ offset: tt, borderRadius: radiusAt(from, t.rad, p, a, b) });
    }
    track(g.animate(kf, { duration: dur, easing: 'linear', fill: 'forwards' })).onfinish = finishClose;
    track(g.animate(kr, { duration: dur, easing: 'linear', fill: 'forwards' }));
    track(scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.round(dur * 0.85), easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' }));
  }
  // kartunya tidak terlihat lagi: turun + pudar (HP) / mengecil + pudar
  function dropOut() {
    var sheet = cur ? cur.sheet : isSheet();
    var h = box.offsetHeight, dur = sheet ? 260 : 200;
    var to = sheet ? 'translate3d(0,' + px(Math.min(h * 0.4, 240)) + ',0)' : 'translate3d(0,10px,0) scale(.96)';
    track(box.animate([{ transform: 'translate3d(0,0,0)', opacity: 1 }, { transform: to, opacity: 0 }],
      { duration: dur, easing: 'cubic-bezier(.4,0,.9,.6)', fill: 'forwards' })).onfinish = finishClose;
    track(scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'linear', fill: 'forwards' }));
  }
  function fadeOut() {
    var so = scrim.style.opacity === '' ? 1 : +scrim.style.opacity;
    track(box.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'linear', fill: 'forwards' })).onfinish = finishClose;
    track(scrim.animate([{ opacity: so }, { opacity: 0 }], { duration: 160, easing: 'linear', fill: 'forwards' }));
  }
  // lepas tarikan = lanjut meluncur keluar dengan kecepatan jari
  function slideOut(k) {
    var h = box.offsetHeight, y = k.y, end = h + 40;
    var v = Math.max(k.v || 0, 0.9);                      // px/ms
    // kemiringan awal cubic-bezier(.25,.6,.4,1) = 2,4 × rata-rata
    var dur = clamp(2.4 * (end - y) / v, 170, 340);
    var so = scrim.style.opacity === '' ? 1 : +scrim.style.opacity;
    box.style.transform = '';
    track(box.animate([{ transform: 'translate3d(0,' + px(y) + ',0)' }, { transform: 'translate3d(0,' + px(end) + ',0)' }],
      { duration: dur, easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'forwards' })).onfinish = finishClose;
    scrim.style.opacity = '';
    track(scrim.animate([{ opacity: so }, { opacity: 0 }], { duration: dur, easing: 'linear', fill: 'forwards' }));
  }
  // tutup seketika (mis. kartu lain diketuk saat animasi tutup berjalan)
  function finishNow() { if (st === 'closing') finishClose(); }

  /* ── tarik untuk menutup (HP) ─────────────────────────────────────── */
  var TH = 0.25;            // lepas lewat 25% tinggi lembar = tutup
  function rub(o, h) { return o <= 0 ? 0 : o / (1 + o / (h * 2.4)); }      // resistensi karet
  function unrub(y, h) { var k = h * 2.4; return y <= 0 ? 0 : y >= k * 0.98 ? y : y / (1 - y / k); }
  function curY() {
    var t = getComputedStyle(box).transform;
    if (!t || t === 'none') return 0;
    var m = t.match(/matrix(3d)?\(([^)]+)\)/);
    if (!m) return 0;
    var v = m[2].split(',');
    return parseFloat(v[m[1] ? 13 : 5]) || 0;
  }
  function endDragFlags() {
    if (mo) { mo.classList.remove('hx-mo-drag'); mo.classList.remove('hx-mo-armed'); }
    if (drag && drag.mode === 'drag') R.classList.remove('hx-gesture');
  }
  function onDown(e) {
    if (drag || e.pointerType === 'mouse' || e.isPrimary === false) return;
    if (st !== 'open' || !shown()) return;
    if (hasCls(R, 'hx-gesture') || hasCls(R, 'hx-overlay-open')) return;
    if (!isSheet()) return;
    // tangkap lagi saat lembar masih memantul balik
    var y0 = 0;
    if (anims.length) { y0 = curY(); stopAnims(); }
    drag = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, mode: 'pending',
      top: box.scrollTop <= 0, yStart: y0, y: y0, h: box.offsetHeight, s: [], t0: evTime(e)
    };
    if (y0 > 0) { box.style.transform = 'translate3d(0,' + px(y0) + ',0)'; scrim.style.opacity = scrimFor(y0, drag.h); }
  }
  function scrimFor(y, h) { return String(n4(1 - 0.7 * clamp(y / h, 0, 1))); }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.mode === 'pending') {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      var vert = Math.abs(dy) > Math.abs(dx) * 1.15;
      var ok = vert && box.scrollTop <= 0 && drag.top && (dy > 0 || drag.yStart > 0) && !hasCls(R, 'hx-gesture');
      if (!ok) { if (drag.yStart > 0) springBack(drag.yStart); drag = null; return; }
      drag.mode = 'drag';
      R.classList.add('hx-gesture');
      mo.classList.add('hx-mo-drag');
      box.style.transition = 'none';
      box.style.willChange = 'transform';
      try { box.setPointerCapture(e.pointerId); } catch (x) { }
      drag.s.push([drag.t0, drag.yStart]);   // sentil secepat kilat = 1 gerakan saja
    }
    var o = unrub(drag.yStart, drag.h) + dy;
    var y = rub(o, drag.h);
    drag.y = y;
    var t = evTime(e);
    drag.s.push([t, y]);
    while (drag.s.length > 2 && t - drag.s[0][0] > 100) drag.s.shift();
    box.style.transform = 'translate3d(0,' + px(y) + ',0)';
    scrim.style.opacity = scrimFor(y, drag.h);
    var armed = y > drag.h * TH;
    if (armed !== hasCls(mo, 'hx-mo-armed')) mo.classList[armed ? 'add' : 'remove']('hx-mo-armed');
  }
  function velocity(tu) {
    var s = drag.s;
    if (s.length < 2) return 0;
    var a = s[0], b = s[s.length - 1], dt = b[0] - a[0];
    if (tu - b[0] > 90) return 0;             // berhenti dulu sebelum lepas
    return dt > 0 ? (b[1] - a[1]) / dt : 0;
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    if (d.mode !== 'drag') { if (d.yStart > 0) springBack(d.yStart); drag = null; return; }
    var v = velocity(evTime(e)), y = d.y;
    lastRel = { y: Math.round(y), v: Math.round(v * 1000) / 1000, h: d.h };
    endDragFlags();
    drag = null;
    suppressUntil = now() + 350;
    if ((y > d.h * TH && v > -0.3) || (v > 0.45 && y > 16)) {
      closeKind = { kind: 'drag', y: y, v: v };
      try { box.releasePointerCapture(e.pointerId); } catch (x) { }
      W.closeSPMo();                          // jalur tutup milik app
      if (closeKind) closeKind = null;
      if (shown() && st !== 'closing') springBack(y);   // ada yang menolak menutup
    } else springBack(y);
  }
  function onCancel(e) {
    if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
    springBackNow();
  }
  function springBackNow() {
    if (!drag) return;
    var y = drag.mode === 'drag' ? drag.y : drag.yStart;
    endDragFlags();
    drag = null;
    if (y > 0) springBack(y); else { box.style.transform = ''; box.style.transition = ''; box.style.willChange = ''; scrim.style.opacity = ''; }
  }
  function springBack(y) {
    var so = scrim.style.opacity === '' ? 1 : +scrim.style.opacity;
    box.style.transform = ''; box.style.transition = ''; box.style.willChange = '';
    scrim.style.opacity = '';
    if (reduced() || y <= 0) return;
    var a = track(box.animate([{ transform: 'translate3d(0,' + px(y) + ',0)' }, { transform: 'translate3d(0,0,0)' }],
      { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1)' }));
    var b = track(scrim.animate([{ opacity: so }, { opacity: 1 }], { duration: 300, easing: 'ease-out' }));
    a.onfinish = function () { var i = anims.indexOf(a); if (i >= 0) anims.splice(i, 1); i = anims.indexOf(b); if (i >= 0) anims.splice(i, 1); };
  }
  function bindDrag() {
    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onCancel);
    // hanya tangkapan milik lembar sendiri (tombol di dalamnya kehilangan
    // tangkapan implisit saat tarikan dimulai — itu bukan pembatalan)
    box.addEventListener('lostpointercapture', function (e) { if (e.target === box) onCancel(e); });
    // Pointer Events saja tidak bisa menahan scroll bawaan di tengah gerakan:
    // touchmove non-pasif mencegah overscroll / tarik-segarkan HANYA saat
    // lembar sedang ditarik (atau di puncak scroll & jari bergerak turun).
    var tx = 0, ty = 0;
    box.addEventListener('touchstart', function (e) {
      var t = e.touches && e.touches[0];
      if (t) { tx = t.clientX; ty = t.clientY; }
      if (e.touches && e.touches.length > 1 && drag) springBackNow();   // cubit: serahkan ke browser
    }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!drag || !e.touches || e.touches.length !== 1 || !e.cancelable) return;
      if (drag.mode === 'drag') { e.preventDefault(); return; }
      if (drag.mode === 'pending' && drag.top && box.scrollTop <= 0) {
        var t = e.touches[0], dy = t.clientY - ty, dx = t.clientX - tx;
        if ((dy > 0 || drag.yStart > 0) && Math.abs(dy) >= Math.abs(dx)) e.preventDefault();
      }
    }, { passive: false });
    box.addEventListener('contextmenu', function (e) { if (drag && drag.mode === 'drag') e.preventDefault(); });
    W.addEventListener('blur', function () { onCancel(); });
    D.addEventListener('visibilitychange', function () { if (D.hidden) onCancel(); });
    // ketukan "hantu" setelah tarikan tidak boleh menekan tombol / overlay
    W.addEventListener('click', function (e) {
      if (suppressUntil && now() < suppressUntil) { suppressUntil = 0; e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  /* ── riwayat: tombol Kembali Android menutup lembar ───────────────── */
  var HK = '__hxSheet', hPend = 0, hTimer = 0;
  function mine(s) { return !!(s && typeof s === 'object' && s[HK]); }
  // Kembali ke entri halaman memulihkan posisi scroll saat lembar DIBUKA
  // (scrollRestoration 'auto'), jadi halaman yang di-scroll di belakang
  // lembar melompat saat lembar ditutup. Selama entri kita ada, entri
  // halaman memakai 'manual'; dikembalikan ke 'auto' begitu lembar tutup.
  var srHeld = false;
  function srHold() {
    try { if (history.scrollRestoration === 'auto') { history.scrollRestoration = 'manual'; srHeld = true; } } catch (e) { }
  }
  function srRelease() {
    if (!srHeld) return;
    srHeld = false;
    try { history.scrollRestoration = 'auto'; } catch (e) { }
  }
  function histPush() {
    if (!W.history || typeof history.pushState !== 'function' || mine(history.state)) return;
    srHold();
    try { var o = {}; o[HK] = 1; history.pushState(o, ''); } catch (e) { }
  }
  // lembar ditutup lewat X / overlay / tarik / Escape: buang entri kita
  function histAfterClose() {
    if (hTimer) return;
    hTimer = setTimeout(function () {
      hTimer = 0;
      if (hPend > 0 || !mine(history.state)) return;   // entri lain di atas: dibersihkan saat popstate
      if (shown() && st !== 'closing') return;          // sudah dibuka lagi
      hPend++;
      try { history.back(); } catch (e) { hPend = 0; }
    }, 0);
  }
  function onPop() {
    popStep();
    // kembali di entri halaman & lembar tertutup / sedang menutup. Ditunda:
    // Safari memulihkan scroll SESUDAH popstate dan membaca mode saat itu.
    if (srHeld && !mine(history.state) && (st === 'closing' || !shown())) {
      setTimeout(function () { if (!mine(history.state) && (st === 'closing' || !shown())) srRelease(); }, 120);
    }
  }
  function popStep() {
    var m = mine(history.state);
    if (hPend > 0) {
      hPend--;
      if (!m && shown() && st !== 'closing') histPush();       // dibuka lagi saat 'back' kita di jalan
      else if (m && !shown()) histAfterClose();                 // entri basi bertumpuk
      return;
    }
    if (m) {                                                    // layar penuh di atas lembar ditutup
      if (!shown() && st === 'closed') histAfterClose();        // lembar sudah tertutup: entri basi
      return;
    }
    if (!shown() || st === 'closing') return;
    if (hasCls(R, 'hx-overlay-open')) { histPush(); return; }  // layar penuh lain yang menangani
    W.closeSPMo();
  }
  function otherModal() {
    var l = D.querySelectorAll('.mo,.cal-overlay');
    for (var i = 0; i < l.length; i++) if (l[i] !== mo && l[i].style.display && l[i].style.display !== 'none') return true;
    return false;
  }
  function onKey(e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!shown() || st === 'closing' || hasCls(R, 'hx-overlay-open') || otherModal()) return;
    W.closeSPMo();
  }

  /* ── pasang & bungkus fungsi app.js ───────────────────────────────── */
  function init() {
    if (mo) return true;
    var m = D.getElementById('spMo'), b = m && m.querySelector('.mbox');
    if (!m || !b) return false;
    mo = m; box = b;
    scrim = D.createElement('div');
    scrim.className = 'hx-mo-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    mo.insertBefore(scrim, mo.firstChild);
    R.classList.add('hx-morph');
    bindDrag();
    D.addEventListener('click', note, true);
    D.addEventListener('pointerup', note, true);
    W.addEventListener('popstate', onPop);
    // dimuat ulang saat lembar terbuka: entri kita tersisa tanpa lembar
    if (mine(W.history && history.state) && !shown()) {
      try { history.replaceState(null, ''); if (history.scrollRestoration === 'manual') history.scrollRestoration = 'auto'; } catch (e) { }
      srHeld = true;   // entri halaman di bawahnya mungkin masih 'manual'
    }
    W.addEventListener('keydown', onKey, true);
    if (W.MutationObserver) {
      // modal ditampilkan / disembunyikan lewat jalur lain (tanpa pembungkus)
      new MutationObserver(function () {
        if (!shown()) {
          if (st !== 'closed' && st !== 'closing') { cleanup(); st = 'closed'; cur = null; }
          else if (st === 'closing' && !closeDone) { cleanup(); st = 'closed'; cur = null; }
          histAfterClose();
        } else if (st === 'closed') {
          st = 'open';
          cur = { s: null, sheet: isSheet() };
          histPush();
        }
      }).observe(mo, { attributes: true, attributeFilter: ['style'] });
    }
    if (shown()) { st = 'open'; cur = { s: null, sheet: isSheet() }; }
    return true;
  }
  var did = {};
  function wrapOpen(name) {
    var orig = W[name];
    if (did[name] || typeof orig !== 'function') return;
    did[name] = true;
    W[name] = keepMarkers(orig, function () {
      // gambar ulang data live / dibuka lagi saat terbuka: tanpa animasi
      if (repainting || (shown() && st !== 'closing')) return orig.apply(this, arguments);
      finishNow();
      var s = null;
      try { s = takeSource(arguments[0], arguments[1]); } catch (e) { s = null; }
      var r = orig.apply(this, arguments);
      try { if (shown()) openFx(s); } catch (e) { warn(e); cleanup(); st = shown() ? 'open' : 'closed'; }
      return r;
    });
  }
  function wrapRepaint() {
    var orig = W._spMoRepaint;
    if (did.rep || typeof orig !== 'function') return;
    did.rep = true;
    W._spMoRepaint = keepMarkers(orig, function () {
      if (st === 'closing') return;           // lembar sedang menutup: jangan gambar ulang
      repainting = true;
      try { return orig.apply(this, arguments); } finally { repainting = false; }
    });
  }
  function wrapClose() {
    var orig = W.closeSPMo;
    if (did.close || typeof orig !== 'function') return;
    did.close = true;
    W.closeSPMo = keepMarkers(orig, function (e) {
      if (e && e.target !== mo) return orig.apply(this, arguments);   // klik di dalam kotak
      if (!shown()) { closeKind = null; return orig.apply(this, arguments); }
      if (st === 'closing') return;
      var self = this, args = arguments;
      try { closeFx(function () { orig.apply(self, args); }); }
      catch (x) { warn(x); cleanup(); closeDone = null; st = 'closed'; return orig.apply(self, args); }
    });
  }
  function hook() {
    if (!init()) return;
    wrapOpen('openSPModal'); wrapOpen('openSPMonth'); wrapOpen('openSPMonthly');
    wrapRepaint(); wrapClose();
  }
  (W.HX = W.HX || {})._morph = { state: function () { return st; }, release: function () { return lastRel; } };   // untuk tes
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', hook); else hook();
  W.addEventListener('load', hook);
  setTimeout(hook, 1000);
})();
