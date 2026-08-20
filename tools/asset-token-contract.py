#!/usr/bin/env python3
"""The cache token is the stylesheets' content hash, so it cannot go stale.

WHY THIS EXISTS.  The token was the literal string `20260806-shared-surfaces`,
hand-written into 57 references across 12 pages.  It had not moved since 6
August while every file it versions was edited on the 19th and 20th -- measured
2026-08-20.  A hand-bumped token has exactly one failure mode and it is the
silent one: you edit a stylesheet, you do not think about the token, and every
returning visitor is served the old CSS from cache with the new HTML.  Nobody
sees it locally, because a hard reload hides it.

That is also why the site could not take an immutable Cache-Control on its CSS.
`immutable` is a promise that a URL's bytes never change; with a hand-bumped
token that promise was false, so the audit's caching win was blocked on this.

SO THE TOKEN IS DERIVED, NOT DECLARED.  sha1 over (name, bytes) of every
versioned stylesheet, first ten hex characters.  Change any of them and the URL
changes with them, by construction.  Forget to re-run the bump and this gate
fails, which is the whole point -- the failure moves from a visitor's cache to a
red gate on this machine.

WHAT IT DOES NOT COVER, stated rather than discovered later: the shared JS files
carry no token at all, so they still revalidate on every navigation.  Giving them
one is a bigger edit across the same 12 pages and it is NOT done here.  Until it
is, /*.js must not take an immutable header -- only the CSS may.

Run:  python3 tools/asset-token-contract.py [--fix] [--self-test]
      --fix       rewrite every reference to the current hash
      --self-test edit a stylesheet in memory and prove the gate fails
"""

import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

# The stylesheets that carry ?v=.  Listed rather than globbed: a new stylesheet
# should have to be added here deliberately, so that "it is not versioned" is a
# decision somebody made and not an oversight a glob papered over.
VERSIONED = (
    "carousel.css", "controls.css", "footer.css", "header.css",
    "hero-time.css", "site-theme.css", "tokens.css",
)

REF = re.compile(r'(\.css)\?v=([A-Za-z0-9._-]+)')


def token_for(read):
    digest = hashlib.sha1()
    for name in sorted(VERSIONED):
        digest.update(name.encode())
        digest.update(read(name))
    return digest.hexdigest()[:10]


def disk_read(name):
    return (ROOT / name).read_bytes()


def pages():
    return sorted(p for p in ROOT.glob("*.html"))


def check(read=disk_read, html=None):
    """Returns a list of complaints; empty means the tree is consistent."""
    expected = token_for(read)
    problems = []
    seen = 0
    for page in pages():
        text = html[page.name] if html and page.name in html else page.read_text(encoding="utf-8")
        for _, found in REF.findall(text):
            seen += 1
            if found != expected:
                problems.append(
                    "%s references ?v=%s but the stylesheets hash to %s -- a "
                    "stylesheet changed and the token did not, so returning "
                    "visitors get new HTML against old CSS"
                    % (page.name, found, expected))
    if not seen:
        problems.append("no versioned stylesheet references found at all; the "
                        "cache-busting token has been dropped")
    return problems


def fix():
    expected = token_for(disk_read)
    touched = 0
    for page in pages():
        text = page.read_text(encoding="utf-8")
        rewritten = REF.sub(r"\1?v=" + expected, text)
        if rewritten != text:
            page.write_text(rewritten, encoding="utf-8")
            touched += 1
    print("  rewrote %d page(s) to ?v=%s" % (touched, expected))


def self_test():
    """A detector nobody has watched fail is one nobody should trust."""
    real = {name: disk_read(name) for name in VERSIONED}
    pages_now = {p.name: p.read_text(encoding="utf-8") for p in pages()}

    # 1 ── a stylesheet changes and the token does not
    mutated = dict(real)
    mutated["tokens.css"] = real["tokens.css"] + b"\n/* injected */\n"
    problems = check(read=lambda n: mutated[n], html=pages_now)
    assert problems, ("injection 'stylesheet edited, token stale' was NOT "
                      "caught -- this gate cannot fail and is worse than none")
    print("  ok   injection 'stylesheet edited, token stale' is caught: %s"
          % problems[0][:80])

    # 2 ── one page drifts off the token the others carry
    drifted = dict(pages_now)
    victim = next(name for name, text in pages_now.items() if REF.search(text))
    drifted[victim] = REF.sub(r"\1?v=deadbeef", pages_now[victim], count=1)
    problems = check(read=lambda n: real[n], html=drifted)
    assert problems, ("injection 'one page drifts' was NOT caught")
    print("  ok   injection 'one page drifts' is caught: %s" % problems[0][:80])

    print("  SELF-TEST OK -- both injections fail the contract")


def main():
    if "--self-test" in sys.argv:
        self_test()
        return 0
    if "--fix" in sys.argv:
        fix()
        return 0
    problems = check()
    if problems:
        print("FAIL -- %d finding(s):" % len(problems))
        for line in problems[:8]:
            print("  - " + line)
        print("  run `python3 tools/asset-token-contract.py --fix` to re-derive it")
        return 1
    print("  Asset token contract: OK -- every reference carries ?v=%s"
          % token_for(disk_read))
    return 0


if __name__ == "__main__":
    sys.exit(main())
