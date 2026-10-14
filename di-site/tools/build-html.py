# Generates index.html once from images/manifest.json + the copy. Dev tool; the output is committed and served static.
import json, html, re, hashlib
root='/home/user/portfolio/di-site'
man=json.load(open(f'{root}/images/manifest.json'))
logo=open(f'{root}/assets/logo/inline-logo.html').read().strip()
navlogo=logo.replace(' role="img" aria-labelledby="logoTitle"><title id="logoTitle">Developmental Improvisation</title>', ' aria-hidden="true">')
assert navlogo!=logo
sprite=open(f'{root}/assets/icons.svg').read().strip()
whitemark=open(f'{root}/assets/logo/dilogo.svg').read()
whitemark_paths=''.join(re.findall(r'<path[^>]*/>',whitemark)).replace('fill="white"','fill="currentColor"')
# Each stylesheet and the script are stamped with a hash of their own bytes, not the date. CSS is served immutable
# for a year (the portfolio's vercel.json), and on 2026-10-13 eight rounds shipped under one date stamp: anybody who
# loaded the first kept its stylesheets through the next seven. A hash changes exactly when the file does.
def V(path): return hashlib.sha1(open(f'{root}/{path}','rb').read()).hexdigest()[:10]

ALT={
 'bow-ties-wall':'Three performers in white shirts and bow ties strike a pose against a brick wall',
 'yellow-trousers':'A workshop participant in yellow trousers laughs mid-step on a foam-mat floor while the group watches',
 'bow-tie-chairs':'Two children in white shirts and bow ties sit on folding chairs in a scene while a third crouches towards them',
 'circle-hands':'Workshop participants reach their hands toward each other in a circle',
 'blue-shirts':'Three children in blue T-shirts dance on a black stage',
 'laugh-hat':'A participant in a bucket hat laughs with his eyes closed',
 'conga-line':'Six teenagers in white shirts and ties bend forward in a line across a stage',
 'linda-laughing':'Linda Kellogg Fulton laughs while leading a session',
 'boy-fist':'A boy in a blue shirt punches the air and laughs, another boy behind him',
 'kids-bw-small':'Four children in white shirts sit and stand together on a stage, in black and white',
 'cast-stage-small':'A cast of eight in white shirts and coloured ties takes a bow on a lit stage',
 'floor-game':'A participant in green crawls across the floor during a group game while others raise their hands',
 'three-teens':'Three teenagers in white shirts and ties play a scene on a grey set',
 'row-linked-arms':'Three participants stand in a row with their arms linked',
 'scene-handshake':'A boy in a plaid shirt and a bowler hat shakes hands with a girl in a scene',
 'linda-stage':'Linda Kellogg Fulton speaks on stage holding a foam prop',
 'three-men':'Three young men in white shirts and ties lean into a conversation, one with a hand on his chest',
 'linda-portrait':'Linda Kellogg Fulton, in black and white, holding one foot up beside her',
 'linda-circle':'Linda Kellogg Fulton leads five children standing in a circle with their arms out',
 'kids-dancing':'Children dance across a bright studio floor',
 'kids-running':'Children run and jump across a studio floor beside a Christmas tree',
 'cast-pose':'Ten children pose together on a stage set with their arms out',
 'two-lines':'Children in two facing lines reach their hands across to each other',
 'zoom-group':'A workshop group poses on a green floor under a screen showing Linda on a video call',
 'duo-brick':'Two adults in white shirts play a scene in front of a brick wall',
}
POS={'yellow-trousers':'50% 40%','bow-tie-chairs':'25% 50%','circle-hands':'45% 50%','blue-shirts':'40% 50%','laugh-hat':'50% 30%','conga-line':'68% 45%','linda-laughing':'50% 30%','bow-ties-wall':'40% 45%','floor-game':'40% 60%','three-teens':'50% 45%','row-linked-arms':'50% 50%','scene-handshake':'22% 45%','linda-stage':'50% 30%','three-men':'50% 40%',
     'linda-portrait':'22% 40%','boy-fist':'50% 40%','kids-bw-small':'50% 50%','cast-stage-small':'50% 50%','linda-circle':'45% 50%','kids-dancing':'50% 50%','kids-running':'50% 50%','cast-pose':'50% 55%','two-lines':'52% 55%','zoom-group':'50% 55%','duo-brick':'50% 45%'}

USED=[]
def picture(name, sizes, lazy=True, cls='', ratio=None, button=True, big=False, ghost=False):
    m=man[name]; srcs=[w for w in m['sizes'] if big or w<=960]
    av=', '.join(f'images/{name}-{w}.avif {w}w' for w in srcs); wp=', '.join(f'images/{name}-{w}.webp {w}w' for w in srcs)
    load='loading="lazy" ' if lazy else 'fetchpriority="high" '
    img=(f'<img src="images/{m["jpeg"]}" width="{m["width"]}" height="{m["height"]}" alt="{html.escape(ALT[name])}" '
         f'{load}decoding="async">')
    pic=f'<picture><source type="image/avif" srcset="{av}" sizes="{sizes}"><source type="image/webp" srcset="{wp}" sizes="{sizes}">{img}</picture>'
    if not button: return pic
    if ghost: return f'<button class="photo__open" type="button" tabindex="-1" data-photo="{name}">{pic}</button>'
    if name not in USED: USED.append(name)
    return f'<button class="photo__open" type="button" data-photo="{name}" aria-label="Open photograph: {html.escape(ALT[name])}">{pic}</button>'
def lb_data():
    out={}
    for n in USED:
        m=man[n]; big=[w for w in m['sizes'] if w>=960] or [m['sizes'][-1]]
        out[n]={'avif':[[w,f'images/{n}-{w}.avif'] for w in big],'webp':[[w,f'images/{n}-{w}.webp'] for w in big],'jpeg':f'images/{m["jpeg"]}','w':m['width'],'h':m['height'],'alt':ALT[n]}
    return json.dumps(out,separators=(',',':'))

def photo(name, ratio, sizes, lazy=True, hover=False, caption=None, big=False, button=True, ghost=False):
    m=man[name]
    # a ghost copy needs no blurred placeholder: by the time the loop brings it on screen the first copy has fetched
    # the same file, so it paints from cache — and fifteen inline placeholders were 4KB of page for nothing
    bg='' if ghost else f';background-image:url({m["placeholder"]})'
    h=(f'<figure class="photo photo--{ratio}{" photo--hover" if hover else ""}" style="--pos:{POS[name]}{bg}">'
       + picture(name,sizes,lazy,big=big,button=button,ghost=ghost) + (f'<figcaption class="photo__caption">{caption}</figcaption>' if caption else '') + '</figure>')
    return h

# the quote ring: eight shaped photographs. A tilted photograph is scaled 1.45 to fill the rotated square, so it must have
# its subject at the centre and no dark ground: linda-portrait and kids-bw-small read as black shapes there and are out.
RING=['bow-tie-chairs','linda-stage','cast-pose','floor-game','laugh-hat','cast-stage-small','three-men','duo-brick']
RSIZES='(max-width: 767px) 76px, (max-width: 1023px) 116px, 148px'
ring=''.join(f'<div class="ring__item"><figure class="photo photo--1x1 photo--circle" style="--pos:{POS[n]};background-image:url({man[n]["placeholder"]})">{picture(n,RSIZES)}</figure></div>' for n in RING)


# ---- The reel ----
# A THIN BAND OF PHOTOGRAPHS BETWEEN THE HERO AND THE FIRST SECTION, sliding sideways (2026-10-13: "not a big fan of the
# carousel at the bottom actually maybe a horizonatal band spliting up the hero and the next section"). One row, full
# bleed, drifting on the flow, held by a pointer, never scrubbed; the tight strip he picked (4px apart, 4px corners),
# every photograph 4:5, and no fade at either end. It was four-to-six columns rising, under the hero (2026-10-02) and
# then at the foot (for the evening of 2026-10-13). The row is three copies of one run, so a screen up to twice the
# run's width never sees the loop's seam; the order interleaves the old columns so no two neighbours are one session.
COLUMNS=[
 ['linda-circle','kids-dancing','row-linked-arms'],
 ['blue-shirts','scene-handshake','linda-portrait'],
 ['circle-hands','kids-running','kids-bw-small'],
 ['zoom-group','boy-fist'],
 ['three-teens','conga-line'],
 ['yellow-trousers','bow-ties-wall'],
]
REEL=[n for row in zip(*[c+[None]*(3-len(c)) for c in COLUMNS]) for n in row if n]
RSZ='(max-width: 767px) 96px, 140px'
_reel_run=lambda ghost: ''.join(f'<li class="reel__item">{photo(n, "4x5", RSZ, ghost=ghost)}</li>' for n in REEL)
reel=(f'<div class="reel" data-reel role="region" aria-label="From the sessions"><div class="reel__track">'
      f'<ul class="reel__run">{_reel_run(False)}</ul><ul class="reel__run" aria-hidden="true">{_reel_run(True)}</ul>'
      f'<ul class="reel__run" aria-hidden="true">{_reel_run(True)}</ul></div></div>')

# the hero's mark: THE BRAND'S OWN COLOURS, with a glint of light passing over them. Jayden, 2026-10-12: "I want the
# logo to be like the normal colors maybe with a premium shine instead of being black." So the paths go in as the logo
# file draws them — sky monogram, gold star, the six arcs — and the geometry is emitted a second time, solid white,
# inside a mask, so a narrow band of white light can travel across the mark and only ever touch the mark itself.
_paths = re.findall(r'<path[^>]*/>', logo)
# EVERY PATH IS NAMED FOR ITS COLOUR, so the logo's palette is eight tokens in tokens.css (--logo-*) and one change
# recolours the hero's mark, the curtain's and the footer's together. The fill attribute stays as the file drew it, as
# the fallback. The star is white in the file, drawn for a dark ground; on this light page it has a colour of its own.
LOGO_PART = {'#F0895B': 'orange', '#FB9BC9': 'pink', '#E744E2': 'magenta', '#FEE79B': 'yellow', '#7358FC': 'violet',
             '#51E596': 'green', '#58CDFC': 'sky', 'white': 'star'}
def _tag(p):
    f = re.search(r'fill="([^"]*)"', p).group(1)
    return p.replace('<path ', f'<path class="logo__{LOGO_PART[f]}" ', 1)
assert all(re.search(r'fill="([^"]*)"', p).group(1) in LOGO_PART for p in _paths), 'a logo colour with no name'
_art = ''.join(_tag(p) for p in _paths)
navlogo = re.sub(r'<path[^>]*/>', lambda m: _tag(m.group(0)), navlogo)
# THE HEADER'S GLYPH is the whole DI logo in one colour, the ink: the black-and-white logo (dilogo.svg, the #mark
# symbol), Jayden's call on 2026-10-13 ("the glyph though can we just use the black and white di logo") over the
# coloured "di" monogram it replaced the same hour. The colour lives in the hero's mark; the header's is the ink,
# the way his portfolio's "jb" is.
navglyph = '<svg class="nav__glyph" viewBox="0 0 787 842" aria-hidden="true"><use href="#mark"/></svg>'
_shape = ''.join(re.sub(r'fill="[^"]*"', 'fill="#fff"', p) for p in _paths)
# the glint: a narrow white band with a soft shoulder either side, laid diagonally. One band, on a rect twice the
# mark's width, so it crosses the mark and is then off it — a glint that comes and goes, not a shimmer that never stops.
_shine = ''.join(f'<stop offset="{o}" stop-color="#fff" stop-opacity="{a}"/>' for o, a in
                 [('0','0'),('.35','0'),('.43','.24'),('.475','.72'),('.5','1'),('.525','.72'),('.57','.24'),('.65','0'),('1','0')])
heromark = (f'<svg class="logo logo--hero" viewBox="0 0 787 842" role="img" aria-labelledby="heroLogoTitle">'
            f'<title id="heroLogoTitle">Developmental Improvisation</title>'
            f'<defs><linearGradient id="markShine" x1="0" y1="0" x2="1" y2=".45">{_shine}</linearGradient>'
            f'<mask id="markMask" maskUnits="userSpaceOnUse" x="0" y="0" width="787" height="842">{_shape}</mask></defs>'
            f'<g class="logo__art">{_art}</g>'
            f'<g mask="url(#markMask)"><g class="logo__glare"><rect class="logo__shine" x="-800" y="-200" width="1600" height="1240" fill="url(#markShine)"/></g></g>'
            f'</svg>')

# ---- The two sections that replace the four cards ----
# Linda's brief, after seeing the cards: split the about into two — what Developmental Improvisation is, and who she
# is — and fill them with placeholder copy while she writes the real thing. So the six verbatim paragraphs from the
# old site are out of the page for now, and so is the reader dialog that carried them: two sections of prose do not
# need a dialog to hold them. THE BODY COPY HERE IS PLACEHOLDER and must be replaced before this is published.
# the page's own description stays real: it is not visible copy, and a search result should say what this is
META_DESC="Developmental Improvisation is a new tool for teaching cognitive development and social/emotional understanding using the art of improvisation, designed specifically for the classroom."

LOREM=[
 "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
 "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
 "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
]
TSIZES='(max-width: 767px) 92vw, 44vw'
TELL=[
 ('about','The method','What Developmental Improvisation is','two-lines',[LOREM[0],LOREM[1]],False),
 ('founder','The founder','Who Linda is','linda-laughing',[LOREM[2],LOREM[1]],True),
]
def tell(idp, label, title, name, paras, flip):
    body=''.join(f'<p class="tell__p">{t}</p>' for t in paras)
    return (f'<section class="tell{"" if flip else " band"}" id="{idp}" aria-labelledby="{idp}Title">'
            f'<div class="container grid tell__row">'
            f'<figure class="tell__figure reveal">{photo(name, "4x5", TSIZES, hover=True)}</figure>'
            f'<div class="tell__copy reveal">'
            f'<h2 class="tell__title" id="{idp}Title">{title}</h2>'
            f'{body}</div></div></section>')
tells=''.join(tell(*t) for t in TELL)
LOREM="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
quotes=[LOREM+" Ut enim ad minim veniam, quis nostrud.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod."]
# three tiles; the middle one carries the last of the six arcs, the other two are the raised ground
# three that read apart from each other: the first arc, the star, and the arc the eye has not seen for a screen
VOICES=[('magenta',quotes[0]),('gold',quotes[1]),('green',quotes[2])]
pile=''.join(f'<li class="voice reveal" data-placeholder="true"><p class="voice__quote">{q}</p><div class="voice__who"><div class="voice__name">First Last</div><div class="voice__role">Role, Organization</div></div></li>' for a,q in VOICES)

form=lambda idp: (f'<form data-newsletter action="[NEWSLETTER_ACTION_URL]" method="post" novalidate><div class="field"><label class="sr-only" for="{idp}-email">Email</label>'
                  f'<input class="input" id="{idp}-email" type="email" name="email" placeholder="Email" autocomplete="email" required>'
                  f'<button class="btn btn--primary" type="submit">Subscribe</button></div><p class="field__message" aria-live="polite"></p></form>')

page=f'''<!DOCTYPE html>
<html lang="en" data-di-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Developmental Improvisation — New Tools for Cognitive Development &amp; Emotional Understanding</title>
<meta name="description" content="{html.escape(META_DESC)}">
<link rel="canonical" href="https://developmentalimprovisation.com/">
<meta name="theme-color" content="#FAFAFB">
<meta name="color-scheme" content="light">
<meta property="og:title" content="Developmental Improvisation">
<meta property="og:description" content="{html.escape(META_DESC)}">
<meta property="og:type" content="website">
<meta property="og:image" content="assets/og.png">
<link rel="icon" href="assets/logo/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="fonts/inter-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css?v={V('css/tokens.css')}">
<link rel="stylesheet" href="css/base.css?v={V('css/base.css')}">
<link rel="stylesheet" href="css/components.css?v={V('css/components.css')}">
<link rel="stylesheet" href="css/home.css?v={V('css/home.css')}">
<script src="js/main.js?v={V('js/main.js')}" defer></script>
</head>
<body>
<script>(function(){{var h=document.documentElement,c=1;try{{c=/[?&#]curtain\\b/.test(location.href)||!sessionStorage.getItem('di:curtain')}}catch(e){{}}h.classList.add('js');if(c&&!matchMedia('(prefers-reduced-motion: reduce)').matches)h.classList.add('curtaining')}})()</script>
<a class="skip" href="#main">Skip to content</a>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><symbol id="mark" viewBox="0 0 787 842">{whitemark_paths}</symbol></svg>
{sprite}

<header class="nav" id="nav">
  <div class="container nav__bar">
    <a class="nav__brand" href="/" aria-label="Developmental Improvisation, home">{navglyph}Developmental Improvisation</a>
    <nav class="nav__links" aria-label="Primary"><a href="#about">About</a><a href="#voices">Testimonials</a><a href="#contact">Contact</a></nav>
    <div class="nav__panel">
      <button class="btn btn--line btn--compact nav__subscribe" type="button" data-open-dialog>Subscribe</button><button class="nav__menu" type="button" data-open-menu aria-expanded="false" aria-controls="menuSheet" aria-label="Menu"><svg class="icon icon--open" aria-hidden="true"><use href="#i-list"/></svg><svg class="icon icon--close" aria-hidden="true"><use href="#i-x"/></svg></button></div>
  </div>
</header>

<main id="main">
  <!-- Linda's brief: "far too busy, too many images, a much simpler hero would do wonders" and "the logo more
       prevalent". So the fifteen drifting photographs are gone and the hero is a masthead: the mark, the line, one
       action and the three figures, centred on one panel. A page about a serious tool for education opens the way an
       institution opens — the name first, then the claim, then the one thing to do. -->
  <section class="hero" id="top" aria-labelledby="heroTitle">
    <div class="container">
      <div class="hero__panel reveal">
        <div class="hero__mark" data-mark><div class="hero__mark__spin">{heromark}</div></div>
        <h1 class="hero__title" id="heroTitle">New tools for cognitive development <span class="hero__title__line">&amp;&nbsp;emotional understanding</span></h1>
        <div class="hero__act"><button class="btn btn--primary btn--lg" type="button" data-open-dialog>Sign Up for our Newsletter!</button></div>
      </div>
    </div>
  </section>

  <!-- the photographs: one thin row sliding sideways, between the hero and the first section -->
  {reel}
{tells}

  <section class="section ring band" id="quote" aria-label="Quote">
    <div class="container">
      <div class="ring__stage reveal--parts">
        <div class="ring__orbit">{ring}</div>
        <div class="ring__centre"><div class="reveal">
          <blockquote class="ring__text">“Creativity in motion creates knowledge!”</blockquote>
          <p class="ring__who">Linda Kellogg Fulton</p>
        </div></div>
      </div>
    </div>
  </section>

  <section class="voices-sec" id="voices" aria-label="Testimonials">
    <div class="container">
      <ul class="voices grid reveal--stagger" aria-label="Testimonials">{pile}</ul>
    </div>
  </section>
</main>

<section class="close band" aria-labelledby="newsletterTitle">
  <!-- The closing line and the newsletter: the last thing the page says. The ways to reach Linda moved into the footer
       below it (2026-10-13), which is drawn the way his portfolio's is. -->
  <div class="container"><div class="close__body reveal">
    <div class="grid close__grid">
      <p class="close__lead">Prepared for anything life has to offer.</p>
      <div class="close__sign">
        <h2 class="close__title" id="newsletterTitle">Sign Up for our Newsletter!</h2>
        {form('nl')}
      </div>
    </div>
  </div></div>
</section>

<footer class="foot band" id="contact">
  <!-- His portfolio's footer (jaydenbetts.design, 2026-10-13): one hairline the full width of the page, the identity on
       the left, two columns of plain links on the right, 44px rows. -->
  <div class="container foot__top">
    <div class="foot__id">
      <a class="foot__brand" href="#top" aria-label="Developmental Improvisation, back to the top">{navlogo}</a>
      <p class="foot__status">Pre-wiring the brain &amp; educating the heart</p>
      <p class="foot__copy">© 2026 Developmental Improvisation</p>
    </div>
    <nav class="foot__nav" aria-label="Footer">
      <div class="foot__col"><h2 class="foot__head">Menu</h2><a class="foot__link" href="#about">About</a><a class="foot__link" href="#voices">Testimonials</a><button class="foot__link" type="button" data-open-dialog>Newsletter</button></div>
      <div class="foot__col"><h2 class="foot__head">Contact</h2><a class="foot__link" href="mailto:developmentalimprov@gmail.com">Email</a><a class="foot__link" href="tel:+18573523221">Call</a></div>
    </nav>
  </div>
</footer>

<dialog class="lightbox" id="lightbox" aria-label="Photograph">
  <div class="lightbox__stage"><figure class="lightbox__figure"></figure></div>
  <button class="dialog__close lightbox__close" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>
  <button class="arrow lightbox__prev" type="button" aria-label="Previous photograph"><svg class="icon" aria-hidden="true"><use href="#i-arrow-left"/></svg></button>
  <button class="arrow lightbox__next" type="button" aria-label="Next photograph"><svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg></button>
  <p class="sr-only lightbox__live" aria-live="polite"></p>
</dialog>
<script type="application/json" id="lbData">{{LBDATA}}</script>

<dialog class="dialog" id="newsletterDialog" aria-labelledby="dialogTitle">
  <button class="dialog__close" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>
  <svg class="mark" aria-hidden="true"><use href="#mark"/></svg>
  <h2 id="dialogTitle" tabindex="-1">Sign Up for our Newsletter!</h2>
  {form('dlg')}
</dialog>


<div class="curtain" aria-hidden="true">
  <div class="curtain__half curtain__half--l"></div>
  <div class="curtain__half curtain__half--r"></div>
  <div class="curtain__load">{navlogo}<span class="curtain__bar"><i></i></span></div>
</div>

<dialog class="sheet" id="menuSheet" aria-label="Menu">
  <div class="sheet__head"><button class="sheet__close" type="button" data-close-menu aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button></div>
  <nav class="sheet__links" aria-label="Primary"><a href="#about">About</a><a href="#voices">Testimonials</a><a href="#contact">Contact</a></nav>
  <button class="btn btn--primary" type="button" data-open-dialog data-close-menu>Subscribe</button>
</dialog>
</body>
</html>
'''
page=page.replace('{LBDATA}', lb_data())
open(f'{root}/index.html','w').write(page)
print('index.html', len(page.splitlines()), 'lines', len(page)//1024, 'KB')
