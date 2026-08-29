#!/usr/bin/env python3
"""Which racers never reach the line, and what are they resting on when they don't?

WHY THIS FILE EXISTS
--------------------
Jayden: "I noticed for the marble game that some of the obsticles made it imposible for
them to cross the finish line. make sure that is working well for the tournment and fantasy
football tournment modes."

He is right and it is not rare. tools/race-fairness-probe.py already reports COMPLETE, and
on the shipped course it reads 49% of races resolving all twelve, mean 9.0 finishers -- so
three racers a race, on average, are still on the hill when it is called. That matters far
beyond the race screen: the race SEEDS the cup (both the tournament and the Yowmings
League), and a racer with no finishing position is a seed the bracket has to invent.

WHAT THE FAIRNESS PROBE CANNOT SAY, AND THIS ONE CAN. It reports the RATE. It reads one
tally at the end, so a stalled racer is a final (x, y) with no history: it cannot say
whether that racer stopped dead at 20 seconds or was still crawling at 69, and it cannot
say whether the anti-stuck kick was firing and failing or never firing at all. Those are
different bugs with different fixes, and the recorded signature of the known one --
"a head resting 54px above a sliding gate, 874px from the line, nud=0" -- is precisely a
claim about the counter, not about the place.

So this samples the crank at 4Hz and, per racer, tracks a HIGH-WATER MARK of depth:

  STALL   the longest stretch in which a racer's deepest point did not improve by more
          than one head radius. A high-water mark, not a delta, because a racer bobbing
          on a moving obstacle passes any "did y increase this frame" test twice a second
          while going nowhere -- which is exactly how the sliding gate hides.
  WHERE   the depth (% of the descent) and the x (% of the width) at which that stall
          happened, so a wedge shows up as a cluster rather than as an anecdote.
  NUD     the anti-stuck counter at the end, and the hard-kick count. nud pinned at 0
          through a 40-second stall means the detector never even considered it stuck.

Everything is read from the simulation's own state under ?wraf=1. Nothing here reads a
screenshot, and the crank is play-engine.js's own __race.sim(), so the race being measured
is the shipped one.

    python3 tools/play-race-stall-probe.py                 # 60 seeds
    python3 tools/play-race-stall-probe.py --seeds 160
    python3 tools/play-race-stall-probe.py --json out.json
    python3 tools/play-race-stall-probe.py --compare a.json b.json    # no browser needed
"""
import argparse
import importlib.util
import json
import statistics
import sys
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "race_fairness_probe", ROOT / "tools" / "race-fairness-probe.py")
FAIR = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(FAIR)

FIELD = FAIR.FIELD
SIM_SECONDS = 70.0
SLICE = 0.25          # seconds per crank slice: 4Hz is plenty for a stall measured in seconds
                      # and cheap enough that 60 seeds is one minute rather than ten

RUN = r"""
([seeds, simSec, slice]) => {
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
      const c0 = window.__race.course();
      // High-water depth per racer, and the longest window it failed to improve.
      const n = window.__race.tally().length;
      const best = new Array(n).fill(-1e9), held = new Array(n).fill(0);
      const worst = new Array(n).fill(0), atY = new Array(n).fill(0), atX = new Array(n).fill(0);
      const mark = new Array(n).fill(null), touch = new Array(n).fill(null);
      const R = c0.D / 2;
      let t = 0;
      while (t < simSec && window.__hmRaceOn) {
        const did = window.__race.sim(slice);
        t += (did || slice);
        const b = window.__race.tally();
        for (let i = 0; i < n; i++) {
          if (b[i].fin) { held[i] = 0; continue; }
          if (b[i].y > best[i] + R) { best[i] = b[i].y; held[i] = 0; mark[i] = null; }
          else {
            // WHAT IS IT TOUCHING WHILE IT GOES NOWHERE. The per-type contact counters are
            // already kept by the engine under ?wraf=1; the DELTA across the stall window
            // names the obstacle holding the racer up, which a final (x, y) cannot.
            if (!mark[i]) mark[i] = {peg: b[i].peg, seg: b[i].seg, gate: b[i].gate, spin: b[i].spin};
            held[i] += slice;
            if (held[i] > worst[i]) {
              worst[i] = held[i]; atY[i] = b[i].y; atX[i] = b[i].x;
              touch[i] = {peg: b[i].peg - mark[i].peg, seg: b[i].seg - mark[i].seg,
                          gate: b[i].gate - mark[i].gate, spin: b[i].spin - mark[i].spin};
            }
          }
        }
        if (!did) break;
      }
      const balls = window.__race.tally();
      rec = {seed: s, t: +t.toFixed(2), course: c0,
             balls: balls.map((b, i) => ({lane: b.lane, f: !!b.f, fin: !!b.fin,
               y: b.y, x: b.x, nud: b.nud | 0, kick: b.kick | 0,
               stall: +worst[i].toFixed(2), sy: atY[i], sx: atX[i], touch: touch[i]}))};
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


def collect(seeds, league=False):
    from playwright.sync_api import sync_playwright
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(FAIR.Handler, directory=str(ROOT)))
    Thread(target=srv.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % srv.server_port
    out = []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(headless=True, args=["--force-color-profile=srgb"])
            pg = b.new_context(viewport={"width": FAIR.VIEWPORT[0],
                                         "height": FAIR.VIEWPORT[1]}).new_page()
            pg.goto(base + "/play.html", wait_until="load")
            pg.evaluate(FAIR.SEED_HEADS, FIELD)
            if league:
                # BEFORE the load that boots the race: rails() reads the flag
                # inside buildCourse(). The League is a DIFFERENT COURSE.
                pg.add_init_script("window.__hmYowLeague = true;")
            pg.goto(base + "/play.html?wraf=1", wait_until="load")
            pg.wait_for_timeout(2400)
            if not pg.evaluate("() => !!(window.__race && window.__race.sim)"):
                raise SystemExit("play-engine.js exposed no __race.sim under ?wraf=1")
            if league and not pg.evaluate("() => !!window.__hmYowLeague"):
                raise SystemExit("--league did not survive the navigation; the course "
                                 "measured would be the standalone one.")
            for i in range(0, len(seeds), 5):
                chunk = seeds[i:i + 5]
                out.extend(pg.evaluate(RUN, [chunk, SIM_SECONDS, SLICE]))
                print("\r  %d/%d seeds" % (len(out), len(seeds)), end="", file=sys.stderr)
            print("", file=sys.stderr)
            b.close()
    finally:
        srv.shutdown(); srv.server_close()
    return out


def digest(records):
    recs = [r for r in records if not r.get("err")]
    if not recs:
        raise SystemExit("no usable seeds")
    dnf, fin, stalls, band, xs, touches = [], 0, [], {}, [], []
    nud_zero = nud_any = 0
    complete = 0
    for r in recs:
        c = r["course"]
        top = c["H"] * 0.42          # the drop is above this; the descent is what is measured
        depth = max(1.0, c["finishY"] - top)
        n = len(r["balls"])
        misses = [b for b in r["balls"] if not b["fin"]]
        if not misses:
            complete += 1
        dnf.append(len(misses))
        fin += n - len(misses)
        for b in misses:
            stalls.append(b["stall"])
            frac = min(1.0, max(0.0, (b["sy"] - top) / depth))
            band[int(frac * 10) * 10] = band.get(int(frac * 10) * 10, 0) + 1
            xs.append((b["sx"] - c["X0"]) / max(1.0, c["CW"]))
            if b.get("touch"):
                touches.append(b["touch"])
            if b["nud"] == 0:
                nud_zero += 1
            else:
                nud_any += 1
    total = sum(len(r["balls"]) for r in recs)
    return {"seeds": len(recs), "complete": complete / len(recs),
            "dnf_per_race": statistics.mean(dnf), "finish_rate": fin / total,
            "stall_p50": FAIR.pct(stalls, 50) if stalls else 0,
            "stall_p95": FAIR.pct(stalls, 95) if stalls else 0,
            "stall_max": max(stalls) if stalls else 0,
            "band": band, "nud_zero": nud_zero, "nud_any": nud_any,
            "touch": {k: sum(t.get(k, 0) for t in touches) / max(1, len(touches))
                      for k in ("peg", "seg", "gate", "spin")},
            "x_p50": statistics.median(xs) if xs else 0}


def report(d, title):
    print("\n%s  --  %d seeds, %d heads" % (title, d["seeds"], FIELD))
    print("  COMPLETE   %.0f%% of races resolved every racer  (%.1f left on the hill a race)"
          % (100 * d["complete"], d["dnf_per_race"]))
    print("  FINISHERS  %.1f%% of racers crossed the line" % (100 * d["finish_rate"]))
    if d["nud_zero"] + d["nud_any"]:
        print("  STALL      longest no-progress window  p50 %.1fs  p95 %.1fs  max %.1fs"
              % (d["stall_p50"], d["stall_p95"], d["stall_max"]))
        print("  ANTI-STUCK %d of %d non-finishers had nud=0 -- the detector never fired on them"
              % (d["nud_zero"], d["nud_zero"] + d["nud_any"]))
        print("  WHERE      by depth band (%% of the descent):")
        for k in sorted(d["band"]):
            print("             %3d-%3d%%  %s %d" % (k, k + 10, "#" * min(60, d["band"][k]), d["band"][k]))
        print("             median x %.2f across the course (0 = left rail, 1 = right)" % d["x_p50"])
        if d.get("touch"):
            print("  HOLDING    contacts made DURING the worst stall, per non-finisher:")
            for k in sorted(d["touch"], key=lambda k: -d["touch"][k]):
                print("             %-6s %.1f" % (k, d["touch"][k]))


def worst(records, n):
    """The individual worst parks, named. A distribution says a defect exists; a seed
    with a place on the course is what you can go and look at."""
    rows = []
    for r in records:
        if r.get("err"):
            continue
        c = r["course"]
        top = c["H"] * 0.42
        depth = max(1.0, c["finishY"] - top)
        for b in r["balls"]:
            rows.append((b["stall"], r["seed"], b["lane"], not b["fin"],
                         (b["sy"] - top) / depth, (b["sx"] - c["X0"]) / max(1.0, c["CW"]),
                         b["nud"], b.get("touch") or {}))
    rows.sort(reverse=True)
    if not rows:
        return
    print("\n  WORST PARKS   (depth%% down the descent, x%% across the course)")
    print("    stall   seed  lane  dnf   depth      x   nud   held by")
    for s, seed, lane, dnf, fy, fx, nud, t in rows[:n]:
        held = " ".join("%s+%d" % (k, v) for k, v in sorted(t.items(), key=lambda kv: -kv[1]) if v)
        print("   %6.1fs %6d %5d %5s  %5.0f%% %5.0f%% %5d   %s"
              % (s, seed, lane, "DNF" if dnf else "-", 100 * fy, 100 * fx, nud, held or "nothing"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=60)
    ap.add_argument("--json")
    ap.add_argument("--compare", nargs=2)
    ap.add_argument("--label", default="race stalls")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--league", action="store_true",
                    help="measure the YOWMINGS LEAGUE course, which is a different "
                         "course from the standalone one -- see race-fairness-probe.py")
    ap.add_argument("--viewport", metavar="WxH",
                    help="measure at this viewport instead of 1440x900")
    ap.add_argument("--worst", type=int, default=8,
                    help="print this many worst individual stalls, with seed and place")
    a = ap.parse_args()
    if a.viewport:
        w, h = a.viewport.lower().split("x")
        FAIR.VIEWPORT = (int(w), int(h))
    if a.compare:
        for path in a.compare:
            report(digest(json.load(open(path))), Path(path).stem)
        return 0
    recs = collect(list(range(a.start, a.start + a.seeds)), league=a.league)
    if a.json:
        json.dump(recs, open(a.json, "w"))
        print("  wrote %s" % a.json)
    report(digest(recs), "%s  [%dx%d%s]"
           % (a.label, FAIR.VIEWPORT[0], FAIR.VIEWPORT[1], ", LEAGUE" if a.league else ""))
    worst(recs, a.worst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
