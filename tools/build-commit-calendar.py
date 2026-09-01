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
import glob
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
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


USER = "jlbetts-cpu"
CONTRIB = "https://github.com/users/%s/contributions" % USER


def github_year():
    """GitHub's own contribution calendar: [(date, level 0-4)], plus the headline total.

    WHY THIS CAME BACK.  An earlier pass replaced a GitHub fetcher with this repo's git
    log, and the measurement behind that was right AT THE TIME: the year then held 52
    active days with two empty stretches of 130 and 118 days, which is a weak picture no
    caption rescues.  On 2026-09-01 he asked for the band to be structured as a
    contribution calendar and sent a reference labelled GITHUB COMMITS, and the same
    measurement now reads differently -- 52 active days across SIX months, longest gap 46
    days.  A seven-row year grid needs a year of data, and this repository has six weeks
    of one: drawn from git log the same grid is eleven empty months with everything
    bunched against the right edge, which is the exact picture that argument rejected.

    WHAT IS LOST, AND IT IS REAL.  The profile HTML carries data-level (0-4) and
    data-date and NOT a per-day count -- it has not carried data-count for years, and a
    grep for it returns zero, which reads as "no contributions" and is the wrong
    conclusion.  So the page can no longer say what the busiest day carried, and the copy
    below does not pretend otherwise.  The levels are still GitHub's own scale against
    his own busiest day, so a dark square is still his busiest kind of day.

    IT IS STILL A BUILD-TIME FETCH committed as JSON.  No token, no CORS, no runtime
    third party, and `generated` still guards the whole section.
    """
    req = urllib.request.Request(CONTRIB, headers={
        "User-Agent": "portfolio-build (build-commit-calendar.py)",
        "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=25) as fh:
        html = fh.read().decode("utf-8", "replace")
    cells = re.findall(r'data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"', html)
    if not cells:
        cells = [(d, l) for l, d in
                 re.findall(r'data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"', html)]
    # SORT BY DATE.  GitHub's grid is a <table> with one ROW PER WEEKDAY, so scanning
    # the markup yields every Sunday, then every Monday, and so on -- consecutive matches
    # are seven days apart, not one.  Rendered unsorted into a column-flowed grid that is
    # a plausible-looking calendar with every date in the wrong cell, which is exactly the
    # kind of quiet wrongness this section exists to avoid.
    cells.sort(key=lambda c: c[0])
    if len(cells) < 300:
        raise SystemExit("the contributions page returned %d cells -- refusing to ship a "
                         "partial year (the markup has probably changed again)" % len(cells))
    m = re.search(r"([\d,]+)\s+contributions\s+in\s+the\s+last\s+year", html, re.I)
    total = int(m.group(1).replace(",", "")) if m else None
    return cells, total


def build_github():
    cells, total = github_year()
    # Trim the leading part-week so the grid's first column is a whole Sunday-start week.
    start = datetime.strptime(cells[0][0], "%Y-%m-%d").date()
    drop = (start.weekday() - WEEK_START) % 7
    if drop:
        cells = cells[(7 - drop) % 7:]
    days, active, streak, longest = [], 0, 0, 0
    for d, l in cells:
        lv = int(l)
        days.append({"d": d, "l": lv})
        if lv:
            active += 1
            streak += 1
            longest = max(longest, streak)
        else:
            streak = 0
    histogram = collections.Counter(day["l"] for day in days)
    return {
        "generated": date.today().isoformat(),
        "source": "github contribution calendar for " + USER,
        "note": ("l is GitHub's own 0-4 level for the day, scaled against his busiest "
                 "day. GitHub does not publish a per-day count, so there is none here "
                 "and the page makes no claim about one."),
        "window": "year",
        "weekStart": "sunday",
        "levelFloors": None,
        "days": days,
        "commits": total if total is not None else 0,
        "activeDays": active,
        "totalDays": len(days),
        "longestStreak": longest,
        "levels": {str(k): histogram.get(k, 0) for k in range(5)},
        "first": days[0]["d"],
        "last": days[-1]["d"],
        "usage": claude_usage(),
    }


TRANSCRIPTS = os.path.expanduser("~/.claude/projects/**/*.jsonl")


def claude_usage():
    """Token usage summed from Claude Code's own transcripts on this machine.

    WHY THIS IS DERIVED AND NOT TYPED IN.  When the panel was first proposed on
    2026-08-11 it was parked, and one of the three arguments was mechanical and still
    stands: there is no API for personal Claude usage, so a figure would be hardcoded
    and would age silently on a page people check.  It does not have to be.  Every
    assistant turn Claude Code writes carries a `usage` object, so the number is
    computable, re-computable by re-running this, and stamped with `generated` like
    everything else in this file.

    WHICH NUMBER, AND WHY NOT THE BIG ONE.  Four counters are recorded and they are not
    interchangeable:

        output          85.6M     what Claude actually wrote
        input            3.7M     what was sent that was not already cached
        cache write    906.0M     context written into the prompt cache
        cache read      35.7B     context RE-READ out of that cache

    The raw sum is 36.7 BILLION and it is meaningless as a headline: cache_read counts
    the same conversation again on every single turn, so it measures how long the
    sessions were, not how much was done.  Publishing it would be the "looks live, is
    nonsense" failure in a new costume.  The page headlines OUTPUT -- the tokens that
    became code and prose -- which is the one counter that cannot be inflated by
    re-reading context, and the rest are kept in the JSON so the choice is visible.

    IT IS THIS MACHINE'S HISTORY.  The tool is his, it runs where the transcripts are,
    and if they are absent it returns None and the section simply does not render.
    """
    totals = {"output": 0, "input": 0, "cacheWrite": 0, "cacheRead": 0}
    turns = 0
    models = collections.Counter()
    first = last = None
    files = glob.glob(TRANSCRIPTS, recursive=True)
    if not files:
        return None
    for path in files:
        try:
            with open(path, encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    if '"usage"' not in line:
                        continue
                    try:
                        row = json.loads(line)
                    except ValueError:
                        continue
                    message = row.get("message") or {}
                    usage = message.get("usage") or row.get("usage")
                    if not isinstance(usage, dict):
                        continue
                    totals["output"] += usage.get("output_tokens") or 0
                    totals["input"] += usage.get("input_tokens") or 0
                    totals["cacheWrite"] += usage.get("cache_creation_input_tokens") or 0
                    totals["cacheRead"] += usage.get("cache_read_input_tokens") or 0
                    turns += 1
                    if message.get("model"):
                        models[message["model"]] += 1
                    stamp = row.get("timestamp")
                    if stamp:
                        if first is None or stamp < first:
                            first = stamp
                        if last is None or stamp > last:
                            last = stamp
        except OSError:
            continue
    if not turns:
        return None
    return {
        "note": ("output is what Claude wrote; cacheRead is context re-read on every "
                 "turn and is deliberately NOT the headline"),
        "output": totals["output"],
        "input": totals["input"],
        "cacheWrite": totals["cacheWrite"],
        "cacheRead": totals["cacheRead"],
        "turns": turns,
        "sessions": len(files),
        "models": [m for m, _ in models.most_common(4)],
        "first": (first or "")[:10],
        "last": (last or "")[:10],
    }


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


# The grid is a weekday calendar, so its columns are WEEKS and its rows are the
# seven weekdays.  Sunday starts the column, which is what every calendar this
# reference came from does, and what `weekday()+1 mod 7` computes below.
WEEKS = 53
WEEK_START = 6  # Python's Sunday


def week_floor(d):
    """The Sunday on or before d.  A grid whose first column is a part-week draws
    its first days against the wrong weekday rows for the whole year."""
    return d - timedelta(days=(d.weekday() - WEEK_START) % 7)


def build(root, window="year"):
    counts = git_days(root)
    first = min(counts)
    last = max(counts)
    end = datetime.strptime(last, "%Y-%m-%d").date()

    if window == "year":
        # A TRAILING YEAR, ALIGNED TO WHOLE WEEKS.  He asked on 2026-09-01 for the
        # band to be structured like a contribution calendar, and a seven-row grid
        # needs weeks to be wide: the project's own 44 days are seven columns, a
        # square the size of a postage stamp in a 1200px column.  The cost is real
        # and is printed by --print: most of this window predates the repository,
        # so it is empty, and the work bunches against the right edge.  That is the
        # picture he chose from a reference showing exactly the same shape.
        # ANCHOR ON THE END, NOT THE START.  Walking back 53 weeks and then re-deriving
        # the end from the aligned start moves the end BACKWARDS by up to six days and
        # silently drops the newest commits -- it cost 35 commits and two active days the
        # first time this ran.  Close the window on the Saturday that ends the last
        # commit's week, then count back.
        end = week_floor(end) + timedelta(days=6)
        start = end - timedelta(days=7 * WEEKS - 1)
    else:
        start = datetime.strptime(first, "%Y-%m-%d").date()

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
        "window": window,
        "weekStart": "sunday",
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
    ap.add_argument("--window", choices=("year", "history"), default="year",
                    help="year: a trailing 53 weeks, aligned to Sunday, for the "
                         "weekday grid. history: only the days the repo has existed.")
    ap.add_argument("--source", choices=("github", "git"), default="github",
                    help="github: his contribution calendar, a real year of weeks. "
                         "git: this repository's log, six weeks of one.")
    args = ap.parse_args()

    root = repo_root()
    if args.source == "github":
        try:
            data = build_github()
        except (urllib.error.URLError, OSError) as exc:
            print("  github fetch failed (%s); falling back to git log" % exc)
            data = build(root, args.window)
    else:
        data = build(root, args.window)

    pct = 100.0 * data["activeDays"] / data["totalDays"]
    summary = ("%d contributions, %d of %d days (%.0f%%), longest run %d"
               % (data["commits"], data["activeDays"], data["totalDays"], pct,
                  data["longestStreak"]))
    if data.get("busiest"):
        summary += ", busiest %d" % data["busiest"]["n"]
    print(summary)
    print("  source %s" % data["source"])
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
