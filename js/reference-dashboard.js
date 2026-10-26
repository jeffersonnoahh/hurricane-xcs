/* ══════════════════════════════════════════════════════════════════════
   GRAFIK OMSET HERO — Dashboard "MONTHLY LIVE OMSET" + Monthly Recap.
   HANYA MEMBACA allData. Tidak pernah menulis ke Firebase.

   Yang digambar (SVG dalam satuan piksel layar, jadi mengisi kotak
   .ref-chart penuh di HP maupun desktop):
     - garis omset kumulatif bulan ini (kurva monoton, .ref-chart-line)
       + area (.ref-chart-area) + titik ujung (.ref-chart-dot). Kelas ini
       DIPAKAI js/motion.js / glass.css bagian 16 untuk animasi masuk —
       jangan diganti. pathLength=1000 supaya "menggambar diri" pas.
     - SATU garis hantu putus-putus (.ref-chart-ghost): kurva bulan rekor
       (omset bulanan tertinggi sebelum bulan ini) pada hari yang sama.
       Kalau bulan ini jauh di bawah laju rekor, dipakai bulan lalu.
     - penanda REKOR BULANAN BARU (.ref-chart-record + .ref-chart-badge)
       di titik garis omset melewati TOTAL bulan rekor.
     - ujung "komet" untuk bulan berjalan: cahaya, ekor terang, garis
       "sekarang"; saat ada penjualan (HX 'sale'): cahaya berlari di
       garis, sapuan di area, denyut cincin, label +nominal.
     - batang omset harian tipis di dasar (seperti volume di grafik saham)
     - geser / sentuh grafik = garis bidik + nilai hari itu vs hantu.
   Perubahan data tidak menggambar ulang dari nol: garis MELUNCUR ke nilai
   baru (±0,75 dtk). Digambar ulang hanya kalau tanda tangan data berubah.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const NEAR = 0.85;            // hantu = rekor bila laju bulan ini >= 85% laju rekor
  const HEAD = 1.07;            // ruang di atas titik tertinggi
  const TWEEN_MS = 760;
  const money = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  /* ── format uang singkat (keputusan bersama): 850rb · 189,73jt · 5jt · 2,95M ── */
  const comma = (s) => String(s).replace('.', ',');
  function short(n) {
    n = Math.round(+n || 0);
    const sign = n < 0 ? '-' : '';
    const a = Math.abs(n);
    if (a < 1000) return sign + a;
    if (a < 1e6) { const k = Math.round(a / 1e3); if (k < 1000) return sign + k + 'rb'; }
    if (a < 1e9) {
      if (a % 1e6 === 0) return sign + (a / 1e6) + 'jt';
      const j = (a / 1e6).toFixed(2);
      if (+j < 1000) return sign + comma(j) + 'jt';
    }
    if (a % 1e9 === 0) return sign + (a / 1e9) + 'M';
    return sign + comma((a / 1e9).toFixed(2)) + 'M';
  }
  // label sumbu: angka bulat dari langkah "rapi" -> tanpa nol di belakang (1,5M · 750jt)
  function axisShort(n) {
    const t = (v) => comma(String(+v.toFixed(2)));
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6) return t(n / 1e3) + 'rb';
    if (n < 1e9) return t(n / 1e6) + 'jt';
    return t(n / 1e9) + 'M';
  }
  const pct1 = (p) => (p >= 0 ? '+' : '') + comma(p.toFixed(1)) + '%';

  /* ── data (dibaca dari allData milik app.js) ──────────────────────── */
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  function dayRev(arr) {
    let s = 0;
    if (arr) for (let i = 0; i < arr.length; i++) { const e = arr[i]; if (e) s += (+e.revenue || 0); }
    return s;
  }
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymKey = (y, m) => y + '-' + pad2(m + 1);
  const dim = (y, m) => new Date(y, m + 1, 0).getDate();
  function curve(y, m, upTo) {
    const D = data(), out = [], pre = ymKey(y, m) + '-';
    let c = 0;
    for (let d = 1; d <= upTo; d++) { c += dayRev(D[pre + pad2(d)]); out.push(c); }
    return out;
  }
  // total per bulan — dihitung ulang hanya kalau app.js mengganti objek allData
  let totRef = null, totMap = null;
  function totals() {
    const D = data();
    if (totRef === D && totMap) return totMap;
    const t = {};
    for (const k in D) { if (k.length >= 10) { const ym = k.slice(0, 7); t[ym] = (t[ym] || 0) + dayRev(D[k]); } }
    totRef = D; totMap = t;
    return t;
  }

  /* model satu bulan: kurva, hantu, titik rekor. sig = tanda tangan data. */
  function model(y, m) {
    const now = new Date();
    const live = y === now.getFullYear() && m === now.getMonth();
    const days = dim(y, m);
    const end = live ? Math.min(now.getDate(), days) : days;
    const vals = curve(y, m, end);
    const ym = ymKey(y, m);
    const T = totals();
    let rec = null;
    for (const k in T) if (k < ym && T[k] > 0 && (!rec || T[k] > rec.total)) rec = { key: k, total: T[k] };
    const pd = new Date(y, m - 1, 1), pk = ymKey(pd.getFullYear(), pd.getMonth());
    const prev = T[pk] > 0 ? { key: pk, total: T[pk] } : null;
    const at = vals.length ? vals[vals.length - 1] : 0;
    const mk = (o, kind) => {
      const gy = +o.key.slice(0, 4), gm = +o.key.slice(5, 7) - 1;
      return { kind, key: o.key, m: gm, total: o.total, vals: curve(gy, gm, Math.min(end, dim(gy, gm))) };
    };
    let ghost = null;
    if (rec) {
      const g = mk(rec, 'record'), gAt = g.vals.length ? g.vals[g.vals.length - 1] : 0;
      if (at >= NEAR * gAt || !prev) ghost = g;
    }
    if (!ghost && prev) ghost = mk(prev, rec && rec.key === prev.key ? 'record' : 'prev');
    let cross = null;
    if (rec && at > rec.total) {
      for (let i = 0; i < vals.length; i++) if (vals[i] > rec.total) { cross = { i, total: rec.total, key: rec.key, m: +rec.key.slice(5, 7) - 1 }; break; }
    }
    const sig = [ym, live ? 1 : 0, vals.join(','),
      ghost ? ghost.key + ghost.kind + ghost.vals.length + ':' + Math.round(ghost.vals[ghost.vals.length - 1] || 0) : '-',
      cross ? cross.i + cross.key : '-'].join('|');
    return { y, m, live, end, vals, ghost, cross, sig };
  }

  /* ── geometri ─────────────────────────────────────────────────────── */
  // langkah sumbu rapi (1·2·2,5·5 × 10^k) dengan paling banyak `max` garis
  function ticksFor(dmax, max) {
    if (!(dmax > 0)) return [];
    const e = Math.floor(Math.log10(dmax)) - 2;
    for (let p = e; p < e + 6; p++) {
      for (const b of [1, 2, 2.5, 5]) {
        const step = b * Math.pow(10, p);
        if (Math.floor(dmax / step) <= max) {
          const out = [];
          for (let v = step; v <= dmax + 1e-6; v += step) out.push(Math.round(v));
          return out;
        }
      }
    }
    return [];
  }
  function dmaxOf(vals, gvals) {
    let mx = 0;
    for (const v of vals) if (v > mx) mx = v;
    if (gvals) for (const v of gvals) if (v > mx) mx = v;
    return mx > 0 ? mx * HEAD : 1;
  }
  function frame(st) {
    const cp = st.compact, W = st.W, H = st.H;
    const lane = cp ? 20 : 26;
    const top = lane + (cp ? 4 : 6), bottom = cp ? 17 : 22, right = cp ? 10 : 14;
    return { W, H, lane, top, base: H - bottom, innerW: Math.max(10, W - right) };
  }
  function points(F, vals, n, dmax) {
    const ih = F.base - F.top;
    const Y = (v) => F.base - (v / dmax) * ih;
    if (n <= 1) return vals.length ? [[0, F.base], [F.innerW, Y(vals[0])]] : [];
    return vals.map((v, i) => [i / (n - 1) * F.innerW, Y(v)]);
  }
  // kurva monoton (seperti d3.curveMonotoneX): melewati setiap titik data,
  // tidak pernah melengkung di atas/bawah data
  function tangents(p) {
    const n = p.length, t = new Array(n).fill(0);
    if (n < 2) return t;
    const s = [];
    for (let i = 0; i < n - 1; i++) { const h = p[i + 1][0] - p[i][0]; s.push(h ? (p[i + 1][1] - p[i][1]) / h : 0); }
    for (let i = 1; i < n - 1; i++) {
      const h0 = p[i][0] - p[i - 1][0], h1 = p[i + 1][0] - p[i][0], s0 = s[i - 1], s1 = s[i];
      const q = (s0 * h1 + s1 * h0) / ((h0 + h1) || 1);
      t[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(q)) || 0;
    }
    t[0] = (3 * s[0] - t[1]) / 2; t[n - 1] = (3 * s[n - 2] - t[n - 2]) / 2;
    if (n === 2) { t[0] = s[0]; t[1] = s[0]; }
    return t;
  }
  const f1 = (v) => Math.round(v * 10) / 10;
  function curvePath(p) {
    if (!p.length) return '';
    let d = 'M' + f1(p[0][0]) + ',' + f1(p[0][1]);
    if (p.length === 1) return d;
    const t = tangents(p);
    for (let i = 0; i < p.length - 1; i++) {
      const h = (p[i + 1][0] - p[i][0]) / 3;
      d += 'C' + f1(p[i][0] + h) + ',' + f1(p[i][1] + t[i] * h) + ' ' + f1(p[i + 1][0] - h) + ',' + f1(p[i + 1][1] - t[i + 1] * h) + ' ' + f1(p[i + 1][0]) + ',' + f1(p[i + 1][1]);
    }
    return d;
  }
  // titik tepat di kurva tempat garis omset melewati level `yy`
  function crossPoint(p, i, yy) {
    if (i <= 0 || i >= p.length) return p[Math.max(0, Math.min(p.length - 1, i))];
    const t = tangents(p), a = p[i - 1], b = p[i], h = (b[0] - a[0]) / 3;
    const c1 = [a[0] + h, a[1] + t[i - 1] * h], c2 = [b[0] - h, b[1] - t[i] * h];
    const at = (u) => {
      const v = 1 - u;
      return [v * v * v * a[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * b[0],
              v * v * v * a[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * b[1]];
    };
    let lo = 0, hi = 1;
    for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (at(mid)[1] > yy) lo = mid; else hi = mid; }
    return at((lo + hi) / 2);
  }

  /* ── keadaan per grafik ───────────────────────────────────────────── */
  const charts = {
    dash: { key: 'dash', area: 'refRevenueGradient', page: 'page-dashboard' },
    month: { key: 'month', area: 'refMonthlyGradient', page: 'page-monthly' }
  };
  const reduced = () => (window.HX && HX.reduced) ? HX.reduced() : !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const pageActive = (st) => { const p = $(st.page); return !!(p && p.classList.contains('active')); };

  function measure(st) {
    if (!st.W || !st.H) { st.W = Math.round(st.el.clientWidth); st.H = Math.round(st.el.clientHeight); }
    st.compact = st.W < 520;
  }

  function structSig(st, M, dmax) {
    const cp = st.W < 520;
    return [M.y, M.m, M.live ? 1 : 0, M.vals.length, M.ghost ? M.ghost.key + M.ghost.kind + M.ghost.vals.length : '-',
      M.cross ? M.cross.i + M.cross.key : '-', ticksFor(dmax, cp ? 3 : 4).join(','), st.W, st.H].join('|');
  }
  // bisa meluncur (tween) dari keadaan sekarang ke model baru?
  function baseSig(st, M) {
    return [M.y, M.m, M.live ? 1 : 0, M.vals.length, M.ghost ? M.ghost.key + M.ghost.vals.length : '-', st.W, st.H].join('|');
  }

  function build(st, M, dmax) {
    const id = st.key, W = st.W, H = st.H, cp = st.compact, n = M.vals.length;
    const F = frame(st);
    const ticks = ticksFor(dmax, cp ? 3 : 4);
    const mShort = new Date(M.y, M.m, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Omset kumulatif ' + BULAN[M.m] + ' ' + M.y + '">';
    s += '<defs>' +
      '<linearGradient id="' + st.area + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#30d158" stop-opacity=".34"></stop><stop offset=".6" stop-color="#30d158" stop-opacity=".09"></stop><stop offset="1" stop-color="#30d158" stop-opacity="0"></stop></linearGradient>' +
      '<linearGradient id="hxLine-' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + F.innerW + '" y2="0"><stop offset="0" stop-color="#1c8a43"></stop><stop offset=".55" stop-color="#30d158"></stop><stop offset="1" stop-color="' + (M.live ? '#a6ffc2' : '#5be37f') + '"></stop></linearGradient>' +
      '<linearGradient id="hxTail-' + id + '" class="ref-chart-tailgrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#eafff1" stop-opacity="0"></stop><stop offset="1" stop-color="#f4fff8" stop-opacity=".95"></stop></linearGradient>' +
      '<radialGradient id="hxGlow-' + id + '"><stop offset="0" stop-color="#9dffbb" stop-opacity=".62"></stop><stop offset=".35" stop-color="#30d158" stop-opacity=".26"></stop><stop offset="1" stop-color="#30d158" stop-opacity="0"></stop></radialGradient>' +
      '<linearGradient id="hxNow-' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#30d158" stop-opacity=".5"></stop><stop offset="1" stop-color="#30d158" stop-opacity="0"></stop></linearGradient>' +
      '<linearGradient id="hxSweep-' + id + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d8ffe4" stop-opacity="0"></stop><stop offset=".5" stop-color="#d8ffe4" stop-opacity=".30"></stop><stop offset="1" stop-color="#d8ffe4" stop-opacity="0"></stop></linearGradient>' +
      '<clipPath id="hxClip-' + id + '"><path class="ref-chart-clip"></path></clipPath>' +
      '</defs>';
    s += '<line class="ref-chart-grid ref-chart-base"></line>';
    ticks.forEach(() => { s += '<line class="ref-chart-grid ref-chart-tick"></line>'; });
    if (n) s += '<path class="ref-chart-area"></path>';
    if (n > 1) {
      s += '<g class="ref-chart-vols">';
      for (let i = 0; i < n; i++) s += '<rect style="--i:' + i + '"' + (M.live && i === n - 1 ? ' class="is-today"' : '') + '></rect>';
      s += '</g>';
    }
    if (n && M.live) s += '<g clip-path="url(#hxClip-' + id + ')"><rect class="ref-chart-sweep" fill="url(#hxSweep-' + id + ')"></rect></g>';
    ticks.forEach((t) => { s += '<text class="ref-chart-label ref-chart-ylabel" x="0">' + axisShort(t) + '</text>'; });
    if (n) {
      const ix = [...new Set([0, Math.floor((n - 1) / 3), Math.floor((n - 1) * 2 / 3), n - 1])];
      ix.forEach((i, k) => {
        const anchor = n === 1 ? 'end' : k === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle');
        s += '<text class="ref-chart-label ref-chart-xlabel" data-i="' + i + '" text-anchor="' + anchor + '" y="' + (H - 4) + '">' + (i + 1) + ' ' + mShort + '</text>';
      });
    }
    if (M.ghost && M.ghost.vals.length) s += '<path class="ref-chart-ghost"></path><circle class="ref-chart-ghost-end" r="' + (cp ? 2.2 : 2.6) + '"></circle>';
    if (n && M.live) s += '<line class="ref-chart-now" stroke="url(#hxNow-' + id + ')"></line>';
    if (n) s += '<path class="ref-chart-line" pathLength="1000" style="stroke:url(#hxLine-' + id + ')"></path>';
    if (n && M.live) s += '<path class="ref-chart-tail" stroke="url(#hxTail-' + id + ')"></path><path class="ref-chart-runner"></path>';
    if (M.cross) s += '<g class="ref-chart-record"><line class="ref-chart-record-stem"></line><path class="ref-chart-record-mark"></path></g>';
    if (n) s += '<g class="ref-chart-scrub"><line class="ref-chart-scrub-line"></line>' + (M.ghost ? '<circle class="ref-chart-scrub-gdot" r="3"></circle>' : '') + '<circle class="ref-chart-scrub-dot" r="4.2"></circle></g>';
    if (n && M.live) s += '<circle class="ref-chart-glow" r="' + (cp ? 15 : 19) + '" fill="url(#hxGlow-' + id + ')"></circle><circle class="ref-chart-ring" r="5"></circle><circle class="ref-chart-ring" r="5"></circle>';
    if (n) s += '<circle class="ref-chart-dot" r="' + (cp ? 3.6 : 4) + '"></circle>';
    s += '</svg><div class="ref-chart-ov" aria-hidden="true">';
    if (M.ghost && M.ghost.vals.length) s += '<span class="ref-chart-tag' + (M.ghost.kind === 'record' ? ' is-record' : '') + '">' + (M.ghost.kind === 'record' ? 'Rekor ' + BULAN[M.ghost.m] : BLN[M.ghost.m]) + '</span>';
    if (M.cross) {
      s += '<span class="ref-chart-badge"><i></i><b>REKOR BULANAN BARU</b>' +
        (cp ? '' : '<em>' + BULAN[M.cross.m] + ' ' + short(M.cross.total) + ' terlampaui</em>') + '</span>';
    }
    s += '<div class="ref-chart-tip"></div></div>';

    st.el.innerHTML = s;
    st.el.classList.toggle('is-live', !!M.live);
    st.el.classList.toggle('is-compact', cp);
    const q = (sel) => st.el.querySelector(sel), qa = (sel) => Array.prototype.slice.call(st.el.querySelectorAll(sel));
    st.nodes = {
      svg: q('svg'), base: q('.ref-chart-base'), grid: qa('.ref-chart-tick'), ylab: qa('.ref-chart-ylabel'), xlab: qa('.ref-chart-xlabel'),
      area: q('.ref-chart-area'), clip: q('.ref-chart-clip'), vols: qa('.ref-chart-vols rect'), sweep: q('.ref-chart-sweep'),
      ghost: q('.ref-chart-ghost'), gend: q('.ref-chart-ghost-end'), now: q('.ref-chart-now'), line: q('.ref-chart-line'),
      tail: q('.ref-chart-tail'), tailG: q('.ref-chart-tailgrad'), runner: q('.ref-chart-runner'),
      rec: q('.ref-chart-record'), stem: q('.ref-chart-record-stem'), mark: q('.ref-chart-record-mark'),
      scrub: q('.ref-chart-scrub'), sline: q('.ref-chart-scrub-line'), sdot: q('.ref-chart-scrub-dot'), sgdot: q('.ref-chart-scrub-gdot'),
      glow: q('.ref-chart-glow'), rings: qa('.ref-chart-ring'), dot: q('.ref-chart-dot'),
      tag: q('.ref-chart-tag'), badge: q('.ref-chart-badge'), tip: q('.ref-chart-tip'), ov: q('.ref-chart-ov')
    };
    st.ticks = ticks;
    st.tagW = null;
    st.M = M;
    st.struct = structSig(st, M, dmax);
    st.base = baseSig(st, M);
  }

  // tulis semua posisi untuk nilai `cur` = {vals, gvals, dmax}
  function place(st, cur) {
    const N = st.nodes, M = st.M, F = frame(st), n = M.vals.length;
    const set = (el, a) => { if (el) for (const k in a) el.setAttribute(k, a[k]); };
    const ih = F.base - F.top, Y = (v) => F.base - (v / cur.dmax) * ih;
    set(N.base, { x1: 0, x2: F.W, y1: F.base, y2: F.base });
    st.ticks.forEach((t, k) => {
      const y = f1(Y(t));
      set(N.grid[k], { x1: 0, x2: F.W, y1: y, y2: y });
      set(N.ylab[k], { y: f1(y - 4) });
    });
    const p = points(F, cur.vals, n, cur.dmax);
    st.pts = p;
    if (!p.length) return;
    const head = p[p.length - 1];
    const lineD = curvePath(p);
    set(N.line, { d: lineD });
    const areaD = lineD + 'L' + f1(head[0]) + ',' + F.base + 'L' + f1(p[0][0]) + ',' + F.base + 'Z';
    set(N.area, { d: areaD });
    set(N.clip, { d: areaD });
    N.xlab.forEach((el) => { const i = +el.getAttribute('data-i'); el.setAttribute('x', f1(n <= 1 ? F.innerW : i / (n - 1) * F.innerW)); });
    // batang omset harian
    if (N.vols.length) {
      let mx = 0; const dl = cur.vals.map((v, i) => { const d = Math.max(0, v - (i ? cur.vals[i - 1] : 0)); if (d > mx) mx = d; return d; });
      const bw = Math.max(1.5, Math.min(7, F.innerW / n * 0.38)), hmax = ih * 0.2;
      N.vols.forEach((r, i) => {
        const h = mx > 0 ? Math.max(dl[i] > 0 ? 1.5 : 0, dl[i] / mx * hmax) : 0;
        set(r, { x: f1(p[i][0] - (i === 0 ? 0 : i === n - 1 ? bw : bw / 2)), y: f1(F.base - h), width: f1(bw), height: f1(h) });
      });
    }
    // hantu
    if (N.ghost) {
      const gp = points(F, cur.gvals, n, cur.dmax);
      set(N.ghost, { d: curvePath(gp) });
      const ge = gp[gp.length - 1];
      set(N.gend, { cx: f1(ge[0]), cy: f1(ge[1]) });
      if (N.tag) {
        // label di bawah ujung hantu kalau hantu di bawah garis omset, di atas kalau di atasnya —
        // diukur dari titik hantu terendah/tertinggi selebar label, supaya tidak tertabrak garisnya
        const below = ge[1] >= head[1] - 2;
        if (st.tagW == null) st.tagW = N.tag.offsetWidth || N.tag.textContent.length * (st.compact ? 6 : 7.4);
        const xl = ge[0] - 6 - st.tagW;
        let lo = ge[1], hi = ge[1];
        for (let i = gp.length - 1; i >= 0; i--) {
          let yv = gp[i][1];
          if (gp[i][0] < xl) {   // ruas yang memotong tepi kiri label: interpolasi
            const r = gp[i + 1];
            if (!r) break;
            yv = gp[i][1] + (r[1] - gp[i][1]) * ((xl - gp[i][0]) / ((r[0] - gp[i][0]) || 1));
          }
          if (yv > lo) lo = yv;
          if (yv < hi) hi = yv;
          if (gp[i][0] < xl) break;
        }
        let ty = below ? lo + 5 : hi - 5 - (st.compact ? 10 : 12);
        ty = Math.max(F.lane, Math.min(F.base - (st.compact ? 12 : 14), ty));
        N.tag.style.right = f1(F.W - ge[0] + 6) + 'px';
        N.tag.style.top = f1(ty) + 'px';
      }
    }
    // kepala
    set(N.dot, { cx: f1(head[0]), cy: f1(head[1]) });
    if (N.glow) set(N.glow, { cx: f1(head[0]), cy: f1(head[1]) });
    N.rings.forEach((r) => set(r, { cx: f1(head[0]), cy: f1(head[1]) }));
    if (N.now) set(N.now, { x1: f1(head[0]), x2: f1(head[0]), y1: f1(head[1] + 6), y2: F.base });
    if (N.tail) {
      set(N.tail, { d: lineD });
      const len = st.compact ? 46 : 78;
      set(N.tailG, { x1: f1(head[0] - len), x2: f1(head[0]) });
      set(N.runner, { d: lineD });
    }
    if (N.sweep) set(N.sweep, { x: -F.W * 0.24, y: F.top - 6, width: f1(F.W * 0.24), height: f1(F.base - F.top + 6) });
    // rekor
    if (N.rec && M.cross) {
      const yy = Y(M.cross.total);
      const c = crossPoint(p, n <= 1 ? 1 : M.cross.i, yy), r = st.compact ? 4 : 4.8;
      set(N.mark, { d: 'M' + f1(c[0]) + ',' + f1(c[1] - r) + 'L' + f1(c[0] + r) + ',' + f1(c[1]) + 'L' + f1(c[0]) + ',' + f1(c[1] + r) + 'L' + f1(c[0] - r) + ',' + f1(c[1]) + 'Z' });
      st.crossAt = c;
      placeBadge(st, F, c, head);
    }
    if (st.scrubI != null) scrubTo(st, st.scrubI);
  }

  function placeBadge(st, F, c, head) {
    const N = st.nodes, b = N.badge;
    if (!b) return;
    const bh = st.compact ? 17 : 20, laneTop = Math.max(0, (F.lane - bh) / 2);
    const estW = st.compact ? 118 : 262;
    let left, right = null;
    if (c[0] + 12 > F.W - estW / 2) right = Math.max(0, F.W - Math.max(c[0], head[0]) - 6);
    else left = Math.max(0, c[0] - estW / 2);
    b.style.top = f1(laneTop) + 'px';
    if (right != null) { b.style.right = f1(right) + 'px'; b.style.left = 'auto'; }
    else { b.style.left = f1(left) + 'px'; b.style.right = 'auto'; }
    const y1 = laneTop + bh, y2 = c[1] - 6;
    if (N.stem) {
      if (y2 - y1 > 3) N.stem.setAttribute('x1', f1(c[0])), N.stem.setAttribute('x2', f1(c[0])), N.stem.setAttribute('y1', f1(y1)), N.stem.setAttribute('y2', f1(y2)), N.stem.style.display = '';
      else N.stem.style.display = 'none';
    }
  }

  /* ── garis bidik (geser / sentuh) ─────────────────────────────────── */
  function scrubTo(st, i) {
    const N = st.nodes, M = st.M, p = st.pts, cur = st.cur;
    if (!N || !N.scrub || !p || !p.length || !cur) return;
    const n = M.vals.length;
    i = Math.max(0, Math.min(n - 1, i));
    st.scrubI = i;
    const F = frame(st), pt = n <= 1 ? p[p.length - 1] : p[i];
    N.sline.setAttribute('x1', f1(pt[0])); N.sline.setAttribute('x2', f1(pt[0]));
    N.sline.setAttribute('y1', F.lane); N.sline.setAttribute('y2', F.base);
    N.sdot.setAttribute('cx', f1(pt[0])); N.sdot.setAttribute('cy', f1(pt[1]));
    const v = cur.vals[i] || 0, prevV = i ? cur.vals[i - 1] : 0;
    let gtxt = '';
    if (N.sgdot && cur.gvals && i < cur.gvals.length) {
      const ih = F.base - F.top, gy = F.base - (cur.gvals[i] / cur.dmax) * ih;
      N.sgdot.setAttribute('cx', f1(pt[0])); N.sgdot.setAttribute('cy', f1(gy)); N.sgdot.style.display = '';
      const g = cur.gvals[i], d = g > 0 ? (v - g) / g * 100 : null;
      gtxt = '<span class="g">' + (M.ghost.kind === 'record' ? 'Rekor ' : '') + BLN[M.ghost.m] + ' ' + short(g) + '</span>' +
        (d == null ? '' : '<span class="' + (d >= 0 ? 'up' : 'dn') + '">' + pct1(d) + '</span>');
    } else if (N.sgdot) N.sgdot.style.display = 'none';
    const today = M.live && i === n - 1;
    N.tip.innerHTML = '<span class="d">' + (today ? 'Hari ini' : (i + 1) + ' ' + BLN[M.m]) + '</span>' +
      '<span class="v">' + short(v) + '</span><span class="day">+' + short(v - prevV) + '</span>' +
      (gtxt ? '<span class="br"></span>' + gtxt : '');
    const leftSide = pt[0] > F.W / 2;
    N.tip.style.top = '0px';
    if (leftSide) { N.tip.style.left = 'auto'; N.tip.style.right = f1(F.W - pt[0] + 10) + 'px'; }
    else { N.tip.style.right = 'auto'; N.tip.style.left = f1(pt[0] + 10) + 'px'; }
    st.el.classList.add('is-scrub');
  }
  function scrubOff(st) {
    st.scrubI = null;
    if (st.el) st.el.classList.remove('is-scrub');
  }
  function bindScrub(st) {
    const el = st.el;
    if (el.__refScrub) return;
    el.__refScrub = true;
    let raf = 0, lastX = 0, hideT = 0, active = false;
    const idxAt = (clientX) => {
      const r = el.getBoundingClientRect(), n = st.M ? st.M.vals.length : 0;
      if (!n || !r.width) return null;
      const F = frame(st), x = (clientX - r.left) * (st.W / r.width);
      return n <= 1 ? 0 : Math.round(Math.max(0, Math.min(1, x / F.innerW)) * (n - 1));
    };
    const go = () => { raf = 0; const i = idxAt(lastX); if (i != null) scrubTo(st, i); };
    const move = (e) => {
      if (e.pointerType !== 'mouse' && !active) return;
      lastX = e.clientX; clearTimeout(hideT);
      if (!raf) raf = requestAnimationFrame(go);
    };
    const end = (e) => {
      active = false;
      clearTimeout(hideT);
      hideT = setTimeout(() => scrubOff(st), e && e.pointerType === 'mouse' ? 0 : 1400);
    };
    el.addEventListener('pointerdown', (e) => { active = true; lastX = e.clientX; clearTimeout(hideT); if (!raf) raf = requestAnimationFrame(go); });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') end(e); });
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') end(e); });
  }

  /* ── gambar / perbarui ────────────────────────────────────────────── */
  function cancelTween(st) {
    if (st.raf) cancelAnimationFrame(st.raf);
    clearTimeout(st.tmo);
    st.raf = 0; st.tweening = false;
  }
  function lerpArr(a, b, e) { return b.map((v, i) => (a[i] == null ? v : a[i] + (v - a[i]) * e)); }

  function draw(st, M, allowTween) {
    if (!st.el) return;
    measure(st);
    if (!st.W || !st.H) return;
    const sig = M.sig + '|' + st.W + 'x' + st.H;
    if (sig === st.sig) return;
    st.sig = sig;
    const gvals = M.ghost ? M.ghost.vals : null;
    const target = { vals: M.vals.slice(), gvals: gvals ? gvals.slice() : null, dmax: dmaxOf(M.vals, gvals) };
    const vis = pageActive(st) && !document.hidden;
    const page = $(st.page);
    const canTween = allowTween && vis && st.wasVisible && st.cur && st.nodes && !reduced() &&
      !(page && page.classList.contains('lg-enter')) && st.base === baseSig(st, M) &&
      !(window.HX && HX.tier === 'low') && window.requestAnimationFrame;
    const sameMonth = !!(st.M && st.M.y === M.y && st.M.m === M.m);
    const hadCross = sameMonth ? !!st.M.cross : null;   // null = bulan lain (ganti bulan)
    if (canTween) {
      cancelTween(st);
      const from = st.cur, t0 = performance.now();
      st.tweening = true;
      const done = () => {
        cancelTween(st);
        st.cur = target;
        if (structSig(st, M, target.dmax) !== st.struct) rebuild(st, M, target, hadCross);
        else { st.M = M; place(st, target); }
        flushFx(st);
      };
      const step = (now) => {
        const t = Math.max(0, Math.min(1, (now - t0) / TWEEN_MS)), e = 1 - Math.pow(1 - t, 3);
        st.cur = { vals: lerpArr(from.vals, target.vals, e), gvals: target.gvals ? lerpArr(from.gvals || [], target.gvals, e) : null, dmax: from.dmax + (target.dmax - from.dmax) * e };
        place(st, st.cur);
        if (t < 1) st.raf = requestAnimationFrame(step); else done();
      };
      st.raf = requestAnimationFrame(step);
      st.tmo = setTimeout(() => { if (st.tweening) done(); }, TWEEN_MS + 500);
      return;
    }
    cancelTween(st);
    st.cur = target;
    rebuild(st, M, target, hadCross);
    flushFx(st);
  }
  function rebuild(st, M, target, hadCross) {
    if (structSig(st, M, target.dmax) !== st.struct || !st.nodes) build(st, M, target.dmax);
    else st.M = M;
    place(st, target);
    // rekor yang muncul saat halaman sudah terbuka (bukan saat masuk halaman):
    //   ref-rec-new   = rekor PECAH barusan (setelah denyut penjualan)
    //   ref-rec-quick = pindah ke bulan yang punya rekor (Monthly Recap ‹ ›)
    const page = $(st.page);
    const cls = hadCross === false ? 'ref-rec-new' : hadCross === null ? 'ref-rec-quick' : '';
    st.el.classList.remove('ref-rec-new', 'ref-rec-quick');   // gambar ulang berikutnya tidak mengulang
    clearTimeout(st.recT);
    if (M.cross && cls && st.drawnOnce && !reduced() && !(page && page.classList.contains('lg-enter'))) {
      void st.el.offsetWidth; st.el.classList.add(cls);
      if (cls === 'ref-rec-new') st.recNewAt = performance.now();
      st.recT = setTimeout(() => st.el.classList.remove(cls), cls === 'ref-rec-new' ? 3200 : 2000);
    }
    st.drawnOnce = true;
    if (!st.el.__refScrub) bindScrub(st);
  }

  /* ── efek penjualan baru ──────────────────────────────────────────── */
  let fxSum = 0, fxCount = 0, fxQueued = false;
  function onSale(s) {
    if (!s) return;
    fxSum += (+s.revenue || 0); fxCount++;
    if (fxQueued) return;
    fxQueued = true;
    Promise.resolve().then(() => {
      fxQueued = false;
      const sum = fxSum, cnt = fxCount;
      fxSum = 0; fxCount = 0;
      [charts.dash, charts.month].forEach((st) => {
        if (!st.el || !st.M || !st.M.live || !pageActive(st) || document.hidden) return;
        st.fx = { sum: (st.fx ? st.fx.sum : 0) + sum, n: (st.fx ? st.fx.n : 0) + cnt };
        if (!st.tweening) flushFx(st);
      });
    });
  }
  function flushFx(st) {
    const fx = st.fx;
    st.fx = null;
    if (!fx || !st.nodes || !st.M || !st.M.live || !st.pts || !st.pts.length) return;
    const N = st.nodes, canAnim = !!(N.dot && N.dot.animate);
    if (!canAnim) return;
    const head = st.pts[st.pts.length - 1];
    if (reduced()) {   // tanpa gerak: cahaya kepala hanya meredup-terang sebentar
      if (N.glow) N.glow.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 900, easing: 'ease-in-out' });
      return;
    }
    const lite = window.HX && HX.tier === 'low';
    const T = lite ? 0 : 820;   // cahaya tiba di kepala
    // 1. cahaya berlari di sepanjang garis menuju kepala
    if (!lite && N.runner && N.runner.getTotalLength) {
      let L = 0;
      try { L = N.runner.getTotalLength(); } catch (e) { L = 0; }
      if (L > 20) {
        const D = Math.min(st.compact ? 70 : 130, L * 0.22);
        N.runner.style.strokeDasharray = D + ' ' + (L + D);
        N.runner.animate([
          { strokeDashoffset: D, opacity: 0 },
          { strokeDashoffset: D - (L * 0.12), opacity: 1, offset: 0.12 },
          { strokeDashoffset: -(L - D) + 2, opacity: 1, offset: 0.9 },
          { strokeDashoffset: -(L - D), opacity: 0 }
        ], { duration: T + 120, easing: 'cubic-bezier(.5,0,.3,1)' });
      }
    }
    // 2. sapuan cahaya di area
    if (!lite && N.sweep) {
      const bw = st.W * 0.24;
      N.sweep.animate([
        { transform: 'translateX(0px)', opacity: 0 },
        { transform: 'translateX(' + f1((head[0] + bw) * 0.18) + 'px)', opacity: 1, offset: 0.18 },
        { transform: 'translateX(' + f1((head[0] + bw) * 0.82) + 'px)', opacity: 1, offset: 0.82 },
        { transform: 'translateX(' + f1(head[0] + bw) + 'px)', opacity: 0 }
      ], { duration: T + 260, easing: 'cubic-bezier(.45,0,.35,1)' });
    }
    // 3. kepala menyala + 2 cincin denyut
    if (N.glow) N.glow.animate([
      { transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.2)', opacity: 1, offset: 0.22 }, { transform: 'scale(1)', opacity: 1 }
    ], { duration: 1200, delay: T, easing: 'cubic-bezier(.2,.7,.3,1)' });
    N.dot.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.6)', offset: 0.25 }, { transform: 'scale(1)' }],
      { duration: 700, delay: T, easing: 'cubic-bezier(.34,1.45,.64,1)' });
    N.rings.forEach((r, k) => r.animate([
      { transform: 'scale(.7)', opacity: 0.95 }, { transform: 'scale(' + (st.compact ? 5 : 6.2) + ')', opacity: 0 }
    ], { duration: 1150, delay: T + k * 210, easing: 'cubic-bezier(.15,.65,.3,1)' }));
    // 4. "+nominal" muncul di jalur atas, sebentar menggantikan label rekor
    // saat rekor baru saja pecah, lencana REKOR yang bicara — tanpa label nominal
    const recJust = st.recNewAt && performance.now() - st.recNewAt < 3000;
    if (fx.sum > 0 && N.ov && !recJust) {
      const F = frame(st);
      const old = N.ov.querySelector('.ref-chart-float');
      if (old) old.remove();
      const fl = document.createElement('span');
      fl.className = 'ref-chart-float';
      fl.textContent = '+' + short(fx.sum) + (fx.n > 1 ? ' · ' + fx.n + ' order' : '');
      fl.style.right = f1(Math.max(0, F.W - head[0] - 6)) + 'px';
      fl.style.top = f1(Math.max(0, (F.lane - (st.compact ? 17 : 20)) / 2)) + 'px';
      N.ov.appendChild(fl);
      const a = fl.animate([
        { opacity: 0, transform: 'translate3d(0,8px,0) scale(.92)' },
        { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', offset: 0.14 },
        { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', offset: 0.8 },
        { opacity: 0, transform: 'translate3d(0,-6px,0) scale(1)' }
      ], { duration: 2300, delay: Math.max(0, T - 160), easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
      [N.badge, N.stem].forEach((el) => { if (el) el.animate([{ opacity: 1 }, { opacity: 0, offset: 0.1 }, { opacity: 0, offset: 0.86 }, { opacity: 1 }],
        { duration: 2300, delay: Math.max(0, T - 160), easing: 'ease' }); });
      a.onfinish = () => fl.remove();
    }
  }

  /* ── dashboard ────────────────────────────────────────────────────── */
  function dashChart() {
    const hero = $('homeOmsetHero');
    if (!hero) return null;
    let chart = hero.querySelector('.ref-chart');
    if (!chart) {
      chart = document.createElement('div');
      chart.className = 'ref-chart';
      hero.appendChild(chart);
      const foot = document.createElement('div');
      foot.className = 'ref-hero-foot';
      hero.appendChild(foot);
    }
    if (charts.dash.el !== chart) { charts.dash.el = chart; observe(charts.dash); }
    return chart;
  }
  function sameDayLabel(prevDate, upToDay) {
    const d = Math.min(upToDay, dim(prevDate.getFullYear(), prevDate.getMonth()));
    return '1–' + d + ' ' + prevDate.toLocaleDateString('en-US', { month: 'short' });
  }
  function compareHtml(M) {
    const current = M.vals.length ? M.vals[M.vals.length - 1] : 0;
    const prevDate = new Date(M.y, M.m - 1, 1);
    const upTo = M.vals.length ? M.vals.length : 1;
    const pv = curve(prevDate.getFullYear(), prevDate.getMonth(), Math.min(upTo, dim(prevDate.getFullYear(), prevDate.getMonth())));
    const previous = pv.length ? pv[pv.length - 1] : 0;
    const delta = current - previous, pct = previous > 0 ? delta / previous * 100 : null;
    return '<span class="' + (delta >= 0 ? 'ref-compare-positive' : 'ref-compare-negative') + '">' + (pct === null ? '—' : pct1(pct)) + '</span>' +
      '<span>vs ' + sameDayLabel(prevDate, upTo) + ' &nbsp; ' + (delta >= 0 ? '↑' : '↓') + ' ' + money(Math.abs(delta)) + '</span>';
  }
  function renderReferenceDashboard(allowTween) {
    if (typeof vOff === 'undefined' || typeof od !== 'function') return;
    const chart = dashChart();
    if (!chart) return;
    const st = charts.dash;
    const viewed = od(vOff);
    const vis = pageActive(st);
    // Sub-judul selalu ditulis (renderAll menimpanya tiap kali), grafik hanya bila tampak
    const M = model(viewed.getFullYear(), viewed.getMonth());
    const sub = $('liveOmsetSub');
    if (sub) { const h = compareHtml(M); if (sub.__refHtml !== h || !sub.firstElementChild) { sub.innerHTML = h; sub.__refHtml = h; } }
    const foot = st.el.parentNode.querySelector('.ref-hero-foot');
    const ft = viewed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' · live total omset';
    if (foot && foot.textContent !== ft) foot.textContent = ft;
    if (vis) draw(st, M, allowTween);
    st.wasVisible = vis && !document.hidden;
  }

  /* ── Monthly Recap ────────────────────────────────────────────────── */
  function renderReferenceMonthly(allowTween) {
    const hero = $('monthlyOmsetHero');
    if (!hero || typeof mYear === 'undefined' || typeof mMonth === 'undefined') return;
    const st = charts.month;
    const M = model(mYear, mMonth);
    const current = M.vals.length ? M.vals[M.vals.length - 1] : 0;
    const big = $('mOmsetBig');
    if (big) {
      const want = window.matchMedia('(max-width:540px)').matches ? 'Rp ' + short(current) : money(current);
      if (big.textContent !== want) big.textContent = want;
    }
    const sub = $('mOmsetSub');
    if (sub) { const h = compareHtml(M); if (sub.innerHTML !== h) sub.innerHTML = h; }
    let chart = hero.querySelector('.ref-month-chart');
    if (!chart) {
      chart = document.createElement('div');
      chart.className = 'ref-chart ref-month-chart';
      hero.appendChild(chart);
      const foot = document.createElement('div');
      foot.className = 'ref-hero-foot ref-month-foot';
      hero.appendChild(foot);
    }
    if (st.el !== chart) { st.el = chart; observe(st); }
    const foot = hero.querySelector('.ref-month-foot');
    const ft = new Date(mYear, mMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' · cumulative revenue trend';
    if (foot && foot.textContent !== ft) foot.textContent = ft;
    const vis = pageActive(st);
    if (vis) draw(st, M, allowTween);
    st.wasVisible = vis && !document.hidden;
  }

  /* ── riwayat 30 hari: batang mini per order ───────────────────────── */
  function renderHistoryBars() {
    const D = data();
    document.querySelectorAll('#histStrip .hday').forEach((card) => {
      let bars = card.querySelector('.ref-history-bars');
      if (!bars) {
        bars = document.createElement('div');
        bars.className = 'ref-history-bars';
        card.appendChild(bars);
      }
      const entries = D[card.dataset.dateKey] || [];
      const values = entries.map((entry) => (entry && entry.revenue) || 0).filter(Boolean).slice(-8);
      const max = Math.max(1, ...values);
      const signature = values.join(',');
      if (bars.dataset.signature === signature) return;
      bars.dataset.signature = signature;
      bars.innerHTML = values.length
        ? values.map((value) => '<i style="height:' + Math.max(3, Math.round(value / max * 29)) + 'px"></i>').join('')
        : '<i style="height:2px;opacity:.25"></i>';
    });
  }

  /* ── ukuran: ResizeObserver (tanpa memaksa layout saat render) ────── */
  let ro = null;
  function observe(st) {
    if (!window.ResizeObserver) return;
    if (!ro) ro = new ResizeObserver((entries) => {
      entries.forEach((en) => {
        const st = en.target === charts.dash.el ? charts.dash : en.target === charts.month.el ? charts.month : null;
        if (!st) return;
        const w = Math.round(en.contentRect.width), h = Math.round(en.contentRect.height);
        if (!w || !h) return;                       // halaman tersembunyi
        if (w === st.W && h === st.H) return;
        st.W = w; st.H = h;
        if (st === charts.dash) renderReferenceDashboard(false); else renderReferenceMonthly(false);
      });
    });
    ro.observe(st.el);
  }

  /* ── pemicu ───────────────────────────────────────────────────────── */
  let hxBound = false;
  function bindHX() {
    if (hxBound || !window.HX || !HX.on) return false;
    hxBound = true;
    HX.on('render', () => {
      renderHistoryBars();
      renderReferenceDashboard(true);
      if (pageActive(charts.month)) renderReferenceMonthly(true);
    });
    HX.on('page', (p) => {
      if (!p) return;
      if (p.id === 'page-dashboard') renderReferenceDashboard(false);
      else if (p.id === 'page-monthly') renderReferenceMonthly(false);
      if (p.from === 'page-dashboard' && p.id !== 'page-dashboard') { charts.dash.wasVisible = false; scrubOff(charts.dash); }
      if (p.from === 'page-monthly' && p.id !== 'page-monthly') { charts.month.wasVisible = false; scrubOff(charts.month); }
    });
    HX.on('sale', onSale);
    HX.on('ready', () => { renderReferenceDashboard(false); renderReferenceMonthly(false); });
    HX.on('prefs', () => { charts.dash.sig = charts.month.sig = null; renderReferenceDashboard(false); renderReferenceMonthly(false); });
    return true;
  }
  function wrapMonthly() {
    if (typeof window.renderMonthly !== 'function' || window.renderMonthly.__ref) return;
    const orig = window.renderMonthly;
    const w = function () { const r = orig.apply(this, arguments); renderReferenceMonthly(false); return r; };
    for (const k in orig) if (Object.prototype.hasOwnProperty.call(orig, k)) w[k] = orig[k];
    w.__ref = true;
    window.renderMonthly = w;
  }

  function init() {
    renderReferenceDashboard(false);
    renderReferenceMonthly(false);
    renderHistoryBars();
    wrapMonthly();
    if (!bindHX()) {
      // fx-core.js dimuat setelah file ini — biasanya sudah ada saat 'load'.
      // Cadangan kalau tidak ada: amati teks seperti dulu (tetap dengan tanda tangan).
      setTimeout(() => {
        if (bindHX()) return;
        const watched = [$('liveOmsetBig'), $('dayLabel'), $('histStrip')].filter(Boolean);
        const mo = new MutationObserver(() => requestAnimationFrame(() => { renderHistoryBars(); renderReferenceDashboard(true); }));
        watched.forEach((node) => mo.observe(node, { childList: true, subtree: true, characterData: true }));
      }, 1500);
    }
    // ganti hari (tengah malam) & kembali dari latar: murah — tidak ada kerja bila data sama
    window.setInterval(() => { if (!document.hidden) { renderReferenceDashboard(false); if (pageActive(charts.month)) renderReferenceMonthly(false); } }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { charts.dash.wasVisible = charts.month.wasVisible = false; return; }
      renderReferenceDashboard(false);
      if (pageActive(charts.month)) renderReferenceMonthly(false);
    });
  }

  // untuk tes & modul lain (hanya membaca)
  window.HXChart = { short, axisShort, model, charts };

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, { once: true });
})();
