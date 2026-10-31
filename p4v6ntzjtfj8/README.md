# Arus Money

A personal money tracker (wallets, categories, budgets, reports) that **adds your BCA transactions automatically from BCA's notification emails**.

Not part of the sales dashboards. It lives in this folder only and shares no data with them. The folder name is random on purpose so the page is hard to find; search engines are told not to index it.

## How it works

```
myBCA transaction ──► BCA sends email ──► your Gmail
                                              │
                         Google Apps Script (runs in YOUR Google account, Code.gs)
                                              │  only answers when the secret matches
                                              ▼
                     Arus app on your phone asks "any new BCA emails?"
                        ──► reads amount + merchant ──► subtracts from BCA wallet
```

* Your money data is stored **only on your phone** (browser storage). It does not go to Firebase or any server.
* The app checks for new emails when you open it and every 5 minutes while it is open.
* Each email is processed once, so syncing again never creates duplicates. Deleting a synced transaction keeps it deleted.
* Emails with no clear amount land in **Settings → Emails I couldn't read**, so nothing slips through silently.

## Setup

### 1. Make sure BCA emails you
In myBCA / KlikBCA, turn on email notification for transactions, and confirm a test transaction shows up in Gmail.

### 2. Create the email bridge (5 minutes)
1. Open https://script.google.com → **New project**.
2. Delete the sample code and paste everything from `apps-script/Code.gs`.
3. Change `SECRET` to your own long random text (e.g. 30 random letters and numbers).
4. Optional check: choose `testSearch` in the toolbar → **Run** → View logs. It should list your BCA emails. If it finds 0, open one BCA email in Gmail, look at the sender address, and change `SEARCH` to match it.
5. **Deploy → New deployment →** gear icon → **Web app**
   * Execute as: **Me**
   * Who has access: **Anyone**
6. Authorize. Google warns "unverified app" because you wrote it yourself: **Advanced → Go to (project name)**.
7. Copy the **Web app URL** (ends in `/exec`).

### 3. Connect the app
1. Open the app → **Settings → BCA email sync**.
2. Paste the URL and the same SECRET → **Sync now**.
3. Set the BCA wallet's starting balance (Settings → Wallets → ✎) to what myBCA shows today.

### 4. Put it on your home screen
* iPhone (Safari): Share → **Add to Home Screen**.
* Android (Chrome): ⋮ → **Add to Home screen**.

## Tips
* **Auto category:** merchants are matched against rules (e.g. "indomaret" → Shopping). When you change the category of a BCA transaction, the app offers to remember it for that merchant.
* **Reader missed something?** Settings → Test the reader: paste the email (subject on the first line). If it isn't recognised, share that sample (hide your account number) so `js/bca-parser.js` can learn the format.
* **Back up** with Settings → Export now and then. Clearing browser data erases everything on that phone.

## Files
| File | What it does |
|---|---|
| `index.html`, `css/style.css`, `js/app.js` | The app |
| `js/bca-parser.js` | Reads a BCA email into amount, type, merchant, reference |
| `apps-script/Code.gs` | The Gmail bridge you paste into Google Apps Script |

No build step. When changing css/js, bump the `?v=` in `index.html`.
