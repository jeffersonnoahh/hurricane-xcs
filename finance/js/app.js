/* Arus Money: personal finance tracker with BCA email auto sync.
   All data lives in this browser (localStorage). BCA emails arrive through the user's own
   Google Apps Script (apps-script/Code.gs); parsing happens here via BcaParser. */
(function () {
  'use strict';

  var KEY = 'arus_v1';
  var $ = function (id) { return document.getElementById(id); };

  // ---------- defaults ----------
  var DEFAULT_CATS = [
    ['food', 'Food & Drink', '🍜', 'expense'], ['transport', 'Transport', '🛵', 'expense'],
    ['shopping', 'Shopping', '🛍️', 'expense'], ['bills', 'Bills & Utilities', '💡', 'expense'],
    ['phone', 'Phone & Internet', '📱', 'expense'], ['health', 'Health', '💊', 'expense'],
    ['fun', 'Entertainment', '🎬', 'expense'], ['family', 'Family', '👨‍👩‍👧', 'expense'],
    ['giving', 'Giving & Tithe', '🙏', 'expense'], ['education', 'Education', '📚', 'expense'],
    ['transfer_out', 'Transfer out', '↗️', 'expense'], ['other_out', 'Other expense', '📦', 'expense'],
    ['salary', 'Salary', '💼', 'income'], ['bonus', 'Bonus', '🎁', 'income'],
    ['transfer_in', 'Transfer in', '↙️', 'income'], ['other_in', 'Other income', '💰', 'income']
  ];
  var DEFAULT_RULES = [
    ['kopi', 'food'], ['coffee', 'food'], ['resto', 'food'], ['mcd', 'food'], ['kfc', 'food'], ['gofood', 'food'], ['grabfood', 'food'], ['shopeefood', 'food'],
    ['gojek', 'transport'], ['grab', 'transport'], ['pertamina', 'transport'], ['shell', 'transport'], ['parkir', 'transport'], ['tol', 'transport'],
    ['tokopedia', 'shopping'], ['shopee', 'shopping'], ['lazada', 'shopping'], ['indomaret', 'shopping'], ['alfamart', 'shopping'],
    ['pln', 'bills'], ['pdam', 'bills'], ['bpjs', 'health'], ['apotek', 'health'], ['telkomsel', 'phone'], ['indihome', 'phone'], ['xl', 'phone'],
    ['netflix', 'fun'], ['spotify', 'fun'], ['gereja', 'giving'], ['church', 'giving'], ['persembahan', 'giving'], ['perpuluhan', 'giving']
  ];

  function blank() {
    return {
      wallets: [{ id: 'bca', name: 'BCA', icon: '🏦', initial: 0 }, { id: 'cash', name: 'Cash', icon: '💵', initial: 0 }],
      cats: DEFAULT_CATS.map(function (c) { return { id: c[0], name: c[1], icon: c[2], type: c[3] }; }),
      tx: [], budgets: {},
      rules: DEFAULT_RULES.map(function (r) { return { kw: r[0], cat: r[1] }; }),
      settings: { syncUrl: '', token: '', autoSync: true, bcaWallet: 'bca', lastSync: 0 },
      seen: {}, review: []
    };
  }

  // ---------- storage ----------
  var S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    var d = blank();
    if (!S || typeof S !== 'object') S = d;
    Object.keys(d).forEach(function (k) { if (S[k] == null) S[k] = d[k]; });
    Object.keys(d.settings).forEach(function (k) { if (S.settings[k] == null) S.settings[k] = d.settings[k]; });
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { toast('Could not save. Storage full or blocked.'); }
  }

  // ---------- helpers ----------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rp(n, signed) {
    var s = 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');
    if (signed && n > 0) return '+' + s;
    if (n < 0) return '−' + s;
    return s;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function ym(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function cat(id) { return S.cats.filter(function (c) { return c.id === id; })[0] || { id: id, name: 'Uncategorized', icon: '❔', type: 'expense' }; }
  function wallet(id) { return S.wallets.filter(function (w) { return w.id === id; })[0] || { id: id, name: '(deleted wallet)', icon: '❔', initial: 0 }; }
  function parseNum(v) { return parseInt(String(v || '').replace(/[^\d]/g, ''), 10) || 0; }

  var toastT;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 2600);
  }

  // ---------- state ----------
  var cur = new Date(); cur.setDate(1);
  var walletSel = 'all';
  var repKind = 'expense';

  function inWallet(t) { return walletSel === 'all' || t.wallet === walletSel || t.toWallet === walletSel; }
  function monthTx() { var m = ym(cur); return S.tx.filter(function (t) { return t.date.slice(0, 7) === m && inWallet(t); }); }

  // Effect of a transaction on one wallet (or on the total when w === 'all').
  function delta(t, w) {
    if (t.type === 'income') return (w === 'all' || t.wallet === w) ? t.amount : 0;
    if (t.type === 'expense') return (w === 'all' || t.wallet === w) ? -t.amount : 0;
    if (t.type === 'transfer') {
      if (w === 'all') return 0;
      return (t.toWallet === w ? t.amount : 0) - (t.wallet === w ? t.amount : 0);
    }
    return 0;
  }
  function balance(w) {
    var init = S.wallets.reduce(function (a, x) { return a + ((w === 'all' || x.id === w) ? (+x.initial || 0) : 0); }, 0);
    return S.tx.reduce(function (a, t) { return a + delta(t, w); }, init);
  }

  // ---------- render ----------
  function renderAll() {
    $('monthLabel').textContent = MONTHS[cur.getMonth()] + ' ' + cur.getFullYear();
    var ws = $('walletFilter');
    ws.innerHTML = '<option value="all">All wallets</option>' + S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.icon + ' ' + w.name) + '</option>'; }).join('');
    if (walletSel !== 'all' && !S.wallets.some(function (w) { return w.id === walletSel; })) walletSel = 'all';
    ws.value = walletSel;
    $('balValue').textContent = rp(balance(walletSel));

    var mt = monthTx(), tin = 0, tout = 0;
    mt.forEach(function (t) {
      if (t.type === 'income') tin += t.amount;
      else if (t.type === 'expense') tout += t.amount;
      else if (walletSel !== 'all') { var d = delta(t, walletSel); if (d > 0) tin += d; else tout -= d; }
    });
    $('sumIn').textContent = rp(tin); $('sumOut').textContent = rp(tout);
    renderSyncLine();
    renderTx(mt); renderReport(mt, tin, tout); renderBudgets(); renderSettings();
  }

  function renderSyncLine() {
    var s = S.settings;
    $('syncLine').textContent = !s.syncUrl ? 'BCA sync not set up yet' : (s.lastSync ? 'BCA synced ' + new Date(s.lastSync).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : 'BCA sync ready');
  }

  function renderTx(mt) {
    if (!mt.length) { $('txList').innerHTML = '<div class="empty">No transactions this month.<br>Tap + to add one, or set up BCA sync in Settings.</div>'; return; }
    var byDay = {};
    mt.forEach(function (t) { (byDay[t.date] = byDay[t.date] || []).push(t); });
    var days = Object.keys(byDay).sort().reverse();
    $('txList').innerHTML = days.map(function (d) {
      var list = byDay[d].sort(function (a, b) { return (b.time || '').localeCompare(a.time || '') || b.created - a.created; });
      var net = list.reduce(function (a, t) { return a + (t.type === 'transfer' ? delta(t, walletSel) : delta(t, 'all')); }, 0);
      var dt = new Date(d + 'T00:00:00');
      return '<div class="day"><div class="day-h"><div><b>' + dt.getDate() + '</b>' + DOW[dt.getDay()] + ', ' + MONTHS[dt.getMonth()].slice(0, 3) + '</div><div>' + rp(net, true) + '</div></div>' +
        list.map(txRow).join('') + '</div>';
    }).join('');
  }

  function txRow(t) {
    var c = t.type === 'transfer' ? { icon: '🔁', name: 'Transfer' } : cat(t.cat);
    var sub = t.type === 'transfer' ? wallet(t.wallet).name + ' → ' + wallet(t.toWallet).name : (t.merchant || t.note || wallet(t.wallet).name);
    if (t.type !== 'transfer' && t.merchant && t.note) sub = t.merchant + ' · ' + t.note;
    var cls = t.type === 'income' ? 'in' : t.type === 'expense' ? 'out' : '';
    var sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
    return '<div class="tx" data-id="' + esc(t.id) + '"><div class="tx-ic">' + esc(c.icon) + '</div><div class="tx-main"><div class="tx-cat">' + esc(c.name) +
      (t.src === 'bca' ? '<span class="badge">BCA</span>' : '') + '</div><div class="tx-note">' + esc((t.time ? t.time + ' · ' : '') + sub) + '</div></div>' +
      '<div class="tx-amt ' + cls + '">' + sign + rp(t.amount) + '</div></div>';
  }

  function renderReport(mt, tin, tout) {
    var net = tin - tout;
    $('repNet').textContent = rp(net, true);
    $('repNet').style.color = net >= 0 ? 'var(--in)' : 'var(--out)';
    var now = new Date(), isCur = ym(now) === ym(cur);
    var daysIn = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    var elapsed = isCur ? now.getDate() : daysIn;
    $('repAvg').textContent = 'Average spend ' + rp(tout / Math.max(1, elapsed)) + ' per day';

    var sums = {}, total = 0;
    mt.forEach(function (t) { if (t.type === repKind) { sums[t.cat] = (sums[t.cat] || 0) + t.amount; total += t.amount; } });
    var rows = Object.keys(sums).sort(function (a, b) { return sums[b] - sums[a]; });
    var max = rows.length ? sums[rows[0]] : 1;
    $('repBars').innerHTML = rows.length ? rows.map(function (id) {
      var c = cat(id), pct = Math.round(sums[id] / total * 100);
      return '<div class="hbar"><div class="hbar-top"><span>' + esc(c.icon + ' ' + c.name) + '</span><span>' + rp(sums[id]) + ' · ' + pct + '%</span></div>' +
        '<div class="hbar-track"><div class="hbar-fill" style="width:' + (sums[id] / max * 100).toFixed(1) + '%"></div></div></div>';
    }).join('') : '<div class="muted">Nothing yet this month.</div>';

    var daily = [];
    for (var i = 1; i <= daysIn; i++) daily.push(0);
    mt.forEach(function (t) { if (t.type === 'expense') daily[+t.date.slice(8, 10) - 1] += t.amount; });
    var dmax = Math.max.apply(null, daily) || 1;
    $('repDaily').innerHTML = '<div class="cols">' + daily.map(function (v, i) {
      return '<div class="col" tabindex="0" data-tip="' + (i + 1) + ' ' + MONTHS[cur.getMonth()].slice(0, 3) + ': ' + rp(v) + '" style="height:' + (v / dmax * 100).toFixed(1) + '%"></div>';
    }).join('') + '</div><div class="col-axis"><span>1</span><span>' + Math.ceil(daysIn / 2) + '</span><span>' + daysIn + '</span></div>';
  }

  function renderBudgets() {
    var m = ym(cur), spent = {};
    S.tx.forEach(function (t) { if (t.type === 'expense' && t.date.slice(0, 7) === m) spent[t.cat] = (spent[t.cat] || 0) + t.amount; });
    $('budgetList').innerHTML = S.cats.filter(function (c) { return c.type === 'expense'; }).map(function (c) {
      var b = +S.budgets[c.id] || 0, s = spent[c.id] || 0, pct = b ? s / b : 0;
      var cls = pct >= 1 ? 'bad' : pct >= 0.8 ? 'warn' : '';
      var right = b ? rp(s) + ' / ' + rp(b) + (pct >= 1 ? ' · over by ' + rp(s - b) : ' · ' + rp(b - s) + ' left') : (s ? rp(s) + ' · no budget' : 'no budget');
      return '<div class="hbar" data-budget="' + esc(c.id) + '" style="cursor:pointer"><div class="hbar-top"><span>' + esc(c.icon + ' ' + c.name) + '</span><span>' + right + '</span></div>' +
        (b ? '<div class="hbar-track"><div class="hbar-fill ' + cls + '" style="width:' + Math.min(100, pct * 100).toFixed(1) + '%"></div></div>' : '') + '</div>';
    }).join('');
  }

  function renderSettings() {
    var s = S.settings;
    if (document.activeElement !== $('sUrl')) $('sUrl').value = s.syncUrl;
    if (document.activeElement !== $('sToken')) $('sToken').value = s.token;
    $('sAuto').checked = !!s.autoSync;
    $('sWallet').innerHTML = S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '">' + esc(w.icon + ' ' + w.name) + '</option>'; }).join('');
    $('sWallet').value = s.bcaWallet;

    $('walletList').innerHTML = S.wallets.map(function (w) {
      return '<div class="list-row"><span>' + esc(w.icon) + '</span><div class="grow"><b>' + esc(w.name) + '</b><div class="muted small">Balance ' + rp(balance(w.id)) + '</div></div>' +
        '<button class="x" data-edit-wallet="' + esc(w.id) + '" aria-label="Edit">✎</button></div>';
    }).join('');
    $('catList').innerHTML = S.cats.map(function (c) {
      return '<div class="list-row"><span>' + esc(c.icon) + '</span><div class="grow">' + esc(c.name) + ' <span class="muted small">' + c.type + '</span></div>' +
        '<button class="x" data-edit-cat="' + esc(c.id) + '" aria-label="Edit">✎</button></div>';
    }).join('');
    $('ruleList').innerHTML = S.rules.length ? S.rules.map(function (r, i) {
      var c = cat(r.cat);
      return '<div class="list-row"><div class="grow">"' + esc(r.kw) + '" → ' + esc(c.icon + ' ' + c.name) + '</div><button class="x" data-del-rule="' + i + '" aria-label="Delete">×</button></div>';
    }).join('') : '<div class="muted small">No rules.</div>';

    $('reviewCard').hidden = !S.review.length;
    $('reviewList').innerHTML = S.review.map(function (r, i) {
      return '<div class="list-row"><div class="grow" data-review="' + i + '" style="cursor:pointer"><b>' + esc(r.subject || '(no subject)') + '</b><div class="muted small">' + esc(new Date(r.date).toLocaleString('id-ID')) + ' · ' + esc((r.snippet || '').slice(0, 90)) + '</div></div>' +
        '<button class="x" data-del-review="' + i + '" aria-label="Dismiss">×</button></div>';
    }).join('');
  }

  // ---------- sheet (bottom modal) ----------
  function openSheet(html, onMount) {
    $('sheetBody').innerHTML = html; $('sheet').hidden = false; $('sheetBg').hidden = false;
    if (onMount) onMount($('sheetBody'));
  }
  function closeSheet() { $('sheet').hidden = true; $('sheetBg').hidden = true; $('sheetBody').innerHTML = ''; }

  function txSheet(t, prefill) {
    var isNew = !t;
    t = t || Object.assign({ id: uid(), type: 'expense', amount: 0, cat: 'food', wallet: S.wallets[0] ? S.wallets[0].id : '', toWallet: '', date: ymd(new Date()), time: hm(new Date()), note: '', merchant: '', src: 'manual', created: Date.now() }, prefill || {});
    var st = { type: t.type, cat: t.cat };
    var wOpts = function (sel) { return S.wallets.map(function (w) { return '<option value="' + esc(w.id) + '"' + (w.id === sel ? ' selected' : '') + '>' + esc(w.icon + ' ' + w.name) + '</option>'; }).join(''); };

    openSheet(
      '<div class="seg type-seg" id="fType"><button data-t="expense">Expense</button><button data-t="income">Income</button><button data-t="transfer">Transfer</button></div>' +
      '<input class="amt-input" id="fAmt" inputmode="numeric" placeholder="0" value="' + (t.amount ? t.amount.toLocaleString('id-ID') : '') + '">' +
      '<div id="fCatWrap"><label>Category</label><div class="cat-grid" id="fCats"></div></div>' +
      '<label id="fWalletL">Wallet<select id="fWallet">' + wOpts(t.wallet) + '</select></label>' +
      '<label id="fToL">To wallet<select id="fTo">' + wOpts(t.toWallet || (S.wallets[1] && S.wallets[1].id)) + '</select></label>' +
      '<div class="btn-row" style="gap:8px"><label style="flex:1">Date<input id="fDate" type="date" value="' + esc(t.date) + '"></label><label style="width:110px">Time<input id="fTime" type="time" value="' + esc(t.time || '') + '"></label></div>' +
      '<label>Merchant / person<input id="fMerch" value="' + esc(t.merchant || '') + '"></label>' +
      '<label>Note<input id="fNote" value="' + esc(t.note || '') + '"></label>' +
      (t.src === 'bca' ? '<p class="muted small">Imported from a BCA email' + (t.ref ? ' · ref ' + esc(t.ref) : '') + '.</p>' : '') +
      (t.src === 'bca' && !isNew ? '<label class="row"><input type="checkbox" id="fRemember" checked> Always use this category for "' + esc(t.merchant || '') + '"</label>' : '') +
      '<button class="btn primary block" id="fSave">Save</button>' +
      (isNew ? '' : '<button class="btn danger block" id="fDel">Delete</button>'),
      function (root) {
        var amt = root.querySelector('#fAmt');
        amt.addEventListener('input', function () { var n = parseNum(amt.value); amt.value = n ? n.toLocaleString('id-ID') : ''; });
        function paint() {
          root.querySelectorAll('#fType button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === st.type); });
          root.querySelector('#fCatWrap').hidden = st.type === 'transfer';
          root.querySelector('#fToL').hidden = st.type !== 'transfer';
          root.querySelector('#fWalletL').firstChild.textContent = st.type === 'transfer' ? 'From wallet' : 'Wallet';
          var cats = S.cats.filter(function (c) { return c.type === st.type; });
          if (st.type !== 'transfer' && !cats.some(function (c) { return c.id === st.cat; })) st.cat = cats[0] ? cats[0].id : '';
          root.querySelector('#fCats').innerHTML = cats.map(function (c) {
            return '<button data-c="' + esc(c.id) + '" class="' + (c.id === st.cat ? 'on' : '') + '"><span>' + esc(c.icon) + '</span>' + esc(c.name) + '</button>';
          }).join('');
        }
        root.querySelector('#fType').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st.type = b.dataset.t; paint(); } });
        root.querySelector('#fCats').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { st.cat = b.dataset.c; paint(); } });
        paint();
        if (isNew) setTimeout(function () { amt.focus(); }, 50);

        root.querySelector('#fSave').onclick = function () {
          var a = parseNum(amt.value);
          if (!a) { toast('Enter an amount'); return; }
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
          save(); closeSheet(); renderAll(); toast(isNew ? 'Added' : 'Saved');
        };
        var del = root.querySelector('#fDel');
        if (del) del.onclick = function () {
          if (!confirm('Delete this transaction?')) return;
          S.tx = S.tx.filter(function (x) { return x.id !== t.id; });
          save(); closeSheet(); renderAll(); toast('Deleted');
        };
      });
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
    if (type === 'income') return S.cats.some(function (c) { return c.id === 'transfer_in'; }) ? 'transfer_in' : (S.cats.filter(function (c) { return c.type === 'income'; })[0] || {}).id;
    return S.cats.some(function (c) { return c.id === 'other_out'; }) ? 'other_out' : (S.cats.filter(function (c) { return c.type === 'expense'; })[0] || {}).id;
  }

  // ---------- BCA sync ----------
  var syncing = false;
  function sync(manual) {
    var s = S.settings;
    if (!s.syncUrl || !s.token) { if (manual) toast('Add the Apps Script URL and secret first'); return Promise.resolve(); }
    if (syncing) return Promise.resolve();
    syncing = true;
    $('sStatus').textContent = 'Syncing…';
    // Look back 2 days before the last sync so late arriving emails are not missed; seen ids stop duplicates.
    var since = s.lastSync ? s.lastSync - 2 * 864e5 : Date.now() - 7 * 864e5;
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
        $('sStatus').textContent = msg + ' (' + emails.length + ' emails checked)';
        if (manual || added || review) toast(msg);
      })
      .catch(function (e) {
        $('sStatus').textContent = 'Sync failed: ' + (e.name === 'AbortError' ? 'timed out' : e.message);
        if (manual) toast('Sync failed. Check URL and secret.');
      })
      .then(function () { clearTimeout(timer); syncing = false; });
  }
  function pruneSeen() {
    var cut = Date.now() - 120 * 864e5;
    Object.keys(S.seen).forEach(function (k) { if (S.seen[k] < cut) delete S.seen[k]; });
  }

  // ---------- small edit sheets ----------
  function walletSheet(w) {
    var isNew = !w; w = w || { id: uid(), name: '', icon: '👛', initial: 0 };
    openSheet('<h3>' + (isNew ? 'New wallet' : 'Edit wallet') + '</h3>' +
      '<label>Name<input id="wName" value="' + esc(w.name) + '"></label>' +
      '<label>Icon (emoji)<input id="wIcon" value="' + esc(w.icon) + '"></label>' +
      '<label>Starting balance<input id="wInit" inputmode="numeric" value="' + (w.initial ? (+w.initial).toLocaleString('id-ID') : '') + '"></label>' +
      '<p class="muted small">Tip: set the starting balance to what myBCA shows today, then let sync handle the rest.</p>' +
      '<button class="btn primary block" id="wSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="wDel">Delete wallet</button>'),
      function (r) {
        r.querySelector('#wSave').onclick = function () {
          var n = r.querySelector('#wName').value.trim(); if (!n) { toast('Name it'); return; }
          w.name = n; w.icon = r.querySelector('#wIcon').value.trim() || '👛'; w.initial = parseNum(r.querySelector('#wInit').value);
          if (isNew) S.wallets.push(w); save(); closeSheet(); renderAll();
        };
        var d = r.querySelector('#wDel');
        if (d) d.onclick = function () {
          var used = S.tx.some(function (t) { return t.wallet === w.id || t.toWallet === w.id; });
          if (used) { toast('This wallet has transactions. Move or delete them first.'); return; }
          if (S.wallets.length < 2) { toast('Keep at least one wallet'); return; }
          S.wallets = S.wallets.filter(function (x) { return x.id !== w.id; }); save(); closeSheet(); renderAll();
        };
      });
  }

  function catSheet(c) {
    var isNew = !c; c = c || { id: uid(), name: '', icon: '🏷️', type: 'expense' };
    openSheet('<h3>' + (isNew ? 'New category' : 'Edit category') + '</h3>' +
      '<label>Name<input id="cName" value="' + esc(c.name) + '"></label>' +
      '<label>Icon (emoji)<input id="cIcon" value="' + esc(c.icon) + '"></label>' +
      '<label>Type<select id="cType"><option value="expense">Expense</option><option value="income">Income</option></select></label>' +
      '<button class="btn primary block" id="cSave">Save</button>' + (isNew ? '' : '<button class="btn danger block" id="cDel">Delete category</button>'),
      function (r) {
        r.querySelector('#cType').value = c.type;
        r.querySelector('#cType').disabled = !isNew;
        r.querySelector('#cSave').onclick = function () {
          var n = r.querySelector('#cName').value.trim(); if (!n) { toast('Name it'); return; }
          c.name = n; c.icon = r.querySelector('#cIcon').value.trim() || '🏷️'; c.type = r.querySelector('#cType').value;
          if (isNew) S.cats.push(c); save(); closeSheet(); renderAll();
        };
        var d = r.querySelector('#cDel');
        if (d) d.onclick = function () {
          if (S.tx.some(function (t) { return t.cat === c.id; })) { toast('Category is in use. Recategorize those transactions first.'); return; }
          S.cats = S.cats.filter(function (x) { return x.id !== c.id; });
          S.rules = S.rules.filter(function (x) { return x.cat !== c.id; });
          delete S.budgets[c.id]; save(); closeSheet(); renderAll();
        };
      });
  }

  function ruleSheet() {
    openSheet('<h3>New rule</h3><label>If merchant contains<input id="rKw" placeholder="e.g. indomaret"></label>' +
      '<label>Use category<select id="rCat">' + S.cats.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.icon + ' ' + c.name) + '</option>'; }).join('') + '</select></label>' +
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
    openSheet('<h3>' + esc(c.icon + ' ' + c.name) + ' budget</h3><label>Monthly limit<input id="bAmt" inputmode="numeric" value="' + (S.budgets[catId] ? (+S.budgets[catId]).toLocaleString('id-ID') : '') + '" placeholder="0 = no budget"></label>' +
      '<button class="btn primary block" id="bSave">Save</button>',
      function (r) {
        var i = r.querySelector('#bAmt');
        i.addEventListener('input', function () { var n = parseNum(i.value); i.value = n ? n.toLocaleString('id-ID') : ''; });
        setTimeout(function () { i.focus(); }, 50);
        r.querySelector('#bSave').onclick = function () {
          var n = parseNum(i.value); if (n) S.budgets[catId] = n; else delete S.budgets[catId];
          save(); closeSheet(); renderAll();
        };
      });
  }

  // ---------- events ----------
  function bind() {
    $('prevMonth').onclick = function () { cur.setMonth(cur.getMonth() - 1); renderAll(); };
    $('nextMonth').onclick = function () { cur.setMonth(cur.getMonth() + 1); renderAll(); };
    $('walletFilter').onchange = function () { walletSel = this.value; renderAll(); };
    $('fab').onclick = function () { txSheet(null, walletSel !== 'all' ? { wallet: walletSel } : null); };
    $('sheetBg').onclick = closeSheet;
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

    document.querySelectorAll('.bottom-nav button').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.bottom-nav button').forEach(function (x) { x.classList.toggle('on', x === b); });
        document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === b.dataset.v); });
        $('fab').hidden = b.dataset.v === 'v-settings';
        window.scrollTo(0, 0);
      };
    });

    $('txList').onclick = function (e) {
      var row = e.target.closest('.tx'); if (!row) return;
      var t = S.tx.filter(function (x) { return x.id === row.dataset.id; })[0];
      if (t) txSheet(t);
    };
    $('repSeg').onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      repKind = b.dataset.k;
      this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      renderAll();
    };
    function showTip(e) {
      var col = e.target.closest('.col'); document.querySelectorAll('.tip').forEach(function (t) { t.remove(); });
      if (!col) return;
      var tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = col.dataset.tip; col.appendChild(tip);
    }
    $('repDaily').addEventListener('mouseover', showTip);
    $('repDaily').addEventListener('focusin', showTip);
    $('repDaily').addEventListener('click', showTip);
    $('repDaily').addEventListener('mouseleave', function () { document.querySelectorAll('.tip').forEach(function (t) { t.remove(); }); });
    $('budgetList').onclick = function (e) { var r = e.target.closest('[data-budget]'); if (r) budgetSheet(r.dataset.budget); };

    $('sSave').onclick = function () {
      var url = $('sUrl').value.trim();
      if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('That does not look like an Apps Script web app URL'); return; }
      S.settings.syncUrl = url; S.settings.token = $('sToken').value.trim();
      S.settings.autoSync = $('sAuto').checked; S.settings.bcaWallet = $('sWallet').value;
      save(); renderAll(); toast('Saved');
    };
    $('sSync').onclick = function () { $('sSave').onclick(); sync(true); };

    $('tRun').onclick = function () {
      var raw = $('tInput').value, nl = raw.indexOf('\n');
      var em = { subject: nl === -1 ? raw : raw.slice(0, nl), body: nl === -1 ? '' : raw.slice(nl + 1) };
      var p = window.BcaParser.parseBcaEmail(em);
      $('tOut').textContent = p ? (p.type === 'income' ? 'Income  ' : 'Expense  ') + rp(p.amount) + '\nMerchant: ' + p.merchant + '\nCategory: ' + cat(guessCat(p.merchant, p.type)).name + (p.ref ? '\nRef: ' + p.ref : '')
        : 'Not recognised as a transaction. Send this sample to your developer so the reader can learn it.';
    };

    $('addWallet').onclick = function () { walletSheet(); };
    $('addCat').onclick = function () { catSheet(); };
    $('addRule').onclick = ruleSheet;
    $('v-settings').addEventListener('click', function (e) {
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
        renderSettings();
      }
    });

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

  load(); bind(); renderAll();
  if (S.settings.autoSync) sync(false);
})();
