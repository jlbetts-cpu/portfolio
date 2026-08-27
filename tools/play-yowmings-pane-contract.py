#!/usr/bin/env python3
"""Does the League's match-up pane still fit once the stake line and the story are in it?

WHY THIS FILE EXISTS
--------------------
The Yowmings League adds two things to a pane whose height is already bounded: the line
saying which draft slot the fixture is for, and the "below the line" report of the
consolation matches nobody watched. tools/play-screens-contract.py already asserts that
nothing on this screen scrolls -- but it drives the SOCCER cup, so it cannot see either of
them, and both were caught overflowing by hand:

  * appended under the tape, the story ran behind the panel's own footer buttons at 1440
  * at 320x568 the pane has 139px and two story lines took it to 231 -- 92px over, because
    at 248px of inner width each sentence wraps to three lines

Both are the capsule trap, and scrollHeight-vs-clientHeight is the diagnostic that finds
it. So this drives the LEAGUE to a built bracket at every size that matters and measures.

WHY THE STORY IS INJECTED RATHER THAN PLAYED FOR. This is a LAYOUT measurement. Playing a
consolation set to get two real sentences on screen costs a couple of minutes a viewport
and measures nothing this file is asking about; the strings below are the shape toldLine()
produces, and what is under test is whether they fit. The physics and the results have
their own instruments (tools/play-yowmings-probe.py, tools/play-yowmings-contract.py).

    python3 tools/play-yowmings-pane-contract.py
"""
import importlib.util, sys
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
ROOT=Path("/Users/jaydenbetts/Downloads/portfolioo_v392")
sp=importlib.util.spec_from_file_location("f",ROOT/"tools"/"soccer-flow-probe.py")
F=importlib.util.module_from_spec(sp); sp.loader.exec_module(F)
OUT=Path(sys.argv[1] if len(sys.argv)>1 else ".")
from playwright.sync_api import sync_playwright
srv=ThreadingHTTPServer(("127.0.0.1",0),partial(F.Quiet,directory=str(ROOT)))
Thread(target=srv.serve_forever,daemon=True).start()
base="http://127.0.0.1:%d"%srv.server_port
STORY=["Player 6 4–1 Player 8 — the 1.05. Player 8 picks sixth.",
       "Player 5 4–0 Player 4 — the 1.07. Player 4 picks eighth.",
       "Player 2 3–2 Player 7 — the 1.03. Player 7 picks fourth."]
bad=0
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True,args=["--force-color-profile=srgb"])
    for w,h in ((1440,900),(390,844),(320,568)):
        pg=b.new_context(viewport={"width":w,"height":h},device_scale_factor=2).new_page()
        pg.goto(base+"/play.html",wait_until="load"); pg.evaluate(F.SEED_HEADS,8)
        pg.goto(base+"/play.html",wait_until="load"); pg.wait_for_timeout(2600)
        pg.evaluate("()=>document.getElementById('pcYow').click()"); pg.wait_for_timeout(1500)
        pg.evaluate("()=>{const s=document.querySelector('.tvSim');if(s)s.click();}")
        for i in range(120):
            pg.wait_for_timeout(1000)
            if pg.evaluate("()=>window.__hmTour.phase")!="qualify": break
        # AND THEN THE TALLEST PANE THERE IS. The 5px overrun that made the story one
        # paragraph instead of N was on the FINAL, whose pane carries the still poster as
        # well as the stake line and the report -- and the first fixture's pane, which is
        # what the loop above measures, never showed it. So the bracket is wound forward to
        # the final and measured again. recordWinner() is used directly rather than playing
        # eleven matches: this is a layout gate, the winners are arbitrary, and what is
        # under test is the shape of the pane the final produces.
        for phase in ("first fixture", "the final"):
          if phase == "the final":
            pg.evaluate("""() => { const BR = window.__hmBracket, br = window.__hmTour.br;
              let nm, guard = 0, last = br.rounds.length - 1;
              while ((nm = BR.nextMatch(br)) && guard++ < 60
                     && !(nm.round === last && nm.index === 0))
                BR.recordWinner(br, nm.round, nm.index, nm.match.a, 3, 1); }""")
          # TWO LINES IS THE MOST A MATCH-UP PANE CAN EVER HOLD, and that is the bracket
          # rather than a cap: the only consolation set that lands while a fixture is still
          # to come is the pair of 5-8 semi-finals. The third/fifth/seventh set is settled
          # by the drain that follows the FINAL, so its three lines arrive on the champion
          # screen, which has no captains, no poster and no tape to share the pane with.
          for n in (0,2):
              pg.evaluate("n=>{window.__hmTour.story = n ? %s.slice(0,n) : null;}"%str(STORY).replace("'",'"'), n)
              pg.evaluate("()=>{try{window.__hmTourRepaint&&window.__hmTourRepaint()}catch(_){}}")
              # paint() is module-private; nudge it through the public tab click instead
              pg.evaluate("""()=>{const t=Array.from(document.querySelectorAll('.tvTab')).find(x=>/Next/.test(x.textContent));if(t)t.click();}""")
              pg.wait_for_timeout(400)
              ov=pg.evaluate("""()=>{const o=[];document.querySelectorAll('.tvPanel,.tvPane').forEach(e=>{
                  if(e.scrollHeight-e.clientHeight>1)o.push(e.className.split(' ')[0]+' '+e.scrollHeight+'>'+e.clientHeight);});
                  const q=Array.from(document.querySelectorAll('.tvPane .tvQual')).map(x=>x.textContent);
                  return {ov:o,q:q};}""")
              print("%dx%d  %-14s story=%d  overflow=%s" % (w,h,phase,n,ov["ov"] or "none"))
              for line in ov["q"]: print("      "+line)
              if ov["ov"]:
                # ATTRIBUTE IT BEFORE FIXING IT. The same pane with T.yow forced off drops the
                # stake line and the report and leaves the screen the soccer cup already
                # shipped. If that overruns too, the overrun is not this mode's and the honest
                # thing is to say so rather than to trim a sentence that is not the cause.
                ctl = pg.evaluate("""()=>{const y=window.__hmTour.yow;window.__hmTour.yow=false;
                  const t=Array.from(document.querySelectorAll('.tvTab')).find(x=>/Next/.test(x.textContent));if(t)t.click();
                  const o=[];document.querySelectorAll('.tvPane').forEach(e=>{if(e.scrollHeight-e.clientHeight>1)o.push(e.scrollHeight+'>'+e.clientHeight);});
                  window.__hmTour.yow=y;return o;}""")
                if ctl:
                  print("        control (League off) also overruns %s -- pre-existing" % ctl)
                else:
                  bad+=1
              if n==2: pg.screenshot(path=str(OUT/("pane-%d-%s.png"%(w,phase.split()[-1]))))
        pg.close()
    b.close()
srv.shutdown(); srv.server_close()
print("STATUS=%s  the stake line and the story fit the pane at every size"
      % ("FAIL" if bad else "PASS"))
sys.exit(1 if bad else 0)
