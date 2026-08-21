#!/usr/bin/env python3
"""Browser regression for Hero popcorn containment and menu reachability."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SHOTS = Path("/tmp/hero-popcorn-browser")
VIEWPORTS = (
    ("desktop-1280", 1280, 900),
    ("mobile-390", 390, 844),
    ("mobile-320", 320, 800),
)


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def inspect_frame(page):
    return page.evaluate(
        """
        () => {
          const hero = document.getElementById("main");
          const clip = document.getElementById("heroMovieEffectsClip");
          const host = document.getElementById("heroMovieEffectsStage");
          const stage = document.getElementById("stage");
          const face = document.getElementById("face");
          const bucket = document.querySelector(".popbucket");
          const props = Array.from(document.querySelectorAll(".popbucket,.kernel,.popcrumb"));
          const rect = node => {
            const box = node.getBoundingClientRect();
            return {left: box.left, top: box.top, right: box.right, bottom: box.bottom,
              width: box.width, height: box.height};
          };
          const heroRect = rect(hero);
          const clipRect = clip && rect(clip);

          let bucketAboveFace = null;
          if (bucket && face && Number.parseFloat(getComputedStyle(bucket).opacity) > 0) {
            bucket.style.pointerEvents = "auto";
            face.style.pointerEvents = "auto";
            const bucketRect = rect(bucket);
            const faceRect = rect(face);
            const left = Math.max(bucketRect.left, faceRect.left);
            const right = Math.min(bucketRect.right, faceRect.right);
            const top = Math.max(bucketRect.top, faceRect.top);
            const bottom = Math.min(bucketRect.bottom, faceRect.bottom);
            if (right > left && bottom > top) {
              const clipZ = Number.parseInt(getComputedStyle(clip).zIndex, 10) || 0;
              const peekZ = Number.parseInt(getComputedStyle(document.querySelector('.heroCharacterPeek')).zIndex, 10) || 0;
              bucketAboveFace = clipZ > peekZ;
            }
          }

          for (const prop of props) prop.style.pointerEvents = "auto";
          const leaking = [];
          for (const prop of props) {
            if (Number.parseFloat(getComputedStyle(prop).opacity) <= 0) continue;
            const box = rect(prop);
            const probes = [];
            if (box.bottom > heroRect.bottom + 0.5) {
              probes.push([(Math.max(box.left, heroRect.left) + Math.min(box.right, heroRect.right)) / 2,
                Math.min(box.bottom - 1, heroRect.bottom + 2)]);
            }
            if (box.top < heroRect.top - 0.5) {
              probes.push([(Math.max(box.left, heroRect.left) + Math.min(box.right, heroRect.right)) / 2,
                Math.max(box.top + 1, heroRect.top - 2)]);
            }
            if (box.right > heroRect.right + 0.5) {
              probes.push([Math.min(box.right - 1, heroRect.right + 2),
                (Math.max(box.top, heroRect.top) + Math.min(box.bottom, heroRect.bottom)) / 2]);
            }
            if (box.left < heroRect.left - 0.5) {
              probes.push([Math.max(box.left + 1, heroRect.left - 2),
                (Math.max(box.top, heroRect.top) + Math.min(box.bottom, heroRect.bottom)) / 2]);
            }
            if (probes.some(([x, y]) => document.elementsFromPoint(x, y).includes(prop))) {
              leaking.push(prop.className);
            }
          }

          const near = (a, b) => Math.abs(a - b) <= 0.5;
          // ── WHERE THE BUCKET ACTUALLY IS, NOT JUST WHETHER IT LEAKS ──────
          // Everything above this line asks whether a prop paints OUTSIDE the
          // Hero, and the answer stayed "no" for the entire time the bucket was
          // being destroyed: the crop was working perfectly and it was cropping
          // away the whole prop. On 2026-08-21, with the movie running and the
          // head in its default arrangement, 15% of the bucket was on screen at
          // 1440 and its top edge sat 22.4px BELOW the Hero's floor once the
          // head had been dragged. Not one assertion in this file could see it.
          // So the containment question is asked from both sides now.
          const bucketBox = bucket &&
            Number.parseFloat(getComputedStyle(bucket).opacity) > 0.5 ? rect(bucket) : null;
          const bucketBelowHero = bucketBox ? bucketBox.bottom - heroRect.bottom : null;
          const bucketVisible = bucketBox
            ? (Math.min(bucketBox.bottom, heroRect.bottom) -
               Math.max(bucketBox.top, heroRect.top)) / bucketBox.height
            : null;
          return {
            bucketBelowHero, bucketVisible,
            heroOverflow: getComputedStyle(hero).overflow,
            peekOverflow: getComputedStyle(document.querySelector('.heroCharacterPeek')).overflow,
            clipOverflow: clip && getComputedStyle(clip).overflow,
            clipPointerEvents: clip && getComputedStyle(clip).pointerEvents,
            clipParent: clip && `${clip.parentElement.tagName}.${clip.parentElement.className}`,
            peekParent: `${document.querySelector('.heroCharacterPeek').parentElement.tagName}.${document.querySelector('.heroCharacterPeek').parentElement.className}`,
            clipZ: clip && getComputedStyle(clip).zIndex,
            peekZ: getComputedStyle(document.querySelector('.heroCharacterPeek')).zIndex,
            allFourEdgesMatch: Boolean(clipRect) &&
              near(heroRect.top, clipRect.top) && near(heroRect.right, clipRect.right) &&
              near(heroRect.bottom, clipRect.bottom) && near(heroRect.left, clipRect.left),
            parents: props.map(prop => prop.parentElement && prop.parentElement.id),
            counts: {
              bucket: document.querySelectorAll(".popbucket").length,
              kernels: document.querySelectorAll(".kernel").length,
              crumbs: document.querySelectorAll(".popcrumb").length,
            },
            leaking,
            stageTransform: getComputedStyle(stage).transform,
            hostTransform: host && getComputedStyle(host).transform,
            stageRect: rect(stage),
            hostRect: host && rect(host),
            bucketAboveFace,
            heroScrollTop: hero.scrollTop,
            horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        }
        """
    )


def run_viewport(browser, base_url, label, width, height):
    print(f"checking {label}")
    context = browser.new_context(viewport={"width": width, "height": height})
    context.add_init_script(
        """
        try{sessionStorage.setItem('introSeen','1')}catch(e){}
        const nativeMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = query => {
          const result = nativeMatchMedia(query);
          if (query === '(hover:hover) and (pointer:fine)') {
            Object.defineProperty(result, 'matches', {value: true});
          }
          return result;
        };
        """
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(base_url + "/index.html", wait_until="load")
    page.wait_for_timeout(900)
    page.wait_for_function(
        "typeof introMode !== 'undefined' && !introMode && !eventLock",
        timeout=15_000,
    )

    page.locator('.csTab[data-tab="goodness"]').click()
    reel = page.locator("#reelFrame")
    reel.focus()
    page.wait_for_selector(".popbucket", state="attached", timeout=5_000)
    page.wait_for_timeout(375)

    samples = []
    for _ in range(16):
        samples.append(inspect_frame(page))
        page.wait_for_timeout(125)

    first = samples[0]
    # The Hero deliberately stopped clipping: its gradient has to continue past
    # its own lower edge to fade into the work section. The crop that keeps the
    # portrait and its props inside the Hero moved to .heroCharacterPeek, which
    # is the element that actually owns them -- so the guarantee is the same
    # one, just enforced by the right box.
    assert first["heroOverflow"] == "visible", first
    assert first["peekOverflow"] in ("hidden", "clip"), first
    assert first["clipOverflow"] == "clip", first
    assert first["clipPointerEvents"] == "none", first
    assert first["allFourEdgesMatch"], first
    assert first["counts"] == {"bucket": 1, "kernels": 7, "crumbs": 12}, first
    assert set(first["parents"]) == {"heroMovieEffectsStage"}, first
    assert all(not sample["leaking"] for sample in samples), samples
    # ── THE LAYER IS NOT A COPY OF THE STAGE'S TRANSFORM ANY MORE ───────────
    # This compared the two matrices as strings and it has been red at HEAD, on
    # a tree with no popcorn work in it, since the layer stopped copying the
    # pose: syncMovieEffectsLayer() measures the stage's real basis from three
    # probes now -- the resting angle, the visitor's arrangement, the idle
    # float, .stagewrap's glide AND the movie's pose, all of it -- and writes
    # that. So the stage reads matrix(1,0,0,1,0,0.8) while the host correctly
    # reads matrix(0.99948,0.0323,-0.0323,0.99948,0,0), and the equality can
    # only pass on a build where the layer has gone back to being wrong. The
    # engine's own essay says so in as many words: "the layer no longer COPIES
    # the stage's pose ... writing it here as well would apply it twice."
    # WHAT IT MEANT IS STILL WORTH ASSERTING, so it is asserted directly: the
    # props' coordinate space and the stage must land on the same rectangle.
    # That is a claim about where things are drawn rather than about how the
    # matrix was spelled, and it is the same weld tools/hero-head-transform
    # -contract.py holds the layer to.
    for sample in samples:
        assert all(abs(sample["stageRect"][edge] - sample["hostRect"][edge]) <= 2
                   for edge in ("left", "top", "right", "bottom")), (label, sample)
    assert any(sample["bucketAboveFace"] is True for sample in samples), samples
    assert all(sample["heroScrollTop"] == 0 for sample in samples), samples
    assert all(not sample["horizontalOverflow"] for sample in samples), samples
    # ── THE BUCKET IS IN THE FRAME, AND THAT IS WHAT "IT WORKS" MEANS ────────
    # Jayden, 2026-08-21: "the popcorn bucket animation should work on the
    # movie please fix". A bucket that is cropped to a smear of popcorn at the
    # fold is not a bucket being held below the frame line, it is the prop
    # missing -- and the kernels fly OUT of it, so a cropped bucket takes the
    # rest of the performance's legibility with it.
    # THE SAMPLES ARE SPLIT BECAUSE THE ENTRANCE IS MOTION, NOT A STATE. The
    # composition's fit springs in over --sp-settle-dur while the bucket is
    # still fading up, so for the first few frames the prop is genuinely rising
    # into the frame and asserting containment there would be asserting that the
    # entrance does not happen. Everything after it is the performance, and the
    # performance has to hold: every chew, bob, squash and shake, at every
    # viewport, with the head where the visitor found it.
    settled = [sample for sample in samples[5:] if sample["bucketBelowHero"] is not None]
    assert len(settled) >= 8, (label, len(settled), samples)
    worst = max(sample["bucketBelowHero"] for sample in settled)
    assert worst <= 0, (
        f"{label}: the popcorn bucket hangs {worst:.1f}px below the Hero's floor "
        "and is cropped away there", settled)
    least = min(sample["bucketVisible"] for sample in settled)
    assert least >= 0.999, (
        f"{label}: only {least:.0%} of the popcorn bucket is inside the Hero", settled)

    page.screenshot(path=str(SHOTS / f"{label}-contained.png"), full_page=False)
    assert not errors, errors
    context.close()


def run_reduced_motion(browser, base_url):
    context = browser.new_context(
        viewport={"width": 1280, "height": 900},
        reduced_motion="reduce",
    )
    context.add_init_script(
        """
        try{sessionStorage.setItem('introSeen','1')}catch(e){}
        const nativeMatchMedia = window.matchMedia.bind(window);
        window.matchMedia = query => {
          const result = nativeMatchMedia(query);
          if (query === '(hover:hover) and (pointer:fine)') {
            Object.defineProperty(result, 'matches', {value: true});
          }
          return result;
        };
        """
    )
    page = context.new_page()
    page.goto(base_url + "/index.html", wait_until="load")
    page.wait_for_function("typeof introMode !== 'undefined' && !introMode", timeout=15_000)
    face = page.locator("#face")
    box = face.bounding_box()
    page.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] * .3)
    page.keyboard.press("ArrowRight")
    handle = page.locator('.heroHeadHandle[data-corner="se"]')
    handle.focus()
    page.keyboard.press("ArrowRight")
    state = page.evaluate("window.__heroHeadTransform.getState()")
    assert state["selected"] and state["x"] and state["scale"] != 1, state
    page.locator('.csTab[data-tab="goodness"]').click()
    page.locator("#reelFrame").focus()
    page.wait_for_timeout(250)
    assert page.locator("#heroMovieEffectsStage > *").count() == 0
    context.close()


def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    handler = partial(QuietHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    Thread(target=server.serve_forever, daemon=True).start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            for viewport in VIEWPORTS:
                run_viewport(browser, base_url, *viewport)
            run_reduced_motion(browser, base_url)
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    print(f"Hero popcorn containment: OK; screenshots: {SHOTS}")


if __name__ == "__main__":
    main()
