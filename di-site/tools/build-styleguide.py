# Generates styleguide.html: every token and component in both themes. Dev tool; the output is committed.
import json, re, datetime
root='/home/user/portfolio/di-site'
man=json.load(open(f'{root}/images/manifest.json'))
sprite=open(f'{root}/assets/icons.svg').read().strip()
whitemark=''.join(re.findall(r'<path[^>]*/>',open(f'{root}/assets/logo/dilogo.svg').read())).replace('fill="white"','fill="currentColor"')
logo=open(f'{root}/assets/logo/inline-logo.html').read().strip().replace(' role="img" aria-labelledby="logoTitle"><title id="logoTitle">Developmental Improvisation</title>',' aria-hidden="true">')
STAMP=datetime.date.today().strftime('%Y%m%d')

def pic(name, sizes='200px'):
    m=man[name]; ws=[w for w in m['sizes'] if w<=960]; av=', '.join(f'images/{name}-{w}.avif {w}w' for w in ws); wp=', '.join(f'images/{name}-{w}.webp {w}w' for w in ws)
    return f'<picture><source type="image/avif" srcset="{av}" sizes="{sizes}"><source type="image/webp" srcset="{wp}" sizes="{sizes}"><img src="images/{m["jpeg"]}" width="{m["width"]}" height="{m["height"]}" alt="" loading="lazy" decoding="async"></picture>'

# the logo's own order: the monogram, then the six arcs clockwise from the top
HUES=[('sky','#58CDFC'),('gold','#FFE469'),('magenta','#E744E2'),('violet','#7358FC'),('orange','#F0895B'),('green','#51E596'),('pink','#FB9BC9'),('yellow','#FEE79B')]
hues=''.join(f'<div class="sw" data-accent="{n}"><div class="sw__chip" style="background:var(--accent);color:var(--on-accent);display:grid;place-items:center;font-size:11px;font-weight:600">Aa</div><div class="sw__meta"><b>{n}</b> <code>{h}</code><br>ink <code>--on-accent</code></div></div>' for n,h in HUES)
def neutral(tok, hexv, note):
    return f'<div class="sw"><div class="sw__chip" style="background:var({tok});border:1px solid var(--line)"></div><div class="sw__meta"><b>{tok[2:]}</b><br><code>{hexv}</code><br><span>{note}</span></div></div>'
neutrals=''.join([neutral('--bg','#F7F5F0','the ground'),neutral('--bg-raised','#FFFFFF','cards'),neutral('--bg-sunken','#EFECE5','wells, empty photo frames'),neutral('--ink','#1B1916','headings, first paragraphs, the mark'),neutral('--ink-2','#514C45','body · 7.8:1'),neutral('--ink-3','#736D64','captions · 4.7:1'),neutral('--line','10% ink','hairlines')])
TINTS=['sky','gold','magenta','violet','orange','green','pink','yellow']
tints=''.join(f'<div class="card card--solid" data-accent="{a}" style="min-height:110px"><p class="t-small" style="font-weight:600">{a}</p></div>' for a in TINTS)
RING=['bow-tie-chairs','linda-laughing','cast-pose','floor-game','laugh-hat','cast-stage-small','three-men','duo-brick']
mini=''.join(f'<div class="ring__item"><figure class="photo photo--1x1 photo--circle">{pic(n,"80px")}</figure></div>' for n in RING)
BRIEF=[('01','The method','violet','kids-dancing'),('02','In the room','orange','two-lines'),('03','The idea','green','circle-hands'),('04','The founder','pink','linda-portrait')]
def briefcard(num,chip,acc,ph):
    return (f'<article class="brief" data-accent="{acc}"><div class="brief__head">'
            f'<p class="brief__chips"><span class="chip">{num}</span><span class="chip">{chip}</span></p>'
            f'<h3 class="brief__title">A title of two lines</h3>'
            f'<p class="brief__sum">Two lines of summary; the reader carries the rest.</p></div>'
            f'<div class="brief__figure"><figure class="photo photo--4x5">{pic(ph,"260px")}</figure>'
            f'<button class="brief__more" type="button">Read more<span class="brief__arrow" aria-hidden="true"><svg class="icon"><use href="#i-arrow-right"/></svg></span></button></div></article>')
briefs=''.join(briefcard(*b) for b in BRIEF)
bars=''.join(f'<div class="bar"><span>--sp-{n}</span><i style="width:var(--sp-{n})"></i><span>{v}</span></div>' for n,v in [(1,4),(2,8),(3,12),(4,16),(5,20),(6,24),(8,32),(10,40),(12,48),(16,64),(20,80),(24,96),(32,128),(40,160)])
motion=''.join(f'<div class="mo" data-dur="{k}"><button class="btn btn--secondary btn--compact" type="button" onclick="play(this)">Play</button><i></i><b>--dur-{k}</b> {v}</div>' for k,v in [('press','100ms · :active'),('state','160ms · hover, focus'),('state-out','240ms · leaving hover'),('move','280ms · position, the pile straightening'),('reveal','360ms · entering on scroll'),('enter','500ms · dialog, first paint')])

page=f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>DI Style Guide</title><meta name="color-scheme" content="light dark">
<link rel="icon" href="assets/logo/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="css/tokens.css?v={STAMP}"><link rel="stylesheet" href="css/base.css?v={STAMP}"><link rel="stylesheet" href="css/components.css?v={STAMP}"><link rel="stylesheet" href="css/home.css?v={STAMP}">
<style>
.sg {{ display:grid; grid-template-columns: 220px minmax(0,1fr); gap: var(--sp-12); padding-top: var(--sp-12); padding-bottom: var(--sp-24); }}
.sg__index {{ position: sticky; top: var(--sp-12); align-self: start; font-size: var(--fs-small); }}
.sg__index a {{ min-height: var(--hit); display:flex; align-items:center; color: var(--ink-2); }}
.sg__index a:hover {{ color: var(--ink); }}
.sg h2 {{ margin: var(--sp-16) 0 var(--sp-6); padding-top: var(--sp-8); border-top: 1px solid var(--line); }}
.sg h2:first-child {{ margin-top:0; border:0; padding-top:0; }}
.sg h3 {{ margin: var(--sp-8) 0 var(--sp-4); font-size: var(--fs-small); color: var(--ink-2); }}
.swatches {{ display:grid; grid-template-columns: repeat(auto-fill, minmax(230px,1fr)); gap: var(--sp-4); }}
.sw {{ display:flex; gap: var(--sp-3); align-items:center; }} .sw__chip {{ width:56px; height:56px; border-radius: var(--r-md); flex:none; }} .sw__chip--s {{ width:20px; height:56px; margin-left: calc(-1 * var(--sp-2)); border-radius: 0 var(--r-md) var(--r-md) 0; }} .sw__meta {{ font-size: var(--fs-caption); color: var(--ink-3); }} .sw__meta b {{ color: var(--ink); font-size: var(--fs-small); }}
code {{ font-family: ui-monospace, Menlo, monospace; font-size: .85em; color: var(--ink-2); }}
.trow {{ display:grid; grid-template-columns: 200px minmax(0,1fr); gap: var(--sp-6); align-items:center; padding: var(--sp-4) 0; border-bottom: 1px solid var(--line); }} .tmeta {{ font-size: var(--fs-caption); color: var(--ink-3); }} .tmeta b {{ color: var(--ink); font-size: var(--fs-small); }}
.bar {{ display:grid; grid-template-columns: 80px 1fr 40px; align-items:center; gap: var(--sp-3); font-size: var(--fs-caption); color: var(--ink-3); padding: var(--sp-1) 0; }} .bar i {{ height: 8px; background: var(--ink); border-radius: var(--r-full); display:block; }}
.rads {{ display:grid; grid-template-columns: repeat(4,1fr); gap: var(--sp-4); }} .rd {{ background: var(--bg-raised); border:1px solid var(--line); padding: var(--sp-6); font-size: var(--fs-caption); color: var(--ink-3); min-height: 120px; }} .rd b {{ color: var(--ink); }}
.mo {{ display:grid; grid-template-columns: 90px 1fr auto; align-items:center; gap: var(--sp-4); padding: var(--sp-2) 0; font-size: var(--fs-caption); color: var(--ink-3); }} .mo i {{ display:block; width: 24px; height:24px; border-radius: var(--r-md); background: var(--accent); transition: transform var(--d, 200ms) var(--ease-out); }} .mo.is-on i {{ transform: translateX(120px); }}
.row {{ display:flex; gap: var(--sp-3); flex-wrap: wrap; align-items:center; }}
.demo {{ background: var(--bg-raised); border:1px solid var(--line); border-radius: var(--r-lg); padding: var(--sp-6); }}
.mini-ring {{ --ring-r: 150; }} .mini-ring .ring__stage {{ height: 420px; margin: 0; }} .mini-ring .ring__item {{ width: 80px; margin-left: -40px; margin-top: -48px; }} .mini-ring .ring__item .photo--tilt {{ width: 66px; margin: 7px; }}
.mini-strip .strip__nav {{ justify-content: flex-end; }} .mini-strip .strip__card {{ width: 180px; }}
.shape-row {{ display: flex; gap: var(--sp-8); align-items: center; }}
.briefs__row .brief {{ grid-column: span 3; }} @media (max-width: 900px) {{ .briefs__row .brief {{ grid-column: span 6; }} }}
.flow {{ display:grid; grid-template-columns: 160px 1fr; gap: var(--sp-2) var(--sp-6); font-size: var(--fs-small); color: var(--ink-2); }} .flow b {{ color: var(--ink); font-weight: 600; }}
</style></head><body>
<script>(function(){{var t=null;try{{t=localStorage.getItem('di:theme')}}catch(e){{}}var h=document.documentElement;h.dataset.theme=t==='light'?'light':'dark';h.classList.add('js')}})()</script>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><symbol id="mark" viewBox="0 0 787 842">{whitemark}</symbol></svg>
{sprite}
<main class="container sg">
<nav class="sg__index" aria-label="Style guide"><a href="#colour">Colour</a><a href="#type">Type</a><a href="#space">Space</a><a href="#radius">Corners</a><a href="#motion">Motion</a><a href="#buttons">Buttons</a><a href="#shapes">Shapes</a><a href="#cards">Cards</a><a href="#photos">Photos</a><a href="#orbit">Photographs in motion</a><a href="#briefs">The four cards</a><a href="#pile">Testimonials</a><a href="#fields">Fields</a><a href="#nav">Header &amp; footer</a></nav>
<div>
<h2 class="t-h2" id="colour">Colour</h2>
<p class="t-body">The palette is the logo, read literally, at full strength. The monogram is <b>sky</b>, the star is <b>gold</b>, and six arcs ring them: clockwise from the top, magenta, violet, orange, green, pink, yellow. Eight colours, each spent exactly once down the page, in that order.</p>
<div class="demo row"><button class="theme" type="button" data-theme-toggle aria-label="Switch to dark mode"><svg class="icon icon--moon" aria-hidden="true"><use href="#i-moon"/></svg><svg class="icon icon--sun" aria-hidden="true"><use href="#i-sun"/></svg></button><span class="t-caption">the toggle in the header · the choice is kept and applied before first paint</span></div>
<h3>The eight, with the ink each one takes</h3><div class="swatches">{hues}</div>
<h3>Neutrals</h3><div class="swatches">{neutrals}</div>
<h3>Surfaces · full strength, never a mix</h3>
<p class="t-body">A hue reaches the page at 100% or not at all. Mixing one into the ground was built twice and rejected: a pastel is no longer the brand colour, and it shifts again between the themes. Every text tier on a solid surface goes to <code>--on-accent</code> — a translucent tier over a saturated hue reads as dirt, not as hierarchy.</p>
<div class="swatches" style="grid-template-columns:repeat(auto-fill,minmax(170px,1fr))">{tints}</div>
<h3>The one field</h3>
<p class="t-body">The closing block is sky at full strength. Its background does not follow the theme, so its ink tokens are rebound for that subtree and every component inside it stays correct in both.</p>
<div class="demo" style="background:var(--c-sky);--ink:#1B1916;--ink-2:rgba(27,25,22,.8);color:var(--ink);border-radius:var(--r-xl)"><p class="t-h3">Sign Up for our Newsletter!</p><p class="t-body" style="margin-top:var(--sp-2)">Warm black on sky: 9.6:1.</p></div>
<h2 class="t-h2" id="type">Type</h2>
<p class="t-body">Two faces that share a geometry. Sen — 800 for the display, 700 for titles — carries every heading; Plus Jakarta Sans, 400 and 600, carries everything else. Sen ships as one variable latin file, 18KB for every weight. Tracking tightens as size grows; leading loosens as it shrinks. Measures are in <code>em</code>, never <code>ch</code>.</p>
<div class="trow"><div class="tmeta"><b>display</b><br><span>hero title · Sen 800</span><br><code>.t-display</code></div><div class="t-display" style="max-width:none">New tools for cognitive development</div></div>
<div class="trow"><div class="tmeta"><b>h2</b><br><span>section titles · Sen 700</span><br><code>.t-h2</code></div><div class="t-h2" style="max-width:none">Safe, educational, and thrilling</div></div>
<div class="trow"><div class="tmeta"><b>h3</b><br><span>card titles · Sen 700</span><br><code>.t-h3</code></div><div class="t-h3">Creativity in motion creates knowledge!</div></div>
<div class="trow"><div class="tmeta"><b>lead</b><br><span>subtitle, quotes · Jakarta 400</span><br><code>.t-lead</code></div><div class="t-lead">Pre-wiring the brain &amp; educating the heart</div></div>
<div class="trow"><div class="tmeta"><b>body</b><br><span>paragraphs · Jakarta 400</span><br><code>.t-body</code></div><div class="t-body">Developmental Improvisation is a new, revolutionary tool for teaching cognitive development and social/emotional understanding using the art of improvisation designed specifically for the classroom.</div></div>
<div class="trow"><div class="tmeta"><b>label</b><br><span>section labels · Jakarta 600, uppercase</span><br><code>.label</code></div><div class="label">Testimonials</div></div>
<div class="trow"><div class="tmeta"><b>caption</b><br><span>captions, © · 400</span><br><code>.t-caption</code></div><div class="t-caption">© 2026 Developmental Improvisation</div></div>
<h2 class="t-h2" id="space">Space</h2>
<p class="t-body">A 4px grid. Sections are <code>--section-y</code> (96px at 1440) top and bottom and open with a hairline on the column.</p>
{bars}
<h2 class="t-h2" id="radius">Corners</h2>
<p class="t-body">Every corner is a <b>superellipse</b>, not a circular arc: <code>corner-shape: squircle</code> beside the radius, one declaration on <code>*</code>. An arc meets the straight edge with a curvature break you can see at large radii; a superellipse does not. Anything meant to be a circle opts back out with <code>corner-shape: round</code>, because the property applies to a 50% radius too.</p>
<div class="rads"><div class="rd" style="border-radius:var(--r-xl)"><b>--r-xl</b><br>36 · the cards, the dialogs, the closing field</div><div class="rd" style="border-radius:var(--r-lg)"><b>--r-lg</b><br>28 · cards, photographs</div><div class="rd" style="border-radius:var(--r-md)"><b>--r-md</b><br>20 · small tiles</div><div class="rd" style="border-radius:var(--r-sm)"><b>--r-sm</b><br>14 · buttons, inputs</div></div>
<div class="row" style="margin-top:var(--sp-4)"><div class="rd" style="width:120px;height:120px;border-radius:36px;background:var(--ink);min-height:0"></div><div class="rd" style="width:120px;height:120px;border-radius:36px;corner-shape:round;background:var(--bg-sunken);min-height:0"></div><span class="t-caption">left: squircle · right: the same 36px radius as a plain arc</span></div>
<h2 class="t-h2" id="motion">Motion</h2>
<p class="t-body">Two kinds. Things that <em>happen</em> take a rung of the ladder below. Things that <em>slide, turn or stack</em> are driven by the scroll through one shared value, the flow, and have no duration: the hero's bento and the ring. Under reduced motion the flow's drift and scroll coupling are zero and reveals become short fades.</p>
{motion}
<h3>The flow</h3>
<div class="flow"><b>--flow-drift</b><span>3.75°/s at rest · one revolution of the ring in 96s</span><b>--flow-scroll</b><span>0.06° per pixel scrolled, in the scroll's direction</span><b>--flow-settle</b><span>0.32s · the time constant of the easing that follows the scroll</span><b>--bento-px</b><span>5 · the hero's columns move 5px per degree, adjacent columns opposed, at three speeds</span><b>hover</b><span>a photograph under the pointer eases the drift to a stop in about 0.5s; leaving the orbit eases it back</span></div>
<h2 class="t-h2" id="buttons">Buttons</h2>
<div class="demo row"><button class="btn btn--primary">Primary</button><button class="btn btn--secondary">Secondary</button><button class="btn btn--ghost">Ghost</button><button class="btn btn--secondary btn--compact">Compact</button><button class="btn btn--primary" aria-busy="true">Loading</button><button class="btn btn--primary is-done" disabled><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Subscribed</button></div>
<div class="demo row" style="margin-top:var(--sp-4)"><div class="arrows"><button class="arrow" type="button" aria-label="Previous"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg></button><button class="arrow" type="button" aria-label="Next"><svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></button></div><span class="t-caption">the lightbox's arrows</span></div>
<h2 class="t-h2" id="shapes">Shapes</h2>
<p class="t-body">Two, and only two. Every photograph on the page is a <b>4:5 rectangle</b> with the same superellipse corner — hero, cards, the reader. The <b>circle</b> is the single exception and it belongs to the quote ring. Four shapes were tried and rejected.</p>
<div class="row"><figure class="photo photo--4x5 photo--hover" style="width:180px">{pic('kids-dancing')}</figure><figure class="photo photo--1x1 photo--circle" style="width:180px">{pic('cast-pose')}</figure></div>
<h2 class="t-h2" id="cards">Cards</h2>
<div class="row"><div class="card card--line" style="flex:1 1 240px;min-height:180px"><p class="t-h3">Card</p><p class="t-body">The raised ground with an inset hairline, --r-lg.</p></div><div class="card card--solid" data-accent="orange" style="flex:1 1 240px;min-height:180px"><p class="t-h3">Solid card</p><p class="t-body">The testimonials. Every tier of ink is --on-accent.</p></div></div>
<h2 class="t-h2" id="photos">Photos</h2>
<p class="t-body">One ratio, one corner, no frames, no outlines. Every photograph on the page is a button that opens it in the lightbox: one at a time on the ink scrim, arrows and keys through the whole set, Esc or the scrim to close, focus back on the photograph. AVIF/WebP/JPEG at 160/320/480/960, 1440 in the lightbox.</p>
<div class="row"><figure class="photo photo--4x5 photo--hover" style="width:180px">{pic('kids-dancing')}</figure><figure class="photo photo--4x5" style="width:180px">{pic('two-lines')}</figure><figure class="photo photo--1x1 photo--circle" style="width:180px">{pic('circle-hands')}</figure></div>
<h2 class="t-h2" id="orbit">Photographs in motion</h2>
<p class="t-body">Two things carry the photographs, on one shared angle. <b>The hero's bento</b>: three columns of 4:5 photographs looping vertically inside a colour panel that clips them, adjacent columns opposed, at three speeds. <b>The ring</b> (the quote): eight circles on a circle, upright, turning with the flow; hover one to stop it.</p>
<div class="demo ring mini-ring" style="margin-top:var(--sp-4);padding:0"><div class="ring__stage"><div class="ring__orbit">{mini}</div><div class="ring__centre"><p class="ring__text" style="font-size:var(--fs-h3)">“Creativity in motion creates knowledge!”</p></div></div></div>
<h2 class="t-h2" id="briefs">The four cards</h2>
<p class="t-body">One row of the field: four identical objects, three columns each. The head carries two chips, the title and a two-line summary; the photograph sits under it and <b>slips --slip 20px up over it</b>. The card is quiet at rest and <b>the whole card fills with its hue under the pointer and on keyboard focus</b> — hover one — the control arrives with it, and the reader opens on that same hue. Where there is no hover (a touch screen) the hue is the resting state.</p>
<div class="grid briefs__row" style="margin-top:var(--sp-4)">{briefs}</div>
<h2 class="t-h2" id="pile">Testimonials</h2>
<p class="t-body">Three cards, each a full-strength hue: the quote mark, the quote, and the person in a nested white card that overhangs the bottom-left corner. One column on a phone.</p>
<h2 class="t-h2" id="fields">Fields</h2>
<div class="demo"><form data-newsletter action="[NEWSLETTER_ACTION_URL]" method="post" novalidate style="max-width:520px"><div class="field"><label class="sr-only" for="sg-email">Email</label><input class="input" id="sg-email" type="email" name="email" placeholder="Email" autocomplete="email" required><button class="btn btn--primary" type="submit">Subscribe</button></div><p class="field__message" aria-live="polite"></p></form></div>
<h2 class="t-h2" id="nav">Header &amp; footer</h2>
<p class="t-body">See <a href="index.html" style="text-decoration:underline">index.html</a>: the header has no container at all — the wordmark on the left, the links, the theme toggle and Subscribe on the right, directly on the page at the field's gutter. On a laptop it scrolls away with the page; on a phone it stays, and takes the ground at 78% with a hairline once there is something under it. There is no Home link (the logo is the way home) and no Gallery link (the gallery is the hero). The foot of the page is one sky field holding the sign-up, the two contact links and the copyright.</p>
<div class="demo" style="padding:0"><div class="nav__brand" style="padding:var(--sp-6);height:auto">{logo}<span class="word">Developmental Improvisation</span></div></div>
</div></main>
<script>function play(b){{const m=b.parentElement;m.style.setProperty('--d',getComputedStyle(document.documentElement).getPropertyValue('--dur-'+m.dataset.dur));m.classList.toggle('is-on');}}</script>
<script src="js/main.js?v={STAMP}" defer></script>
</body></html>
'''
open(f'{root}/styleguide.html','w').write(page)
print('styleguide.html', len(page)//1024, 'KB')
