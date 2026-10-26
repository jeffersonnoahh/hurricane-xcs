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
     - SCRUB: geser jari mendatar (atau tahan 400 ms lalu geser) / arahkan
       mouse = garis bidik kaca + titik yang menempel di garis omset, loncat
       per hari; label kecil "17 OKT · +Rp 112jt · total Rp 1,45M"; batang
       hari itu menyala; bagian sesudah hari itu meredup. Angka hero besar
       ikut menunjukkan total s.d. hari itu — lewat LAPISAN di atas teks asli
       (teks #liveOmsetBig/#mOmsetBig tidak pernah ditulis ulang: motion.js
       & premium-ui.js mengamatinya). Lepas = titik meluncur pulang ke hari
       ini dengan pegas lembut, angka hero menghitung kembali ke nilai asli.
       Lapisan scrub = elemen HTML yang hanya digeser transform (kompositor),
       SVG grafik tidak digambar ulang selama scrub.
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

  /* ── format uang singkat (keputusan bersama): 850rb · 189,73jt · 5jt · 2,95M ──
     Sama persis dengan fRp di app.js (dipakai kalau ada); salinan aturannya
     di sini hanya cadangan kalau app.js belum termuat. */
  const comma = (s) => String(s).replace('.', ',');
  const fDec = (c) => { const w = Math.floor(c / 100), f = c % 100; return f ? w + ',' + (f < 10 ? '0' : '') + f : String(w); };
  function short(n) {
    n = Math.round(+n || 0);
    try { if (typeof fRp === 'function') return fRp(n); } catch (e) { }
    const a = Math.abs(n), sg = n < 0 ? '-' : '';
    if (a >= 999995000) return sg + fDec(Math.round(a / 1e7)) + 'M';
    if (a >= 999500) return sg + fDec(Math.round(a / 1e4)) + 'jt';
    if (a >= 1000) return sg + Math.round(a / 1e3) + 'rb';
    return String(n);
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
    const mShort = BLN[M.m].toUpperCase();   // 1 OKT · 9 OKT … (sama dengan label scrub)
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
    if (n && M.live) s += '<circle class="ref-chart-glow" r="' + (cp ? 15 : 19) + '" fill="url(#hxGlow-' + id + ')"></circle><circle class="ref-chart-ring" r="5"></circle><circle class="ref-chart-ring" r="5"></circle>';
    if (n) s += '<circle class="ref-chart-dot" r="' + (cp ? 3.6 : 4) + '"></circle>';
    s += '</svg><div class="ref-chart-ov" aria-hidden="true">';
    if (M.ghost && M.ghost.vals.length) s += '<span class="ref-chart-tag' + (M.ghost.kind === 'record' ? ' is-record' : '') + '">' + (M.ghost.kind === 'record' ? 'Rekor ' + BULAN[M.ghost.m] : BLN[M.ghost.m]) + '</span>';
    if (M.cross) {
      s += '<span class="ref-chart-badge"><i></i><b>REKOR BULANAN BARU</b>' +
        (cp ? '' : '<em>' + BULAN[M.cross.m] + ' ' + short(M.cross.total) + ' terlampaui</em>') + '</span>';
    }
    // lapisan scrub (HTML, hanya transform): redup · batang hari · garis bidik · titik hantu · titik · label
    if (n) {
      s += '<div class="ref-scrub"><div class="ref-scrub-clip"><i class="ref-scrub-shade"></i></div>' +
        (n > 1 ? '<i class="ref-scrub-pool"></i><i class="ref-scrub-bar"></i>' : '') + '<i class="ref-scrub-x"></i>' +
        (M.ghost && M.ghost.vals.length ? '<i class="ref-scrub-gdot"></i>' : '') +
        '<i class="ref-scrub-dot"></i><div class="ref-scrub-lab"></div></div>';
    }
    s += '</div>';

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
      glow: q('.ref-chart-glow'), rings: qa('.ref-chart-ring'), dot: q('.ref-chart-dot'),
      tag: q('.ref-chart-tag'), badge: q('.ref-chart-badge'), ov: q('.ref-chart-ov'),
      sx: q('.ref-scrub-x'), sdot: q('.ref-scrub-dot'), sgdot: q('.ref-scrub-gdot'), sbar: q('.ref-scrub-bar'), spool: q('.ref-scrub-pool'),
      shade: q('.ref-scrub-shade'), slab: q('.ref-scrub-lab')
    };
    st.labKey = null; st.labW = 0; st.ylabW = null; st.sxY = false;
    st.el.classList.remove('sx-ylab');
    // posisi lapisan scrub baru dibuat: pasang tanpa transisi (tidak meluncur dari pojok kiri)
    if (st.sx && st.sx.mode !== 'idle') sxJump(st);
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
    st.tan = null;
    if (!p.length) return;
    const head = p[p.length - 1];
    const lineD = curvePath(p);
    set(N.line, { d: lineD });
    const areaD = lineD + 'L' + f1(head[0]) + ',' + F.base + 'L' + f1(p[0][0]) + ',' + F.base + 'Z';
    set(N.area, { d: areaD });
    set(N.clip, { d: areaD });
    N.xlab.forEach((el) => { const i = +el.getAttribute('data-i'); el.setAttribute('x', f1(n <= 1 ? F.innerW : i / (n - 1) * F.innerW)); });
    // batang omset harian (geometrinya disimpan untuk batang sorot scrub)
    st.vol = null;
    if (N.vols.length) {
      let mx = 0; const dl = cur.vals.map((v, i) => { const d = Math.max(0, v - (i ? cur.vals[i - 1] : 0)); if (d > mx) mx = d; return d; });
      const bw = Math.max(1.5, Math.min(7, F.innerW / n * 0.38)), hmax = ih * 0.2;
      const xs = [], hs = [];
      N.vols.forEach((r, i) => {
        const h = mx > 0 ? Math.max(dl[i] > 0 ? 1.5 : 0, dl[i] / mx * hmax) : 0;
        const x = p[i][0] - (i === 0 ? 0 : i === n - 1 ? bw : bw / 2);
        xs.push(x); hs.push(h);
        set(r, { x: f1(x), y: f1(F.base - h), width: f1(bw), height: f1(h) });
      });
      st.vol = { bw, hmax, xs, hs };
    }
    // lapisan scrub: ukuran tetap (per gambar, bukan per gerakan)
    if (N.sx) {
      const px = (v) => f1(v) + 'px';
      N.sx.style.top = px(F.lane - 1); N.sx.style.height = px(F.base - F.lane + 1);
      if (N.shade) { N.shade.style.top = px(F.lane - 4); N.shade.style.height = px(F.H - F.lane + 4); N.shade.style.width = px(F.W + 64); }
      if (N.sbar && st.vol) { N.sbar.style.top = px(F.base - st.vol.hmax); N.sbar.style.width = px(st.vol.bw); N.sbar.style.height = px(st.vol.hmax); }
      if (N.spool && st.vol) { const ph = st.vol.hmax + 14; N.spool.style.top = px(F.base - ph); N.spool.style.height = px(ph); }
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
    // scrub aktif: ikut geometri baru (data masuk / ukuran berubah). Saat
    // meluncur pulang, bingkai luncuran berikutnya yang memasang posisinya.
    if (st.sx && st.sx.mode === 'active' && st.sx.i != null) sxPlace(st, st.sx.i, true);
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

  /* ── SCRUB: geser / tahan / arahkan mouse di grafik ──────────────────
     Keadaan per grafik di st.sx = { mode: 'active' | 'glide', type, id, i, big, ... }
       active = jari / mouse sedang memilih hari (loncat per hari)
       glide  = dilepas: titik meluncur pulang ke hari ini (pegas lembut)
     Gerak jari: touch-action pan-y (gulir tegak tetap milik browser).
     Scrub mulai hanya kalau 8px pertama jelas MENDATAR (|dx| > 1,3·|dy|),
     atau jari diam 400 ms (tahan ≈ long-press bawaan HP). Mulai dari geser
     mendatar: pointer ditangkap, touchmove dicegah (halaman diam). Mulai
     dari tahan: arah gerak pertama (>8px) yang memutuskan — TEGAK = scrub
     dibatalkan & touchmove TIDAK dicegah (halaman bergulir seperti biasa),
     mendatar/miring = scrub dikunci. Jari kedua (cubit-zoom) = scrub
     berhenti, zoom milik browser (touch-action: pan-y pinch-zoom). Satu
     pemilik gerakan: kelas 'hx-gesture' di <html> (selama jari scrub). */
  const root = document.documentElement;
  const SX_SLOP = 8, SX_HOLD = 400;
  function canBuzz() { const ua = navigator.userActivation; return !ua || ua.hasBeenActive; }
  function buzz(ms) { try { if (navigator.vibrate && canBuzz()) navigator.vibrate(ms); } catch (e) { } }
  const f2 = (v) => Math.round(v * 100) / 100;
  const tf = (el, x, y) => { if (el) el.style.transform = 'translate3d(' + f2(x) + 'px,' + f2(y) + 'px,0)'; };
  // garis 1px tajam: tepi kirinya di piksel perangkat yang utuh
  const snapPx = (x) => { const r = window.devicePixelRatio || 1; return Math.round((x - 0.5) * r) / r; };

  // titik tepat di kurva pada indeks pecahan u (0..n-1). Titik kendali kurva
  // berjarak sama secara mendatar, jadi x linear terhadap parameter.
  function curveAt(st, u) {
    const p = st.pts, n = st.M ? st.M.vals.length : 0;
    if (!p || !p.length || !n) return null;
    if (n <= 1) return p[p.length - 1];
    u = Math.max(0, Math.min(n - 1, u));
    const i = Math.min(n - 2, Math.floor(u)), s = u - i;
    if (s <= 1e-4) return p[i];
    if (s >= 1 - 1e-4) return p[i + 1];
    const t = st.tan || (st.tan = tangents(p)), a = p[i], b = p[i + 1], h = (b[0] - a[0]) / 3, v = 1 - s;
    const c1 = a[1] + t[i] * h, c2 = b[1] - t[i + 1] * h;
    return [a[0] + (b[0] - a[0]) * s, v * v * v * a[1] + 3 * v * v * s * c1 + 3 * v * s * s * c2 + s * s * s * b[1]];
  }
  function valAt(st, u) {
    const v = st.cur ? st.cur.vals : null;
    if (!v || !v.length) return 0;
    u = Math.max(0, Math.min(v.length - 1, u));
    const i = Math.floor(u), s = u - i;
    return i >= v.length - 1 ? v[v.length - 1] : v[i] + (v[i + 1] - v[i]) * s;
  }
  // label: "17 OKT │ +Rp 112jt │ total Rp 1,45M" (+ "vs Rekor Jul +19,6%" di layar lebar)
  function labHtml(st, i) {
    const M = st.M, cur = st.cur, n = M.vals.length;
    const v = cur.vals[i] || 0, d = Math.max(0, v - (i ? cur.vals[i - 1] : 0));
    const today = M.live && i === n - 1;
    let h = '<span class="d">' + (today ? '<i class="now"></i>' : '') + (i + 1) + ' ' + BLN[M.m].toUpperCase() + '</span><i class="sep"></i>' +
      '<span class="a' + (d > 0 ? '' : ' z') + '">+Rp ' + short(d) + '</span><i class="sep"></i>' +
      '<span class="t"><em>total</em> Rp ' + short(v) + '</span>';
    if (!st.compact && M.ghost && cur.gvals && i < cur.gvals.length && cur.gvals[i] > 0) {
      const g = cur.gvals[i], pc = (v - g) / g * 100;
      h += '<i class="sep"></i><span class="g">vs ' + (M.ghost.kind === 'record' ? 'Rekor ' : '') + BLN[M.ghost.m] +
        ' <b class="' + (pc >= 0 ? 'up' : 'dn') + '">' + pct1(pc) + '</b></span>';
    }
    return h;
  }
  // pasang lapisan scrub di indeks u. full = indeks bulat: juga batang hari,
  // titik hantu dan label (luncuran pulang hanya menggeser garis + titik).
  function sxPlace(st, u, full) {
    const N = st.nodes;
    if (!N || !N.sx || !st.cur) return;
    const pt = curveAt(st, u);
    if (!pt) return;
    const F = frame(st), x = pt[0];
    tf(N.sx, snapPx(x), 0);
    tf(N.sdot, x, pt[1]);
    tf(N.shade, x + 2, 0);
    sxYLabels(st, x);
    if (!full) return;
    const n = st.M.vals.length, i = Math.max(0, Math.min(n - 1, Math.round(u)));
    if (N.spool) tf(N.spool, x, 0);
    if (N.sbar && st.vol && st.vol.xs[i] != null) {
      const sc = Math.max(2, st.vol.hs[i]) / st.vol.hmax;
      N.sbar.style.transform = 'translate3d(' + f1(st.vol.xs[i]) + 'px,0,0) scaleY(' + sc.toFixed(3) + ')';
    }
    if (N.sgdot) {
      const g = st.cur.gvals;
      if (g && i < g.length) {
        const ih = F.base - F.top;
        tf(N.sgdot, x, F.base - (g[i] / st.cur.dmax) * ih);
        N.sgdot.style.visibility = '';
      } else N.sgdot.style.visibility = 'hidden';
    }
    if (N.slab) {
      const key = i + '|' + Math.round(st.cur.vals[i] || 0) + '|' + (st.compact ? 1 : 0);
      if (st.labKey !== key) { N.slab.innerHTML = labHtml(st, i); st.labKey = key; st.labW = N.slab.offsetWidth || st.labW; }
      const w = st.labW || 0;
      tf(N.slab, Math.max(0, Math.min(F.W - w, x - w / 2)), 0);
    }
  }
  // garis bidik di atas label sumbu Y (hari-hari awal): label itu meredup
  // (hanya kelas di .ref-chart, berganti saat melewati batas — bukan per gerakan)
  function sxYLabels(st, x) {
    const N = st.nodes;
    if (!N || !N.ylab.length) return;
    if (st.ylabW == null) {
      let w = 0;
      N.ylab.forEach((t) => { try { const b = t.getBBox(); if (b.width > w) w = b.width; } catch (e) { } });
      st.ylabW = w;
    }
    const on = !!(st.sx && st.sx.mode !== 'idle') && x < st.ylabW + 7;
    if (on !== st.sxY) { st.sxY = on; st.el.classList.toggle('sx-ylab', on); }
  }
  // lapisan baru / scrub baru: pasang posisi tanpa transisi selama satu frame
  function sxJump(st) {
    const el = st.el;
    if (!el) return;
    el.classList.add('ref-sx-jump');
    cancelAnimationFrame(st.jumpRaf);
    st.jumpRaf = requestAnimationFrame(() => { st.jumpRaf = requestAnimationFrame(() => el.classList.remove('ref-sx-jump')); });
  }

  /* angka hero besar selama scrub: lapisan .ref-big-ov tepat di atas teks
     asli (gaya huruf disalin, posisi dicocokkan dengan kotak teks). Teks
     asli hanya disembunyikan lewat kelas .ref-big-hide; isinya tidak disentuh. */
  const BIG_COPY = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant-numeric',
    'font-variant-ligatures', 'font-variant-caps', 'font-feature-settings', 'font-variation-settings', 'font-kerning',
    'font-optical-sizing', 'font-synthesis', 'letter-spacing', 'word-spacing', 'line-height', 'text-transform', 'text-align',
    'text-indent', 'text-rendering', 'text-shadow', 'direction', '-webkit-font-smoothing', '-moz-osx-font-smoothing',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'];
  const bigEl = (st) => $(st.key === 'dash' ? 'liveOmsetBig' : 'mOmsetBig');
  function textRect(node) {
    const r = document.createRange();
    r.selectNodeContents(node);
    const rs = r.getClientRects();
    return { r: r.getBoundingClientRect(), lines: rs.length };
  }
  // odometer / guliran js/motion.js yang sedang jalan di angka ini: dipotong
  // HANYA lewat kelas & atribut (motion.js sendiri membereskan sisanya)
  function cutMotion(hero, el) {
    const ns = hero.querySelectorAll('.hx-odo,.hx-odo-dl');
    for (let k = 0; k < ns.length; k++) ns[k].setAttribute('data-ref-cut', '');
    if (el.classList.contains('lg-rolling') || el.hasAttribute('data-lg')) { el.classList.remove('lg-rolling'); el.removeAttribute('data-lg'); }
  }
  function bigOpen(st) {
    let ov = null;
    try {
      const el = bigEl(st), hero = el && el.parentElement;
      if (!hero || !st.M || !st.M.vals.length || root.classList.contains('lg-loading')) return null;
      const tn = el.firstChild;
      if (!tn || tn.nodeType !== 3 || el.childNodes.length !== 1 || el.offsetParent !== hero) return null;
      const real = Math.round(st.M.vals[st.M.vals.length - 1] || 0), text = tn.data;
      // gaya teks sekarang: lengkap ("Rp 2.987.622.749") atau singkat ("Rp 2,99M")
      const fmt = text === money(real) ? money : text === 'Rp ' + short(real) ? (v) => 'Rp ' + short(v) : null;
      if (!fmt) return null;
      cutMotion(hero, el);
      const cs = getComputedStyle(el);
      ov = document.createElement('div');
      ov.className = 'ref-big-ov';
      ov.setAttribute('aria-hidden', 'true');
      const s = ov.style;
      BIG_COPY.forEach((p) => { const v = cs.getPropertyValue(p); if (v) s.setProperty(p, v); });
      s.color = cs.color;
      s.setProperty('-webkit-text-fill-color', cs.color);
      s.boxSizing = 'border-box';
      s.width = el.offsetWidth + 'px';
      s.left = el.offsetLeft + 'px';
      s.top = el.offsetTop + 'px';
      ov.textContent = text;
      hero.appendChild(ov);
      const a = textRect(tn);
      if (a.lines !== 1) throw 0;                       // angka terlipat dua baris: tidak dilapisi
      const sc = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
      let b = textRect(ov.firstChild);
      s.left = (el.offsetLeft + (a.r.left - b.r.left) / sc) + 'px';
      s.top = (el.offsetTop + (a.r.top - b.r.top) / sc) + 'px';
      b = textRect(ov.firstChild);
      if (Math.abs(b.r.left - a.r.left) > 1 || Math.abs(b.r.top - a.r.top) > 1 || Math.abs(b.r.width - a.r.width) > 1.5) throw 0;
      el.classList.add('ref-big-hide');
      hero.classList.add('ref-big-on');
      return { el, hero, ov, fmt, last: text };
    } catch (e) {
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      return null;
    }
  }
  function bigSet(st, v) {
    const b = st.sx && st.sx.big;
    if (!b) return;
    const t = b.fmt(Math.round(v));
    if (t === b.last) return;
    b.last = t;
    if (b.ov.firstChild) b.ov.firstChild.data = t; else b.ov.textContent = t;
  }
  // kembali ke teks asli: lapisan berisi teks asli persis, lalu ditukar
  function bigClose(st) {
    const b = st.sx && st.sx.big;
    if (!b) return;
    st.sx.big = null;
    cutMotion(b.hero, b.el);
    b.el.classList.remove('ref-big-hide');
    b.hero.classList.remove('ref-big-on');
    if (b.ov.parentNode) b.ov.parentNode.removeChild(b.ov);
  }

  function sxIdx(st, clientX) {
    const sx = st.sx, n = st.M ? st.M.vals.length : 0;
    if (!n || !sx) return null;
    if (sx.rw == null || sx.W !== st.W) {
      const r = st.el.getBoundingClientRect();
      sx.rl = r.left; sx.rw = r.width; sx.W = st.W;
    }
    if (!sx.rw) return null;
    const F = frame(st), x = (clientX - sx.rl) * (st.W / sx.rw);
    return n <= 1 ? 0 : Math.round(Math.max(0, Math.min(1, x / F.innerW)) * (n - 1));
  }
  function sxSet(st, i, jump) {
    const sx = st.sx;
    if (!sx || i == null || (i === sx.i && !jump)) return;
    sx.i = i;
    if (jump) sxJump(st);
    sxPlace(st, i, true);
    bigSet(st, st.cur ? st.cur.vals[i] || 0 : 0);
    if (sx.type !== 'mouse') buzz(6);
  }
  function sxStart(st, o) {
    if (!st.el || !st.M || !st.M.vals.length || !st.nodes || !st.nodes.sx || !st.cur || !pageActive(st) || document.hidden) return false;
    let sx = st.sx;
    const fresh = !sx;
    // disentuh lagi saat masih meluncur pulang: lanjut dari posisi sekarang (meluncur ke jari, tanpa loncat)
    if (sx && sx.mode === 'glide') { cancelAnimationFrame(sx.raf); clearTimeout(sx.tmo); sx.i = null; }
    if (!sx) sx = st.sx = { i: null, big: null };
    sx.mode = 'active'; sx.type = o.type; sx.id = o.id; sx.rw = null;
    // jari: arah sudah pasti (geser mendatar) atau belum (tahan) — lihat touchmove
    sx.lock = !o.hold; sx.x0 = o.x; sx.y0 = o.y == null ? 0 : o.y;
    if (o.type !== 'mouse') {
      if (!sx.gest && !root.classList.contains('hx-gesture')) { root.classList.add('hx-gesture'); sx.gest = true; }
      try { st.el.setPointerCapture(o.id); } catch (e) { }
    }
    st.el.classList.remove('is-glide');
    st.el.classList.add('is-scrub');
    if (!sx.big) sx.big = bigOpen(st);
    sxSet(st, sxIdx(st, o.x), fresh);
    return true;
  }
  // lepas: titik meluncur pulang ke hari ini (pegas teredam kritis, mulai
  // diam lalu menetap tanpa memantul), angka hero menghitung ke nilai asli
  function sxRelease(st, instant) {
    const sx = st.sx;
    if (!sx || sx.mode !== 'active') return;
    if (sx.gest) { root.classList.remove('hx-gesture'); sx.gest = false; }
    st.sxEndAt = performance.now(); st.sxEndType = sx.type;
    const n = st.M ? st.M.vals.length : 0, from = sx.i;
    if (instant || reduced() || !window.requestAnimationFrame || from == null || !n || from >= n - 1 || document.hidden || !st.pts) {
      sxFinish(st, !instant && from != null && from < n - 1 && !reduced());
      return;
    }
    sx.mode = 'glide';
    st.el.classList.remove('is-scrub');
    st.el.classList.add('is-glide');
    const dur = Math.round(460 + 300 * Math.min(1, (n - 1 - from) / Math.max(1, n - 1)));
    const w = 7.2 / dur, end = 1 - (1 + 7.2) * Math.exp(-7.2), t0 = performance.now();
    const step = (now) => {
      if (st.sx !== sx || sx.mode !== 'glide') return;
      const t = Math.max(0, now - t0), k = t / dur;
      const e = k >= 1 ? 1 : (1 - (1 + w * t) * Math.exp(-w * t)) / end;
      const to = st.M.vals.length - 1;               // data bisa bertambah saat meluncur
      const u = from + (to - from) * Math.min(1, e);
      sxPlace(st, u, false);
      bigSet(st, valAt(st, u));
      if (k < 1) sx.raf = requestAnimationFrame(step); else sxFinish(st, true);
    };
    sx.raf = requestAnimationFrame(step);
    sx.tmo = setTimeout(() => { if (st.sx === sx && sx.mode === 'glide') sxFinish(st, true); }, dur + 450);
  }
  // selesai (atau dipotong): semua kembali ke keadaan diam
  function sxFinish(st, landed) {
    const sx = st.sx;
    if (!sx) return;
    cancelAnimationFrame(sx.raf); clearTimeout(sx.tmo);
    if (sx.gest) { root.classList.remove('hx-gesture'); sx.gest = false; }
    if (sx.mode === 'active' || sx.mode === 'glide') { st.sxEndAt = performance.now(); st.sxEndType = sx.type; }
    sx.mode = 'idle';
    if (st.nodes && st.cur && st.pts && st.M && st.M.vals.length) sxPlace(st, st.M.vals.length - 1, false);
    bigClose(st);
    st.sx = null;
    if (st.el) st.el.classList.remove('is-scrub', 'is-glide', 'sx-ylab');
    st.sxY = false;
    // titik pulang menyatu dengan kepala garis: kepala berdenyut sekali
    const N = st.nodes;
    if (landed && N && N.dot && N.dot.animate && !reduced()) {
      try { N.dot.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 560, easing: 'cubic-bezier(.34,1.4,.64,1)' }); } catch (e) { }
    }
  }
  function sxKill(st) {
    clearTimeout(st.lpT);
    st.pd = null;
    if (st.sx) sxFinish(st, false);
  }
  function bindScrub(st) {
    const el = st.el;
    if (el.__refScrub) return;
    el.__refScrub = true;
    // gerakan milik modul lain sedang berlangsung?
    const other = () => root.classList.contains('hx-gesture') && !(st.sx && st.sx.gest);
    const active = (id) => st.sx && st.sx.mode === 'active' && (id == null || st.sx.id === id);
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      if (other() || !st.M || !st.M.vals.length) return;
      const pd = st.pd = { id: e.pointerId, type: e.pointerType || 'touch', x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      clearTimeout(st.lpT);
      // tahan diam 400 ms = scrub juga; arah gerak pertama sesudahnya yang
      // menentukan: tegak = gulir halaman (scrub batal), mendatar = scrub
      st.lpT = setTimeout(() => {
        if (st.pd !== pd || other()) return;
        st.pd = null;
        sxStart(st, { type: pd.type, id: pd.id, x: pd.x, y: pd.y, hold: true });
      }, SX_HOLD);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        // desktop: cukup arahkan (tanpa tekan)
        if (active()) { if (st.sx.type === 'mouse') sxSet(st, sxIdx(st, e.clientX)); return; }
        if (other()) return;
        sxStart(st, { type: 'mouse', id: e.pointerId, x: e.clientX });
        return;
      }
      if (active(e.pointerId)) { sxSet(st, sxIdx(st, e.clientX)); return; }
      const pd = st.pd;
      if (!pd || pd.id !== e.pointerId) return;
      pd.x = e.clientX; pd.y = e.clientY;
      const dx = e.clientX - pd.x0, dy = e.clientY - pd.y0;
      if (dx * dx + dy * dy < SX_SLOP * SX_SLOP) return;
      clearTimeout(st.lpT);
      st.pd = null;
      // jelas mendatar = scrub; selain itu = gulir halaman (milik browser)
      if (Math.abs(dx) > 1.3 * Math.abs(dy) && !other()) sxStart(st, { type: pd.type, id: pd.id, x: e.clientX, y: e.clientY });
    });
    const up = (e) => {
      if (st.pd && st.pd.id === e.pointerId) { clearTimeout(st.lpT); st.pd = null; }
      if (active(e.pointerId) && st.sx.type !== 'mouse') sxRelease(st, false);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // hanya tangkapan milik grafik ini: anak SVG yang kehilangan tangkapan
    // implisit (Chrome) saat kita menangkap pointer juga mengirim event ini
    el.addEventListener('lostpointercapture', (e) => { if (e.target === el) up(e); });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && active() && st.sx.type === 'mouse') sxRelease(st, false);
    });
    // selama jari scrub: halaman tidak ikut bergulir (listener non-pasif hanya di grafik).
    // Scrub dari tahan belum dikunci: gerak < 8px dibiarkan (browser masih boleh
    // memilih gulir); gerak pertama yang TEGAK membatalkan scrub tanpa
    // preventDefault, jadi halaman bergulir seperti biasa.
    el.addEventListener('touchmove', (e) => {
      const sx = st.sx;
      if (!active() || sx.type === 'mouse') return;
      if (e.touches && e.touches.length > 1) { sxKill(st); return; }   // jari kedua: cubit-zoom milik browser
      if (!sx.lock) {
        const t = e.touches && e.touches[0];
        if (!t) return;
        const dx = t.clientX - sx.x0, dy = t.clientY - sx.y0;
        if (dx * dx + dy * dy < SX_SLOP * SX_SLOP) return;
        if (Math.abs(dy) > 1.3 * Math.abs(dx)) { sxKill(st); return; }
        sx.lock = true;
      }
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    // tahan lama di Android: tanpa menu konteks (klik kanan mouse tetap normal)
    el.addEventListener('contextmenu', (e) => {
      if (st.pd || (active() && st.sx.type !== 'mouse')) e.preventDefault();
    });
    // scrub dengan jari bukan ketukan: klik susulan tidak diteruskan
    el.addEventListener('click', (e) => {
      if (st.sxEndType && st.sxEndType !== 'mouse' && performance.now() - (st.sxEndAt || 0) < 450) { e.stopPropagation(); e.preventDefault(); }
    }, true);
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
    return '1–' + d + ' ' + BLN[prevDate.getMonth()];
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
    const ft = BULAN[viewed.getMonth()] + ' ' + viewed.getFullYear() + (M.live ? ' · omset berjalan' : ' · total omset');
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
    const ft = BULAN[mMonth] + ' ' + mYear + ' · tren omset kumulatif';
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
        // ukuran berubah di tengah scrub: ukuran huruf angka hero ikut lebar layar — lapisan dipasang ulang
        if (st.sx && st.sx.big) {
          bigClose(st);
          st.sx.big = bigOpen(st);
          if (st.sx.i != null && st.cur) bigSet(st, st.cur.vals[st.sx.i] || 0);
        }
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
      if (p.from === 'page-dashboard' && p.id !== 'page-dashboard') { charts.dash.wasVisible = false; sxKill(charts.dash); }
      if (p.from === 'page-monthly' && p.id !== 'page-monthly') { charts.month.wasVisible = false; sxKill(charts.month); }
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
      if (document.hidden) { charts.dash.wasVisible = charts.month.wasVisible = false; sxKill(charts.dash); sxKill(charts.month); return; }
      renderReferenceDashboard(false);
      if (pageActive(charts.month)) renderReferenceMonthly(false);
    });
    // jendela kehilangan fokus (notifikasi, pindah aplikasi) di tengah scrub: langsung beres
    window.addEventListener('blur', () => { sxKill(charts.dash); sxKill(charts.month); });
    window.addEventListener('orientationchange', () => { sxKill(charts.dash); sxKill(charts.month); });
  }

  // untuk tes & modul lain (hanya membaca)
  window.HXChart = { short, axisShort, model, charts, sxState: (k) => { const st = charts[k]; return st && st.sx ? { mode: st.sx.mode, i: st.sx.i, type: st.sx.type, big: !!st.sx.big } : null; } };

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init, { once: true });
})();
