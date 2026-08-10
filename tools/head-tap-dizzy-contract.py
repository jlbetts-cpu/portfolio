#!/usr/bin/env python3
"""Fails when tapping the companion head stops making it go dizzy.

WHY THIS FILE EXISTS
On 2026-08-07, commit e6d4295 "Add selectable movable Hero portrait" deleted one
line from hero-engine.js:

    faceImg.addEventListener("click",()=>{if(CALIB||eventLock)return;tapReact();});

It was collateral. That commit's only other hero-engine.js change was a one-line
rewrite of the overFace IIFE directly above it, and the click binding sat on the
very next line, so it went out with the same hunk. Nothing else about the pose
was touched -- startDizzy(), dizzyTick(), placeTools() and TAPS=["dizzy"] all
survived intact, and tapReact() survived too. It simply had no caller any more.

That is the whole reason this went unnoticed for three days: an orphaned
function throws nothing, logs nothing, and breaks no test. The only symptom was
a person clicking the head and it not doing the thing it used to do.

WHAT THIS ASSERTS
1. tapReact() is still defined, and still reaches startDizzy().
2. tapReact() has at least one LIVE caller -- one that is not inside a comment.
3. The head's click binding exists and is bound to #face.

Point 2 is the one that matters, and the reason it is stated as "not inside a
comment" is that this project has already been bitten by a checker whose comment
handling was wrong (hm-check.py reports a SyntaxError that `node --check`
disagrees with, because its stripper swallows a /* */ block and feeds prose to
the parser). So the --self-test here re-injects the bug two ways: once by
deleting the line, and once by commenting it out. A detector that only catches
the deletion is a detector that will go green the first time someone comments
the binding out "temporarily".

HOW TO USE IT WHEN IT FAILS
Do not delete the assertion. Restore the caller. The guard belongs on the
transform host, not on a page name:

    if(!faceImg.closest(".heroHeadTransform"))faceImg.addEventListener("click",
      ()=>{if(CALIB||eventLock)return;tapReact();});

index.html mounts hero-head-transform.js, which binds pointerdown on #face to
drag the portrait. preventDefault on pointerdown does NOT suppress the click
that follows it, so a binding without that guard fires dizzy at the end of every
drag on the home page. play.html does not mount the transform, so it gets the
original behaviour unchanged.

    python3 tools/head-tap-dizzy-contract.py
    python3 tools/head-tap-dizzy-contract.py --self-test
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "hero-engine.js"

# The binding, matched on the real call chain rather than on a loose keyword, so
# that prose mentioning tapReact cannot satisfy it.
BINDING = re.compile(
    r"faceImg\s*\.\s*addEventListener\s*\(\s*[\"']click[\"']", re.S
)
CALL = re.compile(r"(?<![\w.$])tapReact\s*\(")
DEFINITION = re.compile(r"function\s+tapReact\s*\(")
DIZZY_DEF = re.compile(r"function\s+startDizzy\s*\(")


def strip_comments(src):
    """Remove // and /* */ comments, leaving string literals intact.

    Deliberately conservative. It tracks single-quote, double-quote and template
    strings and their backslash escapes, so a '//' or '/*' inside a string is
    never mistaken for a comment. It does NOT attempt to recognise regex
    literals -- that requires real parsing, and the failure mode would be to
    treat a regex's contents as code, which can only ever make this checker
    stricter (a false FAIL), never blind (a false PASS). Blindness is the
    failure mode that matters here, so the trade is deliberate.

    Newlines are preserved so reported line numbers stay true.
    """
    out = []
    i, n = 0, len(src)
    while i < n:
        c = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if c in "\"'`":
            quote = c
            out.append(c)
            i += 1
            while i < n:
                if src[i] == "\\":
                    out.append("  ")
                    i += 2
                    continue
                out.append(src[i])
                if src[i] == quote:
                    i += 1
                    break
                i += 1
            continue
        if c == "/" and nxt == "/":
            while i < n and src[i] != "\n":
                i += 1
            continue
        if c == "/" and nxt == "*":
            i += 2
            while i < n and not (src[i] == "*" and i + 1 < n and src[i + 1] == "/"):
                if src[i] == "\n":
                    out.append("\n")
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    return "".join(out)


def check(src, label="hero-engine.js"):
    """Returns (failures, notes). Empty failures == PASS."""
    fails, notes = [], []

    code = strip_comments(src)

    # The stripper is itself a thing that can be wrong, so say what it did.
    notes.append(
        f"stripper removed {len(src) - len(code)} chars of comment "
        f"({100 * (len(src) - len(code)) / max(1, len(src)):.1f}% of {label})"
    )

    if not DEFINITION.search(code):
        fails.append("tapReact() is not defined in live code")
    if not DIZZY_DEF.search(code):
        fails.append("startDizzy() is not defined in live code")

    # tapReact must reach startDizzy.
    body = re.search(r"function\s+tapReact\s*\([^)]*\)\s*\{(.*?)\}", code, re.S)
    if not body:
        fails.append("could not read tapReact()'s body")
    elif "startDizzy" not in body.group(1):
        fails.append("tapReact() no longer reaches startDizzy() -- the tap "
                     "reaction has been repointed at something else")

    callers = [m for m in CALL.finditer(code)
               if not code[:m.start()].rstrip().endswith("function")]
    call_lines = sorted({code[:m.start()].count("\n") + 1 for m in callers})
    if not call_lines:
        fails.append(
            "tapReact() has NO live caller -- this is exactly the e6d4295 "
            "regression. Clicking the head does nothing. See the module "
            "docstring for the one-line restore."
        )
    else:
        notes.append(f"tapReact() called from line(s) {call_lines}")

    binds = [m for m in BINDING.finditer(code)]
    if not binds:
        fails.append(
            "no live click binding on #face -- the head is not listening for a "
            "tap at all"
        )
    else:
        bind_lines = sorted({code[:m.start()].count("\n") + 1 for m in binds})
        notes.append(f"#face click binding at line(s) {bind_lines}")

    return fails, notes


def self_test(src):
    """Re-inject the regression, two ways, and require the detector to fire.

    A detector nobody has watched fail is one nobody should trust.
    """
    results = []

    # The live binding line, found the same way check() finds it.
    code = strip_comments(src)
    m = BINDING.search(code)
    if not m:
        raise SystemExit(
            "--self-test cannot run: there is no live click binding to remove, "
            "which means the contract is already failing for real. Fix the site "
            "first, then re-run the self-test."
        )
    line_no = code[: m.start()].count("\n")
    lines = src.split("\n")
    original = lines[line_no]
    if "tapReact" not in original:
        raise SystemExit(
            "--self-test cannot run: the binding and the tapReact() call are on "
            "different lines, so the injections below would not reproduce "
            "e6d4295. Update the self-test to match the new shape."
        )

    # Injection A -- the actual e6d4295 deletion.
    deleted = "\n".join(lines[:line_no] + lines[line_no + 1:])
    fails_a, _ = check(deleted, "injected: binding deleted")
    results.append(("A: binding line deleted (the real e6d4295)", bool(fails_a), fails_a))

    # Injection B -- the same line commented out. This is the failure mode a
    # naive checker misses, and the one this project has already shipped once.
    commented = "\n".join(
        lines[:line_no] + ["/* " + original + " */"] + lines[line_no + 1:]
    )
    fails_b, _ = check(commented, "injected: binding commented out")
    results.append(("B: binding line commented out", bool(fails_b), fails_b))

    # Injection C -- prose that merely mentions the call. Must NOT be enough to
    # keep the contract green.
    prose = "\n".join(
        lines[:line_no]
        + ["/* the head used to call tapReact() here and go dizzy */"]
        + lines[line_no + 1:]
    )
    fails_c, _ = check(prose, "injected: replaced by prose mentioning tapReact()")
    results.append(("C: replaced by a comment that mentions tapReact()", bool(fails_c), fails_c))

    return results


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--self-test", action="store_true",
                    help="re-inject the e6d4295 regression three ways and "
                         "require the detector to fire on each")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    if not ENGINE.exists():
        print(f"FAIL  hero-engine.js not found at {ENGINE}")
        return 1

    src = ENGINE.read_text()

    # Cheap sanity on the file itself, so a parse problem is never mistaken for
    # a missing binding. node is used because it is the authority; this project
    # has already been misled by a hand-rolled parser disagreeing with it.
    try:
        r = subprocess.run(["node", "--check", str(ENGINE)],
                           capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            print("FAIL  hero-engine.js does not parse:")
            print(r.stderr.strip()[:800])
            return 1
    except (FileNotFoundError, subprocess.TimeoutExpired):
        print("note  node unavailable; skipping the parse pre-check")

    if args.self_test:
        results = self_test(src)
        ok = True
        print("SELF-TEST -- the detector must fire on every injection\n")
        for name, fired, fails in results:
            print(f"  {'fires ' if fired else 'BLIND '} {name}")
            if args.verbose and fails:
                for f in fails:
                    print(f"           -> {f}")
            if not fired:
                ok = False
        print()
        print("SELF-TEST", "PASS" if ok else "FAIL -- this contract cannot be trusted")
        return 0 if ok else 1

    fails, notes = check(src)
    for n in notes:
        print(f"note  {n}")
    if fails:
        print()
        for f in fails:
            print(f"FAIL  {f}")
        print()
        print("STATUS=FAIL  tapping the head does not make it dizzy")
        return 1
    print()
    print("STATUS=PASS  tapping the head still makes it dizzy")
    return 0


if __name__ == "__main__":
    sys.exit(main())
