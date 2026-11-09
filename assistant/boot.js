/* Hurricane Assistant (/assistant/) startup.
   A separate page from the dashboard: it reads the same Firebase data
   (read only) and gives coach.js the same globals the dashboard's app.js
   would (allData, allActs, TM, _warnThresh, _isLeader, …), so coach.js
   works unchanged in both places. Nothing here writes to Firebase. */
var allData = {}, allActs = {}, TM = {}, adminUnlocked = false;
var _warnThresh = { rev: 50000000, chats: 7, calls: 7, fups: 15 };
try { var _wt = JSON.parse(localStorage.getItem('hxcs_warn_thresh') || 'null'); if (_wt) for (var _k in _wt) _warnThresh[_k] = _wt[_k]; } catch (e) { }

// same lists as js/app.js (keep in sync)
var _LEADERS = ['Agung'];
var _ACT_EXCLUDE = ['Live tiktok', 'Shopee live'];
var _WARN_EXCLUDE = ['Tokopedia', 'Live tiktok', 'Shopee live', 'Shopee'];
function _low(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function _isLeader(sp) { return _LEADERS.some(function (x) { return _low(x) === _low(sp); }); }
function _isActExcluded(sp) { return _ACT_EXCLUDE.some(function (x) { return _low(x) === _low(sp); }) || _isLeader(sp); }
function _isWarnExcluded(sp) { return _WARN_EXCLUDE.some(function (x) { return _low(x) === _low(sp); }); }

window.DATA_NS = '';
window.renderAll = function () { };   // coach.js wraps this; called on every data change

(function () {
  function dk(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function asList(v) { return Array.isArray(v) ? v : v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []; }
  function byDay(obj) { var out = {}; Object.keys(obj || {}).forEach(function (k) { out[k] = asList(obj[k]); }); return out; }

  firebase.initializeApp({
    apiKey: 'AIzaSyDfWkhwB3flykNloLRKaXwkNWfxbY22H2g',
    authDomain: 'hurricane-scorecard.firebaseapp.com',
    databaseURL: 'https://hurricane-scorecard-default-rtdb.firebaseio.com',
    projectId: 'hurricane-scorecard',
    storageBucket: 'hurricane-scorecard.firebasestorage.app',
    messagingSenderId: '13981949757',
    appId: '1:13981949759:web:356458e60883bf36ab3d8a'
  });
  window.db = firebase.database();

  // only what Coach needs: this month and the 8 days before (for the 7 day view)
  var now = new Date(), first = new Date(now.getFullYear(), now.getMonth(), 1), back = new Date(now); back.setDate(back.getDate() - 9);
  var from = dk(back < first ? back : first);
  var ready = { teams: false, scores: false, acts: false }, opened = false;
  function changed(part) {
    ready[part] = true;
    if (ready.teams && ready.scores && ready.acts) {
      var load = document.getElementById('haLoad'); if (load) load.remove();
      if (!opened && window.HXCoach) { opened = true; window.HXCoach.open(); }
      window.renderAll();
    }
  }
  db.ref('config/teams').on('value', function (s) { TM = s.val() || {}; window._cfgTeamsLoaded = true; changed('teams'); });
  db.ref('scores').orderByKey().startAt(from).on('value', function (s) { allData = byDay(s.val()); changed('scores'); });
  db.ref('activities').orderByKey().startAt(from).on('value', function (s) { allActs = byDay(s.val()); changed('acts'); });
})();
