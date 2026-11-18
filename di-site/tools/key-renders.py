# Cuts the 3-5-3 renders out of the flat grey they were generated on (2026-11-17) and saves them as WebP.
#   python3 tools/key-renders.py SOURCE_DIR assets/method   (SOURCE_DIR: the 1024px PNGs from Figma)

import sys, os, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
SIZES = {'caterpillar':720,'cocoon':720,'butterfly':720,'trifecta':720}
for f in sorted(os.listdir(src)):
    if not f.endswith('.png'): continue
    n = f[:-4]
    a = np.asarray(Image.open(os.path.join(src, f)).convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    # the ground: the median of a 12px border, so a faint vignette does not count as the object
    edge = np.concatenate([a[:12].reshape(-1,3), a[-12:].reshape(-1,3), a[:, :12].reshape(-1,3), a[:, -12:].reshape(-1,3)])
    bg = np.median(edge, axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    alpha = np.clip((d - 5.0) / 14.0, 0, 1)
    # un-mix the ground out of the soft edge so it sits clean on any grey or white
    am = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - am) * bg) / am, 0, 255)
    rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    ys, xs = np.where(d > 6)
    pad = int(0.03 * max(h, w))
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, w), min(ys.max() + pad + 1, h))
    im = Image.fromarray(rgba).crop(box)
    side = SIZES.get(n, 320)
    im.thumbnail((side, side), Image.LANCZOS)
    im.save(os.path.join(out, n + '.webp'), 'WEBP', quality=88, method=6)
    print(n, 'bg', bg.round(1).tolist(), 'box', box, '->', im.size, os.path.getsize(os.path.join(out, n + '.webp')))
