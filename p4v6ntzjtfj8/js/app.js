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
    ids.forEach(function (id) { var wo = wallet(id), lv = bookValue(wo); if (lv != null) { live += lv; if (wo.holding && wo.holding.withCash) manual.push(id); } else manual.push(id); });
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
    renderUpcoming(); renderRealBtn(); renderKomisi(); renderWorldCard(); renderBizCard(); renderInstCard();
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
  // Distinct premium card colors so a stack never reads as one block (like real bank cards)
  var CARD_PAL = [['#b8893b', '#5c3d0e'], ['#2563eb', '#1e3a8a'], ['#7c3aed', '#3b0764'], ['#0f9f74', '#064e3b'], ['#e2557a', '#7a1d3b'], ['#334155', '#0f172a'], ['#0e9fb8', '#0b4a63'], ['#e07b2d', '#7a3410'], ['#4f46e5', '#1e1b6b'], ['#a3a3a3', '#3f3f46'], ['#c0396b', '#4a0e2a'], ['#3b82f6', '#0c2d6b']];
  function walletGrad(w) { var ws = S.wallets.filter(included), i = ws.indexOf(w); return CARD_PAL[(i < 0 ? 0 : i) % CARD_PAL.length]; }
  function renderStack() {
    var ws = S.wallets.filter(included);
    $('hWallets').innerHTML = '<div class="wstack' + (stackOpen ? ' open' : '') + '">' + ws.map(function (w, i) {
      var g = walletGrad(w), u = typeof unpaidIn === 'function' ? unpaidIn(w.id) : 0;
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
    // Height jumps open instantly (cards slide via transform); shrink only after the cards have closed, so the page doesn't re-layout every frame.
    var hOpen = n * (CARD_H + GAP) + 40, hShut = CARD_H + 24 + 26;
    clearTimeout(st._hT);
    if (stackOpen) st.style.height = hOpen + 'px';
    else if (!st.style.height) st.style.height = hShut + 'px';
    else st._hT = setTimeout(function () { if (!stackOpen) st.style.height = hShut + 'px'; }, 520);
  }
  // ---------- Wallet deck (Apple Wallet: overlapping vertical stack; tap a card to lift it, tap again / outside to go back) ----------
  function walletDeck(startId, fromEl) {
    var ws = S.wallets.filter(included); if (!ws.length) return;
    var ov = document.createElement('div'); ov.className = 'wdeck';
    ov.innerHTML = '<div class="dw-bg"></div><div class="dw-in">' +
      '<div class="dw-head"><button class="dw-x" type="button" aria-label="Close">‹</button><h2>Wallets</h2><button class="dw-man" type="button">Manage</button></div>' +
      '<div class="dw-stack">' + ws.map(function (w, i) {
        var g = walletGrad(w);
        return '<div class="dw-card" data-i="' + i + '" style="--a:' + g[0] + ';--b:' + g[1] + ';z-index:' + (i + 1) + '"><i class="dw-sheen"></i>' +
          '<div class="dw-strip"><span class="dw-ic">' + (spKey(w) ? sprite(spKey(w)) : '<b>' + esc(w.icon) + '</b>') + '</span><span class="dw-name">' + esc(w.name) + '</span><span class="dw-amt">' + money(balance(w.id)) + '</span></div>' +
          '<div class="dw-body"><span class="dw-grp">' + ((GROUPS[groupOf(w)] || {}).name || '') + '</span><span class="dw-big">' + money(balance(w.id)) + '</span></div></div>';
      }).join('') + '<div class="dw-info"></div></div></div>';
    document.body.appendChild(ov);
    var inEl = ov.querySelector('.dw-in'), stack = ov.querySelector('.dw-stack'), cards = [].slice.call(stack.querySelectorAll('.dw-card')), info = ov.querySelector('.dw-info');
    var sel = -1, n = cards.length, STRIP = 62;
    function dims() { var W = stack.clientWidth, CH = Math.round(W / 1.586); return { W: W, CH: CH, VH: inEl.clientHeight - stack.offsetTop }; }
    function layout(first) {
      var d = dims();
      cards.forEach(function (c) { c.style.height = d.CH + 'px'; });
      if (sel < 0) {
        ov.classList.remove('picked');
        cards.forEach(function (c, i) { c.style.transitionDelay = (first ? i * 28 : (n - i) * 12) + 'ms'; c.style.transform = 'translateY(' + (i * STRIP) + 'px)'; c.style.opacity = 1; });
        stack.style.height = ((n - 1) * STRIP + d.CH + 24) + 'px';
      } else {
        ov.classList.add('picked');
        var k = 0, base = Math.max(d.CH + 260, d.VH - 74);
        cards.forEach(function (c, i) {
          c.style.transitionDelay = '0ms';
          if (i === sel) { c.style.transform = 'translateY(0)'; c.style.opacity = 1; return; }
          var m = Math.min(k, 4); c.style.transform = 'translateY(' + (base + m * 9) + 'px) scale(' + (1 - m * 0.025).toFixed(3) + ')'; c.style.opacity = k > 4 ? 0 : 1; k++;
        });
        info.style.top = (d.CH + 14) + 'px';
        info.style.maxHeight = Math.max(160, base - d.CH - 28) + 'px';
        stack.style.height = Math.max(d.VH - 10, base + 80) + 'px';
      }
    }
    function paintInfo(i) {
      var w = ws[i];
      var tx = S.tx.filter(function (t) { return t.wallet === w.id || t.toWallet === w.id; }).sort(function (a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')); });
      var m = ym(new Date()), inM = 0, outM = 0, u = unpaidIn(w.id);
      tx.forEach(function (t) { if (t.date.slice(0, 7) !== m) return; var d = delta(t, w.id); if (d > 0) inM += d; else outM -= d; });
      info.innerHTML = holdPanel(w) + '<div class="dw-stats"><div><small>In this month</small><b class="pos">' + money(inM, { rp: false }) + '</b></div><div><small>Out this month</small><b class="neg">' + money(outM, { rp: false }) + '</b></div>' + (u ? '<div><small>Not received</small><b>' + money(u, { rp: false }) + '</b></div>' : '<div><small>Transactions</small><b>' + tx.length + '</b></div>') + '</div>' +
        '<div class="dw-acts"><button type="button" data-a="add"><span>＋</span>Add</button><button type="button" data-a="move"><span>⇄</span>Transfer</button><button type="button" data-a="hist"><span>☰</span>History</button><button type="button" data-a="edit"><span>✎</span>Edit</button></div>' +
        '<div class="dw-sec">Recent</div><div class="dw-list">' + (tx.length ? tx.slice(0, 4).map(function (t, k) { return txRow(t, k, true); }).join('') : '<div class="dw-empty">No transactions in this wallet yet.</div>') + '</div>';
      bindHold(info, w, function () { paintInfo(i); applyView(i); });
    }
    function wView(w) { return wViewOf(w); }
    function holdPanel(w) { return holdHtml(w); }
    function applyView(i) {
      var w = ws[i], h = w.holding, c = cards[i]; if (!c) return;
      var lvv = liveValue(w), cp = cashPart(w), amt = h && h.asset && wView(w) === 'cost' ? (+h.cost || 0) + cp : (h && h.asset && lvv != null ? lvv + cp : balance(w.id));
      c.querySelector('.dw-big').innerHTML = money(Math.round(amt)); c.querySelector('.dw-amt').innerHTML = money(Math.round(amt));
      c.classList.toggle('is-cost', !!(h && h.asset && wView(w) === 'cost'));
    }
    cards.forEach(function (c, i) { applyView(i); });
    window.__deckLive = function () { cards.forEach(function (c, i) { applyView(i); }); if (sel >= 0) paintInfo(sel); };
    // Opening a card adds one history step, so Back (‹ or the phone gesture) returns to the stack first.
    var skipPop = false;
    function pick(i, fromPop) {
      haptic();
      if (i === sel || i < 0) {
        if (sel < 0) return;
        sel = -1; layout();
        if (fromPop !== true && history.state && history.state.deckPick) { skipPop = true; history.back(); }
        return;
      }
      var was = sel; sel = i; paintInfo(i); inEl.scrollTo({ top: 0, behavior: 'smooth' }); layout();
      if (was < 0) history.pushState({ deck: 1, deckPick: 1 }, '');
    }
    // open: cards rise from the Home stack and fan into place
    // First layout with CSS transitions off, so only one animation (the fly-in) moves the cards.
    cards.forEach(function (c) { c.style.transition = 'none'; }); stack.style.transition = 'none';
    layout(true);
    void stack.offsetHeight;
    var homeStack = fromEl && fromEl.closest('.wstack'), a = fromEl ? fromEl.getBoundingClientRect() : null, longest = 0;
    cards.forEach(function (c, i) {
      var b = c.getBoundingClientRect(), to = c.style.transform, delay = Math.min(i, 9) * 22, dur = 540;
      var from = a ? 'translate(' + (a.left - b.left) + 'px,' + (a.top - b.top + Math.min(i, 3) * 10) + 'px) scale(' + (a.width / b.width).toFixed(3) + ') ' + to
                   : 'translateY(' + (inEl.clientHeight * 0.6) + 'px) ' + to;
      c.animate([{ transform: from, opacity: a && i < 3 ? 1 : 0 }, { transform: to, opacity: 1 }], { duration: dur, delay: delay, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' });
      longest = Math.max(longest, dur + delay);
    });
    if (homeStack) homeStack.style.visibility = 'hidden';
    setTimeout(function () { cards.forEach(function (c) { c.style.transition = ''; }); stack.style.transition = ''; }, longest + 30);
    requestAnimationFrame(function () { ov.classList.add('show'); });
    haptic(); history.pushState({ deck: 1 }, '');
    var closed = false;
    function close(fromPop) {
      if (closed) return; closed = true; window.removeEventListener('popstate', pop); window.__deckLive = null;
      ov.classList.remove('show'); ov.classList.add('hide');
      cards.forEach(function (c, i) { c.style.transitionDelay = (i * 15) + 'ms'; c.style.transform = 'translateY(' + (inEl.clientHeight + 40) + 'px)'; });
      setTimeout(function () { ov.remove(); }, 460);
      if (homeStack) setTimeout(function () { homeStack.style.visibility = ''; }, 260);
      if (fromPop !== true && history.state && history.state.deck) history.go(history.state.deckPick ? -2 : -1);
    }
    function pop() { if (skipPop) { skipPop = false; return; } if (sel >= 0) pick(-1, true); else close(true); }
    window.addEventListener('popstate', pop);
    ov.querySelector('.dw-x').onclick = function () { if (sel >= 0) pick(-1); else close(); };
    ov.querySelector('.dw-man').onclick = function () { close(); show('v-account'); setTimeout(function () { var l = $('walletList'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 350); };
    inEl.addEventListener('click', function (e) {
      var c = e.target.closest('.dw-card');
      if (c) { var i = +c.dataset.i; return pick(sel >= 0 && i !== sel ? -1 : i); }
      var t = e.target.closest('.tx'); if (t) { var tt = S.tx.filter(function (x) { return x.id === t.dataset.id; })[0]; if (tt) { close(); setTimeout(function () { txSheet(tt); }, 220); } return; }
      var b = e.target.closest('[data-a]');
      if (b && sel >= 0) {
        var w = ws[sel]; haptic();
        if (b.dataset.a === 'add') { close(); setTimeout(function () { txSheet(null, { wallet: w.id }); }, 220); }
        if (b.dataset.a === 'move') { close(); setTimeout(function () { txSheet(null, { wallet: w.id, type: 'transfer' }); }, 220); }
        if (b.dataset.a === 'hist') { close(); walletSel = w.id; renderTx(); show('v-tx'); }
        if (b.dataset.a === 'edit') { close(); setTimeout(function () { walletSheet(w); }, 220); }
        return;
      }
      if (e.target.closest('button,.dw-info')) return;
      if (sel >= 0) pick(-1); else close();   // tap outside
    });
    // swipe down: back to the stack, or close when already in the stack
    var y0 = null;
    inEl.addEventListener('touchstart', function (e) { y0 = inEl.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
    inEl.addEventListener('touchend', function (e) { if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; if (dy > 120) { if (sel >= 0) pick(-1); else close(); } });
    window.addEventListener('resize', function () { if (!closed) layout(); });
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

  // ---------- swipe to delete categories (with two confirmations) ----------
  function confirmBox(title, body, ok, danger) {
    return new Promise(function (res) {
      var ov = document.createElement('div'); ov.className = 'cbox';
      ov.innerHTML = '<div class="cbox-in"><div class="cbox-ic">' + (danger ? '⚠️' : '🗑️') + '</div><h3>' + title + '</h3><p>' + body + '</p><div class="cbox-b"><button class="btn" data-r="0">Cancel</button><button class="btn ' + (danger ? 'danger-fill' : 'primary') + '" data-r="1">' + ok + '</button></div></div>';
      document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add('show'); });
      ov.onclick = function (e) { var b = e.target.closest('[data-r]'); if (!b && e.target !== ov) return; var r = b ? b.dataset.r === '1' : false; ov.classList.remove('show'); setTimeout(function () { ov.remove(); }, 250); res(r); };
    });
  }
  function deleteCategory(id) {
    var c = cat(id);
    if (LOCKED.indexOf(id) !== -1) { toast('🔒 ' + c.name + ' is built in and can\u2019t be deleted'); return; }
    var used = S.tx.filter(function (t) { return t.cat === id; }).length + S.debts.filter(function (d) { return d.incomeCat === id; }).length + (S.recurring || []).filter(function (r) { return r.cat === id; }).length;
    var kids = S.cats.filter(function (x) { return x.parent === id; });
    var fb = c.type === 'income' ? 'uncat_in' : c.type === 'debt' ? (c.flow === 'in' ? 'debt' : 'loan') : 'uncat';
    haptic();
    confirmBox('Delete \u201c' + esc(c.name) + '\u201d?', 'This category will be removed from your list.', 'Delete', false).then(function (ok1) {
      if (!ok1) return false;
      var details = [];
      if (used) details.push(used + ' transaction' + (used > 1 ? 's' : '') + ' will move to <b>' + esc(cat(fb).name) + '</b>');
      if (kids.length) details.push(kids.length + ' sub categor' + (kids.length > 1 ? 'ies' : 'y') + ' will become main categories');
      details.push('This can\u2019t be undone.');
      return confirmBox('Are you sure?', details.join('.<br>'), 'Yes, delete', true);
    }).then(function (ok2) {
      if (!ok2) { closeSwipes(); return; }
      S.tx.forEach(function (t) { if (t.cat === id) t.cat = fb; });
      S.debts.forEach(function (d) { if (d.incomeCat === id) d.incomeCat = fb; });
      (S.recurring || []).forEach(function (r) { if (r.cat === id) r.cat = fb; });
      kids.forEach(function (k) { delete k.parent; });
      S.cats = S.cats.filter(function (x) { return x.id !== id; });
      S.rules = S.rules.filter(function (r) { return r.cat !== id; });
      delete S.budgets[id];
      (S.businesses || []).forEach(function (b) { if (b.cats) b.cats = b.cats.filter(function (x) { return x !== id; }); });
      if (S.settings.autoOwed) delete S.settings.autoOwed[id];
      var rows = document.querySelectorAll('.sw[data-cid="' + id + '"]');
      rows.forEach(function (r) { r.classList.add('gone'); });
      setTimeout(function () { save(); renderAll(); document.dispatchEvent(new Event('catdeleted')); }, rows.length ? 320 : 0);
      toast(c.name + ' deleted');
    });
  }
  function closeSwipes(except) { document.querySelectorAll('.sw.open').forEach(function (s) { if (s !== except) { s.classList.remove('open'); s.querySelector('.w-row, .cat-row').style.transform = ''; } }); }
  function bindSwipe(box) {
    var cur = null, x0 = 0, y0 = 0, dx = 0, lock = null, W = 92;
    box.addEventListener('touchstart', function (e) {
      var sw = e.target.closest('.sw'); if (!sw || e.target.closest('.sw-del')) return;
      cur = sw; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = null; closeSwipes(sw);
      cur.querySelector('.w-row, .cat-row').style.transition = 'none';
    }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!cur) return; var mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (lock == null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (lock !== 'x') return; e.preventDefault(); cur.classList.add('swiping');
      var base = cur.classList.contains('open') ? -W : 0; dx = Math.min(0, Math.max(-W * 1.6, base + mx));
      cur.querySelector('.w-row, .cat-row').style.transform = 'translateX(' + dx + 'px)';
    }, { passive: false });
    box.addEventListener('touchend', function () {
      if (!cur) return; var row = cur.querySelector('.w-row, .cat-row'); row.style.transition = ''; var c0 = cur; setTimeout(function () { c0.classList.remove('swiping'); }, 350);
      if (lock === 'x') {
        cur.dataset.swiped = '1';
        if (dx < -W * 1.35) { row.style.transform = ''; cur.classList.remove('open'); deleteCategory(cur.dataset.cid); }
        else if (dx < -W / 2) { cur.classList.add('open'); row.style.transform = 'translateX(' + (-W) + 'px)'; haptic(); }
        else { cur.classList.remove('open'); row.style.transform = ''; }
      }
      cur = null;
    });
    box.addEventListener('click', function (e) {
      var d = e.target.closest('[data-delcat]'); if (d) { e.stopPropagation(); deleteCategory(d.dataset.delcat); return; }
      var sw = e.target.closest('.sw'); if (!sw) return;
      if (sw.dataset.swiped) { delete sw.dataset.swiped; e.stopPropagation(); return; }
      if (sw.classList.contains('open')) { e.stopPropagation(); closeSwipes(); }
    }, true);
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

  // ---------- Shared holding panel: Invested vs Live value (gold etc.), or an inline setup form ----------
  function isGoldish(w) { return !!(w && ((w.holding && w.holding.asset === 'gold') || /gold|emas|antam/i.test(w.name) || /gold/.test(spKey(w) || ''))); }
  function isUsdish(w) { return !!(w && ((w.holding && w.holding.asset === 'usd') || /\busd\b|dollar|dolar/i.test(w.name) || spKey(w) === 'usd')); }
  // Holdings you track by "money invested + average": gold (per gram) and USD (per $1).
  var INV = {
    gold: { noun: 'gold', avgLabel: 'Average / gram', avgPh: '1.950.000', invPh: '50.000.000', unit: '/ g', qty: function (q) { return fmtG(q); }, fetch: function () { if (typeof fetchGold === 'function') fetchGold(); } },
    usd: { noun: 'dollars', avgLabel: 'Average rate (Rp per $1)', avgPh: '16.200', invPh: '16.200.000', unit: '/ $1', qty: function (q) { return fmtUsd(q); }, fetch: function () { if (typeof fetchFx === 'function') fetchFx(); } }
  };
  function invAssetOf(w) { return w && w.holding && INV[w.holding.asset] ? w.holding.asset : isGoldish(w) ? 'gold' : isUsdish(w) ? 'usd' : null; }
  function hasHolding(w) { return !!(w && w.holding && w.holding.asset && +w.holding.qty); }
  function wViewOf(w) { return ((S.settings.wView || {})[w.id]) || 'live'; }
  function holdHtml(w) {
    if (!hasHolding(w)) {
      var ia = invAssetOf(w); if (!ia) return '';
      var cf = INV[ia];
      return '<div class="hv hv-setup" data-asset="' + ia + '"><div class="hv-st"><b>Track these ' + cf.noun + ' live</b><small>Enter what you put in and your average ' + (ia === 'usd' ? 'rate' : 'price') + '. Apex shows what it’s worth now with the live ' + (ia === 'usd' ? 'USD/IDR rate' : 'gold price') + '. Net worth keeps counting the money you put in.</small></div>' +
        '<div class="two"><label class="fld">Money invested<input class="hvInv" inputmode="numeric" placeholder="' + cf.invPh + '"></label><label class="fld">' + cf.avgLabel + '<input class="hvAvg" inputmode="numeric" placeholder="' + cf.avgPh + '"></label></div>' +
        '<div class="hv-prev"></div><button type="button" class="btn primary block hvSave">Start tracking</button></div>';
    }
    var h = w.holding, p = PRICES[h.asset], v = p ? h.qty * p : null, inv = +h.cost || 0, d = v != null && inv ? v - inv : null, live = wViewOf(w) === 'live', u = ASSETS[h.asset].unit;
    var avg = h.avg || (inv && h.qty ? inv / h.qty : 0), cash = h.withCash ? cashPart(w) : 0;
    var totV = v != null ? v + cash : null, totI = inv + cash;
    return '<div class="hv"><div class="hv-seg"><button type="button" data-v="cost" class="' + (live ? '' : 'on') + '">Invested</button><button type="button" data-v="live" class="' + (live ? 'on' : '') + '"><i class="live"></i>Live value</button></div>' +
      (h.asset === 'usd' ? '<div class="hv-usd">' + fmtUsd(h.qty) + '</div>' : '') +
      '<div class="hv-big"><small>' + (live ? 'Worth now' : 'Money you put in') + (h.withCash ? ' · Rupiah + ' + (h.asset === 'usd' ? 'USD' : 'gold') : '') + '</small><b>' + (live ? (totV != null ? money(Math.round(totV)) : 'Fetching…') : money(Math.round(totI))) + '</b>' +
      (d != null ? '<span class="hv-pl ' + (d >= 0 ? 'up' : 'dn') + '">' + (d >= 0 ? '▲ +' : '▼ −') + money(Math.abs(Math.round(d)), { rp: false }) + ' · ' + (d >= 0 ? '+' : '−') + Math.abs(d / inv * 100).toFixed(2) + '%</span>' : '') + '</div>' +
      '<div class="hv-grid"><div><small>You own</small><b>' + (INV[h.asset] ? INV[h.asset].qty(h.qty) : (+h.qty).toLocaleString('id-ID', { maximumFractionDigits: 6 }) + ' ' + u) + '</b></div><div><small>Your average</small><b>' + (avg ? money(Math.round(avg), { rp: false }) : '–') + '</b></div><div><small>Live ' + (h.asset === 'usd' ? 'rate' : 'price') + '</small><b>' + (p ? money(Math.round(p), { rp: false }) : '–') + '</b></div><div><small>' + (h.asset === 'usd' ? 'USD invested' : 'Invested') + '</small><b>' + money(Math.round(inv), { rp: false }) + '</b></div>' +
      (h.withCash ? '<div><small>Rupiah part</small><b>' + money(Math.round(cash), { rp: false }) + '</b></div><div><small>' + (h.asset === 'usd' ? 'USD' : 'Gold') + ' worth now</small><b>' + (v != null ? money(Math.round(v), { rp: false }) : '–') + '</b></div>' : '') + '</div>' +
      '<button type="button" class="hv-edit">Change invested / average</button></div>';
  }
  // Wire a container that holds holdHtml(w). onChange re-renders the host view.
  function bindHold(box, w, onChange) {
    if (!box) return;
    box.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); S.settings.wView = S.settings.wView || {}; S.settings.wView[w.id] = b.dataset.v; save(); haptic(); onChange(); }; });
    var ed = box.querySelector('.hv-edit'); if (ed) ed.onclick = function (e) { e.stopPropagation(); walletSheet(w); };
    var inv = box.querySelector('.hvInv'), avg = box.querySelector('.hvAvg'), prev = box.querySelector('.hv-prev'), sv = box.querySelector('.hvSave');
    if (!inv) return;
    fmtInput(inv); fmtInput(avg);
    var ia = box.querySelector('[data-asset]').dataset.asset, cf = INV[ia];
    if (!PRICES[ia]) cf.fetch();
    function pv() {
      var a = parseNum(inv.value), b = parseNum(avg.value), g = a && b ? a / b : 0, p = PRICES[ia];
      prev.innerHTML = !g ? '' : (p ? '<div class="gl-row"><span>You own</span><b>' + cf.qty(g) + '</b></div><div class="gl-row big"><span>Worth now</span><b>' + money(Math.round(g * p)) + '</b></div><div class="gl-row"><span>Profit / loss</span><b class="' + (g * p >= a ? 'pos' : 'neg') + '">' + (g * p >= a ? '+' : '−') + money(Math.abs(Math.round(g * p - a)), { rp: false }) + ' (' + (g * p >= a ? '+' : '−') + Math.abs((g * p - a) / a * 100).toFixed(2) + '%)</b></div>' : cf.qty(g) + ' · fetching live price…');
    }
    [inv, avg].forEach(function (x) { x.addEventListener('input', pv); x.addEventListener('click', function (e) { e.stopPropagation(); }); });
    sv.onclick = function (e) {
      e.stopPropagation();
      var a = parseNum(inv.value), b = parseNum(avg.value); if (!a || !b) { toast('Enter money invested and average price'); return; }
      w.holding = { asset: ia, qty: a / b, cost: a, avg: b }; S.settings.wView = S.settings.wView || {}; S.settings.wView[w.id] = 'live';
      haptic(); save(); renderAll(); onChange(); toast((ia === 'usd' ? 'Dollars' : 'Gold') + ' now tracked live ✓');
    };
  }
  var txAll = false, txLimit = 80;
  function renderTx() {
    var w = walletSel;
    if (w !== 'all' && !S.wallets.some(function (x) { return x.id === w; })) w = walletSel = 'all';
    var wo = w === 'all' ? { id: 'all', name: 'Total', icon: '🌐', color: '#2fb5c9' } : wallet(w);
    $('pillIc').outerHTML = icon(wo, 'sm').replace('<span ', '<span id="pillIc" ');
    $('pillName').textContent = wo.name;
    var hw = w === 'all' ? null : wallet(w), hb = $('txHold');
    setMoney($('txBal'), hw && hasHolding(hw) ? (wViewOf(hw) === 'cost' ? Math.round((+hw.holding.cost || 0) + cashPart(hw)) : (liveValue(hw) != null ? Math.round(liveValue(hw) + cashPart(hw)) : balance(w))) : balance(w));
    if (hb) { var hh = hw ? holdHtml(hw) : ''; hb.innerHTML = hh; hb.hidden = !hh; if (hh) bindHold(hb, hw, renderTx); }
    // Real money: what's actually in this wallet (booked-but-not-received income taken out)
    var rb = $('txReal');
    if (rb) { var un = unpaidIn(w === 'all' ? null : w), real = balance(w) - un;
      rb.innerHTML = '<span class="rb-3d">' + sprite('reserve_transfer') + '</span><span>Real money</span><b>' + money(real, { rp: true }) + '</b><i>›</i>' + (un ? '<em>' + money(un, { rp: false }) + ' not received yet</em>' : ''); }
    $('monthLabel').innerHTML = txAll ? 'All time' : MONTHS[cur.getMonth()] + ' ' + cur.getFullYear();
    $('monthLabel').classList.toggle('all', txAll);
    var mKey = ym(cur), mt, open, end;
    if (txAll) {
      mt = S.tx.filter(function (t) { return touches(t, w); });
      var firstD = mt.reduce(function (a, t) { return !a || t.date < a ? t.date : a; }, '');
      open = firstD ? balance(w, firstD) : balance(w); end = balance(w);
    } else { mt = txIn(mKey, w); open = balance(w, mKey + '-01'); end = balance(w, nextMonthStart(cur)); }
    $('pOpen').innerHTML = money(open);
    $('pEnd').innerHTML = money(end, { sign: true });
    rollTo($('pNet'), end - open, { sign: true });

    if (!mt.length) {
      // Empty month: offer a jump to the nearest month that has transactions (e.g. after importing history).
      var other = S.tx.filter(function (t) { return touches(t, w); }), near = null;
      other.forEach(function (t) { var k = t.date.slice(0, 7); if (k === mKey) return; if (!near || Math.abs(monthsBetween(k, mKey)) < Math.abs(monthsBetween(near, mKey)) || (Math.abs(monthsBetween(k, mKey)) === Math.abs(monthsBetween(near, mKey)) && k < near)) near = k; });
      var nN = near ? other.filter(function (t) { return t.date.slice(0, 7) === near; }).length : 0;
      $('txList').innerHTML = '<div class="card empty">' + dinoImg('empty-dino') + '<br>No transactions in ' + MONTHS[cur.getMonth()] + '.' +
        (near ? '<button class="btn tx-jump" type="button" data-jump="' + near + '">Go to ' + monthName(near) + ' · ' + nN + ' transaction' + (nN === 1 ? '' : 's') + '</button><button class="link tx-jump2" type="button" data-alltime="1">See all ' + other.length.toLocaleString('id-ID') + ' transactions</button>' : '') + '</div>';
      return;
    }
    var shownTx = mt.slice().sort(function (a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')) || b.created - a.created; });
    var more = txAll && shownTx.length > txLimit ? shownTx.length - txLimit : 0;
    if (txAll) shownTx = shownTx.slice(0, txLimit);
    var byDay = {};
    shownTx.forEach(function (t) { (byDay[t.date] = byDay[t.date] || []).push(t); });
    var i = 0;
    $('txList').innerHTML = '<div class="stagger">' + Object.keys(byDay).sort().reverse().map(function (d) {
      var list = byDay[d].sort(function (a, b) { return (b.time || '').localeCompare(a.time || '') || b.created - a.created; });
      var net = list.reduce(function (a, t) { return a + deltaSel(t, w); }, 0);
      var dt = new Date(d + 'T00:00:00');
      return '<div class="day" style="--i:' + (i++) + '"><div class="day-h"><div class="dnum">' + dt.getDate() + '</div><div class="dmeta"><b>' + DOW[dt.getDay()] + '</b>' + MONTHS[dt.getMonth()] + ' ' + dt.getFullYear() + '</div><div class="dnet">' + money(net, { sign: true, rp: false }) + '</div></div>' +
        list.map(function (t) { return txRow(t, 0, false); }).join('') + '</div>';
    }).join('') + '</div>' + (more ? '<button class="btn block tx-more" type="button" data-more="1">Show more · ' + more.toLocaleString('id-ID') + ' older</button>' : '');
    renderMlStatus();
  }
  function monthsBetween(a, b) { return (+a.slice(0, 4) - +b.slice(0, 4)) * 12 + (+a.slice(5, 7) - +b.slice(5, 7)); }
  function renderMlStatus() {
    var el = $('mlStatus'); if (!el) return;
    var n = S.tx.filter(function (t) { return t.src === 'ml'; }).length;
    el.innerHTML = n ? '✓ ' + n.toLocaleString('id-ID') + ' Money Lover transactions in this app' : 'No Money Lover transactions in this app yet';
    el.classList.toggle('ok', !!n);
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
      return '<div class="hbar" data-catd="' + esc(id) + '"><div class="hbar-top"><span class="l">' + icon(c, 'sm') + esc(c.name) + '</span><span class="r">' + money(sums[id], { rp: false }) + ' · ' + pct + '%</span></div>' +
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
    $('repBars').onclick = function (e) { var h = e.target.closest('[data-catd]'); if (h) { haptic(); catDetail(cat(h.dataset.catd)); } };
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
      return '<div class="sw" data-cid="' + esc(c.id) + '"><button class="sw-del" type="button" data-delcat="' + esc(c.id) + '"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>Delete</button><button class="w-row' + (c.parent ? ' child' : '') + '" data-edit-cat="' + esc(c.id) + '">' + icon(c, 'sm') + '<span class="grow">' + esc(c.name) + (c.flow ? '<span class="sub">' + (c.flow === 'in' ? 'Money in' : 'Money out') + '</span>' : '') + '</span>' + (LOCKED.indexOf(c.id) !== -1 ? '<span class="lock" title="Built in">🔒</span>' : '') + '<span class="muted">›</span></button></div>';
    }).join('');
    if (!$('catList').dataset.swipe) { $('catList').dataset.swipe = 1; bindSwipe($('catList')); }
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
    $('realAmt').innerHTML = money(realBalance('all'), { rp: true }); var rs = el.querySelector('svg'); if (rs) rs.outerHTML = '<span class="rb-3d">' + sprite('reserve_transfer') + '</span>';
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
      '<div class="card real-hero"><span class="hero-3d">' + sprite('reserve_transfer') + '</span><div class="eyebrow">Actually in your accounts</div><div class="mid-money xl">' + money(real) + '</div>' +
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
  function komisiRecs() { var cs = kmCats(); return S.debts.filter(function (d) { return d.earned && cs.indexOf(d.incomeCat) !== -1 && d.closed !== 'cancelled'; }); }
  function komisiByMonth() {
    var by = {};
    komisiRecs().forEach(function (d) { var k = d.forMonth || d.created.slice(0, 7); var m = by[k] = by[k] || { k: k, earned: 0, paid: 0, recs: [] }; m.earned += d.amount; m.paid += Math.min(d.amount, dPaid(d)); m.recs.push(d); });
    return Object.keys(by).sort().reverse().map(function (k) { return by[k]; });
  }
  function monthName(k) { var d = new Date(k + '-01T00:00:00'); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function renderKomisi() {
    var el = $('hKomisi'); if (!el) return;
    var ms = komisiByMonth(), cur = ms.filter(function (m) { return m.k === ym(new Date()); })[0] || { earned: 0, paid: 0 };
    var owe = ms.reduce(function (a, m) { return a + m.earned - m.paid; }, 0), total = ms.reduce(function (a, m) { return a + m.earned; }, 0);
    var last6 = ms.slice(0, 6).reverse(), max = Math.max.apply(null, last6.map(function (m) { return m.earned; }).concat([1]));
    el.innerHTML = '<div class="km-top"><div><div class="eyebrow">Dad still owes</div><div class="mid-money">' + money(owe) + '</div><div class="muted small">This month ' + money(cur.earned, { rp: false }) + ' earned · ' + money(cur.paid, { rp: false }) + ' paid</div></div><span class="card-3d">' + sprite('komisi_out') + '</span></div>' +
      (last6.length ? '<div class="km-bars">' + last6.map(function (m, i) { var he = m.earned / max * 100, hp = m.paid / max * 100; return '<div class="km-col" style="--i:' + i + '"><div class="km-b"><i class="e" style="height:' + he.toFixed(1) + '%"></i><i class="p" style="height:' + hp.toFixed(1) + '%"></i></div><span>' + monthName(m.k).slice(0, 3) + '</span></div>'; }).join('') + '</div><div class="km-leg"><span><i class="e"></i>Earned</span><span><i class="p"></i>Paid by Dad</span><span class="muted">Total ' + money(total, { rp: false }) + '</span></div>'
        : '<div class="muted small" style="margin-top:10px">Tap + → Income → RESERVE TRANSFER to start.</div>');
  }
  // ---------- Cartoon 3D Earth (toy-style sphere drawn per pixel + cute face) ----------
  var EARTH = { tex: null, wait: [] };
  function earthTex(cb) {
    if (EARTH.tex) return cb(EARTH.tex);
    EARTH.wait.push(cb); if (EARTH.wait.length > 1) return;
    var W = 1024, H = 512, got = {}, left = 2;
    ['day', 'water'].forEach(function (n) {
      var im = new Image();
      im.onload = function () {
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); got[n] = x.getImageData(0, 0, W, H).data;
        if (--left) return;
        // stylize: flat ocean / land / desert / ice + coastline outline + shallow band
        var day = got.day, wa = got.water, land = new Uint8Array(W * H), out = new Uint8ClampedArray(W * H * 3), i, j, k;
        for (k = 0; k < W * H; k++) land[k] = wa[k * 4] < 128 ? 1 : 0;
        function near(i, j, r, v) { for (var dy = -r; dy <= r; dy++) { var y = j + dy; if (y < 0 || y >= H) continue; for (var dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; var x = (i + dx + W) % W; if (land[y * W + x] === v) return true; } } return false; }
        for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
          k = j * W + i; var o = k * 3, lat = 90 - (j + .5) / H * 180, R, G, B;
          var r = day[k * 4], g = day[k * 4 + 1], b = day[k * 4 + 2];
          if (land[k]) {
            if (near(i, j, 2, 0)) { R = 46; G = 122; B = 74; }
            else if (Math.abs(lat) > 66 || (r > 185 && g > 185 && b > 185)) { R = 242; G = 250; B = 255; }
            else if (r > g * 1.04 && r > 120) { R = 255; G = 204; B = 92; }
            else { R = 92; G = 214; B = 110; }
          } else {
            if (Math.abs(lat) > 74) { R = 230; G = 246; B = 255; }
            else if (near(i, j, 6, 1)) { R = 104; G = 206; B = 255; }
            else { R = 46; G = 154; B = 245; }
          }
          out[o] = R; out[o + 1] = G; out[o + 2] = B;
        }
        // puffy cartoon clouds (separate alpha layer that drifts faster)
        var cl = new Uint8ClampedArray(W * H), seed = 7;
        function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
        for (var n2 = 0; n2 < 16; n2++) {
          var cx = rnd() * W, cy = H * (0.18 + rnd() * 0.64), puffs = 3 + (rnd() * 2 | 0), s = 8 + rnd() * 6;
          for (var p = 0; p < puffs; p++) {
            var px = cx + (p - puffs / 2) * s * 1.1, py = cy + (rnd() - .5) * s * .6, pr = s * (0.8 + rnd() * 0.5);
            for (var y = Math.max(0, py - pr | 0); y < Math.min(H, py + pr + 1); y++) {
              var sx = pr / Math.max(.25, Math.cos((90 - (y + .5) / H * 180) * Math.PI / 180));
              for (var x = px - sx | 0; x < px + sx + 1; x++) {
                var dx = (x - px) / sx, dy = (y - py) / pr, d2 = dx * dx + dy * dy;
                if (d2 < 1) { var xx = ((x % W) + W) % W, v = dy > 0.35 ? 205 : 255; if (cl[y * W + xx] < v) cl[y * W + xx] = v; }
              }
            }
          }
        }
        EARTH.tex = { W: W, H: H, col: out, cl: cl };
        EARTH.wait.splice(0).forEach(function (f) { f(EARTH.tex); });
      };
      im.onerror = function () { EARTH.wait = []; };
      im.src = 'img/earth-' + n + '.jpg?v=1';
    });
  }
  function mountEarth(cv, speed, face) {
    if (!cv || cv._earth) return; cv._earth = 1;
    earthTex(function (T) {
      var css = cv.clientWidth || +cv.dataset.s || 120, dpr = Math.min(2, window.devicePixelRatio || 1), N = Math.round(css * dpr);
      cv.width = cv.height = N;
      var ctx = cv.getContext('2d'), img = ctx.createImageData(N, N), D = img.data, W = T.W, H = T.H;
      var L = [-0.55, 0.55, 0.63], ll = Math.hypot(L[0], L[1], L[2]); L = L.map(function (v) { return v / ll; });
      var Hx = L[0], Hy = L[1], Hz = L[2] + 1, hl = Math.hypot(Hx, Hy, Hz); Hx /= hl; Hy /= hl; Hz /= hl;
      var roll = -18 * Math.PI / 180, pitch = 16 * Math.PI / 180, cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), spn = Math.sin(pitch);
      var edge = 1 - (2.6 * dpr * (css > 80 ? 1.15 : .7)) / (N / 2);
      var pix = [], TY = [], TX = [], SH = [], HI = [], ED = [];
      for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
        var x = (i + 0.5) / N * 2 - 1, y = 1 - (j + 0.5) / N * 2, r2 = x * x + y * y;
        if (r2 > 1) continue;
        var rr = Math.sqrt(r2), z = Math.sqrt(1 - r2), d = x * L[0] + y * L[1] + z * L[2];
        var x1 = x * cr - y * sr, y1 = x * sr + y * cr, gy = y1 * cp - z * spn, gz = y1 * spn + z * cp;
        var lat = Math.asin(Math.max(-1, Math.min(1, gy))), lon = Math.atan2(x1, gz);
        pix.push((j * N + i) * 4);
        TY.push(Math.min(H - 1, Math.floor((0.5 - lat / Math.PI) * H)) * W);
        TX.push((lon / (2 * Math.PI) + 0.5) * W);
        // cel shading: 3 soft bands
        var band = d > 0.42 ? 1.06 : d > 0.02 ? 0.9 : d > -0.4 ? 0.74 : 0.62;
        SH.push(band);
        var h = Math.max(0, x * Hx + y * Hy + z * Hz);
        HI.push(Math.pow(h, 22) * 0.55 + (Math.pow(h, 160) > .5 ? .55 : 0));
        ED.push(rr > edge ? 1 : 0);
      }
      var n = pix.length, PX = new Int32Array(pix), TYa = new Int32Array(TY), TXa = new Float32Array(TX), SHa = new Float32Array(SH), HIa = new Float32Array(HI), EDa = new Uint8Array(ED);
      var col = T.col, cl = T.cl, t0 = performance.now(), last = 0, visible = true;
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(cv);
      function drawFace(now) {
        var s = N / 2, cx = s, cy = s * 1.08, t = (now - t0) / 1000;
        var blink = (t % 4.2) > 4.05 ? 0.12 : 1, look = Math.sin(t * 0.7) * s * 0.03;
        ctx.save();
        ctx.fillStyle = 'rgba(255,120,160,.55)';
        [[-0.46, 0.2], [0.46, 0.2]].forEach(function (b) { ctx.beginPath(); ctx.ellipse(cx + b[0] * s, cy + b[1] * s, s * .13, s * .075, 0, 0, 7); ctx.fill(); });
        ctx.fillStyle = '#16213f';
        [-0.27, 0.27].forEach(function (ex) {
          ctx.beginPath(); ctx.ellipse(cx + ex * s + look, cy - 0.04 * s, s * .085, s * .125 * blink, 0, 0, 7); ctx.fill();
          if (blink > .5) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + ex * s + look - s * .03, cy - 0.09 * s, s * .032, 0, 7); ctx.fill(); ctx.fillStyle = '#16213f'; }
        });
        ctx.strokeStyle = '#16213f'; ctx.lineWidth = Math.max(1.5, s * .045); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx + look, cy + 0.1 * s, s * .13, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
        ctx.restore();
      }
      function frame(now) {
        if (!cv.isConnected) return;
        requestAnimationFrame(frame);
        if (!visible || document.hidden || now - last < 30) return; last = now;
        var off = (now - t0) * speed, coff = off * 1.45;
        for (var k = 0; k < n; k++) {
          var p = PX[k];
          if (EDa[k]) { D[p] = 22; D[p + 1] = 33; D[p + 2] = 80; D[p + 3] = 255; continue; }
          var row = TYa[k], tx = (TXa[k] - off) % W; if (tx < 0) tx += W;
          var ti = (row + (tx | 0)) * 3, cx = (TXa[k] - coff) % W; if (cx < 0) cx += W;
          var c = cl[row + (cx | 0)] / 255, sh = SHa[k], hi = HIa[k] * 255;
          var r = col[ti], g = col[ti + 1], b = col[ti + 2];
          if (c) { if (c > 0.9) { r = g = b = 255; } else { r = 206; g = 222; b = 250; } }
          D[p] = r * sh + hi; D[p + 1] = g * sh + hi; D[p + 2] = b * sh + hi; D[p + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        if (face) drawFace(now);
        cv.classList.add('on');
      }
      requestAnimationFrame(frame);
    });
  }
  // =================== INVEST TO THE WORLD ===================
  var WORLD_DEF = ['giving', 'kasih', 'berkati_ortu'];
  var WORLD_VERSES = [
    ['Store up for yourselves treasures in heaven.', 'Matthew 6:20'],
    ['Give, and it will be given to you.', 'Luke 6:38'],
    ['It is more blessed to give than to receive.', 'Acts 20:35'],
    ['God loves a cheerful giver.', '2 Corinthians 9:7'],
    ['Whoever is generous to the poor lends to the LORD.', 'Proverbs 19:17'],
    ['Honor the LORD with your wealth.', 'Proverbs 3:9']
  ];
  function worldCats() {
    var ids = S.settings.worldCats || WORLD_DEF;
    return ids.filter(function (id) { return S.cats.some(function (c) { return c.id === id; }); });
  }
  function worldTx() { var set = worldCats(); return S.tx.filter(function (t) { return t.type === 'expense' && set.indexOf(t.cat) !== -1; }); }
  function worldStats() {
    var tx = worldTx(), now = new Date(), m = ym(now), y = String(now.getFullYear());
    var st = { all: 0, year: 0, month: 0, n: tx.length, byCat: {}, byMonth: {}, spentYear: 0 };
    tx.forEach(function (t) {
      st.all += t.amount; if (t.date.slice(0, 4) === y) st.year += t.amount; if (t.date.slice(0, 7) === m) st.month += t.amount;
      st.byMonth[t.date.slice(0, 7)] = (st.byMonth[t.date.slice(0, 7)] || 0) + t.amount;
    });
    S.tx.forEach(function (t) { if (t.type === 'expense' && t.date.slice(0, 4) === y) st.spentYear += t.amount; });
    return st;
  }
  function renderWorldCard() {
    var el = $('hWorld'); if (!el) return;
    var st = worldStats(), goal = S.settings.worldGoal || 0, pc = goal ? Math.min(100, st.year / goal * 100) : 0;
    el.innerHTML = '<div class="wdc-glow"></div><div class="wdc-top"><div><div class="eyebrow">Invested this year</div><div class="mid-money">' + money(st.year) + '</div>' +
      '<div class="small wdc-sub">This month ' + money(st.month, { rp: false }) + ' · All time ' + money(st.all, { rp: false }) + '</div></div><span class="wdc-globe"><canvas class="earth" data-s="56"></canvas></span></div>' +
      (goal ? '<div class="wdc-bar"><i style="width:' + pc.toFixed(1) + '%"></i></div><div class="small wdc-sub">' + Math.round(pc) + '% of your ' + money(goal, { rp: false }) + ' goal</div>' : '<div class="small wdc-sub" style="margin-top:8px">Tap to step into the world ✨</div>');
    mountEarth(el.querySelector('.earth'), 0.01, false);
  }
  function countUp(el, to) {
    if (S.settings.hide) { el.innerHTML = money(to); return; }
    var t0 = performance.now(), D = 1400;
    (function f(now) { var p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 4); el.textContent = 'Rp ' + fmt(Math.round(to * e)); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  function worldOpen() {
    haptic();
    var ov = $('world'); if (!ov) { ov = document.createElement('div'); ov.id = 'world'; ov.className = 'world'; document.body.appendChild(ov); }
    var range = 'all';
    function paint(first) {
      var st = worldStats(), cats = worldCats(), now = new Date(), y = String(now.getFullYear()), m = ym(now);
      var inR = function (t) { return range === 'all' || (range === 'year' ? t.date.slice(0, 4) === y : t.date.slice(0, 7) === m); };
      var tx = worldTx().filter(inR), tot = tx.reduce(function (a, t) { return a + t.amount; }, 0), by = {};
      tx.forEach(function (t) { by[t.cat] = (by[t.cat] || 0) + t.amount; });
      var rows = cats.map(function (id) { return { c: cat(id), v: by[id] || 0 }; }).sort(function (a, b) { return b.v - a.v; }), mx = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
      var months = []; for (var i = 11; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push(ym(d)); }
      var bm = Math.max.apply(null, months.map(function (k) { return st.byMonth[k] || 0; }).concat([1]));
      var goal = S.settings.worldGoal || 0, gp = goal ? Math.min(1, st.year / goal) : 0, C = 2 * Math.PI * 34;
      var share = st.spentYear ? Math.round(st.year / st.spentYear * 100) : 0;
      var v = WORLD_VERSES[Math.floor(Date.now() / 864e5) % WORLD_VERSES.length];
      var recent = tx.slice().sort(function (a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')); }).slice(0, 12);
      ov.innerHTML = '<div class="wd-aur"><i></i><i></i><i></i></div><div class="wd-stars"></div>' +
        '<div class="wd-in">' +
        '<div class="wd-head"><button class="wd-x" id="wClose" aria-label="Close">‹</button><span>Invest to the World</span><button class="wd-x" id="wEdit" aria-label="Pick categories">⚙︎</button></div>' +
        '<div class="wd-globe"><div class="wd-atm"></div><canvas class="earth wd-earth" data-s="150"></canvas><div class="wd-ring"></div><div class="wd-ring r2"></div></div>' +
        '<div class="wd-lbl">' + (range === 'all' ? 'Invested into the world, all time' : range === 'year' ? 'Invested in ' + y : 'Invested in ' + monthName(m)) + '</div>' +
        '<div class="wd-total" id="wTotal">' + money(tot) + '</div>' +
        '<div class="wd-seg" id="wRange">' + [['month', 'Month'], ['year', 'Year'], ['all', 'All time']].map(function (r) { return '<button data-r="' + r[0] + '" class="' + (range === r[0] ? 'on' : '') + '">' + r[1] + '</button>'; }).join('') + '</div>' +
        '<div class="wd-stats"><div><small>Times given</small><b>' + tx.length + '</b></div><div><small>Of spending ' + y + '</small><b>' + share + '%</b></div><div><small>This month</small><b>' + money(st.month, { rp: false }) + '</b></div></div>' +
        '<div class="wd-card wd-goal" id="wGoal"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="g-tr"/><circle cx="40" cy="40" r="34" class="g-fg" style="stroke-dasharray:' + C.toFixed(1) + ';stroke-dashoffset:' + (C * (1 - gp)).toFixed(1) + '"/></svg><b class="g-pc">' + (goal ? Math.round(gp * 100) + '%' : '🎯') + '</b>' +
          '<div class="grow"><b>' + (goal ? y + ' goal' : 'Set a yearly goal') + '</b><span>' + (goal ? money(st.year, { rp: false }) + ' of ' + money(goal, { rp: false }) + (st.year < goal ? ' · ' + money(goal - st.year, { rp: false }) + ' to go' : ' · reached 🎉') : 'How much do you want to sow this year?') + '</span></div><i>›</i></div>' +
        '<div class="wd-sec">Last 12 months</div><div class="wd-card wd-bars">' + months.map(function (k, i) { var h = (st.byMonth[k] || 0) / bm * 100; return '<div class="wdb" style="--i:' + i + '"><div class="wdb-t"><i style="--h:' + h.toFixed(1) + '%"' + (k === m ? ' class="now"' : '') + '></i></div><span>' + monthName(k).slice(0, 1) + '</span></div>'; }).join('') + '</div>' +
        '<div class="wd-sec">Where it went</div><div class="wd-card">' + (rows.length ? rows.map(function (r, i) { return '<div class="wd-row" style="--i:' + i + '">' + icon(r.c, 'sm') + '<div class="grow"><div class="wd-rt"><b>' + esc(r.c.name) + '</b><span>' + money(r.v) + '</span></div><div class="wd-rb"><i style="--w:' + (r.v / mx * 100).toFixed(1) + '%"></i></div></div></div>'; }).join('') : '<div class="wd-empty">No categories picked yet. Tap ⚙︎ to choose.</div>') + '</div>' +
        '<div class="wd-sec">Recent seeds</div><div class="wd-card">' + (recent.length ? recent.map(function (t) { return '<div class="wd-row">' + icon(cat(t.cat), 'sm') + '<div class="grow"><div class="wd-rt"><b>' + esc(t.merchant || t.note || cat(t.cat).name) + '</b><span>' + money(t.amount, { rp: false }) + '</span></div><div class="wd-sub">' + fmtDate(t.date) + ' · ' + esc(cat(t.cat).name) + '</div></div></div>'; }).join('') : '<div class="wd-empty">Nothing here yet for this period. Every gift you log in these categories shows up here.</div>') + '</div>' +
        '<div class="wd-verse">“' + esc(v[0]) + '”<span>' + esc(v[1]) + '</span></div>' +
        '<button class="wd-pick" id="wPick">Pick categories · ' + cats.length + ' selected</button>' +
        '</div>';
      if (first !== false) countUp(ov.querySelector('#wTotal'), tot);
      mountEarth(ov.querySelector('.wd-earth'), 0.012, false);
      ov.querySelector('#wClose').onclick = worldClose;
      ov.querySelector('#wEdit').onclick = ov.querySelector('#wPick').onclick = function () { worldPicker(function () { paint(); renderWorldCard(); }); };
      ov.querySelector('#wGoal').onclick = function () { worldGoalSheet(function () { paint(false); renderWorldCard(); }); };
      ov.querySelector('#wRange').onclick = function (e) { var b = e.target.closest('button'); if (!b || b.dataset.r === range) return; range = b.dataset.r; haptic(); paint(); };
    }
    paint();
    ov.scrollTop = 0; ov.hidden = false; void ov.offsetWidth;
    document.body.classList.add('world-mode'); ov.classList.add('show');
    var tc = document.querySelector('meta[name=theme-color]'); if (tc) { ov.dataset.tc = tc.content; tc.content = '#0b0a14'; }
    history.pushState({ world: 1 }, '');
  }
  function worldClose(fromPop) {
    var ov = $('world'); if (!ov || !ov.classList.contains('show')) return;
    ov.classList.remove('show'); document.body.classList.remove('world-mode');
    var tc = document.querySelector('meta[name=theme-color]'); if (tc && ov.dataset.tc) tc.content = ov.dataset.tc;
    setTimeout(function () { if (!ov.classList.contains('show')) ov.hidden = true; }, 500);
    if (fromPop !== true && history.state && history.state.world) history.back();
  }
  window.addEventListener('popstate', function () { worldClose(true); });
  function worldPicker(done) {
    var sel = worldCats().slice();
    var exp = S.cats.filter(function (c) { return c.type === 'expense'; });
    var tops = exp.filter(function (c) { return !c.parent; });
    function spentAll(id) { return S.tx.reduce(function (a, t) { return a + (t.type === 'expense' && t.cat === id ? t.amount : 0); }, 0); }
    function row(c, kid) { return '<label class="wd-pk' + (kid ? ' kid' : '') + '">' + icon(c, 'sm') + '<span class="grow">' + esc(c.name) + '<span class="sub">' + money(spentAll(c.id), { rp: false }) + ' spent so far</span></span><input type="checkbox" class="switch" data-c="' + esc(c.id) + '"' + (sel.indexOf(c.id) !== -1 ? ' checked' : '') + '></label>'; }
    openSheet('<h3>Pick categories</h3><p class="muted small" style="text-align:center;margin:-6px 0 12px">Everything you spend in these counts as investing into the world.</p>' +
      '<input id="wpQ" placeholder="Search category" autocomplete="off" style="margin-bottom:10px">' +
      '<div class="card list-card" id="wpList">' + tops.map(function (c) { return row(c) + exp.filter(function (k) { return k.parent === c.id; }).map(function (k) { return row(k, 1); }).join(''); }).join('') + '</div>' +
      '<button class="btn primary block" id="wpSave" style="margin-top:12px">Save</button>',
      function (r) {
        r.querySelector('#wpList').addEventListener('change', function (e) {
          var cb = e.target; if (!cb.dataset.c) return; haptic();
          var kids = exp.filter(function (k) { return k.parent === cb.dataset.c; });
          kids.forEach(function (k) { var x = r.querySelector('[data-c="' + k.id + '"]'); if (x) x.checked = cb.checked; });
        });
        r.querySelector('#wpQ').addEventListener('input', function () { var q = this.value.toLowerCase(); r.querySelectorAll('.wd-pk').forEach(function (l) { l.hidden = q && l.textContent.toLowerCase().indexOf(q) === -1; }); });
        r.querySelector('#wpSave').onclick = function () {
          S.settings.worldCats = [].map.call(r.querySelectorAll('[data-c]:checked'), function (x) { return x.dataset.c; });
          save(); closeSheet(); toast('Saved ✓ ' + S.settings.worldCats.length + ' categories'); done && done();
        };
      });
  }
  function worldGoalSheet(done) {
    openSheet('<h3>Yearly goal</h3><p class="muted small" style="text-align:center;margin:-6px 0 12px">How much do you want to invest into the world this year?</p>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="wgAmt" inputmode="numeric" placeholder="0" value="' + (S.settings.worldGoal ? S.settings.worldGoal.toLocaleString('id-ID') : '') + '"></div>' +
      '<button class="btn primary block" id="wgSave">Save goal</button>' + (S.settings.worldGoal ? '<button class="btn block" id="wgClear">Remove goal</button>' : ''),
      function (r) {
        var a = r.querySelector('#wgAmt'); fmtInput(a); setTimeout(function () { a.focus(); }, 380);
        r.querySelector('#wgSave').onclick = function () { S.settings.worldGoal = parseNum(a.value) || 0; save(); closeSheet(); toast('Goal saved 🎯'); done && done(); };
        var c = r.querySelector('#wgClear'); if (c) c.onclick = function () { S.settings.worldGoal = 0; save(); closeSheet(); done && done(); };
      });
  }
  // ---------- Track a commission whose money is already in a wallet (e.g. imported RESERVE TRANSFER): who still owes, payments so far ----------
  function kmCats() { var cs = komisiCats(); return cs.length ? cs : ['reserve_transfer', 'komisi_in']; }
  function kmTrackPick() {
    var cs = kmCats(), list = S.tx.filter(function (t) { return t.type === 'income' && cs.indexOf(t.cat) !== -1 && !t.debtId; }).sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 30);
    openSheet('<h3>Already in your wallet</h3><p class="muted small" style="text-align:center;margin:-6px 0 12px">Pick the commission transfer that’s already in your wallet. You’ll enter what’s been paid; Apex tracks the rest without counting the money twice.</p>' +
      (list.length ? '<div class="card list-card">' + list.map(function (t) {
        return '<button class="w-row" data-kt="' + esc(t.id) + '">' + icon(cat(t.cat), 'sm') + '<span class="grow">' + esc(cat(t.cat).name) + '<span class="sub">' + fmtDate(t.date) + ' · ' + esc(wallet(t.wallet).name) + (t.note ? ' · ' + esc(t.note) : '') + '</span></span><b>' + money(t.amount, { rp: false }) + '</b></button>';
      }).join('') + '</div>' : '<div class="empty">No untracked commission transfers found.</div>'),
      function (r) { r.addEventListener('click', function (e) { var b = e.target.closest('[data-kt]'); if (!b) return; var t = S.tx.filter(function (x) { return x.id === b.dataset.kt; })[0]; if (t) kmTrackSheet(t); }); });
  }
  function kmAmt(v) { var n = parseNum(v); return n > 0 && n < 100000 ? n * 1e6 : n; } // "85" = 85 jt
  function kmTrackSheet(t) {
    var d0 = new Date(t.date + 'T00:00:00'), forM = ym(new Date(d0.getFullYear(), d0.getMonth() - 1, 1));
    var who = (S.settings.autoOwed || {})[t.cat] || 'Dad';
    function payRow(i) { return '<div class="kt-pay"><input class="kt-a" inputmode="numeric" placeholder="e.g. 85 = 85 jt"><input class="kt-d" type="date" value="' + esc(t.date) + '"><button type="button" class="kt-x" aria-label="Remove">✕</button></div>'; }
    openSheet('<h3>Track commission</h3>' +
      '<div class="kt-hero"><small>' + esc(cat(t.cat).name) + ' · ' + fmtDate(t.date) + ' · already in ' + esc(wallet(t.wallet).name) + '</small><b>' + money(t.amount) + '</b></div>' +
      '<div class="two"><label class="fld">Commission for<input id="ktMonth" type="month" value="' + forM + '"></label><label class="fld">Who pays<input id="ktWho" value="' + esc(who) + '"></label></div>' +
      '<div class="fld">Already paid<div id="ktPays">' + payRow() + payRow() + '</div><button type="button" class="link" id="ktAddPay">＋ Add payment</button></div>' +
      '<div class="kt-sum" id="ktSum"></div>' +
      '<button class="btn primary block" id="ktSave">Save</button>',
      function (r) {
        function rows() { return [].slice.call(r.querySelectorAll('.kt-pay')); }
        function sum() {
          var paid = rows().reduce(function (a, x) { return a + kmAmt(x.querySelector('.kt-a').value); }, 0), left = t.amount - paid;
          r.querySelector('#ktSum').innerHTML = '<div class="gl-row"><span>Commission</span><b>' + money(t.amount) + '</b></div><div class="gl-row"><span>Paid so far</span><b class="pos">' + money(paid) + '</b></div><div class="gl-row big"><span>Still to collect from ' + esc(r.querySelector('#ktWho').value || 'them') + '</span><b class="' + (left > 0 ? 'neg' : 'pos') + '">' + money(Math.max(0, left)) + '</b></div>' + (left < 0 ? '<div class="muted small">Paid is more than the commission.</div>' : '');
        }
        function wire() { rows().forEach(function (x) { var a = x.querySelector('.kt-a'); if (!a._w) { a._w = 1; a.addEventListener('input', sum); a.addEventListener('blur', function () { var n = kmAmt(a.value); a.value = n ? n.toLocaleString('id-ID') : ''; sum(); }); x.querySelector('.kt-x').onclick = function () { x.remove(); sum(); }; } }); }
        r.querySelector('#ktAddPay').onclick = function () { r.querySelector('#ktPays').insertAdjacentHTML('beforeend', payRow()); wire(); };
        r.querySelector('#ktWho').addEventListener('input', sum);
        wire(); sum();
        r.querySelector('#ktSave').onclick = function () {
          var person = r.querySelector('#ktWho').value.trim() || 'Dad', fm = r.querySelector('#ktMonth').value || forM;
          var pays = rows().map(function (x) { return { amt: kmAmt(x.querySelector('.kt-a').value), date: x.querySelector('.kt-d').value || t.date }; }).filter(function (p) { return p.amt > 0; });
          var dd = { id: uid(), dir: 'in', earned: true, incomeCat: t.cat, person: person, title: 'Komisi ' + monthName(fm), amount: t.amount, created: t.date, forMonth: fm, due: '', wallet: t.wallet, tags: 'income', notes: '', prebooked: true, bookTx: t.id, ts: Date.now(),
            payments: pays.map(function (p) { return { id: uid(), amount: Math.min(p.amt, t.amount), date: p.date, wallet: t.wallet, note: 'Paid', txId: null }; }) };
          S.debts.push(dd); t.debtId = dd.id;
          haptic(); save(); closeSheet(); renderAll();
          var left = dRemain(dd); toast(left ? person + ' still owes ' + money(left, { rp: true }) : 'Fully paid 🎉');
        };
      });
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
      '<button class="btn primary block" id="kmAdd">＋ Add commission</button>' +
      '<button class="btn block" id="kmTrack" style="margin-top:8px">Track one already in RESERVE</button>',
      function (r) {
        r.addEventListener('click', function (e) { var b = e.target.closest('[data-km]'); if (b) debtDetail(debtById(b.dataset.km)); });
        r.querySelector('#kmAdd').onclick = function () { txSheet(null, { type: 'income', cat: 'reserve_transfer' }); };
        r.querySelector('#kmTrack').onclick = function () { haptic(); kmTrackPick(); };
      });
  }
  // ---------- Business: income & expense per business ----------
  function bizForCat(c) { var b = (S.businesses || []).filter(function (x) { return (x.cats || []).indexOf(c) !== -1; })[0]; return b ? b.id : ''; }
  function bizTx(id, m) { return S.tx.filter(function (t) { return t.biz === id && (t.type === 'income' || t.type === 'expense') && (!m || t.date.slice(0, 7) === m); }); }
  function bizIO(id, m) { var r = { i: 0, e: 0 }; bizTx(id, m).forEach(function (t) { if (t.type === 'income') r.i += t.amount; else r.e += t.amount; }); return r; }
  var BCOL = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#2dd4bf'];
  function bizIcon(b, i) { return '<span class="biz-ic" style="--c:' + BCOL[i % BCOL.length] + '">' + sprite(b.sp || 'kas_kantor') + '</span>'; }
  function renderBizCard() {
    var el = $('hBiz'); if (!el) return; var m = ym(new Date()), bs = S.businesses || [];
    var tot = bs.reduce(function (a, b) { var r = bizIO(b.id, m); a.i += r.i; a.e += r.e; return a; }, { i: 0, e: 0 });
    el.innerHTML = '<div class="km-top"><span class="card-3d">' + sprite('bi') + '</span><div><div class="eyebrow">Business profit · ' + MONTHS[new Date().getMonth()] + '</div><div class="mid-money ' + (tot.i - tot.e < 0 ? 'neg' : '') + '">' + money(tot.i - tot.e, { sign: true }) + '</div><div class="muted small">In ' + money(tot.i, { rp: false }) + ' · Out ' + money(tot.e, { rp: false }) + '</div></div></div>' +
      '<div class="biz-chips">' + bs.map(function (b, i) { var r = bizIO(b.id, m); return '<span class="biz-chip">' + bizIcon(b, i) + '<b>' + esc(b.name) + '</b><em class="' + (r.i - r.e < 0 ? 'neg' : 'pos') + '">' + money(r.i - r.e, { rp: false, sign: true }) + '</em></span>'; }).join('') + '</div>';
  }
  function bizSheet() {
    var m = ym(new Date()), bs = S.businesses || [];
    openSheet('<div class="sheet-top"><span style="width:36px"></span><h3>Business</h3><span style="width:36px"></span></div>' +
      '<div class="muted small" style="text-align:center;margin:-8px 0 12px">' + MONTHS[new Date().getMonth()] + ' ' + new Date().getFullYear() + '</div>' +
      '<div class="card list-card stagger">' + bs.map(function (b, i) {
        var r = bizIO(b.id, m), net = r.i - r.e, mx = Math.max(r.i, r.e, 1);
        return '<button class="w-row biz-row" data-biz="' + esc(b.id) + '" style="--i:' + i + '">' + bizIcon(b, i) + '<span class="grow"><b>' + esc(b.name) + '</b><span class="sub">In ' + money(r.i, { rp: false }) + ' · Out ' + money(r.e, { rp: false }) + ((b.cats || []).length ? ' · ' + b.cats.map(function (c) { return cat(c).name; }).join(', ') : '') + '</span><span class="biz-mini"><i class="in" style="--w:' + (r.i / mx * 100).toFixed(0) + '%"></i><i class="out" style="--w:' + (r.e / mx * 100).toFixed(0) + '%"></i></span></span><span class="amt ' + (net < 0 ? 'neg' : 'pos') + '">' + money(net, { rp: false, sign: true }) + '</span></button>';
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
      '<div class="fld">Categories that go to this business<span class="sub">Pick a category on + and the business is chosen for you</span><div class="chips wrap" id="bzCats">' + S.cats.filter(function (c) { return c.type !== 'debt'; }).map(function (c) { return '<button type="button" data-c="' + esc(c.id) + '" class="' + ((b.cats || []).indexOf(c.id) !== -1 ? 'on' : '') + '">' + esc(c.name) + '</button>'; }).join('') + '</div></div>' +
      '<div class="fld">Icon' + picker(null, st.sp) + '</div>' +
      '<button class="btn primary block" id="bzSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="bzDel">Delete business</button>'),
      function (r) {
        var cs = (b.cats || []).slice(); r.querySelector('#bzCats').onclick = function (e) { var x = e.target.closest('button'); if (!x) return; var i = cs.indexOf(x.dataset.c); if (i === -1) cs.push(x.dataset.c); else cs.splice(i, 1); x.classList.toggle('on'); haptic(); };
        bindSpPicker(r, st); if (isNew) setTimeout(function () { r.querySelector('#bzName').focus(); }, 380);
        r.querySelector('#bzSave').onclick = function () { var n = r.querySelector('#bzName').value.trim(); if (!n) { toast('Name it'); return; } b.name = n; b.sp = st.sp; (S.businesses || []).forEach(function (o) { if (o !== b) o.cats = (o.cats || []).filter(function (c) { return cs.indexOf(c) === -1; }); }); b.cats = cs; S.tx.forEach(function (t) { if (!t.biz && cs.indexOf(t.cat) !== -1) t.biz = b.id; }); if (isNew) (S.businesses = S.businesses || []).push(b); save(); renderAll(); bizSheet(); toast('Saved ✓'); };
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
  // ---------- INSTALLMENTS: tracked separately, never counted in wallets or net worth ----------
  function iPaid(p) { return (p.pays || []).reduce(function (a, x) { return a + x.amount; }, 0); }
  function iLeft(p) { return Math.max(0, (p.total || 0) - iPaid(p)); }
  function iNext(p) {
    if (!p.monthly || !iLeft(p)) return null;
    var now = new Date(), day = Math.min(28, p.dueDay || 1), d = new Date(now.getFullYear(), now.getMonth(), day);
    var paidThis = (p.pays || []).some(function (x) { return x.date.slice(0, 7) === ym(now); });
    if (paidThis || d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
    return ymd(d);
  }
  var ICOL = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa'];
  function renderInstCard() {
    var el = $('hInst'); if (!el) return; var ps = S.inst || [];
    var tot = ps.reduce(function (a, p) { return a + (p.total || 0); }, 0), paid = ps.reduce(function (a, p) { return a + iPaid(p); }, 0);
    var nx = ps.map(function (p) { return { p: p, d: iNext(p) }; }).filter(function (x) { return x.d; }).sort(function (a, b) { return a.d.localeCompare(b.d); })[0];
    el.innerHTML = '<div class="km-top"><span class="card-3d">' + sprite('my_home') + '</span><div><div class="eyebrow">Still to pay · not in your net worth</div><div class="mid-money">' + money(tot - paid) + '</div><div class="muted small">' + (nx ? 'Next: ' + esc(nx.p.name) + ' · ' + money(nx.p.monthly, { rp: false }) + ' on ' + fmtDate(nx.d) : 'Paid ' + money(paid, { rp: false }) + ' of ' + money(tot, { rp: false })) + '</div></div></div>' +
      '<div class="inst-list">' + ps.map(function (p, i) { var pc = p.total ? Math.min(100, iPaid(p) / p.total * 100) : 0; return '<div class="inst-mini" style="--c:' + ICOL[i % ICOL.length] + '"><span class="biz-ic" style="--c:' + ICOL[i % ICOL.length] + '">' + sprite(p.sp || 'my_home') + '</span><span class="grow"><b>' + esc(p.name) + '</b><span class="bill-bar inst-bar"><i style="--w:' + pc.toFixed(1) + '%"></i></span></span><em>' + Math.round(pc) + '%</em></div>'; }).join('') + '</div>';
  }
  function instSheet() {
    var ps = S.inst || [], tot = ps.reduce(function (a, p) { return a + (p.total || 0); }, 0), paid = ps.reduce(function (a, p) { return a + iPaid(p); }, 0);
    var monthly = ps.filter(function (p) { return iLeft(p); }).reduce(function (a, p) { return a + (p.monthly || 0); }, 0);
    openSheet('<h3>Installments</h3><p class="muted small" style="text-align:center;margin:-8px 0 12px">Kept separate: these never change your wallets or net worth.</p>' +
      '<div class="dd-stats" style="margin-top:0;border:0;padding-top:0"><div><small>Total</small><b>' + money(tot, { rp: false }) + '</b></div><div><small>Paid</small><b class="pos">' + money(paid, { rp: false }) + '</b></div><div><small>Per month</small><b>' + money(monthly, { rp: false }) + '</b></div></div>' +
      '<div class="card list-card stagger" style="margin-top:12px">' + ps.map(function (p, i) {
        var pc = p.total ? Math.min(100, iPaid(p) / p.total * 100) : 0, nx = iNext(p);
        return '<button class="w-row" data-inst="' + esc(p.id) + '" style="--i:' + i + '"><span class="biz-ic" style="--c:' + ICOL[i % ICOL.length] + '">' + sprite(p.sp || 'my_home') + '</span><span class="grow"><b>' + esc(p.name) + '</b><span class="sub">' + money(iPaid(p), { rp: false }) + ' of ' + money(p.total || 0, { rp: false }) + (nx ? ' · next ' + fmtDate(nx) : iLeft(p) ? '' : ' · done 🎉') + '</span><span class="bill-bar inst-bar" style="--c:' + ICOL[i % ICOL.length] + '"><i style="--w:' + pc.toFixed(1) + '%"></i></span></span><span class="amt">' + money(iLeft(p), { rp: false }) + '</span></button>';
      }).join('') + '<button class="w-row" id="instAdd"><span class="biz-ic add">＋</span><span class="grow"><b>Add installment</b><span class="sub">House, car, wedding, gadget…</span></span></button></div>',
      function (r) {
        r.addEventListener('click', function (e) { var b = e.target.closest('[data-inst]'); if (b) { haptic(); instDetail(S.inst.filter(function (x) { return x.id === b.dataset.inst; })[0]); } });
        r.querySelector('#instAdd').onclick = function () { instEdit(); };
      });
  }
  function instEdit(p) {
    var isNew = !p; p = p || { id: uid(), name: '', sp: 'my_home', total: 0, monthly: 0, dueDay: 1, pays: [] }; var st = { sp: p.sp };
    openSheet('<h3>' + (isNew ? 'Add installment' : 'Edit installment') + '</h3><span class="ic preview i3d">' + sprite(st.sp) + '</span>' +
      '<label class="fld">Name<input id="iName" value="' + esc(p.name) + '" placeholder="e.g. RUMAH NOAH"></label>' +
      '<label class="fld">Total price (Rp)<input id="iTotal" inputmode="numeric" value="' + (p.total ? p.total.toLocaleString('id-ID') : '') + '" placeholder="0"></label>' +
      '<div class="two"><label class="fld">Per month (Rp)<input id="iMonthly" inputmode="numeric" value="' + (p.monthly ? p.monthly.toLocaleString('id-ID') : '') + '" placeholder="0"></label><label class="fld">Due day<input id="iDay" inputmode="numeric" value="' + (p.dueDay || 1) + '"></label></div>' +
      '<div class="fld">Icon' + picker(null, st.sp) + '</div>' +
      '<button class="btn primary block" id="iSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="iDel">Delete installment</button>'),
      function (r) {
        fmtInput(r.querySelector('#iTotal')); fmtInput(r.querySelector('#iMonthly')); bindSpPicker(r, st);
        r.querySelector('#iSave').onclick = function () {
          var n = r.querySelector('#iName').value.trim(); if (!n) { toast('Name it'); return; }
          p.name = n; p.sp = st.sp; p.total = parseNum(r.querySelector('#iTotal').value); p.monthly = parseNum(r.querySelector('#iMonthly').value); p.dueDay = Math.max(1, Math.min(28, parseNum(r.querySelector('#iDay').value) || 1));
          if (isNew) (S.inst = S.inst || []).push(p); save(); renderAll(); instDetail(p); toast('Saved ✓');
        };
        var d = r.querySelector('#iDel'); if (d) d.onclick = function () {
          confirmBox('Delete \u201c' + esc(p.name) + '\u201d?', 'Its payment history will be removed.', 'Delete').then(function (a) { return a && confirmBox('Are you sure?', 'This can\u2019t be undone.', 'Yes, delete', true); }).then(function (b) { if (!b) return; S.inst = S.inst.filter(function (x) { return x !== p; }); save(); renderAll(); instSheet(); toast('Deleted'); });
        };
      });
  }
  function instDetail(p) {
    if (!p) return; var i = S.inst.indexOf(p), col = ICOL[i % ICOL.length], pd = iPaid(p), pct = p.total ? pd / p.total : 0, left = iLeft(p), nx = iNext(p);
    var monthsLeft = p.monthly ? Math.ceil(left / p.monthly) : null, fin = monthsLeft ? new Date(new Date().getFullYear(), new Date().getMonth() + monthsLeft, 1) : null;
    var pays = (p.pays || []).slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    openSheet('<div class="sheet-top"><button class="icon-btn" id="iBack" aria-label="Back">‹</button><h3>' + esc(p.name) + '</h3><button class="icon-btn" id="iEdit" aria-label="Edit">✎</button></div>' +
      '<div class="gd-hero"><div class="g-vis big">' + ringSvg(pct, col, 132) + '<span class="g-ic">' + sprite(p.sp || 'my_home') + '</span></div><div class="gd-pct">' + Math.round(pct * 100) + '%</div><div class="muted small">' + money(pd) + ' of ' + money(p.total || 0) + '</div></div>' +
      '<div class="dd-stats"><div><small>Remaining</small><b>' + money(left, { rp: false }) + '</b></div><div><small>Per month</small><b>' + (p.monthly ? money(p.monthly, { rp: false }) : '–') + '</b></div><div><small>' + (fin ? 'Finished' : 'Months left') + '</small><b>' + (fin ? MONTHS[fin.getMonth()].slice(0, 3) + ' ' + fin.getFullYear() : '–') + '</b></div></div>' +
      (nx ? '<div class="inst-next"><span>Next payment</span><b>' + money(p.monthly) + ' · ' + fmtDate(nx) + '</b></div>' : '') +
      (left ? '<div class="amt-wrap" style="margin-top:14px"><span>Rp</span><input class="amt-input" id="iAmt" inputmode="numeric" placeholder="Payment" value="' + (p.monthly ? Math.min(p.monthly, left).toLocaleString('id-ID') : '') + '"></div>' +
        '<label class="fld">Date<input id="iDate" type="date" value="' + today() + '"></label><button class="btn primary block" id="iPay">＋ Record payment</button>' : '<div class="empty">Fully paid 🎉</div>') +
      '<p class="muted small" style="text-align:center">Recording here does not take money from any wallet.</p>' +
      (pays.length ? '<div class="sheet-sec">Payments</div><div class="timeline">' + pays.map(function (x) { return '<div class="tl"><div><b class="pos">+ ' + money(x.amount) + '</b><small>' + fmtDate(x.date) + '</small></div><button class="x" data-ipdel="' + esc(x.id) + '" aria-label="Delete">×</button></div>'; }).join('') + '</div>' : ''),
      function (r) {
        requestAnimationFrame(function () { requestAnimationFrame(function () { r.querySelectorAll('.g-fill').forEach(function (c) { c.classList.add('go'); }); }); });
        r.querySelector('#iBack').onclick = instSheet; r.querySelector('#iEdit').onclick = function () { instEdit(p); };
        var a = r.querySelector('#iAmt'); if (a) fmtInput(a);
        var b = r.querySelector('#iPay'); if (b) b.onclick = function () {
          var v = parseNum(a.value); if (!v) { toast('Enter the amount'); return; }
          (p.pays = p.pays || []).push({ id: uid(), amount: v, date: r.querySelector('#iDate').value || today() });
          var done = !iLeft(p); save(); renderAll(); instDetail(p); toast(done ? p.name + ' fully paid! 🎉' : 'Payment recorded'); if (done) confetti();
        };
        r.addEventListener('click', function (e) { var x = e.target.closest('[data-ipdel]'); if (!x) return; confirmBox('Delete this payment?', 'It will be removed from ' + esc(p.name) + '.', 'Delete').then(function (ok) { if (!ok) return; p.pays = p.pays.filter(function (y) { return y.id !== x.dataset.ipdel; }); save(); renderAll(); instDetail(p); }); });
      });
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
  var scrollMem = {};
  function show(id, back) {
    if (id === view) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    scrollMem[view] = window.scrollY;
    var prev = view; view = id;
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active', 'back'); });
    var el = $(id); void el.offsetWidth;
    el.classList.add('active'); if (back) el.classList.add('back');
    window.scrollTo(0, scrollMem[id] || 0);
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
  function onScroll() { var y = window.scrollY; $('topbar').classList.toggle('show', y > 120);
    if (view === 'v-home') { var nv = $('hNet'); $('topTitle').innerHTML = '<span class="tb-l">Net worth</span> ' + (S.settings.hide ? 'Rp ••••••' : money(balance('all') + recvNet() - dSum('out', 'remain'))); } document.documentElement.style.setProperty('--p', Math.max(0, Math.min(1, y / 180)).toFixed(3)); }

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
        root.querySelector('#fBiz').addEventListener('change', function () { this.dataset.manual = 1; });
        var files = (t.files || []).slice(); attachUI(root.querySelector('#fFiles'), files);
        var ub = root.querySelector('#fUnpaid');
        if (ub) { fmtInput(root.querySelector('#fPaidNow')); ub.onchange = function () { root.querySelector('#fUnpaidF').hidden = !ub.checked; haptic(); if (ub.checked) setTimeout(function () { root.querySelector('#fPayer').focus(); }, 200); }; }
        root.querySelector('#fScan').onclick = function () { haptic(); scanInto(root); };
        root.querySelector('#fSplit').onclick = function () { haptic(); splitSheet({ total: parseNum(amt.value), merchant: root.querySelector('#fMerch').value.trim(), date: root.querySelector('#fDate').value, wallet: root.querySelector('#fWallet').value, cat: st.type === 'expense' ? st.cat : '' }); };
        var ind = root.querySelector('#fType .seg-ind');
        function paint() {
          var idx = ['expense', 'income', 'debt', 'transfer'].indexOf(st.type);
          ind.style.transform = 'translateX(' + (idx * 100) + '%)';
          root.querySelectorAll('#fType button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === st.type); });
          root.querySelector('#fCatWrap').hidden = st.type === 'transfer';
          root.querySelector('#fToL').hidden = st.type !== 'transfer';
          root.querySelector('#fBizL').hidden = st.type === 'transfer';
          var bz = root.querySelector('#fBiz'); if (isNew && !bz.dataset.manual) { var lb = bizForCat(st.cat); if (!lb) { var cn = cat(st.cat).name.toLowerCase(); (S.businesses || []).forEach(function (b) { if (cn === b.name.toLowerCase()) lb = b.id; }); } bz.value = lb || (prefill && prefill.biz) || ''; }
          var upb = root.querySelector('#fUnpaidBox'); if (upb) upb.hidden = st.type !== 'income';
          root.querySelector('#fWalletL span').textContent = st.type === 'transfer' ? 'From wallet' : 'Wallet';
          var cats = S.cats.filter(function (c) { return c.type === st.type; });
          if (st.type !== 'transfer' && !cats.some(function (c) { return c.id === st.cat; })) st.cat = cats[0] ? cats[0].id : '';
          var sc = cat(st.cat);
          root.querySelector('#fCatSel').innerHTML = icon(sc) + '<span class="grow"><small>Category</small>' + esc(sc.name) + '</span><span class="chev2">' + (pickOpen ? '▴' : '▾') + '</span>';
          root.querySelector('#fCatPick').classList.toggle('open', pickOpen);
          var q = root.querySelector('#fCatQ').value.trim().toLowerCase();
          root.querySelector('#fCats').innerHTML = catTree(st.type).filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; }).map(function (c, i) {
            return '<div class="sw" data-cid="' + esc(c.id) + '"><button class="sw-del" type="button" data-delcat="' + esc(c.id) + '"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>Delete</button><button type="button" data-c="' + esc(c.id) + '" class="cat-row' + (c.parent ? ' child' : '') + (c.id === st.cat ? ' on' : '') + '" style="--i:' + Math.min(i, 14) + '">' + icon(c, 'sm') + '<span class="grow">' + esc(c.name) + '</span>' + (c.id === st.cat ? '<span class="check">✓</span>' : '') + '</button></div>';
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
        bindSwipe(root.querySelector('#fCats'));
        var onDel = function () { if (!document.body.contains(root)) { document.removeEventListener('catdeleted', onDel); return; } paint(); }; document.addEventListener('catdeleted', onDel);
        root.querySelector('#fCats').addEventListener('click', function (e) { var b = e.target.closest('button[data-c]'); if (b) { st.cat = b.dataset.c; pickOpen = false; root.querySelector('#fCatQ').value = ''; haptic(); paint(); autoOwed(); } });
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
            toWallet: '', biz: bizForCat(guessCat(p.merchant, p.type)) || undefined, date: ymd(d), time: hm(d), merchant: p.merchant, note: '', src: 'bca', srcId: em.id, ref: p.ref || '', created: Date.now()
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
  // ---------- Import from Money Lover (Excel/CSV export). Runs fully on the phone: the file never leaves it. ----------
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = function () { res(window.XLSX); }; s.onerror = function () { rej(new Error('Could not load the Excel reader. Check your connection.')); }; document.head.appendChild(s); });
  }
  function mlNorm(x) { return String(x || '').toLowerCase().replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/[^a-z0-9]/g, ''); }
  function mlParse(rows) {
    // rows: arrays, first row = header. Money Lover columns: Id, Date, Category, Amount, Currency, Wallet, Note, With, Event, Exclude from report
    var H = rows[0].map(function (h) { return mlNorm(h); }), col = function (n) { return H.indexOf(n); };
    var iD = col('date'), iC = col('category'), iA = col('amount'), iW = col('wallet'), iN = col('note'), iI = col('id'), iCur = col('currency');
    if (iD < 0 || iC < 0 || iA < 0) throw new Error('This doesn’t look like a Money Lover export (no Date / Category / Amount columns).');
    var data = rows.slice(1).filter(function (r) { return r && r[iA] != null && r[iA] !== '' && r[iD] != null && r[iD] !== ''; });
    // Google Sheets turned some dd/mm dates into real dates with day and month swapped. If the file mixes text dates and real dates, swap the real ones back.
    var hasText = data.some(function (r) { return typeof r[iD] === 'string'; }), hasReal = data.some(function (r) { return r[iD] instanceof Date || typeof r[iD] === 'number'; });
    function toDate(v) {
      if (typeof v === 'string') { var m = v.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/); if (m) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]); var m2 = v.match(/^(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : null; }
      var d = v instanceof Date ? v : new Date(Math.round((v - 25569) * 864e5));
      var y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, da = d.getUTCDate();
      if (v instanceof Date) { y = d.getFullYear(); mo = d.getMonth() + 1; da = d.getDate(); if (d.getHours() >= 12) { var n2 = new Date(d.getTime() + 12 * 36e5); y = n2.getFullYear(); mo = n2.getMonth() + 1; da = n2.getDate(); } }
      if (hasText && hasReal && da <= 12) { var t = mo; mo = da; da = t; }
      return y + '-' + pad(mo) + '-' + pad(da);
    }
    return data.map(function (r) {
      var amt = typeof r[iA] === 'number' ? r[iA] : parseFloat(String(r[iA]).replace(/[^\d\-.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
      return { id: iI >= 0 ? r[iI] : null, date: toDate(r[iD]), cat: String(r[iC] || '').trim(), amount: amt || 0, wallet: iW >= 0 ? String(r[iW] || '').trim() : '', note: iN >= 0 && r[iN] != null ? String(r[iN]).trim() : '', cur: iCur >= 0 ? r[iCur] : 'IDR' };
    }).filter(function (x) { return x.date && x.amount; });
  }
  function mlImportFile(file) {
    busy(true, 'Reading ' + file.name + '…');
    var isCsv = /\.csv$/i.test(file.name);
    loadXLSX().then(function (X) {
      return file.arrayBuffer().then(function (buf) {
        var wb = isCsv ? X.read(new TextDecoder().decode(buf), { type: 'string', raw: true }) : X.read(buf, { type: 'array', cellDates: true });
        var ws = wb.Sheets[wb.SheetNames.filter(function (n) { return /transaction/i.test(n); })[0] || wb.SheetNames[0]];
        return X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      });
    }).then(function (rows) { busy(false); mlPreview(mlParse(rows), file.name); })
      .catch(function (e) { busy(false); toast(e.message || 'Could not read that file'); });
  }
  function mlPreview(R, fname, preset) {
    preset = preset || {};
    if (!R.length) { toast('No transactions found in that file'); return; }
    var byName = {};
    S.cats.forEach(function (c) { (byName[mlNorm(c.name)] = byName[mlNorm(c.name)] || []).push(c); });
    function matchCat(name, amt) {
      var list = byName[mlNorm(name)]; if (!list) return null;
      var want = amt >= 0 ? 'income' : 'expense';
      return list.filter(function (c) { return c.type === want; })[0] || list[0];
    }
    var cats = {}, wallets = {}, dates = R.map(function (r) { return r.date; }).sort();
    R.forEach(function (r) {
      var k = r.cat + (r.amount >= 0 ? '|in' : '|out');
      if (!cats[k]) cats[k] = { name: r.cat, dir: r.amount >= 0 ? 'in' : 'out', n: 0, sum: 0, c: matchCat(r.cat, r.amount) };
      cats[k].n++; cats[k].sum += r.amount;
      wallets[r.wallet] = (wallets[r.wallet] || 0) + r.amount;
    });
    Object.keys(cats).forEach(function (k) {
      if (!cats[k].c && mlNorm(cats[k].name) === 'bl' && cats[k].dir === 'out') cats[k].c = S.cats.filter(function (c) { return c.id === 'ml_bl_out' || mlNorm(c.name) === 'billiard'; })[0] || { id: 'ml_bl_out', name: 'BILLIARD', icon: '🎱', sp: 'fun', type: 'expense', _new: true };
    });
    var unmatched = Object.keys(cats).filter(function (k) { return !cats[k].c; });
    var debtKeys = Object.keys(cats).filter(function (k) { return cats[k].c && cats[k].c.type === 'debt'; });
    var expOpts = S.cats.filter(function (c) { return c.type === 'expense'; }), incOpts = S.cats.filter(function (c) { return c.type === 'income'; });
    var wMatch = {}; Object.keys(wallets).forEach(function (n) { wMatch[n] = S.wallets.filter(function (w) { return mlNorm(w.name) === mlNorm(n); })[0] || null; });
    var st = { skipDebt: true, map: {} };
    function catSelect(k) {
      var c = cats[k], opts = c.dir === 'in' ? incOpts : expOpts;
      return '<select data-map="' + esc(k) + '"><option value="__new">＋ New category "' + esc(c.name) + '"</option>' + opts.map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.icon + ' ' + o.name) + '</option>'; }).join('') + '</select>';
    }
    openSheet('<h3>Import from Money Lover</h3>' +
      '<div class="ml-sum"><b>' + R.length.toLocaleString('id-ID') + '</b><em>transactions in the file</em><span>' + fmtDate(dates[0]) + ' → ' + fmtDate(dates[dates.length - 1]) + '</span></div>' +
      '<div class="sheet-sec">Wallets in the file</div><div class="card list-card">' + Object.keys(wallets).map(function (n) {
        return '<div class="ml-row"><span class="grow"><b>' + esc(n || '(no wallet)') + '</b><span class="sub">' + (wMatch[n] ? '→ ' + esc(wMatch[n].name) + ' in Apex' : '⚠️ No Apex wallet with this name, will be created') + '</span></span><span>' + money(wallets[n], { rp: false }) + '</span></div>';
      }).join('') + '</div>' +
      (unmatched.length ? '<div class="sheet-sec">Categories to choose</div><div class="card list-card">' + unmatched.map(function (k) {
        return '<div class="ml-row ml-col"><span><b>' + esc(cats[k].name) + '</b><span class="sub">' + cats[k].n + ' transactions · ' + money(Math.abs(cats[k].sum), { rp: false }) + (cats[k].dir === 'in' ? ' in' : ' out') + '</span></span>' + catSelect(k) + '</div>';
      }).join('') + '</div>' : '') +
      '<div class="sheet-sec">Matched automatically</div><div class="ml-chips">' + Object.keys(cats).filter(function (k) { return cats[k].c && cats[k].c.type !== 'debt'; }).map(function (k) { return '<span>' + esc(cats[k].name) + ' → ' + esc(cats[k].c.name) + ' <i>' + cats[k].n + '</i></span>'; }).join('') + '</div>' +
      (debtKeys.length ? '<label class="set-row plain"><span class="grow"><b>Skip loans & debt entries</b><span class="sub">' + debtKeys.map(function (k) { return esc(cats[k].name) + ' (' + cats[k].n + ')'; }).join(', ') + '</span></span><input type="checkbox" class="switch" id="mlSkip" checked></label>' : '') +
      '<div class="sheet-sec">Balances after import</div><p class="muted small" style="margin:-4px 2px 8px">Type each wallet’s real balance. Apex adds the history and sets the balance to exactly this. Leave empty to keep the current balance.</p>' +
      '<div class="card list-card">' + S.wallets.map(function (w) {
        var fromFile = Object.keys(wMatch).filter(function (n) { return wMatch[n] === w; })[0];
        var pv = Object.keys(preset).filter(function (n) { return mlNorm(n) === mlNorm(w.name); })[0];
        return '<label class="ml-row"><span class="grow"><b>' + esc(w.name) + '</b><span class="sub">Now ' + money(balance(w.id), { rp: false }) + (fromFile != null ? ' · history in file' : '') + '</span></span><input class="ml-bal" data-w="' + esc(w.id) + '" inputmode="numeric" placeholder="keep"' + (pv != null ? ' value="' + Math.round(preset[pv]).toLocaleString('id-ID') + '"' : fromFile != null ? ' value="' + Math.round(wallets[fromFile]).toLocaleString('id-ID') + '"' : '') + '></label>';
      }).join('') + '</div>' +
      '<div class="ml-dupe" id="mlDupe"></div>' +
      '<button class="btn primary block" id="mlGo">Import ' + R.length.toLocaleString('id-ID') + ' transactions</button>' +
      '<p class="muted small" style="text-align:center">Read on your phone only. Nothing is uploaded. Already-imported rows are skipped, so running it twice won’t double anything.</p>',
      function (r) {
        r.querySelectorAll('.ml-bal').forEach(fmtInput);
        function count() {
          var skip = r.querySelector('#mlSkip') ? r.querySelector('#mlSkip').checked : false;
          var have = {}; S.tx.forEach(function (t) { if (t.mlKey) have[t.mlKey] = 1; });
          var n = 0, dup = 0;
          R.forEach(function (x) { var k = x.cat + (x.amount >= 0 ? '|in' : '|out'); if (skip && debtKeys.indexOf(k) !== -1) return; if (have[mlKey(x)]) dup++; else n++; });
          r.querySelector('#mlGo').textContent = 'Import ' + n.toLocaleString('id-ID') + ' transactions';
          r.querySelector('#mlDupe').textContent = dup ? dup.toLocaleString('id-ID') + ' already in Apex will be skipped.' : '';
        }
        var sk = r.querySelector('#mlSkip'); if (sk) sk.onchange = count; count();
        r.querySelector('#mlGo').onclick = function () {
          var skip = sk ? sk.checked : false, map = {};
          r.querySelectorAll('[data-map]').forEach(function (s) { map[s.dataset.map] = s.value; });
          var bal = {}; r.querySelectorAll('.ml-bal').forEach(function (i) { if (String(i.value).trim() !== '') bal[i.dataset.w] = parseNum(i.value); });
          confirmBox('Import now?', 'Adds the Money Lover history to Apex and sets the balances you typed.', 'Import', false).then(function (ok) { if (ok) mlCommit(R, cats, map, wMatch, skip, debtKeys, bal); });
        };
      });
  }
  // Private import link prepared for this person: the data file on the site is AES-GCM encrypted; the key only exists in the link's #hash (never sent to any server).
  function mlSeedFromHash() {
    var m = location.hash.match(/^#mls=([a-f0-9]{8,40})\.([A-Za-z0-9_\-]{40,60})$/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    mlSeed(m[1], m[2]);
  }
  function mlSeedPrompt() {
    var v = prompt('Paste your import code'); if (!v) return;
    var m = String(v).trim().replace(/^.*#mls=/, '').match(/^([a-f0-9]{8,40})\.([A-Za-z0-9_\-]{40,60})$/);
    if (!m) { toast('That code doesn\u2019t look right'); return; }
    mlSeed(m[1], m[2]);
  }
  function mlSeed(fid, key) {
    var m = [null, fid, key];
    if (!(window.crypto && crypto.subtle)) { toast('This browser can\u2019t unlock the import'); return; }
    busy(true, 'Unlocking your Money Lover data…');
    var kb = Uint8Array.from(atob(m[2].replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - m[2].length % 4) % 4)), function (ch) { return ch.charCodeAt(0); });
    fetch('s/' + m[1] + '.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('Import file not found'); return r.json(); }).then(function (f) {
      var iv = unb64(f.iv), ct = unb64(f.ct);
      return crypto.subtle.importKey('raw', kb, 'AES-GCM', false, ['decrypt']).then(function (k) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, k, ct); });
    }).then(function (buf) {
      busy(false);
      var d = JSON.parse(new TextDecoder().decode(buf));
      mlPreview(d.rows, d.name, d.balances || {});
    }).catch(function (e) { busy(false); toast(e && e.message === 'Import file not found' ? e.message : 'Could not unlock the import link'); });
  }
  function mlKey(x) { return 'ml|' + (x.id != null ? x.id : '') + '|' + x.date + '|' + x.amount + '|' + x.cat; }
  function mlCommit(R, cats, map, wMatch, skip, debtKeys, bal) {
    busy(true, 'Importing…');
    var made = {};
    Object.keys(map).forEach(function (k) {
      if (map[k] !== '__new') { cats[k].c = cat(map[k]); return; }
      var c = cats[k], nc = { id: 'ml_' + mlNorm(c.name) + '_' + c.dir, name: c.name, icon: c.dir === 'in' ? '💰' : '🏷️', type: c.dir === 'in' ? 'income' : 'expense' };
      if (!S.cats.some(function (x) { return x.id === nc.id; })) S.cats.push(nc);
      c.c = nc; made[nc.id] = 1;
    });
    Object.keys(wMatch).forEach(function (n) {
      if (wMatch[n]) return;
      var w = { id: uid(), name: n || 'Money Lover', icon: '👛', initial: 0 }; S.wallets.push(w); wMatch[n] = w;
    });
    Object.keys(cats).forEach(function (k) { var c = cats[k].c; if (c && c._new) { delete c._new; if (!S.cats.some(function (x) { return x.id === c.id; })) S.cats.push(c); } });
    var have = {}; S.tx.forEach(function (t) { if (t.mlKey) have[t.mlKey] = 1; });
    var added = 0;
    R.forEach(function (x) {
      var k = x.cat + (x.amount >= 0 ? '|in' : '|out'), c = cats[k].c, key = mlKey(x);
      if (!c || have[key]) return;
      if (debtKeys.indexOf(k) !== -1 && skip) return;
      var type = c.type === 'debt' ? 'debt' : (x.amount >= 0 ? 'income' : 'expense');
      var t = { id: uid(), type: type, cat: c.id, amount: Math.abs(x.amount), wallet: wMatch[x.wallet].id, toWallet: '', date: x.date, time: '', note: x.note || '', merchant: '', src: 'ml', mlKey: key, created: Date.now() };
      var b = bizForCat(c.id); if (b) t.biz = b;
      S.tx.push(t); have[key] = 1; added++;
    });
    Object.keys(bal).forEach(function (id) { var w = S.wallets.filter(function (x) { return x.id === id; })[0]; if (w) setBalance(w, bal[id]); });
    S.settings.mlImported = { at: Date.now(), n: added };
    save(); busy(false); closeSheet(); renderAll();
    toast('Imported ' + added.toLocaleString('id-ID') + ' transactions ✓');
  }
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
      '<div class="two" id="wLiveF"><label class="fld">Quantity<input id="wQty" inputmode="decimal" value="' + (w.holding ? esc(w.holding.qty) : '') + '" placeholder="e.g. 25.5"></label><label class="fld">Total paid (Rp)<input id="wCost" inputmode="numeric" value="' + (w.holding && w.holding.cost ? (+w.holding.cost).toLocaleString('id-ID') : '') + '" placeholder="for profit/loss"></label></div><div class="two" id="wGoldF"><label class="fld">Money invested (Rp)<input id="wInv" inputmode="numeric" value="' + (w.holding && w.holding.cost ? (+w.holding.cost).toLocaleString('id-ID') : '') + '" placeholder="e.g. 50.000.000"></label><label class="fld"><span id="wAvgL">Average price / gram</span><input id="wAvg" inputmode="numeric" value="' + (w.holding && w.holding.cost && +w.holding.qty ? Math.round(w.holding.avg || w.holding.cost / w.holding.qty).toLocaleString('id-ID') : '') + '" placeholder="e.g. 1.950.000"></label></div><div id="wUsdF"><div class="two"><label class="fld">US dollars you have<input id="wUsdQ" inputmode="decimal" placeholder="e.g. 36.260,63" value="' + (w.holding && w.holding.asset === 'usd' ? String((+w.holding.qty).toFixed(2)).replace('.', ',') : '') + '"></label><label class="fld">Average rate (Rp per $1)<input id="wUsdAvg" inputmode="numeric" placeholder="e.g. 17.900" value="' + (w.holding && w.holding.asset === 'usd' && w.holding.avg ? Math.round(w.holding.avg).toLocaleString('id-ID') : '') + '"></label></div>' +
        '<label class="set-row plain"><span class="grow">This wallet also has Rupiah<span class="sub">e.g. a bank with an IDR and a USD account</span></span><input type="checkbox" class="switch" id="wUsdCashOn"' + (w.holding && w.holding.withCash ? ' checked' : '') + '></label>' +
        '<label class="fld" id="wUsdCashL">Rupiah part<input id="wUsdCash" inputmode="numeric" placeholder="e.g. 303.951.791" value="' + (w.holding && w.holding.withCash ? Math.round(cashPart(w)).toLocaleString('id-ID') : '') + '"></label></div>' +
        '<div class="gl-prev" id="wLiveV"></div></div>' +
      '<label class="set-row plain"><span class="grow">Include in total balance</span><input type="checkbox" class="switch" id="wInc"' + (w.excluded ? '' : ' checked') + '></label>' +
      '<button class="btn primary block" id="wSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="wDel">Delete wallet</button>'),
      function (r) {
        fmtInput(r.querySelector('#wBal')); fmtInput(r.querySelector('#wCost'));
        fmtInput(r.querySelector('#wInv')); fmtInput(r.querySelector('#wAvg')); fmtInput(r.querySelector('#wUsdAvg')); fmtInput(r.querySelector('#wUsdCash'));
        function liveUi() {
          var a = r.querySelector('#wAsset').value, gold = !!INV[a], q = parseFloat(String(r.querySelector('#wQty').value).replace(',', '.')) || 0, out = '';
          var usdM = a === 'usd';
          r.querySelector('#wLiveF').hidden = !a || gold; r.querySelector('#wGoldF').hidden = !gold || usdM; r.querySelector('#wUsdF').hidden = !usdM; r.querySelector('#wBal').closest('label').hidden = !!a;
          r.querySelector('#wUsdCashL').hidden = !r.querySelector('#wUsdCashOn').checked;
          if (usdM) {
            var uq = parseDec(r.querySelector('#wUsdQ').value), ua = parseNum(r.querySelector('#wUsdAvg').value), up = PRICES.usd, ucash = r.querySelector('#wUsdCashOn').checked ? parseNum(r.querySelector('#wUsdCash').value) : 0;
            if (!up) INV.usd.fetch();
            if (!uq || !ua) out = '<span class="muted">Enter the dollars you have and your average rate.</span>';
            else { var ui = uq * ua, uv = up ? uq * up : null; out = '<div class="gl-row"><span>You have</span><b>' + fmtUsd(uq) + '</b></div><div class="gl-row"><span>USD invested</span><b>' + money(Math.round(ui)) + '</b></div>' +
              (uv != null ? '<div class="gl-row"><span>Live rate</span><b>' + money(Math.round(up)) + ' / $1</b></div><div class="gl-row"><span>USD worth now</span><b>' + money(Math.round(uv)) + '</b></div><div class="gl-row"><span>Profit / loss</span><b class="' + (uv >= ui ? 'pos' : 'neg') + '">' + (uv >= ui ? '+' : '−') + money(Math.abs(Math.round(uv - ui)), { rp: false }) + ' (' + (uv >= ui ? '+' : '−') + Math.abs((uv - ui) / ui * 100).toFixed(2) + '%)</b></div>' : '<div class="gl-row"><span>Live rate</span><b>fetching…</b></div>') +
              (ucash ? '<div class="gl-row big"><span>Wallet invested (Rp + USD)</span><b>' + money(Math.round(ui + ucash)) + '</b></div>' + (uv != null ? '<div class="gl-row big"><span>Wallet worth now</span><b>' + money(Math.round(uv + ucash)) + '</b></div>' : '') : ''); }
          } else if (gold) {
            var cf = INV[a]; r.querySelector('#wAvgL').textContent = cf.avgLabel; r.querySelector('#wAvg').placeholder = 'e.g. ' + cf.avgPh;
            var inv = parseNum(r.querySelector('#wInv').value), avg = parseNum(r.querySelector('#wAvg').value), g = inv && avg ? inv / avg : 0, p = PRICES[a];
            if (!p) cf.fetch();
            if (!g) out = '<span class="muted">Enter how much you put in and your average ' + (a === 'usd' ? 'rate' : 'price per gram') + '.</span>';
            else if (!p) out = cf.qty(g) + ' · fetching live price…';
            else { var v = g * p, d = v - inv, pc = d / inv * 100; out = '<div class="gl-row"><span>You own</span><b>' + cf.qty(g) + '</b></div><div class="gl-row"><span>Live ' + (a === 'usd' ? 'rate' : 'price') + '</span><b>' + money(Math.round(p)) + ' ' + cf.unit + '</b></div><div class="gl-row big"><span>Worth now</span><b>' + money(Math.round(v)) + '</b></div><div class="gl-row"><span>Profit / loss</span><b class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d >= 0 ? '+' : '−') + money(Math.abs(Math.round(d)), { rp: false }) + ' (' + (d >= 0 ? '+' : '−') + Math.abs(pc).toFixed(2) + '%)</b></div>'; }
          } else if (a) out = PRICES[a] ? 'Now worth ' + money(q * PRICES[a]) + ' · 1 ' + ASSETS[a].unit + ' = ' + money(PRICES[a]) : 'Fetching live price…';
          r.querySelector('#wLiveV').innerHTML = out;
        }
        r.querySelector('#wInv').oninput = liveUi; r.querySelector('#wAvg').oninput = liveUi;
        ['#wUsdQ', '#wUsdAvg', '#wUsdCash'].forEach(function (q) { r.querySelector(q).addEventListener('input', liveUi); }); r.querySelector('#wUsdCashOn').onchange = liveUi;
        r.querySelector('#wAsset').onchange = function () { if (this.value && !PRICES[this.value]) fetchPrices(true).then(liveUi); liveUi(); }; r.querySelector('#wQty').oninput = liveUi; liveUi();
        var wst = { sp: spKey(w) }; bindSpPicker(r, wst);
        r.querySelector('#wSave').onclick = function () {
          var n = r.querySelector('#wName').value.trim(); if (!n) { toast('Give it a name'); return; }
          w.name = n; if (wst.sp) { w.sp = wst.sp; delete w.custom; }
          w.excluded = !r.querySelector('#wInc').checked;
          var wa = r.querySelector('#wAsset').value;
          var usdCash = null;
          if (wa === 'usd') { var uq = parseDec(r.querySelector('#wUsdQ').value), ua = parseNum(r.querySelector('#wUsdAvg').value); if (!uq || !ua) { toast('Enter your dollars and average rate'); return; } var wc = r.querySelector('#wUsdCashOn').checked; w.holding = { asset: 'usd', qty: uq, cost: uq * ua, avg: ua, withCash: wc || undefined }; if (wc) usdCash = parseNum(r.querySelector('#wUsdCash').value); }
          else if (INV[wa]) { var inv = parseNum(r.querySelector('#wInv').value), avg = parseNum(r.querySelector('#wAvg').value); if (!inv || !avg) { toast('Enter money invested and average ' + (wa === 'usd' ? 'rate' : 'price')); return; } w.holding = { asset: wa, qty: inv / avg, cost: inv, avg: avg }; }
          else if (wa) w.holding = { asset: wa, qty: parseFloat(String(r.querySelector('#wQty').value).replace(',', '.')) || 0, cost: parseNum(r.querySelector('#wCost').value) }; else delete w.holding;
          w.group = r.querySelector('#wGroup').value;
          if (isNew) S.wallets.push(w);
          if (!w.holding) setBalance(w, parseNum(r.querySelector('#wBal').value) * (curBal < 0 ? -1 : 1));
          else if (usdCash != null) setBalance(w, usdCash);
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

  // ---------- Category page: how much went into this category (month / year / all time, chart, transactions) ----------
  function catDetail(c) {
    if (!c) return;
    var kids = S.cats.filter(function (k) { return k.parent === c.id; }), ids = [c.id].concat(kids.map(function (k) { return k.id; }));
    var inc = c.type === 'income', now = new Date(), m = ym(now), pm = ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)), y = String(now.getFullYear());
    var tx = S.tx.filter(function (t) { return ids.indexOf(t.cat) !== -1 && t.type !== 'transfer'; }).sort(function (a, b) { return (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')); });
    var all = 0, mo = 0, last = 0, yr = 0, byM = {}, byKid = {};
    tx.forEach(function (t) { var a = t.amount, k = t.date.slice(0, 7); all += a; if (k === m) mo += a; if (k === pm) last += a; if (t.date.slice(0, 4) === y) yr += a; byM[k] = (byM[k] || 0) + a; byKid[t.cat] = (byKid[t.cat] || 0) + a; });
    var first = tx.length ? tx[tx.length - 1].date : null, months = first ? Math.max(1, (now.getFullYear() - +first.slice(0, 4)) * 12 + now.getMonth() - (+first.slice(5, 7) - 1) + 1) : 1;
    var ms = []; for (var i = 11; i >= 0; i--) ms.push(ym(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    var bmax = Math.max.apply(null, ms.map(function (k) { return byM[k] || 0; }).concat([1]));
    var vs = last ? (mo - last) / last * 100 : null, shown = 20;
    function list(n) { return tx.length ? tx.slice(0, n).map(function (t, k) { return txRow(t, k, true); }).join('') : '<div class="dw-empty">No transactions in this category yet.</div>'; }
    openSheet('<div class="cd-head">' + icon(c, 'lg') + '<div><h3>' + esc(c.name) + '</h3><span>' + (inc ? 'Income' : 'Expense') + ' category' + (kids.length ? ' · incl. ' + kids.length + ' sub' : '') + '</span></div></div>' +
      '<div class="cd-hero"><small>' + (inc ? 'Received' : 'Spent') + ' all time</small><b>' + money(all) + '</b><span>' + tx.length.toLocaleString('id-ID') + ' transactions' + (first ? ' since ' + fmtDate(first) : '') + '</span></div>' +
      '<div class="cd-stats"><div><small>This month</small><b>' + money(mo, { rp: false }) + '</b>' + (vs != null ? '<i class="' + ((vs > 0) === !inc ? 'bad' : 'good') + '">' + (vs > 0 ? '▲ ' : '▼ ') + Math.abs(vs).toFixed(0) + '% vs last</i>' : '') + '</div>' +
        '<div><small>This year</small><b>' + money(yr, { rp: false }) + '</b></div><div><small>Avg / month</small><b>' + money(Math.round(all / months), { rp: false }) + '</b></div></div>' +
      '<div class="cd-sec">Last 12 months</div><div class="cd-bars" id="cdBars">' + ms.map(function (k, i) { var v = byM[k] || 0; return '<button type="button" class="cd-b' + (k === m ? ' now' : '') + '" data-k="' + k + '" style="--i:' + i + '"><i style="height:' + Math.max(v ? 3 : 0, v / bmax * 100).toFixed(1) + '%"></i><span>' + MONTHS[+k.slice(5, 7) - 1].slice(0, 1) + '</span></button>'; }).join('') + '</div>' +
      '<div class="cd-tip" id="cdTip">Tap a bar to see that month</div>' +
      (kids.length ? '<div class="cd-sec">Inside this category</div><div class="card list-card cd-kids">' + [c].concat(kids).filter(function (k) { return byKid[k.id]; }).sort(function (a, b) { return byKid[b.id] - byKid[a.id]; }).map(function (k) {
        return '<div class="ml-row">' + icon(k, 'sm') + '<span class="grow">' + esc(k.id === c.id ? c.name + ' (itself)' : k.name) + '</span><b>' + money(byKid[k.id], { rp: false }) + '</b></div>'; }).join('') + '</div>' : '') +
      '<div class="cd-sec">Transactions</div><div class="dw-list" id="cdList">' + list(shown) + '</div>' +
      (tx.length > shown ? '<button class="btn block" id="cdMore" style="margin-top:8px">Show more</button>' : '') +
      '<div class="two" style="margin-top:12px"><button class="btn" id="cdAdd">＋ Add</button><button class="btn" id="cdEdit">Edit category</button></div>',
      function (r) {
        r.querySelector('#cdBars').onclick = function (e) {
          var b = e.target.closest('.cd-b'); if (!b) return; haptic();
          this.querySelectorAll('.cd-b').forEach(function (x) { x.classList.toggle('sel', x === b); });
          var k = b.dataset.k, n = tx.filter(function (t) { return t.date.slice(0, 7) === k; }).length;
          r.querySelector('#cdTip').innerHTML = '<b>' + monthName(k) + '</b> · ' + money(byM[k] || 0) + ' · ' + n + ' transaction' + (n === 1 ? '' : 's');
        };
        var mb = r.querySelector('#cdMore'); if (mb) mb.onclick = function () { shown += 40; r.querySelector('#cdList').innerHTML = list(shown); if (shown >= tx.length) mb.remove(); };
        r.querySelector('#cdList').onclick = function (e) { var t = e.target.closest('.tx'); if (!t) return; var tt = S.tx.filter(function (x) { return x.id === t.dataset.id; })[0]; if (tt) txSheet(tt); };
        r.querySelector('#cdAdd').onclick = function () { txSheet(null, { type: inc ? 'income' : 'expense', cat: c.id }); };
        r.querySelector('#cdEdit').onclick = function () { catSheet(c); };
      });
  }
  // "Bl" from Money Lover is billiard: give it a proper name and icon.
  function fixBilliard() { S.cats.forEach(function (c) { if (c.id === 'ml_bl_out') { c.name = 'BILLIARD'; c.icon = '🎱'; c.sp = 'fun'; } }); }
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
          closeSheet(); setTimeout(function () { deleteCategory(c.id); }, 300); return;
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
    $('realBtn').onclick = function () { haptic(); realSheet(); }; $('txReal').onclick = function () { haptic(); realSheet(); };
    $('hKomisi').onclick = function () { haptic(); komisiSheet(); };
    $('kmOpen').onclick = function () { haptic(); komisiSheet(); };
    $('hWorld').onclick = worldOpen; $('worldOpen').onclick = worldOpen; $('worldBtn').onclick = worldOpen;
    $('kmBtn').onclick = function () { haptic(); komisiSheet(); }; $('realBtn2').onclick = function () { haptic(); realSheet(); };
    $('hInst').onclick = function () { haptic(); instSheet(); }; $('instOpen').onclick = function () { haptic(); instSheet(); }; $('instBtn').onclick = function () { haptic(); instSheet(); };
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
      var c = e.target.closest('[data-wallet]') || st.querySelector('.wcard');
      if (c) walletDeck(c.dataset.wallet, c);
    });
    $('seeReports').onclick = function () { cur = new Date(); cur.setDate(1); renderAll(); show('v-report'); };
    $('periodReport').onclick = function () { show('v-report'); };
    $('repBack').onclick = function () { show(repFrom === 'v-report' ? 'v-home' : repFrom, true); };
    $('seeAllTx').onclick = function () { walletSel = 'all'; cur = new Date(); cur.setDate(1); renderAll(); show('v-tx'); };
    $('txPrev').onclick = function () { if (txAll) txAll = false; else cur.setMonth(cur.getMonth() - 1); haptic(); renderAll(); };
    $('txNext').onclick = function () { if (txAll) txAll = false; else cur.setMonth(cur.getMonth() + 1); haptic(); renderAll(); };
    $('monthLabel').onclick = function () { txAll = !txAll; txLimit = 80; haptic(); renderTx(); };

    function openTx(e) { var row = e.target.closest('.tx'); if (!row) return; var t = S.tx.filter(function (x) { return x.id === row.dataset.id; })[0]; if (t) txSheet(t); }
    $('txList').onclick = function (e) {
      var j = e.target.closest('[data-jump]'); if (j) { cur = new Date(j.dataset.jump + '-01T00:00:00'); txAll = false; haptic(); renderAll(); return; }
      if (e.target.closest('[data-alltime]')) { txAll = true; txLimit = 80; haptic(); renderTx(); return; }
      if (e.target.closest('[data-more]')) { txLimit += 150; haptic(); renderTx(); return; }
      openTx(e);
    }; $('hRecent').onclick = openTx;

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
      else if (t.dataset.editCat) catDetail(cat(t.dataset.editCat));
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
    $('billManage').onclick = recList; $('recBtn').onclick = recList; $('splitBtn').onclick = splitHub;
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
  function fmtG(g) { return (+g).toLocaleString('id-ID', { maximumFractionDigits: g < 10 ? 3 : 2 }) + ' g'; }
  // Net worth never includes live profit: every tracked holding counts at the money invested. No invested amount recorded = use the wallet's normal balance.
  function bookValue(w) { var h = w && w.holding; if (!h || !h.asset || !(+h.qty)) return null; return +h.cost > 0 ? +h.cost : null; }
  // Rupiah part of a wallet that also holds dollars/gold (initial + its transactions).
  function cashPart(w) { if (!w || !(w.holding && w.holding.withCash)) return 0; return (+w.initial || 0) + S.tx.reduce(function (a, t) { return a + delta(t, w.id); }, 0); }
  function parseDec(v) { v = String(v || '').trim().replace(/[^\d.,\-]/g, ''); if (!v) return 0; if (v.indexOf(',') !== -1) v = v.replace(/\./g, '').replace(',', '.'); else if ((v.match(/\./g) || []).length > 1) v = v.replace(/\./g, ''); return parseFloat(v) || 0; }
  function fmtUsd(q) { return 'USD ' + (+q).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
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

  // ---------- Live gold price bar (PAX Gold ≈ 1 troy oz of physical gold, via CoinGecko, in IDR) ----------
  var OZ = 31.1034768, GOLD = null;
  try { GOLD = JSON.parse(localStorage.getItem('apex_gold') || 'null'); } catch (e) {}
  function goldSpark(pts, w, h) {
    if (!pts || pts.length < 2) return '';
    var mn = Math.min.apply(null, pts), mx = Math.max.apply(null, pts), rg = mx - mn || 1;
    var d = pts.map(function (v, i) { return (i ? 'L' : 'M') + (i / (pts.length - 1) * w).toFixed(1) + ' ' + (h - 2 - (v - mn) / rg * (h - 4)).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><defs><linearGradient id="gsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5c451" stop-opacity=".35"/><stop offset="1" stop-color="#f5c451" stop-opacity="0"/></linearGradient></defs><path d="' + d + ' L' + w + ' ' + h + ' L0 ' + h + 'Z" fill="url(#gsg)"/><path d="' + d + '" fill="none" stroke="#f5c451" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function renderGold(flash) {
    var el = $('goldBar'); if (!el) return;
    if (!GOLD) { el.innerHTML = '<span class="gb-ic">' + sprite('gold_inv') + '</span><div class="gb-main"><b>Gold</b><small>Loading live price…</small></div>'; return; }
    var up = GOLD.chg >= 0, g = GOLD.price / OZ, pts = (GOLD.spark || []).filter(function (_, i, a) { return i % 3 === 0 || i === a.length - 1; });
    el.innerHTML = '<span class="gb-ic">' + sprite('gold_inv') + '</span>' +
      '<div class="gb-main"><b>Gold <i class="live"></i></b><small>per gram · live</small></div>' +
      '<div class="gb-spark">' + goldSpark(pts, 80, 28) + '</div>' +
      '<div class="gb-right"><b class="gb-price' + (flash ? ' fl-' + flash : '') + '">' + money(Math.round(g)) + '</b><span class="gb-chg ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(GOLD.chg).toFixed(2) + '%</span></div>';
  }
  var goldT = 0;
  function fetchGold() {
    clearTimeout(goldT); goldT = setTimeout(fetchGold, 60e3);
    if (document.hidden) return;
    fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=idr&ids=pax-gold&sparkline=true&price_change_percentage=24h')
      .then(function (r) { return r.json(); }).then(function (j) {
        var c = j && j[0]; if (!c || !c.current_price) return;
        var prev = GOLD && GOLD.price;
        GOLD = { price: c.current_price, chg: c.price_change_percentage_24h || 0, hi: c.high_24h, lo: c.low_24h, spark: (c.sparkline_in_7d && c.sparkline_in_7d.price) || [], ts: Date.now() };
        try { localStorage.setItem('apex_gold', JSON.stringify(GOLD)); } catch (e) {}
        PRICES.gold = GOLD.price / OZ;
        if (prev !== GOLD.price && S.wallets.some(function (w) { return w.holding && w.holding.asset === 'gold'; })) { renderAll(); if (window.__deckLive) window.__deckLive(); }
        renderGold(prev && prev !== GOLD.price ? (GOLD.price > prev ? 'up' : 'dn') : '');
      }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && (!GOLD || Date.now() - GOLD.ts > 50e3)) fetchGold(); });
  function goldSheet() {
    if (!GOLD) { fetchGold(); toast('Getting the live gold price…'); return; }
    var g = GOLD.price / OZ, mine = S.wallets.filter(function (w) { return w.holding && w.holding.asset === 'gold'; }), grams = mine.reduce(function (a, w) { return a + (+w.holding.qty || 0); }, 0);
    var sp = GOLD.spark || [], wk = sp.length ? (GOLD.price - sp[0]) / sp[0] * 100 : 0, age = Math.max(0, Math.round((Date.now() - GOLD.ts) / 1000));
    openSheet('<h3>Gold price</h3>' +
      '<div class="gs-hero"><span class="gs-ic">' + sprite('gold_inv') + '</span><div class="gs-price">' + money(Math.round(g)) + '<small>/ gram</small></div>' +
      '<div class="gs-chg ' + (GOLD.chg >= 0 ? 'up' : 'dn') + '">' + (GOLD.chg >= 0 ? '▲ ' : '▼ ') + Math.abs(GOLD.chg).toFixed(2) + '% today · ' + (wk >= 0 ? '▲ ' : '▼ ') + Math.abs(wk).toFixed(1) + '% this week</div></div>' +
      '<div class="gs-chart">' + goldSpark(sp, 320, 110) + '<div class="gs-ax"><span>7 days ago</span><span>Now</span></div></div>' +
      '<div class="dd-stats" style="margin-top:4px"><div><small>Today high</small><b>' + money(Math.round((GOLD.hi || GOLD.price) / OZ), { rp: false }) + '</b></div><div><small>Today low</small><b>' + money(Math.round((GOLD.lo || GOLD.price) / OZ), { rp: false }) + '</b></div><div><small>Per 10 g</small><b>' + money(Math.round(g * 10), { rp: false }) + '</b></div></div>' +
      (grams ? '<div class="card gs-mine"><div><small>Your gold</small><b>' + grams.toLocaleString('id-ID', { maximumFractionDigits: 3 }) + ' g</b></div><div style="text-align:right"><small>Worth now</small><b>' + money(Math.round(grams * g)) + '</b></div></div>' : '<p class="muted small" style="text-align:center">Tip: give a gold wallet a holding (Edit wallet → grams) and Apex values it with this live price.</p>') +
      '<p class="muted small" style="text-align:center;margin-top:10px">International spot price (PAX Gold, 1 token = 1 troy oz) converted to grams. Antam and Pegadaian prices are usually a bit higher. Updated ' + (age < 60 ? age + 's' : Math.round(age / 60) + ' min') + ' ago.</p>');
  }
  // ---------- Live IHSG bar (Jakarta Composite, via our Cloudflare function /p4v6ntzjtfj8/mkt) ----------
  var IHSG = null;
  try { IHSG = JSON.parse(localStorage.getItem('apex_ihsg') || 'null'); } catch (e) {}
  function lineSpark(pts, w, h, col, base) {
    if (!pts || pts.length < 2) return '';
    var vals = pts.map(function (p) { return p[1]; }), mn = Math.min.apply(null, vals.concat(base != null ? [base] : [])), mx = Math.max.apply(null, vals.concat(base != null ? [base] : [])), rg = mx - mn || 1;
    var y = function (v) { return (h - 2 - (v - mn) / rg * (h - 4)).toFixed(1); };
    var d = vals.map(function (v, i) { return (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ' ' + y(v); }).join(' '), id = 'ls' + Math.random().toString(36).slice(2, 7);
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".3"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' +
      (base != null ? '<line x1="0" x2="' + w + '" y1="' + y(base) + '" y2="' + y(base) + '" stroke="currentColor" stroke-opacity=".25" stroke-dasharray="2 3" stroke-width="1"/>' : '') +
      '<path d="' + d + ' L' + w + ' ' + h + ' L0 ' + h + 'Z" fill="url(#' + id + ')"/><path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function ihsgChg() { return IHSG && IHSG.prevClose ? { d: IHSG.price - IHSG.prevClose, pc: (IHSG.price - IHSG.prevClose) / IHSG.prevClose * 100 } : { d: 0, pc: 0 }; }
  function fmtIdx(v) { return (+v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function renderIhsg(flash) {
    var el = $('ihsgBar'); if (!el) return;
    if (!IHSG) { el.innerHTML = '<span class="ib-ic">' + sprite('stocks') + '</span><div class="gb-main"><b>IHSG</b><small>Loading live index…</small></div>'; return; }
    var c = ihsgChg(), up = c.d >= 0, col = up ? '#22c55e' : '#ef4444', open = IHSG.state === 'open';
    el.innerHTML = '<span class="ib-ic">' + sprite('stocks') + '</span>' +
      '<div class="gb-main"><b>IHSG ' + (open ? '<i class="live"></i>' : '') + '</b><small>' + (open ? 'Jakarta · live' : 'Market closed') + '</small></div>' +
      '<div class="gb-spark">' + lineSpark((IHSG.day && IHSG.day.length > 1 ? IHSG.day : IHSG.week || []).filter(function (_, i, a) { return a.length < 50 || i % 2 === 0 || i === a.length - 1; }), 80, 28, col, IHSG.prevClose) + '</div>' +
      '<div class="gb-right"><b class="gb-price' + (flash ? ' fl-' + flash : '') + '">' + fmtIdx(IHSG.price) + '</b><span class="gb-chg ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(c.pc).toFixed(2) + '%</span></div>';
  }
  var ihsgT = 0;
  function fetchIhsg() {
    clearTimeout(ihsgT);
    // every minute while the market is open, every 10 minutes otherwise
    ihsgT = setTimeout(fetchIhsg, IHSG && IHSG.state === 'open' ? 60e3 : 600e3);
    if (document.hidden) return;
    fetch('mkt?s=%5EJKSE').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
      if (!j || !j.price) return;
      var prev = IHSG && IHSG.price; j.ts = Date.now(); IHSG = j;
      try { localStorage.setItem('apex_ihsg', JSON.stringify(IHSG)); } catch (e) {}
      renderIhsg(prev && prev !== j.price ? (j.price > prev ? 'up' : 'dn') : '');
      clearTimeout(ihsgT); ihsgT = setTimeout(fetchIhsg, j.state === 'open' ? 60e3 : 600e3);
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && (!IHSG || Date.now() - (IHSG.ts || 0) > 50e3)) fetchIhsg(); });
  function ihsgSheet() {
    if (!IHSG) { fetchIhsg(); toast('Getting the live IHSG…'); return; }
    var c = ihsgChg(), up = c.d >= 0, col = up ? '#22c55e' : '#ef4444', open = IHSG.state === 'open';
    var wk = IHSG.week || [], wpc = wk.length ? (IHSG.price - wk[0][1]) / wk[0][1] * 100 : null;
    var t = IHSG.time ? new Date(IHSG.time * 1000) : null;
    var st = { tab: 'day' };
    function chart() { var pts = st.tab === 'day' ? IHSG.day : wk; return pts && pts.length > 1 ? lineSpark(pts, 320, 120, col, st.tab === 'day' ? IHSG.prevClose : null) : '<div class="muted small" style="text-align:center;padding:40px 0">No chart data yet.</div>'; }
    openSheet('<h3>IHSG</h3>' +
      '<div class="gs-hero"><span class="gs-ic">' + sprite('stocks') + '</span><div class="gs-price">' + fmtIdx(IHSG.price) + '</div>' +
      '<div class="gs-chg ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ +' : '▼ −') + fmtIdx(Math.abs(c.d)) + ' (' + (up ? '+' : '−') + Math.abs(c.pc).toFixed(2) + '%) today' + (wpc != null ? ' · ' + (wpc >= 0 ? '▲ ' : '▼ ') + Math.abs(wpc).toFixed(2) + '% 5 days' : '') + '</div>' +
      '<div class="ib-state ' + (open ? 'open' : '') + '">' + (open ? '● Market open' : 'Market closed') + (t ? ' · ' + t.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB' : '') + '</div></div>' +
      '<div class="ib-tabs"><button type="button" data-t="day" class="on">Today</button><button type="button" data-t="week">5 days</button></div>' +
      '<div class="gs-chart ib-chart" style="color:var(--muted)">' + chart() + '</div>' +
      '<div class="dd-stats" style="margin-top:4px"><div><small>Open</small><b>' + (IHSG.open ? fmtIdx(IHSG.open) : '–') + '</b></div><div><small>High</small><b>' + (IHSG.high ? fmtIdx(IHSG.high) : '–') + '</b></div><div><small>Low</small><b>' + (IHSG.low ? fmtIdx(IHSG.low) : '–') + '</b></div></div>' +
      '<div class="dd-stats" style="margin-top:0;border-top:0"><div><small>Previous close</small><b>' + (IHSG.prevClose ? fmtIdx(IHSG.prevClose) : '–') + '</b></div><div><small>Trading hours</small><b>09:00–16:00</b></div><div><small>Updates</small><b>' + (open ? 'Every min' : 'Paused') + '</b></div></div>' +
      '<p class="muted small" style="text-align:center;margin-top:10px">Jakarta Composite Index (^JKSE). Data from Yahoo Finance, can lag the exchange by a few minutes.</p>',
      function (r) {
        r.querySelector('.ib-tabs').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; st.tab = b.dataset.t; this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); r.querySelector('.ib-chart').innerHTML = chart(); haptic(); };
      });
  }
  // ---------- Live USD/IDR bar (real FX rate via our Cloudflare function; falls back to CoinGecko USDT) ----------
  var FX = null;
  try { FX = JSON.parse(localStorage.getItem('apex_fx') || 'null'); } catch (e) {}
  function fxChg() { return FX && FX.prevClose ? { d: FX.price - FX.prevClose, pc: (FX.price - FX.prevClose) / FX.prevClose * 100 } : { d: 0, pc: FX && FX.chg24 || 0 }; }
  function fmtFx(v) { return 'Rp ' + (+v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
  function renderFx(flash) {
    var el = $('fxBar'); if (!el) return;
    if (!FX) { el.innerHTML = '<span class="ib-ic">' + sprite('usd') + '</span><div class="gb-main"><b>USD / IDR</b><small>Loading live rate…</small></div>'; return; }
    var c = fxChg(), up = c.d >= 0 && c.pc >= 0, col = up ? '#22c55e' : '#ef4444';
    el.innerHTML = '<span class="ib-ic">' + sprite('usd') + '</span>' +
      '<div class="gb-main"><b>USD / IDR <i class="live"></i></b><small>1 US dollar · live</small></div>' +
      '<div class="gb-spark">' + lineSpark((FX.day && FX.day.length > 1 ? FX.day : FX.week || []).filter(function (_, i, a) { return a.length < 50 || i % 2 === 0 || i === a.length - 1; }), 80, 28, col, FX.prevClose) + '</div>' +
      '<div class="gb-right"><b class="gb-price' + (flash ? ' fl-' + flash : '') + '">' + fmtFx(FX.price) + '</b><span class="gb-chg ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(c.pc).toFixed(2) + '%</span></div>';
  }
  var fxT = 0;
  function fxSet(j) {
    var prev = FX && FX.price; j.ts = Date.now(); FX = j;
    try { localStorage.setItem('apex_fx', JSON.stringify(FX)); } catch (e) {}
    PRICES.usd = FX.price;
    renderFx(prev && prev !== j.price ? (j.price > prev ? 'up' : 'dn') : '');
    if (prev && prev !== j.price && S.wallets.some(function (w) { return w.holding && w.holding.asset === 'usd'; })) renderAll();
  }
  function fetchFx() {
    clearTimeout(fxT); fxT = setTimeout(fetchFx, 60e3);
    if (document.hidden) return;
    fetch('mkt?s=IDR%3DX').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) { if (!j || !j.price) throw 0; fxSet(j); })
      .catch(function () {
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr&include_24hr_change=true').then(function (r) { return r.json(); }).then(function (j) {
          var t = j && j.tether; if (!t || !t.idr) return;
          fxSet({ name: 'USD/IDR', price: t.idr, chg24: t.idr_24h_change || 0, day: [], week: [], state: 'open', time: Date.now() / 1000, src: 'usdt' });
        }).catch(function () {});
      });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && (!FX || Date.now() - (FX.ts || 0) > 50e3)) fetchFx(); });
  function fxSheet() {
    if (!FX) { fetchFx(); toast('Getting the live rate…'); return; }
    var c = fxChg(), up = c.pc >= 0, col = up ? '#22c55e' : '#ef4444', wk = FX.week || [], wpc = wk.length ? (FX.price - wk[0][1]) / wk[0][1] * 100 : null;
    var mine = S.wallets.filter(function (w) { return w.holding && w.holding.asset === 'usd'; }), usd = mine.reduce(function (a, w) { return a + (+w.holding.qty || 0); }, 0);
    var st = { tab: 'day' };
    function chart() { var pts = st.tab === 'day' ? FX.day : wk; return pts && pts.length > 1 ? lineSpark(pts, 320, 120, col, st.tab === 'day' ? FX.prevClose : null) : '<div class="muted small" style="text-align:center;padding:40px 0">No chart data yet.</div>'; }
    openSheet('<h3>USD / IDR</h3>' +
      '<div class="gs-hero"><span class="gs-ic">' + sprite('usd') + '</span><div class="gs-price">' + (+FX.price).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '<small>Rp per $1</small></div>' +
      '<div class="gs-chg ' + (up ? 'up' : 'dn') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(c.pc).toFixed(2) + '% today' + (wpc != null ? ' · ' + (wpc >= 0 ? '▲ ' : '▼ ') + Math.abs(wpc).toFixed(2) + '% 5 days' : '') + '</div>' +
      '<div class="ib-state">' + (up ? 'Dollar stronger, rupiah weaker today' : 'Rupiah stronger today') + '</div></div>' +
      (FX.day && FX.day.length ? '<div class="ib-tabs"><button type="button" data-t="day" class="on">Today</button><button type="button" data-t="week">5 days</button></div><div class="gs-chart ib-chart" style="color:var(--muted)">' + chart() + '</div>' : '') +
      '<div class="dd-stats" style="margin-top:4px"><div><small>High</small><b>' + (FX.high ? fmt(Math.round(FX.high)) : '–') + '</b></div><div><small>Low</small><b>' + (FX.low ? fmt(Math.round(FX.low)) : '–') + '</b></div><div><small>Prev close</small><b>' + (FX.prevClose ? fmt(Math.round(FX.prevClose)) : '–') + '</b></div></div>' +
      '<div class="dd-stats" style="margin-top:0;border-top:0"><div><small>$100</small><b>' + fmt(Math.round(FX.price * 100)) + '</b></div><div><small>$1.000</small><b>' + fmt(Math.round(FX.price * 1000)) + '</b></div><div><small>Rp 1 jt</small><b>$' + (1e6 / FX.price).toFixed(2) + '</b></div></div>' +
      (usd ? '<div class="card gs-mine"><div><small>Your dollars</small><b>$' + usd.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '</b></div><div style="text-align:right"><small>Worth now</small><b>' + money(Math.round(usd * FX.price)) + '</b></div></div>' : '') +
      '<p class="muted small" style="text-align:center;margin-top:10px">' + (FX.src === 'usdt' ? 'Backup source: USDT price from CoinGecko (very close to the real dollar rate).' : 'Market rate from Yahoo Finance. Bank and money changer rates differ slightly.') + '</p>',
      function (r) { var tb = r.querySelector('.ib-tabs'); if (tb) tb.onclick = function (e) { var b = e.target.closest('button'); if (!b) return; st.tab = b.dataset.t; this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); r.querySelector('.ib-chart').innerHTML = chart(); haptic(); }; });
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

  // ---------- split bill ----------
  // opts: {total, merchant, date, wallet, cat}
  function splitPeopleRecent() {
    var seen = {}, out = [];
    S.debts.slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }).forEach(function (d) { var n = String(d.person || '').trim(), k = n.toLowerCase(); if (n && !seen[k]) { seen[k] = 1; out.push(n); } });
    return out.slice(0, 10);
  }
  function splitSheet(opts) {
    opts = opts || {};
    var st = { people: [], me: true, payer: 'me', mode: 'equal', custom: {} };
    var expCats = S.cats.filter(function (c) { return c.type === 'expense'; });
    var catSel = opts.cat && cat(opts.cat).type === 'expense' ? opts.cat : (expCats[0] || {}).id;
    openSheet('<h3>Split bill</h3>' +
      '<div class="amt-wrap"><span>Rp</span><input class="amt-input" id="spAmt" inputmode="numeric" placeholder="0" value="' + (opts.total ? opts.total.toLocaleString('id-ID') : '') + '"></div>' +
      '<label class="fld">What for<input id="spTitle" placeholder="e.g. Dinner at Sushi Tei" value="' + esc(opts.merchant || '') + '"></label>' +
      '<div class="fld">Split with<div class="sp-people" id="spPeople"></div>' +
        '<div class="sp-add"><input id="spName" placeholder="Add a name" autocomplete="off" enterkeyhint="done"><button type="button" class="btn" id="spAddBtn">Add</button></div>' +
        '<div class="sp-recent" id="spRecent"></div></div>' +
      '<div class="fld">Who paid the bill?<div class="sp-payer" id="spPayer"></div></div>' +
      '<div class="seg d-seg" id="spMode" style="--x:0%"><button data-m="equal" class="on">Split equally</button><button data-m="custom">Custom amounts</button><i class="seg-ind"></i></div>' +
      '<div class="card sp-break" id="spBreak"></div>' +
      '<div id="spMeF"><div class="two"><label class="fld">Category<select id="spCat">' + expCats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === catSel ? ' selected' : '') + '>' + esc(c.icon + ' ' + c.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="fld">Paid from<select id="spWallet">' + walletOpts(opts.wallet || S.settings.bcaWallet || (S.wallets[0] || {}).id) + '</select></label></div></div>' +
      '<label class="fld">Date<input id="spDate" type="date" value="' + esc(opts.date || today()) + '"></label>' +
      '<p class="muted small" id="spHint"></p>' +
      '<button class="btn primary block" id="spGo">Save split</button>',
      function (r) {
        var amtEl = r.querySelector('#spAmt'); fmtInput(amtEl);
        function total() { return parseNum(amtEl.value) || 0; }
        function members() { return (st.me ? ['me'] : []).concat(st.people); }
        function label(p) { return p === 'me' ? 'Me' : p; }
        function shares() {
          var ms = members(), T = total(), out = {};
          if (st.mode === 'custom') { ms.forEach(function (p) { out[p] = st.custom[p] || 0; }); return out; }
          if (!ms.length) return out;
          var each = Math.floor(T / ms.length), rem = T - each * ms.length;
          ms.forEach(function (p) { out[p] = each; });
          var who = ms.indexOf(st.payer) !== -1 ? st.payer : ms[0]; out[who] += rem;
          return out;
        }
        function addPerson(n) {
          n = String(n || '').trim(); if (!n) return;
          if (/^me$/i.test(n)) { st.me = true; paint(); return; }
          if (st.people.some(function (p) { return p.toLowerCase() === n.toLowerCase(); })) { toast(n + ' is already in'); return; }
          st.people.push(n); haptic(); paint();
        }
        function paint() {
          if (st.payer !== 'me' && st.people.indexOf(st.payer) === -1) st.payer = 'me';
          r.querySelector('#spPeople').innerHTML =
            '<button type="button" class="sp-chip me' + (st.me ? ' on' : '') + '" data-me="1">' + avatar('Me') + '<span>Me</span><i>' + (st.me ? '✓' : '+') + '</i></button>' +
            st.people.map(function (p, i) { return '<button type="button" class="sp-chip on" data-rm="' + i + '">' + avatar(p) + '<span>' + esc(p) + '</span><i>✕</i></button>'; }).join('');
          var rec = splitPeopleRecent().filter(function (n) { return st.people.map(function (p) { return p.toLowerCase(); }).indexOf(n.toLowerCase()) === -1; });
          r.querySelector('#spRecent').innerHTML = rec.length ? '<span class="muted small">Recent</span>' + rec.map(function (n) { return '<button type="button" data-add="' + esc(n) + '">+ ' + esc(n) + '</button>'; }).join('') : '';
          r.querySelector('#spPayer').innerHTML = ['me'].concat(st.people).map(function (p) { return '<button type="button" data-pay="' + esc(p) + '" class="' + (st.payer === p ? 'on' : '') + '">' + esc(label(p)) + '</button>'; }).join('');
          var sh = shares(), ms = members(), T = total(), sum = ms.reduce(function (a, p) { return a + (sh[p] || 0); }, 0);
          r.querySelector('#spBreak').innerHTML = ms.length ? ms.map(function (p) {
            var owes = p !== st.payer && (st.payer === 'me' || p === 'me');
            var tag = p === st.payer ? 'Paid the bill' : owes ? (p === 'me' ? 'You owe ' + esc(st.payer) : 'Owes you') : 'Owes ' + esc(st.payer);
            return '<div class="sp-row">' + avatar(label(p)) + '<span class="grow"><b>' + esc(label(p)) + '</b><span class="sub">' + tag + '</span></span>' +
              (st.mode === 'custom' ? '<input class="sp-in" inputmode="numeric" data-p="' + esc(p) + '" placeholder="0" value="' + (st.custom[p] ? st.custom[p].toLocaleString('id-ID') : '') + '">' : '<b class="sp-amt">' + money(sh[p] || 0) + '</b>') + '</div>';
          }).join('') + (st.mode === 'custom' ? '<div class="sp-left ' + (sum === T ? 'ok' : 'bad') + '" id="spLeft">' + (sum === T ? 'All assigned ✓' : (T - sum > 0 ? 'Left to assign ' : 'Over by ') + money(Math.abs(T - sum))) + '</div>' : '') :
            '<div class="muted small">Add the people who shared this bill.</div>';
          r.querySelectorAll('.sp-in').forEach(function (inp) {
            fmtInput(inp);
            inp.addEventListener('input', function () { st.custom[inp.dataset.p] = parseNum(inp.value) || 0; var s2 = members().reduce(function (a, p) { return a + (st.custom[p] || 0); }, 0), T2 = total(), el = r.querySelector('#spLeft'); el.className = 'sp-left ' + (s2 === T2 ? 'ok' : 'bad'); el.textContent = s2 === T2 ? 'All assigned ✓' : (T2 - s2 > 0 ? 'Left to assign ' : 'Over by ') + 'Rp ' + fmt(Math.abs(T2 - s2)); });
          });
          r.querySelector('#spMeF').hidden = st.payer !== 'me';
          r.querySelector('#spHint').textContent = st.payer === 'me'
            ? 'The full bill is recorded as your expense. Each friend’s share goes to Owed so you can track who paid you back.'
            : 'Nothing leaves your wallet now. Your share is saved as money you owe ' + st.payer + ' and is recorded when you pay them back.';
        }
        r.querySelector('#spPeople').onclick = function (e) {
          var b = e.target.closest('button'); if (!b) return; haptic();
          if (b.dataset.me) { st.me = !st.me; } else { var p = st.people[+b.dataset.rm]; st.people.splice(+b.dataset.rm, 1); delete st.custom[p]; }
          paint();
        };
        r.querySelector('#spRecent').onclick = function (e) { var b = e.target.closest('button'); if (b) addPerson(b.dataset.add); };
        r.querySelector('#spPayer').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; st.payer = b.dataset.pay; if (st.payer === 'me') st.me = true; haptic(); paint(); };
        var nameEl = r.querySelector('#spName');
        r.querySelector('#spAddBtn').onclick = function () { addPerson(nameEl.value); nameEl.value = ''; nameEl.focus(); };
        nameEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addPerson(nameEl.value); nameEl.value = ''; } });
        r.querySelector('#spMode').onclick = function (e) {
          var b = e.target.closest('button'); if (!b) return; st.mode = b.dataset.m;
          if (st.mode === 'custom') { var sh = shares(); st.mode = 'equal'; var eq = shares(); st.mode = 'custom'; members().forEach(function (p) { if (!st.custom[p]) st.custom[p] = eq[p] || 0; }); }
          this.style.setProperty('--x', st.mode === 'equal' ? '0%' : '100%');
          this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); haptic(); paint();
        };
        amtEl.addEventListener('input', function () { if (st.mode === 'equal') paint(); else { var el = r.querySelector('#spLeft'); if (el) { var s2 = members().reduce(function (a, p) { return a + (st.custom[p] || 0); }, 0), T2 = total(); el.className = 'sp-left ' + (s2 === T2 ? 'ok' : 'bad'); el.textContent = s2 === T2 ? 'All assigned ✓' : (T2 - s2 > 0 ? 'Left to assign ' : 'Over by ') + 'Rp ' + fmt(Math.abs(T2 - s2)); } } });
        paint();
        if (!opts.total) setTimeout(function () { amtEl.focus(); }, 380);
        r.querySelector('#spGo').onclick = function () {
          var T = total(), ms = members(), sh = shares();
          if (!T) { toast('Enter the bill amount'); amtEl.focus(); return; }
          if (!st.people.length) { toast('Add at least one person'); nameEl.focus(); return; }
          var sum = ms.reduce(function (a, p) { return a + (sh[p] || 0); }, 0);
          if (sum !== T) { toast('Shares must add up to ' + 'Rp ' + fmt(T)); return; }
          var title = r.querySelector('#spTitle').value.trim() || 'Bill', date = r.querySelector('#spDate').value || today();
          var w = r.querySelector('#spWallet').value, sid = uid(), rec = { id: sid, title: title, total: T, date: date, payer: st.payer, wallet: w, people: [], ts: Date.now() };
          if (st.payer === 'me') {
            var t = addTx({ type: 'expense', cat: r.querySelector('#spCat').value, amount: T, wallet: w, date: date, merchant: title, note: 'Split with ' + st.people.join(', '), splitId: sid });
            rec.txId = t.id;
            st.people.forEach(function (p) {
              var d = sh[p] > 0 ? { id: uid(), dir: 'in', person: p, title: 'Split: ' + title, amount: sh[p], created: date, due: '', wallet: w, tags: 'split', notes: '', payments: [], splitId: sid, ts: Date.now() } : null;
              if (d) S.debts.push(d);
              rec.people.push({ name: p, amount: sh[p] || 0, debtId: d ? d.id : '' });
            });
            if (st.me) rec.people.unshift({ name: 'Me', amount: sh.me || 0, me: true });
          } else {
            var mine = st.me ? (sh.me || 0) : 0, dOut = null;
            if (mine > 0) { dOut = { id: uid(), dir: 'out', person: st.payer, title: 'Split: ' + title, amount: mine, created: date, due: '', wallet: w, tags: 'split', notes: '', payments: [], splitId: sid, ts: Date.now() }; S.debts.push(dOut); }
            ms.forEach(function (p) { rec.people.push({ name: label(p), amount: sh[p] || 0, me: p === 'me', debtId: p === 'me' && dOut ? dOut.id : '' }); });
          }
          (S.splits || (S.splits = [])).push(rec);
          haptic(); save(); renderAll(); splitDetail(sid, true);
          var fr = $('fab').getBoundingClientRect(); burst(fr.left + fr.width / 2, fr.top);
        };
      });
  }
  function splitStatus(s) {
    var open = 0, owed = 0;
    s.people.forEach(function (p) { var d = p.debtId && S.debts.filter(function (x) { return x.id === p.debtId; })[0]; if (d && dOpen(d)) { open++; owed += dRemain(d); } });
    return { open: open, owed: owed };
  }
  function splitMsg(s, p) { return 'Hi ' + p.name + '! Your share for ' + s.title + ' (' + fmtDate(s.date) + ') is Rp ' + fmt(p.amount) + '. Thank you! 🙏'; }
  function splitDetail(sid, fresh) {
    var s = (S.splits || []).filter(function (x) { return x.id === sid; })[0]; if (!s) return;
    var payer = s.payer === 'me' ? 'You' : s.payer, ss = splitStatus(s);
    openSheet('<h3>' + (fresh ? 'Split saved 🎉' : esc(s.title)) + '</h3>' +
      '<div class="sp-hero"><div class="sp-total">' + money(s.total) + '</div><div class="muted small">' + (fresh ? esc(s.title) + ' · ' : '') + fmtDate(s.date) + ' · ' + esc(payer) + ' paid</div>' +
      (s.payer === 'me' ? '<div class="sp-status ' + (ss.open ? '' : 'ok') + '">' + (ss.open ? ss.open + ' still owe you ' + money(ss.owed) : 'Everyone paid you back ✓') + '</div>' : '') + '</div>' +
      '<div class="card sp-break">' + s.people.map(function (p, i) {
        var d = p.debtId && S.debts.filter(function (x) { return x.id === p.debtId; })[0], rem = d ? dRemain(d) : 0, done = d && !dOpen(d);
        var sub = p.me ? (s.payer === 'me' ? 'Your share' : d ? (done ? 'You paid ' + esc(s.payer) + ' back ✓' : 'You owe ' + esc(s.payer) + ' ' + money(rem)) : 'Your share') :
          (s.payer === 'me' ? (d ? (done ? 'Paid you back ✓' : rem < p.amount ? money(rem) + ' left' : 'Not paid yet') : 'Settled') : (p.name === s.payer ? 'Paid the bill' : 'Owes ' + esc(s.payer)));
        var acts = d && !done ? '<span class="sp-acts">' + (!p.me ? '<button type="button" class="sp-wa" data-wa="' + i + '" aria-label="WhatsApp">💬</button>' : '') + '<button type="button" class="sp-pay" data-pay="' + i + '">' + (p.me ? 'Pay' : 'Paid') + '</button></span>' : '';
        return '<div class="sp-row' + (done ? ' done' : '') + '">' + avatar(p.name) + '<span class="grow"><b>' + esc(p.name) + '</b><span class="sub">' + sub + '</span></span><b class="sp-amt">' + money(p.amount) + '</b>' + acts + '</div>';
      }).join('') + '</div>' +
      (s.payer === 'me' && ss.open ? '<button class="btn block" id="spShare">Share all shares on WhatsApp</button>' : '') +
      '<button class="btn primary block" id="spDone">Done</button>' +
      '<button class="btn danger block" id="spDel">Delete split</button>',
      function (r) {
        r.querySelector('.sp-break').onclick = function (e) {
          var b = e.target.closest('button'); if (!b) return;
          if (b.dataset.wa != null) { var p = s.people[+b.dataset.wa]; window.open('https://wa.me/?text=' + encodeURIComponent(splitMsg(s, p)), '_blank'); return; }
          if (b.dataset.pay != null) { var d = S.debts.filter(function (x) { return x.id === s.people[+b.dataset.pay].debtId; })[0]; if (d) paySheet(d); }
        };
        var sh = r.querySelector('#spShare');
        if (sh) sh.onclick = function () {
          var lines = s.people.filter(function (p) { var d = p.debtId && S.debts.filter(function (x) { return x.id === p.debtId; })[0]; return d && dOpen(d); }).map(function (p) { return '• ' + p.name + ': Rp ' + fmt(p.amount); });
          window.open('https://wa.me/?text=' + encodeURIComponent('Split for ' + s.title + ' (' + fmtDate(s.date) + ')\nTotal Rp ' + fmt(s.total) + '\n\n' + lines.join('\n') + '\n\nThank you! 🙏'), '_blank');
        };
        r.querySelector('#spDone').onclick = closeSheet;
        r.querySelector('#spDel').onclick = function () {
          confirmBox('Delete this split?', 'This removes the bill expense and every unpaid share linked to it. Payments already recorded stay.', 'Delete', true).then(function (yes) {
            if (!yes) return;
            S.debts = S.debts.filter(function (d) { return d.splitId !== sid || (d.payments || []).length; });
            if (s.txId) S.tx = S.tx.filter(function (t) { return t.id !== s.txId; });
            S.splits = S.splits.filter(function (x) { return x.id !== sid; });
            save(); renderAll(); closeSheet(); toast('Split deleted');
          });
        };
      });
  }
  function splitHub() {
    var list = (S.splits || []).slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || b.ts - a.ts; });
    var owedAll = list.reduce(function (a, s) { return a + (s.payer === 'me' ? splitStatus(s).owed : 0); }, 0);
    openSheet('<h3>Split bill</h3>' +
      '<div class="sp-hero"><div class="muted small">Friends owe you from splits</div><div class="sp-total">' + money(owedAll) + '</div></div>' +
      '<button class="btn primary block" id="spNew">＋ New split</button>' +
      (list.length ? '<div class="section-h" style="margin-top:14px">History</div><div class="card list-card">' + list.map(function (s) {
        var ss = splitStatus(s);
        return '<button class="set-row" data-sid="' + esc(s.id) + '"><span class="ic sm">' + sprite('makan_team') + '</span><span class="grow">' + esc(s.title) + '<span class="sub">' + fmtDate(s.date) + ' · ' + s.people.length + ' people · ' + (s.payer === 'me' ? 'you paid' : esc(s.payer) + ' paid') + '</span></span>' +
          '<span class="sp-st ' + (ss.open ? '' : 'ok') + '">' + (ss.open ? money(ss.owed, { rp: false }) + ' left' : 'Settled') + '</span></button>';
      }).join('') + '</div>' : '<p class="muted small" style="text-align:center;margin-top:14px">No splits yet. Paid for dinner with friends? Split it here and track who paid you back.</p>'),
      function (r) {
        r.querySelector('#spNew').onclick = function () { splitSheet({}); };
        r.querySelectorAll('[data-sid]').forEach(function (b) { b.onclick = function () { splitDetail(b.dataset.sid); }; });
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
  var SEC_NAMES = { installments: 'Installments', business: 'Business', komisi: 'Komisi Noah', world: 'Invest to the World', insights: 'Insights', upcoming: 'Upcoming & overdue', goals: 'Goals', bills: 'Bills & subscriptions', allocation: 'Allocation', wallets: 'Wallets', cashflow: 'Cash flow', spending: 'Spending donut', month: 'This month', recent: 'Recent activity' };
  function homeLayout() {
    // Calm default: daily things first, duplicate charts off (turn on in Customize Home).
    var DEF = ['wallets', 'upcoming', 'komisi', 'world', 'business', 'installments', 'insights', 'goals', 'bills', 'cashflow', 'recent', 'allocation', 'spending', 'month'], OFF = { allocation: 1, spending: 1, month: 1 };
    var L = (S.settings.home || []).filter(function (x) { return SEC_NAMES[x.k]; });
    if (S.settings.home && !L.some(function (x) { return x.k === 'world'; })) { var ki = L.map(function (x) { return x.k; }).indexOf('komisi'); L.splice(ki + 1, 0, { k: 'world', on: true }); }
    DEF.concat(Object.keys(SEC_NAMES)).forEach(function (k) { if (SEC_NAMES[k] && !L.some(function (x) { return x.k === k; })) L.push({ k: k, on: !S.settings.home ? !OFF[k] : true }); });
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
  function linkBiz() {
    if (S.bizLinkVer === 1) return;
    var D = { hurricane: ['reserve_transfer', 'komisi_in'], sentaris: ['sentaris'] };
    (S.businesses || []).forEach(function (b) { if (D[b.id] && !b.cats) b.cats = D[b.id]; });
    S.tx.forEach(function (t) { if (!t.biz) { var b = bizForCat(t.cat); if (b) t.biz = b; } });
    S.debts.forEach(function (d) { if (d.earned && !d.biz) { var b = bizForCat(d.incomeCat); if (b) d.biz = b; } });
    S.bizLinkVer = 1;
  }
  function defBiz() { if (S.businesses) return; S.businesses = [{ id: 'hurricane', name: 'HURRICANE', sp: 'bi' }, { id: 'sentaris', name: 'SENTARIS', sp: 'sentaris' }, { id: 'others', name: 'OTHERS', sp: 'other_out' }]; }
  function secIcons() {
    var M = { komisi: 'komisi_out', world: 'giving', business: 'bi', installments: 'my_home', insights: 'investment', upcoming: 'debt_collection', goals: 'bybit', bills: 'streaming', allocation: 'stocks', wallets: 'w_cash', cashflow: 'ajaib_essa', spending: 'shopping', month: 'fun_money', recent: 'uncat' };
    document.querySelectorAll('#homeSecs .sec').forEach(function (sec) { var k = M[sec.dataset.sec], h = sec.querySelector('.section-h > span, .card-h > h2, .card-h2 > h2, .cf-head > h2'); if (k && h && !h.querySelector('.h-3d')) h.insertAdjacentHTML('afterbegin', '<span class="h-3d">' + sprite(k) + '</span>'); });
  }
  load(); fixBilliard(); zeroStart(); ownerWallets(); walletIcons(); defBiz(); linkBiz(); if (!S.inst) S.inst = [{ id: 'rumah', name: 'RUMAH NOAH', sp: 'my_home', total: 0, monthly: 0, dueDay: 1, pays: [] }, { id: 'wedding', name: 'WEDDING AND ENGAGEMENT', sp: 'wedding', total: 0, monthly: 0, dueDay: 1, pays: [] }]; addKomisi(); useGenerated(); postRecurring(); save(); importFromHash(); bind(); bindFeatures(); bindPremium(); renderAll(); applyHome(); secIcons(); setCloudStatus();
  $('hInsights').addEventListener('click', function (e) { if (e.target.closest('[data-wrap]')) { haptic(); openWrapped(new Date()); } });
  setTimeout(mlSeedFromHash, 1500);
  $('mlCode').onclick = function () { haptic(); mlSeedPrompt(); };
  $('mlFile').onchange = function () { var f = this.files[0]; this.value = ''; if (f) mlImportFile(f); };
  hideSplash(); fetchPrices(); renderGold(); fetchGold(); $('goldBar').onclick = function () { haptic(); goldSheet(); }; renderIhsg(); fetchIhsg(); $('ihsgBar').onclick = function () { haptic(); ihsgSheet(); }; renderFx(); fetchFx(); $('fxBar').onclick = function () { haptic(); fxSheet(); }; registerSW(); setTimeout(onboarding, 1300);
  // iOS 26 Home Screen apps: the viewport stops above the home bar, so the bottom inset must not be added twice
  function vpCheck() {
    var sa = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var portrait = window.innerHeight > window.innerWidth;
    var gap = (portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width)) - window.innerHeight;
    document.documentElement.classList.toggle('vp-short', !!sa && gap > 20);
  }
  vpCheck(); window.addEventListener('resize', vpCheck); window.addEventListener('orientationchange', function () { setTimeout(vpCheck, 300); });
  // Native feel: block pinch / double tap zoom (iOS ignores user-scalable=no)
  ['gesturestart','gesturechange','gestureend'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
  document.addEventListener('touchmove', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  // One time hint: Add to Home Screen removes the Safari bars
  (function () {
    var standalone = window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var seen; try { seen = localStorage.getItem('apex_a2hs'); } catch (e) {}
    if (standalone || !ios || seen) return;
    setTimeout(function () {
      var d = document.createElement('div'); d.className = 'a2hs';
      d.innerHTML = '<span style="font-size:22px">\u{1F4F2}</span><span>For the full app feel: tap <b>Share</b> then <b>Add to Home Screen</b>.</span><button class="a2x" aria-label="Close">✕</button>';
      document.body.appendChild(d);
      d.querySelector('.a2x').onclick = function () { try { localStorage.setItem('apex_a2hs', '1'); } catch (e) {} d.remove(); };
    }, 2500);
  })();
  (function () { var c = S.settings.cloud; if (c && c.on) cloudPull(c.id, c.pass).then(function (ch) { if (ch) { applyHome(); toast('Synced from cloud ☁️'); } }).catch(function () {}); })();
  if (S.settings.pinHash) { delete S.settings.pinHash; save(); }
  bindTilt(); bindSpecular(); bindPull(); bindScrub(); window.addEventListener('scroll', onScroll, { passive: true });
  requestAnimationFrame(moveInd);
  if (S.settings.autoSync) sync(false);
})();
