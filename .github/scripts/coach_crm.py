#!/usr/bin/env python3
"""Coach tab: CRM summary per seller.

Pulls the last few days of WhatsApp chats from the Sentaris CRM export API,
matches each CRM seller to a dashboard roster name, and saves a short summary
(counts + a to do list of customers) to Firebase:

    coach/crm          Hurricane (root namespace)
    maria/coach/crm    Maria dashboard
    calvin/coach/crm   Calvin dashboard

The Coach tab (js/coach.js) only reads that node, so it opens instantly.
Runs every 30 min from .github/workflows/coach-crm.yml. Needs SENTARIS_TOKEN.
Only customer name + last 4 WA digits are saved (the closing form already
stores the same), never message text.

Manual name fixes: put {"<crm seller>|<CRM TEAM>": "<sp>|<team>"} in
<ns>/coach/crmMap (value "-" = ignore that CRM account).
"""
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

FB = 'https://hurricane-scorecard-default-rtdb.firebaseio.com'
CRM = 'https://crm.sentaris.cloud/api/export'
TOKEN = os.environ.get('SENTARIS_TOKEN', '').strip()
DAYS_BACK = 3          # "since" for the CRM export (threads touched since then)
ACTIVE_DAYS = 7        # a chat counts as active if its last message is this recent
MAX_PAGES = 40         # 200 threads per page; the API allows 30 requests/min
PAGE_GAP = 2.1         # seconds between pages (stays under 30/min)
MAX_TASKS = 15

# CRM team -> dashboard namespace. Everything else is Hurricane (root).
NS_OF_TEAM = {'WILLY': 'maria', 'VIO': 'maria', 'MARIA': 'maria', 'KELVIN': 'maria', 'CALLVIN': 'calvin'}
# CRM team spelling -> Hurricane roster team
TEAM_ALIAS = {'CHRIS A': 'Christ A', 'CHRIS B': 'Christ B', 'REIVALDY': 'REI'}
CHANNEL = re.compile(r'shopee|tokopedia|tiktok|lazada|blibli|^live$', re.I)

STATUS = {'Hot Leads': 'hot', 'Warm Leads': 'warm', 'Test Drive': 'td', 'Baru': 'baru', 'Cold Leads': 'cold',
          'Dead Leads': 'dead', 'Sudah Beli': 'bought', 'Complaint': 'complaint', 'Luar Kota': 'luar', 'Pengecekan': 'cek'}
OPEN = {'hot', 'warm', 'td', 'baru', 'cold', 'complaint', 'cek', 'luar', 'other'}


def http(url, method='GET', body=None, headers=None, timeout=60, tries=5):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode()
    for i in range(tries):
        req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get('Retry-After') or 20)
                print(f'429, waiting {wait}s', flush=True)
                time.sleep(wait)
                continue
            if e.code >= 500 and i < tries - 1:
                time.sleep(2 ** i * 2)
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            if i < tries - 1:
                time.sleep(2 ** i * 2)
                continue
            raise
    raise RuntimeError('too many retries: ' + url)


def fb_get(path):
    return http(f'{FB}/{path}.json', timeout=30)


def fb_put(path, obj):
    http(f'{FB}/{path}.json?print=silent', method='PUT', body=obj,
         headers={'content-type': 'application/json'}, timeout=60)


def norm(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip().lower()


def lev1(a, b):
    """True when a and b differ by at most one edit."""
    if a == b:
        return True
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) > len(b):
        a, b = b, a
    i = j = diff = 0
    while i < len(a) and j < len(b):
        if a[i] != b[j]:
            diff += 1
            if diff > 1:
                return False
            if len(a) == len(b):
                i += 1
            j += 1
        else:
            i += 1
            j += 1
    return diff + (len(b) - j) + (len(a) - i) <= 1


def tok_score(tok, member):
    m = norm(member)
    mt = m.split(' ')
    if tok == m or tok in mt:
        return 3
    for x in [m] + mt:
        if len(tok) >= 3 and len(x) >= 3 and (x.startswith(tok) or tok.startswith(x)):
            return 2
        if len(tok) >= 4 and len(x) >= 4 and lev1(tok, x):
            return 2
    return 0


def parse_ts(s):
    try:
        return dt.datetime.fromisoformat(s)
    except Exception:
        return None


def load_threads():
    since = (dt.datetime.now(dt.timezone(dt.timedelta(hours=7))) - dt.timedelta(days=DAYS_BACK)).date().isoformat()
    hdr = {'Authorization': 'Bearer ' + TOKEN}
    out, cur, pages = [], None, 0
    while True:
        url = f'{CRM}/threads?since={since}' + (f'&cursor={cur}' if cur else '')
        d = http(url, headers=hdr, timeout=90)
        out.extend(d.get('threads') or [])
        pages += 1
        cur = d.get('next_cursor')
        if not cur or pages >= MAX_PAGES:
            break
        time.sleep(PAGE_GAP)
    print(f'CRM: {len(out)} threads in {pages} pages (since {since})', flush=True)
    return out


class Matcher:
    def __init__(self, ns, teams, overrides):
        self.ns = ns
        self.teams = {t: [m for m in (v or {}).get('m') or [] if m and not CHANNEL.search(str(m))] for t, v in (teams or {}).items()}
        self.over = overrides or {}
        self.lower_team = {norm(t): t for t in self.teams}

    def dash_team(self, crm_team):
        if not crm_team:
            return None
        if self.ns:                           # Maria / Calvin: one team ("Sales")
            return next(iter(self.teams), None)
        t = TEAM_ALIAS.get(crm_team.upper(), crm_team)
        return self.lower_team.get(norm(t))

    def match(self, seller, crm_team):
        """List of 'sp|team' keys for this CRM account (an account can be shared by 2 sellers)."""
        ov = self.over.get(f'{seller}|{crm_team}')
        if ov == '-':
            return []
        if ov:
            return [ov]
        home = self.dash_team(crm_team)
        keys = []
        for part in re.split(r'[,/&]+', str(seller or '')):
            toks = [t for t in re.split(r'[\s()]+', norm(part)) if len(t) >= 2]
            best = None
            for team, members in self.teams.items():
                for m in members:
                    s = max([tok_score(t, m) for t in toks] or [0])
                    same = team == home
                    if s < 2 or (not same and s < 3):   # other teams: exact name only
                        continue
                    cand = (s, same, m, team)
                    if best is None or cand[:2] > best[:2]:
                        best = cand
            if best:
                k = f'{best[2]}|{best[3]}'
                if k not in keys:
                    keys.append(k)
        return keys


def fkey(k):
    return re.sub(r'[.#$/\[\]]', '_', k)


def summarize(threads, now):
    c = {'chats7': 0, 'new7': 0, 'waiting': 0, 'waiting2h': 0, 'hot': 0, 'warm': 0, 'td': 0,
         'baru': 0, 'dead7': 0, 'bought7': 0, 'fup': 0}
    tasks, gaps = [], []
    for t in threads:
        last = parse_ts(t.get('last_msg_at'))
        if not last:
            continue
        h = (now - last).total_seconds() / 3600
        if h > ACTIVE_DAYS * 24:
            continue
        st = STATUS.get(t.get('status'), 'other')
        c['chats7'] += 1
        first = parse_ts(t.get('first_msg_at'))
        if first and (now - first).days < ACTIVE_DAYS:
            c['new7'] += 1
        if st in ('hot', 'warm', 'td', 'baru'):
            c[st] += 1
        if st == 'dead':
            c['dead7'] += 1
        if st == 'bought':
            c['bought7'] += 1
        name = re.sub(r'^[\W_]+$', '', str(t.get('customer_name') or '').strip())
        base = {'n': (name or 'Tanpa nama')[:40], 'w': str(t.get('phone_last4') or '')[-4:],
                's': st, 'h': round(h, 1), 'm': int(t.get('message_count') or 0)}
        if st in OPEN and t.get('last_sender') == 'customer':
            c['waiting'] += 1
            if h >= 2:
                c['waiting2h'] += 1
            if h <= 72:
                # hot leads first, then fresh chats (today), then older ones
                tasks.append(dict(base, k='reply', p=0 if st in ('hot', 'td', 'warm') else 1 if h <= 24 else 3))
            elif st in ('hot', 'warm', 'td'):
                tasks.append(dict(base, k='push', p=2))
        elif st in ('hot', 'warm', 'td') and h >= 24:
            tasks.append(dict(base, k='push', p=2))
        elif st in ('baru', 'cold') and t.get('last_sender') == 'seller' and 24 <= h <= 120:
            c['fup'] += 1
            tasks.append(dict(base, k='fup', p=4))
        # reply speed: customer turn -> next seller message, last 7 days only
        pending = None
        for msg in t.get('last_messages') or []:
            at = parse_ts(msg.get('at'))
            if not at or (now - at).days >= ACTIVE_DAYS:
                continue
            if msg.get('from') == 'customer':
                pending = pending or at
            elif msg.get('from') == 'seller' and pending:
                gaps.append((at - pending).total_seconds() / 60)
                pending = None
    tasks.sort(key=lambda x: (x['p'], x['h']))
    gaps.sort()
    c['replyMed'] = round(gaps[len(gaps) // 2]) if gaps else None
    c['replyN'] = len(gaps)
    return {'c': c, 't': [{k: v for k, v in x.items() if k != 'p'} for x in tasks[:MAX_TASKS]]}


def main():
    if not TOKEN:
        sys.exit('SENTARIS_TOKEN is not set')
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=7)))
    threads = load_threads()
    matchers = {}
    for ns in ('', 'maria', 'calvin'):
        p = (ns + '/') if ns else ''
        matchers[ns] = Matcher(ns, fb_get(p + 'config/teams'), fb_get(p + 'coach/crmMap'))

    # bucket threads per namespace and per seller
    buckets = {ns: {'sellers': {}, 'unmatched': {}, 'teams': {}} for ns in matchers}
    for t in threads:
        team = (t.get('team') or '').strip()
        ns = NS_OF_TEAM.get(team.upper(), '')
        m = matchers[ns]
        keys = m.match(t.get('seller') or t.get('account_name'), team)
        dteam = m.dash_team(team)
        b = buckets[ns]
        if dteam:
            b['teams'].setdefault(dteam, []).append(t)
        if keys:
            for k in keys:
                b['sellers'].setdefault(k, {'acc': set(), 'th': []})
                b['sellers'][k]['acc'].add(t.get('account_name') or '')
                b['sellers'][k]['th'].append(t)
        else:
            u = f"{t.get('seller') or t.get('account_name') or '?'}|{team or '-'}"
            b['unmatched'].setdefault(u, {'team': dteam, 'th': []})['th'].append(t)

    for ns, b in buckets.items():
        out = {'updatedAt': int(now.timestamp() * 1000), 'sellers': {}, 'teams': {}, 'unmatched': {}}
        for k, v in b['sellers'].items():
            sp, team = k.split('|', 1)
            s = summarize(v['th'], now)
            s.update(sp=sp, team=team, acc=sorted(a for a in v['acc'] if a))
            out['sellers'][fkey(k)] = s
        for team, th in b['teams'].items():
            out['teams'][fkey(team)] = dict(summarize(th, now)['c'], team=team)
        for u, v in b['unmatched'].items():
            s = summarize(v['th'], now)
            out['unmatched'][fkey(u)] = {'name': u, 'team': v['team'], 'c': s['c'], 't': s['t'][:8]}
        path = (ns + '/' if ns else '') + 'coach/crm'
        if os.environ.get('DRY_RUN'):
            json.dump(out, open(os.environ['DRY_RUN'] + (ns or 'root') + '.json', 'w'), ensure_ascii=False, indent=1)
        else:
            fb_put(path, out)
        print(f"{path}: {len(out['sellers'])} sellers, {len(out['unmatched'])} unmatched accounts", flush=True)
        for u in out['unmatched'].values():
            print('   unmatched:', u['name'], '->', u['team'], u['c']['chats7'], 'chats', flush=True)


if __name__ == '__main__':
    main()
