"""Catch a frozen player, for the case study's "players" section.

It has to come from BEFORE the fix: freezes are 0.12 per match now, so the
current build would take an hour to show one. 912a643 is the fix, so its parent
is the last commit where a head could reach `st="fall"` with `air=false` — a
state nothing in the engine can leave.

Detection: sample every head's centre at ~12Hz; a head that moves under 3px for
1.2s while the match phase is "play" is frozen. Capture the strip around it and
mark the frozen one so the picture reads without a caption.
"""
import io, sys
sys.path.insert(0, "/private/tmp/claude-501/-Users-jaydenbetts-Downloads-portfolioo-v392/45be4ee6-6066-4ba0-a7f9-f2a3b71bea03/scratchpad")
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4794
BASE = "http://127.0.0.1:%d" % PORT
OUT = "/Users/jaydenbetts/Downloads/portfolioo_v392/docs/case-study-league/assets"
W, H = 1512, 850

TRACK = """() => {
  const S = window.__hmSoccer;
  if (!S || !S.on) return null;
  const heads = [...document.querySelectorAll('.hero > div')].filter(d => {
    const bi = getComputedStyle(d).backgroundImage || '';
    if (bi.indexOf('data:') < 0) return false;
    const r = d.getBoundingClientRect();
    return r.width > 20 && r.height > 20 && r.top > 60 && r.bottom < innerHeight - 20;
  });
  return { phase: S.phase, heads: heads.map(h => {
    const r = h.getBoundingClientRect();
    return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2),
            Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  })};
}"""


def drive(p):
    p.goto(BASE + "/play.html", wait_until="load"); p.wait_for_timeout(2400)
    p.keyboard.press("Escape"); p.wait_for_timeout(300)
    p.get_by_text("Yowmings League").first.click(); p.wait_for_timeout(2800)
    for lab in ("Simulate", "Start the race"):
        b = p.get_by_role("button", name=lab)
        if b.count():
            b.first.click(); break
    waited = 0
    while waited < 170000:
        p.wait_for_timeout(1200); waited += 1200
        if "hmSoccer" in p.evaluate("()=>document.body.className"):
            p.wait_for_timeout(2500); return True
        for lab in ("Kick off", "Go", "Continue", "Next", "Start the race"):
            b = p.get_by_role("button", name=lab)
            try:
                if b.count() and b.first.is_visible():
                    b.first.click(); break
            except Exception:
                pass
    return False


with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(viewport={"width": W, "height": H}, device_scale_factor=2)
    p = ctx.new_page()
    if not drive(p):
        print("  never reached a match"); sys.exit(0)
    p.evaluate("()=>{const S=window.__hmSoccer; if(S){S.target=5;S.cap=7;}}")

    hist, frozen = {}, None
    for _ in range(1400):
        p.wait_for_timeout(80)
        d = p.evaluate(TRACK)
        if not d or d["phase"] != "play":
            continue
        for i, h in enumerate(d["heads"]):
            key = i
            prev = hist.get(key)
            if prev and abs(prev[0] - h[0]) < 3 and abs(prev[1] - h[1]) < 3:
                hist[key] = (h[0], h[1], prev[2] + 1, h)
            else:
                hist[key] = (h[0], h[1], 0, h)
            # 15 samples at 80ms = 1.2s motionless
            if hist[key][2] >= 15:
                frozen = h
                break
        if frozen:
            break

    if not frozen:
        print("  no freeze observed"); ctx.close(); br.close(); sys.exit(0)

    x, y, bw, bh = frozen[2], frozen[3], frozen[4], frozen[5]
    print("  frozen head at %d,%d (%dx%d) — capturing" % (x, y, bw, bh))
    cx, cy = x + bw / 2, y + bh / 2
    cw, ch = 620, 420
    clip = {"x": max(0, min(W - cw, cx - cw / 2)), "y": max(0, min(H - ch, cy - ch / 2)),
            "width": cw, "height": ch}
    frames = []
    for _ in range(5):
        frames.append(p.screenshot(clip=clip))
        p.wait_for_timeout(360)

    ims = [Image.open(io.BytesIO(f)).convert("RGB") for f in frames]
    # NO PROGRAMMATIC RING. The first version drew one from the head's
    # getBoundingClientRect and it landed a full head-height low: these heads
    # carry transforms, so the rect I sample is not where the head paints. The
    # strip does the work on its own -- the frozen head holds the identical
    # position in every frame while everything around it moves -- and a caption
    # can point at it without me shipping a misplaced circle.
    w, h = ims[0].size; gap = 8
    sheet = Image.new("RGB", (w * len(ims) + gap * (len(ims) - 1), h), (255, 255, 255))
    for i, im in enumerate(ims):
        sheet.paste(im, (i * (w + gap), 0))
    if sheet.width > 3800:
        r = 3800 / sheet.width
        sheet = sheet.resize((int(sheet.width * r), int(sheet.height * r)), Image.LANCZOS)
    sheet.save(OUT + "/players-01-frozen.png", "PNG")
    print("  wrote players-01-frozen.png  %d frames  %dx%d  (ringed: it does not move)"
          % (len(ims), sheet.width, sheet.height))
    ctx.close(); br.close()
