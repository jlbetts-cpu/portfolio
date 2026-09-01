#!/usr/bin/env python3
"""Write data/contributions.json from Jayden's public GitHub contribution graph.

WHY THIS IS A TOOL AND NOT A FETCH IN THE PAGE. GitHub's contribution calendar
is served as HTML from /users/<login>/contributions and is CORS-blocked, and the
GraphQL API that returns it as data needs a token — which cannot be shipped in a
static site. So the graph is fetched HERE, committed as JSON, and rendered
client-side from that.

WHICH MEANS IT CAN GO STALE, and a panel that looks live while being a stale
snapshot is worse than no panel — that was one of the three arguments that
parked this idea in August. The mitigations are both in the output: `generated`
is written into the JSON and the page is expected to show it, and re-running
this is one command. Do not render this without the date.

    python3 tools/fetch-contributions.py            # default login
    python3 tools/fetch-contributions.py --login X  # someone else

Parsing note: GitHub's cells used to carry `data-count`. They do not any more —
they carry `data-level` (0-4) and `data-date`. A grep for the old attribute
returns zero and reads as "no contributions", which is exactly the wrong
conclusion. Levels are buckets, not counts, so this reports ACTIVE DAYS and the
level histogram rather than inventing a commit total it cannot know.
"""
import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import date, datetime

LOGIN = "jlbetts-cpu"
URL = "https://github.com/users/%s/contributions"
OUT = "data/contributions.json"


def fetch(login):
    req = urllib.request.Request(
        URL % login,
        headers={"User-Agent": "jaydenbetts-portfolio-build/1.0 (+https://github.com/%s)" % login},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        if r.status != 200:
            raise SystemExit("GitHub returned %s for %s" % (r.status, login))
        return r.read().decode("utf-8", "replace")


def parse(html):
    """(date, level) per day. Tolerates either attribute order."""
    cells = re.findall(r'data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"', html)
    if not cells:
        flipped = re.findall(r'data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"', html)
        cells = [(d, l) for l, d in flipped]
    if not cells:
        raise SystemExit(
            "no calendar cells found — GitHub's markup has changed again. "
            "Do NOT ship a zero: check the page by hand before trusting this."
        )
    return sorted({d: int(l) for d, l in cells}.items())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--login", default=LOGIN)
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()

    days = parse(fetch(a.login))
    active = [(d, l) for d, l in days if l > 0]
    hist = {}
    for _, l in days:
        hist[l] = hist.get(l, 0) + 1

    payload = {
        "login": a.login,
        "generated": date.today().isoformat(),
        "source": URL % a.login,
        "note": "level is GitHub's 0-4 bucket, not a commit count",
        "days": [{"d": d, "l": l} for d, l in days],
        "activeDays": len(active),
        "totalDays": len(days),
        "levels": {str(k): hist.get(k, 0) for k in range(5)},
        "first": days[0][0],
        "last": days[-1][0],
    }

    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(payload, f, indent=1)
        f.write("\n")

    print("  wrote %s" % a.out)
    print("  %s: %d active days of %d, %s .. %s"
          % (a.login, payload["activeDays"], payload["totalDays"], payload["first"], payload["last"]))
    print("  levels: %s" % payload["levels"])
    if payload["activeDays"] == 0:
        print("  REFUSING TO BE USEFUL: zero active days almost certainly means the")
        print("  commit email is not verified on the account, not that he did nothing.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
