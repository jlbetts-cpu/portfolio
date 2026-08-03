/* play-games.js -- the launcher half of index.html's play-menu controller
   (index.html:4465-4713), split out per the Task 3 brief and
   docs/superpowers/specs/2026-08-02-play-page-design.md §5.4/§3.2.

   OWNERSHIP SPLIT: that controller did two jobs in one IIFE. The saved-heads
   roster (readAll's UI half, render(), #moodHeads, headsShown/applyHeads/
   syncBar, "Add an egghead") is home-owned and stays in index.html for Task 5.
   This file owns the game launchers, the shared gating (gameCount/gameOn/
   battleGate) and the soccer team tray -- everything play.html needs to start
   and gate a match on its own, with its own copy of the menu (spec §4.1: "its
   own game menu + team tray").

   CORRECTION (2026-08-02, Jayden, overriding the original 4-game brief): the
   menu ships SOCCER and TOURNAMENT only -- "not quite yet" for Floor is Lava
   and Marble Race. Their launchers (battleGo/raceGo below) are ported anyway
   because they are entangled with the shared helpers in the same source block
   -- surgically cutting them out of a sequential function group is the harder,
   riskier edit -- but play.html's markup carries no #battleGo/#raceGo buttons,
   so document.getElementById returns null and the `if(bi)`/`if(bg)` guards
   already in this code leave them permanently unbound. Nothing to start them.

   readAll() IS DUPLICATED here, not reused from home. index.html:4473-4482's
   copy is coupled to nothing but localStorage -- but it lives inside an IIFE
   gated on `#moodHeads` existing (index.html:4466), which play.html does not
   have. The spec says play.html "carries its own copy of the game menu"
   (§4.1), so this is a second independent copy of the same read-and-dedupe
   logic already duplicated a THIRD time inside play-engine.js's own startup
   (play-engine.js:6-12, one-shot, no live cache) -- three copies of one
   14-line block is how this codebase already handles a small piece of logic
   three different scripts need without a shared-utils file. Same cache-and-
   version-bump shape as the home copy, since battleGate() polls it every
   400ms and the team tray reads it on every open. */
(function(){
 var _hcVer=0,_hcCache=null,_hcCacheVer=-1;
 try{addEventListener("storage",function(e){if(!e||e.key===null||e.key==="hmCompanions")_hcVer++;});}catch(_){}
 function readAll(){if(_hcCache&&_hcCacheVer===_hcVer)return _hcCache.slice();
  var a=[],rawN=null;
  try{var raw=localStorage.getItem("hmCompanions");if(raw!==null){a=JSON.parse(raw)||[];rawN=a.length;}}catch(_){}
  if(rawN===null){try{var l=JSON.parse(localStorage.getItem("hmCompanion")||"null");if(l&&l.cut)a=[l];}catch(_){}}   // an emptied pit stays empty
  var seen={};a=a.filter(function(d){if(!d||!d.cut||d.cut.length<15000)return false;
  var k2=JSON.stringify(d.marks||"m")+JSON.stringify((d.eyes||[]).map(function(e){return[e.x,e.y,e.w,e.h];}));
  if(seen[d.cut]||seen[k2])return false;seen[d.cut]=1;seen[k2]=1;return true;}).slice(0,8);
  if(rawN!==null&&rawN!==a.length){try{localStorage.setItem("hmCompanions",JSON.stringify(a));_hcVer++;}catch(_){}}   // heal duplicates so one x is always one head
  _hcCache=a;_hcCacheVer=_hcVer;
  return a.slice();}

 // --- MENU OPEN/CLOSE: NOT part of the controller this file splits from -- that toggle lives
 // in a separate home-only module (index.html:4260-4462) mixed in with mood-word triggers
 // (startRain/moodEat/startParty/startLove) that have no meaning without the hero headline.
 // Every one of those functions is unreachable on play.html, so it is not portable, but SOME
 // open/close glue is required or #moodBtn does nothing: .moodMenu's visibility is entirely
 // gated on body>.moodbar.open (play.css:152-153, carried over from index.html). Minimal
 // version only: click-to-toggle, outside-click-to-close, Escape-to-close. No hover-intent, no
 // mobile edge-clamping, no chevron-rotation choreography -- home's menu carries four mood rows
 // plus a saved-heads grid and can run off the top of a short phone screen; this one is three
 // rows and sits in a fixed top-right corner with room to open downward, so the fancier
 // clamping home needs was solving a problem this menu doesn't have.
 (function(){
  var bar=document.getElementById("moodbar");if(!bar)return;
  var btn=document.getElementById("moodBtn");
  function closeM(){bar.classList.remove("open");if(btn)btn.setAttribute("aria-expanded","false");}
  function openM(){bar.classList.add("open");if(btn)btn.setAttribute("aria-expanded","true");}
  if(btn)btn.addEventListener("click",function(e){e.stopPropagation();
   if(document.body.classList.contains("hmTour")){closeM();return;}   // tournament disables moodBtn (index.html:8545) -- honor that here too
   bar.classList.contains("open")?closeM():openM();});
  document.addEventListener("click",function(e){if(bar.classList.contains("open")&&!bar.contains(e.target))closeM();});
  addEventListener("keydown",function(e){if(e.key==="Escape"&&bar.classList.contains("open"))closeM();});
 })();

 function gameCount(){return Math.max(readAll().length,(window.__hmLive||[]).length);}
 function gameOn(){if(window.__hmTour&&window.__hmTour.live)return true;return document.body.classList.contains("hmBattle")||document.body.classList.contains("hmSoccer")||document.body.classList.contains("hmRace");}
 var _bgLast="";
 function battleGate(){var n=gameCount(),on=gameOn();
  var few=n<1;                                  // ONE head count per tick -- this used to be six readAll() calls
  var sig=(on?1:0)+"|"+(few?1:0);
  if(sig===_bgLast)return;                      // nothing changed since last tick: no DOM writes at all
  _bgLast=sig;
  ["battleGo","soccerGo","raceGo","tourGo"].forEach(function(id){var bi=document.getElementById(id);if(!bi)return;
   if(on){bi.style.display="none";}   // a game is running: only End game belongs here
   else{bi.style.display="flex";bi.style.opacity=few?"0.38":"";bi.style.pointerEvents=few?"none":"";bi.setAttribute("aria-disabled",few?"true":"false");}});   // even one head can play now -- mini-Jayden makes the second
  ["soccerTeams","lavaTeams"].forEach(function(tid){var tb=document.getElementById(tid);if(tb){if(on){tb.style.display="none";}else{tb.style.display="";tb.style.opacity=few?"0.38":"";tb.style.pointerEvents=few?"none":"";}}});   // the team-picker icons ride with the Soccer + Floor-is-Lava rows
  var offNow=on;[].forEach.call(document.querySelectorAll(".moodMenu .moodItem[data-mood], #addPlaceholder, .moodMenu .moodGo"),function(el){
   if(offNow)el.setAttribute("aria-disabled","true");else el.removeAttribute("aria-disabled");});   // the dim is CSS; this is what a screen reader hears
  var eg=document.getElementById("endGame");if(eg)eg.style.display="none";   // End now lives on the scoreboard, not the menu
  syncMoodSeps();}
 /* ---- A .moodSep is a rule BETWEEN two groups, so it only earns its pixel when there is
    something visible on BOTH sides of it. play.html's menu carries no .moodSep today (no mood
    dots, no "Add an egghead" group to separate from), so this is a no-op here -- kept verbatim
    so a later pass that adds dividers back gets the behavior for free. ---- */
 function syncMoodSeps(){
  var mm=document.getElementById("moodMenu");if(!mm)return;
  var kids=[].slice.call(mm.children),last=null,before=false,i,el;
  var shown=function(e){if(e.hasAttribute("hidden"))return false;
   if(getComputedStyle(e).display==="none")return false;
   return e.getBoundingClientRect().height>0.5;};
  for(i=0;i<kids.length;i++){el=kids[i];
   if(el.classList.contains("moodSep")){el.setAttribute("data-keep","0");last=el;continue;}
   if(shown(el)){if(last&&before)last.setAttribute("data-keep","1");before=true;}}
  for(i=0;i<kids.length;i++){el=kids[i];
   if(el.classList.contains("moodSep"))el.style.display=el.getAttribute("data-keep")==="1"?"":"none";}}
 window.__syncMoodSeps=syncMoodSeps;
 battleGate();setInterval(battleGate,400);
 function closeMenuBar(){var mb=document.getElementById("moodbar");if(mb)mb.classList.remove("open");var mbt=document.getElementById("moodBtn");if(mbt)mbt.setAttribute("aria-expanded","false");}
 var bg=document.getElementById("battleGo");
 if(bg)bg.addEventListener("click",function(){
  var rc=readAll().length;if(rc<1||gameOn())return;
  window.__hmLavaTeams=false;   // the plain button is a solo free-for-all (teams are the opt-in via the teams icon)
  if(rc%2===1&&window.__hmFillerAdd)window.__hmFillerAdd();   // odd sides -> mini-Jayden steps in
  window.__hmCrowd=rc+(rc%2===1?1:0);   // seed the crowd size NOW so the lava's first rise is tuned to the real player count (not a stale/default value)
  window.__hmBattleReq=performance.now();document.body.classList.add("hmBattle");
  if(window.__hmNewArena)window.__hmNewArena();   // lay the random arena BEFORE the heads scatter onto it
  closeMenuBar();battleGate();});
 var sg=document.getElementById("soccerGo");
 if(sg)sg.addEventListener("click",function(){
  var rc=readAll().length;if(rc<1||gameOn())return;
  if(rc%2===1&&window.__hmFillerAdd)window.__hmFillerAdd();   // add BEFORE kickoff so the teams count him
  try{if(window.__hmSoccerStart)window.__hmSoccerStart();}catch(_){}closeMenuBar();battleGate();});
 var tg=document.getElementById("tourGo");
 if(tg)tg.addEventListener("click",function(){
  if(gameOn())return;
  try{if(window.__hmTourStart)window.__hmTourStart();}catch(_){}closeMenuBar();battleGate();});   // the tournament builds its own squads, so no mini-Jayden top-up here -- Task 4 lands __hmTourStart; until then this is a correctly-gated no-op
 var rg=document.getElementById("raceGo");
 if(rg)rg.addEventListener("click",function(){
  var rc=readAll().length;if(rc<1||gameOn())return;
  var _dly=0;if(rc%2===1&&window.__hmFillerAdd){window.__hmFillerAdd();_dly=500;}   // odd field -> the mini-Jayden lines up... and the grid WAITS the half-beat his spawn needs, or he'd race as a ghost
  setTimeout(function(){try{if(window.__hmRaceStart)window.__hmRaceStart();}catch(_){}},_dly);closeMenuBar();battleGate();});
 // End game retired from the menu -- it lives on each game's own scoreboard, beside the thing it controls

 var bar=document.getElementById("moodbar");if(bar)bar.addEventListener("click",function(){setTimeout(function(){battleGate();},60);});   // home also called render() here to refresh #moodHeads; play.html has no roster grid to refresh

 // --- SOCCER TEAM PICKER: pick sides in one tap; heads preview their team colour live ---
 (function(){
  var teamsBtn=document.getElementById("soccerTeams");if(!teamsBtn)return;
  var lavaBtn=document.getElementById("lavaTeams");   // the Floor-is-Lava teams icon opens the SAME tray in lava mode -- play.html has no lavaTeams button, so this stays null and every `if(lavaBtn)` guard below already no-ops
  var tray=null,sel={},open=false,mode="soccer",activeTrig=teamsBtn;
  var st=document.createElement("style");
  st.textContent=".moodRow{display:flex;align-items:center;gap:8px}.moodRow>#soccerGo{flex:1 1 auto}"
   +".moodTeamsBtn{flex:0 0 auto;align-self:stretch;display:inline-flex;align-items:center;justify-content:center;gap:3px;border:1px solid var(--c100);border-radius:4px;background:var(--c50);cursor:pointer;padding:0 8px;transition:border-color .18s cubic-bezier(.2,.8,.2,1),background-color .18s}"
   +".moodTeamsBtn:hover{border-color:var(--c500)}.moodTeamsBtn .tdotR,.moodTeamsBtn .tdotB{width:8px;height:8px;border-radius:50%;display:block}.moodTeamsBtn .tdotR{background:rgb(224,90,78)}.moodTeamsBtn .tdotB{background:rgb(90,160,216)}"
   +".teamTray{position:fixed;right:20px;bottom:96px;z-index:80;width:300px;max-width:calc(100vw - 28px);background:var(--c50);border:1px solid var(--c100);border-radius:12px;box-shadow:0 18px 46px -18px rgba(8,8,8,.42),0 4px 12px -6px rgba(8,8,8,.18);padding:12px;opacity:0;transform:translateY(8px) scale(.98);pointer-events:none;transition:opacity .18s cubic-bezier(.2,.8,.2,1),transform .2s cubic-bezier(.2,.8,.2,1)}"
   +".teamTray.open{opacity:1;transform:none;pointer-events:auto}@media(max-width:520px){.teamTray{left:12px;right:12px;width:auto;bottom:82px}}"
   +".teamTrayHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.teamTrayTitle{font-family:var(--sans);font-weight:600;font-size:var(--fs-small);color:var(--c950)}"
   +".teamMini{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--c100);border-radius:6px;background:var(--c50);color:var(--c700);cursor:pointer;font-size:var(--fs-small);line-height:1;transition:border-color .15s,color .15s}.teamMini:hover{border-color:var(--c500);color:var(--c950)}"
   +".teamTrayCols{display:grid;grid-template-columns:1fr 1fr;gap:8px}.teamCol{border-radius:10px;padding:8px 8px 8px;min-height:118px;border:1.5px solid}.teamCol.red{border-color:rgba(224,90,78,.45);background:rgba(224,90,78,.055)}.teamCol.blue{border-color:rgba(90,160,216,.45);background:rgba(90,160,216,.055)}"
   +".teamColHdr{font-family:var(--sans);font-weight:600;font-size:var(--fs-micro);letter-spacing:.06em;text-transform:uppercase;margin-bottom:8px;text-align:center}.teamCol.red .teamColHdr{color:rgb(190,58,47)}.teamCol.blue .teamColHdr{color:rgb(52,116,176)}"
   +".teamChips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-content:flex-start}.teamChip{width:40px;height:48px;border-radius:8px;overflow:hidden;border:2px solid transparent;cursor:pointer;padding:0;background:var(--c100);transition:transform .12s cubic-bezier(.2,.8,.2,1)}.teamChip:hover{transform:translateY(-2px)}.teamChip img{width:100%;height:100%;object-fit:cover;display:block}.teamChip.red{border-color:rgb(224,90,78)}.teamChip.blue{border-color:rgb(90,160,216)}.teamChip{touch-action:none;-webkit-user-select:none;user-select:none}.teamCol.dragOver{outline:2px dashed rgba(8,8,8,.35);outline-offset:-3px}.teamCol.red.dragOver{background:rgba(224,90,78,.14)}.teamCol.blue.dragOver{background:rgba(90,160,216,.14)}"
   +".teamTrayFoot{margin-top:12px}.teamStart{width:100%;padding:12px;border:0;border-radius:8px;background:var(--c950);color:var(--c50);font-family:var(--sans);font-weight:600;font-size:14px;cursor:pointer;transition:opacity .15s}.teamStart:hover{opacity:.9}.teamHint{font-family:var(--sans);font-size:var(--fs-micro);color:var(--c500);text-align:center;margin-top:8px}";
  document.head.appendChild(st);

  function heads(){return readAll();}                         // hmCompanions order == the slot index each head spawns with
  function balanced(n){var a=[];for(var i=0;i<n;i++)a.push(i<Math.ceil(n/2)?1:2);return a;}
  function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  function ensureSel(){var n=heads().length,ok=true,i;
   for(i=0;i<n;i++){if(sel[i]!==1&&sel[i]!==2){ok=false;break;}}
   for(var k in sel){if(+k>=n&&+k<9000)delete sel[k];}   // keep the mini-Jayden key (9001)
   var realKeys=0;for(var k2 in sel){if(+k2<9000)realKeys++;}
   if(!ok||realKeys!==n){var prev=window.__hmTeamSel,good=false,mjKeep=sel[9001];
    if(prev){good=true;for(i=0;i<n;i++){if(prev[i]!==1&&prev[i]!==2){good=false;break;}}}
    if(good){sel={};for(i=0;i<n;i++)sel[i]=prev[i];}
    else{var a=balanced(n);sel={};a.forEach(function(t,i2){sel[i2]=t;});}
    if(mjKeep===1||mjKeep===2)sel[9001]=mjKeep;else if(prev&&(prev[9001]===1||prev[9001]===2))sel[9001]=prev[9001];}
   if(sel[9001]!==1&&sel[9001]!==2)sel[9001]=(Math.random()<0.5?1:2);   // Jayden picks a side too (he joins when the sides are uneven)
   return n;}
  function syncGlobal(){var o={};for(var k in sel)o[k]=sel[k];window.__hmTeamSel=o;}
  function applyPreview(){if(open){var o={};for(var k in sel)o[k]=sel[k];window.__hmTeamPreview=o;}else window.__hmTeamPreview=null;}
  var colEls={};   // team -> column element, for drag hit-testing
  function hitCol(c,px,py){if(!c)return false;var r=c.getBoundingClientRect();return px>=r.left&&px<=r.right&&py>=r.top&&py<=r.bottom;}
  function bindChip(b,key){   // TAP flips sides; DRAG the chip onto the other column to switch it there
   b.addEventListener("pointerdown",function(ev){ev.preventDefault();ev.stopPropagation();
    var sx=ev.clientX,sy=ev.clientY,moved=false,ghost=null;try{b.setPointerCapture(ev.pointerId);}catch(_){}
    function paintOver(px,py){[1,2].forEach(function(t){var c=colEls[t];if(c)c.classList.toggle("dragOver",hitCol(c,px,py));});}
    function mv(e){var dx=e.clientX-sx,dy=e.clientY-sy;
     if(!moved&&Math.hypot(dx,dy)>6){moved=true;ghost=b.cloneNode(true);ghost.style.cssText="position:fixed;z-index:90;width:"+b.offsetWidth+"px;height:"+b.offsetHeight+"px;margin:0;pointer-events:none;opacity:.9;transform:translate(-50%,-50%);box-shadow:0 8px 20px -6px rgba(8,8,8,.5)";document.body.appendChild(ghost);b.style.opacity="0.28";}
     if(moved&&ghost){ghost.style.left=e.clientX+"px";ghost.style.top=e.clientY+"px";paintOver(e.clientX,e.clientY);}}
    function up(e){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);
     [1,2].forEach(function(t){var c=colEls[t];if(c)c.classList.remove("dragOver");});
     if(ghost){ghost.parentNode&&ghost.parentNode.removeChild(ghost);b.style.opacity="";}
     if(!moved){sel[key]=(sel[key]===1?2:1);}   // a plain tap = flip to the other side
     else{var tgt=hitCol(colEls[1],e.clientX,e.clientY)?1:(hitCol(colEls[2],e.clientX,e.clientY)?2:null);if(tgt)sel[key]=tgt;}   // dropped over a column = that side
     syncGlobal();applyPreview();renderTray();}
    document.addEventListener("pointermove",mv);document.addEventListener("pointerup",up);});
   return b;}
  function mjChip(){var b=document.createElement("button");b.className="teamChip "+(sel[9001]===1?"red":"blue");b.type="button";b.title="Mini-Jayden — joins when the sides are uneven";b.setAttribute("aria-label","Mini-Jayden, switch his side");
   var im=document.createElement("img");im.src="images/smile.webp";im.alt="";b.appendChild(im);   // the grinning mini-Jayden
   return bindChip(b,9001);}
  function chip(h,slot){var b=document.createElement("button");b.className="teamChip "+(sel[slot]===1?"red":"blue");b.type="button";b.setAttribute("aria-label","Switch this head to the other team");
   var im=document.createElement("img");im.src=h.cut;im.alt="";b.appendChild(im);
   return bindChip(b,slot);}
  function renderTray(){if(!tray){tray=document.createElement("div");tray.className="teamTray";tray.setAttribute("role","dialog");tray.setAttribute("aria-label","Choose soccer teams");tray.addEventListener("click",function(e){e.stopPropagation();});document.body.appendChild(tray);}
   var hs=heads(),n=hs.length;tray.innerHTML="";
   var hd=document.createElement("div");hd.className="teamTrayHead";
   var ti=document.createElement("span");ti.className="teamTrayTitle";ti.textContent=(mode==="lava"?"Lava teams":"Soccer teams");hd.appendChild(ti);
   var hb=document.createElement("div");hb.style.cssText="display:flex;gap:8px";
   var shuf=document.createElement("button");shuf.className="teamMini";shuf.type="button";shuf.setAttribute("aria-label","Shuffle teams");shuf.title="Shuffle";shuf.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>';
   shuf.addEventListener("click",function(ev){ev.stopPropagation();var a=shuffle(balanced(n));sel={};a.forEach(function(t,i){sel[i]=t;});sel[9001]=(Math.random()<0.5?1:2);syncGlobal();applyPreview();renderTray();});
   var cl=document.createElement("button");cl.className="teamMini";cl.type="button";cl.setAttribute("aria-label","Close");cl.innerHTML="&times;";
   cl.addEventListener("click",function(ev){ev.stopPropagation();closeTray();});
   hb.appendChild(shuf);hb.appendChild(cl);hd.appendChild(hb);tray.appendChild(hd);
   var cols=document.createElement("div");cols.className="teamTrayCols";colEls={};
   [1,2].forEach(function(tm){var col=document.createElement("div");col.className="teamCol "+(tm===1?"red":"blue");colEls[tm]=col;
    var ch=document.createElement("div");ch.className="teamColHdr";ch.textContent=tm===1?"Red":"Blue";col.appendChild(ch);
    var cc=document.createElement("div");cc.className="teamChips";for(var i=0;i<n;i++){if(sel[i]===tm)cc.appendChild(chip(hs[i],i));}
    if(sel[9001]===tm)cc.appendChild(mjChip());col.appendChild(cc);cols.appendChild(col);});
   tray.appendChild(cols);
   var ft=document.createElement("div");ft.className="teamTrayFoot";
   var start=document.createElement("button");start.className="teamStart";start.type="button";start.textContent=(mode==="lava"?"Start Floor is Lava":"Start match");
   start.addEventListener("click",function(ev){ev.stopPropagation();startWithTeams();});ft.appendChild(start);
   var hint=document.createElement("div");hint.className="teamHint";hint.textContent=(mode==="lava"?"Teammates spare each other — until they're the last team":"Tap a head to switch its side");ft.appendChild(hint);
   tray.appendChild(ft);}
  function openTray(m){if(gameOn())return;mode=(m==="lava")?"lava":"soccer";activeTrig=(mode==="lava"&&lavaBtn)?lavaBtn:teamsBtn;ensureSel();open=true;syncGlobal();applyPreview();renderTray();tray.classList.add("open");activeTrig.setAttribute("aria-expanded","true");setTimeout(function(){document.addEventListener("click",outside,true);},0);}
  function closeTray(){open=false;if(tray)tray.classList.remove("open");applyPreview();if(teamsBtn)teamsBtn.setAttribute("aria-expanded","false");if(lavaBtn)lavaBtn.setAttribute("aria-expanded","false");document.removeEventListener("click",outside,true);}
  function outside(e){if(tray&&!tray.contains(e.target)&&e.target!==teamsBtn&&!teamsBtn.contains(e.target)&&e.target!==lavaBtn&&(!lavaBtn||!lavaBtn.contains(e.target)))closeTray();}
  function startWithTeams(){syncGlobal();open=false;window.__hmTeamPreview=null;if(tray)tray.classList.remove("open");document.removeEventListener("click",outside,true);
   var rc=heads().length;if(rc<1||gameOn())return;
   if(rc%2===1&&window.__hmFillerAdd)window.__hmFillerAdd();
   if(mode==="lava"){window.__hmLavaTeams=true;window.__hmBattleReq=performance.now();document.body.classList.add("hmBattle");if(window.__hmNewArena)window.__hmNewArena();}   // Floor is Lava, but in fixed teams
   else{window.__hmLavaTeams=false;try{if(window.__hmSoccerStart)window.__hmSoccerStart();}catch(_){}}
   closeMenuBar();battleGate();}
  teamsBtn.setAttribute("aria-expanded","false");if(lavaBtn)lavaBtn.setAttribute("aria-expanded","false");
  teamsBtn.addEventListener("click",function(e){e.stopPropagation();if(open&&mode==="soccer")closeTray();else{if(open)closeTray();openTray("soccer");}});
  if(lavaBtn)lavaBtn.addEventListener("click",function(e){e.stopPropagation();if(open&&mode==="lava")closeTray();else{if(open)closeTray();openTray("lava");}});
 })();
})();
