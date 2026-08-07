#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/hero-head-task3")


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def assert_handle_hits(page, label):
    page.wait_for_timeout(30)
    handles = page.evaluate(
        """label => {
          const selection = document.querySelector('#heroHeadSelection');
          const selectedRect = selection.getBoundingClientRect();
          const heroRect = document.querySelector('#main').getBoundingClientRect();
          return [...document.querySelectorAll('.heroHeadHandle')].map(handle => {
            const corner = handle.dataset.corner;
            const rect = handle.getBoundingClientRect();
            const before = getComputedStyle(handle, '::before');
            const towardX = corner.endsWith('w') ? 1 : -1;
            const towardY = corner.startsWith('n') ? 1 : -1;
            const visualX = rect.left + parseFloat(before.left);
            const visualY = rect.top + parseFloat(before.top);
            const expectedX = corner.endsWith('w') ? selectedRect.left : selectedRect.right;
            const expectedY = corner.startsWith('n') ? selectedRect.top : selectedRect.bottom;
            const outerX = corner.endsWith('w') ? rect.left : rect.right;
            const outerY = corner.startsWith('n') ? rect.top : rect.bottom;
            const points = [[2,2],[12,2],[2,12]].map(([dx,dy]) => [
              outerX + towardX * dx, outerY + towardY * dy
            ]);
            const hits = points.map(([x,y]) => {
              const node = document.elementFromPoint(x,y);
              return node === handle || handle.contains(node);
            });
            const intersectionWidth = Math.max(0,
              Math.min(rect.right, selectedRect.right) - Math.max(rect.left, selectedRect.left));
            const intersectionHeight = Math.max(0,
              Math.min(rect.bottom, selectedRect.bottom) - Math.max(rect.top, selectedRect.top));
            const heroIntersectionWidth = Math.max(0,
              Math.min(rect.right, heroRect.right) - Math.max(rect.left, heroRect.left));
            const heroIntersectionHeight = Math.max(0,
              Math.min(rect.bottom, heroRect.bottom) - Math.max(rect.top, heroRect.top));
            return {
              label, corner, hits,
              selectedIntersection: intersectionWidth * intersectionHeight,
              heroIntersection: heroIntersectionWidth * heroIntersectionHeight,
              area: rect.width * rect.height,
              visualCornerDelta: Math.hypot(visualX - expectedX, visualY - expectedY),
              rect: {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},
              selectedRect: {
                left:selectedRect.left,top:selectedRect.top,
                right:selectedRect.right,bottom:selectedRect.bottom
              }
            };
          });
        }""",
        label,
    )
    assert all(
        handle["selectedIntersection"] >= handle["area"] - 1
        and handle["heroIntersection"] >= handle["area"] - 1
        and handle["visualCornerDelta"] <= 0.5
        and all(handle["hits"])
        for handle in handles
    ), handles


def drag_selection_to(page, x, y):
    box = page.locator("#heroHeadSelection").bounding_box()
    page.mouse.move(box["x"] + box["width"] * 0.5, box["y"] + box["height"] * 0.5)
    page.mouse.down()
    page.mouse.move(x, y, steps=5)
    page.mouse.up()


def logical_head_rect(page):
    return page.evaluate(
        """() => {
          const face=document.querySelector('#face'),r=face.getBoundingClientRect();
          const b=face.dataset.headBounds.split(/\s+/).map(Number);
          return {x:r.left+r.width*b[0],y:r.top+r.height*b[1],
            width:r.width*(b[2]-b[0]),height:r.height*(b[3]-b[1])};
        }"""
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


def static_contract():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "controls.css").read_text(encoding="utf-8")
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    engine = (ROOT / "hero-engine.js").read_text(encoding="utf-8")
    transform = (ROOT / "hero-head-transform.js").read_text(encoding="utf-8")
    assert 'id="heroHeadTransform"' in html
    assert 'id="heroHeadSelection"' in html
    assert 'data-head-bounds="0.22 0.12 0.80 0.91"' in html
    assert html.count('class="heroHeadHandle"') == 4
    assert '<script src="hero-head-transform.js"></script>' in html
    assert html.index('src="hero-engine.js"') < html.index('src="hero-head-transform.js"')
    for token in (
        "--selection-ink",
        "--selection-line",
        "--selection-handle-size",
        "--selection-hit-size",
        "--hero-head-safe-gap",
    ):
        assert token in tokens, token
    for selector in (".heroHeadTransform{", ".heroHeadSelection{", ".heroHeadHandle{"):
        assert selector in css, selector
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
    assert "c.bottom+16" not in transform


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
            face.click(
                position={
                    "x": face.bounding_box()["width"] * 0.5,
                    "y": face.bounding_box()["height"] * 0.3,
                }
            )
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
            resting_logical = logical_head_rect(page)
            page.screenshot(path=str(SHOTS / f"home-{label}-selected.png"))

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
            assert moved["y"] >= protected["y"] + protected["height"] + 15
            assert moved["x"] >= hero["x"]
            assert moved["x"] + moved["width"] <= hero["x"] + hero["width"]
            assert moved["y"] + moved["height"] <= hero["y"] + hero["height"] + 0.5

            se = page.locator('.heroHeadHandle[data-corner="se"]')
            before = logical_head_rect(page)
            anchor = (before["x"], before["y"])
            handle = se.bounding_box()
            page.mouse.move(
                handle["x"] + handle["width"] / 2,
                handle["y"] + handle["height"] / 2,
            )
            page.mouse.down()
            page.mouse.move(
                handle["x"] + handle["width"] / 2 + 36,
                handle["y"] + handle["height"] / 2 + 36,
                steps=4,
            )
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
                handle_locator = page.locator(
                    f'.heroHeadHandle[data-corner="{corner}"]'
                )
                handle_corner = handle_locator.bounding_box()
                press_corner = {
                    "x": handle_corner["x"] + handle_corner["width"] / 2,
                    "y": handle_corner["y"] + handle_corner["height"] / 2,
                }
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

            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)

            drag_selection_to(page, width + 1000, height + 1000)
            assert_handle_hits(page, "safe-lower-right")
            drag_selection_to(page, -1000, -1000)
            assert_handle_hits(page, "safe-upper-left")
            page.locator("#main").evaluate(
                "node=>node.style.setProperty('--hero-head-safe-gap','48px')"
            )
            page.evaluate("window.__heroHeadTransform.reclamp()")
            page.wait_for_timeout(30)
            gap_result = page.evaluate(
                """() => {
                  const hero=document.querySelector('#main');
                  const copy=hero.querySelector('.heroCopy');
                  const face=document.querySelector('#face');
                  const bounds=face.dataset.headBounds.split(/\s+/).map(Number);
                  const h=hero.getBoundingClientRect(),c=copy.getBoundingClientRect();
                  const f=face.getBoundingClientRect();
                  const gap=parseFloat(getComputedStyle(hero).getPropertyValue('--hero-head-safe-gap'));
                  return {
                    gap,
                    objectTop:Math.max(f.top+f.height*bounds[1],h.top),
                    expectedTop:Math.min(h.bottom,c.bottom+gap)
                  };
                }"""
            )
            assert gap_result["gap"] == 48 and abs(
                gap_result["objectTop"] - gap_result["expectedTop"]
            ) <= 1, gap_result
            page.locator("#main").evaluate(
                "node=>node.style.removeProperty('--hero-head-safe-gap')"
            )
            page.evaluate("window.__heroHeadTransform.reset()")
            page.wait_for_timeout(30)

            for point_name, inset in (("center", 22), ("far-inboard", 4)):
                page.evaluate("window.__heroHeadTransform.reset()")
                page.wait_for_timeout(30)
                se = page.locator('.heroHeadHandle[data-corner="se"]')
                handle = se.bounding_box()
                resize_start = page.evaluate("window.__heroHeadTransform.getState()")
                anchor_start = opposite_point(logical_head_rect(page), "se")
                press_x = handle["x"] + inset
                press_y = handle["y"] + inset
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
                next_handle = se.bounding_box()
                page.mouse.move(
                    next_handle["x"] + next_handle["width"] / 2,
                    next_handle["y"] + next_handle["height"] / 2,
                )
                page.mouse.down()
                page.mouse.move(
                    next_handle["x"] + next_handle["width"] / 2 + 12,
                    next_handle["y"] + next_handle["height"] / 2 + 12,
                )
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

            box = face.bounding_box()
            owner_x = box["x"] + box["width"] * 0.5
            owner_y = box["y"] + box["height"] * 0.3
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
            moved_box = face.bounding_box()
            page.mouse.move(
                moved_box["x"] + moved_box["width"] * 0.5,
                moved_box["y"] + moved_box["height"] * 0.3,
            )
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
                  const selectionBefore=selection.style.getPropertyValue('--selection-x');
                  let atEvent=null;
                  const observe=event=>{atEvent={
                    detail:event.detail,
                    cssX:getComputedStyle(document.querySelector('#heroHeadTransform'))
                      .getPropertyValue('--hero-head-x').trim(),
                    selectionX:selection.style.getPropertyValue('--selection-x')
                  };};
                  addEventListener('heroheadtransform',observe,{once:true});
                  for(let i=0;i<3;i++)face.dispatchEvent(new KeyboardEvent('keydown',{
                    key:'ArrowRight',bubbles:true
                  }));
                  const immediate=count;
                  requestAnimationFrame(()=>{
                    removeEventListener('heroheadtransform',onTransform);
                    resolve({immediate,count,before,after:window.__heroHeadTransform.getState(),
                      selectionBefore,selectionAfter:selection.style.getPropertyValue('--selection-x'),atEvent});
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
            box = face.bounding_box()
            page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.3)
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
                {"x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] * 0.3},
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
            for _ in range(30):
                page.keyboard.press("ArrowRight")
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
            for _ in range(40):
                page.keyboard.press("ArrowLeft")
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
            se_box = se.bounding_box()
            logical = logical_head_rect(page)
            anchor = opposite_point(logical, "se")
            drag = corner_point(logical, "se")
            press = {
                "x": se_box["x"] + se_box["width"] / 2,
                "y": se_box["y"] + se_box["height"] / 2,
            }
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

            se_box = se.bounding_box()
            logical = logical_head_rect(page)
            anchor = opposite_point(logical, "se")
            drag = corner_point(logical, "se")
            press = {
                "x": se_box["x"] + se_box["width"] / 2,
                "y": se_box["y"] + se_box["height"] / 2,
            }
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
                reset_result == {"selected": True, "x": 0, "y": 0, "scale": 1}
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
            se = page.locator('.heroHeadHandle[data-corner="se"]')
            handle = se.bounding_box()
            page.mouse.move(
                handle["x"] + handle["width"] / 2,
                handle["y"] + handle["height"] / 2,
            )
            page.mouse.down()
            page.mouse.move(
                handle["x"] + handle["width"] / 2 + 24,
                handle["y"] + handle["height"] / 2 + 24,
                steps=4,
            )
            page.mouse.up()
            page.wait_for_timeout(50)
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
            aligned = (
                projection["movieMode"]
                and projection["scale"] > 1
                and projection["visibleProps"] > 0
                and projection["clipOverflow"] == "clip"
                and all(
                abs(projection["stage"][edge] - projection["effects"][edge]) <= 1
                for edge in ("left", "top", "right", "bottom")
                )
            )
            record(failures, aligned, f"{label} movie projection", projection)
            page.screenshot(path=str(SHOTS / f"home-{label}-movie.png"))
            context.close()
        browser.close()
        assert not failures, "\n" + "\n".join(failures)


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    static_contract()
    server = ThreadingHTTPServer(
        ("127.0.0.1", 0), partial(Quiet, directory=str(ROOT))
    )
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        browser_contract(f"http://127.0.0.1:{server.server_port}")
    finally:
        server.shutdown()
        server.server_close()
    print("Hero head transform: OK")


if __name__ == "__main__":
    main()
