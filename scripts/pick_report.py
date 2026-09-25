"""Pick the report to publish from one or more tracker feeds.

    python scripts/pick_report.py OUT.json FEED1.json [FEED2.json ...]

Each feed is a guild spreadsheet's public report (`?` feed of its web app).
Unusable feeds (failed fetch, wrong shape, private fields) are skipped. The
best report wins:
  1. one that knows which guild is ours (usKnown) beats one that doesn't,
  2. then the most recent war (the day in its war key),
  3. then the most recent capture (generatedAt).
If no feed is usable, OUT is left untouched (the last good report stays live).
"""
import json
import sys


def load(path):
    try:
        with open(path, encoding="utf-8") as fh:
            payload = json.load(fh)
    except (OSError, ValueError):
        return None
    if not isinstance(payload, dict) or payload.get("status") not in ("ok", "no_report"):
        return None
    if payload["status"] == "ok":
        r = payload.get("report")
        if not isinstance(r, dict) or "players" in r or "forecast" in r:
            return None  # unsafe: private fields must never be published
        if not isinstance(r.get("us"), dict) or not isinstance(r.get("them"), dict):
            return None
    return payload


def rank(payload):
    if payload["status"] != "ok":
        return (-1, -1, -1)
    r = payload["report"]
    key = str(r.get("warKey", ""))
    day = int(key.rsplit("@", 1)[1]) if "@" in key and key.rsplit("@", 1)[1].isdigit() else 0
    return (1 if r.get("usKnown") else 0, day, int(r.get("generatedAt") or 0))


def pick(paths):
    feeds = [p for p in (load(x) for x in paths) if p is not None]
    return max(feeds, key=rank) if feeds else None


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    best = pick(argv[2:])
    if best is None:
        print("No usable feed; keeping the current report.")
        return 0
    with open(argv[1], "w", encoding="utf-8") as fh:
        json.dump(best, fh, ensure_ascii=False)
    r = best.get("report") or {}
    print("Publishing:", best["status"], r.get("date", ""), (r.get("us") or {}).get("name", ""),
          "vs", (r.get("them") or {}).get("name", ""), "| usKnown", r.get("usKnown"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
