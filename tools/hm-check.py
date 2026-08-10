import re, subprocess, tempfile, sys, os, glob, time
from html.parser import HTMLParser
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fail = 0

def compact(source):
    return re.sub(r'\s+', '', source)

# ── THE SYNTAX GATE, AND WHY IT LOOKS LIKE THIS  (2026-08-10) ────────────────
# The 2026-08-09 conformance audit recorded this file as reporting a SyntaxError
# in hero-head-transform.js that `node --check hero-head-transform.js` disagreed
# with, and put it down to a comment-stripper swallowing a /* */ block. There is
# no comment stripper here and never was, so that diagnosis is wrong -- but the
# gate did have two real ways to lie, and a gate nobody trusts is a gate nobody
# reads. Both are closed below. It reports `syntax OK` on the current tree.
#
# 1. IT EXTRACTED <script> BODIES WITH A REGEX.  `<script[^>]*>(.*?)</script>`
#    truncates the block at the first `</script>` that appears anywhere -- and a
#    JS string or a comment is allowed to contain that text. A truncated block is
#    a guaranteed SyntaxError that the real file does not have. HTMLParser scans
#    for the closing tag the way the HTML spec (and therefore the browser) does,
#    so the gate now agrees with the thing actually running the code.
#
# 2. IT REPORTED THE TEMP FILE'S PATH AND LINE NUMBERS.  Every .js file was
#    copied into /var/folders/... before checking, so a failure named a path that
#    no longer existed at a line number nobody could map back. Standalone files
#    are now checked IN PLACE; inline blocks report the HTML file and the line
#    the block starts on, so the number is addressable.
#
# 3. IT READ FILES OTHER AGENTS WERE WRITING.  This repo is worked by several
#    agents in one worktree, and a read that lands mid-write yields a torn file
#    and a phantom error. A failure is now re-read and re-checked once before it
#    is believed. That is the most likely explanation for the audit's report.

def _node_check(path):
    return subprocess.run(['node', '--check', path], capture_output=True, text=True)

def check_file(path):
    """Check a .js file in place, so paths and line numbers are the real ones."""
    global fail
    r = _node_check(path)
    if r.returncode:
        time.sleep(0.25)                      # a concurrent writer may have been mid-save
        r = _node_check(path)
    if r.returncode:
        fail = 1
        print(os.path.relpath(path, ROOT), 'FAIL\n', r.stderr[:400])

def check_block(label, source, line_offset):
    """Check an inline <script> body; map node's line numbers back to the page."""
    global fail
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(source); p = f.name
    try:
        r = _node_check(p)
        if r.returncode:
            err = r.stderr[:400].replace(p, label)
            # node reports "<file>:<n>"; n is relative to the extracted block
            err = re.sub(label + r':(\d+)',
                         lambda m: '%s:%d' % (label, int(m.group(1)) + line_offset - 1), err)
            fail = 1
            print(label, 'FAIL\n', err)
    finally:
        os.unlink(p)

class _Scripts(HTMLParser):
    """Collect inline <script> bodies with the line each one starts on."""
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.blocks, self._attrs, self._line = [], None, 0
    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self._attrs = dict(attrs)
            self._line = self.getpos()[0] + 1
    def handle_data(self, data):
        if self._attrs is not None:
            a = self._attrs
            if 'src' not in a and 'json' not in (a.get('type') or '') and data.strip():
                self.blocks.append((data, self._line))
    def handle_endtag(self, tag):
        if tag == 'script':
            self._attrs = None

for html in ['index.html', 'play.html']:
    path = os.path.join(ROOT, html)
    if not os.path.exists(path): continue
    parser = _Scripts(); parser.feed(open(path).read())
    for i, (body, line) in enumerate(parser.blocks):
        check_block('%s block %d (line %d)' % (html, i, line), body, line)

for js in sorted(glob.glob(os.path.join(ROOT, '*.js'))):
    check_file(js)

# Play Night theme contract. These assertions name the user-visible break they catch:
# a direct Night load must not leave any Play screen on the light ramp, while authored
# arena/team channels remain owned by the game rather than by the site theme.
play_html = open(os.path.join(ROOT, 'play.html')).read()
play_css = open(os.path.join(ROOT, 'play.css')).read()
theme_css = open(os.path.join(ROOT, 'site-theme.css')).read()
night_css = compact(play_css + theme_css)

assert re.search(r'<body\b[^>]*\bdata-theme-page=["\']play["\']', play_html), \
    'play.html must opt into the Play theme adapter'
for label, selector, declaration in (
    ('Play hub chrome', 'body[data-theme-page="play"] .pCard', 'background-color:var(--theme-surface)'),
    ('Add-your-head emphasis', 'body[data-theme-page="play"] #pcHead', 'background-color:var(--theme-elevated)'),
    ('Play menu', 'body[data-theme-page="play"] .moodMenu', 'background-color:var(--theme-elevated)'),
    ('team setup', 'body[data-theme-page="play"] .pTeamIn', 'background-color:var(--theme-surface)'),
    ('match instructions', 'body[data-theme-page="play"] .hmCount', 'color:var(--theme-ink)'),
    ('tournament panel', 'body[data-theme-page="play"] .tvSheetPanel', 'background-color:var(--theme-surface)'),
):
    expected = compact(':root[data-theme="dark"] ' + selector)
    assert expected in night_css and compact(declaration) in night_css[night_css.index(expected):], \
        f'{label}: missing dark Play adapter'

assert compact(':root[data-theme="dark"] body[data-theme-page="play"] .hmScore:has(.sbCard)::before') in night_css, \
    'scoreboard must have a localized Night backing light'
assert compact(':root[data-theme="dark"] body[data-theme-page="play"] .hmScore .sbCard') in night_css, \
    'scoreboard must have a frosted near-black Night material'
assert 'z-index:-1' in night_css and 'filter:blur(12px)' in night_css, \
    'scoreboard light must stay soft and behind the card'
assert compact('@media(prefers-reduced-motion:reduce){.hmScore.sbHit .sbCard{animation:none}}') in compact(play_css), \
    'reduced motion must remove only the scoreboard pulse, not its score state'

dark_blocks = ''.join(re.findall(r':root\[data-theme=["\']dark["\']\][^{]*\{[^}]*\}', play_css + theme_css, re.S))
for team_var in ('--tc1:', '--tc2:', '--tcol1:', '--tcol2:'):
    assert team_var not in dark_blocks, f'Night theme must not overwrite team channel {team_var[:-1]}'
for artwork in ('.hmPlanet', '.hmSky', '.hmWater', '.hmGoal', '.face', '.teamChip img'):
    assert artwork not in dark_blocks, f'Night theme must not target authored game artwork {artwork}'

print('syntax OK' if not fail else 'SYNTAX FAILURES'); sys.exit(fail)
