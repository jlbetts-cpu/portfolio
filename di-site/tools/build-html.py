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
POS={'yellow-trousers':'50% 40%','bow-tie-chairs':'25% 50%','circle-hands':'45% 50%','blue-shirts':'40% 50%','laugh-hat':'50% 30%','conga-line':'68% 45%','linda-laughing':'50% 30%','bow-ties-wall':'0% 50%','floor-game':'40% 60%','three-teens':'50% 45%','row-linked-arms':'50% 50%','scene-handshake':'22% 45%','linda-stage':'50% 30%','three-men':'50% 40%',
     'linda-portrait':'22% 40%','boy-fist':'50% 40%','kids-bw-small':'50% 50%','cast-stage-small':'50% 50%','linda-circle':'45% 50%','kids-dancing':'50% 50%','kids-running':'50% 50%','cast-pose':'50% 55%','two-lines':'52% 55%','zoom-group':'50% 55%','duo-brick':'50% 45%'}

USED=[]
def picture(name, sizes, lazy=True, cls='', ratio=None, button=True, big=False):
    m=man[name]; srcs=[w for w in m['sizes'] if big or w<=960]
    av=', '.join(f'images/{name}-{w}.avif {w}w' for w in srcs); wp=', '.join(f'images/{name}-{w}.webp {w}w' for w in srcs)
    load='loading="lazy" ' if lazy else 'fetchpriority="high" '
    img=(f'<img src="images/{m["jpeg"]}" width="{m["width"]}" height="{m["height"]}" alt="{html.escape(ALT[name])}" '
         f'{load}decoding="async">')
    pic=f'<picture><source type="image/avif" srcset="{av}" sizes="{sizes}"><source type="image/webp" srcset="{wp}" sizes="{sizes}">{img}</picture>'
    if not button: return pic
    if name not in USED: USED.append(name)
    return f'<button class="photo__open" type="button" data-photo="{name}" aria-label="Open photograph: {html.escape(ALT[name])}">{pic}</button>'
def lb_data():
    out={}
    for n in USED:
        m=man[n]; big=[w for w in m['sizes'] if w>=960] or [m['sizes'][-1]]
        out[n]={'avif':[[w,f'images/{n}-{w}.avif'] for w in big],'webp':[[w,f'images/{n}-{w}.webp'] for w in big],'jpeg':f'images/{m["jpeg"]}','w':m['width'],'h':m['height'],'alt':ALT[n]}
    return json.dumps(out,separators=(',',':'))

def photo(name, ratio, sizes, lazy=True, hover=False, caption=None, big=False, button=True):
    m=man[name]
    h=(f'<figure class="photo photo--{ratio}{" photo--hover" if hover else ""}" style="--pos:{POS[name]};background-image:url({m["placeholder"]})">'
       + picture(name,sizes,lazy,big=big,button=button) + (f'<figcaption class="photo__caption">{caption}</figcaption>' if caption else '') + '</figure>')
    return h

# The hero's bento: three columns of photographs that loop with the flow, plus two tiles of pure colour.
# Each column carries its contents twice; the second copy is aria-hidden and its first child marks the loop length.
BSIZES='(max-width: 767px) 44vw, (max-width: 1279px) 22vw, 15vw'
# fifteen photographs and no colour blocks: there are enough pictures. No two black-and-white ones adjacent in a column.
COLS=[
  ['yellow-trousers','blue-shirts','scene-handshake','linda-stage','circle-hands'],
  ['boy-fist','kids-bw-small','conga-line','three-teens','laugh-hat'],
  ['three-men','row-linked-arms','kids-running','floor-game','cast-pose'],
]
def bento_item(name, hidden, first, i):
    mid=' data-mid' if first else ''
    hid=' aria-hidden="true"' if hidden else ''
    # only the first two of each column are on screen before the panel crops them; the rest wait
    ph='' if hidden else f';background-image:url({man[name]["placeholder"]})'   # the second copy is behind the first: no placeholder needed
    return (f'<figure class="photo photo--4x5" style="--pos:{POS[name]}{ph}"{hid}{mid}>'
            + picture(name, BSIZES, lazy=hidden or i > 1, button=not hidden) + '</figure>')
def bento_col(i, items):
    body=''.join(bento_item(n,False,False,j) for j,n in enumerate(items)) + ''.join(bento_item(n,True,j==0,j) for j,n in enumerate(items))
    return f'<div class="bento__col" data-bento="{1 if i % 2 == 0 else -1}" style="--speed:{[1,.74,1.18][i]}">{body}</div>'
bento=''.join(bento_col(i,c) for i,c in enumerate(COLS))

# the quote ring: eight shaped photographs. A tilted photograph is scaled 1.45 to fill the rotated square, so it must have
# its subject at the centre and no dark ground: linda-portrait and kids-bw-small read as black shapes there and are out.
RING=['bow-tie-chairs','linda-laughing','cast-pose','floor-game','laugh-hat','cast-stage-small','three-men','duo-brick']
RSIZES='(max-width: 767px) 76px, (max-width: 1023px) 116px, 148px'
ring=''.join(f'<div class="ring__item"><figure class="photo photo--1x1 photo--circle" style="--pos:{POS[n]};background-image:url({man[n]["placeholder"]})">{picture(n,RSIZES)}</figure></div>' for n in RING)


P=[
 "Developmental Improvisation is a new, revolutionary tool for teaching cognitive development and social/emotional understanding using the art of improvisation designed specifically for the classroom.",
 "Created by educator Linda Kellogg Fulton, based on her fifty plus years working in improvisation, it offers students a unique, beneficial, and fascinating experience-based exploration into the realm of Social Emotional Learning through imaginative excursions and cooperative play.",
 "Developmental Improvisation provides participants an opportunity to experience all the probabilities of human behavior in realistic, authentic situations that come through a variety of safe, educational, and thrilling exercises and games.",
 "Developmental Improvisation provides balance to traditional education, offering students a vehicle for enhancing their intellect, cooperation, communication, and other skills by encouraging them to find solutions for any issues. This revolutionary approach to learning allows students to put their critical thinking and creative problem-solving to the test through spontaneously imaginative “What would you do?” situations.",
 "The end result is students growing in not just their intellect, but also their compassion and instinct, making for well-rounded individuals who will be prepared for anything life has to offer.",
 "All while having as much fun as possible!",
]
# ---- The four cards ----
# One row of the bento: four cards of the same shape, each one clickable, each carrying one of the logo's arcs.
# Two of them say what Developmental Improvisation is, one says what it asks of a student, one says who Linda is.
# The card shows a chip, a title, a summary and a photograph; the whole card opens a reader with the full copy,
# so the page keeps four short blocks instead of six long ones.
BS='(max-width: 767px) 68vw, (max-width: 1279px) 40vw, 21vw'
BRIEFS=[
 ('01','The method','violet','What Developmental Improvisation is',
  'A new tool for teaching cognitive development and social/emotional understanding through the art of improvisation.',
  [P[0]],'linda-circle'),
 ('02','In the room','orange','Inside a session',
  'Safe, educational, and thrilling exercises and games, built to let students meet the whole range of human behavior.',
  [P[2],P[5]],'kids-dancing'),
 ('03','The idea','green','\u201cWhat would you do?\u201d',
  'Spontaneously imaginative situations that put critical thinking and creative problem-solving to the test.',
  [P[3],P[4]],'two-lines'),
 ('04','The founder','pink','Who Linda is',
  'Educator Linda Kellogg Fulton created Developmental Improvisation out of fifty plus years working in improvisation.',
  [P[1]],'linda-portrait'),
]
def brief(num, chip, accent, title, summary, paras, photo_name):   # chip: kept in the data, not drawn — the title says it
    full=''.join(f'<p class="t-body">{p}</p>' for p in paras)
    return (f'<article class="brief reveal" data-accent="{accent}" aria-labelledby="brief-{num}">'
            f'<div class="brief__head">'
            f'<h2 class="brief__title" id="brief-{num}">{title}</h2>'
            f'<p class="brief__sum">{summary}</p></div>'
            f'<div class="brief__figure">{photo(photo_name, "4x5", BS, hover=True, button=False)}'
            f'<button class="brief__more" type="button" data-reader>Read more'
            f'<span class="brief__arrow" aria-hidden="true"><svg class="icon"><use href="#i-arrow-right"/></svg></span></button></div>'
            f'<div class="brief__full">{full}</div></article>')
briefs=''.join(brief(*b) for b in BRIEFS)

LOREM="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
quotes=[LOREM+" Ut enim ad minim veniam, quis nostrud.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod."]
# three tiles; the middle one carries the last of the six arcs, the other two are the raised ground
# three that read apart from each other: the first arc, the star, and the arc the eye has not seen for a screen
VOICES=[('magenta',quotes[0]),('gold',quotes[1]),('green',quotes[2])]
pile=''.join(f'<li class="voice reveal" data-accent="{a}" data-placeholder="true"><p class="voice__mark" aria-hidden="true">“</p><p class="voice__quote">{q}</p><div class="voice__who"><span class="voice__avatar" aria-hidden="true">FL</span><div><div class="voice__name">First Last</div><div class="voice__role">Role, Organization</div></div></div></li>' for a,q in VOICES)

form=lambda idp: (f'<form data-newsletter action="[NEWSLETTER_ACTION_URL]" method="post" novalidate><div class="field"><label class="sr-only" for="{idp}-email">Email</label>'
                  f'<input class="input" id="{idp}-email" type="email" name="email" placeholder="Email" autocomplete="email" required>'
                  f'<button class="btn btn--primary" type="submit">Subscribe</button></div><p class="field__message" aria-live="polite"></p></form>')

page=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Developmental Improvisation — New Tools for Cognitive Development &amp; Emotional Understanding</title>
<meta name="description" content="{html.escape(P[0])}">
<link rel="canonical" href="https://developmentalimprovisation.com/">
<meta name="theme-color" content="#131211">
<meta name="color-scheme" content="dark light">
<meta property="og:title" content="Developmental Improvisation">
<meta property="og:description" content="{html.escape(P[0])}">
<meta property="og:type" content="website">
<meta property="og:image" content="assets/og.png">
<link rel="icon" href="assets/logo/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="fonts/PlusJakartaSans-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/PlusJakartaSans-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/Jost-100-900.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css?v={STAMP}">
<link rel="stylesheet" href="css/base.css?v={STAMP}">
<link rel="stylesheet" href="css/components.css?v={STAMP}">
<link rel="stylesheet" href="css/home.css?v={STAMP}">
<script src="js/main.js?v={STAMP}" defer></script>
</head>
<body>
<script>(function(){{var h=document.documentElement,t=null,c=1;try{{t=localStorage.getItem('di:theme');c=!sessionStorage.getItem('di:curtain')}}catch(e){{}}h.dataset.theme=t==='light'?'light':'dark';h.classList.add('js');if(c&&!matchMedia('(prefers-reduced-motion: reduce)').matches)h.classList.add('curtaining')}})()</script>
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
  <section class="hero" id="top" aria-labelledby="heroTitle">
    <div class="container grid hero__grid">
      <div class="hero__head">
        <h1 class="hero__title" id="heroTitle">New tools for cognitive development &amp; emotional understanding</h1>
        <div class="hero__meta">
          <p class="hero__sub">Pre-wiring the brain &amp; educating the heart</p>
        </div>
        <div><button class="btn btn--primary" type="button" data-open-dialog>Sign Up for our Newsletter!</button></div>
      </div>
      <div class="hero__bento" id="gallery" data-accent="gold">{bento}</div>
    </div>
  </section>

  <section class="briefs" id="about" aria-label="About Developmental Improvisation">
    <div class="container grid briefs__row">{briefs}</div>
  </section>

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
      <p class="close__lead">Pre-wiring the brain &amp; educating the heart</p>
      <div class="close__sign">
        <svg class="close__mark" aria-hidden="true"><use href="#mark"/></svg>
        <h2 class="close__title" id="newsletterTitle">Sign Up for our Newsletter!</h2>
        {form('nl')}
      </div>
      <div class="close__reach">
        <p class="label">Contact</p>
        <a href="mailto:developmentalimprov@gmail.com"><svg class="icon" aria-hidden="true"><use href="#i-envelope-simple"/></svg>developmentalimprov@gmail.com</a>
        <a href="tel:+18573523221"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg>(857) 352-3221</a>
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

<dialog class="dialog card--tint" id="newsletterDialog" aria-labelledby="dialogTitle" data-accent="orange">
  <button class="dialog__close" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>
  <svg class="mark" aria-hidden="true"><use href="#mark"/></svg>
  <h2 id="dialogTitle" tabindex="-1">Sign Up for our Newsletter!</h2>
  {form('dlg')}
</dialog>

<dialog class="dialog reader" id="reader" aria-labelledby="readerTitle">
  <button class="dialog__close" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>
  <div class="reader__head"><h2 class="reader__title" id="readerTitle" tabindex="-1"></h2></div>
  <div class="reader__prose"></div>
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
