/* Arus Money: personal finance tracker with BCA email auto sync.
   All data lives in this browser (localStorage). BCA emails arrive through the user's own
   Google Apps Script (apps-script/Code.gs); parsing happens here via BcaParser.
   Wallet balances can be loaded once from a link hash (#import=...), which never reaches a server. */
(function () {
  'use strict';

  var KEY = 'arus_v1';
  var $ = function (id) { return document.getElementById(id); };

  // ---------- defaults ----------
  // [id, name, icon, type, parent, flow]  type: expense | income | debt (flow in/out for debt)
  var DEFAULT_CATS = [
    ['food', 'Food & Beverage', '🍖', 'expense'],
    ['bills', 'Bills & Utilities', '🧾', 'expense'], ['phone_bill', 'Phone Bill', '📞', 'expense', 'bills'], ['gas_bill', 'Gas Bill', '🔥', 'expense', 'bills'],
    ['internet_bill', 'Internet Bill', '🌐', 'expense', 'bills'], ['personal_expense', 'PERSONAL EXPENSE', '🍿', 'expense', 'bills'],
    ['shopping', 'Shopping', '🧺', 'expense'], ['personal_items', 'Personal Items', '📱', 'expense', 'shopping'],
    ['health', 'Health & Fitness', '🩺', 'expense'], ['tennis', 'TENNIS', '🎾', 'expense', 'health'],
    ['education', 'Education', '🎓', 'expense'],
    ['fun', 'Entertainment', '🎮', 'expense'], ['streaming', 'Streaming Service', '📺', 'expense', 'fun'], ['fun_money', 'Fun Money', '🎉', 'expense', 'fun'],
    ['insurance', 'Insurances', '🛡', 'expense'],
    ['investment', 'Investment', '📊', 'expense'], ['digital_assets', 'DIGITAL ASSETS', '🪙', 'expense', 'investment'], ['bitget', 'BITGET', '🚀', 'expense', 'investment'],
    ['ajaib_kripto', 'AJAIB KRIPTO', '💰', 'expense', 'investment'], ['pluang', 'PLUANG', '💶', 'expense', 'investment'], ['ajaib_essa', 'AJAIB ESSA', '💹', 'expense', 'investment'],
    ['bybit', 'BYBIT', '🎯', 'expense', 'investment'], ['stocks', 'STOCKS', '📈', 'expense', 'investment'], ['ethereum', 'ETHERIUM', '💎', 'expense', 'investment'],
    ['gold_inv', 'GOLD', '🥇', 'expense', 'investment'], ['louis_hugo', 'LOUIS AND HUGO', '👔', 'expense', 'investment'], ['bren', 'BREN', '💵', 'expense', 'investment'],
    ['usd', 'USD', '🧧', 'expense', 'investment'], ['pokemon', 'Pokemon', '👾', 'expense', 'investment'],
    ['other_out', 'Other Expense', '📦', 'expense'], ['transfer_out', 'Outgoing transfer', '📤', 'expense'], ['pay_interest', 'Pay Interest', '🧮', 'expense'],
    ['uncat', 'Uncategorized', '❔', 'expense'], ['makan_team', 'MAKAN SAMA TEAM', '🍩', 'expense'], ['iklan_tokped', 'IKLAN TOKOPEDIA', '📢', 'expense'],
    ['giving', 'PERSEMBAHAN AND PERPULUHAN', '⛪', 'expense'], ['spending', 'SPENDING', '🏅', 'expense'], ['kasih', 'KASIH KE ORANG SUSAH', '💝', 'expense'],
    ['balance_adj', 'BALANCE', '⚖', 'expense'], ['utang', 'UTANG', '🃏', 'expense'], ['komisi_out', 'KOMISI', '💰', 'expense'],
    ['kas_kantor', 'Uang kas kantor', '🏢', 'expense'], ['berkati_ortu', 'BERKATI ORANG TUA', '💐', 'expense'],
    ['sharss', 'SHARSS ❤️❤️', '❤', 'expense'], ['branding', 'PERSONAL BRANDING', '📸', 'expense'], ['project', 'PROJECT', '🏗', 'expense'],
    ['gifts', 'GIFTS 🍾', '🍾', 'expense'], ['to_reserve', 'TRANSFER TO RESERVE', '♟', 'expense'], ['bi', 'BI', '🏆', 'expense'],
    ['gold_debit', 'GOLD DEBIT CARD', '💳', 'expense'], ['korea_loan', 'Korea loan', '✈', 'expense'], ['wedding', 'WEDDING AND PROPOSAL', '💍', 'expense'],
    ['shanghai', 'Shanghai', '🛶', 'expense'], ['dvn', 'DVN', '🌀', 'expense'], ['my_home', 'MY HOME', '🏠', 'expense'],
    ['salary', 'Salary', '💼', 'income'], ['bonus', 'Bonus', '🎁', 'income'], ['interest', 'Collect Interest', '📈', 'income'],
    ['transfer_in', 'Incoming transfer', '↙', 'income'], ['other_in', 'Other Income', '💰', 'income'],
    ['debt', 'Debt', '📥', 'debt', '', 'in'], ['loan', 'Loan', '💸', 'debt', '', 'out'],
    ['debt_collection', 'Debt Collection', '🪙', 'debt', '', 'in'], ['repayment', 'Repayment', '🧾', 'debt', '', 'out']
  ];
  var CAT_VER = 2;
  var CAT_MAP = { transport: 'other_out', phone: 'phone_bill', family: 'my_home', loan_out: 'loan' };
  var OLD_DEFAULT_IDS = ['food', 'transport', 'shopping', 'bills', 'phone', 'health', 'fun', 'family', 'giving', 'education', 'loan_out', 'transfer_out', 'other_out', 'salary', 'bonus', 'interest', 'transfer_in', 'other_in'];
  var DEFAULT_RULES = [
    ['kopi', 'food'], ['coffee', 'food'], ['resto', 'food'], ['mcd', 'food'], ['kfc', 'food'], ['gofood', 'food'], ['grabfood', 'food'], ['shopeefood', 'food'],
    ['gojek', 'other_out'], ['grab', 'other_out'], ['pertamina', 'other_out'], ['shell', 'other_out'], ['parkir', 'other_out'],
    ['tokopedia', 'shopping'], ['shopee', 'shopping'], ['lazada', 'shopping'], ['indomaret', 'shopping'], ['alfamart', 'shopping'],
    ['pln', 'bills'], ['pdam', 'bills'], ['pgn', 'gas_bill'], ['bpjs', 'insurance'], ['apotek', 'health'], ['telkomsel', 'phone_bill'], ['indosat', 'phone_bill'], ['indihome', 'internet_bill'], ['biznet', 'internet_bill'],
    ['netflix', 'streaming'], ['spotify', 'streaming'], ['youtube', 'streaming'], ['gereja', 'giving'], ['church', 'giving'], ['persembahan', 'giving'], ['perpuluhan', 'giving'],
    ['bitget', 'bitget'], ['bybit', 'bybit'], ['pluang', 'pluang'], ['ajaib', 'ajaib_kripto']
  ];
  // Fluent Emoji 3D (Microsoft, MIT license), stored in img/3d as webp. Emoji -> file name.
  var ICONS = {"🍜":"steaming-bowl","🛵":"motor-scooter","🛍":"shopping-bags","💡":"light-bulb","📱":"mobile-phone","💊":"pill","🎬":"clapper-board","🏡":"house-with-garden","📚":"books","💸":"money-with-wings","📦":"package","💼":"briefcase","🎁":"wrapped-gift","📈":"chart-increasing","💰":"money-bag","🔁":"repeat-button","❔":"white-question-mark","🏦":"bank","💵":"dollar-banknote","🍿":"popcorn","🪙":"coin","🚙":"sport-utility-vehicle","⌚":"watch","💹":"chart-increasing-with-yen","📊":"bar-chart","🥇":"1st-place-medal","👛":"purse","🌐":"globe-with-meridians","🏷":"label","🐷":"pig-face","🌱":"seedling","🧾":"receipt","👁":"eye","🎨":"artist-palette","💳":"credit-card","📅":"calendar","🔐":"locked-with-key","🧮":"abacus","⏰":"alarm-clock","🏠":"house","🚗":"automobile","✈":"airplane","🍔":"hamburger","☕":"hot-beverage","🛒":"shopping-cart","💄":"lipstick","🐶":"dog-face","🎮":"video-game","⛽":"fuel-pump","🎓":"graduation-cap","🏥":"hospital","💍":"ring","🎉":"party-popper","🍀":"four-leaf-clover","💎":"gem-stone","🧧":"red-envelope","🏆":"trophy","🧳":"luggage","💻":"laptop","⛪":"church","🔄":"counterclockwise-arrows-button","🗂":"card-index-dividers","🛡":"shield","⭐":"star","🍎":"red-apple","🧸":"teddy-bear","🏍":"motorcycle","🏢":"office-building","📉":"chart-decreasing","↗":"up-right-arrow","↙":"down-left-arrow","👕":"t-shirt","🎯":"bullseye","❤":"red-heart","🏙":"cityscape","🐵":"monkey-face","♟":"chess-pawn","🏀":"basketball","🍖":"meat-on-bone","📞":"telephone-receiver","🔥":"fire","🧺":"basket","🩺":"stethoscope","🎾":"tennis","📺":"television","💶":"euro-banknote","👔":"necktie","👾":"alien-monster","📤":"outbox-tray","📥":"inbox-tray","🍩":"doughnut","📢":"loudspeaker","🏅":"sports-medal","💝":"heart-with-ribbon","⚖":"balance-scale","🃏":"joker","💐":"bouquet","📸":"camera-with-flash","🏗":"building-construction","🍾":"bottle-with-popping-cork","🛶":"canoe","🌀":"cyclone","🚀":"rocket"};
  function key3d(e) { return String(e || '').replace(/\uFE0F/g, ''); }
  function img3d(e, cls) { var f = ICONS[key3d(e)]; return f ? '<img class="' + (cls || 'i3') + '" src="img/3d/' + f + '.webp" alt="" decoding="async">' : esc(e); }
  var PALETTE = ['#3fb27f', '#e8833a', '#4f7cff', '#d9a520', '#8e5bd6', '#e05d6f', '#2fb5c9', '#5f6b7a', '#c2553b', '#2e8f6b'];

  function mkCat(c) { var o = { id: c[0], name: c[1], icon: c[2], type: c[3] }; if (c[4]) o.parent = c[4]; if (c[5]) o.flow = c[5]; return o; }
  function blank() {
    return {
      wallets: [{ id: 'bca', name: 'BCA', icon: '🏦', initial: 0 }, { id: 'cash', name: 'Cash', icon: '💵', initial: 0 }],
      cats: DEFAULT_CATS.map(mkCat), catVer: CAT_VER,
      tx: [], budgets: {},
      rules: DEFAULT_RULES.map(function (r) { return { kw: r[0], cat: r[1] }; }),
      settings: { syncUrl: '', token: '', autoSync: true, bcaWallet: 'bca', lastSync: 0, startFrom: 0, hide: false, theme: 'dark' },
      seen: {}, review: []
    };
  }

  // ---------- storage ----------
  var S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    var d = blank();
    if (!S || typeof S !== 'object') S = d;
    Object.keys(d).forEach(function (k) { if (S[k] == null && k !== 'catVer') S[k] = d[k]; });
    Object.keys(d.settings).forEach(function (k) { if (S.settings[k] == null) S.settings[k] = d.settings[k]; });
    // New default categories added in later versions.
    if ((S.catVer || 1) < CAT_VER) {
      // Switch to the full category list; keep categories the user made themselves.
      var mine = S.cats.filter(function (c) { return OLD_DEFAULT_IDS.indexOf(c.id) === -1 && !DEFAULT_CATS.some(function (x) { return x[0] === c.id; }); });
      S.cats = DEFAULT_CATS.map(mkCat).concat(mine);
      var ok = function (id) { return S.cats.some(function (c) { return c.id === id; }); };
      S.tx.forEach(function (t) {
        if (t.cat === 'loan_out') { t.type = 'debt'; t.cat = 'loan'; return; }
        if (CAT_MAP[t.cat]) t.cat = CAT_MAP[t.cat];
        if (t.cat && !ok(t.cat)) t.cat = t.type === 'income' ? 'other_in' : 'other_out';
      });
      Object.keys(S.budgets).forEach(function (k) { var n = CAT_MAP[k] || k; var v = S.budgets[k]; delete S.budgets[k]; if (ok(n)) S.budgets[n] = v; });
      S.rules = DEFAULT_RULES.map(function (r) { return { kw: r[0], cat: r[1] }; }).concat(S.rules.filter(function (r) { return !DEFAULT_RULES.some(function (d) { return d[0] === r.kw; }) && ok(r.cat); }));
      S.catVer = CAT_VER;
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Could not save. Storage full or blocked.'); }
  }

  // ---------- helpers ----------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.abs(Math.round(n)).toLocaleString('en-US'); }
  var MASK = '••••••••';
  // Money text that respects "Hide amounts". sign: true shows +/−.
  function money(n, opt) {
    opt = opt || {};
    if (S.settings.hide) return '<span class="masked">' + (opt.rp === false ? '' : 'Rp ') + MASK + '</span>';
    var s = (opt.rp === false ? '' : 'Rp ') + fmt(n);
    if (opt.sign && n > 0) s = '+' + s;
    if (n < 0) s = '−' + s;
    return s;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function cat(id) { return S.cats.filter(function (c) { return c.id === id; })[0] || { id: id, name: 'Uncategorized', icon: '❔', type: 'expense' }; }
  function wallet(id) { return S.wallets.filter(function (w) { return w.id === id; })[0] || { id: id, name: '(deleted wallet)', icon: '❔', initial: 0 }; }
  function parseNum(v) { return parseInt(String(v || '').replace(/[^\d]/g, ''), 10) || 0; }
  function color(id) { var h = 0; String(id).split('').forEach(function (ch) { h = (h * 31 + ch.charCodeAt(0)) >>> 0; }); return PALETTE[h % PALETTE.length]; }
  function icon(obj, cls) { var has = !!ICONS[key3d(obj.icon)]; return '<span class="ic ' + (cls || '') + (has ? ' i3d' : '') + '" style="--c:' + (obj.color || color(obj.id)) + '">' + img3d(obj.icon) + '</span>'; }
  function picker(cur) { return '<div class="icon-pick">' + Object.keys(ICONS).map(function (e) { return '<button type="button" data-e="' + e + '" class="' + (key3d(cur) === e ? 'on' : '') + '">' + img3d(e) + '</button>'; }).join('') + '</div>'; }
  function bindPicker(root, input, preview) { root.querySelector('.icon-pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; input.value = b.dataset.e; root.querySelectorAll('.icon-pick button').forEach(function (x) { x.classList.toggle('on', x === b); }); if (preview) preview(); haptic(); }); }
  function included(w) { return !w.excluded; }
  function fmtInput(el) { el.addEventListener('input', function () { var n = parseNum(el.value); el.value = n ? n.toLocaleString('en-US') : ''; }); }

  // Wallet groups for the summary cards. A wallet can pick one; otherwise its name decides.
  var GROUPS = {
    cash: { name: 'Cash & Bank', icon: '🏦', sub: 'Everyday money' },
    savings: { name: 'Savings', icon: '🐷', sub: 'Steady reserve' },
    invest: { name: 'Investments', icon: '📈', sub: 'Track your wealth growth' }
  };
  function groupOf(w) {
    if (w.group && GROUPS[w.group]) return w.group;
    if (/invest|stock|saham|ajaib|bibit|reksa|crypto|gold|emas|puter|rolex|jimney|daytona|properti/i.test(w.name)) return 'invest';
    if (/reserve|saving|tabungan|deposito|dana darurat|emergency/i.test(w.name)) return 'savings';
    return 'cash';
  }
  function short(n) {
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(/\.0$/, '') + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(Math.round(n));
  }
  function applyTheme() {
    var light = S.settings.theme === 'light';
    if (light) document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', light ? '#f3f5f1' : '#000000');
    document.querySelectorAll('#themeSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === (light ? 'light' : 'dark')); });
  }

  var toastT;
  function toast(msg) {
    var t = $('toast'); t.hidden = true; void t.offsetWidth; t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2800);
  }
  function haptic() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }

  // ---------- state ----------
  var cur = new Date(); cur.setDate(1);
  var walletSel = 'all';
  var repKind = 'expense';
  var view = 'v-home';
  var cfMonths = 6, cfSel = null, catTab = 'expense';

  // Effect of one transaction on one wallet.
  function flowIn(t) { return t.type === 'income' || (t.type === 'debt' && cat(t.cat).flow === 'in'); }
  function isFlow(t) { return t.type === 'income' || t.type === 'expense'; }
  function delta(t, w) {
    if (t.type === 'income' || t.type === 'expense' || t.type === 'debt') return t.wallet === w ? (flowIn(t) ? t.amount : -t.amount) : 0;
    if (t.type === 'transfer') return (t.toWallet === w ? t.amount : 0) - (t.wallet === w ? t.amount : 0);
    return 0;
  }
  function walletIds(w) { return w === 'all' ? S.wallets.filter(included).map(function (x) { return x.id; }) : [w]; }
  function deltaSel(t, w) { return walletIds(w).reduce(function (a, id) { return a + delta(t, id); }, 0); }
  // Balance of a wallet (or the total) counting only transactions dated before `before` (yyyy-mm-dd), or all.
  function balance(w, before) {
    var ids = walletIds(w);
    var init = S.wallets.reduce(function (a, x) { return a + (ids.indexOf(x.id) !== -1 ? (+x.initial || 0) : 0); }, 0);
    return S.tx.reduce(function (a, t) { return (before && t.date >= before) ? a : a + deltaSel(t, w); }, init);
  }
  function touches(t, w) { var ids = walletIds(w); return ids.indexOf(t.wallet) !== -1 || ids.indexOf(t.toWallet) !== -1; }
  function txIn(month, w) { return S.tx.filter(function (t) { return t.date.slice(0, 7) === month && touches(t, w); }); }
  function inOut(list, w) {
    var tin = 0, tout = 0;
    list.forEach(function (t) {
      if (t.type === 'transfer') { var d = deltaSel(t, w); if (d > 0) tin += d; else tout -= d; }
      else { var d2 = deltaSel(t, w); if (d2 > 0) tin += d2; else tout -= d2; }
    });
    return { tin: tin, tout: tout };
  }
  function nextMonthStart(d) { var n = new Date(d.getFullYear(), d.getMonth() + 1, 1); return ymd(n); }

  // Rolling digits: each digit spins on its own column, overshoots, then settles.
  var RS = {}, DH = 1.15, COL = (function () { var s = ''; for (var k = 0; k < 30; k++) s += '<span>' + (k % 10) + '</span>'; return s; })();
  function ty(k) { return 'translateY(' + (-k * DH).toFixed(3) + 'em)'; }
  function rollTo(el, n, opt, key) {
    key = key || el.id; opt = opt || {};
    if (S.settings.hide) { el.innerHTML = money(n, opt); RS[key] = null; el.removeAttribute('data-sig'); return; }
    var text = money(n, opt), sig = text.replace(/\d/g, '0');
    var digits = text.replace(/\D/g, '').split('').map(Number);
    var st = RS[key], cols = el.querySelectorAll('.dg-col');
    var spinAll = !st || st.sig !== sig, from;
    if (!cols.length || el.dataset.sig !== sig) {
      el.innerHTML = text.split('').map(function (c) { return /\d/.test(c) ? '<span class="dg"><span class="dg-col">' + COL + '</span></span>' : '<span class="dg-s' + (/[Rp]/.test(c) ? ' cur' : '') + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>'; }).join('');
      el.dataset.sig = sig; cols = el.querySelectorAll('.dg-col');
      from = (!spinAll) ? st.digits : digits.map(function () { return 0; });
      cols.forEach(function (c, i) { c.style.transition = 'none'; c.style.transform = ty(10 + from[i]); });
      void el.offsetWidth;
    } else from = st ? st.digits : digits.map(function () { return 0; });
    var dir = (!st || spinAll) ? 1 : (n >= st.v ? 1 : -1);
    RS[key] = { sig: sig, digits: digits, v: n };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { cols.forEach(function (c, i) { c.style.transition = 'none'; c.style.transform = ty(10 + digits[i]); }); return; }
    var tok = (el._tok || 0) + 1, end = 0, moved = false; el._tok = tok;
    cols.forEach(function (c, i) {
      var o = from[i], d = digits[i], t;
      if (o === d && !spinAll) { c.style.transition = 'none'; c.style.transform = ty(10 + d); c._fin = null; return; }
      if (dir > 0) t = (d > o && !spinAll) ? 10 + d : 20 + d; else t = d < o ? 10 + d : d;
      var delay = i * 45, dur = 850 + Math.abs(t - (10 + o)) * 28;
      c.style.transition = 'transform ' + dur + 'ms cubic-bezier(.18,1.3,.32,1) ' + delay + 'ms';
      c.style.transform = ty(t); c._fin = 10 + d; moved = true;
      end = Math.max(end, delay + dur);
    });
    setTimeout(function () { if (el._tok !== tok) return; cols.forEach(function (c) { if (c._fin != null) { c.style.transition = 'none'; c.style.transform = ty(c._fin); c._fin = null; } }); }, end + 40);
    if (st && !spinAll && moved) { el.classList.remove('flash-up', 'flash-down'); void el.offsetWidth; el.classList.add(dir > 0 ? 'flash-up' : 'flash-down'); }
  }
  function setMoney(el, n, opt) { rollTo(el, n, opt); }
  // ---------- render ----------
  function renderAll() {
    applyTheme(); renderEye();
    renderHome(); renderTx(); renderBudgets(); renderReport(); renderAccount();
  }

  var EYE_OPEN = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.5 7.5A17 17 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function renderEye() { $('eyeBtn').innerHTML = S.settings.hide ? EYE_OFF : EYE_OPEN; $('hideToggle').checked = !!S.settings.hide; }

  function renderHome() {
    var total = balance('all');
    setMoney($('hTotal'), total);
    var hr = new Date().getHours();
    $('hGreet').textContent = (hr < 11 ? 'Good morning' : hr < 15 ? 'Good afternoon' : hr < 19 ? 'Good evening' : 'Good night') + '. Here is your money today.';
    var mStart = ym(new Date()) + '-01', open0 = balance('all', mStart), chg = total - open0;
    var chip = $('hChip');
    if (open0 > 0 && chg !== 0) { var pc = chg / open0 * 100; chip.hidden = false; chip.className = 'chip' + (chg < 0 ? ' dn' : ''); chip.textContent = (chg > 0 ? '+' : '−') + Math.abs(pc).toFixed(Math.abs(pc) < 10 ? 1 : 0) + '% ' + (chg > 0 ? '↑' : '↓'); }
    else chip.hidden = true;

    var gt = {}; S.wallets.filter(included).forEach(function (w) { var g = groupOf(w); gt[g] = (gt[g] || 0) + balance(w.id); });
    $('hGroups').innerHTML = Object.keys(GROUPS).filter(function (g) { return g in gt; }).map(function (g, i) {
      var G = GROUPS[g], share = total ? Math.round(gt[g] / total * 100) : 0;
      return '<div class="sum-card g-' + g + '" style="--i:' + i + '"><div class="sum-top"><span class="sum-ico">' + img3d(G.icon) + '</span><span><b>' + G.name + '</b><small>' + G.sub + '</small></span></div>' +
        '<div class="sum-amt"><span class="mid-money" data-roll="g_' + g + '" data-v="' + gt[g] + '"></span><span class="chip soft">' + share + '% of total</span></div>' +
        '<button class="sum-foot" data-group="' + g + '"><span>View wallets</span><span>→</span></button></div>';
    }).join('');
    $('hGroups').querySelectorAll('[data-roll]').forEach(function (el) { rollTo(el, +el.dataset.v, {}, el.dataset.roll); });
    renderCashflow(); renderDonut();
    var ws = S.wallets.slice().sort(function (a, b) { return balance(b.id) - balance(a.id); }).slice(0, 3);
    $('hWallets').innerHTML = ws.map(function (w) {
      return '<button class="w-row" data-wallet="' + esc(w.id) + '">' + icon(w) + '<span class="grow">' + esc(w.name) + '</span><span class="amt">' + money(balance(w.id)) + '</span></button>';
    }).join('');

    var now = new Date(), m = ym(now), mt = txIn(m, 'all');
    var io = inOut(mt.filter(isFlow), 'all');
    var day = now.getDate();
    setMoney($('hAvg'), io.tout / day, { rp: false });
    $('hSpentLine').innerHTML = 'Spent ' + money(io.tout) + ' so far';
    // Compare with the same days of last month.
    var lm = new Date(now.getFullYear(), now.getMonth() - 1, 1), lmKey = ym(lm), lastSame = 0;
    S.tx.forEach(function (t) { if (t.type === 'expense' && t.date.slice(0, 7) === lmKey && +t.date.slice(8, 10) <= day && touches(t, 'all')) lastSame += t.amount; });
    var ring = $('hRing'), pct = 0, cap;
    if (lastSame > 0) {
      pct = Math.round(Math.abs(io.tout - lastSame) / lastSame * 100);
      cap = io.tout <= lastSame ? 'Lower than last month' : 'Higher than last month';
      ring.classList.toggle('up', io.tout > lastSame);
    } else { cap = io.tout ? 'No data for last month' : 'No spending yet'; ring.classList.remove('up'); }
    $('hRingTxt').textContent = pct + '%';
    $('hRingCap').textContent = cap;
    requestAnimationFrame(function () { ring.style.strokeDashoffset = (113.1 * (1 - Math.min(100, pct) / 100)).toFixed(1); });

    setMoney($('hSpent'), io.tout, { rp: false });
    setMoney($('hIncome'), io.tin, { rp: false });
    var tot = io.tout + io.tin;
    requestAnimationFrame(function () {
      $('hBarOut').style.width = tot ? (io.tout / tot * 100) + '%' : '0';
      $('hBarIn').style.width = tot ? (io.tin / tot * 100) + '%' : '0';
    });

    var recent = S.tx.slice().sort(function (a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || b.created - a.created; }).slice(0, 5);
    $('hRecent').innerHTML = recent.length ? '<div class="stagger">' + recent.map(function (t, i) { return txRow(t, i, true); }).join('') + '</div>'
      : '<div class="empty"><span class="big-e">' + img3d('🌱') + '</span>No transactions yet.<br>Tap + or wait for your next BCA payment.</div>';

    var pip = $('hSyncPip');
    pip.hidden = !S.review.length; pip.textContent = S.review.length;
  }

  // Spending donut: top category neon, second yellow, the rest striped.
  function renderDonut() {
    var m = ym(new Date()), sums = {}, total = 0;
    S.tx.forEach(function (t) { if (t.type === 'expense' && t.date.slice(0, 7) === m && touches(t, 'all')) { sums[t.cat] = (sums[t.cat] || 0) + t.amount; total += t.amount; } });
    var ids = Object.keys(sums).sort(function (a, b) { return sums[b] - sums[a]; });
    var segs = ids.slice(0, 2).map(function (id) { return { id: id, v: sums[id] }; });
    var rest = ids.slice(2).reduce(function (a, id) { return a + sums[id]; }, 0);
    if (rest) segs.push({ id: '_other', v: rest });
    var svg = $('donutSvg'), R = 58, C = 2 * Math.PI * R, GAP = segs.length > 1 ? 16 : 0;
    var html = '<circle cx="80" cy="80" r="' + R + '" class="d-track"/>', off = 0;
    var fills = ['var(--d1)', 'var(--d2)', 'url(#hatch)'];
    segs.forEach(function (s, i) {
      var len = Math.max(0, s.v / total * C - GAP);
      var fill = s.id === '_other' ? fills[2] : fills[i];
      html += '<circle cx="80" cy="80" r="' + R + '" class="d-seg' + (s.id === '_other' ? ' hatch' : '') + '" style="stroke:' + fill + ';--len:' + len.toFixed(1) + ';--off:' + (-off).toFixed(1) + ';--i:' + i + '" stroke-dasharray="0 ' + C.toFixed(1) + '"/>';
      off += s.v / total * C;
    });
    if (!segs.length) html += '<circle cx="80" cy="80" r="' + R + '" class="d-seg hatch" style="stroke:url(#hatch);--len:' + C.toFixed(1) + ';--off:0;--i:0" stroke-dasharray="0 ' + C.toFixed(1) + '"/>';
    svg.innerHTML = svg.querySelector('defs').outerHTML + html;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      svg.querySelectorAll('.d-seg').forEach(function (c) { var cs = c.style; c.setAttribute('stroke-dasharray', cs.getPropertyValue('--len') + ' ' + C.toFixed(1)); c.setAttribute('stroke-dashoffset', cs.getPropertyValue('--off')); });
    }); });
    $('donutPct').textContent = segs.length ? Math.round(segs[0].v / total * 100) + '%' : '0%';
    $('donutCap').textContent = segs.length ? cat(segs[0].id).name : 'No spending yet';
    $('donutLegend').innerHTML = segs.map(function (s, i) {
      var name = s.id === '_other' ? 'Other' : cat(s.id).name;
      return '<span class="lg"><i class="lg-dot ' + (s.id === '_other' ? 'hatch' : 'd' + (i + 1)) + '"></i>' + esc(name) + ' <b>' + money(s.v, { rp: false }) + '</b></span>';
    }).join('');
  }

  function renderCashflow(still) {
    var now = new Date(), months = [];
    for (var k = cfMonths - 1; k >= 0; k--) { var d = new Date(now.getFullYear(), now.getMonth() - k, 1); months.push({ key: ym(d), label: MONTHS[d.getMonth()].slice(0, 3), full: MONTHS[d.getMonth()] + ' ' + d.getFullYear(), tin: 0, tout: 0 }); }
    var idx = {}; months.forEach(function (m, i) { idx[m.key] = i; });
    S.tx.forEach(function (t) {
      var i = idx[t.date.slice(0, 7)]; if (i == null || !isFlow(t) || !touches(t, 'all')) return;
      if (t.type === 'income') months[i].tin += t.amount; else months[i].tout += t.amount;
    });
    var net = months.reduce(function (a, m) { return a + m.tin - m.tout; }, 0);
    rollTo($('cfNet'), net, { sign: true });
    $('cfNet').className = 'mid-money ' + (net > 0 ? 'pos' : net < 0 ? 'neg' : '');
    $('cfSub').textContent = 'Money in minus money out, last ' + (cfMonths === 12 ? '12 months' : cfMonths + ' months');
    document.querySelectorAll('#cfSeg button').forEach(function (b) { b.classList.toggle('on', +b.dataset.n === cfMonths); });
    var max = Math.max.apply(null, months.map(function (m) { return Math.max(m.tout, m.tin); })) || 1;
    if (cfSel == null || cfSel >= months.length) cfSel = months.length - 1;
    var ticks = [1, .75, .5, .25, 0].map(function (f) { return S.settings.hide ? '' : short(max * f); });
    $('cfChart').innerHTML = '<div class="cf-chart' + (still ? ' still' : '') + '"><div class="cf-y">' + ticks.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div><div class="cf-plot">' +
      months.map(function (m, i) {
        var v = Math.max(m.tout, m.tin), h = Math.max(v ? 4 : 2, v / max * 100);
        return '<button class="cf-bar' + (i === cfSel ? ' sel' : '') + '" data-i="' + i + '" style="--i:' + i + '" aria-label="' + m.full + '"><i style="height:' + h.toFixed(1) + '%;--top:' + (100 - h).toFixed(1) + '%"></i></button>';
      }).join('') + '</div></div><div class="cf-x">' + months.map(function (m, i) { return '<span class="' + (i === cfSel ? 'sel' : '') + '">' + (cfMonths === 12 ? m.label.slice(0, 1) : m.label) + '</span>'; }).join('') + '</div>';
    var m = months[cfSel], plot = $('cfChart').querySelector('.cf-plot'), bar = plot.children[cfSel];
    var tip = document.createElement('div'); tip.className = 'cf-tip';
    var nn = m.tin - m.tout;
    tip.innerHTML = '<div class="d">' + m.full + '</div><div class="r"><span>Money in</span><b>' + money(m.tin, { rp: false }) + '</b></div><div class="r"><span>Money out</span><b>' + money(m.tout, { rp: false }) + '</b></div><div class="r"><span>Net</span><b>' + money(nn, { sign: true, rp: false }) + '</b></div>';
    plot.appendChild(tip);
    var left = bar.offsetLeft + bar.offsetWidth / 2, pw = plot.offsetWidth, tw = tip.offsetWidth;
    left = Math.max(tw / 2, Math.min(pw - tw / 2, left));
    tip.style.left = left + 'px';
    // Sit just above the selected bar; may rise into the space above the plot.
    var barTop = bar.querySelector('i').offsetTop;
    tip.style.top = Math.max(-tip.offsetHeight + 4, barTop - tip.offsetHeight - 14) + 'px';
  }

  function renderTx() {
    var w = walletSel;
    if (w !== 'all' && !S.wallets.some(function (x) { return x.id === w; })) w = walletSel = 'all';
    var wo = w === 'all' ? { id: 'all', name: 'Total', icon: '🌐', color: '#2fb5c9' } : wallet(w);
    $('pillIc').outerHTML = icon(wo, 'sm').replace('<span ', '<span id="pillIc" ');
    $('pillName').textContent = wo.name;
    setMoney($('txBal'), balance(w));
    $('monthLabel').textContent = MONTHS[cur.getMonth()] + ' ' + cur.getFullYear();
    var mKey = ym(cur), open = balance(w, mKey + '-01'), end = balance(w, nextMonthStart(cur));
    $('pOpen').innerHTML = money(open);
    $('pEnd').innerHTML = money(end, { sign: true });
    rollTo($('pNet'), end - open, { sign: true });

    var mt = txIn(mKey, w);
    if (!mt.length) { $('txList').innerHTML = '<div class="card empty"><span class="big-e">' + img3d('🧾') + '</span>No transactions in ' + MONTHS[cur.getMonth()] + '.</div>'; return; }
    var byDay = {};
    mt.forEach(function (t) { (byDay[t.date] = byDay[t.date] || []).push(t); });
    var i = 0;
    $('txList').innerHTML = '<div class="stagger">' + Object.keys(byDay).sort().reverse().map(function (d) {
      var list = byDay[d].sort(function (a, b) { return (b.time || '').localeCompare(a.time || '') || b.created - a.created; });
      var net = list.reduce(function (a, t) { return a + deltaSel(t, w); }, 0);
      var dt = new Date(d + 'T00:00:00');
      return '<div class="day" style="--i:' + (i++) + '"><div class="day-h"><div class="dnum">' + dt.getDate() + '</div><div class="dmeta"><b>' + DOW[dt.getDay()] + '</b>' + MONTHS[dt.getMonth()] + ' ' + dt.getFullYear() + '</div><div class="dnet">' + money(net, { sign: true, rp: false }) + '</div></div>' +
        list.map(function (t) { return txRow(t, 0, false); }).join('') + '</div>';
    }).join('') + '</div>';
  }

  function txRow(t, i, showDate) {
    var c = t.type === 'transfer' ? { id: 'transfer', icon: '🔁', name: 'Transfer', color: '#5f6b7a' } : cat(t.cat);
    var sub = t.type === 'transfer' ? wallet(t.wallet).name + ' → ' + wallet(t.toWallet).name : (t.merchant || t.note || wallet(t.wallet).name);
    if (t.type !== 'transfer' && t.merchant && t.note) sub = t.merchant + ' · ' + t.note;
    if (showDate) { var d = new Date(t.date + 'T00:00:00'); sub = d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' · ' + sub; }
    else if (t.time) sub = t.time + ' · ' + sub;
    var cls = t.type === 'transfer' ? '' : flowIn(t) ? 'pos' : 'neg';
    return '<div class="tx" data-id="' + esc(t.id) + '" style="--i:' + i + '">' + icon(c) + '<div class="tx-main"><div class="tx-cat">' + esc(c.name) +
      (t.src === 'bca' ? '<span class="badge">BCA</span>' : '') + '</div><div class="tx-note">' + esc(sub) + '</div></div>' +
      '<div class="amt-col"><div class="amt ' + cls + '">' + money(t.amount, { rp: false }) + '</div><small>' + (t.type === 'income' ? 'Received' : t.type === 'expense' ? 'Spent' : t.type === 'debt' ? (flowIn(t) ? 'Money in' : 'Money out') : 'Moved') + '</small></div></div>';
  }

  function renderReport() {
    var mKey = ym(cur), mt = txIn(mKey, 'all').filter(isFlow);
    var io = inOut(mt, 'all'), net = io.tin - io.tout;
    $('repMonth').textContent = MONTHS[cur.getMonth()] + ' ' + cur.getFullYear();
    rollTo($('repNet'), net, { sign: true });
    $('repNet').className = 'mid-money ' + (net >= 0 ? 'pos' : 'neg');
    var now = new Date(), daysIn = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    var elapsed = ym(now) === mKey ? now.getDate() : daysIn;
    $('repAvg').innerHTML = 'Average spend ' + money(io.tout / Math.max(1, elapsed)) + ' per day';
    $('repSeg').classList.toggle('right', repKind === 'income');
    $('repSeg').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === repKind); });

    var sums = {}, total = 0;
    mt.forEach(function (t) { if (t.type === repKind) { sums[t.cat] = (sums[t.cat] || 0) + t.amount; total += t.amount; } });
    var rows = Object.keys(sums).sort(function (a, b) { return sums[b] - sums[a]; });
    var max = rows.length ? sums[rows[0]] : 1;
    $('repBars').innerHTML = rows.length ? rows.map(function (id) {
      var c = cat(id), pct = Math.round(sums[id] / total * 100);
      return '<div class="hbar"><div class="hbar-top"><span class="l">' + icon(c, 'sm') + esc(c.name) + '</span><span class="r">' + money(sums[id], { rp: false }) + ' · ' + pct + '%</span></div>' +
        '<div class="hbar-track"><div class="hbar-fill" data-w="' + (sums[id] / max * 100).toFixed(1) + '"></div></div></div>';
    }).join('') : '<div class="empty">Nothing yet this month.</div>';

    var daily = [];
    for (var i = 1; i <= daysIn; i++) daily.push(0);
    mt.forEach(function (t) { if (t.type === 'expense') daily[+t.date.slice(8, 10) - 1] += t.amount; });
    var dmax = Math.max.apply(null, daily) || 1;
    $('repDaily').innerHTML = '<div class="cols">' + daily.map(function (v, i) {
      return '<div class="col" tabindex="0" style="--i:' + i + ';height:' + Math.max(v ? 2 : 0, v / dmax * 100).toFixed(1) + '%" data-tip="' + (i + 1) + ' ' + MONTHS[cur.getMonth()].slice(0, 3) + ': ' + (S.settings.hide ? MASK : 'Rp ' + fmt(v)) + '"></div>';
    }).join('') + '</div><div class="col-axis"><span>1</span><span>' + Math.ceil(daysIn / 2) + '</span><span>' + daysIn + '</span></div>';
    growBars($('repBars'));
  }
  function growBars(root) {
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      root.querySelectorAll('[data-w]').forEach(function (el) { el.style.width = el.dataset.w + '%'; });
    }); });
  }

  function renderBudgets() {
    var m = ym(cur), spent = {};
    $('budgetMonth').textContent = MONTHS[cur.getMonth()] + ' ' + cur.getFullYear();
    S.tx.forEach(function (t) { if (t.type === 'expense' && t.date.slice(0, 7) === m) spent[t.cat] = (spent[t.cat] || 0) + t.amount; });
    var totB = 0, totS = 0;
    var rows = S.cats.filter(function (c) { return c.type === 'expense'; }).map(function (c) {
      var b = +S.budgets[c.id] || 0, s = spent[c.id] || 0, pct = b ? s / b : 0;
      if (b) { totB += b; totS += s; }
      var cls = pct >= 1 ? 'bad' : pct >= 0.8 ? 'warn' : '';
      var right = b ? (pct >= 1 ? 'over ' + money(s - b, { rp: false }) : money(b - s, { rp: false }) + ' left') : (s ? money(s, { rp: false }) : 'Set budget');
      return '<div class="b-row" data-budget="' + esc(c.id) + '">' + icon(c) + '<div class="grow"><div class="b-top"><span>' + esc(c.name) + '</span><span>' + right + '</span></div>' +
        (b ? '<div class="bar"><i class="' + cls + '" data-w="' + Math.min(100, pct * 100).toFixed(1) + '"></i></div><div class="muted small">' + money(s, { rp: false }) + ' of ' + money(b, { rp: false }) + '</div>' : '') + '</div></div>';
    });
    $('budgetList').innerHTML = rows.join('');
    $('bTotal').innerHTML = money(totS) + (totB ? ' <span class="muted small">/ ' + money(totB, { rp: false }) + '</span>' : '');
    var p = totB ? totS / totB : 0;
    var bar = $('bTotalBar'); bar.className = p >= 1 ? 'bad' : p >= 0.8 ? 'warn' : ''; bar.dataset.w = Math.min(100, p * 100).toFixed(1);
    $('bTotalLine').textContent = totB ? Math.round(p * 100) + '% used' : 'Tap a category to set its monthly limit.';
    growBars($('v-budget'));
  }

  function renderAccount() {
    var s = S.settings;
    if (document.activeElement !== $('sUrl')) $('sUrl').value = s.syncUrl;
    if (document.activeElement !== $('sToken')) $('sToken').value = s.token;
    $('sAuto').checked = !!s.autoSync;
    $('startFromLine').textContent = s.startFrom ? 'Tracking BCA emails since ' + new Date(s.startFrom).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    $('sWallet').innerHTML = S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.icon + ' ' + w.name) + '</option>'; }).join('');
    $('sWallet').value = s.bcaWallet;

    $('walletList').innerHTML = S.wallets.map(function (w) {
      return '<button class="w-row" data-edit-wallet="' + esc(w.id) + '">' + icon(w) + '<span class="grow">' + esc(w.name) + '<span class="sub">' + money(balance(w.id)) + (w.excluded ? ' · not in total' : '') + '</span></span><span class="muted">›</span></button>';
    }).join('');
    document.querySelectorAll('#catSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === catTab); });
    $('catSeg').style.setProperty('--x', ['expense', 'income', 'debt'].indexOf(catTab) * 100 + '%');
    $('catList').innerHTML = catTree(catTab).map(function (c) {
      return '<button class="w-row' + (c.parent ? ' child' : '') + '" data-edit-cat="' + esc(c.id) + '">' + icon(c, 'sm') + '<span class="grow">' + esc(c.name) + (c.flow ? '<span class="sub">' + (c.flow === 'in' ? 'Money in' : 'Money out') + '</span>' : '') + '</span><span class="muted">›</span></button>';
    }).join('');
    $('ruleList').innerHTML = S.rules.length ? S.rules.map(function (r, i) {
      var c = cat(r.cat);
      return '<div class="w-row"><span class="grow" style="font-weight:500">"' + esc(r.kw) + '" → ' + esc(c.icon + ' ' + c.name) + '</span><button class="x" data-del-rule="' + i + '" aria-label="Delete">×</button></div>';
    }).join('') : '<p class="muted small pad">No rules.</p>';

    $('reviewCard').hidden = !S.review.length;
    $('reviewList').innerHTML = S.review.map(function (r, i) {
      return '<div class="w-row" style="padding-left:0;padding-right:0"><span class="grow" data-review="' + i + '" style="cursor:pointer;font-weight:500">' + esc(r.subject || '(no subject)') + '<span class="sub">' + esc(new Date(r.date).toLocaleString('en-GB')) + ' · ' + esc((r.snippet || '').slice(0, 90)) + '</span></span>' +
        '<button class="x" data-del-review="' + i + '" aria-label="Dismiss">×</button></div>';
    }).join('');
  }

  // ---------- navigation ----------
  function show(id, back) {
    if (id === view) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var prev = view; view = id;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active', 'back'); });
    var el = $(id); void el.offsetWidth;
    el.classList.add('active'); if (back) el.classList.add('back');
    window.scrollTo(0, 0);
    var navId = id === 'v-report' ? prev === 'v-tx' ? 'v-tx' : 'v-home' : id;
    if (id === 'v-report') repFrom = prev;
    document.querySelectorAll('.bottom-nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === navId); });
    moveInd();
    $('fab').classList.toggle('gone', id === 'v-account' || id === 'v-report');
    if (id === 'v-budget' || id === 'v-report') { growBars($(id)); }
    if (id === 'v-home') renderHome();
    $('topTitle').textContent = TITLES[id] || ''; onScroll();
  }
  var TITLES = { 'v-home': 'Overview', 'v-tx': 'Transactions', 'v-budget': 'Budgets', 'v-report': 'Report', 'v-account': 'Account' };
  function onScroll() { $('topbar').classList.toggle('show', window.scrollY > 70); }

  // ---------- extra motion ----------
  // Coin burst (used when income is added).
  function burst(x, y) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body.animate) return;
    for (var k = 0; k < 14; k++) (function (k) {
      var im = document.createElement('img'); im.src = 'img/3d/coin.webp'; im.className = 'coin-fx';
      im.style.left = (x - 17) + 'px'; im.style.top = (y - 17) + 'px'; document.body.appendChild(im);
      var a = -Math.PI / 2 + (Math.random() - .5) * 2.2, v = 140 + Math.random() * 160, dx = Math.cos(a) * v, dy = Math.sin(a) * v;
      var rot = (Math.random() - .5) * 720, sc = .6 + Math.random() * .6;
      im.animate([
        { transform: 'translate(0,0) scale(.2) rotate(0)', opacity: 0 },
        { transform: 'translate(' + dx * .6 + 'px,' + dy * .6 + 'px) scale(' + sc + ') rotate(' + rot * .5 + 'deg)', opacity: 1, offset: .35 },
        { transform: 'translate(' + dx + 'px,' + (dy + 260) + 'px) scale(' + sc * .8 + ') rotate(' + rot + 'deg)', opacity: 0 }
      ], { duration: 1100 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)', delay: k * 18 }).onfinish = function () { im.remove(); };
    })(k);
  }
  // 3D tilt + glare on the balance card.
  function bindTilt() {
    var card = document.querySelector('.bal-card'); if (!card) return;
    var glare = document.createElement('div'); glare.className = 'bal-glare'; card.appendChild(glare);
    function move(cx, cy) {
      var r = card.getBoundingClientRect(), px = (cx - r.left) / r.width, py = (cy - r.top) / r.height;
      if (px < 0 || px > 1 || py < 0 || py > 1) return;
      card.classList.add('tilting');
      card.style.transform = 'perspective(900px) rotateX(' + ((.5 - py) * 10).toFixed(2) + 'deg) rotateY(' + ((px - .5) * 12).toFixed(2) + 'deg) scale(1.015)';
      card.style.setProperty('--gx', (px * 100) + '%'); card.style.setProperty('--gy', (py * 100) + '%');
    }
    function reset() { card.classList.remove('tilting'); card.style.transform = ''; }
    card.addEventListener('touchmove', function (e) { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    card.addEventListener('touchstart', function (e) { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    card.addEventListener('touchend', reset); card.addEventListener('touchcancel', reset);
    card.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
    card.addEventListener('mouseleave', reset);
  }
  // Light on glass follows the finger.
  function bindSpecular() {
    function upd(e) {
      var p = e.touches ? e.touches[0] : e; if (!p) return;
      var el = document.elementFromPoint(p.clientX, p.clientY); el = el && el.closest('.bottom-nav,.round-btn,.wallet-pill,.sheet,.fab');
      if (!el) return; var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((p.clientX - r.left) / r.width * 100) + '%'); el.style.setProperty('--my', ((p.clientY - r.top) / r.height * 100) + '%');
    }
    document.addEventListener('touchstart', upd, { passive: true }); document.addEventListener('touchmove', upd, { passive: true }); document.addEventListener('mousemove', upd);
  }
  // Pull down on Home to sync BCA.
  function bindPull() {
    var y0 = null, dy = 0, el, ptr = $('ptr'), txt = $('ptrTxt');
    document.addEventListener('touchstart', function (e) {
      if (sheetOpen || view !== 'v-home' || window.scrollY > 2 || e.target.closest('.bal-card,.sum-row,.cf-plot')) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0; el = $('v-home');
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy <= 0) return;
      var pull = Math.min(120, dy * .45);
      el.style.transition = 'none'; el.style.translate = '0 ' + pull + 'px';
      ptr.style.transition = 'none'; ptr.style.opacity = Math.min(1, pull / 50);
      ptr.style.transform = 'translate(-50%,' + (pull - 60) + 'px)';
      ptr.querySelector('.ptr-ic').style.transform = 'rotate(' + pull * 4 + 'deg)';
      var ready = pull > 72; ptr.classList.toggle('ready', ready); txt.textContent = ready ? 'Release to sync' : 'Pull to sync';
      if (ready && !ptr._h) { haptic(); ptr._h = 1; } if (!ready) ptr._h = 0;
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (y0 == null) return; var pull = Math.min(120, dy * .45); y0 = null;
      el.style.transition = 'translate .55s var(--spring)'; el.style.translate = '0 0';
      ptr.style.transition = 'transform .55s var(--spring),opacity .4s';
      if (pull > 72) {
        ptr.classList.add('busy'); txt.textContent = 'Syncing…'; ptr.style.transform = 'translate(-50%,0)';
        Promise.resolve(sync(true)).then(function () { ptr.classList.remove('busy', 'ready'); ptr.style.transform = 'translate(-50%,-140%)'; ptr.style.opacity = 0; });
      } else { ptr.style.transform = 'translate(-50%,-140%)'; ptr.style.opacity = 0; }
    });
  }
  var repFrom = 'v-home';
  function moveInd() {
    var on = document.querySelector('.bottom-nav button.on'), ind = $('navInd'), nav = $('nav');
    if (!on) return;
    var r = on.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    var x = r.left - nr.left, dist = Math.abs(x - (ind._x == null ? x : ind._x));
    ind._x = x;
    ind.style.width = r.width + 'px';
    ind.style.transform = 'translateX(' + x + 'px)';
    if (dist > 4) { ind.style.scale = (1 + Math.min(.35, dist / 500)) + ' .82'; clearTimeout(ind._t); ind._t = setTimeout(function () { ind.style.scale = '1 1'; }, 190); }
  }

  // ---------- sheet (bottom modal) ----------
  var sheetOpen = false;
  function openSheet(html, onMount) {
    $('sheetBody').innerHTML = html;
    $('sheet').hidden = false; $('sheetBg').hidden = false; $('sheet').scrollTop = 0;
    void $('sheet').offsetWidth;
    $('sheet').classList.add('show'); $('sheetBg').classList.add('show');
    sheetOpen = true;
    if (onMount) onMount($('sheetBody'));
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    $('sheet').classList.remove('show'); $('sheetBg').classList.remove('show'); $('fab').classList.remove('open');
    setTimeout(function () { if (!sheetOpen) { $('sheet').hidden = true; $('sheetBg').hidden = true; $('sheetBody').innerHTML = ''; } }, 420);
  }
  // Swipe the sheet down to close.
  (function () {
    var y0 = null, dy = 0, sh;
    document.addEventListener('touchstart', function (e) {
      sh = $('sheet'); if (!sheetOpen || !sh.contains(e.target) || sh.scrollTop > 0 || e.target.closest('.cat-list,.icon-pick')) { y0 = null; return; }
      y0 = e.touches[0].clientY; dy = 0;
    }, { passive: true });
    document.addEventListener('touchmove', function (e) {
      if (y0 == null) return; dy = e.touches[0].clientY - y0;
      if (dy > 0) { sh.style.transition = 'none'; sh.style.transform = 'translateY(' + dy + 'px)'; }
    }, { passive: true });
    document.addEventListener('touchend', function () {
      if (y0 == null) return; sh.style.transition = ''; sh.style.transform = '';
      if (dy > 110) closeSheet(); y0 = null;
    });
  })();

  function walletPicker() {
    var row = function (w, bal, sel) {
      return '<button class="w-row" data-pick="' + esc(w.id) + '">' + icon(w) + '<span class="grow">' + esc(w.name) + '<span class="sub">' + money(bal) + '</span></span>' + (sel ? '<span class="check">✓</span>' : '') + '</button>';
    };
    var inc = S.wallets.filter(included), exc = S.wallets.filter(function (w) { return w.excluded; });
    openSheet('<div class="sheet-top"><button class="round-btn" id="pkClose" aria-label="Close">✕</button><h3>Select Wallet</h3><button class="round-btn" id="pkAdd" aria-label="Add wallet">＋</button></div>' +
      '<div class="card list-card">' + row({ id: 'all', name: 'Total', icon: '🌐', color: '#2fb5c9' }, balance('all'), walletSel === 'all') + '</div>' +
      '<div class="sheet-sec">Included in total</div><div class="card list-card stagger">' + inc.map(function (w, i) { return row(w, balance(w.id), walletSel === w.id).replace('class="w-row"', 'class="w-row" style="--i:' + i + '"'); }).join('') + '</div>' +
      (exc.length ? '<div class="sheet-sec">Excluded from total</div><div class="card list-card">' + exc.map(function (w) { return row(w, balance(w.id), walletSel === w.id); }).join('') + '</div>' : '') +
      '<p class="muted small" style="text-align:center;margin-top:14px">Press and hold a wallet to edit it.</p>',
      function (r) {
        r.querySelector('#pkClose').onclick = closeSheet;
        r.querySelector('#pkAdd').onclick = function () { walletSheet(); };
        var holdT;
        r.querySelectorAll('[data-pick]').forEach(function (b) {
          var held = false;
          b.addEventListener('touchstart', function () { held = false; holdT = setTimeout(function () { held = true; haptic(); if (b.dataset.pick !== 'all') walletSheet(wallet(b.dataset.pick)); }, 550); }, { passive: true });
          b.addEventListener('touchend', function () { clearTimeout(holdT); });
          b.addEventListener('touchmove', function () { clearTimeout(holdT); }, { passive: true });
          b.addEventListener('contextmenu', function (e) { e.preventDefault(); if (b.dataset.pick !== 'all') walletSheet(wallet(b.dataset.pick)); });
          b.onclick = function () { if (held) return; walletSel = b.dataset.pick; haptic(); closeSheet(); renderTx(); if (view !== 'v-tx') show('v-tx'); };
        });
      });
  }

  function txSheet(t, prefill) {
    var isNew = !t;
    t = t || Object.assign({ id: uid(), type: 'expense', amount: 0, cat: 'food', wallet: S.settings.bcaWallet || (S.wallets[0] || {}).id, toWallet: '', date: ymd(new Date()), time: hm(new Date()), note: '', merchant: '', src: 'manual', created: Date.now() }, prefill || {});
    var st = { type: t.type, cat: t.cat };
    var wOpts = function (sel) { return S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === sel ? ' selected' : '') + '>' + esc(w.icon + ' ' + w.name) + '</option>'; }).join(''); };
    $('fab').classList.add('open');
    openSheet(
      '<h3>' + (isNew ? 'Add transaction' : 'Edit transaction') + '</h3>' +
      '<div class="seg type-seg" id="fType" style="display:grid;grid-template-columns:repeat(4,1fr)"><button data-t="expense">Expense</button><button data-t="income">Income</button><button data-t="debt">Debt/Loan</button><button data-t="transfer">Transfer</button><i class="seg-ind" style="width:calc(25% - 1.5px)"></i></div>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="fAmt" inputmode="numeric" placeholder="0" value="' + (t.amount ? t.amount.toLocaleString('en-US') : '') + '"></div>' +
      '<div id="fCatWrap"><button type="button" class="cat-sel" id="fCatSel"></button><div class="cat-pick" id="fCatPick"><input id="fCatQ" placeholder="Search category" autocomplete="off"><div class="cat-list" id="fCats"></div></div></div>' +
      '<label class="fld" id="fWalletL"><span>Wallet</span><select id="fWallet">' + wOpts(t.wallet) + '</select></label>' +
      '<label class="fld" id="fToL">To wallet<select id="fTo">' + wOpts(t.toWallet || (S.wallets[1] && S.wallets[1].id)) + '</select></label>' +
      '<div class="two"><label class="fld">Date<input id="fDate" type="date" value="' + esc(t.date) + '"></label><label class="fld">Time<input id="fTime" type="time" value="' + esc(t.time || '') + '"></label></div>' +
      '<label class="fld">Merchant / person<input id="fMerch" value="' + esc(t.merchant || '') + '"></label>' +
      '<label class="fld">Note<input id="fNote" value="' + esc(t.note || '') + '"></label>' +
      (t.src === 'bca' ? '<p class="muted small">Imported from a BCA email' + (t.ref ? ' · ref ' + esc(t.ref) : '') + '.</p>' : '') +
      (t.src === 'bca' && !isNew ? '<label class="set-row plain"><span class="grow small">Always use this category for "' + esc(t.merchant || '') + '"</span><input type="checkbox" class="switch" id="fRemember" checked></label>' : '') +
      '<button class="btn primary block" id="fSave">Save</button>' +
      (isNew ? '' : '<button class="btn danger block" id="fDel">Delete</button>'),
      function (root) {
        var amt = root.querySelector('#fAmt'); fmtInput(amt);
        var ind = root.querySelector('#fType .seg-ind');
        function paint() {
          var idx = ['expense', 'income', 'debt', 'transfer'].indexOf(st.type);
          ind.style.transform = 'translateX(' + (idx * 100) + '%)';
          root.querySelectorAll('#fType button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === st.type); });
          root.querySelector('#fCatWrap').hidden = st.type === 'transfer';
          root.querySelector('#fToL').hidden = st.type !== 'transfer';
          root.querySelector('#fWalletL span').textContent = st.type === 'transfer' ? 'From wallet' : 'Wallet';
          var cats = S.cats.filter(function (c) { return c.type === st.type; });
          if (st.type !== 'transfer' && !cats.some(function (c) { return c.id === st.cat; })) st.cat = cats[0] ? cats[0].id : '';
          var sc = cat(st.cat);
          root.querySelector('#fCatSel').innerHTML = icon(sc) + '<span class="grow"><small>Category</small>' + esc(sc.name) + '</span><span class="chev2">' + (pickOpen ? '▴' : '▾') + '</span>';
          root.querySelector('#fCatPick').classList.toggle('open', pickOpen);
          var q = root.querySelector('#fCatQ').value.trim().toLowerCase();
          root.querySelector('#fCats').innerHTML = catTree(st.type).filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; }).map(function (c, i) {
            return '<button type="button" data-c="' + esc(c.id) + '" class="cat-row' + (c.parent ? ' child' : '') + (c.id === st.cat ? ' on' : '') + '" style="--i:' + Math.min(i, 14) + '">' + icon(c, 'sm') + '<span class="grow">' + esc(c.name) + '</span>' + (c.id === st.cat ? '<span class="check">✓</span>' : '') + '</button>';
          }).join('') || '<p class="muted small" style="text-align:center">No category found</p>';
        }
        var pickOpen = isNew;
        root.querySelector('#fCatSel').onclick = function () { pickOpen = !pickOpen; haptic(); paint(); };
        root.querySelector('#fCatQ').addEventListener('input', paint);
        root.querySelector('#fType').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st.type = b.dataset.t; haptic(); paint(); } });
        root.querySelector('#fCats').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st.cat = b.dataset.c; pickOpen = false; root.querySelector('#fCatQ').value = ''; haptic(); paint(); } });
        paint();
        if (isNew) setTimeout(function () { amt.focus(); }, 380);

        root.querySelector('#fSave').onclick = function () {
          var a = parseNum(amt.value);
          if (!a) { toast('Enter an amount'); amt.focus(); return; }
          var w = root.querySelector('#fWallet').value, to = root.querySelector('#fTo').value;
          if (st.type === 'transfer' && w === to) { toast('Pick two different wallets'); return; }
          var oldCat = t.cat;
          Object.assign(t, {
            type: st.type, amount: a, cat: st.type === 'transfer' ? '' : st.cat, wallet: w, toWallet: st.type === 'transfer' ? to : '',
            date: root.querySelector('#fDate').value || ymd(new Date()), time: root.querySelector('#fTime').value,
            merchant: root.querySelector('#fMerch').value.trim(), note: root.querySelector('#fNote').value.trim()
          });
          var rem = root.querySelector('#fRemember');
          if (rem && rem.checked && t.merchant && t.cat && t.cat !== oldCat) learnRule(t.merchant, t.cat);
          if (isNew) S.tx.push(t);
          haptic(); save(); closeSheet(); renderAll(); toast(isNew ? 'Added ✓' : 'Saved ✓');
          if (isNew && t.type === 'income') { var fr = $('fab').getBoundingClientRect(); burst(fr.left + fr.width / 2, fr.top); }
        };
        var del = root.querySelector('#fDel');
        if (del) del.onclick = function () {
          if (!confirm('Delete this transaction?')) return;
          S.tx = S.tx.filter(function (x) { return x.id !== t.id; });
          save(); closeSheet(); renderAll(); toast('Deleted');
        };
      });
  }

  // Categories of one type, each parent followed by its children.
  function catTree(type) {
    var list = S.cats.filter(function (c) { return c.type === type; }), out = [];
    list.filter(function (c) { return !c.parent || !list.some(function (p) { return p.id === c.parent; }); }).forEach(function (p) {
      out.push(p); list.forEach(function (c) { if (c.parent === p.id) out.push(c); });
    });
    return out;
  }

  function learnRule(merchant, catId) {
    var kw = merchant.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ');
    if (!kw) return;
    S.rules = S.rules.filter(function (r) { return r.kw !== kw; });
    S.rules.unshift({ kw: kw, cat: catId });
  }

  function guessCat(merchant, type) {
    var m = (merchant || '').toLowerCase();
    for (var i = 0; i < S.rules.length; i++) {
      var r = S.rules[i], c = cat(r.cat);
      if (r.kw && c.type === type && m.indexOf(r.kw.toLowerCase()) !== -1) return r.cat;
    }
    if (type === 'debt') return 'debt';
    if (type === 'income') return S.cats.some(function (c) { return c.id === 'transfer_in'; }) ? 'transfer_in' : (S.cats.filter(function (c) { return c.type === 'income'; })[0] || {}).id;
    return S.cats.some(function (c) { return c.id === 'other_out'; }) ? 'other_out' : (S.cats.filter(function (c) { return c.type === 'expense'; })[0] || {}).id;
  }

  // ---------- BCA sync ----------
  var syncing = false;
  function sync(manual) {
    var s = S.settings;
    if (!s.syncUrl || !s.token) { if (manual) { toast('Set up BCA sync in Account first'); } return Promise.resolve(); }
    if (syncing) return Promise.resolve();
    syncing = true;
    $('hSync').classList.add('spin');
    $('sStatus').textContent = 'Syncing…';
    // Only emails from the moment tracking started count (set on first connect or Start fresh).
    if (!s.startFrom) { s.startFrom = Date.now(); save(); }
    var since = Math.max(s.startFrom, s.lastSync ? s.lastSync - 2 * 864e5 : 0);
    var url = s.syncUrl + (s.syncUrl.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(s.token) + '&since=' + since;
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 30000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok) throw new Error(data && data.error ? data.error : 'Unexpected reply');
        var added = 0, review = 0, emails = data.emails || [];
        emails.forEach(function (em) {
          if (!em || !em.id || S.seen[em.id]) return;
          if (em.date < s.startFrom) return;
          S.seen[em.id] = Date.now();
          var p = window.BcaParser.parseBcaEmail(em);
          if (!p) {
            if (/(rp\.?|idr)\s*[\d.,]+/i.test(em.body || '') && !/otp|promo/i.test(em.subject || '')) {
              S.review.unshift({ id: em.id, date: em.date, subject: em.subject, snippet: window.BcaParser.normalize(em.body).slice(0, 400) });
              review++;
            }
            return;
          }
          if (p.ref && S.tx.some(function (t) { return t.src === 'bca' && t.ref === p.ref && t.amount === p.amount; })) return;
          var d = new Date(em.date);
          S.tx.push({
            id: uid(), type: p.type, amount: p.amount, cat: guessCat(p.merchant, p.type),
            wallet: S.wallets.some(function (w) { return w.id === s.bcaWallet; }) ? s.bcaWallet : (S.wallets[0] || {}).id,
            toWallet: '', date: ymd(d), time: hm(d), merchant: p.merchant, note: '', src: 'bca', srcId: em.id, ref: p.ref || '', created: Date.now()
          });
          added++;
        });
        S.review = S.review.slice(0, 50);
        pruneSeen();
        s.lastSync = data.now || Date.now();
        save(); renderAll();
        var msg = added ? added + ' BCA transaction' + (added > 1 ? 's' : '') + ' added' : 'No new BCA transactions';
        if (review) msg += ' · ' + review + ' to review';
        $('sStatus').textContent = msg + ' (' + emails.length + ' emails checked, ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ')';
        if (manual || added || review) toast(msg);
      })
      .catch(function (e) {
        $('sStatus').textContent = 'Sync failed: ' + (e.name === 'AbortError' ? 'timed out' : e.message);
        if (manual) toast('Sync failed. Check URL and secret.');
      })
      .then(function () { clearTimeout(timer); syncing = false; $('hSync').classList.remove('spin'); });
  }
  function pruneSeen() {
    var cut = Date.now() - 120 * 864e5;
    Object.keys(S.seen).forEach(function (k) { if (S.seen[k] < cut) delete S.seen[k]; });
  }

  // ---------- small edit sheets ----------
  // Set a wallet so that its balance today equals `target`.
  function setBalance(w, target) {
    var txSum = S.tx.reduce(function (a, t) { return a + delta(t, w.id); }, 0);
    w.initial = target - txSum;
  }

  function walletSheet(w) {
    var isNew = !w; w = w || { id: uid(), name: '', icon: '👛', initial: 0 };
    var curBal = isNew ? 0 : balance(w.id);
    openSheet('<h3>' + (isNew ? 'New wallet' : 'Edit wallet') + '</h3>' +
      icon(w, 'preview') +
      '<label class="fld">Name<input id="wName" value="' + esc(w.name) + '"></label>' +
      '<div class="fld">Icon' + picker(w.icon) + '</div><label class="fld">Or type any emoji<input id="wIcon" value="' + esc(w.icon) + '"></label>' +
      '<label class="fld">Current balance<input id="wBal" inputmode="numeric" value="' + (curBal ? Math.abs(curBal).toLocaleString('en-US') : '') + '" placeholder="0"></label>' +
      '<label class="fld">Group<select id="wGroup">' + Object.keys(GROUPS).map(function (g) { return '<option value="' + g + '"' + (groupOf(w) === g ? ' selected' : '') + '>' + GROUPS[g].icon + ' ' + GROUPS[g].name + '</option>'; }).join('') + '</select></label>' +
      '<label class="set-row plain"><span class="grow">Include in total balance</span><input type="checkbox" class="switch" id="wInc"' + (w.excluded ? '' : ' checked') + '></label>' +
      '<button class="btn primary block" id="wSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="wDel">Delete wallet</button>'),
      function (r) {
        fmtInput(r.querySelector('#wBal'));
        bindPicker(r, r.querySelector('#wIcon'));
        r.querySelector('#wSave').onclick = function () {
          var n = r.querySelector('#wName').value.trim(); if (!n) { toast('Give it a name'); return; }
          w.name = n; w.icon = r.querySelector('#wIcon').value.trim() || '👛';
          w.excluded = !r.querySelector('#wInc').checked;
          w.group = r.querySelector('#wGroup').value;
          if (isNew) S.wallets.push(w);
          setBalance(w, parseNum(r.querySelector('#wBal').value) * (curBal < 0 ? -1 : 1));
          haptic(); save(); closeSheet(); renderAll(); toast('Saved ✓');
        };
        var d = r.querySelector('#wDel');
        if (d) d.onclick = function () {
          var used = S.tx.some(function (t) { return t.wallet === w.id || t.toWallet === w.id; });
          if (used) { toast('This wallet has transactions. Move or delete them first.'); return; }
          if (S.wallets.length < 2) { toast('Keep at least one wallet'); return; }
          if (!confirm('Delete wallet "' + w.name + '"?')) return;
          S.wallets = S.wallets.filter(function (x) { return x.id !== w.id; }); save(); closeSheet(); renderAll();
        };
      });
  }

  function catSheet(c, type) {
    var isNew = !c; c = c || { id: uid(), name: '', icon: '🏷️', type: type || 'expense' };
    openSheet('<h3>' + (isNew ? 'New category' : 'Edit category') + '</h3>' +
      '<label class="fld">Name<input id="cName" value="' + esc(c.name) + '"></label>' +
      '<div class="fld">Icon' + picker(c.icon) + '</div><label class="fld">Or type any emoji<input id="cIcon" value="' + esc(c.icon) + '"></label>' +
      '<label class="fld">Type<select id="cType"><option value="expense">Expense</option><option value="income">Income</option><option value="debt">Debt/Loan</option></select></label>' +
      '<label class="fld" id="cParentL">Inside category (optional)<select id="cParent"></select></label>' +
      '<label class="fld" id="cFlowL">Money goes<select id="cFlow"><option value="out">Out of my wallet (lend, repay)</option><option value="in">Into my wallet (borrow, collect)</option></select></label>' +
      '<button class="btn primary block" id="cSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="cDel">Delete category</button>'),
      function (r) {
        bindPicker(r, r.querySelector('#cIcon'));
        r.querySelector('#cType').value = c.type;
        r.querySelector('#cType').disabled = !isNew;
        function opts() {
          var ty = r.querySelector('#cType').value;
          r.querySelector('#cParent').innerHTML = '<option value="">None (main category)</option>' + S.cats.filter(function (p) { return p.type === ty && !p.parent && p.id !== c.id; }).map(function (p) { return '<option value="' + esc(p.id) + '"' + (c.parent === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('');
          r.querySelector('#cFlowL').hidden = ty !== 'debt';
          r.querySelector('#cParentL').hidden = S.cats.some(function (x) { return x.parent === c.id; });
        }
        r.querySelector('#cType').onchange = opts; opts();
        r.querySelector('#cFlow').value = c.flow || 'out';
        r.querySelector('#cSave').onclick = function () {
          var n = r.querySelector('#cName').value.trim(); if (!n) { toast('Give it a name'); return; }
          c.name = n; c.icon = r.querySelector('#cIcon').value.trim() || '🏷️'; c.type = r.querySelector('#cType').value;
          var pv = r.querySelector('#cParent').value; if (pv) c.parent = pv; else delete c.parent;
          if (c.type === 'debt') c.flow = r.querySelector('#cFlow').value; else delete c.flow;
          if (isNew) S.cats.push(c); save(); closeSheet(); renderAll();
        };
        var d = r.querySelector('#cDel');
        if (d) d.onclick = function () {
          if (S.tx.some(function (t) { return t.cat === c.id; })) { toast('Category is in use. Recategorize those transactions first.'); return; }
          if (S.cats.some(function (x) { return x.parent === c.id; })) { toast('Move or delete its sub categories first.'); return; }
          S.cats = S.cats.filter(function (x) { return x.id !== c.id; });
          S.rules = S.rules.filter(function (x) { return x.cat !== c.id; });
          delete S.budgets[c.id]; save(); closeSheet(); renderAll();
        };
      });
  }

  function ruleSheet() {
    openSheet('<h3>New rule</h3><label class="fld">If merchant contains<input id="rKw" placeholder="e.g. indomaret"></label>' +
      '<label class="fld">Use category<select id="rCat">' + S.cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.icon + ' ' + c.name) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn primary block" id="rSave">Save</button>',
      function (r) {
        r.querySelector('#rSave').onclick = function () {
          var kw = r.querySelector('#rKw').value.trim().toLowerCase(); if (!kw) { toast('Type a word'); return; }
          S.rules.unshift({ kw: kw, cat: r.querySelector('#rCat').value }); save(); closeSheet(); renderAll();
        };
      });
  }

  function budgetSheet(catId) {
    var c = cat(catId);
    openSheet('<h3>' + esc(c.name) + ' budget</h3>' + icon(c, 'preview') +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="bAmt" inputmode="numeric" value="' + (S.budgets[catId] ? (+S.budgets[catId]).toLocaleString('en-US') : '') + '" placeholder="0"></div>' +
      '<p class="muted small">Monthly limit. Leave empty for no budget.</p><button class="btn primary block" id="bSave">Save</button>',
      function (r) {
        var i = r.querySelector('#bAmt'); fmtInput(i);
        setTimeout(function () { i.focus(); }, 380);
        r.querySelector('#bSave').onclick = function () {
          var n = parseNum(i.value); if (n) S.budgets[catId] = n; else delete S.budgets[catId];
          haptic(); save(); closeSheet(); renderAll();
        };
      });
  }

  // ---------- one time wallet import from link (#import=base64 JSON) ----------
  function importFromHash() {
    var m = location.hash.match(/^#import=([A-Za-z0-9_\-+/=%]+)/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    var data;
    try {
      var b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/');
      data = JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch (e) { toast('That import link is broken'); return; }
    var list = (data && data.wallets) || [];
    if (!list.length) return;
    var total = list.reduce(function (a, x) { return a + (+x[2] || 0); }, 0);
    if (!confirm('Load ' + list.length + ' wallets (total Rp ' + fmt(total) + ') onto this phone?\nExisting wallets with the same name get their balance updated.')) return;
    list.forEach(function (x) {
      var name = String(x[0]), w = S.wallets.filter(function (y) { return y.name.toLowerCase() === name.toLowerCase(); })[0];
      if (!w) { w = { id: uid(), name: name, icon: x[1] || '👛', initial: 0 }; S.wallets.push(w); }
      if (x[1]) w.icon = x[1];
      if (x[3]) w.color = x[3];
      setBalance(w, +x[2] || 0);
    });
    if (data.removeEmptyDefaults) {
      S.wallets = S.wallets.filter(function (w) {
        var isDefault = w.id === 'cash' && !list.some(function (x) { return String(x[0]).toLowerCase() === 'cash'; });
        return !(isDefault && balance(w.id) === 0 && !S.tx.some(function (t) { return t.wallet === w.id || t.toWallet === w.id; }));
      });
    }
    save(); toast('Wallets loaded ✓');
  }

  // ---------- events ----------
  function bind() {
    document.querySelectorAll('.bottom-nav button').forEach(function (b) { b.onclick = function () { haptic(); show(b.dataset.v); }; });
    window.addEventListener('resize', moveInd);
    $('fab').onclick = function () { haptic(); txSheet(null, walletSel !== 'all' ? { wallet: walletSel } : null); };
    $('sheetBg').onclick = closeSheet;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

    $('eyeBtn').onclick = function () { S.settings.hide = !S.settings.hide; haptic(); save(); renderAll(); };
    $('hideToggle').onchange = function () { S.settings.hide = this.checked; save(); renderAll(); };
    $('hSync').onclick = function () { haptic(); if (S.review.length) { show('v-account'); setTimeout(function () { $('reviewCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); } else sync(true); };
    $('seeAllWallets').onclick = walletPicker;
    $('donutGo').onclick = function () { haptic(); cur = new Date(); cur.setDate(1); renderAll(); show('v-report'); };
    $('balDetails').onclick = function () { haptic(); walletPicker(); };
    $('hGroups').onclick = function (e) { if (e.target.closest('[data-group]')) { haptic(); walletPicker(); } };
    $('cfSeg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; cfMonths = +b.dataset.n; cfSel = null; haptic(); renderCashflow(); };
    $('cfChart').onclick = function (e) { var b = e.target.closest('.cf-bar'); if (!b) return; cfSel = +b.dataset.i; haptic(); renderCashflow(true); };
    $('themeSeg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; S.settings.theme = b.dataset.t; haptic(); save(); applyTheme(); renderCashflow(true); };
    $('walletPill').onclick = walletPicker;
    $('hWallets').onclick = function (e) { var b = e.target.closest('[data-wallet]'); if (b) { walletSel = b.dataset.wallet; renderTx(); show('v-tx'); } };
    $('seeReports').onclick = function () { cur = new Date(); cur.setDate(1); renderAll(); show('v-report'); };
    $('periodReport').onclick = function () { show('v-report'); };
    $('repBack').onclick = function () { show(repFrom === 'v-report' ? 'v-home' : repFrom, true); };
    $('seeAllTx').onclick = function () { walletSel = 'all'; cur = new Date(); cur.setDate(1); renderAll(); show('v-tx'); };
    $('txPrev').onclick = function () { cur.setMonth(cur.getMonth() - 1); haptic(); renderAll(); };
    $('txNext').onclick = function () { cur.setMonth(cur.getMonth() + 1); haptic(); renderAll(); };

    function openTx(e) { var row = e.target.closest('.tx'); if (!row) return; var t = S.tx.filter(function (x) { return x.id === row.dataset.id; })[0]; if (t) txSheet(t); }
    $('txList').onclick = openTx; $('hRecent').onclick = openTx;

    $('repSeg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; repKind = b.dataset.k; haptic(); renderReport(); };
    function showTip(e) {
      var col = e.target.closest('.col');
      document.querySelectorAll('.tip').forEach(function (t) { t.remove(); });
      document.querySelectorAll('.col.sel').forEach(function (c) { c.classList.remove('sel'); });
      if (!col) return;
      col.classList.add('sel');
      var tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = col.dataset.tip; col.appendChild(tip);
    }
    // Static 3D icons in the page markup.
    document.querySelectorAll('[data-i3d]').forEach(function (el) { el.innerHTML = img3d(el.dataset.i3d); el.classList.add('i3d'); });
    $('repDaily').addEventListener('mouseover', showTip);
    $('repDaily').addEventListener('focusin', showTip);
    $('repDaily').addEventListener('click', showTip);
    $('budgetList').onclick = function (e) { var r = e.target.closest('[data-budget]'); if (r) budgetSheet(r.dataset.budget); };

    $('sSave').onclick = function () {
      var url = $('sUrl').value.trim();
      if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('That does not look like an Apps Script web app URL'); return false; }
      S.settings.syncUrl = url; S.settings.token = $('sToken').value.trim();
      S.settings.autoSync = $('sAuto').checked; S.settings.bcaWallet = $('sWallet').value;
      save(); renderAll(); toast('Saved ✓'); return true;
    };
    $('sSync').onclick = function () { if ($('sSave').onclick() !== false) sync(true); };

    $('tRun').onclick = function () {
      var raw = $('tInput').value, nl = raw.indexOf('\n');
      var em = { subject: nl === -1 ? raw : raw.slice(0, nl), body: nl === -1 ? '' : raw.slice(nl + 1) };
      var p = window.BcaParser.parseBcaEmail(em);
      $('tOut').textContent = p ? (p.type === 'income' ? 'Income  ' : 'Expense  ') + 'Rp ' + fmt(p.amount) + '\nMerchant: ' + p.merchant + '\nCategory: ' + cat(guessCat(p.merchant, p.type)).name + (p.ref ? '\nRef: ' + p.ref : '')
        : 'Not recognised as a transaction. Send this sample to your developer so the reader can learn it.';
    };

    $('addWallet').onclick = function () { walletSheet(); };
    $('addCat').onclick = function () { catSheet(null, catTab); };
    $('catSeg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; catTab = b.dataset.t; haptic(); renderAccount(); };
    $('addRule').onclick = ruleSheet;
    $('v-account').addEventListener('click', function (e) {
      var t = e.target.closest('[data-edit-wallet],[data-edit-cat],[data-del-rule],[data-review],[data-del-review]');
      if (!t) return;
      if (t.dataset.editWallet) walletSheet(wallet(t.dataset.editWallet));
      else if (t.dataset.editCat) catSheet(cat(t.dataset.editCat));
      else if (t.dataset.delRule != null) { S.rules.splice(+t.dataset.delRule, 1); save(); renderAll(); }
      else if (t.dataset.delReview != null) { S.review.splice(+t.dataset.delReview, 1); save(); renderAll(); }
      else if (t.dataset.review != null) {
        var i = +t.dataset.review, r = S.review[i], d = new Date(r.date);
        S.review.splice(i, 1); save();
        txSheet(null, { wallet: S.settings.bcaWallet, date: ymd(d), time: hm(d), note: r.subject || '', src: 'bca', srcId: r.id });
        renderAccount();
      }
    });

    $('resetBtn').onclick = function () {
      if (!confirm('Start fresh? This deletes ALL transactions, sets every wallet to Rp 0, and only BCA transactions from now on will be added.')) return;
      S.tx = []; S.seen = {}; S.review = [];
      S.wallets.forEach(function (w) { w.initial = 0; });
      S.settings.startFrom = Date.now(); S.settings.lastSync = Date.now();
      save(); renderAll(); toast('Fresh start. Waiting for your next BCA transaction.');
    };
    $('exportBtn').onclick = function () {
      var blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arus-backup-' + ymd(new Date()) + '.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    $('importFile').onchange = function () {
      var f = this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result);
          if (!d || !Array.isArray(d.tx) || !Array.isArray(d.wallets)) throw new Error('not an Arus backup');
          if (!confirm('Replace all data on this phone with this backup (' + d.tx.length + ' transactions)?')) return;
          localStorage.setItem(KEY, JSON.stringify(d)); load(); renderAll(); toast('Backup restored');
        } catch (e) { toast('Import failed: ' + e.message); }
      };
      rd.readAsText(f); this.value = '';
    };

    document.addEventListener('visibilitychange', function () { if (!document.hidden && S.settings.autoSync) sync(false); });
    setInterval(function () { if (!document.hidden && S.settings.autoSync) sync(false); }, 5 * 60 * 1000);
  }

  load(); importFromHash(); bind(); renderAll();
  bindTilt(); bindSpecular(); bindPull(); window.addEventListener('scroll', onScroll, { passive: true });
  requestAnimationFrame(moveInd);
  if (S.settings.autoSync) sync(false);
})();
