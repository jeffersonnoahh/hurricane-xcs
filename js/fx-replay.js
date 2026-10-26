/* ══════════════════════════════════════════════════════════════════════
   FX REPLAY — "Putar ulang hari ini"
   Tayangan ulang ±12 detik dari penjualan hari yang sedang dilihat
   (allData[gvk()]), urut ts, jam WIB dari ts.

   HANYA MEMBACA. Tidak pernah menulis ke Firebase dan tidak pernah
   mengubah allData: data disalin ke model sendiri saat layar dibuka.

   - Tombol kaca kecil di pojok kanan atas kartu target Dashboard
     (sejajar judul "Today's Target"). Hilang kalau hari itu < 3 penjualan.
   - Layar penuh (z 900: di atas kapsul live 850, di bawah modal .mo 999
     dan toast). Lembar hitam padat, TANPA backdrop-filter.
   - Semua tampilan = fungsi dari satu waktu t (detik). Satu loop rAF hanya
     selama diputar; jeda / geser timeline cukup menggambar ulang t baru.
     Hanya transform/opacity per frame + teks yang benar-benar berubah.
   - Kurangi Gerak: tanpa animasi — ringkasan + grafik akhir + daftar
     penjualan per jam.
   - Tutup: X, Escape, tombol Back Android (history.pushState saat buka,
     popstate), "Tutup" di kartu akhir.

   Untuk tes: HX.replay.open([dayKey]) / .close() / .state() / .seek(t)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HX = window.HX;
  if (!HX || HX.__replay) return;
  HX.__replay = true;

  var D = document, R = D.documentElement;
  var WIB = 7 * 3600e3, MIN = 60e3, HOUR = 3600e3, DAYMS = 864e5;
  var BIG = 10e6;
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // waktu (detik)
  var INTRO = 0.55;      // panggung masuk, jam diam
  var LEAD = 0.4;        // jam berjalan dari awal jendela ke penjualan pertama
  var OM_EASE = 0.42;    // angka omzet menggulung per penjualan
  var HEAD_EASE = 0.2;   // titik kepala grafik naik
  var FEED_MOVE = 0.26;  // baris feed turun satu slot
  var FEED_IN = 0.24;    // baris baru muncul
  var ROW_MOVE = 0.5;    // baris TOP 5 meluncur (FLIP)
  var TAG_HOLD = 1.5;    // label "naik"
  var LATE_PAUSE = 0.35; // jeda sebelum fase "susulan"
  var END_GAP = 1.0;     // penjualan terakhir → kartu akhir
  var END_IN = 0.6;      // kartu akhir masuk
  var FLASH = 1.15;      // kilat target tembus

  var PLAY = '<svg viewBox="0 0 10 12" aria-hidden="true"><path d="M1.2 1.1v9.8c0 .5.5.8.9.5l7.4-4.9c.4-.3.4-.8 0-1.1L2.1.6c-.4-.3-.9 0-.9.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 10 12" aria-hidden="true"><rect x="1" y="1" width="2.8" height="10" rx=".9"/><rect x="6.2" y="1" width="2.8" height="10" rx=".9"/></svg>';
  var XICON = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
  var AGAIN = '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M11.6 7.2A4.6 4.6 0 1 1 9.9 3.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M10.4 1.4l.2 2.9-2.9.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ── util ─────────────────────────────────────────────────────────── */
  function str(v) { return String(v == null ? '' : v).trim(); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function eOut(x) { x = clamp(x, 0, 1); return 1 - (1 - x) * (1 - x) * (1 - x); }
  function eInOut(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function eBack(x) { x = clamp(x, 0, 1); var c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(ms) { var d = new Date(ms + WIB); return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()); }
  function hm(r) { var m = Math.floor(r / MIN); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
  function keyParts(key) { var p = String(key).split('-'); return [+p[0], +p[1], +p[2]]; }
  function dayStart(key) { var p = keyParts(key); return Date.UTC(p[0], p[1] - 1, p[2]) - WIB; }
  function dayName(key) { var p = keyParts(key); return HARI[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()]; }
  function dayShort(key) { var p = keyParts(key); return p[2] + ' ' + MON[p[1] - 1]; }
  function money(n) { return HX.money(n); }
  // persen seperti app.js (dibulatkan), tapi tidak pernah 100% sebelum benar-benar tembus
  function pctTxt(v, T) { var p = Math.round(v / T * 100); return v < T ? Math.min(p, 99) : Math.max(p, 100); }
  // 'Rp 223.140.000' tanpa toLocaleString (dipanggil tiap frame)
  function full(n) {
    n = Math.round(n);
    var s = String(Math.abs(n)), out = '';
    while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
    return (n < 0 ? '−Rp ' : 'Rp ') + s + out;
  }
  function mono(t) {
    try { if (typeof teamMono === 'function') return teamMono(t); } catch (e) { }
    var w = str(t).split(/\s+/).filter(Boolean);
    return w.length ? (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase() : '';
  }
  function viewKey() { try { if (typeof gvk === 'function') return gvk(); } catch (e) { } return HX.todayKey(); }
  function viewOff() { try { return +vOff || 0; } catch (e) { return 0; } }
  function dayEntries(key) {
    var d;
    try { d = allData && allData[key]; } catch (e) { d = null; }
    if (!d) return [];
    if (!Array.isArray(d)) {
      var a = [];
      for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) a.push(d[k]);
      d = a;
    }
    return d.filter(function (e) { return e && typeof e === 'object'; });
  }
  function el(tag, cls, html) {
    var n = D.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  // tulis hanya kalau berubah (hindari invalidasi gaya tiap frame)
  function sT(n, v) { if (n._t !== v) { n._t = v; n.style.transform = v; n.style.webkitTransform = v; } }
  function sO(n, v) {
    v = v < 0.003 ? 0 : v > 0.997 ? 1 : Math.round(v * 1000) / 1000;
    if (n._o !== v) { n._o = v; n.style.opacity = v; n.style.visibility = v ? 'visible' : 'hidden'; }
  }
  function sX(n, v) { if (n._x !== v) { n._x = v; n.textContent = v; } }
  function sC(n, c, on) { on = !!on; var k = '_c_' + c; if (n[k] !== on) { n[k] = on; if (on) n.classList.add(c); else n.classList.remove(c); } }

  /* ── "Terbesar" = satu CLOSING (pesanan) terbesar ──────────────────
     Aturan sama dengan fx-badges ("Terbesar minggu ini"): baris sales yang
     sama (per nama) berjarak ≤ 120 dtk dan ≤ 150 dtk dari baris pertamanya
     = satu closing (satu pesanan sering dicatat beberapa baris: TWIN TURBO
     + 2× SPRING BUFFER beberapa detik berselang). Hanya sales: channel &
     team lead dilewati — kecuali hari itu tidak ada penjualan sales sama
     sekali. Seri: yang lebih awal. Baris tanpa jam berdiri sendiri. */
  var CL_GAP = 120e3, CL_SPAN = 150e3;
  function closingsOf(rows) {
    var a = rows.slice().sort(function (p, q) { return ((p.ts || 0) - (q.ts || 0)) || (p.i - q.i); });
    var out = [], g = null;
    a.forEach(function (x) {
      if (g && x.ts > 0 && x.ts - g.last <= CL_GAP && x.ts - g.ts <= CL_SPAN) { g.rev += x.rev; g.items++; g.last = x.ts; return; }
      g = { sp: x.sp, team: x.team, ts: x.ts, last: x.ts, rev: x.rev, items: 1, late: x.late };
      out.push(g);
      if (!(x.ts > 0)) g = null;
    });
    return out;
  }
  function bigClosing(s) {
    var best = null;
    function better(c) {
      if (!(c.rev > 0)) return false;
      if (!best || c.rev > best.rev) return true;
      return c.rev === best.rev && (c.ts || Infinity) < (best.ts || Infinity);
    }
    [true, false].some(function (sellersOnly) {
      var by = {}, names = [];
      s.forEach(function (x) {
        if (sellersOnly && (x.ch || x.lead || x.anon)) return;
        var n = x.sp.toLowerCase();
        if (!by[n]) { by[n] = []; names.push(n); }
        by[n].push(x);
      });
      names.forEach(function (n) { closingsOf(by[n]).forEach(function (c) { if (better(c)) best = c; }); });
      return !!best;
    });
    return best;
  }

  /* ── model: salinan data hari itu + jadwal tayang ─────────────────── */
  function buildModel(key) {
    var raw = dayEntries(key), T = +HX.target() || 0;
    var ds = dayStart(key), de = ds + DAYMS;
    var s = raw.map(function (e, i) {
      var ts = +e.ts || 0, sp = str(e.sp) || '—', team = str(e.team);
      return {
        sp: sp, team: team, prod: str(e.prod), units: Math.max(1, Math.round(+e.units || 1)),
        rev: +e.revenue || 0, ts: ts, i: i, ch: HX.isChannel(sp), lead: HX.isLeader(sp),
        late: !ts || ts >= de, key: sp + '|' + team, anon: !str(e.sp)
      };
    });
    s.sort(function (a, b) { return ((a.late ? 1 : 0) - (b.late ? 1 : 0)) || (a.ts - b.ts) || (a.i - b.i); });
    var n = s.length, nIn = 0, i;
    s.forEach(function (x) { if (!x.late) { x.r = clamp(x.ts - ds, 0, DAYMS - 1); nIn++; } });

    // jendela jam
    var rs, rl;
    if (nIn) {
      rl = s[nIn - 1].r;
      rs = Math.max(0, Math.floor((s[0].r - 20 * MIN) / (30 * MIN)) * 30 * MIN);
    } else { rs = 8 * HOUR; rl = 20 * HOUR; }
    var xs = rs, xe = Math.min(DAYMS, Math.max(rl + 25 * MIN, rs + 3 * HOUR));

    // jadwal: tiap penjualan ≥ minGap; jeda sepi dimampatkan (akar)
    var S = clamp(n * 0.2 + 3.5, 6.5, 11.4);
    var gaps = [], fsum = 0, fixed = 0;
    for (i = 1; i < n; i++) {
      var a = s[i - 1], b = s[i], f = 0, extra = 0;
      if (!a.late && !b.late) f = Math.sqrt(clamp((b.r - a.r) / MIN, 0, 240));
      else if (!a.late && b.late) extra = LATE_PAUSE;
      gaps.push({ f: f, x: extra }); fsum += f; fixed += extra;
    }
    var minGap = n > 1 ? Math.min(0.18, 0.8 * S / (n - 1)) : 0;
    var rest = Math.max(0, S - minGap * (n - 1) - fixed);
    if (n) s[0].tau = INTRO + LEAD;
    for (i = 1; i < n; i++) {
      var g = gaps[i - 1];
      s[i].tau = s[i - 1].tau + minGap + g.x + (fsum > 0 ? rest * g.f / fsum : rest / (n - 1));
    }
    var last = n ? s[n - 1].tau : INTRO + LEAD;
    var endAt = last + END_GAP, total = endAt + END_IN;

    // kumulatif, lewat target
    var cum = 0, cross = -1;
    s.forEach(function (x, j) {
      cum += x.rev; x.cum = cum;
      if (cross < 0 && T > 0 && cum >= T) cross = j;
    });
    var big = bigClosing(s);

    // TOP 5 (tanpa channel & team lead): event slot per sales
    var tot = {}, at = {}, rows = {}, rlist = [], prev = {};
    s.forEach(function (x, j) {
      if (x.ch || x.lead) return;
      var k = x.key;
      tot[k] = (tot[k] || 0) + x.rev; at[k] = j;
      if (!rows[k]) { rows[k] = { key: k, sp: x.sp, team: x.team, ev: [], sales: [] }; rlist.push(rows[k]); }
      rows[k].sales.push(j);
      var top = Object.keys(tot).sort(function (p, q) { return (tot[q] - tot[p]) || (at[p] - at[q]); }).slice(0, 5);
      var now = {};
      top.forEach(function (k2, q) { now[k2] = q; });
      var seen = {};
      Object.keys(prev).concat(top).forEach(function (k2) {
        if (seen[k2]) return; seen[k2] = 1;
        var from = prev.hasOwnProperty(k2) ? prev[k2] : 5, to = now.hasOwnProperty(k2) ? now[k2] : 5;
        if (from !== to) rows[k2].ev.push({ tau: x.tau, slot: to, climb: to < from });
      });
      prev = now;
    });
    rlist.forEach(function (row) {
      var lt = -1, lf = 5, ls = 5;
      row.ev.forEach(function (ev) {
        var p = lt < 0 ? 5 : lf + (ls - lf) * eInOut((ev.tau - lt) / ROW_MOVE);
        ev.from = p; lt = ev.tau; lf = p; ls = ev.slot;
      });
    });
    var mvp = null;
    Object.keys(tot).forEach(function (k) { if (!mvp || tot[k] > mvp.rev) mvp = { key: k, rev: tot[k], sp: rows[k].sp, team: rows[k].team }; });

    return {
      key: key, today: viewOff() === 0 && key === HX.todayKey(), T: T, s: s, n: n, nIn: nIn,
      rs: rs, rl: rl, xs: xs, xe: xe, total: total, endAt: endAt, sum: cum, cross: cross, big: big,
      rows: rlist, mvp: mvp, ymax: Math.max(cum, T, 1) * 1.12,
      maxCum: s.reduce(function (m, x) { return Math.max(m, x.cum); }, 0)
    };
  }

  /* ── fungsi waktu ─────────────────────────────────────────────────── */
  var M = null;
  // indeks penjualan terakhir yang sudah mendarat pada t (-1 = belum ada)
  function landed(t) {
    var s = M.s, lo = 0, hi = s.length - 1, ans = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (s[mid].tau <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  // jam (ms sejak 00:00 WIB) pada t
  function clockAt(t, L) {
    var s = M.s;
    if (!M.nIn) return M.rs;
    var first = s[0];
    if (t <= first.tau) return M.rs + (first.r - M.rs) * eInOut((t - INTRO) / LEAD);
    var j = Math.min(L, M.nIn - 1);
    if (j >= M.nIn - 1) return M.rl;
    var a = s[j], b = s[j + 1];
    return a.r + (b.r - a.r) * clamp((t - a.tau) / (b.tau - a.tau), 0, 1);
  }
  function rolled(t, L, dur) {
    var v = 0, s = M.s;
    for (var i = 0; i <= L; i++) v += s[i].rev * eOut((t - s[i].tau) / dur);
    return v;
  }

  /* ── DOM ──────────────────────────────────────────────────────────── */
  var ov, E = {}, pool = [], rowEls = {}, st = { open: false, pushed: false, ignorePop: false, reduced: false, drag: false };
  var t = 0, playing = false, raf = 0, lastNow = 0;
  var G = null; // geometri hasil ukur

  function build() {
    if (ov) return;
    ov = el('div', 'hxr');
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', 'Putar ulang penjualan');
    ov.setAttribute('tabindex', '-1');
    ov.innerHTML =
      '<div class="hxr-sheet">' +
        '<div class="hxr-top">' +
          '<div class="hxr-kick"><i class="hxr-dot"></i><span class="hxr-kt">Putar ulang</span><span class="hxr-kd"></span></div>' +
          '<button type="button" class="hxr-x" aria-label="Tutup">' + XICON + '</button>' +
        '</div>' +
        '<div class="hxr-stage">' +
          '<div class="hxr-main">' +
            '<div class="hxr-clockrow">' +
              '<div class="hxr-clock">--:--</div>' +
              '<div class="hxr-cmeta"><span class="hxr-wib">WIB</span><span class="hxr-late">susulan</span></div>' +
              '<div class="hxr-count"><b>0</b><span>penjualan</span></div>' +
            '</div>' +
            '<div class="hxr-omw"><i class="hxr-omglow"></i><div class="hxr-om">Rp 0</div></div>' +
            '<div class="hxr-tgt">' +
              '<div class="hxr-tl"><span class="hxr-tls"><span class="hxr-tlw"><span class="hxr-tlab"></span><span class="hxr-left"></span></span>' +
                '<span class="hxr-hit">Target tembus <b></b></span></span><span class="hxr-pct">0%</span></div>' +
              '<div class="hxr-barw"><div class="hxr-bar"><i class="hxr-fill"></i><i class="hxr-lap"></i>' +
                '<i class="hxr-notch" style="left:25%"></i><i class="hxr-notch" style="left:50%"></i><i class="hxr-notch" style="left:75%"></i>' +
              '</div><i class="hxr-flash"></i><i class="hxr-ring"></i></div>' +
            '</div>' +
            '<div class="hxr-chart">' +
              '<div class="hxr-cv"><div class="hxr-cvi"></div></div>' +
              '<div class="hxr-cgrid"></div>' +
              '<i class="hxr-now"></i><i class="hxr-head"></i><i class="hxr-cx"></i>' +
            '</div>' +
          '</div>' +
          '<div class="hxr-side">' +
            '<div class="hxr-board"><div class="hxr-h"><span>Top 5 sales</span><span>omset</span></div><div class="hxr-rows"><div class="hxr-empty">Belum ada penjualan sales</div></div></div>' +
            '<div class="hxr-feed"><div class="hxr-h"><span>Penjualan masuk</span><span class="hxr-fn"></span></div><div class="hxr-lines"></div></div>' +
          '</div>' +
          '<div class="hxr-endw"><div class="hxr-end" role="group" aria-label="Ringkasan"></div></div>' +
          '<div class="hxr-pz"><div class="hxr-pzp"><span class="hxr-pzi">' + PAUSE + '</span><span>Dijeda · ketuk untuk lanjut</span></div></div>' +
          '<div class="hxr-sv"></div>' +
        '</div>' +
        '<div class="hxr-ctl">' +
          '<button type="button" class="hxr-pp" aria-label="Jeda">' + PAUSE + '</button>' +
          '<div class="hxr-scrub" role="slider" tabindex="0" aria-label="Linimasa" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
            '<div class="hxr-track"><i class="hxr-tfill"></i></div>' +
            '<div class="hxr-ticks"></div>' +
            '<i class="hxr-thumb"></i>' +
            '<span class="hxr-t0"></span><span class="hxr-t1"></span>' +
          '</div>' +
        '</div>' +
      '</div>';
    D.body.appendChild(ov);
    function q(c) { return ov.querySelector('.' + c); }
    ['sheet', 'kd', 'x', 'stage', 'main', 'side', 'clock', 'late', 'count', 'omw', 'om', 'omglow', 'tlab', 'tlw', 'pct', 'bar', 'fill', 'lap',
      'ring', 'left', 'hit', 'flash', 'chart', 'cv', 'cvi', 'cgrid', 'now', 'head', 'cx', 'rows', 'empty', 'lines', 'fn', 'endw', 'end', 'pz',
      'sv', 'ctl', 'pp', 'scrub', 'track', 'tfill', 'ticks', 'thumb', 't0', 't1', 'feed', 'board'].forEach(function (c) { E[c] = q('hxr-' + c); });
    E.cnum = E.count.querySelector('b');
    E.hitT = E.hit.querySelector('b');
    E.notches = Array.prototype.slice.call(ov.querySelectorAll('.hxr-notch'));
    for (var i = 0; i < 16; i++) { var ln = el('div', 'hxr-ln'); ln._i = -1; sO(ln, 0); E.lines.appendChild(ln); pool.push(ln); }

    E.x.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    E.pp.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    E.stage.addEventListener('click', function (e) {
      if (st.reduced || !M) return;
      if (e.target.closest && e.target.closest('button,a,.hxr-end')) return;
      if (t >= M.total) return;
      toggle();
    });
    E.end.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.getAttribute('data-a') === 'again') restart(); else close();
    });
    initScrub();
    // iOS: geser satu jari di layar ini tidak boleh menggulir halaman di belakang
    ov.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length > 1) return;   // cubit-zoom tetap boleh
      var sc = e.target.closest && e.target.closest('.hxr-sv');
      if (sc && sc.scrollHeight > sc.clientHeight + 1) return;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    ov.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  /* ── isi statis per pembukaan ─────────────────────────────────────── */
  function lateTxt() { return 'susulan'; }
  function lineHTML(x) {
    var amt = (x.rev < 0 ? '−Rp ' : '+Rp ') + money(Math.abs(x.rev));
    return '<span class="hxr-lt">' + (x.late ? lateTxt() : hhmm(x.ts)) + '</span>' +
      '<span class="hxr-lnp"><b>' + esc(x.sp) + '</b><i> · ' + esc(x.prod || '—') + (x.units > 1 ? ' ×' + x.units : '') + '</i></span>' +
      '<span class="hxr-la' + (x.rev < 0 ? ' neg' : '') + '">' + esc(amt) + '</span>';
  }
  function endHTML(withAgain) {
    var m = M, pct = m.T > 0 ? pctTxt(m.sum, m.T) : 0;
    var head = m.today ? 'Hari ini' : dayName(m.key) + ', ' + dayShort(m.key);
    var cx = m.cross >= 0 ? m.s[m.cross] : null;
    var big = m.big, mvp = m.mvp;
    var h = '<div class="hxr-ek">Ringkasan · ' + esc(head) + '</div>' +
      '<div class="hxr-ev">Rp ' + esc(money(m.sum)) + '</div>' +
      '<div class="hxr-eps">' +
        (m.T > 0 ? '<span class="hxr-ep' + (pct >= 100 ? ' ok' : '') + '">' + pct + '% target</span>' : '') +
        '<span class="hxr-ep">' + m.n + ' penjualan</span>' +
      '</div>' +
      '<div class="hxr-ers">' +
        (big ? '<div class="hxr-er"><span class="k">Terbesar</span><span class="v"><span class="nm"><b>' + esc(big.sp) + '</b>' +
          '<small>' + (big.items > 1 ? big.items + ' item · ' : '') + (big.late ? 'susulan' : hhmm(big.ts)) + '</small></span>' +
          '<em>Rp ' + esc(money(big.rev)) + '</em></span></div>' : '') +
        (mvp ? '<div class="hxr-er"><span class="k">MVP</span><span class="v"><i>01</i><b>' + esc(mvp.sp) + '</b><em>Rp ' + esc(money(mvp.rev)) + '</em></span></div>' : '') +
      '</div>' +
      '<div class="hxr-el">' + (cx
        ? 'Target tembus <b>' + (cx.late ? 'susulan' : hhmm(cx.ts)) + '</b> · penjualan ' + esc(cx.sp)
        : (m.T > 0 ? 'Kurang <b class="neg">Rp ' + esc(money(m.T - m.sum)) + '</b> dari target Rp ' + esc(money(m.T)) : '')) + '</div>' +
      '<div class="hxr-ebt">' +
        (withAgain ? '<button type="button" class="hxr-b2" data-a="again">' + AGAIN + '<span>Putar lagi</span></button>' : '') +
        '<button type="button" class="hxr-b1" data-a="close"><span>Tutup</span></button>' +
      '</div>';
    return h;
  }
  function fill() {
    var m = M;
    E.kd.textContent = dayName(m.key) + ', ' + dayShort(m.key);
    ov.setAttribute('aria-label', m.today ? 'Putar ulang hari ini' : 'Putar ulang ' + dayShort(m.key));
    E.tlab.textContent = m.T > 0 ? 'Target ' + money(m.T) : 'Target belum diatur';
    E.t0.textContent = m.nIn ? hm(m.s[0].r) : '';
    E.t1.textContent = m.nIn ? hm(m.rl) : '';
    E.end.innerHTML = endHTML(true);
    sC(ov, 'has-late', m.n > m.nIn);
    // baris TOP 5 (dibuat ulang per pembukaan)
    Object.keys(rowEls).forEach(function (k) { var r = rowEls[k]; if (r.parentNode) r.parentNode.removeChild(r); });
    rowEls = {};
    m.rows.forEach(function (row) {
      if (!row.ev.length) return;
      var r = el('div', 'hxr-row',
        '<i class="hxr-rbar"></i><i class="hxr-rhl"></i>' +
        '<span class="hxr-rk">05</span>' +
        '<span class="hxr-rm">' + esc(mono(row.team)) + '</span>' +
        '<span class="hxr-rn">' + esc(row.sp) + '</span>' +
        '<span class="hxr-rv"><span class="hxr-tag">naik</span><b>0</b></span>');
      r._bar = r.children[0]; r._hl = r.children[1]; r._rk = r.children[2];
      r._tag = r.children[5].children[0]; r._rv = r.children[5].children[1];
      sO(r, 0); sO(r._tag, 0); sO(r._hl, 0);
      E.rows.appendChild(r);
      rowEls[row.key] = r;
    });
    pool.forEach(function (ln) { ln._i = -1; sO(ln, 0); });
    // titik penjualan di timeline
    var tk = '';
    m.s.forEach(function (x, j) {
      var p = (x.tau / m.total * 100).toFixed(2);
      tk += '<i class="' + (x.rev >= BIG ? 'b' : x.ch ? 'c' : '') + (j === m.cross ? ' x' : '') + '" style="left:' + p + '%"></i>';
    });
    E.ticks.innerHTML = tk;
    E.fn.textContent = m.n > m.nIn ? (m.n - m.nIn) + ' susulan' : '';
    // reset cache tulis supaya gambar pertama lengkap
    [E.clock, E.cnum, E.om, E.pct, E.left].forEach(function (n) { n._x = null; });
  }

  /* ── ukur & grafik (piksel asli) ──────────────────────────────────── */
  function chartSVG(w, h, gid) {
    var m = M, padB = 16, padT = 6, y0 = h - padB, y1 = padT;
    var xr = function (r) { return (r - m.xs) / (m.xe - m.xs) * w; };
    var yv = function (v) { return y0 - clamp(v / m.ymax, -0.05, 1) * (y0 - y1); };
    var d = 'M0,' + y0.toFixed(1), cum = 0;
    if (m.nIn) d = 'M' + xr(m.xs).toFixed(1) + ',' + y0.toFixed(1);
    m.s.forEach(function (x) {
      if (!x.late) d += 'H' + xr(x.r).toFixed(1);
      cum += x.rev;
      d += 'V' + yv(cum).toFixed(1);
    });
    var area = d + 'V' + y0.toFixed(1) + 'Z';
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#30d158" stop-opacity=".30"/><stop offset="1" stop-color="#30d158" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + d + '" fill="none" stroke="#30d158" stroke-width="1.8" stroke-linejoin="round"/>' +
      '</svg>';
  }
  function gridHTML(w, h) {
    var m = M, padB = 16, padT = 6, y0 = h - padB, y1 = padT, out = '';
    var xr = function (r) { return (r - m.xs) / (m.xe - m.xs) * w; };
    out += '<i class="hxr-base" style="top:' + y0.toFixed(1) + 'px"></i>';
    if (m.T > 0) {
      var yt = y0 - m.T / m.ymax * (y0 - y1);
      out += '<i class="hxr-tline" style="top:' + yt.toFixed(1) + 'px"></i><span class="hxr-tlbl" style="top:' + (yt - 13).toFixed(1) + 'px">Target</span>';
    }
    var span = (m.xe - m.xs) / HOUR, step = w < 260 ? 4 : w < 420 ? (span > 10 ? 3 : 2) : (span > 12 ? 2 : 1);
    for (var hh = Math.ceil(m.xs / HOUR); hh * HOUR <= m.xe; hh++) {
      if (hh % step) continue;
      var x = xr(hh * HOUR);
      if (x < 12 || x > w - 12) continue;
      out += '<span class="hxr-hr" style="left:' + x.toFixed(1) + 'px">' + pad(hh % 24) + '</span>';
    }
    return out;
  }
  function layout() {
    if (!M || !ov) return;
    var cw = E.chart.clientWidth, ch = E.chart.clientHeight;
    var g = { cw: cw, ch: ch };
    if (cw > 0 && ch > 0) {
      E.cvi.innerHTML = chartSVG(cw, ch, 'hxr-g1');
      E.cgrid.innerHTML = gridHTML(cw, ch);
      g.y0 = ch - 16; g.y1 = 6;
    }
    var cs = getComputedStyle(ov);
    g.rh = parseFloat(cs.getPropertyValue('--hxr-rh')) || 32;
    g.lh = parseFloat(cs.getPropertyValue('--hxr-lh')) || 30;
    g.K = clamp(Math.floor((E.lines.clientHeight + 4) / g.lh), 1, pool.length - 2);
    g.tw = E.scrub.clientWidth;
    G = g;
    if (st.reduced) {
      var sc = E.sv.querySelector('.hxr-schart');
      if (sc && sc.clientWidth) {
        sc.innerHTML = chartSVG(sc.clientWidth, sc.clientHeight, 'hxr-g2') + '<div class="hxr-cgrid">' + gridHTML(sc.clientWidth, sc.clientHeight) + '</div>';
      }
    }
    // paksa tulis ulang transform
    [E.cv, E.cvi, E.now, E.head, E.cx, E.thumb].forEach(function (n) { n._t = null; });
    paint(t);
  }

  /* ── gambar keadaan pada t ────────────────────────────────────────── */
  function paint(tt) {
    var m = M, g = G;
    if (!m || !g) return;
    var L = landed(tt), s = m.s, i;

    // jam + fase susulan
    var r = clockAt(tt, L);
    sX(E.clock, m.nIn ? hm(r) : '--:--');
    var lateNow = L >= m.nIn && m.n > m.nIn;
    sC(ov, 'is-late', lateNow);
    sX(E.cnum, String(L + 1));

    // omzet + target
    var om = rolled(tt, L, OM_EASE);
    sX(E.om, full(om));
    var p = m.T > 0 ? om / m.T : 0;
    sT(E.fill, 'translate3d(' + ((clamp(p, 0, 1) - 1) * 100).toFixed(2) + '%,0,0)');
    sT(E.lap, 'translate3d(' + ((clamp(p - 1, 0, 1) - 1) * 100).toFixed(2) + '%,0,0)');
    sX(E.pct, m.T > 0 ? pctTxt(om, m.T) + '%' : '');
    for (i = 0; i < 3; i++) sC(E.notches[i], 'lit', p >= (i + 1) * 0.25);
    var lc = L >= 0 ? s[L].cum : 0;
    sX(E.left, m.T > 0 && lc < m.T ? ' · kurang ' + money(m.T - lc) : '');

    // target tembus
    var cx = m.cross >= 0 ? s[m.cross] : null, ct = cx ? tt - cx.tau : -1;
    if (cx && ct >= 0) {
      sX(E.hitT, cx.late ? 'susulan' : hhmm(cx.ts));
      var hp = eBack(ct / 0.45);
      sO(E.hit, clamp(ct / 0.18, 0, 1));
      sT(E.hit, 'translate3d(0,' + ((1 - hp) * 6).toFixed(2) + 'px,0) scale(' + (0.86 + 0.14 * hp).toFixed(4) + ')');
      sO(E.tlw, clamp(1 - ct / 0.15, 0, 1));
      var fl = ct < FLASH ? (ct < 0.08 ? ct / 0.08 : 1 - eOut((ct - 0.08) / (FLASH - 0.08))) : 0;
      sO(E.flash, fl);
      var rp = clamp(ct / 0.9, 0, 1);
      sO(E.ring, rp < 1 ? (1 - rp) * 0.9 : 0);
      sT(E.ring, 'scale(' + (0.3 + eOut(rp) * 2.6).toFixed(3) + ')');
      sC(ov, 'is-hit', true);
    } else {
      sO(E.hit, 0); sO(E.tlw, 1); sO(E.flash, 0); sO(E.ring, 0);
      sC(ov, 'is-hit', false);
    }

    // penjualan besar (>= Rp10jt): cahaya di belakang angka + denyut kecil
    var bg = 0, bt = -1;
    for (i = L; i >= 0 && tt - s[i].tau < 0.9; i--) if (s[i].rev >= BIG) { bt = tt - s[i].tau; break; }
    if (bt >= 0) bg = bt < 0.1 ? bt / 0.1 : 1 - eOut((bt - 0.1) / 0.8);
    sO(E.omglow, bg);
    var pulse = bt >= 0 && bt < 0.5 ? Math.sin(Math.PI * clamp(bt / 0.5, 0, 1)) * 0.035 : 0;
    sT(E.om, pulse ? 'scale(' + (1 + pulse).toFixed(4) + ')' : 'none');

    // grafik
    if (g.cw && g.y0) {
      var reveal = tt >= m.endAt ? g.cw : clamp((r - m.xs) / (m.xe - m.xs) * g.cw, 0, g.cw);
      if (tt < INTRO) reveal = 0;
      var off = (g.cw - reveal).toFixed(1);
      sT(E.cv, 'translate3d(-' + off + 'px,0,0)');
      sT(E.cvi, 'translate3d(' + off + 'px,0,0)');
      var hv = rolled(tt, L, HEAD_EASE);
      var hy = g.y0 - clamp(hv / m.ymax, -0.05, 1) * (g.y0 - g.y1);
      var hx = tt >= m.endAt && m.nIn ? (m.rl - m.xs) / (m.xe - m.xs) * g.cw : reveal;
      sT(E.head, 'translate3d(' + hx.toFixed(1) + 'px,' + hy.toFixed(1) + 'px,0)');
      sT(E.now, 'translate3d(' + hx.toFixed(1) + 'px,0,0)');
      var show = tt >= INTRO * 0.6 ? 1 : 0;
      sO(E.head, show); sO(E.now, show * (tt >= m.endAt ? 0 : 1));
      if (cx && ct >= 0 && g.y0 && m.nIn) {
        var cxx = cx.late ? (m.rl - m.xs) / (m.xe - m.xs) * g.cw : (cx.r - m.xs) / (m.xe - m.xs) * g.cw;
        var cyy = g.y0 - m.T / m.ymax * (g.y0 - g.y1);
        var cp = eBack(ct / 0.5);
        sT(E.cx, 'translate3d(' + cxx.toFixed(1) + 'px,' + cyy.toFixed(1) + 'px,0) scale(' + (0.2 + 0.8 * cp).toFixed(3) + ')');
        sO(E.cx, clamp(ct / 0.15, 0, 1));
      } else sO(E.cx, 0);
    }

    // TOP 5
    var anyRow = false, top = 0, vis = [];
    m.rows.forEach(function (row) {
      var rEl = rowEls[row.key];
      if (!rEl) return;
      var ev = null;
      for (var k = row.ev.length - 1; k >= 0; k--) if (row.ev[k].tau <= tt) { ev = row.ev[k]; break; }
      var pr = ev ? clamp((tt - ev.tau) / ROW_MOVE, 0, 1) : 1;
      var pos = ev ? ev.from + (ev.slot - ev.from) * eInOut(pr) : 5;
      // keluar papan: pudar cepat di tempat; masuk dari bawah: muncul setelah mulai naik
      // (baris yang keluar & yang masuk tidak saling tumpuk di slot 05)
      var op = !ev ? 0 : ev.slot === 5 ? 1 - clamp(pr / 0.3, 0, 1) : ev.from > 4 ? clamp((pr - 0.3) / 0.35, 0, 1) : 1;
      sO(rEl, op);
      if (!op) return;
      anyRow = true;
      sT(rEl, 'translate3d(0,' + (pos * g.rh).toFixed(1) + 'px,0)');
      var moving = ev && tt - ev.tau < ROW_MOVE && ev.climb;
      sC(rEl, 'up', moving);
      var rk = clamp(Math.round(pos), 0, 4);
      sX(rEl._rk, '0' + (rk + 1));
      sC(rEl, 'r1', rk === 0);
      // omzet per sales (menggulung), sorot saat mencetak
      var v = 0, lastT = -1;
      for (var q = 0; q < row.sales.length; q++) {
        var x = s[row.sales[q]];
        if (x.tau > tt) break;
        v += x.rev * eOut((tt - x.tau) / OM_EASE); lastT = x.tau;
      }
      sX(rEl._rv, money(v));
      var dh = lastT >= 0 ? tt - lastT : 9;
      sO(rEl._hl, dh < 0.8 ? 1 - eOut(dh / 0.8) : 0);
      // label "naik"
      var ce = null;
      for (k = row.ev.length - 1; k >= 0; k--) { if (row.ev[k].tau <= tt && row.ev[k].climb) { ce = row.ev[k]; break; } }
      var dc = ce ? tt - ce.tau : 9;
      sO(rEl._tag, dc < TAG_HOLD ? clamp(dc / 0.18, 0, 1) * (1 - eOut((dc - (TAG_HOLD - 0.3)) / 0.3)) : 0);
      sT(rEl._tag, 'translate3d(' + (dc < 0.3 ? (1 - eOut(dc / 0.3)) * -6 : 0).toFixed(2) + 'px,0,0)');
      vis.push([rEl, v]);
      if (v > top) top = v;
    });
    vis.forEach(function (a) { sT(a[0]._bar, 'scaleX(' + (top > 0 ? clamp(a[1] / top, 0, 1) : 0).toFixed(4) + ')'); });
    sO(E.empty, anyRow || L < 0 ? 0 : 1);

    // feed: baru di atas, yang lama turun satu slot dan memudar di bawah
    var K = g.K, lo = Math.max(0, L - K), used = {};
    for (i = lo; i <= L; i++) {
      var pos2 = 0;
      for (var k2 = i + 1; k2 <= L; k2++) pos2 += eOut((tt - s[k2].tau) / FEED_MOVE);
      if (pos2 >= K) continue;
      var ln = pool[i % pool.length];
      used[i % pool.length] = 1;
      if (ln._i !== i) {
        ln._i = i;
        var x2 = s[i];
        ln.className = 'hxr-ln' + (x2.rev >= BIG ? ' big' : '') + (x2.ch ? ' ch' : '') + (x2.late ? ' late' : '');
        ln.innerHTML = lineHTML(x2);
        ln._t = null; ln._o = null;
      }
      var age = tt - s[i].tau, ein = eOut((age - 0.07) / FEED_IN);
      var fade = clamp(K - pos2, 0, 1);
      sO(ln, ein * fade);
      sT(ln, 'translate3d(0,' + (pos2 * g.lh - (1 - ein) * 10).toFixed(1) + 'px,0) scale(' + (0.97 + 0.03 * ein).toFixed(4) + ')');
    }
    for (i = 0; i < pool.length; i++) if (!used[i]) sO(pool[i], 0);

    // timeline
    var f = clamp(tt / m.total, 0, 1);
    sT(E.tfill, 'scaleX(' + f.toFixed(4) + ')');
    sT(E.thumb, 'translate3d(' + (f * g.tw).toFixed(1) + 'px,0,0)');
    var vn = String(Math.round(f * 100));
    if (E.scrub._vn !== vn) { E.scrub._vn = vn; E.scrub.setAttribute('aria-valuenow', vn); }

    // kartu akhir
    var e = tt >= m.endAt ? eOut((tt - m.endAt) / END_IN) : 0;
    sO(E.end, e);
    sT(E.end, 'translate3d(0,' + ((1 - e) * 18).toFixed(1) + 'px,0) scale(' + (0.97 + 0.03 * e).toFixed(4) + ')');
    sC(ov, 'is-end', e > 0);
    var dim = 1 - 0.8 * e;
    sO(E.main, dim); sO(E.side, dim);
  }

  /* ── loop ─────────────────────────────────────────────────────────── */
  function frame(now) {
    raf = 0;
    if (!st.open || !M) return;
    if (playing) {
      var dt = lastNow ? Math.min(now - lastNow, 100) : 16;
      lastNow = now;
      t += dt / 1000;
      if (t >= M.total) { t = M.total; playing = false; syncPlay(); }
    }
    if (prof) { var p0 = performance.now(); paint(t); prof.n++; prof.ms += performance.now() - p0; }
    else paint(t);
    if (playing) raf = requestAnimationFrame(frame); else lastNow = 0;
  }
  var prof = null; // HX.replay.profile() — hanya untuk tes
  function kick() { if (!raf && st.open) raf = requestAnimationFrame(frame); }
  var pzT = 0;
  function syncPlay() {
    if (!ov) return;
    var ended = M && t >= M.total;
    var paused = !playing && !ended && !st.drag;
    if (paused && !ov['_c_is-paused'] && st.open && !st.reduced) {
      // pil "Dijeda" muncul sebentar; tombol play hijau tetap jadi penanda
      sC(ov, 'pz-on', true);
      clearTimeout(pzT);
      pzT = setTimeout(function () { sC(ov, 'pz-on', false); }, 1300);
    }
    if (!paused) { clearTimeout(pzT); sC(ov, 'pz-on', false); }
    sC(ov, 'is-paused', paused);
    E.pp.innerHTML = playing ? PAUSE : (ended ? AGAIN : PLAY);
    E.pp.setAttribute('aria-label', playing ? 'Jeda' : ended ? 'Putar lagi' : 'Putar');
  }
  function toggle() {
    if (!M) return;
    if (t >= M.total) { restart(); return; }
    playing = !playing; lastNow = 0;
    syncPlay(); kick();
  }
  function restart() { t = 0; playing = true; lastNow = 0; syncPlay(); paint(0); kick(); }
  function seek(nt) {
    if (!M) return;
    t = clamp(nt, 0, M.total);
    if (t >= M.total) playing = false;
    lastNow = 0;
    syncPlay();
    paint(t);
    kick();
  }

  /* ── timeline: seret untuk mencari ────────────────────────────────── */
  function initScrub() {
    var sc = E.scrub, wasPlaying = false, pid = null;
    function at(e) {
      var b = sc.getBoundingClientRect();
      return clamp((e.clientX - b.left) / (b.width || 1), 0, 1) * M.total;
    }
    function end() {
      if (!st.drag) return;
      st.drag = false; pid = null;
      R.classList.remove('hx-gesture');
      sC(sc, 'drag', false);
      if (wasPlaying && t < M.total) playing = true;
      lastNow = 0; syncPlay(); kick();
    }
    sc.addEventListener('pointerdown', function (e) {
      if (!M || st.reduced) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (R.classList.contains('hx-gesture')) return;
      st.drag = true; pid = e.pointerId;
      R.classList.add('hx-gesture');
      wasPlaying = playing; playing = false;
      try { sc.setPointerCapture(e.pointerId); } catch (er) { }
      sC(sc, 'drag', true);
      e.preventDefault();
      seek(at(e));
    });
    sc.addEventListener('pointermove', function (e) { if (st.drag && e.pointerId === pid) seek(at(e)); });
    sc.addEventListener('pointerup', end);
    sc.addEventListener('pointercancel', end);
    sc.addEventListener('lostpointercapture', end);
    sc.addEventListener('click', function (e) { e.stopPropagation(); });
    sc.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); seek(t + (e.key === 'ArrowLeft' ? -1 : 1)); }
    });
    st.endDrag = end;
  }

  /* ── buka / tutup ─────────────────────────────────────────────────── */
  var opener = null, resizeT = 0;
  function onKey(e) {
    if (!st.open) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(); return; }
    if (st.reduced) return;
    var tag = e.target && e.target.tagName;
    if ((e.key === ' ' || e.key === 'Spacebar') && tag !== 'BUTTON') { e.preventDefault(); toggle(); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target !== E.scrub) { e.preventDefault(); seek(t + (e.key === 'ArrowLeft' ? -1 : 1)); }
  }
  function onResize() {
    if (!st.open) return;
    clearTimeout(resizeT);
    resizeT = setTimeout(function () { if (st.open) layout(); }, 120);
  }
  function onVis() { if (D.hidden && st.open && playing) { playing = false; syncPlay(); if (st.drag && st.endDrag) st.endDrag(); } }
  function onBlur() { if (st.drag && st.endDrag) st.endDrag(); }
  function onPop() {
    if (st.ignorePop) { st.ignorePop = false; return; }
    if (st.open) close(true);
  }

  function open(key) {
    if (st.open) return false;
    if (R.classList.contains('hx-overlay-open')) return false;   // layar penuh modul lain
    key = key || viewKey();
    var m = buildModel(key);
    if (m.n < 1) return false;
    M = m;
    build();
    st.reduced = HX.reduced();
    fill();
    st.open = true;
    opener = D.activeElement;
    R.classList.add('hx-overlay-open');
    R.classList.add('hx-replay-open');
    sC(ov, 'is-static', st.reduced);
    if (st.reduced) staticView();
    ov.classList.add('on');
    try {
      if (!(history.state && history.state.hxReplay)) { history.pushState({ hxReplay: 1 }, ''); st.pushed = true; }
      else st.pushed = true;
    } catch (e) { st.pushed = false; }
    D.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    D.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    t = 0; playing = !st.reduced; lastNow = 0;
    G = null;
    layout();
    if (st.reduced) { t = M.total; paint(t); }
    syncPlay();
    // dua frame: display:block → transisi masuk
    void ov.offsetWidth;
    ov.classList.add('in');
    try { ov.focus({ preventScroll: true }); } catch (e) { try { ov.focus(); } catch (e2) { } }
    kick();
    return true;
  }
  function close(fromPop) {
    if (!st.open) return;
    st.open = false; playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastNow = 0;
    if (st.drag && st.endDrag) st.endDrag();
    ov.classList.remove('in');
    R.classList.remove('hx-replay-open');
    R.classList.remove('hx-overlay-open');
    D.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    D.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('blur', onBlur);
    setTimeout(function () { if (!st.open && ov) { ov.classList.remove('on'); E.sv.innerHTML = ''; } }, 280);
    if (!fromPop && st.pushed) {
      try {
        if (history.state && history.state.hxReplay) {
          st.ignorePop = true;
          setTimeout(function () { st.ignorePop = false; }, 1200);
          history.back();
        }
      } catch (e) { st.ignorePop = false; }
    }
    st.pushed = false;
    var o = opener; opener = null;
    if (o && o.focus && D.body.contains(o) && o !== D.body) { try { o.focus({ preventScroll: true }); } catch (e) { } }
  }

  /* ── Kurangi Gerak: ringkasan + grafik akhir + daftar ─────────────── */
  function staticView() {
    var m = M, h = '<div class="hxr-end hxr-send">' + endHTML(false) + '</div>';
    if (m.nIn) h += '<div class="hxr-sh">Omset sepanjang hari</div><div class="hxr-schart"></div>';
    h += '<div class="hxr-sh">Semua penjualan · urut jam</div><div class="hxr-sl">';
    m.s.forEach(function (x) {
      h += '<div class="hxr-ln static' + (x.rev >= BIG ? ' big' : '') + (x.ch ? ' ch' : '') + (x.late ? ' late' : '') + '">' + lineHTML(x) + '</div>';
    });
    h += '</div>';
    E.sv.innerHTML = h;
    var b = E.sv.querySelector('[data-a="close"]');
    if (b) b.addEventListener('click', function (e) { e.stopPropagation(); close(); });
  }

  /* ── tombol masuk di kartu target Dashboard ───────────────────────── */
  var btn = null, btnPosKey = '';
  function ensureBtn() {
    var card = D.querySelector('#page-dashboard .goal-card');
    if (!card) return;
    if (!btn || btn.parentNode !== card) {
      btn = card.querySelector('.hxr-btn');
      if (!btn) {
        btn = el('button', 'hxr-btn', '<span class="hxr-bi">' + PLAY + '</span><span class="hxr-bl">Putar ulang<span class="hxr-bx"></span></span>');
        btn.type = 'button';
        btn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
        card.appendChild(btn);
        btnPosKey = '';
      }
    }
    var key = viewKey(), n = dayEntries(key).length, off = viewOff();
    var show = n >= 3;
    if (btn.hidden === show) btn.hidden = !show;
    var x = off === 0 ? ' hari ini' : ' ' + dayShort(key);
    var bx = btn.querySelector('.hxr-bx');
    if (bx.textContent !== x) { bx.textContent = x; btn.setAttribute('aria-label', 'Putar ulang' + x); }
    if (show) placeBtn(card);
  }
  // sejajarkan dengan judul kartu (padding kartu beda di tiap lebar layar).
  // offsetTop/Left tidak terpengaruh transform animasi masuk motion.js.
  function placeBtn(card) {
    var title = card.querySelector('.goal-title');
    if (!title || !btn) return;
    var k = innerWidth + 'x' + (card.clientWidth || 0);
    if (k === btnPosKey) return;
    var ot = title.offsetTop, oh = title.offsetHeight, op = title.offsetParent;
    if (!oh) return;
    // judul bisa berada di dalam induk yang ber-position: jumlahkan sampai kartu
    while (op && op !== card) { ot += op.offsetTop; op = op.offsetParent; }
    if (op !== card) return;
    var cs = getComputedStyle(card), pr = parseFloat(cs.paddingRight) || 16;
    btn.style.top = Math.round(ot + oh / 2 - 14) + 'px';
    btn.style.right = Math.round(pr - 2) + 'px';
    btnPosKey = k;
  }
  function refresh() { try { ensureBtn(); } catch (e) { } }
  HX.on('render', refresh);
  HX.on('ready', refresh);
  HX.on('page', function (d) { if (d && d.id === 'page-dashboard') { btnPosKey = ''; refresh(); } });
  window.addEventListener('resize', function () { btnPosKey = ''; clearTimeout(refresh._t); refresh._t = setTimeout(refresh, 150); });
  window.addEventListener('popstate', onPop);
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', refresh); else refresh();

  /* ── API kecil (tes / modul lain) ─────────────────────────────────── */
  HX.replay = {
    open: open,
    close: function () { close(); },
    seek: function (s) { seek(s); },
    pause: function () { if (playing) toggle(); },
    profile: function (on) { var r = prof; prof = on ? { n: 0, ms: 0 } : null; return r; },
    play: function () { if (!playing) toggle(); },
    state: function () {
      return M ? {
        open: st.open, t: t, total: M.total, playing: playing, n: M.n, nIn: M.nIn, key: M.key, sum: M.sum,
        cross: M.cross >= 0 ? { i: M.cross, tau: M.s[M.cross].tau, time: M.s[M.cross].late ? 'susulan' : hhmm(M.s[M.cross].ts) } : null,
        taus: M.s.map(function (x) { return +x.tau.toFixed(3); }), K: G && G.K, reduced: st.reduced,
        big: M.big ? { sp: M.big.sp, rev: M.big.rev, items: M.big.items, time: M.big.late ? 'susulan' : hhmm(M.big.ts) } : null
      } : { open: st.open };
    }
  };
})();
