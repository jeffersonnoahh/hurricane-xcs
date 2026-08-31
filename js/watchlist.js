/* ══════════════════════════════════════════════════════════════════════
   WATCHLIST — daftar sales bergaya watchlist saham (Stockbit / Apple Stocks).
   Tiap sales = satu baris: nama, grafik mini omzet KUMULATIF bulan berjalan,
   dan perubahan hari ini.

   Kenapa kumulatif: omzet tidak pernah berkurang, jadi garisnya NAIK saat ada
   order dan MENDATAR saat tidak ada — persis seperti permintaan (tidak bisa
   turun). Mendatar = tidak ada order, dan lamanya ditulis "BELUM ORDER n HARI".

   File TERPISAH — app.js tidak disentuh. Fungsi asli dibungkus, bukan diubah.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PAGE = 'watchlist';

  function el(id) { return document.getElementById(id); }
  function dkey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function viewedDate() {
    try { return (typeof od === 'function') ? od(vOff) : new Date(); }
    catch (e) { return new Date(); }
  }
  function rows(day) {
    if (!day) return [];
    var a = Array.isArray(day) ? day : Object.values(day);
    return a.filter(function (x) { return x && typeof x === 'object'; });
  }
  function jt(n) {
    if (!n) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + 'M';
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + 'jt';
    if (n >= 1e3) return Math.round(n / 1e3) + 'rb';
    return String(Math.round(n));
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* garis mini: kumulatif → naik saat ada order, mendatar saat tidak */
  function spark(series, color, flat) {
    var W = 132, H = 34, PAD = 3;
    if (!series.length) return '';
    var max = Math.max.apply(null, series) || 1;
    var step = series.length > 1 ? (W - PAD * 2) / (series.length - 1) : 0;
    var pts = series.map(function (v, i) {
      return [PAD + i * step, H - PAD - (v / max) * (H - PAD * 2)];
    });
    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
    var last = pts[pts.length - 1];
    var gid = 'wg' + Math.abs(color.charCodeAt(1) * 7 + series.length);
    return '<svg class="wl-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity=".38"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      (flat ? '' : '<path d="' + d + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="url(#' + gid + ')"/>') +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" ' +
      'stroke-linejoin="round" stroke-linecap="round"' + (flat ? ' stroke-dasharray="3 3"' : '') + '/>' +
      '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.6" fill="' + color + '"/>' +
      '</svg>';
  }

  function compute() {
    if (typeof TM === 'undefined' || typeof allData === 'undefined') return [];
    var vd = viewedDate();
    var y = vd.getFullYear(), m = vd.getMonth() + 1, upto = vd.getDate();
    var todayKey = dkey(vd);

    /* omzet harian per sales untuk bulan berjalan */
    var daily = {};
    Object.keys(allData).forEach(function (k) {
      var p = k.split('-');
      if (+p[0] !== y || +p[1] !== m || +p[2] > upto) return;
      rows(allData[k]).forEach(function (e) {
        var key = e.sp + '|' + e.team;
        (daily[key] || (daily[key] = {}))[+p[2]] = (daily[key][+p[2]] || 0) + (e.revenue || 0);
      });
    });

    /* tanggal order terakhir (lihat mundur, tidak hanya bulan ini) */
    var lastSale = {};
    Object.keys(allData).sort().forEach(function (k) {
      rows(allData[k]).forEach(function (e) {
        if ((e.revenue || 0) > 0) lastSale[e.sp + '|' + e.team] = k;
      });
    });

    var out = [];
    Object.keys(TM).forEach(function (team) {
      var tc = TM[team] || {};
      (tc.m || []).forEach(function (sp) {
        var key = sp + '|' + team, d = daily[key] || {};
        var series = [], cum = 0;
        for (var i = 1; i <= upto; i++) { cum += (d[i] || 0); series.push(cum); }
        var todayRev = d[upto] || 0;
        var monthRev = cum;

        var days = null;
        if (lastSale[key]) {
          var a = new Date(lastSale[key] + 'T00:00:00'), b = new Date(todayKey + 'T00:00:00');
          days = Math.round((b - a) / 864e5);
        }
        out.push({
          sp: sp, team: team, color: tc.c || '#30d158',
          series: series, today: todayRev, month: monthRev,
          daysIdle: days, everSold: !!lastSale[key]
        });
      });
    });

    /* urutan watchlist: yang bergerak hari ini di atas, lalu omzet bulan */
    out.sort(function (a, b) { return (b.today - a.today) || (b.month - a.month); });
    return out;
  }

  function render() {
    var host = el('wlBody');
    if (!host) return;
    var list = compute();
    if (!list.length) { host.innerHTML = '<div class="wl-empty">Belum ada data.</div>'; return; }

    var vd = viewedDate();
    var lbl = el('wlSub');
    if (lbl) {
      lbl.textContent = 'Omzet kumulatif 1–' + vd.getDate() + ' ' +
        vd.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) +
        ' · garis naik saat ada order, mendatar saat tidak';
    }

    var movers = list.filter(function (r) { return r.today > 0; }).length;
    var mv = el('wlMovers');
    if (mv) mv.textContent = movers + ' dari ' + list.length + ' sales bergerak hari ini';

    host.innerHTML = list.map(function (r) {
      var up = r.today > 0;
      var flat = r.month === 0;
      var color = up ? '#30d158' : (flat ? '#6e6e73' : '#8e8e93');
      var right, sub;
      if (up) {
        right = '<div class="wl-chg up">+' + jt(r.today) + '</div>';
        sub = '<div class="wl-sub">hari ini</div>';
      } else if (r.everSold && r.daysIdle !== null) {
        var warn = r.daysIdle >= 3;
        right = '<div class="wl-chg ' + (warn ? 'bad' : 'idle') + '">BELUM ORDER</div>';
        sub = '<div class="wl-sub ' + (warn ? 'bad' : '') + '">' + r.daysIdle + ' hari</div>';
      } else {
        right = '<div class="wl-chg bad">BELUM ORDER</div>';
        sub = '<div class="wl-sub bad">bulan ini</div>';
      }
      return '<div class="wl-row">' +
        '<div class="wl-id"><div class="wl-name">' + esc(r.sp) + '</div>' +
        '<div class="wl-team">' + esc(r.team) + '</div></div>' +
        '<div class="wl-chart">' + spark(r.series, color, flat) + '</div>' +
        '<div class="wl-val"><div class="wl-total">' + jt(r.month) + '</div>' +
        '<div class="wl-sub">omzet bulan</div></div>' +
        '<div class="wl-right">' + right + sub + '</div>' +
        '</div>';
    }).join('');
  }

  /* ── pasang tanpa menyentuh app.js: bungkus fungsi aslinya ── */
  function hook() {
    if (typeof window.showPage === 'function' && !window.showPage.__wl) {
      var orig = window.showPage;
      window.showPage = function (p, e) {
        orig.apply(this, arguments);
        if (p === PAGE) render();
      };
      window.showPage.__wl = true;
    }
    if (typeof window.renderAll === 'function' && !window.renderAll.__wl) {
      var origAll = window.renderAll;
      window.renderAll = function () {
        origAll.apply(this, arguments);
        var pg = el('page-' + PAGE);
        if (pg && pg.classList.contains('active')) render();
      };
      window.renderAll.__wl = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hook);
  } else { hook(); }
  setTimeout(hook, 800);
  /* AUTO_OPEN: hanya untuk screenshot — buka tab lewat ?page=watchlist */
  if(location.search.indexOf('page=watchlist')>=0){
    setTimeout(function(){
      var tb=document.querySelector('.nav-tab[data-page="watchlist"]');
      if(tb&&typeof showPage==='function')tb.click();
    },2500);
  }
  window.renderWatchlist = render;
})();
