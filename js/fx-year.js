/* ══════════════════════════════════════════════════════════════════════
   FX YEAR — Rekap 1 Tahun + Rekor Bulanan per sales.
   HANYA MEMBACA (allData lewat HX.monthAgg). Tidak pernah menulis ke Firebase.

   1. Halaman "Yearly Recap" (#page-yearly → #hxYear)
      - 12 batang omset per bulan (tahun kalender, atau 12 bulan terakhir),
        bisa disaring: Semua · per tim · per sales.
      - Bulan REKOR (melewati rekor sepanjang masa saat itu) = emas + mahkota,
        bulan TURUN (lebih kecil dari bulan sebelumnya) = merah, NAIK = hijau,
        bulan pertama (belum ada pembanding) = perak, bulan BERJALAN = permukaan
        cair + bayangan proyeksi akhir bulan.
      - Garis tangga emas = rekor sepanjang masa dari bulan ke bulan; setiap
        anak tangga = rekor baru.
      - Geser jari di grafik untuk memilih bulan; kartu detail di bawahnya
        (omset, vs bulan lalu, vs rekor, closing, hari terbaik, top 3 sales,
        tombol buka Monthly Recap bulan itu).
      - Daftar "Kejar Rekor": tiap sales, omset bulan ini vs rekor bulanannya.
   2. Kartu Salespeople: strip REKOR di tiap kartu (rekor bulanan sebelum
      bulan yang dilihat, progres bulan itu, kurang berapa / REKOR BARU).
   3. Modal detail sales: blok rekor pribadi + grafik mini 12 bulan, dan
      tombol "Rekap 1 Tahun" (buka halaman tahunan khusus sales itu).

   DEFINISI (satu untuk semua tampilan di modul ini)
   - Omset bulan = jumlah revenue semua record bulan itu (= Monthly Recap).
     Tim = susunan roster SEKARANG (HX.monthAgg, termasuk team lead & channel
     di tim itu); sales = digabung per nama.
   - Bulan "data belum lengkap": bulan lampau yang hari ber-datanya < 10
     (April 2026 hanya 4 hari). Tidak dipakai untuk rekor / naik-turun.
   - Bulan pertama sales yang mulai jualan < 10 hari sebelum akhir bulan
     (mis. udin 26 Sep) juga bukan patokan rekor — bulan berikutnya dihitung
     "bulan pertama", bukan "rekor +1000%".
   - Rekor bulan X = omset X > omset terbesar semua bulan lengkap SEBELUM X
     (minimal 1 bulan pembanding). Bulan berjalan boleh jadi rekor begitu
     omsetnya sudah lewat (tidak menunggu akhir bulan).
   - Turun/naik = dibanding bulan tepat sebelumnya (kalau bulan itu lengkap).
     Bulan berjalan dibanding tanggal yang SAMA bulan lalu (1–29 Sep), sama
     dengan Monthly Recap — tidak pernah ditandai "turun".
   - Channel (Tokopedia, Shopee, Live tiktok…) & team lead: tidak punya strip
     rekor / blok rekor (sama dengan HX.records di fx-live).
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HX = window.HX;
  if (!HX || HX.__year) return;
  HX.__year = true;
  var D = document;

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var MIN_DATA_DAYS = 10;

  /* ── util ─────────────────────────────────────────────────────────── */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function byId(id) { return D.getElementById(id); }
  function now() { return new Date(); }
  function mk(y, m) { return y + '-' + (m < 9 ? '0' : '') + (m + 1); }
  function mnorm(y, m) { while (m < 0) { m += 12; y--; } while (m > 11) { m -= 12; y++; } return { y: y, m: m }; }
  function dim(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function money(n) { return HX.money(n); }
  function full(n) { return HX.moneyFull(n); }
  function pct(x, d) { d = d == null ? 1 : d; return (x * 100).toFixed(d).replace('.', ','); }
  // "berapa persen dari" (< 100%) dibulatkan KE BAWAH: 99,86% → 99%, bukan 100%
  function pctFloor(x) { return String(Math.floor(x * 100 + 1e-9)); }
  // perubahan: 1 desimal kalau kecil (−9,7%), bulat kalau besar (+24%)
  function pctChg(x) { var a = Math.abs(x); return pct(a, a < 0.1 ? 1 : 0); }
  function sgn(x) { return x > 0 ? '+' : (x < 0 ? '−' : ''); }
  // label batang: maksimal ±5 karakter (12 kolom di layar HP 360px)
  function compact(n) {
    n = Math.round(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace('.', ',').replace(/,0$/, '') + 'M';
    if (n >= 1e6) { var j = n / 1e6; return (j < 10 ? (Math.round(j * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(j))) + 'jt'; }
    if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
    return n ? String(n) : '0';
  }
  // label persen di bawah batang (kolom ±28px): +100% ke atas jadi "▲5×"
  function deltaLbl(d) {
    if (d >= 1) return '▲' + Math.round(1 + d) + '×';
    var a = Math.abs(d * 100);
    var s = (d >= 0 ? '▲' : '▼') + (a < 10 ? a.toFixed(1).replace('.', ',') : String(Math.round(a))) + '%';
    // sama dengan chip & tabel (−9,7%); di layar sempit tanda % dibuang supaya muat
    var w = window.innerWidth || 1024, max = w <= 340 ? 4 : w <= 400 ? 5 : 6;
    if (s.length > max) s = s.slice(0, -1);
    return s;
  }
  function teamMonoHtml(t) { try { if (typeof teamChip === 'function') return teamChip(t); } catch (e) { } return ''; }
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  function roster() { try { return TM || {}; } catch (e) { return {}; } }
  function teamOrder() {
    var o; try { o = _TEAM_ORDER; } catch (e) { o = []; }
    var ts = Object.keys(roster()).filter(function (t) { var x = roster()[t]; return x && x.m && x.m.length; });
    return ts.sort(function (a, b) { var ai = o.indexOf(a), bi = o.indexOf(b); return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || (a < b ? -1 : 1); });
  }
  function reduced() { return HX.reduced(); }
  function vib(ms) { try { if (navigator.vibrate && !reduced()) navigator.vibrate(ms); } catch (e) { } }
  function noRecord(sp) { return HX.isLeader(sp) || HX.isChannel(sp); }
  function pageOn(id) { var p = byId(id); return !!(p && p.classList.contains('active')); }
  // bulan yang sedang dilihat dashboard (hari terpilih) — sama dengan kartu Salespeople
  function viewMonth() {
    var d; try { d = od(vOff); } catch (e) { d = now(); }
    return { y: d.getFullYear(), m: d.getMonth() };
  }
  // bulan modal sales: Monthly Recap membuka modal untuk mYear/mMonth
  function modalMonth() {
    if (pageOn('page-monthly')) { try { if (typeof mYear === 'number' && typeof mMonth === 'number') return { y: mYear, m: mMonth }; } catch (e) { } }
    return viewMonth();
  }
  // tulis innerHTML hanya kalau berubah (fokus keyboard & hover tidak hilang)
  // ...dan kalau berubah, tombol yang sedang difokus dicari lagi lewat data-act/data-v
  function setHtml(node, h) {
    if (!node || node.__hxy === h) return false;
    var ae = D.activeElement, act = ae && ae !== node && node.contains(ae) && ae.getAttribute('data-act') ? [ae.getAttribute('data-act'), ae.getAttribute('data-v')] : null;
    node.innerHTML = h; node.__hxy = h;
    if (act) refocus(node, act);
    return true;
  }
  function refocus(node, act) {
    var q = '[data-act="' + act[0] + '"]' + (act[1] != null ? '[data-v="' + String(act[1]).replace(/["\\]/g, '\\$&') + '"]' : '');
    var b = null; try { b = node.querySelector(q); } catch (e) { }
    if (b) { try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } }
  }

  var IC = {
    crown: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5.2l3.2 2.6L8 3l2.8 4.8L14 5.2l-1.2 6.6H3.2z" fill="currentColor"/><rect x="3.2" y="12.6" width="9.6" height="1.6" rx=".8" fill="currentColor"/></svg>',
    up: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5L9 7.5H1z" fill="currentColor"/></svg>',
    down: '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5L1 2.5h8z" fill="currentColor"/></svg>',
    year: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="8.5" width="2.4" height="5.5" rx=".8" fill="currentColor" opacity=".55"/><rect x="5" y="6" width="2.4" height="8" rx=".8" fill="currentColor" opacity=".7"/><rect x="8.6" y="9" width="2.4" height="5" rx=".8" fill="currentColor" opacity=".55"/><rect x="12.1" y="2.5" width="2.4" height="11.5" rx=".8" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    r: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ── seri bulanan ─────────────────────────────────────────────────── */
  // cakupan data perusahaan per bulan: jumlah hari yang ada record omset
  var cov = null;
  function coverage() {
    if (cov) return cov;
    var D0 = data(), c = {}, first = null;
    Object.keys(D0).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var a = D0[k];
      if (!a || !a.length) return;
      var any = false;
      for (var i = 0; i < a.length; i++) if (a[i] && (+a[i].revenue || 0) > 0) { any = true; break; }
      if (!any) return;
      var m = k.slice(0, 7);
      c[m] = (c[m] || 0) + 1;
      if (!first || m < first) first = m;
    });
    cov = { days: c, first: first };
    return cov;
  }
  function firstMonth() {
    var f = coverage().first, n = now();
    if (!f) return { y: n.getFullYear(), m: n.getMonth() };
    return { y: +f.slice(0, 4), m: +f.slice(5, 7) - 1 };
  }
  function cmpYM(a, b) { return (a.y - b.y) * 12 + (a.m - b.m); }

  // nilai satu bulan (opsional s/d tanggal `upto`) untuk satu "lensa"
  function valueOf(lens, y, m, upto) {
    var A = HX.monthAgg(y, m, upto);
    if (!lens || lens.kind === 'all') return { rev: A.total, closes: A.closes, agg: A };
    if (lens.kind === 'team') {
      for (var i = 0; i < A.teams.length; i++) if (A.teams[i].team === lens.team) return { rev: A.teams[i].revenue, closes: A.teams[i].closes, agg: A, team: A.teams[i] };
      return { rev: 0, closes: 0, agg: A };
    }
    var s = A.get(lens.sp);
    if (!s && HX.isChannel(lens.sp)) {
      // channel tidak ada di sellers monthAgg (hanya untuk jaga-jaga: UI tidak membuka lensa channel)
      for (var j = 0; j < A.channels.length; j++) if (norm(A.channels[j].sp) === norm(lens.sp)) return { rev: A.channels[j].revenue, closes: A.channels[j].closes, agg: A, channel: A.channels[j] };
      return { rev: 0, closes: 0, agg: A };
    }
    return { rev: s ? s.revenue : 0, closes: s ? s.closes : 0, agg: A, seller: s };
  }

  /* Seri lengkap dari bulan data pertama s/d bulan ini, plus status tiap bulan.
     Cache per (lensa, render) — HX.monthAgg sudah di-cache per render.
     o.pre    = lensa sales: belum mulai jualan (bulan sebelum penjualan pertama)
     o.short  = lensa sales: bulan pertama yang mulai < 10 hari sebelum akhir bulan
     o.usable = boleh jadi pembanding (bukan partial/short/pre) */
  var serCache = {};
  HX.on('render', function () { serCache = {}; cov = null; });
  function lensKey(l) { return !l || l.kind === 'all' ? 'all' : l.kind + ':' + norm(l.team || l.sp); }
  function series(lens) {
    var ck = lensKey(lens);
    if (serCache[ck]) return serCache[ck];
    var n = now(), cur = { y: n.getFullYear(), m: n.getMonth() }, f = firstMonth(), C = coverage().days;
    var isSp = !!(lens && lens.kind === 'sp'), started = false;
    var out = [], best = 0, bestAt = null, eligibleBefore = 0, prev = null;
    for (var c = { y: f.y, m: f.m }; cmpYM(c, cur) <= 0; c = mnorm(c.y, c.m + 1)) {
      var key = mk(c.y, c.m), v = valueOf(lens, c.y, c.m), isCur = cmpYM(c, cur) === 0;
      var nDays = dim(c.y, c.m);
      var partial = !isCur && (C[key] || 0) < MIN_DATA_DAYS;
      var pre = isSp && !started && !(v.rev > 0), short = false, startDay = null;
      if (isSp && !started && v.rev > 0) {
        started = true;
        if (v.seller && v.seller.days) {
          var ks = Object.keys(v.seller.days).sort();
          if (ks.length) startDay = +ks[0].slice(8, 10);
        }
        if (!isCur && startDay && nDays - startDay + 1 < MIN_DATA_DAYS) short = true;
      }
      var o = {
        y: c.y, m: c.m, key: key, rev: v.rev, closes: v.closes, cur: isCur, partial: partial,
        pre: pre, short: short, startDay: startDay,
        dataDays: C[key] || 0, nDays: nDays, prevBest: best, prevBestAt: bestAt,
        record: false, down: false, up: false, delta: null, prevRev: null, prevSame: null, prevSameDays: null, proj: null, v: v
      };
      if (isCur) {
        // proyeksi dari waktu yang SUDAH lewat (hari ini dihitung sebagian);
        // < 2 hari berjalan terlalu liar (jam 00:30 tanggal 1 = −100%) → tidak ditampilkan
        var day = n.getDate(), frac = day - 1 + (n.getHours() * 60 + n.getMinutes()) / 1440;
        o.dayOf = day;
        o.proj = frac >= 2 ? o.rev / frac * nDays : null;
      }
      o.usable = !partial && !short && !pre;
      if (o.usable) {
        if (prev && prev.usable && prev.rev > 0) {
          o.prevRev = prev.rev;
          if (isCur) {
            // tanggal yang sama bulan lalu (1–29 Sep), seperti Monthly Recap
            var pm = mnorm(c.y, c.m - 1), upto = Math.min(o.dayOf, dim(pm.y, pm.m));
            var ps = valueOf(lens, pm.y, pm.m, upto).rev;
            o.prevSame = ps; o.prevSameDays = upto;
            // tanggal 1–2: hari ini baru sebagian → persennya liar (sama seperti proyeksi)
            if (ps > 0 && frac >= 2) o.delta = o.rev / ps - 1;
          } else {
            o.delta = o.rev / prev.rev - 1;
            o.down = o.rev < prev.rev; o.up = o.rev > prev.rev;
          }
        } else if (prev && prev.usable && best > 0) {
          // bulan sebelumnya Rp 0 tapi pernah jualan → bukan "bulan pertama"
          o.prevRev = 0;
          if (!isCur) o.up = o.rev > 0;
        }
        if (eligibleBefore >= 1 && best > 0 && o.rev > best) o.record = true;
        if (o.rev > 0) eligibleBefore++;
        if (o.rev > best) { best = o.rev; bestAt = key; }
      }
      o.athAfter = best; o.athAt = bestAt;
      out.push(o);
      prev = o;
    }
    var idx = {};
    out.forEach(function (o, i) { idx[o.key] = i; });
    var res = { list: out, idx: idx, ath: best, athAt: bestAt, get: function (k) { return idx[k] == null ? null : out[idx[k]]; } };
    serCache[ck] = res;
    return res;
  }

  /* status rekor satu sales untuk bulan (y,m) — dipakai kartu, modal, daftar */
  function sellerStatus(sp, y, m) {
    var S = series({ kind: 'sp', sp: sp }), o = S.get(mk(y, m));
    var best = 0, bestAt = null, months = 0;
    S.list.forEach(function (x) {
      if (cmpYM(x, { y: y, m: m }) >= 0 || !x.usable || !(x.rev > 0)) return;
      months++;
      if (x.rev > best) { best = x.rev; bestAt = x.key; }
    });
    var curRev = o ? o.rev : 0;
    return {
      sp: sp, best: best, bestAt: bestAt, months: months, current: curRev,
      ratio: best > 0 ? curRev / best : 0,
      record: months >= 1 && best > 0 && curRev > best,
      equal: months >= 1 && best > 0 && curRev === best,
      first: months === 0, isCur: !!(o && o.cur), series: S
    };
  }
  function ymLabel(key, long) {
    if (!key) return '';
    var y = +key.slice(0, 4), m = +key.slice(5, 7) - 1, ty = now().getFullYear();
    var b = long ? BULAN[m] : BLN[m];
    return y !== ty ? b + ' ' + y : b;
  }
  HX.year = { series: series, seller: sellerStatus, label: ymLabel };

  /* ══ 1. HALAMAN YEARLY RECAP ══════════════════════════════════════════ */
  var st = {
    mode: 'year',               // 'year' | 'rolling'
    year: now().getFullYear(),
    lens: { kind: 'all' },
    sel: null,                  // 'YYYY-MM'
    showAll: false,
    built: false, shownOnce: false, opening: false
  };
  var el = {};                  // referensi DOM halaman

  function pageActive() { return pageOn('page-yearly'); }

  function windowMonths() {
    var n = now(), out = [];
    if (st.mode === 'rolling') {
      for (var i = 11; i >= 0; i--) out.push(mnorm(n.getFullYear(), n.getMonth() - i));
    } else {
      for (var m = 0; m < 12; m++) out.push({ y: st.year, m: m });
    }
    return out;
  }
  function yearsWithData() {
    var C = coverage().days, ys = {};
    Object.keys(C).forEach(function (k) { ys[+k.slice(0, 4)] = 1; });
    ys[now().getFullYear()] = 1;
    return Object.keys(ys).map(Number).sort(function (a, b) { return b - a; });
  }

  // satu kolom grafik (bulan) dengan status tampilan
  function columns() {
    var S = series(st.lens), n = now(), cur = { y: n.getFullYear(), m: n.getMonth() };
    return windowMonths().map(function (c) {
      var o = S.get(mk(c.y, c.m));
      var fut = cmpYM(c, cur) > 0;
      return { y: c.y, m: c.m, key: mk(c.y, c.m), o: o, future: fut, empty: !fut && (!o || o.pre), S: S };
    });
  }
  function hasData(c) { return !!(c && c.o && !c.o.pre && !c.future); }
  function colState(c) {
    if (c.future) return 'future';
    if (!c.o || c.o.pre) return 'empty';
    if (c.o.partial || c.o.short) return 'partial';
    if (c.o.record) return 'record';
    if (c.o.cur) return 'cur';
    if (c.o.down) return 'down';
    if (c.o.up) return 'up';
    return 'base';
  }

  function lensTitle() {
    var l = st.lens;
    if (l.kind === 'team') return 'Team ' + l.team;
    if (l.kind === 'sp') return l.sp;
    return HX.brand;
  }

  function build() {
    var host = byId('hxYear');
    if (!host) return false;
    host.innerHTML = [
      '<section class="hxy-head">',
      '  <div class="hxy-kick"><span class="hxy-kdot"></span>REKAP 1 TAHUN</div>',
      '  <h1 class="hxy-h1"><span class="hxy-h1-t"></span></h1>',
      '  <p class="hxy-sub"></p>',
      '  <div class="hxy-periods" role="tablist" aria-label="Periode"></div>',
      '</section>',
      '<section class="hxy-hero">',
      '  <div class="hxy-stat hxy-stat-main"><span class="hxy-sl">TOTAL OMSET</span><strong class="hxy-sv" data-y="total">Rp 0</strong><small class="hxy-ss" data-y="totalSub"></small></div>',
      '  <div class="hxy-stat hxy-stat-ath"><span class="hxy-sl"><i class="hxy-ic">' + IC.crown + '</i>REKOR BULANAN</span><strong class="hxy-sv" data-y="ath">—</strong><small class="hxy-ss" data-y="athSub"></small></div>',
      '  <div class="hxy-stat"><span class="hxy-sl">RATA-RATA / BULAN</span><strong class="hxy-sv" data-y="avg">—</strong><small class="hxy-ss" data-y="avgSub"></small></div>',
      '  <div class="hxy-stat"><span class="hxy-sl">NAIK · TURUN</span><strong class="hxy-sv" data-y="ud">—</strong><small class="hxy-ss" data-y="udSub"></small></div>',
      '</section>',
      '<section class="hxy-chartcard">',
      '  <div class="hxy-lenses" aria-label="Saring"></div>',
      '  <div class="hxy-moments"></div>',
      '  <div class="hxy-chart" tabindex="0" role="listbox" aria-label="Omset per bulan">',
      '    <div class="hxy-grid"></div>',
      '    <svg class="hxy-athsvg" aria-hidden="true"><path class="hxy-ath-glow"/><path class="hxy-ath-line"/><g class="hxy-ath-dots"></g></svg>',
      '    <div class="hxy-cols"></div>',
      '  </div>',
      '  <div class="hxy-legend">',
      '    <span><i class="hxy-lg-rec"></i>Rekor baru</span><span><i class="hxy-lg-up"></i>Naik</span><span><i class="hxy-lg-down"></i>Turun</span><span><i class="hxy-lg-base"></i>Bulan pertama</span><span><i class="hxy-lg-cur"></i>Berjalan</span><span><i class="hxy-lg-ath"></i>Garis rekor</span>',
      '  </div>',
      '</section>',
      '<section class="hxy-detail" aria-live="polite"></section>',
      '<section class="hxy-split">',
      '  <div class="hxy-panel hxy-chase"></div>',
      '  <div class="hxy-panel hxy-table"></div>',
      '</section>',
      '<p class="hxy-foot">Omset = semua penjualan yang tercatat (sama dengan Monthly Recap). Tim mengikuti susunan roster sekarang, termasuk team lead dan channel di tim itu. Bulan dengan data kurang dari ' + MIN_DATA_DAYS + ' hari ditandai “data awal” dan tidak dihitung untuk rekor atau naik-turun. Bulan berjalan dibandingkan dengan tanggal yang sama bulan lalu.</p>'
    ].join('');
    el = {
      host: host,
      h1: host.querySelector('.hxy-h1-t'), sub: host.querySelector('.hxy-sub'),
      periods: host.querySelector('.hxy-periods'), lenses: host.querySelector('.hxy-lenses'),
      moments: host.querySelector('.hxy-moments'),
      chart: host.querySelector('.hxy-chart'), grid: host.querySelector('.hxy-grid'),
      svg: host.querySelector('.hxy-athsvg'), athLine: host.querySelector('.hxy-ath-line'), athGlow: host.querySelector('.hxy-ath-glow'), athDots: host.querySelector('.hxy-ath-dots'),
      cols: host.querySelector('.hxy-cols'), detail: host.querySelector('.hxy-detail'),
      chase: host.querySelector('.hxy-chase'), table: host.querySelector('.hxy-table'),
      stat: {}
    };
    Array.prototype.forEach.call(host.querySelectorAll('[data-y]'), function (n) { el.stat[n.getAttribute('data-y')] = n; });
    // 12 slot kolom, dipakai ulang supaya tinggi batang ber-morph antar saringan
    var h = '';
    for (var i = 0; i < 12; i++) {
      h += '<button type="button" class="hxy-col" role="option" data-i="' + i + '">' +
        '<span class="hxy-track"><span class="hxy-ghost"></span><span class="hxy-bar"><i class="hxy-shine"></i></span>' +
        '<span class="hxy-tip"><span class="hxy-crown">' + IC.crown + '<i class="hxy-spark"></i></span><span class="hxy-val"></span></span></span>' +
        '<span class="hxy-mon"></span><span class="hxy-dl"></span></button>';
    }
    el.cols.innerHTML = h;
    el.colEls = Array.prototype.slice.call(el.cols.children);
    bindChart();
    host.addEventListener('click', onHostClick);
    st.built = true;
    return true;
  }

  /* ── interaksi grafik: ketuk / geser jari / panah keyboard ─────────── */
  var lastCols = [];
  function bindChart() {
    var drag = null;
    function colAt(x) {
      var r = el.cols.getBoundingClientRect(), i = Math.floor((x - r.left) / (r.width / 12));
      return Math.max(0, Math.min(11, i));
    }
    function pick(i, fromDrag) {
      var c = lastCols[i];
      if (!hasData(c)) return;
      if (st.sel === c.key) return;
      st.sel = c.key;
      if (fromDrag) vib(4);
      paintSelection();
      paintDetail(true);
      paintTable(lastCols);
    }
    function release() {
      if (drag && drag.on) { D.documentElement.classList.remove('hx-gesture'); el.chart.classList.remove('is-scrub'); }
      drag = null;
    }
    el.chart.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      release();
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
      // mouse: langsung pilih; sentuh: tunggu — bisa jadi jari mau menggulir
      if (e.pointerType === 'mouse') pick(colAt(e.clientX), false);
    });
    el.chart.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.on) {
        // geser mendatar = scrub; tegak = biarkan halaman tergulir
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
          drag.on = true;
          D.documentElement.classList.add('hx-gesture');
          el.chart.classList.add('is-scrub');
          try { el.chart.setPointerCapture(e.pointerId); } catch (er) { }
        } else if (Math.abs(dy) > 10) { drag = null; return; }
      }
      if (drag.on) { pick(colAt(e.clientX), true); }
    });
    function end(e) {
      if (!drag || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
      var tap = !drag.on && e && e.type === 'pointerup' && Math.abs(e.clientX - drag.x) < 10 && Math.abs(e.clientY - drag.y) < 10;
      release();
      if (tap) pick(colAt(e.clientX), false);
    }
    el.chart.addEventListener('pointerup', end);
    el.chart.addEventListener('pointercancel', end);
    // Sentuh: browser menangkap pointer ke batang yang disentuh; saat
    // setPointerCapture memindahkannya ke grafik, batang itu mengirim
    // lostpointercapture yang MENGGELEMBUNG ke sini — itu bukan akhir geseran.
    el.chart.addEventListener('lostpointercapture', function (e) { if (e.target === el.chart) end(e); });
    // pindah halaman di tengah geseran → jangan tinggalkan hx-gesture menempel
    HX.on('page', function () { release(); });
    el.chart.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      var i = -1;
      lastCols.forEach(function (c, j) { if (c.key === st.sel) i = j; });
      var step = e.key === 'ArrowLeft' ? -1 : 1;
      for (var j = i + step; j >= 0 && j < 12; j += step) {
        if (hasData(lastCols[j])) { pick(j, false); break; }
      }
    });
    // pan-y: browser tetap boleh menggulir halaman ke atas/bawah dari grafik
    el.chart.style.touchAction = 'pan-y';
  }

  function onHostClick(e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!t || !el.host.contains(t)) return;
    var a = t.getAttribute('data-act'), v = t.getAttribute('data-v');
    if (a === 'period') {
      if (v === 'rolling') st.mode = 'rolling'; else { st.mode = 'year'; st.year = +v; }
      st.sel = null; paint(false);
    } else if (a === 'lens') {
      st.lens = v === 'all' ? { kind: 'all' } : { kind: 'team', team: v };
      st.prevLens = null; st.sel = null; paint(false);
    } else if (a === 'seller') {
      setSeller(v); paint(false);
      try { window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' }); } catch (er) { window.scrollTo(0, 0); }
    } else if (a === 'clearsp') {
      st.lens = st.prevLens || { kind: 'all' }; st.prevLens = null; st.sel = null; paint(false);
    } else if (a === 'month') {
      st.sel = v; paintSelection(); paintDetail(true); paintTable(lastCols);
      if (el.chart.scrollIntoView) { try { el.chart.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } catch (er) { } }
    } else if (a === 'monthly') {
      openMonthly(+v.slice(0, 4), +v.slice(5, 7) - 1);
    } else if (a === 'more') {
      st.showAll = !st.showAll; paintChase();
    }
  }
  function setSeller(sp) {
    if (st.lens.kind !== 'sp') st.prevLens = st.lens;
    st.lens = { kind: 'sp', sp: sp };
    st.sel = null;
  }
  function tabFor(p) { return D.querySelector('.nav-tab[data-page="' + p + '"]'); }
  function openMonthly(y, m) {
    try { mYear = y; mMonth = m; } catch (e) { }
    var t = tabFor('monthly');
    if (t) t.click(); else { try { showPage('monthly', D.createElement('div')); } catch (e) { } }
  }

  /* ── menggambar ───────────────────────────────────────────────────── */
  function paint(entrance) {
    if (!st.built && !build()) return;
    var cols = columns();
    lastCols = cols;
    // bulan terpilih: tetap kalau masih ada di jendela, kalau tidak → bulan berjalan / terakhir ber-data
    var ok = false;
    cols.forEach(function (c) { if (c.key === st.sel && hasData(c)) ok = true; });
    if (!ok) {
      st.sel = null;
      for (var i = cols.length - 1; i >= 0; i--) if (hasData(cols[i]) && cols[i].o.rev > 0) { st.sel = cols[i].key; break; }
      if (!st.sel) for (var j = cols.length - 1; j >= 0; j--) if (hasData(cols[j])) { st.sel = cols[j].key; break; }
    }
    paintHead(cols);
    paintHero(cols, entrance);
    paintChart(cols, entrance);
    paintSelection();
    paintDetail(!!entrance);
    paintChase();
    paintTable(cols);
    if (entrance) entranceFx();
  }

  function paintHead(cols) {
    var l = st.lens, S = cols[0] && cols[0].S;
    setHtml(el.h1, (l.kind === 'sp' ? '<span class="hxy-who">' + esc(l.sp) + '</span>' : l.kind === 'team' ? '<span class="hxy-who">' + teamMonoHtml(l.team) + 'Team ' + esc(l.team) + '</span>' : '') +
      'Omset ' + (st.mode === 'rolling' ? '12 bulan terakhir' : st.year));
    var a = cols[0], b = cols[cols.length - 1];
    var withData = cols.filter(function (c) { return hasData(c) && c.o.rev > 0; }).length;
    var sub = BLN[a.m] + ' ' + a.y + ' – ' + BLN[b.m] + ' ' + b.y + ' · ' + withData + ' bulan ada omset' +
      (l.kind === 'sp' ? ' · rekor pribadi sepanjang masa ' + (S && S.ath > 0 ? money(S.ath) + ' (' + ymLabel(S.athAt) + ')' : '—') : '');
    if (el.sub.textContent !== sub) el.sub.textContent = sub;
    // pilihan periode
    var ph = yearsWithData().map(function (y) {
      var on = st.mode === 'year' && st.year === y;
      return '<button type="button" class="hxy-seg' + (on ? ' on' : '') + '" role="tab" aria-selected="' + on + '" data-act="period" data-v="' + y + '">' + y + '</button>';
    }).join('') + '<button type="button" class="hxy-seg' + (st.mode === 'rolling' ? ' on' : '') + '" role="tab" aria-selected="' + (st.mode === 'rolling') + '" data-act="period" data-v="rolling">12 Bulan</button>';
    setHtml(el.periods, ph);
    // saringan tim / sales
    var lh = '';
    if (l.kind === 'sp') lh += '<button type="button" class="hxy-chip on is-sp" data-act="clearsp" aria-label="Tutup tampilan ' + esc(l.sp) + '"><span>' + esc(l.sp) + '</span><i class="hxy-ic">' + IC.x + '</i></button>';
    lh += '<button type="button" class="hxy-chip' + (l.kind === 'all' ? ' on' : '') + '" data-act="lens" data-v="all">Semua</button>';
    teamOrder().forEach(function (t) {
      var on = l.kind === 'team' && l.team === t;
      lh += '<button type="button" class="hxy-chip' + (on ? ' on' : '') + '" data-act="lens" data-v="' + esc(t) + '">' + teamMonoHtml(t) + esc(t) + '</button>';
    });
    if (setHtml(el.lenses, lh)) {
      // chip aktif (termasuk chip sales dengan tombol ×) harus kelihatan
      var on = el.lenses.querySelector('.hxy-chip.on');
      if (on) {
        var lr = el.lenses.getBoundingClientRect(), cr = on.getBoundingClientRect();
        if (lr.width && (cr.left < lr.left || cr.right > lr.right)) el.lenses.scrollLeft += cr.left - lr.left - 12;
      }
    }
  }

  // angka yang menghitung naik/turun dengan halus (tanpa memicu layout)
  var tweens = typeof WeakMap === 'function' ? new WeakMap() : null;
  function tweenText(node, to, fmt, ms) {
    if (!node) return;
    var from = +(node.getAttribute('data-n') || 0);
    node.setAttribute('data-n', String(to));
    var prev = tweens && tweens.get(node);
    if (from === to && prev && prev.on) return;      // render live di tengah hitungan masuk: biarkan selesai
    if (prev) prev.on = false;
    if (reduced() || !ms || from === to || !tweens) { node.textContent = fmt(to); return; }
    var t0 = 0, id = { on: true };
    tweens.set(node, id);
    function step(ts) {
      if (!id.on) return;
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      node.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else id.on = false;
    }
    requestAnimationFrame(step);
  }

  function setStat(node, txt) {
    var p = tweens && tweens.get(node); if (p) p.on = false;
    node.setAttribute('data-n', '0'); node.textContent = txt;
  }
  function paintHero(cols, entrance) {
    var vis = cols.filter(hasData);
    var total = 0, full_ = 0, nFull = 0, up = 0, down = 0, recs = [];
    vis.forEach(function (c) {
      total += c.o.rev;
      if (c.o.usable && !c.o.cur && c.o.rev > 0) { full_ += c.o.rev; nFull++; }
      if (c.o.up) up++;
      if (c.o.down) down++;
      if (c.o.record) recs.push(c);
    });
    var S = cols[0].S, ms = entrance ? 1300 : 650;
    tweenText(el.stat.total, total, full, ms);
    var cur = vis.filter(function (c) { return c.o.cur; })[0];
    el.stat.totalSub.textContent = vis.length ? (cur ? 'termasuk ' + BULAN[cur.m] + ' (berjalan, ' + cur.o.dayOf + '/' + cur.o.nDays + ' hari)' : vis.length + ' bulan') : 'belum ada data';
    if (S.ath > 0) {
      tweenText(el.stat.ath, S.ath, money, ms);
      el.stat.athSub.textContent = ymLabel(S.athAt, true) + (S.athAt === mk(now().getFullYear(), now().getMonth()) ? ' · bulan ini' : '') + ' · sepanjang masa';
    } else { setStat(el.stat.ath, '—'); el.stat.athSub.textContent = 'belum ada rekor'; }
    if (nFull) { tweenText(el.stat.avg, full_ / nFull, money, ms); el.stat.avgSub.textContent = 'dari ' + nFull + ' bulan lengkap'; }
    else { setStat(el.stat.avg, '—'); el.stat.avgSub.textContent = 'belum ada bulan lengkap'; }
    setHtml(el.stat.ud, '<span class="hxy-up">' + IC.up + up + '</span><span class="hxy-down">' + IC.down + down + '</span>');
    el.stat.udSub.textContent = (up || down ? up + ' bulan naik, ' + down + ' turun' : 'belum ada pembanding') + (recs.length ? ' · ' + recs.length + '× rekor baru' : '');
    // chip momen: rekor & turun — jawaban cepat "bulan mana pecah rekor, mana turun"
    var yr = function (c) { return c.y !== now().getFullYear() ? " '" + String(c.y).slice(2) : ''; };
    var rh = recs.map(function (c) {
      return '<button type="button" class="hxy-mchip rec" data-act="month" data-v="' + c.key + '"><i class="hxy-ic">' + IC.crown + '</i>' + BLN[c.m] + yr(c) + '</button>';
    }).join('');
    var dh = vis.filter(function (c) { return c.o.down; }).map(function (c) {
      return '<button type="button" class="hxy-mchip down" data-act="month" data-v="' + c.key + '"><i class="hxy-ic">' + IC.down + '</i>' + BLN[c.m] + yr(c) + ' ' + sgn(c.o.delta) + pctChg(c.o.delta) + '%</button>';
    }).join('');
    setHtml(el.moments, (rh ? '<div class="hxy-mgrp"><span class="hxy-mlbl">Rekor baru</span>' + rh + '</div>' : '') +
      (dh ? '<div class="hxy-mgrp"><span class="hxy-mlbl">Turun</span>' + dh + '</div>' : ''));
    el.moments.style.display = rh || dh ? '' : 'none';
  }

  // batas atas sumbu: langkah 1·2·4·6·8·10 → garis 25/50/75/100% selalu angka bulat
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), n = v / p;
    var s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return s * p;
  }

  var geo = { max: 1 };
  function paintChart(cols, entrance) {
    var hi = 0;
    cols.forEach(function (c) { if (hasData(c)) { hi = Math.max(hi, c.o.rev, c.o.proj || 0, c.o.prevBest || 0); } });
    var max = niceMax(hi * 1.08);
    geo.max = max;
    var gh = '';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      gh += '<div class="hxy-gl" style="bottom:' + (f * 100) + '%"><span>' + compact(max * f) + '</span></div>';
    });
    setHtml(el.grid, gh);
    // entrance hanya DITAMBAH di sini; entranceFx yang melepasnya (2,6 dtk).
    // Render live di tengah entrance tidak boleh memotong animasi.
    if (entrance && !reduced()) el.chart.classList.add('is-entrance');
    // tinggi area batang (px tata letak — tidak terpengaruh transform masuk)
    var tr0 = el.cols.querySelector('.hxy-track'), th = tr0 ? tr0.offsetHeight : 0, lp = th > 0 ? 18 / th * 100 : 0;
    cols.forEach(function (c, i) {
      var b = el.colEls[i], s = colState(c), o = hasData(c) ? c.o : null;
      var h = o ? Math.max(o.rev > 0 ? 1.2 : 0, o.rev / max * 100) : 0;
      var gp = o && o.cur && o.proj > o.rev ? Math.min(100, o.proj / max * 100) : 0;
      // label nilai jangan tertimpa garis rekor emas: naikkan ke atas garis
      var top = Math.max(h, gp);
      var ap = o && o.athAfter > 0 ? Math.min(100, o.athAfter / max * 100) : -1;
      if (ap > top && ap - top < lp) top = ap;
      b.className = 'hxy-col st-' + s + (o && o.cur ? ' is-cur' : '') + (c.key === st.sel ? ' sel' : '');
      b.style.setProperty('--h', h.toFixed(2) + '%');
      b.style.setProperty('--gp', gp.toFixed(2) + '%');
      b.style.setProperty('--t', top.toFixed(2) + '%');
      b.style.setProperty('--i', String(i));
      b.disabled = !o;
      b.setAttribute('aria-selected', c.key === st.sel ? 'true' : 'false');
      b.setAttribute('data-k', c.key);
      var mon = b.querySelector('.hxy-mon'), dl = b.querySelector('.hxy-dl'), val = b.querySelector('.hxy-val');
      if (mon.textContent !== BLN[c.m]) mon.textContent = BLN[c.m];
      var vtxt = o && o.rev > 0 ? compact(o.rev) : (c.future ? '' : (o ? '0' : '—'));
      if (val.textContent !== vtxt) val.textContent = vtxt;
      var dtxt = '';
      if (o && (o.partial || o.short) && o.rev > 0) dtxt = 'awal';
      else if (o && o.cur) dtxt = 'jalan';
      else if (o && o.delta != null) dtxt = deltaLbl(o.delta);
      if (dl.textContent !== dtxt) dl.textContent = dtxt;
      dl.className = 'hxy-dl' + (o && o.delta != null && !o.cur ? (o.delta >= 0 ? ' pos' : ' neg') : '');
      var lbl = BULAN[c.m] + ' ' + c.y + ': ' + (c.future ? 'belum berjalan' : !o ? 'belum ada data' : full(o.rev) +
        (o.record ? ', rekor baru' : '') + (o.down ? ', turun ' + pct(Math.abs(o.delta)) + '%' : '') + (o.up ? ', naik ' + pct(o.delta) + '%' : '') +
        (o.cur ? ', bulan berjalan' : '') + (o.partial ? ', data belum lengkap' : '') + (o.short ? ', bulan pertama (mulai ' + o.startDay + ' ' + BLN[c.m] + ')' : ''));
      b.setAttribute('aria-label', lbl);
    });
    drawAth(cols, entrance);
  }

  // garis tangga rekor sepanjang masa (dari bulan pertama ber-data di jendela)
  function drawAth(cols, entrance) {
    var tr = el.cols.querySelector('.hxy-track');
    var cr = el.chart.getBoundingClientRect();
    if (!tr || !cr.width) { el.athLine.setAttribute('d', ''); el.athGlow.setAttribute('d', ''); setHtml(el.athDots, ''); return; }
    // Halaman bisa sedang di-scale animasi masuk (glass.css lg-rise .99):
    // ukur dalam piksel tata letak, bukan piksel layar.
    var k = el.chart.offsetWidth / cr.width;
    var r = el.cols.getBoundingClientRect(), tb = tr.getBoundingClientRect();
    var Wc = el.chart.offsetWidth, Hc = el.chart.offsetHeight;
    var W = r.width * k, H = tr.offsetHeight, ox = (r.left - cr.left) * k, oyBottom = (tb.bottom - cr.top) * k, cw = W / 12;
    if (!W || !H) { el.athLine.setAttribute('d', ''); el.athGlow.setAttribute('d', ''); setHtml(el.athDots, ''); return; }
    el.svg.setAttribute('viewBox', '0 0 ' + Wc + ' ' + Hc);
    el.svg.setAttribute('width', Wc); el.svg.setAttribute('height', Hc);
    var d = '', dots = '', started = false, lastY = null;
    cols.forEach(function (c, i) {
      if (!hasData(c)) return;
      var o = c.o, lvl = o.athAfter;
      if (!(lvl > 0)) return;
      var y = oyBottom - Math.min(1, lvl / geo.max) * H, x0 = ox + i * cw, x1 = x0 + cw;
      if (!started) { d += 'M' + x0.toFixed(1) + ' ' + y.toFixed(1); started = true; }
      else if (lastY !== null && Math.abs(lastY - y) > 0.1) { d += ' L' + x0.toFixed(1) + ' ' + lastY.toFixed(1) + ' L' + x0.toFixed(1) + ' ' + y.toFixed(1); }
      d += ' L' + x1.toFixed(1) + ' ' + y.toFixed(1);
      if (o.record) dots += '<circle cx="' + (x0 + cw / 2).toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" style="--i:' + i + '"/>';
      lastY = y;
    });
    el.athLine.setAttribute('d', d);
    el.athGlow.setAttribute('d', d);
    setHtml(el.athDots, dots);
    if (entrance && !reduced() && d && el.athLine.getTotalLength) {
      var L = 0; try { L = el.athLine.getTotalLength(); } catch (e) { }
      if (L > 0) {
        [el.athLine, el.athGlow].forEach(function (p) {
          p.style.transition = 'none';
          p.style.strokeDasharray = L + ' ' + L;
          p.style.strokeDashoffset = String(L);
          p.getBoundingClientRect();
          p.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(.22,1,.36,1) .55s';
          p.style.strokeDashoffset = '0';
        });
        clearTimeout(drawAth.t);
        drawAth.t = setTimeout(function () { [el.athLine, el.athGlow].forEach(function (p) { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; p.style.transition = ''; }); }, 2300);
      }
    }
  }

  function paintSelection() {
    el.colEls.forEach(function (b) {
      var on = b.getAttribute('data-k') === st.sel;
      b.classList.toggle('sel', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    el.chart.classList.toggle('has-sel', !!st.sel);
  }

  function statusPill(o) {
    if (!o) return '';
    if (o.partial) return '<span class="hxy-pill hxy-p-grey">Data belum lengkap · ' + o.dataDays + ' hari</span>';
    if (o.short) return '<span class="hxy-pill hxy-p-grey">Bulan pertama · mulai jualan ' + o.startDay + ' ' + BLN[o.m] + '</span>';
    var p = '';
    if (o.record) p += '<span class="hxy-pill hxy-p-gold"><i class="hxy-ic">' + IC.crown + '</i>' + (o.cur ? 'Rekor baru · bulan ini' : 'Rekor baru') + '</span>';
    if (o.cur) p += '<span class="hxy-pill hxy-p-live"><i class="hxy-ldot"></i>Berjalan · ' + o.dayOf + '/' + o.nDays + ' hari</span>';
    else if (o.down) p += '<span class="hxy-pill hxy-p-red"><i class="hxy-ic">' + IC.down + '</i>Turun</span>';
    else if (o.up && !o.record) p += '<span class="hxy-pill hxy-p-green"><i class="hxy-ic">' + IC.up + '</i>Naik</span>';
    else if (!o.record && o.prevRev == null) p += '<span class="hxy-pill hxy-p-grey">Bulan pertama · belum ada pembanding</span>';
    return p;
  }

  // hari terbaik bulan itu untuk lensa (pakai atribusi tim yang SAMA dengan total)
  function bestDayOf(o, l, A) {
    var best = null, D0 = data();
    for (var d = 1; d <= o.nDays; d++) {
      var k = HX.dayKey(new Date(o.y, o.m, d)), sum = 0;
      (D0[k] || []).forEach(function (e) {
        if (!e) return;
        if (l.kind === 'all') { sum += +e.revenue || 0; return; }
        var nm = String(e.sp == null ? '' : e.sp).trim(), t = e.team;
        if (HX.isChannel(nm)) {
          for (var ci = 0; ci < A.channels.length; ci++) if (norm(A.channels[ci].sp) === norm(nm)) { t = A.channels[ci].team; break; }
        } else { var sx = A.get(nm); if (sx) t = sx.team; }
        if (t === l.team) sum += +e.revenue || 0;
      });
      if (sum > 0 && (!best || sum > best.v)) best = { d: d, v: sum };
    }
    return best;
  }

  function paintDetail(anim) {
    var c = null;
    lastCols.forEach(function (x) { if (x.key === st.sel) c = x; });
    if (!hasData(c)) { el.detail.__sig = null; setHtml(el.detail, '<div class="hxy-empty">Belum ada data omset di periode ini.</div>'); return; }
    var o = c.o, l = st.lens, A = o.v.agg;
    var cmp = [];
    var pm = mnorm(o.y, o.m - 1);
    if (o.cur && o.prevSame != null) {
      var lbl = 'vs 1–' + o.prevSameDays + ' ' + BLN[pm.m];
      var subTxt = BLN[pm.m] + ' 1–' + o.prevSameDays + ': ' + money(o.prevSame) + (o.rev > o.prevRev ? ' · sudah lewat total ' + BULAN[pm.m] : '');
      if (o.delta != null) cmp.push(box(o.delta >= 0 ? 'pos' : 'neg', lbl, (o.delta >= 0 ? IC.up : IC.down) + sgn(o.delta) + pct(Math.abs(o.delta)) + '%', subTxt));
    } else if (o.prevRev != null && o.delta != null) {
      cmp.push(box(o.delta >= 0 ? 'pos' : 'neg', 'vs ' + BULAN[pm.m],
        (o.delta >= 0 ? IC.up : IC.down) + sgn(o.delta) + pct(Math.abs(o.delta)) + '%',
        sgn(o.rev - o.prevRev) + money(Math.abs(o.rev - o.prevRev))));
    }
    if (o.usable && o.prevBest > 0) {
      if (o.record) cmp.push(box('gold', 'vs rekor lama', IC.crown + '+' + pct(o.rev / o.prevBest - 1) + '%', 'rekor lama ' + money(o.prevBest) + ' · ' + ymLabel(o.prevBestAt)));
      else if (o.rev === o.prevBest) cmp.push(box('neutral', 'vs rekor ' + ymLabel(o.prevBestAt), '100%', 'sama dengan rekor'));
      else cmp.push(box('neutral', 'vs rekor ' + ymLabel(o.prevBestAt), pctFloor(o.rev / o.prevBest) + '%', 'kurang ' + money(o.prevBest - o.rev)));
    }
    if (o.cur && o.proj != null) cmp.push(box('live', 'proyeksi ' + o.nDays + ' ' + BLN[o.m], money(o.proj), 'kalau laju ' + o.dayOf + ' hari pertama berlanjut'));

    // statistik + daftar top
    var stats = [], top = [], topTitle = '';
    if (l.kind === 'sp') {
      var s = o.v.seller;
      stats.push(['Closing', String(o.closes || 0)]);
      stats.push(['Peringkat', s && s.rank ? '#' + s.rank + ' dari ' + A.nSellers : '—']);
      stats.push(['Hari terbaik', s && s.best && s.best.date ? money(s.best.revenue) + ' · ' + (+s.best.date.slice(8)) + ' ' + BLN[+s.best.date.slice(5, 7) - 1] : '—']);
      stats.push(['Produk teratas', s && s.topProd ? esc(s.topProd) : '—']);
    } else {
      // sales aktif & top 3: orang saja (tanpa team lead & channel)
      var pool = l.kind === 'team' && o.v.team ? o.v.team.members.filter(function (x) { return !x.leader; }) : A.sellers;
      var nSell = pool.filter(function (x) { return x.revenue > 0; }).length;
      stats.push(['Closing', String(o.closes || 0)]);
      stats.push(['Sales aktif', String(nSell)]);
      var bd = bestDayOf(o, l, A);
      stats.push(['Hari terbaik', bd ? money(bd.v) + ' · ' + bd.d + ' ' + BLN[o.m] : '—']);
      if (l.kind === 'all') {
        var tt = A.teams[0];
        stats.push(['Tim teratas', tt ? teamMonoHtml(tt.team) + esc(tt.team) : '—']);
      } else {
        stats.push(['Kontribusi', A.total > 0 ? pct(o.rev / A.total) + '% omset' : '—']);
      }
      top = pool.filter(function (x) { return x.revenue > 0; }).slice(0, 3);
      topTitle = 'Top 3 sales ' + BULAN[o.m];
    }
    var h = '<div class="hxy-dhead"><div><div class="hxy-dmon">' + BULAN[o.m] + ' ' + o.y + '</div><div class="hxy-pills">' + statusPill(o) + '</div></div>' +
      '<button type="button" class="hxy-link" data-act="monthly" data-v="' + o.key + '">Monthly Recap<i class="hxy-ic">' + IC.r + '</i></button></div>' +
      '<div class="hxy-dval' + (o.record ? ' is-rec' : '') + '">' + full(o.rev) + '</div>' +
      (cmp.length ? '<div class="hxy-cmp">' + cmp.join('') + '</div>' : '') +
      '<div class="hxy-dstats">' + stats.map(function (x) { return '<div><span>' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
    if (top.length) {
      h += '<div class="hxy-top"><div class="hxy-ptitle">' + topTitle + '</div>' + top.map(function (x, i) {
        return '<button type="button" class="hxy-trow" data-act="seller" data-v="' + esc(x.sp) + '"><span class="hxy-rk r' + (i + 1) + '">0' + (i + 1) + '</span>' +
          '<span class="hxy-tn">' + esc(x.sp) + '<small>' + teamMonoHtml(x.team) + esc(x.team || '') + '</small></span><span class="hxy-tv">' + money(x.revenue) + '</span><i class="hxy-ic hxy-chev">' + IC.r + '</i></button>';
      }).join('') + '</div>';
    }
    // tidak berubah → jangan sentuh (fokus keyboard tetap, angka tidak berputar ulang)
    var sig = h + '|' + o.key;
    if (!anim && el.detail.__sig === sig) return;
    var ae = D.activeElement, act = ae && el.detail.contains(ae) ? [ae.getAttribute('data-act'), ae.getAttribute('data-v')] : null;
    var prevN = el.detail.__last == null ? 0 : el.detail.__last;
    el.detail.innerHTML = h;
    el.detail.__sig = sig; el.detail.__hxy = null;
    var dv = el.detail.querySelector('.hxy-dval');
    dv.setAttribute('data-n', String(prevN));
    el.detail.__last = o.rev;
    tweenText(dv, o.rev, full, anim ? 700 : 0);
    if (act && act[0]) refocus(el.detail, act);
    if (anim && !reduced()) {
      el.detail.classList.remove('flip'); void el.detail.offsetWidth; el.detail.classList.add('flip');
    }
  }
  function box(tone, l, v, s) {
    return '<div class="hxy-cbox hxy-bt-' + tone + '"><span>' + l + '</span><b>' + v + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</div>';
  }

  // daftar "Kejar Rekor" — bulan berjalan vs rekor bulanan tiap sales
  function chaseRows() {
    var n = now(), y = n.getFullYear(), m = n.getMonth(), l = st.lens, rows = [];
    var R = roster(), seen = {};
    Object.keys(R).forEach(function (t) {
      if (l.kind === 'team' && t !== l.team) return;
      ((R[t] && R[t].m) || []).forEach(function (sp) {
        if (!sp || seen[norm(sp)] || noRecord(sp)) return;
        seen[norm(sp)] = 1;
        var s = sellerStatus(sp, y, m);
        if (!(s.best > 0) && !(s.current > 0)) return;
        rows.push({ sp: sp, team: t, s: s });
      });
    });
    // yang sudah pecah rekor dulu (urut omset), lalu yang paling dekat rekornya
    rows.sort(function (a, b) {
      var ar = a.s.record ? 1 : 0, br = b.s.record ? 1 : 0;
      if (ar !== br) return br - ar;
      if (ar) return b.s.current - a.s.current;
      return (b.s.best > 0 ? b.s.ratio : -1) - (a.s.best > 0 ? a.s.ratio : -1) || b.s.current - a.s.current;
    });
    return rows;
  }
  function paintChase() {
    var rows = chaseRows(), n = now();
    var lim = st.showAll ? rows.length : Math.min(rows.length, 8);
    var recN = rows.filter(function (r) { return r.s.record; }).length;
    var h = '<div class="hxy-ptitle">Kejar Rekor · ' + BULAN[n.getMonth()] + '<small>' + (recN ? recN + ' sales sudah pecah rekor bulan ini' : 'omset bulan ini vs rekor bulanan masing-masing') + '</small></div>';
    if (!rows.length) h += '<div class="hxy-empty">Belum ada data.</div>';
    rows.slice(0, lim).forEach(function (r) {
      var s = r.s, w = s.best > 0 ? Math.min(100, s.ratio * 100) : 100;
      var sel = st.lens.kind === 'sp' && norm(st.lens.sp) === norm(r.sp);
      var val, sub;
      if (s.record) { val = '<b class="gold">' + IC.crown + '+' + pctChg(s.ratio - 1) + '%</b>'; sub = 'lama ' + money(s.best); }
      else if (s.first) { val = '<b class="mut">baru</b>'; sub = money(s.current); }
      else if (s.equal) { val = '<b>100%</b>'; sub = 'sama dengan rekor'; }
      else { val = '<b>' + pctFloor(s.ratio) + '%</b>'; sub = 'kurang ' + money(s.best - s.current); }
      h += '<button type="button" class="hxy-crow' + (s.record ? ' is-rec' : '') + (sel ? ' sel' : '') + '" data-act="seller" data-v="' + esc(r.sp) + '">' +
        '<span class="hxy-cn">' + esc(r.sp) + '<small>' + teamMonoHtml(r.team) + esc(r.team) + '</small></span>' +
        '<span class="hxy-cbar"><i style="width:' + w.toFixed(1) + '%"></i></span>' +
        '<span class="hxy-cv">' + val + '<small>' + sub + '</small></span></button>';
    });
    if (rows.length > 8) h += '<button type="button" class="hxy-more" data-act="more">' + (st.showAll ? 'Tampilkan lebih sedikit' : 'Lihat semua (' + rows.length + ')') + '</button>';
    setHtml(el.chase, h);
  }

  // tabel ringkas semua bulan di jendela (terbaru di atas)
  function paintTable(cols) {
    var vis = cols.filter(hasData).slice().reverse();
    var max = 0; vis.forEach(function (c) { max = Math.max(max, c.o.rev); });
    var h = '<div class="hxy-ptitle">Semua bulan<small>' + (st.lens.kind === 'all' ? 'omset perusahaan' : esc(lensTitle())) + '</small></div>';
    if (!vis.length) h += '<div class="hxy-empty">Belum ada data.</div>';
    vis.forEach(function (c) {
      var o = c.o, s = colState(c), w = max > 0 ? o.rev / max * 100 : 0;
      var tag = s === 'record' ? '<em class="hxy-tag-gold">' + IC.crown + 'Rekor</em>' : s === 'down' ? '<em class="hxy-tag-red">Turun</em>' : s === 'up' ? '<em class="hxy-tag-green">Naik</em>' : s === 'cur' ? '<em class="hxy-tag-live">Berjalan</em>' : s === 'partial' ? '<em class="hxy-tag-grey">' + (o.short ? 'Bulan 1' : 'Data awal') + '</em>' : '';
      if (s === 'record' && o.cur) tag += '<em class="hxy-tag-live">Berjalan</em>';
      var dl = o.delta != null ? sgn(o.delta) + pct(Math.abs(o.delta), 1) + '%' + (o.cur ? ' · 1–' + o.prevSameDays : '') : '—';
      h += '<button type="button" class="hxy-trw st-' + s + (c.key === st.sel ? ' sel' : '') + '" data-act="month" data-v="' + c.key + '">' +
        '<span class="hxy-tm">' + BLN[c.m] + ' <small>' + c.y + '</small></span>' +
        '<span class="hxy-tb"><i style="width:' + w.toFixed(1) + '%"></i></span>' +
        '<span class="hxy-tr">' + money(o.rev) + '<small class="' + (o.delta == null ? '' : o.delta >= 0 ? 'pos' : 'neg') + '">' + dl + '</small></span>' +
        '<span class="hxy-tt">' + tag + '</span></button>';
    });
    setHtml(el.table, h);
  }

  function entranceFx() {
    if (reduced()) return;
    el.host.classList.remove('hxy-in');
    void el.host.offsetWidth;
    el.host.classList.add('hxy-in');
    clearTimeout(entranceFx.t);
    entranceFx.t = setTimeout(function () {
      el.host.classList.remove('hxy-in'); el.chart.classList.remove('is-entrance');
      if (pageActive()) drawAth(lastCols, false);   // ukuran akhir setelah animasi halaman selesai
    }, 2600);
  }

  /* render live: hanya kalau halaman aktif; digabung per frame */
  var pend = false;
  function schedule() {
    if (pend) return; pend = true;
    requestAnimationFrame(function () { pend = false; if (pageActive() && st.built && !st.opening) paint(false); });
  }
  HX.on('render', function () { if (pageActive()) schedule(); });
  HX.on('page', function (p) {
    if (p && p.id === 'page-yearly') {
      // rAF: halaman sudah tampil (ukuran grafik terbaca untuk garis rekor).
      // st.opening: paint(false) yang sudah antre dari renderAll dilewati.
      st.opening = true;
      requestAnimationFrame(function () { st.opening = false; paint(true); st.shownOnce = true; });
    }
    if (p && p.id === 'page-monthly') ensureMonthlyBtn();
    if (p && p.id === 'page-salespeople') { decorateCards(true); }
  });
  var rz = null;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { if (pageActive() && st.built) paintChart(lastCols, false); }, 150);
  });

  // dibuka dari tempat lain (modal sales / tombol Monthly Recap)
  HX.year.open = function (opts) {
    opts = opts || {};
    if (opts.sp) setSeller(opts.sp);
    else if (opts.team) { st.lens = { kind: 'team', team: opts.team }; st.prevLens = null; st.sel = null; }
    if (opts.y != null && opts.m != null) {
      st.mode = 'year'; st.year = opts.y; st.sel = mk(opts.y, opts.m);
    }
    // pindah halaman DULU, baru tutup modal: kalau terbalik, efek tutup
    // (fx-morph) mengecil ke kartu di halaman yang sedang ditinggalkan
    var t = tabFor('yearly');
    if (t) t.click();
    try { var mo = byId('spMo'); if (mo && mo.style.display !== 'none' && typeof closeSPMo === 'function') closeSPMo(); } catch (e) { }
  };
  HX.year.state = function () { return { mode: st.mode, year: st.year, lens: st.lens, sel: st.sel }; };

  // tombol di kepala Monthly Recap → halaman tahunan, bulan yang sama terpilih
  function ensureMonthlyBtn() {
    var pg = byId('page-monthly');
    if (!pg || !tabFor('yearly')) return;
    var host = pg.querySelector('.premium-monthly-head > div') || pg.querySelector('#monthlyControlRow');
    if (!host) return;
    var b = byId('hxyMonthBtn');
    if (!b) {
      b = D.createElement('button');
      b.type = 'button'; b.id = 'hxyMonthBtn'; b.className = 'hxy-mbtn';
      b.innerHTML = '<span class="ic">' + IC.year + '</span><span class="tx">Rekap 1 Tahun</span><span class="ch">' + IC.r + '</span>';
      b.addEventListener('click', function () {
        var y, m; try { y = mYear; m = mMonth; } catch (e) { var n = now(); y = n.getFullYear(); m = n.getMonth(); }
        st.lens = { kind: 'all' }; st.prevLens = null;
        HX.year.open({ y: y, m: m });
      });
    }
    if (b.parentNode !== host) host.appendChild(b);
  }

  /* ══ 2. STRIP REKOR DI KARTU SALESPEOPLE ═══════════════════════════════ */
  function athStrip(sp, y, m) {
    var s = sellerStatus(sp, y, m);
    if (!(s.best > 0) && !(s.current > 0)) return '';
    if (s.first) {
      return '<div class="hxy-ath is-first"><div class="hxy-ath-top"><span class="hxy-ath-l">' + IC.crown + 'REKOR</span><span class="hxy-ath-v">bulan pertama</span></div>' +
        '<div class="hxy-ath-sub">patokan rekor dimulai dari bulan ini</div></div>';
    }
    if (s.record) {
      return '<div class="hxy-ath is-rec"><div class="hxy-ath-top"><span class="hxy-ath-l">' + IC.crown + 'REKOR BARU</span><span class="hxy-ath-v">+' + pctChg(s.ratio - 1) + '%</span></div>' +
        '<div class="hxy-ath-bar"><i style="width:100%"></i></div>' +
        '<div class="hxy-ath-sub">lewat rekor ' + ymLabel(s.bestAt) + ' ' + money(s.best) + '</div></div>';
    }
    var w = Math.min(100, s.ratio * 100);
    return '<div class="hxy-ath"><div class="hxy-ath-top"><span class="hxy-ath-l">' + IC.crown + 'REKOR</span><span class="hxy-ath-v">' + money(s.best) + ' · ' + ymLabel(s.bestAt) + '</span></div>' +
      '<div class="hxy-ath-bar"><i style="width:' + w.toFixed(1) + '%"></i></div>' +
      '<div class="hxy-ath-sub">' + (s.equal ? '<b>100%</b> · sama dengan rekor' : '<b>' + pctFloor(s.ratio) + '%</b> · kurang ' + money(s.best - s.current)) + '</div></div>';
  }
  function spFromKey(k) { var i = String(k || '').lastIndexOf('|'); return i > 0 ? k.slice(0, i) : k; }
  function decorateCards(anim) {
    var grid = byId('spGrid');
    if (!grid) return;
    var vm = viewMonth();
    var cards = grid.querySelectorAll('.spc[data-k]');
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], sp = spFromKey(c.getAttribute('data-k'));
      if (!sp || noRecord(sp)) continue;
      var old = null;
      for (var j = 0; j < c.children.length; j++) if (c.children[j].classList && c.children[j].classList.contains('hxy-ath')) old = c.children[j];
      var html = athStrip(sp, vm.y, vm.m);
      c.classList.toggle('hxy-rec-card', html.indexOf('hxy-ath is-rec') >= 0);
      if (old) { if (old.getAttribute('data-h') === html) continue; old.parentNode.removeChild(old); }
      if (!html) continue;
      var wrap = D.createElement('div');
      wrap.innerHTML = html;
      var node = wrap.firstChild;
      node.setAttribute('data-h', html);
      c.appendChild(node);
    }
    if (anim && !reduced()) {
      grid.classList.remove('hxy-cards-in'); void grid.offsetWidth; grid.classList.add('hxy-cards-in');
      clearTimeout(decorateCards.t);
      decorateCards.t = setTimeout(function () { grid.classList.remove('hxy-cards-in'); }, 1800);
    }
  }
  // sinkron setelah renderAll (sebelum layar digambar) → tidak berkedip.
  // Hanya saat Salespeople tampil: renderSPGrid menulis ulang semua kartu tiap
  // render, jadi kerja di halaman lain terbuang (dibangun lagi saat dibuka).
  HX.on('render', function () {
    if (!pageOn('page-salespeople')) return;
    try { decorateCards(false); } catch (e) { console.warn('[HX] year cards', e); }
  });

  /* ══ 3. MODAL DETAIL SALES ══════════════════════════════════════════════ */
  var yearAct = {
    id: 'year', order: 30, icon: IC.year, label: 'Rekap 1 Tahun',
    show: function (sp) { return !noRecord(sp) && series({ kind: 'sp', sp: sp }).ath > 0; },
    run: function (sp) { var m = modalMonth(); HX.year.open({ sp: sp, y: m.y, m: m.m }); }
  };
  HX.spAction(yearAct);
  HX.on('spmodal', function (ev) {
    try { modalBlock(ev.sp, ev.box); } catch (e) { console.warn('[HX] year modal', e); }
  });
  // _spMoRepaint (di dalam renderAll) menggambar modal SEBELUM cache bulanan
  // dibersihkan → setelah 'render' gambar ulang dengan data baru
  HX.on('render', function () {
    var mo = byId('spMo');
    if (!HX.spCurrent || !mo || mo.style.display !== 'flex') return;
    // daftar tombol juga dibangun ulang dengan data baru (penjualan pertama → tombol muncul)
    try { HX.spAction(yearAct); } catch (e) { }
    try { modalBlock(HX.spCurrent.sp, mo.querySelector('.mbox')); } catch (e) { }
  });
  function modalBlock(sp, box) {
    if (!box) return;
    var old = box.querySelector('.hxy-mrec');
    var vm = modalMonth(), s = noRecord(sp) ? null : sellerStatus(sp, vm.y, vm.m);
    if (!s || (!(s.best > 0) && !(s.current > 0))) { if (old) old.parentNode.removeChild(old); return; }
    var S = s.series, months = [];
    for (var i = 11; i >= 0; i--) months.push(mnorm(vm.y, vm.m - i));
    // tampilkan hanya dari bulan data pertama sales ini (maks 12, min 6)
    var firstIdx = months.length - 1;
    for (var a = 0; a < months.length; a++) { var oo = S.get(mk(months[a].y, months[a].m)); if (oo && oo.rev > 0) { firstIdx = a; break; } }
    months = months.slice(Math.max(0, Math.min(firstIdx, months.length - 6)));
    var max = 0;
    months.forEach(function (c) { var o = S.get(mk(c.y, c.m)); if (o) max = Math.max(max, o.rev); });
    var bars = months.map(function (c) {
      var o = S.get(mk(c.y, c.m)), h = o && max > 0 ? Math.max(o.rev > 0 ? 3 : 0, o.rev / max * 100) : 0;
      var cl = !o || o.pre ? 'e' : o.record ? 'rec' : o.cur ? 'cur' : o.down ? 'dn' : (o.partial || o.short) ? 'pa' : o.up ? 'up' : 'base';
      if (o && o.key === S.athAt) cl += ' ath';
      return '<span class="hxy-mb ' + cl + '" title="' + BULAN[c.m] + ' ' + c.y + ': ' + (o && !o.pre ? full(o.rev) : '—') + '"><b><i style="height:' + h.toFixed(1) + '%"></i></b><em>' + BLN[c.m] + '</em></span>';
    }).join('');
    var head, sub;
    if (s.first) { head = 'Bulan pertama'; sub = 'rekor mulai dihitung dari ' + BULAN[vm.m]; }
    else if (s.record) { head = '+' + pctChg(s.ratio - 1) + '% di atas rekor'; sub = 'rekor lama ' + money(s.best) + ' · ' + ymLabel(s.bestAt, true) + ' — ' + BULAN[vm.m] + ' jadi rekor baru'; }
    else { head = money(s.best) + ' · ' + ymLabel(s.bestAt, true); sub = BULAN[vm.m] + ' ' + money(s.current) + ' · ' + (s.equal ? 'sama dengan rekor' : pctFloor(s.ratio) + '% · kurang ' + money(s.best - s.current) + ' lagi'); }
    var html = '<div class="hxy-mr-top"><span class="hxy-mr-l"><i class="hxy-ic">' + IC.crown + '</i>' + (s.record ? 'REKOR BARU' : 'REKOR BULANAN') + '</span>' +
      (S.ath > 0 && (s.record || Math.round(S.ath) !== Math.round(s.best)) ? '<span class="hxy-mr-ath">sepanjang masa ' + money(S.ath) + '</span>' : '') + '</div>' +
      '<div class="hxy-mr-v">' + head + '</div><div class="hxy-mr-s">' + sub + '</div>' +
      (s.first ? '' : '<div class="hxy-ath-bar lg"><i style="width:' + Math.min(100, s.ratio * 100).toFixed(1) + '%"></i></div>') +
      '<div class="hxy-mbars">' + bars + '</div>';
    var key = norm(sp) + '|' + mk(vm.y, vm.m);
    // sama persis → biarkan (data live masuk tiap ada penjualan siapa pun)
    if (old && old.getAttribute('data-k') === key && old.__h === html) return;
    var div = D.createElement('div');
    // orang/bulan yang sama dengan isi baru → tanpa animasi tumbuh ulang
    div.className = 'hxy-mrec' + (s.record ? ' is-rec' : '') + (old && old.getAttribute('data-k') === key ? ' is-live' : '');
    div.setAttribute('data-k', key);
    div.__h = html;
    div.innerHTML = html;
    if (old) old.parentNode.removeChild(old);
    var acts = null;
    for (var k = 0; k < box.children.length; k++) if (box.children[k].className === 'hx-sp-actions') acts = box.children[k];
    var after = acts || byId('mKPIs');
    if (after && after.parentNode === box) box.insertBefore(div, after.nextSibling); else box.appendChild(div);
  }

  /* awal: kalau halaman yang relevan sudah aktif saat modul dimuat */
  function boot() {
    if (pageOn('page-salespeople')) { try { decorateCards(false); } catch (e) { } }
    ensureMonthlyBtn();
    if (pageActive() && !st.built) paint(true);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();
  HX.on('ready', boot);
})();
