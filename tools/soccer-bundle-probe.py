#!/usr/bin/env python3
"""Does the soccer match actually WEDGE in the goalmouth, and does the keeper stop?

WHY THIS FILE EXISTS
--------------------
Jayden: "there is still a lot of bundling up in the soccer mode lots of people in
the goal and the 'goalie' of the other team just stands there."

Two claims, and neither can be settled by watching. A pile that clears in half a
second and a pile that lasts fifteen are the same picture in memory, and the
difference between them is the whole question -- on this project chaos that
RESOLVES is the product and chaos that STOPS is dead time. There is no hand crank
in the soccer mode the way there is in the marble race, so this drives real
matches at real speed and samples them at 10Hz.

WHAT IT FOUND (three 45s eight-head matches, 1440x900)
------------------------------------------------------
THE PILE DOES NOT WEDGE. Three or more players in a goal area happened nine times
in 2.2 minutes; the median spell lasted 0.2s and the WORST lasted 0.8s. Not one
spell in any configuration reached three seconds. The bundling is real, it is
frequent, and it clears in under a second every time -- so it is a thing to leave
alone. Anything that felt longer than that to a viewer is a camera or scoreboard
question, not a physics one.

THE KEEPER IS NOT STOPPING -- ITS LEASH IS SATURATING. Its target is a third of
the way from its own net to the ball, clamped to KEEPLEASH of the pitch; the clamp
binds 71% of the frames, so for most of a match the keeper is standing exactly
where it is being told to stand. And lengthening the leash is DISPROVED: at 0.15
and 0.20 the match gets monotonically quieter, because a keeper with more rope is
just a better goalkeeper.

  leash                    0.11      0.15      0.20
  saturated                 71%       55%       34%
  ball enters a goal area  13.8/min  11.1/min   7.1/min
  of those, fast (shots)    8.9/min   7.6/min   4.9/min
  goals per match             3.0       2.0       1.7
  3+ in a goal area      2% of play  3%       12%   (worst spell 0.8s -> 2.9s)

WHAT IT MEASURES
----------------
  PILE    players whose centre is inside a goal area, as the DISTRIBUTION OF RUN
          LENGTHS for runs of 3+. The question is never whether a pile happens --
          it should, it is the product -- but whether it ENDS.
  DEAD    the ball under DEADV px/s. Same treatment.
  ALONE   no player within REACH head-widths of the ball: un-contested time.
  LEASH   the share of frames on which the keeper's clamp is binding, read from
          the engine itself (play-engine.js publishes it under ?wraf=1) rather
          than inferred from position, so it is the actual branch and not a guess.
  And the things that must NOT get tidier: goals, entries into a goal area, fast
  entries, possession changes, and the share of play that is contested.

    python3 tools/soccer-bundle-probe.py                    # 3 x 45s, as shipped
    python3 tools/soccer-bundle-probe.py 45 3 8 out.json    # secs, matches, heads
    python3 tools/soccer-bundle-probe.py 45 3 8 out.json 0.20   # ...with the leash swapped

NOTE ON THE INSTRUMENT. Everything comes from the simulation's own state via
window.__hmSoccer; nothing reads a screenshot. The sampling is real-time, so do
not run anything heavy alongside it -- stealing CPU from the page changes the
match you are measuring.
"""
import json
import statistics
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent.parent
SEED_HEADS = (ROOT / "tools" / "race-fairness-probe.py").read_text() \
    .split('SEED_HEADS = r"""')[1].split('"""')[0]
DT = 0.1
GOALBOX = 0.13      # share of the pitch width counted as "in the goal area"
DEADV = 90.0        # px/s: the ball is not going anywhere
REACH = 1.30        # multiples of a head width: close enough to be contesting

SAMPLE = r"""
() => {
  const S = window.__hmSoccer; if (!S || !S.on) return null;
  const g = S.geo || {};
  return {
    t: performance.now(), phase: S.phase, red: S.red, blue: S.blue,
    bx: S.ball.x, by: S.ball.y, bvx: S.ball.vx || 0, bvy: S.ball.vy || 0,
    XL: g.XL || 0, XR: g.XR || 1440, GH: g.GH || 150, gy: g.groundY || 0,
    p: (S.players || []).filter(q => !q.elim)
        .map(q => ({s: q.slot, tm: q.team || 0, r: q.role || '', x: q.x, y: q.y, hw: q.hw, k: q.kSat|0}))
  };
}
"""


# --leash N re-serves play-engine.js with the keeper's leash swapped, so the
# before/after of the one number this file exists to argue about needs no edit.
LEASH_NOW = ('if(role==="keeper")bxT=team===1?Math.min(bxT,heroR.w*0.11)'
             ':Math.max(bxT,heroR.w*0.89-HW);')


class Inj(SimpleHTTPRequestHandler):
    on = False
    leash = None

    def log_message(self, *a):
        pass

    def send_head(self):
        if self.leash and self.path.split("?")[0] == "/play-engine.js":
            src = (ROOT / "play-engine.js").read_text()
            if LEASH_NOW not in src:
                raise SystemExit(
                    "soccer-bundle-probe can no longer swap the keeper's leash: the "
                    "anchor %r is gone from play-engine.js, so --leash is measuring "
                    "nothing." % LEASH_NOW)
            k = float(self.leash)
            swapped = ('if(role==="keeper")bxT=team===1?Math.min(bxT,heroR.w*%s)'
                       ':Math.max(bxT,heroR.w*%s-HW);' % (k, round(1 - k, 10)))
            body = src.replace(LEASH_NOW, swapped).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            import io
            return io.BytesIO(body)
        return SimpleHTTPRequestHandler.send_head(self)


def collect(match_s, seeds, heads, leash=None):
    from playwright.sync_api import sync_playwright
    Inj.leash = leash
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(Inj, directory=str(ROOT)))
    Thread(target=srv.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % srv.server_port
    out = []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(headless=True, args=["--force-color-profile=srgb"])
            pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
            pg.goto(base + "/play.html", wait_until="load")
            pg.evaluate(SEED_HEADS, heads)
            pg.goto(base + "/play.html?wraf=1", wait_until="load")
            pg.wait_for_timeout(2600)
            for m in range(seeds):
                pg.evaluate("() => window.__hmSoccerStart && window.__hmSoccerStart()")
                pg.wait_for_timeout(4200)
                frames = []
                n = int(match_s / DT)
                for i in range(n):
                    f = pg.evaluate(SAMPLE)
                    if f:
                        frames.append(f)
                    pg.wait_for_timeout(int(DT * 1000))
                out.append(frames)
                print("\r  match %d/%d  (%d frames)" % (m + 1, seeds, len(frames)),
                      end="", file=sys.stderr)
                try:
                    pg.evaluate("() => window.__hmSoccerEnd && window.__hmSoccerEnd()")
                except Exception:
                    pass
                pg.wait_for_timeout(1200)
            print("", file=sys.stderr)
            b.close()
    finally:
        srv.shutdown(); srv.server_close()
    return out


def runs(flags):
    """Lengths, in seconds, of every unbroken run of True."""
    out, n = [], 0
    for v in flags:
        if v:
            n += 1
        elif n:
            out.append(n * DT); n = 0
    if n:
        out.append(n * DT)
    return out


def pct(xs, p):
    if not xs:
        return 0.0
    ys = sorted(xs); k = (len(ys) - 1) * p / 100.0
    import math
    lo, hi = math.floor(k), math.ceil(k)
    return ys[lo] if lo == hi else ys[lo] + (ys[hi] - ys[lo]) * (k - lo)


def digest(matches, label):
    pile_runs, dead_runs, alone_runs = [], [], []
    keeper_far, keeper_near, contested, poss, goals = [], [], 0, 0, 0
    sat = []
    total = 0
    for fr in matches:
        if len(fr) < 20:
            continue
        XL, XR = fr[0]["XL"], fr[0]["XR"]
        W = XR - XL
        gl, gr = XL + W * GOALBOX, XR - W * GOALBOX
        piles, deads, alones = [], [], []
        last_team, prev = None, {}
        goals += (fr[-1]["red"] + fr[-1]["blue"]) - (fr[0]["red"] + fr[0]["blue"])
        for k, f in enumerate(fr):
            total += 1
            hw = statistics.fmean([q["hw"] for q in f["p"]]) if f["p"] else 100.0
            inL = sum(1 for q in f["p"] if q["x"] < gl)
            inR = sum(1 for q in f["p"] if q["x"] > gr)
            piles.append(max(inL, inR) >= 3)
            sp = (f["bvx"] ** 2 + f["bvy"] ** 2) ** 0.5
            deads.append(sp < DEADV)
            d = [((q["x"] - f["bx"]) ** 2 + (q["y"] - f["by"]) ** 2) ** 0.5 for q in f["p"]]
            near = min(d) if d else 1e9
            alones.append(near > REACH * hw)
            if near <= REACH * hw:
                contested += 1
                tm = f["p"][d.index(near)]["tm"]
                if last_team is not None and tm != last_team:
                    poss += 1
                last_team = tm
            for q in f["p"]:
                if q["r"] != "keeper":
                    continue
                sat.append(q.get("k", 0))
                if q["s"] in prev:
                    dx = abs(q["x"] - prev[q["s"]]) / DT
                    mid = XL + W * 0.5
                    own_half = (f["bx"] < mid) if q["x"] < mid else (f["bx"] > mid)
                    (keeper_near if own_half else keeper_far).append(dx)
                prev[q["s"]] = q["x"]
        pile_runs += runs(piles); dead_runs += runs(deads); alone_runs += runs(alones)
    mins = total * DT / 60.0
    print("\n%s  --  %d matches, %.1f minutes of play" % (label, len(matches), mins))
    for nm, rs in (("PILE  3+ in a goal area", pile_runs), ("DEAD  ball under %.0fpx/s" % DEADV, dead_runs),
                   ("ALONE no player near the ball", alone_runs)):
        if not rs:
            print("  %-30s never happens" % nm); continue
        print("  %-30s %3d runs   p50 %.1fs  p90 %.1fs  max %.1fs   over 3s: %d   "
              "%.0f%% of play"
              % (nm, len(rs), pct(rs, 50), pct(rs, 90), max(rs),
                 sum(1 for v in rs if v > 3.0), 100 * sum(rs) / max(1e-9, total * DT)))
    print("  KEEPER  %.0f px/s while the ball is in ITS OWN half, %.0f px/s while it is not"
          % (statistics.fmean(keeper_near) if keeper_near else 0,
             statistics.fmean(keeper_far) if keeper_far else 0))
    print("  LEASH   the keeper's target is pinned at its clamp %.0f%% of the match"
          % (100 * statistics.fmean(sat) if sat else 0))
    print("  KEEPER  still (under 5px/s) %.0f%% of the time with the ball in its own half"
          % (100 * statistics.fmean([1.0 if v < 5 else 0.0 for v in keeper_near])
             if keeper_near else 0))
    print("  -- the chaos, which must NOT get tidier --")
    print("  goals %.1f a match   possession changes %.1f a minute   contested %.0f%% of play"
          % (goals / max(1, len(matches)), poss / max(1e-9, mins), 100 * contested / max(1, total)))


if __name__ == "__main__":
    secs = float(sys.argv[1]) if len(sys.argv) > 1 else 70
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    heads = int(sys.argv[3]) if len(sys.argv) > 3 else 8
    leash = sys.argv[5] if len(sys.argv) > 5 else None
    ms = collect(secs, n, heads, leash=leash)
    if len(sys.argv) > 4:
        Path(sys.argv[4]).write_text(json.dumps(ms))
    digest(ms, "soccer -- keeper leash %s" % (leash or "as shipped (0.11)"))
