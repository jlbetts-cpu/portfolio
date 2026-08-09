#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
# WHAT A PASS FROM THIS TOOL MEANS, AND WHAT IT DOES NOT.
#
# It finds tokens that are USED but never DEFINED, and tokens DEFINED twice with
# different values. Both are real and both are worth blocking on.
#
# It does NOT find the most common form of token drift: a hardcoded literal
# sitting exactly where a token should be, holding a value that was right in its
# old context and is wrong in its new one. Nothing is undefined, nothing
# conflicts, and the audit is silent.
#
# Worked example, 2026-08-03: about.html reported ZERO findings both before and
# after a conformance pass that changed eleven type and spacing roles -- among
# them .footReach carrying line-height:1.55 while the five case studies resolved
# the same role through var(--lh-prose) = 1.5, and .abLabel losing a specificity
# fight to .abBody p so that "At a glance" rendered as 17.79px/400 body text
# instead of the 13px/600 label it was declared as.
#
# The only thing that finds that class of bug is measuring COMPUTED values in a
# browser and diffing the same role across pages. A green run here is necessary,
# not sufficient. Do not cite STATUS=PASS as proof of token conformance.
# ─────────────────────────────────────────────────────────────────────────────
"""
token-audit.py -- design-token conformance gate for jaydenbetts.com.

Companion to tools/hm-check.py. hm-check.py answers "does the JavaScript parse";
this answers "does the CSS obey the token system". Standard library only, no
browser, no network, deterministic: the same tree always produces the same
output, so the numbers in the machine tail can be tracked commit over commit.

    python3 tools/token-audit.py                 # shipping pages, human summary
    python3 tools/token-audit.py --scope all     # + the design demos
    python3 tools/token-audit.py --json          # full findings as JSON
    python3 tools/token-audit.py --strict        # warnings become errors
    python3 tools/token-audit.py --list undefined_no_fallback   # one check, verbose

Exit code is 1 if any ERROR fired, else 0.

------------------------------------------------------------------------------
THE ERROR / WARNING SPLIT, and why it is where it is
------------------------------------------------------------------------------
ERROR   = machine-certain defect that renders wrong or fails silently. No human
          judgement is needed to know it is broken, so it can block a ship.
WARNING = design debt. The finding is real, but deciding whether a given literal
          is *the same concept* as a token -- rather than merely the same number
          -- needs a person. A gate that guesses at intent gets ignored.

Under that line:

  ERROR    undefined_no_fallback   var(--x) where --x is defined nowhere the page
                                   can reach and no fallback is supplied. The
                                   declaration is invalid at computed-value time
                                   and silently inherits: the page looks nearly
                                   right, which is why it survives review.
  ERROR    conflicting_definition  one token name, two files, two different
                                   values. Whichever file loads last wins, so the
                                   same component renders differently per page for
                                   no expressed reason. Sanctioned re-bindings are
                                   allowlisted below (SANCTIONED_REBINDS).
  ERROR    archivo_off_broadcast   Archivo in a font-family outside play.css.
                                   The register split is a stated rule and the
                                   test is exact.

  WARNING  everything else: tokenisable literals, untokenised gaps, motion
           spread, control geometry, chrome shadows, hover fills, small tap
           targets, third font families. Each needs a human to confirm intent.

--strict escalates every warning to an error, for when the system is meant to be
closed and you want the gate to hold it closed.

------------------------------------------------------------------------------
SCOPE
------------------------------------------------------------------------------
SHIPPING  the nine real pages plus the three shared stylesheets and the site JS.
DEMOS     specimen / header-prototype / accent-swatches / button-system / orbs --
          design demos, deliberately full of raw values because that is what they
          are demonstrating. Audited only under --scope demos|all, and never
          counted in the shipping totals.
EXCLUDED  index-local-preview.html -- a stale build artefact, excluded always and
          reported as excluded so its absence is never mistaken for an oversight.
"""

import argparse
import bisect
import json
import os
import re
import sys
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# about.html was the only shipping page outside this list, and it was also the
# page the 2026-08-08 adoption audit measured at 0% component adoption. The two
# facts were related: nothing below its header was checked by anything.
SHIPPING_HTML = ['index.html', 'about.html', 'play.html', 'apollo.html',
                 'bearings.html', 'cluster.html', 'strata.html', 'ucdavis.html',
                 'headmaker.html', 'gradientlab.html']
# controls.css and site-theme.css are the two files that GOVERN the rest of the
# site's controls and colour, and until 2026-08-08 neither was audited -- the
# library sat outside its own gate. footer.css and builder-theme.css join them
# for the same reason. hero-time.css is deliberately still out: it is mid-rewrite
# on this branch and belongs to another lane.
SHIPPING_CSS = ['tokens.css', 'header.css', 'play.css',
                'controls.css', 'site-theme.css', 'footer.css',
                'builder-theme.css']
SHIPPING_JS = ['header.js', 'hero-engine.js', 'play-engine.js', 'play-games.js',
               'play-tournament.js', 'party.js', 'egghead-seed.js']

DEMO_FILES = ['specimen.html', 'header-prototype.html', 'accent-swatches.html',
              'button-system.html', 'orbs.html']
EXCLUDED_FILES = ['index-local-preview.html']

TOKENS_FILE = 'tokens.css'

# Token re-bindings the system explicitly sanctions. tokens.css's own header
# documents this one: play.html binds --accent to the live-match green, because
# on that page "interactive" and "this match is live" are the same signal.
SANCTIONED_REBINDS = {
    ('--accent', 'play.css'),
    ('--accent-press', 'play.css'),
    ('--accent-wash', 'play.css'),
    ('--accent-dark', 'play.css'),
}

# ---------------------------------------------------------------------------
# value normalisation
# ---------------------------------------------------------------------------

HEX_RE = re.compile(r'^#([0-9a-f]{3,8})$', re.I)
TIME_RE = re.compile(r'^(-?\d*\.?\d+)(ms|s)$')
PX_RE = re.compile(r'^(-?\d*\.?\d+)px$')
FUNC_RE = re.compile(r'^[a-z-]+\(', re.I)


IMPORTANT_RE = re.compile(r'\s*!\s*important\s*$', re.I)


def norm(value):
    """Canonical form of a CSS value, so `.08` == `0.08` and `rgba(1, 2, 3)` ==
    `rgba(1,2,3)`. Comparison-only; never written back to a file."""
    v = IMPORTANT_RE.sub('', value.strip()).lower()
    v = re.sub(r'\s+', ' ', v)
    m = HEX_RE.match(v)
    if m:
        h = m.group(1)
        if len(h) in (3, 4):
            h = ''.join(c * 2 for c in h)
        return '#' + h
    # collapse whitespace only inside a value that IS one function --
    # `var(--sp-8) var(--sp-16)` is two values and must not become one token.
    if FUNC_RE.match(v) and v.endswith(')') and len(split_top(v)) == 1:
        v = re.sub(r'\s+', '', v)
    v = re.sub(r'(?<![\w.])0+(\.\d)', r'\1', v)     # 0.08 -> .08
    v = re.sub(r'(\.\d*?)0+(?![\d])', r'\1', v)     # .080 -> .08
    v = re.sub(r'\.(?![\d])', '', v)                # .  -> (nothing)
    return v


def to_ms(value):
    m = TIME_RE.match(value.strip().lower())
    if not m:
        return None
    n = float(m.group(1))
    return n * 1000.0 if m.group(2) == 's' else n


def canon_time(value):
    ms = to_ms(value)
    if ms is None:
        return None
    return ('%g' % ms) + 'ms'


def px_of(value):
    m = PX_RE.match(value.strip().lower())
    return float(m.group(1)) if m else None


def split_top(value, seps=' \t\n\r,/'):
    """Split a value on top-level separators, respecting parens and quotes."""
    out, buf, depth, quote = [], '', 0, None
    for ch in value:
        if quote:
            buf += ch
            if ch == quote:
                quote = None
            continue
        if ch in '"\'':
            quote = ch
            buf += ch
            continue
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if depth == 0 and ch in seps:
            if buf.strip():
                out.append(buf.strip())
            buf = ''
            continue
        buf += ch
    if buf.strip():
        out.append(buf.strip())
    return out


# ---------------------------------------------------------------------------
# source model
# ---------------------------------------------------------------------------

CSS_COMMENT = re.compile(r'/\*.*?\*/', re.S)
HTML_COMMENT = re.compile(r'<!--.*?-->', re.S)
JS_LINE_COMMENT = re.compile(r'^[ \t]*//[^\n]*', re.M)
STYLE_BLOCK = re.compile(r'(<style\b[^>]*>)(.*?)(</style\s*>)', re.S | re.I)
STYLE_ATTR = re.compile(r'''\bstyle\s*=\s*(["'])(.*?)\1''', re.S | re.I)
LINK_RE = re.compile(r'<link\b[^>]*rel\s*=\s*["\']?stylesheet["\']?[^>]*>', re.I)
HREF_RE = re.compile(r'href\s*=\s*["\']([^"\']+)["\']', re.I)
SCRIPT_SRC = re.compile(r'<script\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\']', re.I)


def blank(text):
    """Same length, same newlines, no content -- keeps every byte offset (and so
    every reported line number) identical to the file on disk."""
    return ''.join('\n' if c == '\n' else ' ' for c in text)


class Source:
    """One file, plus a `css` view of it in which every byte that is not live CSS
    has been blanked. Offsets into `css` are offsets into the real file, so
    file:line evidence is exact and survives the other agents' edits landing."""

    def __init__(self, path):
        self.path = path
        self.name = os.path.basename(path)
        self.ext = os.path.splitext(path)[1].lower()
        with open(path, 'r', encoding='utf-8', errors='replace') as fh:
            self.text = fh.read()
        self._line_starts = [0] + [m.end() for m in re.finditer(r'\n', self.text)]
        self.links, self.scripts = [], []
        self.css = self._css_view()
        self._blocks = self._parse_blocks()
        self._block_starts = [b[1] for b in self._blocks]
        self._brace_pos, self._brace_depth = self._brace_index()
        self.fontface_spans = [(m.start(), m.end()) for m in
                               re.finditer(r'@font-face\s*\{[^}]*\}', self.css, re.I)]

    def line(self, pos):
        return bisect.bisect_right(self._line_starts, pos)

    def where(self, pos):
        return '%s:%d' % (self.name, self.line(pos))

    def _css_view(self):
        if self.ext == '.css':
            return CSS_COMMENT.sub(lambda m: blank(m.group(0)), self.text)
        if self.ext == '.js':
            t = CSS_COMMENT.sub(lambda m: blank(m.group(0)), self.text)
            return JS_LINE_COMMENT.sub(lambda m: blank(m.group(0)), t)
        # HTML: blank everything, then paste the CSS regions back in.
        src = HTML_COMMENT.sub(lambda m: blank(m.group(0)), self.text)
        for m in LINK_RE.finditer(src):
            h = HREF_RE.search(m.group(0))
            if h:
                self.links.append(os.path.basename(h.group(1).split('?')[0]))
        for m in SCRIPT_SRC.finditer(src):
            self.scripts.append(os.path.basename(m.group(1).split('?')[0]))
        out = list(blank(src))
        for m in STYLE_BLOCK.finditer(src):
            body = CSS_COMMENT.sub(lambda x: blank(x.group(0)), m.group(2))
            out[m.start(2):m.end(2)] = list(body)
        for m in STYLE_ATTR.finditer(src):
            # an attribute is a declaration list with no selector: wrap it in a
            # synthetic block so the block parser sees it, without moving offsets.
            body = m.group(2)
            if '--' in body or ':' in body:
                out[m.start(2):m.end(2)] = list(body)
                if out[m.start(2) - 1] == ' ':
                    out[m.start(2) - 1] = '{'
                if out[m.end(2)] == ' ':
                    out[m.end(2)] = '}'
        return ''.join(out)

    def _brace_index(self):
        pos, depth, d = [], [], 0
        for m in re.finditer(r'[{}]', self.css):
            d += 1 if m.group() == '{' else -1
            pos.append(m.start())
            depth.append(d)
        return pos, depth

    def depth_at(self, p):
        i = bisect.bisect_right(self._brace_pos, p - 1) - 1
        return self._brace_depth[i] if i >= 0 else 0

    def _parse_blocks(self):
        """(selector, body_start, body_end) for every brace block, innermost last
        in document order by body_start."""
        out, stack, last = [], [], 0
        for m in re.finditer(r'[{}]', self.css):
            if m.group() == '{':
                stack.append((self.css[last:m.start()], m.end()))
                last = m.end()
            else:
                if stack:
                    sel, bs = stack.pop()
                    out.append((' '.join(sel.split()), bs, m.start()))
                last = m.end()
        out.sort(key=lambda b: b[1])
        return out

    def ancestors(self, pos):
        """Selectors of every block containing pos, outermost first."""
        want = self.depth_at(pos)
        if want <= 0:
            return []
        out = []
        i = bisect.bisect_right(self._block_starts, pos) - 1
        while i >= 0 and len(out) < want:
            sel, bs, be = self._blocks[i]
            if bs <= pos and be >= pos:
                out.append(sel)
            i -= 1
        return list(reversed(out))

    def selector_at(self, pos):
        """Innermost selector containing pos."""
        i = bisect.bisect_right(self._block_starts, pos) - 1
        best = ''
        while i >= 0:
            sel, bs, be = self._blocks[i]
            if be >= pos:
                best = sel
                break
            i -= 1
        return best

    def in_fontface(self, pos):
        return any(a <= pos < b for a, b in self.fontface_spans)


# ---------------------------------------------------------------------------
# extraction
# ---------------------------------------------------------------------------

DEF_RE = re.compile(r'(?<![\w-])(--[A-Za-z0-9_-]+)\s*:')
USE_RE = re.compile(r'\bvar\(\s*(--[A-Za-z0-9_-]+)\s*(,?)')
SETPROP_RE = re.compile(r'setProperty\(\s*[`"\'](--[A-Za-z0-9_-]+)')
DECL_RE = re.compile(r'(?<![\w-])(-{0,2}[a-zA-Z][a-zA-Z0-9-]*)\s*:')


def read_value(css, start):
    """Value text from `start` to the terminating ; or } at paren depth 0."""
    depth, quote, i, n = 0, None, start, len(css)
    while i < n:
        ch = css[i]
        if quote:
            if ch == quote:
                quote = None
        elif ch in '"\'':
            quote = ch
        elif ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        elif depth == 0 and ch in ';}':
            break
        i += 1
    return css[start:i].strip(), i


GLOBAL_SCOPE = re.compile(r'^(?::root|html|\*|:where\(:root\)|:root\s*,|html\s*,)',
                          re.I)


def is_global_scope(sel):
    """A GLOBAL definition is one made on the root element itself.

    `GLOBAL_SCOPE.match` alone was too generous: it anchors on the START of the
    selector, so `:root[data-theme="dark"] body[data-theme-page="headmaker"]`
    counted as global even though the declaration lands on <body>, on one page,
    in one theme. That is the language's own scoping mechanism -- the same thing
    `.jbNav{--ico-md:16px}` is -- and it is never a competing global value.
    Reading it as global made builder-theme.css's dark adapter report 17
    `conflicting_definition` ERRORs for doing exactly the job it exists to do.
    So: the selector must start at the root AND its last compound must still be
    the root. Any descendant or child combinator means it is scoped."""
    s = (sel or '').strip()
    if not GLOBAL_SCOPE.match(s):
        return False
    return not any(re.search(r'[\s>+~]', part.strip())
                   for part in s.split(','))


def collect_defs(src):
    """token name -> list of Def dicts.

    `scope` distinguishes a GLOBAL definition (`:root{}` / `html{}`) from a
    SCOPED one (`.jbNav{--ico-md:16px}`). Scoped re-binding is the language's
    own mechanism for local variation and is never a conflict; only global
    definitions are compared across files.
    `at` records the enclosing at-rule chain, so a responsive or
    prefers-reduced-motion override is not mistaken for a competing value."""
    out = defaultdict(list)
    css = src.css
    for m in DEF_RE.finditer(css):
        pre = css[max(0, m.start() - 6):m.start()]
        if re.search(r'var\(\s*$', pre):
            continue
        value, _ = read_value(css, m.end())
        anc = src.ancestors(m.start())
        at = [a for a in anc if a.lstrip().startswith('@')]
        sel = anc[-1] if anc else ''
        out[m.group(1)].append({
            'pos': m.start(), 'value': value, 'at': at,
            'scope': 'global' if is_global_scope(sel) else 'scoped',
            'selector': sel,
        })
    for m in SETPROP_RE.finditer(src.text):
        out[m.group(1)].append({'pos': m.start(), 'value': '<runtime>',
                                'at': [], 'scope': 'runtime', 'selector': ''})
    return out


def collect_uses(src):
    """list of (pos, token, has_fallback)."""
    return [(m.start(), m.group(1), m.group(2) == ',')
            for m in USE_RE.finditer(src.css)]


def collect_decls(src):
    """list of (pos, prop, value, selector) for every declaration inside a block."""
    out = []
    css = src.css
    for m in DECL_RE.finditer(css):
        if src.depth_at(m.start()) <= 0:
            continue
        pre = css[max(0, m.start() - 6):m.start()]
        if re.search(r'var\(\s*$', pre):
            continue
        prop = m.group(1).lower()
        if prop.startswith('--'):
            continue
        value, _ = read_value(css, m.end())
        if not value:
            continue
        out.append((m.start(), prop, value, src.selector_at(m.start())))
    return out


# ---------------------------------------------------------------------------
# property categories
# ---------------------------------------------------------------------------

RADIUS_PROPS = {'border-radius', 'border-top-left-radius', 'border-top-right-radius',
                'border-bottom-left-radius', 'border-bottom-right-radius'}
SPACE_PROPS = {'padding', 'padding-top', 'padding-right', 'padding-bottom',
               'padding-left', 'padding-block', 'padding-inline', 'margin',
               'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
               'margin-block', 'margin-inline', 'gap', 'row-gap', 'column-gap',
               'grid-gap'}
SIZE_PROPS = {'width', 'height', 'min-width', 'min-height', 'max-width',
              'max-height', 'flex-basis'}
COLOUR_PROPS = {'color', 'background', 'background-color', 'border-color', 'fill',
                'stroke', 'outline-color', 'border-top-color', 'border-right-color',
                'border-bottom-color', 'border-left-color', 'caret-color',
                'text-decoration-color', 'accent-color'}
BORDER_PROPS = {'border', 'border-top', 'border-right', 'border-bottom',
                'border-left', 'border-width', 'outline', 'outline-width'}
MOTION_PROPS = {'transition', 'transition-duration', 'transition-timing-function',
                'animation', 'animation-duration', 'animation-timing-function'}
SHADOW_PROPS = {'box-shadow'}

EASING_KEYWORDS = {'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear',
                   'step-start', 'step-end'}
EASING_RE = re.compile(r'^(cubic-bezier|linear|steps)\(', re.I)


# Which family a token belongs to, BY NAME, in order. Deriving the family from
# the value alone is wrong: --fs-body and --sp-16 are both `16px` but a 16px
# padding is not a font size, and proposing --fs-body for it would be nonsense.
# Only families whose members are interchangeable with a literal in the same
# property are listed; --fs-*, --lh-*, --tr-*, --blur-* and the responsive
# --sp-A-B ladder are deliberately absent (see NON_SUBSTITUTABLE below).
TOKEN_FAMILY = [
    (re.compile(r'^--r-'), 'radius'),
    (re.compile(r'^--sp-\d+$'), 'length'),          # the FIXED ladder only
    (re.compile(r'^--(pad-bar|gap-bar|tap-min|nav-h|hair-w|focus-w)$'), 'length'),
    (re.compile(r'^--ico-(xs|sm|md)$'), 'icon'),
    (re.compile(r'^--(c\d+|yellow)$'), 'colour'),
    (re.compile(r'^--accent(-press|-wash|-dark)?$'), 'colour'),
    (re.compile(r'^--(wash-\w+|mat-[\w-]+|i700|i100)$'), 'colour'),
    (re.compile(r'^--(rim|sh)-'), 'shadow'),
    (re.compile(r'-dur$'), 'duration'),
    (re.compile(r'^--ease-out$'), 'easing'),
    (re.compile(r'^--sp-(quick|settle|pop|bounce|bounce-approx)$'), 'easing'),
]

# Named here so the exclusion is a decision on the record, not an oversight:
# these tokens hold values a literal elsewhere may coincidentally equal, but
# substituting the token would change the meaning of the declaration.
NON_SUBSTITUTABLE = ('--fs-', '--lh-', '--tr-', '--blur-', '--gap-head',
                     '--gap-eyebrow', '--gap-para', '--rail-', '--press-scale',
                     '--ico-stroke')


def token_category(name, value):
    if name.startswith(NON_SUBSTITUTABLE):
        return None
    for rx, cat in TOKEN_FAMILY:
        if rx.search(name):
            return cat
    return None


def prop_categories(prop):
    """Which token families a literal in this property could legitimately be."""
    cats = set()
    if prop in RADIUS_PROPS:
        cats.add('radius')
    if prop in SPACE_PROPS or prop in SIZE_PROPS:
        cats.add('length')
    if prop in SIZE_PROPS:
        cats.add('icon')
    if prop in COLOUR_PROPS or prop in SHADOW_PROPS or prop in BORDER_PROPS:
        cats.add('colour')
    if prop in BORDER_PROPS:
        cats.add('length')
    if prop in MOTION_PROPS:
        cats.add('duration')
        cats.add('easing')
    if prop in SHADOW_PROPS:
        cats.add('shadow')
    return cats


SKIP_LITERALS = {'0', 'auto', 'none', 'inherit', 'initial', 'unset', 'currentcolor',
                 'transparent', 'solid', 'dashed', 'dotted', 'inset', 'outset',
                 'infinite', 'both', 'forwards', 'backwards', 'normal', 'revert'}


def interesting(lit):
    l = lit.strip().lower()
    if not l or l in SKIP_LITERALS:
        return False
    if l.startswith(('var(', 'calc(', 'clamp(', 'min(', 'max(', 'env(', 'url(')):
        return False
    if l.startswith('--'):
        return False
    return True


# ---------------------------------------------------------------------------
# the audit
# ---------------------------------------------------------------------------

class Finding(dict):
    pass


class Audit:
    def __init__(self, scope='shipping'):
        self.scope = scope
        self.sources = {}
        self.findings = defaultdict(list)
        self.metrics = {}
        self.missing = []
        self._load()

    # -- files ------------------------------------------------------------
    def _load(self):
        names = list(SHIPPING_HTML) + list(SHIPPING_CSS) + list(SHIPPING_JS)
        if self.scope in ('demos', 'all'):
            names += DEMO_FILES
        if self.scope == 'demos':
            # tokens.css comes along because it is the token index and because
            # header-prototype.html links it; the shipping pages do not.
            names = list(DEMO_FILES) + [TOKENS_FILE]
        for n in names:
            p = os.path.join(ROOT, n)
            if not os.path.exists(p):
                self.missing.append(n)
                continue
            self.sources[n] = Source(p)
        self.pages = [n for n in self.sources
                      if n.endswith('.html') and
                      (self.scope != 'shipping' or n in SHIPPING_HTML)]
        self.defs = {n: collect_defs(s) for n, s in self.sources.items()}
        self.uses = {n: collect_uses(s) for n, s in self.sources.items()}
        self.decls = {n: collect_decls(s) for n, s in self.sources.items()
                      if not n.endswith('.js')}

    def add(self, key, level, where, msg, **extra):
        f = Finding(level=level, where=where, msg=msg)
        f.update(extra)
        self.findings[key].append(f)

    # -- 1. undefined tokens ---------------------------------------------
    def check_undefined(self):
        """Reachability is resolved PER PAGE -- a token defined in index.html is
        not defined for play.html. That is what makes this check able to catch
        'header.css uses a token only tokens.css defines, on the one page that
        does not link tokens.css'."""
        reach = {}
        for page in self.pages:
            s = self.sources[page]
            names = set(self.defs[page])
            for dep in s.links + s.scripts:
                if dep in self.defs:
                    names |= set(self.defs[dep])
            reach[page] = names
        # which pages can reach each shared file
        readers = defaultdict(list)
        for page in self.pages:
            s = self.sources[page]
            readers[page].append(page)
            for dep in s.links + s.scripts:
                if dep in self.sources:
                    readers[dep].append(page)
        all_names = set()
        for d in self.defs.values():
            all_names |= set(d)

        for fname, uses in self.uses.items():
            src = self.sources[fname]
            for pos, token, fb in uses:
                pages = readers.get(fname) or []
                if pages:
                    bad = [p for p in pages if token not in reach[p]]
                    if not bad:
                        continue
                    ctx = 'unreachable on ' + ', '.join(sorted(bad))
                else:
                    if token in all_names:
                        continue
                    ctx = 'defined nowhere in the tree'
                key = 'undefined_with_fallback' if fb else 'undefined_no_fallback'
                self.add(key, 'WARNING' if fb else 'ERROR', src.where(pos),
                         '%s -- %s' % (token, ctx), token=token, file=fname,
                         line=src.line(pos), pages=sorted(set(pages)))

    # -- 2/3. literals ----------------------------------------------------
    def build_token_index(self):
        """value -> token names, from tokens.css only. tokens.css is the intended
        single home, so a literal is 'tokenisable' only if THE canonical file
        already names that exact value."""
        idx = defaultdict(lambda: defaultdict(set))
        scale = defaultdict(set)
        tk = self.sources.get(TOKENS_FILE)
        if not tk:
            return idx, scale
        for name, entries in self.defs[TOKENS_FILE].items():
            for d in entries:
                value = d['value']
                if value == '<runtime>' or 'var(' in value or d['at']:
                    continue
                cat = token_category(name, value)
                if not cat:
                    continue
                v = norm(value)
                if cat == 'duration':
                    v = canon_time(value) or v
                idx[cat][v].add(name)
                if cat in ('length', 'radius', 'icon'):
                    px = px_of(value)
                    if px is not None:
                        scale[cat].add(px)
                elif cat == 'duration':
                    ms = to_ms(value)
                    if ms is not None:
                        scale['duration'].add(ms)
        return idx, scale

    def check_literals(self):
        idx, scale = self.build_token_index()
        self.token_index = idx
        hits = Counter()
        hit_sites = defaultdict(list)
        gaps = Counter()
        gap_sites = defaultdict(list)
        raw_px = Counter()
        raw_hex = Counter()
        raw_px_t = Counter()
        raw_hex_t = Counter()

        for fname, decls in self.decls.items():
            if fname == TOKENS_FILE:
                continue
            src = self.sources[fname]
            for pos, prop, value, sel in decls:
                for lit in re.findall(r'(?<![\w.#-])-?\d*\.?\d+px\b', value):
                    raw_px[fname] += 1
                for lit in re.findall(r'#[0-9a-fA-F]{3,8}\b', value):
                    raw_hex[fname] += 1
                cats = prop_categories(prop)
                if not cats:
                    continue
                # the same two counts, but only on properties the token layer
                # actually covers -- the honest denominator for "how much of
                # this page could be tokenised today".
                raw_px_t[fname] += len(re.findall(r'(?<![\w.#-])-?\d*\.?\d+px\b', value))
                raw_hex_t[fname] += len(re.findall(r'#[0-9a-fA-F]{3,8}\b', value))
                parts = split_top(value)
                if prop in SHADOW_PROPS:
                    parts = parts + [p.strip() for p in split_top(value, ',')]
                for lit in parts:
                    if not interesting(lit):
                        continue
                    nlit = norm(lit)
                    if lit.lower() in EASING_KEYWORDS and 'easing' not in cats:
                        continue
                    matched = None
                    for cat in cats:
                        probe = nlit
                        if cat == 'duration':
                            probe = canon_time(lit) or nlit
                        if probe in idx.get(cat, {}):
                            matched = (cat, sorted(idx[cat][probe])[0], probe)
                            break
                    if matched:
                        cat, token, probe = matched
                        hits[(cat, probe, token)] += 1
                        hit_sites[(cat, probe, token)].append(
                            (src.where(pos), prop, sel[:70]))
                    else:
                        cat = self._gap_cat(lit, cats)
                        if cat:
                            gaps[(cat, nlit)] += 1
                            gap_sites[(cat, nlit)].append(
                                (src.where(pos), prop, sel[:70]))

        self.metrics['raw_px_by_file'] = dict(raw_px)
        self.metrics['raw_hex_by_file'] = dict(raw_hex)
        self.metrics['raw_px_tokenable_by_file'] = dict(raw_px_t)
        self.metrics['raw_hex_tokenable_by_file'] = dict(raw_hex_t)
        self.hit_sites = hit_sites
        self.gap_sites = gap_sites
        self.scale = scale

        for (cat, lit, token), n in hits.most_common():
            sl = hit_sites[(cat, lit, token)]
            by_file = Counter(s[0].split(':')[0] for s in sl)
            self.add('tokenisable_literal', 'WARNING', sl[0][0],
                     '%s %s -> %s (%d occurrences: %s)'
                     % (cat, lit, token, n,
                        ', '.join('%s %d' % kv for kv in by_file.most_common(4))),
                     category=cat, literal=lit, token=token, count=n,
                     by_file=dict(by_file), sites=[s[0] for s in sl[:12]])
        for (cat, lit), n in gaps.most_common():
            if n < 2:
                continue
            sl = gap_sites[(cat, lit)]
            by_file = Counter(s[0].split(':')[0] for s in sl)
            self.add('untokenised_literal', 'WARNING', sl[0][0],
                     '%s %s x%d -- %s' % (cat, lit, n, self._propose(cat, lit, scale)),
                     category=cat, literal=lit, count=n,
                     proposal=self._propose(cat, lit, scale),
                     by_file=dict(by_file), sites=[s[0] for s in sl[:12]])

    @staticmethod
    def _gap_cat(lit, cats):
        l = lit.strip().lower()
        if canon_time(l) and 'duration' in cats:
            return 'duration'
        if (EASING_RE.match(l) or l in EASING_KEYWORDS) and 'easing' in cats:
            return 'easing'
        if (l.startswith('#') or l.startswith(('rgb(', 'rgba(', 'hsl(', 'hsla(',
                                               'oklch(', 'oklab('))) and 'colour' in cats:
            return 'colour'
        px = px_of(l)
        if px is not None and px > 0:
            # negatives are offsets and pulls, not rungs on a spacing ladder
            if 'radius' in cats:
                return 'radius'
            if 'length' in cats:
                return 'length'
        return None

    @staticmethod
    def _propose(cat, lit, scale):
        """Where this literal belongs in the existing scale. A gap is not a
        violation: the point is to say whether it is drift off a rung the ladder
        already has, or a rung the ladder is genuinely missing."""
        if cat == 'duration':
            ms = to_ms(lit)
            rungs = sorted(scale.get('duration', ()))
            if ms is None or not rungs:
                return 'no duration scale to compare against'
            below = [r for r in rungs if r <= ms]
            above = [r for r in rungs if r >= ms]
            if below and above and below[-1] == above[0]:
                return 'equals the %gms rung -- use the token' % below[-1]
            lo = '%gms' % below[-1] if below else 'nothing'
            hi = '%gms' % above[0] if above else 'nothing'
            return 'sits between %s and %s -- name a rung or move to one' % (lo, hi)
        if cat == 'easing':
            return ('not one of the named curves; the site has 2 easing tokens '
                    'and this is not either')
        if cat == 'colour':
            return 'no colour token holds this value -- add a ramp step or re-use one'
        px = px_of(lit)
        if px is None:
            return 'no rung; needs a named token or a nearer existing one'
        rungs = sorted(scale.get(cat, ())) or sorted(scale.get('length', ()))
        if not rungs:
            return 'no scale to compare against'
        if px > max(rungs) * 2:
            return ('layout measure (%gpx), above the whole ladder -- belongs to '
                    'a named layout token, not a spacing rung' % px)
        near = min(rungs, key=lambda r: abs(r - px))
        d = abs(near - px)
        if d <= 1:
            return 'round to the %gpx rung (off by %gpx)' % (near, d)
        if d <= 2:
            return 'nearest rung %gpx -- likely a rounding drift' % near
        return 'genuine gap; nearest rung %gpx -- add a rung or re-use it' % near

    # -- 4. duplicate / conflicting definitions ---------------------------
    def check_conflicts(self):
        """Compare only GLOBAL definitions, and compare a file's BASE value
        against the canonical file's FULL set of values (base + every at-rule
        state). A page that copies tokens.css's base value is a duplicate, not a
        conflict; a page that copies the base but drops the
        prefers-reduced-motion or breakpoint state is an incomplete copy; a page
        that states a different base value is the dangerous case."""
        base = defaultdict(dict)      # token -> file -> normalised base value
        allv = defaultdict(lambda: defaultdict(set))
        atstates = defaultdict(lambda: defaultdict(set))
        where = defaultdict(dict)
        for fname, d in self.defs.items():
            for name, entries in d.items():
                for e in entries:
                    if e['value'] == '<runtime>' or e['scope'] != 'global':
                        continue
                    v = norm(e['value'])
                    allv[name][fname].add(v)
                    if e['at']:
                        atstates[name][fname].add(' '.join(e['at'])[:60])
                    else:
                        base[name].setdefault(fname, v)
                        where[name].setdefault(fname, self.sources[fname].where(e['pos']))

        for name in sorted(base):
            files = sorted(base[name])
            if len(files) < 2:
                continue
            canon = TOKENS_FILE if TOKENS_FILE in files else files[0]
            canon_vals = allv[name][canon]
            for f in files:
                if f == canon:
                    continue
                v = base[name][f]
                if v in canon_vals:
                    missing = atstates[name][canon] - atstates[name][f]
                    if missing:
                        self.add('incomplete_token_copy', 'WARNING', where[name][f],
                                 '%s copied from %s but without its %s state'
                                 % (name, canon, '/'.join(sorted(missing))),
                                 token=name, file=f, missing=sorted(missing))
                    else:
                        self.add('duplicate_definition', 'WARNING', where[name][f],
                                 '%s defined identically in %s and %s'
                                 % (name, canon, f), token=name, files=[canon, f])
                elif (name, f) in SANCTIONED_REBINDS:
                    self.add('sanctioned_rebind', 'INFO', where[name][f],
                             '%s re-bound in %s to %s (documented in tokens.css)'
                             % (name, f, v), token=name, file=f, value=v)
                else:
                    self.add('conflicting_definition', 'ERROR', where[name][f],
                             '%s = %s in %s, but %s in %s (%s)'
                             % (name, v, f, '|'.join(sorted(canon_vals)), canon,
                                where[name].get(canon, canon)),
                             token=name, file=f, value=v,
                             canonical=canon, canonical_values=sorted(canon_vals),
                             sites=[where[name][f], where[name].get(canon, '')])

    # -- 5. motion --------------------------------------------------------
    def check_motion(self):
        """Counted two ways, because the two numbers answer different questions.
        `*_literal` counts only values written as raw literals -- that is the
        spread the token layer has not absorbed yet. `tokenised` counts var()
        references, which are already under control. Transition and animation are
        kept apart: an animation curve is choreography, a transition curve is
        interaction feel, and only the second is a chrome consistency problem."""
        dur = {'transition': Counter(), 'animation': Counter()}
        ease = {'transition': Counter(), 'animation': Counter()}
        tokenised = Counter()
        sites = defaultdict(list)
        for fname, decls in self.decls.items():
            if fname == TOKENS_FILE:
                continue
            src = self.sources[fname]
            for pos, prop, value, sel in decls:
                if prop not in MOTION_PROPS:
                    continue
                kind = 'transition' if prop.startswith('transition') else 'animation'
                for seg in split_top(IMPORTANT_RE.sub('', value), ','):
                    parts = split_top(seg)
                    times = [p for p in parts if canon_time(p)]
                    if prop.endswith('-duration'):
                        for t in times:
                            dur[kind][canon_time(t)] += 1
                            sites[('dur', canon_time(t))].append(src.where(pos))
                    elif times:
                        dur[kind][canon_time(times[0])] += 1
                        sites[('dur', canon_time(times[0]))].append(src.where(pos))
                    for p in parts:
                        lp = p.strip().lower()
                        if lp.startswith('var(--'):
                            tokenised[re.match(r'var\(\s*(--[\w-]+)', lp).group(1)] += 1
                            continue
                        if lp in EASING_KEYWORDS and lp != 'linear':
                            key = lp
                        elif EASING_RE.match(lp):
                            key = norm(lp)
                        else:
                            continue
                        ease[kind][key] += 1
                        sites[('ease', key)].append(src.where(pos))

        alld = dur['transition'] + dur['animation']
        alle = ease['transition'] + ease['animation']
        self.metrics['distinct_durations'] = len(alld)
        self.metrics['distinct_easings'] = len(alle)
        self.metrics['distinct_transition_durations'] = len(dur['transition'])
        self.metrics['distinct_transition_easings'] = len(ease['transition'])
        self.metrics['distinct_animation_durations'] = len(dur['animation'])
        self.metrics['distinct_animation_easings'] = len(ease['animation'])
        self.metrics['duration_histogram'] = alld.most_common()
        self.metrics['easing_histogram'] = alle.most_common()
        self.metrics['tokenised_motion_refs'] = tokenised.most_common()
        token_curve = norm('cubic-bezier(.2,.8,.2,1)')
        kw, lit = alle.get('ease-out', 0), alle.get(token_curve, 0)
        self.metrics['ease_out_keyword'] = kw
        self.metrics['ease_out_literal_curve'] = lit
        self.metrics['ease_out_pair'] = kw + lit
        if kw and lit:
            self.add('motion_curve_collision', 'WARNING', 'site-wide',
                     'ease-out keyword (%d) and cubic-bezier(.2,.8,.2,1) (%d) sit '
                     'side by side %d times and are NOT the same curve'
                     % (kw, lit, kw + lit), count=kw + lit,
                     sites=sites[('ease', 'ease-out')][:8])
        if len(dur['transition']) > 2:
            self.add('motion_spread', 'WARNING', 'site-wide',
                     '%d distinct literal transition durations and %d distinct '
                     'literal transition easings, against 2 motion tokens '
                     '(--ease-out, --ease-out-dur). Site-wide incl. animation: '
                     '%d / %d.' % (len(dur['transition']), len(ease['transition']),
                                   len(alld), len(alle)),
                     transition_durations=len(dur['transition']),
                     transition_easings=len(ease['transition']),
                     all_durations=len(alld), all_easings=len(alle))

    # -- 6. control geometry ---------------------------------------------
    CONTROL_SEL = re.compile(
        r'(?:^|[\s,>+~])(?:button\b|\.[\w-]*(?:btn|button|chip|pill|toggle|tab)[\w-]*)',
        re.I)
    GRID = {0, 1, 2, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 30, 32, 36, 40,
            44, 48, 52, 56, 64, 72, 80}

    def check_controls(self):
        pads = Counter()
        pad_sites = defaultdict(list)
        offgrid = Counter()
        offgrid_sites = defaultdict(list)
        small = []
        for fname, decls in self.decls.items():
            if fname == TOKENS_FILE:
                continue
            src = self.sources[fname]
            for pos, prop, value, sel in decls:
                if not self.CONTROL_SEL.search(sel or ''):
                    continue
                if prop == 'padding':
                    key = norm(value)
                    pads[key] += 1
                    pad_sites[key].append((src.where(pos), sel[:70]))
                if prop in ('padding', 'padding-top', 'padding-bottom',
                            'padding-left', 'padding-right', 'height',
                            'min-height', 'width', 'min-width', 'border-radius'):
                    for part in split_top(value):
                        px = px_of(part)
                        if px is not None and px not in self.GRID:
                            offgrid[part.strip()] += 1
                            offgrid_sites[part.strip()].append(
                                (src.where(pos), prop, sel[:70]))
                if prop in ('height', 'min-height', 'width', 'min-width'):
                    # a pseudo-element, an icon inside the control, or a
                    # 1-2px rule is not the tap target; the control box is.
                    if '::' in sel or re.search(r'\b(svg|path|i|span)\b\s*$', sel):
                        continue
                    px = px_of(value)
                    if px is not None and 16 <= px < 44:
                        small.append((src.where(pos), sel[:70], prop, value))
        self.metrics['control_padding_variants'] = len(pads)
        self.metrics['control_padding_histogram'] = pads.most_common()
        if len(pads) > 3:
            self.add('control_padding_spread', 'WARNING', 'site-wide',
                     '%d distinct padding values on button-like controls: %s'
                     % (len(pads), ', '.join('%s (x%d)' % (p, n)
                                             for p, n in pads.most_common(10))),
                     count=len(pads), histogram=pads.most_common())
        for lit, n in offgrid.most_common():
            ex = offgrid_sites[lit][0]
            self.add('control_offgrid', 'WARNING', ex[0],
                     '%s x%d on control geometry -- on no rung of the ladder'
                     % (lit, n), literal=lit, count=n,
                     sites=[s[0] for s in offgrid_sites[lit][:10]])
        for where_, sel, prop, value in small:
            self.add('tap_target_under_44', 'WARNING', where_,
                     '%s: %s:%s -- below the 44px --tap-min' % (sel, prop, value),
                     selector=sel, prop=prop, value=value)

    # -- standing rules ---------------------------------------------------
    CHROME_SEL = re.compile(
        r'(?:nav|header|\bbar\b|panel|card|menu|sheet|drawer|tooltip|modal|dialog'
        r'|btn|button|chip|tab|pill|toggle|rail|dock|toast)', re.I)
    NOT_CHROME_SEL = re.compile(
        r'(?:head(?!er)|shadow|hero|photo|ball|orb|cup|trophy|face|eye|blob|'
        r'crate|marble|confetti|spark|glow|planet|lava|goal|pitch|sun|moon)', re.I)

    def check_shadows(self):
        for fname, decls in self.decls.items():
            if fname == TOKENS_FILE:
                continue
            src = self.sources[fname]
            for pos, prop, value, sel in decls:
                if prop != 'box-shadow':
                    continue
                v = IMPORTANT_RE.sub('', value.strip()).lower()
                if v in ('none', 'unset', 'inherit', 'initial') or not sel:
                    continue
                if 'focus' in sel.lower() or 'scrollbar' in sel.lower():
                    continue
                if not self.CHROME_SEL.search(sel) or self.NOT_CHROME_SEL.search(sel):
                    continue
                cast = [l for l in (x.strip() for x in split_top(v, ','))
                        if self._is_cast(l)]
                if not cast:
                    continue          # pure rim -- a border, not an elevation
                self.add('chrome_cast_shadow', 'WARNING', src.where(pos),
                         '%s -- box-shadow:%s (chrome separates with hairlines, '
                         'not elevation)' % (sel[:70], value[:90]),
                         selector=sel[:120], value=value[:160],
                         layers=cast)

    @staticmethod
    def _is_cast(layer):
        """A layer is an ELEVATION only if it is not inset and actually casts:
        `0 0 0 1px rgba(...)` is a ring drawn on the outside -- a border by
        another name -- and the no-shadow rule is about elevation, not borders."""
        if layer.startswith('inset') or 'rim' in layer:
            return False
        nums = re.findall(r'(-?\d*\.?\d+)(?:px|rem|em)?', layer)
        vals = [float(n) for n in nums[:3]] if len(nums) >= 3 else None
        if vals and vals[0] == 0 and vals[1] == 0 and vals[2] == 0:
            return False          # spread-only ring
        return True

    # THE THREE HOVER FILLS THE SPECS ACTUALLY SANCTION.  Added 2026-08-04
    # because the heuristic and the specs had started disagreeing, and a gate
    # that fires on a rule the design system mandates is worse than no gate: the
    # next person "fixes" the sanctioned rule to get the number down.
    #
    # Keyed off the VALUE rather than the selector, deliberately. The specs
    # sanction particular TOKENS for particular roles, and a token is a durable
    # thing to test; a selector list is renamed every other round. Anything
    # reaching for a raw hex or a general grey still warns, which is the case
    # the check was written for.
    #
    #   --accent-press / --ctl-accent-press
    #       PRIMARY, and only Primary. 2026-08-03-control-system.md §5.3 lists
    #       the five properties that may animate on hover and gives
    #       `background-color` to "Primary only (accent -> accent-press)". A
    #       filled control is the one kind whose hover has nowhere else to go:
    #       its ink is already white on a solid ground.
    #   --nav-hover-bg / --nav-active-bg
    #       THE NAV PILL. header.css's Round 11/12 note records this as a
    #       deliberate reversal in Jayden's own words -- "hover should just be
    #       the light grey pill" -- explicitly scoped to nav items and nothing
    #       else. It is the one place the no-fill rule was overruled by the
    #       person the rule is for.
    #   --mat-* / --mat-i*
    #       A MATERIAL, NOT A FILL. §3.2's one permitted addition: a control
    #       floating over arbitrary content (a photograph, a video, the pitch)
    #       takes a material so its label stays legible. That is what it needs
    #       to be readable, not decoration on hover.
    SANCTIONED_HOVER_FILL = re.compile(
        r'var\(\s*--(?:ctl-)?accent-press|var\(\s*--nav-(?:hover|active)-bg|'
        r'var\(\s*--accent-wash|'
        r'var\(\s*--ctl-(?:ground-hover|primary-ground-hover)|'
        r'var\(\s*--mat-', re.I)
    # --ctl-ground-hover / --ctl-primary-ground-hover are the SEMANTIC names for
    # the same two sanctioned fills the raw names above already carry:
    # --ctl-ground-hover is --theme-elevated, the site's one interaction ground
    # (the same #F1F1F1 pill --nav-hover-bg and --accent-wash resolve to in
    # light), and --ctl-primary-ground-hover is the primary's pressed ground,
    # which --accent-press already covers under its old name. Without them,
    # controls.css -- added to SHIPPING_CSS on 2026-08-08 -- reported its own
    # base library as three unsanctioned hover fills, which is the tool
    # disagreeing with the system it audits rather than with a defect.
    # --accent-wash is the SAME sanctioned case as --nav-hover-bg: both resolve to
    # #F1F1F1, the site's one interaction ground. --nav-hover-bg is declared inside
    # .jbNav and does not resolve outside the bar, so any control outside the header
    # that wants the hover pill must reach for --accent-wash. Omitting it here made
    # the Gradient Maker's tab hover report as an unsanctioned fill.

    def check_hover_fill(self):
        for fname, decls in self.decls.items():
            if fname == TOKENS_FILE:
                continue
            src = self.sources[fname]
            for pos, prop, value, sel in decls:
                if prop not in ('background', 'background-color'):
                    continue
                if ':hover' not in (sel or ''):
                    continue
                v = IMPORTANT_RE.sub('', value.strip()).lower()
                if v.startswith(('none', 'transparent', 'unset', 'inherit', 'initial')):
                    continue
                if self.NOT_CHROME_SEL.search(sel or '') or 'scrollbar' in sel.lower():
                    continue
                if self.SANCTIONED_HOVER_FILL.search(v):
                    # Recorded, not suppressed. It stays visible in --list so the
                    # exception is auditable and nobody has to rediscover why the
                    # number moved; it just does not count as a warning.
                    self.add('hover_fill_sanctioned', 'INFO', src.where(pos),
                             '%s -- background:%s (sanctioned: Primary / nav pill '
                             '/ material -- see SANCTIONED_HOVER_FILL)'
                             % (sel[:70], value[:60]),
                             selector=sel[:120], value=value[:120])
                    continue
                self.add('hover_background_fill', 'WARNING', src.where(pos),
                         '%s -- background:%s (hover moves ink and weight, '
                         'not fill)' % (sel[:70], value[:60]),
                         selector=sel[:120], value=value[:120])

    ALLOWED_FONT = re.compile(
        r'^(?:var\(--(?:sans|serif|mono)\)|inherit|unset|initial|revert)$', re.I)

    def check_fonts(self):
        for fname, decls in self.decls.items():
            src = self.sources[fname]
            for pos, prop, value, sel in decls:
                if prop not in ('font-family', 'font'):
                    continue
                if src.in_fontface(pos):
                    continue           # @font-face LOADS a face; it is not a use
                fams = [f.strip().strip('\'"') for f in split_top(value, ',')]
                head = fams[0] if fams else ''
                if 'archivo' in value.lower():
                    if fname != 'play.css':
                        self.add('archivo_off_broadcast', 'ERROR', src.where(pos),
                                 '%s -- Archivo outside play.css: %s'
                                 % (sel[:60], value[:70]),
                                 file=fname, selector=sel[:120])
                    continue
                if self.ALLOWED_FONT.match(value.strip()):
                    continue
                if re.match(r'^(?:ui-monospace|monospace|system-ui|-apple-system)',
                            head, re.I):
                    continue
                if 'instrument sans' in value.lower():
                    continue
                self.add('third_font_family', 'WARNING', src.where(pos),
                         '%s -- font-family:%s' % (sel[:60], value[:80]),
                         file=fname, value=value[:120])

    def run(self):
        self.check_undefined()
        self.check_literals()
        self.check_conflicts()
        self.check_motion()
        self.check_controls()
        self.check_shadows()
        self.check_hover_fill()
        self.check_fonts()
        return self


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------

ORDER = [
    ('undefined_no_fallback', 'Undefined tokens, no fallback (silently inherits)'),
    ('conflicting_definition', 'Same token, different values, different files'),
    ('archivo_off_broadcast', 'Archivo outside the broadcast boards'),
    ('undefined_with_fallback', 'Undefined tokens carrying a fallback (intentional)'),
    ('incomplete_token_copy', 'Token copied without its responsive/preference state'),
    ('duplicate_definition', 'Token defined identically in more than one file'),
    ('sanctioned_rebind', 'Documented re-bindings'),
    ('tokenisable_literal', 'Raw values that exactly equal an existing token'),
    ('untokenised_literal', 'Raw values with no token (gaps in the scale)'),
    ('motion_curve_collision', 'Motion: interchangeable curves that are not equal'),
    ('motion_spread', 'Motion: duration and easing spread'),
    ('control_padding_spread', 'Control geometry: padding variants'),
    ('control_offgrid', 'Control geometry: off-grid values'),
    ('tap_target_under_44', 'Tap targets under 44px'),
    ('chrome_cast_shadow', 'Cast shadows on chrome'),
    ('hover_background_fill', 'Hover states that fill a background'),
    ('hover_fill_sanctioned', 'Hover fills the specs sanction (not a finding)'),
    ('third_font_family', 'Font families outside the system'),
]


def report(audit, args):
    findings = audit.findings
    errors = sum(1 for k, v in findings.items() for f in v if f['level'] == 'ERROR')
    warnings = sum(1 for k, v in findings.items() for f in v if f['level'] == 'WARNING')

    if args.json:
        out = {
            'scope': audit.scope,
            'excluded': EXCLUDED_FILES,
            'missing': audit.missing,
            'metrics': audit.metrics,
            'findings': {k: v for k, v in findings.items()},
            'errors': errors,
            'warnings': warnings,
        }
        print(json.dumps(out, indent=2, default=list))
        return errors

    w = sys.stdout.write
    w('=' * 78 + '\n')
    w('TOKEN AUDIT  scope=%s  root=%s\n' % (audit.scope, ROOT))
    w('excluded: %s\n' % ', '.join(EXCLUDED_FILES))
    if audit.scope == 'shipping':
        w('demos not audited (use --scope all): %s\n' % ', '.join(DEMO_FILES))
    if audit.missing:
        w('not present: %s\n' % ', '.join(audit.missing))
    w('=' * 78 + '\n\n')

    for key, title in ORDER:
        items = findings.get(key) or []
        if not items:
            continue
        level = items[0]['level']
        w('[%s] %s -- %d\n' % (level, title, len(items)))
        show = items if (args.list == key or args.verbose) else items[:args.top]
        for f in show:
            w('    %-26s %s\n' % (f['where'], f['msg']))
        if len(items) > len(show):
            w('    ... %d more (--list %s)\n' % (len(items) - len(show), key))
        w('\n')

    m = audit.metrics
    w('-' * 78 + '\nRAW-VALUE DENSITY   (all = every declaration; tok = only the\n'
      'properties the token layer covers -- radius, spacing, colour, motion, border)\n')
    px = m.get('raw_px_by_file', {})
    hx = m.get('raw_hex_by_file', {})
    pxt = m.get('raw_px_tokenable_by_file', {})
    hxt = m.get('raw_hex_tokenable_by_file', {})
    w('    %-22s %8s %8s %8s %8s\n' % ('', 'px all', 'px tok', 'hex all', 'hex tok'))
    for f in sorted(set(px) | set(hx), key=lambda f: -px.get(f, 0)):
        w('    %-22s %8d %8d %8d %8d\n'
          % (f, px.get(f, 0), pxt.get(f, 0), hx.get(f, 0), hxt.get(f, 0)))
    w('\nMOTION\n')
    w('    distinct durations : %d\n' % m.get('distinct_durations', 0))
    w('    distinct easings   : %d\n' % m.get('distinct_easings', 0))
    w('    ease-out keyword   : %d\n' % m.get('ease_out_keyword', 0))
    w('    literal .2,.8,.2,1 : %d\n' % m.get('ease_out_literal_curve', 0))
    if args.verbose:
        w('    durations: %s\n' % m.get('duration_histogram'))
        w('    easings  : %s\n' % m.get('easing_histogram'))
    w('\n')

    w('=' * 78 + '\n## MACHINE\n')
    for key, _ in ORDER:
        w('%s=%d\n' % (key, len(findings.get(key) or [])))
    w('tokenisable_occurrences=%d\n'
      % sum(f.get('count', 1) for f in findings.get('tokenisable_literal', [])))
    w('untokenised_occurrences=%d\n'
      % sum(f.get('count', 1) for f in findings.get('untokenised_literal', [])))
    w('distinct_durations=%d\n' % m.get('distinct_durations', 0))
    w('distinct_easings=%d\n' % m.get('distinct_easings', 0))
    w('control_padding_variants=%d\n' % m.get('control_padding_variants', 0))
    w('raw_px_total=%d\n' % sum(px.values()))
    w('raw_hex_total=%d\n' % sum(hx.values()))
    w('errors=%d\nwarnings=%d\n' % (errors, warnings))
    w('STATUS=%s\n' % ('FAIL' if errors else 'PASS'))
    return errors


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    ap.add_argument('--scope', choices=['shipping', 'demos', 'all'],
                    default='shipping')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--strict', action='store_true',
                    help='treat warnings as errors')
    ap.add_argument('--verbose', '-v', action='store_true')
    ap.add_argument('--top', type=int, default=8,
                    help='findings shown per category (default 8)')
    ap.add_argument('--list', default=None,
                    help='show every finding for one category key')
    ap.add_argument('--root', default=None,
                    help='audit a different tree (e.g. a `git archive` of the '
                         'branch point) to separate pre-existing findings from '
                         'ones this branch introduced')
    args = ap.parse_args()
    if args.root:
        global ROOT
        ROOT = os.path.abspath(args.root)

    audit = Audit(args.scope).run()
    errors = report(audit, args)
    if args.strict:
        warnings = sum(1 for v in audit.findings.values()
                       for f in v if f['level'] == 'WARNING')
        errors += warnings
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
