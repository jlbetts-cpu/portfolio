#!/usr/bin/env python3
"""Write data/commit-history.json from THIS repository's own git log.

WHY THIS REPLACED THE GITHUB FETCHER.  The first cut of the Play page's commit
band drew GitHub's 12-month contribution calendar, and the picture was weak in a
way no caption could rescue:

    last 367 days   52 active   14%          two empty stretches, 130 and 118 days
    last  90 days   33 active   37%
    last  45 days   33 active   73%

-- eight idle months and then everything bunched against the right edge.  That is
the same objection that parked this feature in August wearing a different hat, and
an honest caption under a weak picture is still a weak picture on a portfolio.

THIS REPOSITORY'S OWN HISTORY IS STRICTLY BETTER ON EVERY AXIS.  It is the record
of the page the visitor is standing on rather than a cross-account aggregate; it
has no gaps, because the project did not exist before 20 July; and it comes from
`git log`, so there is no third party, no token, no CORS, and nothing that can be
out of date except this file's own snapshot.

IT STILL HAS TO BE A BUILD-TIME TOOL.  A browser cannot run git.  So the calendar
is computed here, committed as JSON, and rendered client-side from that -- which
means it CAN go stale, and the mitigation is unchanged and non-negotiable:
`generated` is written into the output, play-contributions.js renders nothing at
all without it, and tools/contributions-band-contract.py fails if either half of
that stops being true.  Re-running this is one command.

    python3 tools/build-commit-calendar.py
    python3 tools/build-commit-calendar.py --print   # do not write, just show

THE LEVELS ARE FIXED BUCKETS, NOT QUARTILES, and that is deliberate.  A ramp
derived from the data re-shades the whole of history every time you commit: the
same day is level 3 today and level 2 next week, so the picture changes meaning
while the past does not.  Fixed thresholds mean a square's darkness is a fact
about that day and nothing else.  They are written into the output so the page can
describe them and so a change to them is visible in a diff of the data.

WHAT WENT WITH THE FETCHER, recorded here so it is not rediscovered the hard way:
GitHub's contribution cells used to carry `data-count` and have not for a long
time -- they carry `data-level` (0-4) and `data-date`.  A grep for the old
attribute returns zero and reads as "no contributions", which is exactly the wrong
conclusion.  Anyone bringing a GitHub graph back needs to know that.  Note also
that its levels were BUCKETS with no counts behind them, which is why the old
caption could only say "not a commit count".  This tool has the real numbers.
"""
import argparse
import collections
import json
import os
import subprocess
import sys
from datetime import date, datetime, timedelta

OUT = "data/commit-history.json"

# commits on a day -> level.  The lower bound of each level, 1..4.
# Chosen against the shape of the real history rather than picked round: at the
# time of writing they split the 32 active days 5 / 11 / 8 / 8, which is a ramp
# that uses all four steps instead of piling into one.
THRESHOLDS = (1, 10, 25, 50)


def level(n):
    if n <= 0:
        return 0
    step = 0
    for i, low in enumerate(THRESHOLDS):
        if n >= low:
            step = i + 1
    return step


def repo_root():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(here)


def git_days(root):
    """{'YYYY-MM-DD': commits}. Author date, --date=short, so a day is the day it
    was to whoever made the commit rather than to UTC."""
    out = subprocess.run(
        ["git", "-C", root, "log", "--date=short", "--pretty=%ad"],
        capture_output=True, text=True, check=True).stdout
    days = collections.Counter(line.strip() for line in out.splitlines() if line.strip())
    if not days:
        raise SystemExit("git log returned no commits -- refusing to ship an empty calendar")
    return days


def build(root):
    counts = git_days(root)
    first = min(counts)
    last = max(counts)
    start = datetime.strptime(first, "%Y-%m-%d").date()
    end = datetime.strptime(last, "%Y-%m-%d").date()

    days = []
    streak = longest = 0
    span = (end - start).days + 1
    for i in range(span):
        d = start + timedelta(days=i)
        key = d.isoformat()
        n = counts.get(key, 0)
        days.append({"d": key, "n": n, "l": level(n)})
        if n:
            streak += 1
            longest = max(longest, streak)
        else:
            streak = 0

    active = sorted(n for n in counts.values() if n > 0)
    busiest = max(counts.items(), key=lambda kv: kv[1])
    histogram = collections.Counter(day["l"] for day in days)

    return {
        "generated": date.today().isoformat(),
        "source": "git log in this repository",
        "note": ("n is the day's real commit count; l is a fixed bucket of it "
                 "(see levelFloors), not a share of anything"),
        "levelFloors": list(THRESHOLDS),
        "days": days,
        "commits": sum(counts.values()),
        "activeDays": len(active),
        "totalDays": span,
        "longestStreak": longest,
        "medianActive": active[len(active) // 2],
        "busiest": {"d": busiest[0], "n": busiest[1]},
        "levels": {str(k): histogram.get(k, 0) for k in range(5)},
        "first": first,
        "last": last,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", dest="show", action="store_true",
                    help="print the summary and write nothing")
    args = ap.parse_args()

    root = repo_root()
    data = build(root)

    summary = ("%(commits)d commits, %(activeDays)d of %(totalDays)d days "
               "(%(pct).0f%%), longest run %(longestStreak)d, median %(medianActive)d "
               "on an active day, busiest %(bn)d" % dict(
                   data, pct=100.0 * data["activeDays"] / data["totalDays"],
                   bn=data["busiest"]["n"]))
    print(summary)
    print("  span %s .. %s   levels %s" % (data["first"], data["last"], data["levels"]))

    if args.show:
        return 0
    path = os.path.join(root, OUT)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
        fh.write("\n")
    print("  wrote %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
