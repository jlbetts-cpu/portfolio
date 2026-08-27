#!/usr/bin/env python3
"""The Yowmings League is the soccer engine with the objective inverted -- prove both halves.

WHAT THIS GATE IS FOR
---------------------
The League's entire claim is that it did NOT fork the engine: same physics, same AI, same
ball loop, same netCatch, with one boolean deciding where a score happens. A claim like
that decays silently. The next person to touch play-engine.js can copy a branch, add a
tuning constant "just for the League", or leave a body class on at the whistle, and nothing
on screen will look wrong for weeks.

So this asserts the SEAMS rather than the appearance:

  1. ONE ENGINE.        __hmYowStart and __hmTourStart are two names on one start(), and the
                        engine's mode flag is read once at kickoff, not sampled per frame.
  2. THE OBJECTIVE.     Soccer scores below the crossbar, the League above it -- and the
                        League additionally requires the ball to have TRAVERSED the aperture:
                        a swept crossing of the near-post plane arms it, leaving that window
                        disarms it, and reaching the far post scores. That is what stops the
                        wall-climber (which made it a 9.0 goals/min score-fest) WITHOUT the
                        instantaneous speed gate that used to refuse completed field goals.
  3. NO KEEPER.         The role is not handed out in this mode, and the leash it owns is
                        therefore never reached. The clamp itself must be untouched: the
                        expression is asserted verbatim, because "do not lengthen the keeper's
                        leash" is a standing instruction and this is the one mode where
                        deleting the role could be mistaken for licence to edit the number.
  4. NOTHING PERSISTS.  hmYow comes off at the whistle. finish() runs on every path a match
                        can end on; stop() does not (a bracket played to a champion never
                        calls it), which is exactly the bug hmFinal already had once.
  5. NO SHADOW, NO POSTER. The uprights are hairlines and the goal shadow is switched off in
                        this mode. And the posters -- asked for on 2026-08-26 and withdrawn
                        the same day, "you are right just remove the posters make it clean" --
                        must not grow back: the still poster stays gated on the SOCCER final.

Static, so it is cheap and runs anywhere. The behaviour that needs a browser is measured by
tools/play-yowmings-probe.py, which drives the real match through soccer-flow-probe's crank.

    python3 tools/play-yowmings-contract.py
    python3 tools/play-yowmings-contract.py --self-test    # re-injects each bug in turn
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FILES = {
    "engine": ROOT / "play-engine.js",
    "tour": ROOT / "play-tournament.js",
    "games": ROOT / "play-games.js",
    "css": ROOT / "play.css",
    "html": ROOT / "play.html",
}

# Each check is (name, fn(src) -> bool, and an INJECTION that must break it). The injection
# is the whole point: a check that cannot fail is worse than no check, and this file has
# five of them, so the self-test proves five failures rather than one green line.
CHECKS = []


def check(name, key, inject_from, inject_to):
    def deco(fn):
        CHECKS.append((name, key, fn, inject_from, inject_to))
        return fn
    return deco


@check("one-engine-two-doors", "tour",
       "window.__hmYowStart   = function(){ return start(true); };",
       "window.__hmYowStart   = function(){ return startLeague(); };")
def one_engine(src):
    """Both launchers call the same start(). A second start() is the fork this forbids."""
    return (re.search(r"window\.__hmTourStart\s*=\s*function\(\)\{\s*return start\(false\);", src)
            and re.search(r"window\.__hmYowStart\s*=\s*function\(\)\{\s*return start\(true\);", src)
            and len(re.findall(r"^function start\(", src, re.M)) == 1)


@check("mode-read-once-at-kickoff", "engine",
       "YOW=!!window.__hmYowLeague;S.yow=YOW;",
       "S.yow=YOW;")
def read_once(src):
    """YOW is assigned in start() and cleared in finish(). Anywhere else is a per-frame flag."""
    # Three assignments and no more: the `var YOW=false` declaration, the read in start(),
    # the clear in finish(). A fourth is a flag being decided somewhere other than kickoff.
    assigns = re.findall(r"(?<![.\w])YOW\s*=\s*(?!=)", src)
    return len(assigns) == 3 and "YOW=!!window.__hmYowLeague;S.yow=YOW;" in src


@check("objective-is-inverted-and-is-a-traversal", "engine",
       "inG=(by<gt)&&(by>gt-UPH)&&(YTHRU!==0);",
       "inG=(by<gt)&&(by>gt-UPH)&&(Math.abs(bvx)>600);")
def objective(src):
    """Above the bar, under the tops, and it got there BY GOING THROUGH THE POSTS.

    WHAT CHANGED AND WHY THIS ASSERTION MOVED. This used to pin
    `inG=(by<gt)&&(by>gt-UPH)&&(Math.abs(bvx)>YKICK)` -- the ball's instantaneous horizontal
    speed at the far post. That clause was written to kill the wall-climber (a ball popped up
    in a corner rising through the aperture without passing a post) and it did, statistically.
    It also threw away completed field goals: measured over 15 minutes of clock-cranked League
    play, 103 balls swept in through the near post at aperture height and 57 were never
    awarded, and of the 32 that reached the far post with the ball on the glass, 32 of 32 were
    refused by that clause alone at a median 315px/s. Jayden saw it directly -- "the football
    looks like its in the goal posts but it doesnt score".

    So the gate now asserts the mechanism that replaced it, and the INJECTION is the old
    clause: putting the speed gate back must fail this check, because it is the bug.

      * the near-post plane is crossed with a SWEPT test between frames, not sampled -- at the
        2200px/s cap the ball covers 37px against a 72px aperture,
      * the height is interpolated at the crossing,
      * the latch is cleared the moment the ball leaves that window at either end,
      * and soccer's own test is byte-for-byte what it was.
    """
    return ("inG=(by<gt)&&(by>gt-UPH)&&(YTHRU!==0);" in src
            and "inG=by>groundY-GH;" in src
            and "_pbx=bx;_pby=by;bx+=bvx*dt;by+=bvy*dt;" in src
            and "if(_pbx>_npL&&bx<=_npL)" in src and "else if(_pbx<_npR&&bx>=_npR)" in src
            and "_yc=_pby+(by-_pby)*_tc" in src
            and "if(YTHRU<0&&(bx>_npL||by>=gt||by<=gt-UPH))YTHRU=0;" in src
            and "if(YTHRU>0&&(bx<_npR||by>=gt||by<=gt-UPH))YTHRU=0;" in src
            # and no speed gate came back in under another name
            and "YKICK" not in src)


@check("no-keeper-and-the-leash-is-untouched", "engine",
       'S.roles[s2]=(i===0)?(YOW?"defender":"keeper")',
       'S.roles[s2]=(i===0)?"keeper"')
def keeper(src):
    """The League hands out no keeper -- and the leash clamp is byte-for-byte as it shipped.

    Both halves matter. Dropping the role is the mode difference; editing the clamp is the
    thing Jayden has ruled out twice, with the measurement in play-engine.js beside it.
    """
    return ('S.roles[s2]=(i===0)?(YOW?"defender":"keeper")' in src
            and 'if(role==="keeper")bxT=team===1?Math.min(bxT,heroR.w*0.11):'
                'Math.max(bxT,heroR.w*0.89-HW);' in src)


@check("the-mode-comes-off-at-the-whistle", "engine",
       'YOW=false;S.yow=false;document.body.classList.remove("hmYow");',
       'S.yow=false;')
def cleared(src):
    """Cleared in finish(), which is the only place every ending path passes through."""
    i = src.find("function finish(){S.on=false")
    if i < 0:
        return False
    tail = src[i:i + 4000]
    return ('YOW=false;S.yow=false;document.body.classList.remove("hmYow");' in tail
            and 'document.body.classList.remove("hmFinal")' in tail)


@check("every-slot-is-played-for", "tour",
       "  if (br.place) { for (const rd of br.rounds) for (const m of rd.matches)",
       "  if (false) { for (const rd of br.rounds) for (const m of rd.matches)")
def placement(src):
    """A draft slot must be settled by a match, and the cup must not end before they are.

    Three things together make the order he acts on honest: the League asks for a placement
    bracket, standings() reads the slots off results instead of sorting them, and complete()
    refuses to call the cup finished while a placement match is unplayed -- which is what
    let the champion screen arrive with four slots still carrying "nobody earned this".
    """
    return ("if (T.yow) opts.place = true;" in src
            and "function placedStandings(br)" in src
            and "if (br.place) return placedStandings(br);" in src
            and "if (br.place) { for (const rd of br.rounds) for (const m of rd.matches)" in src)


@check("consolation-is-simulated-never-rolled", "tour",
       "sim.con ? !nm.match.con : nm.round !== sim.round",
       "nm.round !== sim.round")
def consolation(src):
    """The unwatched matches are PLAYED. Jayden settles a real draft with the result.

    simulateConsolation() is simulateRound() with a different stopping rule: it takes the
    same cranked CLOCK, presses the same Kick off through the same step(), and lets the same
    engine decide. There is no path here that invents a score, and the assertion is that the
    drain still goes through step() rather than through anything of its own.
    """
    return ("function simulateConsolation(){" in src
            and "CLOCK.on().then(function(){ if (sim) step(); });" in src
            and "sim.con ? !nm.match.con : nm.round !== sim.round" in src
            and "con: true" in src)


@check("uprights-cast-nothing-and-posters-stay-gone", "css",
       "body.hmYow .hmGoal{background:none;border-radius:0;box-shadow:none;",
       "body.hmYow .hmGoal{background:none;border-radius:0;box-shadow:0 2px 8px rgba(0,0,0,.2);")
def no_shadow(src):
    """No elevation on the uprights, and no shadow anywhere in the League's own block."""
    # Rule by rule rather than by a slice of the file: the League's block sits directly
    # under soccer's @keyframes hmNet, whose gold flash IS a box-shadow, and a range scan
    # read that as the League casting one. Only rules that this mode actually owns count.
    owned = [r for r in re.findall(r"[^{}]+\{[^{}]*\}", src)
             if re.match(r"[^{]*(body\.hmYow|\.hmUp)", r)]
    if not owned:
        return False
    for rule in owned:
        for decl in re.findall(r"box-shadow:\s*([^;}]*)", rule):
            if decl.strip() != "none":
                return False
    return "body.hmYow .hmGoal{background:none;border-radius:0;box-shadow:none;" in src


def poster_still_gated_on_the_soccer_final():
    """The withdrawn feature must not grow back. Read tournament.js rather than trusting a note.

    Not part of CHECKS because its injection lives in a different file and it is an absence
    rather than a presence: the only .tvPoster in the tree is inside the `if (fin)` branch,
    and nothing about it may mention the League.
    """
    src = FILES["tour"].read_text()
    posters = [m.start() for m in re.finditer(r"tvPoster", src)]
    if len(posters) != 1:
        return False, "expected exactly one .tvPoster site, found %d" % len(posters)
    head = src[max(0, posters[0] - 400):posters[0]]
    if "if (fin){" not in head:
        return False, "the poster is no longer gated on the final"
    if re.search(r"yow", head, re.I):
        return False, "the League has been let into the poster branch"
    return True, "one still poster, gated on the soccer final, no League"


def run(sources):
    ok = True
    for name, key, fn, _f, _t in CHECKS:
        good = bool(fn(sources[key]))
        print("  %-44s %s" % (name, "ok" if good else "FAIL"))
        ok = ok and good
    good, why = poster_still_gated_on_the_soccer_final()
    print("  %-44s %s  (%s)" % ("posters-withdrawn-and-still-withdrawn",
                                "ok" if good else "FAIL", why))
    return ok and good


def main():
    sources = {k: v.read_text() for k, v in FILES.items()}
    if "--self-test" in sys.argv:
        # Every check is re-run against a tree with ITS OWN bug put back. A check that still
        # says ok has stopped measuring anything.
        bad = []
        for name, key, fn, frm, to in CHECKS:
            hurt = dict(sources)
            if frm not in hurt[key]:
                bad.append(name + ": injection text not found, the check is stale")
                continue
            hurt[key] = hurt[key].replace(frm, to, 1)
            if fn(hurt[key]):
                bad.append(name + ": survived its own injection")
            else:
                print("  %-44s fails when re-injected  ok" % name)
        if bad:
            print("\n".join("  " + b for b in bad))
            print("STATUS=FAIL")
            return 1
        print("STATUS=PASS  every check can fail")
        return 0
    print("Yowmings League contract")
    if not run(sources):
        print("STATUS=FAIL")
        return 1
    print("STATUS=PASS  one engine, the objective inverted, no keeper, nothing left behind")
    return 0


if __name__ == "__main__":
    sys.exit(main())
