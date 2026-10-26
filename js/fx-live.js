/* ══════════════════════════════════════════════════════════════════════
   FX LIVE — setiap penjualan rekan tim jadi momen bersama.
   HANYA MEMBACA data. Tidak pernah menulis ke Firebase. Yang ditulis hanya
   localStorage HP ini: 'hx-last-visit' dan 'hxl-target100-<tanggal>'.

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

   Wallpaper: HX.emit('ripple', {x, y, power}) saat kapsul mekar
   (power 0..1: channel .25 · biasa .5 · ringkasan .7 · besar 1) dan
   HX.emit('surge', {x, y, power:1}) di puncak banner 100%.

   ATURAN: semua gerak = transform/opacity lewat Web Animations (jalan di
   compositor — tetap mulus walau renderAll sedang membangun ulang daftar).
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
  var HOLD = { sale: 4500, ch: 3200, sum: 5200, goal: 4600, since: 5800 };
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
  function dec(v, k) {
    var s = v.toFixed(k);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }
  // 'Rp 24,3jt' / 'Rp 9,55jt' / 'Rp 2,95M' / 'Rp 850rb'
  function short(n) {
    n = Math.round(n || 0);
    if (n >= 1e9) return 'Rp ' + dec(n / 1e9, 2) + 'M';
    if (n >= 1e6) { var v = n / 1e6; return 'Rp ' + dec(v, v >= 100 ? 0 : v >= 10 ? 1 : 2) + 'jt'; }
    if (n >= 1e3) return 'Rp ' + Math.round(n / 1e3) + 'rb';
    return 'Rp ' + n;
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
  function anim(el, kf, o) {
    if (!el || !CAN) return null;
    try { return el.animate(kf, o); } catch (e) { return null; }
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
     Tanpa nilai awal: setiap kolom berputar satu putaran penuh dari kosong. */
  var STACK = (function () {
    var s = '<i>&nbsp;</i>';
    for (var r = 0; r < 2; r++) for (var d = 0; d < 10; d++) s += '<i>' + d + '</i>';
    return s;
  })();
  function digitsOf(str) { var a = []; String(str || '').replace(/\d/g, function (c) { a.push(+c); }); return a; }
  function odo(host, to, from, delay, dur) {
    if (!host) return 0;
    var R = still();
    to = String(to); dur = dur || 900; delay = delay || 0;
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
      var st = D.createElement('span'); st.className = 'hxl-dgs'; st.innerHTML = STACK;
      col.appendChild(st); wrap.appendChild(col);
      var start, end;
      // angka baru: putar satu putaran penuh. Kolom yang baru MUNCUL saat
      // angka bertambah (5.775.000 -> 15.330.000 / 96% -> 101%) tidak
      // berputar — digitnya naik masuk dari bawah, supaya tidak sempat
      // terbaca "75.095.000" atau "088%"
      var grow = false;
      if (fd == null && fD) { start = end = 1 + d; grow = true; }
      else if (fd == null) { start = 0; end = 11 + d; }
      else { start = 1 + fd; end = d >= fd ? 1 + d : 11 + d; }
      st.style.transform = 'translateY(' + (-end * LH) + 'em)';
      cols.push({ st: st, col: col, start: start, end: end, grow: grow });
    }
    flushTxt();
    host.textContent = '';
    host.appendChild(wrap);
    if (R) return 0;
    var moving = cols.filter(function (c) { return c.start !== c.end || c.grow; });
    if (!moving.length) return 0;
    wrap.classList.add('is-rolling');
    var step = Math.min(40, 220 / Math.max(1, moving.length)), endAt = 0;
    moving.forEach(function (c, k) {
      var dl = delay + k * step, du = dur + k * 18;
      if (c.grow) {
        anim(c.st, [{ opacity: 0, transform: 'translateY(' + (-c.end * LH + 0.7) + 'em)' }, { opacity: 1, transform: 'translateY(' + (-c.end * LH) + 'em)' }],
          { duration: Math.round(du * 0.8), delay: dl + Math.round(du * 0.25), easing: EASE_OUT, fill: 'backwards' });
        endAt = Math.max(endAt, dl + du);
        return;
      }
      anim(c.st, [{ transform: 'translateY(' + (-c.start * LH) + 'em)' }, { transform: 'translateY(' + (-c.end * LH) + 'em)' }],
        { duration: du, delay: dl, easing: 'cubic-bezier(.12,.86,.22,1)', fill: 'backwards' });
      endAt = Math.max(endAt, dl + du);
    });
    setTimeout(function () { wrap.classList.remove('is-rolling'); }, endAt + 30);
    return endAt;
  }

  /* ── peringkat hari ini (label "naik ke #2") ─────────────────────── */
  function rankOf(it) {
    if (it.kind !== 'sale' || HX.isLeader(it.sp)) return null;
    var m = {}, me = norm(it.sp) + '|' + norm(it.team);
    todayList().forEach(function (e) {
      if (HX.isChannel(e.sp)) return;
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
        say: 'Sejak terakhir dibuka, ' + gapText(it.gap) + ': ' + it.n + ' penjualan, ' + short(it.total)
      };
      case 'goal': return {
        chip: '<span class="hxl-ring"><svg viewBox="0 0 38 38" aria-hidden="true"><circle class="trk" cx="19" cy="19" r="16"/>' +
              '<circle class="arc" cx="19" cy="19" r="16" stroke-dasharray="' + RING_C.toFixed(2) + '" stroke-dashoffset="' +
              (RING_C * (1 - it.pct / 100)).toFixed(2) + '"/></svg><b>' + it.pct + '</b></span>',
        // tanpa kolom kanan: judulnya harus utuh di layar HP
        name: 'Target hari ini tembus ' + it.pct + '%',
        l2: (it.by && it.by.sp ? 'didorong ' + nice(it.by.sp) + ' · ' : '') + short(it.revenue) + ' dari ' + short(it.target).replace('Rp ', ''),
        amt: '', sub: '',
        say: 'Target hari ini tembus ' + it.pct + ' persen' + (it.by && it.by.sp ? ', didorong ' + nice(it.by.sp) : '')
      };
    }
    return { chip: '', name: '', l2: '', amt: '', sub: '', say: '' };
  }
  function bodyHTML(it, v) {
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
    if (it.kind === 'goal100' || it.kind === 'since') return t - it.at > STALE_100_MS;
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
    var batch = buf.filter(function (s) { return !s.own; }), goals = gbuf;
    buf = []; gbuf = [];
    if (batch.length > 3) addSummary(batch);
    else batch.forEach(addSale);
    if (goals.length) addGoals(goals);
    pump();
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
    var small = it.kind === 'ch';
    var H = small ? 44 : 62;
    var W = small ? fitWidth(it, H, vw) : Math.min(vw - 24, desk ? 420 : 400);
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
      '<i class="hxl-bloom" aria-hidden="true"></i>' +
      '<span class="hxl-shape" aria-hidden="true"><i class="hxl-cap hxl-capL"></i><i class="hxl-cap hxl-capR"></i><i class="hxl-mid"></i></span>' +
      '<i class="hxl-glass" aria-hidden="true"></i>' +
      '<span class="hxl-body" aria-hidden="true">' + bodyHTML(it, v) + '<i class="hxl-sweep"></i><i class="hxl-prog"></i></span>' +
      '<i class="hxl-seed" aria-hidden="true"></i>';
    D.body.appendChild(el);
    var q = function (s) { return el.querySelector(s); };
    var P = {
      shape: q('.hxl-shape'), capL: q('.hxl-capL'), capR: q('.hxl-capR'), mid: q('.hxl-mid'),
      glass: q('.hxl-glass'), body: q('.hxl-body'), seed: q('.hxl-seed'), bloom: q('.hxl-bloom'),
      sweep: q('.hxl-sweep'), prog: q('.hxl-prog'), chip: q('.hxl-chip,.hxl-ring,.hxl-tag'),
      badge: q('.hxl-badge'), name: q('.hxl-name'), rank: q('.hxl-rank'), l2wrap: q('.hxl-l2wrap'),
      amt: q('.hxl-amt'), sub: q('.hxl-sub'), arc: q('.hxl-ring .arc')
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

    var cy = top + H / 2, power = it.kind === 'ch' ? 0.25 : big ? 1 : it.kind === 'sum' || it.kind === 'since' ? 0.7 : it.kind === 'goal' ? 0.6 : 0.5;
    if (R) {
      // Kurangi Gerak: muncul pelan saja, tanpa gerak
      P.body.style.opacity = '1'; P.glass.style.opacity = '1';
      if (v.amt) odo(P.amt, v.amt, null, 0);
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
    P.glass.style.opacity = '1'; P.body.style.opacity = '1';
    anim(P.glass, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: AT + 300, easing: 'ease-out', fill: 'backwards' });
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
    var rolled = v.amt ? odo(P.amt, v.amt, null, AT + 270, it.kind === 'ch' ? 620 : 760) : 0;
    if (P.rank) setTimeout(function () { if (cur === c) paintRank(c, false); }, Math.max(AT + 700, rolled - 150));
    // 4. closing besar: cahaya mekar + kilau menyapu
    if (big) bigFx(c, AT + 260);
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

  function paintRank(c, instant) {
    var P = c.P, r = rankOf(c.it);
    if (!P.rank || !r) return;
    P.rank.textContent = r === 1 ? '#1 hari ini' : 'naik ke #' + r;
    P.rank.classList.toggle('is-top', r === 1);
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
        var rm = function () { if (old.parentNode) old.parentNode.removeChild(old); };
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
    // nominal bergulir dari angka lama ke angka baru
    if (v.amt && v.amt !== c.amtStr) { odo(P.amt, v.amt, c.amtStr, 60, 800); c.amtStr = v.amt; }
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
    anim(P.bloom, [{ opacity: getComputedStyle(P.bloom).opacity }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
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
  function guard() {
    clearInterval(guardT);
    guardT = setInterval(function () {
      if (!cur) { clearInterval(guardT); return; }
      if (cur.state !== 'closing' && HX.busy()) cur.close(true);
    }, 400);
  }

  /* ── interaksi kapsul (satu pendengar untuk semua) ─────────────────── */
  var press = null;
  D.addEventListener('pointerdown', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('.hxl-island.is-live') : null;
    if (!el || !cur || cur.el !== el) return;
    press = { x: e.clientX, y: e.clientY, t: Date.now(), swiped: false };
  }, true);
  D.addEventListener('pointermove', function (e) {
    if (!press || !cur || cur.kind !== 'island') return;
    if (e.clientY - press.y < -16 && Math.abs(e.clientX - press.x) < 60) { press.swiped = true; cur.close(false); press = null; }
  }, { passive: true });
  D.addEventListener('pointerup', function () { setTimeout(function () { press = null; }, 0); }, true);
  function act(c) {
    if (!c || c.kind !== 'island') return;
    var it = c.it;
    c.close(false);
    if ((it.kind === 'sale' || it.kind === 'ch') && viewingToday() && typeof openSPModal === 'function') {
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
    var sayTxt = 'Target harian tembus ' + pct + ' persen' + (by && by.sp ? ', didorong ' + nice(by.sp) : '') + '. Ketuk untuk menutup.';
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
        '<span class="hxl-bn-clock">HARI INI · ' + clock + '</span></div>' +
        '<div class="hxl-bn-row"><div class="hxl-bn-pct"><span class="hxl-bn-num"></span><span class="hxl-bn-sign">%</span></div>' +
        '<div class="hxl-bn-facts"><div class="hxl-bn-rev">' + esc(full(rev)) + '</div>' +
        '<div class="hxl-bn-of">dari target ' + esc(full(T)) + '</div></div></div>' +
        '<div class="hxl-bn-bar"><i class="hxl-bn-fill"></i><i class="hxl-bn-head"></i></div>' +
        '<div class="hxl-bn-by">' + (by && by.sp
          ? 'Didorong <b>' + esc(nice(by.sp)) + '</b>' + (by.team ? ' · Team ' + esc(by.team) : '') + (by.revenue ? ' · <em>+' + esc(full(by.revenue)) + '</em>' : '')
          : 'Kerja seluruh tim hari ini') + '</div>' +
      '</div>';
    D.body.appendChild(el);
    var q = function (s) { return el.querySelector(s); };
    var B = {
      num: q('.hxl-bn-num'), pct: q('.hxl-bn-pct'), fill: q('.hxl-bn-fill'), head: q('.hxl-bn-head'), bar: q('.hxl-bn-bar'),
      bloom: q('.hxl-bn-bloom'), rings: el.querySelectorAll('.hxl-bn-ring'), sweep: q('.hxl-bn-sweep'), edge: q('.hxl-bn-edge'),
      rim: q('.hxl-bn-rim'), kick: q('.hxl-bn-kick'), clock: q('.hxl-bn-clock'), facts: q('.hxl-bn-facts'), by: q('.hxl-bn-by')
    };
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

  function closeBanner(c) {
    if (!c || c.state === 'closing') return;
    c.state = 'closing';
    clearTimeout(c.timer);
    var el = c.el, fin = false;
    function done() {
      if (fin) return; fin = true;
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
    if (!D.hidden) pump();
  });

  /* ── "Sejak terakhir dibuka" ─────────────────────────────────────── */
  var prevVisit = +lsGet(LS_VISIT) || 0;      // dibaca SEBELUM ditimpa
  function stamp() { lsSet(LS_VISIT, String(Date.now())); }
  stamp();
  setInterval(function () { if (!D.hidden) stamp(); }, 60000);
  D.addEventListener('visibilitychange', stamp);
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
    state: function () { return { showing: cur ? (cur.kind === 'banner' ? 'goal100' : cur.it.kind) : null, phase: cur ? cur.state : null, queue: Q.map(function (q) { return q.kind + (q.n ? ':' + q.n : ''); }) }; },
    dismiss: function () { if (cur) cur.close(true); },
    close: function () { if (cur) cur.close(false); },
    _short: short
  };
})();
