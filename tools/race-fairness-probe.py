#!/usr/bin/env python3
"""Does the Marble Race course meet every STARTING LANE the same number of times?

WHY THIS FILE EXISTS
--------------------
Jayden, watching the race: "obstacles in the marble aren't set up for those that
spawn on the side, the obstacles need to feel equal for everyone, nobody should
just be falling through."

That is three claims, and not one of them can be settled by watching. The course
is regenerated on every race -- `pegField`, `funnel`, `zigzag`, `spinner`,
`gate` and `bumps` are dealt from a shuffled deck with a random section count, and
every peg carries an rnd() jitter -- so a single run is one sample of a random
layout. The only honest answer is a distribution over many seeds.

WHAT IT MEASURES
----------------
Twelve heads, the standard field, at 1440x900. For each seed:

  * Math.random is replaced with a seeded mulberry32 for the whole synchronous
    window that covers start() + the entire simulation, so a seed reproduces a
    race exactly. Nothing else runs in that window: start() and __race.sim() are
    both synchronous, so no rAF frame can interleave and steal a draw.
  * `__race.sim(sec)` steps the world with draw=false -- the same path a hidden
    tab already uses -- so a ~20-second race costs a few tens of milliseconds
    instead of twenty seconds.
  * `__race.tally()` returns, per racer: the starting LANE index (0 = nearest the
    left rail, N-1 = nearest the right), and the number of contacts it made with
    pegs, static segments, gate walls and spinner blades ON THE WAY DOWN --
    counting stops at the line, so a finisher rattling around the pen does not
    flatter its own lane. Plus path length, anti-stuck kicks, and time to the line.

The lane index is a POSITION, not a racer: `gridOrder` is reshuffled every race,
so which head owns lane 0 is random and the lane means only "spawned this far
across the width".

WHAT IT REPORTS
---------------
Per lane, over all seeds: mean and worst-case contact counts, split by obstacle
type; path length; time to the line; and the finish rate. Then three numbers that
decide the question:

  FAIRNESS   min-lane mean contacts / max-lane mean contacts. 1.00 is perfect.
  FLOOR      the 5th-percentile contact count of the WORST lane -- the "falling
             through" case, which is about the unlucky run and not the average.
  DURATION   the distribution of race length.

...and three that guard the thing Jayden must not lose. The chaos is the point:
fairness here means comparable NUMBERS of obstacles, never comparable outcomes.

  SPREAD     stddev of finishing rank within a lane. Uniform over 12 places is
             3.45. A course that got more predictable drives this DOWN.
  RHO        |Spearman| between starting lane and finishing rank. 0 is "your lane
             tells you nothing about where you finish", which is the target.
  GAP        seconds between the first and last finisher.

Plus COMPLETION -- the share of seeds where all twelve crossed -- because there is
a known wedging defect near the sliding gate and any obstacle change must not make
it worse.

    python3 tools/race-fairness-probe.py                  # 120 seeds
    python3 tools/race-fairness-probe.py --seeds 400
    python3 tools/race-fairness-probe.py --json out.json  # for a before/after diff
    python3 tools/race-fairness-probe.py --compare a.json b.json   # no browser needed
    python3 tools/race-fairness-probe.py --contract       # the gate: assert the thresholds
    python3 tools/race-fairness-probe.py --self-test      # re-inject each defect; it must fire

NOTE ON BEFORE/AFTER. A seed reproduces a race only against a fixed course
generator: change the generator and the same seed necessarily builds a different
course. What is held fixed across a comparison is the ENSEMBLE (the same list of
seeds) and the starting grid (the shuffle and the spawn x are drawn before
buildCourse(), so seed S puts the same field in the same lanes either way).

NOTE ON THE INSTRUMENT. `?wraf=1` is play-engine.js's dev-only handle; the tally
counters and the hand crank are behind the same flag and cost a live viewer one
boolean test per contact. Nothing here reads a screenshot -- the browser pane
rasterises this page wrong and throttles its rAF, so every number comes from the
simulation's own state.
"""

import argparse
import json
import math
import statistics
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent.parent
FIELD = 12
VIEWPORT = (1440, 900)
SIM_SECONDS = 70.0          # a hard ceiling on simulated race time; a normal race wraps well inside it
BATCH = 10                  # seeds per evaluate() call: keeps any single blocking call short
CONTRACT_SEEDS = 80         # enough that a lane mean is stable to ~0.5 obstacles; the gate runs in ~2 min

# ---------------------------------------------------------------------------
# Synthetic heads. Copied in spirit from race-fidelity-contract.py: N tinted
# copies of the seed egg, with the eyes nudged so readAll()'s de-dupe does not
# collapse them into one head and leave nothing to race.
# ---------------------------------------------------------------------------
SEED_HEADS = r"""
async (n) => {
  const EGG = window.__EGGHEAD;
  const HUES = ['#e05a4e','#5aa0d8','#3fa99a','#e0b23f','#8a6bd0','#d06ba0','#6bd08a','#d0846b',
                '#b06b3f','#4f7fd0','#57b06b','#c04f8a'];
  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = EGG.cut; });
  const out = [];
  for (let k = 0; k < n; k++) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = HUES[k % HUES.length]; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-over';
    const eyes = JSON.parse(JSON.stringify(EGG.eyes));
    eyes[0].x += k * 0.004; eyes[1].x -= k * 0.004;
    out.push({cut: c.toDataURL('image/webp', 0.9), eyes: eyes, marks: EGG.marks});
  }
  localStorage.setItem('hmCompanions', JSON.stringify(out));
  return out.length;
}
"""

# ---------------------------------------------------------------------------
# One batch of seeded races, start to finish, inside a single synchronous window.
# Math.random is swapped for the duration and restored in a finally, so a thrown
# race can never leave the page running on a deterministic generator.
# ---------------------------------------------------------------------------
RUN_BATCH = r"""
(args) => {
  const [seeds, simSec] = args;
  function mulberry32(a){ return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const out = [];
  const orig = Math.random;
  for (const s of seeds) {
    let rec = null;
    try {
      Math.random = mulberry32(s * 2654435761 + 12345);
      if (!window.__hmRaceStart({advance: 8, format: 'line'})) { out.push({seed: s, err: 'nofield'}); continue; }
      const stepped = window.__race.sim(simSec);
      // READ BEFORE THE WRAP-UP CAN SWEEP. finish() resolves everyone still on
      // course as `out`, and standings() drops `out` racers that were never in
      // outOrder -- so a tally read after a forced finish would be short a lane.
      // sim() stops the moment the race ends naturally, which is before we get here.
      rec = {seed: s, stepped: +stepped.toFixed(2), still: !!window.__hmRaceOn,
             course: window.__race.course(), balls: window.__race.tally()};
    } catch (e) {
      rec = {seed: s, err: String(e && e.message || e)};
    } finally {
      Math.random = orig;
      try { window.__hmRaceEnd && window.__hmRaceEnd(); } catch (_) {}
    }
    out.push(rec);
  }
  return out;
}
"""


# ---------------------------------------------------------------------------
# THE DEFECTS, RE-INJECTED. --self-test serves a play-engine.js with one of these
# swapped in and requires the contract to fail. A gate nobody has watched fail is
# a gate nobody should trust, and both of these are edits somebody could plausibly
# make: the first is what the file said before this work, the second is the
# reasonable-looking version of the fix that measured worse than doing nothing.
# ---------------------------------------------------------------------------
INJECTIONS = {
    # 1. THE FREE RIDE. The rail-anchored lattice put back the way it was: a fixed
    #    pitch, clipped by an exclusion band that leaves a peg-free chute at each
    #    rail. Measured FAIRNESS 0.64, rail lanes on 2.5 pegs against 13 in the middle.
    "band": (
        "    var k=Math.max(3,Math.floor(CW/pitch)),p2=CW/k;   // p2 >= pitch by construction, so anchoring the lattice to the rails never closes an interior gap\n    var R=Math.min(Math.max(pr*1.8,D*0.7),p2*0.36);   // the rail peg's radius: far enough to carry a head clear of the old dead lane, never so far that it closes the passage inboard\n    for(var r=0;r<rows;r++){var c;\n     if(r%2===0){pegs.push({x:X0,y:y+rnd(-3,3),r:R,rail:-1});pegs.push({x:W,y:y+rnd(-3,3),r:R,rail:1});   // WIDE row: the boundary is a peg ON each rail, so a rail-hugger is always met and always sent inward\n      for(c=1;c<k-1;c++)pegs.push({x:X0+p2*(c+0.5)+rnd(-3,3),y:y+rnd(-3,3),r:pr});}\n     else{for(c=1;c<k;c++)pegs.push({x:X0+p2*c+rnd(-3,3),y:y+rnd(-3,3),r:pr});}            // NARROW row: a full pitch of daylight at each rail, so the boundary is open -- peg over gap, gap over peg\n     y+=vs;}",
        "    var edge=DM*1.28+pr;\n    for(var r=0;r<rows;r++){var off=(r%2)?pitch/2:0,n=Math.floor((CW-pitch*0.6)/pitch);\n     for(var c=0;c<=n;c++){var px=X0+pitch*0.55+off+c*pitch;if(px<X0+edge||px>W-edge)continue;pegs.push({x:px+rnd(-3,3),y:y+rnd(-3,3),r:pr});}\n     y+=vs;}",
    ),
    # 2. THE WEDGE. The boundary peg lifted off the rail onto the lattice's own
    #    half-pitch -- the version that reads as the tidy thing to do. It leaves a
    #    slot the width of a head, and the anti-stuck kick rate goes up ~20x.
    "wedge": (
        "pegs.push({x:X0,y:y+rnd(-3,3),r:R,rail:-1});pegs.push({x:W,y:y+rnd(-3,3),r:R,rail:1});",
        "pegs.push({x:X0+p2*0.5,y:y+rnd(-3,3),r:pr});pegs.push({x:W-p2*0.5,y:y+rnd(-3,3),r:pr});",
    ),
}


class Handler(SimpleHTTPRequestHandler):
    inject = None

    def log_message(self, *a):
        pass

    def send_head(self):
        if self.inject and self.path.split("?")[0] == "/play-engine.js":
            src = (ROOT / "play-engine.js").read_text()
            find, repl = INJECTIONS[self.inject]
            if find not in src:
                raise SystemExit(
                    "self-test cannot re-inject '%s': the anchor text is gone from "
                    "play-engine.js, so this detector is no longer watching what it "
                    "claims to watch.\n  anchor: %s" % (self.inject, find[:110])
                )
            body = src.replace(find, repl, 1).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            import io

            return io.BytesIO(body)
        return SimpleHTTPRequestHandler.send_head(self)


# ---------------------------------------------------------------------------
# THE CONTRACT. Every threshold is a measured number with margin, and each one is
# a sentence Jayden said or a thing he must not lose. Held at 1440x900 with the
# standard twelve-head field, which is what every number in this file was taken at.
# ---------------------------------------------------------------------------
def contract(d, f):
    lane_means = [r["mean"] for r in d["lanes"]]
    kick = max(r["kick"] for r in d["lanes"])
    # -- "the obstacles need to feel equal for everyone" ----------------------
    f.check(d["fairness"] >= 0.85, "every lane meets a comparable count",
            "leanest/richest = %.3f  (was 0.64 with the rail chute; needs >= 0.85)"
            % d["fairness"])
    f.check(min(lane_means) >= 24.0, "no lane is starved",
            "leanest lane averages %.1f obstacles (needs >= 24)" % min(lane_means))
    # -- "nobody should just be falling through" ------------------------------
    f.check(d["floor"] >= 19.0, "the unlucky run still meets the course",
            "5th percentile of the leanest lane = %.1f (needs >= 19)" % d["floor"])
    # -- the boundary deflects, it does not wedge -----------------------------
    f.check(kick <= 0.25, "the rail deflects rather than traps",
            "worst lane draws %.2f anti-stuck kicks a racer (needs <= 0.25)" % kick)
    # -- "slow down the race just a bit" -- a bit, in both directions ---------
    f.check(18.0 <= d["win_p50"] <= 30.0, "slower, but not doubled",
            "winner p50 %.1fs (was 19.9s; band is 18-30)" % d["win_p50"])
    # -- and the known wedging defect is not made worse -----------------------
    f.check(d["completion"] >= 0.25, "the race still resolves its field",
            "%.0f%% of races finish all 12 (was 36%%; needs >= 25%%)"
            % (100 * d["completion"]))
    # -- THE CHAOS IS THE POINT. These fail if the race got PREDICTABLE. ------
    f.check(d["spread"] >= 3.10, "finishing order is still a lottery",
            "stddev of finish rank within a lane = %.2f (uniform is %.2f; needs >= 3.10)"
            % (d["spread"], math.sqrt((d["field"] ** 2 - 1) / 12.0)))
    f.check(abs(d["rho"]) <= 0.15, "your lane does not tell you where you finish",
            "|Spearman(lane, rank)| = %.3f (needs <= 0.15)" % abs(d["rho"]))


class Findings:
    def __init__(self, verbose=False):
        self.failures = []
        self.verbose = verbose

    def check(self, cond, label, detail=""):
        if cond:
            if self.verbose:
                print("  ok   %-44s %s" % (label, detail))
        else:
            self.failures.append(label)
            print("  FAIL %-44s %s" % (label, detail))
        return cond


# ---------------------------------------------------------------------------
# Statistics. Everything worst-case-first: a mean hides exactly the lane Jayden
# is complaining about.
# ---------------------------------------------------------------------------
def pct(xs, p):
    if not xs:
        return 0.0
    ys = sorted(xs)
    k = (len(ys) - 1) * (p / 100.0)
    lo, hi = math.floor(k), math.ceil(k)
    return ys[lo] if lo == hi else ys[lo] + (ys[hi] - ys[lo]) * (k - lo)


def spearman(xs, ys):
    """Rank correlation. Used on (starting lane, finishing rank): near zero is the
    goal, because a lane that predicts a placing is a lane that has stopped being
    a lottery."""
    n = len(xs)
    if n < 3:
        return 0.0

    def ranks(v):
        order = sorted(range(n), key=lambda i: v[i])
        r = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and v[order[j + 1]] == v[order[i]]:
                j += 1
            avg = (i + j) / 2.0
            for k in range(i, j + 1):
                r[order[k]] = avg
            i = j + 1
        return r

    rx, ry = ranks(xs), ranks(ys)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((rx[i] - mx) * (ry[i] - my) for i in range(n))
    dx = math.sqrt(sum((v - mx) ** 2 for v in rx))
    dy = math.sqrt(sum((v - my) ** 2 for v in ry))
    return 0.0 if dx == 0 or dy == 0 else num / (dx * dy)


def rank_of(balls):
    """The finishing order the board and the qualifier both show, recomputed here so
    the reading does not depend on standings() surviving the wrap-up: finishers by
    the clock, then everyone else by how far down the course they got."""
    fin = sorted([b for b in balls if b["fin"]], key=lambda b: b["t"])
    un = sorted([b for b in balls if not b["fin"]], key=lambda b: -b["y"])
    return {b["i"]: k for k, b in enumerate(fin + un)}


def digest(records, field=FIELD):
    lanes = {i: {"contacts": [], "peg": [], "seg": [], "gate": [], "spin": [],
                 "dist": [], "t": [], "fin": 0, "n": 0, "rank": [], "kick": [], "hits": []}
             for i in range(field)}
    per_race = []
    lane_rank_pairs = ([], [])
    bad = 0
    for r in records:
        if r.get("err") or not r.get("balls"):
            bad += 1
            continue
        balls = r["balls"]
        rk = rank_of(balls)
        finishers = [b for b in balls if b["fin"]]
        times = sorted(b["t"] / 1000.0 for b in finishers)
        per_race.append({
            "seed": r["seed"],
            "finished": len(finishers),
            "complete": len(finishers) == len(balls),
            "first": times[0] if times else None,
            "last": times[-1] if times else None,
            "gap": (times[-1] - times[0]) if len(times) > 1 else None,
            # WALL is what a viewer sits through: everything sim() stepped, less the
            # 3.2s countdown. It is longer than the last crossing because the mode
            # holds a wrap-up beat after it, and it is the number "the race takes
            # 16.7-20.2s" refers to.
            "wall": (r.get("stepped") or 0) - 3.2,
            "stepped": r.get("stepped"),
            "still": r.get("still"),
            "pegs": r["course"]["pegs"], "segs": r["course"]["segs"],
            "spins": r["course"]["spins"], "gates": r["course"]["gates"],
            "depth": r["course"]["finishY"],
        })
        for b in balls:
            L = lanes[b["lane"]]
            tot = b["peg"] + b["seg"] + b["gate"] + b["spin"]
            L["n"] += 1
            L["contacts"].append(tot)
            for k in ("peg", "seg", "gate", "spin", "kick", "hits", "dist"):
                L[k].append(b[k])
            L["rank"].append(rk[b["i"]])
            lane_rank_pairs[0].append(b["lane"])
            lane_rank_pairs[1].append(rk[b["i"]])
            if b["fin"]:
                L["fin"] += 1
                L["t"].append(b["t"] / 1000.0)

    lane_rows = []
    for i in range(field):
        L = lanes[i]
        if not L["n"]:
            continue
        lane_rows.append({
            "lane": i,
            "n": L["n"],
            "mean": statistics.fmean(L["contacts"]),
            "p05": pct(L["contacts"], 5),
            "p50": pct(L["contacts"], 50),
            "min": min(L["contacts"]),
            "peg": statistics.fmean(L["peg"]), "seg": statistics.fmean(L["seg"]),
            "gate": statistics.fmean(L["gate"]), "spin": statistics.fmean(L["spin"]),
            "kick": statistics.fmean(L["kick"]), "hits": statistics.fmean(L["hits"]),
            "dist": statistics.fmean(L["dist"]),
            "t": statistics.fmean(L["t"]) if L["t"] else None,
            "finrate": L["fin"] / L["n"],
            "rank_sd": statistics.pstdev(L["rank"]) if len(L["rank"]) > 1 else 0.0,
            "rank_mean": statistics.fmean(L["rank"]),
        })

    means = [r["mean"] for r in lane_rows]
    worst = min(lane_rows, key=lambda r: r["mean"]) if lane_rows else None
    best = max(lane_rows, key=lambda r: r["mean"]) if lane_rows else None
    durs = [p["wall"] for p in per_race]
    wins = [p["first"] for p in per_race if p["first"] is not None]
    gaps = [p["gap"] for p in per_race if p["gap"] is not None]
    return {
        "races": len(per_race), "dropped": bad, "field": field,
        "lanes": lane_rows,
        "fairness": (min(means) / max(means)) if means and max(means) else 0.0,
        "worst_lane": worst["lane"] if worst else None,
        "best_lane": best["lane"] if best else None,
        "floor": worst["p05"] if worst else 0.0,
        "floor_min": worst["min"] if worst else 0.0,
        "rho": spearman(*lane_rank_pairs),
        "spread": statistics.fmean([r["rank_sd"] for r in lane_rows]) if lane_rows else 0.0,
        "completion": (statistics.fmean([1.0 if p["complete"] else 0.0 for p in per_race])
                       if per_race else 0.0),
        "resolved": statistics.fmean([p["finished"] for p in per_race]) if per_race else 0.0,
        "dur_mean": statistics.fmean(durs) if durs else 0.0,
        "dur_p05": pct(durs, 5), "dur_p50": pct(durs, 50), "dur_p95": pct(durs, 95),
        "dur_max": max(durs) if durs else 0.0,
        "win_mean": statistics.fmean(wins) if wins else 0.0,
        "win_p05": pct(wins, 5), "win_p50": pct(wins, 50), "win_p95": pct(wins, 95),
        "gap_mean": statistics.fmean(gaps) if gaps else 0.0,
        "obstacles": {k: statistics.fmean([p[k] for p in per_race]) if per_race else 0.0
                      for k in ("pegs", "segs", "spins", "gates")},
        "depth": statistics.fmean([p["depth"] for p in per_race]) if per_race else 0.0,
        "per_race": per_race,
    }


def report(d, title="race fairness"):
    print("\n%s -- %d races, field %d, %dx%d"
          % (title, d["races"], d["field"], VIEWPORT[0], VIEWPORT[1]))
    if d["dropped"]:
        print("  %d race(s) dropped (start refused or threw)" % d["dropped"])
    print("\n  lane   n   distinct obstacles met      peg   seg  gate  spin   hits  kick"
          "    dist     t/s   fin%   rank sd")
    print("              mean   p05   p50   min")
    for r in d["lanes"]:
        print("   %2d  %4d  %5.1f %5.1f %5.1f %5.0f   %5.1f %5.1f %5.1f %5.1f  %5.0f %5.2f"
              "  %6.0f  %6s  %4.0f%%   %5.2f"
              % (r["lane"], r["n"], r["mean"], r["p05"], r["p50"], r["min"],
                 r["peg"], r["seg"], r["gate"], r["spin"], r["hits"], r["kick"], r["dist"],
                 ("%.1f" % r["t"]) if r["t"] is not None else "-",
                 100 * r["finrate"], r["rank_sd"]))
    print("\n  FAIRNESS  %.3f   (lane %d meets %.0f%% of what lane %d meets)"
          % (d["fairness"], d["worst_lane"], 100 * d["fairness"], d["best_lane"]))
    print("  FLOOR     %.1f contacts at the 5th percentile of the leanest lane "
          "(absolute min %d)" % (d["floor"], d["floor_min"]))
    print("  WINNER    mean %.1fs   p05 %.1f  p50 %.1f  p95 %.1f   (drop -> first crossing)"
          % (d["win_mean"], d["win_p05"], d["win_p50"], d["win_p95"]))
    print("  DURATION  mean %.1fs   p05 %.1f  p50 %.1f  p95 %.1f  max %.1f   "
          "(drop -> wrap-up)"
          % (d["dur_mean"], d["dur_p05"], d["dur_p50"], d["dur_p95"], d["dur_max"]))
    print("  COMPLETE  %.0f%% of races resolved all %d  (mean %.1f finishers)"
          % (100 * d["completion"], d["field"], d["resolved"]))
    print("\n  -- the chaos guards (these must NOT improve) --")
    print("  SPREAD    %.2f  stddev of finishing rank within a lane "
          "(uniform over %d = %.2f)" % (d["spread"], d["field"],
                                        math.sqrt((d["field"] ** 2 - 1) / 12.0)))
    print("  RHO       %+.3f  Spearman(start lane, finish rank) -- 0 is a lottery"
          % d["rho"])
    print("  GAP       %.1fs  between first and last finisher" % d["gap_mean"])
    print("\n  course    %.0f pegs  %.0f segments  %.0f spinners  %.0f gates  "
          "%.0fpx to the line"
          % (d["obstacles"]["pegs"], d["obstacles"]["segs"], d["obstacles"]["spins"],
             d["obstacles"]["gates"], d["depth"]))


def compare(a, b):
    print("\n=== BEFORE -> AFTER ===")
    rows = [
        ("fairness (min/max lane obstacles)", a["fairness"], b["fairness"], "%.3f", "up"),
        ("floor (p05 of leanest lane)", a["floor"], b["floor"], "%.1f", "up"),
        ("mean obstacles, leanest lane",
         min(r["mean"] for r in a["lanes"]), min(r["mean"] for r in b["lanes"]), "%.1f", "up"),
        ("mean obstacles, all lanes",
         statistics.fmean([r["mean"] for r in a["lanes"]]),
         statistics.fmean([r["mean"] for r in b["lanes"]]), "%.1f", "up"),
        ("winner p50 (s)", a["win_p50"], b["win_p50"], "%.1f", "up"),
        ("duration p50 (s)", a["dur_p50"], b["dur_p50"], "%.1f", "up"),
        ("duration p95 (s)", a["dur_p95"], b["dur_p95"], "%.1f", "up"),
        ("completion (all finish)", a["completion"], b["completion"], "%.2f", "up"),
        ("mean finishers", a["resolved"], b["resolved"], "%.2f", "up"),
        ("SPREAD of finish rank", a["spread"], b["spread"], "%.2f", "hold"),
        ("|RHO| lane vs rank", abs(a["rho"]), abs(b["rho"]), "%.3f", "down"),
        ("first-to-last gap (s)", a["gap_mean"], b["gap_mean"], "%.1f", "hold"),
    ]
    print("  %-34s %10s %10s %10s" % ("", "before", "after", "delta"))
    for label, x, y, fmt, _dirn in rows:
        print("  %-34s %10s %10s %10s"
              % (label, fmt % x, fmt % y,
                 ("%+.3f" % (y - x)) if abs(y - x) < 10 else ("%+.1f" % (y - x))))
    print("\n  Read SPREAD and GAP as things to HOLD, not to improve: a course that"
          "\n  narrows the finishing order has broken the point of the race.")


def collect(seeds, sim_seconds, inject=None):
    from playwright.sync_api import sync_playwright

    Handler.inject = inject
    handler = partial(Handler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)   # port 0: the OS hands us one nobody else owns
    Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % server.server_port
    out = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True, args=["--force-color-profile=srgb"])
            ctx = browser.new_context(
                viewport={"width": VIEWPORT[0], "height": VIEWPORT[1]}, device_scale_factor=1)
            pg = ctx.new_page()
            try:
                pg.goto(base + "/play.html", wait_until="load")
                pg.evaluate(SEED_HEADS, FIELD)
                pg.goto(base + "/play.html?wraf=1", wait_until="load")
                pg.wait_for_timeout(2600)
                have = pg.evaluate("() => !!(window.__race && window.__race.sim)")
                if not have:
                    raise SystemExit(
                        "play-engine.js exposed no __race.sim under ?wraf=1 -- the hand "
                        "crank this probe depends on is gone, so nothing below would be "
                        "measuring the race.")
                done = 0
                for i in range(0, len(seeds), BATCH):
                    chunk = seeds[i:i + BATCH]
                    out.extend(pg.evaluate(RUN_BATCH, [chunk, sim_seconds]))
                    done += len(chunk)
                    print("\r  %d/%d races" % (done, len(seeds)), end="", file=sys.stderr)
                print("", file=sys.stderr)
            finally:
                ctx.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=120)
    ap.add_argument("--start", type=int, default=1, help="first seed (hold this fixed across a comparison)")
    ap.add_argument("--sim", type=float, default=SIM_SECONDS)
    ap.add_argument("--json", help="write the digest here, for --compare")
    ap.add_argument("--raw", help="write every per-racer record here")
    ap.add_argument("--compare", nargs=2, metavar=("BEFORE", "AFTER"),
                    help="diff two --json digests; runs no browser")
    ap.add_argument("--title", default="race fairness")
    ap.add_argument("--contract", action="store_true",
                    help="assert the fairness/pace/chaos thresholds and exit non-zero on any failure")
    ap.add_argument("--self-test", action="store_true",
                    help="re-inject each known defect; the contract must fail on every one")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        n = args.seeds if args.seeds != 120 else CONTRACT_SEEDS
        ok = True
        for key in INJECTIONS:
            print("\n--- re-injecting: %s" % key)
            f = Findings(False)
            try:
                d = digest(collect(list(range(args.start, args.start + n)), args.sim, key))
                contract(d, f)
            except Exception as exc:                     # a crash is not a detection
                print("  the injected build threw: %s" % exc)
                f.failures = []
            if f.failures:
                print("  detector(s) fired: %s" % ", ".join(f.failures))
            else:
                print("  NOTHING FIRED -- this defect would ship silently")
                ok = False
        print("\nSTATUS=%s  (self-test)" % ("PASS" if ok else "FAIL"))
        return 0 if ok else 1

    if args.contract:
        n = args.seeds if args.seeds != 120 else CONTRACT_SEEDS
        d = digest(collect(list(range(args.start, args.start + n)), args.sim))
        report(d, "race fairness contract")
        f = Findings(args.verbose)
        print()
        contract(d, f)
        if f.failures:
            print("\nSTATUS=FAIL  (%d finding%s)"
                  % (len(f.failures), "" if len(f.failures) == 1 else "s"))
            return 1
        print("\nSTATUS=PASS  every lane meets the course, the rail deflects rather "
              "than traps, and the finish is still a lottery.")
        return 0

    if args.compare:
        a = json.loads(Path(args.compare[0]).read_text())
        b = json.loads(Path(args.compare[1]).read_text())
        report(a, "BEFORE")
        report(b, "AFTER")
        compare(a, b)
        return 0

    seeds = list(range(args.start, args.start + args.seeds))
    records = collect(seeds, args.sim)
    if args.raw:
        Path(args.raw).write_text(json.dumps(records))
    d = digest(records)
    report(d, args.title)
    if args.json:
        Path(args.json).write_text(json.dumps(d))
        print("\n  wrote %s" % args.json)
    return 0


if __name__ == "__main__":
    sys.exit(main())
