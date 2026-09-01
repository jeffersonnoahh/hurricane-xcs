/* ══════════════════════════════════════════════════════════════════════
   CATATAN SALES (mis. "ON LEAVE") — badge kecil di samping nama.

   Sumbernya DATA, bukan kode: Firebase config/spNotes, bentuknya
       { "Eli|Ivan": "ON LEAVE" }
   Jadi menandai/melepas orang cuti cukup mengubah data, tanpa deploy ulang.

   Tampil di: Monthly Recap (ranking sales), Salespeople, Watchlist.
   File TERPISAH — app.js tidak disentuh.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var NOTES = {};          /* "sp|team" → teks  ·  juga cocok per-nama saja */
  var DB = 'https://hurricane-scorecard-default-rtdb.firebaseio.com';
  var NS = (typeof DATA_NS !== 'undefined' && DATA_NS) ? DATA_NS + '/' : '';

  function load() {
    fetch(DB + '/' + NS + 'config/spNotes.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { NOTES = d || {}; apply(); })
      .catch(function () { });
  }

  function noteFor(name, team) {
    if (!name) return null;
    var exact = NOTES[name + '|' + team];
    if (exact) return exact;
    /* cocok hanya nama, supaya tetap kena walau timnya berubah */
    for (var k in NOTES) {
      if (k.split('|')[0].toLowerCase() === String(name).toLowerCase()) return NOTES[k];
    }
    return null;
  }

  function badge(txt) {
    var b = document.createElement('span');
    b.className = 'sp-note-badge';
    b.textContent = txt;
    return b;
  }

  /* Tempelkan badge ke elemen nama yang cocok, tanpa mengubah teks aslinya. */
  function decorate(root) {
    if (!Object.keys(NOTES).length) return;
    var sels = ['.rank-name', '.rk-name', '.spc-name', '.wl-name',
                '.sp-lookup-name', '.warn-crit-name', '.tn', '.lbn', '.nr-name'];
    root.querySelectorAll(sels.join(',')).forEach(function (e) {
      if (e.querySelector('.sp-note-badge')) return;
      var nm = e.textContent.trim();
      if (!nm) return;
      /* tim: cari elemen saudara yang menyebut nama tim */
      var team = '';
      var sib = e.parentElement && e.parentElement.textContent || '';
      var t = noteFor(nm, team);
      if (!t) {
        /* coba potong bila teks mengandung nama + tim */
        t = noteFor(nm.split('·')[0].trim(), team);
      }
      if (t) e.appendChild(badge(t));
    });
    /* tabel Monthly Recap: kolom nama di dalam <td> */
    root.querySelectorAll('td').forEach(function (td) {
      if (td.querySelector('.sp-note-badge')) return;
      if (td.children.length) return;
      var t = noteFor(td.textContent.trim(), '');
      if (t) td.appendChild(badge(t));
    });
  }

  function apply() {
    try { decorate(document); } catch (e) { }
  }

  /* jalankan ulang setiap render tanpa mengubah fungsi aslinya */
  function wrap(fn) {
    if (typeof window[fn] !== 'function' || window[fn].__note) return;
    var orig = window[fn];
    window[fn] = function () {
      var r = orig.apply(this, arguments);
      setTimeout(apply, 60);
      return r;
    };
    window[fn].__note = true;
  }

  function hook() {
    ['renderAll', 'renderMonthly', 'renderWarning', 'renderWatchlist',
     'renderInsights', 'renderNotReported'].forEach(wrap);
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
  setTimeout(hook, 900);
  setTimeout(load, 1500);
  window.reloadSpNotes = load;
})();
