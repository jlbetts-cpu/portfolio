#!/usr/bin/env python3
"""Does the match ever STOP, and how much of it happens in the air?

WHY THIS FILE EXISTS, AND WHY IT IS NOT soccer-bundle-probe.py
--------------------------------------------------------------
Jayden: "no players seem to be standing still or any breaking or ball getting
stuck or lame tug of wars ... the ball bouncing in the air is intresting heads
jumping up for it is intresting."

soccer-bundle-probe.py answered the question it was built for -- does the
GOALMOUTH PILE wedge -- and the answer was no (worst spell 0.8s). That probe
samples a real-time match at 10Hz. Two consequences make it the wrong instrument
for this question:

  * 10Hz IS TOO COARSE FOR A TAIL. A 0.4s standstill and a 0.5s one are the same
    four samples. The thing Jayden sees is the tail, not the mean, and the tail
    is exactly what a 100ms grid rounds off.
  * REAL TIME IS TOO SLOW FOR A SAMPLE. Three 45s matches is 2.2 minutes of play.
    A tail event at the 99th percentile needs hundreds of matches, not three.

So this one CRANKS THE CLOCK, exactly the way the tournament's Simulate does
(play-tournament.js's CLOCK): performance.now, requestAnimationFrame and
setTimeout are replaced with virtual ones, and the world is pumped one 1/60
frame at a time. That is the REAL match -- the same engine, the same AI, the
same physics, never a dice roll -- and it yields a sample on EVERY frame at
tens of times wall speed.

WHAT IT MEASURES
----------------
  STILL   the ball under STILLV px/s while the phase is "play", as the
          distribution of run lengths. Frames, not tenths.
  TUG     two or more heads within a head-width of the ball AND the ball going
          nowhere. This is the "lame tug of war" named directly: a contest is
          only lame when nothing comes of it.
  STUCK   the longest window the ball spends inside a STUCKR-px circle, and
          where on the pitch those windows are.
  AIR     the share of play the ball is off the deck, and the mean number of
          heads off the ground.
  RATE    goals, shots, direction changes and possession changes per minute.

The things that must NOT get tidier are printed alongside, because every one of
them is a thing Jayden has defended: contested share, possession changes, and
the keeper's leash saturation.

    python3 tools/soccer-flow-probe.py                     # 12 matches, 8 heads
    python3 tools/soccer-flow-probe.py 12 8 out.json       # matches, heads, dump
    python3 tools/soccer-flow-probe.py 12 8 out.json BASE  # label the run

NOTE ON THE INSTRUMENT. Everything comes from window.__hmSoccer under ?wraf=1.
Nothing reads a screenshot, and nothing here changes the engine -- the crank is
installed in the page from outside, and the match it drives is the shipped one.
"""
import json
import math
import statistics
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent.parent
SEED_HEADS = (ROOT / "tools" / "race-fairness-probe.py").read_text() \
    .split('SEED_HEADS = r"""')[1].split('"""')[0]

DT = 1.0 / 60.0
STILLV = 60.0     # px/s: the ball is not going anywhere
TUGR = 1.05       # multiples of a head width: close enough to be shoving
STUCKR = 70.0     # px: the radius that counts as "the same place"
AIRCLR = 0.6      # ball radii of clearance that counts as genuinely airborne
STUCKHOLD = 2.0   # seconds inside one circle before it counts as an episode

# The crank. Same shape as play-tournament.js's CLOCK, installed from outside so
# the engine under test is byte-for-byte the shipped one.
CRANK = r"""
() => {
  if (window.__flowCrank) return true;
  const realRAF = window.requestAnimationFrame.bind(window);
  const realST  = window.setTimeout.bind(window);
  const realCT  = window.clearTimeout.bind(window);
  const perf    = window.performance;
  const realNow = perf.now.bind(perf);
  let warped = false, vt = 0, offset = 0;
  let rafQ = [], rafId = 1, timers = [], tid = 1;
  const vnow = () => warped ? vt : realNow() + offset;
  try { perf.now = vnow; } catch (_) {}
  window.requestAnimationFrame = function (fn) {
    if (!warped) return realRAF(ts => fn(ts + offset));
    const id = rafId++; rafQ.push({ id, fn }); return id; };
  window.cancelAnimationFrame = function (id) {
    for (let i = 0; i < rafQ.length; i++) if (rafQ[i].id === id) { rafQ.splice(i, 1); return; } };
  window.setTimeout = function (fn, ms) {
    if (!warped) return realST.apply(null, arguments);
    const t = { id: 'v' + (tid++), at: vt + (+ms || 0), fn,
                args: Array.prototype.slice.call(arguments, 2) };
    timers.push(t); return t.id; };
  window.clearTimeout = function (id) {
    if (typeof id === 'string' && id.charAt(0) === 'v') {
      for (let i = 0; i < timers.length; i++) if (timers[i].id === id) { timers.splice(i, 1); return; }
      return; }
    return realCT(id); };
  function fireDue() {
    for (let guard = 0; guard < 5000; guard++) {
      let best = -1;
      for (let i = 0; i < timers.length; i++)
        if (timers[i].at <= vt && (best < 0 || timers[i].at < timers[best].at)) best = i;
      if (best < 0) return;
      const t = timers[best]; timers.splice(best, 1);
      try { t.fn.apply(null, t.args); } catch (_) {}
    } }
  window.__flowCrank = {
    on: () => new Promise(res => {
      if (warped) return res(true);
      realRAF(() => realRAF(() => { warped = true; vt = realNow() + offset; res(true); })); }),
    pump(n, sample) {
      const out = [];
      for (let i = 0; i < n; i++) {
        vt += 1000 / 60;
        fireDue();
        const q = rafQ; rafQ = [];
        for (let j = 0; j < q.length; j++) { try { q[j].fn(vt); } catch (_) {} }
        if (sample) { const s = sample(); if (s) out.push(s); }
      }
      return out; },
    vnow };
  return true;
}
"""

# One frame of the simulation's own state. Flattened into arrays rather than
# objects: a 60Hz sample over a dozen matches is ~100k frames and the transport
# is the cost, not the physics.
SAMPLE = r"""
() => {
  window.__flowSample = () => {
    const S = window.__hmSoccer;
    if (!S || !S.on) return null;
    const g = S.geo || {};
    const ps = (S.players || []).filter(q => !q.elim);
    let near = 0, minD = 1e9, hw = 100, offGround = 0, satN = 0, satY = 0, nearTeam = 0;
    if (ps.length) hw = ps.reduce((a, q) => a + q.hw, 0) / ps.length;
    for (const q of ps) {
      const d = Math.hypot(q.x - S.ball.x, q.y - S.ball.y);
      if (d < minD) { minD = d; nearTeam = q.tm || q.team || 0; }
      if (d <= hw * 1.05) near++;
      if (!q.gr) offGround++;
      if (q.role === 'keeper') { satN++; satY += (q.kSat | 0); }
    }
    return [
      S.phase === 'play' ? 1 : 0,
      S.ball.x, S.ball.y, S.ball.vx || 0, S.ball.vy || 0,
      S.red, S.blue,
      near, +minD.toFixed(1), hw, offGround, ps.length,
      g.groundY || 0, g.BR || 24, g.XL || 0, g.XR || 1440,
      satN ? satY / satN : -1, nearTeam,
    ];
  };
  return true;
}
"""

F_PLAY, F_BX, F_BY, F_BVX, F_BVY, F_RED, F_BLUE, F_NEAR, F_MIND, F_HW, \
    F_OFFG, F_NP, F_GY, F_BR, F_XL, F_XR, F_SAT, F_NTEAM = range(18)


class Quiet(SimpleHTTPRequestHandler):
    """Serves the worktree, with one substitution.

    SOCCER_ENGINE=<path> serves that file as /play-engine.js instead of the one on
    disk, which is how a before/after is taken without editing the tree between the
    two runs -- `git show HEAD:play-engine.js > old.js` and point this at it. Same
    idiom soccer-bundle-probe.py uses for --leash, and for the same reason: a
    comparison whose two arms are separated by an edit is a comparison of two
    different trees.
    """

    engine = None

    def log_message(self, *a):
        pass

    def send_head(self):
        if self.engine and self.path.split("?")[0] == "/play-engine.js":
            body = Path(self.engine).read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            import io
            return io.BytesIO(body)
        return SimpleHTTPRequestHandler.send_head(self)


def collect(matches, heads, chunk=180, cap_frames=60 * 240):
    from playwright.sync_api import sync_playwright
    import os
    Quiet.engine = os.environ.get("SOCCER_ENGINE") or None
    if Quiet.engine:
        print("  serving %s as /play-engine.js" % Quiet.engine, file=sys.stderr)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(Quiet, directory=str(ROOT)))
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
            pg.evaluate(CRANK)
            pg.evaluate(SAMPLE)
            pg.evaluate("() => window.__flowCrank.on()")
            for m in range(matches):
                pg.evaluate("() => window.__hmSoccerStart && window.__hmSoccerStart()")
                frames = []
                while len(frames) < cap_frames:
                    got = pg.evaluate(
                        "n => window.__flowCrank.pump(n, window.__flowSample)", chunk)
                    frames += got
                    if len(got) < chunk:          # S.on went false: the match ended
                        break
                out.append(frames)
                print("\r  match %d/%d  (%d frames, %.0fs simulated)"
                      % (m + 1, matches, len(frames), len(frames) * DT),
                      end="", file=sys.stderr)
                try:
                    pg.evaluate("() => window.__hmSoccerEnd && window.__hmSoccerEnd()")
                except Exception:
                    pass
                pg.evaluate("n => window.__flowCrank.pump(n, null)", 120)
            print("", file=sys.stderr)
            b.close()
    finally:
        srv.shutdown(); srv.server_close()
    return out


def runs(flags):
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
    lo, hi = math.floor(k), math.ceil(k)
    return ys[lo] if lo == hi else ys[lo] + (ys[hi] - ys[lo]) * (k - lo)


def line(nm, rs, played):
    if not rs:
        print("  %-32s never happens" % nm); return
    print("  %-32s %4d runs  p50 %.2fs  p90 %.2fs  p99 %.2fs  max %.2fs  "
          "over 1.5s: %-3d  %.1f%% of play"
          % (nm, len(rs), pct(rs, 50), pct(rs, 90), pct(rs, 99), max(rs),
             sum(1 for v in rs if v > 1.5), 100 * sum(rs) / max(1e-9, played * DT)))


def digest(matches, label):
    still_r, tug_r, alone_r = [], [], []
    stuck_max, stuck_where, stuck_eps = 0.0, None, []
    played = 0
    air_f = deck_f = 0
    offg_sum = offg_n = 0
    goals = shots = dirchg = poss = contested = 0
    alone_air = alone_deck = 0
    sat = []
    lens = []
    for fr in matches:
        pf = [f for f in fr if f[F_PLAY]]
        if len(pf) < 60:
            continue
        lens.append(len(fr) * DT)
        goals += (fr[-1][F_RED] + fr[-1][F_BLUE]) - (fr[0][F_RED] + fr[0][F_BLUE])
        still, tug, alone = [], [], []
        last_team, last_sign = None, 0
        team_run, team_cand = 0, None
        in_shot = False
        # A ring buffer of recent positions: the longest window the ball stays
        # inside one STUCKR circle. This is "the ball is wedged", which is not
        # the same claim as "the ball is slow" -- a ball rolling a full pitch
        # width slowly is not stuck, and DECK_MAX's own note says so.
        win, held, held_at = [], 0, (0.0, 0.0)
        for f in pf:
            played += 1
            sp = math.hypot(f[F_BVX], f[F_BVY])
            still.append(sp < STILLV)
            tug.append(f[F_NEAR] >= 2 and sp < STILLV)
            alone.append(f[F_MIND] > TUGR * f[F_HW])
            rest = f[F_GY] - f[F_BR]
            airborne = f[F_BY] < rest - f[F_BR] * AIRCLR
            # ALONE SPLITS INTO TWO OPPOSITE THINGS and the aggregate hides which.
            # A ball in flight with nobody on it yet is the most alive moment on the
            # pitch -- it is the airborne ball Jayden asked for more of. A ball lying
            # on the grass with nobody on it is dead time and the only version that
            # is a defect. Reporting one number for both is how a fix that adds
            # flight time reads as a fix that adds dead time.
            if f[F_MIND] > TUGR * f[F_HW]:
                if airborne:
                    alone_air += 1
                else:
                    alone_deck += 1
            air_f += 1 if airborne else 0
            deck_f += 0 if airborne else 1
            offg_sum += f[F_OFFG]; offg_n += 1
            if f[F_SAT] >= 0:
                sat.append(f[F_SAT])
            if f[F_MIND] <= TUGR * f[F_HW]:
                contested += 1
                # HYSTERESIS, because the nearest head flickers between two
                # bodies in a scrum every other frame and a raw edge count
                # reports 2/s of "possession changes" that nobody could see.
                # A side has to hold the nearest touch for 8 frames (0.13s)
                # before the change is real.
                if f[F_NTEAM] == team_cand:
                    team_run += 1
                else:
                    team_cand, team_run = f[F_NTEAM], 1
                if team_run == 8 and team_cand != last_team:
                    if last_team is not None:
                        poss += 1
                    last_team = team_cand
            # A direction change is an EVENT, so it needs a deadband wide
            # enough that a ball jittering across zero does not emit one a
            # frame. 250px/s each way; below that the ball is not going
            # anywhere in either direction.
            sign = 1 if f[F_BVX] > 250 else (-1 if f[F_BVX] < -250 else 0)
            if sign and last_sign and sign != last_sign:
                dirchg += 1
            if sign:
                last_sign = sign
            # Edge-triggered: one shot per crossing, not one per frame spent
            # above the threshold.
            if abs(f[F_BVX]) > 900:
                if not in_shot:
                    shots += 1; in_shot = True
            elif abs(f[F_BVX]) < 700:
                in_shot = False
            win.append((f[F_BX], f[F_BY]))
            while len(win) > 1:
                xs = [p[0] for p in win]; ys = [p[1] for p in win]
                if (max(xs) - min(xs)) <= STUCKR and (max(ys) - min(ys)) <= STUCKR:
                    break
                win.pop(0)
                if held and held * DT >= STUCKHOLD:
                    # the window just broke: bank the episode that ended
                    stuck_eps.append((held * DT, held_at))
                held = 0
            if len(win) > held:
                held = len(win)
                held_at = ((f[F_BX] - f[F_XL]) / max(1.0, f[F_XR] - f[F_XL]),
                           (f[F_GY] - f[F_BY]) / max(1.0, f[F_GY]))
            if len(win) * DT > stuck_max:
                stuck_max = len(win) * DT
                stuck_where = held_at
        still_r += runs(still); tug_r += runs(tug); alone_r += runs(alone)
    mins = played * DT / 60.0
    print("\n%s  --  %d matches, %.1f minutes of play, median match %.0fs"
          % (label, len(lens), mins, statistics.median(lens) if lens else 0))
    line("STILL ball under %.0fpx/s" % STILLV, still_r, played)
    line("TUG   2+ heads on a dead ball", tug_r, played)
    line("ALONE nobody near the ball", alone_r, played)
    print("  %-32s in flight %.1f%% of play   ON THE DECK %.1f%% of play"
          % ("      ...and of that,", 100 * alone_air / max(1, played),
             100 * alone_deck / max(1, played)))
    eps = sorted((v for v, _ in stuck_eps), reverse=True)
    print("  %-32s %4d over %.0fs  p90 %.2fs  max %.2fs   %.1f%% of play"
          % ("STUCK in one %.0fpx circle" % STUCKR, len(eps), STUCKHOLD,
             pct(eps, 90), stuck_max, 100 * sum(eps) / max(1e-9, played * DT)))
    for v, w in sorted(stuck_eps, reverse=True)[:4]:
        print("        %5.2fs at %3.0f%% across the pitch, %2.0f%% up"
              % (v, 100 * w[0], 100 * w[1]))
    print("  -- the air, which is what he asked for more of --")
    print("  %-32s %.1f%% of play      heads off the ground %.2f of %d"
          % ("AIR   ball clear of the deck", 100 * air_f / max(1, played),
             offg_sum / max(1, offg_n),
             round(statistics.fmean([f[F_NP] for m in matches for f in m])) if matches else 0))
    print("  -- the rates --")
    print("  goals %.1f/match  %.1f/min    shots %.1f/min    "
          "direction changes %.1f/min"
          % (goals / max(1, len(lens)), goals / max(1e-9, mins),
             shots / max(1e-9, mins), dirchg / max(1e-9, mins)))
    print("  -- the chaos, which must NOT get tidier --")
    print("  contested %.0f%% of play   possession changes %.1f/min   "
          "keeper leash pinned %.0f%%"
          % (100 * contested / max(1, played), poss / max(1e-9, mins),
             100 * statistics.fmean(sat) if sat else 0))
    return {
        "label": label, "matches": len(lens), "minutes": mins,
        "median_match_s": statistics.median(lens) if lens else 0,
        "still": {"p50": pct(still_r, 50), "p90": pct(still_r, 90),
                  "p99": pct(still_r, 99), "max": max(still_r) if still_r else 0,
                  "share": sum(still_r) / max(1e-9, played * DT),
                  "over_1s5": sum(1 for v in still_r if v > 1.5)},
        "tug": {"p50": pct(tug_r, 50), "p90": pct(tug_r, 90), "p99": pct(tug_r, 99),
                "max": max(tug_r) if tug_r else 0,
                "share": sum(tug_r) / max(1e-9, played * DT),
                "over_1s5": sum(1 for v in tug_r if v > 1.5)},
        "stuck_max_s": stuck_max,
        "stuck_episodes": len(eps),
        "stuck_p90": pct(eps, 90),
        "stuck_share": sum(eps) / max(1e-9, played * DT),
        "air_share": air_f / max(1, played),
        "heads_off_ground": offg_sum / max(1, offg_n),
        "goals_per_match": goals / max(1, len(lens)),
        "goals_per_min": goals / max(1e-9, mins),
        "shots_per_min": shots / max(1e-9, mins),
        "dirchg_per_min": dirchg / max(1e-9, mins),
        "alone_air": alone_air / max(1, played),
        "alone_deck": alone_deck / max(1, played),
        "contested": contested / max(1, played),
        "poss_per_min": poss / max(1e-9, mins),
        "leash_pinned": statistics.fmean(sat) if sat else 0,
    }


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    heads = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    dump = sys.argv[3] if len(sys.argv) > 3 else None
    label = sys.argv[4] if len(sys.argv) > 4 else "soccer"
    ms = collect(n, heads)
    d = digest(ms, label)
    if dump:
        Path(dump).write_text(json.dumps(d, indent=1))
        print("\n  wrote %s" % dump)
