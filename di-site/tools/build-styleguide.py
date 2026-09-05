# Generates styleguide.html: every token and component in both themes. Dev tool; the output is committed.
import json, re, datetime
root='/home/user/portfolio/di-site'
man=json.load(open(f'{root}/images/manifest.json'))
sprite=open(f'{root}/assets/icons.svg').read().strip()
star=re.search(r'<path[^>]*/>',open(f'{root}/assets/illustrations/star.svg').read()).group(0)
whitemark=''.join(re.findall(r'<path[^>]*/>',open(f'{root}/assets/logo/dilogo.svg').read())).replace('fill="white"','fill="currentColor"')
logo=open(f'{root}/assets/logo/inline-logo.html').read().strip().replace(' role="img" aria-labelledby="logoTitle"><title id="logoTitle">Developmental Improvisation</title>',' aria-hidden="true">')
STAMP=datetime.date.today().strftime('%Y%m%d')

def pic(name, sizes='200px'):
    m=man[name]; av=', '.join(f'images/{name}-{w}.avif {w}w' for w in m['sizes']); wp=', '.join(f'images/{name}-{w}.webp {w}w' for w in m['sizes'])
    return f'<picture><source type="image/avif" srcset="{av}" sizes="{sizes}"><source type="image/webp" srcset="{wp}" sizes="{sizes}"><img src="images/{m["jpeg"]}" width="{m["width"]}" height="{m["height"]}" alt="" loading="lazy" decoding="async"></picture>'

HUES=[('green','#51E596','#1F9A5E','10.7'),('sky','#58CDFC','#1A8BC6','9.6'),('violet','#7358FC','#5A45D9','white 4.6'),('magenta','#E744E2','#B72FB3','5.2'),('orange','#F0895B','#C8552A','6.9'),('pink','#FB9BC9','#D14E8E','8.7'),('yellow','#FEE79B','#A67D08','14.1')]
hues=''.join(f'<div class="sw"><div class="sw__chip" style="background:var(--c-{n})"></div><div class="sw__chip sw__chip--s" style="background:var(--m-{n})"></div><div class="sw__meta"><b>{n}</b> <code>{h}</code> · mark <code>{m}</code><br><span>dark ink {c}:1</span></div></div>' for n,h,m,c in HUES)
def neutral(tok, light, dark, note):
    return f'<div class="sw"><div class="sw__chip" style="background:var({tok});border:1px solid var(--line)"></div><div class="sw__meta"><b>{tok[2:]}</b><br><code>{light}</code> · dark <code>{dark}</code><br><span>{note}</span></div></div>'
neutrals=''.join([neutral('--bg','#F7F5F0','#131211','the ground'),neutral('--bg-raised','#FFFFFF','#1C1A18','cards'),neutral('--bg-sunken','#EFECE5','#0E0D0C','wells, empty photo frames'),neutral('--ink','#1B1916','#F4F1EB','headings, first paragraphs'),neutral('--ink-2','#514C45','74% ink','body · 7.8:1 / 9.8:1'),neutral('--ink-3','#736D64','56% ink','captions · 4.7:1 / 5.8:1'),neutral('--line','10% ink','10% ink','hairlines'),neutral('--nav-bg','#1B1916','#1B1916','the header, both themes')])
FRAMES=['sky','green','yellow','pink','orange','violet','magenta']*2
ORBIT=['yellow-trousers','bow-tie-chairs','circle-hands','blue-shirts','laugh-hat','conga-line','linda-portrait','boy-fist','floor-game','three-teens','row-linked-arms','scene-handshake','linda-stage','three-men']
mini=''.join(f'<div class="orbit__item" style="--i:{i}"><div class="orbit__card" style="--c:var(--c-{FRAMES[i]})"><div class="orbit__photo">{pic(n,"90px")}</div></div></div>' for i,n in enumerate(ORBIT))
def stackcard(num,acc,title):
    return f'<article class="stack__card card card--accent" data-accent="{acc}" data-surface="accent" style="position:static;min-height:0;grid-template-columns:1fr"><div><span class="stack__num">({num})</span><h3 class="stack__title" style="font-size:var(--fs-h3)">{title}</h3><p class="t-body">Ink, ink-2 and ink-3 flip to dark on every hue but violet, which takes white.</p><div class="stack__extra"><div class="chips"><span class="chip">chip</span></div></div></div></article>'
stack=''.join(stackcard(f'0{i+1}',a,t) for i,(a,t) in enumerate([('sky','Sky'),('green','Green'),('yellow','Yellow'),('violet','Violet'),('orange','Orange')]))
bars=''.join(f'<div class="bar"><span>--sp-{n}</span><i style="width:var(--sp-{n})"></i><span>{v}</span></div>' for n,v in [(1,4),(2,8),(3,12),(4,16),(5,20),(6,24),(8,32),(10,40),(12,48),(16,64),(20,80),(24,96),(32,128),(40,160)])
motion=''.join(f'<div class="mo" data-dur="{k}"><button class="btn btn--secondary btn--compact" type="button" onclick="play(this)">Play</button><i></i><b>--dur-{k}</b> {v}</div>' for k,v in [('press','100ms · :active'),('state','160ms · hover, focus'),('state-out','240ms · leaving hover, theme'),('move','280ms · position, the pile straightening'),('reveal','360ms · entering on scroll'),('enter','500ms · dialog, first paint')])

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
.bar {{ display:grid; grid-template-columns: 80px 1fr 40px; align-items:center; gap: var(--sp-3); font-size: var(--fs-caption); color: var(--ink-3); padding: var(--sp-1) 0; }} .bar i {{ height: 8px; background: var(--accent-mark); border-radius: var(--r-full); display:block; }}
.rads {{ display:grid; grid-template-columns: repeat(4,1fr); gap: var(--sp-4); }} .rd {{ background: var(--bg-raised); border:1px solid var(--line); padding: var(--sp-6); font-size: var(--fs-caption); color: var(--ink-3); min-height: 120px; }} .rd b {{ color: var(--ink); }}
.mo {{ display:grid; grid-template-columns: 90px 1fr auto; align-items:center; gap: var(--sp-4); padding: var(--sp-2) 0; font-size: var(--fs-caption); color: var(--ink-3); }} .mo i {{ display:block; width: 24px; height:24px; border-radius: var(--r-md); background: var(--accent); transition: transform var(--d, 200ms) var(--ease-out); }} .mo.is-on i {{ transform: translateX(120px); }}
.row {{ display:flex; gap: var(--sp-3); flex-wrap: wrap; align-items:center; }}
.demo {{ background: var(--bg-raised); border:1px solid var(--line); border-radius: var(--r-lg); padding: var(--sp-6); }}
.demo--ink {{ border-radius: var(--r-lg); padding: var(--sp-6); }}
.mini-orbit {{ position:relative; height: 260px; overflow:hidden; margin-top: 0; --r: 220px; --cw: 90px; --n: 14; --k: .4; --fade-a: 80; --fade-b: 92; }} .mini-orbit .orbit__ring {{ top: 300px; }}
.stack .stack__card + .stack__card {{ margin-top: var(--sp-6); }}
.sg-theme {{ position: fixed; right: var(--sp-6); bottom: var(--sp-6); z-index: 10; background: var(--bg-raised); border: 1px solid var(--line); }}
.flow {{ display:grid; grid-template-columns: 160px 1fr; gap: var(--sp-2) var(--sp-6); font-size: var(--fs-small); color: var(--ink-2); }} .flow b {{ color: var(--ink); font-weight: 600; }}
</style></head><body>
<script>(function(){{var t=null;try{{t=localStorage.getItem('di:theme')}}catch(e){{}}var h=document.documentElement;h.dataset.theme=t==='dark'?'dark':'light';h.classList.add('js')}})()</script>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><symbol id="star" viewBox="489.5 285 57.8 66">{star}</symbol><symbol id="mark" viewBox="0 0 787 842">{whitemark}</symbol></svg>
{sprite}
<button class="theme sg-theme" type="button" data-theme-toggle aria-label="Switch to dark mode"><svg class="icon icon--moon" aria-hidden="true"><use href="#i-moon"/></svg><svg class="icon icon--sun" aria-hidden="true"><use href="#i-sun"/></svg></button>
<main class="container sg">
<nav class="sg__index" aria-label="Style guide"><a href="#colour">Colour</a><a href="#type">Type</a><a href="#space">Space</a><a href="#radius">Radius</a><a href="#motion">Motion</a><a href="#buttons">Buttons</a><a href="#chips">Chips &amp; stars</a><a href="#cards">Cards</a><a href="#photos">Photos</a><a href="#orbit">Orbit</a><a href="#stack">Stacked cards</a><a href="#pile">Pile</a><a href="#fields">Fields</a><a href="#nav">Header &amp; footer</a></nav>
<div>
<h2 class="t-h2" id="colour">Colour</h2>
<p class="t-body">Two themes from one token sheet. Light is the default: a warm off-white ground and a warm black ink; the header is that same black in both themes. Dark swaps the ground and ink. The seven logo hues are surfaces (the stacked cards, the newsletter, the arch's frames) with dark ink on all but violet; on the light ground the small marks (stars, initials, the pager) use a deeper tone of the same hue so a 16px star still reads. Use the toggle at bottom right to see both.</p>
<h3>Brand hues · surface, then mark tone</h3><div class="swatches">{hues}</div>
<h3>Neutrals · light, then dark</h3><div class="swatches">{neutrals}</div>
<h3>Surfaces</h3>
<div class="row"><div class="demo" style="flex:1 1 200px"><p class="t-h3">Ground</p><p class="t-caption">card on the ground</p></div><div class="demo demo--ink" data-surface="ink" style="flex:1 1 200px"><p class="t-h3">Ink</p><p class="t-caption">the header</p></div><div class="demo" data-accent="green" data-surface="accent" style="flex:1 1 200px;border:0"><p class="t-h3">Accent</p><p class="t-caption">a coloured card</p></div><div class="demo" data-accent="violet" data-surface="accent" style="flex:1 1 200px;border:0"><p class="t-h3">Violet</p><p class="t-caption">white ink, no tiers</p></div></div>
<h2 class="t-h2" id="type">Type</h2>
<p class="t-body">Plus Jakarta Sans, 400 and 600. Tracking tightens as size grows; leading loosens as it shrinks. Measures are in <code>em</code>, never <code>ch</code>. The hero title is also capped at 5.8% of the hero's height so it fits inside the arch on short screens.</p>
<div class="trow"><div class="tmeta"><b>display</b><br><span>hero title · 600</span><br><code>.t-display</code></div><div class="t-display" style="max-width:none">New tools for cognitive development</div></div>
<div class="trow"><div class="tmeta"><b>h2</b><br><span>section titles · 600</span><br><code>.t-h2</code></div><div class="t-h2" style="max-width:none">Safe, educational, and thrilling</div></div>
<div class="trow"><div class="tmeta"><b>h3</b><br><span>card titles · 600</span><br><code>.t-h3</code></div><div class="t-h3">Creativity in motion creates knowledge!</div></div>
<div class="trow"><div class="tmeta"><b>lead</b><br><span>subtitle, quotes · 400</span><br><code>.t-lead</code></div><div class="t-lead">Pre-wiring the brain &amp; educating the heart</div></div>
<div class="trow"><div class="tmeta"><b>body</b><br><span>paragraphs · 400</span><br><code>.t-body</code></div><div class="t-body">Developmental Improvisation is a new, revolutionary tool for teaching cognitive development and social/emotional understanding using the art of improvisation designed specifically for the classroom.</div></div>
<div class="trow"><div class="tmeta"><b>small</b><br><span>labels, nav · 600</span><br><code>.t-small</code></div><div class="t-small" style="font-weight:600">Welcome · Testimonials · Contact</div></div>
<div class="trow"><div class="tmeta"><b>caption</b><br><span>captions, © · 400</span><br><code>.t-caption</code></div><div class="t-caption">© 2026 Developmental Improvisation</div></div>
<h2 class="t-h2" id="space">Space</h2>
<p class="t-body">A 4px grid. Sections are <code>--section-y</code> (96px at 1440) top and bottom and open with a hairline on the column.</p>
{bars}
<h2 class="t-h2" id="radius">Radius</h2><div class="rads"><div class="rd" style="border-radius:var(--r-xl)"><b>--r-xl</b><br>28 · stacked cards, popup, newsletter</div><div class="rd" style="border-radius:var(--r-lg)"><b>--r-lg</b><br>20 · cards, photos, arch frames</div><div class="rd" style="border-radius:var(--r-md)"><b>--r-md</b><br>14 · buttons, inputs</div><div class="rd" style="border-radius:var(--r-full)"><b>--r-full</b><br>chips, avatars</div></div>
<h2 class="t-h2" id="motion">Motion</h2>
<p class="t-body">Two kinds. Things that <em>happen</em> take a rung of the ladder below. Things that <em>turn or stack</em> are driven by the scroll through one shared value, the flow, and have no duration: the arch, the logo's ring in the header, the stacked cards. Under reduced motion the flow's drift and scroll coupling are zero and reveals become short fades.</p>
{motion}
<h3>The flow</h3>
<div class="flow"><b>--flow-drift</b><span>3.75°/s at rest · one revolution of the arch in 96s</span><b>--flow-scroll</b><span>0.09° per pixel scrolled, in the scroll's direction</span><b>--flow-settle</b><span>0.32s · the time constant of the easing that follows the scroll</span><b>hover</b><span>a photograph under the pointer eases the drift to a stop in about 0.5s; leaving eases it back</span><b>the stack</b><span>a covered card scales from its top edge by 4.5% per card above it, in step with the scroll</span></div>
<h2 class="t-h2" id="buttons">Buttons</h2>
<div class="demo row"><button class="btn btn--primary">Primary</button><button class="btn btn--secondary">Secondary</button><button class="btn btn--ghost">Ghost</button><button class="btn btn--secondary btn--compact">Compact</button><button class="btn btn--primary" aria-busy="true">Loading</button><button class="btn btn--primary is-done" disabled><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>Subscribed</button></div>
<div class="demo--ink row" data-surface="ink" style="margin-top:var(--sp-4)"><button class="btn btn--primary">Primary on ink</button><button class="btn btn--secondary">Secondary</button><button class="theme" type="button" aria-label="Theme"><svg class="icon icon--moon" aria-hidden="true"><use href="#i-moon"/></svg><svg class="icon icon--sun" aria-hidden="true"><use href="#i-sun"/></svg></button></div>
<div class="demo row" data-accent="sky" data-surface="accent" style="margin-top:var(--sp-4);border:0"><button class="btn btn--primary">Primary on a surface</button><button class="btn btn--secondary">Secondary</button><button class="btn btn--ghost">Ghost</button></div>
<div class="demo row" data-accent="violet" data-surface="accent" style="margin-top:var(--sp-4);border:0"><button class="btn btn--primary">Primary on violet</button><button class="btn btn--secondary">Secondary</button><button class="btn btn--ghost">Ghost</button></div>
<h2 class="t-h2" id="chips">Chips &amp; stars</h2>
<div class="demo"><div class="chips">{''.join(f'<span class="chip" data-accent="{n}" style="--chip-bg:var(--c-{n})">{n}</span>' for n,_,_,_ in HUES if n!='violet')}</div><p class="section__label" style="margin:var(--sp-6) 0 0" data-accent="sky"><svg class="star" aria-hidden="true"><use href="#star"/></svg>The star marks every section label, in the section's mark tone</p></div>
<h2 class="t-h2" id="cards">Cards</h2>
<div class="row"><div class="card" style="flex:1 1 240px"><p class="t-h3">Card</p><p class="t-body">Raised ground, hairline, --r-lg. Testimonials.</p></div><div class="card card--accent" data-accent="orange" data-surface="accent" style="flex:1 1 240px"><p class="t-h3">Accent card</p><p class="t-body">Full-strength hue, --r-xl. The stack and the newsletter.</p></div></div>
<h2 class="t-h2" id="photos">Photos</h2>
<div class="row"><figure class="photo photo--4x5 photo--hover" style="width:200px">{pic('kids-dancing')}</figure><figure class="photo photo--3x2" style="width:300px">{pic('cast-pose','300px')}</figure><figure class="photo photo--1x1" style="width:200px">{pic('laugh-hat')}</figure></div>
<h2 class="t-h2" id="orbit">Orbit</h2>
<p class="t-body">The hero's arch at a small radius: fourteen slots, each photograph in a 3px frame of one brand hue, leaning 0.4 × its angle, fading across the bottom. It turns with the flow; hover a photograph to stop it, scroll to speed it up.</p>
<div class="demo hero mini-orbit"><div class="orbit__ring">{mini}</div></div>
<h2 class="t-h2" id="stack">Stacked cards</h2>
<div class="stack">{stack}</div>
<h2 class="t-h2" id="pile">Pile</h2>
<p class="t-body">Five testimonials at their own angles; they drop in on reveal and straighten on hover. On narrow screens they become a scroll-snap row with a star pager.</p>
<h2 class="t-h2" id="fields">Fields</h2>
<div class="demo"><form data-newsletter action="[NEWSLETTER_ACTION_URL]" method="post" novalidate style="max-width:520px"><div class="field"><label class="sr-only" for="sg-email">Email</label><input class="input" id="sg-email" type="email" name="email" placeholder="Email" autocomplete="email" required><button class="btn btn--primary" type="submit">Subscribe</button></div><p class="field__message" aria-live="polite"></p></form></div>
<h2 class="t-h2" id="nav">Header &amp; footer</h2>
<p class="t-body">See <a href="index.html" style="text-decoration:underline">index.html</a>: the header is the ink surface in both themes, with the colour logo (its ring of figures turns with the scroll), the links on the right, the theme toggle and Subscribe. The footer is the mark, one line, © and two link columns.</p>
<div class="demo--ink" data-surface="ink" style="display:flex;align-items:center;gap:var(--sp-3)">{logo.replace('class="logo"', 'class="logo" style="height:32px;width:auto"')}<span style="font-size:15px;font-weight:600;color:var(--ink)">Developmental Improvisation</span></div>
</div></main>
<script>function play(b){{const m=b.parentElement;m.style.setProperty('--d',getComputedStyle(document.documentElement).getPropertyValue('--dur-'+m.dataset.dur));m.classList.toggle('is-on');}}</script>
<script src="js/main.js?v={STAMP}" defer></script>
</body></html>
'''
open(f'{root}/styleguide.html','w').write(page)
print('styleguide.html', len(page)//1024, 'KB')
