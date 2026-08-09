#!/usr/bin/env python3
"""Computed-style contract for the connected Home work collection."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
VIEWPORTS = ((1440, 900), (390, 844), (320, 800))
MODES = ("light", "night")
ARTIFACTS = Path("/tmp/work-collection-contract")


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format, *_args):
        pass


def wait_for_thumbnail_variant(page, state):
    page.wait_for_function("""state => {
      const images=[...document.querySelectorAll('.csPanel.on .csFrame img')];
      return images.length >= 2 && images.every(image => {
        const src=image.getAttribute('src')||'',srcset=image.getAttribute('srcset')||'';
        return state === 'night'
          ? src.includes('/night-1200.webp') && srcset.includes('/night-1200.webp') && srcset.includes('/night-2400.webp')
          : !src.includes('/variants/time/') && srcset === '';
      });
    }""", arg=state)


def decode_visible_active_thumbnails(page):
    return page.evaluate("""async () => {
      const visibleImages=[...document.querySelectorAll('.csPanel.on .csFrame img')].filter(image => {
        const r=image.getBoundingClientRect(),s=getComputedStyle(image);
        return r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth &&
          s.display!=='none' && s.visibility!=='hidden';
      });
      const decodeWithTimeout=image=>new Promise((resolve,reject)=>{
        const src=image.currentSrc||image.getAttribute('src')||'(missing src)';
        const timer=setTimeout(()=>reject(new Error(`image decode timeout after 5000ms: ${src}`)),5000);
        image.decode().then(()=>{clearTimeout(timer);resolve();},error=>{clearTimeout(timer);reject(new Error(`image decode failed: ${src}: ${error}`));});
      });
      await Promise.all(visibleImages.map(image => decodeWithTimeout(image)));
      return visibleImages.map(image => ({
        src:image.currentSrc||image.getAttribute('src'),naturalWidth:image.naturalWidth
      }));
    }""")


def static_contract():
    tokens = (ROOT / "tokens.css").read_text(encoding="utf-8")
    return [
        f"missing semantic collection token: {token}"
        for token in ("--work-meta-gap", "--work-title-size", "--work-year-size")
        if token not in tokens
    ]


def browser_contract(base_url):
    failures = []
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        for width, height in VIEWPORTS:
            for mode in MODES:
                label = f"{width}x{height} {mode}"
                context = browser.new_context(
                    viewport={"width": width, "height": height}, reduced_motion="reduce"
                )
                context.add_init_script("try{sessionStorage.setItem('introSeen','1')}catch(e){}")
                page = context.new_page()
                page.goto(base_url + "/index.html?work-collection=1", wait_until="load")
                page.evaluate(
                    "mode => window.SiteTheme.setMode(mode === 'night' ? 'night' : 'off', {persist:false})",
                    mode,
                )
                page.wait_for_selector(".csPanel.on .csFrame img")
                wait_for_thumbnail_variant(page, mode)
                page.evaluate("""() => {
                  document.documentElement.style.scrollBehavior='auto';
                  const r=document.querySelector('#cases').getBoundingClientRect();
                  window.scrollTo(0,scrollY+r.top-72);
                }""")
                thumbnails = decode_visible_active_thumbnails(page)
                assert len(thumbnails) >= 2 and all(image["naturalWidth"] > 0 for image in thumbnails), (
                    label,
                    "visible active Home thumbnails",
                    thumbnails,
                )
                data = page.evaluate("""() => {
                  const one=s=>document.querySelector(s), css=n=>getComputedStyle(n), box=n=>n.getBoundingClientRect();
                  const collection=one('#cases'), frame=one('.csPanel.on .csFrame'), image=frame.querySelector('img');
                  const meta=one('.csPanel.on .csMeta'), title=meta.querySelector('.csName'), year=meta.querySelector('.csYear');
                  const stars=[...document.querySelectorAll('.heroNightStars i')];
                  const c=box(collection), f=box(frame), i=box(image), m=box(meta);
                  return {
                    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
                    collection:{left:c.left,right:c.right,width:c.width},
                    frame:{left:f.left,right:f.right,bottom:f.bottom,radius:css(frame).borderRadius,
                      shadow:css(frame).boxShadow,border:css(frame).borderTopWidth},
                    image:{left:i.left,right:i.right,radius:css(image).borderRadius,shadow:css(image).boxShadow},
                    meta:{top:m.top,gap:m.top-f.bottom},
                    title:{fontSize:css(title).fontSize},year:{fontSize:css(year).fontSize},
                    stars:stars.map(n=>({opacity:parseFloat(css(n).opacity),animation:css(n).animationName}))
                  };
                }""")
                expected_edge = 120 if width == 1440 else 16
                expected_radius = "20px" if width == 1440 else "14px"
                expected_gap = 16 if width == 1440 else 12
                expected_title = "18px" if width == 1440 else "15px"
                checks = (
                    (data["frame"]["radius"] == expected_radius,
                     f"square Home media: {label} wrapper radius {data['frame']['radius']} != {expected_radius}"),
                    (data["image"]["radius"] == expected_radius,
                     f"square Home media: {label} image radius {data['image']['radius']} != {expected_radius}"),
                    (data["frame"]["shadow"].count("inset") == 1 and data["image"]["shadow"] == "none" and data["frame"]["border"] == "0px",
                     f"Home media rim ownership: {label} wrapper={data['frame']['shadow']} image={data['image']['shadow']} border={data['frame']['border']}"),
                    (abs(data["meta"]["gap"] - expected_gap) <= .5,
                     f"oversized metadata gap: {label} {data['meta']['gap']}px != {expected_gap}px"),
                    (data["title"]["fontSize"] == expected_title,
                     f"oversized metadata title: {label} {data['title']['fontSize']} != shared lead {expected_title}"),
                    (data["year"]["fontSize"] == "15px",
                     f"oversized metadata year: {label} {data['year']['fontSize']} != 15px"),
                    (abs(data["collection"]["left"] - expected_edge) <= 1 and abs(data["collection"]["right"] - (width - expected_edge)) <= 1,
                     f"collection gutter alignment: {label} {data['collection']}"),
                    (abs(data["frame"]["left"] - expected_edge) <= 1 and abs(data["frame"]["right"] - (width - expected_edge)) <= 1,
                     f"Home media edge alignment: {label} {data['frame']}"),
                    (data["overflow"] <= 1, f"horizontal overflow: {label} {data['overflow']}px"),
                )
                failures.extend(message for passed, message in checks if not passed)
                if mode == "night":
                    if not all(star["animation"] == "none" for star in data["stars"]):
                        failures.append(f"reduced-motion Night stars animate: {label}")
                    brightest = max(star["opacity"] for star in data["stars"])
                    if brightest > .72:
                        failures.append(f"bright reduced-motion stars: {label} max opacity {brightest} > .72")
                page.screenshot(path=str(ARTIFACTS / f"home-work-{width}-{mode}.png"), full_page=False)
                context.close()
        browser.close()
    return failures


def main():
    failures = static_contract()
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
    Thread(target=server.serve_forever, daemon=True).start()
    try:
        failures.extend(browser_contract(f"http://127.0.0.1:{server.server_port}"))
    finally:
        server.shutdown()
        server.server_close()
    assert not failures, "\n" + "\n".join(failures)
    print(f"Work collection contract: OK ({ARTIFACTS})")


if __name__ == "__main__":
    main()
