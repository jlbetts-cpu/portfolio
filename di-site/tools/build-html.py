# Generates index.html once from images/manifest.json + the copy. Dev tool; the output is committed and served static.
import json, html, datetime, re
root='/home/user/portfolio/di-site'
man=json.load(open(f'{root}/images/manifest.json'))
logo=open(f'{root}/assets/logo/inline-logo.html').read().strip()
navlogo=logo.replace(' role="img" aria-labelledby="logoTitle"><title id="logoTitle">Developmental Improvisation</title>', ' aria-hidden="true">')
assert navlogo!=logo
sprite=open(f'{root}/assets/icons.svg').read().strip()
star=re.search(r'<path[^>]*/>',open(f'{root}/assets/illustrations/star.svg').read()).group(0)
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
     'linda-portrait':'30% 35%','boy-fist':'50% 40%','linda-circle':'45% 50%','kids-dancing':'50% 50%','kids-running':'50% 50%','cast-pose':'50% 55%','two-lines':'52% 55%','zoom-group':'50% 55%','duo-brick':'50% 45%'}

def picture(name, sizes, lazy=True, cls='', ratio=None):
    m=man[name]; srcs=m['sizes']
    av=', '.join(f'images/{name}-{w}.avif {w}w' for w in srcs); wp=', '.join(f'images/{name}-{w}.webp {w}w' for w in srcs)
    load='loading="lazy" ' if lazy else 'fetchpriority="high" '
    img=(f'<img src="images/{m["jpeg"]}" width="{m["width"]}" height="{m["height"]}" alt="{html.escape(ALT[name])}" '
         f'{load}decoding="async">')
    return (f'<picture><source type="image/avif" srcset="{av}" sizes="{sizes}"><source type="image/webp" srcset="{wp}" sizes="{sizes}">{img}</picture>')

def photo(name, ratio, sizes, lazy=True, hover=False, caption=None):
    m=man[name]
    h=(f'<figure class="photo photo--{ratio}{" photo--hover" if hover else ""}" style="--pos:{POS[name]};background-image:url({m["placeholder"]})">'
       + picture(name,sizes,lazy) + (f'<figcaption class="photo__caption">{caption}</figcaption>' if caption else '') + '</figure>')
    return h

ORBIT=['yellow-trousers','bow-tie-chairs','circle-hands','blue-shirts','laugh-hat','conga-line','linda-portrait','boy-fist','floor-game','three-teens','row-linked-arms','scene-handshake','linda-stage','three-men']
OSIZES='(max-width: 767px) 128px, (max-width: 1440px) 16vw, 240px'
# one brand hue per frame; seven hues over fourteen slots, so no two neighbours share one and slot 13 (magenta) meets slot 0 (sky)
FRAMES=['sky','green','yellow','pink','orange','violet','magenta']*2
orbit=''.join(f'<div class="orbit__item" style="--i:{i}"><div class="orbit__card" style="--c:var(--c-{FRAMES[i]})"><div class="orbit__photo" style="--pos:{POS[n]};background-image:url({man[n]["placeholder"]})">{picture(n,OSIZES,lazy=i>4)}</div></div></div>' for i,n in enumerate(ORBIT))


P=[
 "Developmental Improvisation is a new, revolutionary tool for teaching cognitive development and social/emotional understanding using the art of improvisation designed specifically for the classroom.",
 "Created by educator Linda Kellogg Fulton, based on her fifty plus years working in improvisation, it offers students a unique, beneficial, and fascinating experience-based exploration into the realm of Social Emotional Learning through imaginative excursions and cooperative play.",
 "Developmental Improvisation provides participants an opportunity to experience all the probabilities of human behavior in realistic, authentic situations that come through a variety of safe, educational, and thrilling exercises and games.",
 "Developmental Improvisation provides balance to traditional education, offering students a vehicle for enhancing their intellect, cooperation, communication, and other skills by encouraging them to find solutions for any issues. This revolutionary approach to learning allows students to put their critical thinking and creative problem-solving to the test through spontaneously imaginative “What would you do?” situations.",
 "The end result is students growing in not just their intellect, but also their compassion and instinct, making for well-rounded individuals who will be prepared for anything life has to offer.",
 "All while having as much fun as possible!",
]
TS='(max-width: 767px) 45vw, (max-width: 1023px) 40vw, 240px'
def stack_card(num, accent, title, paras, extra, tiles):
    body=''.join(f'<p class="t-body">{p}</p>' for p in paras)
    tl=''.join(photo(t,'4x5',TS) for t in tiles)
    extra_html=('<div class="stack__extra">'+extra+'</div>') if extra else ''
    return (f'<article class="stack__card card card--accent" data-accent="{accent}" data-surface="accent" aria-labelledby="stack-{num}">'
            f'<div><span class="stack__num" aria-hidden="true">({num})</span><h2 class="stack__title" id="stack-{num}">{title}</h2><div class="stack__body">{body}</div>'
            f'{extra_html}</div>'
            f'<div class="stack__tiles">{tl}</div></article>')
chips3='<div class="chips">'+''.join(f'<span class="chip">{c}</span>' for c in ['critical thinking','creative problem-solving','cooperation','communication'])+'</div>'
btn4='<button class="btn btn--primary" type="button" data-open-dialog>Sign Up for our Newsletter!</button>'
stack=(stack_card('01','sky','Welcome to Developmental Improvisation',P[0:2],'',['linda-laughing','linda-circle'])
      +stack_card('02','green','Safe, educational, and thrilling exercises and games',P[2:3],'',['kids-dancing','kids-running'])
      +stack_card('03','yellow','“What would you do?”',P[3:4],chips3,['cast-pose','two-lines'])
      +stack_card('04','violet','The end result',P[4:6],btn4,['zoom-group','duo-brick']))

LOREM="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
quotes=[LOREM+" Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.", LOREM+" Ut enim ad minim veniam, quis nostrud.", LOREM, "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore.", "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod."]
# five cards in two rows; the rows touch only at rotated corners, so no quote is hidden under another card
POSE=[('0px','40px','-5deg','sky'),('380px','0px','3deg','green'),('760px','60px','-2deg','yellow'),('200px','368px','4deg','pink'),('600px','384px','-6deg','magenta')]
pile=''.join(f'<li class="pile__card card testimonial" data-placeholder="true" data-accent="{a}" style="--x:{x};--y:{y};--rot:{r}"><p class="testimonial__quote">“{q}”</p><div class="testimonial__who"><span class="testimonial__avatar" aria-hidden="true">FL</span><div><div class="testimonial__name">First Last</div><div class="testimonial__role">Role, Organization</div></div></div></li>' for q,(x,y,r,a) in zip(quotes,POSE))
pager=''.join(f'<svg class="star{" is-active" if i==0 else ""}" aria-hidden="true"><use href="#star"/></svg>' for i in range(5))

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
<meta name="theme-color" content="#1B1916">
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
<link rel="stylesheet" href="css/tokens.css?v={STAMP}">
<link rel="stylesheet" href="css/base.css?v={STAMP}">
<link rel="stylesheet" href="css/components.css?v={STAMP}">
<link rel="stylesheet" href="css/home.css?v={STAMP}">
<script src="js/main.js?v={STAMP}" defer></script>
</head>
<body>
<script>(function(){{var t=null;try{{t=localStorage.getItem('di:theme')}}catch(e){{}}var h=document.documentElement;h.dataset.theme=t==='dark'?'dark':'light';h.classList.add('js')}})()</script>
<a class="skip" href="#main">Skip to content</a>
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true"><symbol id="star" viewBox="489.5 285 57.8 66">{star}</symbol><symbol id="mark" viewBox="0 0 787 842">{whitemark_paths}</symbol></svg>
{sprite}

<header class="nav" id="nav" data-surface="ink">
  <div class="container nav__bar">
    <a class="nav__brand" href="/" aria-label="Developmental Improvisation, home">{navlogo}<span class="word">Developmental Improvisation</span></a>
    <nav class="nav__links" aria-label="Primary"><a href="/" aria-current="page">Home</a><a href="#gallery">Gallery</a><a href="#contact">Contact</a></nav>
    <div class="nav__actions"><button class="theme" type="button" data-theme-toggle aria-label="Switch to dark mode"><svg class="icon icon--moon" aria-hidden="true"><use href="#i-moon"/></svg><svg class="icon icon--sun" aria-hidden="true"><use href="#i-sun"/></svg></button><button class="btn btn--secondary btn--compact nav__subscribe" type="button" data-open-dialog>Subscribe</button><button class="btn btn--ghost btn--compact nav__menu" type="button" data-open-menu aria-expanded="false" aria-controls="menuSheet">Menu</button></div>
  </div>
</header>

<main id="main">
  <section class="hero" id="top" aria-labelledby="heroTitle">
    <div class="orbit__ring" id="gallery" aria-hidden="true">{orbit}</div>
    <div class="hero__copy">
      <h1 class="hero__title" id="heroTitle"><span class="sr-only">Developmental Improvisation. </span>New tools for cognitive development &amp; emotional understanding</h1>
      <p class="hero__sub">Pre-wiring the brain &amp; educating the heart</p>
      <div class="hero__actions"><button class="btn btn--primary" type="button" data-open-dialog>Sign Up for our Newsletter!</button><a class="btn btn--secondary" href="#contact">Contact</a></div>
    </div>
  </section>

  <section class="section" id="welcome" data-accent="sky" aria-labelledby="welcomeLabel">
    <div class="container">
      <p class="section__label reveal" id="welcomeLabel"><svg class="star" aria-hidden="true"><use href="#star"/></svg>Welcome</p>
      <div class="stack">{stack}</div>
    </div>
  </section>

  <section class="section quote" data-accent="pink" aria-label="Quote">
    <div class="container reveal">
      <blockquote class="quote__text">“Creativity in motion creates knowledge!”</blockquote>
      <p class="quote__who"><svg class="star" aria-hidden="true"><use href="#star"/></svg>Linda Kellogg Fulton</p>
    </div>
  </section>

  <section class="section" id="testimonials" data-accent="magenta" aria-labelledby="testimonialsLabel">
    <div class="container">
      <p class="section__label reveal" id="testimonialsLabel"><svg class="star" aria-hidden="true"><use href="#star"/></svg>Testimonials</p>
      <ul class="pile" tabindex="0" aria-label="Testimonials, scroll sideways on small screens">{pile}</ul>
      <div class="pile__pager" aria-hidden="true">{pager}</div>
    </div>
  </section>

  <section class="section" id="newsletter" data-accent="orange" aria-labelledby="newsletterTitle">
    <div class="container">
      <div class="newsletter card card--accent reveal" data-surface="accent">
        <div class="newsletter__head"><svg class="mark" aria-hidden="true"><use href="#mark"/></svg><h2 id="newsletterTitle">Sign Up for our Newsletter!</h2></div>
        <div class="newsletter__form">{form('nl')}</div>
      </div>
    </div>
  </section>

  <section class="section" id="contact" data-accent="green" aria-labelledby="contactTitle">
    <div class="container section__grid">
      <div class="col-head reveal">
        <p class="section__label"><svg class="star" aria-hidden="true"><use href="#star"/></svg>Contact</p>
        <h2 class="t-h2" id="contactTitle">To Find Out MORE!</h2>
        <p class="t-lead" style="margin-top:var(--sp-4)">Email or Call Here:</p>
      </div>
      <div class="col-body contact__actions reveal">
        <a class="btn btn--secondary" href="mailto:developmentalimprov@gmail.com"><svg class="icon" aria-hidden="true"><use href="#i-envelope-simple"/></svg>developmentalimprov@gmail.com</a>
        <a class="btn btn--secondary" href="tel:+18573523221"><svg class="icon" aria-hidden="true"><use href="#i-phone"/></svg>(857) 352-3221</a>
      </div>
    </div>
  </section>
</main>

<footer class="footer">
  <div class="container footer__grid">
    <div class="footer__brand"><svg class="mark" aria-hidden="true"><use href="#mark"/></svg><p class="footer__line">Pre-wiring the brain &amp; educating the heart</p><p class="footer__copy">© 2026 Developmental Improvisation</p></div>
    <nav class="footer__col footer__col--menu" aria-labelledby="footMenu"><h2 id="footMenu">Menu</h2><a href="/">Home</a><br><a href="#gallery">Gallery</a><br><a href="#contact">Contact</a></nav>
    <nav class="footer__col footer__col--contact" aria-labelledby="footContact"><h2 id="footContact">Contact</h2><a href="mailto:developmentalimprov@gmail.com">Email</a><br><a href="tel:+18573523221">Call</a><br><a href="#" aria-disabled="true">LinkedIn</a><br><a href="#" aria-disabled="true">Instagram</a><br><a href="#" aria-disabled="true">Facebook</a><br><a href="#" aria-disabled="true">X</a></nav>
  </div>
</footer>

<dialog class="dialog" id="newsletterDialog" aria-labelledby="dialogTitle" data-accent="orange" data-surface="accent">
  <button class="dialog__close" type="button" aria-label="Close"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></button>
  <svg class="mark" aria-hidden="true"><use href="#mark"/></svg>
  <h2 id="dialogTitle" tabindex="-1">Sign Up for our Newsletter!</h2>
  {form('dlg')}
</dialog>

<dialog class="sheet" id="menuSheet" aria-label="Menu">
  <div class="sheet__head"><svg class="mark" style="width:28px;height:30px;color:var(--ink)" aria-hidden="true"><use href="#mark"/></svg><button class="btn btn--ghost btn--compact" type="button" data-close-menu>Close</button></div>
  <nav class="sheet__links" aria-label="Primary"><a href="/">Home</a><a href="#gallery">Gallery</a><a href="#contact">Contact</a></nav>
  <button class="btn btn--primary" type="button" data-open-dialog data-close-menu>Subscribe</button>
</dialog>
</body>
</html>
'''
open(f'{root}/index.html','w').write(page)
print('index.html', len(page.splitlines()), 'lines', len(page)//1024, 'KB')
