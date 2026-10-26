# Generates styleguide.html: what the page IS, read from the files the page is drawn from. Dev tool; the output is
# committed.
# REBUILT 2026-10-26 (Some Wins' design bible §14: tokens -> styles -> components -> patterns, each drawn once). The old
# guide documented three designs ago: Inter at 400/700, a dark theme and its switch, warm neutrals (#FBFAF7, #1B1916),
# eight pastel accents, a sky-blue closing field, a photo bento hero and four hover cards, none of which the page had
# any more. Whoever built from it would have put them back. So every value here is now read from css/tokens.css at
# build time, and every component is the page's own class: the guide cannot say something the page does not do.
import re, hashlib
root='/home/user/portfolio/di-site'
tokens=open(f'{root}/css/tokens.css').read()
sprite=open(f'{root}/assets/icons.svg').read().strip()
man=__import__('json').load(open(f'{root}/images/manifest.json'))
def V(path): return hashlib.sha1(open(f'{root}/{path}','rb').read()).hexdigest()[:10]
# the first :root block holds the page's values; later blocks are reader settings (contrast, motion, breakpoints)
first=tokens[tokens.index(':root {'):]
first=first[:first.index('\n}\n')]
def tok(name):
    m=re.search(rf'{re.escape(name)}:\s*([^;]+);', first)
    if not m: raise SystemExit(f'no {name} in tokens.css')
    return m.group(1).strip()

def pic(name, w):
    m=man[name]; ws=[x for x in m['sizes'] if x<=960]
    av=', '.join(f'images/{name}-{x}.avif {x}w' for x in ws); wp=', '.join(f'images/{name}-{x}.webp {x}w' for x in ws)
    return (f'<picture><source type="image/avif" srcset="{av}" sizes="{w}px"><source type="image/webp" srcset="{wp}" sizes="{w}px">'
            f'<img src="images/{m["jpeg"]}" width="{m["width"]}" height="{m["height"]}" alt="" decoding="async"></picture>')

def chip(name, note, edge=True):
    return (f'<div class="sw"><i style="background:var({name});{"box-shadow:inset 0 0 0 1px var(--line)" if edge else ""}"></i>'
            f'<div><b>{name}</b> <code>{tok(name)}</code><br><span>{note}</span></div></div>')
grounds=''.join(chip(n,w) for n,w in [('--bg','the page'),('--band','every other section, edge to edge'),('--bg-raised','a field on white'),
                                         ('--bg-overlay','a field or a control on a grey band'),('--bg-sunken','a photograph\'s frame before it arrives')])
inks=''.join(chip(n,w,False) for n,w in [('--ink','every word on the page, and the focus ring'),('--ink-3','a field\'s placeholder, nothing else'),
                                            ('--line','the hairline over the footer'),('--ring','the 1px ring inside an outlined control'),
                                            ('--ring-strong','that ring under the pointer'),('--scrim','behind a dialog')])
LOGO=['sky','star','magenta','violet','orange','green','pink','yellow']
logo=''.join(f'<div class="sw"><i style="background:var(--logo-{n})"></i><div><b>--logo-{n}</b> <code>{tok("--logo-"+n)}</code></div></div>' for n in LOGO)

# the type the page sets, tier by tier, each in the page's own tokens
TIERS=[('display','the claim, once','--fs-display','--lh-display','--ls-display',600,'New tools for cognitive development'),
       ('h1','a section\'s headline, the closing line','--fs-h1','--lh-h1','--ls-h1',600,'What Developmental Improvisation is'),
       ('read','a section\'s words, read rather than scanned','--fs-read','--lh-read',None,400,'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.'),
       ('quote','a testimonial','--fs-quote','--lh-quote','--ls-quote',400,'“Lorem ipsum dolor sit amet, consectetur adipiscing elit.”'),
       ('h3','the sign-up\'s title, a dialog\'s','--fs-h3','--lh-h3','--ls-h3',600,'Sign Up for our Newsletter!'),
       ('ui','the header, buttons, a name under a quote','--fs-ui',None,None,600,'Testimonials'),
       ('caption','a role, the copyright','--fs-caption',None,None,400,'Role, Organization')]
def tier(k,use,fs,lh,ls,wt,sample):
    st=f'font-size:var({fs});font-weight:{wt};'+(f'line-height:var({lh});' if lh else 'line-height:1.4;')+(f'letter-spacing:var({ls});' if ls else '')
    meta=f'<code>{tok(fs)}</code>'+(f' / {tok(lh)}' if lh else '')+(f' · {tok(ls)}' if ls else ' · 0')+f' · {wt}'
    return f'<div class="trow"><div class="tmeta"><b>{k}</b><br><span>{use}</span><br>{meta}<br><span class="px" data-fs="{fs}"></span></div><div style="{st}">{sample}</div></div>'
type_rows=''.join(tier(*t) for t in TIERS)

bars=''.join(f'<div class="bar"><span>--sp-{n}</span><i style="width:var(--sp-{n})"></i><span>{tok("--sp-"+str(n))}</span></div>' for n in (1,2,3,4,5,6,7,8,10,12,16,20,24,32))
DUR=[('press','a press'),('state','arriving under the pointer, or focus'),('state-out','leaving it'),('move','a photograph settling, a spring back'),('reveal','a photograph closing back into its frame; a section arriving, under reduced motion'),('enter','a dialog, the viewer, a photograph opening out of its frame')]
motion=''.join(f'<div class="mo" data-dur="--dur-{k}"><button class="btn btn--line btn--compact" type="button" onclick="play(this)">Play</button><i></i><b>--dur-{k}</b> <code>{tok("--dur-"+k)}</code> <span>{w}</span></div>' for k,w in DUR)
press=''.join(f'<button class="btn btn--line btn--compact" type="button" style="transition:transform var(--dur-press) var(--ease-out)" onpointerdown="this.style.transform=\'scale(var({n}))\'" onpointerup="this.style.transform=\'\'" onpointerleave="this.style.transform=\'\'"><code>{n}</code> {tok(n)}</button>' for n in ('--press-glyph','--press-text','--press-photo'))

page=f'''<!DOCTYPE html><html lang="en" data-di-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>DI Style Guide</title><meta name="color-scheme" content="light">
<link rel="icon" href="assets/logo/favicon.svg?v={V('assets/logo/favicon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="css/tokens.css?v={V('css/tokens.css')}"><link rel="stylesheet" href="css/base.css?v={V('css/base.css')}"><link rel="stylesheet" href="css/components.css?v={V('css/components.css')}"><link rel="stylesheet" href="css/home.css?v={V('css/home.css')}">
<style>
.sg {{ display:grid; grid-template-columns: 200px minmax(0,1fr); gap: var(--sp-12); padding-block: var(--sp-12) var(--sp-24); }}
.sg__index {{ position: sticky; top: var(--sp-12); align-self: start; font-size: var(--fs-ui); }}
.sg__index a {{ min-height: var(--hit); display:flex; align-items:center; }}
.sg h1 {{ font-size: var(--fs-h1); line-height: var(--lh-h1); letter-spacing: var(--ls-h1); font-weight: 600; }}
.sg h2 {{ margin: var(--sp-16) 0 var(--sp-4); font-size: var(--fs-h3); line-height: var(--lh-h3); letter-spacing: var(--ls-h3); font-weight: 600; }}
.sg h3 {{ margin: var(--sp-8) 0 var(--sp-3); font-size: var(--fs-ui); font-weight: 600; }}
.sg p {{ max-width: 46em; line-height: 1.55; }} .sg p + p {{ margin-top: var(--sp-3); }}
.sg code {{ font-family: ui-monospace, Menlo, monospace; font-size: .85em; }}
.sw-grid {{ display:grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: var(--sp-4); }}
.sw {{ display:flex; gap: var(--sp-3); align-items:center; font-size: var(--fs-caption); }} .sw i {{ width:48px; height:48px; border-radius: var(--r-sm); flex:none; }}
.trow {{ display:grid; grid-template-columns: 240px minmax(0,1fr); gap: var(--sp-6); align-items:center; padding: var(--sp-5) 0; }} .tmeta {{ font-size: var(--fs-caption); }}
.bar {{ display:grid; grid-template-columns: 64px 1fr 48px; align-items:center; gap: var(--sp-3); font-size: var(--fs-caption); padding: 2px 0; }} .bar i {{ height: 8px; background: var(--ink); border-radius: var(--r-full); display:block; }}
.mo {{ display:grid; grid-template-columns: 80px 160px auto auto 1fr; align-items:center; gap: var(--sp-3); padding: var(--sp-1) 0; font-size: var(--fs-caption); }} .mo i {{ display:block; width: 24px; height:24px; border-radius: 50%; corner-shape: round; background: var(--ink); transition: transform var(--d, 200ms) var(--ease-out); }} .mo.is-on i {{ transform: translateX(120px); }}
.row {{ display:flex; gap: var(--sp-4); flex-wrap: wrap; align-items:center; }} .row + p {{ margin-top: var(--sp-4); }}
.stage {{ padding: var(--sp-8); background: var(--band); border-radius: var(--r-lg); }}
.corner {{ width: 112px; height: 112px; background: var(--band); display:grid; place-items:center; text-align:center; font-size: var(--fs-caption); }}
.rules li {{ padding: var(--sp-2) 0; max-width: 46em; }} .rules b {{ font-weight: 600; }}
@media (max-width: 860px) {{ .sg {{ grid-template-columns: 1fr; }} .sg__index {{ display:none; }} .trow {{ grid-template-columns: 1fr; gap: var(--sp-2); }} }}
</style></head><body>
<script>document.documentElement.classList.add('js')</script>
{sprite}
<main class="container sg">
<nav class="sg__index" aria-label="Style guide"><a href="#rules">The rules</a><a href="#colour">Colour</a><a href="#type">Type</a><a href="#space">Space</a><a href="#corners">Corners</a><a href="#press">Press</a><a href="#motion">Motion</a><a href="#controls">Controls</a><a href="#photographs">Photographs</a></nav>
<div>
<h1>Developmental Improvisation, the system</h1>
<p>Every value below is read from <code>css/tokens.css</code> when this page is built, and every control is the page's own class, so this guide cannot describe something the page does not do. The decisions behind it, and which of them are locked, are in <code>docs/decisions.md</code>; the reasons are in <code>docs/BUILD-LOG.md</code>.</p>

<h2 id="rules">The rules, in one place</h2>
<ul class="rules">
<li><b>A quiet room, and the photographs and the logo as its only colour.</b> Everything else is the ink on white or on Apple's grey; no hue in the chrome, no coloured text, no gradient but the logo's glint.</li>
<li><b>Light only.</b> One ground, one ink, both from the same cool family.</li>
<li><b>Two weights, 400 and 600.</b> Hierarchy is size and weight; every word is in the ink.</li>
<li><b>No shadows, anywhere.</b> Lines in three places only: the header's 1px edge, the hairline over the footer, the 1px ring inside an outlined control.</li>
<li><b>Sections alternate white and grey, edge to edge, with no gap:</b> the change of ground is the break, and no two in a row share one.</li>
<li><b>One action a screen.</b> No section shows more than six things to press.</li>
</ul>

<h2 id="colour">Colour</h2>
<h3>Grounds</h3><div class="sw-grid">{grounds}</div>
<h3>Ink and lines</h3><div class="sw-grid">{inks}</div>
<h3>The logo's own palette, its only colour</h3><div class="sw-grid">{logo}</div>

<h2 id="type">Type</h2>
<p><b>Inter</b>, one variable file, 400 and 600. Inter switches to its display design at 32px and up by itself. Tracking tightens as the size grows and is never set by hand below the headline sizes.</p>
{type_rows}

<h2 id="space">Space</h2>
<p>A 4px grid. Every section has <code>--section-y</code> <code>{tok('--section-y')}</code> above and below it; the column is <code>{tok('--page-max')}</code> with a gutter of <code>{tok('--gutter')}</code>.</p>
{bars}

<h2 id="corners">Corners</h2>
<p>Four, and each has a job. Every corner is a superellipse where the browser can draw one (<code>corner-shape: squircle</code>); a circle opts back out.</p>
<div class="row">
<div class="corner" style="border-radius:2px">2px<br>a frame on the film</div>
<div class="corner" style="border-radius:var(--r-lg)">--r-lg {tok('--r-lg')}<br>a photograph, the film</div>
<div class="corner" style="border-radius:var(--r-full);width:180px;height:56px">pill<br>a button, a field</div>
<div class="corner" style="border-radius:50%;corner-shape:round">circle<br>one glyph</div>
</div>

<h2 id="press">Press</h2>
<p>Every control answers a press by shrinking, and the depth follows its size: a small thing has to go further to be seen at all. Press these.</p>
<div class="row">{press}</div>

<h2 id="motion">Motion</h2>
<p>A ladder for what happens, all on <code>--ease-out</code> <code>{tok('--ease-out')}</code>. Hand-tuned and kept off the ladder: a section arriving (900ms fade, 1100ms rise), a photograph resolving over its placeholder (700ms), the curtain (900ms). What slides and turns, the strip and the ring, has no duration: it follows one shared angle, and under reduced motion it stands still.</p>
{motion}

<h2 id="controls">Controls</h2>
<h3>Buttons and the field</h3>
<div class="stage row"><button class="btn btn--primary btn--lg" type="button">Sign Up for our Newsletter!</button><button class="btn btn--primary" type="button">Subscribe</button><button class="btn btn--primary" type="button" aria-busy="true">Subscribe</button></div>
<div class="row" style="margin-top:var(--sp-4)"><div class="field" style="flex:1 1 360px;max-width:520px"><label class="sr-only" for="sg-email">Email</label><input class="input" id="sg-email" type="email" placeholder="Email" autocomplete="off"><button class="btn btn--primary" type="button">Subscribe</button></div></div>
<h3>A light control over a photograph</h3>
<div class="row"><div class="photo photo--4x5" style="width:220px;position:relative">{pic('two-lines', 220)}<button class="on-photo" type="button" aria-label="Play" style="position:absolute;right:16px;bottom:16px;width:56px;height:56px"><svg class="icon" aria-hidden="true" style="width:22px;height:22px;margin-left:3px"><use href="#i-play"/></svg></button></div><p style="max-width:28em">The strip's pause and the film's play: white at <code>{tok('--on-photo')}</code> with an ink glyph, so it reads on the darkest and the brightest picture beneath it; solid under reduced transparency, ringed under increased contrast.</p></div>

<h2 id="photographs">Photographs</h2>
<p>A photograph fills its frame and opens out of it into the viewer. Its file is chosen for the width it is drawn at, its crop counted.</p>
<div class="row">
<figure class="photo photo--4x5" style="width:180px">{pic('kids-dancing', 180)}</figure>
<figure class="photo photo--1x1 photo--circle" style="width:150px">{pic('cast-pose', 150)}</figure>
<div class="film" style="width:135px;background-image:none"><img src="assets/video/linda-china-poster.jpg?v={V('assets/video/linda-china-poster.jpg')}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></div>
</div>
<p>Left to right: a section's photograph (4:5, <code>--r-lg</code>), the ring's circle, the film (9:16, <code>--r-lg</code>). The strip's frames are 4:5 on the film base with a 2px corner.</p>
</div></main>
<script>
function play(b){{const m=b.parentElement;m.style.setProperty('--d',getComputedStyle(document.documentElement).getPropertyValue(m.dataset.dur));m.classList.toggle('is-on');}}
document.querySelectorAll('.px').forEach(function(s){{var p=document.createElement('span');p.style.fontSize='var('+s.dataset.fs+')';document.body.appendChild(p);s.textContent=Math.round(parseFloat(getComputedStyle(p).fontSize))+'px at this width';p.remove();}});
document.querySelectorAll('.photo img').forEach(function(i){{function on(){{i.classList.add('is-loaded');}} if(i.complete)on();else i.addEventListener('load',on);}});
</script>
</body></html>
'''
open(f'{root}/styleguide.html','w').write(page)
print('styleguide.html', len(page)//1024, 'KB')
