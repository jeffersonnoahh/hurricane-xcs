# Hurricane Sales Dashboards — System Guide

> **THIS REPO: Hurricane XCS** — live at https://hurricane-xcs.pages.dev — Firebase **root** namespace.

Three near-identical static sales dashboards, one per sales organization. Same codebase lineage, same features; they differ only in branding, roster, admin password, and Firebase namespace. **A bug fixed or feature added in one must usually be ported to all three.**

| Dashboard | URL | Local repo | GitHub | Firebase namespace | Admin pwd |
|---|---|---|---|---|---|
| Hurricane XCS | hurricane-xcs.pages.dev | `~/Projects/hurricane-xcs` | `jeffersonnoahh/hurricane-xcs` | *(root)* | `hurricane2026` |
| Maria Team | maria-team.pages.dev | `~/Projects/maria-team` | `jeffersonnoahh/maria-team` | `maria/` | `maria2026` |
| Calvin Team | callvin-team.pages.dev | `~/Projects/calvin-team` | `jeffersonnoahh/callvin-team-` (typo is real) | `calvin/` | `calvin2026` |

## Architecture

Pure static site — **no build step, no bundler, no backend server**. Everything runs in the browser and talks straight to Firebase.

```
index.html          all pages/panels in one file (show/hide per section)
css/style.css       main styles + "2026 PRODUCT REDESIGN" override block
css/premium.css     premium mobile app-shell (bottom nav, FAB, sheets)
js/app.js           ALL logic (~3,400 lines): Firebase, rendering, admin, aggregation
js/premium-ui.js    mobile shell behavior (nav, More sheet)
_headers            Cloudflare Pages cache headers (the real ones)
netlify.toml        LEFTOVER — Cloudflare ignores it. Do not edit expecting effect.
```

## Hosting & deploy (Cloudflare Pages)

- Push to `main` on GitHub → Cloudflare Pages auto-builds & deploys (~1 min). That is the entire pipeline; there is no CLI deploy step.
- **Caching:** `_headers` sets `Cache-Control: no-cache, must-revalidate` site-wide. Additionally, css/js are referenced with `?v=` version strings in index.html (e.g. `js/app.js?v=20260719-saletype1`). **Every time you change a css/js file, bump its `?v=` in index.html** — this is what guarantees phones pick up the new code.
- Pre-push check: `node --check js/app.js` (no build means no compiler to catch syntax errors).
- Verify a deploy by `curl`-ing the live URL for the new string, not by trusting the Cloudflare UI. Rollout can lag ~1 min; poll.
- Data-only changes (Firebase edits) need **no deploy** — the site reads live data.

## Database: one shared Firebase Realtime Database

Project `hurricane-scorecard`, URL `https://hurricane-scorecard-default-rtdb.firebaseio.com`. Rules are public read/write (security = obscurity + admin password gate in the UI only). The web app loads the Firebase **compat SDK 9.23.0 from CDN** in index.html and initializes in js/app.js (~line 36).

**Namespacing:** all three dashboards share this ONE database. Maria/Calvin isolate their data by prefixing every path via a wrapper in js/app.js:

```js
const DATA_NS='maria';   // '' for Hurricane (root), 'maria' or 'calvin' for clones
window.db.ref=(p)=>_origRef(DATA_NS?(p?DATA_NS+'/'+p:DATA_NS):p);
```

So Hurricane data lives at `/scores`, Maria's at `/maria/scores`, Calvin's at `/calvin/scores`. Same tree shape in each namespace:

```
config/
  teams/{TeamName}/m        array of member names  ← LIVE roster (code TM is fallback only)
  products/{ProductName}    unit price             ← LIVE catalog (code P is fallback only)
  chatTarget, revTarget, deadlineHour
scores/{YYYY-MM-DD}         array of sale entries:
                            {sp, team, prod, units, revenue, saleType:[...], custom?, ts}
activities/{YYYY-MM-DD}     array of activity entries:
                            {sp, team, calls, chats, fups, isLate, notes, ts}
omset/{YYYY-MM-DD}          manual omset overrides
briefing/{YYYY-MM-DD}       daily briefing text
```

- **Salesperson identity is the composite `sp + '|' + team`** everywhere in app.js. The same name in two teams = two different people (this caused ghost-duplicate bugs; be careful when moving/merging people).
- **Roster vs records:** dropdowns/tracker/warnings build from `config/teams`; historical views (Monthly Recap etc.) build from `scores`/`activities` records. So removing someone from the roster keeps all their history — that is the intended way to off-board someone.

## How the app fetches & writes

- Reads: SDK listeners (`ref.on('value')` / `once`) — the dashboard is live, no polling.
- **Appends to day arrays (scores/activities) MUST use `ref.transaction()`** — atomic append, never read-modify-write the whole day. (A whole-day `.set()` from a stale phone wiped a day of order logs on 2026-07-18.)
- **Config writes MUST use `.update()`, never `.set()`** on `config` — a whole-node `set()` in `saveTargets` wiped teams+products on 2026-07-11. A write gate `window._cfgTeamsLoaded` blocks roster edits before config has loaded.
- Admin password: checked client-side against `DEFAULT_ADMIN_PWD` in app.js (~line 2360), overridable per-browser via `localStorage['hxcs_admin_pwd']`. That's the only meaningful localStorage state; all shared data is in Firebase.

## Direct REST access (fastest way to query/fix data)

Firebase RTDB speaks plain REST — use `curl` or Python urllib (ALWAYS with a socket timeout; a no-timeout fetch of `/scores.json` once hung for minutes):

```bash
# read (prepend /maria or /calvin for the clones)
curl -s "https://hurricane-scorecard-default-rtdb.firebaseio.com/config/teams.json"
curl -s "https://hurricane-scorecard-default-rtdb.firebaseio.com/scores/2026-08-04.json"

# targeted write — smallest possible path, print=silent
curl -s -X PUT -d '["name1","name2"]' \
  "https://hurricane-scorecard-default-rtdb.firebaseio.com/config/teams/Valen/m.json?print=silent"
```

This is how "who did X / fix this record / move this person" tasks are done — script it, verify by re-reading, never touch a wider path than needed.

## Safety rules (written in blood — each one is a past incident)

1. **Never `.set()` a whole node** (`config`, a whole day, whole `teams`). Use `update()`, transactions, or the narrowest possible REST path.
2. **Back up before any destructive data edit:** dump the affected node to the scratchpad (`backup_*.json`) first. An hourly full-DB backup job also snapshots to `~/hurricane-backups/` (running since 2026-07-18).
3. **Verify after every write** — re-read the node and print proof.
4. Known still-fragile spots: `saveTeamsToFirebase` still writes the whole roster object (a stale admin tab once dropped Rico Sby), and the Admin "Edit Records" panel still uses old-style writes. Harden if touched.

## Domain logic worth knowing

- **Sale types** (`saleType` array): `upsell`, `cross`, `repeat`, `testdrive`, `complete`. Logging a sale is **blocked unless ≥1 is selected**. Definitions: *testdrive* = SPV sent to demo the product then closing; *complete* = customer confirms buy directly; *upsell* = SPV upsells to a higher package.
- **Activity exclusions:** `_ACT_EXCLUDE=['Live tiktok','Shopee live']` — these channels don't log calls/follow-ups and are skipped in not-reported/tracker views. `_WARN_EXCLUDE` adds `Tokopedia`/`Shopee` for the Warning page.
- Custom-price sales: aggregation tracks `{u,r}` (units+revenue) per product — never recompute revenue from catalog price × units.
- Orphan products (in records but deleted from catalog) must be guarded in aggregations (`if(!p[e.prod])p[e.prod]={...}`) — missing guards once crashed the whole dashboard.

## Porting a change to all three dashboards

1. Implement + verify in one repo (usually hurricane-xcs).
2. Port via a **count-asserted patch script** (Python: assert exact number of replacements per file, write atomically) — the codebases are identical-lineage but not byte-identical (branding, DATA_NS, roster, password).
3. `node --check js/app.js` in each repo → bump `?v=` in each index.html → commit & push each → verify each live URL.
