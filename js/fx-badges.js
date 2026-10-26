/* ══════════════════════════════════════════════════════════════════════
   FX BADGES — lencana pencapaian otomatis dari data penjualan.
   HANYA MEMBACA. Tidak pernah menulis ke Firebase, tidak mengubah allData.
   Satu-satunya yang ditulis: localStorage 'hx-bdg-seen' (lencana yang sudah
   pernah tampil di HP ini hari ini — supaya kilau "baru" hanya sekali).

   Lencana (hanya untuk SALES: channel & team lead dilewati; dihitung per
   NAMA sales — "gabriel" = "Gabriel" — tim hanya untuk tampilan):
     pertama        Closing pertama     closing paling awal hari ini
     hattrick       Hattrick            3 closing dalam 60 menit hari ini
     terbesar       Terbesar minggu ini satu closing terbesar Senin–Minggu ini
     beruntun       Beruntun N hari     N ≥ 3 hari kerja berturut-turut ada
                                        closing (sampai hari ini, atau sampai
                                        kemarin kalau hari ini belum)
     juara-kemarin  Juara kemarin       #1 omzet kemarin di antara sales
     juara-hari     Juara hari ini      #1 omzet hari ini di antara sales (live)
                    → "Juara sales kemarin / hari ini" bila channel atau team
                      lead di atasnya (Top Performers menempatkan channel di
                      01 pada ±1 dari 4 hari): lencana tidak boleh membantah
                      angka peringkat
     rekor          Rekor pribadi       omzet hari ini melewati hari terbaik
                                        sebelumnya (≥ 10 hari aktif sebelumnya)
                                        — definisi bersama HX.records (fx-live)
                                        bila ada; warna emas seperti modul lain

   "Closing" = satu pesanan. Satu pesanan sering dicatat beberapa baris
   beberapa detik berselang (TWIN TURBO + 2× SPRING BUFFER pukul 12:09:21,
   :30, :36). Baris sales yang sama berjarak ≤ 120 dtk (dan ≤ 150 dtk dari
   baris pertamanya) digabung jadi satu closing. Data Apr–Okt 2026: 752 jeda
   < 2 mnt vs 22 jeda 2–5 mnt; batas 150 dtk mencegah catatan susulan
   (13 baris dalam 218 dtk) terbaca sebagai satu pesanan raksasa.

   Hari Minggu tanpa closing dan hari tanpa penjualan sama sekali (libur)
   tidak memutus "Beruntun" — tapi juga tidak dihitung.

   Tampil (hanya saat melihat HARI INI — lencana adalah status live):
     kartu Salespeople (.spc)  maks. 2 chip di kanan avatar + "+N"; lebar
                               chip dihitung tanpa layout (canvas), ruang
                               diukur sekali per lebar layar
     Top Performers (.lbi)     satu chip ikon setelah nama (lencana paling
                               berharga selain "Juara hari ini" — angka
                               peringkat 01 sudah mengatakannya; "Juara sales
                               hari ini" di baris 02+ tetap tampil)
     modal detail (#spMo)      bagian "Pencapaian": label + keterangan

   API untuk modul lain:
     HX.badges(sp, team) → [{id, label, short, detail, earnedAt, tone, value}]
                           urut paling berharga dulu (cache per data);
                           tone 'gold' = juara-hari & rekor, 'green', 'silver'
     HX.badges.icon(id)  → SVG monokrom (currentColor) untuk id lencana
     HX.badges.all()     → {nama: [lencana…]} semua pemegang hari ini
     HX.badges.record(sp)→ {today, best, bestDay, activeDays} rekor pribadi
     HX.badges._sim(arr) → TES SAJA: tambah penjualan palsu hari ini ke
                           perhitungan modul ini (allData tidak disentuh);
                           _sim(null) menghapus.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var HX = window.HX;
  if (!HX || HX.__badges) return;
  HX.__badges = true;

  var GAP = 120000, SPAN = 150000, HOUR = 3600000;
  var STREAK_MIN = 3, REC_MIN_DAYS = 10, STREAK_MAX_DAYS = 400;
  var PLAY_MS = 1400;

  /* ── glif monokrom (16×16, currentColor) ─────────────────────────── */
  var S = '<svg class="hx-bdg-g" viewBox="0 0 16 16" aria-hidden="true" focusable="false">';
  var ST = ' fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  var ICON = {
    // bendera: yang pertama menancapkan
    pertama: S + '<path d="M3.6 14.6V1.9"' + ST + ' stroke-width="1.7"/><path d="M3.6 2.3h8.9l-2.1 3.1 2.1 3.1H3.6z" fill="currentColor"/></svg>',
    // tiga chevron naik: tiga beruntun
    hattrick: S + '<path d="M3 6.1 8 2.4l5 3.7M3 9.9 8 6.2l5 3.7M3 13.7 8 10l5 3.7"' + ST + ' stroke-width="1.6"/></svg>',
    // permata
    terbesar: S + '<path d="M4.6 2.4h6.8l3.1 3.9L8 13.9 1.5 6.3z" fill="currentColor" fill-opacity=".22"' + ST + ' stroke-width="1.45"/><path d="M1.9 6.3h12.2M6.5 2.6 5.5 6.3 8 13.4l2.5-7.1-1-3.7"' + ST + ' stroke-width="1.05" opacity=".8"/></svg>',
    // nyala api
    beruntun: S + '<path d="M8.3 1.2c.5 2.6 4.4 4.3 4.4 8.6A4.7 4.7 0 0 1 8 14.6a4.6 4.6 0 0 1-4.7-4.7c0-2.1 1.1-3.6 2.3-4.5-.1 1.7.6 2.9 1.7 3.4-.5-2.3 0-4.8 1-7.6z" fill="currentColor"/><path d="M8 14.4c-1.5 0-2.4-1-2.4-2.3 0-1.1.6-1.9 1.3-2.4.1.9.6 1.4 1.2 1.6.1-.9.4-1.6.9-2.3.6 1 1.4 1.8 1.4 3.1 0 1.3-1 2.3-2.4 2.3z" fill="#000" fill-opacity=".38"/></svg>',
    // mahkota
    juara: S + '<path d="M1.9 5.1 5.2 8 8 2.9 10.8 8l3.3-2.9-1.1 7H3z" fill="currentColor"/><path d="M3.2 14.2h9.6"' + ST + ' stroke-width="1.5"/></svg>',
    // piala: hari terbaik sepanjang masa
    rekor: S + '<path d="M4.6 2.1h6.8v3.1a3.4 3.4 0 0 1-6.8 0z" fill="currentColor"/><path d="M4.6 3.4H2.7v.8c0 1.3 1 2.3 2.3 2.4M11.4 3.4h1.9v.8c0 1.3-1 2.3-2.3 2.4M8 8.7v2.7M5.2 13.9h5.6"' + ST + ' stroke-width="1.5"/></svg>'
  };
  function iconOf(id) { return ICON[id === 'juara-hari' || id === 'juara-kemarin' ? 'juara' : id] || ''; }

  /* ── utilitas ────────────────────────────────────────────────────── */
  var OWN = Object.prototype.hasOwnProperty;
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function isSeller(sp) { return !!norm(sp) && !HX.isChannel(sp) && !HX.isLeader(sp); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function dateOf(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2], 12); }
  function shift(k, n) { var d = dateOf(k); d.setDate(d.getDate() + n); return keyOf(d); }
  function midnight(k) { var d = dateOf(k); d.setHours(0, 0, 0, 0); return d.getTime(); }
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var HRI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  function dShort(k) { var d = dateOf(k); return d.getDate() + ' ' + BLN[d.getMonth()]; }
  function hm(ts) { var d = new Date(ts); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // spasi tak-putus: "Rp" dan angkanya / "#2 keseluruhan" tidak terpisah baris
  function rp(n) { return 'Rp\u00a0' + HX.money(n); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function now() { return Date.now(); }
  function live() { try { return vOff === 0; } catch (e) { return true; } }
  function getData() { try { return allData || {}; } catch (e) { return {}; } }
  function ok(e) { return !!e && typeof e === 'object'; }
  function dayRows(day) { var a = getData()[day]; return Array.isArray(a) ? a.filter(ok) : []; }

  // baris penjualan satu sales → closing (pesanan), urut waktu
  function closings(rows) {
    var a = rows.filter(function (e) { return +e.ts > 0; }).sort(function (x, y) { return x.ts - y.ts; });
    var out = [], g = null;
    a.forEach(function (e) {
      var ts = +e.ts, r = +e.revenue || 0;
      if (g && ts - g.last <= GAP && ts - g.ts <= SPAN) { g.rev += r; g.items++; g.last = ts; }
      else { g = { ts: ts, last: ts, rev: r, items: 1 }; out.push(g); }
    });
    return out;
  }

  // channel / team lead yang omzetnya ≥ r di baris-baris satu hari (urut
  // omzet) — kalau ada, juara sales bukan #1 di Top Performers
  function nonSellersAbove(rows, r) {
    var t = {}, nm = {};
    rows.forEach(function (e) {
      var k = norm(e.sp);
      if (!k || isSeller(e.sp)) return;
      t[k] = (t[k] || 0) + (+e.revenue || 0);
      if (!nm[k]) nm[k] = String(e.sp).trim();
    });
    return Object.keys(t).filter(function (k) { return t[k] > 0 && t[k] >= r; })
      .sort(function (a, b) { return t[b] - t[a]; }).map(function (k) { return nm[k]; });
  }
  function belowText(top) {
    return ' · #' + (top.length + 1) + '\u00a0keseluruhan, di bawah ' + top.slice(0, 2).join(' dan ') +
      (top.length > 2 ? ' +' + (top.length - 2) : '');
  }

  /* ── perhitungan (cache per objek allData + hari + simulasi) ─────── */
  // app.js membuat objek allData BARU setiap snapshot Firebase, jadi
  // "objeknya sama" = "datanya sama": render tanpa data baru tidak dihitung.
  var C = { data: null, day: null, sim: null, hist: null, histSig: '', res: {}, rec: {} };
  var simRows = null;

  // riwayat hari SEBELUM hari ini: total per sales per hari, hari aktif
  // perusahaan, hari terbaik. Dihitung ulang hanya kalau isi hari lampau
  // berubah (tanda = kunci + jumlah baris + ts baris terakhir per hari).
  function history(today) {
    var D = getData(), keys = Object.keys(D).filter(function (k) { return k < today && /^\d{4}-\d\d-\d\d$/.test(k); }).sort();
    var sig = today + '#';
    for (var i = 0; i < keys.length; i++) {
      var a = D[keys[i]], n = Array.isArray(a) ? a.length : 0, last = n && ok(a[n - 1]) ? (a[n - 1].ts || 0) : 0;
      sig += keys[i] + ':' + n + ':' + last + ',';
    }
    if (C.hist && C.histSig === sig) return C.hist;
    var tot = {}, active = {};
    keys.forEach(function (k) {
      var rows = dayRows(k);
      if (rows.length) active[k] = 1;
      rows.forEach(function (e) {
        if (!isSeller(e.sp)) return;
        var n = norm(e.sp), t = tot[n] || (tot[n] = {});
        t[k] = (t[k] || 0) + (+e.revenue || 0);
      });
    });
    var best = {};
    Object.keys(tot).forEach(function (n) {
      var b = { rev: 0, day: null, days: 0 }, t = tot[n];
      Object.keys(t).forEach(function (k) {
        if (t[k] > 0) b.days++;
        if (t[k] > b.rev) { b.rev = t[k]; b.day = k; }
      });
      best[n] = b;
    });
    C.hist = { tot: tot, active: active, best: best, first: keys[0] || today };
    C.histSig = sig;
    return C.hist;
  }

  function compute() {
    var D = getData(), today = HX.todayKey();
    if (C.data === D && C.day === today && C.sim === simRows) return C.res;
    C.data = D; C.day = today; C.sim = simRows;
    var res = {}, rec = {};
    C.res = res; C.rec = rec;
    if (!Object.keys(D).length) return res;
    var H = history(today);
    function give(n, b) { (res[n] || (res[n] = [])).push(b); }

    // hari ini, per sales
    var rows = dayRows(today).concat(simRows || []);
    var by = {};
    rows.forEach(function (e) { if (isSeller(e.sp)) (by[norm(e.sp)] || (by[norm(e.sp)] = [])).push(e); });
    var cl = {}, tot = {};
    Object.keys(by).forEach(function (n) {
      cl[n] = closings(by[n]);
      tot[n] = by[n].reduce(function (s, e) { return s + (+e.revenue || 0); }, 0);
    });

    // 1. Closing pertama
    var fN = null, fC = null;
    Object.keys(cl).forEach(function (n) { var c = cl[n][0]; if (c && (!fC || c.ts < fC.ts)) { fC = c; fN = n; } });
    if (fN) give(fN, { id: 'pertama', label: 'Closing pertama', short: 'Pertama', tone: 'silver', value: 50, earnedAt: fC.ts,
      detail: 'Closing pertama hari ini · ' + hm(fC.ts) });

    // 2. Hattrick: jendela 60 menit dengan closing terbanyak (≥ 3)
    Object.keys(cl).forEach(function (n) {
      var c = cl[n], bestN = 0, bi = 0, bj = 0, j = 0, at = 0;
      for (var i = 0; i < c.length; i++) {
        while (c[i].ts - c[j].ts > HOUR) j++;
        if (i - j + 1 > bestN) { bestN = i - j + 1; bi = j; bj = i; }
        if (!at && i - j + 1 >= 3) at = c[i].ts;   // closing ke-3 pertama dalam satu jam
      }
      if (bestN >= 3) {
        var mins = Math.max(1, Math.round((c[bj].ts - c[bi].ts) / 60000));
        give(n, { id: 'hattrick', label: 'Hattrick', short: 'Hattrick', tone: 'green', value: 80, earnedAt: at,
          detail: bestN + ' closing dalam ' + mins + ' mnt · ' + hm(c[bi].ts) + '–' + hm(c[bj].ts) });
      }
    });

    // 3. Terbesar minggu ini (Senin–Minggu): satu closing terbesar
    var back = (dateOf(today).getDay() + 6) % 7, tB = null;
    for (var d = back; d >= 0; d--) {
      var k = shift(today, -d), m = {};
      (d === 0 ? rows : dayRows(k)).forEach(function (e) { if (isSeller(e.sp)) (m[norm(e.sp)] || (m[norm(e.sp)] = [])).push(e); });
      Object.keys(m).forEach(function (n) {
        closings(m[n]).forEach(function (c) {
          if (c.rev > 0 && (!tB || c.rev > tB.c.rev || (c.rev === tB.c.rev && c.ts < tB.c.ts))) tB = { n: n, c: c, k: k };
        });
      });
    }
    if (tB) {
      var when = tB.k === today ? 'hari ini ' + hm(tB.c.ts) : HRI[dateOf(tB.k).getDay()] + ' ' + dShort(tB.k);
      give(tB.n, { id: 'terbesar', label: 'Terbesar minggu ini', short: 'Terbesar', tone: 'green', value: 75, earnedAt: tB.c.ts, ver: String(tB.c.ts),
        detail: rp(tB.c.rev) + (tB.c.items > 1 ? ' · ' + tB.c.items + ' item' : '') + ' · ' + when });
    }

    // 4. Beruntun N hari kerja
    var cand = {};
    Object.keys(H.tot).forEach(function (n) { cand[n] = 1; });
    Object.keys(tot).forEach(function (n) { cand[n] = 1; });
    Object.keys(cand).forEach(function (n) {
      var t = H.tot[n] || {}, soldToday = (tot[n] || 0) > 0;
      var day = soldToday ? today : shift(today, -1), cnt = 0, start = null, guard = 0;
      while (guard++ < STREAK_MAX_DAYS && day >= H.first) {
        if (day === today || (t[day] || 0) > 0) { cnt++; start = day; }
        else if (dateOf(day).getDay() !== 0 && H.active[day]) break;   // hari kerja tanpa closing: putus
        day = shift(day, -1);
      }
      if (cnt >= STREAK_MIN) {
        give(n, { id: 'beruntun', label: 'Beruntun ' + cnt + ' hari', short: cnt + ' hari', tone: 'green', value: 55 + Math.min(cnt, 19), n: cnt,
          earnedAt: soldToday && cl[n] && cl[n][0] ? cl[n][0].ts : midnight(today),
          detail: 'Closing tiap hari kerja sejak ' + dShort(start) + (soldToday ? '' : ' · hari ini belum') });
      }
    });

    // 5. Juara kemarin
    var yk = shift(today, -1), yN = null, yR = 0, yR2 = 0;
    Object.keys(H.tot).forEach(function (n) {
      var r = H.tot[n][yk] || 0;
      if (r > yR) { yR2 = yR; yR = r; yN = n; } else if (r > yR2) yR2 = r;
    });
    if (yN) {
      var yTop = nonSellersAbove(dayRows(yk), yR), yQ = yTop.length > 0;
      give(yN, { id: 'juara-kemarin', label: yQ ? 'Juara sales kemarin' : 'Juara kemarin', short: yQ ? '#1 sales kemarin' : '#1 kemarin',
        tone: 'silver', value: 58, all1: !yQ, earnedAt: midnight(today),
        detail: rp(yR) + (yR2 > 0 ? ' · unggul ' + rp(yR - yR2) + (yQ ? ' dari sales lain' : '') : '') + (yQ ? belowText(yTop) : '') });
    }

    // 6. Juara hari ini — putar ulang urutan penjualan: kapan terakhir naik ke #1
    var seq = [];
    Object.keys(by).forEach(function (n) { by[n].forEach(function (e) { seq.push({ n: n, ts: +e.ts || 0, r: +e.revenue || 0 }); }); });
    seq.sort(function (a, b) { return a.ts - b.ts; });
    var run = {}, lead = null, since = 0;
    seq.forEach(function (s) {
      run[s.n] = (run[s.n] || 0) + s.r;
      if (run[s.n] > 0 && (!lead || (s.n !== lead && run[s.n] > run[lead]))) { lead = s.n; since = s.ts; }
    });
    // koreksi baris negatif (retur): pemimpin akhir = omzet terbesar
    Object.keys(run).forEach(function (n) { if (lead && run[n] > run[lead]) { lead = n; since = 0; } });
    if (lead && run[lead] > 0) {
      var second = 0;
      Object.keys(run).forEach(function (n) { if (n !== lead && run[n] > second) second = run[n]; });
      var top = nonSellersAbove(rows, run[lead]), q = top.length > 0;
      give(lead, { id: 'juara-hari', label: q ? 'Juara sales hari ini' : 'Juara hari ini', short: q ? '#1 sales' : '#1 hari ini',
        tone: 'gold', value: 95, all1: !q, earnedAt: since || now(),
        detail: rp(run[lead]) + (second > 0 ? ' · unggul ' + rp(run[lead] - second) + (q ? ' dari sales lain' : '')
          : (q ? ' · satu-satunya sales yang closing' : ' · satu-satunya yang closing')) + (q ? belowText(top) : '') });
    }

    // 7. Rekor pribadi — SATU definisi dengan kapsul rekor fx-live
    //    (HX.records.day); hitungan sendiri hanya bila fx-live tidak ada atau
    //    saat simulasi (_sim menambah baris yang tidak dikenal HX.records)
    var RX = !simRows && HX.records && typeof HX.records.day === 'function' ? HX.records : null;
    Object.keys(tot).forEach(function (n) {
      var b = H.best[n] || { rev: 0, day: null, days: 0 };
      var r = { today: tot[n], best: b.rev, bestDay: b.day, activeDays: b.days, record: b.days >= REC_MIN_DAYS && b.rev > 0 && tot[n] > b.rev };
      if (RX) {
        try {
          var x = RX.day(n);
          if (x && typeof x.record === 'boolean') r = { today: +x.today || 0, best: +x.best || 0, bestDay: x.bestDate || null, activeDays: +x.days || 0, record: x.record };
        } catch (e) { }
      }
      rec[n] = { today: r.today, best: r.best, bestDay: r.bestDay, activeDays: r.activeDays };
      if (r.record && r.bestDay) {
        var acc = 0, at3 = 0;
        by[n].slice().sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); }).forEach(function (e) {
          acc += +e.revenue || 0; if (!at3 && acc > r.best) at3 = +e.ts || 0;
        });
        var bd = RX && typeof RX.dateLabel === 'function' ? RX.dateLabel(r.bestDay) : dShort(r.bestDay);
        give(n, { id: 'rekor', label: 'Rekor pribadi', short: 'Rekor', tone: 'gold', sk: 'goldl', value: 100, earnedAt: at3 || now(),
          detail: rp(r.today) + ' hari ini · rekor lama ' + rp(r.best) + ' (' + bd + ')' });
      }
    });

    Object.keys(res).forEach(function (n) {
      res[n].sort(function (a, b) { return b.value - a.value || (a.earnedAt || 0) - (b.earnedAt || 0); });
    });
    return res;
  }

  function pub(b) {
    return { id: b.id, label: b.label, short: b.short, detail: b.detail, earnedAt: b.earnedAt, tone: b.tone, value: b.value };
  }
  function raw(sp) { try { return compute()[norm(sp)] || []; } catch (e) { console.warn('[HX] badges', e); return []; } }
  HX.badges = function (sp) { return raw(sp).map(pub); };
  HX.badges.icon = iconOf;
  HX.badges.all = function () {
    var r = {}, o = {};
    try { r = compute(); } catch (e) { }
    Object.keys(r).forEach(function (n) { o[n] = r[n].map(pub); });
    return o;
  };
  HX.badges.record = function (sp) {
    try { compute(); } catch (e) { return null; }
    var r = C.rec[norm(sp)];
    return r ? { today: r.today, best: r.best, bestDay: r.bestDay, activeDays: r.activeDays } : null;
  };

  /* ── "baru" per HP per hari ──────────────────────────────────────── */
  var SEEN_KEY = 'hx-bdg-seen', seen = { d: '', ids: {} }, playing = {};
  try { var sv = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); if (sv && sv.ids && sv.d) seen = sv; } catch (e) { }
  function seenIds() { var t = HX.todayKey(); if (seen.d !== t) { seen = { d: t, ids: {} }; playing = {}; } return seen.ids; }
  function markSeen(bi) {
    seenIds()[bi] = 1;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) { }
  }
  function instId(b, sp) { return b.id + ':' + norm(sp) + (b.ver ? ':' + b.ver : ''); }
  // status kilau sebuah lencana: sedang menyala (lanjutkan dari posisinya
  // setelah app.js membangun ulang daftar), menunggu terlihat, atau biasa
  function stateOf(bi) {
    var p = playing[bi], t = now();
    if (p && t < p + PLAY_MS) return { cls: ' hx-bdg-new', d: Math.round(p - t) };
    if (!seenIds()[bi] && !HX.reduced()) return { cls: ' hx-bdg-pend', d: null };
    return { cls: '', d: null };
  }
  function dStyle(st) { return st.d == null ? '' : '--hx-bdg-d:' + st.d + 'ms;'; }

  /* ── ukuran chip tanpa layout (canvas measureText) ───────────────── */
  // skin.css memaksa satu tumpukan font sistem untuk semua elemen
  // (*{font-family:…!important}) — tapi body punya font sendiri. Jadi font
  // dibaca SEKALI dari chip contoh tersembunyi berkelas sama.
  var cv = null, wCache = {}, FONT = '';
  function chipFont() {
    var f = '';
    try {
      var p = document.createElement('span');
      p.className = 'hx-bdg';
      p.setAttribute('aria-hidden', 'true');
      p.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden';
      p.innerHTML = '<span class="hx-bdg-t">M</span>';
      document.body.appendChild(p);
      var cs = getComputedStyle(p.firstChild);
      f = (cs.fontWeight || '600') + ' ' + (cs.fontSize || '10px') + ' ' + cs.fontFamily;
      document.body.removeChild(p);
    } catch (e) { }
    return f || '600 10px sans-serif';
  }
  function textW(t) {
    if (wCache[t] != null) return wCache[t];
    var w = t.length * 6;
    try {
      if (!FONT) FONT = chipFont();
      cv = cv || document.createElement('canvas').getContext('2d');
      cv.font = FONT;
      w = cv.measureText(t).width + t.length * 0.1 + 1.5;
    } catch (e) { }
    return (wCache[t] = Math.ceil(w));
  }
  // = CSS: padding 0 7px 0 5px, glif 12px + 4px, tanpa border (rim = inset shadow)
  var CHIP_PAD = 5 + 12 + 4 + 7, CHIP_GAP = 4, ICO_W = 20;
  function chipW(t) { return CHIP_PAD + textW(t); }
  function moreW(n) { return 13 + textW('+' + n); }

  // ruang di kanan avatar kartu: diukur sekali per lebar layar, hanya saat
  // halaman Salespeople terlihat (kalau tersembunyi: perkiraan dari CSS,
  // diukur ulang saat halaman dibuka)
  var VW = window.innerWidth || 390, fit = { vw: -1, avail: 0, est: true };
  function estimate(vw) {
    if (vw <= 390) return vw - 32 - 28 - 40 - 8;             // 1 kolom
    if (vw <= 768) return (vw - 33) / 2 - 28 - 40 - 8;       // 2 kolom
    return 196;
  }
  function spPageOn() { var p = document.getElementById('page-salespeople'); return !!(p && p.classList.contains('active')); }
  function avail() {
    if (fit.vw === VW && (!fit.est || !spPageOn())) return fit.avail;
    var host = document.getElementById('spGrid'), card = spPageOn() && host ? host.querySelector('.spc') : null;
    var cw = card ? card.clientWidth : 0;
    if (cw > 0) {
      var cs = getComputedStyle(card), av = card.querySelector('.spc-av');
      fit = { vw: VW, est: false, avail: cw - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0) - (av ? av.offsetWidth : 44) - 8 };
    } else fit = { vw: VW, est: true, avail: estimate(VW) };
    return fit.avail;
  }
  // susunan pertama yang muat: 2 label → 2 label pendek → 1 label +N →
  // 1 label pendek +N → ikon +N
  var TRIES = [[2, 'label'], [2, 'short'], [1, 'label'], [1, 'short']];
  function layout(bs, room) {
    var n = bs.length;
    for (var i = 0; i < TRIES.length; i++) {
      var k = Math.min(TRIES[i][0], n), mode = TRIES[i][1], w = 0;
      for (var j = 0; j < k; j++) w += chipW(bs[j][mode]) + (j ? CHIP_GAP : 0);
      if (n > k) w += CHIP_GAP + moreW(n - k);
      if (w <= room) return { k: k, mode: mode };
    }
    return { k: 1, mode: 'icon' };
  }

  /* ── kartu Salespeople ───────────────────────────────────────────── */
  function spOfKey(k) { k = k || ''; var i = k.lastIndexOf('|'); return i > 0 ? k.slice(0, i) : k; }
  function childByClass(el, cls) {
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.classList && c.classList.contains(cls)) return c;
    return null;
  }
  // kelas warna: tone, kecuali gaya khusus (rekor = glif + garis tepi emas
  // tanpa isi emas, supaya tidak tertukar dengan "Juara hari ini")
  function toneCls(b) { return 'hxb-' + (b.sk || b.tone); }
  function chipHTML(b, sp, mode) {
    var bi = instId(b, sp), st = stateOf(bi), s = dStyle(st);
    return '<span class="hx-bdg ' + toneCls(b) + (mode === 'icon' ? ' hx-bdg-ico' : '') + st.cls + '" data-bi="' + esc(bi) + '"' +
      (s ? ' style="' + s + '"' : '') + ' title="' + esc(b.label + ' · ' + b.detail) + '">' + iconOf(b.id) +
      (mode === 'icon' ? '' : '<span class="hx-bdg-t">' + esc(b[mode]) + '</span>') + '</span>';
  }
  function decorateCards(on) {
    var host = document.getElementById('spGrid');
    if (!host) return;
    var cards = host.getElementsByClassName('spc'), room = -1;
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c], row = childByClass(card, 'hx-bdg-row');
      var sp = spOfKey(card.getAttribute('data-k')), bs = on ? raw(sp) : [];
      if (!bs.length) { if (row) card.removeChild(row); continue; }
      if (room < 0) room = avail();
      var L = layout(bs, room), field = L.mode === 'icon' ? 'id' : L.mode;
      var sig = L.k + L.mode + '|' + bs.map(function (b) { return instId(b, sp) + '=' + toneCls(b) + '=' + b[field] + '=' + b.detail; }).join(',');
      if (row && row.getAttribute('data-sig') === sig) continue;
      var h = '';
      for (var j = 0; j < L.k; j++) h += chipHTML(bs[j], sp, L.mode);
      if (bs.length > L.k) {
        h += '<span class="hx-bdg hx-bdg-more" title="' + esc(bs.slice(L.k).map(function (b) { return b.label; }).join(', ')) + '">+' + (bs.length - L.k) + '</span>';
      }
      if (!row) { row = document.createElement('div'); row.className = 'hx-bdg-row'; card.appendChild(row); }
      row.setAttribute('data-sig', sig);
      row.setAttribute('role', 'img');
      row.setAttribute('aria-label', 'Pencapaian: ' + bs.map(function (b) { return b.label; }).join(', '));
      row.innerHTML = h;
    }
  }

  /* ── Top Performers: satu chip ikon setelah nama ─────────────────── */
  function decorateLb(on) {
    var host = document.getElementById('lb');
    if (!host) return;
    var rows = host.getElementsByClassName('lbi');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], nm = r.querySelector('.lbn');
      if (!nm) continue;
      var old = childByClass(nm, 'hx-bdg-lb'), sp = spOfKey(r.getAttribute('data-k'));
      var b = null;
      // "Juara hari ini" dilewati hanya kalau baris ini memang 01 keseluruhan
      if (on) { var bs = raw(sp); for (var j = 0; j < bs.length && !b; j++) if (!(bs[j].id === 'juara-hari' && bs[j].all1)) b = bs[j]; }
      if (!b) { if (old) nm.removeChild(old); continue; }
      var bi = instId(b, sp), sig = bi + '=' + b.label + '=' + b.detail;
      if (old && old.getAttribute('data-sig') === sig) continue;
      var st = stateOf(bi), el = old || document.createElement('span');
      el.className = 'hx-bdg-lb ' + toneCls(b) + st.cls;
      el.setAttribute('data-bi', bi);
      el.setAttribute('data-sig', sig);
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', b.label);
      el.setAttribute('title', b.label + ' · ' + b.detail);
      if (st.d != null) el.setAttribute('style', dStyle(st)); else el.removeAttribute('style');
      el.innerHTML = iconOf(b.id);
      if (!old) nm.appendChild(el);
    }
  }

  /* ── modal detail sales: bagian "Pencapaian" ─────────────────────── */
  var modalFresh = true;
  function paintModal(sp, team, box) {
    if (!box) return;
    var sec = childByClass(box, 'hx-bdg-sec'), bs = live() ? raw(sp) : [];
    var opening = modalFresh;
    modalFresh = false;
    if (!bs.length) {
      if (sec) { sec.style.display = 'none'; sec.removeAttribute('data-sig'); }
      return;
    }
    var spN = norm(sp);
    if (!sec) {
      sec = document.createElement('div');
      sec.className = 'hx-bdg-sec';
      var after = childByClass(box, 'hx-sp-actions') || document.getElementById('mKPIs');
      if (after && after.parentNode === box) box.insertBefore(sec, after.nextSibling); else box.appendChild(sec);
      opening = true;
    }
    if (sec.getAttribute('data-sp') !== spN || sec.style.display === 'none') opening = true;
    var sig = bs.map(function (b) { return instId(b, sp) + '=' + toneCls(b) + '=' + b.label + '=' + b.detail; }).join(',');
    if (!opening && sec.getAttribute('data-sig') === sig) return;
    var had = {};
    if (!opening) {
      var olds = sec.querySelectorAll('[data-bi]');
      for (var i = 0; i < olds.length; i++) had[olds[i].getAttribute('data-bi')] = 1;
    }
    var anim = !HX.reduced(), k = 0;
    var h = '<div class="sl hx-bdg-sl">Pencapaian</div><div class="hx-bdg-list" role="list">';
    bs.forEach(function (b) {
      var bi = instId(b, sp), st = stateOf(bi), enter = anim && (opening || !had[bi]);
      var delay = enter && opening ? 140 + k++ * 60 : 0;
      var style = dStyle(st) + (enter ? 'animation-delay:' + delay + 'ms;' : '');
      h += '<div class="hx-bdg-tile ' + toneCls(b) + st.cls + (enter ? ' hx-bdg-in' : '') + '" role="listitem" data-bi="' + esc(bi) + '"' +
        (enter ? ' data-d0="' + (delay + 380) + '"' : '') + (style ? ' style="' + style + '"' : '') + '>' +
        '<span class="hx-bdg-disc">' + iconOf(b.id) + '</span>' +
        '<span class="hx-bdg-tx"><span class="hx-bdg-tl">' + esc(b.label) + '</span><span class="hx-bdg-td">' + esc(b.detail) + '</span></span></div>';
    });
    sec.innerHTML = h + '</div>';
    sec.setAttribute('data-sp', spN);
    sec.setAttribute('data-sig', sig);
    sec.style.display = '';
    watchPending();
    armCleanup();
  }

  /* ── kilau sekali saat lencana pertama kali TERLIHAT ─────────────── */
  // Lencana yang belum pernah tampil di HP ini hari ini menunggu sampai
  // ≥ 55% terlihat di layar (IntersectionObserver), tidak tertutup modal /
  // layar penuh / lembar, dan tab aktif. Tertutup → menunggu tanpa polling;
  // dicoba lagi saat modal/layar penuh ditutup atau tab aktif kembali.
  var io = null, retryT = 0;
  function blocked(el) {
    if (document.hidden) return true;
    var de = document.documentElement;
    if (de.classList.contains('hx-overlay-open') || de.classList.contains('hx-gesture')) return true;
    var mo = document.getElementById('spMo'), inMo = !!(mo && mo.contains(el));
    if (!inMo && mo && mo.style.display && mo.style.display !== 'none') return true;
    var b = document.body;
    if (!inMo && b && (b.classList.contains('premium-form-open') || b.classList.contains('premium-more-open'))) return true;
    return false;
  }
  function play(el, delay) {
    var bi = el.getAttribute('data-bi');
    el.classList.remove('hx-bdg-pend');
    if (!bi) return;
    if (seenIds()[bi]) {
      // sudah terlihat di tempat lain (mis. di modal): ikut kilau yang masih
      // berjalan, atau diam saja
      var p = playing[bi], t = now();
      if (p && t < p + PLAY_MS && !HX.reduced()) {
        el.style.setProperty('--hx-bdg-d', Math.round(p - t) + 'ms');
        el.classList.add('hx-bdg-new');
        armCleanup();
      }
      return;
    }
    markSeen(bi);
    if (HX.reduced()) return;
    playing[bi] = now() + delay;
    el.style.setProperty('--hx-bdg-d', delay + 'ms');
    el.classList.add('hx-bdg-new');
    armCleanup();
  }
  // Satu pewaktu untuk semua kilau: setelah jendelanya lewat, kelas dilepas
  // dari elemen mana pun yang membawanya — termasuk salinan yang dibuat ulang
  // saat app.js membangun ulang daftar di tengah kilau.
  var cleanT = 0;
  function armCleanup() {
    clearTimeout(cleanT);
    var t = now(), next = Infinity;
    Object.keys(playing).forEach(function (bi) {
      var end = playing[bi] + PLAY_MS + 60;
      if (end > t) next = Math.min(next, end); else delete playing[bi];
    });
    var els = document.querySelectorAll('.hx-bdg-new');
    for (var i = 0; i < els.length; i++) {
      if (!playing[els[i].getAttribute('data-bi')]) { els[i].classList.remove('hx-bdg-new'); els[i].style.removeProperty('--hx-bdg-d'); }
    }
    cleanT = next < Infinity ? setTimeout(armCleanup, next - t + 10) : 0;
  }
  function onSeen(entries) {
    var batch = [];
    entries.forEach(function (en) {
      var el = en.target;
      if (!document.documentElement.contains(el)) { io.unobserve(el); return; }
      if (!en.isIntersecting || en.intersectionRatio < 0.55 || blocked(el)) return;
      io.unobserve(el);
      batch.push(el);
    });
    if (!batch.length) return;
    // menyala berurutan dalam urutan baca
    batch.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
    batch.forEach(function (el, i) {
      var base = +el.getAttribute('data-d0') || 0;
      var pg = el.closest ? el.closest('.page') : null;
      if (pg && pg.classList.contains('lg-enter')) base = Math.max(base, 700);   // tunggu kartu masuk (motion.js)
      play(el, base + Math.min(i, 8) * 70);
    });
  }
  function watchPending() {
    var els = document.querySelectorAll('.hx-bdg-pend');
    if (!window.IntersectionObserver) {
      for (var i = 0; i < els.length; i++) if (!blocked(els[i])) play(els[i], 0);
      return;
    }
    if (!io) io = new IntersectionObserver(onSeen, { threshold: [0, 0.55, 1] });
    io.disconnect();
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  }
  function retrySoon() {
    clearTimeout(retryT);
    retryT = setTimeout(function () { if (document.querySelector('.hx-bdg-pend')) watchPending(); }, 250);
  }

  /* ── siklus ──────────────────────────────────────────────────────── */
  function decorateAll() {
    var on = live();
    try { decorateCards(on); } catch (e) { console.warn('[HX] badges cards', e); }
    try { decorateLb(on); } catch (e) { console.warn('[HX] badges lb', e); }
    watchPending();
    if (cleanT || document.querySelector('.hx-bdg-new')) armCleanup();
  }
  HX.on('render', decorateAll);
  HX.on('ready', decorateAll);
  HX.on('spmodal', function (o) {
    try { paintModal(o.sp, o.team, o.box); } catch (e) { console.warn('[HX] badges modal', e); }
  });
  HX.on('page', function (o) {
    if (o && o.id === 'page-salespeople' && fit.est) {
      try { decorateCards(live()); } catch (e) { }   // ukur ruang sungguhan sekarang
    }
    watchPending();
  });

  function hookClose() {
    if (!window.MutationObserver) return;
    var mo = document.getElementById('spMo');
    if (mo) new MutationObserver(function () {
      if (!mo.style.display || mo.style.display === 'none') { modalFresh = true; retrySoon(); }
    }).observe(mo, { attributes: true, attributeFilter: ['style'] });
    var pend = function () { if (document.querySelector('.hx-bdg-pend')) retrySoon(); };
    new MutationObserver(pend).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    if (document.body) new MutationObserver(pend).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (C.day && C.day !== HX.todayKey()) decorateAll(); else retrySoon();
  });

  // ganti hari tanpa render (HP terbuka lewat tengah malam)
  function atMidnight() {
    var t = new Date(), next = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 5);
    setTimeout(function () { decorateAll(); atMidnight(); }, Math.max(60000, next - t));
  }

  var rzT = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rzT);
    rzT = setTimeout(function () {
      var w = window.innerWidth || VW;
      if (w === VW) return;
      VW = w;
      try { decorateCards(live()); } catch (e) { }
      watchPending();
    }, 160);
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { wCache = {}; FONT = ''; try { decorateCards(live()); } catch (e) { } });
  }

  // TES SAJA — penjualan palsu hanya untuk perhitungan modul ini
  HX.badges._sim = function (arr) {
    simRows = arr && arr.length ? arr.map(function (e) {
      return { sp: e.sp, team: e.team, prod: e.prod || 'TWIN TURBO', units: e.units || 1, revenue: e.revenue != null ? +e.revenue : 5775000, ts: e.ts || now() };
    }) : null;
    decorateAll();
    var cur = HX.spCurrent, mo = document.getElementById('spMo');
    if (cur && mo && mo.style.display === 'flex') paintModal(cur.sp, cur.team, mo.querySelector('.mbox'));
    return simRows ? simRows.length : 0;
  };
  HX.badges._bench = function () { C.data = null; C.hist = null; C.histSig = ''; var t0 = performance.now(); compute(); return +(performance.now() - t0).toFixed(2); };
  HX.badges._seenReset = function () { seen = { d: HX.todayKey(), ids: {} }; playing = {}; try { localStorage.removeItem(SEEN_KEY); } catch (e) { } };

  function boot() { hookClose(); atMidnight(); decorateAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
