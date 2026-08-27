#!/usr/bin/env python3
"""The head region of all ten pages, checked against the rules that decide whether
a search engine can understand this site.

WHY A CONTRACT AND NOT A ONE-OFF AUDIT. Every finding this file encodes was true
at some point on this site and then quietly stopped being true, or was never
true and nobody noticed: sitemap.xml listed two of eight indexable pages for
weeks; about.html -- the most name-relevant page here -- carried no structured
data at all; three tool pages were indexed three different ways. None of that is
visible by looking at the site. All of it is visible to a crawler.

WHAT IT ENFORCES, and why each rule is here:

  unique title + description   Two pages sharing either is two pages competing
                               for one result. Checked for exact duplicates.
  canonical present + absolute An indexable page with no canonical lets
                               parameters and mixed hosts fragment its signal.
  noindex <-> sitemap          A noindex page listed in the sitemap is a direct
                               contradiction; Search Console reports it against
                               the whole file. Enforced BOTH ways: every
                               indexable page must be listed, every noindex page
                               must not be.
  canonical == sitemap <loc>   The two must name the same URL, or they are two
                               different claims about where a page lives.
  JSON-LD parses               A single trailing comma silently voids the
                               strongest signal available for a name query.
  Person @id consistency       Pages describing the same person must use one
                               @id, or they compete as separate entities instead
                               of consolidating into one.
  og/twitter completeness      A portfolio gets passed between recruiters as a
                               pasted link. A card that does not render is a
                               first impression not made.
  one h1                       Zero h1 is a page with no stated subject.

WHAT IT DOES NOT DO. It does not check whether the CLAIMS are true. The location
contradiction this site currently carries (meta says San Francisco, resume says
Davis) is a copy decision, not a technical one, and no linter should be trusted
to settle it.

Run:  python3 tools/seo-contract.py
      python3 tools/seo-contract.py --self-test
"""
import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://jaydenbetts.design"

PAGES = ["index.html", "about.html", "play.html", "headmaker.html", "gradientlab.html",
         "apollo.html", "bearings.html", "cluster.html", "strata.html", "ucdavis.html"]

PERSON_ID = f"{ORIGIN}/#person"
# Properties that make a Person node useful for a name query. Not schema.org
# requirements -- schema.org requires almost nothing -- but the ones that
# actually feed a knowledge panel.
PERSON_KEYS = ["name", "url", "jobTitle", "sameAs"]


def head_of(text):
    m = re.search(r"<head[^>]*>(.*?)</head>", text, re.S | re.I)
    return m.group(1) if m else text[:20000]


def meta(head, *, name=None, prop=None):
    if name:
        pat = (rf'<meta[^>]+name\s*=\s*["\']{re.escape(name)}["\'][^>]*'
               rf'content\s*=\s*["\'](.*?)["\']')
    else:
        pat = (rf'<meta[^>]+property\s*=\s*["\']{re.escape(prop)}["\'][^>]*'
               rf'content\s*=\s*["\'](.*?)["\']')
    m = re.search(pat, head, re.S | re.I)
    return m.group(1).strip() if m else None


def jsonld_blocks(text):
    out = []
    for m in re.finditer(r'<script[^>]+type\s*=\s*["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                         text, re.S | re.I):
        out.append(m.group(1).strip())
    return out


def walk(node):
    """Every dict in a JSON-LD tree, @graph and nesting included."""
    if isinstance(node, dict):
        yield node
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)


def sitemap_locs(sitemap_text):
    # Comments FIRST. This bit me on its first run: the explanatory comment at the
    # top of sitemap.xml mentioned the tag name in prose, so a naive scan matched
    # from inside the comment through to the first real closing tag and swallowed
    # the home page's URL -- which then reported the home page as missing from its
    # own sitemap. A parser that reads commented-out prose as data is a parser that
    # invents findings.
    body = re.sub(r"<!--.*?-->", "", sitemap_text, flags=re.S)
    # <image:loc> is a different tag and must not be collected as a page URL.
    return [m.group(1).strip()
            for m in re.finditer(r"(?<![\w:])<loc>(.*?)</loc>", body, re.S)]


def audit(pages_text, sitemap_text, robots_text):
    fails, warns = [], []
    titles, descs = {}, {}
    indexable, noindexed = [], []
    canonicals = {}

    for name, text in pages_text.items():
        head = head_of(text)
        tag = f"{name}"

        # --- title ---
        tm = re.search(r"<title[^>]*>(.*?)</title>", head, re.S | re.I)
        title = tm.group(1).strip() if tm else None
        if not title:
            fails.append(f"{tag}: no <title>")
        else:
            titles.setdefault(title, []).append(name)
            if len(title) > 65:
                warns.append(f"{tag}: title is {len(title)} chars, Google truncates near 60")

        # --- robots ---
        robots = (meta(head, name="robots") or "").lower()
        is_noindex = "noindex" in robots
        (noindexed if is_noindex else indexable).append(name)

        # --- description ---
        desc = meta(head, name="description")
        if not desc:
            (warns if is_noindex else fails).append(
                f"{tag}: no meta description" + (" (noindex, so cosmetic)" if is_noindex else ""))
        else:
            descs.setdefault(desc, []).append(name)
            if not 50 <= len(desc) <= 165:
                warns.append(f"{tag}: description is {len(desc)} chars (aim 50-165)")

        # --- canonical ---
        cm = re.search(r'<link[^>]+rel\s*=\s*["\']canonical["\'][^>]*href\s*=\s*["\'](.*?)["\']',
                       head, re.S | re.I)
        canon = cm.group(1).strip() if cm else None
        if is_noindex:
            if canon:
                warns.append(f"{tag}: noindex page carries a canonical; at best inert")
        else:
            if not canon:
                fails.append(f"{tag}: indexable but has no canonical")
            else:
                canonicals[name] = canon
                if not canon.startswith("http"):
                    fails.append(f"{tag}: canonical is not absolute: {canon}")
                if urlparse(canon).netloc != urlparse(ORIGIN).netloc:
                    fails.append(f"{tag}: canonical host is not {ORIGIN}: {canon}")

        # --- cards ---
        if not is_noindex:
            for prop in ("og:title", "og:description", "og:url", "og:image", "og:type"):
                if not meta(head, prop=prop):
                    fails.append(f"{tag}: missing {prop}")
            if not meta(head, prop="og:image:width"):
                warns.append(f"{tag}: og:image has no declared width/height")
            if not meta(head, name="twitter:card"):
                fails.append(f"{tag}: missing twitter:card")
            ogu = meta(head, prop="og:url")
            if ogu and canon and ogu.rstrip("/") != canon.rstrip("/"):
                fails.append(f"{tag}: og:url ({ogu}) != canonical ({canon})")

        # --- headings ---
        # ── COMMENTS COME OFF FIRST, AND THE ORDER WAS THE BUG.  2026-08-27 ──
        # This stripped scripts and styles and THEN comments, and on 2026-08-27
        # it reported "no <h1> -- the page states no subject" on all nine
        # shipping pages at once. Every one of them has an h1. What it was
        # actually finding is prose: the case studies carry a comment reading
        # "<script> in <head>, so :root carries data-theme-state before this
        # markup is parsed", and a mention of an opening tag inside a comment
        # opens a block the first pass then closes at the next REAL </script> --
        # swallowing 10,863 characters of apollo.html, the h1 among them.
        # Nine simultaneous failures on nine files nobody had touched is what a
        # gate failing on working code looks like from the outside, and this
        # file is full of essays that name tags, so it would have happened again
        # the next time somebody wrote one. Comments are not markup; taking them
        # off first is the order that matches what a parser does.
        body = re.sub(r"<!--.*?-->", "", text, flags=re.S)
        body = re.sub(r"<(script|style)\b.*?</\1>", "", body, flags=re.S | re.I)
        n_h1 = len(re.findall(r"<h1\b", body, re.I))
        if n_h1 == 0:
            fails.append(f"{tag}: no <h1> -- the page states no subject")
        elif n_h1 > 1:
            warns.append(f"{tag}: {n_h1} <h1> elements")

        # --- JSON-LD ---
        for i, raw in enumerate(jsonld_blocks(text)):
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as e:
                fails.append(f"{tag}: JSON-LD block {i} does not parse: {e}")
                continue
            # Is this page's Person node the SUBJECT of the page, or just a
            # byline? A case study names him as `author` and needs only enough to
            # identify him; the home page and About describe him and should carry
            # the fuller node. Holding a byline to the subject's standard produced
            # five warnings about a jobTitle that has no business being there.
            is_subject = any(n.get("mainEntity") or n.get("@type") == "ProfilePage"
                             for n in walk(data))
            for node in walk(data):
                if node.get("@type") == "Person":
                    if node.get("@id") and node["@id"] != PERSON_ID:
                        fails.append(f"{tag}: Person @id is {node['@id']}, "
                                     f"splitting the entity; expected {PERSON_ID}")
                    needed = PERSON_KEYS if is_subject else ["name", "url", "sameAs"]
                    missing = [k for k in needed if k not in node]
                    if missing:
                        warns.append(f"{tag}: Person node missing {missing}")
                    for u in node.get("sameAs", []):
                        if not u.startswith("http"):
                            fails.append(f"{tag}: sameAs entry is not absolute: {u}")

    # --- cross-page uniqueness ---
    for t, owners in titles.items():
        if len(owners) > 1:
            fails.append(f"duplicate <title> {t!r} on {owners}")
    for d, owners in descs.items():
        if len(owners) > 1:
            fails.append(f"duplicate description on {owners}")

    # --- sitemap <-> robots directives, both ways ---
    locs = sitemap_locs(sitemap_text)
    if len(locs) != len(set(locs)):
        fails.append("sitemap has duplicate <loc> entries")
    loc_set = {l.rstrip("/") for l in locs}
    for name in indexable:
        want = (ORIGIN + "/") if name == "index.html" else f"{ORIGIN}/{name}"
        if want.rstrip("/") not in loc_set:
            fails.append(f"{name}: indexable but absent from sitemap.xml")
    for name in noindexed:
        if f"{ORIGIN}/{name}".rstrip("/") in loc_set:
            fails.append(f"{name}: noindex but LISTED in sitemap.xml -- a contradiction")
    for name, canon in canonicals.items():
        if canon.rstrip("/") not in loc_set:
            fails.append(f"{name}: canonical {canon} is not the URL the sitemap lists")

    # --- robots.txt ---
    if "Sitemap:" not in robots_text:
        fails.append("robots.txt names no sitemap")
    else:
        sm = re.search(r"Sitemap:\s*(\S+)", robots_text).group(1)
        if urlparse(sm).netloc != urlparse(ORIGIN).netloc:
            fails.append(f"robots.txt sitemap host disagrees with canonicals: {sm}")
    if re.search(r"^\s*Disallow:\s*/\s*$", robots_text, re.M):
        fails.append("robots.txt disallows the entire site")

    return fails, warns


def _break_jsonld(text):
    """Put a trailing comma in the first ld+json payload -- the classic silent void.

    Asserts it actually changed the document, because an injection that quietly
    fails to apply makes a working detector look broken.
    """
    m = re.search(r'(<script[^>]+application/ld\+json[^>]*>)(\s*\{)', text, re.I)
    assert m, "no ld+json block to break"
    out = text[:m.end(1)] + m.group(2).replace("{", "{,", 1) + text[m.end(2):]
    assert out != text, "self-test injection was a no-op"
    return out


def load():
    pages = {p: (ROOT / p).read_text(encoding="utf-8", errors="ignore") for p in PAGES}
    return (pages,
            (ROOT / "sitemap.xml").read_text(encoding="utf-8"),
            (ROOT / "robots.txt").read_text(encoding="utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    pages, sitemap, robots = load()

    if args.self_test:
        # Four defects, each one a thing that actually went wrong on this site.
        # A detector nobody has watched fail is one nobody should trust.
        cases = {
            "sitemap drops an indexable page":
                (pages, re.sub(r"<url>\s*<loc>[^<]*about\.html</loc>.*?</url>", "", sitemap, flags=re.S), robots,
                 "absent from sitemap"),
            # The injection is anchored on the ld+json OPENING TAG rather than on
            # any string inside the payload. My first attempt guessed at an
            # interior substring, did not match, produced a byte-identical
            # document, and the case reported "MISSED" for a detector that was
            # working perfectly. A self-test that can silently no-op is worse than
            # no self-test, so this one asserts the bytes actually changed.
            "JSON-LD gains a trailing comma":
                ({**pages, "index.html": _break_jsonld(pages["index.html"])},
                 sitemap, robots, "does not parse"),
            "Person @id drifts on one page":
                ({**pages, "about.html": pages["about.html"].replace(PERSON_ID, f"{ORIGIN}/about.html#person")},
                 sitemap, robots, "splitting the entity"),
            "a noindex page gets listed in the sitemap":
                (pages, sitemap.replace("</urlset>", f"<url><loc>{ORIGIN}/play.html</loc></url></urlset>"),
                 robots, "LISTED in sitemap"),
        }
        ok = True
        for label, (p, s, r, expect) in cases.items():
            f, _ = audit(p, s, r)
            hit = any(expect in x for x in f)
            print(f"  {'caught  ' if hit else 'MISSED  '}{label}")
            ok &= hit
        print("SELF-TEST " + ("PASS  every injected defect was caught."
                              if ok else "FAIL  a defect slipped through."))
        return 0 if ok else 1

    fails, warns = audit(pages, sitemap, robots)
    for w in warns:
        print("WARN  " + w)
    for f in fails:
        print("FAIL  " + f)
    print("=" * 70)
    print(f"STATUS={'FAIL' if fails else 'PASS'}  {len(fails)} failure(s), {len(warns)} warning(s)")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
