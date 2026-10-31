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
    ['salary', 'Salary', '💵', 'income'], ['my_cash', 'MY CASH', '❤', 'income', 'salary'], ['reserve_transfer', 'RESERVE TRANSFER', '💰', 'income', 'salary'],
    ['other_in', 'Other Income', '📦', 'income'], ['transfer_in', 'Incoming transfer', '📥', 'income'], ['interest', 'Collect Interest', '📈', 'income'],
    ['uncat_in', 'Uncategorized', '❔', 'income'], ['plus_crypto', 'PLUS CRYPTO', '🪙', 'income'], ['ajaib_kripto_plus', 'AJAIB KRIPTO PLUS', '💹', 'income'],
    ['bitget_plus', 'BITGET PLUS', '🚀', 'income'], ['mexc_plus', 'MEXC PLUS', '📈', 'income'], ['bybit_plus', 'BYBIT PLUS', '🎯', 'income'],
    ['stocks_plus', 'STOCKS PLUS', '📊', 'income'], ['gold_debit_in', 'GOLD DEBIT', '💳', 'income'], ['brpt_plus', 'BRPT PLUS', '♟', 'income'],
    ['pokemon_plus', 'Pokemon plus', '👾', 'income'], ['sentaris', 'SENTARIS', '🏙', 'income'], ['komisi_in', 'KOMISI', '💰', 'income'],
    ['loan', 'Loan', '💸', 'debt', '', 'out'], ['repayment', 'Repayment', '🧾', 'debt', '', 'out'],
    ['debt_collection', 'Debt Collection', '🪙', 'debt', '', 'in'], ['debt', 'Debt', '📥', 'debt', '', 'in']
  ];
  var CAT_VER = 4;
  // Built-in categories (shown with a lock, cannot be deleted).
  var LOCKED = ['loan', 'repayment', 'debt_collection', 'debt', 'other_out', 'transfer_out', 'pay_interest', 'uncat', 'other_in', 'transfer_in', 'interest', 'uncat_in'];
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
      settings: { syncUrl: '', token: '', autoSync: true, bcaWallet: 'bca', bcaAccounts: null, autoOwed: { reserve_transfer: 'Dad', komisi_in: 'Dad' }, lastSync: 0, startFrom: 0, hide: false, theme: 'dark' },
      seen: {}, review: [], debts: [], goals: [], recurring: []
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
    if ((S.catVer || 1) === 2) {
      // Version 3: the user's own income categories.
      var used = function (id) { return S.tx.some(function (t) { return t.cat === id; }); };
      S.cats = S.cats.filter(function (c) { return !(c.id === 'bonus' && !used('bonus')); });
      S.cats.forEach(function (c) { var d3 = DEFAULT_CATS.filter(function (x) { return x[0] === c.id; })[0]; if (d3 && c.type === 'income') { c.icon = d3[2]; c.name = d3[1]; } });
      var at = S.cats.map(function (c) { return c.type; }).lastIndexOf('income') + 1 || S.cats.length;
      DEFAULT_CATS.forEach(function (x) { if (x[3] === 'income' && !S.cats.some(function (c) { return c.id === x[0]; })) S.cats.splice(at++, 0, mkCat(x)); });
      S.catVer = CAT_VER;
    }
    if ((S.catVer || 1) === 3) {
      // Version 4: Debt/Loan in the user's order.
      var order = ['loan', 'repayment', 'debt_collection', 'debt'];
      var debts = order.map(function (id) { return S.cats.filter(function (c) { return c.id === id; })[0]; }).filter(Boolean);
      S.cats = S.cats.filter(function (c) { return order.indexOf(c.id) === -1; }).concat(debts);
      S.catVer = CAT_VER;
    }
    if ((S.catVer || 1) < CAT_VER) {
      // Switch to the full category list; keep categories the user made themselves.
      var mine = S.cats.filter(function (c) { return OLD_DEFAULT_IDS.indexOf(c.id) === -1 && !DEFAULT_CATS.some(function (x) { return x[0] === c.id; }); });
      S.cats = DEFAULT_CATS.map(mkCat).concat(mine);
      var ok = function (id) { return S.cats.some(function (c) { return c.id === id; }); };
      S.tx.forEach(function (t) {
        if (t.cat === 'loan_out') { t.type = 'debt'; t.cat = 'loan'; return; }
        if (CAT_MAP[t.cat]) t.cat = CAT_MAP[t.cat];
        if (t.cat === 'bonus') t.cat = 'other_in';
        if (t.cat && !ok(t.cat)) t.cat = t.type === 'income' ? 'other_in' : 'other_out';
      });
      Object.keys(S.budgets).forEach(function (k) { var n = CAT_MAP[k] || k; var v = S.budgets[k]; delete S.budgets[k]; if (ok(n)) S.budgets[n] = v; });
      S.rules = DEFAULT_RULES.map(function (r) { return { kw: r[0], cat: r[1] }; }).concat(S.rules.filter(function (r) { return !DEFAULT_RULES.some(function (d) { return d[0] === r.kw; }) && ok(r.cat); }));
      S.catVer = CAT_VER;
    }
  }
  // BCA emails show the source account masked (first 4 + last 2 digits). Map each to a wallet.
  function ensureAccounts() {
    if (Array.isArray(S.settings.bcaAccounts)) return;
    var reserve = S.wallets.filter(function (w) { return /reserve/i.test(w.name); })[0];
    S.settings.bcaAccounts = [
      { mask: '6275****46', label: 'Tahapan Xpresi / Tahapan (ends 46)', wallet: reserve ? reserve.id : '' },
      { mask: '6275****91', label: 'Tahapan Xpresi (ends 91)', wallet: '' },
      { mask: '6370****23', label: 'Tahapan Xpresi (ends 23)', wallet: '' }
    ];
  }
  function maskMatch(mask, src) {
    var a = String(mask || '').replace(/[^0-9*xX•]/g, ''), b = String(src || '').replace(/[^0-9*xX•]/g, '');
    if (!a || !b) return false;
    var pa = a.match(/^\d*/)[0], sa = a.match(/\d*$/)[0], pb = b.match(/^\d*/)[0], sb = b.match(/\d*$/)[0];
    var n = Math.min(pa.length, pb.length), m = Math.min(sa.length, sb.length);
    return n >= 2 && m >= 2 && pa.slice(0, n) === pb.slice(0, n) && sa.slice(-m) === sb.slice(-m);
  }
  function walletForSrc(src) {
    var acc = (S.settings.bcaAccounts || []).filter(function (a) { return a.wallet && maskMatch(a.mask, src); })[0];
    return acc && S.wallets.some(function (w) { return w.id === acc.wallet; }) ? acc.wallet : null;
  }
  function useGenerated() { if (S.iconVer === 2) return; (S.cats || []).concat(S.wallets || []).forEach(function (o) { delete o.custom; }); S.iconVer = 2; }
  function save() {
    S.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); cloudQueue(); }
    catch (e) { toast('Could not save. Storage full or blocked.'); }
  }

  // ---------- helpers ----------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Math.abs(Math.round(n)).toLocaleString('id-ID'); }
  var MASK = '••••••';
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
  // Custom 3D icon sheet (generated for Apex, hosted on Higgsfield). 10 columns x 9 rows.
  var SHEET = 'https://d2ol7oe51mr4n9.cloudfront.net/user_39sfmdQQbAHtgXwYGqnL0idUf2I/69b9c1ff-1600-4e29-b092-0ac3a9737591.webp';
  var SP = {"food":0,"bills":1,"phone_bill":2,"gas_bill":3,"internet_bill":4,"personal_expense":5,"shopping":6,"personal_items":7,"health":8,"tennis":9,"education":10,"fun":11,"streaming":12,"fun_money":13,"insurance":14,"investment":15,"digital_assets":16,"bitget":17,"ajaib_kripto":18,"pluang":19,"ajaib_essa":20,"bybit":21,"stocks":22,"ethereum":23,"gold_inv":24,"louis_hugo":25,"bren":26,"usd":27,"pokemon":28,"other_out":29,"transfer_out":30,"pay_interest":31,"uncat":32,"makan_team":33,"iklan_tokped":34,"giving":35,"spending":36,"kasih":37,"balance_adj":38,"utang":39,"komisi_out":40,"kas_kantor":41,"berkati_ortu":42,"sharss":43,"branding":44,"project":45,"gifts":46,"to_reserve":47,"bi":48,"gold_debit":49,"korea_loan":50,"wedding":51,"shanghai":52,"dvn":53,"my_home":54,"salary":55,"my_cash":56,"reserve_transfer":57,"other_in":58,"transfer_in":59,"interest":60,"uncat_in":61,"plus_crypto":62,"ajaib_kripto_plus":63,"bitget_plus":64,"mexc_plus":65,"bybit_plus":66,"stocks_plus":67,"gold_debit_in":68,"brpt_plus":69,"pokemon_plus":70,"sentaris":71,"loan":72,"repayment":73,"debt_collection":74,"debt":75,"w_reserve":76,"w_bank":77,"w_daytona":78,"w_jimney":79,"w_hulk":80,"w_ajaib":81,"w_goldputer":82,"w_cash":83,"g_savings":84};
  var SP_GROUP = { cash: 'w_bank', savings: 'g_savings', invest: 'stocks' };
  function spKey(obj) {
    if (!obj) return null;
    if (obj.sp && SP[obj.sp] != null) return obj.sp;
    if (obj.custom) return null;
    if (obj.id === 'transfer') return 'transfer_out';
    if (obj.id === 'all') return 'w_goldputer';
    if (SP[obj.id] != null) return obj.id;
    var n = String(obj.name || '');
    if (obj.initial != null || obj.excluded != null) {
      if (/reserve/i.test(n)) return 'w_reserve';
      if (/daytona/i.test(n)) return 'w_daytona';
      if (/jimney/i.test(n)) return 'w_jimney';
      if (/hulk|rolex/i.test(n)) return 'w_hulk';
      if (/puter/i.test(n)) return 'w_goldputer';
      if (/gold|emas/i.test(n)) return 'gold_inv';
      if (/ajaib|stock|saham/i.test(n)) return 'w_ajaib';
      if (/personal/i.test(n)) return 'personal_expense';
      if (/cash|tunai|dompet/i.test(n)) return 'w_cash';
      if (/bank|bca|mandiri|bri|bni|jago|seabank/i.test(n)) return 'w_bank';
      return 'w_cash';
    }
    return null;
  }
  function sprite(k, cls) {
    var i = SP[k], c = i % 10, r = Math.floor(i / 10);
    return '<span class="sp ' + (cls || '') + '" style="background-position:' + (c / 9 * 100).toFixed(3) + '% ' + (r / 8 * 100).toFixed(3) + '%"></span>';
  }
  function icon(obj, cls) {
    var k = spKey(obj);
    if (k) return '<span class="ic ' + (cls || '') + ' i3d" style="--c:' + (obj.color || color(obj.id)) + '">' + sprite(k) + '</span>'; var has = !!ICONS[key3d(obj.icon)]; return '<span class="ic ' + (cls || '') + (has ? ' i3d' : '') + '" style="--c:' + (obj.color || color(obj.id)) + '">' + img3d(obj.icon) + '</span>'; }
  function picker(cur, curSp) {
    return '<div class="icon-pick">' + Object.keys(SP).map(function (k) { return '<button type="button" data-sp="' + k + '" class="' + (curSp === k ? 'on' : '') + '">' + sprite(k) + '</button>'; }).join('') + '</div>';
  }
  function bindSpPicker(root, state) {
    root.querySelector('.icon-pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; state.sp = b.dataset.sp; root.querySelectorAll('.icon-pick button').forEach(function (x) { x.classList.toggle('on', x === b); }); var pv = root.querySelector('.ic.preview'); if (pv) pv.innerHTML = sprite(state.sp); haptic(); });
  }
  function pickerOld(cur) { return '<div class="icon-pick">' + Object.keys(ICONS).map(function (e) { return '<button type="button" data-e="' + e + '" class="' + (key3d(cur) === e ? 'on' : '') + '">' + img3d(e) + '</button>'; }).join('') + '</div>'; }
  function bindPicker(root, input, preview) { root.querySelector('.icon-pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; input.value = b.dataset.e; root.querySelectorAll('.icon-pick button').forEach(function (x) { x.classList.toggle('on', x === b); }); if (preview) preview(); haptic(); }); }
  function included(w) { return !w.excluded; }
  function fmtInput(el) { el.addEventListener('input', function () { var n = parseNum(el.value); el.value = n ? n.toLocaleString('id-ID') : ''; }); }

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
  // Loading pill for slower work. Several jobs can overlap; it hides when all finish.
  var busyN = 0, busyShowT = null;
  function busy(on, label) {
    var el = $('busy'); if (!el) return;
    busyN = Math.max(0, busyN + (on ? 1 : -1));
    if (on) { if (label) $('busyTxt').textContent = label; clearTimeout(busyShowT); busyShowT = setTimeout(function () { if (busyN) { el.hidden = false; void el.offsetWidth; el.classList.add('show'); document.body.classList.add('busy-on'); } }, 250); }
    else if (!busyN) { clearTimeout(busyShowT); el.classList.remove('show'); document.body.classList.remove('busy-on'); setTimeout(function () { if (!busyN) el.hidden = true; }, 380); }
  }
  function hideSplash() {
    var sp = document.getElementById('splash'); if (!sp) return;
    var wait = Math.max(0, 1150 - (Date.now() - (window.__splashT0 || 0)));
    setTimeout(function () { sp.classList.add('out'); document.body.classList.add('app-in'); setTimeout(function () { sp.remove(); }, 700); }, wait);
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
    var ids = walletIds(w), live = 0, manual = [];
    ids.forEach(function (id) { var lv = liveValue(wallet(id)); if (lv != null) live += lv; else manual.push(id); });
    if (!manual.length) return live;
    var init = S.wallets.reduce(function (a, x) { return a + (manual.indexOf(x.id) !== -1 ? (+x.initial || 0) : 0); }, 0);
    return live + S.tx.reduce(function (a, t) { if (before && t.date >= before) return a; var d = 0; manual.forEach(function (id) { d += delta(t, id); }); return a + d; }, init);
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
    renderHome(); renderTx(); renderBudgets(); renderReport(); renderAccount(); renderDebts(); renderFeatures();
  }

  var EYE_OPEN = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.5 7.5A17 17 0 0 0 2 12s3.6 6 10 6a9.6 9.6 0 0 0 4.4-1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  function renderEye() {
    var h = !!S.settings.hide;
    $('eyeBtn').innerHTML = h ? EYE_OFF : EYE_OPEN; $('hideToggle').checked = h;
    document.documentElement.classList.toggle('privacy', h);
    document.querySelectorAll('[data-priv]').forEach(function (b) { b.innerHTML = h ? EYE_OFF : EYE_OPEN; b.classList.toggle('on', h); b.setAttribute('aria-pressed', h); });
  }
  function togglePrivacy() { S.settings.hide = !S.settings.hide; haptic(); save(); renderAll(); toast(S.settings.hide ? 'Privacy on: all amounts hidden' : 'Amounts visible'); }

  function renderHome() {
    var total = balance('all');
    var liquid = S.wallets.filter(function (w) { return included(w) && groupOf(w) !== 'invest'; }).reduce(function (a, w) { return a + balance(w.id); }, 0);
    var recv = dSum('in', 'remain'), pay = dSum('out', 'remain'), net = total + recvNet() - pay;
    setMoney($('hNet'), net);
    rollTo($('hTotal'), liquid, { rp: false }); rollTo($('hRecv'), recv, { rp: false }); rollTo($('hPay'), pay, { rp: false });
    var hr = new Date().getHours();
    $('hGreet').textContent = hr < 11 ? 'Good morning' : hr < 15 ? 'Good afternoon' : hr < 19 ? 'Good evening' : 'Good night';
    renderUpcoming(); renderRealBtn(); renderKomisi(); renderBizCard();
    var mStart = ym(new Date()) + '-01', open0 = balance('all', mStart), chg = total - open0;
    var chip = $('hChip');
    if (open0 > 0 && chg !== 0) { var pc = chg / open0 * 100; chip.hidden = false; chip.className = 'chip' + (chg < 0 ? ' dn' : ''); chip.textContent = (chg > 0 ? '▲ ' : '▼ ') + Math.abs(pc).toFixed(Math.abs(pc) < 10 ? 1 : 0) + '% this month'; }
    else chip.hidden = true;

    var gt = {}; S.wallets.filter(included).forEach(function (w) { var g = groupOf(w); gt[g] = (gt[g] || 0) + Math.max(0, balance(w.id)); });
    var gsum = Object.keys(gt).reduce(function (x, g) { return x + gt[g]; }, 0) || 1;
    var GC = { cash: 'var(--info)', savings: 'var(--gold)', invest: 'var(--violet)' };
    var order = Object.keys(GROUPS).filter(function (g) { return gt[g] > 0; });
    $('allocTotal').innerHTML = order.length + ' group' + (order.length === 1 ? '' : 's');
    $('allocBar').innerHTML = order.map(function (g, i) { return '<i style="--w:' + (gt[g] / gsum * 100).toFixed(2) + '%;background:' + GC[g] + ';--i:' + i + '"></i>'; }).join('');
    $('allocLegend').innerHTML = order.map(function (g) {
      return '<button class="lg-row" data-group="' + g + '"><i style="background:' + GC[g] + '"></i><span class="grow">' + GROUPS[g].name + '</span><span class="muted small">' + Math.round(gt[g] / gsum * 100) + '%</span><b>' + money(gt[g], { rp: false }) + '</b></button>';
    }).join('');
    renderSpark();
    renderCashflow(); renderDonut();
    renderStack();

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
      : '<div class="empty">' + dinoImg('empty-dino') + '<b>Nothing here yet</b><br>Tap + or wait for your next BCA payment.</div>';

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

  // Net worth trend (wallet balances at the end of each day).
  var sparkDays = 30, SPK = null, scrubbing = false;
  function bindScrub() {
    var svg = $('hSpark'), lbl = $('hScrubLbl');
    function at(x) {
      if (!SPK) return; var r = svg.getBoundingClientRect(); var f = Math.max(0, Math.min(1, (x - r.left) / r.width));
      var i = Math.round(f * (SPK.pts.length - 1)), p = SPK.xy[i], g = svg.querySelector('.sp-scrub');
      if (!g) return; g.removeAttribute('hidden'); g.querySelector('line').setAttribute('x1', p[0]); g.querySelector('line').setAttribute('x2', p[0]);
      var c = g.querySelector('circle'); c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]);
      if (i !== at.last) { at.last = i; haptic(); }
      var v = SPK.pts[i] + SPK.offset, txt = money(v); $('hNet').innerHTML = txt; delete $('hNet').dataset.sig;
      if (!S.settings.hide) RS.hNet = { sig: txt.replace(/\d/g, '0'), digits: txt.replace(/\D/g, '').split('').map(Number), v: v };
      var d = SPK.dates[i]; lbl.textContent = d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); lbl.style.left = (f * 100) + '%'; lbl.hidden = false;
    }
    function end() { if (!scrubbing) return; scrubbing = false; document.body.classList.remove('scrubbing'); lbl.hidden = true; var g = svg.querySelector('.sp-scrub'); if (g) g.setAttribute('hidden', ''); at.last = -1; if (SPK) rollTo($('hNet'), SPK.pts[SPK.pts.length - 1] + SPK.offset); }
    svg.addEventListener('touchstart', function (e) { scrubbing = true; document.body.classList.add('scrubbing'); at(e.touches[0].clientX); }, { passive: true });
    svg.addEventListener('touchmove', function (e) { if (scrubbing) { e.preventDefault(); at(e.touches[0].clientX); } }, { passive: false });
    svg.addEventListener('touchend', end); svg.addEventListener('touchcancel', end);
    svg.addEventListener('mousemove', function (e) { scrubbing = true; at(e.clientX); }); svg.addEventListener('mouseleave', end);
  }
  function renderSpark() {
    var n = sparkDays, now = new Date(), pts = [];
    var step = n > 120 ? 7 : 1;
    for (var k = n; k >= 0; k -= step) { var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k + 1); pts.push(balance('all', ymd(d))); }
    var mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), W = 360, H = 96, pad = 8;
    var flat = mx === mn; if (flat) { mn -= 1; mx += 1; }
    var xy = pts.map(function (v, i) { return [i / (pts.length - 1) * W, pad + (1 - (v - mn) / (mx - mn)) * (H - pad * 2)]; });
    var d = xy.map(function (p, i) {
      if (!i) return 'M' + p[0].toFixed(1) + ',' + p[1].toFixed(1);
      var q = xy[i - 1], cx = (q[0] + p[0]) / 2;
      return 'C' + cx.toFixed(1) + ',' + q[1].toFixed(1) + ' ' + cx.toFixed(1) + ',' + p[1].toFixed(1) + ' ' + p[0].toFixed(1) + ',' + p[1].toFixed(1);
    }).join('');
    var first = pts[0], last = pts[pts.length - 1], diff = last - first, up = diff >= 0;
    var col = up ? 'var(--pos)' : 'var(--neg)', end = xy[xy.length - 1];
    $('hSpark').innerHTML = '<defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (up ? '#34d399' : '#f87171') + '" stop-opacity=".28"/><stop offset="1" stop-color="' + (up ? '#34d399' : '#f87171') + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="sp-area" d="' + d + ' L' + W + ',' + H + ' L0,' + H + 'Z" fill="url(#spg)"/>' +
      '<path class="sp-line" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke" pathLength="1"/>' +
      '<circle class="sp-pulse" cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="3.5" fill="' + col + '"/>' +
      '<circle class="sp-dot" cx="' + end[0].toFixed(1) + '" cy="' + end[1].toFixed(1) + '" r="3.5" fill="' + col + '"/>' +
      '<g class="sp-scrub" hidden><line y1="0" y2="' + H + '" stroke="var(--ink2)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/><circle r="5" fill="' + col + '" stroke="var(--bg)" stroke-width="2" vector-effect="non-scaling-stroke"/></g>';
    var dates = []; for (var k2 = n; k2 >= 0; k2 -= step) dates.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - k2));
    SPK = { pts: pts, xy: xy, dates: dates, W: W, offset: (balance('all') + recvNet() - dSum('out', 'remain')) - last };
    var chip = $('hChip'), lbl = { 7: '1W', 30: '1M', 90: '3M', 365: '1Y' }[n];
    chip.hidden = false; chip.className = 'chip' + (up ? '' : ' dn');
    var pc = first ? Math.abs(diff / first * 100) : 0;
    chip.innerHTML = (up ? '▲ ' : '▼ ') + money(Math.abs(diff), { rp: true }) + ' · ' + pc.toFixed(pc < 10 ? 1 : 0) + '% · ' + lbl;
    document.querySelectorAll('#hRange button').forEach(function (b) { b.classList.toggle('on', +b.dataset.r === n); });
  }

  // ---------- wallet card stack (tap to fan out, hold to drag) ----------
  var stackOpen = false, CARD_H = 92, GAP = 10;
  var GCARD = { cash: ['#2563eb', '#1e3a8a'], savings: ['#b8893b', '#5c3d0e'], invest: ['#7c3aed', '#3b0764'] };
  function renderStack() {
    var ws = S.wallets.filter(included);
    $('hWallets').innerHTML = '<div class="wstack' + (stackOpen ? ' open' : '') + '">' + ws.map(function (w, i) {
      var g = GCARD[groupOf(w)] || ['#059669', '#064e3b'], u = typeof unpaidIn === 'function' ? unpaidIn(w.id) : 0;
      return '<div class="wcard" data-wallet="' + esc(w.id) + '" data-id="' + esc(w.id) + '" style="--a:' + g[0] + ';--b:' + g[1] + ';--i:' + i + '">' +
        '<span class="wc-3d">' + (spKey(w) ? sprite(spKey(w)) : '<b>' + esc(w.icon) + '</b>') + '</span>' +
        '<div class="wc-top"><span class="wc-name">' + esc(w.name) + '</span><span class="wc-grp">' + (GROUPS[groupOf(w)] || {}).name + '</span></div>' +
        '<div class="wc-bot"><span class="wc-amt">' + money(balance(w.id)) + '</span>' + (plTag(w) || (u ? '<span class="wc-sub">' + money(u, { rp: false }) + ' not received</span>' : '')) + '</div><i class="wc-shine"></i></div>';
    }).join('') + '<button class="ws-close" type="button">Close</button><div class="ws-hint">' + ws.length + ' wallets · tap to open</div></div>';
    layoutStack();
    var st = $('hWallets').querySelector('.wstack');
    makeSortable(st, '.wcard', null, function (ids) { reorderWallets(ids); }, function () { return stackOpen; });
  }
  function layoutStack() {
    var st = $('hWallets') && $('hWallets').querySelector('.wstack'); if (!st) return;
    var cs = [].slice.call(st.querySelectorAll('.wcard')), n = cs.length;
    st.classList.toggle('open', stackOpen);
    cs.forEach(function (c, i) {
      if (stackOpen) { c.style.transform = 'translateY(' + (i * (CARD_H + GAP)) + 'px)'; c.style.opacity = 1; c.style.zIndex = n - i; c.style.transitionDelay = (i * 35) + 'ms'; }
      else { var k = Math.min(i, 3); c.style.transform = 'translateY(' + (k * 12) + 'px) scale(' + (1 - k * .05) + ')'; c.style.opacity = i > 2 ? 0 : 1 - k * .12; c.style.zIndex = n - i; c.style.transitionDelay = ((n - i) * 18) + 'ms'; }
    });
    st.style.height = (stackOpen ? n * (CARD_H + GAP) + 40 : CARD_H + 24 + 26) + 'px';
  }
  function reorderWallets(ids) {
    var by = {}; S.wallets.forEach(function (w) { by[w.id] = w; });
    var moved = ids.map(function (id) { return by[id]; }).filter(Boolean);
    var rest = S.wallets.filter(function (w) { return ids.indexOf(w.id) === -1; });
    S.wallets = moved.concat(rest); save(); renderAll(); toast('Order saved');
  }
  // Generic drag-to-reorder. handleSel: drag from a handle; null: press and hold the item.
  function makeSortable(box, itemSel, handleSel, onDrop, enabled) {
    if (!box) return;
    var drag = null, holdT = null;
    function items() { return [].slice.call(box.querySelectorAll(itemSel)); }
    function start(item, y) {
      var list = items(), rects = list.map(function (el) { return el.getBoundingClientRect(); });
      drag = { item: item, list: list, rects: rects, from: list.indexOf(item), to: list.indexOf(item), y0: y, base: item.style.transform || '' };
      item.classList.add('dragging'); box.classList.add('sorting'); haptic();
    }
    function move(y) {
      var d = drag, dy = y - d.y0, r0 = d.rects[d.from], mid = r0.top + r0.height / 2 + dy, to = d.from;
      d.rects.forEach(function (r, i) { if (i < d.from && mid < r.top + r.height / 2) to = Math.min(to, i); if (i > d.from && mid > r.top + r.height / 2) to = Math.max(to, i); });
      d.to = to;
      d.item.style.transform = d.base + ' translateY(' + dy + 'px) scale(1.03)';
      d.list.forEach(function (el, i) {
        if (el === d.item) return; var sh = 0, h = r0.height + (d.rects[1] ? Math.max(0, d.rects[1].top - d.rects[0].bottom) : 8);
        if (d.from < to && i > d.from && i <= to) sh = -h; if (d.from > to && i >= to && i < d.from) sh = h;
        el.style.translate = '0 ' + sh + 'px';
      });
    }
    function end() {
      var d = drag; drag = null; if (!d) return;
      d.item.classList.remove('dragging'); box.classList.remove('sorting');
      d.list.forEach(function (el) { el.style.translate = ''; }); d.item.style.transform = d.base;
      if (d.to !== d.from) { var ids = d.list.map(function (el) { return el.dataset.id; }); ids.splice(d.to, 0, ids.splice(d.from, 1)[0]); box.dataset.dragged = '1'; onDrop(ids); }
    }
    box.addEventListener('touchstart', function (e) {
      if (enabled && !enabled()) return;
      var item = e.target.closest(itemSel); if (!item || !box.contains(item)) return;
      var y = e.touches[0].clientY;
      if (handleSel) { if (!e.target.closest(handleSel)) return; start(item, y); return; }
      clearTimeout(holdT); holdT = setTimeout(function () { start(item, y); }, 380);
    }, { passive: true });
    box.addEventListener('touchmove', function (e) { if (drag) { e.preventDefault(); move(e.touches[0].clientY); } else clearTimeout(holdT); }, { passive: false });
    box.addEventListener('touchend', function () { clearTimeout(holdT); end(); });
    box.addEventListener('touchcancel', function () { clearTimeout(holdT); end(); });
    // mouse (desktop)
    box.addEventListener('mousedown', function (e) {
      if (enabled && !enabled()) return; var item = e.target.closest(itemSel); if (!item) return;
      if (handleSel && !e.target.closest(handleSel)) return;
      var y = e.clientY; holdT = setTimeout(function () { start(item, y); }, handleSel ? 0 : 380);
      function mm(ev) { if (drag) move(ev.clientY); }
      function mu() { clearTimeout(holdT); document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); end(); }
      document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu);
    });
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
    var realMax = Math.max.apply(null, months.map(function (m) { return Math.max(m.tout, m.tin); })), max = realMax || 1;
    if (cfSel == null || cfSel >= months.length) cfSel = months.length - 1;
    var ticks = [1, .75, .5, .25, 0].map(function (f) { return S.settings.hide || !realMax ? '' : short(max * f); });
    $('cfChart').innerHTML = '<div class="cf-chart' + (still ? ' still' : '') + '"><div class="cf-y">' + ticks.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div><div class="cf-plot">' +
      months.map(function (m, i) {
        var hi = Math.max(m.tin ? 3 : 1.5, m.tin / max * 100), ho = Math.max(m.tout ? 3 : 1.5, m.tout / max * 100);
        return '<button class="cf-bar pair' + (i === cfSel ? ' sel' : '') + '" data-i="' + i + '" style="--i:' + i + '" aria-label="' + m.full + '"><i class="in" style="height:' + hi.toFixed(1) + '%"></i><i class="out" style="height:' + ho.toFixed(1) + '%"></i></button>';
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
    var barTop = Math.min.apply(null, [].map.call(bar.querySelectorAll('i'), function (x) { return x.offsetTop; }));
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
    if (!mt.length) { $('txList').innerHTML = '<div class="card empty">' + dinoImg('empty-dino') + '<br>No transactions in ' + MONTHS[cur.getMonth()] + '.</div>'; return; }
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
      (t.src === 'bca' ? '<span class="badge">BCA</span>' : '') + (t.files && t.files.length ? '<span class="clip" title="Attachments">📎' + (t.files.length > 1 ? t.files.length : '') + '</span>' : '') + '</div><div class="tx-note">' + esc(sub) + '</div></div>' +
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
    ensureAccounts();
    $('acctList').innerHTML = s.bcaAccounts.map(function (a, i) {
      return '<div class="acct-row"><div class="grow"><b>' + esc(a.mask) + '</b><span class="sub">' + esc(a.label || '') + '</span></div><select data-acct="' + i + '"><option value="">Default wallet</option>' + S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === a.wallet ? ' selected' : '') + '>' + esc(w.icon + ' ' + w.name) + '</option>'; }).join('') + '</select><button class="x" data-delacct="' + i + '" aria-label="Remove">×</button></div>';
    }).join('');

    $('walletList').innerHTML = S.wallets.map(function (w) {
      return '<button class="w-row" data-id="' + esc(w.id) + '" data-edit-wallet="' + esc(w.id) + '"><span class="drag" aria-label="Drag">≡</span>' + icon(w) + '<span class="grow">' + esc(w.name) + '<span class="sub">' + money(balance(w.id)) + (w.excluded ? ' · not in total' : '') + '</span>' + plTag(w) + '</span><span class="muted">›</span></button>';
    }).join('');
    if (!$('walletList').dataset.sortable) { $('walletList').dataset.sortable = 1; makeSortable($('walletList'), '.w-row', '.drag', function (ids) { reorderWallets(ids); }); }
    document.querySelectorAll('#catSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === catTab); });
    $('catSeg').style.setProperty('--x', ['expense', 'income', 'debt'].indexOf(catTab) * 100 + '%');
    $('catList').innerHTML = catTree(catTab).map(function (c) {
      return '<button class="w-row' + (c.parent ? ' child' : '') + '" data-edit-cat="' + esc(c.id) + '">' + icon(c, 'sm') + '<span class="grow">' + esc(c.name) + (c.flow ? '<span class="sub">' + (c.flow === 'in' ? 'Money in' : 'Money out') + '</span>' : '') + '</span>' + (LOCKED.indexOf(c.id) !== -1 ? '<span class="lock" title="Built in">🔒</span>' : '') + '<span class="muted">›</span></button>';
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

  // ---------- money owed (receivables + payables) ----------
  var dDir = 'in', dFilter = 'open';
  var ST_LABEL = { unpaid: 'Unpaid', partial: 'Partially paid', paid: 'Fully paid', overdue: 'Overdue', cancelled: 'Cancelled', writtenoff: 'Written off' };
  function today() { return ymd(new Date()); }
  function debtById(id) { return S.debts.filter(function (d) { return d.id === id; })[0]; }
  function dPaid(d) { return (d.payments || []).reduce(function (a, p) { return a + p.amount; }, 0); }
  function dRemain(d) { return Math.max(0, d.amount - dPaid(d)); }
  function dStatus(d) {
    if (d.closed === 'cancelled') return 'cancelled';
    if (d.closed === 'writtenoff') return 'writtenoff';
    var paid = dPaid(d);
    if (paid >= d.amount) return 'paid';
    if (d.due && d.due < today()) return 'overdue';
    return paid > 0 ? 'partial' : 'unpaid';
  }
  function dOpen(d) { var s2 = dStatus(d); return s2 !== 'paid' && s2 !== 'cancelled' && s2 !== 'writtenoff'; }
  function recvNet() { return S.debts.filter(function (d) { return d.dir === 'in' && !d.closed && !d.prebooked && dOpen(d); }).reduce(function (a, d) { return a + dRemain(d); }, 0); }
  function dSum(dir, what) {
    return S.debts.filter(function (d) { return d.dir === dir && !d.closed; }).reduce(function (a, d) {
      return a + (what === 'remain' ? (dOpen(d) ? dRemain(d) : 0) : what === 'paid' ? dPaid(d) : what === 'over' ? (dStatus(d) === 'overdue' ? dRemain(d) : 0) : d.amount);
    }, 0);
  }
  function initials(n) { return String(n || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase(); }
  function avatar(n) { return '<span class="av" style="--c:' + color('p' + String(n).toLowerCase()) + '">' + esc(initials(n)) + '</span>'; }
  function dueText(d) {
    if (!d.due) return 'No due date';
    var days = Math.round((new Date(d.due + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
    if (dStatus(d) === 'paid') return 'Due ' + fmtDate(d.due);
    return days < 0 ? 'Overdue ' + (-days) + ' day' + (days === -1 ? '' : 's') : days === 0 ? 'Due today' : 'Due in ' + days + ' day' + (days === 1 ? '' : 's');
  }
  function fmtDate(s) { var x = new Date(s + 'T00:00:00'); return x.getDate() + ' ' + MONTHS[x.getMonth()].slice(0, 3) + ' ' + x.getFullYear(); }

  function renderDebts() {
    var dir = dDir, list = S.debts.filter(function (d) { return d.dir === dir; });
    document.querySelectorAll('#dSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.d === dir); });
    $('dSeg').style.setProperty('--x', dir === 'in' ? '0%' : '100%');
    document.querySelectorAll('#dFilter button').forEach(function (b) { b.classList.toggle('on', b.dataset.f === dFilter); });
    var tot = dSum(dir, 'amount'), paid = dSum(dir, 'paid'), rem = dSum(dir, 'remain'), over = dSum(dir, 'over');
    $('dHeroLbl').textContent = dir === 'in' ? 'Owed to me' : 'I owe';
    $('dPaidLbl').textContent = dir === 'in' ? 'Collected' : 'Paid back';
    rollTo($('dOut'), rem);
    $('dTotal').innerHTML = money(tot, { rp: false }); $('dPaid').innerHTML = money(paid, { rp: false }); $('dOver').innerHTML = money(over, { rp: false });
    var openN = list.filter(dOpen).length;
    $('dHeroSub').textContent = openN + ' open · ' + list.filter(function (d) { return dStatus(d) === 'overdue'; }).length + ' overdue';
    var pct = tot ? Math.round(paid / tot * 100) : 0;
    $('dRingTxt').textContent = pct + '%';
    requestAnimationFrame(function () { $('dRing').style.strokeDashoffset = (113.1 * (1 - pct / 100)).toFixed(1); });

    var q = $('dQ').value.trim().toLowerCase();
    var f = dFilter;
    list = list.filter(function (d) {
      var st = dStatus(d);
      if (q && (d.person + ' ' + (d.title || '') + ' ' + (d.tags || '')).toLowerCase().indexOf(q) === -1) return false;
      if (f === 'open') return dOpen(d); if (f === 'all') return true; if (f === 'closed') return st === 'cancelled' || st === 'writtenoff';
      return st === f;
    });
    var so = $('dSort').value;
    list.sort(function (a, b) {
      if (so === 'due') return (a.due || '9999') .localeCompare(b.due || '9999');
      if (so === 'recent') return (b.created || '').localeCompare(a.created || '') || b.ts - a.ts;
      if (so === 'name') return a.person.localeCompare(b.person);
      return dRemain(b) - dRemain(a);
    });
    $('dList').innerHTML = list.length ? '<div class="stagger">' + list.map(function (d, i) {
      var st = dStatus(d), p = dPaid(d), pc = d.amount ? Math.min(100, Math.round(p / d.amount * 100)) : 0;
      return '<div class="d-card" style="--i:' + i + '"><div class="d-top">' + avatar(d.person) + '<div class="grow"><div class="d-name">' + esc(d.person) + '</div><div class="d-title">' + esc(d.title || (dir === 'in' ? 'Owes me' : 'I owe')) + '</div></div><span class="st ' + st + '">' + ST_LABEL[st] + '</span></div>' +
        '<div class="d-amts"><div><small>Remaining</small><span class="mid-money">' + money(dRemain(d)) + '</span></div><div style="text-align:right"><small>' + pc + '% ' + (dir === 'in' ? 'collected' : 'paid') + '</small><span class="muted small">' + money(p, { rp: false }) + ' of ' + money(d.amount, { rp: false }) + '</span></div></div>' +
        '<div class="d-prog ' + (st === 'overdue' ? 'overdue' : st === 'partial' ? 'partial' : '') + '"><i data-w="' + pc + '"></i></div>' +
        '<div class="d-meta"><span>' + dueText(d) + '</span><span>' + (d.payments || []).length + ' payment' + ((d.payments || []).length === 1 ? '' : 's') + '</span></div>' +
        '<div class="d-actions">' + (dOpen(d) ? '<button class="btn primary" data-pay="' + esc(d.id) + '">＋ Record payment</button>' : '<button class="btn" disabled style="opacity:.5">' + ST_LABEL[st] + '</button>') + '<button class="btn" data-view="' + esc(d.id) + '">View details</button></div></div>';
    }).join('') + '</div>' : '<div class="card empty"><span class="big-e">' + img3d(dir === 'in' ? '🧾' : '💸') + '</span>' + (S.debts.some(function (d) { return d.dir === dir; }) ? 'Nothing matches this filter.' : (dir === 'in' ? 'Nobody owes you money yet.<br>Tap ＋ to add someone, for example Dad owes you Rp 100.000.000.' : 'You don\'t owe anyone.<br>Tap ＋ to track money you borrowed.')) + '</div>';
    growBars($('dList'));
  }

  function renderUpcoming() {
    var soon = ymd(new Date(Date.now() + 14 * 864e5));
    var list = S.debts.filter(function (d) { return dOpen(d) && d.due && d.due <= soon; }).sort(function (a, b) { return a.due.localeCompare(b.due); }).slice(0, 4);
    $('upHead').hidden = $('hUpcoming').hidden = !list.length;
    $('hUpcoming').innerHTML = list.map(function (d) {
      var st = dStatus(d);
      return '<button class="w-row" data-view="' + esc(d.id) + '">' + avatar(d.person) + '<span class="grow">' + esc(d.person) + '<span class="sub" style="color:' + (st === 'overdue' ? 'var(--neg)' : 'var(--muted)') + '">' + (d.dir === 'in' ? 'Owes you · ' : 'You owe · ') + dueText(d) + '</span></span><span class="amt ' + (d.dir === 'in' ? 'pos' : 'neg') + '">' + money(dRemain(d), { rp: false }) + '</span></button>';
    }).join('');
  }

  function walletOpts(sel) { return S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === sel ? ' selected' : '') + '>' + esc(w.icon + ' ' + w.name) + '</option>'; }).join(''); }
  function addTx(o) { var t = Object.assign({ id: uid(), toWallet: '', time: hm(new Date()), note: '', merchant: '', src: 'manual', created: Date.now() }, o); S.tx.push(t); return t; }

  function debtSheet(d, dir) {
    var isNew = !d;
    d = d || { id: uid(), dir: dir || 'in', person: '', title: '', amount: 0, created: today(), due: '', tags: '', notes: '', wallet: S.settings.bcaWallet || (S.wallets[0] || {}).id, payments: [], ts: Date.now() };
    openSheet('<h3>' + (isNew ? 'New record' : 'Edit record') + '</h3>' +
      '<div class="seg d-seg" id="nDir" style="--x:' + (d.dir === 'in' ? '0%' : '100%') + '"><button data-d="in" class="' + (d.dir === 'in' ? 'on' : '') + '">Owed to me</button><button data-d="out" class="' + (d.dir === 'out' ? 'on' : '') + '">I owe</button><i class="seg-ind"></i></div>' +
      '<label class="fld">Person or company<input id="nPerson" value="' + esc(d.person) + '" placeholder="e.g. Dad"></label>' +
      '<label class="fld">WhatsApp number (optional)<input id="nPhone" inputmode="tel" value="' + esc(d.phone || '') + '" placeholder="08…"></label>' +
      '<label class="fld">Title<input id="nTitle" value="' + esc(d.title) + '" placeholder="e.g. House renovation loan"></label>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="nAmt" inputmode="numeric" placeholder="0" value="' + (d.amount ? d.amount.toLocaleString('id-ID') : '') + '"></div>' +
      '<div class="two"><label class="fld">Date<input id="nDate" type="date" value="' + esc(d.created) + '"></label><label class="fld">Due date (optional)<input id="nDue" type="date" value="' + esc(d.due || '') + '"></label></div>' +
      '<label class="fld">Linked wallet<select id="nWallet">' + walletOpts(d.wallet) + '</select></label>' +
      (isNew ? '<label class="set-row plain"><span class="grow small" id="nMoveLbl"></span><input type="checkbox" class="switch" id="nMove"></label>' : '') +
      '<label class="fld">Tags (optional)<input id="nTags" value="' + esc(d.tags || '') + '" placeholder="family, business"></label>' +
      '<label class="fld">Notes<textarea id="nNotes" rows="2">' + esc(d.notes || '') + '</textarea></label>' +
      '<button class="btn primary block" id="nSave">Save</button>',
      function (r) {
        var amt = r.querySelector('#nAmt'); fmtInput(amt);
        var dirNow = d.dir;
        function lbl() { var ml = r.querySelector('#nMoveLbl'); if (ml) ml.textContent = dirNow === 'in' ? 'I paid this out of my wallet now (lend / paid upfront for them)' : 'I received this money into my wallet now (borrowed)'; }
        lbl();
        r.querySelector('#nDir').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; dirNow = b.dataset.d; this.style.setProperty('--x', dirNow === 'in' ? '0%' : '100%'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); lbl(); haptic(); };
        if (isNew) setTimeout(function () { r.querySelector('#nPerson').focus(); }, 380);
        r.querySelector('#nSave').onclick = function () {
          var person = r.querySelector('#nPerson').value.trim(), a = parseNum(amt.value);
          if (!person) { toast('Who is it?'); return; } if (!a) { toast('Enter the amount'); return; }
          Object.assign(d, { dir: dirNow, person: person, title: r.querySelector('#nTitle').value.trim(), amount: a, created: r.querySelector('#nDate').value || today(), due: r.querySelector('#nDue').value, wallet: r.querySelector('#nWallet').value, tags: r.querySelector('#nTags').value.trim(), notes: r.querySelector('#nNotes').value.trim(), phone: r.querySelector('#nPhone').value.trim() });
          if (isNew) {
            S.debts.push(d);
            var mv = r.querySelector('#nMove');
            if (mv && mv.checked) { var t = addTx({ type: 'debt', cat: d.dir === 'in' ? 'loan' : 'debt', amount: a, wallet: d.wallet, date: d.created, merchant: person, note: d.title, debtId: d.id }); d.startTx = t.id; }
          }
          dDir = d.dir; haptic(); save(); closeSheet(); renderAll(); toast(isNew ? 'Saved ✓' : 'Updated ✓');
        };
      });
  }

  function paySheet(d) {
    if (!d) return;
    var rem = dRemain(d), inn = d.dir === 'in';
    openSheet('<h3>' + (inn ? 'Record payment' : 'Record repayment') + '</h3>' +
      (d.prebooked ? '<p class="muted small" style="text-align:center;margin:-6px 0 10px">This money is already counted in ' + esc(wallet(d.wallet).name) + '. Recording it only lowers what ' + esc(d.person) + ' still owes.</p>' : '') +
      '<div class="d-top" style="margin-bottom:10px">' + avatar(d.person) + '<div class="grow"><div class="d-name">' + esc(d.person) + '</div><div class="d-title">Remaining ' + money(rem) + '</div></div></div>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="pAmt" inputmode="numeric" placeholder="0"></div>' +
      '<div class="quick-amts"><button type="button" data-a="' + rem + '">Full ' + money(rem, { rp: false }) + '</button><button type="button" data-a="' + Math.round(rem / 2) + '">50%</button><button type="button" data-a="' + Math.round(rem / 4) + '">25%</button></div>' +
      '<div class="two"><label class="fld">Date<input id="pDate" type="date" value="' + today() + '"></label><label class="fld">' + (inn ? 'Received into' : 'Paid from') + '<select id="pWallet">' + walletOpts(d.wallet) + '</select></label></div>' +
      '<label class="fld">Note (optional)<input id="pNote" placeholder="e.g. transfer from BCA"></label>' +
      '<button class="btn primary block" id="pSave">Save payment</button>',
      function (r) {
        var amt = r.querySelector('#pAmt'); fmtInput(amt);
        setTimeout(function () { amt.focus(); }, 380);
        r.querySelector('.quick-amts').onclick = function (e) { var b = e.target.closest('button'); if (b) { amt.value = (+b.dataset.a).toLocaleString('id-ID'); haptic(); } };
        r.querySelector('#pSave').onclick = function () {
          var a = parseNum(amt.value); if (!a) { toast('Enter the amount'); return; }
          if (a > rem && !confirm('This is more than the remaining ' + 'Rp ' + fmt(rem) + '. Save anyway?')) return;
          var date = r.querySelector('#pDate').value || today(), w = r.querySelector('#pWallet').value, note = r.querySelector('#pNote').value.trim();
          var t = d.prebooked ? { id: null } : addTx({ type: d.earned ? 'income' : 'debt', cat: d.earned ? (d.incomeCat || 'other_in') : inn ? 'debt_collection' : 'repayment', amount: a, wallet: w, date: date, merchant: d.person, note: note || d.title, debtId: d.id });
          d.payments = d.payments || []; d.payments.push({ id: uid(), amount: a, date: date, wallet: w, note: note, txId: t.id });
          var done = dPaid(d) >= d.amount;
          haptic(); save(); closeSheet(); renderAll();
          toast(done ? (inn ? 'Fully paid 🎉' : 'All paid back 🎉') : 'Payment saved ✓');
          if (done) { var fr = $('fab').getBoundingClientRect(); burst(fr.left + fr.width / 2, fr.top); }
        };
      });
  }

  // Money booked into a wallet that has not actually arrived yet ("Not received yet" income).
  function unpaidIn(walletId) { return S.debts.filter(function (d) { return d.prebooked && !d.closed && dOpen(d) && (walletId == null || d.wallet === walletId); }).reduce(function (a, d) { return a + dRemain(d); }, 0); }
  function realBalance(walletId) { return balance(walletId) - unpaidIn(walletId === 'all' ? null : walletId); }
  function renderRealBtn() {
    var el = $('realBtn'); if (!el) return;
    var u = unpaidIn(null), owing = S.debts.filter(function (d) { return d.dir === 'in' && dOpen(d); }).length;
    el.hidden = !u && !owing;
    $('realAmt').innerHTML = money(realBalance('all'), { rp: true });
  }
  function realSheet() {
    var tot = balance('all'), unp = unpaidIn(null), real = tot - unp;
    var rows = S.wallets.filter(function (w) { return !w.excluded && (balance(w.id) || unpaidIn(w.id)); }).map(function (w) {
      var b = balance(w.id), u = unpaidIn(w.id);
      return '<div class="rw">' + icon(w, 'sm') + '<div class="grow"><b>' + esc(w.name) + '</b>' + (u ? '<span class="sub">' + money(b, { rp: false }) + ' booked · ' + money(u, { rp: false }) + ' not received</span>' : '') + '</div><span class="amt">' + money(b - u) + '</span></div>';
    }).join('');
    var owers = S.debts.filter(function (d) { return d.dir === 'in' && dOpen(d); }).sort(function (a, b) { return dRemain(b) - dRemain(a); });
    var oweTot = owers.reduce(function (a, d) { return a + dRemain(d); }, 0);
    openSheet('<h3>Real money</h3>' +
      '<div class="card real-hero"><div class="eyebrow">Actually in your accounts</div><div class="mid-money xl">' + money(real) + '</div>' +
      '<div class="real-bar"><i class="r" style="--w:' + (tot > 0 ? Math.max(0, real / tot * 100) : 100).toFixed(1) + '%"></i><i class="u" style="--w:' + (tot > 0 ? Math.min(100, unp / tot * 100) : 0).toFixed(1) + '%"></i></div>' +
      '<div class="real-legend"><span><i class="r"></i>Received ' + money(real, { rp: false }) + '</span><span><i class="u"></i>Not received yet ' + money(unp, { rp: false }) + '</span></div></div>' +
      '<div class="sheet-sec">By wallet</div><div class="card list-card">' + (rows || '<p class="muted small pad" style="padding-bottom:12px">All wallets are at 0.</p>') + '</div>' +
      '<div class="sheet-sec">Who owes you · ' + money(oweTot, { rp: true }) + '</div><div class="card list-card">' +
      (owers.length ? owers.map(function (d) {
        var st = dStatus(d), pc = d.amount ? Math.round(dPaid(d) / d.amount * 100) : 0;
        return '<button class="w-row" data-owe="' + esc(d.id) + '">' + avatar(d.person) + '<span class="grow">' + esc(d.person) + '<span class="sub">' + esc(d.title || 'Owes you') + (d.prebooked ? ' · in ' + esc(wallet(d.wallet).name) : '') + ' · ' + (st === 'overdue' ? '<em class="neg">' + dueText(d) + '</em>' : dueText(d)) + '</span><span class="bill-bar"><i style="--w:' + pc + '%"></i></span></span><span class="amt pos">' + money(dRemain(d), { rp: false }) + '</span></button>';
      }).join('') : '<p class="muted small pad" style="padding-bottom:12px">Nobody owes you money right now.</p>') + '</div>',
      function (r) { r.addEventListener('click', function (e) { var b = e.target.closest('[data-owe]'); if (b) debtDetail(debtById(b.dataset.owe)); }); });
  }
  // ---------- Komisi Noah: commission per month ----------
  function komisiCats() { return Object.keys(S.settings.autoOwed || {}); }
  function komisiRecs() { var cs = komisiCats(); return S.debts.filter(function (d) { return d.earned && cs.indexOf(d.incomeCat) !== -1 && d.closed !== 'cancelled'; }); }
  function komisiByMonth() {
    var by = {};
    komisiRecs().forEach(function (d) { var k = d.created.slice(0, 7); var m = by[k] = by[k] || { k: k, earned: 0, paid: 0, recs: [] }; m.earned += d.amount; m.paid += Math.min(d.amount, dPaid(d)); m.recs.push(d); });
    return Object.keys(by).sort().reverse().map(function (k) { return by[k]; });
  }
  function monthName(k) { var d = new Date(k + '-01T00:00:00'); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function renderKomisi() {
    var el = $('hKomisi'); if (!el) return;
    var ms = komisiByMonth(), cur = ms.filter(function (m) { return m.k === ym(new Date()); })[0] || { earned: 0, paid: 0 };
    var owe = ms.reduce(function (a, m) { return a + m.earned - m.paid; }, 0), total = ms.reduce(function (a, m) { return a + m.earned; }, 0);
    var last6 = ms.slice(0, 6).reverse(), max = Math.max.apply(null, last6.map(function (m) { return m.earned; }).concat([1]));
    el.innerHTML = '<div class="km-top"><div><div class="eyebrow">Dad still owes</div><div class="mid-money">' + money(owe) + '</div><div class="muted small">This month ' + money(cur.earned, { rp: false }) + ' earned · ' + money(cur.paid, { rp: false }) + ' paid</div></div><span class="km-ic">' + sprite('komisi_out') + '</span></div>' +
      (last6.length ? '<div class="km-bars">' + last6.map(function (m, i) { var he = m.earned / max * 100, hp = m.paid / max * 100; return '<div class="km-col" style="--i:' + i + '"><div class="km-b"><i class="e" style="height:' + he.toFixed(1) + '%"></i><i class="p" style="height:' + hp.toFixed(1) + '%"></i></div><span>' + monthName(m.k).slice(0, 3) + '</span></div>'; }).join('') + '</div><div class="km-leg"><span><i class="e"></i>Earned</span><span><i class="p"></i>Paid by Dad</span><span class="muted">Total ' + money(total, { rp: false }) + '</span></div>'
        : '<div class="muted small" style="margin-top:10px">Add income with category RESERVE TRANSFER or KOMISI and it shows here per month.</div>');
  }
  function komisiSheet() {
    var ms = komisiByMonth(), owe = ms.reduce(function (a, m) { return a + m.earned - m.paid; }, 0), earned = ms.reduce(function (a, m) { return a + m.earned; }, 0);
    openSheet('<h3>Komisi Noah</h3><div class="dd-stats" style="margin-top:0;border:0;padding-top:0"><div><small>Total earned</small><b>' + money(earned, { rp: false }) + '</b></div><div><small>Paid by Dad</small><b>' + money(earned - owe, { rp: false }) + '</b></div><div><small>Still owed</small><b class="pos">' + money(owe, { rp: false }) + '</b></div></div>' +
      (ms.length ? ms.map(function (m) {
        var pc = m.earned ? Math.round(m.paid / m.earned * 100) : 0;
        return '<div class="sheet-sec">' + monthName(m.k) + ' · ' + pc + '% paid</div><div class="card list-card">' + m.recs.map(function (d) {
          return '<button class="w-row" data-km="' + esc(d.id) + '">' + icon(cat(d.incomeCat), 'sm') + '<span class="grow">' + esc(d.title || 'Commission') + '<span class="sub">' + fmtDate(d.created) + ' · ' + money(dPaid(d), { rp: false }) + ' of ' + money(d.amount, { rp: false }) + ' paid</span><span class="bill-bar"><i style="--w:' + (d.amount ? Math.min(100, dPaid(d) / d.amount * 100) : 0).toFixed(0) + '%"></i></span></span><span class="amt ' + (dRemain(d) ? 'pos' : 'muted') + '">' + (dRemain(d) ? money(dRemain(d), { rp: false }) : 'Paid ✓') + '</span></button>';
        }).join('') + '</div>';
      }).join('') : '<div class="empty">' + dinoImg('empty-dino') + 'No commission yet.<br>Press + → Income → RESERVE TRANSFER.</div>') +
      '<button class="btn primary block" id="kmAdd">＋ Add commission</button>',
      function (r) {
        r.addEventListener('click', function (e) { var b = e.target.closest('[data-km]'); if (b) debtDetail(debtById(b.dataset.km)); });
        r.querySelector('#kmAdd').onclick = function () { txSheet(null, { type: 'income', cat: 'reserve_transfer' }); };
      });
  }
  // ---------- Business: income & expense per business ----------
  function bizTx(id, m) { return S.tx.filter(function (t) { return t.biz === id && (t.type === 'income' || t.type === 'expense') && (!m || t.date.slice(0, 7) === m); }); }
  function bizIO(id, m) { var r = { i: 0, e: 0 }; bizTx(id, m).forEach(function (t) { if (t.type === 'income') r.i += t.amount; else r.e += t.amount; }); return r; }
  var BCOL = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#2dd4bf'];
  function bizIcon(b, i) { return '<span class="biz-ic" style="--c:' + BCOL[i % BCOL.length] + '">' + sprite(b.sp || 'kas_kantor') + '</span>'; }
  function renderBizCard() {
    var el = $('hBiz'); if (!el) return; var m = ym(new Date()), bs = S.businesses || [];
    var tot = bs.reduce(function (a, b) { var r = bizIO(b.id, m); a.i += r.i; a.e += r.e; return a; }, { i: 0, e: 0 });
    el.innerHTML = '<div class="km-top"><div><div class="eyebrow">Business profit · ' + MONTHS[new Date().getMonth()] + '</div><div class="mid-money ' + (tot.i - tot.e < 0 ? 'neg' : '') + '">' + money(tot.i - tot.e, { sign: true }) + '</div><div class="muted small">In ' + money(tot.i, { rp: false }) + ' · Out ' + money(tot.e, { rp: false }) + '</div></div></div>' +
      '<div class="biz-chips">' + bs.map(function (b, i) { var r = bizIO(b.id, m); return '<span class="biz-chip">' + bizIcon(b, i) + '<b>' + esc(b.name) + '</b><em class="' + (r.i - r.e < 0 ? 'neg' : 'pos') + '">' + money(r.i - r.e, { rp: false, sign: true }) + '</em></span>'; }).join('') + '</div>';
  }
  function bizSheet() {
    var m = ym(new Date()), bs = S.businesses || [];
    openSheet('<div class="sheet-top"><span style="width:36px"></span><h3>Business</h3><span style="width:36px"></span></div>' +
      '<div class="muted small" style="text-align:center;margin:-8px 0 12px">' + MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear() + '</div>' +
      '<div class="card list-card stagger">' + bs.map(function (b, i) {
        var r = bizIO(b.id, m), net = r.i - r.e, mx = Math.max(r.i, r.e, 1);
        return '<button class="w-row biz-row" data-biz="' + esc(b.id) + '" style="--i:' + i + '">' + bizIcon(b, i) + '<span class="grow"><b>' + esc(b.name) + '</b><span class="sub">In ' + money(r.i, { rp: false }) + ' · Out ' + money(r.e, { rp: false }) + '</span><span class="biz-mini"><i class="in" style="--w:' + (r.i / mx * 100).toFixed(0) + '%"></i><i class="out" style="--w:' + (r.e / mx * 100).toFixed(0) + '%"></i></span></span><span class="amt ' + (net < 0 ? 'neg' : 'pos') + '">' + money(net, { rp: false, sign: true }) + '</span></button>';
      }).join('') + '<button class="w-row" id="bizAdd"><span class="biz-ic add">＋</span><span class="grow"><b>Add business</b><span class="sub">Track another business</span></span></button></div>',
      function (r) {
        r.addEventListener('click', function (e) { var b = e.target.closest('[data-biz]'); if (b) { haptic(); bizDetail(bs.filter(function (x) { return x.id === b.dataset.biz; })[0]); } });
        r.querySelector('#bizAdd').onclick = function () { bizEdit(); };
      });
  }
  function bizEdit(b) {
    var isNew = !b; b = b || { id: uid(), name: '', sp: 'kas_kantor' }; var st = { sp: b.sp };
    openSheet('<h3>' + (isNew ? 'Add business' : 'Edit business') + '</h3><span class="ic preview i3d">' + sprite(st.sp) + '</span>' +
      '<label class="fld">Business name<input id="bzName" value="' + esc(b.name) + '" placeholder="e.g. HURRICANE"></label>' +
      '<div class="fld">Icon' + picker(null, st.sp) + '</div>' +
      '<button class="btn primary block" id="bzSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="bzDel">Delete business</button>'),
      function (r) {
        bindSpPicker(r, st); if (isNew) setTimeout(function () { r.querySelector('#bzName').focus(); }, 380);
        r.querySelector('#bzSave').onclick = function () { var n = r.querySelector('#bzName').value.trim(); if (!n) { toast('Name it'); return; } b.name = n; b.sp = st.sp; if (isNew) (S.businesses = S.businesses || []).push(b); save(); renderAll(); bizSheet(); toast('Saved ✓'); };
        var d = r.querySelector('#bzDel'); if (d) d.onclick = function () { if (!confirm('Delete ' + b.name + '? Its transactions stay, just without a business.')) return; S.tx.forEach(function (t) { if (t.biz === b.id) delete t.biz; }); S.businesses = S.businesses.filter(function (x) { return x !== b; }); save(); renderAll(); bizSheet(); };
      });
  }
  function bizDetail(b) {
    var i0 = S.businesses.indexOf(b), col = BCOL[i0 % BCOL.length], mDate = new Date(); mDate.setDate(1);
    function draw() {
      var m = ym(mDate), r = bizIO(b.id, m), net = r.i - r.e, list = bizTx(b.id, m).sort(function (x, y) { return (y.date + (y.time || '')).localeCompare(x.date + (x.time || '')); });
      var months = []; for (var k = 5; k >= 0; k--) { var d = new Date(mDate.getFullYear(), mDate.getMonth() - k, 1); months.push({ k: ym(d), l: MONTHS[d.getMonth()].slice(0, 3), io: bizIO(b.id, ym(d)) }); }
      var mx = Math.max.apply(null, months.map(function (x) { return Math.max(x.io.i, x.io.e); }).concat([1]));
      openSheet('<div class="sheet-top"><button class="icon-btn" id="bzBack" aria-label="Back">‹</button><h3>' + esc(b.name) + '</h3><button class="icon-btn" id="bzEdit" aria-label="Edit">✎</button></div>' +
        '<div class="biz-month"><button id="bzPrev">‹</button><span>' + MONTHS[mDate.getMonth()] + ' ' + mDate.getFullYear() + '</span><button id="bzNext">›</button></div>' +
        '<div class="card" style="text-align:center"><div class="eyebrow">Profit</div><div class="mid-money xl ' + (net < 0 ? 'neg' : 'pos') + '">' + money(net, { sign: true }) + '</div>' +
        '<div class="dd-stats"><div><small>Income</small><b class="pos">' + money(r.i, { rp: false }) + '</b></div><div><small>Expense</small><b class="neg">' + money(r.e, { rp: false }) + '</b></div><div><small>Margin</small><b>' + (r.i ? Math.round(net / r.i * 100) + '%' : '–') + '</b></div></div>' +
        '<div class="km-bars" style="height:90px">' + months.map(function (x, j) { return '<div class="km-col" style="--i:' + j + '"><div class="km-b biz-b"><i class="bi" style="height:' + (x.io.i / mx * 100).toFixed(1) + '%"></i><i class="be" style="height:' + (x.io.e / mx * 100).toFixed(1) + '%"></i></div><span' + (x.k === m ? ' style="color:var(--ink);font-weight:600"' : '') + '>' + x.l + '</span></div>'; }).join('') + '</div>' +
        '<div class="km-leg" style="justify-content:center"><span><i style="background:var(--pos)"></i>Income</span><span><i style="background:var(--neg)"></i>Expense</span></div></div>' +
        '<div class="two"><button class="btn primary" id="bzIn">＋ Income</button><button class="btn" id="bzOut">＋ Expense</button></div>' +
        '<div class="sheet-sec">Transactions</div>' + (list.length ? '<div class="card list-card stagger">' + list.map(function (t, j) { return txRow(t, j, true); }).join('') + '</div>' : '<div class="empty">' + dinoImg('empty-dino') + 'No ' + esc(b.name) + ' transactions this month.</div>'),
        function (el) {
          el.querySelector('#bzBack').onclick = bizSheet; el.querySelector('#bzEdit').onclick = function () { bizEdit(b); };
          el.querySelector('#bzPrev').onclick = function () { mDate.setMonth(mDate.getMonth() - 1); haptic(); draw(); };
          el.querySelector('#bzNext').onclick = function () { mDate.setMonth(mDate.getMonth() + 1); haptic(); draw(); };
          el.querySelector('#bzIn').onclick = function () { txSheet(null, { type: 'income', cat: 'other_in', biz: b.id }); };
          el.querySelector('#bzOut').onclick = function () { txSheet(null, { type: 'expense', cat: 'other_out', biz: b.id }); };
          el.addEventListener('click', function (e) { var rw = e.target.closest('.tx'); if (rw) { var t = S.tx.filter(function (x) { return x.id === rw.dataset.id; })[0]; if (t) txSheet(t); } });
        });
    }
    draw();
  }
  function unbook(d, why) { var r = dRemain(d); if (d.prebooked && r > 0) addTx({ type: 'expense', cat: 'balance_adj', amount: r, wallet: d.wallet, date: today(), merchant: d.person, note: why + ': ' + (d.title || ''), debtId: d.id }); }
  function debtDetail(d) {
    if (!d) return;
    var st = dStatus(d), p = dPaid(d), pc = d.amount ? Math.min(100, Math.round(p / d.amount * 100)) : 0, inn = d.dir === 'in';
    var pays = (d.payments || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    openSheet('<div class="d-top" style="margin:4px 0 8px">' + avatar(d.person) + '<div class="grow"><div class="d-name" style="font-size:18px">' + esc(d.person) + '</div><div class="d-title">' + esc(d.title || (inn ? 'Owes me' : 'I owe')) + '</div></div><span class="st ' + st + '">' + ST_LABEL[st] + '</span></div>' +
      '<div class="eyebrow" style="margin-top:14px">Remaining</div><div class="mid-money xl">' + money(dRemain(d)) + '</div>' +
      '<div class="d-prog ' + (st === 'overdue' ? 'overdue' : st === 'partial' ? 'partial' : '') + '" style="margin-top:12px"><i data-w="' + pc + '"></i></div>' +
      '<div class="d-meta"><span>' + pc + '% ' + (inn ? 'collected' : 'paid') + '</span><span>' + dueText(d) + '</span></div>' +
      '<div class="dd-stats"><div><small>Total ' + (inn ? 'owed' : 'borrowed') + '</small><b>' + money(d.amount, { rp: false }) + '</b></div><div><small>' + (inn ? 'Received' : 'Paid') + '</small><b>' + money(p, { rp: false }) + '</b></div><div><small>Remaining</small><b>' + money(dRemain(d), { rp: false }) + '</b></div></div>' +
      '<div class="sheet-sec">Payment timeline</div><div class="timeline">' +
        '<div class="tl start"><div><b>' + (inn ? 'Owed' : 'Borrowed') + ' ' + money(d.amount) + '</b><small>' + fmtDate(d.created) + (d.startTx ? ' · moved via ' + esc(wallet(d.wallet).name) : '') + '</small></div></div>' +
        pays.map(function (x) { return '<div class="tl"><div><b class="pos">+ ' + money(x.amount) + '</b><small>' + fmtDate(x.date) + ' · ' + esc(wallet(x.wallet).name) + (x.note ? ' · ' + esc(x.note) : '') + '</small></div><button class="x" data-delpay="' + esc(x.id) + '" aria-label="Delete payment">×</button></div>'; }).join('') +
        (pays.length ? '' : '<div class="muted small" style="padding:6px 0">No payments yet.</div>') +
      '</div>' +
      ((d.tags || d.notes) ? '<div class="sheet-sec">Notes</div><div class="card" style="box-shadow:none">' + (d.tags ? '<div class="small muted">Tags: ' + esc(d.tags) + '</div>' : '') + (d.notes ? '<div style="white-space:pre-wrap;margin-top:4px">' + esc(d.notes) + '</div>' : '') + '</div>' : '') +
      '<div class="sheet-sec">Attachments</div><div id="ddFiles"></div>' +
      '<div class="small muted" style="margin:10px 2px">Linked wallet: ' + esc(wallet(d.wallet).name) + '</div>' +
      (dOpen(d) ? '<button class="btn block wa-btn" id="ddWa"><svg viewBox="0 0 24 24"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1z"/></svg>' + (inn ? 'Remind on WhatsApp' : 'Message on WhatsApp') + '</button>' : '') +
      (dOpen(d) ? '<button class="btn primary block" id="ddPay">＋ ' + (inn ? 'Record payment' : 'Record repayment') + '</button>' : '') +
      '<div class="two"><button class="btn" id="ddEdit">Edit</button>' + (d.closed ? '<button class="btn" id="ddReopen">Reopen</button>' : '<button class="btn" id="ddCancel">Cancel debt</button>') + '</div>' +
      (!d.closed && inn ? '<button class="btn block" id="ddWrite">Write off</button>' : '') +
      '<button class="btn danger block" id="ddDel">Delete record</button>',
      function (r) {
        growBars(r);
        d.files = d.files || []; attachUI(r.querySelector('#ddFiles'), d.files, function () { var bt = d.bookTx && S.tx.filter(function (x) { return x.id === d.bookTx; })[0]; if (bt) bt.files = d.files.slice(); save(); renderAll(); });
        var b;
        if ((b = r.querySelector('#ddPay'))) b.onclick = function () { paySheet(d); };
        if ((b = r.querySelector('#ddWa'))) b.onclick = function () { haptic(); waRemind(d); };
        r.querySelector('#ddEdit').onclick = function () { debtSheet(d); };
        if ((b = r.querySelector('#ddCancel'))) b.onclick = function () { if (!confirm('Mark as cancelled? It will no longer count as outstanding.')) return; unbook(d, 'Cancelled'); d.closed = 'cancelled'; save(); closeSheet(); renderAll(); toast('Cancelled'); };
        if ((b = r.querySelector('#ddWrite'))) b.onclick = function () { if (!confirm('Write off the remaining Rp ' + fmt(dRemain(d)) + '? It will no longer count in your net worth.')) return; unbook(d, 'Not received'); d.closed = 'writtenoff'; save(); closeSheet(); renderAll(); toast('Written off'); };
        if ((b = r.querySelector('#ddReopen'))) b.onclick = function () { delete d.closed; save(); closeSheet(); renderAll(); toast('Reopened'); };
        r.querySelector('#ddDel').onclick = function () {
          if (!confirm('Delete this record and its ' + (d.payments || []).length + ' payment(s)? Linked wallet transactions are removed too.')) return;
          var ids = (d.payments || []).map(function (x) { return x.txId; }).concat(d.startTx ? [d.startTx] : []).concat(d.bookTx ? [d.bookTx] : []);
          S.tx = S.tx.filter(function (t) { return ids.indexOf(t.id) === -1; });
          S.debts = S.debts.filter(function (x) { return x.id !== d.id; });
          save(); closeSheet(); renderAll(); toast('Deleted');
        };
        r.addEventListener('click', function (e) {
          var x = e.target.closest('[data-delpay]'); if (!x) return;
          if (!confirm('Delete this payment? Its wallet transaction is removed too.')) return;
          var pay = d.payments.filter(function (y) { return y.id === x.dataset.delpay; })[0];
          d.payments = d.payments.filter(function (y) { return y !== pay; });
          if (pay) S.tx = S.tx.filter(function (t) { return t.id !== pay.txId; });
          save(); renderAll(); debtDetail(d);
        });
      });
  }

  // ---------- navigation ----------
  function show(id, back) {
    if (id === view) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    var prev = view; view = id;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active', 'back'); });
    var el = $(id); void el.offsetWidth;
    el.classList.add('active'); if (back) el.classList.add('back');
    window.scrollTo(0, 0);
    var navId = id === 'v-report' ? (prev === 'v-tx' ? 'v-tx' : prev === 'v-account' ? 'v-account' : 'v-home') : id === 'v-budget' ? (prev === 'v-home' ? 'v-home' : 'v-account') : id;
    if (id === 'v-budget') budFrom = prev;
    if (id === 'v-report') repFrom = prev;
    document.querySelectorAll('.bottom-nav button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === navId); });
    moveInd();
    $('fab').classList.toggle('gone', id === 'v-account' || id === 'v-report');
    if (id === 'v-debts') renderDebts();
    if (id === 'v-budget' || id === 'v-report') { growBars($(id)); }
    if (id === 'v-home') renderHome();
    $('topTitle').textContent = TITLES[id] || ''; onScroll();
  }
  var budFrom = 'v-account';
  var TITLES = { 'v-home': 'Apex', 'v-tx': 'Activity', 'v-budget': 'Budgets', 'v-report': 'Report', 'v-account': 'More', 'v-debts': 'Money owed' };
  function onScroll() { var y = window.scrollY; $('topbar').classList.toggle('show', y > 120); document.documentElement.style.setProperty('--p', Math.max(0, Math.min(1, y / 180)).toFixed(3)); }

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
      var el = document.elementFromPoint(p.clientX, p.clientY); el = el && el.closest('.bottom-nav,.round-btn,.wallet-pill,.sheet,.fab,.card,.day,.d-card');
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
    $('sheet').classList.add('show'); $('sheetBg').classList.add('show'); document.body.classList.add('sheet-open');
    sheetOpen = true;
    if (onMount) onMount($('sheetBody'));
  }
  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen = false;
    $('sheet').classList.remove('show'); $('sheetBg').classList.remove('show'); $('fab').classList.remove('open'); document.body.classList.remove('sheet-open');
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

  // ---------- attachments: photos, PDFs, files (stored on this device in IndexedDB) ----------
  var fdb = null;
  function fileDB() {
    if (fdb) return fdb;
    fdb = new Promise(function (ok, no) { var r = indexedDB.open('apex_files', 1); r.onupgradeneeded = function () { r.result.createObjectStore('f'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; });
    return fdb;
  }
  function filePut(id, blob) { return fileDB().then(function (db) { return new Promise(function (ok, no) { var tx = db.transaction('f', 'readwrite'); tx.objectStore('f').put(blob, id); tx.oncomplete = ok; tx.onerror = function () { no(tx.error); }; }); }); }
  function fileGet(id) { return fileDB().then(function (db) { return new Promise(function (ok) { var q = db.transaction('f').objectStore('f').get(id); q.onsuccess = function () { ok(q.result); }; q.onerror = function () { ok(null); }; }); }); }
  function fileDel(id) { return fileDB().then(function (db) { db.transaction('f', 'readwrite').objectStore('f').delete(id); }).catch(function () {}); }
  // Shrink photos so many receipts fit on the phone; PDFs and other files are kept as they are.
  function prepFile(f) {
    if (!/^image\//.test(f.type) || /gif|svg/.test(f.type)) return Promise.resolve(f);
    return new Promise(function (ok) {
      var img = new Image(), url = URL.createObjectURL(f);
      img.onload = function () { var k = Math.min(1, 1800 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { ok(b || f); }, 'image/jpeg', .82); };
      img.onerror = function () { URL.revokeObjectURL(url); ok(f); };
      img.src = url;
    });
  }
  function fileKind(m) { return /^image\//.test(m.type) ? 'img' : /pdf/.test(m.type) || /\.pdf$/i.test(m.name) ? 'pdf' : 'file'; }
  function sizeTxt(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function openFile(m) {
    fileGet(m.id).then(function (b) {
      if (!b) { toast('File not found on this device'); return; }
      var url = URL.createObjectURL(b);
      if (fileKind(m) === 'img') {
        var ov = document.createElement('div'); ov.className = 'viewer'; ov.innerHTML = '<img src="' + url + '" alt=""><div class="v-bar"><span>' + esc(m.name) + '</span><a href="' + url + '" download="' + esc(m.name) + '">Save</a><button>Close</button></div>';
        document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('show'); });
        ov.onclick = function (e) { if (e.target.tagName === 'A') return; ov.classList.remove('show'); setTimeout(function () { ov.remove(); URL.revokeObjectURL(url); }, 300); };
      } else { var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; if (fileKind(m) !== 'pdf') a.download = m.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 60000); }
    });
  }
  // A small attachments widget used in the transaction sheet and the commission record.
  function attachUI(host, list, onChange) {
    function thumb(m, i) {
      var k = fileKind(m);
      return '<div class="att" data-i="' + i + '"><button type="button" class="att-open" data-open="' + i + '">' + (k === 'img' ? '<img data-img="' + esc(m.id) + '" alt="">' : '<span class="att-badge ' + k + '">' + (k === 'pdf' ? 'PDF' : (m.name.split('.').pop() || 'FILE').slice(0, 4).toUpperCase()) + '</span>') +
        '<span class="att-name">' + esc(m.name) + '</span><span class="att-size">' + sizeTxt(m.size || 0) + '</span></button><button type="button" class="att-x" data-rm="' + i + '" aria-label="Remove">×</button></div>';
    }
    function draw() {
      host.innerHTML = '<div class="att-grid">' + list.map(thumb).join('') + '<label class="att add"><input type="file" multiple accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" hidden><span class="att-plus">＋</span><span class="att-name">Photo, PDF or file</span></label></div>';
      host.querySelectorAll('[data-img]').forEach(function (im) { fileGet(im.dataset.img).then(function (b) { if (b) im.src = URL.createObjectURL(b); }); });
      host.querySelector('input').onchange = function () {
        var fs = [].slice.call(this.files); if (!fs.length) return; busy(true, 'Attaching…');
        Promise.all(fs.map(function (f) {
          if (f.size > 25 * 1048576) { toast(f.name + ' is over 25 MB'); return null; }
          return prepFile(f).then(function (b) { var m = { id: 'f' + uid(), name: f.name, type: b.type || f.type, size: b.size, at: Date.now() }; return filePut(m.id, b).then(function () { return m; }); });
        })).then(function (ms) { ms.filter(Boolean).forEach(function (m) { list.push(m); }); busy(false); draw(); if (onChange) onChange(); haptic(); })
          .catch(function () { busy(false); toast('Could not store the file (phone storage full?)'); });
      };
    }
    host.addEventListener('click', function (e) {
      var o = e.target.closest('[data-open]'), x = e.target.closest('[data-rm]');
      if (o) openFile(list[+o.dataset.open]);
      else if (x) { if (!confirm('Remove this attachment?')) return; var m = list.splice(+x.dataset.rm, 1)[0]; fileDel(m.id); draw(); if (onChange) onChange(); }
    });
    draw();
  }

  function txSheet(t, prefill) {
    var isNew = !t;
    t = t || Object.assign({ id: uid(), type: 'expense', amount: 0, cat: 'food', wallet: S.settings.bcaWallet || (S.wallets[0] || {}).id, toWallet: '', date: ymd(new Date()), time: hm(new Date()), note: '', merchant: '', src: 'manual', created: Date.now() }, prefill || {});
    var st = { type: t.type, cat: t.cat };
    var wOpts = function (sel) { return S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === sel ? ' selected' : '') + '>' + esc(w.icon + ' ' + w.name) + '</option>'; }).join(''); };
    $('fab').classList.add('open');
    openSheet(
      '<h3>' + (isNew ? 'Add transaction' : 'Edit transaction') + '</h3>' +
      '<div class="sheet-tools"><button type="button" id="fScan"><svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>Scan receipt</button><button type="button" id="fSplit"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c.6-3 2.6-5 5-5s4.4 2 5 5M11 20c.6-3 2.6-5 5-5s4.4 2 5 5"/></svg>Split bill</button></div><div class="scan-bar" hidden><i></i><span></span></div>' +
      '<div class="seg type-seg" id="fType" style="display:grid;grid-template-columns:repeat(4,1fr)"><button data-t="expense">Expense</button><button data-t="income">Income</button><button data-t="debt">Debt/Loan</button><button data-t="transfer">Transfer</button><i class="seg-ind" style="width:calc(25% - 1.5px)"></i></div>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="fAmt" inputmode="numeric" placeholder="0" value="' + (t.amount ? t.amount.toLocaleString('id-ID') : '') + '"></div>' +
      '<div id="fCatWrap"><button type="button" class="cat-sel" id="fCatSel"></button><div class="cat-pick" id="fCatPick"><input id="fCatQ" placeholder="Search category" autocomplete="off"><div class="cat-list" id="fCats"></div></div></div>' +
      '<label class="fld" id="fWalletL"><span>Wallet</span><select id="fWallet">' + wOpts(t.wallet) + '</select></label>' +
      '<label class="fld" id="fBizL">Business<select id="fBiz"><option value="">None (personal)</option>' + (S.businesses || []).map(function (b) { return '<option value="' + esc(b.id) + '"' + (t.biz === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld" id="fToL">To wallet<select id="fTo">' + wOpts(t.toWallet || (S.wallets[1] && S.wallets[1].id)) + '</select></label>' +
      '<div class="two"><label class="fld">Date<input id="fDate" type="date" value="' + esc(t.date) + '"></label><label class="fld">Time<input id="fTime" type="time" value="' + esc(t.time || '') + '"></label></div>' +
      (isNew ? '<div class="unpaid" id="fUnpaidBox"><label class="set-row plain"><span class="grow"><b>Not received yet</b><span class="sub">Add the full amount to the wallet now and remind me to collect it</span></span><input type="checkbox" class="switch" id="fUnpaid"></label>' +
        '<div id="fUnpaidF" hidden><div class="two"><label class="fld">Who pays you<input id="fPayer" placeholder="e.g. Dad"></label><label class="fld">Remind me on<input id="fDue" type="date"></label></div>' +
        '<label class="fld">Already received (optional)<input id="fPaidNow" inputmode="numeric" placeholder="0"></label></div></div>' : '') +
      '<label class="fld">Merchant / person<input id="fMerch" value="' + esc(t.merchant || '') + '"></label>' +
      '<label class="fld">Note<input id="fNote" value="' + esc(t.note || '') + '"></label>' +
      '<div class="fld">Attachments<div id="fFiles"></div></div>' +
      (t.src === 'bca' ? '<p class="muted small">Imported from a BCA email' + (t.ref ? ' · ref ' + esc(t.ref) : '') + '.</p>' : '') +
      (t.src === 'bca' && !isNew ? '<label class="set-row plain"><span class="grow small">Always use this category for "' + esc(t.merchant || '') + '"</span><input type="checkbox" class="switch" id="fRemember" checked></label>' : '') +
      '<button class="btn primary block" id="fSave">Save</button>' +
      (isNew ? '' : '<button class="btn danger block" id="fDel">Delete</button>'),
      function (root) {
        var amt = root.querySelector('#fAmt'); fmtInput(amt);
        var files = (t.files || []).slice(); attachUI(root.querySelector('#fFiles'), files);
        var ub = root.querySelector('#fUnpaid');
        if (ub) { fmtInput(root.querySelector('#fPaidNow')); ub.onchange = function () { root.querySelector('#fUnpaidF').hidden = !ub.checked; haptic(); if (ub.checked) setTimeout(function () { root.querySelector('#fPayer').focus(); }, 200); }; }
        root.querySelector('#fScan').onclick = function () { haptic(); scanInto(root); };
        root.querySelector('#fSplit').onclick = function () { var a = parseNum(amt.value); if (!a) { toast('Enter the bill amount first'); amt.focus(); return; } splitSheet(a, root.querySelector('#fMerch').value.trim(), root.querySelector('#fDate').value, root.querySelector('#fWallet').value); };
        var ind = root.querySelector('#fType .seg-ind');
        function paint() {
          var idx = ['expense', 'income', 'debt', 'transfer'].indexOf(st.type);
          ind.style.transform = 'translateX(' + (idx * 100) + '%)';
          root.querySelectorAll('#fType button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === st.type); });
          root.querySelector('#fCatWrap').hidden = st.type === 'transfer';
          root.querySelector('#fToL').hidden = st.type !== 'transfer';
          root.querySelector('#fBizL').hidden = st.type === 'transfer';
          var bz = root.querySelector('#fBiz'); if (isNew && !bz.value) { var cn = cat(st.cat).name.toLowerCase(); (S.businesses || []).forEach(function (b) { if (cn === b.name.toLowerCase()) bz.value = b.id; }); }
          var upb = root.querySelector('#fUnpaidBox'); if (upb) upb.hidden = st.type !== 'income';
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
        function autoOwed() {
          var payer = (S.settings.autoOwed || {})[st.cat];
          if (!ub || st.type !== 'income' || !payer) return;
          ub.checked = true; root.querySelector('#fUnpaidF').hidden = false;
          var pf = root.querySelector('#fPayer'); if (!pf.value) pf.value = payer;
          var df = root.querySelector('#fDue'); if (!df.value) { var x = new Date(); x.setDate(x.getDate() + 30); df.value = ymd(x); }
          var rw = S.wallets.filter(function (w) { return /reserve/i.test(w.name); })[0]; if (rw) root.querySelector('#fWallet').value = rw.id;
          var box = root.querySelector('#fUnpaidBox'); box.classList.remove('auto'); void box.offsetWidth; box.classList.add('auto');
          toast('Commission: ' + payer + ' owes this amount');
        }
        root.querySelector('#fCats').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st.cat = b.dataset.c; pickOpen = false; root.querySelector('#fCatQ').value = ''; haptic(); paint(); autoOwed(); } });
        paint(); if (isNew && prefill && prefill.cat) autoOwed();
        if (isNew) setTimeout(function () { amt.focus(); }, 380);

        root.querySelector('#fSave').onclick = function () {
          var a = parseNum(amt.value);
          if (!a) { toast('Enter an amount'); amt.focus(); return; }
          var w = root.querySelector('#fWallet').value, to = root.querySelector('#fTo').value;
          if (st.type === 'transfer' && w === to) { toast('Pick two different wallets'); return; }
          if (ub && ub.checked && st.type === 'income') {
            var payer = root.querySelector('#fPayer').value.trim(); if (!payer) { toast('Who will pay you?'); root.querySelector('#fPayer').focus(); return; }
            var dd = { id: uid(), dir: 'in', earned: true, incomeCat: st.cat, person: payer, title: cat(st.cat).name + (root.querySelector('#fNote').value.trim() ? ' · ' + root.querySelector('#fNote').value.trim() : ''), amount: a,
              created: root.querySelector('#fDate').value || today(), due: root.querySelector('#fDue').value, wallet: w, tags: 'income', notes: '', payments: [], ts: Date.now() };
            dd.prebooked = true; dd.files = files; S.debts.push(dd);
            dd.biz = root.querySelector('#fBiz').value || undefined; var bt = addTx({ biz: dd.biz, type: 'income', cat: st.cat, amount: a, wallet: w, date: dd.created, merchant: payer, note: dd.title + ' (not received yet)', debtId: dd.id, files: files }); dd.bookTx = bt.id;
            var pn = parseNum(root.querySelector('#fPaidNow').value);
            if (pn) dd.payments.push({ id: uid(), amount: Math.min(pn, a), date: dd.created, wallet: w, note: 'Already received', txId: null });
            haptic(); save(); closeSheet(); renderAll();
            toast(money(a, { rp: true }) + ' added to ' + wallet(w).name + ' · ' + payer + ' still owes ' + money(a - Math.min(pn, a), { rp: true }));
            return;
          }
          var oldCat = t.cat;
          Object.assign(t, {
            type: st.type, amount: a, cat: st.type === 'transfer' ? '' : st.cat, wallet: w, toWallet: st.type === 'transfer' ? to : '',
            date: root.querySelector('#fDate').value || ymd(new Date()), time: root.querySelector('#fTime').value,
            merchant: root.querySelector('#fMerch').value.trim(), note: root.querySelector('#fNote').value.trim(), biz: root.querySelector('#fBiz').value || undefined
          });
          var rem = root.querySelector('#fRemember');
          if (rem && rem.checked && t.merchant && t.cat && t.cat !== oldCat) learnRule(t.merchant, t.cat);
          t.files = files; if (!files.length) delete t.files;
          if (t.debtId) S.debts.forEach(function (d) { if (d.bookTx === t.id) d.files = files; });
          if (isNew) S.tx.push(t);
          if (t.debtId) S.debts.forEach(function (d) { (d.payments || []).forEach(function (p) { if (p.txId === t.id) { p.amount = t.amount; p.date = t.date; p.wallet = t.wallet; } }); });
          haptic(); save(); closeSheet(); renderAll(); toast(isNew ? 'Added ✓' : 'Saved ✓');
          if (isNew && t.type === 'income') { var fr = $('fab').getBoundingClientRect(); burst(fr.left + fr.width / 2, fr.top); }
        };
        var del = root.querySelector('#fDel');
        if (del) del.onclick = function () {
          if (!confirm('Delete this transaction?')) return;
          (t.files || []).forEach(function (m) { if (!S.debts.some(function (d) { return (d.files || []).some(function (x) { return x.id === m.id; }) && d.bookTx !== t.id; })) fileDel(m.id); });
          S.tx = S.tx.filter(function (x) { return x.id !== t.id; });
          S.debts.forEach(function (d) { d.payments = (d.payments || []).filter(function (p) { return p.txId !== t.id; }); if (d.startTx === t.id) delete d.startTx; });
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
    syncing = true; busy(true, 'Syncing BCA…');
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
            wallet: walletForSrc(p.src) || (S.wallets.some(function (w) { return w.id === s.bcaWallet; }) ? s.bcaWallet : (S.wallets[0] || {}).id), srcAcct: p.src || '',
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
      .then(function () { clearTimeout(timer); syncing = false; busy(false); $('hSync').classList.remove('spin'); });
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
      '<div class="fld">Icon' + picker(w.icon, spKey(w)) + '</div>' +
      '<label class="fld">Current balance<input id="wBal" inputmode="numeric" value="' + (curBal ? Math.abs(curBal).toLocaleString('id-ID') : '') + '" placeholder="0"></label>' +
      '<label class="fld">Group<select id="wGroup">' + Object.keys(GROUPS).map(function (g) { return '<option value="' + g + '"' + (groupOf(w) === g ? ' selected' : '') + '>' + GROUPS[g].icon + ' ' + GROUPS[g].name + '</option>'; }).join('') + '</select></label>' +
      '<div class="live-box"><label class="fld">Track live price<select id="wAsset"><option value="">No, I set the balance myself</option>' + Object.keys(ASSETS).map(function (k) { return '<option value="' + k + '"' + (w.holding && w.holding.asset === k ? ' selected' : '') + '>' + ASSETS[k].name + '</option>'; }).join('') + '</select></label>' +
      '<div class="two" id="wLiveF"><label class="fld">Quantity<input id="wQty" inputmode="decimal" value="' + (w.holding ? esc(w.holding.qty) : '') + '" placeholder="e.g. 25.5"></label><label class="fld">Total paid (Rp)<input id="wCost" inputmode="numeric" value="' + (w.holding && w.holding.cost ? (+w.holding.cost).toLocaleString('id-ID') : '') + '" placeholder="for profit/loss"></label></div><div class="muted small" id="wLiveV"></div></div>' +
      '<label class="set-row plain"><span class="grow">Include in total balance</span><input type="checkbox" class="switch" id="wInc"' + (w.excluded ? '' : ' checked') + '></label>' +
      '<button class="btn primary block" id="wSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="wDel">Delete wallet</button>'),
      function (r) {
        fmtInput(r.querySelector('#wBal')); fmtInput(r.querySelector('#wCost'));
        function liveUi() { var a = r.querySelector('#wAsset').value, q = parseFloat(String(r.querySelector('#wQty').value).replace(',', '.')) || 0; r.querySelector('#wLiveF').hidden = !a; r.querySelector('#wBal').closest('label').hidden = !!a; r.querySelector('#wLiveV').innerHTML = a ? (PRICES[a] ? 'Now worth ' + money(q * PRICES[a]) + ' · 1 ' + ASSETS[a].unit + ' = ' + money(PRICES[a]) : 'Fetching live price…') : ''; }
        r.querySelector('#wAsset').onchange = function () { if (this.value && !PRICES[this.value]) fetchPrices(true).then(liveUi); liveUi(); }; r.querySelector('#wQty').oninput = liveUi; liveUi();
        var wst = { sp: spKey(w) }; bindSpPicker(r, wst);
        r.querySelector('#wSave').onclick = function () {
          var n = r.querySelector('#wName').value.trim(); if (!n) { toast('Give it a name'); return; }
          w.name = n; if (wst.sp) { w.sp = wst.sp; delete w.custom; }
          w.excluded = !r.querySelector('#wInc').checked;
          var wa = r.querySelector('#wAsset').value; if (wa) w.holding = { asset: wa, qty: parseFloat(String(r.querySelector('#wQty').value).replace(',', '.')) || 0, cost: parseNum(r.querySelector('#wCost').value) }; else delete w.holding;
          w.group = r.querySelector('#wGroup').value;
          if (isNew) S.wallets.push(w);
          if (!w.holding) setBalance(w, parseNum(r.querySelector('#wBal').value) * (curBal < 0 ? -1 : 1));
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
    var isNew = !c; c = c || { id: uid(), name: '', icon: '🏷️', type: type || 'expense', sp: type === 'income' ? 'other_in' : type === 'debt' ? 'loan' : 'other_out' };
    openSheet('<h3>' + (isNew ? 'New category' : 'Edit category') + '</h3>' +
      '<label class="fld">Name<input id="cName" value="' + esc(c.name) + '"></label>' +
      '<div class="fld">Icon' + picker(c.icon, spKey(c)) + '</div>' +
      '<label class="fld">Type<select id="cType"><option value="expense">Expense</option><option value="income">Income</option><option value="debt">Debt/Loan</option></select></label>' +
      '<label class="fld" id="cParentL">Inside category (optional)<select id="cParent"></select></label>' +
      '<label class="fld" id="cFlowL">Money goes<select id="cFlow"><option value="out">Out of my wallet (lend, repay)</option><option value="in">Into my wallet (borrow, collect)</option></select></label>' +
      '<button class="btn primary block" id="cSave">Save</button>' + (isNew || LOCKED.indexOf(c.id) !== -1 ? (LOCKED.indexOf(c.id) !== -1 ? '<p class="muted small" style="text-align:center">🔒 Built in category: you can rename it, but not delete it.</p>' : '') : '<button class="btn danger block" id="cDel">Delete category</button>'),
      function (r) {
        var cst = { sp: spKey(c) }; bindSpPicker(r, cst);
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
          c.name = n; c.type = r.querySelector('#cType').value; if (cst.sp) { c.sp = cst.sp; delete c.custom; }
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
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="bAmt" inputmode="numeric" value="' + (S.budgets[catId] ? (+S.budgets[catId]).toLocaleString('id-ID') : '') + '" placeholder="0"></div>' +
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
    document.querySelectorAll('.bottom-nav button').forEach(function (b) { b.onclick = function () { haptic(); var sv = b.querySelector('svg'); sv.classList.remove('pop'); void sv.offsetWidth; sv.classList.add('pop'); show(b.dataset.v); }; });
    window.addEventListener('resize', moveInd);
    $('fab').onclick = function () { haptic(); if (view === 'v-debts') debtSheet(null, dDir); else txSheet(null, walletSel !== 'all' ? { wallet: walletSel } : null); };
    document.querySelectorAll('[data-priv]').forEach(function (b) { b.onclick = togglePrivacy; });
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]'); if (g) { haptic(); show(g.dataset.go); return; }
      var bk = e.target.closest('[data-back]'); if (bk) { haptic(); show(budFrom === 'v-budget' ? 'v-account' : budFrom, true); }
    });
    document.querySelectorAll('.actions [data-q]').forEach(function (b) {
      b.onclick = function () {
        haptic(); var q = b.dataset.q;
        if (q === 'expense' || q === 'income') txSheet(null, { type: q, cat: q === 'income' ? 'salary' : 'food' });
        else if (q === 'owed') show('v-debts'); else if (q === 'budget') show('v-budget');
      };
    });
    $('dSeg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; dDir = b.dataset.d; haptic(); renderDebts(); };
    $('dFilter').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; dFilter = b.dataset.f; haptic(); renderDebts(); };
    $('dQ').addEventListener('input', renderDebts);
    $('dSort').onchange = renderDebts;
    $('dAdd').onclick = function () { haptic(); debtSheet(null, dDir); };
    $('dList').addEventListener('click', function (e) {
      var p = e.target.closest('[data-pay]'); if (p) { haptic(); paySheet(debtById(p.dataset.pay)); return; }
      var v = e.target.closest('[data-view]'); if (v) { haptic(); debtDetail(debtById(v.dataset.view)); }
    });
    $('hUpcoming').addEventListener('click', function (e) { var r = e.target.closest('[data-view]'); if (r) debtDetail(debtById(r.dataset.view)); });
    $('sheetBg').onclick = closeSheet;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

    $('eyeBtnWrap').onclick = togglePrivacy;
    $('hideToggle').onchange = function () { S.settings.hide = this.checked; save(); renderAll(); };
    $('hSync').onclick = function () { haptic(); if (S.review.length) { show('v-account'); setTimeout(function () { $('reviewCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); } else sync(true); };
    $('seeAllWallets').onclick = walletPicker;
    $('realBtn').onclick = function () { haptic(); realSheet(); };
    $('hKomisi').onclick = function () { haptic(); komisiSheet(); };
    $('kmOpen').onclick = function () { haptic(); komisiSheet(); };
    $('hBiz').onclick = function () { haptic(); bizSheet(); }; $('bizOpen').onclick = function () { haptic(); bizSheet(); }; $('bizBtn').onclick = function () { haptic(); bizSheet(); };
    $('hRange').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; sparkDays = +b.dataset.r; haptic(); renderSpark(); };
    $('allocLegend').onclick = function (e) { if (e.target.closest('[data-group]')) walletPicker(); };
    $('donutGo').onclick = function () { haptic(); cur = new Date(); cur.setDate(1); renderAll(); show('v-report'); };
    $('balDetails').onclick = function () { haptic(); walletPicker(); };

    $('cfSeg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; cfMonths = +b.dataset.n; cfSel = null; haptic(); renderCashflow(); };
    $('cfChart').onclick = function (e) { var b = e.target.closest('.cf-bar'); if (!b) return; cfSel = +b.dataset.i; haptic(); renderCashflow(true); };
    $('themeSeg').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; S.settings.theme = b.dataset.t; haptic(); save(); applyTheme(); renderCashflow(true); };
    $('walletPill').onclick = walletPicker;
    $('hWallets').addEventListener('click', function (e) {
      var st = $('hWallets').querySelector('.wstack'); if (!st || st.dataset.dragged) { if (st) delete st.dataset.dragged; return; }
      if (e.target.closest('.ws-close')) { stackOpen = false; layoutStack(); haptic(); return; }
      if (!stackOpen) { stackOpen = true; layoutStack(); haptic(); return; }
      var c = e.target.closest('[data-wallet]'); if (c) { walletSel = c.dataset.wallet; renderTx(); show('v-tx'); }
    });
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
    document.querySelectorAll('[data-sp]').forEach(function (el) { if (el.closest('.icon-pick')) return; el.innerHTML = sprite(el.dataset.sp); el.classList.add('i3d'); });
    document.querySelectorAll('[data-i3d]').forEach(function (el) { el.innerHTML = img3d(el.dataset.i3d); el.classList.add('i3d'); });
    $('repDaily').addEventListener('mouseover', showTip);
    $('repDaily').addEventListener('focusin', showTip);
    $('repDaily').addEventListener('click', showTip);
    $('budgetList').onclick = function (e) { var r = e.target.closest('[data-budget]'); if (r) budgetSheet(r.dataset.budget); };

    $('acctList').addEventListener('change', function (e) { var sel = e.target.closest('[data-acct]'); if (!sel) return; S.settings.bcaAccounts[+sel.dataset.acct].wallet = sel.value; save(); toast('Saved ✓'); });
    $('acctList').addEventListener('click', function (e) { var b = e.target.closest('[data-delacct]'); if (!b) return; S.settings.bcaAccounts.splice(+b.dataset.delacct, 1); save(); renderAccount(); });
    $('addAcct').onclick = function () {
      var m = prompt('Account as BCA shows it in emails (first 4 and last 2 digits), e.g. 6275****46'); if (!m) return;
      var l = prompt('Name for this account (optional)', '') || '';
      ensureAccounts(); S.settings.bcaAccounts.push({ mask: m.trim(), label: l.trim(), wallet: '' }); save(); renderAccount();
    };
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
    $('zeroBtn').onclick = function () { if (!confirm('Set every wallet to Rp 0 and remove all transactions and money owed? A backup is kept so you can undo.')) return; zeroAll(); save(); renderAll(); toast('Everything is at 0 now'); var r2 = $('restoreZero'); if (r2) r2.hidden = false; };
    var rb = $('restoreZero'); if (rb) { rb.hidden = !localStorage.getItem('apex_backup_before_zero'); rb.onclick = function () { if (!confirm('Bring back the balances and transactions from before the reset to 0?')) return; var old = JSON.parse(localStorage.getItem('apex_backup_before_zero')); old.zeroVer = 2; localStorage.setItem(KEY, JSON.stringify(old)); load(); renderAll(); toast('Old data restored'); }; }
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

  document.documentElement.style.setProperty('--sheet', 'url("' + SHEET + '")');
  // =================== FEATURES: insights, goals, bills, calendar, search, CSV ===================
  function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
  function addPeriod(d, f) { var x = new Date(d + 'T00:00:00'); if (f === 'weekly') x.setDate(x.getDate() + 7); else if (f === 'yearly') x.setFullYear(x.getFullYear() + 1); else x.setMonth(x.getMonth() + 1); return ymd(x); }
  function monthlyOf(r) { return r.freq === 'weekly' ? r.amount * 52 / 12 : r.freq === 'yearly' ? r.amount / 12 : r.amount; }

  // ---- recurring: post everything that is due ----
  function postRecurring() {
    var t = today(), n = 0;
    (S.recurring || []).forEach(function (r) {
      var guard = 0;
      while (r.active !== false && r.next && r.next <= t && guard++ < 60) {
        addTx({ type: r.type, cat: r.cat, amount: r.amount, wallet: r.wallet, date: r.next, merchant: r.name, note: 'Recurring', recId: r.id });
        r.next = addPeriod(r.next, r.freq); n++;
      }
    });
    if (n) { save(); setTimeout(function () { toast(n + ' recurring payment' + (n > 1 ? 's' : '') + ' added'); }, 900); }
  }

  // ---- insights ----
  function renderInsights() {
    var now = new Date(), m = ym(now), day = now.getDate(), dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var lm = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    var cur = {}, prev = {}, spent = 0, lastFull = 0, biggest = null;
    S.tx.forEach(function (t) {
      if (t.type !== 'expense' || !touches(t, 'all')) return;
      var mk = t.date.slice(0, 7), d = +t.date.slice(8, 10);
      if (mk === m) { cur[t.cat] = (cur[t.cat] || 0) + t.amount; spent += t.amount; if (!biggest || t.amount > biggest.amount) biggest = t; }
      if (mk === lm) { lastFull += t.amount; if (d <= day) prev[t.cat] = (prev[t.cat] || 0) + t.amount; }
    });
    var cards = [];
    if (S.tx.some(function (t) { return t.date.slice(0, 7) === m; })) cards.push({ sp: 'fun_money', tone: 'wrap', title: MONTHS[now.getMonth()] + ' Wrapped', body: 'Your month as a story. Tap to play ▶', wrap: 1 });
    var moves = Object.keys(cur).map(function (k) { return { k: k, c: cur[k], p: prev[k] || 0 }; }).filter(function (x) { return x.p > 0; })
      .sort(function (a, b) { return Math.abs(b.c - b.p) - Math.abs(a.c - a.p); });
    if (moves[0]) { var mv = moves[0], pc = Math.round((mv.c - mv.p) / mv.p * 100), upm = pc > 0;
      cards.push({ sp: spKey(cat(mv.k)) || 'stocks', tone: upm ? 'neg' : 'pos', title: cat(mv.k).name + ' ' + (upm ? 'up ' : 'down ') + Math.abs(pc) + '%', body: 'vs the same days last month', bar: Math.min(100, mv.c / Math.max(mv.c, mv.p) * 100), bar2: Math.min(100, mv.p / Math.max(mv.c, mv.p) * 100) }); }
    if (spent) { var proj = spent / day * dim;
      cards.push({ sp: 'ajaib_essa', tone: lastFull && proj > lastFull ? 'neg' : 'pos', title: 'On track for ' + money(proj, { rp: true }), body: lastFull ? (proj > lastFull ? 'More than' : 'Less than') + ' last month (' + money(lastFull, { rp: false }) + ')' : 'Month-end spending forecast', bar: Math.min(100, day / dim * 100) }); }
    if (biggest) cards.push({ sp: spKey(cat(biggest.cat)) || 'other_out', tone: '', title: 'Biggest: ' + money(biggest.amount, { rp: true }), body: (biggest.merchant || cat(biggest.cat).name) + ' · ' + fmtDate(biggest.date) });
    var subs = (S.recurring || []).filter(function (r) { return r.active !== false && r.type === 'expense'; });
    if (subs.length) { var mt = subs.reduce(function (a, r) { return a + monthlyOf(r); }, 0);
      cards.push({ sp: 'streaming', tone: '', title: money(mt, { rp: true }) + ' / month', body: subs.length + ' bill' + (subs.length > 1 ? 's' : '') + ' & subscriptions · ' + money(mt * 12, { rp: false }) + ' a year' }); }
    var od = S.debts.filter(function (d) { return d.dir === 'in' && dStatus(d) === 'overdue'; });
    if (od.length) cards.push({ sp: 'debt_collection', tone: 'neg', title: od.length + ' overdue · ' + money(od.reduce(function (a, d) { return a + dRemain(d); }, 0), { rp: true }), body: 'People owe you past the due date', go: 'v-debts' });
    if (!cards.length) cards.push({ sp: 'investment', tone: '', title: 'Insights appear here', body: 'Add a few transactions and Apex starts spotting patterns for you.' });
    $('hInsights').innerHTML = cards.map(function (c, i) {
      return '<div class="ins-card ' + c.tone + '" style="--i:' + i + '"' + (c.go ? ' data-go="' + c.go + '"' : '') + (c.wrap ? ' data-wrap="1"' : '') + '><div class="ins-top">' + sprite(c.sp, 'ins-ic') + '</div><b>' + c.title + '</b><span>' + esc(c.body) + '</span>' +
        (c.bar != null ? '<div class="ins-bars"><i style="--w:' + c.bar.toFixed(1) + '%"></i>' + (c.bar2 != null ? '<i class="ghost" style="--w:' + c.bar2.toFixed(1) + '%"></i>' : '') + '</div>' : '') + '</div>';
    }).join('');
  }

  // ---- goals ----
  function goalSaved(g) { return (g.history || []).reduce(function (a, h) { return a + h.amount; }, 0); }
  function ringSvg(pct, col, size) {
    var r = 26, C = 2 * Math.PI * r;
    return '<svg class="g-ring" viewBox="0 0 64 64" width="' + size + '" height="' + size + '"><circle cx="32" cy="32" r="' + r + '" class="g-track"/><circle cx="32" cy="32" r="' + r + '" class="g-fill" stroke="' + col + '" stroke-dasharray="' + C.toFixed(2) + '" style="--off:' + (C * (1 - Math.min(1, pct))).toFixed(2) + ';--c:' + C.toFixed(2) + '"/></svg>';
  }
  var GCOL = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#2dd4bf'];
  function renderGoals() {
    var gs = S.goals || [];
    $('hGoals').innerHTML = gs.map(function (g, i) {
      var sv = goalSaved(g), pct = g.target ? sv / g.target : 0, col = GCOL[i % GCOL.length], left = g.due ? daysBetween(today(), g.due) : null;
      return '<button class="goal" data-goal="' + esc(g.id) + '" style="--i:' + i + '"><div class="g-vis">' + ringSvg(pct, col, 64) + '<span class="g-ic">' + sprite(g.sp || 'g_savings') + '</span></div>' +
        '<b>' + esc(g.name) + '</b><span class="g-amt">' + money(sv, { rp: false }) + '</span><span class="g-sub">' + Math.round(pct * 100) + '% of ' + money(g.target, { rp: false }) + (left != null ? ' · ' + (left >= 0 ? left + 'd left' : 'past due') : '') + '</span></button>';
    }).join('') + '<button class="goal add" id="goalAdd2"><div class="g-vis"><span class="g-plus">＋</span></div><b>New goal</b><span class="g-sub">Save for something</span></button>';
  }
  function goalSheet(g) {
    var isNew = !g; g = g || { id: uid(), name: '', target: 0, due: '', sp: 'g_savings', history: [] };
    var st = { sp: g.sp };
    openSheet('<h3>' + (isNew ? 'New goal' : 'Edit goal') + '</h3>' + '<span class="ic preview i3d">' + sprite(st.sp) + '</span>' +
      '<label class="fld">Name<input id="gName" value="' + esc(g.name) + '" placeholder="e.g. Wedding fund"></label>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="gTarget" inputmode="numeric" placeholder="Target" value="' + (g.target ? g.target.toLocaleString('id-ID') : '') + '"></div>' +
      '<label class="fld">Target date (optional)<input id="gDue" type="date" value="' + esc(g.due || '') + '"></label>' +
      '<div class="fld">Icon' + picker(null, st.sp) + '</div>' +
      '<button class="btn primary block" id="gSave">Save goal</button>' + (isNew ? '' : '<button class="btn danger block" id="gDel">Delete goal</button>'),
      function (r) {
        fmtInput(r.querySelector('#gTarget')); bindSpPicker(r, st);
        r.querySelector('#gSave').onclick = function () {
          var n = r.querySelector('#gName').value.trim(), t = parseNum(r.querySelector('#gTarget').value);
          if (!n) { toast('Name your goal'); return; } if (!t) { toast('Set a target amount'); return; }
          g.name = n; g.target = t; g.due = r.querySelector('#gDue').value; g.sp = st.sp;
          if (isNew) (S.goals = S.goals || []).push(g); save(); closeSheet(); renderGoals(); toast('Goal saved ✓');
        };
        var d = r.querySelector('#gDel'); if (d) d.onclick = function () { if (!confirm('Delete this goal?')) return; S.goals = S.goals.filter(function (x) { return x !== g; }); save(); closeSheet(); renderGoals(); };
      });
  }
  function goalDetail(g) {
    var sv = goalSaved(g), pct = g.target ? sv / g.target : 0, i = S.goals.indexOf(g), col = GCOL[i % GCOL.length];
    var left = g.due ? daysBetween(today(), g.due) : null, need = Math.max(0, g.target - sv);
    var perMonth = left && left > 0 ? need / Math.max(1, left / 30.4) : 0;
    openSheet('<div class="gd-hero"><div class="g-vis big">' + ringSvg(pct, col, 132) + '<span class="g-ic">' + sprite(g.sp || 'g_savings') + '</span></div>' +
      '<div class="gd-pct">' + Math.round(pct * 100) + '%</div><h3 style="margin:0">' + esc(g.name) + '</h3>' +
      '<div class="muted small">' + money(sv) + ' of ' + money(g.target) + '</div></div>' +
      '<div class="dd-stats"><div><small>Still needed</small><b>' + money(need, { rp: false }) + '</b></div><div><small>Days left</small><b>' + (left == null ? '–' : Math.max(0, left)) + '</b></div><div><small>Per month</small><b>' + (perMonth ? money(perMonth, { rp: false }) : '–') + '</b></div></div>' +
      '<div class="amt-wrap" style="margin-top:16px"><span>Rp</span><input class="amt-input" id="gAdd" inputmode="numeric" placeholder="Add money"></div>' +
      '<div class="quick-amts"><button type="button" data-a="100000">+100rb</button><button type="button" data-a="500000">+500rb</button><button type="button" data-a="1000000">+1jt</button>' + (need ? '<button type="button" data-a="' + need + '">Finish</button>' : '') + '</div>' +
      '<div class="two"><button class="btn primary" id="gIn">Add to goal</button><button class="btn" id="gOut">Withdraw</button></div>' +
      ((g.history || []).length ? '<div class="sheet-sec">History</div><div class="timeline">' + g.history.slice().reverse().slice(0, 12).map(function (h) { return '<div class="tl"><div><b class="' + (h.amount > 0 ? 'pos' : 'neg') + '">' + (h.amount > 0 ? '+ ' : '− ') + money(Math.abs(h.amount)) + '</b><small>' + fmtDate(h.date) + '</small></div></div>'; }).join('') + '</div>' : '') +
      '<button class="btn block" id="gEdit">Edit goal</button>',
      function (r) {
        var a = r.querySelector('#gAdd'); fmtInput(a);
        requestAnimationFrame(function () { requestAnimationFrame(function () { r.querySelectorAll('.g-fill').forEach(function (c) { c.classList.add('go'); }); }); });
        r.querySelector('.quick-amts').onclick = function (e) { var b = e.target.closest('button'); if (b) { a.value = (+b.dataset.a).toLocaleString('id-ID'); haptic(); } };
        function move(sign) {
          var v = parseNum(a.value); if (!v) { toast('Enter an amount'); return; }
          var before = goalSaved(g); (g.history = g.history || []).push({ amount: sign * v, date: today() }); save();
          var done = before < g.target && goalSaved(g) >= g.target;
          closeSheet(); renderGoals(); renderInsights();
          if (done) { toast('Goal reached! 🎉'); confetti(); } else toast(sign > 0 ? 'Added to ' + g.name : 'Withdrawn');
        }
        r.querySelector('#gIn').onclick = function () { move(1); };
        r.querySelector('#gOut').onclick = function () { move(-1); };
        r.querySelector('#gEdit').onclick = function () { goalSheet(g); };
      });
  }
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body.animate) return;
    var cols = ['#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa', '#fff'];
    for (var k = 0; k < 70; k++) (function (k) {
      var p = document.createElement('i'); p.className = 'confetti'; p.style.background = cols[k % cols.length];
      p.style.left = (50 + (Math.random() - .5) * 20) + 'vw'; p.style.top = '40vh'; document.body.appendChild(p);
      var a = Math.random() * Math.PI * 2, v = 200 + Math.random() * 300;
      p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * v + 'px,' + (Math.sin(a) * v - 120) + 'px) rotate(' + (Math.random() * 720) + 'deg)', opacity: 1, offset: .6 }, { transform: 'translate(' + Math.cos(a) * v * 1.2 + 'px,' + (Math.sin(a) * v + 380) + 'px) rotate(' + (Math.random() * 1080) + 'deg)', opacity: 0 }],
        { duration: 1600 + Math.random() * 900, easing: 'cubic-bezier(.2,.7,.3,1)', delay: k * 6 }).onfinish = function () { p.remove(); };
    })(k);
  }

  // ---- bills & subscriptions ----
  function renderBills() {
    var rs = (S.recurring || []).filter(function (r) { return r.active !== false; }).sort(function (a, b) { return a.next.localeCompare(b.next); });
    $('billHead').hidden = $('hBills').hidden = false;
    $('hBills').innerHTML = rs.length ? rs.slice(0, 4).map(function (r, i) {
      var dl = daysBetween(today(), r.next), pct = Math.max(0, Math.min(1, 1 - dl / (r.freq === 'weekly' ? 7 : r.freq === 'yearly' ? 365 : 30)));
      return '<button class="w-row bill" data-rec="' + esc(r.id) + '" style="--i:' + i + '">' + icon(cat(r.cat), 'sm') + '<span class="grow">' + esc(r.name) + '<span class="sub">' + (dl <= 0 ? 'Due today' : dl === 1 ? 'Tomorrow' : 'In ' + dl + ' days') + ' · ' + r.freq + '</span><span class="bill-bar"><i style="--w:' + (pct * 100).toFixed(1) + '%"></i></span></span><span class="amt ' + (r.type === 'income' ? 'pos' : '') + '">' + money(r.amount, { rp: false }) + '</span></button>';
    }).join('') : '<button class="w-row" id="billEmpty"><span class="ic sm i3d">' + sprite('streaming') + '</span><span class="grow">Add your bills & subscriptions<span class="sub">Netflix, PLN, Indihome, salary… they add themselves</span></span><span class="muted">＋</span></button>';
  }
  function recSheet(r) {
    var isNew = !r; r = r || { id: uid(), name: '', type: 'expense', amount: 0, cat: 'streaming', wallet: S.settings.bcaWallet || (S.wallets[0] || {}).id, freq: 'monthly', next: today(), active: true };
    var catOpts = function (ty, sel) { return catTree(ty).map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + (c.parent ? '— ' : '') + esc(c.name) + '</option>'; }).join(''); };
    openSheet('<h3>' + (isNew ? 'New recurring' : 'Edit recurring') + '</h3>' +
      '<div class="seg" id="rType" style="display:grid;grid-template-columns:1fr 1fr;--x:' + (r.type === 'income' ? '100%' : '0%') + '"><button data-t="expense" class="' + (r.type === 'expense' ? 'on' : '') + '">Bill / expense</button><button data-t="income" class="' + (r.type === 'income' ? 'on' : '') + '">Income</button><i class="seg-ind" style="transform:translateX(var(--x))"></i></div>' +
      '<label class="fld">Name<input id="rName" value="' + esc(r.name) + '" placeholder="e.g. Netflix"></label>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="rAmt" inputmode="numeric" placeholder="0" value="' + (r.amount ? r.amount.toLocaleString('id-ID') : '') + '"></div>' +
      '<div class="two"><label class="fld">Repeats<select id="rFreq"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label class="fld">Next date<input id="rNext" type="date" value="' + esc(r.next) + '"></label></div>' +
      '<label class="fld">Category<select id="rCat">' + catOpts(r.type, r.cat) + '</select></label>' +
      '<label class="fld">Wallet<select id="rWallet">' + walletOpts(r.wallet) + '</select></label>' +
      '<label class="set-row plain"><span class="grow">Active</span><input type="checkbox" class="switch" id="rActive"' + (r.active !== false ? ' checked' : '') + '></label>' +
      '<p class="muted small">On the due date Apex adds the transaction for you and moves to the next date.</p>' +
      '<button class="btn primary block" id="rSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="rDel">Delete</button>'),
      function (el) {
        fmtInput(el.querySelector('#rAmt')); el.querySelector('#rFreq').value = r.freq; var ty = r.type;
        el.querySelector('#rType').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; ty = b.dataset.t; this.style.setProperty('--x', ty === 'income' ? '100%' : '0%'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); el.querySelector('#rCat').innerHTML = catOpts(ty, ty === 'income' ? 'salary' : 'streaming'); haptic(); };
        el.querySelector('#rSave').onclick = function () {
          var n = el.querySelector('#rName').value.trim(), a = parseNum(el.querySelector('#rAmt').value);
          if (!n) { toast('Name it'); return; } if (!a) { toast('Enter the amount'); return; }
          Object.assign(r, { name: n, type: ty, amount: a, freq: el.querySelector('#rFreq').value, next: el.querySelector('#rNext').value || today(), cat: el.querySelector('#rCat').value, wallet: el.querySelector('#rWallet').value, active: el.querySelector('#rActive').checked });
          if (isNew) (S.recurring = S.recurring || []).push(r);
          postRecurring(); save(); closeSheet(); renderAll(); toast('Saved ✓');
        };
        var d = el.querySelector('#rDel'); if (d) d.onclick = function () { if (!confirm('Delete this recurring item? Past transactions stay.')) return; S.recurring = S.recurring.filter(function (x) { return x !== r; }); save(); closeSheet(); renderAll(); };
      });
  }
  function recList() {
    var rs = (S.recurring || []).slice().sort(function (a, b) { return a.next.localeCompare(b.next); });
    var mt = rs.filter(function (r) { return r.active !== false && r.type === 'expense'; }).reduce(function (a, r) { return a + monthlyOf(r); }, 0);
    openSheet('<div class="sheet-top"><span style="width:36px"></span><h3>Bills & subscriptions</h3><button class="icon-btn" id="recNew" aria-label="Add">＋</button></div>' +
      '<div class="card" style="text-align:center"><div class="eyebrow">Fixed costs per month</div><div class="mid-money">' + money(mt) + '</div><div class="muted small">' + money(mt * 12, { rp: false }) + ' per year</div></div>' +
      '<div class="card list-card">' + (rs.length ? rs.map(function (r) { return '<button class="w-row" data-rec="' + esc(r.id) + '">' + icon(cat(r.cat), 'sm') + '<span class="grow">' + esc(r.name) + '<span class="sub">' + r.freq + ' · next ' + fmtDate(r.next) + (r.active === false ? ' · paused' : '') + '</span></span><span class="amt ' + (r.type === 'income' ? 'pos' : '') + '">' + money(r.amount, { rp: false }) + '</span></button>'; }).join('') : '<p class="muted small pad" style="padding-bottom:14px">Nothing yet. Tap ＋ to add Netflix, PLN, rent or your salary.</p>') + '</div>',
      function (el) { el.querySelector('#recNew').onclick = function () { recSheet(); }; el.addEventListener('click', function (e) { var b = e.target.closest('[data-rec]'); if (b) recSheet(S.recurring.filter(function (x) { return x.id === b.dataset.rec; })[0]); }); });
  }

  // ---- activity: search + calendar ----
  var txMode = 'list';
  function renderTxExtras() {
    var q = ($('txQ').value || '').trim().toLowerCase();
    $('txMode').style.setProperty('--x', txMode === 'cal' ? '100%' : '0%');
    document.querySelectorAll('#txMode button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === txMode); });
    if (q) {
      var num = parseNum(q), res = S.tx.filter(function (t) {
        var c = t.type === 'transfer' ? 'transfer' : cat(t.cat).name;
        return ((t.merchant || '') + ' ' + (t.note || '') + ' ' + c + ' ' + wallet(t.wallet).name).toLowerCase().indexOf(q) !== -1 || (num && String(t.amount).indexOf(String(num)) !== -1);
      }).sort(function (a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')); }).slice(0, 80);
      $('txCal').hidden = true;
      $('txList').innerHTML = '<div class="muted small" style="margin:0 4px 8px">' + res.length + ' result' + (res.length === 1 ? '' : 's') + '</div>' + (res.length ? '<div class="card list-card stagger">' + res.map(function (t, i) { return txRow(t, i, true); }).join('') + '</div>' : '');
      return;
    }
    $('txCal').hidden = txMode !== 'cal';
    if (txMode !== 'cal') return;
    var y = cur.getFullYear(), mo = cur.getMonth(), dim = new Date(y, mo + 1, 0).getDate(), first = (new Date(y, mo, 1).getDay() + 6) % 7, sums = {}, max = 0;
    S.tx.forEach(function (t) { if (t.type === 'expense' && t.date.slice(0, 7) === ym(cur) && touches(t, walletSel)) { sums[t.date] = (sums[t.date] || 0) + t.amount; } });
    Object.keys(sums).forEach(function (k) { max = Math.max(max, sums[k]); });
    var cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (d) { return '<span class="cal-h">' + d + '</span>'; }).join('');
    for (var b = 0; b < first; b++) cells += '<span></span>';
    for (var d = 1; d <= dim; d++) {
      var key = y + '-' + pad(mo + 1) + '-' + pad(d), v = sums[key] || 0, lv = v ? Math.max(.14, v / max) : 0;
      cells += '<button class="cal-d' + (key === today() ? ' today' : '') + (v ? ' has' : '') + '" data-day="' + key + '" style="--a:' + lv.toFixed(2) + ';--i:' + d + '"><b>' + d + '</b>' + (v ? '<small>' + (S.settings.hide ? '•••' : short(v)) + '</small>' : '') + '</button>';
    }
    var tot = Object.keys(sums).reduce(function (a, k) { return a + sums[k]; }, 0), days = Object.keys(sums).length;
    $('txCal').innerHTML = '<div class="card cal"><div class="cal-top"><div><div class="eyebrow">Spent in ' + MONTHS[mo] + '</div><div class="mid-money">' + money(tot) + '</div></div><div class="cal-key"><span>less</span><i style="--a:.15"></i><i style="--a:.45"></i><i style="--a:.75"></i><i style="--a:1"></i><span>more</span></div></div>' +
      '<div class="cal-grid">' + cells + '</div><div class="muted small" style="margin-top:10px">' + days + ' spending day' + (days === 1 ? '' : 's') + ' · ' + (dim - days) + ' no-spend day' + (dim - days === 1 ? '' : 's') + '</div></div>';
  }
  function daySheet(day) {
    var list = S.tx.filter(function (t) { return t.date === day && touches(t, walletSel); });
    openSheet('<h3>' + fmtDate(day) + '</h3>' + (list.length ? '<div class="card list-card stagger">' + list.map(function (t, i) { return txRow(t, i, false); }).join('') + '</div>' : '<div class="empty">No transactions on this day 🎉</div>'),
      function (el) { el.addEventListener('click', function (e) { var r = e.target.closest('.tx'); if (r) { var t = S.tx.filter(function (x) { return x.id === r.dataset.id; })[0]; if (t) txSheet(t); } }); });
  }

  function bindFeatures() {
    $('goalAdd').onclick = function () { goalSheet(); };
    $('hGoals').addEventListener('click', function (e) { if (e.target.closest('#goalAdd2')) { goalSheet(); return; } var g = e.target.closest('[data-goal]'); if (g) goalDetail(S.goals.filter(function (x) { return x.id === g.dataset.goal; })[0]); });
    $('billManage').onclick = recList; $('recBtn').onclick = recList;
    $('hBills').addEventListener('click', function (e) { if (e.target.closest('#billEmpty')) { recSheet(); return; } var b = e.target.closest('[data-rec]'); if (b) recSheet(S.recurring.filter(function (x) { return x.id === b.dataset.rec; })[0]); });
    $('txQ').addEventListener('input', function () { if (!this.value) renderTx(); renderTxExtras(); });
    $('txMode').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; txMode = b.dataset.m; haptic(); renderTxExtras(); };
    $('txCal').addEventListener('click', function (e) { var d = e.target.closest('[data-day]'); if (d) { haptic(); daySheet(d.dataset.day); } });
    $('csvBtn').onclick = function () {
      var rows = [['Date', 'Time', 'Type', 'Category', 'Wallet', 'To wallet', 'Amount', 'Merchant', 'Note']].concat(S.tx.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).map(function (t) {
        return [t.date, t.time || '', t.type, t.type === 'transfer' ? '' : cat(t.cat).name, wallet(t.wallet).name, t.toWallet ? wallet(t.toWallet).name : '', (t.type === 'income' || flowIn(t) ? '' : '-') + t.amount, t.merchant || '', t.note || ''];
      }));
      var csv = rows.map(function (r) { return r.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'apex-transactions-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      toast('CSV exported ✓');
    };
  }
  function renderFeatures() { renderInsights(); renderGoals(); renderBills(); renderTxExtras(); }

  // =================== PREMIUM PACK: live prices, cloud sync, scan, WhatsApp + split, wrapped, home layout, onboarding ===================
  var DINO = (document.querySelector('link[rel=apple-touch-icon]') || {}).href || 'icon.svg';
  function dinoImg(cls) { return '<img class="dino ' + (cls || '') + '" src="' + DINO + '" alt="">'; }

  // ---------- live asset prices ----------
  var ASSETS = { gold: { name: 'Gold (gram)', unit: 'g' }, btc: { name: 'Bitcoin', unit: 'BTC' }, eth: { name: 'Ethereum', unit: 'ETH' }, usd: { name: 'US Dollar', unit: 'USD' } };
  var PRICES = (function () { try { return JSON.parse(localStorage.getItem('apex_prices')) || {}; } catch (e) { return {}; } })();
  function liveValue(w) { var h = w && w.holding; if (!h || !h.asset || !(+h.qty)) return null; var p = PRICES[h.asset]; return p ? +h.qty * p : null; }
  function fetchPrices(force) {
    if (!force && PRICES.ts && Date.now() - PRICES.ts < 5 * 60e3) return Promise.resolve();
    if (!S.wallets.some(function (w) { return w.holding && w.holding.asset; }) && !force) return Promise.resolve();
    if (force) busy(true, 'Updating prices…');
    return fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,pax-gold&vs_currencies=idr').then(function (r) { if (force) busy(false); return r.json(); }, function (e) { if (force) busy(false); throw e; }).then(function (j) {
      PRICES = { btc: j.bitcoin && j.bitcoin.idr, eth: j.ethereum && j.ethereum.idr, usd: j.tether && j.tether.idr, gold: j['pax-gold'] && j['pax-gold'].idr / 31.1034768, ts: Date.now() };
      try { localStorage.setItem('apex_prices', JSON.stringify(PRICES)); } catch (e) {}
      renderAll();
    }).catch(function () {});
  }
  function plOf(w) { var v = liveValue(w), c = w.holding && +w.holding.cost; if (v == null || !c) return null; return { v: v, d: v - c, pc: (v - c) / c * 100 }; }
  function plTag(w) {
    var p = plOf(w), h = w.holding; if (!h || liveValue(w) == null) return '';
    var q = (+h.qty).toLocaleString('id-ID', { maximumFractionDigits: 6 }) + ' ' + ASSETS[h.asset].unit;
    return '<span class="pl ' + (p ? (p.d >= 0 ? 'up' : 'dn') : '') + '"><i class="live"></i>' + q + (p ? ' · ' + (p.d >= 0 ? '▲ ' : '▼ ') + Math.abs(p.pc).toFixed(1) + '%' : '') + '</span>';
  }

  // ---------- cloud backup & sync (encrypted) ----------
  var FB = 'https://hurricane-scorecard-default-rtdb.firebaseio.com/apex/';
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function deriveKey(pass, id) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']).then(function (k) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('apex-' + id), iterations: 150000, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function cloudPayload() { var c = JSON.parse(JSON.stringify(S)); delete c.settings.cloud; return c; }
  var cloudT = null, cloudBusy = false;
  function cloudQueue() { var c = S.settings && S.settings.cloud; if (!c || !c.on) return; clearTimeout(cloudT); cloudT = setTimeout(cloudPush, 3500); }
  function cloudPush() {
    var c = S.settings.cloud; if (!c || !c.on || cloudBusy) return Promise.resolve();
    cloudBusy = true; setCloudStatus('Backing up…'); busy(true, 'Backing up…');
    var iv = crypto.getRandomValues(new Uint8Array(12)), at = S.updatedAt || Date.now();
    return deriveKey(c.pass, c.id).then(function (k) { return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(cloudPayload()))); })
      .then(function (ct) { return fetch(FB + c.id + '.json?print=silent', { method: 'PUT', body: JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct), at: at }) }); })
      .then(function (r) { if (!r.ok) throw new Error(r.status); c.last = Date.now(); localStorage.setItem(KEY, JSON.stringify(S)); setCloudStatus(); })
      .catch(function () { setCloudStatus('Backup failed. Will retry.'); }).then(function () { cloudBusy = false; busy(false); });
  }
  function cloudPull(id, pass, opts) {
    opts = opts || {}; busy(true, 'Syncing cloud…');
    var done = function (x) { busy(false); return x; }, fail = function (e) { busy(false); throw e; };
    return fetch(FB + id + '.json').then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ct) { if (opts.mustExist) throw new Error('No backup found for that code'); return null; }
      if (!opts.force && S.updatedAt && j.at <= S.updatedAt) return null;
      return deriveKey(pass, id).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(j.iv) }, k, unb64(j.ct)); })
        .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); }, function () { throw new Error('Wrong passphrase'); });
    }).then(function (data) {
      if (!data) return false;
      var cloud = { id: id, pass: pass, on: true, last: Date.now() };
      S = data; S.settings = S.settings || {}; S.settings.cloud = cloud;
      load2(); localStorage.setItem(KEY, JSON.stringify(S)); renderAll(); return true;
    }).then(done, fail);
  }
  function load2() { var d = blank(); Object.keys(d).forEach(function (k) { if (S[k] == null && k !== 'catVer') S[k] = d[k]; }); Object.keys(d.settings).forEach(function (k) { if (S.settings[k] == null) S.settings[k] = d.settings[k]; }); }
  function setCloudStatus(msg) {
    var el = $('cloudStatus'); if (!el) return; var c = S.settings.cloud;
    el.textContent = msg || (c && c.on ? 'On · last backup ' + (c.last ? new Date(c.last).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : 'pending') : 'Off · your data is only on this device');
    $('cloudBtn').textContent = c && c.on ? 'Manage' : 'Turn on';
  }
  function cloudSheet() {
    var c = S.settings.cloud;
    if (c && c.on) {
      openSheet('<h3>Cloud backup</h3><span class="ic preview i3d">' + sprite('insurance') + '</span>' +
        '<p class="muted small" style="text-align:center">Encrypted on this phone with your passphrase before upload. Nobody else can read it.</p>' +
        '<div class="card"><div class="eyebrow">Your sync code</div><div class="sync-code" id="syncCode">' + esc(c.id) + '</div><div class="muted small">Use this code + your passphrase to open your data on another device.</div><button class="btn block" id="copyCode">Copy code</button></div>' +
        '<button class="btn primary block" id="cNow">Back up now</button><button class="btn danger block" id="cOff">Turn off on this device</button>',
        function (r) {
          r.querySelector('#copyCode').onclick = function () { try { navigator.clipboard.writeText(c.id); toast('Code copied'); } catch (e) { toast(c.id); } };
          r.querySelector('#cNow').onclick = function () { cloudPush().then(function () { toast('Backed up ✓'); closeSheet(); }); };
          r.querySelector('#cOff').onclick = function () { if (!confirm('Stop backing up from this device? Your cloud copy stays.')) return; c.on = false; save(); closeSheet(); setCloudStatus(); };
        });
      return;
    }
    openSheet('<h3>Cloud backup</h3><span class="ic preview i3d">' + sprite('insurance') + '</span>' +
      '<div class="seg" id="cMode" style="display:grid;grid-template-columns:1fr 1fr;--x:0%"><button data-m="new" class="on">New backup</button><button data-m="join">Restore / link</button><i class="seg-ind" style="transform:translateX(var(--x))"></i></div>' +
      '<label class="fld" id="cCodeL" hidden>Sync code<input id="cCode" autocomplete="off" placeholder="e.g. 7f3a9c..."></label>' +
      '<label class="fld">Passphrase<input id="cPass" type="password" autocomplete="new-password" placeholder="At least 8 characters"></label>' +
      '<label class="fld" id="cPass2L">Repeat passphrase<input id="cPass2" type="password" autocomplete="new-password"></label>' +
      '<p class="muted small">Remember this passphrase. It is never uploaded, so it cannot be reset.</p>' +
      '<button class="btn primary block" id="cGo">Turn on backup</button>',
      function (r) {
        var mode = 'new';
        r.querySelector('#cMode').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; this.style.setProperty('--x', mode === 'join' ? '100%' : '0%'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); r.querySelector('#cCodeL').hidden = mode !== 'join'; r.querySelector('#cPass2L').hidden = mode === 'join'; r.querySelector('#cGo').textContent = mode === 'join' ? 'Restore my data' : 'Turn on backup'; };
        r.querySelector('#cGo').onclick = function () {
          var p = r.querySelector('#cPass').value; if (p.length < 8) { toast('Use at least 8 characters'); return; }
          var btn = this; btn.disabled = true;
          if (mode === 'new') {
            if (p !== r.querySelector('#cPass2').value) { toast('Passphrases don’t match'); btn.disabled = false; return; }
            var id = Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(10)), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
            S.settings.cloud = { id: id, pass: p, on: true }; save(); cloudPush().then(function () { closeSheet(); setCloudStatus(); toast('Cloud backup on ☁️'); setTimeout(cloudSheet, 500); });
          } else {
            var code = r.querySelector('#cCode').value.trim().toLowerCase(); if (!code) { toast('Enter your sync code'); btn.disabled = false; return; }
            if (!confirm('Replace the data on this device with your cloud backup?')) { btn.disabled = false; return; }
            cloudPull(code, p, { force: true, mustExist: true }).then(function () { closeSheet(); toast('Restored from cloud ✓'); }).catch(function (e) { toast(e.message); btn.disabled = false; });
          }
        };
      });
  }

  // ---------- receipt / screenshot scan ----------
  function loadOCR() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = ok; s.onerror = function () { no(new Error('Could not load the scanner')); }; document.head.appendChild(s); });
  }
  function parseReceipt(text) {
    var p = window.BcaParser.parseBcaEmail({ subject: 'Transaksi berhasil', body: text }) || {};
    var amount = 0, lines = text.split('\n');
    // Prefer the grand total line (TOTAL / Grand total / Total bayar), never the subtotal.
    for (var li = lines.length - 1; li >= 0 && !amount; li--) { var L = lines[li]; if (/(grand\s*total|total\s*(bayar|pembayaran|belanja)?)\b/i.test(L) && !/sub\s*-?\s*total/i.test(L)) { var nm = L.match(/([\d]{1,3}(?:[.,]\d{3})+|\d{4,})(?:[.,]\d{1,2})?/); if (nm) amount = window.BcaParser.parseAmount(nm[0]); } }
    if (!amount) amount = p.amount || 0;
    if (!amount) { var m, best = 0, re = /(?:rp\.?|idr|total)\s*:?\s*([\d.,]{4,})/gi; while ((m = re.exec(text))) { var v = window.BcaParser.parseAmount(m[1]); if (v > best) best = v; } amount = best; }
    var merchant = p.merchant && !/transaksi/i.test(p.merchant) ? p.merchant : (text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 2 && /[a-z]/i.test(l) && !/rp|idr|total|tanggal|date|struk|receipt/i.test(l); })[0] || '');
    var dm = text.match(/(\d{1,2})[\/\-. ](\d{1,2}|jan|feb|mar|apr|may|mei|jun|jul|aug|agu|sep|oct|okt|nov|dec|des)[a-z]*[\/\-. ](\d{2,4})/i), date = '';
    if (dm) { var mon = isNaN(dm[2]) ? ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(dm[2].slice(0, 3).toLowerCase().replace('mei', 'may').replace('agu', 'aug').replace('okt', 'oct').replace('des', 'dec')) + 1 : +dm[2]; var yr = +dm[3] < 100 ? 2000 + +dm[3] : +dm[3]; if (mon >= 1 && mon <= 12) date = yr + '-' + pad(mon) + '-' + pad(+dm[1]); }
    return { amount: amount, merchant: merchant.slice(0, 50), date: date };
  }
  function scanInto(root) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var bar = root.querySelector('.scan-bar'); bar.hidden = false; bar.querySelector('i').style.width = '8%'; bar.querySelector('span').textContent = 'Loading scanner…'; busy(true, 'Reading receipt…');
      loadOCR().then(function () {
        return window.Tesseract.recognize(f, 'eng+ind', { logger: function (m) { if (m.status === 'recognizing text') { bar.querySelector('i').style.width = (10 + m.progress * 90) + '%'; bar.querySelector('span').textContent = 'Reading receipt… ' + Math.round(m.progress * 100) + '%'; } } });
      }).then(function (res) {
        var r = parseReceipt(res.data.text || ''); bar.hidden = true; busy(false);
        if (r.amount) { var a = root.querySelector('#fAmt'); a.value = r.amount.toLocaleString('id-ID'); a.classList.add('flash-up'); }
        if (r.merchant) root.querySelector('#fMerch').value = r.merchant;
        if (r.date) root.querySelector('#fDate').value = r.date;
        toast(r.amount ? 'Receipt read ✓ Check and save' : 'Couldn’t find the amount. Type it in.');
      }).catch(function (e) { bar.hidden = true; busy(false); toast(e.message || 'Scan failed'); });
    };
    inp.click();
  }

  // ---------- split bill + WhatsApp ----------
  function splitSheet(total, merchant, date, walletId) {
    openSheet('<h3>Split bill</h3><div class="muted small" style="text-align:center">' + money(total) + (merchant ? ' · ' + esc(merchant) : '') + '</div>' +
      '<label class="fld">Friends (comma separated)<input id="spNames" placeholder="Bren, Louis, Hugo"></label>' +
      '<label class="set-row plain"><span class="grow">Include me in the split</span><input type="checkbox" class="switch" id="spMe" checked></label>' +
      '<div class="card" id="spPrev"></div><button class="btn primary block" id="spGo">Create money owed</button>',
      function (r) {
        function names() { return r.querySelector('#spNames').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
        function share() { var n = names().length + (r.querySelector('#spMe').checked ? 1 : 0); return n ? Math.round(total / n) : 0; }
        function prev() { var ns = names(), s = share(); r.querySelector('#spPrev').innerHTML = ns.length ? ns.map(function (n) { return '<div class="sp-row">' + avatar(n) + '<span class="grow">' + esc(n) + '</span><b>' + money(s, { rp: false }) + '</b></div>'; }).join('') : '<div class="muted small">Type names to see each share.</div>'; }
        r.querySelector('#spNames').addEventListener('input', prev); r.querySelector('#spMe').onchange = prev; prev();
        setTimeout(function () { r.querySelector('#spNames').focus(); }, 380);
        r.querySelector('#spGo').onclick = function () {
          var ns = names(), s = share(); if (!ns.length) { toast('Add at least one friend'); return; }
          ns.forEach(function (n) { S.debts.push({ id: uid(), dir: 'in', person: n, title: 'Split: ' + (merchant || 'bill'), amount: s, created: date || today(), due: '', wallet: walletId, tags: 'split', notes: '', payments: [], ts: Date.now() }); });
          save(); closeSheet(); renderAll(); toast(ns.length + ' friend' + (ns.length > 1 ? 's' : '') + ' now owe you ' + money(s, { rp: true }) + ' each');
        };
      });
  }
  function waRemind(d) {
    var rem = dRemain(d), inn = d.dir === 'in';
    var msg = inn ? 'Hi ' + d.person + ', just a friendly reminder about ' + (d.title || 'the money') + ': Rp ' + fmt(rem) + ' is still remaining' + (d.due ? ' (due ' + fmtDate(d.due) + ')' : '') + '. Thank you! 🙏'
      : 'Hi ' + d.person + ', I still owe you Rp ' + fmt(rem) + ' for ' + (d.title || 'the loan') + '. I’ll settle it soon 🙏';
    var phone = String(d.phone || '').replace(/[^\d]/g, '').replace(/^0/, '62');
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  }

  // ---------- monthly wrapped ----------
  function wrapData(mDate) {
    var m = ym(mDate), prevM = ym(new Date(mDate.getFullYear(), mDate.getMonth() - 1, 1));
    var spent = 0, inc = 0, prevSpent = 0, cats = {}, days = {}, n = 0;
    S.tx.forEach(function (t) {
      if (!touches(t, 'all')) return; var mk = t.date.slice(0, 7);
      if (mk === prevM && t.type === 'expense') prevSpent += t.amount;
      if (mk !== m) return;
      if (t.type === 'expense') { spent += t.amount; cats[t.cat] = (cats[t.cat] || 0) + t.amount; days[t.date] = (days[t.date] || 0) + t.amount; n++; }
      if (t.type === 'income') inc += t.amount;
    });
    var topC = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0], topD = Object.keys(days).sort(function (a, b) { return days[b] - days[a]; })[0];
    var dim = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0).getDate();
    return { m: MONTHS[mDate.getMonth()], spent: spent, inc: inc, prevSpent: prevSpent, topC: topC, topCv: topC ? cats[topC] : 0, topD: topD, topDv: topD ? days[topD] : 0, n: n, noSpend: dim - Object.keys(days).length, saved: inc - spent };
  }
  function openWrapped(mDate) {
    var d = wrapData(mDate || new Date()), diff = d.prevSpent ? Math.round((d.spent - d.prevSpent) / d.prevSpent * 100) : null;
    var goals = (S.goals || []).map(function (g) { return { g: g, p: g.target ? goalSaved(g) / g.target : 0 }; }).sort(function (a, b) { return b.p - a.p; })[0];
    var slides = [
      { c: 'w1', h: '<div class="w-k">Your</div><div class="w-big">' + d.m + '</div><div class="w-k">in money</div>' + dinoImg('w-dino'), s: 'Tap to continue' },
      { c: 'w2', h: '<div class="w-k">You spent</div><div class="w-num" data-n="' + d.spent + '"></div>' + (diff != null ? '<div class="w-chip ' + (diff > 0 ? 'dn' : 'up') + '">' + (diff > 0 ? '▲ ' : '▼ ') + Math.abs(diff) + '% vs last month</div>' : ''), s: d.n + ' transactions' },
      { c: 'w3', h: d.topC ? '<div class="w-k">Your top category</div><div class="w-ic">' + sprite(spKey(cat(d.topC)) || 'other_out') + '</div><div class="w-mid">' + esc(cat(d.topC).name) + '</div><div class="w-num sm" data-n="' + d.topCv + '"></div>' : '<div class="w-mid">No spending yet</div>', s: d.spent ? Math.round(d.topCv / d.spent * 100) + '% of everything you spent' : '' },
      { c: 'w4', h: d.topD ? '<div class="w-k">Biggest spending day</div><div class="w-big">' + new Date(d.topD + 'T00:00:00').getDate() + ' ' + d.m.slice(0, 3) + '</div><div class="w-num sm" data-n="' + d.topDv + '"></div>' : '<div class="w-mid">Calm month</div>', s: d.noSpend + ' no-spend days 🌿' },
      { c: 'w5', h: '<div class="w-k">' + (d.saved >= 0 ? 'You kept' : 'You spent more than you earned by') + '</div><div class="w-num" data-n="' + Math.abs(d.saved) + '"></div><div class="w-bars"><div><i style="--w:100%" class="in"></i><span>In ' + money(d.inc, { rp: false }) + '</span></div><div><i style="--w:' + (d.inc ? Math.min(100, d.spent / d.inc * 100) : 100).toFixed(0) + '%" class="out"></i><span>Out ' + money(d.spent, { rp: false }) + '</span></div></div>', s: d.inc ? Math.round(Math.max(0, d.saved) / d.inc * 100) + '% savings rate' : '' },
      { c: 'w6', h: (goals ? '<div class="w-k">Closest goal</div><div class="w-ring">' + ringSvg(goals.p, '#34d399', 150) + '<b>' + Math.round(goals.p * 100) + '%</b></div><div class="w-mid">' + esc(goals.g.name) + '</div>' : '<div class="w-k">Next month</div><div class="w-mid">Set a goal and watch it grow</div>') + dinoImg('w-dino sm'), s: 'See you next month 🦖' }
    ];
    var ov = document.createElement('div'); ov.className = 'wrapped'; ov.innerHTML = '<div class="w-prog">' + slides.map(function () { return '<i><b></b></i>'; }).join('') + '</div><button class="w-x" aria-label="Close">✕</button><div class="w-stage"></div>';
    document.body.appendChild(ov); void ov.offsetWidth; ov.classList.add('show');
    var i = -1, t = null;
    function go(k) {
      if (k >= slides.length) return close(); if (k < 0) k = 0; i = k; clearTimeout(t);
      var sl = slides[i]; ov.querySelector('.w-stage').innerHTML = '<div class="w-slide ' + sl.c + '">' + sl.h + '<div class="w-sub">' + sl.s + '</div></div>';
      ov.querySelectorAll('.w-prog i').forEach(function (p, j) { p.className = j < i ? 'done' : j === i ? 'on' : ''; });
      ov.querySelectorAll('.w-num').forEach(function (el) { var n = +el.dataset.n, t0 = performance.now(); (function step(now) { var f = Math.min(1, (now - t0) / 1100), e = 1 - Math.pow(1 - f, 3); el.textContent = S.settings.hide ? 'Rp ••••••' : 'Rp ' + fmt(n * e); if (f < 1) requestAnimationFrame(step); })(t0); });
      requestAnimationFrame(function () { requestAnimationFrame(function () { ov.querySelectorAll('.g-fill').forEach(function (c) { c.classList.add('go'); }); }); });
      if (i === slides.length - 1) confetti();
      t = setTimeout(function () { go(i + 1); }, 5200);
    }
    function close() { clearTimeout(t); ov.classList.remove('show'); setTimeout(function () { ov.remove(); }, 400); }
    ov.querySelector('.w-x').onclick = function (e) { e.stopPropagation(); close(); };
    ov.addEventListener('click', function (e) { if (e.target.closest('.w-x')) return; haptic(); go(e.clientX < innerWidth * .3 ? i - 1 : i + 1); });
    var y0 = null; ov.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; }, { passive: true }); ov.addEventListener('touchend', function (e) { if (y0 != null && e.changedTouches[0].clientY - y0 > 90) close(); y0 = null; });
    go(0);
  }

  // ---------- customizable home ----------
  var SEC_NAMES = { business: 'Business', komisi: 'Komisi Noah', insights: 'Insights', upcoming: 'Upcoming & overdue', goals: 'Goals', bills: 'Bills & subscriptions', allocation: 'Allocation', wallets: 'Wallets', cashflow: 'Cash flow', spending: 'Spending donut', month: 'This month', recent: 'Recent activity' };
  function homeLayout() {
    var keys = Object.keys(SEC_NAMES), L = (S.settings.home || []).filter(function (x) { return SEC_NAMES[x.k]; });
    keys.forEach(function (k) { if (!L.some(function (x) { return x.k === k; })) L.push({ k: k, on: true }); });
    return L;
  }
  function applyHome() {
    var box = $('homeSecs'); if (!box) return;
    homeLayout().forEach(function (x) { var el = box.querySelector('[data-sec="' + x.k + '"]'); if (!el) return; box.appendChild(el); el.classList.toggle('sec-off', !x.on); });
  }
  function homeSheet() {
    var L = homeLayout();
    function rows() { return L.map(function (x, i) { return '<div class="hl-row" data-i="' + i + '" data-id="' + x.k + '"><span class="drag">≡</span><label class="grow"><input type="checkbox" class="switch" ' + (x.on ? 'checked' : '') + '> ' + SEC_NAMES[x.k] + '</label><button class="x" data-up="' + i + '"' + (i ? '' : ' disabled') + '>↑</button><button class="x" data-dn="' + i + '"' + (i < L.length - 1 ? '' : ' disabled') + '>↓</button></div>'; }).join(''); }
    openSheet('<h3>Customize Home</h3><p class="muted small" style="text-align:center">Turn sections on or off and change their order.</p><div class="card list-card hl" id="hlList">' + rows() + '</div><button class="btn primary block" id="hlDone">Done</button><button class="btn block" id="hlReset">Reset to default</button>',
      function (r) {
        var list = r.querySelector('#hlList');
        list.addEventListener('click', function (e) {
          var u = e.target.closest('[data-up]'), d = e.target.closest('[data-dn]');
          if (u) { var i = +u.dataset.up; L.splice(i - 1, 0, L.splice(i, 1)[0]); } else if (d) { var j = +d.dataset.dn; L.splice(j + 1, 0, L.splice(j, 1)[0]); } else return;
          haptic(); list.innerHTML = rows(); S.settings.home = L; save(); applyHome();
        });
        makeSortable(list, '.hl-row', '.drag', function (ids) { L = ids.map(function (k) { return L.filter(function (x) { return x.k === k; })[0]; }); list.innerHTML = rows(); S.settings.home = L; save(); applyHome(); haptic(); });
        list.addEventListener('change', function (e) { var row = e.target.closest('.hl-row'); if (!row) return; L[+row.dataset.i].on = e.target.checked; S.settings.home = L; save(); applyHome(); });
        r.querySelector('#hlDone').onclick = closeSheet;
        r.querySelector('#hlReset').onclick = function () { delete S.settings.home; save(); applyHome(); closeSheet(); toast('Home reset'); };
      });
  }

  // ---------- onboarding ----------
  function onboarding() {
    if (S.onboarded) return;
    if (S.tx.length || S.debts.length || S.wallets.length > 2) { S.onboarded = true; save(); return; }
    var steps = [
      { t: 'Welcome to Apex', b: 'Your private money app. Everything stays on your phone unless you turn on encrypted cloud backup.' },
      { t: 'It fills itself in', b: 'Connect BCA email sync and every QRIS, transfer and payment becomes a transaction automatically.' },
      { t: 'See the full picture', b: 'Net worth, money people owe you, goals and bills, in one calm place.' }
    ];
    var ov = document.createElement('div'); ov.className = 'onb'; document.body.appendChild(ov); var i = 0;
    function draw() {
      var s = steps[i];
      ov.innerHTML = '<div class="onb-in">' + dinoImg('onb-dino') + '<h2>' + s.t + '</h2><p>' + s.b + '</p><div class="onb-dots">' + steps.map(function (_, j) { return '<i class="' + (j === i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<button class="btn primary block" id="onbNext">' + (i < steps.length - 1 ? 'Continue' : 'Let’s go') + '</button>' + (i < steps.length - 1 ? '<button class="onb-skip" id="onbSkip">Skip</button>' : '') + '</div>';
      ov.querySelector('#onbNext').onclick = function () { haptic(); if (i < steps.length - 1) { i++; draw(); } else done(); };
      var sk = ov.querySelector('#onbSkip'); if (sk) sk.onclick = done;
    }
    function done() { S.onboarded = true; save(); ov.classList.add('out'); setTimeout(function () { ov.remove(); }, 450); }
    draw(); requestAnimationFrame(function () { ov.classList.add('show'); });
  }

  // ---------- offline ----------
  function registerSW() { if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {}); }

  function bindPremium() {
    $('cloudBtn').onclick = cloudSheet; $('homeBtn').onclick = homeSheet; $('wrapBtn').onclick = function () { openWrapped(new Date()); };
    setInterval(function () { if (!document.hidden) fetchPrices(); }, 5 * 60e3);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { fetchPrices(); var c = S.settings.cloud; if (c && c.on) cloudPull(c.id, c.pass).then(function (ch) { if (ch) toast('Synced from cloud ☁️'); }).catch(function () {}); } });
  }

  // One-time reset requested by the owner: net worth starts at 0 and they enter everything themselves.
  function zeroAll() {
    try { localStorage.setItem('apex_backup_before_zero', JSON.stringify(S)); } catch (e) {}
    S.wallets.forEach(function (w) { w.initial = 0; delete w.holding; });
    S.tx = []; S.debts = []; S.seen = {}; S.review = [];
    (S.goals || []).forEach(function (g) { g.history = []; });
    (S.recurring || []).forEach(function (r) { var t = new Date(); t.setDate(t.getDate() + 1); if (r.next <= today()) r.next = ymd(t); });
    S.settings.startFrom = Date.now(); S.settings.lastSync = Date.now();
  }
  function zeroStart() {
    if (S.zeroVer === 2) return;
    zeroAll(); S.settings.autoSync = false; S.zeroVer = 2; return;
    try { localStorage.setItem('apex_backup_before_zero', JSON.stringify(S)); } catch (e) {}
    S.wallets.forEach(function (w) { w.initial = 0; delete w.holding; });
    S.tx = []; S.debts = []; S.seen = {}; S.review = [];
    (S.goals || []).forEach(function (g) { g.history = []; });
    S.settings.startFrom = Date.now(); S.settings.lastSync = Date.now();
    S.zeroVer = 1;
  }
  // One-time: the owner's wallet list (names from their Money Lover), balances start at 0.
  function ownerWallets() {
    if (S.walletVer === 1) return;
    var LIST = [['bca', 'RESERVE', '💰', 'savings'], ['cash', 'Personal Expense', '🍿', 'cash'], ['gold', 'GOLD', '🥇', 'invest'], ['mandiri', 'BANK MANDIRI', '🏦', 'cash'],
      ['daytona', 'INVESTMENT DAYTONA', '⌚', 'invest'], ['jimney', 'JIMNEY INVESTMENT', '🚙', 'invest'], ['hulk', 'INVESTMENT HULK ROLEX', '⌚', 'invest'],
      ['ajaib', 'AJAIB', '💹', 'invest'], ['stocks', 'STOCKS', '📊', 'invest'], ['goldputer', 'GOLD PUTER', '🪙', 'invest']];
    var byName = function (n) { return S.wallets.filter(function (w) { return w.name.toLowerCase() === n.toLowerCase(); })[0]; };
    var out = LIST.map(function (x) {
      var w = byName(x[1]) || S.wallets.filter(function (y) { return y.id === x[0]; })[0] || { id: x[0], initial: 0 };
      w.name = x[1]; w.icon = x[2]; w.group = x[3]; delete w.sp; delete w.custom; if (w.initial == null) w.initial = 0;
      return w;
    });
    // keep any other wallet the owner made, at the end
    S.wallets.forEach(function (w) { if (out.indexOf(w) === -1) out.push(w); });
    S.wallets = out;
    var res = out[0];
    S.settings.bcaWallet = res.id;
    ensureAccounts(); S.settings.bcaAccounts.forEach(function (a) { if (/46$/.test(a.mask)) a.wallet = res.id; });
    if (walletSel !== 'all' && !S.wallets.some(function (w) { return w.id === walletSel; })) walletSel = 'all';
    S.walletVer = 1;
  }
  function addKomisi() { if (!S.cats.some(function (c) { return c.id === 'komisi_in'; })) { var at = S.cats.map(function (c) { return c.type; }).lastIndexOf('income') + 1 || S.cats.length; S.cats.splice(at, 0, { id: 'komisi_in', name: 'KOMISI', icon: '💰', type: 'income', sp: 'komisi_out' }); } }
  function walletIcons() {
    if (S.wIconVer === 1) return;
    var M = [[/reserve/i, 'w_reserve'], [/personal/i, 'personal_expense'], [/puter/i, 'w_goldputer'], [/^gold$/i, 'gold_inv'], [/mandiri|bank|bca/i, 'w_bank'], [/daytona/i, 'w_daytona'], [/jimney/i, 'w_jimney'], [/hulk|rolex/i, 'w_hulk'], [/ajaib/i, 'w_ajaib'], [/stock|saham/i, 'stocks'], [/cash|tunai/i, 'w_cash']];
    S.wallets.forEach(function (w) { if (w.sp) return; for (var i = 0; i < M.length; i++) if (M[i][0].test(w.name)) { w.sp = M[i][1]; break; } });
    S.wIconVer = 1;
  }
  function defBiz() { if (S.businesses) return; S.businesses = [{ id: 'hurricane', name: 'HURRICANE', sp: 'bi' }, { id: 'sentaris', name: 'SENTARIS', sp: 'sentaris' }, { id: 'others', name: 'OTHERS', sp: 'other_out' }]; }
  load(); zeroStart(); ownerWallets(); walletIcons(); defBiz(); addKomisi(); useGenerated(); postRecurring(); save(); importFromHash(); bind(); bindFeatures(); bindPremium(); renderAll(); applyHome(); setCloudStatus();
  $('hInsights').addEventListener('click', function (e) { if (e.target.closest('[data-wrap]')) { haptic(); openWrapped(new Date()); } });
  hideSplash(); fetchPrices(); registerSW(); setTimeout(onboarding, 1300);
  (function () { var c = S.settings.cloud; if (c && c.on) cloudPull(c.id, c.pass).then(function (ch) { if (ch) { applyHome(); toast('Synced from cloud ☁️'); } }).catch(function () {}); })();
  if (S.settings.pinHash) { delete S.settings.pinHash; save(); }
  bindTilt(); bindSpecular(); bindPull(); bindScrub(); window.addEventListener('scroll', onScroll, { passive: true });
  requestAnimationFrame(moveInd);
  if (S.settings.autoSync) sync(false);
})();
