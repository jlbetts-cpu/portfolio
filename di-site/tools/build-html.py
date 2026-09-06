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
def picture(name, sizes, lazy=True, cls='', ratio=None, button=True):
    m=man[name]; srcs=[w for w in m['sizes'] if w<=960]
    av=', '.join(f'images/{name}-{w}.avif {w}w' for w in srcs); wp=', '.join(f'images/{name}-{w}.webp {w}w' for w in srcs)
    load='loading="lazy" ' if lazy else 'fetchpriority="high" '
    img=(f'<img src="images/{m["jpeg"]}" width="{m["width"]}" height="{m["height"]}" alt="{html.escape(ALT[name])}" '
         f'{load}decoding="async">')
    pic=f'<picture><source type="image/avif" srcset="{av}" sizes="{sizes}"><source type="image/webp" srcset="{wp}" sizes="{sizes}">{img}</picture>'
    if name not in USED: USED.append(name)
    if not button: return pic
    return f'<button class="photo__open" type="button" data-photo="{name}" aria-label="Open photograph: {html.escape(ALT[name])}">{pic}</button>'
def lb_data():
    out={}
    for n in USED:
        m=man[n]; big=[w for w in m['sizes'] if w>=960] or [m['sizes'][-1]]
        out[n]={'avif':[[w,f'images/{n}-{w}.avif'] for w in big],'webp':[[w,f'images/{n}-{w}.webp'] for w in big],'jpeg':f'images/{m["jpeg"]}','w':m['width'],'h':m['height'],'alt':ALT[n]}
    return json.dumps(out,separators=(',',':'))

def photo(name, ratio, sizes, lazy=True, hover=False, caption=None):
    m=man[name]
    h=(f'<figure class="photo photo--{ratio}{" photo--hover" if hover else ""}" style="--pos:{POS[name]};background-image:url({m["placeholder"]})">'
       + picture(name,sizes,lazy) + (f'<figcaption class="photo__caption">{caption}</figcaption>' if caption else '') + '</figure>')
    return h

# The hero's bento: three columns of photographs that loop with the flow, plus two tiles of pure colour.
# Each column carries its contents twice; the second copy is aria-hidden and its first child marks the loop length.
BSIZES='(max-width: 767px) 44vw, (max-width: 1279px) 22vw, 15vw'
COLS=[
  [('p','yellow-trousers'),('t','sky'),('p','three-men'),('p','blue-shirts'),('p','linda-stage')],
  [('p','circle-hands'),('p','boy-fist'),('t','gold'),('p','conga-line'),('p','scene-handshake')],
  [('p','laugh-hat'),('p','floor-game'),('p','row-linked-arms'),('p','three-teens'),('p','kids-bw-small')],
]
def bento_item(kind, name, hidden, first):
    mid=' data-mid' if first else ''
    if kind == 't':
        return f'<div class="tile" data-accent="{name}" aria-hidden="true" style="aspect-ratio:1"{mid}></div>'
    hid=' aria-hidden="true"' if hidden else ''
    return (f'<figure class="photo photo--4x5" style="--pos:{POS[name]};background-image:url({man[name]["placeholder"]})"{hid}{mid}>'
            + picture(name, BSIZES, lazy=hidden, button=not hidden) + '</figure>')
def bento_col(i, items):
    body=''.join(bento_item(k,n,False,False) for k,n in items) + ''.join(bento_item(k,n,True,j==0) for j,(k,n) in enumerate(items))
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
TS='(max-width: 767px) 62vw, 22vw'   # the photograph sits inside the colour panel: 304px wide at 1440
def stack_card(num, accent, title, paras, extra, photo_name):
    body=''.join(f'<p class="t-body">{p}</p>' for p in paras)
    extra_html=('<div>'+extra+'</div>') if extra else ''
    return (f'<article class="stack__card card card--line grid" data-accent="{accent}" aria-labelledby="stack-{num}">'
            f'<div class="stack__head"><h2 class="stack__title" id="stack-{num}">{title}</h2><div class="stack__body">{body}</div>'
            f'{extra_html}</div>'
            f'<div class="stack__figure">{photo(photo_name, "4x5", TS, hover=True)}</div></article>')
btn4='<button class="btn btn--primary" type="button" data-open-dialog>Sign Up for our Newsletter!</button>'
# the four cards take the logo's arcs in ring order, second through fifth
stack=(stack_card('01','violet','Welcome to Developmental Improvisation',P[0:2],'','linda-circle')
      +stack_card('02','orange','Safe, educational, and thrilling exercises and games',P[2:3],'','kids-dancing')
      +stack_card('03','green','“What would you do?”',P[3:4],'','two-lines')
      +stack_card('04','pink','The end result',P[4:6],btn4,'zoom-group'))

LOREM="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
quotes=[LOREM+" Ut enim ad minim veniam, quis nostrud.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod."]
# three tiles; the middle one carries the last of the six arcs, the other two are the raised ground
# three that read apart from each other: the first arc, the star, and the arc the eye has not seen for a screen
VOICES=[('magenta',quotes[0]),('gold',quotes[1]),('green',quotes[2])]
pile=''.join(f'<li class="voice" data-accent="{a}" data-placeholder="true"><p class="voice__mark" aria-hidden="true">“</p><p class="voice__quote">{q}</p><div class="voice__who"><span class="voice__avatar" aria-hidden="true">FL</span><div><div class="voice__name">First Last</div><div class="voice__role">Role, Organization</div></div></div></li>' for a,q in VOICES)

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
<meta name="theme-color" content="#F7F5F0">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="Developmental Improvisation">
<meta property="og:description" content="{html.escape(P[0])}">
<meta property="og:type" content="website">
<meta property="og:image" content="assets/og.png">
<link rel="icon" href="assets/logo/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="fonts/PlusJakartaSans-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/PlusJakartaSans-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/Sen-400-800.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/tokens.css?v={STAMP}">
<link rel="stylesheet" href="css/base.css?v={STAMP}">
<link rel="stylesheet" href="css/components.css?v={STAMP}">
<link rel="stylesheet" href="css/home.css?v={STAMP}">
<script src="js/main.js?v={STAMP}" defer></script>
</head>
<body>
<script>(function(){{var h=document.documentElement,t=null,c=1;try{{t=localStorage.getItem('di:theme');c=!sessionStorage.getItem('di:curtain')}}catch(e){{}}h.dataset.theme=t==='dark'?'dark':'light';h.classList.add('js');if(c&&!matchMedia('(prefers-reduced-motion: reduce)').matches)h.classList.add('curtaining')}})()</script>
<a class="skip" href="#main">Skip to content</a>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><symbol id="mark" viewBox="0 0 787 842">{whitemark_paths}</symbol></svg>
{sprite}

<header class="nav" id="nav">
  <div class="container nav__bar">
    <a class="nav__brand" href="/" aria-label="Developmental Improvisation, home">{navlogo}<span class="word">Developmental Improvisation</span></a>
    <nav class="nav__links" aria-label="Primary"><a href="#gallery">Gallery</a><a href="#contact">Contact</a></nav>
    <div class="nav__actions"><button class="theme" type="button" data-theme-toggle aria-label="Switch to dark mode"><svg class="icon icon--moon" aria-hidden="true"><use href="#i-moon"/></svg><svg class="icon icon--sun" aria-hidden="true"><use href="#i-sun"/></svg></button><button class="btn btn--secondary btn--compact nav__subscribe" type="button" data-open-dialog>Subscribe</button><button class="btn btn--ghost btn--compact nav__menu" type="button" data-open-menu aria-expanded="false" aria-controls="menuSheet">Menu</button></div>
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
      <div class="hero__bento" id="gallery">{bento}</div>
    </div>
  </section>

  <section class="section" id="welcome" aria-label="Welcome">
    <div class="container"><div class="stack">{stack}</div></div>
  </section>

  <section class="section ring" id="quote" aria-label="Quote">
    <div class="container">
      <div class="ring__stage">
        <div class="ring__orbit">{ring}</div>
        <div class="ring__centre"><div class="reveal">
          <blockquote class="ring__text">“Creativity in motion creates knowledge!”</blockquote>
          <p class="ring__who">Linda Kellogg Fulton</p>
        </div></div>
      </div>
    </div>
  </section>

  <section class="section" id="voices" aria-labelledby="voicesLabel">
    <div class="container">
      <div class="voices__head reveal"><p class="label" id="voicesLabel">Testimonials</p></div>
      <ul class="voices reveal">{pile}</ul>
    </div>
  </section>
</main>

<footer class="close" id="contact">
  <div class="close__field">
    <div class="grid close__grid">
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

<dialog class="dialog card--tint" id="newsletterDialog" aria-labelledby="dialogTitle" data-accent="orange">
  <button class="dialog__close" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>
  <svg class="mark" aria-hidden="true"><use href="#mark"/></svg>
  <h2 id="dialogTitle" tabindex="-1">Sign Up for our Newsletter!</h2>
  {form('dlg')}
</dialog>

<div class="curtain" aria-hidden="true">
  <div class="curtain__half curtain__half--l"></div>
  <div class="curtain__half curtain__half--r"></div>
  <div class="curtain__load"><svg class="mark" aria-hidden="true"><use href="#mark"/></svg><span class="curtain__bar"><i></i></span></div>
</div>

<dialog class="sheet" id="menuSheet" aria-label="Menu">
  <div class="sheet__head"><svg class="mark" style="width:28px;height:30px;color:var(--ink)" aria-hidden="true"><use href="#mark"/></svg><button class="btn btn--ghost btn--compact" type="button" data-close-menu>Close</button></div>
  <nav class="sheet__links" aria-label="Primary"><a href="#gallery">Gallery</a><a href="#contact">Contact</a></nav>
  <button class="btn btn--primary" type="button" data-open-dialog data-close-menu>Subscribe</button>
</dialog>
</body>
</html>
'''
page=page.replace('{LBDATA}', lb_data())
open(f'{root}/index.html','w').write(page)
print('index.html', len(page.splitlines()), 'lines', len(page)//1024, 'KB')
