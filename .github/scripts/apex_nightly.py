"""Apex nightly safety copy (runs on GitHub Actions at 01:00 WIB).

Copies each encrypted Apex cloud backup (/apex/<id>) into that day's snapshot
(/apex/<id>_h/<YYYY-MM-DD>) and removes snapshots older than 30 days.
It only moves encrypted data: it has no key and cannot read anything.
Touches only /apex/... paths (never the Hurricane dashboard data).
"""
import json, os, sys, urllib.request, datetime

DB = os.environ.get("APEX_DB", "https://hurricane-scorecard-default-rtdb.firebaseio.com").rstrip("/")
KEEP_DAYS = 30
TIMEOUT = 30


def req(method, path, body=None):
    data = None if body is None else body.encode()
    r = urllib.request.Request(f"{DB}/apex/{path}.json" + ("?print=silent" if method != "GET" else ""), data=data, method=method)
    with urllib.request.urlopen(r, timeout=TIMEOUT) as resp:
        return resp.read().decode()


def shallow(path):
    r = urllib.request.Request(f"{DB}/apex{('/' + path) if path else ''}.json?shallow=true")
    with urllib.request.urlopen(r, timeout=TIMEOUT) as resp:
        j = json.loads(resp.read().decode() or "null")
    return sorted(j.keys()) if isinstance(j, dict) else []


def main():
    wib = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=7)
    day = (wib - datetime.timedelta(hours=2)).strftime("%Y-%m-%d")  # at 01:00 WIB this is the day that just ended
    cut = (wib - datetime.timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d")
    ids = [k for k in shallow("") if not k.endswith("_h") and len(k) >= 16]
    print(f"{len(ids)} backup(s); snapshot day {day}; pruning before {cut}")
    for i in ids:
        main_blob = req("GET", i)
        try:
            j = json.loads(main_blob)
        except ValueError:
            continue
        if not isinstance(j, dict) or "ct" not in j:
            continue
        req("PUT", f"{i}_h/{day}", main_blob)
        for k in shallow(f"{i}_h"):
            if k < cut:
                req("DELETE", f"{i}_h/{k}")
        print(f"  {i[:6]}…: snapshot saved")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # never fail loudly with data in logs
        print("nightly copy failed:", type(e).__name__)
        sys.exit(1)
