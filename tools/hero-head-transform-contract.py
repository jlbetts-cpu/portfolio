#!/usr/bin/env python3
import math
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from PIL import Image
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


# ── THE HEAD'S BOUNDS ARE MEASURED, NOT AUTHORED ─────────────────────────────
# data-head-bounds is where the head sits inside its own image, and the frame
# traces it exactly -- so a value one pixel tighter than the cut-out is a head
# standing outside its own selection box, permanently, on a frame that never
# goes away. It shipped tighter: 0.22 0.12 0.80 0.91 is a rectangle around the
# FACE, and the artwork is a photographic cut-out with HAIR. Measured off the
# alpha channel, the top edge alone was 5.8% of the image short, which is 5.7px
# of head outside the frame at the resting 235px and 58px outside it at 2.2x.
# So the number is not asserted as a literal any more. It is DERIVED here, from
# the same pixels the browser paints, and the attribute is checked against the
# derivation -- neither tighter (the head escapes) nor padded (a fudge that
# happens to work at one size). A re-exported portrait with taller hair now
# fails this file instead of quietly growing out of its frame.
def face_images():
    """Every image the engine can put in #face, read from the engine's own table.

    Listing them here by hand is how one gets missed: wink.webp carries the
    tallest hair of the nine and is reachable from an idle fidget and from the
    logo hover, neither of which anybody thinks about when editing a list.
    """
    engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    table = engine.split("const FACES={", 1)[1].split("\n};", 1)[0]
    names = sorted(set(re.findall(r'"(images/[\w./-]+\.webp)"', table)))
    assert len(names) >= 8, names
    return names


def measured_head_bounds():
    """The union of every face's opaque extent, as fractions of its own image.

    THE UNION, NOT THE CURRENT FACE. A frame that re-hugged whichever face is
    showing would resize itself every time he blinks -- the exact breathing the
    rigid-body rewrite exists to stop -- and would let the next mood step
    outside it. One rectangle that bounds every face the head can wear is the
    object's bounds, and that is what a design tool frames.
    """
    left, top, right, bottom = 1.0, 1.0, 0.0, 0.0
    for name in face_images():
        image = Image.open(ROOT / name).convert("RGBA")
        width, height = image.size
        box = image.getchannel("A").getbbox()
        assert box, name
        left = min(left, box[0] / width)
        top = min(top, box[1] / height)
        right = max(right, box[2] / width)
        bottom = max(bottom, box[3] / height)
    return left, top, right, bottom


def authored_head_bounds():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    found = re.search(r'data-head-bounds="([\d.\s]+)"', html)
    assert found, "the portrait must declare where the head sits in its image"
    values = [float(part) for part in found.group(1).split()]
    assert len(values) == 4, values
    return values


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
RIGID_TALLY = {"worst": 0.0, "samples": 0, "where": None}


def assert_handle_hits(page, label):
    """Every drawn dot must be aimable, and welded to the corner it names.

    THE TEST IS THE DOT, NOT THE BOX. Nobody aims at an invisible 44px square;
    they aim at the 8px square they can see. This component has already shipped
    a version where the sw and se dots were painted ~30px OUTSIDE their own hit
    area -- permanently dead, not intermittent -- and elementFromPoint at the
    visible dot is the only probe that catches that.

    AND THE CORNER IT CHECKS AGAINST IS THE ROTATED ONE. The head rests turned,
    so the selection box's own corners are the corners of a bounding box, not of
    the head. Asserting the dot sits on those would be asserting the head is
    level, which it has not been since --hero-head-rest-rotate was wired.

    ── AND THE OFFSET FROM THAT CORNER IS ZERO, NOT MERELY BOUNDED ─────────────
    The assertion here used to be that the dot lies somewhere on the segment
    between its hit box's centre and the true corner. That is satisfied by a dot
    anywhere in a 22px range, which is how the shipped build could draw all four
    corner dots 4px off their corners at rest, and -- once the head was dragged
    up -- draw nw, ne and the rotator at exactly the same y while the box was
    turned -13.8deg. Being LEVEL was the tell Jayden's screenshot carried: a
    rotated rectangle's corners cannot share a y unless something is overriding
    it, and three independent clamps against one shared bound is what does that.

    The frame and the head are one rigid body -- measured at 0.000e+00 variance
    across sixty float frames -- and the handles are part of that body. So the
    offset is asserted to be ZERO, which makes it invariant under rotation and
    scale by construction rather than by a separate sweep. This assertion runs
    at rest, at both scale limits, at the tested rotations, at both widths and
    with the head dragged against each edge.

    A HANDLE WHOSE CORNER HAS LEFT THE STAGE IS ALLOWED NOT TO EXIST -- and is
    then held to a stricter standard, not a looser one. It must be hidden AND
    unpressable together (a live target with no dot is the dead handle again,
    from the other direction), and it must be genuinely off stage: the predicate
    is restated here from the Hero's own rect rather than read back from the
    attribute, so the module and the contract cannot agree on a wrong answer.
    At least one corner must survive in every arrangement, or the composition
    would be unrecoverable.
    """
    page.wait_for_timeout(30)
    handles = page.evaluate(
        """label => {
          const selection=document.querySelector('#heroHeadSelection');
          const selectedRect=selection.getBoundingClientRect();
          const heroRect=document.querySelector('#main').getBoundingClientRect();
          // THE REACHABLE REGION, RESTATED. The Hero minus the opaque floating
          // bar across its top -- derived here from the live DOM rather than
          // taken from the module, so the two are independent witnesses.
          const barNode=document.querySelector('.jbStick .jbNav')
            ||document.querySelector('.jbStick');
          let reachTop=heroRect.top;
          if(barNode){
            const b=barNode.getBoundingClientRect();
            if(b.bottom>heroRect.top&&b.top<heroRect.bottom&&b.width>0)
              reachTop=Math.min(b.bottom,heroRect.bottom);
          }
          const hitSize=parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--selection-hit-size'))||44;
          const dotSize=parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--selection-handle-size'))||8;
          // A dot is unreachable exactly when its corner has left the region a
          // pointer can press. The target slides to stay inside that region and
          // by no more than the corner is past its edge, so "the target no
          // longer contains its own dot" and "the corner is off the stage" are
          // the same statement -- which is why this can be restated from the
          // Hero's rect alone, with no reference to the module's arithmetic.
          const edge=0;
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
            // A DOT WITH NO LOCATION IS A DEAD HANDLE, NOT A CRASH. The dot's
            // position is read back through getComputedStyle on the ::before,
            // and `left` there is calc(50% + var(--h-dx)) -- so if --h-dx is
            // ever written as something the cascade cannot resolve, or the
            // selection is display:none when this runs, the declaration falls
            // back to `auto` and parseFloat gives NaN. Passing that to
            // elementFromPoint throws "The provided double value is
            // non-finite", which killed the whole gate with a stack trace in
            // Playwright's plumbing and no mention of the head at all -- half a
            // day of bisecting to find out WHICH handle. It is a real failure
            // and it now reads as one, with the numbers that name it.
            const finite=Number.isFinite(dot.x)&&Number.isFinite(dot.y);
            const hits=!finite?[false]:points.map(([dx,dy])=>{
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
            const style=getComputedStyle(handle);
            return {
              label, corner, hits, angle, finite,
              dot:{x:dot.x,y:dot.y},
              beforeLeft:before.left,beforeTop:before.top,
              selectionHidden:selection.hidden,
              selectedIntersection:intersectionWidth*intersectionHeight,
              heroIntersection:heroIntersectionWidth*heroIntersectionHeight,
              area:rect.width*rect.height,
              // THE DOT MUST LIVE INSIDE ITS OWN TARGET. This single number is
              // the one that was ~30px wrong for two of the four corners.
              dotOutsideHit:Math.max(0,rect.left-dot.x,dot.x-rect.right,
                rect.top-dot.y,dot.y-rect.bottom),
              along, dotLen, truthLen,
              // ZERO, NOT BOUNDED: how far the painted square sits from the
              // corner of the rigid body it belongs to.
              rigid:Math.hypot(dot.x-truth.x,dot.y-truth.y),
              off:handle.hasAttribute('data-off'),
              // The dot goes and the button stays: nothing is drawn where it
              // cannot be pressed, nothing is pressable where nothing is drawn,
              // and the control is still there for a keyboard.
              hidden:parseFloat(before.opacity)===0,
              inert:style.pointerEvents==='none',
              operable:style.visibility!=='hidden'&&style.display!=='none',
              // The same predicate the module applies, restated from the Hero.
              offStage:truth.x<heroRect.left+edge||truth.x>heroRect.right-edge
                ||truth.y<reachTop+edge||truth.y>heroRect.bottom-edge,
              rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}
            };
          });
        }""",
        label,
    )
    # ── A DISMISSED FRAME IS NOT A FAILING HANDLE ──────────────────────────
    # #heroHeadSelection is display:none when the frame has been dismissed, and
    # a ::before inside a display:none subtree keeps its COMPUTED value: `left`
    # stays calc(50% + var(--h-dx)) with the percentage unresolved, so every
    # number below is read off a rectangle that is 0x0 at the document origin
    # and parseFloat returns NaN for any handle whose dot is offset. That threw
    # out of elementFromPoint with "The provided double value is non-finite" --
    # a stack trace inside Playwright's plumbing that named neither the head nor
    # the handle, and cost most of a day to trace to a frame that had simply
    # been closed. Say THAT instead: every assertion under it is about where a
    # handle is drawn, and none of them mean anything while nothing is drawn.
    assert not any(handle["selectionHidden"] for handle in handles), (
        label, "the selection frame was dismissed before this measurement -- "
        "something took the press that was meant for the head", handles[:1])
    live = [handle for handle in handles if not handle["off"]]
    for handle in live:
        HIT_TALLY["total"] += len(handle["hits"])
        HIT_TALLY["hit"] += sum(handle["hits"])
        if not all(handle["hits"]):
            HIT_TALLY["worst"].append((label, handle["corner"], handle["hits"]))
        RIGID_TALLY["samples"] += 1
        if handle["rigid"] > RIGID_TALLY["worst"]:
            RIGID_TALLY["worst"] = handle["rigid"]
            RIGID_TALLY["where"] = (label, handle["corner"], round(handle["angle"], 2))
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
        # THE HANDLE IS PART OF THE RIGID BODY. Half a pixel of slack for the
        # float's own sub-pixel rounding, and nothing else.
        and handle["rigid"] <= 0.5
        and not handle["offStage"]
        and all(handle["hits"])
        for handle in live
    ), [h for h in live if h["rigid"] > 0.5 or h["offStage"] or not all(h["hits"])]
    # A handle that has stepped off the stage must be hidden AND inert, and must
    # actually be off the stage. Half-measures here are the dead handle again.
    assert all(
        handle["hidden"]
        and handle["inert"]
        and handle["offStage"]
        # AND STILL OPERABLE FROM THE KEYBOARD. Removing it outright cost the
        # token maximum scale, silently, to anyone holding an arrow key.
        and handle["operable"]
        for handle in handles
        if handle["off"]
    ), [h for h in handles if h["off"]]
    assert any(
        handle["corner"] != "rotate" for handle in live
    ), ("no corner handle survives -- the arrangement is unrecoverable", label, handles)


# ── THE FRAME MUST CONTAIN THE ARTWORK, AT EVERY SIZE AND EVERY ANGLE ────────
# "Sometimes the head peaks out of it" was the hair: data-head-bounds traced the
# face, the frame traced data-head-bounds, and the difference is a photographic
# cut-out's silhouette. This measures the real thing -- the artwork's opaque
# extent, from the alpha channel -- and asks whether it lies inside the
# rectangle actually drawn on screen.
#
# IN THE FRAME'S OWN FRAME. Rotation is not a source of error here as long as
# both the head and its frame go through one matrix, and proving that is the
# point: the artwork's corners are turned about the head's rotation centre, the
# frame's corners about the frame's, and the two are compared after un-turning
# by the frame's angle. If anything downstream ever computes the frame from a
# TURNED bounding box and then turns it again, the corners escape and this
# fails -- which is exactly the failure the 45deg sample exists to catch, since
# that is where a turned box is furthest from the rectangle it holds.
#
# AND IT MUST NOT BE PADDED EITHER. The clearance is asserted to be the authored
# --selection-air and no more, so nobody can pass this by making the frame
# generous: a fudge factor that reads right at 1x is visibly loose at 0.24x and
# still short at 2.2x.
FRAME_CONTAINS = """({bounds, air}) => {
  const wrap=document.querySelector('#heroHeadTransform');
  const face=document.querySelector('#face');
  const sel=document.querySelector('#heroHeadSelection');
  const frameNode=document.querySelector('.heroHeadFrame');
  const authored=face.dataset.headBounds.split(/\\s+/).map(Number);
  // The head measured LEVEL, which is the only state its bounds fractions mean
  // anything in, plus the point it turns about -- the centre of those same
  // fractions, because that is what syncOrigin() writes as transform-origin.
  const names=['--hero-head-rotate','--hero-head-float-rot','--hero-head-enter-rot'];
  const live=names.reduce((sum,n)=>
    sum+(parseFloat(getComputedStyle(wrap).getPropertyValue(n))||0),0);
  const saved=names.map(n=>[n,wrap.style.getPropertyValue(n),wrap.style.getPropertyPriority(n)]);
  names.forEach(n=>wrap.style.setProperty(n,'0deg','important'));
  const f=face.getBoundingClientRect();
  saved.forEach(([n,v,p])=>{if(v)wrap.style.setProperty(n,v,p);else wrap.style.removeProperty(n);});
  // No letterbox: the fractions are fractions of the IMAGE, and they are
  // applied to the ELEMENT. object-fit:contain makes those the same rectangle
  // only while the element's aspect matches the image's, so that is asserted
  // rather than assumed.
  const fit=Math.min(f.width/face.naturalWidth,f.height/face.naturalHeight);
  const letterbox=Math.max(Math.abs(f.width-face.naturalWidth*fit),
                           Math.abs(f.height-face.naturalHeight*fit))/2;
  const art={left:f.left+f.width*bounds[0],top:f.top+f.height*bounds[1],
             right:f.left+f.width*bounds[2],bottom:f.top+f.height*bounds[3]};
  const pivot={x:f.left+f.width*(authored[0]+authored[2])/2,
               y:f.top+f.height*(authored[1]+authored[3])/2};
  const rad=live*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
  const spin=(x,y)=>({x:pivot.x+(x-pivot.x)*cos-(y-pivot.y)*sin,
                      y:pivot.y+(x-pivot.x)*sin+(y-pivot.y)*cos});
  const corners=[[art.left,art.top],[art.right,art.top],
                 [art.right,art.bottom],[art.left,art.bottom]].map(c=>spin(c[0],c[1]));
  // The rectangle actually painted: the selection box's origin, the frame
  // layer's offset inside it, and the angle the chrome was handed.
  const r=sel.getBoundingClientRect();
  const num=n=>parseFloat(frameNode.style.getPropertyValue(n))||0;
  const fw=num('--frame-w'),fh=num('--frame-h');
  const fc={x:r.left+num('--frame-x')+fw/2,y:r.top+num('--frame-y')+fh/2};
  const fang=(parseFloat(sel.style.getPropertyValue('--hero-head-rotate'))||0)*Math.PI/180;
  const fcos=Math.cos(-fang),fsin=Math.sin(-fang);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  corners.forEach(c=>{
    const dx=c.x-fc.x,dy=c.y-fc.y;
    const lx=dx*fcos-dy*fsin,ly=dx*fsin+dy*fcos;
    minX=Math.min(minX,lx);maxX=Math.max(maxX,lx);
    minY=Math.min(minY,ly);maxY=Math.max(maxY,ly);
  });
  const over={left:-fw/2-minX,right:maxX-fw/2,top:-fh/2-minY,bottom:maxY-fh/2};
  return {over,worst:Math.max(...Object.values(over)),letterbox,air,
    angle:live,frameAngle:parseFloat(sel.style.getPropertyValue('--hero-head-rotate'))||0,
    scale:window.__heroHeadTransform.getState().scale,
    frame:{w:fw,h:fh}};
}"""


def assert_frame_contains_artwork(page, label, bounds, failures):
    page.evaluate("window.__heroHeadTransform.stopFloat()")
    page.wait_for_timeout(40)
    air = page.evaluate(
        "() => parseFloat(getComputedStyle(document.documentElement)"
        ".getPropertyValue('--selection-air'))||0"
    )
    result = page.evaluate(FRAME_CONTAINS, {"bounds": list(bounds), "air": air})
    CONTAINMENT_TALLY["total"] += 1
    contained = result["worst"] <= 0
    snug = result["worst"] >= -(air + 1.5)
    CONTAINMENT_TALLY["hit"] += contained and snug
    record(
        failures,
        contained and snug and result["letterbox"] <= 0.5,
        f"{label} frame contains the artwork",
        result,
    )
    return result


CONTAINMENT_TALLY = {"hit": 0, "total": 0}


def turn_to(page, degrees):
    """Rotate with the keyboard, which quantises to --hero-head-rotate-step-large."""
    page.locator(".heroHeadRotate").evaluate("node => node.focus({preventScroll:true})")
    for _ in range(32):
        now = page.evaluate("window.__heroHeadTransform.getState().rotate")
        if abs(now - degrees) <= 0.01:
            return now
        page.keyboard.press(
            "Shift+ArrowRight" if degrees > now else "Shift+ArrowLeft"
        )
        page.wait_for_timeout(20)
    return page.evaluate("window.__heroHeadTransform.getState().rotate")


def scale_to_limit(page, direction):
    page.locator('.heroHeadHandle[data-corner="se"]').evaluate(
        "node => node.focus({preventScroll:true})"
    )
    for _ in range(40):
        page.keyboard.press(f"Shift+Arrow{direction}")
    page.wait_for_timeout(40)
    return page.evaluate("window.__heroHeadTransform.getState().scale")


GESTURE_TALLY = {"hit": 0, "total": 0}


def assert_handle_gestures(page, label):
    """Pressing the dot must start the gesture that dot advertises.

    Five 44px targets do not fit on a 136px head, so they overlap -- and paint
    order used to decide the overlap, which is how the rotate handle came to be
    dead at the resting composition on a 390 viewport (its dot sat 24px from the
    nw dot, entirely inside nw's target, and .heroHeadHandle paints above
    .heroHeadRotate). Real input only: the handlers use setPointerCapture, so a
    dispatched PointerEvent reports failure on working code.

    ── A HANDLE THAT IS NOT ON SCREEN IS NOT TESTED, AND THAT IS NOT A LOOPHOLE
    At 320 the authored resting composition puts the head's nw corner 12px past
    the left edge of the window. There is no honest place to draw that handle:
    the shipped build drew it at x=4, sixteen pixels from the corner it names,
    and a test that pressed it was confirming the frame could lie rather than
    that the handle worked. The corner is off stage, the handle says so, and it
    is skipped here for the same reason the frame's own outline is cropped
    there.
    WHAT IS ASSERTED INSTEAD IS THAT THE COMPOSITION STAYS RECOVERABLE: every
    handle that IS on screen must start the gesture it advertises, and at least
    one corner must be on screen, or nothing could ever be resized back.
    """
    # Asked at rest, because rest is the pose every iteration below returns to.
    page.evaluate("window.__heroHeadTransform.reset()")
    page.wait_for_timeout(40)
    present = page.evaluate(
        """() => [...document.querySelectorAll('.heroHeadHandle,.heroHeadRotate')]
             .filter(n => !n.hasAttribute('data-off'))
             .map(n => n.getAttribute('data-corner') || 'rotate')"""
    )
    assert any(name != "rotate" for name in present), (label, "no corner on stage", present)
    for name in present:
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


# ── DRIVE A HANDLE THAT IS ACTUALLY THERE ────────────────────────────────────
# A corner whose true position has left the stage is hidden and inert, so a test
# that keeps pressing `se` because `se` is the tidy choice stops testing
# anything the moment the head is scaled up far enough to push that corner past
# the Hero's floor -- it presses empty space, nothing moves, and the assertion
# blames the scale limits. The tests below ask which corners are on stage and
# drive one of those, preferring the one they were written around. What they are
# really about -- that the token bounds the scale, that the opposite corner
# stays put -- is a property of any corner, not of that one.
def live_corners(page):
    return page.evaluate(
        """() => [...document.querySelectorAll('.heroHeadHandle')]
             .filter(node => !node.hasAttribute('data-off'))
             .map(node => node.getAttribute('data-corner'))"""
    )


def a_live_corner(page, prefer):
    corners = live_corners(page)
    assert corners, (
        "no corner handle is on stage, so the scale could never be brought back -- "
        "that is the failure, not the assertion that follows"
    )
    return prefer if prefer in corners else corners[0]


# ── A GESTURE IS NOT OVER UNTIL THE OBJECT HAS STOPPED ───────────────────────
# The head rubber-bands past its bounds now and springs back, so for a few
# hundred milliseconds after a release it is still travelling. Everything below
# aims at a box it read a moment earlier, and a stale aim at a moving target is
# how this file started reporting failures on working code: measured, the second
# drag of the return-trip pair pressed the CENTRE of a box that had been read
# while the head was still 47px above where it was going to stop, and that point
# was under the floating nav -- so the press dismissed the frame instead of
# grabbing it. The visitor never has that problem, because the visitor aims at
# what is on screen rather than at a reading from 20ms ago.
# So the wait is part of performing a drag, not a tolerance added to an
# assertion: nothing here is weakened, it is just asked after the head has come
# to rest. `settling` is absent on a build without the spring, and `!undefined`
# is true, so this is a no-op against any earlier tree.
def wait_for_rest(page):
    page.wait_for_function(
        "() => !window.__heroHeadTransform.getState().settling", timeout=4000)


GRIP = """box => {
  // A FINGER IS NOT A POINT, so neither is this. Chromium applies touch
  // adjustment on a mobile context: a touch that lands on a plain div within
  // about a finger's width of a real button is DELIVERED TO THE BUTTON.
  // Measured at 390x844 with the head parked by the corner time control:
  // elementFromPoint(324,518) returns heroHeadSelection and the pointerdown
  // from the very same coordinate arrives at heroTimeBtn. A single-point test
  // therefore passes while the press it predicts goes somewhere else -- and
  // the frame is dismissed, which is what this whole helper exists to avoid.
  // So a candidate has to clear a radius, not a pixel.
  const inHead=n=>!!(n&&n.closest&&(n.closest('#heroHeadSelection')||n.closest('#face')));
  const reach=16, probes=[[0,0],[-reach,0],[reach,0],[0,-reach],[0,reach]];
  const spots=[];
  for (const fy of [.5,.35,.65,.25,.75]) for (const fx of [.5,.35,.65,.25,.75]) spots.push([fx,fy]);
  for (const [fx,fy] of spots) {
    const x=box.x+box.width*fx, y=box.y+box.height*fy;
    if (x<0||y<0||x>=innerWidth||y>=innerHeight) continue;
    if (!inHead(document.elementFromPoint(x,y))) continue;
    const clear=probes.every(([dx,dy])=>{
      const px=x+dx, py=y+dy;
      if (px<0||py<0||px>=innerWidth||py>=innerHeight) return true;
      const node=document.elementFromPoint(px,py);
      // Anything that is not the head and not inert page background is a thing
      // a finger could be snapped to.
      return inHead(node) || !(node&&node.closest&&node.closest('a,button,[role="button"],input,select'));
    });
    if (clear) return {x,y};
  }
  return null;
}"""


def grip_point(page):
    """Somewhere on the frame that the head will actually receive a press.

    The Hero has two opaque things sitting over the selection at opposite
    corners -- the floating nav across the top, and the corner time control at
    the bottom right, which index.html states outright "cannot be swallowed by a
    toy, at any z-index". Park the head against either and a fixed fraction of
    the box is a press on that chrome instead, which dismisses the frame; the
    drag then never happens and every rect the next assertion reads is 0x0.
    Both of those are correct product behaviour, so the test asks the page where
    it may press rather than hunting for a fraction that misses both.
    """
    box = page.locator("#heroHeadSelection").bounding_box()
    assert box, "the selection frame is not on screen -- something dismissed it"
    grip = page.evaluate(GRIP, box)
    assert grip, ("no point on the selection frame is pressable -- every one is "
                  "covered by something opaque", box)
    return grip


def drag_selection_to(page, x, y):
    """Grab the frame and put it somewhere, without pressing whatever is on top.

    NOT THE CENTRE, AND THE REASON IS A REAL RULE RATHER THAN A FLAKE. The
    corner time control sits at the Hero's bottom-right and index.html states
    outright that it "cannot be swallowed by a toy, at any z-index" -- so with
    the head parked down there, the selection's own centre is over the control.
    Measured at 390x844: the centre lands at (346,524) and elementsFromPoint
    returns heroTimeIcon / heroTimeBtn / heroTime. That press dismisses the
    frame instead of grabbing it, the drag never happens, and every rect the
    next assertion reads is 0x0 -- which surfaced as a non-finite value out of
    elementFromPoint, a stack trace inside Playwright's plumbing that named
    neither the head nor the handle.
    AND THE POINT IS CHOSEN BY ASKING, NOT BY PICKING A NICER FRACTION. The
    first fix here was a flat quarter in from the top-left, which clears the
    corner control -- and then lands under the OPAQUE NAV the moment the head
    has been dragged to the top of the Hero, because the selection box is
    clipped to the Hero and the Hero runs up behind the bar. Two opaque things
    at opposite corners is enough to say the rule out loud instead of hunting
    for a fraction that misses both: press somewhere the head actually receives
    the press. elementFromPoint answers that in one call and stays true when the
    next piece of chrome moves.
    """
    grip = grip_point(page)
    page.mouse.move(grip["x"], grip["y"])
    page.mouse.down()
    page.mouse.move(x, y, steps=5)
    page.mouse.up()
    wait_for_rest(page)


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


def authored_state(state):
    """The arrangement the visitor made, without the rectangle derived from it.

    THE EXTRAS LIFT MOVES THE BOX AND MUST NOT MOVE THE STATE. getState()
    reports `box` as a convenience for tests that need the geometry the clamp
    enforces -- but it is captured from the live layout, and during a
    performance the peek element travels under its own transform, which is
    exactly the behaviour the spec allows: "without changing the authored
    x/y/scale transform state; only the peek element's own transform transition
    can start or stop projection tracking". Comparing whole getState() dicts
    across a lift therefore asserts the opposite of the rule -- that the head
    must not follow the peek -- and fails on correct code by the height of the
    lift (measured: 64px at 1440). What has to hold is that x, y, scale and
    rotate are untouched. Where that box sits, and how big it is, belong to the
    peek and to the engine: captureBase() lifts the wrapper's own transform for
    its read but not the performance transform the engine writes on #stage, so
    during a squash the base picks that up and the box changes size by about
    half a percent -- measured, 1.29px on a 247px box at 1280. That is the same
    reason selected_chrome() already strips `box`: it is a derived rectangle in
    viewport pixels, and asserting on it is a test about the viewport rather
    than about the state.
    """
    return {key: state[key] for key in ("selected", "x", "y", "scale", "rotate")}


def assert_lift_preserved(before, after, label):
    assert authored_state(after) == authored_state(before), (label, before, after)


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
    """The pointer surface is the rigid rect, ringed with air and cropped by the stage.

    THREE THINGS, IN ONE COMPARISON. The box is built from the rigid rect --
    getState().box, which is already turned -- so nothing here reads a live
    rectangle: the portrait carries its own idle breathing and a measured
    silhouette disagrees with the enforced geometry by up to ~14px at any
    instant, which is the breathing rather than the rule.

    THE RING IS ADDED BEFORE THE TURN, so at an angle it contributes to both
    axes: air * (|cos| + |sin|) on every side, and the angle used is the one the
    chrome was actually handed, float included. This used to be a one-sided
    "grew by no more than air*2*1.45" allowance, which is the same number with
    the sign thrown away -- it could not tell a frame welded to the head from
    one that had drifted inward.

    AND IT IS CLIPPED, which the old form did not model at all. The selection
    box is the pointer surface, so it is deliberately cropped to the reachable
    region -- the Hero, minus the opaque bar across its top. Comparing a cropped
    box against an uncropped rect asserts that the head never reaches the edge
    of its own stage: it passed only while the head happened to be small enough,
    and failed by 14px on the centre the moment the head's bounds were corrected
    to include his hair. The expectation is cropped the same way the box is.
    """
    rigid, selection, air = sample["rigid"], sample["selection"], sample["air"]
    hero, ceiling = sample["hero"], sample["ceiling"]
    angle = math.radians(sample.get("angle", sample["state"]["rotate"]))
    # ── THE BOX IS TURNED ONCE, AT THE ANGLE THE CHROME WAS HANDED ──────────
    # getState().box is the clamp's rectangle and it is turned by state.rotate
    # ALONE, because the clamp reasons about the arrangement and not about
    # whatever the head is doing this instant. The chrome is turned by the sum
    # -- rest plus float plus the travel's bank -- so the two are boxes of the
    # same body at different angles, and adding a ring to one to predict the
    # other is only near-enough while the difference is a fraction of a degree.
    # It was: the bob alone is +-0.7deg, which is 1.6px of half-width at 1440
    # and fits inside the 2.5px tolerance, so the approximation held by luck.
    # The bank is +-2.6deg and it does not: measured at 1440 in the movie
    # matrix, expected 456.7 against an actual 460.5, and the frame was
    # perfectly welded -- the sample's own independently-computed `visible`
    # agreed with the live selection box to 0.007px.
    # So the local rectangle is recovered from the turned one and turned again
    # at the right angle, which is the arithmetic syncSelection() itself does.
    # Inverting W = w|cos| + h|sin| / H = w|sin| + h|cos| needs cos(2*theta0),
    # which is 0.886 at the resting -13.8deg and only degenerate at 45deg,
    # where the ring form is still the better answer.
    c0 = abs(math.cos(math.radians(sample["state"]["rotate"])))
    s0 = abs(math.sin(math.radians(sample["state"]["rotate"])))
    det = c0 * c0 - s0 * s0
    cos, sin = abs(math.cos(angle)), abs(math.sin(angle))
    exact = abs(det) > 0.1 and rigid.get("width") and rigid.get("height")
    if exact:
        local_w = (rigid["width"] * c0 - rigid["height"] * s0) / det + air * 2
        local_h = (rigid["height"] * c0 - rigid["width"] * s0) / det + air * 2
        half_w = (local_w * cos + local_h * sin) / 2
        half_h = (local_w * sin + local_h * cos) / 2
        centre = {"left": (rigid["left"] + rigid["right"]) / 2,
                  "top": (rigid["top"] + rigid["bottom"]) / 2}
        turned = {"left": centre["left"] - half_w, "right": centre["left"] + half_w,
                  "top": centre["top"] - half_h, "bottom": centre["top"] + half_h}
    else:
        ring = air * (cos + sin)
        turned = {side: rigid[side] + (-ring if side in ("left", "top") else ring)
                  for side in ("left", "right", "top", "bottom")}
    for near, far, low, high in (
        ("left", "right", hero["left"], hero["right"]),
        ("top", "bottom", ceiling, hero["bottom"]),
    ):
        expected_near = max(turned[near], low)
        expected_far = min(turned[far], high)
        # One animation frame of float may separate the two reads.
        assert abs(selection[near] - expected_near) <= 2.5, (
            label, near, expected_near, selection[near], sample)
        assert abs(selection[far] - expected_far) <= 2.5, (
            label, far, expected_far, selection[far], sample)


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
    # A HORIZONTAL LEAD-IN, BECAUSE touch-action IS pan-y NOW. The head no longer
    # swallows a vertical swipe -- that WAS "the head resizes on scroll on mobile",
    # measured at +0.70 of scale from a swipe up the NW handle with the page not
    # moving at all. A gesture that opens straight up or straight down is a page
    # scroll by design now. A drag that means the head opens sideways, which is
    # what a finger does when it means to drag a thing, and the browser then keeps
    # delivering the whole 2D path.
    for step in range(1, 4):
        client.send("Input.dispatchTouchEvent", {
            "type": "touchMove",
            "touchPoints": [{"x": start["x"] + 12 * step, "y": start["y"], "id": 1}],
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
    # AIM AT THE HEAD, NOT AT ITS BOUNDING BOX. #face is a square that is always
    # rotated, so bounding_box() is the TURNED box -- up to 22% larger than the
    # artwork -- and a point 30% down its centre line is not necessarily on the
    # head at all. At 1280x650 it lands on .heroCopy, which is genuinely outside
    # the portrait: an outside press now dismisses the frame rather than merely
    # relaxing it, so a mis-aim that used to be invisible fails here instead.
    # getState().box is the rigid rectangle the clamp itself reasons about.
    point = page.evaluate("""() => {const b=window.__heroHeadTransform.getState().box;
        return {x:(b.left+b.right)/2, y:(b.top+b.bottom)/2};}""")
    page.mouse.click(point["x"], point["y"])
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


# ── THE HEAD TRAVELS, AND IT NEVER TRAVELS OUT OF REACH ──────────────────────
# Jayden: "maybe it can be floating around the hero instead of just floating in
# one spot maybe bouncing and floating like the dvd symbol". So the float now
# carries the portrait across the Hero and turns at the edges, and there are
# exactly three things that can go wrong with that, all three of which this
# file already has precedent for:
#
#   IT DOES NOT ACTUALLY GO ANYWHERE. A bounded drift with a bug in its bounds
#     is a head that pins itself at the first wall and sits there looking
#     broken, which measures as "floating" and looks like nothing.
#   IT GOES SOMEWHERE IT CANNOT BE REACHED. This is the expensive one and it is
#     the reason usableRect() exists: the Hero runs up behind an opaque bar, and
#     a handle parked under it cannot be pressed at all -- the contract caught
#     exactly that once, with elementFromPoint returning NAV.jbNav where a
#     corner handle should have been. A travel bounded by the raw Hero rather
#     than the reachable region would walk the head straight back into it, and
#     it would do so a minute after load, which is the worst possible time for a
#     bug to appear because nobody is watching by then.
#   IT TRAVELS UNDER REDUCED MOTION. The bob is feedback-shaped and small; a
#     portrait crossing the screen on its own is autonomous travel of arbitrary
#     distance that nobody asked for frame by frame, which is precisely what the
#     setting is about. releaseMove()'s comment already draws that line for the
#     throw; this is the same line.
#
# SAMPLED FROM THE MODULE'S OWN NUMBERS, NOT FROM PIXELS. getBoundingClientRect
# on the portrait reads hero-engine's idle breathing, worth ~14px, which is
# larger than several of the tolerances here; getState() exposes travel and
# travelBounds for the same reason it exposes drift and box.
TRAVEL_SAMPLE = """() => {
  const s = window.__heroHeadTransform.getState();
  const hero = document.querySelector('#main').getBoundingClientRect();
  const bar = document.querySelector('.jbStick .jbNav')
    || document.querySelector('.jbStick');
  const wrap = document.querySelector('#heroHeadTransform');
  const num = n => parseFloat(wrap.style.getPropertyValue(n)) || 0;
  // THE REACHABLE REGION, RESTATED FROM THE PAGE rather than from the module,
  // so this witnesses the rule instead of quoting it back.
  let ceiling = 0;
  if (bar) {
    const b = bar.getBoundingClientRect();
    if (b.bottom > hero.top && b.top < hero.bottom && b.width > 0)
      ceiling = Math.min(b.bottom, hero.bottom) - hero.top;
  }
  const gap = parseFloat(getComputedStyle(document.querySelector('#main'))
    .getPropertyValue('--hero-head-safe-gap')) || 0;
  const share = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--hero-head-min-visible')) || 0.42;
  // Where the head's rigid box actually is, travel and bob included.
  const box = s.box, fx = num('--hero-head-float-x'), fy = num('--hero-head-float-y');
  const live = {left: box.left + fx, right: box.right + fx,
                top: box.top + fy, bottom: box.bottom + fy,
                width: box.width, height: box.height};
  const needX = Math.min(Math.max(live.width * share, gap), hero.width);
  const needY = Math.min(Math.max(live.height * share, gap), hero.height - ceiling);
  const sel = document.querySelector('#heroHeadSelection').getBoundingClientRect();
  const dots = [...document.querySelectorAll('.heroHeadHandle,.heroHeadRotate')]
    .map(n => {
      const st = getComputedStyle(n, '::before'), r = n.getBoundingClientRect();
      return {x: r.left + parseFloat(st.left) - hero.left,
              y: r.top + parseFloat(st.top) - hero.top,
              off: n.hasAttribute('data-off')};
    });
  const sel2 = document.querySelector('#heroHeadSelection');
  return {
    t: performance.now(), travel: s.travel, bounds: s.travelBounds,
    // THE LEAN, AND THE TWO NUMBERS THAT SAY IT IS NOT DRAWN TWICE.
    // rot is the whole of what the head adds to its authored resting angle --
    // the bob and the travel's bank share one channel on purpose -- and
    // frameRot is the angle the CHROME was handed. They are read together so
    // "the head leans" and "the frame leans with it" are one sample rather
    // than two tests that could pass in different states.
    rot: parseFloat(wrap.style.getPropertyValue('--hero-head-float-rot')) || 0,
    frameRot: parseFloat(sel2.style.getPropertyValue('--hero-head-rotate')) || 0,
    headRot: s.rotate,
    bobAmp: parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--hero-head-float-rot-amp')) || 0.7,
    // The reversal's own time constant, so the lean's speed limit below is
    // derived from the tuning rather than being a number somebody picked.
    turn: (parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--hero-head-travel-turn')) || 900) / 1000,
    x: s.x, y: s.y, ceiling: ceiling, heroW: hero.width, heroH: hero.height,
    // reachable(): a share of the head inside the Hero MINUS the opaque bar
    reachable: live.right >= needX && live.left <= hero.width - needX
      && live.bottom >= ceiling + needY && live.top <= hero.height - needY,
    dark: dots.filter(d => d.off).length,
    // HOW FAR PAST EACH EDGE THE FURTHEST DRAWN DOT IS, and zero when it is
    // inside. NOT the selection element's own rect: syncSelection() clamps that
    // to the Hero on all four sides by construction, so an assertion built on
    // it is true whatever the head does -- a dead test of the exact kind this
    // file's own header warns about. The DOTS are the thing that can leave.
    out: {l: Math.max(0, -Math.min(...dots.map(d => d.x))),
          r: Math.max(0, Math.max(...dots.map(d => d.x)) - hero.width),
          t: Math.max(0, -Math.min(...dots.map(d => d.y))),
          b: Math.max(0, Math.max(...dots.map(d => d.y)) - hero.height)},
    dotBox: {l: Math.min(...dots.map(d => d.x)), r: Math.max(...dots.map(d => d.x)),
             t: Math.min(...dots.map(d => d.y)), b: Math.max(...dots.map(d => d.y))}
  };
}"""


def sample_travel(page, seconds, every=0.1):
    """Sample the drift densely enough to see a turn happen, not just its ends."""
    rows = []
    for _ in range(int(seconds / every)):
        rows.append(page.evaluate(TRAVEL_SAMPLE))
        page.wait_for_timeout(int(every * 1000))
    return rows


def travel_speed_override(page, speed, sweep_ms):
    """Crank the drift so a whole journey fits inside a test.

    THE TOKENS ARE THE LEVER, AND THAT IS THE POINT. The shipped speed crosses
    a 1440 Hero in about a minute, so a test run at the shipped tuning can
    witness that the head moves and roughly how fast, and cannot witness what
    happens at the far wall without spending a minute per viewport getting
    there. Every other number the drift uses is already read from a custom
    property through the same cache, so raising two of them and invalidating
    the cache exercises the SHIPPED code path at a speed a test can watch --
    as opposed to re-injecting a fast variant, which would be testing a
    different program. The bounds, the turn and the clamp are untouched.
    """
    page.evaluate(
        """([speed, sweep]) => {
          const root = document.documentElement.style;
          root.setProperty('--hero-head-travel-speed-x', speed);
          root.setProperty('--hero-head-travel-speed-y', speed);
          root.setProperty('--hero-head-travel-sweep', sweep);
          window.__heroHeadTransform.reclamp();
        }""",
        [str(speed), str(sweep_ms)],
    )


def resting_envelope(page):
    """How far outside the Hero the drawn dots reach with the drift switched off.

    THE BASELINE IS THE RESTING POSE, NOT ZERO, AND THAT IS A FINDING RATHER
    THAN A CONCESSION. At 320x800 the shipped composition already puts the nw
    dot 13.4px off the left edge of the Hero, which makes that handle dark at
    rest -- measured on the build BEFORE the drift existed, so it is not the
    drift's doing and demanding zero here would be asserting a bug the site does
    not have a fix for yet. What the drift must not do is make it worse, and
    that is exactly what this baseline turns into a testable statement.

    THE BOB HAS TO BE RUNNING WHILE THIS IS TAKEN, or the baseline is a still
    frame and the comparison is off by up to 12px of sinusoid. Stopping the
    float would stop both; setting the travel speed to zero stops the journey
    and leaves the bob alone, which is the pose being described. The window is
    long enough to cover the two fast harmonics (3.7s and 5.9s).
    """
    travel_speed_override(page, 0, 14000)
    page.evaluate("window.__heroHeadTransform.reset()")
    page.wait_for_timeout(80)
    rows = sample_travel(page, 7, 0.2)
    worst = {side: max(r["out"][side] for r in rows) for side in ("l", "r", "t", "b")}
    return {"out": worst, "dark": max(r["dark"] for r in rows), "samples": len(rows)}


def assert_travels(page, label, failures):
    """The drift crosses the Hero, turns softly, and never leaves the region."""
    # THE POINTER GOES TO A CORNER FIRST. The float freezes while the pointer is
    # over the head or its frame -- that is what makes a 44px handle a still
    # target -- so a test that leaves the mouse where its last gesture ended is
    # measuring a head that is deliberately not moving.
    page.mouse.move(2, 2)
    page.wait_for_timeout(500)
    rest = resting_envelope(page)
    travel_speed_override(page, 22, 14000)
    page.wait_for_timeout(200)

    # ── 1. AT THE SHIPPED TUNING IT MOVES, AND IT MOVES SLOWLY ──────────────
    # Both halves are the requirement. "Slow" is not decoration here: the note
    # was "like the dvd symbol" on a portfolio, and a portrait crossing a hero
    # at screensaver speed is a gag. The ceiling is generous -- four times the
    # authored 22px/s -- because what it is there to catch is somebody reaching
    # for the speed token to make a demo read better.
    # ── DISTANCE TRAVELLED, NOT DISPLACEMENT ───────────────────────────────
    # It was |last - first|, and that measures the wrong thing the moment a
    # reversal falls inside the window: a head that goes out 90px and comes
    # back 60 reads as 30. That used to be rare because the resting offset sat
    # near the middle of the field; it is not rare now that the ceiling is the
    # nav's underside, which puts rest close to the BOTTOM of the vertical
    # field -- measured at 320x800, rest is 17px below the top wall and 234px
    # above the bottom one, so the first turn happens about two seconds in and
    # an 8s window always contains one. The head covered 56.2px of a 251.6px
    # field and was reported as failing to travel.
    # Path length is what "it goes somewhere" actually means, it is what the
    # speed assertion below wants anyway, and it is STRICTER against the failure
    # this pair exists to catch: a head pinned at a wall has a path length of 0
    # however the window is sliced.
    shipped = sample_travel(page, 8, 0.25)
    moved = max(sum(abs(b["travel"][axis] - a["travel"][axis])
                    for a, b in zip(shipped, shipped[1:]))
                for axis in ("x", "y"))
    span = max(shipped[0]["bounds"]["maxX"] - shipped[0]["bounds"]["minX"],
               shipped[0]["bounds"]["maxY"] - shipped[0]["bounds"]["minY"])
    seconds = (shipped[-1]["t"] - shipped[0]["t"]) / 1000
    # Against the FIELD as well as an absolute floor: at 320 the field is 126px
    # wide and the head cannot cover 60px of it without turning inside the
    # window, so demanding a flat distance would fail on a correct build.
    want = min(60, span * 0.35)
    record(failures, moved >= want,
           f"{label} the head travels at the shipped tuning",
           {"moved": round(moved, 1), "want": round(want, 1), "field": round(span, 1)})
    record(failures, moved / max(seconds, 0.001) <= 88,
           f"{label} the travel stays slow",
           {"px_per_second": round(moved / max(seconds, 0.001), 1)})

    # ── 2. CRANKED, IT REACHES BOTH WALLS AND COMES BACK ────────────────────
    # 20s AND 200ms, WHICH IS NOT AN ARBITRARY PAIR. At 120px/s the widest field
    # this site has -- 1179px at 1440x900 -- is crossed in 9.8s, so a window of
    # 20 covers going out to one wall and all the way back to the other with
    # margin. The interval is the cost: TRAVEL_SAMPLE resolves five pseudo-
    # elements and several rects, and at 100ms it added roughly five minutes per
    # viewport to a gate that has to run serially with twenty-nine others. A
    # turn spans about 1.8s, which is nine samples at 200ms -- still several
    # samples of evidence per reflection, which is what the assertions read.
    travel_speed_override(page, 120, 1500)
    rows = sample_travel(page, 20, 0.2)
    travel_speed_override(page, 22, 14000)
    xs = [r["travel"]["x"] for r in rows]
    ys = [r["travel"]["y"] for r in rows]
    bounds = rows[0]["bounds"]

    def turns(values):
        steps = [b - a for a, b in zip(values, values[1:])]
        steps = [v for v in steps if abs(v) > 0.25]
        return sum(1 for a, b in zip(steps, steps[1:]) if a * b < 0)

    record(failures, turns(xs) + turns(ys) >= 2,
           f"{label} the drift reflects rather than pinning at a wall",
           {"x_turns": turns(xs), "y_turns": turns(ys)})
    # It gets all the way there. A drift that turned early every time would
    # shrink its own field a little on each pass and end up hovering in the
    # middle, which is the failure that looks most like success.
    reachX = (max(xs) - min(xs)) / max(1e-6, bounds["maxX"] - bounds["minX"])
    reachY = (max(ys) - min(ys)) / max(1e-6, bounds["maxY"] - bounds["minY"])
    record(failures, max(reachX, reachY) >= 0.9,
           f"{label} the drift uses its whole field",
           {"x_share": round(reachX, 3), "y_share": round(reachY, 3)})

    # ── 3. AND NEVER LEAVES THE REACHABLE REGION WHILE IT DOES ──────────────
    # This is the assertion the whole helper exists for. Three statements, and
    # they are not the same statement: the reachability rule the clamp enforces,
    # the selection staying on the stage, and no handle going dark. A build that
    # bounced off the raw Hero would pass the first and fail the other two,
    # which is precisely the bug worth catching -- handles that are welded,
    # correctly, to a corner nobody can press.
    unreachable = [r for r in rows if not r["reachable"]]
    record(failures, not unreachable,
           f"{label} the drift stayed inside the reachable region",
           {"samples": len(rows), "bad": len(unreachable),
            "first": unreachable[0] if unreachable else None})
    # THE JOURNEY COSTS NO REACH. Per side, against the resting envelope, with
    # 1.5px of slack for the bob landing on a different phase than the baseline
    # sampled. A drift bounded by reachability alone -- the obvious one-line-
    # shorter implementation -- sails the leading corners off the stage and
    # fails here by hundreds of pixels, which is what --self-test proves.
    worst = {side: max(r["out"][side] for r in rows) for side in ("l", "r", "t", "b")}
    slipped = {side: round(worst[side] - rest["out"][side], 1)
               for side in worst if worst[side] > rest["out"][side] + 1.5}
    record(failures, not slipped,
           f"{label} the drift pushed no dot further off the Hero than rest does",
           {"resting": {k: round(v, 1) for k, v in rest["out"].items()},
            "drifting": {k: round(v, 1) for k, v in worst.items()},
            "slipped": slipped})
    dark = max(r["dark"] for r in rows)
    record(failures, dark <= rest["dark"],
           f"{label} the drift darkened no handle that rest leaves live",
           {"resting_dark": rest["dark"], "worst_while_drifting": dark,
            "samples": len(rows)})
    # Above the bar is the specific place a handle dies -- the Hero runs up
    # behind an opaque nav -- so it is stated on its own rather than folded into
    # the four-sided comparison, where a generous left edge could hide it.
    ceiling = rows[0]["ceiling"]
    highest = min(r["dotBox"]["t"] for r in rows)
    record(failures, highest >= -rest["out"]["t"] - 1.5,
           f"{label} no handle drifted off the top of the Hero",
           {"highest_dot": round(highest, 1), "bar_underside": round(ceiling, 1),
            "resting_top_overhang": round(rest["out"]["t"], 1)})

    # ── 4. AND IT LEANS THE WAY IT IS GOING ────────────────────────────────
    # Jayden: "the rotation doesnt seem to change so Id want that to change to
    # kinda go in the direction of where he is going so if hes going right a
    # tilt to the right and if hes going left a tilt to the left".
    # Four statements, and each one is a different way for this to be wrong:
    #   IT DOES NOT FOLLOW THE DIRECTION. A lean driven by a clock rather than
    #     by the heading looks identical in a still and is the obvious wrong
    #     implementation, so the correlation is against the head's own measured
    #     velocity rather than against time.
    #   IT IS NOT THERE, OR IT IS A CARTOON. A bank under the bob's own +-0.7deg
    #     cannot be told from the bob; one over a few degrees is a portrait
    #     rocking on a job application. Both ends are asserted.
    #   IT SNAPS AT THE WALL. The reversal is a 0.9s first-order lag and the
    #     lean follows it, so the angle has a SPEED LIMIT: a sign flip would put
    #     the whole swing into one frame, an eased turn spends about two seconds
    #     on it. Stated as degrees per second and NOT as degrees per sample,
    #     which is the trap this walked into first: sample_travel() asks for
    #     200ms and gets what the page can give it, and index.html is
    #     raster-bound -- the same slowness that broke settled_gaze. Measured
    #     per frame with a sampler that does no round trips, a true 200ms window
    #     carries 0.52-0.80deg at these three widths; the contract's own
    #     "200ms" samples land ~1500ms apart under load and carry 2.5-3.9deg,
    #     which failed a per-sample threshold while the head was easing
    #     perfectly. The limit is two full swings per turn constant -- 2-3x the
    #     measured peak at every width, and a snap of the swing inside even the
    #     fastest sample interval is 20deg/s or more, so it still bites.
    #   THE FRAME COMES OFF THE HEAD. The lean rides the float's angle channel
    #     precisely so the chrome follows with no second mechanism; if anything
    #     ever drives the head's angle without going through it, the frame is
    #     left behind and every handle with it. Asserted every sample, not once.
    rots = [r["rot"] for r in rows]
    vel = [(b["travel"]["x"] - a["travel"]["x"]) / max(1e-6, (b["t"] - a["t"]) / 1000)
           for a, b in zip(rows, rows[1:])]
    paired = list(zip(vel, rots[1:]))
    mv = sum(v for v, _ in paired) / len(paired)
    mr = sum(r for _, r in paired) / len(paired)
    cov = sum((v - mv) * (r - mr) for v, r in paired)
    sv = math.sqrt(sum((v - mv) ** 2 for v, _ in paired))
    sr = math.sqrt(sum((r - mr) ** 2 for _, r in paired))
    corr = cov / sv / sr if sv and sr else 0.0
    swing = max(rots) - min(rots)
    turn = rows[0]["turn"] or 0.9
    steps = [(abs(b["rot"] - a["rot"]), (b["t"] - a["t"]) / 1000)
             for a, b in zip(rows, rows[1:]) if b["t"] > a["t"]]
    peak = max(step / gap for step, gap in steps)
    interval = sum(gap for _, gap in steps) / len(steps)
    record(failures, corr >= 0.5,
           f"{label} the head leans the way it is travelling",
           {"corr": round(corr, 3), "samples": len(paired),
            "rot_range": [round(min(rots), 2), round(max(rots), 2)]})
    record(failures, 2.0 <= swing <= 8.0,
           f"{label} the lean is legible and still subtle",
           {"swing_deg": round(swing, 2), "bob_amp": rows[0]["bobAmp"]})
    record(failures, peak <= 2 * swing / turn,
           f"{label} the lean eases through the reversal rather than snapping",
           {"peak_deg_per_s": round(peak, 2), "limit": round(2 * swing / turn, 2),
            "swing_deg": round(swing, 2), "turn_s": turn,
            "mean_sample_ms": round(interval * 1000)})
    welded = max(abs(r["frameRot"] - (r["headRot"] + r["rot"])) for r in rows)
    record(failures, welded <= 0.01,
           f"{label} the frame carries the same angle as the head",
           {"worst_deg": round(welded, 4), "samples": len(rows)})
    return rows


def assert_still_under_reduce(page, label, failures, seconds=12):
    """Under reduce the head does not travel at all -- not slowly, not at all."""
    page.mouse.move(2, 2)
    first = page.evaluate(TRAVEL_SAMPLE)
    page.wait_for_timeout(int(seconds * 1000))
    last = page.evaluate(TRAVEL_SAMPLE)
    record(failures,
           first["travel"] == {"x": 0, "y": 0} and last["travel"] == {"x": 0, "y": 0},
           f"{label} reduced motion pins the travel",
           {"first": first["travel"], "last": last["travel"], "seconds": seconds})
    # AND THE LEAN GOES WITH IT. The bank is a fact about a journey that is not
    # happening, so under reduce the only thing left on the angle channel is the
    # bob, frozen at whatever phase it stopped in -- which is why this is
    # asserted against the bob's own authored amplitude rather than against
    # zero. Without it the head sits permanently a couple of degrees off the
    # pose hero-time.css authored, for the one visitor who asked for less.
    lean = max(abs(first["rot"]), abs(last["rot"]))
    record(failures, lean <= first["bobAmp"] + 0.05,
           f"{label} reduced motion drops the travel's lean",
           {"worst_deg": round(lean, 3), "bob_amp": first["bobAmp"]})


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
    # Two files declare a transform for the same element: controls.css owns the
    # position and hero-time.css composes the float and the entrance onto it. When
    # a class in one loses to a class in the other, the float is read perfectly and
    # dropped, and the selection frame drifts ~10px off a head that never moved.
    # An ID wins on specificity, so it wins no matter which file links first, and
    # that is the property worth asserting.
    #
    # THE LINK-ORDER ASSERTION THAT USED TO SIT HERE WAS FALSE FROM THE DAY IT WAS
    # WRITTEN. It required hero-time.css to link before controls.css; index.html
    # has always done the reverse -- controls at 1687, hero-time at 1689 -- and the
    # comment above it asserted the reverse of that again. So it failed on every
    # tree it was ever run against, including a pristine HEAD, and it taught
    # everyone that this contract is "expected" to be red. A gate that has never
    # once passed protects nothing and hides the assertions underneath it.
    #
    # Order is now recorded rather than demanded: if it flips, the ID still wins.
    assert ".heroHeadTransform{" in controls
    assert "#heroHeadTransform{" in time_css, (
        "hero-time.css must reach this element by ID. controls.css declares "
        ".heroHeadTransform{transform:...} for the same node, and a class-vs-class "
        "fight is decided by link order -- which no stylesheet should have to know.")
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
    # ── THE FRAME'S BOUNDS ARE THE ARTWORK'S, TO WITHIN A ROUNDING ────────────
    # Not tighter, or the head stands outside its own frame. Not looser by more
    # than the fourth decimal the attribute is written to, or the number has
    # stopped being a measurement and become a pad -- and a pad that reads right
    # at one size is wrong at the other end of a 9x scale range.
    authored = authored_head_bounds()
    measured = measured_head_bounds()
    slack = 1e-4
    for index, (name, direction) in enumerate(
        (("left", -1), ("top", -1), ("right", 1), ("bottom", 1))
    ):
        gap = (authored[index] - measured[index]) * direction
        assert 0 <= gap <= slack, (
            f"data-head-bounds {name}: authored {authored[index]!r} vs measured "
            f"{measured[index]!r} across {len(face_images())} faces"
        )
    assert 'data-head-bounds="0.1933 0.0616 0.8484 0.9234"' in html
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
    # THE SAME UNPASSABLE SHAPE AS THE LINK-ORDER ASSERTION ABOVE, and a second
    # copy of it lives in shared-surfaces-contract.py. It bans the tap-reaction
    # binding outright -- but the fix that was actually shipped GUARDS the binding,
    # and the guarded line contains this exact string:
    #     if(!faceImg.closest(".heroHeadTransform"))faceImg.addEventListener("click",...)
    # so the assertion went red the moment the bug was fixed correctly. What has to
    # be true is that the reaction never fires for the portrait the transform owns,
    # where a click is the drag and the selection, not that the code is absent.
    for m in re.finditer(r'faceImg\.addEventListener\("click"', engine):
        head = engine[max(0, m.start() - 60):m.start()]
        assert 'closest(".heroHeadTransform")' in head, (
            "unguarded tap reaction on the portrait at offset %d: inside "
            ".heroHeadTransform the click belongs to drag and select" % m.start())
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
            # pan-y, NOT none. `none` here promised the browser that a vertical
            # swipe starting on the head must never scroll the page -- over a
            # 196x228pt box that is on screen from load, exactly where a thumb
            # lands. That is the bug Jayden reported. What still has to be true
            # is that the head declares an intent at all, and that a vertical
            # swipe can reach the page.
            assert "pan-y" in selected["touchAction"], selected
            assert len(selected["handles"]) == 4
            assert all(
                h["width"] >= 44 and h["height"] >= 44 and h["tabIndex"] == 0
                for h in selected["handles"]
            ), selected
            assert_handle_hits(page, "default")
            # THE DRIFT IS OFF HERE, AND THIS BLOCK PROVES IT. Every context in
            # this loop is reduced_motion="reduce", which is also what makes the
            # settle detector below able to converge at all: it wants two reads
            # 100ms apart agreeing to half a pixel, and a head crossing the Hero
            # never gives it one. That is a property of the fixture, so it is
            # asserted rather than assumed -- if the travel ever started running
            # under reduce, the next forty assertions in this loop would start
            # failing for reasons that have nothing to do with what they test.
            assert_still_under_reduce(page, f"{label} reduce", failures, 8)
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

            # ── THE FRAME CONTAINS THE HEAD, AT EVERY SIZE AND EVERY ANGLE ────
            # Six samples, because this invariant fails differently in each
            # direction: too-tight bounds show up worst at maximum scale, where
            # the error is multiplied by 9x; a rotation composed in the wrong
            # order shows up worst at 45deg, where a turned box is furthest from
            # the rectangle it holds; and a frame that has been padded rather
            # than measured shows up at minimum scale, where a fixed pad is the
            # whole object.
            measured_bounds = measured_head_bounds()
            for turn_angle in (None, 45):
                page.evaluate("window.__heroHeadTransform.reset()")
                page.wait_for_timeout(40)
                pose = "rest" if turn_angle is None else "45deg"
                if turn_angle is not None:
                    turn_to(page, turn_angle)
                assert_frame_contains_artwork(
                    page, f"{label} {pose}", measured_bounds, failures)
                scale_to_limit(page, "Right")
                assert_frame_contains_artwork(
                    page, f"{label} {pose} max scale", measured_bounds, failures)
                scale_to_limit(page, "Left")
                assert_frame_contains_artwork(
                    page, f"{label} {pose} min scale", measured_bounds, failures)
            page.evaluate("window.__heroHeadTransform.reset()")
            page.evaluate("window.__heroHeadTransform.startFloat()")
            page.wait_for_timeout(40)

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

            tested_corners = []
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
                # At 320 the authored composition already puts nw 12px past the
                # window's left edge, so that corner has no dot to press. Skip
                # it rather than press empty space and blame the anchor maths.
                if corner not in live_corners(page):
                    continue
                tested_corners.append(corner)
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

            record(
                failures,
                len(tested_corners) >= 2,
                f"{label} corners reachable at rest",
                {"tested": tested_corners, "live": live_corners(page)},
            )

            for corner, axis, dx, dy in (
                ("se", "horizontal", -32, 0),
                ("nw", "vertical", 0, 32),
            ):
                page.evaluate("window.__heroHeadTransform.reset()")
                page.wait_for_timeout(30)
                # The claim is about a one-axis drag on a CORNER, not about that
                # corner: at 320 nw has no dot, so a live one stands in and the
                # drag's sign is taken from whichever side it is on, so it still
                # pulls inward.
                corner = a_live_corner(page, corner)
                if axis == "horizontal":
                    dx, dy = (-32 if corner.endswith("e") else 32), 0
                else:
                    dx, dy = 0, (32 if corner.startswith("n") else -32)
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
            # NOTE: se is off stage at 2.2 and keeps its focus anyway, which is
            # the point of drawing the dot away rather than removing the button.
            # If this loop ever stops short of the token minimum, that guarantee
            # has gone, not the arithmetic.
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

            shrink_corner = a_live_corner(page, "se")
            logical = logical_head_rect(page)
            anchor = opposite_point(logical, shrink_corner)
            drag = corner_point(logical, shrink_corner)
            press = drawn_dot(page, shrink_corner)
            # 10% of the way from the anchor toward whichever side this corner
            # is on, so the drag shrinks rather than flips whichever one it is.
            target_drag = {
                "x": anchor["x"]
                + logical["width"] * 0.1 * (1 if shrink_corner.endswith("e") else -1),
                "y": anchor["y"]
                + logical["height"] * 0.1 * (1 if shrink_corner.startswith("s") else -1),
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
            # THE ONLY CONTEXT IN THIS FILE WITH MOTION ON, so the drift is
            # asserted here. It runs BEFORE startMovie() because the movie moves
            # the head on its own schedule, and a test that cannot tell its own
            # subject from the thing driving it is not measuring anything.
            assert_travels(page, label, failures)
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(60)
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
            grip = grip_point(page)
            before_second = page.evaluate("""() => ({scrollY,
              tab:document.querySelector('.csTab[aria-selected="true"]').dataset.tab})""")
            # The frame's centre is under the corner time control once the head
            # has been dragged down there -- see grip_point().
            touch_drag(context, page, {"x": grip["x"], "y": grip["y"]},
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
            # ── A TAP SOMEWHERE ELSE DISMISSES THE FRAME ──────────────────
            # REVERSED, and the reversal is Jayden's: "i actually think i do
            # prefer that the resize box can disappear if you click off of it."
            # The frame was deliberately permanent before this, and the comment
            # that stood here argued for it; keeping that argument next to an
            # inverted assertion is how a settled decision gets restored as a
            # bug fix. WHAT MUST NOT CHANGE is that the tap still reaches what
            # it was aimed at -- chrome that eats a CTA is worse than either
            # behaviour -- so the time menu still opens on the same tap.
            page.touchscreen.tap(time_button["x"] + time_button["width"] / 2,
                                 time_button["y"] + time_button["height"] / 2)
            assert not page.evaluate("window.__heroHeadTransform.getState().selected"), label
            assert page.locator("#face").get_attribute("aria-pressed") == "false", label
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
            # ── THE FRAME IS NOT PAINTED ANY MORE, SO IT MUST NOT COME BACK ────
            # This demanded a Highlight outline on the rim and the five dots,
            # because a frame repainted as system colours is how a high-contrast
            # user sees a selection at all. The frame's PAINT has since been
            # deleted -- hero-time.css scopes the rim, the dots and their
            # backgrounds away by ID, and its forced-colors block deletes them
            # there too, with the reasoning written down at that rule: bringing
            # the wireframe back under forced colours would put it over the
            # photograph for exactly the users least able to read the two
            # together. That is a decision, not a regression, so the assertion
            # is inverted rather than dropped: it still fails if anyone repaints
            # the box, which is the thing that would now be wrong.
            # WHAT DOES NOT CHANGE is everything below -- the targets are still
            # 44px, still focusable, still in the same place as in normal
            # colours. The control survives; only its picture is gone.
            assert forced["frameOutline"] == "none" and forced["handleOutline"] == "none", (
                label, "the selection frame is painted under forced colours -- "
                "hero-time.css deletes it there on purpose", forced)
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
            # ── THE FLOAT LOOP READS NOTHING FROM THE DOM ─────────────────
            # This invariant was written down in a sixteen-line comment in
            # hero-head-transform.js and broken anyway: an uncached
            # rootNumber() came back inside place(), which runs once per handle
            # per frame, so five getComputedStyle() calls on the ROOT landed in
            # every frame -- audited at 219 root reads a second and ~300ms of
            # style recalculation per second on an idle page, which is what
            # "everything feels laggy just existing on the site" was. Measured:
            # 22.5-26.9fps with the read, 58.3fps without, same machine.
            # A COMMENT IS NOT AN INVARIANT, so it is asserted here. The module
            # counts every DOM read it makes and totals the ones that happen
            # inside a float frame; at rest that total must not move. Anyone who
            # puts a read back breaks this instead of the machine.
            # THE DRIFT RUNS INSIDE THIS FRAME, so this now covers it as well,
            # and it is the reason travelBounds() is arithmetic on state.base
            # rather than the getBoundingClientRect() it would be natural to
            # write: the bounds move with scale, rotation and the arrangement,
            # every one of which is already a number this module holds. The
            # gap, the share and the headline's lower edge are cached beside
            # --selection-air and invalidated by the same reclamp().
            page.wait_for_timeout(900)
            reads_before = page.evaluate("window.__heroHeadTransform.getState().loopReads")
            page.wait_for_timeout(1200)
            reads_after = page.evaluate("window.__heroHeadTransform.getState().loopReads")
            assert reads_after == reads_before, (
                label, "the float loop read the DOM", reads_before, reads_after)
            transformed = select_move_resize(page)
            page.wait_for_selector("#stage .iris")
            # Pinned to the HEAD, not the hero: the eyes only follow a cursor
            # within stage.width * 1.4 of themselves, and a point outside that
            # reads the idle wander instead of the gaze. One stage-width to
            # either side is comfortably inside that radius and far enough out
            # to peg the gaze at full deflection, which is what makes the two
            # readings separate by more than the rounding.
            # THE GAZE POINT IS CHOSEN RELATIVE TO THE HEAD, SO THE HEAD HAS TO
            # HOLD STILL WHILE IT IS USED. settled_gaze() retries for up to
            # eight windows with the pointer pinned, and __curNear is true only
            # within stage.width * 1.4 of the eyes -- so a head that travels
            # away during those retries walks out of its own test. The float is
            # stopped for the reading, which is what every other measurement in
            # this file already does: the subject here is the gaze, not the
            # drift, and the drift has its own assertions above.
            #
            # THIS IS NOT THE FIX FOR THE FAILURE BELOW, AND SAYING SO MATTERS.
            # On 2026-08-20 settled_gaze() started reporting "the eyes never
            # held still long enough to read" at 1440 with clean:false after
            # 7-13 samples. It is tempting to read that as the drift's doing.
            # It is not: bisected by routing the PRE-DRIFT hero-head-transform.js
            # into the same page, the same viewport and the same helper, it
            # fails identically -- 0 clean windows out of 4 on both sides, with
            # __curNear true, blinking false and two irises present the whole
            # time. So the window is being broken by something in the engine
            # swapping the irises out under it, on this tree, independent of
            # anything this file's drift does. Stopping the float here is still
            # right, and it is not what that failure is.
            page.evaluate("window.__heroHeadTransform.stopFloat()")
            stage = page.locator("#stage").bounding_box()
            gaze_cx = stage["x"] + stage["width"] / 2
            gaze_y = min(height - 4, max(4, stage["y"] + stage["height"] * .42))
            gaze_a = settled_gaze(page, max(4, gaze_cx - stage["width"]), gaze_y, label)
            gaze_b = settled_gaze(page, min(width - 4, gaze_cx + stage["width"]), gaze_y, label)
            assert gaze_b["x"] - gaze_a["x"] >= 1, (label, gaze_a, gaze_b)
            page.evaluate("window.__heroHeadTransform.startFloat()")
            blink = page.evaluate(BLINK_TO_NEUTRAL)
            assert blink["ok"], (label, blink)
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
            assert_lift_preserved(transformed, projection["state"], label)
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
            assert_lift_preserved(
                transformed, page.evaluate("window.__heroHeadTransform.getState()"), label)
            page.screenshot(path=str(TASK4_SHOTS / f"home-{width}-{height}-post-performance.png"))
            assert not errors, (label, errors)
            context.close()
        browser.close()


def document_width(page):
    return page.evaluate("document.documentElement.scrollWidth")


# ── THE GAZE IS SEVEN INTEGERS WIDE, SO "IT CHANGED" MEANT NOTHING ──────────
# This block used to read the iris transform, move the mouse, wait for the
# string to stop matching, and assert the two readings differed. Every clause
# of that was noise:
#
#   * updateIris() ROUNDS the iris offset to whole pixels, off an eye element
#     that is 18px wide at TRAVEL 0.16. The entire range the eyes can travel is
#     round(nx * 2.88) -- seven values, -3 to 3 -- so two genuinely different
#     gaze directions routinely land on the same integer. That is where the
#     reported "both were matrix(1, 0, 0, 1, -1, 0)" came from.
#   * It re-rolls a microsaccade and a hippus term EVERY FRAME. The transform
#     string therefore changes constantly without the gaze having moved, so the
#     wait returned on jitter and the reading taken one round-trip later had
#     already settled back.
#   * The right-hand sample point was outside the range the engine tracks at
#     all. updateIris() only follows the cursor while window.__curNear -- the
#     pointer inside stage.width * 1.4 of the head -- and 75% of the HERO's
#     width is beyond that on the wide viewports. Measured over six runs of
#     this exact block: __curNear was false at that point in four of them, so
#     the two "gaze" samples were two draws from the idle saccade wander. The
#     assertion passed all six times, and in two of them the pointer went RIGHT
#     while the iris went LEFT. It was not testing gaze tracking.
#
# So: the sample points come off the HEAD now, which is what keeps them inside
# the range the engine follows; the reading is the median of a window of frames
# instead of one instant; a window is thrown away if a blink or a fidget ran
# through it, because both drive the eyes for reasons that have nothing to do
# with the cursor; and the assertion is DIRECTION, which is the thing this test
# means and the thing seven quantised values can still carry.
# ── AND THE WINDOW IS COUNTED IN FRAMES, NOT IN MILLISECONDS ─────────────────
# `xs.length >= 20` inside a 700ms wall-clock window is an unwritten assertion
# that the page renders at 28.6fps, and index.html does not: measured at
# 1440x900 it holds about 16.5fps, raster-bound -- 11,073ms of RasterTask
# against 0.16s of script in a 4s window. So the window closed with 16 to 24
# samples and the reading was thrown away for a reason that has nothing to do
# with the eyes. In the captured failing windows there were ZERO guard
# rejections: two irises, blinking false, fidget null, __curNear true, and the
# iris m41 constant throughout. The test was failing on frame rate.
# A frame count is what this test actually means -- a run of consecutive frames
# with nothing but the cursor driving the eyes -- and on a slow page it should
# get LONGER rather than weaker, which is exactly what counting frames does.
# THE IDLE CHECK IS THE PRICE OF THAT, and it is not optional. updateIris()
# stops following the pointer IDLE_MS after the last pointer event and falls
# back to an idle wander silently, so a frame-counted window on a 10fps page
# can outlive the follow and return a wander as a gaze. `followed` reports it
# instead, and settled_gaze retries with a fresh pointer move.
# 32 RATHER THAN 20 because the assertion downstream is a direction with a
# `>= 1` floor, and at 320px -- where the eyes have about a pixel of horizontal
# travel to give -- one run in six came back with a margin of 0.6. More frames
# is more of the sub-pixel gaze coming back out from under Math.round().
GAZE_WINDOW_FRAMES = 32

GAZE_SAMPLER = """async frames => {
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const xs = [];
  let clean = true, followed = true;
  const started = performance.now();
  while (clean && xs.length < frames) {
    if (performance.now() - lastMove >= IDLE_MS) { followed = false; break; }
    const iris = document.querySelector('#stage .iris');
    if (!iris || blinking || fidget || !window.__curNear) clean = false;
    else xs.push(new DOMMatrixReadOnly(getComputedStyle(iris).transform).m41);
    await frame();
  }
  xs.sort((a, b) => a - b);
  // The MEAN is the reading. Every sample is an integer -- Math.round() in
  // updateIris() sees to that -- so a median is one of seven values and a
  // single sample landing a pixel either way can swing it; averaged over a
  // window the sub-pixel gaze underneath the rounding comes back out, which is
  // what makes this readable at 320px wide, where the eyes only have about a
  // pixel of horizontal travel to give.
  return {clean: clean && followed && xs.length >= frames, followed: followed,
          samples: xs.length, took: Math.round(performance.now() - started),
          x: xs.length ? xs.reduce((total, v) => total + v, 0) / xs.length : null,
          median: xs.length ? xs[xs.length >> 1] : null,
          spread: xs.length ? xs[xs.length - 1] - xs[0] : null};
}"""


def settled_gaze(page, x, y, label):
    """Where the eyes come to rest with the pointer held at (x, y).

    Retried rather than averaged. A blink or a fidget inside the window is not
    noise to be smoothed away -- it is something else driving the eyes -- and
    the honest answer is to read a window that does not contain one. Moving the
    pointer again on every attempt is load-bearing: the cursor stops being
    followed IDLE_MS after the last pointer event, and the fallback is silent,
    which is the exact failure this helper exists to stop.
    """
    reading = None
    for _ in range(8):
        page.mouse.move(x, y)
        reading = page.evaluate(GAZE_SAMPLER, GAZE_WINDOW_FRAMES)
        if reading["clean"]:
            return reading
    raise AssertionError((label, "the eyes never held still long enough to read", reading))


# ── requestBlink() HAS A PRECONDITION, AND THIS IS IT ────────────────────────
# The old sequence was `page.evaluate("requestBlink(...)")` followed by a
# wait_for_function polling #face's src for a _closed frame, and it timed out
# roughly one run in three. With a blink already in flight requestBlink
# RETARGETS that blink's reopen and returns -- hero-engine.js:191, "retarget
# mid-blink" -- it does not start a new one, so the closed frame the poller was
# waiting for may already have been and gone. Idle blinks fire every 2.1-5.3s
# and the head also blinks itself on hover and on face changes, so the call
# lands inside one often. On top of that the closed frame is a transient the
# engine is free to overwrite (browFlash and the brow fidgets write #face's src
# directly), and it was measured at 112-228ms -- a window a poller installed
# one CDP round-trip later has no business betting on.
#
# None of that has to be raced. buildBlink()'s first step is a close and
# applyStep() runs it SYNCHRONOUSLY inside requestBlink, so if the call is made
# from inside the page, with the precondition checked in the same task, the
# closed frame is readable on the very next line with no round-trip to lose it
# in.
BLINK_TO_NEUTRAL = """async () => {
  const face = document.querySelector('#face');
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const src = () => face.getAttribute('src') || '';
  const closed = /_closed\\.webp$/;
  const deadline = performance.now() + 8000;
  while (blinking && performance.now() < deadline) await frame();
  if (blinking) return {ok: false, why: 'a blink was still in flight after 8s', src: src()};
  requestBlink('neutral', false, false);
  const shut = src();
  if (!closed.test(shut)) return {ok: false, why: 'requestBlink did not close the eyes', shut};
  // Drain it before handing back. setFace() rebuilds the irises on the reopen,
  // so the caller marking them mid-blink marks elements the blink itself is
  // about to replace -- and the "these are fresh irises" assertion downstream
  // then passes for the wrong reason.
  while ((blinking || closed.test(src())) && performance.now() < deadline) await frame();
  return {ok: !blinking && !closed.test(src()), shut, reopened: src(), curFace};
}"""


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
      return {state:st,visible,rigid,ceiling,angle,
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


# ── PROVING THE WELD DETECTOR CAN FAIL ───────────────────────────────────────
# A contract nobody has watched fail is a contract nobody should trust, and the
# assertion this file gained is the one that would have caught a bug that
# shipped on the landing page. So --self-test puts the shipped chain back: the
# hit centre clamped into the selection box as well as into the Hero, and the
# painted square clamped back toward that centre by at most half the target --
# the pair that drew all four corner dots 4px off their corners at the resting
# composition, at both widths, and strung nw, ne and the rotator out along one
# shared y once the head was dragged upward.
#
# THE FIRST ATTEMPT AT THIS SELF-TEST PASSED, WHICH IS WHY IT IS WRITTEN THIS
# WAY. Re-injecting turn()'s crop alone proved nothing: at rest no corner is off
# stage, so that clamp is a no-op, and once a corner IS off stage the handle is
# hidden and correctly exempt. The clamp that has to be re-injected is the one
# that bites where the head actually lives. `point` is rewritten to the clamped
# centre at the end so the off-stage rule sees the zero offset it historically
# saw, and all five handles stay live exactly as they did on the shipped build.
#
# The run is expected to FAIL. If it passes, the detector is broken and every
# green run before it was noise.
SELF_TEST_SITE = """   var cx=axis(point.x,lead.x,m.heroW,hit);
   var cy=axis(point.y,lead.y-m.ceiling,m.heroH-m.ceiling,hit);
   node.style.setProperty("--h-x",cx+"px");
   node.style.setProperty("--h-y",cy+"px");
   node.style.setProperty("--h-dx",(point.x-cx)+"px");
   node.style.setProperty("--h-dy",(point.y-cy)+"px");
   node.__dot={x:point.x,y:point.y};"""
SELF_TEST_INJECT = """   var ex=parseFloat(selection.style.getPropertyValue("--selection-w"))||0;
   var ey=parseFloat(selection.style.getPropertyValue("--selection-h"))||0;
   var shipped=function(at,extent,lead,limit){
    var half=hit/2,lo=half-lead,hi=limit-lead-half;
    if(hi<lo)hi=lo=(lo+hi)/2;
    var want=extent<hit?extent/2:Math.max(half,Math.min(extent-half,at));
    return Math.max(lo,Math.min(hi,want));
   };
   var cx=shipped(point.x,ex,lead.x,m.heroW);
   var cy=shipped(point.y,ey,lead.y-m.ceiling,m.heroH-m.ceiling);
   var css=(hit-m.dot)/2;
   var sx=Math.max(-css,Math.min(css,point.x-cx));
   var sy=Math.max(-css,Math.min(css,point.y-cy));
   node.style.setProperty("--h-x",cx+"px");
   node.style.setProperty("--h-y",cy+"px");
   node.style.setProperty("--h-dx",sx+"px");
   node.style.setProperty("--h-dy",sy+"px");
   node.__dot={x:cx+sx,y:cy+sy};
   point={x:cx,y:cy};"""


# ── PROVING THE TRAVEL DETECTOR CAN FAIL ─────────────────────────────────────
# The drift's assertions are worth exactly as much as their ability to reject
# the build somebody would have written instead, and there is one obvious such
# build: bound the journey by the reachability rule alone. It is the rule the
# clamp already uses, it is one line shorter, and it is wrong -- reachability
# says 42% of the head must stay inside, which lets the leading corners sail off
# the stage, and a corner off the stage is a handle that is hidden and dead. The
# frame, not the head's box, is what has to stay on the Hero.
# It also drops the headline's lower edge, so the injected build walks the
# portrait up over the h1 as well. Both are the same mistake -- bounding the
# wrong rectangle -- and the run is expected to FAIL on the on-stage and
# handle-live assertions. If it passes, they are not detecting anything.
TRAVEL_SELF_TEST_SITE = """   return {
    minX:Math.min(0,Math.max(needX-box.width-box.left,bobX-(cx-fw/2))),
    maxX:Math.max(0,Math.min(m.heroW-needX-box.left,m.heroW-bobX-fw/2-cx)),
    minY:Math.min(0,Math.max(m.ceiling+needY-box.height-box.top,
     m.travelFloor+bobY-(cy-fh/2))),
    maxY:Math.max(0,Math.min(m.heroH-needY-box.top,m.heroH-bobY-fh/2-cy))};"""
TRAVEL_SELF_TEST_INJECT = """   return {
    minX:needX-box.width-box.left,
    maxX:m.heroW-needX-box.left,
    minY:m.ceiling+needY-box.height-box.top,
    maxY:m.heroH-needY-box.top};"""


# ── AND THE SECOND RE-INJECTION: A HEAD THAT TRAVELS WITHOUT LEANING ────────
# This is the exact build that shipped this morning, and Jayden's note about it
# is the reason the lean exists -- "the rotation doesnt seem to change". It is
# also the failure mode a lean can silently regress INTO: the bank rides the bob
# on one channel, so anything that stops writing it leaves a head that still
# moves, still floats and still passes every other assertion in this file.
BANK_SELF_TEST_SITE = "   t.rot+=(want-t.rot)*(1-Math.exp(-dt/(tau/3)));"
BANK_SELF_TEST_INJECT = "   t.rot=0;"


def bank_self_test(browser, base_url, source):
    """Take the lean out and require assert_travels() to notice."""
    if BANK_SELF_TEST_SITE not in source:
        raise SystemExit(
            "--self-test cannot find the bank in hero-head-transform.js; update "
            "BANK_SELF_TEST_SITE to match it rather than letting the self-test "
            "pass blind."
        )
    broken = source.replace(BANK_SELF_TEST_SITE, BANK_SELF_TEST_INJECT, 1)
    for width, height in ((1440, 900), (390, 844)):
        context = browser.new_context(viewport={"width": width, "height": height})
        context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
        context.route(
            "**/hero-head-transform.js*",
            lambda route: route.fulfill(
                status=200, content_type="application/javascript", body=broken
            ),
        )
        page = context.new_page()
        page.goto(f"{base_url}/index.html?head-transform=1", wait_until="load")
        page.wait_for_function(
            "typeof introMode !== 'undefined' && !introMode && !eventLock",
            timeout=15_000,
        )
        caught = []
        assert_travels(page, f"self-test bank {width}", caught)
        context.close()
        wanted = [f for f in caught
                  if "leans the way it is travelling" in f or "legible and still subtle" in f]
        if not wanted:
            raise SystemExit(
                f"--self-test FAILED at {width}x{height}: a head that travels "
                "without leaning was accepted. The lean assertions are not "
                f"detecting anything. Recorded: {caught!r}"
            )
        print(f"self-test {width}x{height}: the lean assertions rejected a head "
              f"that travels level, as they must ({len(wanted)} of them)")


def travel_self_test(browser, base_url, source):
    """Bound the drift by reachability alone and require assert_travels() to reject it."""
    if TRAVEL_SELF_TEST_SITE not in source:
        raise SystemExit(
            "--self-test cannot find travelBounds() in hero-head-transform.js; "
            "update TRAVEL_SELF_TEST_SITE to match it rather than letting the "
            "self-test pass blind."
        )
    broken = source.replace(TRAVEL_SELF_TEST_SITE, TRAVEL_SELF_TEST_INJECT, 1)
    for width, height in ((1440, 900), (390, 844)):
        context = browser.new_context(viewport={"width": width, "height": height})
        context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
        context.route(
            "**/hero-head-transform.js*",
            lambda route: route.fulfill(
                status=200, content_type="application/javascript", body=broken
            ),
        )
        page = context.new_page()
        page.goto(f"{base_url}/index.html?head-transform=1", wait_until="load")
        page.wait_for_function(
            "typeof introMode !== 'undefined' && !introMode && !eventLock",
            timeout=15_000,
        )
        caught = []
        assert_travels(page, f"self-test {width}", caught)
        context.close()
        wanted = [f for f in caught
                  if "further off the Hero" in f or "darkened no handle" in f
                  or "off the top" in f]
        if not wanted:
            raise SystemExit(
                f"--self-test FAILED at {width}x{height}: a drift bounded by "
                "reachability alone was accepted. The travel assertions are not "
                f"detecting anything. Recorded: {caught!r}"
            )
        print(f"self-test {width}x{height}: the travel assertions rejected the "
              f"reachability-only bound, as they must ({len(wanted)} of them)")


def self_test(base_url):
    """Re-inject the clamp and require assert_handle_hits() to reject it."""
    source = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
    if SELF_TEST_SITE not in source:
        raise SystemExit(
            "--self-test cannot find turn() in hero-head-transform.js; update "
            "SELF_TEST_SITE to match it rather than letting the self-test pass blind."
        )
    broken = source.replace(SELF_TEST_SITE, SELF_TEST_INJECT, 1)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            for width, height in ((1440, 900), (390, 844)):
                context = browser.new_context(viewport={"width": width, "height": height})
                context.route(
                    "**/hero-head-transform.js*",
                    lambda route: route.fulfill(
                        status=200, content_type="application/javascript", body=broken
                    ),
                )
                page = context.new_page()
                page.goto(f"{base_url}/index.html", wait_until="load")
                page.wait_for_timeout(2500)
                page.evaluate("window.__heroHeadTransform.stopFloat()")
                try:
                    assert_handle_hits(page, f"self-test {width}")
                except AssertionError:
                    print(f"self-test {width}x{height}: the weld assertion rejected "
                          f"the re-injected clamp, as it must")
                    context.close()
                    continue
                context.close()
                raise SystemExit(
                    f"--self-test FAILED at {width}x{height}: the re-injected corner "
                    "clamp was accepted. The rigidity assertion is not detecting "
                    "anything and every green run of this file is noise."
                )
            travel_self_test(browser, base_url, source)
            bank_self_test(browser, base_url, source)
        finally:
            browser.close()
    print("Hero head transform self-test: OK (the detectors fail when they should)")


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    TASK4_SHOTS.mkdir(parents=True, exist_ok=True)
    only_self_test = "--self-test" in sys.argv
    if not only_self_test:
        static_contract()
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))
    )
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        if only_self_test:
            self_test(f"http://127.0.0.1:{server.server_port}")
            return
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
    print(f"Frame contained the artwork: {CONTAINMENT_TALLY['hit']}"
          f"/{CONTAINMENT_TALLY['total']} samples")
    print(f"Handle welded to its own corner: worst offset "
          f"{RIGID_TALLY['worst']:.4f}px over {RIGID_TALLY['samples']} samples"
          f" (at {RIGID_TALLY['where']})")
    assert not HIT_TALLY["worst"], HIT_TALLY["worst"]
    assert rate == 100, rate
    assert RIGID_TALLY["samples"] > 0, "the rigidity assertion never ran"
    print("Hero head transform: OK")


if __name__ == "__main__":
    main()
