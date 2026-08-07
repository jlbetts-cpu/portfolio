#!/usr/bin/env python3
"""Responsive computed-style contracts for Task 2 shared surfaces."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ROUTES = ("index.html", "bearings.html", "apollo.html", "cluster.html", "strata.html", "ucdavis.html")
VIEWPORTS = ((1440, 900), (390, 844), (320, 800))
MODES = ("light", "dark")
ARTIFACTS = Path("/tmp/shared-surfaces-browser")
GEOMETRY = {}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def alpha(color):
    if color == "transparent":
        return 0.0
    if color.startswith("rgba("):
        return float(color.removeprefix("rgba(").removesuffix(")").split(",")[-1])
    return 1.0


def verify(page, route, route_name, width, mode):
    page.goto(route, wait_until="domcontentloaded")
    page.wait_for_function("document.documentElement.classList.contains('theme-ready')")
    page.evaluate("mode => window.SiteTheme.setMode(mode === 'dark' ? 'night' : 'off', {persist:false})", mode)
    data = page.evaluate("""route => {
      const one=s=>document.querySelector(s), css=(n,p)=>getComputedStyle(n,p), box=n=>n.getBoundingClientRect();
      const controls=[...document.querySelectorAll('.tvTab,.sbBtn,.toTop,.skipLink,.playerTick')];
      const metric=n=>{const r=box(n);return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,
        radius:css(n).borderRadius,ground:css(n).backgroundColor,shadow:css(n).boxShadow,opacity:css(n).opacity}};
      return {
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
        controls:controls.map(n=>({cls:n.className,tag:n.tagName,h:box(n).height,w:box(n).width,
          border:css(n).borderTopWidth,radius:css(n).borderRadius,ground:css(n).backgroundColor})),
        collections:[...document.querySelectorAll('.collection')].slice(0,8).map(n=>({
          outer:metric(n),tabs:n.querySelector('.collection__tabs')?metric(n.querySelector('.collection__tabs')):null,
          content:n.querySelector('.collection__content')?metric(n.querySelector('.collection__content')):null,
          tabShadow:n.querySelector('.collection__tabs')?css(n.querySelector('.collection__tabs')).boxShadow:null,
          contentShadow:n.querySelector('.collection__content')?css(n.querySelector('.collection__content')).boxShadow:null
        })),
        media:[...document.querySelectorAll('.media--full,.media--mockup')].slice(0,8).map(n=>({cls:n.className,box:metric(n),image:n.querySelector('img')?{
          box:metric(n.querySelector('img')),src:n.querySelector('img').currentSrc,naturalWidth:n.querySelector('img').naturalWidth,
          display:css(n.querySelector('img')).display,visibility:css(n.querySelector('img')).visibility,filter:css(n.querySelector('img')).filter}:null})),
        toolbars:[...document.querySelectorAll('.carousel-toolbar')].map(n=>({box:metric(n),label:n.getAttribute('aria-label'),
          children:[...n.querySelectorAll('button')].map(b=>({box:metric(b),shadow:css(b).boxShadow,border:css(b).borderTopWidth}))})),
        home:route==='index.html'?{
          nav:metric(one('.jbNav')),hero:metric(one('.surface--hero')),cases:metric(one('.collection')),
          atmosphere:metric(one('.heroTimeClip')),
          tabs:metric(one('.collection__tabs')),frame:metric(one('.csFrame')),
          copy:metric(one('.heroCopy')),ctas:metric(one('.heroCtas')),
          primary:metric(one('#workBtn')),time:metric(one('#heroTimeBtn')),
          skip:metric(one('.skipLink')),heroAfter:{shadow:css(one('.surface--hero'),'::after').boxShadow,
            border:css(one('.surface--hero'),'::after').borderTopWidth},
          peek:(()=>{const p=one('.heroCharacterPeek'),w=one('.heroCharacterPeek .stagewrap'),s=one('#stage'),f=one('#face'),h=box(one('.surface--hero')),
            r=box(p),wr=box(w),sr=box(s),fr=box(f);return{display:css(p).display,heroTop:h.top,heroBottom:h.bottom,
              left:wr.left,right:wr.right,top:wr.top,bottom:wr.bottom,width:wr.width,height:wr.height,
              stageLeft:sr.left,stageRight:sr.right,faceTop:fr.top,faceHeight:fr.height,
              src:f.currentSrc||f.getAttribute('src'),alt:f.getAttribute('alt'),eyes:s.querySelectorAll('.eye').length};})(),
          stars:(()=>{const field=one('.heroNightStars'),points=[...field.querySelectorAll('i')],r=box(field),s=css(field);return{
            count:points.length,left:r.left,right:r.right,top:r.top,bottom:r.bottom,opacity:s.opacity,contain:s.contain,
            animations:points.map(n=>css(n).animationName),bright:points.filter(n=>n.classList.contains('is-bright')).length};})()
        }:null,
        ticks:[...document.querySelectorAll('.playerTick')].map(n=>({tag:n.tagName,w:box(n).width,h:box(n).height,
          markW:parseFloat(css(n,'::before').width),markH:parseFloat(css(n,'::before').height)}))
      };
    }""", route_name)
    assert data["overflow"] <= 1, (route, width, mode, data["overflow"])
    for control in data["controls"]:
        assert control["tag"] in ("BUTTON", "A") and control["h"] >= 43.5, (route, control)
        assert control["border"] == "0px", (route, control)
    expected_outer_radius = "28px" if width == 1440 else "20px"
    expected_media_radius = "20px" if width == 1440 else "14px"
    for collection in data["collections"]:
        assert collection["outer"]["radius"] == expected_outer_radius, (route, collection)
        assert alpha(collection["outer"]["ground"]) == 1 and collection["outer"]["shadow"] != "none", (route, collection)
        assert collection["tabs"] and collection["content"], (route, collection)
        assert collection["tabs"]["radius"] == "0px" and collection["content"]["radius"] == "0px", collection
        assert collection["tabShadow"] != "none" and collection["contentShadow"] == "none", collection
    for media in data["media"]:
        if "collection__content" not in media["cls"]:
            assert media["box"]["radius"] == expected_media_radius, (route, media)
        if media["image"]:
            assert media["image"]["naturalWidth"] > 0 and media["image"]["display"] != "none", (route, media)
            assert media["image"]["visibility"] == "visible" and media["image"]["box"]["opacity"] == "1", (route, media)
    for toolbar in data["toolbars"]:
        assert toolbar["label"] and toolbar["box"]["shadow"] != "none", (route, toolbar)
        assert len(toolbar["children"]) >= 3
        for child in toolbar["children"]:
            assert child["box"]["height"] >= 43.5 and child["box"]["width"] >= 43.5, child
            assert child["shadow"] == "none" and child["border"] == "0px", child
    for tick in data["ticks"]:
        assert tick["tag"] == "BUTTON" and tick["w"] >= 43.5 and tick["h"] >= 43.5, tick
        assert abs(tick["markW"] - 14) <= .5 and abs(tick["markH"] - 2) <= .5, tick
    if data["home"]:
        home = data["home"]
        peek = home["peek"]
        expected_edge = 120 if width == 1440 else 16
        expected_hero_radius = expected_outer_radius
        assert home["skip"]["bottom"] <= 0, home["skip"]
        assert home["nav"]["shadow"] != "none" and home["nav"]["radius"] == "999px", home["nav"]
        assert home["hero"]["shadow"] == "none" and home["hero"]["radius"] == expected_hero_radius, home["hero"]
        assert abs(home["nav"]["top"] - 8) <= .5 and abs(home["nav"]["height"] - 52) <= .5, home["nav"]
        assert abs(home["hero"]["top"] - home["nav"]["bottom"] - 12) <= .5, (home["nav"], home["hero"])
        if width > 760:
            assert abs(home["hero"]["bottom"] - (page.viewport_size["height"] - 16)) <= 1, home["hero"]
        assert home["nav"]["shadow"].count("inset") == 1, home["nav"]
        assert home["cases"]["radius"] == expected_outer_radius and home["tabs"]["radius"] == "0px", home
        assert home["frame"]["radius"] == "0px", home["frame"]
        assert home["heroAfter"]["shadow"] == "none" and home["heroAfter"]["border"] == "0px", home["heroAfter"]
        for name in ("nav", "hero", "cases", "tabs", "frame"):
            assert abs(home[name]["left"] - expected_edge) <= 1, (width, mode, name, home[name])
            assert abs(home[name]["right"] - (width - expected_edge)) <= 1, (width, mode, name, home[name])
        for name in ("primary", "time"):
            assert home[name]["height"] >= 43.5 and alpha(home[name]["ground"]) == 1, (name, home[name])
        assert abs(home["primary"]["top"] - home["time"]["top"]) <= .5, home
        assert abs(home["primary"]["bottom"] - home["time"]["bottom"]) <= .5, home
        if width > 760:
            copy_center = (home["copy"]["top"] + home["copy"]["bottom"]) / 2
            copy_position = (copy_center - home["hero"]["top"]) / home["hero"]["height"]
            assert .34 <= copy_position <= .48 and home["ctas"]["bottom"] < home["hero"]["top"] + home["hero"]["height"] * .6, home
        page.mouse.click(width / 2, 2)
        page.locator(".skipLink").evaluate("n=>n.focus()")
        programmatic_skip = page.locator(".skipLink").evaluate("n=>{const r=n.getBoundingClientRect();return{bottom:r.bottom,visible:n.matches(':focus-visible')}}")
        assert programmatic_skip["bottom"] <= 0, programmatic_skip
        page.locator(".skipLink").evaluate("n=>n.blur()")
        page.mouse.click(1, 1)
        page.keyboard.press("Tab")
        page.wait_for_function("getComputedStyle(document.querySelector('.skipLink')).transform === 'none'", timeout=1000)
        focused_skip = page.locator(".skipLink").evaluate("n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,active:document.activeElement===n}}")
        assert focused_skip["active"] and focused_skip["top"] >= 0 and focused_skip["bottom"] > focused_skip["top"], focused_skip
        page.locator(".skipLink").evaluate("n=>n.blur()")
        page.wait_for_function("document.querySelector('.skipLink').getBoundingClientRect().bottom <= 0", timeout=1000)
        assert peek["display"] != "none" and peek["src"] and "neutral" in peek["src"], peek
        assert peek["alt"] == "Jayden Betts" and peek["eyes"] >= 2, peek
        assert abs((peek["left"] + peek["right"]) / 2 - width / 2) <= 2, peek
        assert peek["width"] >= (500 if width == 1440 else 270), peek
        assert peek["top"] < peek["heroBottom"] < peek["bottom"], peek
        visible_ratio = (peek["heroBottom"] - max(peek["top"], peek["heroTop"])) / peek["height"]
        face_cutoff = (peek["heroBottom"] - peek["faceTop"]) / peek["faceHeight"]
        if width > 760:
            assert .52 <= visible_ratio <= .72, peek
            assert .59 <= face_cutoff <= .65, peek
        else:
            assert .62 <= visible_ratio <= .67, peek
            assert .62 <= face_cutoff <= .67, peek
        stars = home["stars"]
        assert 28 <= stars["count"] <= 36 and 3 <= stars["bright"] <= 7, stars
        assert stars["left"] >= home["hero"]["left"] and stars["right"] <= home["hero"]["right"], stars
        assert stars["top"] >= home["hero"]["top"] and stars["bottom"] <= home["hero"]["bottom"], stars
        assert stars["contain"] == "strict" and all(name == "none" for name in stars["animations"]), stars
        assert stars["opacity"] == ("1" if mode == "dark" else "0"), stars
        atmosphere = home["atmosphere"]
        for edge in ("left", "right", "top", "bottom"):
            assert abs(atmosphere[edge] - home["hero"][edge]) <= 1, (edge, atmosphere, home["hero"])
        assert atmosphere["radius"] == home["hero"]["radius"], (atmosphere, home["hero"])
        assert abs((atmosphere["left"] + atmosphere["right"]) / 2 - (peek["left"] + peek["right"]) / 2) <= 1, (atmosphere, peek)

        page.locator("#heroTimeBtn").click()
        menu = page.locator("#heroTimeMenu").evaluate("n=>{const r=n.getBoundingClientRect(),b=document.querySelector('#heroTimeBtn').getBoundingClientRect(),s=getComputedStyle(n);return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,buttonBottom:b.bottom,overflow:s.overflowY,radius:s.borderRadius}}")
        assert menu["top"] >= menu["buttonBottom"] and menu["bottom"] <= page.viewport_size["height"] - 1, menu
        assert menu["left"] >= 15 and menu["right"] <= width - 15 and menu["overflow"] == "auto", menu
        assert menu["radius"] == "20px", menu
        page.keyboard.press("Escape")

        if width == 320:
            for tab in page.locator(".collection__tabs > .ctl--tab").all():
                bounds = tab.bounding_box()
                assert bounds and bounds["x"] >= 15.5 and bounds["x"] + bounds["width"] <= 304.5, bounds
        page.screenshot(path=str(ARTIFACTS / f"home-{width}-{mode}.png"), full_page=False)
        if mode == "light":
            for state in ("pre-dawn", "sunrise", "daytime", "dusk", "sunset"):
                page.evaluate("state => window.SiteTheme.setMode(state, {persist:false})", state)
                seam = page.locator(f'.heroTimeGradient[data-time-gradient="{state}"]').evaluate("n=>{const r=n.getBoundingClientRect(),h=document.querySelector('.surface--hero').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,heroLeft:h.left,heroRight:h.right,heroTop:h.top,heroBottom:h.bottom,opacity:getComputedStyle(n).opacity}}")
                assert seam["opacity"] == "1", (state, seam)
                for a,b in (("left","heroLeft"),("right","heroRight"),("top","heroTop"),("bottom","heroBottom")):
                    assert abs(seam[a] - seam[b]) <= 1, (state, seam)
            page.evaluate("window.SiteTheme.setMode('off', {persist:false})")
        page.locator("#cases").scroll_into_view_if_needed()
        page.screenshot(path=str(ARTIFACTS / f"home-work-{width}-{mode}.png"), full_page=False)
    elif page.locator(".player,.tv,.demoWrap").count():
        content = page.locator(".content").first.bounding_box()
        for selector in (".media--full", ".collection", ".playerStage.media--mockup"):
            if page.locator(selector).count() and content:
                bounds = page.locator(selector).first.bounding_box()
                assert bounds and abs(bounds["x"] - content["x"]) <= 1 and abs((bounds["x"] + bounds["width"]) - (content["x"] + content["width"])) <= 1, (route_name, selector, bounds, content)
        if page.locator(".player").count():
            image = page.locator(".player .scene-swap-target").first
            before_box = image.bounding_box()
            before_src = image.get_attribute("src")
            page.locator(".player .carousel-toolbar button[data-dir='1']").first.evaluate("n=>n.click()")
            page.wait_for_function("src => document.querySelector('.player .scene-swap-target').getAttribute('src') !== src", arg=before_src)
            after_box = image.bounding_box()
            assert before_box and after_box and abs(before_box["width"] - after_box["width"]) <= 1 and abs(before_box["height"] - after_box["height"]) <= 1
        page.locator(".player,.tv,.demoWrap").first.scroll_into_view_if_needed()
        page.wait_for_function("""() => {
          const host=document.querySelector('.player,.tv,.demoWrap');
          const image=host&&host.querySelector('img');
          return !image || (image.complete && image.naturalWidth > 0);
        }""")
        page.screenshot(path=str(ARTIFACTS / f"{route_name[:-5]}-{width}-{mode}.png"), full_page=False)
        if page.locator(".player,.tv").count():
            page.locator(".player,.tv").first.screenshot(path=str(ARTIFACTS / f"{route_name[:-5]}-component-{width}-{mode}.png"))

    geometry = {
        "collections": [(c["outer"]["width"], c["outer"]["radius"], c["tabs"]["height"], c["content"]["width"]) for c in data["collections"]],
        "media": [(m["box"]["width"], m["box"]["height"], m["box"]["radius"]) for m in data["media"]],
        "toolbars": [(t["box"]["width"], t["box"]["height"], len(t["children"])) for t in data["toolbars"]],
    }
    key = (route_name, width)
    if mode == "light":
        GEOMETRY[key] = geometry
    else:
        assert geometry == GEOMETRY[key], (route_name, width, GEOMETRY[key], geometry)


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_port}/"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            for width, height in VIEWPORTS:
                for mode in MODES:
                    context = browser.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce")
                    page = context.new_page()
                    for route in ROUTES:
                        verify(page, base + route, route, width, mode)
                    context.close()
            for motion_width, motion_height in VIEWPORTS:
                motion_context = browser.new_context(viewport={"width": motion_width, "height": motion_height}, reduced_motion="no-preference")
                motion_context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
                motion_page = motion_context.new_page()
                motion_page.emulate_media(reduced_motion="no-preference")
                motion_page.goto(base + "index.html", wait_until="domcontentloaded")
                assert not motion_page.evaluate("matchMedia('(prefers-reduced-motion:reduce)').matches")
                motion_page.wait_for_function("document.querySelectorAll('#stage .eye').length >= 2")
                motion_page.evaluate("window.SiteTheme.setMode('night', {persist:false})")
                motion_page.wait_for_function("getComputedStyle(document.querySelector('.heroNightStars i')).animationName === 'heroStarTwinkle'")
                phase_a = motion_page.evaluate("""() => {const field=document.querySelector('.heroNightStars'),animations=field.getAnimations({subtree:true});animations.forEach(a=>{a.pause();a.currentTime=0});return[...field.querySelectorAll('i')].map(n=>parseFloat(getComputedStyle(n).opacity));}""")
                motion_page.locator(".surface--hero").screenshot(path=str(ARTIFACTS / f"home-night-twinkle-a-{motion_width}.png"))
                phase_b = motion_page.evaluate("""() => {const field=document.querySelector('.heroNightStars'),animations=field.getAnimations({subtree:true});animations.forEach(a=>{a.currentTime=a.effect.getTiming().duration*.5});return[...field.querySelectorAll('i')].map(n=>parseFloat(getComputedStyle(n).opacity));}""")
                twinkle_delta = max(abs(a-b) for a,b in zip(phase_a, phase_b))
                assert .02 <= twinkle_delta <= .16, (motion_width, twinkle_delta, phase_a, phase_b)
                motion_page.locator(".surface--hero").screenshot(path=str(ARTIFACTS / f"home-night-twinkle-b-{motion_width}.png"))
                motion_page.evaluate("document.querySelector('.heroNightStars').getAnimations({subtree:true}).forEach(a=>a.play())")
                hero_box = motion_page.locator(".surface--hero").bounding_box()
                assert hero_box
                motion_page.mouse.move(hero_box["x"] + hero_box["width"] * .25, hero_box["y"] + hero_box["height"] * .72)
                motion_page.wait_for_timeout(120)
                before_gaze = motion_page.locator("#stage .iris").first.evaluate("n=>n.style.transform")
                motion_page.mouse.move(hero_box["x"] + hero_box["width"] * .75, hero_box["y"] + hero_box["height"] * .72)
                motion_page.wait_for_function("before => document.querySelector('#stage .iris').style.transform !== before", arg=before_gaze)
                motion_page.locator("#face").evaluate("n=>n.click()")
                motion_page.wait_for_function("[...document.querySelectorAll('.dlogo')].some(n=>parseFloat(getComputedStyle(n).opacity)>.1)")

                motion_page.reload(wait_until="domcontentloaded")
                motion_page.wait_for_function("document.querySelectorAll('#stage .eye').length >= 2")
                motion_page.locator(".csGo").first.evaluate("n=>n.focus()")
                motion_page.wait_for_function("/smile\\.webp$/.test(document.querySelector('#face').getAttribute('src'))")
                motion_page.locator(".csGo").first.evaluate("n=>n.blur()")
                motion_page.locator(".csTab[data-tab='goodness']").evaluate("n=>n.click()")
                rest_transform = motion_page.locator(".heroCharacterPeek").evaluate("n=>getComputedStyle(n).transform")
                motion_page.locator("#reelFrame").evaluate("n=>n.focus()")
                assert motion_page.locator("#reelFrame").evaluate("n=>document.activeElement===n")
                motion_page.wait_for_function("document.querySelector('.heroCharacterPeek').classList.contains('is-movie') && document.querySelector('#glasses').classList.contains('on') && document.querySelector('.popbucket')")
                motion_page.wait_for_function("document.querySelector('.heroCharacterPeek').hasAttribute('data-movie-tick')")
                motion_page.wait_for_function("parseFloat(document.querySelector('.popbucket').style.opacity) > 0")
                assert motion_page.locator(".heroCharacterPeek").evaluate("n=>getComputedStyle(n).transform") != rest_transform
                motion_page.locator(".surface--hero").screenshot(path=str(ARTIFACTS / f"home-movie-{motion_width}.png"))
                motion_page.locator("#reelFrame").evaluate("n=>n.blur()")
                motion_page.wait_for_function("!document.querySelector('.heroCharacterPeek').classList.contains('is-movie')")
                motion_page.wait_for_function("rest => getComputedStyle(document.querySelector('.heroCharacterPeek')).transform === rest", arg=rest_transform)
                motion_context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"Shared surface browser contract: OK ({ARTIFACTS})")


if __name__ == "__main__":
    main()
