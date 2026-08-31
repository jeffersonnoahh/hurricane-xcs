(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const money = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
  const compact = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(Math.round(n || 0));
  };

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function revenueForDate(date) {
    return (allData[dateKey(date)] || []).reduce((sum, entry) => sum + (entry.revenue || 0), 0);
  }

  function monthSeries(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const end = year === today.getFullYear() && month === today.getMonth() ? Math.min(today.getDate(), days) : days;
    let cumulative = 0;
    const values = [];
    for (let day = 1; day <= end; day++) {
      const value = revenueForDate(new Date(year, month, day));
      cumulative += value;
      values.push({day, daily:value, cumulative});
    }
    return values;
  }

  function monthTotal(date) {
    const series = monthSeries(date);
    return series.length ? series[series.length - 1].cumulative : 0;
  }

  function chartSvg(series, monthLabel, gradientId) {
    gradientId = gradientId || 'refRevenueGradient';
    const W = 850, H = 188, left = 58, right = 12, top = 10, bottom = 27;
    const innerW = W - left - right, innerH = H - top - bottom;
    const max = Math.max(1, ...series.map((d) => d.cumulative));
    const x = (i) => left + (series.length <= 1 ? innerW : (i / (series.length - 1)) * innerW);
    const y = (value) => top + innerH - (value / max) * innerH;
    const pts = series.map((d, i) => [x(i), y(d.cumulative)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ' L' + (pts.length ? pts[pts.length - 1][0].toFixed(1) : left) + ',' + (top + innerH) + ' L' + left + ',' + (top + innerH) + ' Z';
    const grids = [0,.25,.5,.75,1].map((ratio) => {
      const gy = top + innerH - ratio * innerH;
      return '<line class="ref-chart-grid" x1="' + left + '" y1="' + gy + '" x2="' + (W-right) + '" y2="' + gy + '"></line>' +
        '<text class="ref-chart-label" x="0" y="' + (gy+4) + '">' + compact(max*ratio) + '</text>';
    }).join('');
    const tickIndexes = [...new Set([0,Math.floor((series.length-1)/3),Math.floor((series.length-1)*2/3),series.length-1])].filter((i)=>i>=0);
    const ticks = tickIndexes.map((i) => '<text class="ref-chart-label" text-anchor="middle" x="' + x(i) + '" y="' + (H-5) + '">' + series[i].day + ' ' + monthLabel + '</text>').join('');
    const dot = pts.length ? '<circle class="ref-chart-dot" cx="' + pts[pts.length-1][0] + '" cy="' + pts[pts.length-1][1] + '" r="4"></circle>' : '';
    return '<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Cumulative monthly revenue trend">' +
      '<defs><linearGradient id="'+gradientId+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#20d883" stop-opacity=".28"></stop><stop offset="1" stop-color="#20d883" stop-opacity=".015"></stop></linearGradient></defs>' +
      grids + (series.length ? '<path class="ref-chart-area" d="'+area+'"></path><path class="ref-chart-line" d="'+line+'"></path>' : '') + dot + ticks + '</svg>';
  }

  function renderHistoryBars() {
    document.querySelectorAll('#histStrip .hday').forEach((card) => {
      let bars = card.querySelector('.ref-history-bars');
      if (!bars) {
        bars = document.createElement('div');
        bars.className = 'ref-history-bars';
        card.appendChild(bars);
      }
      const entries = allData[card.dataset.dateKey] || [];
      const values = entries.map((entry) => entry.revenue || 0).filter(Boolean).slice(-8);
      const max = Math.max(1,...values);
      const signature = values.join(',');
      if (bars.dataset.signature === signature) return;
      bars.dataset.signature = signature;
      bars.innerHTML = values.length
        ? values.map((value) => '<i style="height:'+Math.max(3,Math.round(value/max*29))+'px"></i>').join('')
        : '<i style="height:2px;opacity:.25"></i>';
    });
  }

  function renderReferenceDashboard() {
    const hero = $('homeOmsetHero');
    if (!hero || typeof allData === 'undefined' || typeof vOff === 'undefined') return;
    let chart = hero.querySelector('.ref-chart');
    if (!chart) {
      chart = document.createElement('div');
      chart.className = 'ref-chart';
      hero.appendChild(chart);
      const foot = document.createElement('div');
      foot.className = 'ref-hero-foot';
      hero.appendChild(foot);
    }
    const viewed = od(vOff);
    const series = monthSeries(viewed);
    const current = series.length ? series[series.length - 1].cumulative : 0;
    const previousDate = new Date(viewed.getFullYear(), viewed.getMonth()-1, 1);
    const previous = monthTotal(previousDate);
    const delta = current - previous;
    const pct = previous > 0 ? delta / previous * 100 : null;
    const sub = $('liveOmsetSub');
    if (sub) {
      const cls = delta >= 0 ? 'ref-compare-positive' : 'ref-compare-negative';
      const arrow = delta >= 0 ? '↑' : '↓';
      sub.innerHTML = '<span class="'+cls+'">'+(pct===null?'—':((pct>=0?'+':'')+pct.toFixed(1)+'%'))+'</span>' +
        '<span>vs '+previousDate.toLocaleDateString('en-US',{month:'short',year:'numeric'})+' &nbsp; '+arrow+' '+money(Math.abs(delta))+'</span>';
    }
    const monthShort = viewed.toLocaleDateString('en-US',{month:'short'}).toUpperCase();
    chart.innerHTML = chartSvg(series,monthShort,'refRevenueGradient');
    const foot = hero.querySelector('.ref-hero-foot');
    if (foot) foot.textContent = viewed.toLocaleDateString('en-US',{month:'long',year:'numeric'}) + ' · live total omset';
    renderHistoryBars();
  }

  function renderReferenceMonthly() {
    const hero = $('monthlyOmsetHero');
    if (!hero || typeof allData === 'undefined' || typeof mYear === 'undefined' || typeof mMonth === 'undefined') return;
    const viewed = new Date(mYear,mMonth,1);
    const series = monthSeries(viewed);
    const current = series.length ? series[series.length-1].cumulative : 0;
    const previousDate = new Date(mYear,mMonth-1,1);
    const previous = monthTotal(previousDate);
    const delta = current-previous;
    const pct = previous>0 ? delta/previous*100 : null;
    const big = $('mOmsetBig');
    if (big) {
      const desiredValue = window.matchMedia('(max-width:540px)').matches ? 'Rp '+compact(current) : money(current);
      if (big.textContent !== desiredValue) big.textContent = desiredValue;
    }
    const sub = $('mOmsetSub');
    if (sub) {
      const cls = delta>=0 ? 'ref-compare-positive' : 'ref-compare-negative';
      const arrow = delta>=0 ? '↑' : '↓';
      const desiredSub = '<span class="'+cls+'">'+(pct===null?'—':((pct>=0?'+':'')+pct.toFixed(1)+'%'))+'</span>'+
        '<span>vs '+previousDate.toLocaleDateString('en-US',{month:'short',year:'numeric'})+' &nbsp; '+arrow+' '+money(Math.abs(delta))+'</span>';
      if (sub.innerHTML !== desiredSub) sub.innerHTML = desiredSub;
    }
    const signature = [mYear,mMonth,current,previous].join('|');
    if (hero.dataset.refSignature === signature && hero.querySelector('.ref-month-chart')) return;
    hero.dataset.refSignature = signature;

    let chart = hero.querySelector('.ref-month-chart');
    if (!chart) {
      chart = document.createElement('div');
      chart.className = 'ref-chart ref-month-chart';
      hero.appendChild(chart);
      const foot = document.createElement('div');
      foot.className = 'ref-hero-foot ref-month-foot';
      hero.appendChild(foot);
    }
    chart.innerHTML = chartSvg(series,viewed.toLocaleDateString('en-US',{month:'short'}).toUpperCase(),'refMonthlyGradient');
    const foot = hero.querySelector('.ref-month-foot');
    if (foot) foot.textContent = viewed.toLocaleDateString('en-US',{month:'long',year:'numeric'})+' · cumulative revenue trend';
  }

  function init() {
    renderReferenceDashboard();
    renderReferenceMonthly();
    const watched = [$('liveOmsetBig'),$('dayLabel'),$('histStrip'),$('mOmsetBig'),$('monthLabel')].filter(Boolean);
    const observer = new MutationObserver(() => requestAnimationFrame(() => {
      renderReferenceDashboard();
      renderReferenceMonthly();
    }));
    watched.forEach((node) => observer.observe(node,{childList:true,subtree:true,characterData:true}));
    window.setInterval(() => { renderReferenceDashboard(); renderReferenceMonthly(); },15000);
  }

  if (document.readyState === 'complete') init();
  else window.addEventListener('load',init,{once:true});
})();
