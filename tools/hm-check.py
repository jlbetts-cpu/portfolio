import re, subprocess, tempfile, sys, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fail = 0

def compact(source):
    return re.sub(r'\s+', '', source)

def check(label, source):
    global fail
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(source); p = f.name
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode:
        fail = 1; print(label, 'FAIL\n', r.stderr[:400])

for html in ['index.html', 'play.html']:
    path = os.path.join(ROOT, html)
    if not os.path.exists(path): continue
    for i, (attrs, body) in enumerate(
            re.findall(r'<script([^>]*)>(.*?)</script>', open(path).read(), re.S)):
        if 'ld+json' in attrs or 'src=' in attrs or not body.strip(): continue
        check('%s block %d' % (html, i), body)

for js in sorted(glob.glob(os.path.join(ROOT, '*.js'))):
    check(os.path.basename(js), open(js).read())

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
