#!/usr/bin/env python3
"""The head's anchor carries the phone's chrome slack, and no test can see it.

THIS CONTRACT EXISTS BECAUSE THE FIX IS INVISIBLE TO EVERY OTHER GATE. The head
is bottom-anchored to the Hero, and the Hero is min-height:100dvh so the
gradient never opens a gap when Safari's chrome retracts. That makes the floor
travel the chrome's full height on every scroll: measured at 390 the head moved
81px while the CENTRED copy beside it moved 42px, so the head slid 39px against
its own composition. Adding (100dvh - 100svh) back to `bottom` holds it a
constant distance from the Hero's TOP, the edge that never moves.

In headless Chromium there is no browser chrome, so 100dvh and 100svh are BOTH
the viewport height and the term is exactly 0px. Verified: it is not that the
harness is imprecise, it is that the quantity does not exist there. So a
behavioural test cannot fail when this regresses, hero-head-scroll-contract
included -- it would keep passing while the head slid on Jayden's phone.

A term that evaluates to zero on every machine anyone can test is exactly what a
cleanup sweep deletes as dead. This asserts it textually, in the live rule, so
removing it breaks a gate instead of only breaking a phone.

Run:  python3 tools/hero-head-chrome-slack-contract.py
      python3 tools/hero-head-chrome-slack-contract.py --self-test
"""
import re
import sys
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "controls.css"
RULE = ".heroHeadTransform{"


def body_of_rule(css):
    i = css.find(RULE)
    if i < 0:
        return None
    j = css.find("}", i)
    return css[i + len(RULE):j] if j > 0 else None


def check(css):
    fails = []
    body = body_of_rule(css)
    if body is None:
        return [f"{RULE[:-1]} rule not found in {CSS.name} at all."]

    bottom = re.search(r"bottom\s*:([^;]+);", body)
    if not bottom:
        return [f"{RULE[:-1]} has no `bottom` -- the head is no longer "
                f"floor-anchored, so this contract needs rewriting, not muting."]
    b = bottom.group(1)

    if "100dvh" not in b or "100svh" not in b:
        fails.append(
            "The chrome slack is gone from the head's `bottom`.\n"
            f"    got: bottom:{b.strip()}\n"
            "    Without (100dvh - 100svh) the head tracks a floor that moves\n"
            "    ~84px on an iPhone while the centred copy moves half that. It\n"
            "    will look correct in every browser you can automate.")
    elif not re.search(r"100dvh\s*-\s*100svh", b):
        fails.append(
            "Both units are present but not as (100dvh - 100svh).\n"
            f"    got: bottom:{b.strip()}\n"
            "    The sign matters: dvh grows as the chrome retracts, so the\n"
            "    slack must be ADDED to bottom. Reversed, the head moves twice\n"
            "    as far as it used to.")
    return fails


def main():
    css = CSS.read_text()
    if "--self-test" in sys.argv:
        css = re.sub(r"(\.heroHeadTransform\{[^}]*?bottom\s*:[^;]*?)"
                     r"\s*\+\s*\(100dvh\s*-\s*100svh\)", r"\1", css, count=1)
        fails = check(css)
        if not fails:
            print("SELF-TEST FAIL: removed the slack term and the contract "
                  "still passed. It is not watching anything.")
            return 1
        print("SELF-TEST PASS: removing the term is caught.\n")
        for f in fails:
            print(f"  - {f}")
        return 0

    fails = check(css)
    if fails:
        print(f"FAIL  {CSS.name}\n")
        for f in fails:
            print(f"  - {f}")
        return 1
    print("PASS  the head's anchor carries (100dvh - 100svh); it holds a "
          "constant distance from the Hero's top when the chrome retracts.")
    return 0


sys.exit(main())
