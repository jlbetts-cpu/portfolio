#!/usr/bin/env python3
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


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
        for width, height in ((1440, 900), (390, 844), (320, 800)):
            context = browser.new_context(
                viewport={"width": width, "height": height}, reduced_motion="reduce"
            )
            context.add_init_script(
                "try{sessionStorage.setItem('introSeen','1')}catch(e){}"
            )
            page = context.new_page()
            page.goto(base_url + "/index.html?head-transform=1", wait_until="load")
            page.wait_for_selector("#face")
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
            context.close()
        browser.close()


def main():
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
