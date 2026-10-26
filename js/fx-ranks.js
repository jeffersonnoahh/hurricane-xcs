/* ══════════════════════════════════════════════════════════════════════
   FX RANKS — PERINGKAT YANG BERGERAK.  HANYA MEMBACA (tidak pernah menulis
   ke Firebase, tidak mengubah allData). Fungsi app.js hanya dibungkus.

   Yang dilakukan:
   1. FLIP — saat render mengubah urutan daftar peringkat, baris MELUNCUR
      dari posisi lama ke posisi baru (bukan melompat). Posisi "sebelum"
      diambil TEPAT sebelum app.js membangun ulang innerHTML (renderAll &
      renderMonthly dibungkus di sini), posisi "sesudah" di event HX
      'render' (sinkron, sebelum layar digambar) -> tidak ada kedipan.
   2. Baris yang NAIK (dan omzetnya memang bertambah) mendapat cahaya tepi
      hijau + jejak cahaya dari posisi lamanya + label "naik 2" (±3 detik).
      Yang naik ke #1 memakai kuning logo. Yang turun hanya meluncur.
   3. Angka omzet yang berubah BERGULIR ke nilai baru; nomor peringkat
      baris yang naik ikut menghitung mundur (5 -> 2) selama meluncur.
      Teks asli tidak pernah ditulis setengah jalan (lihat .fxr-roll).
   4. CHIP GERAK PERINGKAT di Monthly Recap (bulan berjalan saja): peringkat
      omzet bulan ini SEKARANG vs saat tutup KEMARIN, hanya 10 sales teratas,
      channel & team lead tidak ikut dihitung.
   5. Monthly Recap ikut hidup: penjualan baru masuk saat halaman itu
      terbuka -> tabel dirender ulang (fungsi asli app.js, read-only) dan
      barisnya meluncur.

   Kunci baris: data-k ("sp|team" / "team:<nama>") kalau ada, kalau belum
   ada: argumen onclick openSPModal('sp','team') / teks nama.

   Event tambahan di HX: 'rank' {board, key, sp, team, from, to, n, top}
   untuk setiap baris yang naik di layar (boleh dipakai modul lain).

   Tes (tanpa menyentuh data): HX.ranks._test — lihat bagian bawah file.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HX = window.HX;
  if (!HX || HX.__ranks) return;
  HX.__ranks = true;

  var EASE = 'cubic-bezier(.2,.86,.24,1)';       // meluncur: cepat lalu mengendap
  var LIFE = 3300;                               // umur label & cahaya (ms)
  var TAG_DELAY = 160;                           // label muncul saat baris "mendarat"
  var MINUS = '\u2212';

  /* ── konteks: urutan hanya dibandingkan dalam konteks yang sama ───── */
  function dayCtx() { try { return 'd:' + gvk(); } catch (e) { return 'd:' + HX.todayKey(); } }
  function monthOfDay() {
    try { var d = od(vOff); return 'm:' + d.getFullYear() + '-' + d.getMonth(); } catch (e) { return 'm:?'; }
  }
  function recapCtx() { try { return 'r:' + mYear + '-' + mMonth; } catch (e) { return 'r:?'; } }
  function recapIsNow() {
    try { var n = new Date(); return mYear === n.getFullYear() && mMonth === n.getMonth(); } catch (e) { return false; }
  }

  /* ── papan peringkat yang diikuti ─────────────────────────────────── */
  // row:'tr' = baris tabel langsung di tbody (tanpa .erow)
  // via: papan lengkap yang urutannya sama (Top Performers = 6 teratas tSP)
  var ALL = [
    { id: 'tsp', host: 'tSP', row: 'tr', name: '.tn', line2: '.tm', val: '.rc', rank: '.rnk', fmt: 'rp', ctx: dayCtx, trail: true },
    { id: 'lb', host: 'lb', row: '.lbi', name: '.lbn', line2: '.lbt', val: '.lbs', rank: '.lbr', fmt: 'rp', ctx: dayCtx, trail: true, cap: true, via: 'tsp' },
    { id: 'tteam', host: 'tTeam', row: 'tr', name: '.tn', val: '.rc', rank: '.rnk', fmt: 'rp', ctx: dayCtx, trail: true, team: true },
    { id: 'wl', host: 'wlBody', row: '.wl-row', name: '.wl-name', sub: '.wl-team', line2: '.wl-team', val: '.wl-total', fmt: 'jt', ctx: dayCtx, trail: true },
    { id: 'spc', host: 'spGrid', row: '.spc', name: '.spc-name', line2: '.spc-team', val: '.spc-rev', fmt: 'rp', ctx: monthOfDay }
  ];
  var MONTH = [
    { id: 'msp', host: 'mSPBody', row: 'tr', name: '.tn', line2: '.tm', val: '.rc', rank: '.rnk', fmt: 'rp', ctx: recapCtx, trail: true, chips: true },
    { id: 'mteam', host: 'mTeamBody', row: 'tr', name: '.tn', val: '.rc', rank: '.rnk', fmt: 'rp', ctx: recapCtx, trail: true, team: true }
  ];
  var BY = {};
  ALL.concat(MONTH).forEach(function (b) { BY[b.id] = b; });

  /* ── format angka (sama persis dengan app.js / watchlist.js) ──────── */
  var FMT = {
    rp: {
      parse: function (s) { var m = /^Rp\s?([\d.]+)$/.exec(s); return m ? +m[1].replace(/\./g, '') : null; },
      fmt: function (n) { n = Math.round(n); try { if (typeof fFull === 'function') return fFull(n); } catch (e) { } return 'Rp ' + n.toLocaleString('id-ID'); }
    },
    // format singkat watchlist: "189,73jt" · "850rb" · "2,95M" (M = miliar) — sama dengan fRp app.js
    jt: {
      parse: function (s) {
        var m = /^(-?\d+(?:,\d+)?)(M|jt|rb)?$/.exec(s);
        if (!m) return null;
        return +m[1].replace(',', '.') * (m[2] === 'M' ? 1e9 : m[2] === 'jt' ? 1e6 : m[2] === 'rb' ? 1e3 : 1);
      },
      fmt: function (n) {
        n = Math.round(+n || 0);
        if (!n) return '0';
        try { if (typeof window.fRp === 'function') return window.fRp(n); } catch (e) { }
        var a = Math.abs(n), sg = n < 0 ? '-' : '';
        var dec = function (c) { var w = Math.floor(c / 100), f = c % 100; return f ? w + ',' + (f < 10 ? '0' : '') + f : String(w); };
        if (a >= 999995000) return sg + dec(Math.round(a / 1e7)) + 'M';
        if (a >= 999500) return sg + dec(Math.round(a / 1e4)) + 'jt';
        if (a >= 1000) return sg + Math.round(a / 1e3) + 'rb';
        return String(n);
      }
    },
    int: {
      parse: function (s) { return /^\d+$/.test(s) ? +s : null; },
      fmt: function (n) { return String(Math.round(n)); }
    }
  };

  /* ── membaca baris ────────────────────────────────────────────────── */
  function byId(id) { return document.getElementById(id); }
  function rowsOf(b, host) {
    var out = [], i, c;
    if (b.row === 'tr') {
      for (i = 0; i < host.children.length; i++) {
        c = host.children[i];
        if (c.tagName === 'TR' && !c.classList.contains('erow')) out.push(c);
      }
      return out;
    }
    var q = host.querySelectorAll(b.row);
    for (i = 0; i < q.length; i++) if (!q[i].classList.contains('fxr-ghost')) out.push(q[i]);
    return out;
  }
  // teks milik elemen itu sendiri (tanpa badge "ON LEAVE" dari sp-notes.js)
  function ownText(el) {
    if (!el) return '';
    var s = '';
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3) s += n.nodeValue;
    return s.trim();
  }
  var ONCLICK = /\(\s*'((?:\\.|[^'\\])*)'\s*,\s*'((?:\\.|[^'\\])*)'\s*\)/;
  function unesc(s) { return s.replace(/\\(.)/g, '$1'); }
  function keyOf(el, b) {
    var k = el.getAttribute('data-k');
    if (k) return k;
    if (b.team) return 'team:' + ownText(el.querySelector(b.name));
    var oc = el.getAttribute('onclick');
    var m = oc && ONCLICK.exec(oc);
    if (m) return unesc(m[1]) + '|' + unesc(m[2]);
    return ownText(el.querySelector(b.name)) + '|' + (b.sub ? ownText(el.querySelector(b.sub)) : '');
  }
  function valOf(el, b) {
    var v = b.val && el.querySelector(b.val);
    return v ? FMT[b.fmt].parse(v.textContent.trim()) : null;
  }
  function pageOf(host) { return host.closest ? host.closest('.page') : null; }
  function live(host) {
    if (document.hidden) return false;
    var pg = pageOf(host);
    if (pg && !pg.classList.contains('active')) return false;
    return host.getClientRects().length > 0;
  }
  function entering(host) { var pg = pageOf(host); return !!(pg && pg.classList.contains('lg-enter')); }
  // "terangkat" saat naik (kartu Top Performers): skala digabung ke transform
  // luncuran yang sama, BUKAN properti CSS `scale` (tidak ada di iOS < 14.5 /
  // Chrome < 104). Keyframe linear dalam progres ter-ease, jadi translate tetap
  // d*(1-p) persis seperti luncuran biasa; skala memuncak di p = LIFT_P.
  var LIFT_S = 1.022, LIFT_P = 0.88;
  function liftS(p) { return p <= LIFT_P ? 1 + (LIFT_S - 1) * p / LIFT_P : 1 + (LIFT_S - 1) * (1 - p) / (1 - LIFT_P); }
  function tf(x, y, s) { return 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px)' + (s ? ' scale(' + s.toFixed(4) + ')' : ''); }
  var CAN_ANIM = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

  /* ── keadaan ──────────────────────────────────────────────────────── */
  var mem = {};     // id -> {ctx, keys, idx{key:i}, val{key:n}, chip{key:txt}}
  var snap = {};    // id -> posisi sebelum render (hanya papan yang terlihat)
  var deco = {};    // id -> {key: {t0, text, gold}}  label + cahaya yang masih hidup
  var flying = {};  // id -> {key: {end, lift}}       baris yang sedang meluncur
  var cycle = 0, mCycle = -1;
  var stats = { pre: 0, post: 0, n: 0 };         // ms terakhir (untuk tes performa)
  // Data pertama + config tim masuk dalam beberapa snapshot berturut-turut
  // (roster cadangan -> roster asli, scores -> activities). Itu BUKAN orang
  // yang naik peringkat: perubahan baru dianggap "terjadi" setelah data siap
  // dan tenang sebentar.
  var readyAt = 0, SETTLE = 1500;
  // showPage() sendiri memanggil renderAll/renderMonthly: halaman yang BARU
  // dibuka tidak diberi luncuran/label (perubahan itu terjadi saat tidak
  // dilihat, dan motion.js sedang memutar animasi masuknya)
  var switching = 0;
  function dataReady() {
    try { return Object.keys(allData).length > 0 && !!window._cfgTeamsLoaded; } catch (e) { return false; }
  }

  /* 1) SEBELUM app.js membangun ulang: catat posisi baris yang terlihat */
  function pre(list) {
    var t0 = performance.now();
    var reads = [];
    list.forEach(function (b) {
      snap[b.id] = null;
      var host = byId(b.host);
      if (!host || !live(host)) return;
      var rs = rowsOf(b, host);
      if (!rs.length) return;
      reads.push([b, host, rs]);
    });
    // baca semua dulu (satu kali layout), tidak ada tulisan di sini
    reads.forEach(function (x) {
      var b = x[0], host = x[1], rs = x[2];
      var h = host.getBoundingClientRect();
      var s = { top: h.top, left: h.left, rects: {}, nodes: {}, keys: [], bottom: 0 };
      rs.forEach(function (el) {
        var k = keyOf(el, b), r = el.getBoundingClientRect();
        s.rects[k] = { t: r.top - h.top, l: r.left - h.left, w: r.width, h: r.height };
        s.nodes[k] = el;
        s.keys.push(k);
        s.bottom = Math.max(s.bottom, r.bottom - h.top);
      });
      snap[b.id] = s;
    });
    stats.pre = performance.now() - t0;
  }

  /* 2) SESUDAH render (sinkron, sebelum digambar).
        Tiga fase supaya tidak ada layout bolak-balik:
        A hitung (tanpa menyentuh DOM) -> B baca posisi/warna -> C tulis. */
  function post(list) {
    var now = performance.now();
    var reduced = HX.reduced();
    var rd = dataReady();
    if (rd && !readyAt) readyAt = now;
    var settled = rd && now - readyAt > SETTLE && !document.documentElement.classList.contains('lg-loading');
    var prevMem = {};
    list.forEach(function (b) { prevMem[b.id] = mem[b.id]; });
    var boards = [], jobs = [], rollReq = [], emitted = {};

    /* A — hitung */
    list.forEach(function (b) {
      var host = byId(b.host);
      var s = snap[b.id]; snap[b.id] = null;
      if (!host) return;
      var ctx = b.ctx();
      var rs = rowsOf(b, host);
      var keys = [], idx = {}, val = {}, el = {};
      rs.forEach(function (r, i) {
        var k = keyOf(r, b);
        if (idx[k] !== undefined) return;            // kunci ganda: abaikan yang kedua
        keys.push(k); idx[k] = i; val[k] = valOf(r, b); el[k] = r;
      });
      var prev = prevMem[b.id];
      var same = !!(prev && prev.ctx === ctx);
      mem[b.id] = { ctx: ctx, keys: keys, idx: idx, val: val, chip: (same && prev.chip) || {}, ok: rd };
      if (!same) { deco[b.id] = {}; flying[b.id] = {}; dropRolls(b.id); }
      var D = deco[b.id] || (deco[b.id] = {});
      var watched = same && !!s && !!prev.ok && settled && !switching;   // perubahan ini TERJADI di depan mata
      var climbs = {};
      if (watched) {
        var via = b.via && prevMem[b.via] && prevMem[b.via].ctx === ctx ? prevMem[b.via] : null;
        keys.forEach(function (k, i) {
          var o = prev.idx[k], ov = prev.val[k], nv = val[k];
          if (o === undefined && via) { o = via.idx[k]; ov = via.val[k]; }
          var grew = (nv != null && ov != null) ? nv > ov : (ov == null && nv != null && nv > 0);
          if (!grew) return;
          if (o !== undefined && o > i) {
            var top = i === 0 && prev.keys[0] !== k;
            climbs[k] = { from: o, to: i };
            D[k] = { t0: now, gold: top, text: top ? 'naik ke #1' : 'naik ' + (o - i),
              short: top ? '#1' : 'naik ' + (o - i), tiny: top ? '#1' : String(o - i) };
            if (!emitted[k] && b.id !== 'spc') {
              emitted[k] = 1;
              var p = k.split('|');
              HX.emit('rank', { board: b.id, key: k, sp: b.team ? null : p[0], team: b.team ? k.slice(5) : p[1], from: o + 1, to: i + 1, n: o - i, top: top });
            }
          } else if (o === undefined && b.cap && prev.keys.length) {
            D[k] = { t0: now, gold: i === 0, text: i === 0 ? 'naik ke #1' : 'masuk 6 besar', short: i === 0 ? '#1' : 'masuk', tiny: i === 0 ? '#1' : 'masuk' };
          }
        });
        if (!reduced) keys.forEach(function (k) {
          var ov = prev.val[k], nv = val[k];
          if (ov != null && nv != null && ov !== nv) rollReq.push([b, k, el[k], ov, nv]);
        });
      }
      var orderChanged = watched && (keys.length !== s.keys.length || keys.some(function (k, i) { return s.keys[i] !== k; }));
      // Render ulang DI TENGAH luncuran (mis. transaksi Firebase memicu 2x
      // 'value' berturut-turut): baris baru melanjutkan dari posisi yang
      // sedang terlihat, bukan melompat ke posisi akhir.
      var fl = flying[b.id] || (flying[b.id] = {});
      var inflight = watched && keys.some(function (k) { return fl[k] && fl[k].end > now; });
      if (watched && (orderChanged || inflight) && !reduced && !entering(host) && CAN_ANIM) {
        jobs.push({ b: b, host: host, s: s, keys: keys, el: el, climbs: climbs, fl: fl, now: now });
      }
      boards.push({ b: b, rs: rs, keys: keys, el: el, val: val, watched: watched });
    });

    /* B — baca */
    boards.forEach(function (x) {
      var D = deco[x.b.id];
      x.pos = {};
      if (!D) return;
      Object.keys(D).forEach(function (k) {
        if (now - D[k].t0 < LIFE && x.el[k]) x.pos[k] = tagPos(x.el[k], x.b, D[k]);
      });
    });
    jobs.forEach(function (j) {
      var h = j.host.getBoundingClientRect();
      j.n = {};
      j.keys.forEach(function (k) {
        var r = j.el[k].getBoundingClientRect();
        j.n[k] = { t: r.top - h.top, l: r.left - h.left, h: r.height };
      });
      j.rankC = {};
      Object.keys(j.climbs).forEach(function (k) {
        var re = j.b.rank && j.el[k].querySelector(j.b.rank);
        if (re) j.rankC[k] = getComputedStyle(re).color;
      });
    });

    /* C — tulis */
    boards.forEach(function (x) {
      rebindRolls(x.b, x.el, x.val);
      decorate(x.b, x.el, x.pos, now);
      if (x.b.chips) chips(x.b, x.rs, x.keys, !x.watched);
    });
    rollReq.forEach(function (r) { rollTo(r[0], r[1], r[2], r[3], r[4], 720); });
    flushRollColors();
    jobs.forEach(flip);
    scheduleCleanup();
    stats.post = performance.now() - now;
    stats.n++;
  }

  /* ── FLIP ─────────────────────────────────────────────────────────── */
  function flip(j) {
    var b = j.b, s = j.s;
    j.keys.forEach(function (k) {
      var row = j.el[k], o = s.rects[k], n = j.n[k];
      var c = j.climbs[k];
      var dx, dy, dur;
      if (!o) {
        // baru masuk daftar: naik dari bawah daftar (Top Performers) atau muncul pelan
        if (!b.cap && !c) {
          row.animate([{ transform: 'translate(0,10px)', opacity: 0 }, { transform: 'none', opacity: 1 }],
            { duration: 520, easing: EASE });
          return;
        }
        dx = 0; dy = Math.max(12, s.bottom - n.t);
        dur = Math.round(Math.min(940, 430 + Math.sqrt(dy) * 16));
        var upE = !!(c && b.cap);                   // masuk 6 besar sambil terangkat
        row.animate((upE ? [0, 0.4, LIFT_P, 1] : [0, 0.4, 1]).map(function (p) {
          var y = p <= 0.4 ? dy - 0.55 * dy * p / 0.4 : 0.45 * dy * (1 - (p - 0.4) / 0.6);
          return { offset: p, transform: tf(0, y, upE ? liftS(p) : 0), opacity: p < 0.4 ? p / 0.4 : 1 };
        }), { duration: dur, easing: EASE });
      } else {
        dx = o.l - n.l; dy = o.t - n.t;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var f = j.fl[k], cont = !!(f && f.end > j.now && !c);   // lanjutan luncuran yang terpotong
        dur = cont ? Math.max(240, Math.round(f.end - j.now))   // sisa waktunya saja
          : Math.round(Math.min(940, 430 + Math.sqrt(dist) * 16));
        if (c && b.cap && !cont) {                  // naik: meluncur + terangkat dalam satu transform
          row.animate([0, LIFT_P, 1].map(function (p) {
            return { offset: p, transform: tf(dx * (1 - p), dy * (1 - p), liftS(p)) };
          }), { duration: dur, easing: EASE });
        } else {
          row.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }],
            { duration: dur, easing: cont ? 'cubic-bezier(.3,.6,.25,1)' : EASE });
        }
        if (cont && f.lift) {
          row.classList.add('fxr-lift');
          setTimeout(function () { row.classList.remove('fxr-lift'); }, dur + 400);
        }
      }
      j.fl[k] = { end: j.now + dur, lift: !!c || !!(j.fl[k] && j.fl[k].lift && j.fl[k].end > j.now) };
      if (!c) return;
      // yang naik: sedikit terangkat, di atas baris yang dilewati, meninggalkan jejak cahaya
      row.classList.add('fxr-lift');              // (skala terangkat: hanya kartu Top Performers, lihat di atas)
      // jejak berakhir di posisi lama; yang masuk dari luar 6 besar: di dasar daftar
      var tl = o ? dy : dy - n.h;
      if (b.trail && tl > 8 && HX.tier !== 'low') trail(row, b, tl, dur, D_gold(b, k));
      var rk = b.rank && row.querySelector(b.rank);
      var rt = rk && rk.textContent.trim();
      if (rt && FMT.int.parse(rt) === c.to + 1) rollRank(rk, c.from + 1, c.to + 1, dur, j.rankC[k], rt.length);
      setTimeout(function () { row.classList.remove('fxr-lift'); }, dur + 720);
    });
    // yang terdorong keluar dari 6 besar: memudar turun, bukan hilang mendadak
    if (b.cap) s.keys.forEach(function (k) {
      if (j.el[k]) return;
      ghost(j.host, s.nodes[k], s.rects[k]);
    });
  }
  function D_gold(b, k) { var d = deco[b.id] && deco[b.id][k]; return !!(d && d.gold); }

  function trail(row, b, dy, dur, gold) {
    var holder = row.tagName === 'TR' ? row.cells[0] : row;
    if (!holder) return;
    var t = document.createElement('span');
    t.className = 'fxr-trail' + (gold ? ' fxr-trail-gold' : '');
    t.setAttribute('aria-hidden', 'true');
    t.style.height = Math.round(dy) + 'px';
    holder.appendChild(t);
    var total = dur + 700;
    var a = t.animate([
      { transform: 'scaleY(0)', opacity: 1, easing: EASE },
      { transform: 'scaleY(1)', opacity: 1, offset: dur / total, easing: 'ease-out' },
      { transform: 'scaleY(1)', opacity: 0 }
    ], { duration: total, fill: 'both' });
    var done = function () { if (t.parentNode) t.parentNode.removeChild(t); };
    a.onfinish = done;
    setTimeout(done, total + 400);
  }

  function ghost(host, node, r) {
    if (!node || !r || node.isConnected) return;
    node.classList.add('fxr-ghost');
    node.classList.remove('lg-in', 'fxr-lit', 'fxr-lift', 'fxr-gold');
    node.removeAttribute('onclick');
    node.setAttribute('aria-hidden', 'true');
    node.style.top = r.t + 'px';
    node.style.left = r.l + 'px';
    node.style.width = r.w + 'px';
    node.style.height = r.h + 'px';
    host.appendChild(node);
    var a = node.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'translate(0,' + Math.round(r.h * 0.22) + 'px) scale(.96)', opacity: 0, offset: 0.55 },
      { transform: 'translate(0,' + Math.round(r.h * 0.4) + 'px) scale(.95)', opacity: 0 }
    ], { duration: 420, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    var done = function () { if (node.parentNode) node.parentNode.removeChild(node); };
    a.onfinish = done;
    setTimeout(done, 900);
  }

  /* ── angka bergulir (teks asli tetap nilai FINAL) ─────────────────── */
  var rolls = {}, raf = 0, rollTimer = 0;
  var TEST_T = null;                             // hanya untuk tes: membekukan waktu guliran
  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }
  function rk(id, k) { return id + '\u0001' + k; }
  function rollTo(b, k, row, from, to, dur) {
    var cell = row && row.querySelector(b.val);
    if (!cell || document.hidden) return;
    var key = rk(b.id, k), r = rolls[key];
    if (r && r.to === to) return;
    if (r) from = r.cur;
    rolls[key] = { board: b.id, k: k, cell: cell, from: from, to: to, cur: from, t0: performance.now(), dur: dur, fmt: FMT[b.fmt].fmt, needColor: true };
    cell.setAttribute('data-fxr', FMT[b.fmt].fmt(from));
    kick();
  }
  // nomor peringkat menghitung mundur (09 -> 02) selama baris meluncur;
  // lebar angka mengikuti teks asli ("01" tetap dua digit)
  function rollRank(el, from, to, dur, color, width) {
    var key = 'rank\u0001' + Math.random();
    var pad = function (n) { n = String(Math.round(n)); while (n.length < width) n = '0' + n; return n; };
    if (color) el.style.setProperty('--fxr-c', color);
    el.setAttribute('data-fxr', pad(from));
    el.classList.add('fxr-roll');
    rolls[key] = { board: '', k: '', cell: el, from: from, to: to, cur: from, t0: performance.now(), dur: dur * 0.9, fmt: pad, needColor: false, rank: true };
    kick();
  }
  // render ulang di tengah guliran: pindahkan guliran ke sel yang baru
  function rebindRolls(b, el, val) {
    Object.keys(rolls).forEach(function (key) {
      var r = rolls[key];
      if (r.board !== b.id) return;
      var row = el[r.k];
      if (!row || val[r.k] !== r.to) { finishRoll(key); return; }
      var cell = row.querySelector(b.val);
      if (!cell) { finishRoll(key); return; }
      if (cell !== r.cell) {
        r.cell = cell;
        r.needColor = true;
        cell.setAttribute('data-fxr', r.fmt(r.cur));
      }
    });
  }
  // warna asli dibaca SEBELUM teks asli dibuat transparan
  function flushRollColors() {
    var pend = [];
    Object.keys(rolls).forEach(function (key) { var r = rolls[key]; if (r.needColor && r.cell) pend.push(r); });
    var cs = pend.map(function (r) { return getComputedStyle(r.cell).color; });
    pend.forEach(function (r, i) {
      r.cell.style.setProperty('--fxr-c', cs[i]);
      r.cell.classList.add('fxr-roll');
      r.needColor = false;
    });
  }
  function finishRoll(key) {
    var r = rolls[key];
    if (!r) return;
    delete rolls[key];
    if (r.cell) { r.cell.classList.remove('fxr-roll'); r.cell.removeAttribute('data-fxr'); }
  }
  function dropRolls(id) { Object.keys(rolls).forEach(function (key) { if (rolls[key].board === id) finishRoll(key); }); }
  function kick() {
    if (!raf) raf = requestAnimationFrame(tick);
    clearTimeout(rollTimer);
    // pengaman: rAF berhenti (tab di latar) -> jangan tinggalkan angka lama
    rollTimer = setTimeout(function () { if (TEST_T == null) Object.keys(rolls).forEach(finishRoll); }, 1600);
  }
  function tick(ts) {
    raf = 0;
    var now = performance.now(), any = false;
    Object.keys(rolls).forEach(function (key) {
      var r = rolls[key];
      if (!r.cell || !r.cell.isConnected) { delete rolls[key]; return; }
      var t = TEST_T != null ? Math.min(1, TEST_T / r.dur) : Math.max(0, Math.min(1, (now - r.t0) / r.dur));
      r.cur = r.from + (r.to - r.from) * easeOut(t);
      r.cell.setAttribute('data-fxr', r.fmt(r.rank ? Math.round(r.cur) : r.cur));
      if (t >= 1) finishRoll(key); else any = true;
    });
    if (any) raf = requestAnimationFrame(tick);
  }

  /* ── label "naik 2" + cahaya tepi (dipasang ulang tiap render) ─────── */
  function span(cls) {
    var e = document.createElement('span');
    e.className = cls;
    e.setAttribute('aria-hidden', 'true');
    return e;
  }
  // label diletakkan TEPAT setelah teks nama, di luar alur tata letak
  // (position:absolute di dalam baris) -> tabel tidak bergeser sedikit pun
  // Kalau tidak muat di baris nama (Top Performers di desktop sempit, nama
  // panjang) -> di baris kedua ("Team Ivan · 3x"); tidak pernah menutupi omzet.
  function textRect(el) {
    var rg = document.createRange();
    rg.selectNodeContents(el);
    var r = rg.getBoundingClientRect();
    return (r.width || r.height) ? r : el.getBoundingClientRect();
  }
  function tagPos(row, b, d) {
    var nm = row.querySelector(b.name);
    if (!nm) return null;
    var rr = row.getBoundingClientRect();
    if (!rr.width && !rr.height) return null;
    var wOf = function (t) { return Math.round(String(t).length * 5.9 + 25); };   // lebar label (perkiraan)
    var lim = rr.right - 8;
    var v = b.val && row.querySelector(b.val);
    var vcell = v ? (v.closest('td') || v) : null;
    var vcl = vcell ? vcell.getBoundingClientRect().left : Infinity;
    if (v) {
      var vr = textRect(v);
      if (vr.width && vr.left > rr.left + 60) lim = Math.min(lim, vr.left - 10);
    }
    // tabel: jangan menutupi angka di kolom sebelahnya (kecuali kolom itu
    // memang sudah tertutup kolom Omset yang menempel di HP)
    var cell = nm.closest('td');
    var nx = cell && cell.nextElementSibling;
    if (nx && nx !== vcell) {
      var nr = textRect(nx.firstElementChild || nx);
      if (nr.width && nr.left < vcl && nr.left > rr.left) lim = Math.min(lim, nr.left - 8);
    }
    var cand = [textRect(nm)];
    var l2 = b.line2 && row.querySelector(b.line2);
    if (l2) cand.push(textRect(l2));
    // teks lengkap di baris nama -> baris kedua -> teks pendek ("#1") -> dijepit
    var tries = [[d.text, 0], [d.text, 1], [d.short, 0], [d.short, 1], [d.tiny, 0], [d.tiny, 1]];
    var pick = null, label = d.tiny || d.text, x;
    for (var i = 0; i < tries.length && !pick; i++) {
      var c = cand[tries[i][1]];
      if (c && tries[i][0] && c.right + 8 + wOf(tries[i][0]) <= lim) { pick = c; label = tries[i][0]; }
    }
    if (pick) x = pick.right + 8;
    else { pick = cand[0]; x = Math.max(pick.left, lim - wOf(label)); }
    return { x: Math.round(x - rr.left), y: Math.round(pick.top - rr.top + pick.height / 2 - 8.5), text: label };
  }
  function decorate(b, el, pos, now) {
    var D = deco[b.id];
    if (!D) return;
    Object.keys(D).forEach(function (k) {
      var d = D[k], age = now - d.t0;
      if (age >= LIFE) { delete D[k]; return; }
      var row = el[k];
      if (!row) return;
      row.classList.add('fxr-lit');
      if (d.gold) row.classList.add('fxr-gold');
      var holder = row.tagName === 'TR' ? row.cells[0] : row;
      if (holder && !holder.querySelector(':scope > .fxr-glow')) {
        var g = span('fxr-glow');
        g.style.animationDelay = (-age) + 'ms';
        holder.appendChild(g);
      }
      var p = pos[k];
      if (holder && p && !holder.querySelector(':scope > .fxr-tag')) {
        var t = span('fxr-tag');
        t.textContent = p.text || d.text;
        t.style.left = p.x + 'px';
        t.style.top = p.y + 'px';
        t.style.animationDelay = (TAG_DELAY - age) + 'ms';
        holder.appendChild(t);
        row.setAttribute('data-fxr-tag', d.text);
      }
    });
  }
  var cleanT = 0;
  function scheduleCleanup() {
    clearTimeout(cleanT);
    var now = performance.now(), next = Infinity;
    Object.keys(deco).forEach(function (id) {
      Object.keys(deco[id]).forEach(function (k) { next = Math.min(next, deco[id][k].t0 + LIFE); });
    });
    if (next === Infinity) return;
    cleanT = setTimeout(cleanup, Math.max(30, next - now + 40));
  }
  function cleanup() {
    var now = performance.now();
    ALL.concat(MONTH).forEach(function (b) {
      var D = deco[b.id];
      if (!D) return;
      var host = byId(b.host);
      Object.keys(D).forEach(function (k) {
        if (now - D[k].t0 < LIFE) return;
        delete D[k];
        if (!host) return;
        rowsOf(b, host).forEach(function (row) {
          if (!row.classList.contains('fxr-lit') || keyOf(row, b) !== k) return;
          row.classList.remove('fxr-lit', 'fxr-gold');
          row.removeAttribute('data-fxr-tag');
          var q = row.querySelectorAll('.fxr-glow,.fxr-tag');
          for (var i = 0; i < q.length; i++) q[i].parentNode.removeChild(q[i]);
        });
      });
    });
    scheduleCleanup();
  }

  /* ── chip gerak peringkat bulan berjalan (Monthly Recap) ──────────── */
  function mtd() {
    var tk = HX.todayKey(), pfx = tk.slice(0, 8), day = +tk.slice(8);
    if (!(day > 1)) return null;                     // tanggal 1: belum ada "kemarin"
    var data;
    try { data = allData; } catch (e) { return null; }
    if (!data) return null;
    var now = {}, yd = {};
    Object.keys(data).forEach(function (k) {
      if (k.slice(0, 8) !== pfx) return;
      var dd = +k.slice(8), arr = data[k];
      if (!arr) return;
      if (!Array.isArray(arr)) arr = Object.keys(arr).map(function (x) { return arr[x]; });
      arr.forEach(function (e) {
        if (!e || typeof e !== 'object' || e.sp == null) return;
        var n = String(e.sp);
        if (HX.isChannel(n) || HX.isLeader(n)) return;
        var r = +e.revenue || 0;
        now[n] = (now[n] || 0) + r;
        if (dd < day) yd[n] = (yd[n] || 0) + r;
        else if (!(n in yd)) yd[n] = 0;
      });
    });
    return { now: ranks(now), yd: ranks(yd) };
  }
  // peringkat dengan seri: 1 + jumlah yang omzetnya LEBIH BESAR
  function ranks(sum) {
    var names = Object.keys(sum), vals = names.map(function (n) { return sum[n]; }).sort(function (a, b) { return b - a; });
    var out = {};
    names.forEach(function (n) {
      var v = sum[n], c = 0;
      while (c < vals.length && vals[c] > v) c++;
      out[n] = c + 1;
    });
    out.__n = names.length;
    return out;
  }
  function chips(b, rs, keys, fresh) {
    var host = byId(b.host);
    var info = recapIsNow() ? mtd() : null;
    legend(host, !!info);
    var prevChip = mem[b.id].chip, nextChip = {};
    var shown = 0;
    rs.forEach(function (row, i) {
      var cell = row.cells && row.cells[0];
      if (!cell) return;
      var old = cell.querySelector('.fxr-chip');
      var k = keys[i], name = k ? k.split('|')[0] : '';
      var want = null;
      if (info && shown < 10 && name && !HX.isChannel(name) && !HX.isLeader(name)) {
        shown++;
        var rn = info.now[name], ry = info.yd[name];
        if (rn == null) rn = (info.now.__n || 0) + 1;
        if (ry == null) ry = (info.yd.__n || 0) + 1;
        var d = ry - rn;
        want = {
          txt: d > 0 ? '+' + d : d < 0 ? MINUS + (-d) : '=',
          cls: d >= 3 ? 'up' : d <= -3 ? 'down' : 'flat',
          tip: (d > 0 ? 'Naik ' + d + ' peringkat' : d < 0 ? 'Turun ' + (-d) + ' peringkat' : 'Peringkat sama') +
            ' sejak kemarin \u00b7 sales #' + ry + ' \u2192 #' + rn + ' (tanpa channel & leader)'
        };
      }
      if (!want) { if (old) old.parentNode.removeChild(old); return; }
      nextChip[k] = want.txt;
      var c = old || document.createElement('span');
      c.className = 'fxr-chip ' + want.cls;
      c.textContent = want.txt;
      c.title = want.tip;
      c.setAttribute('aria-label', want.tip);
      if (!old) {
        if (fresh && !HX.reduced()) { c.classList.add('fxr-in'); c.style.animationDelay = (380 + shown * 45) + 'ms'; }
        else if (prevChip[k] !== undefined && prevChip[k] !== want.txt && !HX.reduced()) c.classList.add('fxr-pop');
        var rnk = cell.querySelector('.rnk');
        if (rnk && rnk.parentNode === cell) cell.insertBefore(c, rnk.nextSibling); else cell.appendChild(c);
      }
    });
    mem[b.id].chip = nextChip;
  }
  // judul .sl memberi jarak ke keterangan lewat flex gap; mesin tanpa flex gap
  // (iOS < 14.5, Chrome < 84) -> keterangan diberi margin sendiri. Diuji sekali.
  var flexGapOk = null;
  function flexGap() {
    if (flexGapOk !== null) return flexGapOk;
    flexGapOk = true;
    try {
      var d = document.createElement('div');
      d.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;top:0;left:0;visibility:hidden;pointer-events:none';
      d.appendChild(document.createElement('div'));
      d.appendChild(document.createElement('div'));
      document.body.appendChild(d);
      flexGapOk = d.scrollHeight === 1;
      d.parentNode.removeChild(d);
    } catch (e) { }
    return flexGapOk;
  }
  function legend(host, on) {
    var tw = host && host.closest('.tw');
    var sl = tw && tw.previousElementSibling;
    if (!sl || !sl.classList.contains('sl')) return;
    var lg = sl.querySelector(':scope > .fxr-legend');
    if (!on) { if (lg) lg.parentNode.removeChild(lg); return; }
    if (lg) return;
    lg = document.createElement('span');
    lg.className = 'fxr-legend' + (flexGap() ? '' : ' fxr-nogap');
    lg.innerHTML = '<span class="fxr-chip up" aria-hidden="true">+3</span>' +
      '<span class="fxr-chip down" aria-hidden="true">' + MINUS + '3</span>' +
      '<span class="fxr-legend-t">peringkat vs kemarin \u00b7 10 besar</span>';
    sl.appendChild(lg);
  }

  /* ── pasang: bungkus renderAll & renderMonthly (sekali saja) ──────── */
  var did = {};
  function keepMarkers(from, to) {
    for (var k in from) if (Object.prototype.hasOwnProperty.call(from, k)) to[k] = from[k];
    return to;
  }
  function wrapAll() {
    if (did.all || typeof window.renderAll !== 'function') return;
    did.all = true;
    var orig = window.renderAll;
    window.renderAll = keepMarkers(orig, function () {
      cycle++;
      try { pre(ALL); } catch (e) { console.warn('[fx-ranks] pre', e); }
      return orig.apply(this, arguments);
    });
  }
  function wrapMonthly() {
    if (did.month || typeof window.renderMonthly !== 'function') return;
    did.month = true;
    var orig = window.renderMonthly;
    window.renderMonthly = keepMarkers(orig, function () {
      mCycle = cycle;
      try { pre(MONTH); } catch (e) { console.warn('[fx-ranks] pre', e); }
      var r = orig.apply(this, arguments);
      try { post(MONTH); } catch (e) { console.warn('[fx-ranks] post', e); }
      return r;
    });
  }
  function wrapShow() {
    if (did.show || typeof window.showPage !== 'function') return;
    did.show = true;
    var orig = window.showPage;
    window.showPage = keepMarkers(orig, function () {
      switching++;
      try { return orig.apply(this, arguments); } finally { switching--; }
    });
  }
  function hook() { wrapAll(); wrapMonthly(); wrapShow(); if (document.body) flexGap(); }

  HX.on('render', function () {
    try { post(ALL); } catch (e) { console.warn('[fx-ranks] post', e); }
  });
  // Monthly Recap tidak ikut renderAll di app.js: penjualan baru yang masuk
  // saat halaman itu terbuka -> render ulang sekali (read-only) supaya
  // barisnya meluncur dan chipnya ikut berubah.
  HX.on('sales', function (list) {
    if (!list || !list.length) return;
    if (list.every(function (s) { return s.sim; })) return;
    var pg = byId('page-monthly');
    if (!pg || !pg.classList.contains('active') || document.hidden) return;
    if (!recapIsNow() || mCycle === cycle) return;
    if (typeof window.renderMonthly !== 'function') return;
    var a = document.activeElement;
    if (a && a.id === 'mSpSearch') return;          // sedang mengetik di pencarian
    try { window.renderMonthly(); } catch (e) { console.warn('[fx-ranks] monthly', e); }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  setTimeout(hook, 1100);

  /* ── untuk tes saja (tidak menyentuh data) ────────────────────────────
     HX.ranks._test.snap('msp')      catat posisi sekarang (seperti sebelum render)
     HX.ranks._test.settle('msp')    jalankan langkah sesudah-render
     HX.ranks._test.move('msp', 8, 3, 'Rp 190.000.000')
                                     pindahkan baris ke-8 ke posisi 3 di DOM
                                     (+ ubah teks omzet), lalu FLIP seperti
                                     render sungguhan. Data tidak disentuh. */
  HX.ranks = {
    boards: BY,
    _test: {
      snap: function (id) { pre([BY[id]]); return !!snap[id]; },
      settle: function (id) { post([BY[id]]); },
      move: function (id, from, to, valText) {
        var b = BY[id], host = byId(b.host);
        pre([b]);
        var rs = rowsOf(b, host), row = rs[from];
        if (!row) return false;
        if (valText != null) { var v = row.querySelector(b.val); if (v) v.textContent = valText; }
        var ref = rs[to];
        if (ref && ref !== row) host.insertBefore(row, ref); else if (!ref) host.appendChild(row);
        // nomor peringkat ditulis ulang seperti app.js
        rowsOf(b, host).forEach(function (r, i) {
          var e = b.rank && r.querySelector(b.rank);
          if (e) e.textContent = (typeof md === 'function') ? md(i) : String(i + 1);
        });
        post([b]);
        return true;
      },
      mtd: mtd,
      // bekukan SEMUA animasi (WAAPI/CSS + angka bergulir) di waktu ms -> tangkapan layar di tengah luncuran
      freeze: function (ms) {
        TEST_T = ms;
        document.getAnimations().forEach(function (a) { try { a.pause(); a.currentTime = ms; } catch (e) { } });
        tick(performance.now());
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      },
      thaw: function () {
        TEST_T = null;
        Object.keys(rolls).forEach(function (k) { rolls[k].t0 = performance.now() - rolls[k].dur * 0.5; });
        document.getAnimations().forEach(function (a) { try { a.play(); } catch (e) { } });
        if (Object.keys(rolls).length) kick();
      },
      mem: function (id) { return mem[id]; },
      stats: function () { return { pre: +stats.pre.toFixed(2), post: +stats.post.toFixed(2), n: stats.n }; }
    }
  };
})();
