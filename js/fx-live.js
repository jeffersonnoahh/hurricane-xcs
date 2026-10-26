/* ══════════════════════════════════════════════════════════════════════
   FX LIVE — setiap penjualan rekan tim jadi momen bersama.
   HANYA MEMBACA data. Tidak pernah menulis ke Firebase. Yang ditulis hanya
   localStorage HP ini: 'hx-last-visit', 'hxl-target100-<tanggal>' dan
   'hxl-rec' (jatah momen rekor hari ini).

   1. KAPSUL "CLOSING MASUK" (gaya Dynamic Island)
      Titik hijau muncul tepat di bawah header, mekar jadi kapsul kaca gelap:
      monogram tim · nama · produk · nominal yang bergulir per digit.
      Tahan ±4,5 dtk (garis tipis di bawah = sisa waktu), lalu kembali jadi
      titik. Ketuk = buka detail sales itu (openSPModal, hanya bila sedang
      melihat HARI INI — kalau tidak, modal akan menunjukkan hari lain).
      Geser ke atas = tutup.
        - satu kapsul sekaligus (antrean)
        - sales yang sama dalam 3 menit digabung ("2 produk", jumlah total)
          — kalau kapsulnya sedang tampil, isinya diperbarui langsung
        - penjualan sendiri (s.own) dilewati: HP penjual sudah ada toast
        - channel (Tokopedia, Shopee, Live TikTok…) = kapsul kecil, tenang,
          digabung per channel
        - >3 penjualan dari satu snapshot (HP bangun dari layar kunci) =
          SATU kapsul ringkasan
        - closing besar (>= Rp10jt) = tepi hijau terang, kilau, riak kuat
        - naik ke 3 besar hari ini = label kecil (#1 = kuning logo)
        - ditahan selama form/modal terbuka / sedang mengetik (HX.busy())
          dan saat tab tersembunyi; yang lebih tua dari 2 menit dibuang
   2. MOMEN TARGET (event 'goal')
        25/50/75% -> kapsul pencapaian dengan cincin
        100%      -> banner sinematik SEKALI SEHARI. Konfeti tetap hanya dari
                     motion.js (maybeCelebrate) — banner ini tidak menambah
                     konfeti; percikan motion.js terbang di atasnya.
   3. "SEJAK TERAKHIR DIBUKA" — sekali saat data pertama masuk ('ready').
   4. REKOR PRIBADI — penjualan yang membuat total HARI INI seorang sales
        melewati hari terbaiknya (>= 10 hari aktif sebelumnya), atau total
        BULAN INI melewati bulan penuh terbaiknya (>= 2 bulan sebelumnya):
        kapsul bertepi emas (satu-satunya tempat kuning logo dipakai di
        sini) 'Rekor pribadi baru · Hendri · Rp 45jt hari ini · rekor lama
        Rp 38jt · 12 Agu'. Juga di HP penjualnya sendiri. Sekali per sales
        per hari per jenis. Didahulukan dari kapsul penjualan biasa dan
        MENGGANTIKAN kapsul penjualan yang memicunya. Definisi rekor dibagi
        ke modul lain lewat HX.records (lihat di bawah).

   Event HX: 'ripple' {x, y, power} saat kapsul mekar (power 0..1:
   channel .25 · biasa .5 · ringkasan .7 · rekor .9 · besar 1) dan 'surge'
   {x, y, power:1} di puncak banner 100%. (Latar sekarang hitam polos —
   saat ini tidak ada pendengarnya; tetap dikirim untuk modul lain.)

   ATURAN: semua gerak = transform/opacity lewat Web Animations (jalan di
   compositor — tetap mulus walau renderAll sedang membangun ulang daftar).
   Setiap kapsul/banner yang ditutup membatalkan SEMUA animasinya (killAnims)
   — animasi fill 'forwards' yang dibiarkan menahan elemen lepas di memori.
   Tanpa backdrop-filter. Tanpa loop tanpa henti. Tidak ada kerja di setiap
   render. "Kurangi Gerak" = fade saja.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HX = window.HX;
  if (!HX || HX.__live) return;
  HX.__live = true;

  var D = document;
  var BIG = 10000000;
  var MERGE_MS = 3 * 60 * 1000;
  var STALE_MS = 2 * 60 * 1000;
  var STALE_100_MS = 15 * 60 * 1000;
  var HOLD = { sale: 4500, ch: 3200, sum: 5200, goal: 4600, since: 5800, rec: 6200 };
  var LS_VISIT = 'hx-last-visit';
  var LH = 1.2;                         // tinggi baris odometer (em) — sama dengan CSS
  var CAN = !!(window.Element && Element.prototype.animate);

  /* ── kecil ───────────────────────────────────────────────────────── */
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nice(s) { s = String(s == null ? '' : s).trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }
  function full(n) { return HX.moneyFull(Math.round(n || 0)); }
  // bilangan bulat c dengan k desimal -> '9,56' (tanpa toFixed: 9.555.000
  // harus jadi 9,56, bukan 9,55 karena galat float)
  function fixed(c, k) {
    if (!k) return String(c);
    var p = Math.pow(10, k), w = Math.floor(c / p), f = String(c % p);
    while (f.length < k) f = '0' + f;
    return w + ',' + f;
  }
  // cermin fRp (app.js) — hanya dipakai kalau fRp tidak ada
  function fRpLocal(n) {
    var a = Math.abs(n), sg = n < 0 ? '-' : '';
    var d2 = function (c) { return c % 100 ? fixed(c, 2) : String(c / 100); };
    if (a >= 999995000) return sg + d2(Math.round(a / 1e7)) + 'M';
    if (a >= 999500) return sg + d2(Math.round(a / 1e4)) + 'jt';
    if (a >= 1000) return sg + Math.round(a / 1e3) + 'rb';
    return String(n);
  }
  // SATU format uang singkat dengan seluruh app (fRp lewat HX.money):
  // 'Rp 24,30jt' / 'Rp 9,56jt' / 'Rp 1jt' / 'Rp 189,73jt' / 'Rp 2,95M' / 'Rp 850rb'
  function short(n) {
    n = Math.round(+n || 0);
    var s = null;
    try { if (typeof fRp === 'function') s = HX.money(n); } catch (e) { s = null; }
    return 'Rp ' + (s == null || s === '' ? fRpLocal(n) : s);
  }
  function ago(ts) {
    var m = Math.floor((Date.now() - (+ts || Date.now())) / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' mnt lalu';
    return Math.floor(m / 60) + ' jam lalu';
  }
  function gapText(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    if (m < 60) return m + ' mnt';
    var h = Math.floor(m / 60), r = m % 60;
    return r < 10 ? h + ' jam' : h + ' jam ' + r + ' mnt';
  }
  // 'Ivan' -> IV, 'Christ A' -> CA, 'REI' -> RE
  function mono(team, sp) {
    var w = String(team || sp || '').trim().split(/\s+/).filter(Boolean);
    var s = w.length > 1 ? w[0].charAt(0) + w[1].charAt(0) : (w[0] || '--').slice(0, 2);
    return s.toUpperCase();
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function still() { return !CAN || HX.reduced(); }
  /* Semua animasi modul ini dicatat. Animasi yang sudah selesai dengan fill
     'forwards'/'both' (atau yang dijeda) tetap hidup dan MENAHAN elemennya
     di memori walau kapsulnya sudah dibuang dari DOM — jadi setiap kapsul /
     banner yang ditutup membatalkan (cancel) semua animasi di dalamnya.
     Tanpa Element.getAnimations (baru ada di Chrome 84 / iOS 13.1+). */
  var LIVE_A = [];
  function anim(el, kf, o) {
    if (!el || !CAN) return null;
    var a = null;
    try { a = el.animate(kf, o); } catch (e) { return null; }
    if (a) LIVE_A.push(a);
    return a;
  }
  function attached(t) {
    try { return t.isConnected !== undefined ? t.isConnected : D.documentElement.contains(t); } catch (e) { return false; }
  }
  // batalkan animasi di dalam root (dan semua yang targetnya sudah lepas dari DOM)
  function killAnims(root) {
    var keep = [];
    for (var i = 0; i < LIVE_A.length; i++) {
      var a = LIVE_A[i], t = null;
      try { t = a.effect && a.effect.target; } catch (e) { t = null; }
      if (!t || (root && (t === root || root.contains(t))) || !attached(t)) {
        try { a.onfinish = null; a.cancel(); } catch (e) { }
      } else keep.push(a);
    }
    LIVE_A = keep;
  }
  function dropAnim(a) {
    if (!a) return;
    try { a.onfinish = null; a.cancel(); } catch (e) { }
    var i = LIVE_A.indexOf(a);
    if (i >= 0) LIVE_A.splice(i, 1);
  }
  function dayOf(ts) {
    try { if (typeof dk === 'function') return dk(new Date(ts)); } catch (e) { }
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function todayList() {
    try { return (allData[HX.todayKey()] || []).filter(Boolean); } catch (e) { return []; }
  }
  function viewingToday() { try { return vOff === 0; } catch (e) { return false; } }
  function lowTier() { return HX.tier === 'low'; }

  /* ── pegas (dihitung sekali jadi keyframe — tetap di compositor) ──── */
  function springFn(z, w) {
    var wd = w * Math.sqrt(1 - z * z);
    return function (t) { return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t)); };
  }
  var SPRING = springFn(0.64, 15.5);    // ±6% lewat, tenang ±0,55 dtk
  var SPRING_SOFT = springFn(0.8, 14);
  function springKF(dur, a, b, map, fn) {
    fn = fn || SPRING;
    var out = [], N = 30;
    for (var i = 0; i <= N; i++) {
      var p = i === N ? 1 : fn(i / N * dur / 1000);
      var k = map(a + (b - a) * p);
      k.offset = i / N;
      out.push(k);
    }
    return out;
  }
  var EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
  var EASE_IN = 'cubic-bezier(.5,0,.75,0)';

  /* ── pembaca layar ───────────────────────────────────────────────── */
  var srEl = null;
  function say(t) {
    if (!srEl) {
      srEl = D.createElement('div');
      srEl.className = 'hxl-sr';
      srEl.setAttribute('role', 'status');
      srEl.setAttribute('aria-live', 'polite');
      D.body.appendChild(srEl);
    }
    srEl.textContent = '';
    setTimeout(function () { srEl.textContent = t; }, 40);
  }

  /* ── posisi: tepat di bawah header (HP) / di bawah header+nav (desktop) */
  function topY() {
    var y = 0, h = D.querySelector('header'), n = D.querySelector('.nav-wrapper');
    if (h) { var r = h.getBoundingClientRect(); if (r.height && r.bottom > 0) y = r.bottom; }
    if (n) {
      var q = n.getBoundingClientRect();
      if (q.height && q.top < innerHeight / 2 && q.bottom > y) y = q.bottom;
    }
    // desktop: kapsul "menggantung" dari tepi bawah nav, tidak menimpa tombol halaman
    return Math.round(y) + (innerWidth >= 769 ? 6 : 10);
  }

  /* ── odometer: digit bergulir per kolom ──────────────────────────────
     Tiap kolom berisi [kosong, 0..9, 0..9]; indeks 0 = kosong, digit d ada
     di 1+d dan 11+d. Kolom selalu bergulir MAJU (angka tidak pernah mundur).
     Tanpa nilai awal (kapsul baru): tiap digit NAIK MASUK dari bawah
     jendelanya sambil menebal (gaya angka iOS), berurutan kiri -> kanan,
     <= ±0,55 dtk. Kolomnya hanya berisi angka itu sendiri, jadi tidak
     pernah ada potongan angka lain yang ikut terlihat (putaran penuh dulu
     terbaca sebagai tumpukan potongan angka).
     Dengan nilai awal: hanya digit yang BERUBAH yang bergulir maju; digit
     yang sama diam, digit yang baru muncul (puluhan juta, 96% -> 101%) naik
     masuk seperti di atas.
     Jendela tiap kolom = tinggi tinta angka + tepi yang memudar (diukur dari
     font yang benar-benar dipakai), dipasang selama SEMUA kolom bergerak dan
     dilepas setelah kolom terakhir mendarat (onfinish), bukan dengan timer. */
  var STACK = (function () {
    var s = '<i>&nbsp;</i>';
    for (var r = 0; r < 2; r++) for (var d = 0; d < 10; d++) s += '<i>' + d + '</i>';
    return s;
  })();
  function digitsOf(str) { var a = []; String(str || '').replace(/\d/g, function (c) { a.push(+c); }); return a; }
  // jendela tinta angka dalam em (baris = LH em): diukur sekali per font
  var inkCache = {};
  function inkMask(host) {
    var cs = null;
    try { cs = getComputedStyle(host); } catch (e) { cs = null; }
    var fam = cs ? cs.fontFamily : '', wt = cs ? cs.fontWeight : '', key = fam + '|' + wt;
    if (inkCache[key] !== undefined) return inkCache[key];
    // bawaan (SF Pro / Roboto): garis dasar ±0,95em dari atas baris 1,2em,
    // angka setinggi ±0,72em
    var top = 0.235, bot = 0.955;
    try {
      var c = D.createElement('canvas').getContext('2d');
      c.font = (cs ? cs.fontStyle + ' ' + wt + ' ' : '') + '100px ' + (fam || 'sans-serif');
      var m = c.measureText('0123456789');
      var a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent, A = m.fontBoundingBoxAscent, De = m.fontBoundingBoxDescent;
      if (a > 55 && a < 90 && d > -10 && d < 12) {
        // garis dasar: dari metrik font kalau ada, kalau tidak pakai bawaan
        var base = (A > 50 && De >= 0 && A + De < 160) ? (LH * 100 - (A + De)) / 2 + A : 95.5;
        top = (base - a) / 100; bot = (base + Math.max(0, d)) / 100;
      }
    } catch (e) { }
    var pad = 0.03, fade = 0.15;
    var e0 = Math.max(0, top - pad - fade), e1 = Math.max(0, top - pad), e2 = Math.min(LH, bot + pad), e3 = Math.min(LH, bot + pad + fade);
    var f = function (x) { return x.toFixed(3) + 'em'; };
    return (inkCache[key] = 'linear-gradient(180deg,transparent ' + f(e0) + ',#000 ' + f(e1) + ',#000 ' + f(e2) + ',transparent ' + f(e3) + ')');
  }
  function odo(host, to, from, delay, dur) {
    if (!host) return 0;
    var R = still();
    to = String(to); dur = dur || 900; delay = delay || 0;
    // guliran sebelumnya di elemen ini (angka diperbarui di tengah jalan) dibatalkan
    if (host.__hxlA) { host.__hxlA.forEach(dropAnim); host.__hxlA = null; }
    var tD = digitsOf(to), fD = from == null ? null : digitsOf(from);
    var wrap = D.createElement('span');
    wrap.className = 'hxl-odo';
    var cols = [], di = 0, txt = '';
    function flushTxt() {
      if (!txt) return;
      var s = D.createElement('span'); s.textContent = txt; wrap.appendChild(s); txt = '';
    }
    for (var i = 0; i < to.length; i++) {
      var ch = to.charAt(i);
      if (ch < '0' || ch > '9') { txt += ch; continue; }
      flushTxt();
      var d = +ch, fromRight = tD.length - 1 - di; di++;
      var fi = fD ? fD.length - 1 - fromRight : -1;
      var fd = fD && fi >= 0 ? fD[fi] : null;
      var col = D.createElement('span'); col.className = 'hxl-dg';
      var st = D.createElement('span'); st.className = 'hxl-dgs';
      col.appendChild(st); wrap.appendChild(col);
      var start = 0, end = 0, rise = fd == null || R;
      if (rise || fd === d) {
        // hanya angka itu sendiri (naik masuk, atau diam kalau tidak berubah)
        st.innerHTML = '<i>' + d + '</i>';
        rise = fd == null;
      } else {
        st.innerHTML = STACK;
        start = 1 + fd; end = d >= fd ? 1 + d : 11 + d;
        st.style.transform = 'translateY(' + (-end * LH) + 'em)';
      }
      cols.push({ st: st, col: col, start: start, end: end, rise: rise });
    }
    flushTxt();
    host.textContent = '';
    host.appendChild(wrap);
    if (R) return 0;
    var moving = cols.filter(function (c) { return c.start !== c.end || c.rise; });
    if (!moving.length) return 0;
    var mk = inkMask(host);
    wrap.style.setProperty('--hxl-ink', mk);
    wrap.classList.add('is-rolling');
    // jeda antar-kolom total <= 120ms: angka selesai hampir bersamaan
    var step = Math.min(24, 120 / Math.max(1, moving.length)), endAt = 0, lastA = null, list = [];
    var rolls = moving.some(function (c) { return !c.rise; });
    moving.forEach(function (c, k) {
      var dl = delay + k * step, du = dur, a, e;
      if (c.rise) {
        // naik masuk: mulai dari bawah tepi jendela, tanpa lewat batas
        var rd = rolls ? Math.round(du * 0.2) : 0, rdu = Math.min(520, rolls ? Math.round(du * 0.8) : du);
        a = anim(c.st, [{ opacity: 0, transform: 'translateY(.62em)' }, { opacity: 1, offset: 0.6 }, { opacity: 1, transform: 'translateY(0em)' }],
          { duration: rdu, delay: dl + rd, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
        e = dl + rd + rdu;
      } else {
        // tanpa lewat batas (tidak ada overshoot): melambat halus ke angkanya
        a = anim(c.st, [{ transform: 'translateY(' + (-c.start * LH) + 'em)' }, { transform: 'translateY(' + (-c.end * LH) + 'em)' }],
          { duration: du, delay: dl, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'backwards' });
        e = dl + du;
      }
      if (a) list.push(a);
      if (e >= endAt) { endAt = e; lastA = a; }
    });
    host.__hxlA = list;
    var off = function () {
      if (lastA) lastA.onfinish = null;
      clearTimeout(tmo);
      wrap.classList.remove('is-rolling');
      if (host.__hxlA === list) host.__hxlA = null;
    };
    // cadangan kalau onfinish tidak pernah datang (tab disembunyikan, dsb.)
    var tmo = setTimeout(off, endAt + 1500);
    if (lastA) lastA.onfinish = off; else { clearTimeout(tmo); tmo = setTimeout(off, endAt + 60); }
    return endAt;
  }

  /* ── peringkat hari ini di antara SALES (label "#1 sales hari ini") ──
     Channel (Live TikTok, Shopee…) dan team lead tidak dihitung — sama
     dengan lencana "Juara hari ini". Karena Top Performers ikut memuat
     channel, labelnya selalu menyebut "sales" supaya tidak bertentangan
     dengan nomor 01 di papan itu. */
  function rankOf(it) {
    if (it.kind !== 'sale' || HX.isLeader(it.sp) || HX.isChannel(it.sp)) return null;
    var m = {}, me = norm(it.sp) + '|' + norm(it.team);
    todayList().forEach(function (e) {
      if (!e || HX.isChannel(e.sp) || HX.isLeader(e.sp)) return;
      var k = norm(e.sp) + '|' + norm(e.team);
      m[k] = (m[k] || 0) + (+e.revenue || 0);
    });
    // penjualan simulasi belum ada di data; penjualan asli sudah
    var after = (m[me] || 0) + (it.sim ? it.total : 0), before = after - it.total;
    var r1 = 1, r0 = 1;
    for (var k in m) if (k !== me) { if (m[k] > after) r1++; if (m[k] > before) r0++; }
    if (r1 > 3) return null;
    if (before > 0 && r0 <= r1) return null;     // tidak naik
    return r1;
  }

  /* ── REKOR PRIBADI — SATU definisi untuk semua modul (HX.records) ─────
     Identitas = nama sales (trim, huruf kecil), DIGABUNG lintas tim.
     Channel (HX.isChannel) & team lead (HX.isLeader) tidak punya rekor.
       HX.records.day(sp) -> { sp, key, team, best, bestDate, today, current,
                               days, eligible, record, gain }
           best     = total HARIAN terbesar di tanggal SEBELUM hari ini
           bestDate = 'YYYY-MM-DD' (seri -> tanggal yang lebih dulu)
           today    = total hari ini (= current)
           days     = jumlah hari aktif sebelumnya (total > 0)
           eligible = days >= 10 dan best > 0
           record   = eligible dan today > best      gain = today/best - 1
       HX.records.month(sp) -> { sp, key, team, best, bestMonth, month, current,
                                 months, eligible, record, gain }
           best = bulan PENUH terbaik sebelum bulan ini ('YYYY-MM'),
           month = current = bulan berjalan s.d. hari ini,
           months = jumlah bulan sebelumnya yang ada penjualan,
           eligible = months >= 2 dan best > 0
       HX.records.holders()      sales yang SEKARANG di atas rekornya
       HX.records.history(sp)    { days:[[tgl,total]..], months:[[bln,total]..] }
       HX.records.dateLabel('2026-08-12') -> '12 Agu'
       HX.records.monthLabel('2026-08')   -> 'Agustus'
     Murni membaca allData. Indeks dibangun malas (hanya kalau ditanya),
     paling banyak sekali per render, dan dipakai ulang kalau datanya sama. */
  var REC_MIN_DAYS = 10, REC_MIN_MONTHS = 2;
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var rxIdx = null, rxDirty = true, rxVer = 0;
  HX.on('render', function () { rxDirty = true; });       // hanya menandai — tanpa kerja
  function rxSeller(sp) { return !!norm(sp) && !HX.isChannel(sp) && !HX.isLeader(sp); }
  function rxBuild() {
    var data; try { data = allData || {}; } catch (e) { data = {}; }
    var tk = HX.todayKey();
    if (rxIdx && !rxDirty && rxIdx.data === data && rxIdx.tk === tk) return rxIdx;
    rxDirty = false;
    var keys = Object.keys(data), n = 0, i, j;
    for (i = 0; i < keys.length; i++) { var a0 = data[keys[i]]; n += (a0 && a0.length) || 0; }
    var sig = keys.length + ':' + n;
    if (rxIdx && rxIdx.data === data && rxIdx.tk === tk && rxIdx.sig === sig) return rxIdx;
    var per = {}, ok = {};
    for (i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!DATE_RE.test(k) || k > tk) continue;
      var arr = data[k], loc = null;
      if (!arr || !arr.length) continue;
      for (j = 0; j < arr.length; j++) {
        var e = arr[j];
        if (!e || typeof e !== 'object') continue;
        var id = norm(e.sp);
        if (!id) continue;
        var o = ok[id];
        if (o === undefined) o = ok[id] = rxSeller(e.sp);
        if (!o) continue;
        if (!loc) loc = {};
        loc[id] = (loc[id] || 0) + (+e.revenue || 0);
        var p = per[id] || (per[id] = { id: id, nm: {}, team: '', last: '', dm: {}, mm: {}, D: null, M: null });
        var nm = String(e.sp).trim();
        p.nm[nm] = (p.nm[nm] || 0) + 1;
        if (k >= p.last) { p.last = k; if (e.team) p.team = e.team; }
      }
      if (loc) for (var id2 in loc) {
        var q = per[id2], mk = k.slice(0, 7);
        q.dm[k] = loc[id2];
        q.mm[mk] = (q.mm[mk] || 0) + loc[id2];
      }
    }
    rxVer++;
    return (rxIdx = { data: data, tk: tk, mk: tk.slice(0, 7), sig: sig, per: per });
  }
  function rxName(p, sp) {
    var best = '', c = -1;
    for (var k in p.nm) if (p.nm[k] > c) { c = p.nm[k]; best = k; }
    return best || String(sp || '').trim();
  }
  function rxDayOf(p, tk) {
    if (p.D) return p.D;
    var best = 0, bd = null, days = 0;
    for (var k in p.dm) {
      if (k >= tk) continue;
      var v = p.dm[k];
      if (!(v > 0)) continue;
      days++;
      if (v > best || (v === best && bd && k < bd)) { best = v; bd = k; }
    }
    return (p.D = { best: best, bestDate: bd, today: p.dm[tk] || 0, days: days });
  }
  function rxMonthOf(p, mk) {
    if (p.M) return p.M;
    var best = 0, bm = null, months = 0;
    for (var m in p.mm) {
      if (m >= mk) continue;
      var v = p.mm[m];
      if (!(v > 0)) continue;
      months++;
      if (v > best || (v === best && bm && m < bm)) { best = v; bm = m; }
    }
    return (p.M = { best: best, bestMonth: bm, current: p.mm[mk] || 0, months: months });
  }
  function recDay(sp) {
    var X = rxBuild(), id = norm(sp), p = X.per[id], seller = rxSeller(sp);
    var d = p && seller ? rxDayOf(p, X.tk) : { best: 0, bestDate: null, today: 0, days: 0 };
    var el = seller && d.days >= REC_MIN_DAYS && d.best > 0;
    return {
      sp: p ? rxName(p, sp) : String(sp || '').trim(), key: id, team: p ? p.team : '',
      best: d.best, bestDate: d.bestDate, today: d.today, current: d.today, days: d.days,
      eligible: el, record: el && d.today > d.best, gain: d.best > 0 ? d.today / d.best - 1 : 0
    };
  }
  function recMonth(sp) {
    var X = rxBuild(), id = norm(sp), p = X.per[id], seller = rxSeller(sp);
    var m = p && seller ? rxMonthOf(p, X.mk) : { best: 0, bestMonth: null, current: 0, months: 0 };
    var el = seller && m.months >= REC_MIN_MONTHS && m.best > 0;
    return {
      sp: p ? rxName(p, sp) : String(sp || '').trim(), key: id, team: p ? p.team : '',
      best: m.best, bestMonth: m.bestMonth, month: m.current, current: m.current, months: m.months,
      eligible: el, record: el && m.current > m.best, gain: m.best > 0 ? m.current / m.best - 1 : 0
    };
  }
  // potongan data untuk grafik mini di kapsul rekor (n titik terakhir sebelum sekarang)
  function rxSeries(id, type, n) {
    var X = rxBuild(), p = X.per[id], out = [];
    if (!p) return out;
    var src = type === 'month' ? p.mm : p.dm, lim = type === 'month' ? X.mk : X.tk, ks = [];
    for (var k in src) if (k < lim && src[k] > 0) ks.push(k);
    ks.sort();
    ks.slice(-n).forEach(function (k) { out.push(src[k]); });
    return out;
  }
  function dateLabel(k) {
    if (!k) return '';
    var a = String(k).split('-'), t = HX.todayKey().slice(0, 4);
    var s = (+a[2]) + ' ' + (BLN[+a[1] - 1] || '');
    return a[0] !== t ? s + ' ' + a[0] : s;
  }
  function monthLabel(k) {
    if (!k) return '';
    var a = String(k).split('-'), t = HX.todayKey().slice(0, 4);
    var s = BULAN[+a[1] - 1] || '';
    return a[0] !== t ? s + ' ' + a[0] : s;
  }
  HX.records = {
    MIN_DAYS: REC_MIN_DAYS, MIN_MONTHS: REC_MIN_MONTHS,
    key: function (sp) { return norm(sp); },
    counts: rxSeller,
    day: recDay,
    month: recMonth,
    holders: function () {
      var X = rxBuild(), out = [];
      for (var id in X.per) {
        var p = X.per[id], nm = rxName(p, id), d = recDay(nm), m = recMonth(nm);
        if (d.record || m.record) out.push({ sp: nm, key: id, team: p.team, day: d.record ? d : null, month: m.record ? m : null });
      }
      return out;
    },
    history: function (sp) {
      var X = rxBuild(), p = X.per[norm(sp)], d = [], m = [], k;
      if (p) {
        for (k in p.dm) d.push([k, p.dm[k]]);
        for (k in p.mm) m.push([k, p.mm[k]]);
        d.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
        m.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
      }
      return { days: d, months: m };
    },
    dateLabel: dateLabel,
    monthLabel: monthLabel,
    version: function () { rxBuild(); return rxVer; }
  };

  /* ── deteksi momen rekor (dari penjualan BARU) ───────────────────────
     Per sales: total hari ini SEBELUM penjualan baru <= rekor lama dan
     SESUDAHNYA > rekor lama -> momen. Penjualan asli sudah ada di allData
     (scan berjalan setelah renderAll); penjualan simulasi belum, jadi
     dijumlah di memori (hanya untuk tes, tidak pernah disimpan).
     Sekali per sales per hari per jenis: localStorage 'hxl-rec'
     {d:'YYYY-MM-DD', k:{'day:hendri':1,...}} (+ cadangan di memori).
     Simulasi hanya ditandai di memori — tes di HP tidak memakan jatah
     momen asli hari itu. */
  var LS_REC = 'hxl-rec', recMem = {}, simAdd = {}, simDay = '';
  function recSeen(type, id, sim) {
    var tk = HX.todayKey(), k = type + ':' + id;
    if (recMem[(sim ? 'sim|' : '') + tk + '|' + k]) return true;
    if (sim) return false;
    try { var o = JSON.parse(lsGet(LS_REC) || 'null'); return !!(o && o.d === tk && o.k && o.k[k]); } catch (e) { return false; }
  }
  function recMark(type, id, sim, persist) {
    var tk = HX.todayKey(), k = type + ':' + id;
    recMem[(sim ? 'sim|' : '') + tk + '|' + k] = 1;
    if (sim || !persist) return;
    var o = null;
    try { o = JSON.parse(lsGet(LS_REC) || 'null'); } catch (e) { }
    if (!o || o.d !== tk || !o.k) o = { d: tk, k: {} };
    o.k[k] = 1;
    lsSet(LS_REC, JSON.stringify(o));
  }
  function findRecords(list) {
    var tk = HX.todayKey(), groups = {}, order = [], out = [], inData = {};
    if (simDay !== tk) { simDay = tk; simAdd = {}; }
    // penjualan "asli" yang ternyata belum ada di allData (mis. event buatan
    // modul lain) dihitung seperti simulasi, supaya garis rekor tidak salah
    todayList().forEach(function (e) { if (e && e.ts) inData[e.ts] = 1; });
    list.forEach(function (s) {
      if (!s || !rxSeller(s.sp)) return;
      var id = norm(s.sp);
      if (!groups[id]) { groups[id] = []; order.push(id); }
      groups[id].push(s);
    });
    order.forEach(function (id) {
      var g = groups[id].slice().sort(function (a, b) { return (+a.ts || 0) - (+b.ts || 0); });
      var d = recDay(g[0].sp), m = recMonth(g[0].sp), add = 0, sim = 0, anySim = false, missing = 0;
      g.forEach(function (s) {
        var r = +s.revenue || 0; add += r;
        if (s.sim) { sim += r; anySim = true; } else if (!inData[s.ts]) missing += r;
      });
      // penjualan asli sudah ada di allData; simulasi ditambahkan di sini
      // (tumpukan simulasi tidak pernah memengaruhi penjualan asli)
      var prevSim = simAdd[id] || 0;
      if (anySim) simAdd[id] = prevSim + sim;
      [['day', d, d.today], ['month', m, m.current]].forEach(function (x) {
        var type = x[0], r = x[1], after = x[2] + (anySim ? prevSim + sim : 0) + missing, before = after - add;
        if (!r.eligible || !(before <= r.best && after > r.best)) return;
        // penjualan yang tepat melewati garis rekor
        var acc = before, cause = g[g.length - 1];
        for (var i = 0; i < g.length; i++) { acc += +g[i].revenue || 0; if (acc > r.best) { cause = g[i]; break; } }
        if (recSeen(type, id, !!cause.sim)) return;
        recMark(type, id, !!cause.sim, false);
        var series = rxSeries(id, type, type === 'month' ? 3 : 6);
        series.push(after);
        out.push({
          kind: 'rec', type: type, key: 'rec:' + type + ':' + id, id: id,
          sp: String(cause.sp || r.sp).trim(), team: cause.team || r.team,
          value: after, best: r.best, bestKey: type === 'month' ? r.bestMonth : r.bestDate,
          sales: g, n: 0, total: 0, last: +cause.ts || Date.now(), at: Date.now(),
          sim: !!cause.sim, own: !!cause.own, series: series
        });
      });
    });
    return out;
  }
  // penjualan lain dari sales yang sama saat momen rekornya tampil / menunggu
  function recAbsorb(s) {
    if (!s || !rxSeller(s.sp)) return false;
    var id = norm(s.sp), hit = false, r = +s.revenue || 0;
    Q.forEach(function (q) { if (q.kind === 'rec' && q.id === id) { q.value += r; q.sales.push(s); hit = true; } });
    if (cur && cur.kind === 'island' && cur.it.kind === 'rec' && cur.it.id === id && cur.state !== 'closing') {
      cur.it.value += r; cur.it.sales.push(s); cur.refresh(); hit = true;
    }
    if (hit && s.sim) simAdd[id] = (simAdd[id] || 0) + r;
    return hit;
  }

  /* ── item antrean ───────────────────────────────────────────────── */
  function saleItem(s) {
    var ch = !!(s.channel || HX.isChannel(s.sp)), t = +s.ts || Date.now();
    return {
      kind: ch ? 'ch' : 'sale',
      key: ch ? 'ch:' + norm(s.sp) : 'sp:' + norm(s.sp) + '|' + norm(s.team),
      sp: s.sp, team: s.team, sales: [s], n: 1, total: +s.revenue || 0,
      first: t, last: t, at: Date.now(), sim: !!s.sim
    };
  }
  function absorb(it, s) {
    it.sales.push(s); it.n++;
    it.total += (+s.revenue || 0);
    it.last = Math.max(it.last, +s.ts || Date.now());
    it.at = Date.now();
    if (s.sim) it.sim = true;
  }
  function near(it, s) { return Math.abs((+s.ts || Date.now()) - it.last) <= MERGE_MS; }
  function sumItem(list) {
    var it = { kind: 'sum', key: 'sum', n: 0, total: 0, last: 0, lastSp: '', at: Date.now() };
    list.forEach(function (s) { addToSum(it, s); });
    return it;
  }
  function addToSum(it, s) {
    if (s.kind) {                                       // item lain yang dilebur
      it.n += s.n; it.total += s.total;
      if (s.last >= it.last) { it.last = s.last; it.lastSp = s.sp; }
      return;
    }
    it.n++; it.total += (+s.revenue || 0);
    var t = +s.ts || Date.now();
    if (t >= it.last) { it.last = t; it.lastSp = s.sp; }
    it.at = Date.now();
  }
  function prodLine(it) {
    if (it.kind === 'ch') return it.n === 1 ? 'pesanan baru' : it.n + ' pesanan';
    if (it.n === 1) {
      var s = it.sales[0], u = +s.units || 1;
      return (u > 1 ? u + '× ' : '') + (s.prod || 'Produk');
    }
    var names = [];
    it.sales.forEach(function (x) { if (x.prod && names.indexOf(x.prod) < 0) names.push(x.prod); });
    return it.n + ' produk · ' + names.join(', ');
  }

  /* ── kapsul rekor: grafik mini dari data asli ─────────────────────────
     Harian: garis 6 hari aktif terakhir + hari ini. Bulanan: batang 3 bulan
     terakhir + bulan ini. Garis putus-putus = rekor lama; titik emas =
     angka baru yang melewatinya. */
  var UP = '<svg viewBox="0 0 10 10" width="7" height="7" aria-hidden="true"><path d="M5 1.2 9.2 8.4H.8z" fill="currentColor"/></svg>';
  var GX0 = 13, GX1 = 39, GY0 = 15, GY1 = 36, GBW = 4.6;
  function gainText(it) {
    var g = it.best > 0 ? (it.value / it.best - 1) * 100 : 0;
    if (!(g > 0)) return '';
    var t = Math.max(1, Math.round(g * 10));              // persepuluhan persen, minimal 0,1
    return '+' + (t < 100 ? (t % 10 ? fixed(t, 1) : String(t / 10)) : String(Math.round(g))) + '%';
  }
  function longDate(k) {
    if (!k) return '';
    var a = String(k).split('-');
    return (+a[2]) + ' ' + (BULAN[+a[1] - 1] || '') + (a[0] !== HX.todayKey().slice(0, 4) ? ' ' + a[0] : '');
  }
  // angka lama dalam satuan & desimal angka baru (titik awal odometer).
  // Satuan dan jumlah desimal diambil dari string fRp angka baru; dibulatkan
  // dengan bilangan bulat seperti fRp. Sama persis -> null (tanpa angka awal).
  function shortLike(n, like) {
    var m = /Rp (\d+)(?:,(\d+))?(jt|M|rb)?/.exec(like);
    if (!m) return null;
    var u = m[3] || '', dp = (m[2] || '').length;
    var div = u === 'M' ? 1e9 : u === 'jt' ? 1e6 : u === 'rb' ? 1e3 : 1;
    var s = 'Rp ' + fixed(Math.max(0, Math.round(n / (div / Math.pow(10, dp)))), dp) + u;
    return s === like ? null : s;
  }
  function glyphHTML(it) {
    var v = it.series && it.series.length > 1 ? it.series : [it.best * 0.6, it.value];
    var top = Math.max(it.value, it.best) || 1, n = v.length, h = '', px, py;
    var Y = function (x) { return GY1 - Math.max(0, Math.min(x, top)) / top * (GY1 - GY0); };
    var lvl = Y(it.best).toFixed(2);
    h += '<i class="hxl-gl-lvl" style="top:' + lvl + 'px"></i><i class="hxl-gl-lvl hxl-gl-gold" style="top:' + lvl + 'px"></i>';
    if (it.type === 'month') {
      var step = n > 1 ? (GX1 - GX0 - GBW) / (n - 1) : 0, x0 = n > 1 ? GX0 : (GX0 + GX1 - GBW) / 2;
      v.forEach(function (x, i) {
        var bh = Math.max(1.5, GY1 - Y(x));
        h += '<i class="hxl-gl-bar' + (i === n - 1 ? ' is-now' : '') + '" style="left:' + (x0 + i * step).toFixed(2) + 'px;top:' +
             (GY1 - bh).toFixed(2) + 'px;height:' + bh.toFixed(2) + 'px"></i>';
      });
      px = x0 + (n - 1) * step + GBW / 2; py = Y(v[n - 1]);
    } else {
      var pts = v.map(function (x, i) { return [GX0 + (n > 1 ? i * (GX1 - GX0) / (n - 1) : 0), Y(x)]; }), len = 0;
      for (var i = 1; i < pts.length; i++) len += Math.sqrt(Math.pow(pts[i][0] - pts[i - 1][0], 2) + Math.pow(pts[i][1] - pts[i - 1][1], 2));
      len = Math.ceil(len + 2);
      h += '<svg viewBox="0 0 52 52" width="52" height="52" aria-hidden="true"><path class="hxl-gl-line" d="M' +
           pts.map(function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('L') +
           '" stroke-dasharray="' + len + ' ' + len + '" data-len="' + len + '"/></svg>';
      px = pts[n - 1][0]; py = pts[n - 1][1];
    }
    var at = 'left:' + px.toFixed(2) + 'px;top:' + py.toFixed(2) + 'px';
    return '<span class="hxl-glyph" aria-hidden="true">' + h + '<i class="hxl-gl-halo" style="' + at + '"></i><i class="hxl-gl-peak" style="' + at + '"></i></span>';
  }

  // isi tiap jenis kapsul: chip | baris 1 | baris 2 | nominal | keterangan
  var CLOCK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.6 12a8.4 8.4 0 1 0 2.5-6"/><path d="M3.4 4.2v4.4h4.4"/><path d="M12 7.6V12l3 1.9"/></svg>';
  var RING_C = 2 * Math.PI * 16;
  function view(it) {
    switch (it.kind) {
      case 'sale': return {
        chip: '<span class="hxl-chip">' + esc(mono(it.team, it.sp)) + '<b class="hxl-badge"></b></span>',
        name: nice(it.sp), l2: prodLine(it), amt: '+' + full(it.total), sub: ago(it.last),
        say: 'Closing masuk: ' + nice(it.sp) + ', ' + prodLine(it) + ', ' + full(it.total)
      };
      case 'ch': return {
        chip: '<span class="hxl-tag">' + esc(it.sp) + '</span>',
        name: '', l2: prodLine(it), amt: '+' + full(it.total), sub: '',
        l2S: [it.n === 1 ? 'baru' : '×' + it.n],
        say: it.sp + ': ' + prodLine(it) + ', ' + full(it.total)
      };
      case 'sum': return {
        chip: '<span class="hxl-chip">+' + it.n + '</span>',
        name: it.n + ' penjualan baru', l2: 'terakhir: ' + nice(it.lastSp), amt: '+' + short(it.total), sub: ago(it.last),
        say: it.n + ' penjualan baru, total ' + short(it.total) + ', terakhir ' + nice(it.lastSp)
      };
      case 'since': return {
        chip: '<span class="hxl-chip">' + CLOCK + '</span>',
        name: 'Sejak terakhir dibuka (' + gapText(it.gap) + ')',
        l2: '+' + it.n + ' penjualan · terakhir: ' + nice(it.lastSp), amt: '+' + short(it.total), sub: 'hari ini',
        // HP sempit: bentuk pendek (jeda waktunya pindah ke bawah nominal)
        nameS: 'Sejak dibuka', subS: gapText(it.gap), l2S: ['+' + it.n + ' penjualan · ' + nice(it.lastSp), '+' + it.n + ' penjualan'],
        say: 'Sejak terakhir dibuka, ' + gapText(it.gap) + ': ' + it.n + ' penjualan, ' + short(it.total)
      };
      case 'rec': {
        var isM = it.type === 'month', when = isM ? 'bulan ini' : 'hari ini';
        var old = isM ? monthLabel(it.bestKey) : dateLabel(it.bestKey);
        var longOld = isM ? old : longDate(it.bestKey);
        return {
          chip: glyphHTML(it),
          kick: isM ? 'Rekor bulanan pribadi' : 'Rekor pribadi baru', gain: gainText(it),
          name: nice(it.sp), val: short(it.value), when: when,
          l2: 'rekor lama ' + short(it.best) + (old ? ' · ' + old : ''), amt: '', sub: '',
          say: (isM ? 'Rekor bulanan pribadi: ' : 'Rekor pribadi baru: ') + nice(it.sp) + ', ' + short(it.value) + ' ' + when +
               '. Rekor lama ' + short(it.best) + (longOld ? ', ' + longOld : '') + '.'
        };
      }
      case 'goal': return {
        chip: '<span class="hxl-ring"><svg viewBox="0 0 38 38" aria-hidden="true"><circle class="trk" cx="19" cy="19" r="16"/>' +
              '<circle class="arc" cx="19" cy="19" r="16" stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="' +
              (RING_C * (1 - it.pct / 100)).toFixed(2) + '"/></svg><b>' + it.pct + '</b></span>',
        // tanpa kolom kanan: judulnya harus utuh di layar HP
        name: 'Target hari ini tembus ' + it.pct + '%',
        l2: (it.by && it.by.sp ? 'didorong ' + nice(it.by.sp) + ' · ' : '') + short(it.revenue) + ' dari ' + short(it.target).replace('Rp ', ''),
        l2S: [(it.by && it.by.sp ? 'didorong ' + nice(it.by.sp) + ' · ' : '') + short(it.revenue)],
        amt: '', sub: '',
        say: 'Target hari ini tembus ' + it.pct + ' persen' + (it.by && it.by.sp ? ', didorong ' + nice(it.by.sp) : '')
      };
    }
    return { chip: '', name: '', l2: '', amt: '', sub: '', say: '' };
  }
  function bodyHTML(it, v) {
    if (it.kind === 'rec') {
      return v.chip + '<span class="hxl-main">' +
        '<span class="hxl-kick"><span class="hxl-kt">' + esc(v.kick) + '</span>' +
          (v.gain ? '<span class="hxl-gain">' + UP + '<b>' + esc(v.gain) + '</b></span>' : '') + '</span>' +
        '<span class="hxl-l1"><span class="hxl-name">' + esc(v.name) + '</span><span class="hxl-sep">·</span>' +
          '<span class="hxl-rv"></span><span class="hxl-when">' + esc(v.when) + '</span></span>' +
        '<span class="hxl-l2wrap"><span class="hxl-l2">' + esc(v.l2) + '</span></span></span>';
    }
    var main = it.kind === 'ch'
      ? '<span class="hxl-main"><span class="hxl-l2wrap"><span class="hxl-l2">' + esc(v.l2) + '</span></span></span>'
      : '<span class="hxl-main"><span class="hxl-l1"><span class="hxl-name">' + esc(v.name) + '</span><span class="hxl-rank"></span></span>' +
        '<span class="hxl-l2wrap"><span class="hxl-l2">' + esc(v.l2) + '</span></span></span>';
    var side = v.amt ? '<span class="hxl-side"><span class="hxl-amt"></span>' + (v.sub ? '<span class="hxl-sub">' + esc(v.sub) + '</span>' : '') + '</span>' : '';
    return v.chip + main + side;
  }

  /* ── antrean ────────────────────────────────────────────────────── */
  var Q = [], cur = null, pumpT = 0, guardT = 0;
  function stale(it, t) {
    // banner 100% dan ringkasan "sejak terakhir dibuka" boleh menunggu lebih
    // lama (mis. aplikasi dibuka di tab latar)
    if (it.kind === 'goal100' || it.kind === 'since' || it.kind === 'rec') return t - it.at > STALE_100_MS;
    return t - it.at > STALE_MS;
  }
  function pump() {
    clearTimeout(pumpT); pumpT = 0;
    if (cur) return;
    var t = Date.now();
    Q = Q.filter(function (it) { return !stale(it, t); });
    if (!Q.length) return;
    if (D.hidden) return;                         // visibilitychange memanggil lagi
    var wait = 0;
    if (HX.busy()) wait = 700;
    else if (Q[0].notBefore && Q[0].notBefore > t) wait = Q[0].notBefore - t;
    if (wait) { pumpT = setTimeout(pump, wait); return; }
    var it = Q.shift();
    if (it.kind === 'goal100') banner(it); else island(it);
  }
  // jangan biarkan antrean jadi parade: >3 kapsul penjualan menunggu -> 1 ringkasan
  function compact() {
    var sales = Q.filter(function (q) { return q.kind === 'sale' || q.kind === 'ch'; });
    if (sales.length <= 3) return;
    var sum = null, out = [];
    Q.forEach(function (q) {
      if (q.kind === 'sale' || q.kind === 'ch' || q.kind === 'sum') {
        if (!sum) { sum = { kind: 'sum', key: 'sum', n: 0, total: 0, last: 0, lastSp: '', at: Date.now() }; out.push(sum); }
        addToSum(sum, q.kind === 'sum' ? { kind: 'sum', n: q.n, total: q.total, last: q.last, sp: q.lastSp } : q);
      } else out.push(q);
    });
    Q = out;
  }
  function addSale(s) {
    var it = saleItem(s);
    if (cur && cur.it && cur.it.key === it.key && cur.state !== 'closing' && near(cur.it, s)) {
      absorb(cur.it, s); cur.refresh(); return;
    }
    for (var i = 0; i < Q.length; i++) {
      if (Q[i].key === it.key && near(Q[i], s)) { absorb(Q[i], s); return; }
    }
    Q.push(it);
    compact();
  }
  function addSummary(list) {
    if (cur && cur.it && cur.it.kind === 'sum' && cur.state !== 'closing') {
      list.forEach(function (s) { addToSum(cur.it, s); }); cur.refresh(); return;
    }
    for (var i = 0; i < Q.length; i++) if (Q[i].kind === 'sum') { list.forEach(function (s) { addToSum(Q[i], s); }); return; }
    Q.push(sumItem(list));
    compact();
  }
  var done100 = {};
  function key100() { return 'hxl-target100-' + HX.todayKey(); }
  function addGoals(goals) {
    var top = null, from = 100;
    goals.forEach(function (g) {
      if (!g || !(g.pct > 0)) return;
      if (!top || g.pct > top.pct) top = g;
      if (typeof g.from === 'number') from = Math.min(from, g.from);
    });
    if (!top) return;
    var T = +top.target || HX.target() || 0, rev = +top.revenue || HX.todayRevenue() || 0;
    Q = Q.filter(function (q) { return q.kind !== 'goal'; });       // yang lebih rendah tidak perlu lagi
    if (top.pct >= 100) {
      var k = key100();
      if (done100[k] || lsGet(k)) return;
      if (Q.some(function (q) { return q.kind === 'goal100'; })) return;
      // penjualan yang mendorong lewat 100% sudah diceritakan di banner
      if (top.by) Q = Q.filter(function (q) {
        return !(q.kind === 'sale' && q.n === 1 && norm(q.sp) === norm(top.by.sp) && norm(q.team) === norm(top.by.team) &&
                 Math.round(q.total) === Math.round(+top.by.revenue || 0));
      });
      Q.unshift({ kind: 'goal100', key: 'goal100', at: Date.now(), from: from, revenue: rev, target: T, by: top.by || null });
      // kapsul yang sedang tampil dipersingkat — momen 100% jangan menunggu lama
      if (cur && cur.kind === 'island') {
        if (cur.state === 'hold') cur.close(false); else cur.shortHold = true;
      }
      return;
    }
    Q.push({ kind: 'goal', key: 'goal', at: Date.now(), pct: top.pct, from: from, revenue: rev, target: T, by: top.by || null });
  }

  /* ── masuk dari HX ──────────────────────────────────────────────────
     'sale' (satu-satu) lalu 'sales' (semuanya) dikirim berurutan dalam
     satu tick untuk penjualan yang SAMA (objek yang sama) — dikumpulkan
     dulu, diproses sekali di tick berikutnya. 'goal' ikut diproses SETELAH
     penjualannya, supaya urutannya: closing dulu, baru pencapaian. */
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null, seenArr = [];
  var buf = [], gbuf = [], flushT = 0;
  function take(s) {
    if (!s || typeof s !== 'object') return;
    if (seen) { if (seen.has(s)) return; seen.add(s); }
    else { if (seenArr.indexOf(s) >= 0) return; seenArr.push(s); if (seenArr.length > 200) seenArr.shift(); }
    buf.push(s); schedule();
  }
  function schedule() { if (!flushT) flushT = setTimeout(flush, 0); }
  function flush() {
    flushT = 0;
    var all = buf, goals = gbuf, recs = [], covered = {};
    buf = []; gbuf = [];
    // 1. rekor pribadi — juga dari HP penjualnya sendiri (s.own)
    try { recs = findRecords(all); } catch (e) { console.warn('[HX live] rekor', e); recs = []; }
    recs.forEach(function (r) { covered[r.id] = 1; });
    // 2. penjualan yang sudah diceritakan kapsul rekor tidak diumumkan lagi;
    //    penjualan berikutnya dari sales yang rekornya sedang tampil/menunggu
    //    ikut menambah angka rekornya
    var batch = all.filter(function (s) {
      if (rxSeller(s.sp) && covered[norm(s.sp)]) return false;
      if (recAbsorb(s)) return false;
      return !s.own;
    });
    if (batch.length > 3) addSummary(batch);
    else batch.forEach(addSale);
    if (recs.length) addRecords(recs);
    if (goals.length) addGoals(goals);
    pump();
  }
  // rekor: prioritas di atas kapsul penjualan biasa (di belakang banner 100%)
  function addRecords(recs) {
    recs.forEach(function (r) {
      // kapsul penjualan sales ini yang masih menunggu -> dilebur ke rekornya
      Q = Q.filter(function (q) {
        if (q.kind === 'sale' && norm(q.sp) === r.id) { r.sales = q.sales.concat(r.sales); return false; }
        return true;
      });
      var at = 0;
      while (at < Q.length && (Q[at].kind === 'goal100' || Q[at].kind === 'rec' || Q[at].kind === 'since')) at++;
      Q.splice(at, 0, r);
      // kapsul penjualan sales yang sama sedang tampil -> dipersingkat,
      // momen rekornya langsung menyusul
      if (cur && cur.kind === 'island' && cur.it && cur.it.kind === 'sale' && norm(cur.it.sp) === r.id && cur.state !== 'closing') {
        if (cur.state === 'hold') cur.close(false); else cur.shortHold = true;
      }
    });
  }
  HX.on('sale', take);
  HX.on('sales', function (arr) { if (arr && arr.forEach) arr.forEach(take); });
  HX.on('goal', function (g) { if (g) { gbuf.push(g); schedule(); } });

  /* ── kapsul ─────────────────────────────────────────────────────── */
  function fitWidth(it, H, vw) {
    var v = view(it), m = D.createElement('div');
    m.className = 'hxl-island hxl-k-' + it.kind + ' hxl-measure';
    m.style.setProperty('--h', H + 'px');
    m.innerHTML = '<div class="hxl-body">' + bodyHTML(it, v) + '</div>';
    var a = m.querySelector('.hxl-amt'); if (a) a.textContent = v.amt;
    D.body.appendChild(m);
    var w = Math.ceil(m.firstChild.getBoundingClientRect().width);
    D.body.removeChild(m);
    // ruang untuk penggabungan berikutnya (nominal memanjang 1–2 digit)
    return Math.max(230, Math.min(w + 24, vw - 24, 380));
  }

  function island(it) {
    var R = still(), vw = innerWidth, desk = vw >= 769;
    var small = it.kind === 'ch', rec = it.kind === 'rec';
    var H = small ? 44 : rec ? 76 : 62;
    var W = small ? fitWidth(it, H, vw) : Math.min(vw - 24, desk ? (rec ? 440 : 420) : 400);
    var off = (W - H) / 2, s0 = Math.min(1, 11 / H);
    var big = (it.kind === 'sale' && it.total >= BIG);
    var v = view(it);

    var el = D.createElement('div');
    el.className = 'hxl-island hxl-k-' + it.kind + (big ? ' is-big' : '');
    el.style.setProperty('--w', W + 'px');
    el.style.setProperty('--h', H + 'px');
    var top = topY();
    el.style.top = top + 'px';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', v.say);
    el.innerHTML =
      '<i class="hxl-shade" aria-hidden="true"></i><i class="hxl-bloom" aria-hidden="true"></i>' +
      '<span class="hxl-shape" aria-hidden="true"><i class="hxl-cap hxl-capL"></i><i class="hxl-cap hxl-capR"></i><i class="hxl-mid"></i></span>' +
      '<i class="hxl-glass" aria-hidden="true"></i>' + (rec ? '<i class="hxl-rim" aria-hidden="true"></i>' : '') +
      '<span class="hxl-body" aria-hidden="true">' + bodyHTML(it, v) + '<i class="hxl-sweep"></i><i class="hxl-prog"></i></span>' +
      '<i class="hxl-seed" aria-hidden="true"></i>';
    D.body.appendChild(el);
    var q = function (s) { return el.querySelector(s); };
    var P = {
      shape: q('.hxl-shape'), capL: q('.hxl-capL'), capR: q('.hxl-capR'), mid: q('.hxl-mid'),
      glass: q('.hxl-glass'), body: q('.hxl-body'), seed: q('.hxl-seed'), bloom: q('.hxl-bloom'), shade: q('.hxl-shade'),
      sweep: q('.hxl-sweep'), prog: q('.hxl-prog'), chip: q('.hxl-chip,.hxl-ring,.hxl-tag,.hxl-glyph'),
      badge: q('.hxl-badge'), name: q('.hxl-name'), rank: q('.hxl-rank'), l2wrap: q('.hxl-l2wrap'),
      amt: q('.hxl-amt'), sub: q('.hxl-sub'), arc: q('.hxl-ring .arc'),
      rim: q('.hxl-rim'), rv: q('.hxl-rv'), gain: q('.hxl-gain'), gainT: q('.hxl-gain b'), glyph: q('.hxl-glyph'),
      peak: q('.hxl-gl-peak'), halo: q('.hxl-gl-halo')
    };
    // posisi akhir ditulis langsung (animasi hanya menimpa sementara)
    P.capL.style.transform = 'translateX(' + (-off) + 'px)';
    P.capR.style.transform = 'translateX(' + off + 'px)';
    P.seed.style.top = Math.round(H * s0 / 2 - 5) + 'px';

    var c = cur = {
      kind: 'island', it: it, el: el, P: P, W: W, H: H, top: top, off: off, s0: s0, R: R, big: big,
      state: 'opening', prog: null, timer: 0, amtStr: v.amt, l2: v.l2, n: it.n || 1, hover: false
    };
    c.close = function (quick) { closeIsland(c, quick); };
    c.refresh = function () { refreshIsland(c); };
    say(v.say);
    guard();

    var cy = top + H / 2, power = rec ? 0.9 : it.kind === 'ch' ? 0.25 : big ? 1 : it.kind === 'sum' || it.kind === 'since' ? 0.7 : it.kind === 'goal' ? 0.6 : 0.5;
    // momen rekor dipakai jatahnya (sekali per sales per hari per jenis)
    if (rec) recMark(it.type, it.id, it.sim, true);
    if (R) {
      // Kurangi Gerak: muncul pelan saja, tanpa gerak
      P.body.style.opacity = '1'; P.glass.style.opacity = '1'; P.shade.style.opacity = '1';
      if (v.amt) odo(P.amt, v.amt, null, 0);
      if (rec) { recFx(c, 0, true); recFit(c); }
      fitAlt(c, v);
      if (P.rank) paintRank(c, true);
      anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
      el.classList.add('is-live');
      HX.emit('ripple', { x: innerWidth / 2, y: cy, power: power });
      c.timer = setTimeout(function () { startHold(c); }, 240);
      return;
    }

    var AT = 130, EXP = 760, blur = !lowTier();
    // 1. titik lahir
    anim(P.seed, [
      { opacity: 0, transform: 'scale(.2)' },
      { opacity: 1, transform: 'scale(1.35)', offset: 0.55 },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    anim(P.seed, [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: AT + 170, easing: 'ease-out', fill: 'forwards' });
    // 2. mekar: grup diskala seragam (titik -> lingkaran), lalu tutup melebar
    anim(P.shape, springKF(EXP - 120, s0, 1, function (x) { return { transform: 'scale(' + x.toFixed(4) + ')' }; }, SPRING_SOFT),
      { duration: EXP - 120, delay: AT, fill: 'backwards' });
    // bentuk gelap baru terlihat SETELAH titik hijau menutupinya
    anim(P.shape, [{ opacity: 0 }, { opacity: 1 }], { duration: 90, delay: 70, fill: 'backwards' });
    var wide = { duration: EXP, delay: AT + 45, fill: 'backwards' };
    anim(P.capL, springKF(EXP, 0, off, function (x) { return { transform: 'translateX(' + (-x).toFixed(2) + 'px)' }; }), wide);
    anim(P.capR, springKF(EXP, 0, off, function (x) { return { transform: 'translateX(' + x.toFixed(2) + 'px)' }; }), wide);
    anim(P.mid, springKF(EXP, 0, 1, function (x) { return { transform: 'scaleX(' + Math.max(0, x).toFixed(4) + ')' }; }), wide);
    // 3. kaca & isi (nilai akhir statis; animasi hanya menutupi awalnya)
    P.glass.style.opacity = '1'; P.body.style.opacity = '1'; P.shade.style.opacity = '1';
    anim(P.glass, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: AT + 300, easing: 'ease-out', fill: 'backwards' });
    // bayangan pemisah (halo gelap) ikut kaca: baru muncul saat kapsul hampir selebar penuh
    anim(P.shade, [{ opacity: 0 }, { opacity: 1 }], { duration: 460, delay: AT + 240, easing: 'ease-out', fill: 'backwards' });
    var bIn = [{ opacity: 0, transform: 'translateY(4px) scale(.965)' }, { opacity: 1, transform: 'none' }];
    if (blur) { bIn[0].filter = 'blur(6px)'; bIn[1].filter = 'blur(0px)'; }
    anim(P.body, bIn, { duration: 420, delay: AT + 250, easing: EASE_OUT, fill: 'backwards' });
    if (P.chip) anim(P.chip, springKF(620, 0.35, 1, function (x) { return { transform: 'scale(' + x.toFixed(4) + ')' }; }),
      { duration: 620, delay: AT + 260, fill: 'backwards' });
    if (P.arc) {
      var f = Math.max(0, Math.min(it.pct, it.from || 0));
      anim(P.arc, [{ strokeDashoffset: (RING_C * (1 - f / 100)).toFixed(2) }, { strokeDashoffset: (RING_C * (1 - it.pct / 100)).toFixed(2) }],
        { duration: 1000, delay: AT + 380, easing: EASE_OUT, fill: 'backwards' });
    }
    var rolled = v.amt ? odo(P.amt, v.amt, null, AT + 280, it.kind === 'ch' ? 420 : 460) : 0;
    if (P.rank) setTimeout(function () { if (cur === c) paintRank(c, false); }, Math.max(AT + 700, rolled - 150));
    // 4. closing besar: cahaya mekar + kilau menyapu
    if (big) bigFx(c, AT + 260);
    if (rec) { recFx(c, AT, false); recFit(c); }
    fitAlt(c, v);
    // 5. riak di wallpaper, tepat saat titik mekar
    setTimeout(function () { if (cur === c) HX.emit('ripple', { x: innerWidth / 2, y: cy, power: power }); }, AT);
    el.classList.add('is-live');
    c.timer = setTimeout(function () { startHold(c); }, AT + EXP - 120);
  }

  function bigFx(c, delay) {
    var P = c.P;
    anim(P.bloom, [
      { opacity: 0, transform: 'scale(.55)' },
      { opacity: 0.95, transform: 'scale(1.08)', offset: 0.35 },
      { opacity: 0.42, transform: 'scale(1)' }
    ], { duration: 1300, delay: delay, easing: 'ease-out', fill: 'both' });
    anim(P.sweep, [{ transform: 'translateX(-140%) skewX(-16deg)' }, { transform: 'translateX(330%) skewX(-16deg)' }],
      { duration: 1050, delay: delay + 380, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' });
  }

  /* momen rekor: angka bergulir dari rekor lama ke angka baru, grafik mini
     tergambar menembus garis rekor, lalu di titik tembus: titik emas,
     tepi emas menyala, kilau, cahaya. Nilai akhir semua statis — animasi
     hanya menutupi awalnya (fill backwards), jadi Kurangi Gerak / HP yang
     tidak punya Web Animations langsung melihat keadaan akhir. */
  function recFx(c, AT, R) {
    var P = c.P, it = c.it, vStr = short(it.value);
    c.amtStr = vStr;
    if (P.rim) P.rim.style.opacity = '0.42';
    var gold = P.glyph ? P.glyph.querySelector('.hxl-gl-gold') : null;
    if (gold) gold.style.opacity = '1';
    if (R) { odo(P.rv, vStr, null, 0); return; }
    var CROSS = AT + 1000;                       // saat garis rekor ditembus
    odo(P.rv, vStr, shortLike(it.best, vStr), AT + 300, 1000);
    var g = P.glyph;
    if (g) {
      var lv = g.querySelector('.hxl-gl-lvl');
      anim(lv, [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }],
        { duration: 460, delay: AT + 280, easing: EASE_OUT, fill: 'backwards' });
      if (gold) anim(gold, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: CROSS - 80, easing: 'ease-out', fill: 'backwards' });
      var ln = g.querySelector('.hxl-gl-line');
      if (ln) {
        var L = +ln.getAttribute('data-len') || 80;
        anim(ln, [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
          { duration: 720, delay: AT + 360, easing: 'cubic-bezier(.5,.05,.3,1)', fill: 'backwards' });
      }
      var bs = g.querySelectorAll('.hxl-gl-bar');
      Array.prototype.forEach.call(bs, function (b, i) {
        var last = i === bs.length - 1;
        if (last) anim(b, springKF(640, 0, 1, function (x) { return { transform: 'scaleY(' + Math.max(0, x).toFixed(4) + ')' }; }),
          { duration: 640, delay: CROSS - 420, fill: 'backwards' });
        else anim(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
          { duration: 420, delay: AT + 340 + i * 80, easing: EASE_OUT, fill: 'backwards' });
      });
      if (P.peak) anim(P.peak, [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1.7)', offset: 0.45 }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 540, delay: CROSS, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      if (P.halo) anim(P.halo, [{ opacity: 0.95, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(2.6)' }],
        { duration: 950, delay: CROSS + 40, easing: 'cubic-bezier(.1,.7,.3,1)' });
    }
    if (P.gain) anim(P.gain, [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
      { duration: 440, delay: CROSS + 80, easing: EASE_OUT, fill: 'backwards' });
    // tepi emas menyala lalu tenang di 42%
    if (P.rim) anim(P.rim, [{ opacity: 0 }, { opacity: 1, offset: 0.22 }, { opacity: 0.42 }],
      { duration: 1600, delay: CROSS, easing: 'ease-out', fill: 'backwards' });
    anim(P.bloom, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 0.9, transform: 'scale(1.06)', offset: 0.3 }, { opacity: 0.3, transform: 'scale(1)' }],
      { duration: 1600, delay: CROSS - 120, easing: 'ease-out', fill: 'both' });
    if (!lowTier()) anim(P.sweep, [{ transform: 'translateX(-140%) skewX(-16deg)' }, { transform: 'translateX(330%) skewX(-16deg)' }],
      { duration: 1150, delay: CROSS + 30, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' });
    // HP penjualnya sendiri (Android): getar pendek tepat saat tembus
    if (it.own && navigator.vibrate) setTimeout(function () { if (cur === c) { try { navigator.vibrate([12, 40, 20]); } catch (e) { } } }, CROSS);
  }
  // teks yang tidak muat (HP 320px) -> bentuk pendeknya (kalau ada)
  function fitAlt(c, v) {
    var P = c.P;
    try {
      if (v.nameS && P.name && P.name.scrollWidth > P.name.clientWidth + 1) {
        P.name.textContent = v.nameS;
        if (v.subS && P.sub) P.sub.textContent = v.subS;
      }
      var l2 = P.l2wrap ? P.l2wrap.querySelector('.hxl-l2:not(.is-old)') : null;
      for (var i = 0; v.l2S && l2 && i < v.l2S.length && l2.scrollWidth > l2.clientWidth + 1; i++) l2.textContent = v.l2S[i];
    } catch (e) { }
  }
  // layar sempit (320px) + nilai panjang ('Rp 116,78jt'): nama sales tidak
  // boleh terpotong -> 'hari ini' / 'bulan ini' disembunyikan (judul kapsul
  // sudah menyebut jenis rekornya). Satu kali baca tata letak per kapsul.
  function recFit(c) {
    var n = c.P.name;
    if (!n) return;
    try {
      c.el.classList.remove('is-tight');
      if (n.scrollWidth > n.clientWidth + 1) c.el.classList.add('is-tight');
    } catch (e) { }
  }
  // penjualan berikutnya dari sales yang sama saat kapsul rekornya tampil
  function recRefresh(c) {
    var it = c.it, P = c.P, R = c.R, v = view(it), vStr = short(it.value);
    c.el.setAttribute('aria-label', v.say);
    say(v.say);
    if (vStr !== c.amtStr) { odo(P.rv, vStr, c.amtStr, 60, 520); c.amtStr = vStr; recFit(c); }
    if (P.gainT && v.gain) P.gainT.textContent = v.gain;
    if (!R) {
      anim(P.shape, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: 0.3 }, { transform: 'scale(.995)', offset: 0.68 }, { transform: 'scale(1)' }],
        { duration: 560, easing: 'ease-in-out' });
      anim(P.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.025)', offset: 0.3 }, { transform: 'scale(1)' }],
        { duration: 560, easing: 'ease-in-out' });
      if (P.halo) anim(P.halo, [{ opacity: 0.9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(2.4)' }],
        { duration: 850, easing: 'cubic-bezier(.1,.7,.3,1)' });
    }
    HX.emit('ripple', { x: innerWidth / 2, y: c.top + c.H / 2, power: 0.6 });
    if (c.state === 'hold') { clearTimeout(c.timer); startHold(c); }
  }

  function paintRank(c, instant) {
    var P = c.P, r = rankOf(c.it);
    if (!P.rank || !r) return;
    P.rank.textContent = r === 1 ? '#1 sales hari ini' : 'naik ke #' + r + ' sales';
    P.rank.classList.toggle('is-top', r === 1);
    // layar sempit: nama tidak boleh terpotong demi label -> bentuk pendek,
    // masih terpotong -> label tidak ditampilkan
    try {
      var clip = function () { return P.name && P.name.scrollWidth > P.name.clientWidth + 1; };
      if (clip()) { P.rank.textContent = '#' + r + ' sales'; if (clip()) { P.rank.textContent = ''; return; } }
    } catch (e) { }
    if (!instant) anim(P.rank, [{ opacity: 0, transform: 'translateX(-6px) scale(.9)' }, { opacity: 1, transform: 'none' }],
      { duration: 380, easing: EASE_OUT, fill: 'backwards' });
  }

  function startHold(c) {
    if (cur !== c || c.state === 'closing') return;
    c.state = 'hold';
    var d = c.shortHold ? 1500 : (HOLD[c.it.kind] || HOLD.sale);
    if (c.R) { c.timer = setTimeout(function () { closeIsland(c); }, d); return; }
    if (c.prog) c.prog.cancel();
    c.prog = anim(c.P.prog, [{ opacity: 1, transform: 'scaleX(1)' }, { opacity: 1, transform: 'scaleX(0)' }],
      { duration: d, easing: 'linear', fill: 'both' });
    if (!c.prog) { c.timer = setTimeout(function () { closeIsland(c); }, d); return; }
    c.prog.onfinish = function () { if (cur === c) closeIsland(c); };
    if (c.hover || D.hidden) c.prog.pause();
  }

  // penjualan baru dari sales yang sama masuk saat kapsulnya tampil
  function refreshIsland(c) {
    if (cur !== c || c.state === 'closing') return;
    if (c.it.kind === 'rec') { recRefresh(c); return; }
    var it = c.it, P = c.P, v = view(it), R = c.R;
    c.el.setAttribute('aria-label', v.say);
    say(v.say);
    // baris 2 berganti seperti ticker: yang lama naik, yang baru masuk dari bawah
    if (v.l2 !== c.l2 && P.l2wrap) {
      var old = P.l2wrap.querySelector('.hxl-l2:not(.is-old)');
      var nu = D.createElement('span');
      nu.className = 'hxl-l2'; nu.textContent = v.l2;
      if (old && !R) {
        old.classList.add('is-old');
        P.l2wrap.appendChild(nu);
        var a = anim(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-100%)' }], { duration: 320, easing: EASE_OUT, fill: 'forwards' });
        anim(nu, [{ opacity: 0, transform: 'translateY(100%)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: EASE_OUT, fill: 'backwards' });
        // baris lama dibuang DAN animasinya dibatalkan (fill forwards menahan elemen)
        var rm = function () { if (old.parentNode) old.parentNode.removeChild(old); dropAnim(a); };
        if (a) a.onfinish = rm; else rm();
      } else {
        if (old) old.parentNode.removeChild(old);
        P.l2wrap.appendChild(nu);
      }
      c.l2 = v.l2;
    }
    if (P.name && it.kind !== 'sale' && P.name.textContent !== v.name) P.name.textContent = v.name;
    if (P.chip && it.kind === 'sum') P.chip.textContent = '+' + it.n;
    if (P.sub && v.sub) P.sub.textContent = v.sub;
    fitAlt(c, v);
    // nominal bergulir dari angka lama ke angka baru
    if (v.amt && v.amt !== c.amtStr) { odo(P.amt, v.amt, c.amtStr, 60, 520); c.amtStr = v.amt; }
    // jumlah closing di pojok monogram
    if (P.badge && it.n > 1) {
      P.badge.textContent = it.n;
      if (!R) anim(P.badge, springKF(600, 0.3, 1, function (x) { return { opacity: Math.min(1, x * 1.4), transform: 'scale(' + x.toFixed(4) + ')' }; }),
        { duration: 600, fill: 'forwards' });
      else { P.badge.style.opacity = 1; P.badge.style.transform = 'none'; }
    }
    if (P.rank) { P.rank.textContent = ''; paintRank(c, R); }
    // naik jadi closing besar
    if (it.kind === 'sale' && !c.big && it.total >= BIG) {
      c.big = true; c.el.classList.add('is-big');
      if (!R) bigFx(c, 80);
    }
    if (!R) {
      // "tarikan napas" kecil: kapsul membesar 4% lalu kembali
      anim(c.P.shape, [{ transform: 'scale(1)' }, { transform: 'scale(1.045)', offset: 0.3 }, { transform: 'scale(.994)', offset: 0.68 }, { transform: 'scale(1)' }],
        { duration: 560, easing: 'ease-in-out' });
      anim(c.P.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.03)', offset: 0.3 }, { transform: 'scale(1)' }],
        { duration: 560, easing: 'ease-in-out' });
    }
    HX.emit('ripple', { x: innerWidth / 2, y: c.top + c.H / 2, power: c.big ? 0.8 : 0.4 });
    // waktu tahan dimulai lagi
    if (c.state === 'hold') { clearTimeout(c.timer); startHold(c); }
  }

  function closeIsland(c, quick) {
    if (!c || c.state === 'closing') return;
    // ditutup saat masih mekar (mis. diketuk): tunggu mekarnya selesai,
    // kecuali harus cepat (modal/form terbuka) -> pudar saja
    if (c.state === 'opening' && !quick) { c.wantClose = true; clearTimeout(c.timer); c.timer = setTimeout(function () { c.state = 'hold'; closeIsland(c); }, 380); return; }
    c.state = 'closing';
    clearTimeout(c.timer);
    if (c.prog) { try { c.prog.onfinish = null; c.prog.pause(); } catch (e) { } }
    var el = c.el, P = c.P, fin = false;
    el.classList.remove('is-live');
    function done() {
      if (fin) return; fin = true;
      clearTimeout(c.timer);
      // semua animasi kapsul ini (termasuk garis waktu yang dijeda) dibatalkan
      // sebelum dibuang — kalau tidak, kapsulnya tertahan di memori selamanya
      c.prog = null;
      killAnims(el);
      if (el.parentNode) el.parentNode.removeChild(el);
      if (cur === c) cur = null;
      clearTimeout(pumpT); pumpT = setTimeout(pump, 140);
    }
    if (c.R || quick) {
      var a = anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: quick ? 160 : 220, easing: 'ease-in', fill: 'forwards' });
      if (a) a.onfinish = done; else done();
      setTimeout(done, 500);
      return;
    }
    // kembali jadi titik: isi pudar -> tutup menyatu -> titik -> hilang
    anim(P.body, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.95)' }], { duration: 170, easing: EASE_IN, fill: 'forwards' });
    anim(P.glass, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    anim(P.shade, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
    anim(P.bloom, [{ opacity: getComputedStyle(P.bloom).opacity }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    // tepi emas = persegi bulat penuh: harus hilang sebelum tutupnya menyatu
    if (P.rim) anim(P.rim, [{ opacity: getComputedStyle(P.rim).opacity }, { opacity: 0 }], { duration: 120, easing: 'ease-in', fill: 'forwards' });
    var CD = 360, cdl = 90, sh = { duration: CD, delay: cdl, easing: 'cubic-bezier(.55,0,.2,1)', fill: 'forwards' };
    anim(P.capL, [{ transform: 'translateX(' + (-c.off) + 'px)' }, { transform: 'translateX(0px)' }], sh);
    anim(P.capR, [{ transform: 'translateX(' + c.off + 'px)' }, { transform: 'translateX(0px)' }], sh);
    anim(P.mid, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], sh);
    anim(P.shape, [{ transform: 'scale(1)' }, { transform: 'scale(' + c.s0 + ')' }],
      { duration: CD - 40, delay: cdl + 120, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    anim(P.seed, [
      { opacity: 0, transform: 'scale(.6)' },
      { opacity: 1, transform: 'scale(1)', offset: 0.35 },
      { opacity: 0, transform: 'scale(.2)' }
    ], { duration: 340, delay: cdl + CD - 120, easing: 'ease-in-out', fill: 'both' });
    anim(P.shape, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, delay: cdl + CD - 30, fill: 'forwards' });
    setTimeout(done, cdl + CD + 260);
  }

  // satu pengawas per tampilan: form/modal dibuka di tengah jalan -> tutup
  // Tab tersembunyi: pengawas berhenti (waktu tahan juga dibekukan), dipasang
  // lagi saat tab terlihat — tidak ada timer modul ini yang jalan di latar.
  function guard() {
    clearInterval(guardT); guardT = 0;
    if (!cur || D.hidden) return;
    guardT = setInterval(function () {
      if (!cur || D.hidden) { clearInterval(guardT); guardT = 0; return; }
      // jari sedang menekan kapsul ini sendiri ('hx-gesture' milik modul ini
      // membuat HX.busy() true) -> bukan alasan untuk menutupnya
      if (ownG) return;
      if (cur.state !== 'closing' && HX.busy()) cur.close(true);
    }, 400);
  }

  /* ── interaksi kapsul (satu pendengar untuk semua) ─────────────────── */
  /* Geser ke atas = tutup. Di HP, begitu jari bergerak browser mengambil
     alih untuk menggulir halaman dan mengirim pointercancel — jadi gerakan
     jari dibaca dari touchmove (pasif: tetap dikirim selama halaman
     menggulir). Halaman TETAP bisa digulir dari atas kapsul; tidak ada
     preventDefault, touch-action tidak diubah. Mouse memakai pointermove.
     Selama jari/mouse menekan kapsul, <html> diberi 'hx-gesture' (satu
     pemilik gestur); kalau modul lain sedang memilikinya, kapsul diam. */
  var press = null, ownG = false, HTML = D.documentElement;
  function gOn() { if (!HTML.classList.contains('hx-gesture')) { HTML.classList.add('hx-gesture'); ownG = true; } }
  function gOff() { if (ownG) { HTML.classList.remove('hx-gesture'); ownG = false; } }
  function pillAt(t) {
    var el = t && t.closest ? t.closest('.hxl-island.is-live') : null;
    return el && cur && cur.el === el ? el : null;
  }
  function pressStart(x, y, touch) {
    if (HTML.classList.contains('hx-gesture') && !ownG) { press = null; return; }   // gestur modul lain
    press = { x: x, y: y, t: Date.now(), swiped: false, touch: !!touch };
    gOn();
  }
  function pressMove(x, y) {
    if (!press || press.swiped || !cur || cur.kind !== 'island') return;
    if (y - press.y < -16 && Math.abs(x - press.x) < 60) { press.swiped = true; cur.close(false); }
  }
  function pressEnd() {
    gOff();
    // klik yang menyusul swipe harus tetap tahu bahwa ini swipe
    setTimeout(function () { press = null; }, 0);
  }
  D.addEventListener('pointerdown', function (e) {
    if (!pillAt(e.target)) return;
    if (e.pointerType === 'touch' && press && press.touch) return;        // sudah dari touchstart
    pressStart(e.clientX, e.clientY, false);
  }, true);
  D.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'touch') pressMove(e.clientX, e.clientY);
  }, { passive: true });
  D.addEventListener('pointerup', function (e) { if (!press || !press.touch || e.pointerType !== 'touch') pressEnd(); }, true);
  // pointercancel (browser mulai menggulir) TIDAK menutup tekanan sentuh —
  // touchmove/touchend di bawah yang menyelesaikannya
  D.addEventListener('pointercancel', function (e) { if (press && !press.touch) pressEnd(); }, true);
  D.addEventListener('lostpointercapture', function (e) { if (press && !press.touch) pressEnd(); }, true);
  D.addEventListener('touchstart', function (e) {
    var t = e.touches && e.touches[0];
    if (!t || e.touches.length > 1) { if (press) pressEnd(); return; }       // dua jari = cubit-zoom
    if (!pillAt(e.target)) return;
    pressStart(t.clientX, t.clientY, true);
  }, { capture: true, passive: true });
  D.addEventListener('touchmove', function (e) {
    var t = e.touches && e.touches[0];
    if (!press || !press.touch || !t) return;
    if (e.touches.length > 1) { pressEnd(); return; }
    pressMove(t.clientX, t.clientY);
  }, { capture: true, passive: true });
  D.addEventListener('touchend', function (e) { if (press && press.touch && (!e.touches || !e.touches.length)) pressEnd(); }, { capture: true, passive: true });
  D.addEventListener('touchcancel', function () { if (press && press.touch) pressEnd(); }, { capture: true, passive: true });
  window.addEventListener('blur', function () { if (press) { press = null; gOff(); } });
  D.addEventListener('visibilitychange', function () { if (D.hidden && press) { press = null; gOff(); } });
  // tekan lama di kapsul/banner: tanpa menu konteks Android (hanya di permukaan ini)
  D.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && t.closest && (t.closest('.hxl-island.is-live') || t.closest('.hxl-banner'))) e.preventDefault();
  }, true);
  function act(c) {
    if (!c || c.kind !== 'island') return;
    var it = c.it;
    c.close(false);
    if ((it.kind === 'sale' || it.kind === 'ch' || it.kind === 'rec') && viewingToday() && typeof openSPModal === 'function') {
      // detail HARI INI orang itu (modal app.js, hanya membaca)
      setTimeout(function () { try { openSPModal(it.sp, it.team); } catch (e) { } }, 60);
    }
  }
  D.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.hxl-island') : null;
    if (!el || !cur || cur.el !== el) return;
    e.preventDefault(); e.stopPropagation();
    if (press && press.swiped) return;
    act(cur);
  }, true);
  D.addEventListener('keydown', function (e) {
    if (!cur || cur.state === 'closing') return;
    if (e.key === 'Escape') { cur.close(false); return; }
    if ((e.key === 'Enter' || e.key === ' ') && D.activeElement === cur.el) {
      e.preventDefault();
      if (cur.kind === 'island') act(cur); else cur.close(false);
    }
  });
  // mouse di atas kapsul: waktu tahan berhenti (desktop)
  D.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse' || !cur || cur.kind !== 'island') return;
    var inside = e.target && e.target.closest && e.target.closest('.hxl-island') === cur.el;
    if (inside && !cur.hover) { cur.hover = true; if (cur.prog) cur.prog.pause(); }
    else if (!inside && cur.hover) { cur.hover = false; if (cur.prog && cur.state === 'hold') cur.prog.play(); }
  }, { passive: true });

  /* ── banner TARGET HARIAN TEMBUS (sekali sehari) ────────────────── */
  function banner(it) {
    var k = key100();
    if (done100[k] || lsGet(k)) { pump(); return; }
    done100[k] = 1; lsSet(k, '1');
    var R = still(), vw = innerWidth, desk = vw >= 769;
    var T = it.target || HX.target() || 0, rev = it.revenue || HX.todayRevenue() || 0;
    var pct = T > 0 ? Math.max(100, Math.floor(rev / T * 100)) : 100;
    var from = Math.max(0, Math.min(99, Math.floor(it.from || 0)));
    var by = it.by;
    var d = new Date(), clock = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

    var el = D.createElement('div');
    el.className = 'hxl-banner';
    var top = topY();
    el.style.top = top + 'px';
    if (desk) {
      var w = Math.min(720, vw - 48);
      el.style.left = '50%'; el.style.right = 'auto'; el.style.width = w + 'px'; el.style.marginLeft = (-w / 2) + 'px';
    }
    var sayTxt = 'Target harian tembus ' + pct + ' persen' + (by && by.sp ? ', lewat penjualan ' + nice(by.sp) : '') + '. Ketuk untuk menutup.';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', sayTxt);
    el.innerHTML =
      '<i class="hxl-bn-bg" aria-hidden="true"></i>' +
      '<span class="hxl-bn-fx" aria-hidden="true"><i class="hxl-bn-grid"></i><i class="hxl-bn-bloom"></i>' +
      '<i class="hxl-bn-ring"></i><i class="hxl-bn-ring"></i><i class="hxl-bn-sweep"></i><i class="hxl-bn-edge"></i></span>' +
      '<i class="hxl-bn-rim" aria-hidden="true"></i>' +
      '<div class="hxl-bn-in" aria-hidden="true">' +
        '<div class="hxl-bn-top"><span class="hxl-bn-kick"><i class="hxl-bn-dot"></i>TARGET HARIAN TEMBUS</span>' +
        '<span class="hxl-bn-clock"><span class="hxl-bn-today">HARI INI · </span>' + clock + '</span></div>' +
        '<div class="hxl-bn-row"><div class="hxl-bn-pct"><span class="hxl-bn-num"></span><span class="hxl-bn-sign">%</span></div>' +
        '<div class="hxl-bn-facts"><div class="hxl-bn-rev">' + esc(full(rev)) + '</div>' +
        '<div class="hxl-bn-of">dari target <span class="hxl-nw">' + esc(full(T)) + '</span></div></div></div>' +
        '<div class="hxl-bn-bar"><i class="hxl-bn-fill"></i><i class="hxl-bn-head"></i></div>' +
        // tiap bagian tidak boleh patah di dalam (mis. 'Rp' terpisah dari angkanya);
        // baris hanya boleh patah di pemisah ' · '
        '<div class="hxl-bn-by">' + (by && by.sp
          ? '<span class="hxl-nw">Lewat penjualan <b>' + esc(nice(by.sp)) + '</b></span>' +
            (by.team ? ' · <span class="hxl-nw">Team ' + esc(by.team) + '</span>' : '') +
            (by.revenue ? ' · <em class="hxl-nw">+' + esc(full(by.revenue)) + '</em>' : '')
          : 'Kerja seluruh tim hari ini') + '</div>' +
      '</div>';
    D.body.appendChild(el);
    var q = function (s) { return el.querySelector(s); };
    var B = {
      num: q('.hxl-bn-num'), pct: q('.hxl-bn-pct'), fill: q('.hxl-bn-fill'), head: q('.hxl-bn-head'), bar: q('.hxl-bn-bar'),
      bloom: q('.hxl-bn-bloom'), rings: el.querySelectorAll('.hxl-bn-ring'), sweep: q('.hxl-bn-sweep'), edge: q('.hxl-bn-edge'),
      rim: q('.hxl-bn-rim'), kick: q('.hxl-bn-kick'), clock: q('.hxl-bn-clock'), facts: q('.hxl-bn-facts'), by: q('.hxl-bn-by'),
      rev: q('.hxl-bn-rev')
    };
    fitText(B.rev, 12);
    var c = cur = { kind: 'banner', it: it, el: el, state: 'opening', timer: 0 };
    c.close = function (quick) { closeBanner(c, quick); };
    c.refresh = function () { };
    say(sayTxt);
    guard();

    // posisi pusat angka (untuk cahaya, cincin, surge)
    var bw = B.bar.getBoundingClientRect().width;
    var er = el.getBoundingClientRect(), pr = B.pct.getBoundingClientRect();
    var bx = pr.left - er.left + pr.width * 0.4, byy = pr.top - er.top + pr.height * 0.5;
    el.style.setProperty('--bx', bx + 'px');
    el.style.setProperty('--by', byy + 'px');
    B.head.style.transform = 'translateX(' + bw + 'px)';

    if (R) {
      odo(B.num, String(pct), null, 0);
      B.pct.classList.add('is-hit');
      B.rim.style.opacity = 0.6;
      anim(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
      HX.emit('surge', { x: er.left + bx, y: er.top + byy, power: 1 });
      c.state = 'hold';
      c.timer = setTimeout(function () { closeBanner(c); }, 3400);
      return;
    }
    // 1. masuk: turun dari bawah header dengan pegas, garis cahaya menyapu tepi atas
    anim(el, springKF(720, 0, 1, function (x) {
      return { opacity: Math.max(0, Math.min(1, x * 1.6)), transform: 'translateY(' + ((1 - x) * -26).toFixed(2) + 'px) scale(' + (0.94 + 0.06 * x).toFixed(4) + ')' };
    }), { duration: 720, fill: 'backwards' });
    anim(B.edge, [
      { opacity: 0, transform: 'translateX(-110%)' }, { opacity: 1, transform: 'translateX(20%)', offset: 0.3 },
      { opacity: 1, transform: 'translateX(180%)', offset: 0.8 }, { opacity: 0, transform: 'translateX(250%)' }
    ], { duration: 1000, delay: 60, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    [B.kick, B.clock].forEach(function (n, i) {
      anim(n, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 140 + i * 60, easing: EASE_OUT, fill: 'backwards' });
    });
    anim(B.facts, [{ opacity: 0, transform: 'translateX(10px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 300, easing: EASE_OUT, fill: 'backwards' });
    anim(B.by, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 520, easing: EASE_OUT, fill: 'backwards' });
    // 2. angka besar bergulir naik dari % sebelumnya, batang terisi bersamaan
    var CL = 1380;                                   // puncak
    odo(B.num, String(pct), from > 0 ? String(from) : null, 220, 1050);
    anim(B.fill, [{ transform: 'scaleX(' + (from / 100).toFixed(4) + ')' }, { transform: 'scaleX(1)' }],
      { duration: 1100, delay: 260, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' });
    anim(B.head, [{ transform: 'translateX(' + (bw * from / 100).toFixed(1) + 'px) scale(.8)', opacity: 0.6 },
                  { transform: 'translateX(' + bw.toFixed(1) + 'px) scale(1)', opacity: 1 }],
      { duration: 1100, delay: 260, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' });
    // 3. puncak: cahaya hijau mekar, dua cincin, kilau menyapu, wallpaper surge
    c.timer = setTimeout(function () {
      if (cur !== c || c.state === 'closing') return;
      c.state = 'hold';
      B.pct.classList.add('is-hit');
      anim(B.bloom, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'scale(1.12)', offset: 0.3 }, { opacity: 0.4, transform: 'scale(1)' }],
        { duration: 1500, easing: 'ease-out', fill: 'forwards' });
      Array.prototype.forEach.call(B.rings, function (r, i) {
        anim(r, [{ opacity: 0.9, transform: 'scale(.35)' }, { opacity: 0, transform: 'scale(' + (i ? 3.4 : 2.6) + ')' }],
          { duration: 1200 + i * 250, delay: i * 170, easing: 'cubic-bezier(.1,.7,.3,1)', fill: 'backwards' });
      });
      anim(B.sweep, [{ transform: 'translateX(-160%) skewX(-18deg)' }, { transform: 'translateX(460%) skewX(-18deg)' }],
        { duration: 1150, delay: 60, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'backwards' });
      anim(B.rim, [{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0.45 }], { duration: 1400, easing: 'ease-out', fill: 'forwards' });
      anim(B.head, [{ transform: 'translateX(' + bw.toFixed(1) + 'px) scale(1)' }, { transform: 'translateX(' + bw.toFixed(1) + 'px) scale(2.4)', offset: 0.3 },
                    { transform: 'translateX(' + bw.toFixed(1) + 'px) scale(1)' }], { duration: 900, easing: 'ease-out' });
      var r2 = el.getBoundingClientRect();
      HX.emit('surge', { x: r2.left + bx, y: r2.top + byy, power: 1 });
      c.timer = setTimeout(function () { closeBanner(c); }, 2100);
    }, CL);
  }

  // angka satu baris yang tidak muat (HP 320px, font sistem besar): kecilkan
  // font-nya sampai muat — sekali, saat banner dibuat
  function fitText(n, min) {
    if (!n) return;
    try {
      for (var i = 0; i < 3 && n.scrollWidth > n.clientWidth + 0.5; i++) {
        var fs = parseFloat(getComputedStyle(n).fontSize) || 16;
        var nf = Math.max(min, Math.floor(fs * n.clientWidth / n.scrollWidth * 2) / 2);
        if (nf >= fs) break;
        n.style.fontSize = nf + 'px';
      }
    } catch (e) { }
  }

  function closeBanner(c) {
    if (!c || c.state === 'closing') return;
    c.state = 'closing';
    clearTimeout(c.timer);
    var el = c.el, fin = false;
    function done() {
      if (fin) return; fin = true;
      clearTimeout(c.timer);
      killAnims(el);
      if (el.parentNode) el.parentNode.removeChild(el);
      if (cur === c) cur = null;
      clearTimeout(pumpT); pumpT = setTimeout(pump, 200);
    }
    var a = anim(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-14px) scale(.97)' }],
      { duration: still() ? 220 : 380, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    if (a) a.onfinish = done;
    setTimeout(done, 600);
  }
  D.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.hxl-banner') : null;
    if (!el || !cur || cur.el !== el) return;
    e.preventDefault(); e.stopPropagation();
    closeBanner(cur);
  }, true);

  /* ── tab tersembunyi: tahan antrean, bekukan waktu tahan ─────────── */
  D.addEventListener('visibilitychange', function () {
    if (cur && cur.prog) { try { if (D.hidden) cur.prog.pause(); else if (!cur.hover && cur.state === 'hold') cur.prog.play(); } catch (e) { } }
    if (D.hidden) { clearInterval(guardT); guardT = 0; }
    else {
      if (cur && cur.state !== 'closing') guard();
      pump();
    }
  });

  /* ── "Sejak terakhir dibuka" ─────────────────────────────────────── */
  var prevVisit = +lsGet(LS_VISIT) || 0;      // dibaca SEBELUM ditimpa
  function stamp() { lsSet(LS_VISIT, String(Date.now())); }
  // tiap menit SELAMA terlihat (interval dihentikan saat tab tersembunyi)
  var stampT = 0;
  function stampLoop() {
    clearInterval(stampT); stampT = 0;
    if (!D.hidden) stampT = setInterval(stamp, 60000);
  }
  stamp();
  stampLoop();
  D.addEventListener('visibilitychange', function () { stamp(); stampLoop(); });
  window.addEventListener('pagehide', stamp);
  var sinceDone = false;
  function since() {
    if (sinceDone) return;
    sinceDone = true;
    if (!prevVisit) return;                         // kunjungan pertama: diam
    var t = Date.now(), gap = t - prevVisit;
    if (gap < 30 * 60 * 1000) return;
    if (dayOf(prevVisit) !== HX.todayKey()) return;   // hanya "hari ini"
    var list = todayList().filter(function (e) { return +e.ts > prevVisit && +e.ts <= t + 5 * 60 * 1000; });
    if (list.length < 2) return;
    var it = { kind: 'since', key: 'since', n: list.length, total: 0, last: 0, lastSp: '', gap: gap, at: t, notBefore: t + 1900 };
    list.forEach(function (e) {
      it.total += (+e.revenue || 0);
      if (+e.ts >= it.last) { it.last = +e.ts; it.lastSp = e.sp; }
    });
    Q.unshift(it);
    pump();
  }
  HX.on('ready', since);
  try { if (window._cfgTeamsLoaded && Object.keys(allData).length) since(); } catch (e) { }

  /* ── untuk tes / pemeriksaan (hanya membaca) ─────────────────────── */
  HX.live = {
    state: function () {
      return {
        showing: cur ? (cur.kind === 'banner' ? 'goal100' : cur.it.kind + (cur.it.type ? ':' + cur.it.type : '')) : null,
        phase: cur ? cur.state : null,
        queue: Q.map(function (q) { return q.kind + (q.type ? ':' + q.type : '') + (q.n ? ':' + q.n : ''); })
      };
    },
    dismiss: function () { if (cur) cur.close(true); },
    close: function () { if (cur) cur.close(false); },
    // waktu membangun ulang indeks rekor (ms) — hanya untuk tes kinerja
    _rxRebuild: function () { rxIdx = null; rxDirty = true; var t = performance.now(); rxBuild(); return performance.now() - t; },
    _short: short,
    _shortLike: shortLike,
    // jumlah animasi modul ini yang masih tercatat (harus 0 saat tidak ada kapsul)
    _anims: function () { return LIVE_A.length; },
    _timers: function () { return { guard: !!guardT, stamp: !!stampT }; }
  };
})();
