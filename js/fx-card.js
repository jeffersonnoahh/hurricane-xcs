/* ══════════════════════════════════════════════════════════════════════
   FX CARD — KARTU SALES KOLEKSI.  HANYA MEMBACA (tidak pernah menulis ke
   Firebase, tidak mengubah allData / allActs / TM). Lihat js/fx-core.js.

   Tombol "Kartu" di baris aksi modal detail sales (#spMo, HX.spAction
   order 20) membuka layar penuh berisi kartu kaca untuk sales itu:

   DEPAN   peringkat omzet bulan itu di antara SALES yang berjualan bulan
           itu (HX.monthAgg: channel & team lead tidak ikut, yang sudah
           keluar roster tetap ikut; "No. 05 / 29" = peringkat / nSellers,
           sama dengan Wrapped & peta bintang), nama, chip monogram tim,
           omzet bulan itu (format singkat app.js), jumlah closing, produk
           terlaris.
           Bingkai menurut peringkat: #1-#3 emas (kuning logo), #4-#10
           perak, sisanya kaca bening. Lapisan foil holografik + pita
           kilau mengikuti jari / kursor saat kartu dimiringkan 3D (maks
           12 derajat, transform saja; TANPA sensor orientasi HP karena
           iOS meminta izin). Diam: melayang pelan (animasi berhingga).
           Seni di jendela kartu = rosette guilloche (pola uang kertas)
           yang digambar dari nama sales — tiap kartu unik.
   BELAKANG (ketuk kartu = balik) hari terbaik & penjualan terbesar BULAN
           itu, streak closing (Minggu tanpa closing tidak memutus),
           bulan ini vs bulan lalu pada periode yang sama, lencana
           (HX.badges bila ada, kalau tidak: lencana turunan), grafik
           batang omzet harian bulan itu.
   SIMPAN  kartu depan digambar ulang sendiri di canvas 1080x1512 (tanpa
           pustaka html-to-image) -> navigator.share({files}) bila bisa
           (Android Chrome, iOS 15+), kalau tidak: unduh (desktop/Android)
           atau buka di tab baru (iOS 14: tekan lama untuk menyimpan).
           PNG disiapkan di belakang setelah kartu terbuka, supaya share()
           dipanggil langsung di dalam ketukan (Safari menolak share()
           setelah await).

   Bulan kartu = bulan dari tanggal yang sedang dilihat (od(vOff)), sama
   dengan kartu Salespeople. Semua angka bulan berasal dari HX.monthAgg
   (js/fx-core.js): sales digabung per NAMA lintas tim, tim kartu = tim
   roster sekarang (kalau sudah keluar: tim record terakhir).

   Protokol layar penuh: <html>.hx-overlay-open selama terbuka (HX.busy()
   true), scroll halaman terkunci tanpa lompatan (touchmove/wheel
   diblokir di overlay, bukan overflow:hidden), tutup lewat X / ketuk di
   luar kartu / Escape / tombol Back Android (history.pushState + popstate;
   ditutup dengan cara lain -> entri riwayatnya dibuang lagi). Gestur
   miring memakai <html>.hx-gesture (satu pemilik gestur).

   Kurangi Gerak: tanpa miring / melayang / masuk bergerak; balik kartu =
   pudar silang.

   Uji (tanpa menyentuh data): HX.card.open(sp, team), HX.card.close(),
   HX.card.flip(), HX.card.state(), HX.card.model(sp, team),
   HX.card.png(sp, team) -> Promise<dataURL>, HX.card.pose(rx, ry, sudut)
   (tahan pose untuk tangkapan layar).
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HX = window.HX;
  if (!HX || HX.__card) return;
  HX.__card = true;

  var TILT = 12;                       // derajat maksimum
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var MONF = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MINUS = '−';
  var GR = "'Space Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
  var MO = "'Space Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

  /* ── util ─────────────────────────────────────────────────────────── */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function now() { return Date.now(); }
  function dim(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
  function toArr(v) {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'object') return Object.keys(v).map(function (k) { return v[k]; });
    return [];
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function money(n) { return HX.money(n || 0); }
  function rp(n) { return 'Rp ' + money(n); }
  function keyDate(k) {   // 'YYYY-MM-DD' -> '14 Agu 2026'
    var p = String(k).split('-');
    return (+p[2]) + ' ' + MON[(+p[1]) - 1] + ' ' + p[0];
  }
  function keyDateShort(k) { var p = String(k).split('-'); return (+p[2]) + ' ' + MON[(+p[1]) - 1]; }
  function mono(team) {
    try { if (typeof teamMono === 'function') return teamMono(team); } catch (e) { }
    return String(team || '').slice(0, 2).toUpperCase();
  }
  function reduced() { return !!(HX.reduced && HX.reduced()); }
  function viewed() { try { if (typeof od === 'function') return od(vOff); } catch (e) { } return new Date(); }
  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
  }
  function pct(n) {
    if (n == null || !isFinite(n)) return '—';
    var r = Math.round(n);
    return (r > 0 ? '+' : r < 0 ? MINUS : '') + Math.abs(r) + '%';
  }
  function slug(s) {
    var t = String(s || 'sales').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return t || 'sales';
  }

  /* ── model data (sekali per buka kartu) ───────────────────────────── */
  // Semua angka BULAN (peringkat, penyebut, omset, closing, produk terlaris,
  // hari terbaik, penjualan terbesar, bulan lalu) dari HX.monthAgg — hitungan
  // bersama Wrapped / peta bintang / pecah omset, jadi angkanya sama di mana
  // pun dilihat. Di sini hanya streak (lintas bulan) yang dihitung sendiri.
  var NOAGG = { nSellers: 0, get: function () { return null; } };
  function agg(y, m0, upto) {
    try { if (typeof HX.monthAgg === 'function') return HX.monthAgg(y, m0, upto) || NOAGG; } catch (e) { console.warn('[fx-card] monthAgg', e); }
    return NOAGG;
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  // streak: hari beruntun dengan closing sampai hari ini (kalau hari ini
  // belum ada, mulai dari kemarin). Minggu tanpa closing dan hari tanpa
  // penjualan sama sekali (libur) dilewati: tidak memutus, tidak dihitung
  // (aturan yang sama dengan lencana "Beruntun" di fx-badges.js). Sales
  // dikenali per NAMA (lintas tim), sama dengan aturan monthAgg.
  function streakOf(sp) {
    var data = {};
    try { data = allData || {}; } catch (e) { }
    var me = norm(sp), firstDay = null;
    Object.keys(data).forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && (firstDay === null || k < firstDay)) firstDay = k; });
    if (firstDay === null) return 0;
    function day(k) {          // {mine, any}: ada penjualan milik sales ini / milik siapa pun
      var o = { mine: false, any: false };
      toArr(data[k]).forEach(function (e) {
        if (!e || typeof e !== 'object') return;
        if (!((+e.revenue || 0) > 0 || (+e.units || 0) > 0)) return;
        o.any = true;
        if (norm(e.sp) === me) o.mine = true;
      });
      return o;
    }
    var d = new Date(); d.setHours(12, 0, 0, 0);
    if (!day(HX.dayKey(d)).mine) d.setDate(d.getDate() - 1);
    var streak = 0;
    for (var i = 0; i < 400; i++) {
      var kk = HX.dayKey(d), o = day(kk);
      if (o.mine) streak++;
      else if (d.getDay() !== 0 && o.any) break;
      else if (!o.any && kk < firstDay) break;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function model(sp, team) {
    var vd = viewed(), today = new Date();
    var Y = vd.getFullYear(), M0 = vd.getMonth();
    var isCur = Y === today.getFullYear() && M0 === today.getMonth();
    var cut = isCur ? today.getDate() : dim(Y, M0);
    var pd = new Date(Y, M0 - 1, 1), PY = pd.getFullYear(), PM0 = pd.getMonth();
    var pcut = isCur ? Math.min(cut, dim(PY, PM0)) : dim(PY, PM0);

    // bulan itu (seluruh bulan = monthRev bulan itu) & bulan lalu pada
    // periode yang sama (bulan berjalan: 1..tanggal hari ini)
    var A = agg(Y, M0), s = A.get(sp);
    var P = agg(PY, PM0, pcut), ps = P.get(sp);
    var leader = s ? !!s.leader : HX.isLeader(sp), channel = HX.isChannel(sp);
    // peringkat & penyebut ("No. 05 / 29") = monthAgg: sales asli bulan itu
    // (yang sudah keluar roster tetap dihitung), tanpa channel & team lead
    var rank = s && !leader && !channel && s.rank ? s.rank : null;
    var tier = rank && rank <= 3 ? 'gold' : rank && rank <= 10 ? 'silver' : 'glass';

    var mtd = s ? s.revenue : 0, closes = s ? s.closes : 0, prev = ps ? ps.revenue : 0;
    var best = null;
    if (s && s.topProd) {
      var tp = s.prods[s.topProd] || {};
      best = { prod: s.topProd, u: tp.units || 0, r: tp.revenue || 0 };
    }
    var bestDay = s && s.best && s.best.date && s.best.revenue > 0 ? { rev: s.best.revenue, key: s.best.date } : null;
    var biggest = s && s.biggest && s.biggest.revenue > 0 ? { rev: s.biggest.revenue, prod: s.biggest.prod || '', key: s.biggest.date } : null;

    // grafik batang omzet harian bulan itu (bulan berjalan: sampai hari ini)
    var daily = [], maxD = 0, maxI = -1;
    for (var i = 0; i < cut; i++) {
      var v = s ? (s.days[HX.dayKey(new Date(Y, M0, i + 1))] || 0) : 0;
      daily.push(v);
      if (v > maxD) { maxD = v; maxI = i; }
    }

    // bulan ini vs bulan lalu (periode yang sama untuk bulan berjalan)
    var delta = prev > 0 ? (mtd - prev) / prev * 100 : null;

    // tim kartu = tim monthAgg (roster sekarang, kalau sudah keluar: tim record terakhir)
    var tm = s && s.team ? String(s.team) : String(team || '');
    var nm = String(sp);
    if (nm === nm.toLowerCase()) nm = nm.charAt(0).toUpperCase() + nm.slice(1);
    var m = {
      sp: String(sp), name: nm, team: tm, mono: mono(tm), seed: hash(sp + '|' + tm),
      Y: Y, M0: M0, isCur: isCur, cut: cut,
      monthLong: MONF[M0] + ' ' + Y, monthShort: MON[M0].toUpperCase() + ' ' + Y, monthName: MONF[M0],
      prevName: MONF[PM0], prevShort: MON[PM0], prevCut: pcut,
      rank: rank, total: A.nSellers, tier: tier, leader: leader, channel: channel,
      mtd: mtd, closes: closes, best: best, bestDay: bestDay, biggest: biggest,
      streak: streakOf(sp), prev: prev, delta: delta, daily: daily, dailyMax: maxD, dailyMaxI: maxI
    };
    m.badges = badges(m);
    return m;
  }

  // lencana: dari modul badges kalau ada, kalau tidak turunan dari angka kartu
  function badges(m) {
    var out = [], got = {};
    // lencana live (status HARI INI) — hanya masuk akal di kartu bulan berjalan
    try {
      if (m.isCur && typeof HX.badges === 'function') {
        var b = HX.badges(m.sp, m.team);
        if (b && typeof b.length === 'number') {
          for (var i = 0; i < b.length && out.length < 3; i++) {
            var x = b[i], label = '', tone = '', icon = '';
            if (typeof x === 'string') label = x;
            else if (x && typeof x === 'object') {
              label = x.label || x.name || x.title || '';
              tone = String(x.tone || x.tier || '').toLowerCase();
              if (x.id) {
                got[x.id] = 1;
                try { icon = HX.badges.icon ? String(HX.badges.icon(x.id) || '') : ''; } catch (e2) { icon = ''; }
              }
            }
            label = String(label).replace(/\s+/g, ' ').trim();
            if (!/^<svg[\s>]/.test(icon)) icon = '';
            if (label) out.push({ label: label.slice(0, 28), tier: tone === 'gold' ? 'gold' : '', icon: icon });
          }
        }
      }
    } catch (e) { }
    // lencana bulan (turunan angka kartu)
    var r = m.rank;
    if (r === 1) out.push({ label: 'Juara ' + m.monthName, tier: 'gold' });
    else if (r && r <= 3) out.push({ label: 'Top 3 ' + m.monthName, tier: 'gold' });
    else if (r && r <= 10) out.push({ label: 'Top 10 ' + m.monthName, tier: 'silver' });
    if (m.mtd >= 100e6) out.push({ label: 'Omset 100jt+' });
    else if (m.mtd >= 50e6) out.push({ label: 'Omset 50jt+' });
    if (m.closes >= 20) out.push({ label: '20+ closing' });
    else if (m.closes >= 10) out.push({ label: '10+ closing' });
    if (m.streak >= 3 && !got.beruntun) out.push({ label: 'Streak ' + m.streak + ' hari' });
    if (m.biggest && m.biggest.rev >= 10e6) out.push({ label: 'Penjualan 10jt+' });
    if (m.delta != null && m.delta > 0 && m.mtd > 0) out.push({ label: 'Naik vs ' + m.prevName });
    return out.slice(0, 5);
  }

  /* ── seni: rosette guilloche (sama untuk layar & PNG) ─────────────── */
  // ctx sudah di-translate ke pojok kiri-atas jendela. w,h = ukuran jendela,
  // k = piksel per em kartu (untuk tebal garis & huruf).
  function drawArt(ctx, w, h, k, m) {
    var R = rng(m.seed);
    var cx = w * (0.70 + R() * 0.06), cy = h * (0.44 + R() * 0.08);
    var base = Math.min(w, h);
    var lw = Math.max(0.5, k * 0.04);

    ctx.save();
    // cahaya dalam jendela
    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.95);
    glow.addColorStop(0, 'rgba(48,209,88,0.20)');
    glow.addColorStop(0.55, 'rgba(48,209,88,0.06)');
    glow.addColorStop(1, 'rgba(48,209,88,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // garis tepi jam (bezel): lingkaran tipis + tick
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    [0.72, 0.765].forEach(function (f) { ctx.beginPath(); ctx.arc(cx, cy, base * f, 0, Math.PI * 2); ctx.stroke(); });
    ctx.beginPath();
    for (var t = 0; t < 120; t++) {
      var a = t / 120 * Math.PI * 2, r1 = base * (t % 5 ? 0.732 : 0.726), r2 = base * 0.753;
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    // pita guilloche: kurva gelombang di sekeliling lingkaran, beberapa salinan bergeser fase
    var gold = m.tier === 'gold';
    var inner = gold ? '255,212,38' : m.tier === 'silver' ? '235,235,245' : '120,240,160';
    var bands = [
      { r: 0.49, a: 0.042, n: 14 + Math.floor(R() * 5), c: 18, h2: 0.18, col: '48,209,88', al: 0.26 },
      { r: 0.355, a: 0.036, n: 10 + Math.floor(R() * 4), c: 14, h2: 0.22, col: '120,240,160', al: 0.34 },
      { r: 0.215, a: 0.032, n: 7 + Math.floor(R() * 3), c: 12, h2: 0.15, col: inner, al: gold ? 0.46 : 0.4 }
    ];
    bands.forEach(function (b) {
      var steps = Math.max(200, b.n * 26), ph0 = R() * Math.PI * 2;
      ctx.strokeStyle = 'rgba(' + b.col + ',' + b.al + ')';
      ctx.lineWidth = lw;
      for (var c = 0; c < b.c; c++) {
        var ph = ph0 + c / b.c * Math.PI * 2 / b.n * 2;
        ctx.beginPath();
        for (var i = 0; i <= steps; i++) {
          var tt = i / steps * Math.PI * 2;
          var rr = base * (b.r + b.a * Math.sin(b.n * tt + ph) + b.a * b.h2 * Math.sin(2 * b.n * tt - ph * 1.7));
          var x = cx + Math.cos(tt) * rr, y = cy + Math.sin(tt) * rr;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    });

    // teks mikro melingkar (seperti uang kertas)
    var txt = 'HURRICANE XCS · KARTU SALES · ' + m.sp.toUpperCase() + ' · ';
    var fs = Math.max(4, k * 0.3);
    ctx.font = '700 ' + fs + 'px ' + MO;
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var rr2 = base * 0.64, circ = Math.PI * 2 * rr2, cw = fs * 0.66;
    var nch = Math.floor(circ / cw), full = '';
    while (full.length < nch) full += txt;
    full = full.slice(0, nch);
    for (var q = 0; q < nch; q++) {
      var aa = q / nch * Math.PI * 2 - Math.PI / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(aa) * rr2, cy + Math.sin(aa) * rr2);
      ctx.rotate(aa + Math.PI / 2);
      ctx.fillText(full.charAt(q), 0, 0);
      ctx.restore();
    }

    // huruf depan sales di tengah rosette (garis luar)
    var ini = (m.name.replace(/[^A-Za-z0-9]/g, '').charAt(0) || '?').toUpperCase();
    ctx.font = '700 ' + (base * 0.2) + 'px ' + GR;
    ctx.lineWidth = Math.max(0.6, k * 0.05);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeText(ini, cx, cy + base * 0.01);
    ctx.restore();
  }

  /* ── markup ───────────────────────────────────────────────────────── */
  var ICON_CARD = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.2" y="1.8" width="9.6" height="12.4" rx="1.9"/><path d="M8 4.9l1.15 2.1L8 9.1 6.85 7z"/><path d="M5.8 11.6h4.4"/></svg>';
  var ICON_X = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  var ICON_FLIP = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.8 6.2A5.3 5.3 0 0 1 12.6 4.6"/><path d="M12.9 2.2v2.6h-2.6"/><path d="M13.2 9.8a5.3 5.3 0 0 1-9.8 1.6"/><path d="M3.1 13.8v-2.6h2.6"/></svg>';
  var ICON_SAVE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.2v8.2"/><path d="M4.7 7.2L8 10.5l3.3-3.3"/><path d="M2.8 11.6v1.2c0 .6.5 1.1 1.1 1.1h8.2c.6 0 1.1-.5 1.1-1.1v-1.2"/></svg>';

  function rankTxt(m) { return m.rank ? (m.rank < 100 ? pad2(m.rank) : String(m.rank)) : '––'; }
  function tierName(m) { return m.tier === 'gold' ? 'Emas' : m.tier === 'silver' ? 'Perak' : 'Kaca'; }
  function rankLabel(m) { return 'Peringkat ' + m.monthName; }
  // tanpa peringkat: team lead / belum ada omset bulan itu (dua baris)
  function unranked(m) { return m.leader ? ['Team lead', 'tidak diperingkat'] : ['Belum ada', 'omset']; }
  function serial(m) { return 'No. ' + rankTxt(m) + ' / ' + pad2(m.total); }

  function frontHTML(m) {
    var prod = m.best ? m.best.prod : '—';
    return '' +
      '<div class="hxc-plate"></div>' +
      '<div class="hxc-a hxc-top"><span class="hxc-brand">HURRICANE XCS</span><span class="hxc-ed">' + esc(m.monthShort) + '</span></div>' +
      '<div class="hxc-win">' +
        '<canvas class="hxc-art" aria-hidden="true"></canvas>' +
        '<div class="hxc-a hxc-rkl"><span>' + esc(rankLabel(m)) + '</span></div>' +
        '<div class="hxc-a hxc-tierc"><span>' + esc(tierName(m)) + '</span></div>' +
        (m.rank
          ? '<div class="hxc-a hxc-rkw"><span class="hxc-rkh">#</span><span class="hxc-rk">' + esc(rankTxt(m)) + '</span></div>'
          : '<div class="hxc-a hxc-rkn"><span>' + esc(unranked(m)[0]) + '</span><span>' + esc(unranked(m)[1]) + '</span></div>') +
      '</div>' +
      '<div class="hxc-a hxc-name"><span>' + esc(m.name) + '</span></div>' +
      '<div class="hxc-a hxc-team"><span class="hxc-mono">' + esc(m.mono) + '</span><span class="hxc-tn">Team ' + esc(m.team) + '</span></div>' +
      '<div class="hxc-a hxc-rule"></div>' +
      '<div class="hxc-a hxc-ol"><span class="hxc-k">Omset ' + esc(m.monthName) + '</span></div>' +
      '<div class="hxc-a hxc-om"><span class="hxc-rp">Rp</span><span class="hxc-num" data-v="' + m.mtd + '">' + esc(money(m.mtd)) + '</span></div>' +
      '<div class="hxc-a hxc-c1"><span class="hxc-k">Closing</span><span class="hxc-v">' + m.closes + '</span></div>' +
      '<div class="hxc-a hxc-c2"><span class="hxc-k">Produk terlaris</span><span class="hxc-v hxc-prod">' + esc(prod) + '</span></div>' +
      '<div class="hxc-a hxc-foot"><span>' + esc(serial(m)) + '</span><span>Kartu sales</span></div>' +
      '<div class="hxc-foil" aria-hidden="true"></div>' +
      '<div class="hxc-spec" aria-hidden="true"></div>' +
      '<div class="hxc-glint" aria-hidden="true"></div>';
  }

  function spark(m) {
    var n = m.daily.length, W = 300, H = 64, gap = n > 20 ? 1.6 : 2.4, bw = W / Math.max(n, 1);
    var max = m.dailyMax || 1, s = '';
    for (var i = 0; i < n; i++) {
      var v = m.daily[i], x = i * bw + gap / 2, w = Math.max(1, bw - gap);
      if (v > 0) {
        var h = Math.max(3, v / max * (H - 4));
        s += '<rect class="' + (i === m.dailyMaxI ? 'hxc-sb is-max' : 'hxc-sb') + '" x="' + x.toFixed(2) + '" y="' + (H - h).toFixed(2) + '" width="' + w.toFixed(2) + '" height="' + h.toFixed(2) + '" rx="' + Math.min(1.5, w / 2).toFixed(2) + '"/>';
      } else {
        s += '<rect class="hxc-sb0" x="' + x.toFixed(2) + '" y="' + (H - 1.6) + '" width="' + w.toFixed(2) + '" height="1.6" rx=".8"/>';
      }
    }
    return '<svg class="hxc-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><g class="hxc-bars">' + s + '</g></svg>';
  }

  function backHTML(m) {
    var bd = m.bestDay, bg = m.biggest;
    var dl = m.delta, dCls = dl == null ? '' : dl > 0.5 ? ' is-up' : dl < -0.5 ? ' is-down' : '';
    var dVal = dl == null ? (m.mtd > 0 ? 'Baru' : '—') : pct(dl);
    var dSub = m.isCur ? '1–' + m.prevCut + ' ' + m.prevShort + ': ' + rp(m.prev) : m.prevName + ': ' + rp(m.prev);
    var tiles = [
      ['Hari terbaik', bd ? rp(bd.rev) : '—', bd ? keyDate(bd.key) : 'belum ada', ''],
      ['Penjualan terbesar', bg ? rp(bg.rev) : '—', bg ? (bg.prod ? bg.prod + ' · ' : '') + keyDateShort(bg.key) : 'belum ada', ''],
      ['Streak closing', m.streak ? m.streak + ' hari' : '—', m.streak ? 'beruntun, Minggu boleh libur' : 'belum ada streak', m.streak >= 3 ? ' is-up' : ''],
      ['vs ' + m.prevName, dVal, dSub, dCls]
    ].map(function (t) {
      return '<div class="hxc-tile"><span class="hxc-k">' + esc(t[0]) + '</span><span class="hxc-tv' + t[3] + '">' + esc(t[1]) + '</span><span class="hxc-ts">' + esc(t[2]) + '</span></div>';
    }).join('');
    var chips = m.badges.length
      ? m.badges.map(function (b) { return '<span class="hxc-chip' + (b.tier === 'gold' ? ' is-gold' : '') + '">' + (b.icon || '') + esc(b.label) + '</span>'; }).join('')
      : '<span class="hxc-none">Belum ada lencana</span>';
    var first = '1 ' + MON[m.M0], last = m.cut + ' ' + MON[m.M0];
    return '' +
      '<div class="hxc-plate"></div>' +
      '<div class="hxc-a hxc-bh">' +
        '<div class="hxc-bhn"><span class="hxc-bname">' + esc(m.name) + '</span><span class="hxc-bteam"><span class="hxc-mono">' + esc(m.mono) + '</span>Team ' + esc(m.team) + '</span></div>' +
        '<span class="hxc-brk">' + (m.rank ? '#' + esc(rankTxt(m)) : '\u2014') + '</span>' +
      '</div>' +
      '<div class="hxc-a hxc-sec1"><span class="hxc-k">Statistik · ' + esc(m.monthName) + '</span></div>' +
      '<div class="hxc-a hxc-tiles">' + tiles + '</div>' +
      '<div class="hxc-a hxc-sec2"><span class="hxc-k">Omset harian · ' + esc(m.monthName) + '</span><span class="hxc-k hxc-max">' + (m.dailyMax ? 'maks ' + esc(money(m.dailyMax)) : '') + '</span></div>' +
      '<div class="hxc-a hxc-chart">' + spark(m) + '</div>' +
      '<div class="hxc-a hxc-axis"><span>' + esc(first) + '</span><span>' + esc(last) + '</span></div>' +
      '<div class="hxc-a hxc-sec3"><span class="hxc-k">Lencana</span></div>' +
      '<div class="hxc-a hxc-chips">' + chips + '</div>' +
      '<div class="hxc-a hxc-foot"><span>Ketuk untuk kembali</span><span>' + esc(serial(m)) + '</span></div>' +
      '<div class="hxc-spec" aria-hidden="true"></div>';
  }

  function overlayHTML(m) {
    var touch = coarse();
    return '' +
      '<div class="hxc-scrim"></div>' +
      '<div class="hxc-bar">' +
        '<div class="hxc-bar-t"><span class="hxc-bar-k">Kartu sales</span><span class="hxc-bar-s">' + esc(m.monthLong) + '</span></div>' +
        '<button type="button" class="hxc-x" aria-label="Tutup">' + ICON_X + '</button>' +
      '</div>' +
      '<div class="hxc-main">' +
        '<div class="hxc-slot" tabindex="0" role="button" aria-pressed="false" aria-label="Kartu ' + esc(m.sp) + '. Ketuk untuk membalik.">' +
          '<div class="hxc-enter"><div class="hxc-float"><div class="hxc-tilt">' +
            '<div class="hxc-face hxc-front t-' + m.tier + '">' + frontHTML(m) + '</div>' +
            '<div class="hxc-face hxc-back t-' + m.tier + '">' + backHTML(m) + '</div>' +
          '</div></div></div>' +
        '</div>' +
        '<div class="hxc-side">' +
          '<div class="hxc-hint">' + (touch ? 'Ketuk kartu untuk membalik · geser untuk memiringkan' : 'Klik kartu untuk membalik · gerakkan kursor untuk memiringkan') + '</div>' +
          '<div class="hxc-ctl">' +
            '<button type="button" class="hxc-btn hxc-bflip">' + ICON_FLIP + '<span>Balik</span></button>' +
            '<button type="button" class="hxc-btn hxc-bsave is-primary">' + ICON_SAVE + '<span class="hxc-bsl">Simpan gambar</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="hxc-msg" role="status" aria-live="polite"></div>';
  }

  function coarse() {
    try { return matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0 && !matchMedia('(hover: hover)').matches; } catch (e) { return false; }
  }
  function isIOS() {
    var p = navigator.platform || '', ua = navigator.userAgent || '';
    return /iP(hone|od|ad)/.test(p) || /iP(hone|od|ad)/.test(ua) || (p === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
  }

  /* ── pegas (untuk miring & balik) ─────────────────────────────────── */
  function Spring(x) { this.x = x; this.v = 0; this.t = x; }
  Spring.prototype.step = function (dt, k, c) {
    var a = k * (this.t - this.x) - c * this.v;
    this.v += a * dt; this.x += this.v * dt;
  };
  Spring.prototype.rest = function (eps) { return Math.abs(this.t - this.x) < eps && Math.abs(this.v) < eps * 8; };
  Spring.prototype.snap = function () { this.x = this.t; this.v = 0; };

  /* ── layar penuh ──────────────────────────────────────────────────── */
  var cur = null, seq = 0;
  var html = document.documentElement;

  /* riwayat: satu entri {hxCard:id} selama kartu terbuka. history.back() kita
     asinkron — popstate-nya dikenali lewat backPending, supaya kartu yang
     langsung dibuka lagi tidak ikut tertutup dan tidak ada entri basi. */
  var backPending = 0, backT = 0;
  function pushEntry(c) {
    if (backPending) { c.wantPush = true; return; }
    try { history.pushState({ hxCard: c.id }, ''); c.pushed = true; } catch (e) { }
  }
  function backDone() {
    backPending = 0; clearTimeout(backT);
    // dorong entri baru SETELAH pendengar popstate lain (fx-morph) selesai
    // membaca state hasil Back ini
    setTimeout(function () { if (cur && cur.wantPush && !backPending) { cur.wantPush = false; pushEntry(cur); } }, 0);
  }
  window.addEventListener('popstate', function () {
    if (backPending) { backDone(); return; }      // Back yang kita minta sendiri
    if (!cur) return;
    cur.popped = true;                            // tombol Back HP / browser
    close();
  });

  function open(sp, team) {
    if (!sp) return;
    // kartu lain masih terbuka: ganti di tempat, entri riwayatnya dipakai ulang
    var reuse = !!(cur && cur.pushed && !cur.popped && history.state && history.state.hxCard === cur.id);
    if (cur) close(true, reuse);
    var m = model(sp, team);
    var root = document.createElement('div');
    root.className = 'hxc-ov' + (reduced() ? ' is-rm' : '') + (HX.tier === 'low' ? ' is-low' : '');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Kartu sales ' + m.sp);
    root.setAttribute('tabindex', '-1');
    root.innerHTML = overlayHTML(m);
    document.body.appendChild(root);

    var c = cur = {
      id: ++seq, m: m, root: root, rm: reduced(),
      slot: root.querySelector('.hxc-slot'), tilt: root.querySelector('.hxc-tilt'),
      front: root.querySelector('.hxc-front'), back: root.querySelector('.hxc-back'),
      foil: root.querySelector('.hxc-front .hxc-foil'),
      specs: root.querySelectorAll('.hxc-spec'),
      saveBtn: root.querySelector('.hxc-bsave'),
      S: { rx: new Spring(0), ry: new Spring(0), px: new Spring(0.5), py: new Spring(0.5), f: new Spring(0) },
      flipped: false, g: null, hover: false, live: false, raf: 0, last: 0, lastEnd: 0,
      timers: [], pushed: false, popped: false, frontVis: true, backVis: false,
      png: null, pngBusy: false, pngWant: false, urls: [],
      prevFocus: document.activeElement
    };
    html.classList.add('hx-overlay-open');
    if (!c.rm) c.back.style.visibility = 'hidden';

    layout();
    // seni digambar di frame berikutnya: frame pertama overlay tetap ringan
    requestAnimationFrame(function () { if (cur === c) paintArt(); });

    // riwayat: tombol Back Android menutup kartu
    if (reuse) { try { history.replaceState({ hxCard: c.id }, ''); c.pushed = true; } catch (e) { pushEntry(c); } }
    else pushEntry(c);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onBlur);

    root.addEventListener('click', onRootClick);
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('wheel', onWheel, { passive: false });
    var slot = c.slot;
    slot.addEventListener('pointerdown', onDown);
    slot.addEventListener('pointermove', onMove);
    slot.addEventListener('pointerup', onUp);
    slot.addEventListener('pointercancel', onCancel);
    slot.addEventListener('lostpointercapture', onCancel);
    slot.addEventListener('pointerleave', onLeave);
    slot.addEventListener('contextmenu', prevent);
    slot.addEventListener('keydown', onSlotKey);
    root.querySelector('.hxc-x').addEventListener('click', function (e) { e.stopPropagation(); close(); });
    root.querySelector('.hxc-bflip').addEventListener('click', function (e) { e.stopPropagation(); flip(); });
    c.saveBtn.addEventListener('click', function (e) { e.stopPropagation(); save(); });

    // masuk
    void root.offsetWidth;
    root.classList.add('is-in');
    // fokus ke dialog (bukan tombol X: di HP cincin fokusnya terlihat seperti tombol aktif)
    try { root.focus({ preventScroll: true }); } catch (e) { try { root.focus(); } catch (e2) { } }
    if (!c.rm && HX.tier !== 'low' && m.mtd > 0) {
      var num = root.querySelector('.hxc-num');
      if (num) { num.setAttribute('aria-label', money(m.mtd)); num.textContent = money(0); }
      later(function () { countUp(c); }, 260);
    }
    // PNG disiapkan di belakang (supaya share() bisa langsung di ketukan)
    later(function () { idle(function () { if (cur === c) makePng(c); }); }, 1300);
  }

  function later(fn, ms) { if (!cur) return; var c = cur; c.timers.push(setTimeout(function () { if (cur === c) fn(); }, ms)); }
  function idle(fn) { if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 1500 }); else setTimeout(fn, 60); }
  function prevent(e) { e.preventDefault(); }

  function close(instant, keepHistory) {
    var c = cur;
    if (!c) return;
    cur = null;
    if (c.raf) cancelAnimationFrame(c.raf);
    c.timers.forEach(clearTimeout);
    if (c.g) { html.classList.remove('hx-gesture'); c.g = null; }
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onBlur);
    // entri riwayat kita dibuang lagi kalau ditutup bukan lewat Back
    if (c.pushed && !c.popped && !keepHistory) {
      try {
        if (history.state && history.state.hxCard === c.id) {
          backPending = 1;
          clearTimeout(backT); backT = setTimeout(backDone, 1000);   // jaga-jaga popstate tak datang
          history.back();
        }
      } catch (e) { backPending = 0; }
    }
    var root = c.root;
    var done = function () {
      if (root.parentNode) root.parentNode.removeChild(root);
      c.urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { } });
      if (!cur) html.classList.remove('hx-overlay-open');
    };
    if (c.prevFocus && c.prevFocus.focus && document.contains(c.prevFocus)) {
      try { c.prevFocus.focus({ preventScroll: true }); } catch (e) { }
    }
    if (instant || c.rm) { done(); return; }
    root.classList.remove('is-in');
    root.classList.add('is-out');
    setTimeout(done, 300);
  }

  function onKey(e) {
    if (!cur) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === 'Tab') {   // fokus berputar di dalam layar kartu (Safari tidak men-Tab tombol sendiri)
      var f = Array.prototype.slice.call(cur.root.querySelectorAll('.hxc-x,.hxc-slot,.hxc-btn'));
      if (!f.length) return;
      e.preventDefault();
      var i = f.indexOf(document.activeElement), n = f.length;
      var nx = i < 0 ? (e.shiftKey ? n - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + n) % n;
      try { f[nx].focus({ preventScroll: true }); } catch (er) { f[nx].focus(); }
      return;
    }
    if (/^(PageUp|PageDown|Home|End|ArrowUp|ArrowDown| |Spacebar)$/.test(e.key) && e.target === document.body) e.preventDefault();
  }
  function onSlotKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); flip(); }
  }
  function onRootClick(e) {
    if (!cur) return;
    if (now() - cur.lastEnd < 350) return;
    var t = e.target, r = cur.root;
    if (t === r || t.classList.contains('hxc-scrim') || t.classList.contains('hxc-main') || t.classList.contains('hxc-bar') ||
        t.classList.contains('hxc-side') || t.classList.contains('hxc-hint')) close();
  }
  function onTouchMove(e) {
    // kunci scroll halaman di belakang; cubit-zoom (2 jari) tetap boleh
    if (e.touches && e.touches.length > 1) return;
    if (e.cancelable) e.preventDefault();
  }
  function onWheel(e) { if (e.cancelable && !e.ctrlKey) e.preventDefault(); }
  function onBlur(e) {
    if (!cur) return;
    if (e && e.type === 'visibilitychange' && !document.hidden) return;
    endGesture(false);
    cur.hover = false; aimRest(); kick();
  }
  var rT = 0;
  function onResize() {
    if (!cur) return;
    clearTimeout(rT);
    rT = setTimeout(function () { if (cur) { layout(); paintArt(); } }, 120);
  }

  /* ── ukuran kartu ─────────────────────────────────────────────────── */
  function layout() {
    var c = cur, r = c.root;
    var vw = window.innerWidth || html.clientWidth, vh = window.innerHeight || html.clientHeight;
    var wide = vw > vh * 1.2 && vh < 600;
    r.classList[wide ? 'add' : 'remove']('is-wide');
    r.classList[vh < 640 && !wide ? 'add' : 'remove']('is-short');
    var bar = r.querySelector('.hxc-bar'), side = r.querySelector('.hxc-side');
    var W;
    if (wide) {
      W = Math.min((vh - 28) / 1.4, vw - side.offsetWidth - 72 - 2 * 56);
    } else {
      var avail = vh - bar.offsetHeight - side.offsetHeight - (vh < 640 ? 22 : 40);
      W = Math.min(vw - 40, avail / 1.4, 380);
    }
    W = Math.max(180, Math.floor(W));
    var H = Math.round(W * 1.4);
    var s = c.slot.style;
    s.width = W + 'px'; s.height = H + 'px';
    s.fontSize = (W / 20).toFixed(3) + 'px';
    s.perspective = Math.round(W * 3.4) + 'px';
    s.webkitPerspective = s.perspective;
    c.W = W; c.H = H;
  }

  function paintArt() {
    var c = cur, cv = c.root.querySelector('.hxc-art');
    if (!cv || !cv.getContext) return;
    var w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, HX.tier === 'low' ? 2 : 3);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawArt(ctx, w, h, c.W / 20, c.m);
    // huruf Space Mono/Grotesk mungkin belum termuat saat kartu dibuka pertama
    if (document.fonts && document.fonts.status !== 'loaded' && !c.fontWait) {
      c.fontWait = true;
      document.fonts.ready.then(function () { if (cur === c) paintArt(); });
    }
  }

  function countUp(c) {
    var el = c.root.querySelector('.hxc-num');
    var to = c.m.mtd;
    if (!el || !(to > 0)) return;
    var t0 = 0, D = 1150;
    function f(ts) {
      if (cur !== c) return;
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / D), e = 1 - Math.pow(1 - p, 4);
      el.textContent = money(p < 1 ? to * e : to);
      if (p < 1) requestAnimationFrame(f);
    }
    requestAnimationFrame(f);
  }

  /* ── gestur: miring & ketuk ───────────────────────────────────────── */
  function rectOf() { return cur.slot.getBoundingClientRect(); }
  function aim(e) {
    var c = cur, rc = c.rect || (c.rect = rectOf());
    var nx = clamp((e.clientX - rc.left) / (rc.width || 1), 0, 1), ny = clamp((e.clientY - rc.top) / (rc.height || 1), 0, 1);
    c.S.rx.t = (0.5 - ny) * 2 * TILT;
    c.S.ry.t = (nx - 0.5) * 2 * TILT;
    c.S.px.t = nx; c.S.py.t = ny;
    setLive(true);
    kick();
  }
  function aimRest() {
    var S = cur.S;
    S.rx.t = 0; S.ry.t = 0; S.px.t = 0.5; S.py.t = 0.5;
  }
  function setLive(on) {
    var c = cur;
    if (c.live === on) return;
    c.live = on;
    c.root.classList[on ? 'add' : 'remove']('is-live');
  }
  function onDown(e) {
    var c = cur;
    if (!c || (e.pointerType === 'mouse' && e.button !== 0)) return;
    // jari kedua = cubit-zoom browser (touch-action:pinch-zoom): lepas miring,
    // ketukan jari pertama tidak lagi membalik kartu
    if (e.isPrimary === false) { if (c.g) endGesture(true); return; }
    if (c.g) return;
    if (html.classList.contains('hx-gesture')) return;     // modul lain sedang memegang gestur
    c.g = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now(), moved: false };
    html.classList.add('hx-gesture');
    try { c.slot.setPointerCapture(e.pointerId); } catch (er) { }
    c.rect = rectOf();
    if (!c.rm) aim(e);
  }
  function onMove(e) {
    var c = cur;
    if (!c) return;
    if (c.g && e.pointerId === c.g.id) {
      var dx = e.clientX - c.g.x, dy = e.clientY - c.g.y;
      if (dx * dx + dy * dy > 81) c.g.moved = true;
      if (!c.rm) aim(e);
      return;
    }
    if (!c.g && e.pointerType === 'mouse' && !c.rm) {
      if (html.classList.contains('hx-gesture')) return;   // gestur modul lain
      if (!c.hover) { c.hover = true; c.rect = rectOf(); }
      aim(e);
    }
  }
  function onUp(e) {
    var c = cur;
    if (!c || !c.g || e.pointerId !== c.g.id) return;
    var tap = !c.g.moved && now() - c.g.t < 650;
    endGesture(true);
    if (tap) flip();
  }
  function onCancel(e) {
    var c = cur;
    if (!c || !c.g || (e && e.pointerId !== c.g.id)) return;
    endGesture(true);
  }
  function onLeave(e) {
    var c = cur;
    if (!c || c.g || e.pointerType !== 'mouse') return;
    c.hover = false; c.rect = null;
    aimRest(); kick();
  }
  function endGesture(rest) {
    var c = cur;
    if (!c || !c.g) return;
    var id = c.g.id;
    c.g = null;
    html.classList.remove('hx-gesture');
    try { if (c.slot.hasPointerCapture && c.slot.hasPointerCapture(id)) c.slot.releasePointerCapture(id); } catch (er) { }
    c.lastEnd = now();
    c.rect = null;
    if (rest && !c.hover) { aimRest(); kick(); }
  }

  function flip() {
    var c = cur;
    if (!c) return;
    c.flipped = !c.flipped;
    c.slot.setAttribute('aria-pressed', c.flipped ? 'true' : 'false');
    c.root.classList[c.flipped ? 'add' : 'remove']('is-flipped');
    c.root.classList.add('is-touched');
    if (c.rm) return;   // Kurangi Gerak: pudar silang lewat CSS (.is-rm.is-flipped), tanpa putar
    // putar ke arah sebaliknya dari sudut sekarang (selalu searah)
    var f = c.S.f;
    f.t = c.flipped ? 180 : 0;
    if (c.flipped && !c.backShown) { c.backShown = true; c.root.classList.add('is-back-in'); }
    kick();
  }
  function setVis(front, back) {
    var c = cur;
    if (front !== c.frontVis) { c.frontVis = front; c.front.style.visibility = front ? '' : 'hidden'; }
    if (back !== c.backVis) { c.backVis = back; c.back.style.visibility = back ? '' : 'hidden'; }
  }

  function kick() {
    var c = cur;
    if (!c || c.raf || c.rm) return;
    c.last = 0;
    c.raf = requestAnimationFrame(tick);
  }
  function tick(ts) {
    var c = cur;
    if (!c) return;
    c.raf = 0;
    var dt = c.last ? Math.min(0.034, (ts - c.last) / 1000) : 1 / 60;
    c.last = ts;
    var S = c.S, follow = !!(c.g || c.hover);
    var k = follow ? 320 : 140, d = follow ? 34 : 15;
    // dua sub-langkah: stabil walau HP menjatuhkan frame
    for (var i = 0; i < 2; i++) {
      S.rx.step(dt / 2, k, d); S.ry.step(dt / 2, k, d);
      S.px.step(dt / 2, k, d); S.py.step(dt / 2, k, d);
      S.f.step(dt / 2, 72, 13.6);
    }
    var tiltRest = !follow && S.rx.rest(0.03) && S.ry.rest(0.03) && S.px.rest(0.002) && S.py.rest(0.002);
    var flipRest = S.f.rest(0.08);
    if (tiltRest) { S.rx.snap(); S.ry.snap(); S.px.snap(); S.py.snap(); }
    if (flipRest) S.f.snap();
    apply();
    if (tiltRest && !follow) setLive(false);
    if (tiltRest && flipRest && !follow) {
      // diam: lepas transform 3D supaya Chrome menggambar teks kartu tajam lagi
      c.tilt.style.transform = c.flipped ? 'rotateY(180deg)' : '';
      return;
    }
    c.raf = requestAnimationFrame(tick);
  }
  function apply() {
    var c = cur, S = c.S;
    var rx = S.rx.x, ry = S.ry.x, f = S.f.x;
    var lift = Math.abs(Math.sin(f * Math.PI / 180));
    var sc = 1 + 0.045 * lift;
    c.tilt.style.transform = 'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + (ry + f).toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
    // sisi yang menghadap layar (cadangan backface-visibility untuk lapisan anak di WebKit)
    var cos = Math.cos((ry + f) * Math.PI / 180);
    setVis(cos > -0.02, cos < 0.02);
    if (!c.live) return;
    var mag = Math.min(1, Math.sqrt(rx * rx + ry * ry) / TILT);
    var fx = (0.5 - S.px.x) * 34, fy = (0.5 - S.py.x) * 34;
    if (c.foil) {
      c.foil.style.transform = 'translate3d(' + fx.toFixed(2) + '%,' + fy.toFixed(2) + '%,0)';
      c.foil.style.opacity = (0.2 + 0.3 * mag).toFixed(3);
    }
    var sx = (0.5 - S.px.x) * 46;
    for (var i = 0; i < c.specs.length; i++) {
      c.specs[i].style.transform = 'translate3d(' + sx.toFixed(2) + '%,0,0)';
      c.specs[i].style.opacity = (0.3 + 0.6 * mag).toFixed(3);
    }
  }

  /* ── simpan gambar ────────────────────────────────────────────────── */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  // teks berspasi huruf (ctx.letterSpacing belum ada di semua browser)
  function spaced(ctx, s, x, y, sp, align) {
    var w = 0, i, ws = [];
    for (i = 0; i < s.length; i++) { ws.push(ctx.measureText(s.charAt(i)).width); w += ws[i] + (i < s.length - 1 ? sp : 0); }
    var sx = align === 'right' ? x - w : x;
    var a0 = ctx.textAlign; ctx.textAlign = 'left';
    for (i = 0; i < s.length; i++) { ctx.fillText(s.charAt(i), sx, y); sx += ws[i] + sp; }
    ctx.textAlign = a0;
    return w;
  }
  function fit(ctx, s, maxW) {
    if (ctx.measureText(s).width <= maxW) return s;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function rimGrad(ctx, W, H, tier) {
    var g = ctx.createLinearGradient(0, 0, W, H);
    var st = tier === 'gold'
      ? [[0, '#fff4bf'], [0.2, '#d9a514'], [0.42, '#ffe27a'], [0.64, '#9c7410'], [0.84, '#ffd426'], [1, '#b98c12']]
      : tier === 'silver'
        ? [[0, '#ffffff'], [0.22, '#8e9299'], [0.45, '#f2f2f5'], [0.68, '#6f737a'], [0.86, '#d9dbe0'], [1, '#9a9ea6']]
        : [[0, 'rgba(255,255,255,0.40)'], [0.38, 'rgba(255,255,255,0.10)'], [0.62, 'rgba(255,255,255,0.20)'], [1, 'rgba(255,255,255,0.07)']];
    st.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  }

  // Gambar kartu DEPAN pada canvas W x H (rasio 20:28). Koordinat dalam em kartu.
  // Dua tahap (latar+seni, lalu teks+foil) supaya tidak satu tugas panjang.
  function paintBase(cv, m) {
    var W = cv.width, H = cv.height, u = W / 20;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    // bingkai
    roundRect(ctx, 0, 0, W, H, 1.05 * u);
    ctx.fillStyle = rimGrad(ctx, W, H, m.tier);
    ctx.fill();
    // pelat dalam
    var ix = 0.18 * u;
    roundRect(ctx, ix, ix, W - 2 * ix, H - 2 * ix, 0.88 * u);
    var g = ctx.createLinearGradient(0, 0, W * 0.35, H);
    g.addColorStop(0, '#1a1c20'); g.addColorStop(0.52, '#0d0e11'); g.addColorStop(1, '#070809');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    var rg = ctx.createRadialGradient(W * 0.85, -H * 0.05, 0, W * 0.85, -H * 0.05, W * 1.2);
    rg.addColorStop(0, 'rgba(48,209,88,0.16)'); rg.addColorStop(0.6, 'rgba(48,209,88,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    // kilau tepi atas pelat
    ctx.save();
    roundRect(ctx, ix, ix, W - 2 * ix, H - 2 * ix, 0.88 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = Math.max(1, u * 0.05); ctx.stroke();
    ctx.restore();

    // jendela seni
    var wx = 0.98 * u, wy = 2.53 * u, ww = W - 2 * wx, wh = 11.4 * u;
    ctx.save();
    roundRect(ctx, wx, wy, ww, wh, 0.72 * u);
    var wg = ctx.createLinearGradient(0, wy, 0, wy + wh);
    wg.addColorStop(0, '#0b0c0e'); wg.addColorStop(1, '#050606');
    ctx.fillStyle = wg; ctx.fill();
    ctx.clip();
    ctx.translate(wx, wy);
    drawArt(ctx, ww, wh, u, m);
    ctx.restore();
    roundRect(ctx, wx, wy, ww, wh, 0.72 * u);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)'; ctx.lineWidth = Math.max(1, u * 0.05); ctx.stroke();
  }
  function paintTop(cv, m) {
    var W = cv.width, H = cv.height, u = W / 20;
    var ctx = cv.getContext('2d');
    var wx = 0.98 * u, wy = 2.53 * u, ww = W - 2 * wx, wh = 11.4 * u;
    ctx.textBaseline = 'alphabetic';
    // baris atas
    ctx.font = '700 ' + (0.6 * u) + 'px ' + MO;
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    spaced(ctx, 'HURRICANE XCS', 1.3 * u, 1.86 * u, 0.13 * u, 'left');
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    spaced(ctx, m.monthShort, W - 1.3 * u, 1.86 * u, 0.08 * u, 'right');

    // label peringkat + chip tingkat di jendela
    ctx.font = '700 ' + (0.56 * u) + 'px ' + MO;
    ctx.fillStyle = 'rgba(255,255,255,0.66)';
    spaced(ctx, rankLabel(m).toUpperCase(), wx + 0.85 * u, wy + 1.42 * u, 0.12 * u, 'left');
    var tn = tierName(m).toUpperCase();
    ctx.font = '700 ' + (0.5 * u) + 'px ' + MO;
    var tw = 0; for (var i = 0; i < tn.length; i++) tw += ctx.measureText(tn.charAt(i)).width + (i < tn.length - 1 ? 0.12 * u : 0);
    var cx2 = wx + ww - 0.75 * u, ch = 1.1 * u, cw = tw + 1.1 * u, cy2 = wy + 0.62 * u;
    roundRect(ctx, cx2 - cw, cy2, cw, ch, ch / 2);
    ctx.fillStyle = m.tier === 'gold' ? 'rgba(255,212,38,0.14)' : 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = m.tier === 'gold' ? 'rgba(255,212,38,0.55)' : m.tier === 'silver' ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = Math.max(1, u * 0.045); ctx.stroke();
    ctx.fillStyle = m.tier === 'gold' ? '#ffd426' : '#f5f5f7';
    spaced(ctx, tn, cx2 - 0.55 * u, cy2 + 0.76 * u, 0.12 * u, 'right');

    // nomor peringkat besar
    var rk = rankTxt(m), rs = 6.6 * u;
    ctx.font = '700 ' + rs + 'px ' + GR;
    var bx = wx + 0.62 * u, by = wy + wh - 0.62 * u;
    var hs = rs * 0.42;
    var rg2 = ctx.createLinearGradient(0, by - rs * 0.75, 0, by);
    if (m.tier === 'gold') { rg2.addColorStop(0, '#fff8d6'); rg2.addColorStop(0.45, '#ffd426'); rg2.addColorStop(1, '#b8860b'); }
    else if (m.tier === 'silver') { rg2.addColorStop(0, '#ffffff'); rg2.addColorStop(1, '#a3a8b0'); }
    else { rg2.addColorStop(0, 'rgba(255,255,255,0.95)'); rg2.addColorStop(1, 'rgba(255,255,255,0.45)'); }
    if (m.rank) {
      ctx.font = '700 ' + hs + 'px ' + GR;
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = rg2;
      ctx.fillText('#', bx, by - rs * 0.43);
      var hw = ctx.measureText('#').width + rs * 0.03;
      ctx.globalAlpha = 1;
      ctx.font = '700 ' + rs + 'px ' + GR;
      spaced(ctx, rk, bx + hw, by, -0.05 * rs, 'left');
    } else {
      var un = unranked(m);
      ctx.font = '700 ' + (1.7 * u) + 'px ' + GR;
      ctx.fillStyle = 'rgba(245,245,247,0.92)';
      ctx.fillText(un[0], wx + 0.85 * u, wy + wh - 1.98 * u);
      ctx.font = '600 ' + (0.95 * u) + 'px ' + GR;
      ctx.fillStyle = 'rgba(235,235,245,0.5)';
      ctx.fillText(un[1], wx + 0.85 * u, wy + wh - 0.86 * u);
    }

    // nama
    ctx.font = '700 ' + (1.85 * u) + 'px ' + GR;
    ctx.fillStyle = '#f5f5f7';
    ctx.fillText(fit(ctx, m.name, W - 2.6 * u), 1.3 * u, 16.05 * u);
    // tim: chip monogram + nama tim
    ctx.font = '700 ' + (0.56 * u) + 'px ' + MO;
    var mw = 0; for (i = 0; i < m.mono.length; i++) mw += ctx.measureText(m.mono.charAt(i)).width + (i < m.mono.length - 1 ? 0.05 * u : 0);
    var mcw = Math.max(1.9 * u, mw + 0.8 * u), mch = 1.12 * u, mx = 1.3 * u, my = 16.75 * u;
    roundRect(ctx, mx, my, mcw, mch, 0.32 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(1, u * 0.04); ctx.stroke();
    ctx.fillStyle = '#e5e5ea';
    spaced(ctx, m.mono, mx + (mcw - mw) / 2, my + 0.76 * u, 0.05 * u, 'left');
    ctx.font = '500 ' + (0.74 * u) + 'px ' + GR;
    ctx.fillStyle = 'rgba(235,235,245,0.62)';
    ctx.fillText(fit(ctx, 'Team ' + m.team, W - mx - mcw - 0.5 * u - 1.3 * u), mx + mcw + 0.5 * u, my + 0.8 * u);
    // garis
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(1.3 * u, 18.45 * u, W - 2.6 * u, Math.max(1, u * 0.04));
    // omzet
    ctx.font = '700 ' + (0.56 * u) + 'px ' + MO;
    ctx.fillStyle = 'rgba(235,235,245,0.5)';
    spaced(ctx, ('Omset ' + m.monthName).toUpperCase(), 1.3 * u, 19.55 * u, 0.12 * u, 'left');
    ctx.font = '600 ' + (1.0 * u) + 'px ' + GR;
    ctx.fillStyle = 'rgba(48,209,88,0.75)';
    ctx.fillText('Rp', 1.3 * u, 22.0 * u);
    var rpw = ctx.measureText('Rp').width;
    ctx.font = '700 ' + (2.15 * u) + 'px ' + GR;
    ctx.fillStyle = '#30d158';
    spaced(ctx, money(m.mtd), 1.3 * u + rpw + 0.3 * u, 22.0 * u, -0.02 * 2.15 * u, 'left');
    // closing & produk
    ctx.font = '700 ' + (0.56 * u) + 'px ' + MO;
    ctx.fillStyle = 'rgba(235,235,245,0.5)';
    spaced(ctx, 'CLOSING', 1.3 * u, 23.55 * u, 0.12 * u, 'left');
    spaced(ctx, 'PRODUK TERLARIS', 7.2 * u, 23.55 * u, 0.12 * u, 'left');
    ctx.font = '700 ' + (1.2 * u) + 'px ' + GR;
    ctx.fillStyle = '#f5f5f7';
    ctx.fillText(String(m.closes), 1.3 * u, 25.0 * u);
    ctx.font = '700 ' + (0.98 * u) + 'px ' + GR;
    ctx.fillText(fit(ctx, m.best ? m.best.prod : '—', W - 7.2 * u - 1.3 * u), 7.2 * u, 24.95 * u);
    // kaki
    ctx.font = '700 ' + (0.5 * u) + 'px ' + MO;
    ctx.fillStyle = 'rgba(235,235,245,0.38)';
    spaced(ctx, serial(m).toUpperCase(), 1.3 * u, H - 1.12 * u, 0.1 * u, 'left');
    spaced(ctx, 'KARTU SALES', W - 1.3 * u, H - 1.12 * u, 0.1 * u, 'right');

    // foil holografik + pita kilau (posisi "difoto" miring sedikit)
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 1.05 * u);
    ctx.clip();
    var fg = ctx.createLinearGradient(0, 0, W, H);
    [[0.18, 'rgba(48,209,88,0)'], [0.27, 'rgba(64,224,160,0.10)'], [0.33, 'rgba(90,200,250,0.08)'], [0.39, 'rgba(191,90,242,0.06)'],
     [0.45, 'rgba(255,214,10,0.05)'], [0.52, 'rgba(48,209,88,0.10)'], [0.62, 'rgba(48,209,88,0)']].forEach(function (s) { fg.addColorStop(s[0], s[1]); });
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
    var sg = ctx.createLinearGradient(W * 0.05, 0, W * 0.75, H * 0.35);
    [[0.3, 'rgba(255,255,255,0)'], [0.47, 'rgba(255,255,255,0.05)'], [0.5, 'rgba(255,255,255,0.11)'], [0.53, 'rgba(255,255,255,0.05)'], [0.7, 'rgba(255,255,255,0)']].forEach(function (s) { sg.addColorStop(s[0], s[1]); });
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var loads = Promise.all([
      document.fonts.load('700 40px "Space Grotesk"'), document.fonts.load('500 40px "Space Grotesk"'),
      document.fonts.load('600 40px "Space Grotesk"'), document.fonts.load('700 20px "Space Mono"')
    ]).catch(function () { });
    var t = new Promise(function (r) { setTimeout(r, 2500); });
    return Promise.race([loads, t]);
  }
  function tickWait() { return new Promise(function (r) { setTimeout(r, 0); }); }
  function renderPng(m) {
    var cv;
    return fontsReady().then(function () {
      cv = document.createElement('canvas');
      cv.width = 1080; cv.height = 1512;
      paintBase(cv, m);
      return tickWait();
    }).then(function () {
      paintTop(cv, m);
      return cv;
    });
  }
  function toBlob(cv) {
    return new Promise(function (res, rej) {
      if (cv.toBlob) { cv.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob')); }, 'image/png'); return; }
      try {
        var d = cv.toDataURL('image/png'), bin = atob(d.split(',')[1]), a = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        res(new Blob([a], { type: 'image/png' }));
      } catch (e) { rej(e); }
    });
  }
  function makePng(c, force) {
    if (c.png || c.pngBusy || cur !== c) return;
    // jangan menggambar PNG saat kartu sedang dimiringkan / dibalik (kecuali diminta)
    if (!force && (c.g || c.hover || c.live || !c.S.f.rest(0.1))) {
      later(function () { idle(function () { makePng(c); }); }, 900);
      return;
    }
    c.pngBusy = true;
    renderPng(c.m).then(function (cv) {
      c.canvas = cv;
      return toBlob(cv);
    }).then(function (b) {
      c.pngBusy = false;
      c.png = b;
      var name = 'kartu-' + slug(c.m.sp) + '.png';
      try { c.file = new File([b], name, { type: 'image/png' }); } catch (e) { c.file = null; }
      c.fname = name;
      if (cur === c && c.pngWant) { c.pngWant = false; readyToSave(c); }
    }).catch(function (e) {
      c.pngBusy = false;
      if (cur === c) { msg('Gagal membuat gambar', true); setSaveLabel(c, 'Simpan gambar', false); }
      console.warn('[fx-card] png', e);
    });
  }
  function canShareFile(c) {
    try { return !!(c.file && navigator.share && navigator.canShare && navigator.canShare({ files: [c.file] })); } catch (e) { return false; }
  }
  function setSaveLabel(c, t, busy) {
    var l = c.saveBtn.querySelector('.hxc-bsl');
    if (l) l.textContent = t;
    c.saveBtn.classList[busy ? 'add' : 'remove']('is-busy');
    c.saveBtn.setAttribute('aria-busy', busy ? 'true' : 'false');
  }
  // dipanggil saat PNG siap SETELAH ketukan: jangan panggil share() di luar
  // ketukan (Safari menolak) — minta satu ketukan lagi.
  function readyToSave(c) {
    if (canShareFile(c) && coarse()) setSaveLabel(c, 'Bagikan gambar', false);
    else { setSaveLabel(c, 'Simpan gambar', false); doSave(c, null); }
  }
  function save() {
    var c = cur;
    if (!c) return;
    if (!c.png) {
      c.pngWant = true;
      setSaveLabel(c, 'Menyiapkan…', true);
      makePng(c, true);
      return;
    }
    // jendela iOS 14 harus dibuka langsung di dalam ketukan
    var w = null;
    if (!(canShareFile(c) && coarse()) && isIOS()) { try { w = window.open('', '_blank'); } catch (e) { w = null; } }
    doSave(c, w);
  }
  function doSave(c, w) {
    var name = c.fname;
    if (canShareFile(c) && coarse()) {
      navigator.share({ files: [c.file], title: 'Kartu ' + c.m.sp }).then(function () {
        if (cur === c) { msg('Kartu dibagikan'); setSaveLabel(c, 'Simpan gambar', false); }
      }).catch(function (e) {
        if (cur !== c) return;
        setSaveLabel(c, 'Simpan gambar', false);
        if (e && e.name === 'AbortError') return;
        download(c, name);
      });
      return;
    }
    if (isIOS()) { openTab(c, w); return; }
    download(c, name);
  }
  function download(c, name) {
    try {
      var url = URL.createObjectURL(c.png);
      c.urls.push(url);
      var a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 0);
      msg('Gambar diunduh: ' + name);
    } catch (e) { preview(c); }
  }
  function openTab(c, w) {
    var data = '';
    try { data = c.canvas.toDataURL('image/png'); } catch (e) { }
    if (!w || !data) { if (w) try { w.close(); } catch (e) { } preview(c, data); return; }
    try {
      var d = w.document;
      d.open();
      d.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>' + esc(c.fname) + '</title></head><body style="margin:0;background:#000;color:#8e8e93;font:15px -apple-system,sans-serif;text-align:center">' +
        '<img src="' + data + '" alt="' + esc('Kartu ' + c.m.sp) + '" style="display:block;width:100%;max-width:540px;margin:0 auto">' +
        '<p style="padding:16px 20px 32px;margin:0">Tekan lama gambar, lalu pilih Simpan ke Foto.</p></body></html>');
      d.close();
      msg('Gambar dibuka di tab baru');
    } catch (e) { preview(c, data); }
  }
  // cadangan terakhir: tampilkan gambar di dalam layar kartu (tekan lama = simpan)
  function preview(c, data) {
    if (cur !== c) return;
    try { data = data || c.canvas.toDataURL('image/png'); } catch (e) { msg('Gagal membuat gambar', true); return; }
    var p = document.createElement('div');
    p.className = 'hxc-prev';
    p.innerHTML = '<img alt="' + esc('Kartu ' + c.m.sp) + '" src="' + data + '"><p>Tekan lama gambar, lalu pilih Simpan.</p><button type="button" class="hxc-btn">Selesai</button>';
    p.querySelector('button').addEventListener('click', function (e) { e.stopPropagation(); if (p.parentNode) p.parentNode.removeChild(p); });
    c.root.appendChild(p);
  }
  var msgT = 0;
  function msg(t, bad) {
    if (!cur) return;
    var el = cur.root.querySelector('.hxc-msg');
    if (!el) return;
    el.textContent = t;
    el.className = 'hxc-msg is-on' + (bad ? ' is-bad' : '');
    clearTimeout(msgT);
    msgT = setTimeout(function () { if (el) el.className = 'hxc-msg'; }, 2600);
  }

  /* ── tombol di modal detail sales ─────────────────────────────────── */
  HX.spAction({
    id: 'card', label: 'Kartu', order: 20, icon: ICON_CARD,
    show: function (sp) { return !HX.isChannel(sp); },
    run: function (sp, team) { open(sp, team); }
  });

  /* ── uji ──────────────────────────────────────────────────────────── */
  HX.card = {
    open: open,
    close: function () { close(); },
    flip: function () { flip(); },
    model: model,
    // TES/tangkapan layar saja: tahan kartu pada pose tertentu (derajat; px,py 0..1)
    pose: function (rx, ry, f, px, py) {
      if (!cur || cur.rm) return;
      var S = cur.S;
      S.rx.x = S.rx.t = +rx || 0; S.ry.x = S.ry.t = +ry || 0; S.f.x = S.f.t = +f || 0;
      S.px.x = S.px.t = px == null ? 0.5 - (+ry || 0) / (2 * TILT) * -1 : +px;
      S.py.x = S.py.t = py == null ? 0.5 - (+rx || 0) / (2 * TILT) : +py;
      setLive(true); apply();
    },
    state: function () {
      if (!cur) return { open: false, overlayClass: html.classList.contains('hx-overlay-open') };
      return {
        open: true, sp: cur.m.sp, team: cur.m.team, rank: cur.m.rank, tier: cur.m.tier, flipped: cur.flipped,
        angle: cur.S.f.x, rx: cur.S.rx.x, ry: cur.S.ry.x, live: cur.live, gesture: !!cur.g,
        png: !!cur.png, W: cur.W, H: cur.H, reduced: cur.rm, pushed: cur.pushed,
        frontVis: getComputedStyle(cur.front).visibility !== 'hidden',
        backVis: getComputedStyle(cur.back).visibility !== 'hidden'
      };
    },
    png: function (sp, team) {
      return renderPng(model(sp, team)).then(function (cv) { return cv.toDataURL('image/png'); });
    }
  };
})();
