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

## Form Closing (js/closing.js + css/closing.css — Hurricane since 2026-11-06; Maria & Calvin since 2026-11-07, one shared file)

One input per closing: customer (full name + last 4 WA digits, both required) · "Ada test" (tested products ≥1) or "Langsung order" · closed products (the WHOLE catalogue is always shown; tested ones carry a TEST mark; a closed product that was not tested is automatically an add-on, labelled "tanpa test") with qty + optional custom price · SPV ("Tanpa SPV" or exactly 1 name) · **Jenis order** = 4 checkboxes, each with an ⓘ button that shows its definition (Jeff's wording, 2026-11-07): Test drive (two-way bound to "Ada test" — same answer, never contradictory), Cross sell ("awalnya sudah pasti beli 1 produk, lalu ikut beli produk tipe lain"), Upsell ("sudah yakin 1 produk, akhirnya beli produk di atasnya"), Repeat order · date (today/yesterday/≤7 days back). If the closing has 2+ product families and Cross sell is unticked, a blue reminder asks "apakah ini cross sell?" — it never ticks it by itself.

- **Data:** still normal `scores/{date}` rows, ONE ROW PER CLOSED PRODUCT, all written in one `transaction()` (idempotent by `orderId`). Legacy fields unchanged, so omzet/ranking/HCC keep working. Extra fields: `orderId` (same on all rows of one closing), `customer`, `wa4`, `custKey` (`name lowercase|wa4`), `tested[]`, `addon` (bool = bought without test), `spv` (`'Tanpa SPV'` or name), `test` (`'ya'|'tidak'`), `inputBy`, `src:'closing'`. `saleType` is computed PER ROW: tested product → `testdrive`; no test / untested add-on → `complete` (shown as **"Langsung Order"** — only for `src:'closing'` rows; legacy rows and the old drawer keep "Order Complete", where sellers often tick it together with Test Drive); if "Ada test" but none of the tested products was bought, the primary row still gets `testdrive`. `cross`/`upsell`/`repeat` ONLY when the seller ticks them (since cl6; before that `cross` was automatic by family): `cross` → rows whose family ≠ the primary row, else (one family) every row except the primary, else (single product) that row; `upsell` → primary row only (primary = most valuable non-add-on line); `repeat` → all rows. Export "Closing" sheet: Tipe = "Test drive"/"Langsung order", then Cross Sell · Upsell · Repeat (Ya/Tidak). `priceMode:'custom'` = the "Harga custom" flag.
- **Config:** `config/closing` = `{mode:'off'|'pilot'|'all', pilot:[names], spv:[names], pinHash}` — Admin → "Form Closing (baru)". mode/spv/pinHash written ONLY with `db.ref('config/closing').update(...)`; the pilot list changes one name at a time with a `transaction()` on the leaf `config/closing/pilot` (two admins can't erase each other). `pinHash` = SHA-256 of the leader PIN (a UI gate only — the DB is public; never store/echo the PIN itself). No `config/closing` node = mode pilot with nobody → old flow untouched, no Export button.
- **Opening:** intercepts `body.premium-form-open` (premium-ui `openEntry`) on the open transition only. Phone owner remembered per phone (`localStorage hx-closing-me` = `sp|team`, re-checked against the live roster every open: renamed/left → picker, moved team → corrected). Pilot owners go straight to the new form; others get the old drawer (with a "Pakai form closing baru" banner when a pilot name is selected). In pilot mode the new form has "Pakai form lama" (one-shot bypass) for non-pilot sellers / dates > 7 days. Mode `all` = everyone gets the new form. "Ganti" picks the seller for THIS closing only (leader logging for a member); `inputBy` = phone owner. Leader phones: first-time picker offers "Leader <name>" — teams with the same leader are grouped (team name minus a trailing " A"/" B": Christ A + Christ B = "Leader Christ"), stored `@leader|<tim>,<tim>` (older single-team phones are upgraded automatically) ( Christ/Livia/Valen aren't roster members, Agung is a hidden non-selling lead) → every open asks "Closing ini untuk sales siapa?" (own team first), `inputBy:'Leader <tim>'`. Marketplace channels (`HX.isChannel`) and any seller name containing shopee/tokopedia/tiktok/lazada/blibli (e.g. "Rei Shopee") have WA optional (export shows `-`).
- **Fix a wrong entry:** the old drawer's log (with ✕) is unreachable when the new form is on, so the form has "Lihat / hapus input 24 jam terakhir": rows with `ts` in the last 24 h for the PHONE OWNER (own sales + rows this phone entered, `inputBy`; NOT whoever is picked via Ganti) — leader phone: all its teams, old-form rows too, also reachable from the member picker, one item per closing, "Hapus" removes all its product rows in ONE transaction filtered by `ts` (same pattern as `_txnDeleteByTs`). Older: Admin → Edit Records.
- **Saving:** close/Back blocked while saving; after 8 s (or when `.info/connected` is false) the form shows "Belum tersambung" + "Tutup form, simpan saat ada sinyal" (the SDK queues the transaction; it is lost only if the app is killed). orderId is reused only when the content matches the failed attempt.
- **Export:** Monthly Recap → "Export closing" (leader PIN; admin skips) → .xlsx (sheets `Closing` = 1 row/transaction, `Per Produk` = 1 row/product; SheetJS 0.18.5 lazy from cdnjs) or CSV (one file; `;` separator + BOM for Indonesian Excel; WA as `="0812"`; text starting with = + @ gets a `'`). "Produk Closing" = everything bought; "Produk Tambahan (tanpa test)" = the untested subset. Never blank cells: `Tanpa SPV`, `Tanpa test`, `-` for old-form rows.
- **One file, three dashboards (since 2026-11-07):** `js/closing.js` and `css/closing.css` are BYTE-IDENTICAL in hurricane-xcs, maria-team and calvin-team. Edit in hurricane-xcs, run the Hurricane suite (`closing/test.mjs`) and the Maria/Calvin suite (`ORG=maria|calvin node closing/test_org.mjs`, 31 checks each), then copy both files to the other two repos and bump `closing.js?v=` / `closing.css?v=` in all three index.html. Per-dashboard behaviour comes from `org()` = `window.DATA_NS` read at USE time ('' Hurricane, 'maria', 'calvin' — in Maria it is only set inside `window.onload`, after closing.js has loaded): Maria/Calvin have one team "Sales", so leader phones are "Leader Maria" / "Leader Calvin" (`ORG_LEAD`; Hurricane groups by team name, Christ A + B → "Leader Christ"); export file `closing_<maria|calvin|hurricane>_…`. All reads/writes go through `window.db.ref` (namespaced by app.js); only `.info/connected` bypasses it (it calls the SDK prototype `ref` — app.js puts its namespace wrapper as an own property on that same instance, so `firebase.database().ref` would be wrapped too). SPV default = the same 8 names on all three (Jeff, 2026-11-07); each dashboard's Admin can change its own list (`<ns>/config/closing/spv`). Maria/Calvin app.js got the same 3 display patches (entry log customer + SPV, "Langsung Order" label for `src:'closing'`).
- **CSS prefix is `hxk-`** — `hxc-` is already taken by fx-card.css (a `.hxc-chips` clash clipped the chips once).
- **No full repaint on `change`/blur** of text/date inputs — WebKit swallows the next tap (the click target is replaced between press and release). Update in place (`warnText`, `refreshFoot`).
- Test: scratchpad `closing/test.mjs` (Playwright WebKit, Firebase writes stubbed; 191 checks incl. 3 review rounds, leaders/channels, delete, guide review, order types/ⓘ (block 9); `CLOSING_JS=<file>` serves another closing.js for A/B runs).

## Porting a change to all three dashboards

1. Implement + verify in one repo (usually hurricane-xcs).
2. Port via a **count-asserted patch script** (Python: assert exact number of replacements per file, write atomically) — the codebases are identical-lineage but not byte-identical (branding, DATA_NS, roster, password).
3. `node --check js/app.js` in each repo → bump `?v=` in each index.html → commit & push each → verify each live URL.

## Coach (js/coach.js + css/coach.css + functions/api/coach.js + .github/scripts/coach_crm.py — Hurricane since 2026-11-09)

Evaluation + to do list per seller, team view per leader. Entry: "Coach" card above the omzet hero on the dashboard, and first button in the More sheet.

- **Who:** same phone owner as Form Closing (`localStorage hx-closing-me`, `sp|team` or `@leader|TeamA,TeamB`). No owner → picker (sets it). "Lihat orang lain" only views.
- **Evaluation (browser, live, no writes):** this month from `scores` (omzet vs `_warnThresh.rev` prorated by date, closings = distinct `orderId||ts`, test drives), last 7 days from `activities` (avg chats/calls/fups per reported day vs `_warnThresh`, callback = calls/chats capped 100%, missed reports = due days without a report; day D is due D+1 at 14:00), team medians, CRM. Score /100: omzet 30, calls 18, chats 12, fups 12, callback 13, reports 10, CRM waiting 5. Gaps ranked by severity → "Kenapa skor segini" + to dos. Ticks are per phone (`hx-coach-done|date|who`).
- **CRM:** `.github/workflows/coach-crm.yml` runs `.github/scripts/coach_crm.py` every 30 min 07:00 to 22:59 WIB (GitHub secret `SENTARIS_TOKEN`; schedules only run from `main`). It pulls 3 days of Sentaris threads (~17 pages, 2.1 s apart, API limit 30/min), matches CRM seller → roster (exact name, prefix, 1 typo; other teams exact only; "A, B" = shared account) and PUTs `coach/crm`, `maria/coach/crm`, `calvin/coach/crm` (derived node, safe to overwrite). Fix a wrong match in `<ns>/coach/crmMap` `{"<crm seller>|<CRM TEAM>": "sp|team"}` (`"-"` = ignore). Only customer name + last 4 WA digits are stored, never message text. Run by hand: `SENTARIS_TOKEN=… python3 .github/scripts/coach_crm.py` (`DRY_RUN=/path/prefix_` writes JSON files instead).
- **AI:** "Tanya Coach AI" → `POST /api/coach` (Pages Function, listed in `_routes.json`) → command center `/api/ai` server to server (Claude Haiku, max 700 tokens, fixed Indonesian coach prompt, no budget advice). Same summary is cached 6 h. No API key in this repo.
- Maria/Calvin: CRM data is already written for them; porting coach.js needs the same 3 files + index.html tags (coach.js reads `coach/crm` through the namespaced `db.ref`).
