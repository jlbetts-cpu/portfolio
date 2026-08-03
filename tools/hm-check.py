import re, subprocess, tempfile, sys, os, glob
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fail = 0

def check(label, source):
    global fail
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f:
        f.write(source); p = f.name
    r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode:
        fail = 1; print(label, 'FAIL\n', r.stderr[:400])

for html in ['index.html', 'play.html']:
    path = os.path.join(ROOT, html)
    if not os.path.exists(path): continue
    for i, (attrs, body) in enumerate(
            re.findall(r'<script([^>]*)>(.*?)</script>', open(path).read(), re.S)):
        if 'ld+json' in attrs or 'src=' in attrs or not body.strip(): continue
        check('%s block %d' % (html, i), body)

for js in sorted(glob.glob(os.path.join(ROOT, '*.js'))):
    check(os.path.basename(js), open(js).read())

print('syntax OK' if not fail else 'SYNTAX FAILURES'); sys.exit(fail)
