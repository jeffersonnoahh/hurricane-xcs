/* ══════════════════════════════════════════════════════════════════════
   FORM CLOSING (js/closing.js) — satu titik input closing untuk sales.
   Dibuka dari tombol "+ SALE" / "Log a sale" (menggantikan Log Entry lama)
   untuk sales yang ikut uji coba, atau untuk semua bila mode = 'all'.

   Isian per closing:
     Sales (diingat per HP; "Ganti" untuk leader yang input atas nama tim)
     Tanggal (Hari ini / Kemarin / tanggal lain s.d. 7 hari ke belakang)
     Nama customer (wajib) + 4 digit terakhir WA (wajib)
     Ada test? → Produk yang di-test (≥1)  |  Langsung order (tanpa test)
     Produk closing (≥1; hanya dari produk yang di-test, + "produk tambahan
       (tanpa test)" untuk yang ikut dibeli tanpa dicoba) + jumlah + harga
     SPV: Tanpa SPV | Ada SPV → pilih 1 nama (wajib bila Ada SPV)
     Opsional: Repeat order, Upsell

   DATA — tetap baris scores/{tanggal} biasa (1 baris per produk), jadi
   omzet, ranking, rekor, Command Center tidak berubah. Field baru di tiap baris:
     orderId, customer, wa4, custKey, tested[], addon(bool), spv ('Tanpa SPV'
     atau nama), test ('ya'|'tidak'), inputBy, src:'closing'
   saleType dihitung otomatis: testdrive (ada test) / complete (= "Langsung
   order"), + cross (2+ keluarga produk), + repeat / upsell bila dicentang.
   Semua baris satu closing ditulis dalam SATU transaction (atomic, tidak
   pernah menimpa hari itu; idempoten per orderId → ketuk dua kali aman).

   CONFIG — config/closing = {mode:'off'|'pilot'|'all', pilot:[nama],
   spv:[nama], pinHash:'sha256'} — HANYA ditulis lewat .update() dari Admin.

   EXPORT — Excel (.xlsx, 2 sheet) atau CSV (pemisah ';' untuk Excel
   Indonesia). Untuk leader lewat PIN (hash SHA-256 di config), admin langsung.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__hxClosing) return;
  window.__hxClosing = true;

  var D = document, R = D.documentElement, W = window;
  var ME_KEY = 'hx-closing-me', PIN_KEY = 'hx-closing-pin', LEAD = '@leader';
  var DEF_SPV = ['Devin', 'Agunk', 'Dimas', 'Willy', 'Roma', 'Purwandi', 'Eko', 'Harris'];
  var TANPA = 'Tanpa SPV';
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var CFG = { mode: 'pilot', pilot: [], spv: DEF_SPV.slice(), pinHash: '' };

  /* ── utilitas ───────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function rp(n) { try { return fFull(Math.round(n)); } catch (e) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); } }
  function rpShort(n) { try { return 'Rp ' + fRp(Math.round(n)); } catch (e) { return rp(n); } }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function toast(msg, kind) { try { showToast(msg, kind || 'info'); } catch (e) { } }
  function data() { try { return allData || {}; } catch (e) { return {}; } }
  function rows(k) { var v = data()[k]; return Array.isArray(v) ? v.filter(Boolean) : v && typeof v === 'object' ? Object.keys(v).map(function (x) { return v[x]; }).filter(Boolean) : []; }
  function dkey(d) { try { return dk(d); } catch (e) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); } }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dLabel(k) { var p = k.split('-'); return (+p[2]) + ' ' + BLN[+p[1] - 1] + ' ' + p[0]; }
  function hm(ts) { var d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function fam(p) { p = String(p || ''); return /XCSR/i.test(p) ? 'XCSR' : /SPRING\s*BUFFER/i.test(p) ? 'SBF' : 'XCS'; }
  function prices() { try { return P || {}; } catch (e) { return {}; } }
  function roster() { try { return TM || {}; } catch (e) { return {}; } }
  function titleCase(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().split(' ').map(function (w) {
      return w && w === w.toLowerCase() ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(' ');
  }
  function uid() { var c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
  async function sha256(s) {
    var b = new TextEncoder().encode(s), h = await crypto.subtle.digest('SHA-256', b);
    return Array.prototype.map.call(new Uint8Array(h), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  function isAdmin() { try { return !!adminUnlocked; } catch (e) { return false; } }
  function dbRef(p) { return W.db && W.db.ref ? W.db.ref(p) : null; }

  /* ── siapa (diingat per HP) & apakah form baru aktif ─────────────── */
  function me() {
    var v = store(ME_KEY); if (!v) return null; var p = v.split('|');
    if (p[0] === LEAD) return { leader: true, sp: '', team: p[1] || '' };      // HP leader: input untuk anggota timnya
    return { sp: p[0], team: p[1] || teamOf(p[0]) };
  }
  function setMe(sp, team) { store(ME_KEY, sp + '|' + (team || teamOf(sp) || '')); }
  function setMeLeader(team) { store(ME_KEY, LEAD + '|' + team); }
  function ownerLabel(o) { return !o ? '' : o.leader ? 'Leader ' + o.team : o.sp; }
  // channel marketplace (Tokopedia/Shopee/TikTok…) tidak punya WA customer → 4 digit WA opsional
  function isCh(sp) { try { return !!(W.HX && HX.isChannel && HX.isChannel(sp)); } catch (e) { return false; } }
  function teamOf(sp) {
    var T = roster(), n = norm(sp);
    for (var t in T) { var m = (T[t] && T[t].m) || []; for (var i = 0; i < m.length; i++) if (norm(m[i]) === n) return t; }
    return '';
  }
  // nama & tim persis seperti di roster live; null kalau nama sudah tidak ada di roster
  function canon(sp, team) {
    var T = roster(), n = norm(sp), t = team && T[team] ? team : teamOf(sp);
    var m = (t && T[t] && T[t].m) || [];
    for (var i = 0; i < m.length; i++) if (norm(m[i]) === n) return { sp: m[i], team: t };
    if (team && T[team]) { var t2 = teamOf(sp); if (t2 && t2 !== team) return canon(sp, t2); }
    return null;
  }
  // pemilik HP yang diingat, dicocokkan ulang ke roster (nama diganti / pindah tim / keluar)
  function meLive() {
    var m = me(); if (!m) return null;
    if (!W._cfgTeamsLoaded) return m;                 // roster live belum dimuat: jangan ubah apa-apa dulu
    if (m.leader) { if (roster()[m.team]) return m; store(ME_KEY, null); return null; }
    var c = canon(m.sp, m.team);
    if (!c) { store(ME_KEY, null); return null; }     // sudah tidak di roster → pilih ulang
    if (c.sp !== m.sp || c.team !== m.team) setMe(c.sp, c.team);
    return c;
  }
  function inPilot(sp) { return (CFG.pilot || []).some(function (x) { return norm(x) === norm(sp); }); }
  function enabledFor(sp) { return CFG.mode === 'all' || (CFG.mode === 'pilot' && !!sp && inPilot(sp)); }
  function anyEnabled() { return CFG.mode === 'all' || (CFG.mode === 'pilot' && (CFG.pilot || []).length > 0); }

  /* ── config ─────────────────────────────────────────────────────── */
  function applyCfg(c) {
    c = c || {};
    CFG.mode = c.mode === 'all' || c.mode === 'off' || c.mode === 'pilot' ? c.mode : 'pilot';
    CFG.pilot = Array.isArray(c.pilot) ? c.pilot.filter(Boolean) : [];
    CFG.spv = Array.isArray(c.spv) && c.spv.filter(Boolean).length ? c.spv.filter(Boolean) : DEF_SPV.slice();
    CFG.pinHash = typeof c.pinHash === 'string' ? c.pinHash : '';
    paintLegacyBanner();
    if (adminBox) paintAdmin();
  }
  function watchOnline(n) {
    n = n || 0;
    try {
      if (W.firebase && firebase.apps && firebase.apps.length) {
        // langsung ke SDK (bukan W.db.ref): pembungkus namespace Maria/Calvin akan merusak path .info
        firebase.database().ref('.info/connected').on('value', function (s) { online = !!s.val(); });
        return;
      }
    } catch (e) { }
    if (n < 120) setTimeout(function () { watchOnline(n + 1); }, 1000);
  }
  function watchCfg() {
    var r = dbRef('config/closing');
    if (!r || !r.on) return setTimeout(watchCfg, 800);
    r.on('value', function (snap) { applyCfg(snap.val()); });
  }

  /* ── draft: isian yang belum disimpan tidak hilang kalau form tertutup tak sengaja
        (ketuk area gelap, Back, Esc) atau Safari memuat ulang tab saat pindah ke WhatsApp ── */
  var DRAFT_KEY = 'hx-closing-draft', DRAFT_MAX = 30 * 60e3, draftT = null;
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function dirty(x) {
    return !!(x && (x.customer || x.wa4 || x.test || (x.tested && x.tested.length) ||
      Object.keys(x.lines || {}).some(function (k) { return x.lines[k].on; }) || Object.keys(x.addons || {}).some(function (k) { return x.addons[k].on; })));
  }
  function saveDraft() {
    if (!S || S.picking) return;
    if (!dirty(S)) { if (S.touched || S.restored) ss(DRAFT_KEY, null); return; }   // form baru yang belum diisi tidak menghapus draft lain
    S.touched = true;
    var d = JSON.parse(JSON.stringify(S)); d.saving = false; d.slow = false; d.err = {}; d.picking = false; d.restored = false; d.at = Date.now();
    ss(DRAFT_KEY, JSON.stringify(d));
  }
  function draftSoon() { clearTimeout(draftT); draftT = setTimeout(saveDraft, 250); }
  function loadDraft() {
    var v = ss(DRAFT_KEY); if (!v) return null;
    try { var d = JSON.parse(v); if (d && d.at && Date.now() - d.at < DRAFT_MAX && dirty(d)) return d; } catch (e) { }
    ss(DRAFT_KEY, null); return null;
  }
  function dropDraft(orderId) {
    clearTimeout(draftT);
    var d = loadDraft(); if (!d || !orderId || d.orderId === orderId) ss(DRAFT_KEY, null);
  }

  /* ══ FORM ══════════════════════════════════════════════════════════ */
  var S = null;           // status form yang terbuka
  var sheet = null, overlay = null, histTok = null, popSkip = 0, overlayAdded = false;
  var confirmOpen = false, bypassOnce = false, expShut = null, online = null, spTouched = false, pendingIds = {};
  function freshState(sp, team) {
    return {
      sp: sp || '', team: team || teamOf(sp), date: dkey(new Date()), dateMode: 'today',
      customer: '', wa4: '', test: null, tested: [], lines: {}, addons: {}, showAddon: false,
      spvMode: TANPA, spv: '', repeat: false, upsell: false, picking: !sp, err: {}, saving: false,
      orderId: null
    };
  }
  function lineOf(prod, addon) {
    var bag = addon ? S.addons : S.lines;
    if (!bag[prod]) bag[prod] = { prod: prod, qty: 1, custom: false, price: prices()[prod] || 0 };
    return bag[prod];
  }
  function chosen() {   // baris closing yang dipilih
    var out = [];
    Object.keys(S.lines).forEach(function (p) { if (S.lines[p].on) out.push({ prod: p, addon: false, l: S.lines[p] }); });
    Object.keys(S.addons).forEach(function (p) { if (S.addons[p].on) out.push({ prod: p, addon: true, l: S.addons[p] }); });
    return out;
  }
  function linePrice(l) { return l.custom ? (+l.price || 0) : (prices()[l.prod] || 0); }
  function total() { return chosen().reduce(function (s, c) { return s + linePrice(c.l) * (c.l.qty || 1); }, 0); }

  // produk urut per keluarga; yang paling sering dijual sales ini lebih dulu
  function productGroups() {
    var cnt = {}, ks = Object.keys(data());
    if (S && S.sp) ks.forEach(function (k) { rows(k).forEach(function (e) { if (e.sp === S.sp && e.prod) cnt[e.prod] = (cnt[e.prod] || 0) + 1; }); });
    var names = Object.keys(prices()), G = { XCS: [], SBF: [], XCSR: [] };
    names.forEach(function (p, i) { G[fam(p)].push({ p: p, i: i, c: cnt[p] || 0 }); });
    Object.keys(G).forEach(function (f) { G[f].sort(function (a, b) { return b.c - a.c || a.i - b.i; }); G[f] = G[f].map(function (x) { return x.p; }); });
    var order = ['XCS', 'SBF', 'XCSR'].map(function (f) { return { f: f, n: G[f].reduce(function (s, p) { return s + (cnt[p] || 0); }, 0) }; })
      .sort(function (a, b) { return b.n - a.n; }).map(function (x) { return x.f; });
    return order.filter(function (f) { return G[f].length; }).map(function (f) { return { fam: f, items: G[f] }; });
  }
  var FAM_LABEL = { XCS: 'XCS (mobil)', SBF: 'Spring Buffer', XCSR: 'XCSR (motor)' };

  function chips(items, isOn, act, extra) {
    return items.map(function (p) {
      return '<button type="button" class="hxk-chip' + (isOn(p) ? ' on' : '') + '" data-act="' + act + '" data-v="' + esc(p) + '">' + esc(p) + (extra ? extra(p) : '') + '</button>';
    }).join('');
  }
  function grouped(isOn, act) {
    return productGroups().map(function (g) {
      return '<div class="hxk-fam"><div class="hxk-famlbl">' + FAM_LABEL[g.fam] + '</div><div class="hxk-chips">' + chips(g.items, isOn, act) + '</div></div>';
    }).join('');
  }
  function warnText(l) {
    var base = prices()[l.prod] || 0, pr = linePrice(l);
    return l.custom && pr && base && (pr < base * 0.7 || pr > base * 1.1) ? (pr < base ? 'Di bawah 70%' : 'Di atas 110%') + ' harga katalog (' + rp(base) + ') — pastikan sudah disetujui leader.' : '';
  }
  function lineRow(c) {
    var l = c.l, base = prices()[c.prod] || 0, w = warnText(l);
    return '<div class="hxk-line" data-p="' + esc(c.prod) + '" data-addon="' + (c.addon ? 1 : 0) + '">' +
      '<div class="hxk-line-top"><div class="hxk-line-name">' + esc(c.prod) + (c.addon ? ' <em>tambahan</em>' : '') + '</div>' +
      '<div class="hxk-qty"><button type="button" data-act="qty" data-d="-1" aria-label="Kurangi">−</button><b>' + (l.qty || 1) + '</b><button type="button" data-act="qty" data-d="1" aria-label="Tambah">+</button></div></div>' +
      '<div class="hxk-line-bot"><span class="hxk-price">' + (l.custom ? 'Harga custom' : rp(base)) + '</span>' +
      '<label class="hxk-sw"><input type="checkbox" data-act="custom"' + (l.custom ? ' checked' : '') + '> Harga beda?</label></div>' +
      (l.custom ? '<div class="hxk-custom"><span>Rp</span><input type="text" inputmode="numeric" data-act="price" value="' + (l.price ? Math.round(l.price) : '') + '" placeholder="' + Math.round(base) + '"></div>' +
        (w ? '<div class="hxk-warn">' + esc(w) + '</div>' : '') : '') +
      '</div>';
  }
  function errMsg(k) { return S.err[k] ? '<div class="hxk-err">' + esc(S.err[k]) + '</div>' : ''; }

  function html() {
    var pick = S.picking, T = roster();
    var h = '<div class="hxk-head"><div><div class="hxk-kick">FORM CLOSING</div><h3>Closing baru</h3></div>' +
      '<button type="button" class="hxk-x" data-act="close" aria-label="Tutup">×</button></div>';
    if (S.restored && !pick) h += '<div class="hxk-restored"><span>' + (S.orderId ? 'Closing ini mungkin belum tersimpan (sinyal putus). Cek isinya lalu Simpan — tidak akan dobel.' : 'Isian terakhir yang belum disimpan dikembalikan.') + '</span>' +
      '<button type="button" class="hxk-link" data-act="fresh">Mulai baru</button></div>';
    // sales
    if (pick) {
      var own = me();
      h += own
        ? '<div class="hxk-sec"><div class="hxk-lbl">Closing ini untuk sales siapa?</div><div class="hxk-sub">HP ini tercatat sebagai <b>' + esc(ownerLabel(own)) + '</b> (yang input).</div>'
        : '<div class="hxk-sec"><div class="hxk-lbl">Kamu siapa?</div><div class="hxk-sub">Dipilih sekali, nanti diingat di HP ini. Leader: pilih "Leader …" di bawah.</div>';
      var teams = Object.keys(T);
      if (own && own.leader && T[own.team]) teams = [own.team].concat(teams.filter(function (t) { return t !== own.team; }));
      teams.forEach(function (t) {
        var m = ((T[t] && T[t].m) || []).filter(function (n) {
          var lead = false; try { lead = _isLeader(n); } catch (e) { }   // team lead yang tidak berjualan (app.js)
          return !lead && (CFG.mode === 'all' || inPilot(n) || isAdmin());
        });
        if (!m.length) return;
        h += '<div class="hxk-famlbl">' + esc(t) + '</div><div class="hxk-chips">' + m.map(function (n) {
          return '<button type="button" class="hxk-chip' + (n === S.sp ? ' on' : '') + '" data-act="me" data-v="' + esc(n) + '" data-t="' + esc(t) + '">' + esc(n) + '</button>';
        }).join('') + '</div>';
      });
      if (CFG.mode === 'pilot' && !isAdmin()) h += '<div class="hxk-sub" style="margin-top:10px">Form baru sedang diuji coba oleh beberapa sales. Yang lain tetap memakai form lama.</div>';
      if (!own && (CFG.mode === 'all' || isAdmin())) {
        h += '<div class="hxk-famlbl hxk-leadlbl">Leader (mencatat closing anggota tim)</div><div class="hxk-chips">' + Object.keys(T).map(function (t) {
          return '<button type="button" class="hxk-chip hxk-lead" data-act="meleader" data-t="' + esc(t) + '">Leader ' + esc(t) + '</button>';
        }).join('') + '</div>';
      }
      if (own) h += '<button type="button" class="hxk-link" data-act="resetme" style="margin-top:8px">Bukan ' + esc(ownerLabel(own)) + '? Ganti nama HP ini</button>';
      if (CFG.mode === 'pilot') h += '<button type="button" class="hxk-link hxk-oldform" data-act="oldform">Nama tidak ada? Pakai form lama</button>';
      return h + '</div>';
    }
    var owner = me();
    h += '<div class="hxk-sec hxk-row"><div><div class="hxk-lbl">Sales</div><div class="hxk-me"><b>' + esc(S.sp) + '</b> · ' + esc(S.team || '—') + '</div>' +
      (owner && (owner.leader || norm(owner.sp) !== norm(S.sp)) ? '<div class="hxk-sub">Diinput oleh ' + esc(ownerLabel(owner)) + '</div>' : '') + errMsg('sales') + '</div>' +
      '<button type="button" class="hxk-link" data-act="pickme">Ganti</button></div>';
    // tanggal
    var today = dkey(new Date()), kemarin = dkey(addDays(new Date(), -1)), minD = dkey(addDays(new Date(), -7));
    h += '<div class="hxk-sec"><div class="hxk-lbl">Tanggal closing</div><div class="hxk-seg">' +
      '<button type="button" data-act="date" data-v="today" class="' + (S.dateMode === 'today' ? 'on' : '') + '">Hari ini</button>' +
      '<button type="button" data-act="date" data-v="kemarin" class="' + (S.dateMode === 'kemarin' ? 'on' : '') + '">Kemarin</button>' +
      '<button type="button" data-act="date" data-v="other" class="' + (S.dateMode === 'other' ? 'on' : '') + '">Lainnya</button></div>' +
      (S.dateMode === 'other' ? '<input type="date" class="hxk-in hxk-date" data-act="dateval" min="' + minD + '" max="' + today + '" value="' + S.date + '">' : '') +
      '<div class="hxk-sub">' + dLabel(S.date) + (S.date === today ? ' (hari ini)' : S.date === kemarin ? ' (kemarin)' : '') + '</div>' + errMsg('date') + '</div>';
    // customer
    h += '<div class="hxk-sec"><div class="hxk-grid2"><div><div class="hxk-lbl">Nama customer</div>' +
      '<input type="text" class="hxk-in" data-act="cust" autocomplete="off" autocapitalize="words" placeholder="Nama lengkap" value="' + esc(S.customer) + '">' + errMsg('customer') + '</div>' +
      '<div><div class="hxk-lbl">4 digit WA' + (isCh(S.sp) ? ' <span class="hxk-optl">opsional</span>' : '') + '</div><input type="text" class="hxk-in hxk-wa" data-act="wa" inputmode="numeric" maxlength="4" placeholder="' + (isCh(S.sp) ? '-' : '1234') + '" value="' + esc(S.wa4) + '">' + errMsg('wa4') + '</div></div></div>';
    // test
    h += '<div class="hxk-sec"><div class="hxk-lbl">Ada produk yang di-test?</div><div class="hxk-seg">' +
      '<button type="button" data-act="test" data-v="ya" class="' + (S.test === 'ya' ? 'on' : '') + '">Ada test</button>' +
      '<button type="button" data-act="test" data-v="tidak" class="' + (S.test === 'tidak' ? 'on' : '') + '">Langsung order</button></div>' + errMsg('test');
    if (S.test === 'ya') {
      h += '<div class="hxk-lbl hxk-lbl2">Produk yang di-test</div>' + grouped(function (p) { return S.tested.indexOf(p) >= 0; }, 'tested') + errMsg('tested');
    }
    h += '</div>';
    // closing
    if (S.test) {
      h += '<div class="hxk-sec"><div class="hxk-lbl">Produk yang closing</div>';
      if (S.test === 'ya') {
        if (!S.tested.length) h += '<div class="hxk-sub">Pilih dulu produk yang di-test di atas.</div>';
        else h += '<div class="hxk-chips">' + chips(S.tested, function (p) { return !!(S.lines[p] && S.lines[p].on); }, 'line') + '</div>';
        h += '<button type="button" class="hxk-link hxk-addon-btn" data-act="addon-toggle">' + (S.showAddon ? '− Sembunyikan produk tambahan' : '+ Produk tambahan (tanpa test)') + '</button>';
        if (S.showAddon) {
          h += '<div class="hxk-sub">Produk yang ikut dibeli tapi tidak dicoba.</div>' +
            grouped(function (p) { return !!(S.addons[p] && S.addons[p].on); }, 'addon');
        }
      } else {
        h += grouped(function (p) { return !!(S.lines[p] && S.lines[p].on); }, 'line');
      }
      var cs = chosen();
      if (cs.length) h += '<div class="hxk-lines">' + cs.map(lineRow).join('') + '</div>';
      h += errMsg('lines') + '</div>';
    }
    // SPV
    h += '<div class="hxk-sec"><div class="hxk-lbl">SPV yang ikut jalan</div><div class="hxk-seg">' +
      '<button type="button" data-act="spvmode" data-v="' + TANPA + '" class="' + (S.spvMode === TANPA ? 'on' : '') + '">Tanpa SPV</button>' +
      '<button type="button" data-act="spvmode" data-v="ada" class="' + (S.spvMode === 'ada' ? 'on' : '') + '">Ada SPV</button></div>';
    if (S.spvMode === 'ada') h += '<div class="hxk-chips hxk-spv">' + chips(CFG.spv, function (n) { return S.spv === n; }, 'spv') + '</div>' + errMsg('spv');
    h += '</div>';
    // opsional
    h += '<div class="hxk-sec hxk-opts"><label class="hxk-sw"><input type="checkbox" data-act="repeat"' + (S.repeat ? ' checked' : '') + '> Repeat order</label>' +
      '<label class="hxk-sw"><input type="checkbox" data-act="upsell"' + (S.upsell ? ' checked' : '') + '> Upsell (naik paket)</label></div>';
    if (CFG.mode === 'pilot') h += '<button type="button" class="hxk-link hxk-oldform" data-act="oldform">Pakai form lama (sales lain / tanggal &gt; 7 hari)</button>';
    // ringkasan
    var cs2 = chosen(), units = cs2.reduce(function (s, c) { return s + (c.l.qty || 1); }, 0);
    h += '<div class="hxk-foot">' +
      // di kaki (selalu terlihat), bukan di bawah form yang panjang
      (S.saving && S.slow ? '<div class="hxk-slow"><b>Belum tersambung ke server</b><span>Closing tersimpan otomatis begitu ada sinyal. Jangan tutup aplikasi / browser sampai muncul "Closing tersimpan".</span>' +
        '<button type="button" class="hxk-link" data-act="bg">Tutup form, simpan saat ada sinyal</button></div>' : '') +
      '<div class="hxk-sum"><b>' + (cs2.length ? rp(total()) : 'Rp 0') + '</b><span>' + units + ' unit · ' + dLabel(S.date) + '</span></div>' +
      '<button type="button" class="hxk-save" data-act="save"' + (S.saving ? ' disabled' : '') + '>' + (S.saving ? (S.slow ? 'Menunggu sinyal…' : 'Menyimpan…') : 'Simpan closing') + '</button></div>';
    return h;
  }

  function paint(keepFocus) {
    if (!sheet || !S) return;
    var a = D.activeElement, act = a && a.getAttribute && a.getAttribute('data-act'), pos = null;
    var line = a && a.closest && a.closest('.hxk-line'), lp = line && line.getAttribute('data-p'), la = line && line.getAttribute('data-addon');
    if (keepFocus && a && a.selectionStart != null) pos = a.selectionStart;
    var sc = sheet.querySelector('.hxk-body') ? sheet.querySelector('.hxk-body').scrollTop : 0;
    sheet.querySelector('.hxk-body').innerHTML = html();
    sheet.querySelector('.hxk-body').scrollTop = sc;
    sheet.classList.toggle('hxk-busy', !!S.saving);
    if (S.saving) sheet.querySelectorAll('.hxk-body input').forEach(function (i) { i.disabled = true; });   // ketikan saat menyimpan tidak hilang diam-diam
    draftSoon();
    if (keepFocus && act) {
      var sel = '[data-act="' + act + '"]';
      var n = lp ? sheet.querySelector('.hxk-line[data-p="' + CSS.escape(lp) + '"][data-addon="' + la + '"] ' + sel) : sheet.querySelector(sel);
      if (n) { try { n.focus({ preventScroll: true }); if (pos != null && n.setSelectionRange) n.setSelectionRange(pos, pos); } catch (e) { } }
    }
  }

  function open(sp, team) {
    if (sheet) return;
    var m = sp ? (canon(sp, team) || { sp: sp, team: team || teamOf(sp) }) : meLive();
    if (m && m.leader) m = null;                               // HP leader → pilih anggota tim dulu
    S = freshState(m && m.sp, m && m.team);
    var d = loadDraft();
    if (d && sp && norm(d.sp) !== norm(m.sp)) d = null;      // dibuka untuk nama tertentu → hanya draft nama itu
    if (d && d.orderId && pendingIds[d.orderId]) d = null;   // closing itu masih dikirim di latar
    if (d && d.sp && (!W._cfgTeamsLoaded || canon(d.sp, d.team))) {
      for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) S[k] = d[k];
      S.saving = false; S.slow = false; S.err = {}; S.picking = false; S.restored = true;
      // tanggal draft TIDAK digeser (lewat tengah malam tetap tanggal closing-nya; orderId tetap sama) — label ikut tanggal
      S.dateMode = S.date === dkey(new Date()) ? 'today' : S.date === dkey(addDays(new Date(), -1)) ? 'kemarin' : 'other';
    }
    if (S.sp && !enabledFor(S.sp) && !isAdmin()) S.picking = true;
    overlay = D.createElement('div'); overlay.className = 'hxk-overlay';
    sheet = D.createElement('section'); sheet.className = 'hxk-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Form closing');
    sheet.innerHTML = '<div class="hxk-handle"></div><div class="hxk-body"></div>';
    D.body.appendChild(overlay); D.body.appendChild(sheet);
    if (!R.classList.contains('hx-overlay-open')) { R.classList.add('hx-overlay-open'); overlayAdded = true; }
    R.classList.add('hxk-lock');
    overlay.addEventListener('click', function () { close(); });
    sheet.addEventListener('click', onClick);
    sheet.addEventListener('input', onInput);
    sheet.addEventListener('change', onChange);
    sheet.addEventListener('focusout', onBlur);
    try { histTok = 'hxk' + Date.now(); history.pushState({ hxk: histTok }, ''); } catch (e) { histTok = null; }
    paint();
    void sheet.offsetWidth; sheet.classList.add('on'); overlay.classList.add('on');
  }
  function close(how) {
    if (!sheet) return;
    if (S && S.saving && how !== 'force' && how !== 'saved') {
      if (how === 'pop') { try { history.pushState({ hxk: histTok }, ''); } catch (e) { } }   // Back ditolak: kembalikan entri riwayat
      toast(S.slow ? 'Masih menunggu sinyal — ketuk "Tutup form, simpan saat ada sinyal" kalau mau menutup.' : 'Sedang menyimpan… tunggu sebentar.', 'info');
      return;
    }
    if (confirmOpen) { try { closeConfirmMo(false); } catch (e) { } }
    if (how === 'saved' || how === 'drop') dropDraft(); else saveDraft();   // 'drop' = pindah ke form lama, dicatat di sana
    clearTimeout(draftT);
    var s = sheet, o = overlay; sheet = null; overlay = null; S = null;
    s.classList.remove('on'); o.classList.remove('on');
    R.classList.remove('hxk-lock');
    if (overlayAdded) { R.classList.remove('hx-overlay-open'); overlayAdded = false; }
    if (how !== 'pop') { try { if (histTok && history.state && history.state.hxk === histTok) { popSkip++; history.back(); } } catch (e) { } }
    histTok = null;
    setTimeout(function () { s.remove(); o.remove(); }, 320);
  }
  W.addEventListener('popstate', function () { if (popSkip > 0) { popSkip--; return; } if (sheet) close('pop'); else if (expShut) expShut('pop'); });
  W.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet) close(); });

  function onClick(e) {
    var b = e.target.closest('[data-act]'); if (!b || !S) return;
    var act = b.getAttribute('data-act'), v = b.getAttribute('data-v');
    var line = b.closest('.hxk-line'), lp = line && line.getAttribute('data-p'), la = line && line.getAttribute('data-addon') === '1';
    if (S.saving && act !== 'close' && act !== 'bg') { e.preventDefault(); return; }
    switch (act) {
      case 'close': close(); return;
      case 'bg': close('force'); return;
      case 'fresh': ss(DRAFT_KEY, null); var own = meLive(); S = own ? (own.leader ? freshState('', '') : freshState(own.sp, own.team)) : freshState(S.sp, S.team); break;
      case 'oldform': close('drop'); bypassOnce = true; openLegacy(); return;
      case 'me':   // pertama kali = pemilik HP; sesudahnya "Ganti" hanya untuk closing ini (leader input untuk anggota tim)
        S.sp = v; S.team = b.getAttribute('data-t') || teamOf(v); S.picking = false; delete S.err.sales; if (!me()) setMe(S.sp, S.team); break;
      case 'resetme': store(ME_KEY, null); S.picking = true; break;
      case 'meleader': setMeLeader(b.getAttribute('data-t')); S.picking = true; break;   // lanjut: pilih anggota tim
      case 'pickme': S.picking = true; break;
      case 'date':
        S.dateMode = v;
        if (v === 'today') S.date = dkey(new Date()); else if (v === 'kemarin') S.date = dkey(addDays(new Date(), -1));
        delete S.err.date; break;
      case 'test':
        if (S.test !== v) { S.test = v; S.lines = {}; S.addons = {}; S.showAddon = false; if (v === 'tidak') S.tested = []; }
        delete S.err.test; break;
      case 'tested':
        var i = S.tested.indexOf(v);
        if (i >= 0) { S.tested.splice(i, 1); if (S.lines[v]) S.lines[v].on = false; } else { S.tested.push(v); if (S.addons[v]) S.addons[v].on = false; }
        delete S.err.tested; break;
      case 'line': var l = lineOf(v, false); l.on = !l.on; delete S.err.lines; break;
      case 'addon-toggle': S.showAddon = !S.showAddon; break;
      case 'addon':
        if (S.tested.indexOf(v) >= 0) { toast(v + ' sudah di daftar produk yang di-test — pilih di atas.', 'info'); return; }
        var a = lineOf(v, true); a.on = !a.on; delete S.err.lines; break;
      case 'qty':
        var L = (la ? S.addons : S.lines)[lp]; if (!L) return;
        L.qty = Math.max(1, Math.min(20, (L.qty || 1) + (+b.getAttribute('data-d') || 0))); break;
      case 'spvmode': S.spvMode = v; if (v === TANPA) S.spv = ''; delete S.err.spv; break;
      case 'spv': S.spv = v; delete S.err.spv; break;
      case 'save': save(); return;
      default: return;
    }
    paint();
  }
  function onInput(e) {
    var t = e.target, act = t.getAttribute('data-act'); if (!S || !act || S.saving) return;
    draftSoon();
    if (act === 'cust') { S.customer = t.value; if (S.err.customer) { delete S.err.customer; dropErr(t); } }
    else if (act === 'wa') { var v = t.value.replace(/\D/g, '').slice(0, 4); if (v !== t.value) t.value = v; S.wa4 = v; if (S.err.wa4) { delete S.err.wa4; dropErr(t); } }
    else if (act === 'price') {
      var line = t.closest('.hxk-line'), L = (line.getAttribute('data-addon') === '1' ? S.addons : S.lines)[line.getAttribute('data-p')];
      var n = +(t.value.replace(/\D/g, '')) || 0; L.price = n;
      var w = line.querySelector('.hxk-warn'), msg = warnText(L);
      if (msg) { if (!w) { w = D.createElement('div'); w.className = 'hxk-warn'; line.appendChild(w); } w.textContent = msg; } else if (w) w.remove();
      refreshFoot();
    }
  }
  // perbarui total & tanggal di kaki tanpa menggambar ulang form
  function refreshFoot() {
    if (!sheet || !S) return;
    var b = sheet.querySelector('.hxk-sum b'), sp = sheet.querySelector('.hxk-sum span'), cs = chosen();
    if (b) b.textContent = cs.length ? rp(total()) : 'Rp 0';
    if (sp) sp.textContent = cs.reduce(function (s, c) { return s + (c.l.qty || 1); }, 0) + ' unit · ' + dLabel(S.date);
  }
  function dropErr(t) { var n = t.parentNode && t.parentNode.querySelector('.hxk-err'); if (n) n.remove(); }
  function onBlur(e) {
    var t = e.target; if (!S || !t.getAttribute || t.getAttribute('data-act') !== 'cust') return;
    var v = titleCase(t.value); if (v !== t.value) t.value = v; S.customer = v; draftSoon();
  }
  function onChange(e) {
    var t = e.target, act = t.getAttribute('data-act'); if (!S || !act || S.saving) return;
    if (act === 'dateval') {        // tanpa paint(): menggambar ulang di sini menelan ketukan berikutnya di WebKit
      var v = t.value, today = dkey(new Date()), kemarin = dkey(addDays(new Date(), -1)), minD = dkey(addDays(new Date(), -7));
      var sec = t.closest('.hxk-sec'), sub = sec && sec.querySelector('.hxk-sub'), er = sec && sec.querySelector('.hxk-err');
      if (!v || v > today || v < minD) {
        S.err.date = 'Pilih tanggal antara ' + dLabel(minD) + ' dan hari ini. Lebih lama dari 7 hari: minta admin.';
        if (sec) { if (!er) { er = D.createElement('div'); er.className = 'hxk-err'; sec.appendChild(er); } er.textContent = S.err.date; }
        t.value = S.date;                                       // kolom selalu sama dengan tanggal yang akan disimpan
      } else { S.date = v; delete S.err.date; if (er) er.remove(); }
      if (sub) sub.textContent = dLabel(S.date) + (S.date === today ? ' (hari ini)' : S.date === kemarin ? ' (kemarin)' : '');
      refreshFoot();
    } else if (act === 'custom') {
      var line = t.closest('.hxk-line'), L = (line.getAttribute('data-addon') === '1' ? S.addons : S.lines)[line.getAttribute('data-p')];
      L.custom = t.checked; if (L.custom && !L.price) L.price = prices()[L.prod] || 0; paint();
    }
    else if (act === 'repeat') S.repeat = t.checked;
    else if (act === 'upsell') S.upsell = t.checked;
  }

  /* ── validasi & simpan ──────────────────────────────────────────── */
  function validate() {
    var e = {}, name = titleCase(S.customer), letters = (name.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    if (letters < 3) e.customer = 'Tulis nama customer (minimal 3 huruf).';
    if (isCh(S.sp) ? (S.wa4 && !/^\d{4}$/.test(S.wa4)) : !/^\d{4}$/.test(S.wa4)) e.wa4 = isCh(S.sp) ? 'Isi 4 digit, atau kosongkan (order marketplace).' : 'Isi 4 digit terakhir nomor WA.';
    if (!S.test) e.test = 'Pilih: ada test atau langsung order.';
    if (S.test === 'ya' && !S.tested.length) e.tested = 'Pilih minimal 1 produk yang di-test.';
    var cs = chosen();
    if (S.test && !cs.length) e.lines = 'Pilih minimal 1 produk yang closing.';
    if (cs.some(function (c) { return !linePrice(c.l); })) e.lines = 'Ada produk dengan harga Rp 0 — isi harga custom-nya.';
    if (S.spvMode === 'ada' && !S.spv) e.spv = 'Pilih nama SPV yang ikut.';
    var today = dkey(new Date()), minD = dkey(addDays(new Date(), -7));
    if (S.date > today || S.date < minD) e.date = 'Tanggal di luar 7 hari terakhir.';
    if (!S.sp || !S.team) e.sales = 'Pilih nama sales dulu (ketuk Ganti).';
    else if (!W._cfgTeamsLoaded) e.sales = 'Data tim belum dimuat — tunggu sebentar lalu Simpan lagi.';
    else { var c = canon(S.sp, S.team); if (!c || c.team !== S.team) e.sales = S.sp + ' tidak ada di tim ' + S.team + ' — ketuk Ganti dan pilih ulang.'; }
    return e;
  }
  function custKey() { return norm(titleCase(S.customer)) + '|' + S.wa4; }
  function similar(a, b) {   // nama hampir sama (beda 1 huruf) dengan 4 digit WA sama
    if (a === b) return true;
    var pa = a.split('|'), pb = b.split('|'); if (pa[1] !== pb[1]) return false;
    var x = pa[0], y = pb[0]; if (Math.abs(x.length - y.length) > 1) return false;
    var i = 0, j = 0, diff = 0;
    while (i < x.length && j < y.length) { if (x[i] === y[j]) { i++; j++; continue; } if (++diff > 1) return false; if (x.length > y.length) i++; else if (y.length > x.length) j++; else { i++; j++; } }
    return diff + (x.length - i) + (y.length - j) <= 1;
  }
  function findDup() {
    var key = custKey(), since = Date.now() - 24 * 3600e3, hit = null;
    var days = [S.date, dkey(new Date()), dkey(addDays(new Date(), -1))];
    days.filter(function (d, i) { return days.indexOf(d) === i; }).forEach(function (d) {
      rows(d).forEach(function (r) {
        if (!r.custKey || !similar(r.custKey, key)) return;
        if ((r.ts || 0) < since && d !== S.date) return;
        if (!hit || (r.ts || 0) > (hit.ts || 0)) hit = r;
      });
    });
    if (!hit) return null;
    var same = rows(dkeyOf(hit)).filter(function (r) { return r.orderId && r.orderId === hit.orderId; });
    return { r: hit, rev: same.reduce(function (s, r) { return s + (+r.revenue || 0); }, 0) || +hit.revenue || 0 };
  }
  function dkeyOf(r) { var ks = Object.keys(data()); for (var i = 0; i < ks.length; i++) if (rows(ks[i]).indexOf(r) >= 0) return ks[i]; return S.date; }
  async function confirmBox(title, msg, ok) {
    // modal konfirmasi bawaan (.mo, z 999) harus tampil DI ATAS sheet ini (z 1250)
    var mo = D.getElementById('confirmMo'), z = mo ? mo.style.zIndex : '', btn = D.getElementById('confirmOkBtn');
    if (mo) mo.style.zIndex = '1300';
    confirmOpen = true;
    try {
      var pr = showConfirm(title, msg, ok || 'Simpan', false);
      // skin .btn memaksa latar hitam → teks hitam tombol "aman" tak terlihat; paksa kuning
      if (btn) { btn.style.setProperty('background', '#ffd426', 'important'); btn.style.setProperty('color', '#121000', 'important'); btn.style.setProperty('font-weight', '800'); }
      return await pr;
    }
    catch (e) { return W.confirm(title + '\n\n' + msg); }
    finally { confirmOpen = false; if (mo) mo.style.zIndex = z; if (btn) { btn.style.removeProperty('background'); btn.style.removeProperty('color'); btn.style.removeProperty('font-weight'); } }
  }
  async function save() {
    if (!S || S.saving) return;
    var mine = S;
    S.err = validate();
    if (Object.keys(S.err).length) { paint(); var f = sheet.querySelector('.hxk-err'); if (f) f.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    var cs = chosen();
    var odd = cs.filter(function (c) { var b = prices()[c.prod] || 0, p = linePrice(c.l); return c.l.custom && b && (p < b * 0.7 || p > b * 1.1); });
    if (odd.length && !(await confirmBox('Harga jauh dari katalog', odd.map(function (c) { return c.prod + ': ' + rp(linePrice(c.l)) + ' (katalog ' + rp(prices()[c.prod] || 0) + ')'; }).join('\n') + '\n\nSudah disetujui leader?', 'Ya, simpan'))) return;
    if (S !== mine) return;                                   // form ditutup (Back) saat konfirmasi terbuka
    var dup = findDup();
    if (dup && !(await confirmBox('Mungkin sudah tercatat', titleCase(S.customer) + (S.wa4 ? ' (…' + S.wa4 + ')' : '') + ' sudah dicatat oleh ' + dup.r.sp + ' jam ' + hm(dup.r.ts) + ' (' + rpShort(dup.rev) + ', ' + (dup.r.prod || '') + ').\n\nSimpan lagi sebagai closing baru?', 'Simpan lagi'))) return;
    if (S !== mine) return;
    try { if (D.activeElement && sheet.contains(D.activeElement)) D.activeElement.blur(); } catch (e) { }
    S.saving = true; S.slow = online === false; paint();
    var slowT = setTimeout(function () { if (S === mine && S.saving && !S.slow) { S.slow = true; paint(); } }, 8000);
    var date = S.date, base = Date.now(), name = titleCase(S.customer), key = custKey(), tested = S.test === 'ya' ? S.tested.slice() : [];
    // Tag per BARIS produk, supaya Insights/My Sales (menghitung per baris) tidak menghitung 1 closing berkali-kali:
    //   produk di-test → testdrive · tanpa test / produk tambahan → complete ("Langsung Order")
    //   cross  → baris dengan keluarga produk lain dari produk utama
    //   upsell → hanya baris utama (nilai terbesar) · repeat → semua baris (sifat customer)
    var catIdx = Object.keys(prices()), pool = cs.filter(function (c) { return !c.addon; }); if (!pool.length) pool = cs;
    var prim = pool.slice().sort(function (a, b) { return linePrice(b.l) * (b.l.qty || 1) - linePrice(a.l) * (a.l.qty || 1) || catIdx.indexOf(a.prod) - catIdx.indexOf(b.prod); })[0];
    var primFam = fam(prim.prod);   // baris utama = produk (bukan tambahan) dengan nilai terbesar → hasil sama apa pun urutan ketuknya
    var meNow = meLive();
    var entries = cs.map(function (c, i) {
      var price = linePrice(c.l), qty = c.l.qty || 1;
      var tags = [S.test === 'ya' && !c.addon ? 'testdrive' : 'complete'];
      if (fam(c.prod) !== primFam) tags.push('cross');
      if (S.repeat) tags.push('repeat');
      if (S.upsell && c === prim) tags.push('upsell');
      return {
        team: S.team, sp: S.sp, prod: c.prod, chats: 0, units: qty, price: price, revenue: price * qty,
        saleType: tags, notes: '', priceMode: c.l.custom ? 'custom' : 'normal', ts: base + i,
        orderId: '', customer: name, wa4: S.wa4, custKey: key, tested: tested, addon: !!c.addon,
        spv: S.spvMode === 'ada' ? S.spv : TANPA, test: S.test, inputBy: meNow ? ownerLabel(meNow) : S.sp, src: 'closing'
      };
    });
    // orderId yang sama HANYA kalau isi closing sama dengan percobaan yang gagal tadi
    // (coba ulang aman, tidak dobel). Isi diubah → closing baru → orderId baru.
    var sig = JSON.stringify([date, S.sp, S.team, key, tested, entries.map(function (e) { return [e.prod, e.units, e.price, e.addon, e.spv, e.saleType]; })]);
    var orderId = S.orderId && S.orderSig === sig ? S.orderId : (date.replace(/-/g, '') + '-' + String(S.sp).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() + '-' + uid());
    S.orderId = orderId; S.orderSig = sig;
    entries.forEach(function (e) { e.orderId = orderId; });
    pendingIds[orderId] = 1; saveDraft();                      // draft ikut membawa orderId → coba ulang setelah reload tidak dobel
    var ref = dbRef('scores/' + date);
    if (!ref) { delete pendingIds[orderId]; clearTimeout(slowT); S.saving = false; S.slow = false; paint(); toast('Tidak terhubung ke database — coba lagi.', 'error'); return; }
    try {
      var res = await ref.transaction(function (curr) {
        var list = Array.isArray(curr) ? curr : curr && typeof curr === 'object' ? curr : null;
        var has = list && (Array.isArray(list) ? list : Object.keys(list).map(function (k) { return list[k]; })).some(function (r) { return r && r.orderId === orderId; });
        if (has) return;                                     // sudah tersimpan (ketuk dua kali / coba ulang): batal, tidak dobel
        if (!list) return entries.slice();
        if (Array.isArray(list)) { entries.forEach(function (en) { list.push(en); }); return list; }
        entries.forEach(function (en) { list['k' + en.ts] = en; }); return list;
      });
      var committed = res && (res.committed !== false);
      var okStored = committed || rows(date).some(function (r) { return r.orderId === orderId; });
      if (!okStored && res && res.snapshot) { var v = res.snapshot.val(); okStored = !!v && JSON.stringify(v).indexOf(orderId) >= 0; }
      if (!okStored) throw new Error('tidak tersimpan');
      // tampilkan segera (listener realtime juga akan menyamakan)
      var arr = data()[date] = Array.isArray(data()[date]) ? data()[date] : rows(date);
      entries.forEach(function (en) { if (!arr.some(function (r) { return r && r.ts === en.ts && r.orderId === en.orderId; })) arr.push(en); });
      try { renderAll(); } catch (e) { }
      delete pendingIds[orderId]; dropDraft(orderId);
      toast('Closing tersimpan · ' + name + ' · ' + rp(entries.reduce(function (s, x) { return s + x.revenue; }, 0)), 'success');
      try { if (navigator.vibrate) navigator.vibrate(30); } catch (e) { }
      if (S === mine) close('saved');                          // form lain yang sedang dibuka tidak ikut tertutup
    } catch (err) {
      delete pendingIds[orderId];
      if (S === mine) { S.saving = false; S.slow = false; paint(); toast('Gagal menyimpan — cek internet lalu ketuk Simpan lagi (tidak akan dobel).', 'error'); }
      else toast('Closing ' + name + ' GAGAL tersimpan — buka form dan isi ulang.', 'error');
      try { console.warn('[closing] save', err); } catch (e) { }
    } finally { clearTimeout(slowT); }
  }

  /* ── membuka form: tombol + SALE / Log a sale ───────────────────── */
  function hookOpen() {
    // premium-ui membuka drawer lama dengan class body 'premium-form-open'. Untuk
    // sales yang memakai form baru, drawer lama langsung ditutup lagi (sebelum
    // tergambar) dan form closing yang dibuka.
    var b = D.body; if (!b || !W.MutationObserver) return;
    var was = b.classList.contains('premium-form-open');
    new MutationObserver(function () {
      var now = b.classList.contains('premium-form-open');
      if (!now || was) { was = now; return; }                // hanya saat drawer BARU dibuka
      was = true; spTouched = false;
      if (bypassOnce) { bypassOnce = false; paintLegacyBanner(); return; }
      var m = meLive();
      if (CFG.mode === 'all' || (m && enabledFor(m.sp))) { b.classList.remove('premium-form-open'); was = false; open(); }
      else paintLegacyBanner();
    }).observe(b, { attributes: true, attributeFilter: ['class'] });
    // nilai bawaan select (nama pertama) tidak dihitung: banner baru muncul setelah user sendiri memilih tim/nama
    ['inSP', 'inTeam'].forEach(function (id) { var el = D.getElementById(id); if (el) el.addEventListener('change', function () { spTouched = true; setTimeout(paintLegacyBanner, 0); }); });
  }
  // buka drawer lama lewat tombol premium-ui (pindah ke Dashboard + hari ini, seperti biasa)
  function openLegacy() {
    var btn = D.querySelector('.premium-quick-add') || D.querySelector('.premium-add-fab');
    setTimeout(function () { if (btn) btn.click(); else D.body.classList.add('premium-form-open'); setTimeout(function () { bypassOnce = false; }, 400); }, 60);
  }
  // banner di drawer lama: hanya untuk peserta uji coba (nama terpilih / HP ini)
  function paintLegacyBanner() {
    var rb = D.querySelector('.hxk-recap-btn'); if (rb) rb.style.display = anyEnabled() ? '' : 'none';
    var panel = D.getElementById('saleEntryPanel'); if (!panel) return;
    var bn = panel.querySelector('.hxk-legacy');
    var sel = (D.getElementById('inSP') || {}).value, m = me();
    var show = CFG.mode === 'all' || (CFG.mode === 'pilot' && ((m && inPilot(m.sp)) || (spTouched && sel && inPilot(sel))));
    if (!show) { if (bn) bn.remove(); return; }
    if (!bn) {
      bn = D.createElement('button'); bn.type = 'button'; bn.className = 'hxk-legacy';
      bn.addEventListener('click', function () {
        var sp = (D.getElementById('inSP') || {}).value, team = (D.getElementById('inTeam') || {}).value;
        D.body.classList.remove('premium-form-open');
        // pemilik HP TIDAK pernah diambil dari pilihan drawer lama (bawaannya selalu nama pertama).
        // Belum ada pemilik → form bertanya "Kamu siapa?". Sudah ada → nama terpilih hanya untuk closing ini.
        if (meLive() && spTouched && sp && enabledFor(sp)) open(sp, team); else open();
      });
      var title = panel.querySelector('.pt'); if (title && title.nextSibling) panel.insertBefore(bn, title.nextSibling); else panel.insertBefore(bn, panel.firstChild);
    }
    bn.innerHTML = '<b>Pakai form closing baru</b><span>Customer, produk di-test, produk closing, SPV — satu kali isi</span><i>›</i>';
  }

  /* ══ EXPORT ════════════════════════════════════════════════════════ */
  function wk(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); var dow = (x.getDay() + 6) % 7; return addDays(x, -dow); }   // Senin
  function ranges() {
    var t = new Date(), mon = wk(t), lastMon = addDays(mon, -7), m1 = new Date(t.getFullYear(), t.getMonth(), 1), pm1 = new Date(t.getFullYear(), t.getMonth() - 1, 1), pmEnd = new Date(t.getFullYear(), t.getMonth(), 0);
    return {
      week: [dkey(mon), dkey(t), 'Minggu ini'], lastweek: [dkey(lastMon), dkey(addDays(mon, -1)), 'Minggu lalu'],
      month: [dkey(m1), dkey(t), 'Bulan ini'], lastmonth: [dkey(pm1), dkey(pmEnd), 'Bulan lalu']
    };
  }
  function collect(from, to, team) {
    var keys = Object.keys(data()).filter(function (k) { return /^\d{4}-\d\d-\d\d$/.test(k) && k >= from && k <= to; }).sort();
    var orders = [], lines = [];
    keys.forEach(function (k) {
      var byId = {};
      rows(k).forEach(function (r) {
        if (team && r.team !== team) return;
        var isNew = r.src === 'closing' && r.orderId;
        var id = isNew ? r.orderId : 'L' + (r.ts || Math.random());
        var spv = isNew ? (r.spv || TANPA) : '-';
        lines.push([k, r.ts ? hm(r.ts) : '-', isNew ? r.orderId : '-', r.sp || '-', r.team || '-', isNew ? (r.customer || '-') : '-', r.prod || '-',
          isNew ? (r.test === 'tidak' ? 'Langsung order' : r.addon ? 'Tambahan (tanpa test)' : 'Di-test') : '-', +r.units || 1, Math.round(+r.price || 0), Math.round(+r.revenue || 0),
          r.priceMode === 'custom' ? 'Ya' : 'Tidak', spv]);
        var o = byId[id];
        if (!o) {
          o = byId[id] = {
            date: k, time: r.ts ? hm(r.ts) : '-', ts: r.ts || 0, id: isNew ? r.orderId : '-', sp: r.sp || '-', team: r.team || '-',
            cust: isNew ? (r.customer || '-') : '-', wa: isNew ? (r.wa4 || '-') : '-', tested: isNew ? (r.tested || []) : null,
            closed: [], addon: [], units: 0, rev: 0, custom: false, spv: spv,
            tipe: isNew ? (r.test === 'tidak' ? 'Langsung order' : 'Test') : '-',
            repeat: (r.saleType || []).indexOf('repeat') >= 0, upsell: (r.saleType || []).indexOf('upsell') >= 0,
            by: isNew ? (r.inputBy || '-') : '-', src: isNew ? 'Form baru' : 'Form lama'
          };
          orders.push(o);
        }
        var label = (r.prod || '-') + ((+r.units || 1) > 1 ? ' ×' + r.units : '');
        o.closed.push(label); if (isNew && r.addon) o.addon.push(label);
        o.units += +r.units || 1; o.rev += +r.revenue || 0; if (r.priceMode === 'custom') o.custom = true;
        if ((r.saleType || []).indexOf('repeat') >= 0) o.repeat = true;
        if ((r.saleType || []).indexOf('upsell') >= 0) o.upsell = true;
      });
    });
    var head = ['Tanggal', 'Jam', 'ID Transaksi', 'Sales', 'Tim', 'Nama Customer', 'WA (4 digit)', 'Produk Di-test', 'Produk Closing', 'Produk Tambahan (tanpa test)',
      'Total Unit', 'Omzet (Rp)', 'Harga Custom', 'SPV', 'Tipe', 'Repeat', 'Upsell', 'Input oleh', 'Sumber'];
    var body = orders.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.ts - b.ts; }).map(function (o) {
      return [o.date, o.time, o.id, o.sp, o.team, o.cust, o.wa, o.tested ? (o.tested.length ? o.tested.join(' + ') : 'Tanpa test') : '-', o.closed.join(' + ') || '-',
        o.addon.join(' + ') || '-', o.units, Math.round(o.rev), o.custom ? 'Ya' : 'Tidak', o.spv, o.tipe, o.repeat ? 'Ya' : 'Tidak', o.upsell ? 'Ya' : 'Tidak', o.by, o.src];
    });
    var lhead = ['Tanggal', 'Jam', 'ID Transaksi', 'Sales', 'Tim', 'Nama Customer', 'Produk', 'Status Produk', 'Unit', 'Harga Satuan (Rp)', 'Omzet (Rp)', 'Harga Custom', 'SPV'];
    return { head: head, body: body, lhead: lhead, lines: lines, n: orders.length, rev: orders.reduce(function (s, o) { return s + o.rev; }, 0) };
  }
  function loadXlsx() {
    if (W.XLSX) return Promise.resolve(W.XLSX);
    return new Promise(function (ok, bad) {
      var s = D.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = function () { W.XLSX ? ok(W.XLSX) : bad(new Error('xlsx')); }; s.onerror = function () { bad(new Error('xlsx')); };
      D.head.appendChild(s);
    });
  }
  function download(blob, name) {
    var a = D.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; D.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function csv(head, body, textCols) {
    textCols = textCols || [];
    var q = function (v, i) {
      if (typeof v === 'number') v = String(v);
      else {
        v = v == null ? '' : String(v);
        if (textCols.indexOf(i) >= 0 && /^\d+$/.test(v)) v = '="' + v + '"';   // "0812" tetap 0812 di Excel
        else if (/^[=+@\t\r]|^-./.test(v)) v = "'" + v;                         // jangan dibaca sebagai rumus
      }
      return /[;"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return '\ufeff' + [head].concat(body).map(function (r) { return r.map(q).join(';'); }).join('\r\n');
  }
  async function doExport(from, to, team, fmt) {
    var X = collect(from, to, team), brand = 'hurricane', base = 'closing_' + brand + '_' + from + '_sd_' + to + (team ? '_' + team.replace(/\s+/g, '') : '');
    if (!X.n) { toast('Tidak ada closing di periode ini.', 'info'); return X; }
    if (fmt === 'xlsx') {
      try {
        var XL = await loadXlsx(), wb = XL.utils.book_new();
        var s1 = XL.utils.aoa_to_sheet([X.head].concat(X.body)), s2 = XL.utils.aoa_to_sheet([X.lhead].concat(X.lines));
        s1['!cols'] = X.head.map(function (h, i) { return { wch: [11, 6, 22, 12, 10, 22, 9, 30, 30, 22, 8, 13, 9, 12, 14, 7, 7, 12, 10][i] || 12 }; });
        s2['!cols'] = X.lhead.map(function (h, i) { return { wch: [11, 6, 22, 12, 10, 22, 22, 20, 6, 15, 13, 9, 12][i] || 12 }; });
        XL.utils.book_append_sheet(wb, s1, 'Closing'); XL.utils.book_append_sheet(wb, s2, 'Per Produk');
        XL.writeFile(wb, base + '.xlsx');
        return X;
      } catch (e) { toast('Excel tidak bisa dimuat — diunduh sebagai CSV.', 'info'); fmt = 'csv'; }
    }
    // satu file saja: Safari iPhone memblokir unduhan kedua yang beruntun. Rincian per produk ada di Excel.
    download(new Blob([csv(X.head, X.body, [X.head.indexOf('WA (4 digit)')])], { type: 'text/csv;charset=utf-8' }), base + '.csv');
    return X;
  }
  var exp = null;
  async function openExport() {
    if (!isAdmin() && !CFG.pinHash) { toast('PIN leader belum diatur. Admin: Admin → Form Closing → PIN leader.', 'info'); return; }
    if (exp) return;
    var locked = !isAdmin() && store(PIN_KEY) !== CFG.pinHash, tries = 0;
    var rg = ranges(), T = roster();
    exp = D.createElement('section'); exp.className = 'hxk-sheet hxk-exp'; exp.setAttribute('role', 'dialog'); exp.setAttribute('aria-modal', 'true'); exp.setAttribute('aria-label', 'Export closing');
    var ov = D.createElement('div'); ov.className = 'hxk-overlay';
    var st = { r: 'week', from: rg.week[0], to: rg.week[1], team: '', fmt: 'xlsx' };
    function pinBody(err) {
      return '<div class="hxk-head"><div><div class="hxk-kick">EXPORT</div><h3>PIN leader</h3></div><button type="button" class="hxk-x" data-a="x" aria-label="Tutup">×</button></div>' +
        '<div class="hxk-sec"><div class="hxk-sub">Rekap closing hanya untuk leader. Masukkan PIN dari admin (cukup sekali di HP ini).</div>' +
        '<input type="password" class="hxk-in hxk-pin" data-a="pin" inputmode="numeric" autocomplete="off" maxlength="8" placeholder="PIN">' +
        (err ? '<div class="hxk-err">' + esc(err) + '</div>' : '') + '</div>' +
        '<div class="hxk-foot"><div class="hxk-sum"><b>Terkunci</b><span>PIN 4–8 angka</span></div><button type="button" class="hxk-save" data-a="unlock">Buka</button></div>';
    }
    function body() {
      var X = collect(st.from, st.to, st.team);
      return '<div class="hxk-head"><div><div class="hxk-kick">EXPORT</div><h3>Rekap closing</h3></div><button type="button" class="hxk-x" data-a="x" aria-label="Tutup">×</button></div>' +
        '<div class="hxk-sec"><div class="hxk-lbl">Periode</div><div class="hxk-chips">' + Object.keys(rg).map(function (k) { return '<button type="button" class="hxk-chip' + (st.r === k ? ' on' : '') + '" data-a="r" data-v="' + k + '">' + rg[k][2] + '</button>'; }).join('') + '</div>' +
        '<div class="hxk-grid2"><div><div class="hxk-lbl hxk-lbl2">Dari</div><input type="date" class="hxk-in" data-a="from" value="' + st.from + '"></div><div><div class="hxk-lbl hxk-lbl2">Sampai</div><input type="date" class="hxk-in" data-a="to" value="' + st.to + '"></div></div></div>' +
        '<div class="hxk-sec"><div class="hxk-lbl">Tim</div><div class="hxk-chips"><button type="button" class="hxk-chip' + (!st.team ? ' on' : '') + '" data-a="t" data-v="">Semua</button>' +
        Object.keys(T).map(function (t) { return '<button type="button" class="hxk-chip' + (st.team === t ? ' on' : '') + '" data-a="t" data-v="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div></div>' +
        '<div class="hxk-sec"><div class="hxk-lbl">Format</div><div class="hxk-seg"><button type="button" data-a="f" data-v="xlsx" class="' + (st.fmt === 'xlsx' ? 'on' : '') + '">Excel (.xlsx)</button><button type="button" data-a="f" data-v="csv" class="' + (st.fmt === 'csv' ? 'on' : '') + '">CSV</button></div></div>' +
        '<div class="hxk-foot"><div class="hxk-sum"><b>' + X.n + ' closing</b><span>' + rp(X.rev) + ' · ' + dLabel(st.from) + ' – ' + dLabel(st.to) + '</span></div>' +
        '<button type="button" class="hxk-save" data-a="go"' + (X.n ? '' : ' disabled') + '>Download</button></div>';
    }
    exp.innerHTML = '<div class="hxk-handle"></div><div class="hxk-body">' + (locked ? pinBody() : body()) + '</div>';
    D.body.appendChild(ov); D.body.appendChild(exp);
    var addedOv = !R.classList.contains('hx-overlay-open'); if (addedOv) R.classList.add('hx-overlay-open');
    R.classList.add('hxk-lock');
    var xTok = null; try { xTok = 'hxkx' + Date.now(); history.pushState({ hxkx: xTok }, ''); } catch (e) { xTok = null; }
    function onKey(e) { if (e.key === 'Escape') shut(); else if (e.key === 'Enter' && locked && e.target.getAttribute('data-a') === 'pin') unlock(); }
    D.addEventListener('keydown', onKey);
    function shut(how) {
      var e = exp; if (!e) return; exp = null; expShut = null; e.classList.remove('on'); ov.classList.remove('on');
      D.removeEventListener('keydown', onKey);
      if (!sheet) R.classList.remove('hxk-lock');
      if (addedOv) R.classList.remove('hx-overlay-open');
      if (how !== 'pop') { try { if (xTok && history.state && history.state.hxkx === xTok) { popSkip++; history.back(); } } catch (er) { } }
      setTimeout(function () { e.remove(); ov.remove(); }, 320);
    }
    expShut = shut;
    function repaint() { exp.querySelector('.hxk-body').innerHTML = locked ? pinBody() : body(); }
    async function unlock() {
      var inp = exp.querySelector('[data-a="pin"]'), pin = inp ? inp.value.trim() : '';
      if (!/^\d{4,8}$/.test(pin)) { exp.querySelector('.hxk-body').innerHTML = pinBody('PIN harus 4–8 angka.'); return; }
      var h = await sha256(pin);
      if (h !== CFG.pinHash) {
        tries++;
        exp.querySelector('.hxk-body').innerHTML = pinBody(tries >= 3 ? 'PIN salah. Tanya admin untuk PIN yang benar.' : 'PIN salah.');
        var n = exp.querySelector('[data-a="pin"]'); if (n) n.focus();
        return;
      }
      store(PIN_KEY, h); locked = false; repaint();
    }
    ov.addEventListener('click', function () { shut(); });
    exp.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a'), v = b.getAttribute('data-v');
      if (a === 'x') return shut();
      if (a === 'unlock') return unlock();
      if (locked) return;
      if (a === 'r') { st.r = v; st.from = rg[v][0]; st.to = rg[v][1]; }
      else if (a === 't') st.team = v;
      else if (a === 'f') st.fmt = v;
      else if (a === 'go') { b.disabled = true; b.textContent = 'Menyiapkan…'; await doExport(st.from, st.to, st.team, st.fmt); b.disabled = false; b.textContent = 'Download'; return; }
      else return;
      repaint();
    });
    exp.addEventListener('change', function (e) {
      var a = e.target.getAttribute('data-a'); if (a !== 'from' && a !== 'to') return;
      st[a] = e.target.value || st[a]; st.r = ''; if (st.from > st.to) { var t = st.from; st.from = st.to; st.to = t; } repaint();
    });
    void exp.offsetWidth; exp.classList.add('on'); ov.classList.add('on');
    if (locked) setTimeout(function () { var n = exp && exp.querySelector('[data-a="pin"]'); if (n) n.focus(); }, 350);
  }

  /* ══ ADMIN: Admin → Form Closing ═══════════════════════════════════ */
  var adminBox = null;
  function cfgWrite(patch) {
    if (!W._cfgTeamsLoaded) { toast('Tunggu config dimuat dulu…', 'info'); return Promise.reject(new Error('cfg')); }
    var r = dbRef('config/closing'); if (!r) return Promise.reject(new Error('db'));
    return r.update(patch);                                   // HANYA update — tidak pernah set() config
  }
  var admDraft = { spv: null, pin: '' };
  // set keanggotaan 1 nama di config/closing/pilot secara atomik (transaction di daun itu saja)
  function pilotSet(name, on) {
    if (!W._cfgTeamsLoaded) { toast('Tunggu config dimuat dulu…', 'info'); return Promise.reject(new Error('cfg')); }
    var r = dbRef('config/closing/pilot'); if (!r) return Promise.reject(new Error('db'));
    return r.transaction(function (cur) {
      var list = Array.isArray(cur) ? cur.filter(Boolean) : cur && typeof cur === 'object' ? Object.keys(cur).map(function (k) { return cur[k]; }).filter(Boolean) : [];
      var i = list.findIndex(function (x) { return norm(x) === norm(name); });
      if (on && i < 0) list.push(name); else if (!on && i >= 0) list.splice(i, 1);
      return list;
    });
  }
  function paintAdmin() {
    if (!adminBox) return;
    var T = roster(), a = D.activeElement, fk = a && adminBox.contains(a) && a.getAttribute('data-adm-in'), pos = fk && a.selectionStart != null ? a.selectionStart : null;
    adminBox.innerHTML =
      '<div class="omset-section-title" style="color:#30d158;">Form Closing (baru)</div>' +
      '<div class="hxk-adm-sub">Input closing: customer, produk di-test, produk closing, SPV. Data tetap masuk omzet seperti biasa.</div>' +
      '<div class="hxk-lbl">Mode</div><div class="hxk-seg hxk-adm-seg">' +
      [['off', 'Mati'], ['pilot', 'Uji coba'], ['all', 'Semua sales']].map(function (m) { return '<button type="button" data-adm="mode" data-v="' + m[0] + '" class="' + (CFG.mode === m[0] ? 'on' : '') + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<div class="hxk-lbl hxk-lbl2">Peserta uji coba (' + CFG.pilot.length + ')</div><div class="hxk-chips">' +
      Object.keys(T).map(function (t) { return ((T[t] && T[t].m) || []).map(function (n) { return '<button type="button" class="hxk-chip' + (inPilot(n) ? ' on' : '') + '" data-adm="pilot" data-v="' + esc(n) + '">' + esc(n) + '</button>'; }).join(''); }).join('') + '</div>' +
      '<div class="hxk-lbl hxk-lbl2">Daftar SPV</div><input type="text" class="hxk-in" data-adm-in="spv" value="' + esc(admDraft.spv != null ? admDraft.spv : CFG.spv.join(', ')) + '"><button type="button" class="btn hxk-adm-btn" data-adm="spv">Simpan daftar SPV</button>' +
      '<div class="hxk-lbl hxk-lbl2">PIN leader untuk export ' + (CFG.pinHash ? '<span class="hxk-ok">· sudah diatur</span>' : '<span class="hxk-bad">· belum diatur</span>') + '</div>' +
      '<input type="password" class="hxk-in" data-adm-in="pin" inputmode="numeric" placeholder="PIN baru (4–8 angka)" autocomplete="new-password"><button type="button" class="btn hxk-adm-btn" data-adm="pin">Simpan PIN</button>' +
      '<div class="hxk-lbl hxk-lbl2">Export</div><button type="button" class="btn hxk-adm-btn hxk-adm-go" data-adm="export">Export closing (Excel / CSV)</button>';
    var pinIn = adminBox.querySelector('[data-adm-in="pin"]'); if (pinIn) pinIn.value = admDraft.pin;   // tidak lewat atribut HTML
    if (fk) { var n = adminBox.querySelector('[data-adm-in="' + fk + '"]'); if (n) { try { n.focus({ preventScroll: true }); if (pos != null) n.setSelectionRange(pos, pos); } catch (e) { } } }
  }
  function mountAdmin() {
    var panel = D.getElementById('adminPanel'); if (!panel || adminBox) return;
    adminBox = D.createElement('div'); adminBox.className = 'omset-section hxk-adm'; adminBox.style.borderColor = 'rgba(48,209,88,.35)';
    var first = panel.querySelector('.omset-section'); if (first) panel.insertBefore(adminBox, first); else panel.appendChild(adminBox);
    paintAdmin();
    adminBox.addEventListener('input', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-adm-in'); if (k) admDraft[k] = e.target.value; });
    adminBox.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-adm]'); if (!b) return;
      var a = b.getAttribute('data-adm'), v = b.getAttribute('data-v');
      try {
        if (a === 'mode') { await cfgWrite({ mode: v }); toast('Mode form closing: ' + b.textContent, 'success'); }
        else if (a === 'pilot') await pilotSet(v, !inPilot(v)); else if (a === 'spv') {
          var names = adminBox.querySelector('[data-adm-in="spv"]').value.split(',').map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
          var uniq = names.filter(function (n, i) { return names.map(norm).indexOf(norm(n)) === i; });
          if (!uniq.length) { toast('Daftar SPV tidak boleh kosong.', 'error'); return; }
          await cfgWrite({ spv: uniq }); admDraft.spv = null; paintAdmin(); toast('Daftar SPV disimpan (' + uniq.length + ' nama).', 'success');
        } else if (a === 'pin') {
          var pin = adminBox.querySelector('[data-adm-in="pin"]').value.trim();
          if (!/^\d{4,8}$/.test(pin)) { toast('PIN harus 4–8 angka.', 'error'); return; }
          await cfgWrite({ pinHash: await sha256(pin) }); admDraft.pin = ''; adminBox.querySelector('[data-adm-in="pin"]').value = ''; toast('PIN leader disimpan.', 'success');
        } else if (a === 'export') openExport();
      } catch (er) { if (er && er.message !== 'cfg') toast('Gagal menyimpan pengaturan — cek internet.', 'error'); }
    });
  }

  /* ── tombol export untuk leader (halaman Monthly Recap) ──────────── */
  function mountRecapBtn() {
    var page = D.getElementById('page-monthly'); if (!page) return;
    // tempat yang sama dengan tombol "Rekap 1 Tahun" (fx-year.js)
    var host = page.querySelector('.premium-monthly-head > div') || page.querySelector('#monthlyControlRow');
    if (!host) return;
    var b = page.querySelector('.hxk-recap-btn');
    if (!b) {
      b = D.createElement('button'); b.type = 'button'; b.className = 'hxk-recap-btn';
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Export closing</span>';
      b.addEventListener('click', openExport);
    }
    b.style.display = anyEnabled() ? '' : 'none';
    if (b.parentNode !== host) host.appendChild(b);
  }

  /* ── tampilkan customer & SPV di My Sales ───────────────────────── */
  function stampMySales() {
    var box = D.getElementById('msSalesList'), sel = D.getElementById('msSPSelect');
    if (!box || !sel || !sel.value) return;
    var pr = String(sel.value).split('|'), sp = pr[0], team = pr[1], by = {};
    Object.keys(data()).forEach(function (k) { rows(k).forEach(function (e) { if (e.sp === sp && e.team === team) (by[k] = by[k] || []).push(e); }); });
    var dates = Object.keys(by).sort().reverse(), groups = box.querySelectorAll('.ms-date-group');
    for (var gi = 0; gi < groups.length && gi < dates.length; gi++) {
      var es = by[dates[gi]].slice().sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); }), cs = groups[gi].querySelectorAll('.ms-sale-card');
      if (cs.length !== es.length) continue;
      for (var ci = 0; ci < cs.length; ci++) {
        var e = es[ci]; if (e.src !== 'closing' || cs[ci].querySelector('.hxk-ms')) continue;
        var t = D.createElement('div'); t.className = 'hxk-ms';
        t.textContent = (e.customer || '-') + (e.wa4 ? ' (…' + e.wa4 + ')' : '') + ' · ' + (e.spv || TANPA) + (e.addon ? ' · tambahan' : e.test === 'tidak' ? ' · langsung order' : ' · di-test');
        (cs[ci].querySelector('.ms-sale-meta') || cs[ci]).appendChild(t);
      }
    }
  }

  /* ── siklus ─────────────────────────────────────────────────────── */
  function boot() {
    try { if (history.state && (history.state.hxk || history.state.hxkx)) { popSkip++; history.back(); } } catch (e) { }
    watchOnline();
    var dr = loadDraft();
    if (dr) setTimeout(function () { var m = meLive(); if (!sheet && (CFG.mode === 'all' || (m && enabledFor(m.sp)))) toast('Ada closing yang belum disimpan (' + (dr.customer || 'tanpa nama') + ') — ketuk + Sale untuk melanjutkan.', 'info'); }, 3500);
    watchCfg(); hookOpen(); paintLegacyBanner();
    var tries = 0;
    (function mount() { mountAdmin(); mountRecapBtn(); if ((!adminBox || !D.querySelector('.hxk-recap-btn')) && tries++ < 40) setTimeout(mount, 500); })();
    try { if (W.HX && HX.on) HX.on('page', function () { setTimeout(mountRecapBtn, 60); }); } catch (e) { }
    var ms = D.getElementById('msSalesList');
    if (ms && W.MutationObserver) new MutationObserver(function () { try { stampMySales(); } catch (e) { } }).observe(ms, { childList: true });
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();

  W.HXClosing = {
    open: open, close: close, exportOpen: openExport, collect: collect, doExport: doExport,
    cfg: function () { return JSON.parse(JSON.stringify(CFG)); }, me: me, setMe: setMe,
    _state: function () { return S; }, _validate: function () { return S ? validate() : null; }, _applyCfg: applyCfg
  };
})();
