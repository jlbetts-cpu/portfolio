"""Bake images/ref-hat.webp -- the referee's cap for the Jayden head.

Drawn to Jayden's reference: a front-on six-panel ball cap, black and white
vertical stripes, black peak.

GEOMETRY, which is what the first attempt got wrong (it came out a bowler):
a ball cap's peak is a shallow LENS at the front, only a little wider than the
crown, with its lower edge arcing DOWN -- not a full ellipse ringing the head.
Crown is wider than tall and flattened on top; peak width is 1.12x crown width,
not 1.36x.

LIT LIKE A PHOTOGRAPH, because it has to sit on one:
  * stripes spaced by sin(theta), so they crowd toward both silhouette edges --
    that, not shading, is what actually sells a curved surface;
  * one key from the upper left, matching the head plate's own highlight, so
    the right third falls into shade and its white panels drop to about 0.62;
  * the peak is turned away from the key and catches only sky, so it is darker
    than the crown's own black, graded front-to-back;
  * ambient occlusion in the crown/peak join -- the join is what reads as fake
    when it is missing;
  * a hairline specular on the peak's leading edge, the one highlight a black
    brim really shows.

Rendered at 4x and downsampled so silhouette and stripe edges are properly
antialiased. He asked for pixel perfect and a 1x ellipse is not.
"""
import math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SS = 4
W, H = 320, 210
w, h = W * SS, H * SS

cx = w * 0.5
crown_w = w * 0.66
crown_top = h * 0.10
brim_y = h * 0.685                       # crown meets peak
crown_h = (brim_y - crown_top) * 1.34    # ellipse taller than shown; bottom is cut

# ----------------------------------------------------------------- crown mask
crown = Image.new("L", (w, h), 0)
ImageDraw.Draw(crown).ellipse(
    [cx - crown_w / 2, crown_top, cx + crown_w / 2, crown_top + crown_h], fill=255)
below = Image.new("L", (w, h), 255)
ImageDraw.Draw(below).rectangle([0, brim_y, w, h], fill=0)
crown = ImageChops.multiply(crown, below)

# ------------------------------------------------------------------- stripes
stripes = Image.new("L", (w, h), 0)
sd = ImageDraw.Draw(stripes)
R = crown_w / 2
PANELS = 13                               # alternating -> 7 white, 6 black
for i in range(PANELS):
    t0 = -math.pi / 2 + i * math.pi / PANELS
    t1 = -math.pi / 2 + (i + 1) * math.pi / PANELS
    if i % 2 == 0:
        sd.rectangle([cx + R * math.sin(t0), 0, cx + R * math.sin(t1), h], fill=255)
stripes = ImageChops.multiply(stripes, crown)

# ------------------------------------------------------------------ lighting
shade = Image.new("L", (w, h), 0)
px = shade.load()
ecy = crown_top + crown_h / 2
for y in range(0, h, 2):
    for x in range(0, w, 2):
        nx = (x - cx) / R
        ny = (y - ecy) / (crown_h / 2)
        d = nx * nx + ny * ny
        if d > 1.4:
            continue
        nz = math.sqrt(max(0.0, 1.0 - min(1.0, d)))
        lvx, lvy, lvz = -0.42, -0.52, 0.75          # key: upper left, toward us
        ndl = max(0.0, nx * lvx + ny * lvy + nz * lvz)
        v = int(max(0, min(255, 40 + 205 * (ndl ** 0.85))))
        for dy in (0, 1):
            for dx in (0, 1):
                if x + dx < w and y + dy < h:
                    px[x + dx, y + dy] = v
shade = shade.filter(ImageFilter.GaussianBlur(SS * 1.5))

BLACK_LO, BLACK_HI = 14, 70
WHITE_LO, WHITE_HI = 122, 250
black_layer = shade.point(lambda v: int(BLACK_LO + (BLACK_HI - BLACK_LO) * v / 255.0))
white_layer = shade.point(lambda v: int(WHITE_LO + (WHITE_HI - WHITE_LO) * v / 255.0))
crown_val = Image.composite(white_layer, black_layer, stripes)

ao = Image.new("L", (w, h), 255)
ImageDraw.Draw(ao).rectangle([0, brim_y - SS * 22, w, brim_y], fill=120)
crown_val = ImageChops.multiply(crown_val, ao.filter(ImageFilter.GaussianBlur(SS * 6)))

# a hair of warmth so it does not read as flat greyscale beside a warm photo
cr, cg, cb = crown_val, crown_val, crown_val
crown_rgb = Image.merge("RGB", (
    cr.point(lambda v: min(255, int(v * 1.02 + 2))),
    cg,
    cb.point(lambda v: int(v * 0.96)),
))

img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
img.paste(crown_rgb, (0, 0), crown)

# --------------------------------------------------------------------- peak
# A lens: the region below an upper arc and above a lower arc. Only a little
# wider than the crown, dipping in the middle. This is the whole difference
# between a ball cap and a bowler.
brim_w = crown_w * 1.08
peak_low = Image.new("L", (w, h), 0)
ImageDraw.Draw(peak_low).ellipse(
    [cx - brim_w / 2, brim_y - h * 0.20, cx + brim_w / 2, brim_y + h * 0.185], fill=255)
peak_cut = Image.new("L", (w, h), 255)
ImageDraw.Draw(peak_cut).ellipse(
    [cx - brim_w * 0.545, brim_y - h * 0.40, cx + brim_w * 0.545, brim_y + h * 0.008], fill=0)
peak = ImageChops.multiply(peak_low, peak_cut)

psh = Image.new("L", (w, h), 0)
pp = psh.load()
y0 = int(brim_y - h * 0.02)
for y in range(y0, h):
    f = (y - y0) / max(1.0, h - y0)
    v = int(9 + 26 * (1.0 - f) + 9 * f)
    for x in range(w):
        # the peak curls away at its ends, so darken toward left/right
        e = abs(x - cx) / (brim_w / 2)
        pp[x, y] = max(0, int(v * (1.0 - 0.30 * min(1.0, e * e))))
psh = psh.filter(ImageFilter.GaussianBlur(SS * 2))
img.paste(Image.merge("RGB", (psh, psh, psh)), (0, 0), peak)

# leading-edge specular
edge = peak.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.GaussianBlur(SS * 0.7))
lower = Image.new("L", (w, h), 0)
ImageDraw.Draw(lower).rectangle([0, int(brim_y + h * 0.04), w, h], fill=255)
edge = ImageChops.multiply(edge, lower).point(lambda v: int(v * 0.42))
img.paste(Image.new("RGB", (w, h), (132, 132, 136)), (0, 0), edge)

# ------------------------------------------------------------------- button
btn = Image.new("L", (w, h), 0)
br = SS * 7
ImageDraw.Draw(btn).ellipse(
    [cx - br, crown_top - br * 0.35, cx + br, crown_top + br * 1.65], fill=255)
img.paste(Image.new("RGB", (w, h), (36, 36, 38)), (0, 0), btn)

img = img.resize((W, H), Image.LANCZOS)
img.save("images/ref-hat.webp", "WEBP", quality=95, method=6)
print("  wrote images/ref-hat.webp  %dx%d  opaque px %d"
      % (img.size[0], img.size[1], sum(1 for v in img.split()[3].getdata() if v > 8)))
