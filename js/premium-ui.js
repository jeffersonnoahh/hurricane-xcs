(function () {
  'use strict';

  function initPremiumUI() {
    const d = document;
    const w = window;

    if (d.documentElement.dataset.premiumUiReady === 'true') return;

    const dashboard = d.getElementById('dashboardContainer');
    const readOnly = d.getElementById('roBanner');
    const goal = d.querySelector('#page-dashboard .goal-card');
    const hero = d.getElementById('homeOmsetHero');
    const dayKpis = d.querySelector('#page-dashboard .kpi-strip-2');
    const historyStrip = d.getElementById('histStrip');
    const historyLabel = d.getElementById('historyHeading');
    const saleEntryPanel = d.getElementById('saleEntryPanel');
    const leaderboardPanel = d.getElementById('leaderboardPanel');
    const performanceTabs = d.getElementById('performanceTabs');
    const nav = d.querySelector('.nav-bar');
    const teamView = d.getElementById('vTeam');
    const spView = d.getElementById('vSP');
    const productView = d.getElementById('vProd');

    const required = [
      dashboard,
      readOnly,
      goal,
      hero,
      dayKpis,
      historyStrip,
      historyLabel,
      saleEntryPanel,
      leaderboardPanel,
      performanceTabs,
      nav,
      teamView,
      spView,
      productView
    ];

    if (required.some((node) => !node)) {
      console.warn('Premium UI skipped because required dashboard elements are missing.');
      return;
    }

    const originalTabs = Array.from(nav.querySelectorAll('.nav-tab[data-page]'));
    const tabsByPage = new Map(originalTabs.map((tab) => [tab.dataset.page, tab]));
    const originalLabels = new Map(originalTabs.map((tab) => [tab.dataset.page, tab.textContent.trim()]));

    if (!tabsByPage.has('dashboard') || !tabsByPage.has('activity') || !tabsByPage.has('monthly')) {
      console.warn('Premium UI skipped because primary navigation is incomplete.');
      return;
    }

    const pageHead = d.createElement('section');
    pageHead.className = 'premium-page-head';
    pageHead.innerHTML = [
      '<div>',
      '<div class="premium-kicker">LIVE SALES OPERATIONS</div>',
      '<h1 id="premiumHeading">Today’s performance</h1>',
      '<p>Monitor momentum, celebrate wins, and act on what needs attention.</p>',
      '</div>',
      '<div class="premium-head-actions">',
      '<button type="button" class="premium-head-ghost" data-go="activity">Log activity</button>',
      '<button type="button" class="premium-head-ghost" data-go="monthly">Monthly recap</button>',
      '<button type="button" class="premium-quick-add">＋ Log a sale</button>',
      '</div>'
    ].join('');
    dashboard.insertBefore(pageHead, readOnly);

    const status = d.createElement('section');
    status.className = 'premium-status-strip';
    status.innerHTML = [
      '<div><span>TARGET PROGRESS</span><strong id="premiumPace">0%</strong><small>of selected-day target</small></div>',
      '<div><span>TOP TEAM</span><strong id="premiumTopTeam">—</strong><small>selected-day revenue</small></div>',
      '<div><span>ACTIVITY</span><strong id="premiumCloses">0 closes</strong><small>selected day</small></div>',
      '<div><span>SELECTED PERIOD</span><strong id="premiumSelectedDay">Today</strong><small>tap date to change</small></div>'
    ].join('');
    goal.after(status);

    const todayColumn = d.createElement('div');
    todayColumn.className = 'premium-today-column';
    todayColumn.append(goal, dayKpis);

    const overview = d.createElement('section');
    overview.className = 'premium-overview-grid';
    hero.before(overview);
    overview.append(hero, todayColumn);
    status.after(historyLabel, historyStrip);

    const legacyBottomGrid = saleEntryPanel.parentElement;
    const entryTitle = saleEntryPanel.querySelector('.pt');
    const closeEntry = d.createElement('button');
    closeEntry.type = 'button';
    closeEntry.className = 'premium-panel-close';
    closeEntry.textContent = '×';
    closeEntry.setAttribute('aria-label', 'Close sale form');
    entryTitle.appendChild(closeEntry);

    const formOverlay = d.createElement('div');
    formOverlay.className = 'premium-form-overlay';
    d.body.appendChild(formOverlay);
    saleEntryPanel.classList.add('premium-entry-drawer');
    d.body.appendChild(saleEntryPanel);

    const performanceGrid = d.createElement('section');
    performanceGrid.className = 'premium-performance-grid';
    const performanceMain = d.createElement('div');
    performanceMain.className = 'premium-performance-main';
    teamView.querySelector('.sl').textContent = 'Selected-Day Team Performance';
    spView.querySelector('.sl').textContent = 'Selected-Day Salesperson Ranking';
    leaderboardPanel.classList.add('premium-leaderboard-panel');
    performanceMain.append(teamView, spView, productView);
    performanceGrid.append(performanceMain, leaderboardPanel);
    performanceTabs.after(performanceGrid);
    if (legacyBottomGrid && legacyBottomGrid.children.length === 0) legacyBottomGrid.remove();

    function openEntry() {
      if (d.getElementById('dayLabel')?.textContent.trim() !== 'TODAY' && typeof w.jumpToToday === 'function') {
        w.jumpToToday();
      }
      tabsByPage.get('dashboard').click();
      d.body.classList.add('premium-form-open');
    }

    function closeEntryForm() {
      d.body.classList.remove('premium-form-open');
    }

    pageHead.querySelector('.premium-quick-add').addEventListener('click', openEntry);
    pageHead.querySelectorAll('[data-go]').forEach((button) => {
      button.addEventListener('click', () => tabsByPage.get(button.dataset.go)?.click());
    });
    closeEntry.addEventListener('click', closeEntryForm);
    formOverlay.addEventListener('click', closeEntryForm);

    const mobileLabels = {
      dashboard: 'Dashboard',
      activity: 'Activity',
      salespeople: 'People',
      mysales: 'My Sales',
      monthly: 'Recap',
      insights: 'Insights',
      warning: 'Warning',
      admin: 'Admin'
    };

    originalTabs.forEach((tab, index) => {
      const originalLabel = originalLabels.get(tab.dataset.page);
      const parts = originalLabel.split(/\s+/);
      const icon = parts.shift();
      tab.dataset.premiumIndex = String(index);
      tab.innerHTML = [
        '<b class="premium-nav-icon">', icon, '</b>',
        '<span class="premium-nav-label">', parts.join(' '), '</span>',
        '<span class="premium-mobile-label">', mobileLabels[tab.dataset.page], '</span>'
      ].join('');
    });

    const spacer = d.createElement('span');
    spacer.className = 'premium-nav-spacer';
    nav.appendChild(spacer);

    const addFab = d.createElement('button');
    addFab.type = 'button';
    addFab.className = 'premium-add-fab';
    addFab.innerHTML = '<b>＋</b><small>Sale</small>';
    addFab.setAttribute('aria-label', 'Log a sale');
    addFab.addEventListener('click', openEntry);
    nav.appendChild(addFab);

    const more = d.createElement('button');
    more.type = 'button';
    more.className = 'nav-tab premium-more-tab';
    more.innerHTML = '<b>•••</b><span>More</span>';
    more.setAttribute('aria-expanded', 'false');
    nav.appendChild(more);

    const moreOverlay = d.createElement('div');
    moreOverlay.className = 'premium-more-overlay';
    const moreSheet = d.createElement('section');
    moreSheet.className = 'premium-more-sheet';
    moreSheet.setAttribute('aria-label', 'More navigation');
    moreSheet.innerHTML = [
      '<div class="premium-sheet-handle"></div>',
      '<div class="premium-sheet-title">',
      '<div><span>MORE</span><h3>Explore Hurricane XCS</h3></div>',
      '<button type="button" aria-label="Close more navigation">×</button>',
      '</div>',
      '<div class="premium-more-grid"></div>'
    ].join('');
    d.body.append(moreOverlay, moreSheet);

    const morePages = ['salespeople', 'mysales', 'insights', 'warning', 'admin'];
    const moreIcons = {salespeople: '👥', mysales: '🛍️', insights: '💡', warning: '⚠️', admin: '⚙️'};
    const moreButtons = [];
    const moreGrid = moreSheet.querySelector('.premium-more-grid');

    morePages.forEach((page) => {
      const button = d.createElement('button');
      button.type = 'button';
      button.dataset.page = page;
      button.innerHTML = '<i>' + moreIcons[page] + '</i><span>' + originalLabels.get(page).replace(/^\S+\s*/, '') + '</span>';
      button.addEventListener('click', () => {
        tabsByPage.get(page)?.click();
        closeMore();
      });
      moreButtons.push(button);
      moreGrid.appendChild(button);
    });

    function openMore() {
      d.body.classList.add('premium-more-open');
      more.setAttribute('aria-expanded', 'true');
    }

    function closeMore() {
      d.body.classList.remove('premium-more-open');
      more.setAttribute('aria-expanded', 'false');
    }

    more.addEventListener('click', openMore);
    moreOverlay.addEventListener('click', closeMore);
    moreSheet.querySelector('.premium-sheet-title button').addEventListener('click', closeMore);

    function syncPremium() {
      const pct = d.getElementById('goalPct')?.textContent || '0%';
      const closes = d.getElementById('K1')?.textContent || '0';
      const day = d.getElementById('dayLabel')?.textContent.trim() || 'TODAY';
      const revenue = d.getElementById('K2')?.textContent.trim() || '0';
      const firstTeam = d.querySelector('#tTeam tr .tn');

      d.getElementById('premiumPace').textContent = pct;
      d.getElementById('premiumCloses').textContent = closes + ' closes';
      d.getElementById('premiumSelectedDay').textContent = day === 'TODAY' ? 'Today' : day;
      d.getElementById('premiumHeading').textContent = day === 'TODAY' ? 'Today’s performance' : day + ' performance';
      d.getElementById('premiumTopTeam').textContent = (revenue === '0' || revenue === 'Rp 0')
        ? 'No sales yet'
        : (firstTeam?.textContent?.trim() || '—');

      const activePage = originalTabs.find((tab) => tab.classList.contains('active'))?.dataset.page;
      more.classList.toggle('active', morePages.includes(activePage));
      moreButtons.forEach((button) => button.classList.toggle('active', button.dataset.page === activePage));
    }

    function handlePageChange() {
      d.body.classList.add('premium-page-changing');
      w.scrollTo({top: 0, behavior: 'smooth'});
      syncPremium();
      w.setTimeout(() => d.body.classList.remove('premium-page-changing'), 280);
    }

    originalTabs.forEach((tab) => tab.addEventListener('click', handlePageChange));
    const syncSources = ['goalPct', 'K1', 'K2', 'dayLabel', 'tTeam']
      .map((id) => d.getElementById(id))
      .filter(Boolean);
    const statusObserver = new MutationObserver(syncPremium);
    syncSources.forEach((node) => statusObserver.observe(node, {
      childList: true,
      subtree: true,
      characterData: true
    }));
    w.setInterval(syncPremium, 10000);
    syncPremium();

    function centerSelectedHistoryDay() {
      const active = historyStrip.querySelector('.active-day');
      if (!active) return;
      historyStrip.scrollTo({
        left: active.offsetLeft - (historyStrip.clientWidth - active.offsetWidth) / 2,
        behavior: 'smooth'
      });
    }

    if (typeof w.renderHist === 'function') {
      const originalRenderHist = w.renderHist;
      w.renderHist = function () {
        const result = originalRenderHist.apply(this, arguments);
        w.setTimeout(centerSelectedHistoryDay, 80);
        return result;
      };
    }
    w.setTimeout(centerSelectedHistoryDay, 500);

    d.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeEntryForm();
        closeMore();
      }
    });

    const monthly = d.querySelector('#page-monthly .container');
    const monthlyHero = d.getElementById('monthlyOmsetHero');
    const monthlyControlRow = d.getElementById('monthlyControlRow');
    const monthControl = monthlyControlRow?.querySelector('.day-switcher');

    if (monthly && monthlyHero && monthlyControlRow && monthControl) {
      monthlyHero.classList.add('premium-monthly-hero');
      const monthlyHead = d.createElement('section');
      monthlyHead.className = 'premium-monthly-head';
      monthlyHead.innerHTML = [
        '<div>',
        '<div class="premium-kicker">MONTHLY PERFORMANCE</div>',
        '<h1>Monthly recap</h1>',
        '<p>Review revenue, activity, products, teams, and individual results.</p>',
        '</div>'
      ].join('');
      monthlyHead.appendChild(monthControl);
      monthlyHero.before(monthlyHead);
      monthlyControlRow.remove();
    }

    d.documentElement.dataset.premiumUiReady = 'true';
  }

  if (document.readyState === 'complete') initPremiumUI();
  else window.addEventListener('load', initPremiumUI, {once: true});
})();
