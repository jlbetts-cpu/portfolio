# One-file copy of the site: index.html with the CSS, the script, the font and the photographs inlined, so it opens
# from a folder by double-click in any browser, with no server and no internet. (Opened straight from the folder, the
# real site loses its typeface in Chrome, which will not load a font from a local file; inlined, it cannot be blocked.)
# Used for the review link and for the folder on his computer. Only the film stays a file beside the page (11.5 MB);
# where it sits is the second argument.
#   python3 tools/build-single.py OUT.html [VIDEO_HREF]
# VIDEO_HREF defaults to assets/video/linda-china.mp4, the path the review link serves it at.
import re, sys, json, base64, pathlib
from urllib.parse import quote
root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'single.html'
video_href = sys.argv[2] if len(sys.argv) > 2 else 'assets/video/linda-china.mp4'
html = (root / 'index.html').read_text()
title = 'Developmental Improvisation'
body = html[html.index('<body>') + 6: html.rindex('</body>')]
# the head's own inline scripts (marking the page as scripted, the curtain, a remembered subscriber) run before paint
head_js = ''.join(re.findall(r'<script>.*?</script>', html[:html.index('<body>')], flags=re.S))

def data(p, mime):
    return f'data:{mime};base64,' + base64.b64encode((root / p).read_bytes()).decode()

css = '\n'.join((root / 'css' / f).read_text() for f in ['tokens.css', 'base.css', 'components.css', 'home.css'])
css = css.replace('url("../fonts/inter-variable.woff2")', f'url("{data("fonts/inter-variable.woff2","font/woff2")}")')
assert css.count('data:font/woff2') == 1, 'font url not matched'
# main.js, then what the page takes from Some Wins (the liquid and the scroll-linked moves, 2026-11-17)
js = (root / 'js' / 'main.js').read_text() + '\n' + (root / 'js' / 'somewins.js').read_text()

MIME = {'avif': 'image/avif', 'webp': 'image/webp', 'jpg': 'image/jpeg'}
def srcset(m):
    # the 480 and 960 files only: the 640/1440/1920 ones would double the file for a copy nobody prints
    out = []
    for cand in m.group(1).split(','):
        if len(cand.split()) == 1:   # one file and no width: the film's poster, inlined as it is
            url = cand.strip().split('?')[0]
            return f'srcset="{data(url, MIME[url.rsplit(".", 1)[1]])}"'
        url, w = cand.split()
        if w not in ('480w', '960w'):
            continue
        out.append(f'{data(url.split("?")[0], MIME[url.split("?")[0].rsplit(".", 1)[1]])} {w}')
    return 'srcset="' + ', '.join(out) + '"'
# the strip's second and third runs are copies of the first, for the loop: inlined they would double fifteen
# photographs' worth of data, so they ship empty and are cloned from the first before the script measures anything
body, ghosts = re.subn(r'<ul class="reel__run" aria-hidden="true">.*?</ul>', '<ul class="reel__run" aria-hidden="true" data-clone></ul>', body, flags=re.S)
CLONE = "document.querySelectorAll('[data-clone]').forEach(function(u){u.innerHTML=u.previousElementSibling.innerHTML;u.querySelectorAll('.photo__open').forEach(function(b){b.tabIndex=-1;b.removeAttribute('aria-label');});});"
body = re.sub(r'srcset="([^"]+)"', srcset, body)
body = re.sub(r'src="(assets/video/[a-z0-9-]+-poster\.jpg)\?v=\w+"', lambda m: f'src="{data(m.group(1), "image/jpeg")}"', body)
body = re.sub(r'src="assets/video/[a-z0-9-]+\.mp4\?v=\w+"', lambda m: f'src="{quote(video_href)}"', body)
body = re.sub(r'src="images/([a-z0-9-]+)-960\.jpg"', lambda m: f'src="{data(f"images/{m.group(1)}-480.webp","image/webp")}"', body)

def lbdata(m):
    d = json.loads(m.group(1))
    for n, e in d.items():
        # a few sources are narrower than 960, so take the widest of the two that was written
        w = max([x for x in [480, 960] if (root / f'images/{n}-{x}.webp').exists()] or [480])
        e['avif'] = [[w, data(f'images/{n}-{w}.avif', 'image/avif')]]
        e['webp'] = [[w, data(f'images/{n}-{w}.webp', 'image/webp')]]
        e['jpeg'] = e['webp'][0][1]
        if 't' in e: e['t'] = [data(f'images/{n}-160.avif', 'image/avif'), data(f'images/{n}-160.webp', 'image/webp')]
    return '<script type="application/json" id="lbData">' + json.dumps(d, separators=(',', ':')) + '</script>'
body = re.sub(r'<script type="application/json" id="lbData">(.*?)</script>', lbdata, body, flags=re.S)
body = body.replace('href="/"', 'href="#top"')
body = re.sub(r'<script src="js/main\.js\?v=\w+" defer></script>', '', body)
assert 'images/' not in body and '<script src=' not in body, 'unresolved local reference'

# a whole document, so it opens on its own; light only, set before anything paints
page = (f'<!DOCTYPE html><html lang="en" data-di-theme="light"><head><meta charset="utf-8">'
        f'<meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>{head_js}'
        f'<style>\n{css}\n</style></head><body>\n{body}\n<script>\n{CLONE}\n{js}\n</script>\n</body></html>\n')
out.write_text(page)
print(out, f'{out.stat().st_size/1e6:.1f} MB', 'ghost runs', ghosts, 'data uris', page.count('data:image'))
