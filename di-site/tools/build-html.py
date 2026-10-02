# Generates index.html once from images/manifest.json + the copy. Dev tool; the output is committed and served static.
import json, html, datetime, re
root='/home/user/portfolio/di-site'
man=json.load(open(f'{root}/images/manifest.json'))
logo=open(f'{root}/assets/logo/inline-logo.html').read().strip()
navlogo=logo.replace(' role="img" aria-labelledby="logoTitle"><title id="logoTitle">Developmental Improvisation</title>', ' aria-hidden="true">')
assert navlogo!=logo
sprite=open(f'{root}/assets/icons.svg').read().strip()
whitemark=open(f'{root}/assets/logo/dilogo.svg').read()
whitemark_paths=''.join(re.findall(r'<path[^>]*/>',whitemark)).replace('fill="white"','fill="currentColor"')
STAMP=datetime.date.today().strftime('%Y%m%d')

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


# ---- The gallery ----
# Jayden, a round after the strip: "the reference I liked was more of a vertical image scroll." So the row stood up.
# Four columns of photographs rising on their own, faded out at the top and the bottom, and still nothing you can
# scrub — the flow drives them, the pointer only holds them. Each column is two copies of one run, so its loop length
# is the first run's height and the translate wraps without a seam.
# ONE SHAPE STILL: every photograph here is 4:5, like every other one on the page. The masonry look the reference has
# comes from the columns sitting at different heights and travelling at different speeds, not from mixed ratios —
# mixed ratios would reopen a locked decision and that is his call, not a side effect of this one.
# Order matters: a phone shows the first two columns and a tablet the first three, so the strongest pictures lead.
GALLERY=[
 ['linda-circle','kids-dancing','boy-fist','row-linked-arms'],
 ['blue-shirts','scene-handshake','three-teens','linda-portrait'],
 ['circle-hands','kids-running','yellow-trousers','kids-bw-small'],
 ['zoom-group','conga-line','bow-ties-wall'],
]
GSIZES='(max-width: 767px) 46vw, (max-width: 1023px) 31vw, 23vw'
def gallery_col(names):
    run=lambda ghost: ''.join(f'<li class="gallery__item">{photo(n, "4x5", GSIZES, ghost=ghost)}</li>' for n in names)
    return (f'<div class="gallery__col"><ul class="gallery__run">{run(False)}</ul>'
            f'<ul class="gallery__run" aria-hidden="true">{run(True)}</ul></div>')
gallery=''.join(gallery_col(c) for c in GALLERY)

# the hero's mark, built from the same source as every other copy of it: the paths once for the black shape, and once
# more inside a mask so a moving band of the palette can be laid over them without duplicating the geometry in markup.
_paths = re.findall(r'<path[^>]*/>', logo)
# two copies of the same geometry: one with its fills STRIPPED so CSS can ink it (a path's own fill attribute beats a
# fill inherited from a styled parent, which is what painted the first version magenta), one solid white for the mask
_ink  = ''.join(re.sub(r'\s*fill="[^"]*"', '', p) for p in _paths)
_shape = ''.join(re.sub(r'fill="[^"]*"', 'fill="#fff"', p) for p in _paths)
# two bands of the palette across a rect twice the mark's width, so one of them is always crossing it and the colour
# never stops moving. Transparent between the bands: the mark is BLACK with light passing over it, not a coloured mark.
_stops = ''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in
                 [('0','#58CDFC','0'),('0.09','#58CDFC','0'),('0.16','#58CDFC','.85'),('0.23','#7358FC','1'),
                  ('0.30','#E744E2','1'),('0.38','#F0895B','.85'),('0.46','#F0895B','0'),('0.59','#FFE469','0'),
                  ('0.66','#FFE469','.85'),('0.73','#51E596','1'),('0.80','#58CDFC','1'),('0.88','#FB9BC9','.85'),
                  ('0.96','#FB9BC9','0'),('1','#FB9BC9','0')])
heromark = (f'<svg class="logo logo--hero" viewBox="0 0 787 842" role="img" aria-labelledby="heroLogoTitle">'
            f'<title id="heroLogoTitle">Developmental Improvisation</title>'
            f'<defs><linearGradient id="markSheen" x1="0" y1="0.15" x2="1" y2="0.85">{_stops}</linearGradient>'
            f'<mask id="markMask" maskUnits="userSpaceOnUse" x="0" y="0" width="787" height="842">{_shape}</mask></defs>'
            f'<g class="logo__ink">{_ink}</g>'
            f'<g mask="url(#markMask)"><rect class="logo__sheen" x="-640" y="-100" width="1180" height="1040" fill="url(#markSheen)"/></g>'
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
    return (f'<section class="tell{" tell--flip" if flip else ""}" id="{idp}" aria-labelledby="{idp}Title">'
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
pile=''.join(f'<li class="voice reveal" data-placeholder="true"><p class="voice__quote">{q}</p><div class="voice__who"><span class="voice__avatar" aria-hidden="true">FL</span><div><div class="voice__name">First Last</div><div class="voice__role">Role, Organization</div></div></div></li>' for a,q in VOICES)

form=lambda idp: (f'<form data-newsletter action="[NEWSLETTER_ACTION_URL]" method="post" novalidate><div class="field"><label class="sr-only" for="{idp}-email">Email</label>'
                  f'<input class="input" id="{idp}-email" type="email" name="email" placeholder="Email" autocomplete="email" required>'
                  f'<button class="btn btn--primary" type="submit">Subscribe</button></div><p class="field__message" aria-live="polite"></p></form>')

page=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Developmental Improvisation — New Tools for Cognitive Development &amp; Emotional Understanding</title>
<meta name="description" content="{html.escape(META_DESC)}">
<link rel="canonical" href="https://developmentalimprovisation.com/">
<meta name="theme-color" content="#0B0B0F">
<meta name="color-scheme" content="dark light">
<meta property="og:title" content="Developmental Improvisation">
<meta property="og:description" content="{html.escape(META_DESC)}">
<meta property="og:type" content="website">
<meta property="og:image" content="assets/og.png">
<link rel="icon" href="assets/logo/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="fonts/geist-variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css?v={STAMP}">
<link rel="stylesheet" href="css/base.css?v={STAMP}">
<link rel="stylesheet" href="css/components.css?v={STAMP}">
<link rel="stylesheet" href="css/home.css?v={STAMP}">
<script src="js/main.js?v={STAMP}" defer></script>
</head>
<body>
<script>(function(){{var h=document.documentElement,t=null,c=1;try{{t=localStorage.getItem('di:theme');c=/[?&#]curtain\\b/.test(location.href)||!sessionStorage.getItem('di:curtain')}}catch(e){{}}h.dataset.theme=t==='light'?'light':'dark';h.classList.add('js');if(c&&!matchMedia('(prefers-reduced-motion: reduce)').matches)h.classList.add('curtaining')}})()</script>
<a class="skip" href="#main">Skip to content</a>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><symbol id="mark" viewBox="0 0 787 842">{whitemark_paths}</symbol></svg>
{sprite}

<header class="nav" id="nav">
  <div class="container nav__bar">
    <a class="nav__brand" href="/" aria-label="Developmental Improvisation, home">{navlogo}<span class="word">Developmental Improvisation</span></a>
    <div class="nav__panel">
      <nav class="nav__links" aria-label="Primary"><a href="#about">About</a><a href="#contact">Contact</a></nav>
      <button class="theme" type="button" data-theme-toggle aria-label="Switch to dark mode"><svg class="icon icon--moon" aria-hidden="true"><use href="#i-moon"/></svg><svg class="icon icon--sun" aria-hidden="true"><use href="#i-sun"/></svg></button><button class="btn btn--secondary btn--compact nav__subscribe" type="button" data-open-dialog>Subscribe</button><button class="nav__menu" type="button" data-open-menu aria-expanded="false" aria-controls="menuSheet" aria-label="Menu"><svg class="icon icon--open" aria-hidden="true"><use href="#i-list"/></svg><svg class="icon icon--close" aria-hidden="true"><use href="#i-x"/></svg></button></div>
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
        <h1 class="hero__title" id="heroTitle">New tools for cognitive development <span class="hero__title__soft">&amp;&nbsp;emotional understanding</span></h1>
        <p class="hero__sub">Pre-wiring the brain &amp; educating the heart</p>
        <div class="hero__act"><button class="btn btn--primary" type="button" data-open-dialog>Sign Up for our Newsletter!</button></div>
      </div>
    </div>
  </section>

  <!-- the photographs sit right under the mark: four columns rising on their own, faded at the top and the bottom -->
  <section class="gallery" aria-label="From the sessions">
    <div class="container"><div class="gallery__stage" data-gallery>{gallery}</div></div>
  </section>

{tells}

  <section class="section ring" id="quote" aria-label="Quote">
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
      <ul class="voices grid reveal--stagger">{pile}</ul>
    </div>
  </section>
</main>

<footer class="close" id="contact">
  <div class="container"><div class="close__field reveal">
    <div class="grid close__grid">
      <p class="close__lead">Prepared for anything life has to offer.</p>
      <div class="close__sign">
        <svg class="close__mark" aria-hidden="true"><use href="#mark"/></svg>
        <h2 class="close__title" id="newsletterTitle">Sign Up for our Newsletter!</h2>
        {form('nl')}
      </div>
      <div class="close__reach">
        <a href="mailto:developmentalimprov@gmail.com"><svg class="icon" aria-hidden="true"><use href="#i-envelope-simple"/></svg>developmentalimprov<wbr>@gmail.com</a>
        <a href="tel:+18573523221"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg>(857) 352-3221</a>
        <!-- the page's second way in. Everything else here points at a newsletter; a teacher who wants this in their
             classroom had nowhere to go. No new address and no form to build — the one already on the page, with the
             subject written for them. -->
        <a class="btn btn--secondary close__ask" href="mailto:developmentalimprov@gmail.com?subject=Bringing%20Developmental%20Improvisation%20to%20our%20school">Bring this to your school</a>
      </div>
      <div class="close__foot">
        <p class="close__copy">© 2026 Developmental Improvisation</p>
      </div>
    </div>
  </div></div>
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
  <nav class="sheet__links" aria-label="Primary"><a href="#about">About</a><a href="#contact">Contact</a></nav>
  <button class="btn btn--primary" type="button" data-open-dialog data-close-menu>Subscribe</button>
</dialog>
</body>
</html>
'''
page=page.replace('{LBDATA}', lb_data())
open(f'{root}/index.html','w').write(page)
print('index.html', len(page.splitlines()), 'lines', len(page)//1024, 'KB')
