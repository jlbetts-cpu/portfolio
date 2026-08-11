#!/usr/bin/env python3
"""The soccer pitch has to be the same pitch at both ends.

This project has now shipped the SAME bug three times, in three different places, and each
time the symptom Jayden reported was the same sentence: the players all end up on the right,
the sides are uneven, and the left goal is easy to score on.

  1. The SUPPORT clamp ran before a centre-to-left-edge conversion while its two bounds were
     written in different spaces, so a head-width of pitch was paid twice on the right and
     never on the left. Reachable head CENTRES were [61.6, 1270.4] at 1440 -- 61.6px of
     margin on the left, 169.6 on the right.
  2. The keeper clamp is the same shape and had to be mirrored with it.
  3. The kickoff launch read `vx = dir*clamp(dxk/ttk)`. `dxk/ttk` is already signed and `dir`
     IS that sign, so the product is |dxk/ttk| -- always positive, always rightward. Every
     head whose mark lay to its left was fired away from it at up to 820px/s. Measured at
     1440x900, six heads: 11 of 13 restarts put two-thirds of a team in the wrong half, and
     team 1 -- whose own half is the LEFT one -- had a mean x of 826.6 against a midline of
     720. With the sign removed the same measurement reads 0 of 12 and a mean of 505.

A comment is not an invariant. Three occurrences say this class of bug is not going to be
prevented by care, so it is asserted instead. Every check below is STATIC -- it reads the
engine source -- so it costs nothing, needs no browser, and cannot be defeated by a flaky
match. The runtime numbers that motivated each one are recorded above the check that guards it.

  ./tools/soccer-lateral-symmetry-contract.py
  ./tools/soccer-lateral-symmetry-contract.py --self-test

--self-test re-injects each bug into a copy of the source and requires the corresponding
check to fail. A detector nobody has watched fail is one nobody should trust.
"""

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE_PATH = ROOT / "play-engine.js"


def strip_comments(src):
    """Remove /* */ and // comments so a note ABOUT a bug cannot be read as the bug.

    Deliberately conservative: it only strips a // run when the line has no quote or slash
    after it that could make it part of a string or a regex literal. Over-keeping is safe
    here (the checks are all specific), over-stripping is not.
    """
    src = re.sub(r"/\*.*?\*/", " ", src, flags=re.S)
    out = []
    for line in src.split("\n"):
        idx = line.find("//")
        while idx != -1:
            before = line[:idx]
            if before.count('"') % 2 == 0 and before.count("'") % 2 == 0 and not before.rstrip().endswith("\\"):
                line = before
                break
            idx = line.find("//", idx + 2)
        out.append(line)
    return "\n".join(out)


CHECKS = []


def check(name):
    def deco(fn):
        CHECKS.append((name, fn))
        return fn
    return deco


# ---------------------------------------------------------------- 1. the kickoff launch
# BUG 3 above. `dir` is the sign of dxk, so multiplying a signed velocity by it discards the
# sign. The launch must use the signed value directly.
@check("kickoff-launch-keeps-its-sign")
def kickoff_sign(live):
    m = re.search(r"vy=-vyk;\s*vx=([^;]+);", live)
    if not m:
        return "the kickoff launch (vy=-vyk; vx=...) is gone or has been rewritten; re-point this check at it"
    expr = m.group(1)
    if re.search(r"\bdir\s*\*", expr):
        return ("the kickoff launch multiplies a signed velocity by `dir`, which IS that sign: "
                "every head whose mark lies to its left is fired away from it. vx=" + expr.strip())
    if "dxk" not in expr:
        return "the kickoff launch no longer solves from dxk; re-point this check at it"
    return None


# ---------------------------------------------------------------- 2. the mirror is one term
# The set-position ladder must carry its whole mirror in ONE sign term applied to ONE
# expression. Two separately-written halves are how bugs 1 and 2 happened.
@check("kickoff-marks-mirror-on-one-sign-term")
def marks_one_sign(live):
    if "var _side=(team===1)?-1:1;" not in live:
        return "the kickoff marks no longer derive their side from a single _side term"
    m = re.search(r"var _markC=([^,;]+)", live)
    if not m:
        return "the kickoff mark centre (_markC) is gone; re-point this check at it"
    expr = m.group(1)
    if "_side*" not in expr:
        return "the kickoff mark centre does not apply _side; the two halves can now drift: " + expr
    if re.search(r"team===1\s*\?", expr) or re.search(r"team\s*===\s*2", expr):
        return "the kickoff mark centre branches on the team again instead of using _side: " + expr
    # exactly one conversion from centre to left edge, at the very end
    if live.count("var _markC=") != 1:
        return "the kickoff mark centre is written more than once"
    return None


# ---------------------------------------------------------------- 3. the SUPPORT clamp
# BUG 1. The bound must be symmetric about heroR.w/2: the low bound is a distance from the
# left wall and the high bound must be the SAME distance from the right wall, with the
# centre-to-left-edge conversion applied once, after the clamp.
@check("support-clamp-is-symmetric")
def support_clamp(live):
    m = re.search(r"bxT=Math\.max\(([^,]+),Math\.min\(([^,]+),aheadX\)\)-HW/2;", live)
    if not m:
        return "the SUPPORT clamp is gone or rewritten; re-point this check at it"
    lo, hi = m.group(1).strip(), m.group(2).strip()
    want_hi = "heroR.w-" + lo.replace("M+", "M-").replace("+", "@").replace("-", "+").replace("@", "-")
    # structural form: low = M+k, high = heroR.w-M-k, same k
    mlo = re.fullmatch(r"M\+HW\*([\d.]+)", lo)
    mhi = re.fullmatch(r"heroR\.w-M-HW\*([\d.]+)", hi)
    if not mlo or not mhi:
        return ("the SUPPORT clamp's bounds are no longer a mirrored pair (M+HW*k / heroR.w-M-HW*k): "
                "low=%s high=%s (expected high like %s)" % (lo, hi, want_hi))
    if mlo.group(1) != mhi.group(1):
        return ("the SUPPORT clamp pays a different head-width margin on each side -- this is the "
                "original 61.6/169.6 bug: low=%s high=%s" % (lo, hi))
    return None


# ---------------------------------------------------------------- 4. the keeper station
# BUG 2. Same shape. team 1 clamps its left edge to at most k*w; team 2 clamps it to at least
# (1-k)*w - HW. Those two are mirror images only when the k's agree and the -HW is present on
# the right (a left edge measured from the right wall owes one head-width).
@check("keeper-station-is-symmetric")
def keeper_clamp(live):
    m = re.search(r'if\(role==="keeper"\)bxT=team===1\?Math\.min\(bxT,([^)]+)\):Math\.max\(bxT,([^)]+)\);', live)
    if not m:
        return "the keeper station clamp is gone or rewritten; re-point this check at it"
    left, right = m.group(1).strip(), m.group(2).strip()
    ml = re.fullmatch(r"heroR\.w\*([\d.]+)", left)
    mr = re.fullmatch(r"heroR\.w\*([\d.]+)-HW", right)
    if not ml or not mr:
        return ("the keeper station's bounds are no longer a mirrored pair "
                "(heroR.w*k / heroR.w*(1-k)-HW): left=%s right=%s" % (left, right))
    k, k2 = float(ml.group(1)), float(mr.group(1))
    if abs((k + k2) - 1.0) > 1e-9:
        return ("the keeper stands a different distance from each goal line: left k=%s, right 1-k=%s "
                "(they must sum to 1)" % (k, k2))
    return None


# ---------------------------------------------------------------- 5. no bare team branch
# A catch-all: inside the soccer AI, any clamp that branches on the team must be one of the
# two audited above. A NEW `team===1?...:...` around a bound is how this bug returns.
@check("no-unaudited-team-branch-on-a-bound")
def no_new_branch(live):
    start = live.find("var _side=(team===1)?-1:1;")
    end = live.find("if(battleOn&&!elim&&!celebrated)")
    if start < 0 or end < 0 or end < start:
        return "cannot locate the soccer AI block; re-point this check at it"
    block = live[start:end]
    audited = ('if(role==="keeper")bxT=team===1?', "var _side=(team===1)?-1:1;",
               "var atk=team===1?", "ownGoalX=team===1?")
    hits = []
    for m in re.finditer(r"[A-Za-z_$][\w$]*\s*=\s*team===[12]\s*\?", block):
        seg = block[max(0, m.start() - 24):m.end()]
        if not any(a in block[max(0, m.start() - 40):m.end() + 4] for a in audited):
            hits.append(seg.strip())
    if hits:
        return ("a new team-conditional bound appeared in the soccer AI. Every mirrored value here "
                "must be written ONCE with a sign term (_side / atk), not twice: " + "; ".join(hits[:3]))
    return None


# ---------------------------------------------------------------- 6. the marks are published
# The runtime mirror is only assertable because the ladder publishes S.marks. Losing that
# would make the browser-side check above silently untestable.
@check("kickoff-marks-are-published-for-assertion")
def marks_published(live):
    if "S9.marks[slot]={x:_markC" not in live:
        return "the kickoff marks are no longer published on S.marks; a runtime mirror check cannot be written"
    return None


# --------------------------------------------------------------------------- self-test
# Each entry re-injects the exact defect the check exists to catch.
INJECTIONS = {
    "kickoff-launch-keeps-its-sign": (
        "vy=-vyk;vx=Math.max(-1150,Math.min(1150,dxk/ttk));",
        "vy=-vyk;vx=dir*Math.max(-1150,Math.min(1150,dxk/ttk));"),
    "kickoff-marks-mirror-on-one-sign-term": (
        "var _markC=heroR.w*0.5+_side*_frac*_span",
        "var _markC=team===1?(heroR.w*0.5-_frac*_span):(heroR.w*0.5+_frac*_span)"),
    "support-clamp-is-symmetric": (
        "bxT=Math.max(M+HW*0.2,Math.min(heroR.w-M-HW*0.2,aheadX))-HW/2;",
        "bxT=Math.max(M+HW*0.2,Math.min(heroR.w-M-HW*1.2,aheadX))-HW/2;"),
    "keeper-station-is-symmetric": (
        'if(role==="keeper")bxT=team===1?Math.min(bxT,heroR.w*0.11):Math.max(bxT,heroR.w*0.89-HW);',
        'if(role==="keeper")bxT=team===1?Math.min(bxT,heroR.w*0.11):Math.max(bxT,heroR.w*0.95-HW);'),
    "no-unaudited-team-branch-on-a-bound": (
        "var _rank=Math.max(0,_mine.indexOf(slot));",
        "var _rank=Math.max(0,_mine.indexOf(slot));var _pad9=team===1?4:40;"),
    "kickoff-marks-are-published-for-assertion": (
        "S9.marks[slot]={x:_markC", "S9.marks[slot]={q:_markC"),
}


def run(live, label):
    bad = []
    for name, fn in CHECKS:
        msg = fn(live)
        print("  %-42s %s" % (name, "ok" if msg is None else "FAIL"))
        if msg is not None:
            bad.append((name, msg))
    if bad:
        print("\n%s FAILED:" % label)
        for name, msg in bad:
            print("  * %s\n    %s" % (name, msg))
    return bad


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true",
                    help="re-inject each bug and require its own check to fail")
    args = ap.parse_args()

    src = ENGINE_PATH.read_text(encoding="utf-8")
    live = strip_comments(src)

    print("play-engine.js lateral symmetry")
    bad = run(live, "CONTRACT")
    if bad:
        return 1

    if args.self_test:
        print("\n--self-test: re-injecting each defect")
        failures = []
        for name, fn in CHECKS:
            old, new = INJECTIONS[name]
            if live.count(old) != 1:
                failures.append("%s: cannot inject (%d occurrences of the anchor)" % (name, live.count(old)))
                print("  %-42s CANNOT INJECT" % name)
                continue
            broken = live.replace(old, new)
            caught = fn(broken)
            print("  %-42s %s" % (name, "caught" if caught else "MISSED"))
            if caught is None:
                failures.append("%s did not catch its own bug" % name)
        if failures:
            print("\nSELF-TEST FAILED:")
            for f in failures:
                print("  * " + f)
            return 1
        print("  every check caught its own defect")

    print("\nSTATUS=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
