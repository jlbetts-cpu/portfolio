#!/usr/bin/env python3
import math
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/hero-head-task3")
TASK4_SHOTS = Path("/tmp/hero-head-task4")
TRANSFORM_VIEWPORTS = (
    (1440, 900), (1280, 650), (761, 844),
    (760, 844), (390, 844), (320, 800),
)
TRANSFORM_THEMES = ("off", "night")
TOUCH_VIEWPORTS = ((390, 844), (320, 800))
ACCESSIBILITY_VIEWPORTS = ((1280, 650), (390, 844))


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


DRAWN_DOT = """name => {
  // WHERE THE SQUARE IS PAINTED, which is the only point anybody aims at. The
  // hit box is 44px and the dot is carried out of its centre toward the head's
  // true corner, so on a clipped or rotated frame the two are up to 18px apart
  // -- and pressing the box's centre tests a point the design never advertised.
  const node=name==='rotate'?document.querySelector('.heroHeadRotate')
    :document.querySelector('.heroHeadHandle[data-corner="'+name+'"]');
  const r=node.getBoundingClientRect(),b=getComputedStyle(node,'::before');
  return {x:r.left+parseFloat(b.left),y:r.top+parseFloat(b.top),
          size:parseFloat(b.width)||8};
}"""


def drawn_dot(page, name):
    return page.evaluate(DRAWN_DOT, name)


BODY_POINT = """() => {
  // A POINT THAT IS THE OBJECT AND NOT A HANDLE. Five 44px targets on a 136px
  // head overlap, and the interior belongs to the head -- a press more than one
  // target's reach from every drawn dot moves the portrait. This finds the
  // press point furthest from all of them so a "drag the head" test cannot
  // accidentally be testing a handle.
  const sel=document.querySelector('#heroHeadSelection').getBoundingClientRect();
  const dots=[...document.querySelectorAll('.heroHeadHandle,.heroHeadRotate')]
    .map(n=>{const r=n.getBoundingClientRect(),b=getComputedStyle(n,'::before');
      return {x:r.left+parseFloat(b.left),y:r.top+parseFloat(b.top)};});
  let best=null,widest=-1;
  for(let fx=0.1;fx<=0.9;fx+=0.1)for(let fy=0.1;fy<=0.9;fy+=0.1){
    const x=sel.left+sel.width*fx,y=sel.top+sel.height*fy;
    if(x<2||y<2||x>innerWidth-2||y>innerHeight-2)continue;
    const clear=Math.min(...dots.map(d=>Math.max(Math.abs(d.x-x),Math.abs(d.y-y))));
    if(clear>widest){widest=clear;best={x,y,clear};}
  }
  return best;
}"""


def body_point(page):
    return page.evaluate(BODY_POINT)


HIT_TALLY = {"hit": 0, "total": 0, "worst": []}


def assert_handle_hits(page, label):
    """Every drawn dot must be aimable.

    THE TEST IS THE DOT, NOT THE BOX. Nobody aims at an invisible 44px square;
    they aim at the 8px square they can see. This component has already shipped
    a version where the sw and se dots were painted ~30px OUTSIDE their own hit
    area -- permanently dead, not intermittent -- and elementFromPoint at the
    visible dot is the only probe that catches that.

    AND THE CORNER IT CHECKS AGAINST IS THE ROTATED ONE. The head rests turned,
    so the selection box's own corners are the corners of a bounding box, not of
    the head. Asserting the dot sits on those would be asserting the head is
    level, which it has not been since --hero-head-rest-rotate was wired.
    """
    page.wait_for_timeout(30)
    handles = page.evaluate(
        """label => {
          const selection=document.querySelector('#heroHeadSelection');
          const selectedRect=selection.getBoundingClientRect();
          const heroRect=document.querySelector('#main').getBoundingClientRect();
          const frame=document.querySelector('.heroHeadFrame');
          const num=name=>parseFloat(frame.style.getPropertyValue(name))||0;
          const angle=parseFloat(selection.style.getPropertyValue('--hero-head-rotate'))||0;
          const rad=angle*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
          const fw=num('--frame-w'),fh=num('--frame-h');
          const cx=selectedRect.left+num('--frame-x')+fw/2;
          const cy=selectedRect.top+num('--frame-y')+fh/2;
          const turn=(dx,dy)=>({x:cx+dx*cos-dy*sin,y:cy+dx*sin+dy*cos});
          return [...document.querySelectorAll('.heroHeadHandle,.heroHeadRotate')].map(handle => {
            const corner=handle.dataset.corner||'rotate';
            const rect=handle.getBoundingClientRect();
            const before=getComputedStyle(handle,'::before');
            const dot={x:rect.left+parseFloat(before.left),y:rect.top+parseFloat(before.top)};
            const size=parseFloat(before.width)||8;
            const truth=corner==='rotate'?turn(0,-fh/2)
              :turn(corner.endsWith('w')?-fw/2:fw/2,corner.startsWith('n')?-fh/2:fh/2);
            const centre={x:(rect.left+rect.right)/2,y:(rect.top+rect.bottom)/2};
            // The dot is carried from its hit-box centre TOWARD the head's true
            // rotated corner and never past it -- which holds whether or not the
            // artboard has cropped that corner off stage.
            // Per AXIS, because the CSS clamp is per axis: the offset that
            // carries the dot out to the corner is clamped in x and in y
            // independently, so the two can bottom out by different amounts
            // and the combined direction is not required to stay parallel.
            const toDot=[dot.x-centre.x,dot.y-centre.y];
            const toTruth=[truth.x-centre.x,truth.y-centre.y];
            const along=[0,1].every(i=>Math.abs(toTruth[i])<0.5
              ?Math.abs(toDot[i])<=0.5
              :toDot[i]*toTruth[i]>=-0.001
                &&Math.abs(toDot[i])<=Math.abs(toTruth[i])+0.5);
            const dotLen=Math.hypot(...toDot),truthLen=Math.hypot(...toTruth);
            // Sampled across the visible square, since that is the target the
            // visitor sees. Points that fall outside the VIEWPORT are skipped
            // rather than failed: elementFromPoint returns null there by
            // definition, and a dot pressed against the window edge whose
            // 10px circle overhangs it is not a broken handle.
            const points=[[0,0],[-size/2+.5,0],[size/2-.5,0],[0,-size/2+.5],[0,size/2-.5]];
            const hits=points.map(([dx,dy])=>{
              const px=dot.x+dx,py=dot.y+dy;
              if(px<0||py<0||px>=innerWidth||py>=innerHeight)return null;
              const node=document.elementFromPoint(px,py);
              return !!(node&&(node===handle||handle.contains(node)
                ||(node.closest&&node.closest('.heroHeadHandle,.heroHeadRotate'))));
            }).filter(hit=>hit!==null);
            const intersectionWidth=Math.max(0,
              Math.min(rect.right,selectedRect.right)-Math.max(rect.left,selectedRect.left));
            const intersectionHeight=Math.max(0,
              Math.min(rect.bottom,selectedRect.bottom)-Math.max(rect.top,selectedRect.top));
            const heroIntersectionWidth=Math.max(0,
              Math.min(rect.right,heroRect.right)-Math.max(rect.left,heroRect.left));
            const heroIntersectionHeight=Math.max(0,
              Math.min(rect.bottom,heroRect.bottom)-Math.max(rect.top,heroRect.top));
            return {
              label, corner, hits, angle,
              selectedIntersection:intersectionWidth*intersectionHeight,
              heroIntersection:heroIntersectionWidth*heroIntersectionHeight,
              area:rect.width*rect.height,
              // THE DOT MUST LIVE INSIDE ITS OWN TARGET. This single number is
              // the one that was ~30px wrong for two of the four corners.
              dotOutsideHit:Math.max(0,rect.left-dot.x,dot.x-rect.right,
                rect.top-dot.y,dot.y-rect.bottom),
              along, dotLen, truthLen,
              rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}
            };
          });
        }""",
        label,
    )
    for handle in handles:
        HIT_TALLY["total"] += len(handle["hits"])
        HIT_TALLY["hit"] += sum(handle["hits"])
        if not all(handle["hits"]):
            HIT_TALLY["worst"].append((label, handle["corner"], handle["hits"]))
    assert all(
        # REACHABILITY IS THE HERO, NOT THE BOX. A 44px target cannot fit inside
        # a selection box narrower than 44px, and at 320 with the head at
        # minimum scale the visible box measures about 27px -- the composition
        # already sits mostly past the left edge there. What has to hold is that
        # the target lies inside the region a pointer can reach and still
        # touches the frame it belongs to.
        handle["selectedIntersection"] > 0
        and handle["heroIntersection"] >= handle["area"] - 1
        and handle["dotOutsideHit"] <= 0.5
        and handle["along"]
        and handle["dotLen"] <= handle["truthLen"] + 0.5
        and all(handle["hits"])
        for handle in handles
    ), handles


GESTURE_TALLY = {"hit": 0, "total": 0}


def assert_handle_gestures(page, label):
    """Pressing the dot must start the gesture that dot advertises.

    Five 44px targets do not fit on a 136px head, so they overlap -- and paint
    order used to decide the overlap, which is how the rotate handle came to be
    dead at the resting composition on a 390 viewport (its dot sat 24px from the
    nw dot, entirely inside nw's target, and .heroHeadHandle paints above
    .heroHeadRotate). Real input only: the handlers use setPointerCapture, so a
    dispatched PointerEvent reports failure on working code.
    """
    for name in ("nw", "ne", "sw", "se", "rotate"):
        page.evaluate("window.__heroHeadTransform.reset()")
        page.wait_for_timeout(40)
        page.evaluate("window.__heroHeadTransform.stopFloat()")
        before = page.evaluate("window.__heroHeadTransform.getState()")
        dot = page.evaluate(
            """name => {
              const node=name==='rotate'?document.querySelector('.heroHeadRotate')
                :document.querySelector('.heroHeadHandle[data-corner="'+name+'"]');
              const r=node.getBoundingClientRect(),b=getComputedStyle(node,'::before');
              return {x:r.left+parseFloat(b.left),y:r.top+parseFloat(b.top)};
            }""",
            name,
        )
        page.mouse.move(dot["x"], dot["y"])
        page.mouse.down()
        page.mouse.move(dot["x"] + 18, dot["y"] + 18, steps=4)
        page.mouse.up()
        page.wait_for_timeout(60)
        after = page.evaluate("window.__heroHeadTransform.getState()")
        turned = abs(after["rotate"] - before["rotate"]) > 0.2
        scaled = abs(after["scale"] - before["scale"]) > 0.005
        started = "rotate" if turned else "resize" if scaled else "none"
        expected = "rotate" if name == "rotate" else "resize"
        GESTURE_TALLY["total"] += 1
        GESTURE_TALLY["hit"] += started == expected
        assert started == expected, (label, name, expected, started, before, after)
    page.evaluate("window.__heroHeadTransform.reset()")
    page.wait_for_timeout(40)


def drag_selection_to(page, x, y):
    box = page.locator("#heroHeadSelection").bounding_box()
    page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
    page.mouse.down()
    page.mouse.move(x, y, steps=5)
    page.mouse.up()


LEVEL_HEAD = """() => {
  // MEASURED LEVEL, WHATEVER THE HEAD IS DOING. getBoundingClientRect() on a
  // rotated element returns the TURNED bounding box, and slicing head-bounds
  // fractions out of that is not the head -- at the resting -13.8deg it reads
  // ~20% too wide. Every angle the wrapper carries is lifted for one read, the
  // same trick the module's own geom() uses. !important because the entrance
  // keyframe outranks an inline write.
  const wrap=document.querySelector('#heroHeadTransform');
  const names=['--hero-head-rotate','--hero-head-float-rot','--hero-head-enter-rot'];
  const saved=names.map(n=>[n,wrap.style.getPropertyValue(n),wrap.style.getPropertyPriority(n)]);
  names.forEach(n=>wrap.style.setProperty(n,'0deg','important'));
  const face=document.querySelector('#face'),r=face.getBoundingClientRect();
  const b=face.dataset.headBounds.split(/\s+/).map(Number);
  const out={x:r.left+r.width*b[0],y:r.top+r.height*b[1],
    left:r.left+r.width*b[0],top:r.top+r.height*b[1],
    right:r.left+r.width*b[2],bottom:r.top+r.height*b[3],
    width:r.width*(b[2]-b[0]),height:r.height*(b[3]-b[1])};
  saved.forEach(([n,v,pr])=>{if(v)wrap.style.setProperty(n,v,pr);else wrap.style.removeProperty(n);});
  return out;
}"""


def logical_head_rect(page):
    return page.evaluate(LEVEL_HEAD)


def rest_rotate(page):
    return page.evaluate(
        """() => parseFloat(getComputedStyle(document.documentElement)
             .getPropertyValue('--hero-head-rest-rotate'))"""
    )


def corner_point(rect, corner):
    return {
        "x": rect["x"] if corner.endswith("w") else rect["x"] + rect["width"],
        "y": rect["y"] if corner.startswith("n") else rect["y"] + rect["height"],
    }


def opposite_point(rect, corner):
    return corner_point(
        rect,
        {"nw": "se", "ne": "sw", "sw": "ne", "se": "nw"}[corner],
    )


def record(failures, condition, label, detail=None):
    if not condition:
        failures.append(f"{label}: {detail!r}")


def storage_snapshot(page):
    return page.evaluate(
        "() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))"
    )


def set_theme(page, theme):
    page.evaluate("state => window.SiteTheme.setMode(state,{persist:false})", theme)
    page.wait_for_function(
        "state => document.querySelector('#main').dataset.timeState === state", arg=theme
    )


def chrome_below_hero(page):
    """Does any selection chrome paint below the Hero's floor?

    THE PROBE HAS TO BE SOMEWHERE VISIBLE. It used to be clamped with
    min(height - 1, heroBottom + 2), which on a phone -- where the Hero fills
    the viewport -- silently turns "just below the floor" into "just above it",
    and the answer there is yes, of course the chrome is there: that is where
    the head lives. Scroll until there is a real pixel below the floor and ask
    about that one.
    """
    # PUT THE PAGE BACK EXACTLY WHERE IT WAS. The touch suite asserts that
    # dragging the head never scrolls the page, so a probe that leaves the
    # scroll position anywhere but where it found it fails the next assertion
    # rather than the thing it was testing.
    resting = page.evaluate("() => scrollY")
    page.evaluate("() => scrollBy(0, 120)")
    page.wait_for_timeout(60)
    hero = page.locator("#main").bounding_box()
    y = hero["y"] + hero["height"] + 2
    leaked = page.evaluate(
        """y => {
          const n = document.elementFromPoint(innerWidth / 2, y);
          return !!(n && (n.id === 'heroHeadSelection'
            || n.classList.contains('heroHeadHandle')
            || n.classList.contains('heroHeadRotate')));
        }""", y)
    page.evaluate("top => scrollTo(0, top)", resting)
    page.wait_for_function("top => Math.abs(scrollY - top) <= 1", arg=resting)
    return leaked


def selected_chrome(page):
    # The transform's own arrangement, without `box`: that is a derived
    # rectangle in viewport pixels and comparing it against a literal would make
    # this assertion about the viewport rather than about the state.
    return page.evaluate("""() => ({
      state: (({selected,x,y,scale,rotate}) => ({selected,x,y,scale,rotate}))
        (window.__heroHeadTransform.getState()),
      pressed: document.querySelector('#face').getAttribute('aria-pressed'),
      hidden: document.querySelector('#heroHeadSelection').hidden,
      tabs: [...document.querySelectorAll('.heroHeadHandle,.heroHeadRotate')].map(n => n.tabIndex)
    })""")


def assert_frame_welded(sample, label):
    """The chrome hugs the rigid rect, offset only by the uniform ring of air.

    Compared centre-to-centre and by extent rather than edge-to-edge: the ring
    is added in SCREEN pixels and never scaled, so the box is always exactly
    that much larger, and asserting the edges would just be asserting the same
    thing twice with the air spelled out four times.
    """
    rigid, selection, air = sample["rigid"], sample["selection"], sample["air"]
    for axis, near, far in (("width", "left", "right"), ("height", "top", "bottom")):
        rigid_centre = (rigid[near] + rigid[far]) / 2
        selection_centre = (selection[near] + selection[far]) / 2
        # One animation frame of float may separate the two reads.
        assert abs(rigid_centre - selection_centre) <= 2.5, (label, axis, sample)
        grew = selection[axis] - rigid[axis]
        # The ring of air is added to the frame BEFORE it is turned, so at an
        # angle it contributes to both axes -- up to air*2*(|cos|+|sin|).
        assert -1 <= grew <= air * 2 * 1.45 + 1, (label, axis, grew, sample)


def assert_authored_reset(page):
    """Home is not 0 on every axis.

    x, y and scale rest neutral because the resting composition is LAYOUT. The
    angle cannot be -- no layout property turns a box -- so rest is
    --hero-head-rest-rotate, and a reset that cleared it to 0 would put the head
    somewhere it has never been.
    """
    actual = selected_chrome(page)
    # A RELOAD RESTORES THE ARTBOARD, FRAME AND ALL. The head arrives already
    # framed -- that is the header's whole idea -- so "authored" here means
    # selected with a neutral transform, not a bare portrait.
    assert actual == {
        "state": {"selected": True, "x": 0, "y": 0, "scale": 1,
                  "rotate": rest_rotate(page)},
        "pressed": "true",
        "hidden": False,
        "tabs": [0, 0, 0, 0, 0],
    }, actual


def touch_drag(context, page, start, end):
    client = context.new_cdp_session(page)
    client.send("Input.dispatchTouchEvent", {
        "type": "touchStart",
        "touchPoints": [{"x": start["x"], "y": start["y"], "id": 1}],
    })
    for step in range(1, 6):
        progress = step / 5
        client.send("Input.dispatchTouchEvent", {
            "type": "touchMove",
            "touchPoints": [{
                "x": start["x"] + (end["x"] - start["x"]) * progress,
                "y": start["y"] + (end["y"] - start["y"]) * progress,
                "id": 1,
            }],
        })
    client.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})


def rect_snapshot(page):
    return page.evaluate("""() => {
      const LEVEL_HEAD_FN=""" + LEVEL_HEAD + """;
      const rect=n=>{const r=n.getBoundingClientRect();return {
        left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      return {hero:rect(document.querySelector('#main')),
        copy:rect(document.querySelector('.heroCopy')),
        logical:LEVEL_HEAD_FN(),
        selection:document.querySelector('#heroHeadSelection').hidden?null:
          rect(document.querySelector('#heroHeadSelection'))};
    }""")


def select_move_resize(page):
    face = page.locator("#face")
    box = face.bounding_box()
    page.mouse.click(box["x"] + box["width"] * .5, box["y"] + box["height"] * .3)
    page.wait_for_function("!document.querySelector('#heroHeadSelection').hidden")
    frame = page.locator("#heroHeadSelection").bounding_box()
    page.mouse.move(frame["x"] + frame["width"] / 2, frame["y"] + frame["height"] / 2)
    page.mouse.down()
    page.mouse.move(frame["x"] + frame["width"] / 2 + 24,
                    frame["y"] + frame["height"] / 2 - 12, steps=4)
    page.mouse.up()
    # OUTWARD ALONG THE HEAD'S OWN DIAGONAL. A fixed +20,+20 grows the portrait
    # only while the se corner happens to point down-right; once the head is
    # rotated, or its corner is riding a clipped edge, the same drag can shrink
    # it. Pushing away from the anchor is what "make it bigger" means at any
    # angle.
    before = logical_head_rect(page)
    anchor = opposite_point(before, "se")
    handle = drawn_dot(page, "se")
    vx, vy = handle["x"] - anchor["x"], handle["y"] - anchor["y"]
    span = math.hypot(vx, vy) or 1
    page.mouse.move(handle["x"], handle["y"])
    page.mouse.down()
    page.mouse.move(handle["x"] + vx / span * 56, handle["y"] + vy / span * 56, steps=4)
    page.mouse.up()
    page.wait_for_timeout(40)
    return page.evaluate("window.__heroHeadTransform.getState()")


def rest_pose_contract():
    """The resting pose is authored in one file and has to be consumed.

    --hero-head-rest-rotate shipped once as a declaration nothing read: the
    token said -13.8deg and liveRotate said 0deg, which is indistinguishable
    from "not implemented" to everyone except the person reading the CSS. These
    assertions are cheap and they are what makes that state impossible.
    """
    time_css = (ROOT / "hero-time.css").read_text(encoding="utf-8")
    controls = (ROOT / "controls.css").read_text(encoding="utf-8")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    transform = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
    assert "--hero-head-rest-rotate:" in time_css
    # Consumed by the transform state, so reset() and the entrance land on it.
    assert '"--hero-head-rest-rotate"' in transform, "the rest angle must be read by JS"
    assert "state.rotate=restRotate()" in transform
    assert "state.x=0;state.y=0;state.scale=1;state.rotate=restRotate();" in transform
    # And consumed by the stylesheet, so the first paint is already tilted.
    assert "#heroHeadTransform{--hero-head-rotate:var(--hero-head-rest-rotate)}" in time_css

    # ── SPECIFICITY IS A CORRECTNESS PROPERTY HERE ────────────────────────────
    # controls.css links AFTER hero-time.css and declares its own
    # .heroHeadTransform{transform:...}. A class selector in hero-time.css
    # therefore reads perfectly and loses -- which is exactly what happened: the
    # float and the entrance were composed into a transform that never won a
    # declaration, so the selection frame drifted ~10px off a head that never
    # moved. An ID is the fix and this is the guard.
    assert html.index('href="hero-time.css') < html.index('href="controls.css'), \
        "the ID selectors below exist because controls.css links later"
    assert ".heroHeadTransform{" in controls
    assert "#heroHeadTransform{\n transform:translate3d(" in time_css, \
        "the float/entrance transform must out-specify controls.css"
    for term in ("var(--hero-head-float-x,0px)", "var(--hero-head-float-y,0px)",
                 "var(--hero-head-enter-y,0px)", "var(--hero-head-float-rot,0deg)",
                 "var(--hero-head-enter-rot,0deg)"):
        assert term in time_css, term

    # ── THE ENTRANCE LANDS ON REST, IT DOES NOT REDEFINE IT ───────────────────
    # Both entrance channels are OFFSETS that resolve to zero, so whatever the
    # rest angle is retuned to, the arrival cannot end anywhere else.
    arrive = time_css.split("@keyframes heroHeadArrive{", 1)[1].split("\n}", 1)[0]
    assert "--hero-head-enter-rot:var(--hero-head-enter-spin)" in arrive
    assert "--hero-head-enter-rot:0deg" in arrive
    assert "--hero-head-enter-y:0px" in arrive
    assert '@property --hero-head-enter-rot{syntax:"<angle>"' in time_css

    # ── THE HERO HAS NO GROUND SHADOW ─────────────────────────────────────────
    # Deleted, not zeroed. The head is suspended clear of the floor, and this
    # site only permits a shadow where it is grounding information. Play's
    # companion still stands on something and keeps both its element and the
    # engine's writer, so this is scoped to the Hero.
    assert 'id="fsh"' not in html, "the Hero must not carry a floor shadow element"
    assert "floorshadow" not in html
    for retired in ("--hero-ground-inset", "--hero-ground-width", "--hero-ground-height",
                    "--hero-ground-stretch", "--hero-ground-throw"):
        assert retired not in time_css.split("*/")[-1] and \
            f"{retired}:" not in time_css, retired
    assert "--time-shadow:" not in time_css and "--time-shadow-opacity:" not in time_css
    for gone in ("paintShadow", "hookShadow", "window.updateShadow"):
        assert gone not in transform, gone
    play = (ROOT / "play.html").read_text(encoding="utf-8")
    engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    assert 'id="fsh"' in play, "Play's companion stands on something and keeps its shadow"
    assert "function updateShadow(dx,dy,rot){if(!fsh)return;" in engine, \
        "the shared writer must no-op where a page has no ground, not throw"


def static_contract():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "controls.css").read_text(encoding="utf-8")
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    transform = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
    rest_pose_contract()
    assert 'id="heroHeadTransform"' in html
    assert 'id="heroHeadSelection"' in html
    assert 'data-head-bounds="0.22 0.12 0.80 0.91"' in html
    assert html.count('class="heroHeadHandle"') == 4
    # Rotation gets its own class so the four RESIZE handles stay exactly four.
    assert html.count('class="heroHeadRotate"') == 1
    assert html.count('class="heroHeadFrame"') == 1
    assert '<script src="hero-head-transform.js"></script>' in html
    assert html.index('src="hero-engine.js"') < html.index('src="hero-head-transform.js"')
    for token in (
        "--selection-ink",
        "--selection-line",
        "--selection-handle-size",
        "--selection-hit-size",
        "--hero-head-safe-gap",
        "--hero-movie-guard-y",
        "--hero-head-min-visible",
        "--hero-head-rotate",
        "--hero-head-min-rotate",
        "--hero-head-max-rotate",
        "--hero-head-rotate-snap",
        "--hero-head-rotate-step",
        "--hero-head-rotate-step-large",
        "--hero-head-origin-x",
        "--hero-head-origin-y",
        "--selection-rotate-size",
    ):
        assert token in tokens, token
    for selector in (".heroHeadTransform{", ".heroHeadSelection{",
                     ".heroHeadHandle,.heroHeadRotate{", ".heroHeadFrame{"):
        assert selector in css, selector
    # Transform order is translate -> rotate -> scale about the head's own
    # centre. Composing rotation before the translate, or leaving the origin at
    # the wrapper's corner, makes the head swim while it is dragged.
    wrapper = css.split(".heroHeadTransform{", 1)[1].split("}", 1)[0]
    assert "transform-origin:var(--hero-head-origin-x) var(--hero-head-origin-y)" in wrapper
    assert wrapper.index("translate3d") < wrapper.index("rotate(var(--hero-head-rotate))")
    assert wrapper.index("rotate(var(--hero-head-rotate))") < wrapper.index("scale(var(--hero-head-scale))")
    # The outline is its own layer so it can turn with the head; the selection
    # box stays axis-aligned because it is the pointer surface.
    frame_rule = css.split(".heroHeadFrame::before{", 1)[1].split("}", 1)[0]
    assert "rotate(var(--hero-head-rotate))" in frame_rule
    assert "transform-origin:50% 50%" in frame_rule
    assert (
        'faceImg.addEventListener("click",()=>{if(CALIB||eventLock)return;tapReact();});'
        not in engine
    )
    for operation in (
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel",
        "lostpointercapture",
        "visibilitychange",
        "requestAnimationFrame",
    ):
        assert operation in transform, operation
    assert 'getPropertyValue("--hero-head-safe-gap")' in transform
    assert '"--hero-head-min-visible"' in transform
    assert '"--hero-head-rotate"' in transform
    assert 'event.target===peek&&event.propertyName==="transform"' in transform
    assert '"--hero-movie-guard-y"' in engine
    assert "c.bottom+16" not in transform
    assert "@media(forced-colors:active)" in css
    forced_target = ".heroHeadFrame::before,.heroHeadHandle::before,.heroHeadRotate::before"
    assert forced_target in css, forced_target
    forced = css.split("@media(forced-colors:active)", 1)[1]
    assert "Highlight" in forced and "forced-color-adjust:auto" in forced


def browser_contract(base_url):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        failures = []
        for width, height in ((1440, 900), (390, 844), (320, 800)):
            label = str(width)
            context = browser.new_context(
                viewport={"width": width, "height": height}, reduced_motion="reduce"
            )
            context.add_init_script(
                "try{sessionStorage.setItem('introSeen','1')}catch(e){}"
            )
            page = context.new_page()
            page.goto(base_url + "/index.html?head-transform=1", wait_until="load")
            page.wait_for_selector("#face")
            page.screenshot(path=str(SHOTS / f"home-{label}-resting.png"))
            face = page.locator("#face")
            # RAW INPUT, NOT locator.click(). The Hero arrives already selected
            # and the selection surface is a Hero-relative sibling painted over
            # the portrait, so Playwright's actionability check sees
            # #heroHeadSelection "intercepting pointer events" and times out --
            # on code that works, because the selection's own pointerdown
            # handler is what begins the move. Every other gesture in this file
            # already drives the mouse directly; this one was the outlier.
            face_box = face.bounding_box()
            page.mouse.click(face_box["x"] + face_box["width"] * 0.5,
                             face_box["y"] + face_box["height"] * 0.3)
            selected = page.evaluate(
                """() => ({
              pressed: document.querySelector('#face').getAttribute('aria-pressed'),
              hidden: document.querySelector('#heroHeadSelection').hidden,
              touchAction: getComputedStyle(document.querySelector('#stage')).touchAction,
              handles: [...document.querySelectorAll('.heroHeadHandle')].map(node => {
                const r = node.getBoundingClientRect();
                return {width:r.width,height:r.height,tabIndex:node.tabIndex};
              })
            })"""
            )
            assert selected["pressed"] == "true" and not selected["hidden"], selected
            assert selected["touchAction"] == "none", selected
            assert len(selected["handles"]) == 4
            assert all(
                h["width"] >= 44 and h["height"] >= 44 and h["tabIndex"] == 0
                for h in selected["handles"]
            ), selected
            assert_handle_hits(page, "default")
            # SNAPSHOT ONLY ONCE THE LAYOUT HAS STOPPED MOVING. This is the
            # rectangle every later assertion is compared against, and it used
            # to be grabbed the instant the head was first clicked -- while the
            # peek was still travelling. It read 198px high at 1440, so a reset
            # that landed perfectly on the authored resting position was scored
            # against a position the head only ever occupied in transit. The
            # test was asserting against a transient it had snapshotted itself.
            # Two consecutive agreeing reads mean the head has settled.
            previous, resting_logical = None, logical_head_rect(page)
            for _ in range(40):
                page.wait_for_timeout(100)
                previous, resting_logical = resting_logical, logical_head_rect(page)
                if all(abs(previous[k] - resting_logical[k]) <= .5
                       for k in ("x", "y", "width", "height")):
                    break
            else:
                raise AssertionError(
                    ("head never settled", label, previous, resting_logical)
                )
            page.screenshot(path=str(SHOTS / f"home-{label}-selected.png"))
            assert_handle_gestures(page, f"{label} rest")

            frame0 = page.locator("#heroHeadSelection").bounding_box()
            hero = page.locator("#main").bounding_box()
            protected = page.locator(".heroCopy").bounding_box()
            page.mouse.move(
                frame0["x"] + frame0["width"] / 2,
                frame0["y"] + frame0["height"] / 2,
            )
            page.mouse.down()
            page.mouse.move(
                frame0["x"] + frame0["width"] / 2 + 32,
                frame0["y"] + frame0["height"] / 2 - 16,
                steps=4,
            )
            page.mouse.up()
            moved = page.locator("#heroHeadSelection").bounding_box()
            # The copy-bottom ceiling is GONE on purpose: the head may now rise
            # behind the headline, which stays legible because .heroCopy paints
            # above it in z-order rather than because the head is forbidden to
            # go there. The selection chrome is still Hero-bound, which is what
            # keeps it out of the work section.
            assert moved["y"] >= hero["y"] - .5, (moved, hero, protected)
            assert moved["x"] >= hero["x"]
            assert moved["x"] + moved["width"] <= hero["x"] + hero["width"]
            assert moved["y"] + moved["height"] <= hero["y"] + hero["height"] + 0.5

            se = page.locator('.heroHeadHandle[data-corner="se"]')
            before = logical_head_rect(page)
            anchor = (before["x"], before["y"])
            handle = drawn_dot(page, "se")
            page.mouse.move(handle["x"], handle["y"])
            page.mouse.down()
            page.mouse.move(handle["x"] + 36, handle["y"] + 36, steps=4)
            page.mouse.up()
            page.wait_for_timeout(30)
            after = logical_head_rect(page)
            resized_state = page.evaluate("window.__heroHeadTransform.getState()")
            record(failures, resized_state["scale"] > 1, f"{label} pointer resize", resized_state)
            record(
                failures,
                abs(after["x"] - anchor[0]) <= 1
                and abs(after["y"] - anchor[1]) <= 1,
                f"{label} logical opposite anchor",
                {"before": before, "after": after},
            )
            record(
                failures,
                abs(
                    after["width"] / before["width"]
                    - after["height"] / before["height"]
                )
                <= 0.02,
                f"{label} proportional resize",
                {"before": before, "after": after},
            )
            page.screenshot(path=str(SHOTS / f"home-{label}-resized.png"))

            for corner in ("nw", "ne", "sw", "se"):
                page.evaluate("window.__heroHeadTransform.reset()")
                page.wait_for_timeout(30)
                if corner.startswith("n"):
                    frame = page.locator("#heroHeadSelection").bounding_box()
                    drag_selection_to(
                        page,
                        frame["x"] + frame["width"] / 2,
                        frame["y"] + frame["height"] / 2 + 40,
                    )
                before_corner = logical_head_rect(page)
                anchor_corner = opposite_point(before_corner, corner)
                press_corner = drawn_dot(page, corner)
                dx = -16 if corner.endswith("w") else 16
                dy = -16 if corner.startswith("n") else 16
                page.mouse.move(press_corner["x"], press_corner["y"])
                page.mouse.down()
                page.mouse.move(press_corner["x"] + dx, press_corner["y"] + dy, steps=3)
                page.mouse.up()
                page.wait_for_timeout(30)
                after_corner = logical_head_rect(page)
                actual_anchor = opposite_point(after_corner, corner)
                corner_state = page.evaluate("window.__heroHeadTransform.getState()")
                record(
                    failures,
                    corner_state["scale"] > 1
                    and abs(actual_anchor["x"] - anchor_corner["x"]) <= 1
                    and abs(actual_anchor["y"] - anchor_corner["y"]) <= 1
                    and abs(
                        after_corner["width"] / before_corner["width"]
                        - after_corner["height"] / before_corner["height"]
                    )
                    <= 0.02,
                    f"{label} {corner} logical proportional anchor",
                    {
                        "before": before_corner,
                        "after": after_corner,
                        "expectedAnchor": anchor_corner,
                        "actualAnchor": actual_anchor,
                        "state": corner_state,
                    },
                )

            for corner, axis, dx, dy in (
                ("se", "horizontal", -32, 0),
                ("nw", "vertical", 0, 32),
            ):
                page.evaluate("window.__heroHeadTransform.reset()")
                page.wait_for_timeout(30)
                before_axis = logical_head_rect(page)
                expected_anchor = opposite_point(before_axis, corner)
                axis_handle = drawn_dot(page, corner)
                press_x = axis_handle["x"]
                press_y = axis_handle["y"]
                page.mouse.move(press_x, press_y)
                page.mouse.down()
                page.mouse.move(press_x + dx, press_y + dy, steps=3)
                page.mouse.up()
                page.wait_for_timeout(30)
                after_axis = logical_head_rect(page)
                actual_anchor = opposite_point(after_axis, corner)
                axis_state = page.evaluate("window.__heroHeadTransform.getState()")
                record(
                    failures,
                    axis_state["scale"] < 1
                    and abs(actual_anchor["x"] - expected_anchor["x"]) <= 1
                    and abs(actual_anchor["y"] - expected_anchor["y"]) <= 1,
                    f"{label} {axis}-only inward resize",
                    {
                        "corner": corner,
                        "state": axis_state,
                        "expectedAnchor": expected_anchor,
                        "actualAnchor": actual_anchor,
                    },
                )

            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)

            drag_selection_to(page, width + 1000, height + 1000)
            assert_handle_hits(page, "safe-lower-right")
            drag_selection_to(page, -1000, -1000)
            assert_handle_hits(page, "safe-upper-left")
            # ── THE RESTING POSITION MUST BE LEGAL ────────────────────────
            # This is the regression that made the head a one-way door. At rest
            # the portrait's logical rect hangs well below the Hero's lower
            # edge, so a containment clamp forbade the composition the page
            # ships with: drag the head away and it could never be put back.
            # The clamp is stated as visibility now, and the first thing this
            # asserts is that the authored resting rect satisfies it.
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)
            # ── AND IT IS THE ROTATED BOX THAT HAS TO BE LEGAL ────────────
            # A turned box is WIDER than the head it holds -- at the resting
            # -13.8deg, ~20% wider on each axis -- so a clamp that was
            # comfortable for the level rect is not automatically comfortable
            # for the pose the page actually ships. This measures the same
            # rigid box the clamp enforces (getState().box, which is
            # transformedBox and therefore already turned) and asserts it
            # against the same reachable region, including the floating bar's
            # footprint at the top.
            legality = page.evaluate(
                """() => {
                  const hero=document.querySelector('#main');
                  const h=hero.getBoundingClientRect();
                  const box=window.__heroHeadTransform.getState().box;
                  const level=(""" + LEVEL_HEAD + """)();
                  const bar=document.querySelector('.jbStick .jbNav')
                    ||document.querySelector('.jbStick');
                  let ceiling=0;
                  if(bar){const r=bar.getBoundingClientRect();
                    if(r.bottom>h.top&&r.top<h.bottom&&r.width>0)
                      ceiling=Math.min(r.bottom,h.bottom)-h.top;}
                  const gap=parseFloat(getComputedStyle(hero)
                    .getPropertyValue('--hero-head-safe-gap'))||0;
                  const share=parseFloat(getComputedStyle(document.documentElement)
                    .getPropertyValue('--hero-head-min-visible'));
                  const needX=Math.min(Math.max(box.width*share,gap),h.width);
                  const needY=Math.min(Math.max(box.height*share,gap),
                    Math.max(1,h.height-ceiling));
                  return {share,needX,needY,ceiling,
                    rotate:window.__heroHeadTransform.getState().rotate,
                    turnedWidth:box.width,levelWidth:level.width,
                    turnedHeight:box.height,levelHeight:level.height,
                    clearOfFloor:h.bottom-(h.top+box.bottom),
                    visibleX:Math.min(box.right,h.width)-Math.max(box.left,0),
                    visibleY:Math.min(box.bottom,h.height)-Math.max(box.top,ceiling)};
                }"""
            )
            record(
                failures,
                legality["visibleX"] >= legality["needX"] - .5
                and legality["visibleY"] >= legality["needY"] - .5,
                f"{label} rotated resting position is legal under its own clamp",
                legality,
            )
            # The assertion above is only meaningful if the box it measured is
            # genuinely the turned one: a level box would pass it for free.
            record(
                failures,
                abs(legality["rotate"] - rest_rotate(page)) <= .01
                and legality["turnedWidth"] > legality["levelWidth"] + 1
                and legality["turnedHeight"] > legality["levelHeight"] + 1,
                f"{label} rest is measured rotated, not level",
                legality,
            )
            # NEGATIVE DEPTH MEANS THE HEAD CLEARS THE FLOOR. It used to hang
            # past it, which is why there was a shadow on that floor at all.
            record(
                failures,
                legality["clearOfFloor"] > 0,
                f"{label} resting head hangs clear of the Hero floor",
                legality,
            )

            # THE RETURN TRIP. Drag the head hard off the top, then hard back
            # down, and it must end up BELOW where it started -- proving the
            # resting position is inside the reachable set and not merely on
            # its boundary.
            frame_up = page.locator("#heroHeadSelection").bounding_box()
            drag_selection_to(page, width / 2, -height)
            lifted = page.evaluate("window.__heroHeadTransform.getState()")
            drag_selection_to(page, width / 2, height * 2)
            returned = page.evaluate("window.__heroHeadTransform.getState()")
            record(
                failures,
                lifted["y"] < -80 and returned["y"] > 0,
                f"{label} head returns past its resting position",
                {"lifted": lifted, "returned": returned, "from": frame_up},
            )
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)

            # The gap token is the PIXEL FLOOR under the visible share, so a
            # head at minimum scale cannot shrink its handles out of reach.
            # Forced far above the share, it becomes the binding constraint.
            page.locator("#main").evaluate(
                "node=>node.style.setProperty('--hero-head-safe-gap','260px')"
            )
            page.evaluate("window.__heroHeadTransform.reclamp()")
            drag_selection_to(page, width / 2, -height)
            page.wait_for_timeout(30)
            # MEASURED AGAINST THE REACHABLE REGION, NOT THE HERO BOX. This
            # assertion used to take the Hero's own top edge as the ceiling.
            # That stopped being true when the Hero went full-bleed and ran up
            # BEHIND the floating header: the bar is opaque and sits at
            # z-index 100, so a handle parked under it cannot be clicked at
            # all. The clamp therefore treats the bar's footprint as
            # unreachable, and the visible share has to be counted from the
            # bar's lower edge -- otherwise this test asserts the head can be
            # pushed into a region where its own handles do not work.
            gap_result = page.evaluate(
                """() => {
                  const hero=document.querySelector('#main');
                  const face=document.querySelector('#face');
                  const b=face.dataset.headBounds.split(/\s+/).map(Number);
                  const h=hero.getBoundingClientRect(),f=face.getBoundingClientRect();
                  const bar=document.querySelector('.jbStick .jbNav')
                    ||document.querySelector('.jbStick');
                  let ceiling=h.top;
                  if(bar){const r=bar.getBoundingClientRect();
                    if(r.bottom>h.top&&r.top<h.bottom&&r.width>0)
                      ceiling=Math.min(r.bottom,h.bottom);}
                  // Measured from the RIGID box the clamp enforces, not from
                  // the rendered silhouette. hero-engine gives the portrait its
                  // own idle breathing, so getBoundingClientRect() disagrees
                  // with the enforced geometry by ~14px at any instant --
                  // sampling it would be measuring the breathing, not the rule.
                  const box=window.__heroHeadTransform.getState().box;
                  const top=h.top+box.top,bottom=h.top+box.bottom;
                  const gap=parseFloat(getComputedStyle(hero)
                    .getPropertyValue('--hero-head-safe-gap'));
                  // CAPPED BY THE HEAD ITSELF. The gap is a floor under the
                  // visible SHARE, but no clamp can keep 260px of a head
                  // visible when the head is only 246.48px tall -- and at 320
                  // it is exactly that, because --hero-peek-width bottoms out
                  // at 312 and the logical head is .79 of it. The old
                  // expectation asked for a visible extent larger than the
                  // object and so could only ever pass at the wider two
                  // viewports. What the rule actually promises is: as much of
                  // the head as the gap asks for, or the whole head, whichever
                  // comes first.
                  return {gap,ceiling,boxHeight:box.height,
                    visibleY:Math.min(bottom,h.bottom)-Math.max(top,ceiling),
                    expected:Math.min(gap,h.bottom-ceiling,box.height)};
                }"""
            )
            assert gap_result["gap"] == 260 and abs(
                gap_result["visibleY"] - gap_result["expected"]
            ) <= 1.5, gap_result
            page.locator("#main").evaluate(
                "node=>node.style.removeProperty('--hero-head-safe-gap')"
            )
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)

            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)

            # ON THE DOT, AND A FEW PIXELS OFF IT. These used to press the hit
            # box's own corners (4px and 22px in), which stopped being a
            # meaningful place once the dot is what owns the target -- a press
            # 18px from the visible square is a press at nothing in particular.
            for point_name, inset in (("on-dot", 0), ("near-dot", 4)):
                # INWARD. A few pixels further out from a dot that is already
                # riding its box's edge is a press on the background, and the
                # background legitimately drags the head.
                page.evaluate("window.__heroHeadTransform.reset()")
                page.wait_for_timeout(30)
                se = page.locator('.heroHeadHandle[data-corner="se"]')
                handle = drawn_dot(page, "se")
                hit_box = se.bounding_box()
                toward_x = (hit_box["x"] + hit_box["width"] / 2) - handle["x"]
                toward_y = (hit_box["y"] + hit_box["height"] / 2) - handle["y"]
                reach = math.hypot(toward_x, toward_y) or 1
                resize_start = page.evaluate("window.__heroHeadTransform.getState()")
                anchor_start = opposite_point(logical_head_rect(page), "se")
                press_x = handle["x"] + toward_x / reach * inset
                press_y = handle["y"] + toward_y / reach * inset
                page.mouse.move(press_x, press_y)
                page.mouse.down()
                resize_captured = se.evaluate("node => node.hasPointerCapture(1)")
                page.mouse.move(press_x + 1, press_y + 1)
                page.wait_for_timeout(30)
                resize_tiny = page.evaluate("window.__heroHeadTransform.getState()")
                anchor_tiny = opposite_point(logical_head_rect(page), "se")
                page.evaluate(
                    """() => document.querySelector('.heroHeadHandle[data-corner="se"]')
                      .dispatchEvent(new PointerEvent('pointercancel', {
                        bubbles:true,pointerId:1,pointerType:'mouse',button:0
                      }))"""
                )
                resize_cancelled = page.evaluate("window.__heroHeadTransform.getState()")
                capture_released = se.evaluate("node => !node.hasPointerCapture(1)")
                page.mouse.move(press_x + 100, press_y + 100)
                page.wait_for_timeout(30)
                resize_after_cancel = page.evaluate("window.__heroHeadTransform.getState()")
                page.mouse.up()
                record(
                    failures,
                    resize_captured
                    and capture_released
                    and abs(resize_tiny["scale"] - resize_start["scale"]) <= 0.02
                    and abs(resize_tiny["x"] - resize_start["x"]) <= 1
                    and abs(resize_tiny["y"] - resize_start["y"]) <= 1
                    and abs(anchor_tiny["x"] - anchor_start["x"]) <= 1
                    and abs(anchor_tiny["y"] - anchor_start["y"]) <= 1
                    and resize_after_cancel == resize_cancelled,
                    f"{label} {point_name} no-jump resize cancellation",
                    {
                        "captured": resize_captured,
                        "captureReleased": capture_released,
                        "start": resize_start,
                        "tiny": resize_tiny,
                        "cancelled": resize_cancelled,
                        "after": resize_after_cancel,
                    },
                )
                next_handle = drawn_dot(page, "se")
                page.mouse.move(next_handle["x"], next_handle["y"])
                page.mouse.down()
                page.mouse.move(next_handle["x"] + 12, next_handle["y"] + 12)
                page.mouse.up()
                page.wait_for_timeout(30)
                restarted = page.evaluate("window.__heroHeadTransform.getState()")
                record(
                    failures,
                    restarted["scale"] > resize_cancelled["scale"],
                    f"{label} resize restarts after cancellation",
                    {"cancelled": resize_cancelled, "restarted": restarted},
                )

            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)

            grip = body_point(page)
            owner_x, owner_y = grip["x"], grip["y"]
            page.mouse.move(owner_x, owner_y)
            page.mouse.down()
            page.evaluate(
                """() => document.body.dispatchEvent(
                  new PointerEvent('pointerdown', {
                    bubbles:true, pointerId:99, pointerType:'touch', button:0,
                    clientX:10, clientY:10
                  })
                )"""
            )
            page.mouse.move(owner_x + 30, owner_y)
            page.mouse.up()
            owner_move = page.evaluate("window.__heroHeadTransform.getState()")
            owner_finished = page.evaluate(
                """() => ({
                  pressed:document.querySelector('#face').getAttribute('aria-pressed'),
                  captured:document.querySelector('#face').hasPointerCapture(1)
                })"""
            )
            assert owner_move["x"] > 0 and owner_finished == {
                "pressed": "true",
                "captured": False,
            }, {"move": owner_move, "finished": owner_finished}
            moved_grip = body_point(page)
            page.mouse.move(moved_grip["x"], moved_grip["y"])
            page.mouse.down()
            page.mouse.move(owner_x + 45, owner_y)
            page.mouse.up()
            second_owner_move = page.evaluate("window.__heroHeadTransform.getState()")
            assert second_owner_move["x"] != owner_move["x"], {
                "first": owner_move,
                "second": second_owner_move,
            }
            page.evaluate("window.__heroHeadTransform.reset()")
            page.keyboard.press("Escape")
            assert page.locator("#face").get_attribute("aria-pressed") == "false"
            assert page.locator("#heroHeadSelection").is_hidden()
            face.focus()
            for key, pressed in (
                ("Enter", "true"),
                ("Enter", "false"),
                ("Space", "true"),
                ("Space", "false"),
            ):
                page.keyboard.press(key)
                keyboard_state = page.evaluate(
                    """() => ({
                      pressed:document.querySelector('#face').getAttribute('aria-pressed'),
                      hidden:document.querySelector('#heroHeadSelection').hidden,
                      focused:document.activeElement === document.querySelector('#face'),
                      tabIndexes:[...document.querySelectorAll('.heroHeadHandle')].map(n=>n.tabIndex)
                    })"""
                )
                expected_tab_index = 0 if pressed == "true" else -1
                assert keyboard_state == {
                    "pressed": pressed,
                    "hidden": pressed == "false",
                    "focused": True,
                    "tabIndexes": [expected_tab_index] * 4,
                }, {"key": key, "state": keyboard_state}

            face.focus()
            page.keyboard.press("Enter")
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)
            for selector, key in (
                ("#heroTimeBtn", "ArrowRight"),
                ('.csTab[role="tab"]', "ArrowDown"),
            ):
                unrelated = page.evaluate(
                    """({selector,key}) => {
                      const node=document.querySelector(selector);
                      node.focus({preventScroll:true});
                      const before=window.__heroHeadTransform.getState();
                      const allowed=node.dispatchEvent(new KeyboardEvent('keydown',{
                        key,bubbles:true,cancelable:true
                      }));
                      return {allowed,before,after:window.__heroHeadTransform.getState()};
                    }""",
                    {"selector": selector, "key": key},
                )
                record(
                    failures,
                    unrelated["allowed"] and unrelated["after"] == unrelated["before"],
                    f"{label} unrelated {selector} {key}",
                    unrelated,
                )
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)
            face.evaluate("node => node.focus({preventScroll:true})")
            state0 = page.evaluate("window.__heroHeadTransform.getState()")
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(30)
            state1 = page.evaluate("window.__heroHeadTransform.getState()")
            record(failures, state1["x"] > state0["x"], f"{label} keyboard move", {"before": state0, "after": state1})
            se.focus()
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(30)
            state2 = page.evaluate("window.__heroHeadTransform.getState()")
            record(failures, state2["scale"] > state1["scale"], f"{label} keyboard resize", {"before": state1, "after": state2})
            focus_style = se.evaluate(
                """node => {
                  const style=getComputedStyle(node,'::before');
                  return {width:style.outlineWidth,style:style.outlineStyle};
                }"""
            )
            record(
                failures,
                focus_style == {"width": "2px", "style": "solid"},
                f"{label} handle focus ring",
                focus_style,
            )
            page.keyboard.press("Escape")
            escaped = page.evaluate(
                """() => ({
                  selected:window.__heroHeadTransform.getState().selected,
                  focused:document.activeElement===document.querySelector('#face')
                })"""
            )
            record(
                failures,
                escaped == {"selected": False, "focused": True},
                f"{label} handle Escape",
                escaped,
            )

            face.focus()
            page.keyboard.press("Enter")
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)
            batched = page.evaluate(
                """() => new Promise(resolve => {
                  let count=0;
                  const onTransform=()=>count++;
                  addEventListener('heroheadtransform',onTransform);
                  const face=document.querySelector('#face');
                  const selection=document.querySelector('#heroHeadSelection');
                  const before=window.__heroHeadTransform.getState();
                  const frame=document.querySelector('.heroHeadFrame');
                  // NEITHER NUMBER ALONE IS A WITNESS, so use their sum. The
                  // box is the Hero-CLIPPED bounding rect: at 390 it is already
                  // pinned to the left edge, so --selection-x reads 0px before
                  // and after a 12px move. --frame-x is the rigid rect's offset
                  // INSIDE that box, so while the box is free to move it stays
                  // constant under a pure translation. Their sum is the frame's
                  // Hero-relative left edge, which moves in both cases.
                  const chromeLeft=()=>
                    (parseFloat(selection.style.getPropertyValue('--selection-x'))||0)
                    +(parseFloat(frame.style.getPropertyValue('--frame-x'))||0);
                  const selectionBefore=chromeLeft();
                  let atEvent=null;
                  const observe=event=>{atEvent={
                    detail:event.detail,
                    cssX:getComputedStyle(document.querySelector('#heroHeadTransform'))
                      .getPropertyValue('--hero-head-x').trim(),
                    selectionX:chromeLeft()
                  };};
                  addEventListener('heroheadtransform',observe,{once:true});
                  for(let i=0;i<3;i++)face.dispatchEvent(new KeyboardEvent('keydown',{
                    key:'ArrowRight',bubbles:true
                  }));
                  const immediate=count;
                  requestAnimationFrame(()=>{
                    removeEventListener('heroheadtransform',onTransform);
                    resolve({immediate,count,before,after:window.__heroHeadTransform.getState(),
                      selectionBefore,selectionAfter:chromeLeft(),atEvent});
                  });
                })"""
            )
            record(
                failures,
                batched["immediate"] == 0
                and batched["count"] == 1
                and abs(batched["after"]["x"] - batched["before"]["x"] - 12) <= 0.01,
                f"{label} animation-frame transform batch",
                batched,
            )
            record(
                failures,
                batched["atEvent"] is not None
                and batched["atEvent"]["detail"]["x"] == batched["after"]["x"]
                and batched["atEvent"]["cssX"] == f'{batched["after"]["x"]}px'
                and batched["atEvent"]["selectionX"] == batched["selectionBefore"]
                and batched["selectionAfter"] != batched["selectionBefore"],
                f"{label} write-event-measure ordering",
                batched,
            )

            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)
            grip = body_point(page)
            page.mouse.move(grip["x"], grip["y"])
            page.mouse.down()
            pointer_burst = page.evaluate(
                """({x,y}) => new Promise(resolve => {
                  let count=0;
                  const onTransform=()=>count++;
                  addEventListener('heroheadtransform',onTransform);
                  const face=document.querySelector('#face');
                  for(let i=1;i<=4;i++)face.dispatchEvent(new PointerEvent('pointermove',{
                    bubbles:true,pointerId:1,pointerType:'mouse',button:0,
                    clientX:x+i*5,clientY:y-i*2
                  }));
                  const immediate=count;
                  requestAnimationFrame(()=>{
                    removeEventListener('heroheadtransform',onTransform);
                    resolve({immediate,count,state:window.__heroHeadTransform.getState()});
                  });
                })""",
                {"x": grip["x"], "y": grip["y"]},
            )
            record(
                failures,
                pointer_burst["immediate"] == 0 and pointer_burst["count"] == 1,
                f"{label} pointer burst consolidation",
                pointer_burst,
            )
            page.evaluate(
                """() => document.querySelector('#face').dispatchEvent(
                  new PointerEvent('pointercancel',{
                    bubbles:true,pointerId:1,pointerType:'mouse',button:0
                  }))"""
            )
            page.mouse.up()

            se.focus()
            for _ in range(40):
                page.keyboard.press("Shift+ArrowRight")
            page.wait_for_timeout(30)
            max_result = page.evaluate(
                """() => ({
                  scale:window.__heroHeadTransform.getState().scale,
                  token:parseFloat(getComputedStyle(document.documentElement)
                    .getPropertyValue('--hero-head-max-scale'))
                })"""
            )
            record(
                failures,
                abs(max_result["scale"] - max_result["token"]) <= 0.001,
                f"{label} token-derived maximum scale",
                max_result,
            )
            assert_handle_hits(page, "keyboard-maximum-scale")
            for _ in range(60):
                page.keyboard.press("Shift+ArrowLeft")
            page.wait_for_timeout(30)
            keyboard_min = page.evaluate(
                """() => ({
                  scale:window.__heroHeadTransform.getState().scale,
                  token:parseFloat(getComputedStyle(document.documentElement)
                    .getPropertyValue('--hero-head-min-scale'))
                })"""
            )
            record(
                failures,
                abs(keyboard_min["scale"] - keyboard_min["token"]) <= 0.001,
                f"{label} token-derived minimum keyboard scale",
                keyboard_min,
            )
            assert_handle_hits(page, "keyboard-minimum-scale")

            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)
            se.focus()
            logical = logical_head_rect(page)
            anchor = opposite_point(logical, "se")
            drag = corner_point(logical, "se")
            press = drawn_dot(page, "se")
            page.mouse.move(press["x"], press["y"])
            page.mouse.down()
            page.mouse.move(press["x"] + width, press["y"] + height, steps=4)
            page.mouse.up()
            page.wait_for_timeout(30)
            pointer_max = page.evaluate(
                """() => ({
                  scale:window.__heroHeadTransform.getState().scale,
                  token:parseFloat(getComputedStyle(document.documentElement)
                    .getPropertyValue('--hero-head-max-scale'))
                })"""
            )
            record(
                failures,
                abs(pointer_max["scale"] - pointer_max["token"]) <= 0.001,
                f"{label} token-derived maximum pointer scale",
                pointer_max,
            )
            assert_handle_hits(page, "pointer-maximum-scale")

            logical = logical_head_rect(page)
            anchor = opposite_point(logical, "se")
            drag = corner_point(logical, "se")
            press = drawn_dot(page, "se")
            target_drag = {
                "x": anchor["x"] + logical["width"] * 0.1,
                "y": anchor["y"] + logical["height"] * 0.1,
            }
            page.mouse.move(press["x"], press["y"])
            page.mouse.down()
            page.mouse.move(
                target_drag["x"] - (drag["x"] - press["x"]),
                target_drag["y"] - (drag["y"] - press["y"]),
                steps=4,
            )
            page.mouse.up()
            page.wait_for_timeout(30)
            min_result = page.evaluate(
                """() => ({
                  scale:window.__heroHeadTransform.getState().scale,
                  token:parseFloat(getComputedStyle(document.documentElement)
                    .getPropertyValue('--hero-head-min-scale'))
                })"""
            )
            record(
                failures,
                abs(min_result["scale"] - min_result["token"]) <= 0.001,
                f"{label} token-derived minimum pointer scale",
                min_result,
            )
            assert_handle_hits(page, "minimum-scale")

            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)
            reset_result = page.evaluate("window.__heroHeadTransform.getState()")
            reset_rect = logical_head_rect(page)
            record(
                failures,
                {k: reset_result[k] for k in ("selected", "x", "y", "scale", "rotate")}
                == {"selected": True, "x": 0, "y": 0, "scale": 1,
                    "rotate": rest_rotate(page)}
                and all(abs(reset_rect[key] - resting_logical[key]) <= 1 for key in ("x", "y", "width", "height")),
                f"{label} exact reset state and geometry",
                {"state": reset_result, "expected": resting_logical, "actual": reset_rect},
            )
            context.close()

        for width, height in ((1440, 900), (390, 844), (320, 800)):
            label = str(width)
            context = browser.new_context(viewport={"width": width, "height": height})
            context.add_init_script(
                "try{sessionStorage.setItem('introSeen','1')}catch(e){}"
            )
            page = context.new_page()
            page.goto(base_url + "/index.html?head-transform=1", wait_until="load")
            page.wait_for_function(
                "typeof introMode !== 'undefined' && !introMode && !eventLock",
                timeout=15_000,
            )
            page.evaluate("startMovie()")
            page.wait_for_timeout(700)
            face = page.locator("#face")
            box = face.bounding_box()
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.3)
            page.mouse.down()
            page.mouse.move(box["x"] + box["width"] / 2 + 28, box["y"] + box["height"] * 0.3 - 12, steps=4)
            page.mouse.up()
            page.wait_for_timeout(50)
            # Outward along the head's own diagonal; see select_move_resize.
            movie_before = logical_head_rect(page)
            movie_anchor = opposite_point(movie_before, "se")
            handle = drawn_dot(page, "se")
            mvx, mvy = handle["x"] - movie_anchor["x"], handle["y"] - movie_anchor["y"]
            movie_span = math.hypot(mvx, mvy) or 1
            page.mouse.move(handle["x"], handle["y"])
            page.mouse.down()
            page.mouse.move(handle["x"] + mvx / movie_span * 56,
                            handle["y"] + mvy / movie_span * 56, steps=4)
            page.mouse.up()
            # LET THE PROJECTION CATCH UP. The effects stage tracks the head on
            # its own animation frame, so a measurement taken 50ms after a
            # resize is reading the lag rather than the alignment -- and the lag
            # is a share of the head's size, so it grew the moment the test
            # started resizing far enough to be sure it had grown the head.
            page.wait_for_timeout(280)
            projection = page.evaluate(
                """() => {
                  const rect=node=>{const r=node.getBoundingClientRect();return {
                    left:r.left,top:r.top,right:r.right,bottom:r.bottom};};
                  const stage=rect(document.querySelector('#stage'));
                  const effects=rect(document.querySelector('#heroMovieEffectsStage'));
                  const hero=rect(document.querySelector('#main'));
                  const clipNode=document.querySelector('#heroMovieEffectsClip');
                  const clip=rect(clipNode);
                  const visibleProps=[...document.querySelectorAll('.popbucket,.kernel,.popcrumb')]
                    .filter(node=>parseFloat(getComputedStyle(node).opacity)>0).length;
                  return {stage,effects,hero,clip,movieMode,visibleProps,
                    clipOverflow:getComputedStyle(clipNode).overflow,
                    scale:window.__heroHeadTransform.getState().scale};
                }"""
            )
            # A TURNED BOUNDING BOX AMPLIFIES A SUB-PIXEL DIFFERENCE. The head
            # rests at -13.8deg, so a fraction of a pixel of size disagreement
            # between the stage and the effects layer shows up on both axes of
            # the rect they are compared through. 2px is the rounding, not drift.
            aligned = (
                projection["movieMode"]
                and projection["scale"] > 1
                and projection["visibleProps"] > 0
                and projection["clipOverflow"] == "clip"
                and all(
                abs(projection["stage"][edge] - projection["effects"][edge]) <= 2
                for edge in ("left", "top", "right", "bottom")
                )
            )
            record(failures, aligned, f"{label} movie projection", projection)
            page.screenshot(path=str(SHOTS / f"home-{label}-movie.png"))
            context.close()
        browser.close()
        assert not failures, "\n" + "\n".join(failures)


def task4_matrix(base_url):
    """Cross-state closure: breakpoints, persistence, touch, a11y, and performances."""
    with sync_playwright() as p:
        browser = p.chromium.launch()
        defaults = {}
        for width, height in TRANSFORM_VIEWPORTS:
            for theme in TRANSFORM_THEMES:
                label = (width, height, theme)
                context = browser.new_context(
                    viewport={"width": width, "height": height}, reduced_motion="reduce"
                )
                context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
                page = context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.on("console", lambda message: errors.append(message.text)
                        if message.type == "error" else None)
                page.goto(base_url + "/index.html?head-transform-task4=1", wait_until="load")
                page.wait_for_function("window.__heroHeadTransform && window.SiteTheme")
                set_theme(page, theme)
                page.wait_for_timeout(80)
                authored = rect_snapshot(page)
                authored_logical = authored["logical"]
                if theme == "off":
                    defaults[(width, height)] = authored
                else:
                    expected = defaults[(width, height)]
                    for group in ("hero", "copy", "logical"):
                        for edge in ("left", "top", "right", "bottom", "width", "height"):
                            assert abs(authored[group][edge] - expected[group][edge]) <= 1, (
                                label, group, edge, authored[group], expected[group]
                            )

                before_storage = storage_snapshot(page)
                before_url = page.url
                changed = select_move_resize(page)
                assert changed["selected"] and (changed["x"] or changed["y"]), (label, changed)
                assert changed["scale"] != 1, (label, changed)
                transformed = rect_snapshot(page)
                hero = transformed["hero"]
                selection = transformed["selection"]
                assert selection["left"] >= hero["left"] - .5, (label, transformed)
                assert selection["right"] <= hero["right"] + .5, (label, transformed)
                assert selection["bottom"] <= hero["bottom"] + .5, (label, transformed)
                assert document_width(page) <= width + 1, (label, document_width(page), width)
                assert storage_snapshot(page) == before_storage, label
                assert page.url == before_url, label

                motion = page.evaluate("""() => {
                  const read=selector=>{const s=getComputedStyle(document.querySelector(selector));
                    return {transitionDuration:s.transitionDuration,animationName:s.animationName};};
                  return {matches:matchMedia('(prefers-reduced-motion:reduce)').matches,
                    transform:read('#heroHeadTransform'),selection:read('#heroHeadSelection'),
                    handle:read('.heroHeadHandle')};
                }""")
                assert motion["matches"], (label, motion)
                for key in ("transform", "selection", "handle"):
                    assert set(motion[key]["transitionDuration"].split(", ")) <= {"0s"}, (label, motion)
                    assert motion[key]["animationName"] == "none", (label, motion)

                page.screenshot(path=str(TASK4_SHOTS / f"home-{width}-{height}-{theme}-resized.png"))
                page.reload(wait_until="load")
                page.wait_for_function("window.__heroHeadTransform && window.__heroHeadTransform.getState")
                assert_authored_reset(page)
                assert storage_snapshot(page) == before_storage, label
                assert page.url == before_url, label
                reset_logical = logical_head_rect(page)
                normalized = {"x": authored_logical["left"], "y": authored_logical["top"],
                              "width": authored_logical["width"], "height": authored_logical["height"]}
                assert all(abs(reset_logical[k] - normalized[k]) <= 1 for k in normalized), (
                    label, normalized, reset_logical
                )
                assert not errors, (label, errors)
                context.close()

        for width, height in TOUCH_VIEWPORTS:
            label = (width, height, "touch")
            context = browser.new_context(
                viewport={"width": width, "height": height}, has_touch=True,
                is_mobile=True, reduced_motion="reduce"
            )
            context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
            page = context.new_page()
            page.goto(base_url + "/index.html?head-transform-touch=1", wait_until="load")
            page.wait_for_function("window.__heroHeadTransform && window.SiteTheme")
            set_theme(page, "off")
            time_button = page.locator("#heroTimeBtn").bounding_box()
            page.touchscreen.tap(time_button["x"] + time_button["width"] / 2,
                                 time_button["y"] + time_button["height"] / 2)
            assert page.locator("#heroTimeBtn").get_attribute("aria-expanded") == "true", label
            page.keyboard.press("Escape")
            before = page.evaluate("""() => ({scrollY,time:document.querySelector('#main').dataset.timeMode,
              expanded:document.querySelector('#heroTimeBtn').getAttribute('aria-expanded'),
              tab:document.querySelector('.csTab[aria-selected="true"]').dataset.tab})""")
            face = page.locator("#face").bounding_box()
            start = {"x": face["x"] + face["width"] * .5, "y": face["y"] + face["height"] * .3}
            end = {"x": time_button["x"] + time_button["width"] / 2,
                   "y": time_button["y"] + time_button["height"] / 2}
            touch_drag(context, page, start, end)
            page.wait_for_timeout(60)
            after = page.evaluate("""() => ({state:window.__heroHeadTransform.getState(),scrollY,
              time:document.querySelector('#main').dataset.timeMode,
              expanded:document.querySelector('#heroTimeBtn').getAttribute('aria-expanded'),
              tab:document.querySelector('.csTab[aria-selected="true"]').dataset.tab})""")
            assert after["state"]["selected"] and (after["state"]["x"] or after["state"]["y"]), (label, after)
            assert abs(after["scrollY"] - before["scrollY"]) <= 1, (label, before, after)
            assert (after["time"], after["expanded"], after["tab"]) == (
                before["time"], before["expanded"], before["tab"]), (label, before, after)
            hero = page.locator("#main").bounding_box()
            assert not chrome_below_hero(page), (label, "first drag chrome leaked")
            frame = page.locator("#heroHeadSelection").bounding_box()
            before_second = page.evaluate("""() => ({scrollY,
              tab:document.querySelector('.csTab[aria-selected="true"]').dataset.tab})""")
            touch_drag(context, page,
                       {"x": frame["x"] + frame["width"] / 2,
                        "y": frame["y"] + frame["height"] / 2},
                       {"x": width / 2, "y": hero["y"] + hero["height"] + 30})
            page.wait_for_timeout(60)
            frame = page.locator("#heroHeadSelection").bounding_box()
            after_second = page.evaluate("""() => ({scrollY,
              tab:document.querySelector('.csTab[aria-selected="true"]').dataset.tab})""")
            assert abs(after_second["scrollY"] - before_second["scrollY"]) <= 1, (
                label, before_second, after_second
            )
            assert after_second["tab"] == before_second["tab"], (label, before_second, after_second)
            assert frame["y"] + frame["height"] <= hero["y"] + hero["height"] + .5, (label, frame, hero)
            assert not chrome_below_hero(page), label
            # ── THE FRAME SURVIVES A TAP SOMEWHERE ELSE ───────────────────
            # It used to dismiss on any outside pointerdown, which is the canvas
            # convention and the wrong one here: the frame is the composition,
            # not a selection state, and dismissing it on the first tap
            # destroys the idea within seconds of arrival. What must NOT change
            # is that the tap still reaches what it was aimed at -- a permanent
            # overlay that eats a CTA would be far worse than one that hides.
            page.touchscreen.tap(time_button["x"] + time_button["width"] / 2,
                                 time_button["y"] + time_button["height"] / 2)
            assert page.evaluate("window.__heroHeadTransform.getState().selected"), label
            assert page.locator("#heroTimeBtn").get_attribute("aria-expanded") == "true", label
            page.keyboard.press("Escape")
            page.locator("#cases").scroll_into_view_if_needed()
            tab = page.locator('.csTab[data-tab="goodness"]')
            tab_box = tab.bounding_box()
            page.touchscreen.tap(tab_box["x"] + tab_box["width"] / 2,
                                 tab_box["y"] + tab_box["height"] / 2)
            assert tab.get_attribute("aria-selected") == "true", label
            context.close()

        for width, height in ACCESSIBILITY_VIEWPORTS:
            label = (width, height, "forced-colors")
            normal_context = browser.new_context(
                viewport={"width": width, "height": height}, reduced_motion="reduce"
            )
            normal_context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
            normal_page = normal_context.new_page()
            normal_page.goto(base_url + "/index.html?head-transform-normal-a11y=1", wait_until="load")
            # THE FRAME IS ALREADY OPEN. It used to be revealed by focusing the
            # portrait and pressing Enter; the frame is permanent now, so Enter
            # is the toggle that CLOSES it -- and every measurement after that
            # was of a hidden element.
            normal_page.wait_for_function(
                "window.__heroHeadTransform && !document.querySelector('#heroHeadSelection').hidden"
            )
            normal_geometry = normal_page.locator("#heroHeadSelection").bounding_box()
            normal_context.close()
            context = browser.new_context(
                viewport={"width": width, "height": height},
                forced_colors="active", reduced_motion="reduce"
            )
            context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
            page = context.new_page()
            page.goto(base_url + "/index.html?head-transform-forced=1", wait_until="load")
            page.wait_for_function(
                "window.__heroHeadTransform && !document.querySelector('#heroHeadSelection').hidden"
            )
            page.locator('.heroHeadHandle[data-corner="se"]').focus()
            forced = page.evaluate("""() => {
              const frame=getComputedStyle(document.querySelector('.heroHeadFrame'),'::before');
              const handle=getComputedStyle(document.querySelector('.heroHeadHandle:focus'),'::before');
              return {matches:matchMedia('(forced-colors:active)').matches,
                frameOutline:frame.outlineStyle,frameAdjust:frame.forcedColorAdjust,
                handleOutline:handle.outlineStyle,handleAdjust:handle.forcedColorAdjust,
                active:document.activeElement && document.activeElement.dataset.corner,
                boxes:[...document.querySelectorAll('.heroHeadHandle,.heroHeadRotate')].map(n=>{const r=n.getBoundingClientRect();return[r.width,r.height];})};
            }""")
            assert forced["matches"] and forced["active"], (label, forced)
            assert forced["frameOutline"] != "none" and forced["handleOutline"] != "none", (label, forced)
            assert forced["frameAdjust"] == "auto" and forced["handleAdjust"] == "auto", (label, forced)
            assert all(w >= 44 and h >= 44 for w, h in forced["boxes"]), (label, forced)
            forced_geometry = page.locator("#heroHeadSelection").bounding_box()
            assert all(abs(forced_geometry[key] - normal_geometry[key]) <= 1
                       for key in ("x", "y", "width", "height")), (
                label, normal_geometry, forced_geometry
            )
            context.close()

        for width, height in ((1440, 900), (1280, 650), (390, 844), (320, 800)):
            label = (width, height, "performances")
            context = browser.new_context(
                viewport={"width": width, "height": height}, reduced_motion="no-preference"
            )
            context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda message: errors.append(message.text)
                    if message.type == "error" else None)
            page.goto(base_url + "/index.html?head-transform-performances=1", wait_until="load")
            page.wait_for_function("typeof introMode !== 'undefined' && !introMode && !eventLock", timeout=15_000)
            transformed = select_move_resize(page)
            hero = page.locator("#main").bounding_box()
            page.mouse.move(hero["x"] + hero["width"] * .25, hero["y"] + hero["height"] * .72)
            page.wait_for_selector("#stage .iris")
            gaze_a = iris_transform(page)
            page.mouse.move(hero["x"] + hero["width"] * .75, hero["y"] + hero["height"] * .72)
            page.wait_for_function("""before => {const iris=document.querySelector('#stage .iris');
              return iris ? getComputedStyle(iris).transform !== before : false;}""", arg=gaze_a)
            gaze_b = iris_transform(page)
            assert gaze_a and gaze_b and gaze_a != gaze_b, (label, gaze_a, gaze_b)
            page.evaluate("requestBlink('neutral', false, false)")
            page.wait_for_function("/_closed\.webp$/.test(document.querySelector('#face').getAttribute('src'))")
            page.wait_for_function("document.querySelectorAll('#stage .iris').length >= 2")
            page.evaluate("document.querySelectorAll('#stage .iris').forEach(n=>n.dataset.task4BeforeSmile='1')")
            page.locator(".csPanel.on .csGo").first.evaluate("n=>n.focus({preventScroll:true})")
            page.wait_for_function("/smile\.webp$/.test(document.querySelector('#face').getAttribute('src'))")
            page.wait_for_function("document.querySelectorAll('#stage .iris').length===0")
            page.locator(".csPanel.on .csGo").first.evaluate("n=>n.blur()")
            page.wait_for_function("/neutral\.webp$/.test(document.querySelector('#face').getAttribute('src'))")
            page.wait_for_function("""document.querySelectorAll('#stage .iris').length>=2 &&
              !document.querySelector('#stage .iris[data-task4-before-smile]')""")
            page.locator('.csTab[data-tab="goodness"]').evaluate("n=>n.click()")
            page.locator("#reelFrame").evaluate("n=>n.focus({preventScroll:true})")
            page.wait_for_timeout(40)
            page.evaluate("""() => document.querySelector('#stage').dispatchEvent(
              new TransitionEvent('transitionend',{bubbles:true,propertyName:'transform'}))""")
            in_flight = []
            for _ in range(16):
                page.wait_for_timeout(35)
                in_flight.append(movie_projection(page))
            # ── ONE FRAME BEHIND IS NOT A DRIFT ───────────────────────────
            # These samples are taken deliberately mid-transition. The effects
            # stage tracks the head on its own animation frame, so while the
            # head is moving the projection is always about one frame behind it
            # -- and a frame of travel on a 360px head at 1.28x is several
            # pixels, which is why a flat tolerance started failing the moment
            # the test resized far enough to be sure it had grown the head.
            # The allowance is therefore the head's OWN travel between two
            # samples: the projection may lag by a frame, and by no more.
            previous_sample = None
            for sample in in_flight:
                assert sample["visible"]["top"] >= sample["hero"]["top"] - .5, (label, sample)
                travel = 0 if previous_sample is None else max(
                    abs(sample["stage"][edge] - previous_sample["stage"][edge])
                    for edge in ("left", "top", "right", "bottom"))
                allowed = max(2, travel + 1)
                assert all(abs(sample["stage"][edge] - sample["effects"][edge]) <= allowed
                           for edge in ("left", "top", "right", "bottom")), (
                    label, allowed, travel, sample)
                previous_sample = sample
                assert_frame_welded(sample, label)
            page.wait_for_function("""document.querySelector('.heroCharacterPeek').classList.contains('is-movie') &&
              document.querySelector('#glasses').classList.contains('on') && document.querySelector('.popbucket') &&
              document.querySelector('.heroCharacterPeek').hasAttribute('data-movie-tick')""")
            page.wait_for_function("parseFloat(getComputedStyle(document.querySelector('.popbucket')).opacity)>0")
            page.wait_for_function("""() => {const b=document.querySelector('.popbucket').getBoundingClientRect(),
              h=document.querySelector('#main').getBoundingClientRect();return b.top<h.bottom && b.bottom>h.top &&
              parseFloat(getComputedStyle(document.querySelector('.popbucket')).opacity)>.5 &&
              parseFloat(getComputedStyle(document.querySelector('#glasses')).opacity)>.5 &&
              document.querySelector('#glasses').getAnimations().every(a=>a.playState==='finished');}""")
            projection = movie_projection(page)
            assert projection["state"] == transformed, (label, transformed, projection)
            assert projection["glasses"] and projection["props"] >= 1, (label, projection)
            assert projection["clipOverflow"] == "clip", (label, projection)
            assert all(abs(projection["stage"][edge] - projection["effects"][edge]) <= 2
                       for edge in ("left", "top", "right", "bottom")), (label, projection)
            assert all(abs(projection["hero"][edge] - projection["clip"][edge]) <= .5
                       for edge in ("left", "top", "right", "bottom")), (label, projection)
            assert_frame_welded(projection, label)
            page.screenshot(path=str(TASK4_SHOTS / f"home-{width}-{height}-movie-active.png"))
            page.locator("#reelFrame").evaluate("n=>n.blur()")
            page.wait_for_function("!document.querySelector('.heroCharacterPeek').classList.contains('is-movie')")
            page.wait_for_function("parseFloat(getComputedStyle(document.querySelector('#glasses')).opacity)===0")
            page.wait_for_function("document.querySelectorAll('#stage .iris').length >= 2")
            assert page.evaluate("window.__heroHeadTransform.getState()") == transformed, label
            page.screenshot(path=str(TASK4_SHOTS / f"home-{width}-{height}-post-performance.png"))
            assert not errors, (label, errors)
            context.close()
        browser.close()


def document_width(page):
    return page.evaluate("document.documentElement.scrollWidth")


def iris_transform(page):
    return page.evaluate("""() => {const iris=document.querySelector('#stage .iris');
      return iris ? getComputedStyle(iris).transform : null;}""")


def movie_projection(page):
    return page.evaluate("""() => {
      const rect=node=>{const r=node.getBoundingClientRect();return {
        left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const h=rect(document.querySelector('#main'));
      // ── WHAT THE SELECTION BOX IS SUPPOSED TO BE ─────────────────────────
      // This used to slice head-bounds fractions out of the face's bounding
      // rect. That is the head only while the head is level; at the resting
      // -13.8deg the rect is the TURNED box of the whole portrait and the
      // slice is a rectangle that corresponds to nothing. Rebuilt the way
      // syncSelection builds it: the level head, plus the uniform ring of air,
      // turned about its own centre, clipped to the Hero below the floating
      // bar. Comparing the chrome against that is comparing it against its own
      // definition rather than against a coincidence that held at 0deg.
      const level=(""" + LEVEL_HEAD + """)();
      const air=parseFloat(getComputedStyle(document.documentElement)
        .getPropertyValue('--selection-air'))||0;
      const wrap=document.querySelector('#heroHeadTransform');
      const wrapStyle=getComputedStyle(wrap);
      const angle=(parseFloat(wrapStyle.getPropertyValue('--hero-head-rotate'))||0)
        +(parseFloat(wrapStyle.getPropertyValue('--hero-head-float-rot'))||0);
      const rad=angle*Math.PI/180;
      const cos=Math.abs(Math.cos(rad)),sin=Math.abs(Math.sin(rad));
      const bw=(level.width+air*2)*cos+(level.height+air*2)*sin;
      const bh=(level.width+air*2)*sin+(level.height+air*2)*cos;
      const cx=(level.left+level.right)/2,cy=(level.top+level.bottom)/2;
      const bar=document.querySelector('.jbStick .jbNav')||document.querySelector('.jbStick');
      let ceiling=h.top;
      if(bar){const r=bar.getBoundingClientRect();
        if(r.bottom>h.top&&r.top<h.bottom&&r.width>0)ceiling=Math.min(r.bottom,h.bottom);}
      const visible={left:Math.max(cx-bw/2,h.left),top:Math.max(cy-bh/2,ceiling),
        right:Math.min(cx+bw/2,h.right),bottom:Math.min(cy+bh/2,h.bottom)};
      // ── THE FRAME IS WELDED TO THE GEOMETRY, NOT TO THE PERFORMANCE ─────
      // During a movie the engine writes its own transform on #stage every
      // frame -- a body-language dip, a lean, a squash. The selection frame is
      // deliberately NOT allowed to chase that: it is a rigid body derived from
      // the captured local rect, which is the whole reason it stops breathing
      // and shimmering. So the thing to compare the chrome against here is that
      // rigid rect (getState().box, Hero-relative), not the rendered head.
      // getState().box is the clamp's geometry and deliberately EXCLUDES the
      // float -- the clamp reasons about where the visitor put the head, not
      // about where it is drifting this instant. The chrome does include the
      // float, because it has to stay welded to what is on screen. So the
      // float is added back here rather than either number being changed.
      const st=window.__heroHeadTransform.getState();
      const wrapNode=document.querySelector('#heroHeadTransform');
      const drift={x:parseFloat(wrapNode.style.getPropertyValue('--hero-head-float-x'))||0,
                   y:parseFloat(wrapNode.style.getPropertyValue('--hero-head-float-y'))||0};
      const rigid=st.box?{left:h.left+st.box.left+drift.x,top:h.top+st.box.top+drift.y,
        right:h.left+st.box.right+drift.x,bottom:h.top+st.box.bottom+drift.y,
        width:st.box.width,height:st.box.height}:null;
      return {state:st,visible,rigid,
        air:parseFloat(getComputedStyle(document.documentElement)
          .getPropertyValue('--selection-air'))||0,
        selection:rect(document.querySelector('#heroHeadSelection')),
        stage:rect(document.querySelector('#stage')),
        effects:rect(document.querySelector('#heroMovieEffectsStage')),hero:h,
        clip:rect(document.querySelector('#heroMovieEffectsClip')),
        clipOverflow:getComputedStyle(document.querySelector('#heroMovieEffectsClip')).overflow,
        glasses:document.querySelector('#glasses').classList.contains('on'),
        props:[...document.querySelectorAll('.popbucket,.kernel,.popcrumb')]
          .filter(n=>{const r=n.getBoundingClientRect();return parseFloat(getComputedStyle(n).opacity)>0 &&
            r.right>h.left && r.left<h.right && r.bottom>h.top && r.top<h.bottom;}).length};
    }""")


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    TASK4_SHOTS.mkdir(parents=True, exist_ok=True)
    static_contract()
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))
    )
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract(f"http://127.0.0.1:{server.server_port}")
        task4_matrix(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown()
        server.server_close()
    rate = 100 * HIT_TALLY["hit"] / max(1, HIT_TALLY["total"])
    print(f"Handle dots hit at the drawn dot: {HIT_TALLY['hit']}/{HIT_TALLY['total']}"
          f" = {rate:.1f}%")
    print(f"Handle gestures started correctly: {GESTURE_TALLY['hit']}"
          f"/{GESTURE_TALLY['total']}")
    assert not HIT_TALLY["worst"], HIT_TALLY["worst"]
    assert rate == 100, rate
    print("Hero head transform: OK")


if __name__ == "__main__":
    main()
