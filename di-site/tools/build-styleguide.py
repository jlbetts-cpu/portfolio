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

HUES=[('green','#51E596'),('sky','#58CDFC'),('violet','#7358FC'),('magenta','#E744E2'),('orange','#F0895B'),('pink','#FB9BC9'),('yellow','#FEE79B')]
hues=''.join(f'<div class="sw"><div class="sw__chip" style="background:var(--c-{n})"></div><div class="sw__chip sw__chip--s" style="background:color-mix(in oklab, var(--c-{n}) var(--tint-mix), var(--bg-raised))"></div><div class="sw__meta"><b>{n}</b> <code>{h}</code><br>tint <code>--tint-mix</code></div></div>' for n,h in HUES)
def neutral(tok, hexv, note):
    return f'<div class="sw"><div class="sw__chip" style="background:var({tok});border:1px solid var(--line)"></div><div class="sw__meta"><b>{tok[2:]}</b><br><code>{hexv}</code><br><span>{note}</span></div></div>'
neutrals=''.join([neutral('--bg','#F7F5F0','the ground'),neutral('--bg-raised','#FFFFFF','cards'),neutral('--bg-sunken','#EFECE5','wells, empty photo frames'),neutral('--ink','#1B1916','headings, first paragraphs, the mark'),neutral('--ink-2','#514C45','body · 7.8:1'),neutral('--ink-3','#736D64','captions · 4.7:1'),neutral('--line','10% ink','hairlines')])
TINTS=['sky','green','yellow','violet','orange','pink','magenta']
tints=''.join(f'<div class="card card--tint" data-accent="{a}" style="min-height:140px"><p class="t-small" style="font-weight:600">{a}</p></div>' for a in TINTS)
RING=[('bow-tie-chairs','round'),('linda-laughing','tilt'),('cast-pose','circle'),('floor-game','round'),('laugh-hat','tilt'),('cast-stage-small','circle'),('three-men','round'),('duo-brick','tilt')]
mini=''.join(f'<div class="ring__item"><figure class="photo photo--1x1 photo--{shape}">{pic(n,"80px")}</figure></div>' for n,shape in RING)
STRIP=['yellow-trousers','three-men','circle-hands','boy-fist','blue-shirts','laugh-hat']
strip=''.join(f'<figure class="photo photo--4x5 strip__card">{pic(n,"180px")}</figure>' for n in STRIP)*2
def stackcard(acc,title):
    return f'<article class="stack__card card card--tint" data-accent="{acc}" style="position:static;min-height:0;grid-template-columns:1fr"><div><h3 class="stack__title" style="font-size:var(--fs-h3)">{title}</h3><p class="t-body">One hue, flat, mixed into the raised ground. One photograph, in one shape, centred in the other column; even cards put it on the left.</p></div></article>'
stack=''.join(stackcard(a,t) for a,t in [('sky','Sky'),('green','Green'),('yellow','Yellow'),('violet','Violet')])
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
.bar {{ display:grid; grid-template-columns: 80px 1fr 40px; align-items:center; gap: var(--sp-3); font-size: var(--fs-caption); color: var(--ink-3); padding: var(--sp-1) 0; }} .bar i {{ height: 8px; background: var(--accent); border-radius: var(--r-full); display:block; }}
.rads {{ display:grid; grid-template-columns: repeat(4,1fr); gap: var(--sp-4); }} .rd {{ background: var(--bg-raised); border:1px solid var(--line); padding: var(--sp-6); font-size: var(--fs-caption); color: var(--ink-3); min-height: 120px; }} .rd b {{ color: var(--ink); }}
.mo {{ display:grid; grid-template-columns: 90px 1fr auto; align-items:center; gap: var(--sp-4); padding: var(--sp-2) 0; font-size: var(--fs-caption); color: var(--ink-3); }} .mo i {{ display:block; width: 24px; height:24px; border-radius: var(--r-md); background: var(--accent); transition: transform var(--d, 200ms) var(--ease-out); }} .mo.is-on i {{ transform: translateX(120px); }}
.row {{ display:flex; gap: var(--sp-3); flex-wrap: wrap; align-items:center; }}
.demo {{ background: var(--bg-raised); border:1px solid var(--line); border-radius: var(--r-lg); padding: var(--sp-6); }}
.mini-ring {{ --ring-r: 150; }} .mini-ring .ring__stage {{ height: 420px; margin: 0; }} .mini-ring .ring__item {{ width: 80px; margin-left: -40px; margin-top: -48px; }} .mini-ring .ring__item .photo--tilt {{ width: 66px; margin: 7px; }}
.mini-strip .strip__nav {{ justify-content: flex-end; }} .mini-strip .strip__card {{ width: 180px; }}
.shape-row {{ display: flex; gap: var(--sp-8); align-items: center; }}
.stack .stack__card + .stack__card {{ margin-top: var(--sp-6); }}
.flow {{ display:grid; grid-template-columns: 160px 1fr; gap: var(--sp-2) var(--sp-6); font-size: var(--fs-small); color: var(--ink-2); }} .flow b {{ color: var(--ink); font-weight: 600; }}
</style></head><body>
<script>(function(){{var t=null;try{{t=localStorage.getItem('di:theme')}}catch(e){{}}var h=document.documentElement;h.dataset.theme=t==='dark'?'dark':'light';h.classList.add('js')}})()</script>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><symbol id="mark" viewBox="0 0 787 842">{whitemark}</symbol></svg>
{sprite}
<main class="container sg">
<nav class="sg__index" aria-label="Style guide"><a href="#colour">Colour</a><a href="#type">Type</a><a href="#space">Space</a><a href="#radius">Radius</a><a href="#motion">Motion</a><a href="#buttons">Buttons</a><a href="#shapes">Shapes</a><a href="#cards">Cards</a><a href="#photos">Photos</a><a href="#orbit">Photographs in motion</a><a href="#stack">Stacked cards</a><a href="#pile">Testimonials</a><a href="#fields">Fields</a><a href="#nav">Header &amp; footer</a></nav>
<div>
<h2 class="t-h2" id="colour">Colour</h2>
<p class="t-body">Two themes, one palette. A warm off-white ground and a warm black ink in light; the same hues over a warm near-black in dark. Colour is flat — never a gradient — and appears in exactly three places: the photographs, a tinted card, and the footer module. A hue is mixed into the raised ground at <code>--tint-mix</code> (22% in light, 30% in dark), on the element that carries <code>data-accent</code>.</p>
<div class="demo row"><button class="theme" type="button" data-theme-toggle aria-label="Switch to dark mode"><svg class="icon icon--moon" aria-hidden="true"><use href="#i-moon"/></svg><svg class="icon icon--sun" aria-hidden="true"><use href="#i-sun"/></svg></button><span class="t-caption">the toggle in the header · the choice is kept and read before first paint</span></div>
<h3>Brand hues · the hue, then the same hue as a tint</h3><div class="swatches">{hues}</div>
<h3>Neutrals</h3><div class="swatches">{neutrals}</div>
<h3>Tinted cards</h3>
<p class="t-body">The stacked cards, the testimonials, the newsletter and the popup. Ink stays ink on every one of them, in both themes.</p>
<div class="swatches" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">{tints}</div>
<h2 class="t-h2" id="type">Type</h2>
<p class="t-body">Two faces that share a geometry. Sen — 800 for the display, 700 for titles — carries every heading; Plus Jakarta Sans, 400 and 600, carries everything else. Sen ships as one variable latin file, 18KB for every weight. Tracking tightens as size grows; leading loosens as it shrinks. Measures are in <code>em</code>, never <code>ch</code>.</p>
<div class="trow"><div class="tmeta"><b>display</b><br><span>hero title · Sen 800</span><br><code>.t-display</code></div><div class="t-display" style="max-width:none">New tools for cognitive development</div></div>
<div class="trow"><div class="tmeta"><b>h2</b><br><span>section titles · Sen 700</span><br><code>.t-h2</code></div><div class="t-h2" style="max-width:none">Safe, educational, and thrilling</div></div>
<div class="trow"><div class="tmeta"><b>h3</b><br><span>card titles · Sen 700</span><br><code>.t-h3</code></div><div class="t-h3">Creativity in motion creates knowledge!</div></div>
<div class="trow"><div class="tmeta"><b>lead</b><br><span>subtitle, quotes · Jakarta 400</span><br><code>.t-lead</code></div><div class="t-lead">Pre-wiring the brain &amp; educating the heart</div></div>
<div class="trow"><div class="tmeta"><b>body</b><br><span>paragraphs · Jakarta 400</span><br><code>.t-body</code></div><div class="t-body">Developmental Improvisation is a new, revolutionary tool for teaching cognitive development and social/emotional understanding using the art of improvisation designed specifically for the classroom.</div></div>
<div class="trow"><div class="tmeta"><b>label</b><br><span>section labels · Jakarta 600, uppercase</span><br><code>.section__label</code></div><div class="section__label" style="margin:0">Gallery</div></div>
<div class="trow"><div class="tmeta"><b>caption</b><br><span>captions, © · 400</span><br><code>.t-caption</code></div><div class="t-caption">© 2026 Developmental Improvisation</div></div>
<h2 class="t-h2" id="space">Space</h2>
<p class="t-body">A 4px grid. Sections are <code>--section-y</code> (96px at 1440) top and bottom and open with a hairline on the column.</p>
{bars}
<h2 class="t-h2" id="radius">Radius</h2><div class="rads"><div class="rd" style="border-radius:var(--r-xl)"><b>--r-xl</b><br>28 · stacked cards, popup, newsletter</div><div class="rd" style="border-radius:var(--r-lg)"><b>--r-lg</b><br>20 · cards, photos</div><div class="rd" style="border-radius:var(--r-md)"><b>--r-md</b><br>14 · buttons, inputs</div><div class="rd" style="border-radius:var(--r-full)"><b>--r-full</b><br>the capsule, avatars</div></div>
<h2 class="t-h2" id="motion">Motion</h2>
<p class="t-body">Two kinds. Things that <em>happen</em> take a rung of the ladder below. Things that <em>slide, turn or stack</em> are driven by the scroll through one shared value, the flow, and have no duration: the strip, the ring, the stacked cards. Under reduced motion the flow's drift and scroll coupling are zero and reveals become short fades.</p>
{motion}
<h3>The flow</h3>
<div class="flow"><b>--flow-drift</b><span>3.75°/s at rest · one revolution of the ring in 96s</span><b>--flow-scroll</b><span>0.06° per pixel scrolled, in the scroll's direction</span><b>--flow-settle</b><span>0.32s · the time constant of the easing that follows the scroll</span><b>--strip-px</b><span>6 · the gallery moves 6px per degree: 22px/s at rest, one card every 15s</span><b>hover</b><span>a photograph under the pointer eases the drift to a stop in about 0.5s; leaving eases it back</span><b>the stack</b><span>a covered card scales from its top edge by 4.5% per card above it, in step with the scroll</span></div>
<h2 class="t-h2" id="buttons">Buttons</h2>
<div class="demo row"><button class="btn btn--primary">Primary</button><button class="btn btn--secondary">Secondary</button><button class="btn btn--ghost">Ghost</button><button class="btn btn--secondary btn--compact">Compact</button><button class="btn btn--primary" aria-busy="true">Loading</button><button class="btn btn--primary is-done" disabled><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Subscribed</button></div>
<div class="demo row" style="margin-top:var(--sp-4)"><div class="arrows"><button class="arrow" type="button" aria-label="Previous"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg></button><button class="arrow" type="button" aria-label="Next"><svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></button></div><span class="t-caption">the strip's arrows</span></div>
<h2 class="t-h2" id="shapes">Shapes</h2>
<p class="t-body">One vocabulary of four, used everywhere a photograph appears out of a rectangle: the capsule, the circle, the rounded square (a 28–30% radius) and the same square turned 45°. The headline sets four of them on the line, at <code>clamp(44px, 5.1vw, 74px)</code> tall so the smallest is still a tap target; the ring and the stacked cards use the same four larger.</p>
<div class="demo"><h1 class="hero__title" style="font-size:var(--fs-h3);max-width:none;line-height:1.6">New tools <span class="hero__shape hero__shape--pill" style="height:44px">{pic('yellow-trousers','44px')}</span> for cognitive <span class="hero__shape hero__shape--circle" style="height:44px">{pic('boy-fist','44px')}</span> development</h1></div>
<h2 class="t-h2" id="cards">Cards</h2>
<div class="row"><div class="card" style="flex:1 1 240px;min-height:180px"><p class="t-h3">Card</p><p class="t-body">The raised ground, a hairline, --r-lg.</p></div><div class="card card--tint" data-accent="orange" style="flex:1 1 240px;min-height:180px"><p class="t-h3">Tinted card</p><p class="t-body">The stacked cards, the testimonials, the newsletter, the popup.</p></div></div>
<h2 class="t-h2" id="photos">Photos</h2>
<p class="t-body">Rectangles for the gallery; the four shapes everywhere else. No frames, no outlines. Every photograph on the page is a button that opens it in the lightbox: one at a time on the ink scrim, arrows and keys through the whole set, Esc or the scrim to close, focus back on the photograph.</p>
<div class="row"><figure class="photo photo--4x5 photo--hover" style="width:180px">{pic('kids-dancing')}</figure><figure class="photo photo--1x1 photo--round" style="width:180px">{pic('cast-pose')}</figure><figure class="photo photo--1x1 photo--tilt" style="width:150px;margin:15px">{pic('laugh-hat')}</figure><figure class="photo photo--1x1 photo--circle" style="width:180px">{pic('circle-hands')}</figure><figure class="photo photo--4x5 photo--pill" style="width:144px">{pic('two-lines')}</figure></div>
<h2 class="t-h2" id="orbit">Photographs in motion</h2>
<p class="t-body">Two things carry the photographs. <b>The gallery</b>: one loop of 4:5 photographs on a track that runs edge to edge, moved by the flow at 6px per degree, the arrows step one card, it can be dragged. <b>The ring</b> (the quote): eight shaped photographs on a circle, upright, turning with the flow; hover one to stop it.</p>
<div class="demo mini-strip"><div class="strip"><div class="strip__nav" style="justify-content:flex-end;margin-bottom:var(--sp-4)"><div class="arrows"><button class="arrow" type="button" data-strip-prev aria-label="Previous"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg></button><button class="arrow" type="button" data-strip-next aria-label="Next"><svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></button></div></div><div class="strip__viewport"><div class="strip__track" data-strip>{strip}</div></div></div></div>
<div class="demo ring mini-ring" style="margin-top:var(--sp-4);padding:0"><div class="ring__stage"><div class="ring__orbit">{mini}</div><div class="ring__centre"><p class="ring__text" style="font-size:var(--fs-h3)">“Creativity in motion creates knowledge!”</p></div></div></div>
<h2 class="t-h2" id="stack">Stacked cards</h2>
<div class="stack">{stack}</div>
<h2 class="t-h2" id="pile">Testimonials</h2>
<p class="t-body">Three tinted cards on a grid, the middle one a step lower. One column on a phone.</p>
<h2 class="t-h2" id="fields">Fields</h2>
<div class="demo"><form data-newsletter action="[NEWSLETTER_ACTION_URL]" method="post" novalidate style="max-width:520px"><div class="field"><label class="sr-only" for="sg-email">Email</label><input class="input" id="sg-email" type="email" name="email" placeholder="Email" autocomplete="email" required><button class="btn btn--primary" type="submit">Subscribe</button></div><p class="field__message" aria-live="polite"></p></form></div>
<h2 class="t-h2" id="nav">Header &amp; footer</h2>
<p class="t-body">See <a href="index.html" style="text-decoration:underline">index.html</a>: the header is transparent on the ground and becomes glass with a hairline once scrolled — the colour logo and the wordmark on the left, the links, the theme toggle and Subscribe on the right. The footer is one coloured module: the logo, a contact column, and the copyright under a hairline.</p>
<div class="demo" style="padding:0"><div class="nav__brand" style="padding:var(--sp-6);height:auto">{logo}<span class="word">Developmental Improvisation</span></div></div>
</div></main>
<script>function play(b){{const m=b.parentElement;m.style.setProperty('--d',getComputedStyle(document.documentElement).getPropertyValue('--dur-'+m.dataset.dur));m.classList.toggle('is-on');}}</script>
<script src="js/main.js?v={STAMP}" defer></script>
</body></html>
'''
open(f'{root}/styleguide.html','w').write(page)
print('styleguide.html', len(page)//1024, 'KB')
