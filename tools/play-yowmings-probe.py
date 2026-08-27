#!/usr/bin/env python3
"""Did the Yowmings League regress what the soccer fix just won?

WHY THIS FILE EXISTS RATHER THAN A FLAG ON soccer-flow-probe.py
---------------------------------------------------------------
668ad73 bought three measured numbers -- the ball inside one 70px circle 76% -> 2.4%
of play, the worst episode 119.1s -> 3.8s, airborne 39% -> 59% -- and the League
inherits every line of physics that produced them. The claim "the mode did not fork
the engine" is only worth anything if it is MEASURED on the mode, so this drives the
League through the same instrument and prints the two columns side by side.

It does not copy the instrument. CRANK, SAMPLE, the field indices and digest() are
imported from tools/soccer-flow-probe.py, so the two arms of the comparison cannot
drift apart by an edit to one of them -- which is the whole failure mode a second
copy of a probe has. The only thing this file adds is one line before kickoff:

    window.__hmYowLeague = true

which is exactly what the Play screen's League door sets, so what is measured is the
shipped launcher's match and not a lab configuration.

    python3 tools/play-yowmings-probe.py              # 6 matches each, 8 heads
    python3 tools/play-yowmings-probe.py 10 8         # matches per mode, heads
"""
import importlib.util
import sys
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location(
    "soccer_flow_probe", ROOT / "tools" / "soccer-flow-probe.py")
FLOW = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(FLOW)


def collect(yow, matches, heads, chunk=180, cap_frames=60 * 240):
    """soccer-flow-probe's collect(), with the mode flag set before each kickoff.

    The flag is set per match rather than once, because the engine clears it at the
    whistle (play-engine.js's finish(), which takes hmYow off for the same reason it
    takes hmFinal off) -- so a League match two would otherwise be a soccer match.
    """
    from playwright.sync_api import sync_playwright
    FLOW.Quiet.engine = None
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(FLOW.Quiet, directory=str(ROOT)))
    Thread(target=srv.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:%d" % srv.server_port
    out = []
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(headless=True, args=["--force-color-profile=srgb"])
            pg = b.new_context(viewport={"width": 1440, "height": 900}).new_page()
            pg.goto(base + "/play.html", wait_until="load")
            pg.evaluate(FLOW.SEED_HEADS, heads)
            pg.goto(base + "/play.html?wraf=1", wait_until="load")
            pg.wait_for_timeout(2600)
            pg.evaluate(FLOW.CRANK)
            pg.evaluate(FLOW.SAMPLE)
            pg.evaluate("() => window.__flowCrank.on()")
            for m in range(matches):
                pg.evaluate("v => { window.__hmYowLeague = v; }", bool(yow))
                pg.evaluate("() => window.__hmSoccerStart && window.__hmSoccerStart()")
                # Prove the mode actually took, once, rather than trusting the flag.
                if m == 0:
                    # S.yow, not S.geo.yow: geo is only published inside the ball step,
                    # so it does not exist yet on the frame the whistle goes.
                    g = pg.evaluate("() => window.__hmSoccer.yow")
                    print("  mode reported by the engine: yow=%r" % g, file=sys.stderr)
                    assert bool(g) == bool(yow), "the engine did not enter the mode asked for"
                frames = []
                while len(frames) < cap_frames:
                    got = pg.evaluate(
                        "n => window.__flowCrank.pump(n, window.__flowSample)", chunk)
                    frames += got
                    if len(got) < chunk:
                        break
                out.append(frames)
                print("\r  %s match %d/%d  (%d frames, %.0fs simulated)"
                      % ("YOW " if yow else "SOC ", m + 1, matches,
                         len(frames), len(frames) * FLOW.DT), end="", file=sys.stderr)
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


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    heads = int(sys.argv[2]) if len(sys.argv) > 2 else 8
    for yow in (False, True):
        label = "YOWMINGS LEAGUE" if yow else "SOCCER (post-668ad73)"
        FLOW.digest(collect(yow, n, heads), label)
