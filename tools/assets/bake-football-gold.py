"""Bake images/football-gold.webp from images/football.webp.  Pure PIL: this
machine's python3 has Pillow but no numpy.

Matches the reference Jayden supplied: a warm metallic gold body whose value
runs from deep bronze in the shadowed underside to a near-white specular on the
upper left, with the LACES left white -- on a gold-dipped ball the leather
takes the plating and the laces do not.

Luminance -> a hand-built gold ramp, so every shading cue already in the source
(pebble grain, the seam, the occlusion under the belly) survives and only the
hue changes. Alpha is carried through untouched so the cutout stays exactly the
one the engine already positions.
"""
from PIL import Image, ImageChops, ImageOps

SRC = "images/football.webp"
DST = "images/football-gold.webp"

STOPS = [
    (0.00, (58, 38, 12)),
    (0.22, (120, 84, 28)),
    (0.46, (186, 146, 62)),
    (0.70, (226, 196, 116)),
    (0.88, (245, 226, 168)),
    (1.00, (255, 250, 226)),
]


def channel_lut(ch):
    out = []
    for i in range(256):
        t = i / 255.0
        v = STOPS[-1][1][ch]
        for k in range(len(STOPS) - 1):
            t0, c0 = STOPS[k]
            t1, c1 = STOPS[k + 1]
            if t0 <= t <= t1:
                f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
                v = c0[ch] + (c1[ch] - c0[ch]) * f
                break
        out.append(int(round(max(0, min(255, v)))))
    return out


im = Image.open(SRC).convert("RGBA")
r, g, b, alpha = im.split()
lum = Image.merge("RGB", (r, g, b)).convert("L")

# Stretch the source's own range so the ramp spans the whole ball instead of
# bunching in the middle -- the source football is dark brown and uses about
# half the scale. autocontrast is masked by hand: fill the transparent border
# with the ball's own mean first, or the cutout's black would anchor the low end.
stat_src = lum.copy()
stat_src.paste(0, (0, 0) + im.size, ImageChops.invert(alpha))
hist = stat_src.histogram()
inside_total = sum(alpha.point(lambda a: 1 if a > 8 else 0).getdata())
# find 2nd/98th percentile of luminance inside the ball
vals = list(lum.getdata())
al = list(alpha.getdata())
ins = sorted(v for v, a in zip(vals, al) if a > 8)
lo = ins[int(len(ins) * 0.02)]
hi = ins[int(len(ins) * 0.98)]
span = max(1, hi - lo)
norm = lum.point(lambda v: max(0, min(255, int((v - lo) * 255.0 / span))))

gold = Image.merge("RGB", (
    norm.point(channel_lut(0)),
    norm.point(channel_lut(1)),
    norm.point(channel_lut(2)),
))

# THE LACES STAY WHITE. They are the brightest and least saturated thing on the
# source; the gold ramp would tint them and the reference keeps them white.
mx = ImageChops.lighter(ImageChops.lighter(r, g), b)
mn = ImageChops.darker(ImageChops.darker(r, g), b)
sat = ImageChops.subtract(mx, mn)                       # 0 = grey, high = colourful
bright = norm.point(lambda v: max(0, min(255, int((v - 190) * 255.0 / 50))))
flat = sat.point(lambda v: max(0, min(255, int((70 - v) * 255.0 / 70))))
lace = ImageChops.multiply(bright, flat)

white = Image.new("RGB", im.size, (252, 251, 247))
gold = Image.composite(white, gold, lace)

out = Image.merge("RGBA", (*gold.split(), alpha))
out.save(DST, "WEBP", quality=95, method=6)

chk = Image.open(DST).convert("RGBA")
cd = list(chk.getdata())
inside = [p for p in cd if p[3] > 8]
n = len(inside)
print("  wrote %s  %s  opaque px %d" % (DST, chk.size, n))
print("  mean RGB inside: %.0f, %.0f, %.0f" % tuple(sum(p[c] for p in inside) / n for c in range(3)))
print("  alpha preserved exactly: %s" % (list(chk.split()[3].getdata()) == list(alpha.getdata())))
print("  lace pixels kept white: %d" % sum(1 for p in inside if p[0] > 240 and p[1] > 240 and p[2] > 235))
