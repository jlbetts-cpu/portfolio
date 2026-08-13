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

AND THEN THE TWO READINGS THIS FILE GREW FOR THE SECOND PASS, because the contact
tally above answered Jayden's first complaint and was blind to his next two.

  CHUTE      the longest CLEAR STRAIGHT DROP anywhere in the course, in head
             diameters. Every obstacle is rasterised into a 20px grid dilated by a
             head radius, and each column's longest unbroken empty run is the free
             fall available at that x. "There isnt enough obsticales anywhere else"
             is this number, and it was 22.4 diameters -- 2225px of a 9106px descent
             -- while the contact tally reported a flat, healthy 30 per lane. A tally
             counts what a lane met; it cannot count what was not there.
  LEADS      how many times FIRST PLACE actually changed hands, with a half-head of
             hysteresis so two racers falling side by side do not score a thousand.
             Reported as a distribution, plus DURABLE (changes where the new leader
             held it a full second), QUIET (the longest stretch of a race with nobody
             going past -- the procession detector, which a mean hides completely) and
             DECIDED (how often the halfway leader wins).

Both are behind the same ?wraf=1 dev flag: play-engine.js carries the lead-change
counter, and chutes() in this file rasterises the course out of the live arrays.

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
CONTRACT_SEEDS = 160        # enough that a lane mean is stable to ~0.5 obstacles AND the fairness ratio,
                            # which is a ratio of two noisy means, does not wobble across the threshold; ~4 min

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
  /* ===== THE CLEAR CHUTE: "there isn't enough obstacles anywhere else" as a number =====
     Contact tallies say how much course a lane MET. They cannot say how much of the
     descent is empty, because a racer that is knocked about meets the same peg field
     twice and scores well while the rest of the drop is air.
     So the course is rasterised. Every peg, segment, spinner blade and gate wall is
     painted into a 20px grid, dilated by a head radius (an obstacle a head-radius away
     is one the head cannot fall past). Then for each COLUMN of the course, the longest
     unbroken run of empty cells is the longest straight drop available at that x --
     the free fall. The headline is the worst column, because that is the line a lucky
     racer finds and rides.
     Read in head diameters, not pixels: a drop of 4 heads is a beat, a drop of 20 is
     the race having stopped happening. The grid is deliberately coarse and its bias is
     toward reporting MORE coverage than there is (boxes, not discs), so a chute it
     does report is real. */
  function chutes(course, pegs, segs, spins, voids) {
    const B = 20, hr = course.D * 0.46;
    const y0 = course.H * 0.42, y1 = course.finishY;
    const nb = Math.max(1, Math.ceil((y1 - y0) / B)), nc = Math.max(1, Math.ceil(course.CW / B));
    const g = new Uint8Array(nb * nc);
    const mark = (xa, xb, ya, yb) => {
      let ca = Math.floor((xa - course.X0) / B), cb = Math.ceil((xb - course.X0) / B);
      let ba = Math.floor((ya - y0) / B), bb2 = Math.ceil((yb - y0) / B);
      if (ca < 0) ca = 0; if (cb > nc) cb = nc; if (ba < 0) ba = 0; if (bb2 > nb) bb2 = nb;
      for (let b = ba; b < bb2; b++) for (let c = ca; c < cb; c++) g[b * nc + c] = 1;
    };
    // A SWEEPER OCCUPIES ITS WHOLE STROKE. Reading p.x alone would report a clear
    // column either side of a peg that visits it twice a second, which is the reverse
    // of the error this metric exists to catch.
    for (const p of pegs) { const sw = p.mv ? p.mv.amp : 0;
      mark(p.x - p.r - hr - sw, p.x + p.r + hr + sw, p.y - p.r - hr, p.y + p.r + hr); }
    for (const w of spins) mark(w.cx - w.r - hr, w.cx + w.r + hr, w.cy - w.r - hr, w.cy + w.r + hr);
    for (const s of segs) {                       // walked, not boxed: a 16deg ramp's bounding box is mostly air
      const n = Math.max(2, Math.ceil(Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / (B / 2)));
      for (let i = 0; i <= n; i++) { const t = i / n, x = s.x1 + (s.x2 - s.x1) * t, y = s.y1 + (s.y2 - s.y1) * t;
        mark(x - hr, x + hr, y - hr, y + hr); }
    }
    /* TWO NUMBERS, BECAUSE A CHUTE NOBODY CAN ENTER IS NOT A CHUTE. The triangle
       outside a funnel wall is sealed at its top by the wall's own start against the
       rail. It is 18% of this grid and no racer has ever been in one. Counting it as
       free fall reported the course as emptier than any racer can find it -- measured
       on the same seeds, worst RAW column 15.1 diameters against 10.9 reachable.
       RAW is kept because every number this file has ever published for CHUTE was a raw
       one, and a comparison that quietly changes its instrument is not a comparison.
       REACHABLE is the one that describes a race. */
    const gv = g.slice();
    for (let b = 0; b < nb; b++) for (let c = 0; c < nc; c++) {
      const yy = y0 + (b + 0.5) * B, xx = course.X0 + (c + 0.5) * B;
      for (const v of (voids || [])) {
        if (yy < v.y0 || yy > v.y1) continue;
        const wx = v.x0 + (v.x1 - v.x0) * ((yy - v.y0) / Math.max(1, v.y1 - v.y0));
        if (v.side < 0 ? (xx < wx) : (xx > wx)) { gv[b * nc + c] = 1; break; }
      }
    }
    let vworst = 0;
    for (let c = 0; c < nc; c++) { let run = 0, best = 0;
      for (let b = 0; b < nb; b++) { if (gv[b * nc + c]) { if (run > best) best = run; run = 0; } else run++; }
      if (run > best) best = run;
      if (best * B > vworst) vworst = best * B; }
    let worst = 0, per = [], covered = 0;
    for (let c = 0; c < nc; c++) {
      let run = 0, best = 0;
      for (let b = 0; b < nb; b++) { if (g[b * nc + c]) { if (run > best) best = run; run = 0; covered++; } else run++; }
      if (run > best) best = run;
      per.push(best * B); if (best * B > worst) worst = best * B;
    }
    per.sort((a, b) => a - b);
    return {max: worst, reach: vworst, med: per[per.length >> 1], min: per[0],
            cover: +(covered / (nb * nc)).toFixed(4), depth: Math.round(y1 - y0), D: +course.D.toFixed(1)};
  }
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
             course: window.__race.course(), balls: window.__race.tally(),
             drama: window.__race.drama ? window.__race.drama() : null,
             // REACH: per obstacle TYPE, how many were built and how many any racer
             // touched. Read here, before __hmRaceEnd, for the same reason the tally is.
             reach: window.__race.reach ? window.__race.reach() : null,
             // read from the LIVE arrays, before the next seed's buildCourse() empties them
             chute: chutes(window.__race.course(), window.__race.pegs, window.__race.segs,
                           window.__race.spins,
                           window.__race.voids ? window.__race.voids() : [])};
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
    # 1. THE FREE RIDE. The rail half-peg deleted, so the boundary of the lattice is a
    #    gap on every row and a head knocked out to a rail drops through untouched. This
    #    is the defect the previous pass fixed, expressed against the code that replaced
    #    it: measured FAIRNESS 0.64, rail lanes on 2.5 pegs against 13 in the middle.
    "band": (
        "      if(py<finishY-SPRINT&&!inVoid(px,py)&&railLive(r2,py)&&roomRail(px,py,L.R))pegs.push({x:px,y:py,r:L.R,rail:r2});}",
        "      if(false)pegs.push({x:px,y:py,r:L.R,rail:r2});}",
    ),
    # 4. THE COURSE POURED ON A GRID AGAIN. The flow envelope switched off, so the
    #    lattice goes back to being laid across the full width at every depth and the
    #    rail is scalloped whether or not the field ever reaches it. This is the course
    #    as Jayden found it -- "half of them arent even in the way of anything" -- and
    #    it is invisible to every other detector here: measured, FAIRNESS, FLOOR, CHUTE
    #    and COVER all stayed green while REACH read 55%.
    "flat": (
        "     for(var hy=0;hy<2;hy++)for(r2=-1;r2<=1;r2+=2){px=(r2<0)?X0:W;py=yy+L.vs*0.5*hy+rnd(-3,3);",
        "     for(var hy=0;hy<2;hy++)for(r2=-1;r2<=1;r2+=2){px=(r2<0)?X0:W;py=yy+L.vs*0.5*hy+rnd(-3,3);"
        "railLive=function(){return true;};inFlow=function(){return true;};",
    ),
    # 5. THE CHUTE CAP REMOVED. The envelope is the right rule for furnishing a course
    #    and no rule at all for guarding one: with the cap pass gone, the columns the
    #    field does not use are bare from top to bottom and a swatted racer free-falls
    #    down one. REACH goes UP when this is injected, which is the whole reason the
    #    two readings have to be gated together.
    "nocap": (
        "   capChutes(5.0);",
        "   if(false)capChutes(5.0);",
    ),
    # 2. THE WEDGE. The boundary peg lifted off the rail onto the lattice's own
    #    half-pitch -- the version that reads as the tidy thing to do. It leaves a
    #    slot the width of a head, and the anti-stuck kick rate goes up ~20x.
    "wedge": (
        "for(r2=-1;r2<=1;r2+=2){px=(r2<0)?X0:W;py=yy+L.vs*0.5*hy+rnd(-3,3);",
        "for(r2=-1;r2<=1;r2+=2){px=(r2<0)?X0+L.p2*0.5:W-L.p2*0.5;py=yy+L.vs*0.5*hy+rnd(-3,3);",
    ),
    # 3. THE HOLLOW COURSE. The backfill switched off, which is the course as it stood
    #    before this pass: set pieces floating in air, a 22-head-diameter clear drop and
    #    a third of the course within reach of anything. The lane contact tally barely
    #    moves, which is exactly why this defect needed its own detector -- FAIRNESS and
    #    FLOOR both stayed green through it for the whole of the previous pass.
    "hollow": (
        "   backfill();                  // ...and now",
        "   if(false)backfill();         // ...and now",
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
    # -- "there isnt enough obsticales anywhere else" -------------------------
    # The contact tally cannot see this one: it counts what a lane MET, and a course can
    # score 30 obstacles a racer while a quarter of its depth is a single clear column.
    # CHUTE is the longest straight drop available anywhere in the course, in head
    # diameters. A working plinko board never lets a ball fall more than about 1.7
    # diameters untouched inside its field; this course has set pieces to get past, so
    # the bar is the worst SEED, not the reference.
    f.check(d["chute_p95"] <= 17.0, "no long free fall anywhere on the course",
            "longest clear drop, p95 of seeds = %.1f head diameters "
            "(was 29.2 before the backfill; needs <= 17)" % d["chute_p95"])
    # -- "half of them arent even in the way of anything or placed to actually be an
    # obsticale" -- the reading this pass was built around. COVER says an obstacle is
    # NEAR the course; REACH says a racer touched it. The previous pass reported COVER
    # 33% -> 51% as a success against this exact sentence, which is why the gate is on
    # REACH and why COVER alone is no longer allowed to answer for it.
    f.check(d["reach_mean"] >= 0.68, "every obstacle is in somebody's way",
            "%.0f%% of everything built is touched by some racer (was 55%%; needs >= 68%%)"
            % (100 * d["reach_mean"]))
    f.check(d["reach_min"] >= 0.55, "...even on the unluckiest layout",
            "worst seed touches %.0f%% of its own course (needs >= 55%%)"
            % (100 * d["reach_min"]))
    # REACHABLE CHUTE: the raw CHUTE above counts the funnels' sealed outer wedges,
    # which are 18% of the grid and which no racer can enter. This is the same reading
    # with them painted out -- the free fall a racer can actually find.
    # 14, not 13, and the difference is a thing that cannot be designed away. A funnel
    # TUBE is two parallel walls one throat apart: nothing satisfies the clearance rule
    # between them, so every pixel of tube is free fall by construction, and the same is
    # true of the split's fast channel and of the run-in, which is deliberately clear so
    # the sweep-home works. Those three account for the whole of the remaining number.
    # It is still a real gate -- the build with the chute pass switched off reads far
    # past it, and so does the one that pours the lattice on a grid again.
    f.check(d.get("creach_p95", 0) <= 14.0, "no long free fall a racer can get to",
            "worst reachable clear column, p95 of seeds = %.1f head diameters (needs <= 14)"
            % d.get("creach_p95", 0))
    f.check(d["cover_mean"] >= 0.42, "the course is furnished, not decorated",
            "%.0f%% of the course is within a head-radius of an obstacle "
            "(was 33%%; needs >= 42%%)" % (100 * d["cover_mean"]))
    # -- "back in fourth whos in first ... allowing others to catch up" -------
    # Counting lead changes needs hysteresis and a worst case; see digest(). The gate is
    # on the DISTRIBUTION, because a healthy mean is compatible with a third of races
    # being processions, and the procession is the thing being complained about.
    f.check(d["lead_zero"] <= 0.02, "first place is contested in every race",
            "%.0f%% of races never change leader at all (needs <= 2%%)"
            % (100 * d["lead_zero"]))
    f.check(d["durable_mean"] >= 3.0, "the lead actually changes hands",
            "%.1f changes a race where the new leader held it a full second "
            "(needs >= 3.0)" % d["durable_mean"])
    # The gate is on the MEDIAN, not the p95. Measured both before and after, the worst
    # 5% of races run 87-88% quiet either way: that tail is a race where one head gets
    # clear at the first choke and the course never gets it back, and no layout tested
    # here moved it. The median did move, 43% -> 39%, and it is the honest claim.
    f.check(d["quiet_p50"] <= 0.45, "the typical race is not a procession",
            "the longest stretch with nobody going past is %.0f%% of the median race "
            "(was 43%%; needs <= 45%%).  p95 is %.0f%% and was 87%%"
            % (100 * d["quiet_p50"], 100 * d["quiet_p95"]))
    f.check(d["half_kept"] <= 0.45, "leading at halfway is not winning",
            "%.0f%% of races are won by whoever led at the halfway depth "
            "(needs <= 45%%; 100%% would be a procession, 8%% pure chance)"
            % (100 * d["half_kept"]))
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
        # -- THE DRAMA READING (see play-engine.js's drama()) --------------------
        # `winner` is read back from the tally rather than from drama(): the engine's
        # own `order[0]` is empty in a race nobody finished, and a race that stalled
        # still has a leader worth asking about. A seed with nobody across the line
        # contributes a lead-change count and no halfway verdict.
        dr = r.get("drama") or {}
        won = min(finishers, key=lambda b: b["t"])["i"] if finishers else None
        half = dr.get("half", -1)
        # REIGNS. A raw change count is not the thing a viewer feels: eight changes in
        # the first four seconds followed by an eighteen-second procession is exactly
        # the complaint, and its mean is identical to eight changes spread evenly.
        # So the log is turned into reigns, and the reading that matters is the LONGEST
        # ONE -- the longest stretch of the race during which nobody went past.
        log, tEnd = dr.get("log") or [], (times[0] * 1000.0 if times else None)
        reigns, durable, quiet, lastfrac, distinct = [], None, None, None, None
        if log and tEnd and tEnd > 0:
            marks = [e[0] for e in log] + [tEnd]
            reigns = [marks[i + 1] - marks[i] for i in range(len(marks) - 1)]
            reigns = [v for v in reigns if v >= 0]
            durable = sum(1 for v in reigns[:-1] if v >= 1000)   # changes whose new leader actually held it for a second
            quiet = max(reigns) / tEnd if reigns else None
            lastfrac = log[-1][0] / tEnd if len(log) > 1 else 0.0
            distinct = len({e[1] for e in log})
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
            "D": r["course"].get("D"), "DM": r["course"].get("DM"),
            "leads": dr.get("changes"),
            "half_kept": (None if (won is None or half is None or half < 0)
                          else (half == won)),
            "late": (None if not dr.get("log") or not times else
                     sum(1 for e in dr["log"] if e[0] > 500 * times[0]) ),
            "durable": durable, "quiet": quiet, "lastfrac": lastfrac, "distinct": distinct,
            "reach": r.get("reach"),
            "chute": (r.get("chute") or {}).get("max"),
            "chuteR": (None if not r.get("chute") or not r["chute"].get("D")
                       or r["chute"].get("reach") is None
                       else r["chute"]["reach"] / r["chute"]["D"]),
            "chute_med": (r.get("chute") or {}).get("med"),
            "cover": (r.get("chute") or {}).get("cover"),
            "chuteD": (None if not r.get("chute") or not r["chute"].get("D")
                       else r["chute"]["max"] / r["chute"]["D"]),
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
    leads = [p["leads"] for p in per_race if p["leads"] is not None]
    kept = [p["half_kept"] for p in per_race if p["half_kept"] is not None]
    late = [p["late"] for p in per_race if p["late"] is not None]
    dur_ch = [p["durable"] for p in per_race if p["durable"] is not None]
    quiet = [p["quiet"] for p in per_race if p["quiet"] is not None]
    dist_l = [p["distinct"] for p in per_race if p["distinct"] is not None]
    # -- REACH. "half of them arent even in the way of anything", as a number ---------
    # Per seed: what share of everything the course BUILT did any of the twelve racers
    # actually touch. Reported per type as well as overall, because a 60% headline that
    # is 95% of the set pieces and 45% of a peg lattice is a lattice problem, and the
    # aggregate hides which. Worst seed first: a mean here would hide the layout that
    # deals half its furniture behind a wall.
    reach_all, reach_kinds = [], {}
    for p in per_race:
        rc = p.get("reach")
        if not rc:
            continue
        n = sum(v["n"] for v in rc.values())
        h = sum(v["hit"] for v in rc.values())
        if n:
            reach_all.append(h / n)
        for k, v in rc.items():
            d = reach_kinds.setdefault(k, {"n": [], "hit": [], "frac": []})
            d["n"].append(v["n"])
            d["hit"].append(v["hit"])
            if v["n"]:
                d["frac"].append(v["hit"] / v["n"])
    chute = [p["chuteD"] for p in per_race if p["chuteD"] is not None]
    chuteR = [p["chuteR"] for p in per_race if p.get("chuteR") is not None]
    chpx = [p["chute"] for p in per_race if p["chute"] is not None]
    cover = [p["cover"] for p in per_race if p["cover"] is not None]
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
        # -- the lead-change distribution. Reported as a whole distribution and not a
        # median, because "the median race has 4 lead changes" is compatible with a
        # third of races having none at all, and a race with none is the procession.
        "lead_mean": statistics.fmean(leads) if leads else 0.0,
        "lead_p05": pct(leads, 5), "lead_p50": pct(leads, 50), "lead_p95": pct(leads, 95),
        "lead_min": min(leads) if leads else 0,
        "lead_zero": (statistics.fmean([1.0 if v == 0 else 0.0 for v in leads])
                      if leads else 0.0),
        "lead_hist": [sum(1 for v in leads if v == k) for k in range(0, 10)]
                     + [sum(1 for v in leads if v >= 10)],
        "late_mean": statistics.fmean(late) if late else 0.0,
        "late_zero": (statistics.fmean([1.0 if v == 0 else 0.0 for v in late])
                      if late else 0.0),
        # DECIDED EARLY: the share of races where whoever led at the midpoint of the
        # descent went on to win. 1.00 is a procession; 1/field is a coin with `field`
        # sides, which no course with a leader worth having will reach.
        "half_kept": statistics.fmean([1.0 if v else 0.0 for v in kept]) if kept else 0.0,
        "half_n": len(kept),
        # DURABLE changes (the new leader held it a second) and the LONGEST QUIET
        # STRETCH as a fraction of the race -- the procession detector a mean hides.
        "durable_mean": statistics.fmean(dur_ch) if dur_ch else 0.0,
        "durable_p05": pct(dur_ch, 5), "durable_p50": pct(dur_ch, 50),
        "durable_zero": (statistics.fmean([1.0 if v == 0 else 0.0 for v in dur_ch])
                         if dur_ch else 0.0),
        "quiet_mean": statistics.fmean(quiet) if quiet else 0.0,
        "quiet_p50": pct(quiet, 50), "quiet_p95": pct(quiet, 95),
        "leaders_mean": statistics.fmean(dist_l) if dist_l else 0.0,
        "leaders_p05": pct(dist_l, 5),
        # THE CLEAR CHUTE, in head diameters. See chutes() in RUN_BATCH.
        "chute_mean": statistics.fmean(chute) if chute else 0.0,
        "chute_p50": pct(chute, 50), "chute_p95": pct(chute, 95),
        "chute_max": max(chute) if chute else 0.0,
        "chute_px": statistics.fmean(chpx) if chpx else 0.0,
        "cover_mean": statistics.fmean(cover) if cover else 0.0,
        # REACHABLE chute: the same reading with the funnels' sealed wedges painted out.
        "creach_mean": statistics.fmean(chuteR) if chuteR else 0.0,
        "creach_p95": pct(chuteR, 95), "creach_max": max(chuteR) if chuteR else 0.0,
        # REACH: the share of built obstacles that any racer contacted. See above.
        "reach_mean": statistics.fmean(reach_all) if reach_all else 0.0,
        "reach_p05": pct(reach_all, 5), "reach_p50": pct(reach_all, 50),
        "reach_min": min(reach_all) if reach_all else 0.0,
        "reach_kinds": {k: {"n": statistics.fmean(v["n"]),
                            "hit": statistics.fmean(v["hit"]),
                            "frac": statistics.fmean(v["frac"]) if v["frac"] else 0.0,
                            "worst": min(v["frac"]) if v["frac"] else 0.0}
                        for k, v in sorted(reach_kinds.items())},
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
    print("\n  -- back and forth: is first place ever contested? --")
    print("  LEADS     mean %.1f  p05 %.0f  p50 %.0f  p95 %.0f  worst %d   "
          "(%.0f%% of races never change leader)"
          % (d["lead_mean"], d["lead_p05"], d["lead_p50"], d["lead_p95"],
             d["lead_min"], 100 * d["lead_zero"]))
    print("            histogram 0..9,10+  %s" % " ".join("%d" % v for v in d["lead_hist"]))
    print("  LATE      mean %.1f lead changes after the halfway clock   "
          "(%.0f%% of races have none)" % (d["late_mean"], 100 * d["late_zero"]))
    print("  DURABLE   mean %.1f  p05 %.0f  p50 %.0f   (%.0f%% of races have none: the "
          "leader is never displaced for a whole second)"
          % (d["durable_mean"], d["durable_p05"], d["durable_p50"], 100 * d["durable_zero"]))
    print("  QUIET     the longest stretch with NO lead change is %.0f%% of the race "
          "(p50 %.0f%%, p95 %.0f%%)"
          % (100 * d["quiet_mean"], 100 * d["quiet_p50"], 100 * d["quiet_p95"]))
    print("  LEADERS   %.1f different heads lead at some point  (p05 %.0f)"
          % (d["leaders_mean"], d["leaders_p05"]))
    print("  DECIDED   %.0f%% of races are won by whoever led at the halfway DEPTH  "
          "(n=%d; 100%% is a procession)" % (100 * d["half_kept"], d["half_n"]))
    print("\n  -- free fall: how much of the descent is nothing at all --")
    print("  CHUTE     the longest clear straight drop is %.1f head diameters "
          "(%.0fpx)  p50 %.1f  p95 %.1f  worst seed %.1f"
          % (d["chute_mean"], d["chute_px"], d["chute_p50"], d["chute_p95"], d["chute_max"]))
    print("  REACHABLE %.1f head diameters is the worst clear column a racer can actually"
          "\n            GET to (p95 %.1f, WORST SEED %.1f) -- the funnels' sealed outer"
          "\n            wedges painted out, because no racer has ever been in one"
          % (d.get("creach_mean", 0), d.get("creach_p95", 0), d.get("creach_max", 0)))
    print("  COVER     %.0f%% of the course's cells are within a head-radius of an obstacle"
          % (100 * d["cover_mean"]))
    print("\n  -- reach: is each obstacle actually IN THE WAY of anybody? --")
    print("  REACH     %.0f%% of everything built was touched by some racer   "
          "(p05 %.0f%%, p50 %.0f%%, worst seed %.0f%%)"
          % (100 * d["reach_mean"], 100 * d["reach_p05"], 100 * d["reach_p50"],
             100 * d["reach_min"]))
    for k, v in d.get("reach_kinds", {}).items():
        print("            %-6s %5.1f built  %5.1f touched  = %3.0f%%   (worst seed %3.0f%%)"
              % (k, v["n"], v["hit"], 100 * v["frac"], 100 * v["worst"]))
    print("\n  course    %.0f pegs  %.0f segments  %.0f spinners  %.0f gates  "
          "%.0fpx to the line"
          % (d["obstacles"]["pegs"], d["obstacles"]["segs"], d["obstacles"]["spins"],
             d["obstacles"]["gates"], d["depth"]))


def compare(a, b):
    print("\n=== BEFORE -> AFTER ===")
    for d in (a, b):     # a digest written before the drama reading existed still diffs
        for k in ("lead_mean", "lead_p05", "lead_zero", "late_mean", "half_kept",
                  "durable_mean", "durable_zero", "quiet_p50", "quiet_p95",
                  "leaders_mean", "chute_mean", "chute_p95", "cover_mean"):
            d.setdefault(k, 0.0)
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
        ("lead changes, mean", a["lead_mean"], b["lead_mean"], "%.1f", "up"),
        ("lead changes, p05", a["lead_p05"], b["lead_p05"], "%.1f", "up"),
        ("races with NO lead change", a["lead_zero"], b["lead_zero"], "%.2f", "down"),
        ("lead changes after halfway", a["late_mean"], b["late_mean"], "%.1f", "up"),
        ("durable changes (held >=1s)", a["durable_mean"], b["durable_mean"], "%.1f", "up"),
        ("races with NO durable change", a["durable_zero"], b["durable_zero"], "%.2f", "down"),
        ("longest quiet stretch, p50", a["quiet_p50"], b["quiet_p50"], "%.2f", "down"),
        ("longest quiet stretch, p95", a["quiet_p95"], b["quiet_p95"], "%.2f", "down"),
        ("different heads that ever lead", a["leaders_mean"], b["leaders_mean"], "%.1f", "up"),
        ("won by the halfway leader", a["half_kept"], b["half_kept"], "%.2f", "down"),
        ("longest clear chute (head dia)", a["chute_mean"], b["chute_mean"], "%.1f", "down"),
        ("longest clear chute, p95", a["chute_p95"], b["chute_p95"], "%.1f", "down"),
        ("course cells near an obstacle", a["cover_mean"], b["cover_mean"], "%.3f", "up"),
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
