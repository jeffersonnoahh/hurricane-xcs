/**
 * Arus: BCA email bridge (Google Apps Script).
 *
 * Runs inside YOUR Google account. It reads BCA notification emails from your Gmail
 * and hands them to the Arus app when the app asks. Nothing is stored anywhere else.
 *
 * Setup (5 minutes, see finance/README.md for screenshots-free steps):
 *   1. Go to https://script.google.com -> New project -> paste this whole file.
 *   2. Change SECRET below to your own long random text.
 *   3. Deploy -> New deployment -> type "Web app"
 *        Execute as: Me      Who has access: Anyone
 *   4. Authorize (Google will warn "unverified app" because you wrote it: Advanced -> Go to project).
 *   5. Copy the Web app URL into Arus -> Settings -> BCA Sync, together with the SECRET.
 */

// Change this. The app must send the same value, so strangers who find the URL get nothing.
var SECRET = 'CHANGE-ME-to-a-long-random-text';

// Which emails count as BCA notifications. Adjust if your BCA emails come from another address.
var SEARCH = 'from:(bca.co.id OR klikbca.com OR mybca)';

// Never send more than this many emails per request.
var MAX_MESSAGES = 200;

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.token !== SECRET) return json_({ ok: false, error: 'bad token' });

  if (p.ping) return json_({ ok: true, ping: true });

  // since = epoch ms. Default: last 7 days. Never look back more than 90 days.
  var now = Date.now();
  var since = Number(p.since) || now - 7 * 864e5;
  since = Math.max(since, now - 90 * 864e5);
  var days = Math.ceil((now - since) / 864e5) + 1;

  var threads = GmailApp.search(SEARCH + ' newer_than:' + days + 'd', 0, 100);
  var out = [];
  for (var i = 0; i < threads.length && out.length < MAX_MESSAGES; i++) {
    var msgs = threads[i].getMessages();
    for (var j = 0; j < msgs.length && out.length < MAX_MESSAGES; j++) {
      var m = msgs[j];
      var t = m.getDate().getTime();
      if (t < since) continue;
      var body = m.getPlainBody() || m.getBody() || '';
      out.push({
        id: m.getId(),
        date: t,
        from: m.getFrom(),
        subject: m.getSubject(),
        body: body.slice(0, 6000)
      });
    }
  }
  out.sort(function (a, b) { return a.date - b.date; });
  return json_({ ok: true, now: now, emails: out });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run this once from the editor to check it finds your BCA emails (see View -> Logs). */
function testSearch() {
  var threads = GmailApp.search(SEARCH + ' newer_than:30d', 0, 10);
  threads.forEach(function (t) { Logger.log(t.getLastMessageDate() + '  ' + t.getFirstMessageSubject()); });
  Logger.log(threads.length + ' threads found');
}
