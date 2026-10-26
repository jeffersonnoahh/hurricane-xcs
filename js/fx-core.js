/* ══════════════════════════════════════════════════════════════════════
   FX CORE — pusat kecil untuk modul efek (js/fx-*.js).
   HANYA MEMBACA. Tidak pernah menulis ke Firebase. Fungsi app.js hanya
   dibungkus (keepMarkers), tidak diubah.

   Yang disediakan untuk modul lain (window.HX):
     HX.on(ev, fn) / HX.off(ev, fn) / HX.emit(ev, data)
     Event:
       'render'  {}                    setiap renderAll() selesai (sinkron,
                                       sebelum layar digambar)
       'ready'   {}                    sekali: data pertama + config tim masuk
       'sale'    {sp,team,prod,units,revenue,ts,own,channel,sim}
                                       satu penjualan BARU hari ini (bukan yang
                                       sudah ada saat aplikasi dibuka)
       'sales'   [sale, ...]           semua penjualan baru dari satu snapshot
                                       (mis. HP bangun dari layar kunci: bisa
                                       puluhan sekaligus — gabungkan!)
       'goal'    {pct, from, revenue, target, by}
                                       omzet HARI INI melewati 25/50/75/100%
                                       target (by = penjualan yang melewatinya)
       'page'    {id, from}            pindah halaman (showPage)
       'surge'   {x, y, power}         minta efek besar di wallpaper
       'ripple'  {x, y, power}         minta riak kecil di wallpaper
     HX.reduced()        Kurangi Gerak aktif
     HX.lessGlass()      Kurangi Transparansi aktif
     HX.tier             'high' | 'mid' | 'low' (perkiraan kekuatan HP)
     HX.busy()           form / modal / sheet terbuka atau sedang mengetik
     HX.isChannel(sp)    Tokopedia, Shopee, Shopee live, Live tiktok, TIKTOK
     HX.isLeader(sp)     team lead yang tidak berjualan (_LEADERS di app.js)
     HX.todayKey()       'YYYY-MM-DD' hari ini (sama dengan app.js dk())
     HX.todayRevenue()   omzet hari ini (semua penjualan, termasuk channel)
     HX.target()         target harian (TR, sudah dari config bila termuat)
     HX.money(n)         format singkat sama dengan app.js (fRp)
     HX.moneyFull(n)     'Rp 5.775.000' (fFull)
     HX._simulateSale(o) UNTUK TES SAJA: memicu 'sale' palsu (sim:true),
                         tidak menyentuh allData / Firebase.
     HX.spAction({id, label, icon, order, show(sp,team), run(sp,team)})
                         tombol di baris aksi modal detail sales (#spMo),
                         di bawah kotak KPI. Satu baris bersama untuk semua
                         modul (urut 'order'); dibangun ulang tiap modal
                         digambar. Event 'spmodal' {sp, team, modal, box}
                         menyusul setiap kali modal selesai digambar.
     HX.spCurrent        {sp, team} modal yang terakhir dibuka
     HX.monthAgg(y,m[,d]) satu hitungan bulanan bersama (lihat di bawah)
     HX.dayKey(date)      'YYYY-MM-DD' untuk tanggal mana pun (= app.js dk)
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.HX && window.HX.__core) return;
  var HX = window.HX = window.HX || {};
  HX.__core = true;

  // Bungkus fungsi app.js SEKALI saja (bendera di sini, bukan penanda di
  // fungsi): sp-notes.js membungkus ulang renderAll di 900 ms tanpa menyalin
  // penanda, jadi __hx hilang dari fungsi terluar — tanpa bendera ini kita
  // membungkus dua kali dan setiap event terkirim ganda.
  var did = {};

  /* ── bus ─────────────────────────────────────────────────────────── */
  var subs = {};
  HX.on = function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return fn; };
  HX.off = function (ev, fn) { var a = subs[ev]; if (a) { var i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } };
  HX.emit = function (ev, data) {
    (subs[ev] || []).slice().forEach(function (fn) {
      try { fn(data); } catch (e) { console.warn('[HX] ' + ev, e); }
    });
  };

  /* ── preferensi & perkiraan perangkat ────────────────────────────── */
  function mq(q) { return window.matchMedia ? matchMedia(q) : { matches: false }; }
  var mqMotion = mq('(prefers-reduced-motion: reduce)');
  var mqTrans = mq('(prefers-reduced-transparency: reduce)');
  HX.reduced = function () { return !!mqMotion.matches; };
  HX.lessGlass = function () { return !!mqTrans.matches; };
  [mqMotion, mqTrans].forEach(function (m) {
    var f = function () { HX.emit('prefs', {}); };
    if (m.addEventListener) m.addEventListener('change', f); else if (m.addListener) m.addListener(f);
  });
  HX.tier = (function () {
    var mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
    var save = navigator.connection && navigator.connection.saveData;
    if (save || mem <= 2 || cores <= 4) return 'low';
    if (mem <= 4 || cores <= 6) return 'mid';
    return 'high';
  })();

  HX.busy = function () {
    var b = document.body;
    if (!b) return false;
    if (b.classList.contains('premium-form-open') || b.classList.contains('premium-more-open')) return true;
    // layar penuh milik modul efek (replay, wrapped, kartu, peta bintang)
    if (document.documentElement.classList.contains('hx-overlay-open')) return true;
    // jari sedang memainkan gestur (geser grafik, tahan-pecah omset, tarik sheet)
    if (document.documentElement.classList.contains('hx-gesture')) return true;
    var mos = document.querySelectorAll('.mo, .cal-overlay');
    for (var i = 0; i < mos.length; i++) if (mos[i].style.display && mos[i].style.display !== 'none') return true;
    var a = document.activeElement;
    return !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
  };

  /* ── siapa yang bukan "sales" ────────────────────────────────────── */
  var CHANNELS = ['tokopedia', 'shopee', 'shopee live', 'live tiktok', 'tiktok'];
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  HX.isChannel = function (sp) { return CHANNELS.indexOf(norm(sp)) >= 0; };
  HX.isLeader = function (sp) {
    try { if (typeof _isLeader === 'function') return _isLeader(sp); } catch (e) { }
    return false;
  };

  /* ── data (dibaca dari variabel global app.js) ───────────────────── */
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  HX.todayKey = function () {
    try { if (typeof dk === 'function') return dk(new Date()); } catch (e) { }
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  function todayEntries() { return (data()[HX.todayKey()] || []).filter(Boolean); }
  HX.todayRevenue = function () {
    return todayEntries().reduce(function (s, e) { return s + (+e.revenue || 0); }, 0);
  };
  HX.target = function () { try { return TR; } catch (e) { return 0; } };
  HX.money = function (n) { try { if (typeof fRp === 'function') return fRp(Math.round(n)); } catch (e) { } return String(Math.round(n)); };
  HX.moneyFull = function (n) { try { if (typeof fFull === 'function') return fFull(Math.round(n)); } catch (e) { } return 'Rp ' + Math.round(n).toLocaleString('id-ID'); };
  function isReady() {
    try { return Object.keys(data()).length > 0 && !!window._cfgTeamsLoaded; } catch (e) { return false; }
  }

  /* ── SATU hitungan bulanan untuk semua modul (pecah omset, wrapped, kartu,
        peta bintang) — supaya peringkat, jumlah sales dan total tim SAMA di
        mana pun dilihat.
     HX.monthAgg(y, m[, sampaiTanggal]) -> {
       total, closes,                      // semua record bulan itu (= monthRev)
       sellers: [s...],                    // sales asli, urut omzet, s.rank 1..n
       nSellers,                           // penyebut peringkat yang sama untuk semua
       leaders: [s...], channels: [c...],  // tidak diperingkat
       teams: [{team, revenue, revenueSellers, revenueChannels, closes, members}],
       get(nama) -> s | null }
     s = {sp, team, revenue, closes, rank, activeDays, days:{tanggal:omzet},
          best:{date, revenue}, biggest:{revenue, prod, date, ts}, topProd, prods}
     Aturan: sales digabung per NAMA (tanpa beda huruf besar/kecil, lintas
     tim); timnya = tim roster SEKARANG bila namanya ada di roster, selain itu
     tim record terakhir (orang yang sudah keluar tetap dihitung di tim
     lamanya). Channel (Tokopedia, Shopee, …) masuk total tim sesuai record,
     tidak diperingkat. Team lead (_LEADERS) masuk total tim, tidak diperingkat. */
  var aggCache = {};
  HX.on('render', function () { aggCache = {}; });
  function rosterTeamOf(name) {
    var n = norm(name);
    try {
      for (var t in TM) {
        var mm = (TM[t] && TM[t].m) || [];
        for (var i = 0; i < mm.length; i++) if (norm(mm[i]) === n) return t;
      }
    } catch (e) { }
    return null;
  }
  HX.monthAgg = function (y, m, upto) {
    var nDays = new Date(y, m + 1, 0).getDate();
    upto = Math.max(1, Math.min(nDays, upto || nDays));
    var ck = y + '-' + m + '-' + upto;
    if (aggCache[ck]) return aggCache[ck];
    var D = data(), sel = {}, chan = {}, total = 0, closes = 0;
    for (var d = 1; d <= upto; d++) {
      var key = HX.dayKey(new Date(y, m, d));
      (D[key] || []).forEach(function (e) {
        if (!e) return;
        var rev = +e.revenue || 0, u = +e.units || 1, nm = String(e.sp == null ? '' : e.sp).trim(), k = norm(nm);
        total += rev; closes += u;
        if (HX.isChannel(nm)) {
          var c = chan[k] || (chan[k] = { sp: nm, team: e.team, revenue: 0, closes: 0 });
          c.revenue += rev; c.closes += u;
          return;
        }
        var s = sel[k] || (sel[k] = { key: k, sp: nm, revenue: 0, closes: 0, days: {}, prods: {}, biggest: { revenue: 0 }, lastTs: -1, lastTeam: e.team });
        s.revenue += rev; s.closes += u;
        s.days[key] = (s.days[key] || 0) + rev;
        if ((e.ts || 0) >= s.lastTs) { s.lastTs = e.ts || 0; s.lastTeam = e.team; s.sp = nm; }
        if (rev > s.biggest.revenue) s.biggest = { revenue: rev, prod: e.prod, date: key, ts: e.ts || 0 };
        var p = s.prods[e.prod] || (s.prods[e.prod] = { units: 0, revenue: 0 });
        p.units += u; p.revenue += rev;
      });
    }
    var all = Object.keys(sel).map(function (k) {
      var s = sel[k];
      s.team = rosterTeamOf(s.sp) || s.lastTeam;
      s.leader = HX.isLeader(s.sp);
      s.activeDays = 0; s.best = { date: null, revenue: 0 };
      Object.keys(s.days).forEach(function (dd) {
        s.activeDays++;
        if (s.days[dd] > s.best.revenue) s.best = { date: dd, revenue: s.days[dd] };
      });
      var tp = null;
      Object.keys(s.prods).forEach(function (pn) { if (!tp || s.prods[pn].revenue > s.prods[tp].revenue) tp = pn; });
      s.topProd = tp;
      return s;
    });
    var sellers = all.filter(function (s) { return !s.leader; })
      .sort(function (a, b) { return b.revenue - a.revenue || b.closes - a.closes || (a.sp < b.sp ? -1 : 1); });
    sellers.forEach(function (s, i) { s.rank = i + 1; });
    var leaders = all.filter(function (s) { return s.leader; });
    leaders.forEach(function (s) { s.rank = null; });
    var channels = Object.keys(chan).map(function (k) { return chan[k]; }).sort(function (a, b) { return b.revenue - a.revenue; });
    var T = {};
    function team(t) { return T[t] || (T[t] = { team: t, revenue: 0, revenueSellers: 0, revenueChannels: 0, closes: 0, members: [] }); }
    all.forEach(function (s) { var x = team(s.team); x.revenue += s.revenue; x.revenueSellers += s.revenue; x.closes += s.closes; x.members.push(s); });
    channels.forEach(function (c) { var x = team(c.team); x.revenue += c.revenue; x.revenueChannels += c.revenue; x.closes += c.closes; });
    var teams = Object.keys(T).map(function (t) { return T[t]; }).sort(function (a, b) { return b.revenue - a.revenue; });
    teams.forEach(function (x) { x.members.sort(function (a, b) { return b.revenue - a.revenue; }); });
    var byName = {};
    all.forEach(function (s) { byName[s.key] = s; });
    var out = {
      y: y, m: m, upto: upto, total: total, closes: closes,
      sellers: sellers, nSellers: sellers.length, leaders: leaders, channels: channels, teams: teams,
      get: function (name) { return byName[norm(name)] || null; }
    };
    aggCache[ck] = out;
    return out;
  };
  HX.dayKey = function (d) {
    try { if (typeof dk === 'function') return dk(d); } catch (e) { }
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  /* ── penjualan sendiri (HP ini) — tidak perlu diumumkan ke diri sendiri ─ */
  var ownTs = {};
  function wrapAppend() {
    if (did.append || typeof window._txnAppend !== 'function' || window._txnAppend.__hx) return;
    did.append = true;
    var orig = window._txnAppend;
    window._txnAppend = keepMarkers(orig, function (node, dateKey, entry) {
      if (node === 'scores' && entry && entry.ts) ownTs[entry.ts] = 1;
      return orig.apply(this, arguments);
    });
    window._txnAppend.__hx = true;
  }

  /* ── deteksi penjualan baru & lewat target ───────────────────────── */
  var seenKey = null, seen = null, readyFired = false;
  var MILES = [25, 50, 75, 100], lastPct = null, lastPctKey = null;
  function scan() {
    if (!isReady()) return;
    if (!readyFired) { readyFired = true; HX.emit('ready', {}); }
    var key = HX.todayKey(), list = todayEntries();
    if (seenKey !== key || !seen) {
      // pertama kali / ganti hari: catat diam-diam, jangan umumkan yang lama
      seenKey = key; seen = {};
      list.forEach(function (e) { if (e.ts) seen[e.ts] = 1; });
    } else {
      var fresh = [];
      list.forEach(function (e) {
        if (!e.ts || seen[e.ts]) return;
        seen[e.ts] = 1;
        fresh.push({
          sp: e.sp, team: e.team, prod: e.prod, units: +e.units || 1, revenue: +e.revenue || 0,
          ts: e.ts, own: !!ownTs[e.ts], channel: HX.isChannel(e.sp), sim: false
        });
      });
      if (fresh.length) {
        fresh.sort(function (a, b) { return a.ts - b.ts; });
        fresh.forEach(function (s) { HX.emit('sale', s); });
        HX.emit('sales', fresh);
      }
    }
    // lewat 25/50/75/100% target HARI INI
    var T = HX.target();
    if (!(T > 0)) return;
    var rev = HX.todayRevenue(), pct = rev / T * 100;
    if (lastPctKey !== key || lastPct === null) { lastPctKey = key; lastPct = pct; return; }
    if (pct > lastPct) {
      for (var i = 0; i < MILES.length; i++) {
        var m = MILES[i];
        if (lastPct < m && pct >= m) {
          // penjualan terakhir yang mendorong lewat garis
          var by = list.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); })[0] || null;
          HX.emit('goal', { pct: m, from: lastPct, revenue: rev, target: T, by: by ? { sp: by.sp, team: by.team, revenue: +by.revenue || 0, prod: by.prod } : null });
        }
      }
    }
    lastPct = pct;
  }

  HX._simulateSale = function (o) {
    o = o || {};
    var s = {
      sp: o.sp || 'Hendri', team: o.team || 'Ivan', prod: o.prod || 'TWIN TURBO',
      units: o.units || 1, revenue: o.revenue != null ? o.revenue : 5775000,
      ts: o.ts || Date.now(), own: !!o.own, channel: HX.isChannel(o.sp || 'Hendri'), sim: true
    };
    HX.emit('sale', s); HX.emit('sales', [s]);
    return s;
  };

  /* ── modal detail sales: baris aksi bersama + event 'spmodal' ────── */
  var spActs = [];
  HX.spCurrent = null;
  HX.spAction = function (def) {
    if (!def || !def.id || typeof def.run !== 'function') return;
    spActs = spActs.filter(function (a) { return a.id !== def.id; });
    spActs.push(def);
    spActs.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    if (HX.spCurrent) {
      var mo = document.getElementById('spMo');
      if (mo && mo.style.display && mo.style.display !== 'none') decorateSp(HX.spCurrent.sp, HX.spCurrent.team, true);
    }
  };
  function escTxt(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function decorateSp(sp, team, quiet) {
    var mo = document.getElementById('spMo');
    var box = mo && mo.querySelector('.mbox');
    if (!box) return;
    HX.spCurrent = { sp: sp, team: team };
    var row = null;
    for (var i = 0; i < box.children.length; i++) if (box.children[i].className === 'hx-sp-actions') row = box.children[i];
    if (!row) {
      row = document.createElement('div');
      row.className = 'hx-sp-actions';
      var k = document.getElementById('mKPIs');
      if (k && k.parentNode === box) box.insertBefore(row, k.nextSibling); else box.appendChild(row);
    }
    row.innerHTML = '';
    spActs.forEach(function (a) {
      try { if (a.show && !a.show(sp, team)) return; } catch (e) { return; }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'hx-sp-act';
      b.setAttribute('data-act', a.id);
      b.innerHTML = (a.icon || '') + '<span>' + escTxt(a.label) + '</span>';
      b.addEventListener('click', function (ev) { ev.stopPropagation(); try { a.run(sp, team); } catch (e) { console.warn('[HX] spAction ' + a.id, e); } });
      row.appendChild(b);
    });
    row.style.display = row.children.length ? '' : 'none';
    if (!quiet) HX.emit('spmodal', { sp: sp, team: team, modal: mo, box: box });
  }
  function wrapSpModal() {
    if (did.spm || typeof window._spModalPaint !== 'function') return;
    did.spm = true;
    var orig = window._spModalPaint;
    window._spModalPaint = keepMarkers(orig, function (sp, team) {
      var r = orig.apply(this, arguments);
      try { decorateSp(sp, team); } catch (e) { console.warn('[HX] spmodal', e); }
      return r;
    });
  }

  /* ── bungkus fungsi app.js tanpa menghapus penanda skrip lain ────── */
  function keepMarkers(from, to) {
    for (var k in from) if (Object.prototype.hasOwnProperty.call(from, k)) to[k] = from[k];
    return to;
  }
  function wrapRender() {
    if (did.render || typeof window.renderAll !== 'function' || window.renderAll.__hx) return;
    did.render = true;
    var orig = window.renderAll;
    window.renderAll = keepMarkers(orig, function () {
      var r = orig.apply(this, arguments);
      HX.emit('render', {});
      scan();
      return r;
    });
    window.renderAll.__hx = true;
  }
  function wrapShow() {
    if (did.show || typeof window.showPage !== 'function' || window.showPage.__hx) return;
    did.show = true;
    var orig = window.showPage;
    window.showPage = keepMarkers(orig, function (p) {
      var a = document.querySelector('.page.active');
      var r = orig.apply(this, arguments);
      HX.emit('page', { id: 'page-' + p, from: a ? a.id : null });
      return r;
    });
    window.showPage.__hx = true;
  }
  function hook() { wrapRender(); wrapShow(); wrapAppend(); wrapSpModal(); scan(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
  window.addEventListener('load', hook);
  setTimeout(hook, 1000);   // setelah watchlist.js / motion.js membungkus fungsi yang sama
  // config tim termuat setelah data (gerbang _cfgTeamsLoaded): coba lagi sampai siap
  var tries = 0, iv = setInterval(function () { scan(); if (readyFired || ++tries > 60) clearInterval(iv); }, 500);
})();
