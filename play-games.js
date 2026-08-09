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
 /* THE HUB'S ONE PIECE OF SHARED STATE. The team screen is built inside the nested
    picker IIFE at the foot of this file, but battleGate() -- declared above it -- has to
    know whether that screen is up, because the hub's four cards and the team screen are
    two surfaces competing for the same corner of the viewport and exactly one of them may
    be visible. A plain var in this outer scope is the whole mechanism; hoisting is what
    makes the forward reference legal. */
 var teamOpen=false;
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
 // Open/close glue for the hidden game launcher remains behavior-only. The visible portrait
 // mood menu is owned by hero-engine.js and uses separate canonical IDs. Minimal
 // version only: click-to-toggle, outside-click-to-close, Escape-to-close. No hover-intent, no
 // mobile edge-clamping, no chevron-rotation choreography -- home's menu carries four mood rows
 // plus a saved-heads grid and can run off the top of a short phone screen; this one is three
 // rows and sits in a fixed top-right corner with room to open downward, so the fancier
 // clamping home needs was solving a problem this menu doesn't have.
 (function(){
  var bar=document.getElementById("gamebar");if(!bar)return;
  var btn=document.getElementById("gameBtn");
  function closeM(){bar.classList.remove("open");if(btn)btn.setAttribute("aria-expanded","false");}
  function openM(){bar.classList.add("open");if(btn)btn.setAttribute("aria-expanded","true");}
  if(btn)btn.addEventListener("click",function(e){e.stopPropagation();
   if(document.body.classList.contains("hmTour")){closeM();return;}   // tournament disables gameBtn -- honor that here too
   bar.classList.contains("open")?closeM():openM();});
  document.addEventListener("click",function(e){if(bar.classList.contains("open")&&!bar.contains(e.target))closeM();});
  addEventListener("keydown",function(e){if(e.key==="Escape"&&bar.classList.contains("open"))closeM();});
 })();

 function gameCount(){return Math.max(readAll().length,(window.__hmLive||[]).length);}
 function gameOn(){if(window.__hmTour&&window.__hmTour.live)return true;return document.body.classList.contains("hmBattle")||document.body.classList.contains("hmSoccer")||document.body.classList.contains("hmRace");}
 var _bgLast="";
 function battleGate(){var n=gameCount(),on=gameOn();
  var few=n<1;                                  // ONE head count per tick -- this used to be six readAll() calls
  // n and teamOpen joined the signature when the hub landed: the hub's Create-head card
  // shows the actual crowd, so a head added in another tab has to repaint it, and the hub
  // has to yield the moment the team screen opens. Both are state the old two-bit
  // signature could not see, and a signature that cannot see a change never repaints.
  var sig=(on?1:0)+"|"+(few?1:0)+"|"+n+"|"+(teamOpen?1:0);
  if(sig===_bgLast)return;                      // nothing changed since last tick: no DOM writes at all
  _bgLast=sig;
  syncHub(on,few);
  ["battleGo","soccerGo","raceGo","tourGo"].forEach(function(id){var bi=document.getElementById(id);if(!bi)return;
   if(on){bi.style.display="none";}   // a game is running: only End game belongs here
   else{bi.style.display="flex";bi.style.opacity=few?"0.38":"";bi.style.pointerEvents=few?"none":"";bi.setAttribute("aria-disabled",few?"true":"false");}});   // even one head can play now -- mini-Jayden makes the second
  ["soccerTeams","lavaTeams"].forEach(function(tid){var tb=document.getElementById(tid);if(tb){if(on){tb.style.display="none";}else{tb.style.display="";tb.style.opacity=few?"0.38":"";tb.style.pointerEvents=few?"none":"";}}});   // the team-picker icons ride with the Soccer + Floor-is-Lava rows
  var offNow=on;[].forEach.call(document.querySelectorAll(".gameMenu .moodItem[data-mood], #addPlaceholder, .gameMenu .moodGo"),function(el){
   if(offNow)el.setAttribute("aria-disabled","true");else el.removeAttribute("aria-disabled");});   // the dim is CSS; this is what a screen reader hears
  var eg=document.getElementById("endGame");if(eg)eg.style.display="none";   // End now lives on the scoreboard, not the menu
  syncMoodSeps();}
 /* ---- A .moodSep is a rule BETWEEN two groups, so it only earns its pixel when there is
    something visible on BOTH sides of it. play.html's menu carries no .moodSep today (no mood
    dots, no "Add an egghead" group to separate from), so this is a no-op here -- kept verbatim
    so a later pass that adds dividers back gets the behavior for free. ---- */
 function syncMoodSeps(){
  var mm=document.getElementById("gameMenu");if(!mm)return;
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

 /* ---- THE HUB. play.html's resting state: a title block and four cards, shown exactly
    when no game is running and no sub-surface is up. It is a SECOND object, not a rebuild
    of the hidden game launcher -- #gameBtn/#gamebar keep their ids and handlers because the
    tournament disables and restores that button by id (play-tournament.js:1163,1183), and
    every card below fires the same launcher the menu row fired. The corner bar is only
    hidden (play.html's own style block), never rewired.

    The gate is the SAME gate: `on` and `few` come straight out of battleGate, so a card
    can never offer a game the menu would have refused, and there is no second definition
    of "can you play yet" to drift. ---- */
 var _hubWas=null;
 function syncHub(on,few){
  var hub=document.getElementById("games");if(!hub)return;
  // A game starting is the one thing that can outrank the team screen: the tournament and
  // the corner launchers can both begin a match without going through startWithTeams(), and
  // a picker left floating over a live pitch is a stuck screen with no way out (its Back
  // returns to a hub that is itself hidden). Whoever starts a game wins the stage.
  if(on&&teamOpen&&window.__hmTeamScreen){try{window.__hmTeamScreen.close();}catch(_){}}
  /* The bar no longer needs a surface swap: the page is paper in every state now, so
     data-surface="paper" is simply what the markup says and never changes. The toggle that
     lived here existed only to undo the dark lobby. */
  var want=!on&&!teamOpen;
  document.body.classList.toggle("pHubOn",want);
  /* .pHubOn changes .hero's height on phones (play.html's style block), and the engine
     derives its whole floor plane from hero.clientHeight -- it re-runs survey() on `resize`
     and on nothing else (play-engine.js:434). So a class that moves the stage has to say
     so, or the heads keep standing on the old floor line until the next real resize. Only
     on an actual change, and only after layout has settled. */
  if(_hubWas!==want){_hubWas=want;
   requestAnimationFrame(function(){try{dispatchEvent(new Event("resize"));}catch(_){}});}
  // aria-hidden as well as the CSS fade: a visibility:hidden subtree is already out of the
  // a11y tree, but the fade holds visibility for 360ms and a screen reader must not read a
  // menu that is on its way out.
  hub.setAttribute("aria-hidden",(!on&&!teamOpen)?"false":"true");
  /* THE TOURNAMENT IS NOT GATED ON THE ROSTER, and that was the "unplayable" bug.
     Reproduced at 390 with hmCompanions cleared: aria-disabled="true", pointer-events:none,
     opacity .38 -- the card was faded and genuinely unclickable, which is exactly "I can't
     click the button to start it". Nothing else was wrong: elementFromPoint landed inside
     the card, __hmTourStart was a function, __hmTour.live was false, and the launcher fires.
     The gate itself is correct and stays; what was wrong is that Tournament was ever behind
     it. It was inherited from battleGate's `few`, which dims every launcher together, but a
     cup does not use the visitor's heads -- buildTeams() (play-tournament.js:476) sets
     canEgg from __hmTint + __EGGHEAD, both of which this page always loads, and then fields
     all twelve teams from dyed eggheads with zero saved heads. So on a first visit, the one
     door that works with an empty planet was the only one closed.
     Expedition still gates: it is a match between the visitor's own heads and there must be
     at least one. (The engine's own launchers keep battleGate's original behaviour -- this
     is the hub's gate, and the hub is where a first-time visitor actually lands.) */
  var ex=document.getElementById("pcExped");
  if(ex)ex.setAttribute("aria-disabled",few?"true":"false");
  var tr=document.getElementById("pcTour");
  if(tr)tr.setAttribute("aria-disabled","false");
  }
 /* ---- THE CROWD STRIP IS GONE, THE CAPABILITY IS NOT.
    It rendered a row of head thumbnails with a per-head remove and an "Add an egghead"
    button above the planet. Jayden removed it: "no stupid hero header that looks bad with
    random head PNGs floating -- the heads are clearly visible below." That is the right
    call -- the planet and the crowd on it already say who is here, and the strip was a
    second, weaker version of the same statement.
    What survives is the two operations, exposed rather than drawn, so the head-level delete
    pattern being designed for the home dropdown and the maker can drive them when it lands
    (one pattern, not a fourth variant):
        window.__hmAddEgghead()      -> dye a fresh egg, store it, spawn it on the planet
        window.__hmRemoveHead(cut)   -> drop that head from storage AND from the scene
    Both keep the three-step contract the home page uses: write hmCompanions, keep
    hmCompanion pointing at something real, then tell the LIVE engine (__hmSpawnOne /
    __hmKill). Skipping the third step is what makes a roster control feel broken -- the
    storage and the planet disagree until a reload. ---- */
 function writeRoster(arr){
  try{localStorage.setItem("hmCompanions",JSON.stringify(arr));_hcVer++;
   if(arr.length)localStorage.setItem("hmCompanion",JSON.stringify(arr[arr.length-1]));
   else localStorage.removeItem("hmCompanion");}catch(_){}
  _bgLast="";battleGate();}   // clear the gate's signature so the next tick repaints, not 400ms later
 window.__hmRemoveHead=function(cut){
  var cur=readAll(),i;
  for(i=0;i<cur.length;i++){if(cur[i].cut===cut){cur.splice(i,1);break;}}
  writeRoster(cur);
  try{if(window.__hmKill)window.__hmKill(cut);}catch(_){}};
 /* The egg, dyed a fresh colour each time. Ported from index.html:1654 with one
    simplification: play.html already loads egghead-seed.js as a <script src>, so
    window.__EGGHEAD is there synchronously and the lazy-fetch dance home needs is gone.
    multiply keeps every fold of the egg's own shading; destination-in clips the flat dye
    back to its silhouette. The imperceptible eye nudge is load-bearing -- readAll()
    de-dupes on marks+eyes as well as on the image, so two eggs with identical geometry
    would collapse into one head. */
 var _eggBag=[];
 var EGG_COLORS=["#E8734A","#E0A32E","#3FA99A","#4E86C7","#8E6FC7","#D45D86","#5FA855","#C9552F","#2E9BB0","#B07CC6"];
 /* The one placeholder's colour. Deliberately NOT drawn from the bag -- see seedPlaceholders. */
 var PLACEHOLDER_COLOR="#3FA99A";
 function nextEggColor(){if(!_eggBag.length){_eggBag=EGG_COLORS.slice();for(var i=_eggBag.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=_eggBag[i];_eggBag[i]=_eggBag[j];_eggBag[j]=t;}}return _eggBag.pop();}
 function tintEgg(cut,color,cb){var img=new Image();
  img.onload=function(){try{
   var w=img.naturalWidth||500,h=img.naturalHeight||600,c=document.createElement("canvas");c.width=w;c.height=h;var g=c.getContext("2d");
   g.drawImage(img,0,0,w,h);
   g.globalCompositeOperation="multiply";g.fillStyle=color;g.fillRect(0,0,w,h);
   g.globalCompositeOperation="destination-in";g.drawImage(img,0,0,w,h);
   g.globalCompositeOperation="source-over";
   var out=c.toDataURL("image/webp",0.9);if(out.indexOf("data:image/webp")!==0)out=c.toDataURL("image/png");
   cb(out);}catch(_){cb(cut);}};
  img.onerror=function(){cb(cut);};img.src=cut;}

 /* ---- THE PLANET IS NEVER EMPTY ON A FIRST VISIT.
    Jayden: "make it so placeholder eggheads are already in the play screen on first load,
    so the page doesn't look too confusing." An empty planet under four cards does not
    explain itself -- and it is the same first-visit state that made the tournament look
    broken (the page looked empty AND its one working door was disabled). A crowd on arrival
    fixes both: you can see what a head IS before being asked to add one.

    THEY ARE SCENERY, NOT A ROSTER, and that distinction is the whole design:

    1. NOTHING IS WRITTEN TO localStorage. writeRoster() is not called; the eggs live in
       _ph[] for the life of the page and are gone on reload. If they persisted, a visitor
       who later cut out their own face would find it standing among strangers they never
       added, and "remove head" would start deleting things they did not create.
    2. THEY YIELD ENTIRELY, NOT PARTIALLY. If readAll() finds even one saved head, no
       placeholder spawns at all. Topping up to a minimum was the alternative and it is
       worse: it mixes the visitor's own face with anonymous eggs and there is no honest
       label for the difference. One real head means the planet is already about them.
    3. ONE SPAWN PATH. This calls the same tintEgg() + __hmSpawnOne() that
       __hmAddEgghead uses and the tournament's twelve dyed captains use -- no second
       spawn route to keep in sync. That also means they inherit whatever the engine does
       with lobby heads: when the by-angle placement on the sphere lands, these are placed
       by it for free, because they are ordinary heads to everything downstream.
    4. SLOTS 0..N-1. Storage is empty whenever this runs, so the placeholders own the low
       slots with nothing to collide with -- which keeps index === slot true for the team
       picker (see heads() below) and lets __hmTeamSel key off them unchanged.

    HOW MANY: ONE. It was five, and five was measured for the job of looking like a crowd
    (a head is 108px wide at 1280, so five spanned 540px; four looked thin, six touched at
    390). Jayden, after weighing hiding them altogether: "keep it on at default -- but can
    we only show one coloured egghead, not all of them."
    ONE IS THE ANSWER TO TWO REQUIREMENTS THAT LOOKED INCOMPATIBLE. The placeholders exist
    so a first visit does not look empty and broken; the reveal exists so a visitor who
    cuts out their own face meets a crowd they helped make. Five satisfied the first and
    spent the second -- the whole cast was on stage before you had done anything. One says
    SOMETHING LIVES HERE without showing the company: it is a hint, not a crowd, and the
    surprise survives.
    WHERE IT STANDS IS NOT LEFT TO CHANCE. At n=5 the row read as a group wherever it
    landed; at n=1 a lone head in a bad spot reads as a bug. play-engine.js:978 already
    branches on exactly this -- `bootTotal===1` centres the head on the arena's own axis
    instead of distributing it along the boot span -- so the single egghead stands dead
    centre at the foot of the field, on the same vertical axis as the portrait above it and
    as the headline above that. It is the one placement that reads as composed rather than
    as leftover, and it needs no new geometry: it is the engine's existing single-head case,
    which until now nothing ever reached.
    ITS COLOUR IS CHOSEN, NOT DEALT. nextEggColor() draws from a shuffled bag, which is
    right when the palette itself is the statement and wrong when one head IS the whole
    first impression of the head system. #3FA99A is picked for three measured reasons:
    its relative luminance is 0.31, so it holds its value on both grounds (3.0:1 on
    --c50 paper, 7.0:1 on the night page) where the bag's #E0A32E burns on paper and its
    #4E86C7 sinks at night; it is far from BOTH team channels (--tc1 224,90,78 and --tc2
    90,160,216), so a lone head cannot be misread as already picked for a side; and it is
    far from the violet the dark theme owns (--theme-focus / --theme-atmosphere), so it
    cannot be misread as selected either. The bag is untouched and still runs every other
    spawn path. ---- */
 var _ph=[],_phTries=0,_bootWait=0,_bootFallback=0,_bootWatch=0;
 /* Play's arena is hidden only until every initial head has both reached the engine's seated
    state and decoded its cutout. A saved data URL can be long enough to pass the storage filter
    and still be undecodable, so an image error (or a bounded four-second wait) removes only the
    failed saved heads and lets the fallback crowd take their place. The second deadline is the
    final safety valve: even a broken bundled fallback may never strand the whole page hidden. */
 function showPlay(){if(_bootWatch){clearTimeout(_bootWatch);_bootWatch=0;}try{if(window.__hmLobbyThrowIn)window.__hmLobbyThrowIn();}catch(_){}requestAnimationFrame(function(){document.body.classList.remove("playBooting");document.body.setAttribute("data-play-ready","true");});}
 function watchPlayBoot(){if(!_bootWatch)_bootWatch=setTimeout(showPlay,8000);}
 function recoverPlayBoot(nodes,expected){
  if(_bootFallback){showPlay();return;}
  _bootFallback=1;
  var roster=readAll(),keep=[],i,img;
  for(i=0;i<roster.length;i++){
   img=nodes[i]&&nodes[i].querySelector("img");
   if(i<expected&&img&&img.naturalWidth)keep.push(roster[i]);
   else try{if(window.__hmKill)window.__hmKill(roster[i].cut);}catch(_){}}
  writeRoster(keep);_bootWait=0;
  if(keep.length)releasePlayBoot(keep.length);else seedPlaceholders();}
 function releasePlayBoot(expected){
  if(_bootWait||!document.body.classList.contains("playBooting")||expected<1)return;
  _bootWait=1;var deadline=performance.now()+4000;
  (function ready(){
   var nodes=[].slice.call(document.querySelectorAll("#playArena [data-hm-boot-ready]"));
   var initial=nodes.slice(0,expected);
   var settled=initial.length>=expected&&initial.every(function(node){var img=node.querySelector("img");return !!(img&&img.complete);});
   var broken=initial.some(function(node){var img=node.querySelector("img");return !!(img&&img.complete&&!img.naturalWidth);});
   if((settled&&broken)||performance.now()>=deadline){recoverPlayBoot(nodes,expected);return;}
   var painted=initial.length>=expected&&initial.every(function(node){var img=node.querySelector("img");return !!(img&&img.complete&&img.naturalWidth);});
   if(!painted){requestAnimationFrame(ready);return;}
   showPlay();
  })();}
 function seedPlaceholders(){
  if(readAll().length)return;                       // the visitor has heads of their own: theirs, not these
  if(_ph.length)return;                             // idempotent -- battleGate ticks every 400ms
  var EGG=window.__EGGHEAD;if(!EGG||!EGG.cut)return;
  /* The engine exports the empty-roster spawn API before this script runs. Keep the bounded
     retry as a defensive load-order guard, but never write scenery into localStorage. */
  if(!window.__hmSpawnOne){if(_phTries++<40)setTimeout(seedPlaceholders,120);return;}
  /* ONE, unless a harness says otherwise. __hmPlaceholderCount exists because the
     placeholder crowd stopped being big enough to test MATCH physics with the moment it
     became one head: tools/play-browser-smoke.py's contact assertions read
     `#playArena [data-hm-boot-ready]`, which only boot-seated heads carry, so they cannot
     be satisfied by adding heads after load -- and a one-player match never settles into
     the "play" phase at all, because there is nobody to stop the first goal. It is a
     number, not a behaviour switch: nothing downstream branches on it, and unset means 1. */
  var N=(window.__hmPlaceholderCount|0)||1,i;
  for(i=0;i<N;i++)(function(slot){
   tintEgg(EGG.cut,PLACEHOLDER_COLOR,function(cut){
    var eyes=(EGG.eyes||[]).map(function(e){var o={};for(var k in e)o[k]=e[k];return o;});
    // the same imperceptible nudge __hmAddEgghead uses: readAll()-style de-dupe keys on
    // marks+eyes as well as the image, so distinct placeholders stay distinct. Harmless
    // at N=1 and correct again the moment N is ever raised.
    if(eyes[0])eyes[0].x+=(slot+1)*0.0004;
    var data={cut:cut,eyes:eyes,marks:EGG.marks,slot:slot,__ph:1,__bootSeated:1,__bootTotal:N};
    _ph[slot]=data;
    try{window.__hmSpawnOne(data,slot);}catch(_){}
    _bgLast="";battleGate();                        // the crowd changed the head count: re-gate now, not in 400ms
    if(_ph.filter(Boolean).length===N)releasePlayBoot(N);
   });})(i);}
 /* The moment a real head arrives, the scenery leaves -- storage and the planet must never
    disagree about who is standing there. */
 function clearPlaceholders(){
  if(!_ph.length)return;
  _ph.forEach(function(d){if(d)try{if(window.__hmKill)window.__hmKill(d.cut);}catch(_){}});
  _ph=[];}
 window.__hmPlaceholders=function(){return _ph.filter(Boolean);};

 window.__hmAddEgghead=function(){
  var EGG=window.__EGGHEAD;if(!EGG||!EGG.cut)return;
  if(readAll().length>=8)return;                      // the planet caps at eight, like the saved heads
  tintEgg(EGG.cut,nextEggColor(),function(cut){
   var eyes=(EGG.eyes||[]).map(function(e){var o={};for(var k in e)o[k]=e[k];return o;});
   if(eyes[0])eyes[0].x+=(Math.random()-0.5)*0.0007;
   var data={cut:cut,eyes:eyes,marks:EGG.marks};
   clearPlaceholders();                             // a real head has arrived: the scenery steps aside
   var arr=readAll();arr.push(data);writeRoster(arr);
   try{if(window.__hmSpawnOne)window.__hmSpawnOne(data,arr.length-1);}catch(_){}});};

 battleGate();setInterval(battleGate,400);
 watchPlayBoot();
 var _savedAtBoot=readAll().length;if(_savedAtBoot)releasePlayBoot(_savedAtBoot);
 seedPlaceholders();
 /* THE 400ms POLL IS TOO SLOW FOR A GROUND SWAP. Everything the gate used to drive was a
    dim or a hide, where a late tick is invisible. The page's ground and the header's
    material are not: body's game class flips the background instantly in CSS, so a gate
    that catches up a third of a second later leaves a light bar sitting on a dark page --
    and the same lag shows up on every path that ends a match without going through this
    file (the scoreboard's own End button, a tournament fixture finishing, an early exit).
    Watching the attribute that IS the state removes the whole class of bug rather than
    shortening the interval. The poll stays as the backstop for everything else.
    No feedback loop: syncHub writes body classes too, but battleGate's signature guard
    makes the re-entrant call a no-op the moment nothing has actually changed. */
 try{new MutationObserver(function(){battleGate();})
  .observe(document.body,{attributes:true,attributeFilter:["class"]});}catch(_){}
 function closeMenuBar(){var mb=document.getElementById("gamebar");if(mb)mb.classList.remove("open");var mbt=document.getElementById("gameBtn");if(mbt)mbt.setAttribute("aria-expanded","false");}
 var bg=document.getElementById("battleGo");
 if(bg)bg.addEventListener("click",function(){
  var rc=readAll().length;if(rc<1||gameOn())return;
  window.__hmLavaTeams=false;   // the plain button is a solo free-for-all (teams are the opt-in via the teams icon)
  if(rc%2===1&&window.__hmFillerAdd)window.__hmFillerAdd();   // odd sides -> mini-Jayden steps in
  window.__hmCrowd=rc+(rc%2===1?1:0);   // seed the crowd size NOW so the lava's first rise is tuned to the real player count (not a stale/default value)
  if(window.PlayViewportOwner)window.PlayViewportOwner.enter("battle");window.__hmBattleReq=performance.now();document.body.classList.add("hmBattle");
  if(window.__hmNewArena)window.__hmNewArena();   // lay the random arena BEFORE the heads scatter onto it
  closeMenuBar();battleGate();});
 var sg=document.getElementById("soccerGo");
 if(sg)sg.addEventListener("click",function(){
  var rc=gameCount();if(rc<1||gameOn())return;
  if(rc%2===1&&window.__hmFillerAdd)window.__hmFillerAdd();   // add BEFORE kickoff so the teams count him
  try{if(window.__hmSoccerStart)window.__hmSoccerStart();}catch(_){}closeMenuBar();battleGate();});
 var tg=document.getElementById("tourGo");
 function startTour(){if(gameOn())return;
  try{if(window.__hmTourStart)window.__hmTourStart();}catch(_){}closeMenuBar();battleGate();}   // the tournament builds its own squads, so no mini-Jayden top-up here
 if(tg)tg.addEventListener("click",startTour);
 var pcT=document.getElementById("pcTour");if(pcT)pcT.addEventListener("click",startTour);   // the hub card and the menu row are ONE launcher, not two copies of one

 /* ---- THE HOVER PREVIEWS LOAD ON DEMAND, AND ONLY PROVE THEMSELVES ON LOAD.
    Jayden asked for screenshots of the inside of each screen on hover. The panel, its geometry
    and its motion are in play.html; this is the only behaviour it needs, and it is deliberately
    the smallest amount that makes the feature safe:

    1. NOTHING IS DOWNLOADED UNTIL A CARD IS ASKED ABOUT. The <img> ships with no src at all --
       not a lazy src, none -- so a visitor who never hovers pays nothing, and the four previews
       can never compete with the engine for bandwidth during the first seconds of the page, which
       is exactly when the heads are spawning. pointerenter rather than mouseenter so a pen
       counts; focus so the keyboard gets the same reveal the mouse does. `once` on both, because
       after the first hover the browser's own cache is the right mechanism and a listener that
       has done its job should not stay bound.
    2. .ready IS ADDED ON THE IMAGE'S OWN LOAD EVENT, never optimistically. This is the whole
       reason it is safe to ship the mechanism before every screenshot exists: with the file
       missing the load event never fires, .ready is never added, the CSS rule never matches, and
       the card behaves precisely as it did before this existed. No empty white rectangle over the
       crowd, no broken-image glyph, no layout reserved for nothing.
    3. NO img.decode(), AND THAT IS A MEASURED DECISION RATHER THAN A SIMPLIFICATION. Decoding
       before revealing is the textbook way to avoid fading in a half-painted image, and it was
       written that way first. In this exact position it HANGS: .pCardPrev is visibility:hidden
       until the card is hovered, and a decode() requested for an image inside a subtree that is
       never painted has nothing to schedule against, so the promise neither resolves nor rejects.
       Verified in the browser -- the call sat unsettled until the probe timed out at 30s, .ready
       was never added, and the previews were silently dead while every other signal (src set,
       complete true, naturalWidth 640) said the image was perfectly fine. That is the worst
       shape a bug can take, so: `load` is the signal. It already guarantees the bytes are whole,
       and the 240ms fade is far more time than the raster needs.

    OUTSTANDING: images/preview/*.webp DO NOT EXIST YET, and that is on purpose rather than an
    oversight. Three of the four screens (tournament, headmaker, gradientlab) are being rebuilt
    right now by other passes, so any capture taken today is wrong within hours -- shipping stale
    pictures of screens that no longer look like that is worse than shipping none, because a
    preview that lies is worse than no preview. The contract for whoever captures them:
        images/preview/match.webp  tournament.webp  headmaker.webp  gradientlab.webp
        640x400 (16:10, 2x the 311px the panel occupies at 1440), WebP q72.
        Budget ~25-40 KB each. Nothing here may approach images/earth-map-src.jpg's 2.51 MB.
    Drop the four files in and the previews turn on with no code change anywhere. ---- */
 [].forEach.call(document.querySelectorAll(".pCard .pCardPrev img[data-prev]"),function(img){
  var panel=img.parentNode,card=panel.parentNode,armed=false;
  function load(){if(armed)return;armed=true;
   img.addEventListener("load",function(){panel.classList.add("ready");},{once:true});
   img.src=img.getAttribute("data-prev");}
  card.addEventListener("pointerenter",load,{once:true});
  card.addEventListener("focus",load,{once:true});});
 var rg=document.getElementById("raceGo");
 if(rg)rg.addEventListener("click",function(){
  var rc=readAll().length;if(rc<1||gameOn())return;
  var _dly=0;if(rc%2===1&&window.__hmFillerAdd){window.__hmFillerAdd();_dly=500;}   // odd field -> the mini-Jayden lines up... and the grid WAITS the half-beat his spawn needs, or he'd race as a ghost
  setTimeout(function(){try{if(window.__hmRaceStart)window.__hmRaceStart();}catch(_){}},_dly);closeMenuBar();battleGate();});
 // End game retired from the menu -- it lives on each game's own scoreboard, beside the thing it controls

 var bar=document.getElementById("gamebar");if(bar)bar.addEventListener("click",function(){setTimeout(function(){battleGate();},60);});

 // --- THE TEAM SCREEN: pick sides in one tap; heads preview their team colour live ---
 /* PROMOTED, NOT REDESIGNED. This was a 300px popover pinned to the bottom-right corner.
    The interaction model was already right and already tested -- tap a chip to flip its
    side, drag it onto the other column, shuffle for a random split, mini-Jayden joins when
    the sides are uneven -- so none of that changed. What changed is scale and framing: it
    now fills the foot of the stage as a real pre-match screen, the two sides are named
    columns with live counts, shuffle is a control with a visible verb instead of a 28px
    icon, and Start is the one primary action on the page.
    It is deliberately NOT a modal over black. The reason to promote it is that this is the
    moment before a match, so the planet stays lit and the heads stay on it -- and because
    every chip flip already pushes __hmTeamPreview, the heads behind the panel change colour
    as you pick. That anticipation beat is the whole point and it cost nothing new.
    THE CSS MOVED TO play.html's style block, where the rest of the hub's rules live (see
    the header on that block for why it is not in play.css this pass). What is left here is
    the hidden game launcher's own two rules: #gamebar is display:none on play.html, but the
    element and its ids stay in the DOM for the tournament, so its styling stays with it. */
 (function(){
  var teamsBtn=document.getElementById("soccerTeams");if(!teamsBtn)return;
  var lavaBtn=document.getElementById("lavaTeams");   // the Floor-is-Lava teams icon opens the SAME screen in lava mode -- play.html has no lavaTeams button, so this stays null and every `if(lavaBtn)` guard below already no-ops
  var host=document.getElementById("pTeam");
  var tray=null,sel={},open=false,mode="soccer",activeTrig=teamsBtn;
  /* EDIT MODE -- the index/About pattern (f897489), rehoused. `editing` is the mode,
     `undo` holds the one head most recently removed so its chip slot can offer it back. */
  var editing=false,undo=null,undoT=0;
  var TRASH='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/></svg>';
  function realHeads(){return readAll();}   // storage only: placeholders are never editable
  /* The head leaves storage on the press and undo puts it back -- not a delete that waits
     on a timer, which is the version that loses work if the tab closes mid-countdown. */
  function removeAt(idx){
   var cur=readAll(),gone=cur.splice(idx,1)[0];if(!gone)return;
   var team=sel[idx]===2?2:1;
   writeRoster(cur);
   try{if(window.__hmKill)window.__hmKill(gone.cut);}catch(_){}
   clearTimeout(undoT);undo={head:gone,idx:idx,team:team};
   undoT=setTimeout(function(){undo=null;if(open)renderTray();},8000);
   sel={};ensureSel();syncGlobal();applyPreview();renderTray();}
  function undoRemove(){
   if(!undo)return;clearTimeout(undoT);
   var cur=readAll();cur.splice(Math.min(undo.idx,cur.length),0,undo.head);
   var back=undo;undo=null;
   writeRoster(cur);
   try{if(window.__hmSpawnOne)window.__hmSpawnOne(back.head,Math.min(back.idx,cur.length-1));}catch(_){}
   sel={};ensureSel();syncGlobal();applyPreview();renderTray();}
  var st=document.createElement("style");
  st.textContent=".moodRow{display:flex;align-items:center;gap:var(--sp-8)}.moodRow>#soccerGo{flex:1 1 auto}"
   +".moodTeamsBtn{flex:0 0 auto;align-self:stretch;display:inline-flex;align-items:center;justify-content:center;gap:3px;border:1px solid var(--c100);border-radius:var(--r-2xs);background:var(--c50);cursor:pointer;padding:0 var(--sp-8);transition:border-color var(--hover-out-dur) var(--ease-out),background-color var(--hover-out-dur) var(--ease-out)}"
   +".moodTeamsBtn:hover{border-color:var(--c500)}.moodTeamsBtn .tdotR,.moodTeamsBtn .tdotB{width:8px;height:8px;border-radius:var(--r-full);display:block}.moodTeamsBtn .tdotR{background:rgb(var(--tc1,224,90,78))}.moodTeamsBtn .tdotB{background:rgb(var(--tc2,90,160,216))}";
  document.head.appendChild(st);

  /* THE PICKER PICKS WHO IS ACTUALLY ON THE PLANET, which since the placeholders landed is
     not always the same as who is in storage. Without this the first-visit path was broken
     in a quiet way: battleGate counts __hmLive (5 placeholders) so "Play a match" lit up,
     but startWithTeams() measured readAll() (0) and bailed at `rc<1` -- an enabled card that
     does nothing, which is the same defect class as the tournament gate.
     Storage wins whenever it has anything, so a visitor with saved heads is unaffected and
     hmCompanions order still equals the slot index each head spawned with. The placeholders
     are seeded into slots 0..N-1 against empty storage, so index === slot holds for them
     too, and every sel[] key, the mini-Jayden parity check and __hmTeamSel all keep working
     on indices without knowing which kind of head they are looking at. */
  function heads(){var a=readAll();if(a.length)return a;
   return (window.__hmPlaceholders?window.__hmPlaceholders():[]);}
  function balanced(n){var a=[];for(var i=0;i<n;i++)a.push(i<Math.ceil(n/2)?1:2);return a;}
  function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
  /* WHICH SIDE MINI-JAYDEN JOINS. He only appears on an ODD roster, and the reason he appears at
     all is stated in the line that used to pick for him: "he joins when the sides are uneven". So
     the pick cannot be a coin flip -- with five heads split 3/2 it landed on the long side half the
     time and the tray read RED 4 / BLUE 2, a screen whose entire job is to show a fair split
     showing a 2-player gap. Counting is the whole fix: he takes the short side, and a tie (which an
     odd roster cannot produce, but a mid-tray drag can) falls to red. A tap or a drag still moves
     him -- this only decides where he starts. */
  function shortSide(n){var r=0,b=0;for(var i=0;i<n;i++){if(sel[i]===1)r++;else if(sel[i]===2)b++;}
   return b<r?2:1;}
  function ensureSel(){var n=heads().length,ok=true,i;
   for(i=0;i<n;i++){if(sel[i]!==1&&sel[i]!==2){ok=false;break;}}
   for(var k in sel){if(+k>=n&&+k<9000)delete sel[k];}   // keep the mini-Jayden key (9001)
   var realKeys=0;for(var k2 in sel){if(+k2<9000)realKeys++;}
   if(!ok||realKeys!==n){var prev=window.__hmTeamSel,good=false,mjKeep=sel[9001];
    if(prev){good=true;for(i=0;i<n;i++){if(prev[i]!==1&&prev[i]!==2){good=false;break;}}}
    if(good){sel={};for(i=0;i<n;i++)sel[i]=prev[i];}
    else{var a=balanced(n);sel={};a.forEach(function(t,i2){sel[i2]=t;});}
    if(mjKeep===1||mjKeep===2)sel[9001]=mjKeep;else if(prev&&(prev[9001]===1||prev[9001]===2))sel[9001]=prev[9001];}
   if(sel[9001]!==1&&sel[9001]!==2)sel[9001]=shortSide(n);   // Jayden takes the side that is a player down -- see shortSide()
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
  /* HIS CHIP IS THE HEAD HE FIELDS, not a second picture of him. It was images/smile.webp: a
     different photograph (grinning, where the head that takes the pitch is his resting face) AND a
     different frame (the raw square cutout, with transparent margin all round, so his tile floated
     centred with air on four sides while every egghead beside it filled its tile to the chin).
     Two heads of the same person, side by side, in the row whose whole job is to say who is playing.
     __hmFillerData() is the engine's own source for the head it spawns -- the 5:6 bake, chin seated
     on the shared foot line -- so reading it here makes the tray quote the roster rather than
     illustrate it. Baked ONCE: fillerData() runs a 500x600 getImageData, and renderTray() re-runs on
     every chip tap. smile.webp stays as the fallback for the frame before #face has decoded. */
  var _mjCut=null;
  function mjCut(){if(_mjCut)return _mjCut;
   try{var d=window.__hmFillerData&&window.__hmFillerData();if(d&&d.cut)_mjCut=d.cut;}catch(_){}
   return _mjCut||"images/smile.webp";}
  function mjChip(){var b=document.createElement("button");b.className="teamChip "+(sel[9001]===1?"red":"blue");b.type="button";b.title="Mini-Jayden — joins when the sides are uneven";b.setAttribute("aria-label","Mini-Jayden, switch his side");
   var im=document.createElement("img");im.src=mjCut();im.alt="";b.appendChild(im);
   return bindChip(b,9001);}
  function chip(h,slot){var b=document.createElement("button");b.className="teamChip "+(sel[slot]===1?"red":"blue");b.type="button";b.setAttribute("aria-label","Switch this head to the other team");
   var im=document.createElement("img");im.src=h.cut;im.alt="";b.appendChild(im);
   return bindChip(b,slot);}
  function renderTray(){if(!tray){tray=host||document.body.appendChild(document.createElement("div"));
    if(!host){tray.className="pTeam";tray.setAttribute("role","dialog");tray.setAttribute("aria-label","Choose sides");}
    tray.addEventListener("click",function(e){e.stopPropagation();});}
   var hs=heads(),n=hs.length;tray.innerHTML="";
   var wrap=document.createElement("div");wrap.className="pTeamIn";tray.appendChild(wrap);
   var hd=document.createElement("div");hd.className="pTeamBar";
   /* BACK LEADS. Jayden: "why is the back button on games on the right side? that's a bit
      confusing." He is right and the rule is already the site's own -- on the case studies
      the escape takes the LEADING slot, where the logo otherwise sits. It had been parked
      beside Shuffle purely because both are secondary buttons, which is a grouping argument,
      not a meaning one: leaving and shuffling are opposite kinds of act and the leading slot
      is where a visitor looks to get out. (Checked the header while I was here: play.html's
      bar is logo / Work / About / Play / Contact, with no Back control at all, and the
      envelope on the right is Contact's own icon with its label hidden at narrow widths.
      This button was the only back-looking thing on the page.) */
   var cl=document.createElement("button");cl.className="pBtn pBtnBack";cl.type="button";cl.setAttribute("aria-label","Back to the games menu");
   cl.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M5 12l6 6"/><path d="M5 12l6 -6"/></svg>Back';
   cl.addEventListener("click",function(ev){ev.stopPropagation();closeTray();});
   hd.appendChild(cl);
   var ti=document.createElement("h2");ti.className="pTeamTitle";ti.textContent=(mode==="lava"?"Lava teams":"Pick sides");hd.appendChild(ti);
   var hb=document.createElement("div");hb.className="pTeamActs";
   /* Shuffle earns a verb at this size. Randomising the sides is half the fun of the
      screen and a 15px icon was hiding it (research §1.5). */
   var shuf=document.createElement("button");shuf.className="pBtn";shuf.type="button";shuf.setAttribute("aria-label","Shuffle the sides");
   shuf.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>Shuffle';
   shuf.addEventListener("click",function(ev){ev.stopPropagation();var a=shuffle(balanced(n));sel={};a.forEach(function(t,i){sel[i]=t;});sel[9001]=shortSide(n);syncGlobal();applyPreview();renderTray();});
   /* The toggle is hidden outright when the picker is showing placeholders: they are not
      in storage, so there is nothing for this mode to act on. */
   if(realHeads().length){
    var ed=document.createElement("button");ed.className="pBtn pTeamEdit";ed.type="button";
    ed.setAttribute("aria-pressed",editing?"true":"false");
    ed.textContent=editing?"Done":"Edit";
    ed.setAttribute("aria-label",editing?"Finish removing heads":"Remove heads");
    ed.addEventListener("click",function(ev){ev.stopPropagation();editing=!editing;
     if(!editing){clearTimeout(undoT);undo=null;}
     renderTray();});
    hb.appendChild(ed);}
   hb.appendChild(shuf);hd.appendChild(hb);wrap.appendChild(hd);
   var cols=document.createElement("div");cols.className="pTeamCols";colEls={};
   cols.setAttribute("data-editing",editing?"true":"false");
   [1,2].forEach(function(tm){var col=document.createElement("div");col.className="pTeamCol "+(tm===1?"red":"blue");colEls[tm]=col;
    var ch=document.createElement("div");ch.className="pTeamColHdr";
    var cn=0,q;for(q=0;q<n;q++)if(sel[q]===tm)cn++;if(n%2===1&&sel[9001]===tm)cn++;
    ch.innerHTML='<span>'+(tm===1?"Red":"Blue")+'</span><span class="pTeamColN">'+cn+'</span>';col.appendChild(ch);
    var cc=document.createElement("div");cc.className="pTeamChips";
    for(var i=0;i<n;i++){if(sel[i]!==tm)continue;
     var ch2=chip(hs[i],i);
     /* The delete is a SIBLING of the chip inside a positioned wrapper, never a child of
        it: .teamChip is a <button>, and a button inside a button is invalid HTML that
        browsers reparent -- the delete would have escaped its tile. This is the same
        .mhItem > .mhPick + .mhX shape index.html uses, for the same reason. */
     var tile=document.createElement("span");tile.className="teamTile";tile.appendChild(ch2);
     if(editing){
      var db=document.createElement("button");db.className="teamDel";db.type="button";
      db.setAttribute("aria-label","Remove head "+(i+1)+" of "+n);
      db.innerHTML=TRASH;
      (function(ix){db.addEventListener("click",function(ev){ev.stopPropagation();ev.preventDefault();removeAt(ix);});})(i);
      tile.appendChild(db);
      ch2.setAttribute("aria-disabled","true");ch2.tabIndex=-1;   // not a visual-only lie
     }
     cc.appendChild(tile);}
    if(undo&&undo.team===tm){var ub=document.createElement("button");ub.className="teamUndo";ub.type="button";
     ub.textContent="Undo";ub.setAttribute("aria-label","Undo removing that head");
     ub.addEventListener("click",function(ev){ev.stopPropagation();undoRemove();});
     cc.appendChild(ub);}
    // Mini-Jayden's chip used to render whenever sel[9001] pointed at this column, regardless of
    // roster size -- but he only actually joins the match when the real roster is ODD (see
    // startWithTeams() below: `if(rc%2===1&&window.__hmFillerAdd)window.__hmFillerAdd()`, using
    // this SAME n = heads().length). So an even roster showed his chip sitting on a team that
    // then took the pitch without him. Gate the chip on the identical parity check the launcher
    // uses -- one source of truth, not a second invented count -- so the tray never promises a
    // player who won't show up. sel[9001] itself is neither set nor cleared here: the value
    // (and ensureSel()'s mjKeep preservation of it across rebuilds) still tracks his side even
    // while hidden, so he returns to the same side, not a random one, the moment the roster goes
    // odd again.
    if(n%2===1&&sel[9001]===tm)cc.appendChild(mjChip());
    col.appendChild(cc);cols.appendChild(col);});
   wrap.appendChild(cols);
   var ft=document.createElement("div");ft.className="pTeamFoot";
   var hint=document.createElement("div");hint.className="pTeamHint";hint.textContent=(mode==="lava"?"Teammates spare each other — until they're the last team":"Tap a head to switch its side, or drag it across");ft.appendChild(hint);
   var start=document.createElement("button");start.className="pBtn pBtnGo";start.type="button";start.textContent=(mode==="lava"?"Start Floor is Lava":"Start match");
   start.addEventListener("click",function(ev){ev.stopPropagation();startWithTeams();});ft.appendChild(start);
   wrap.appendChild(ft);}
  /* THE STAGE MOVES WITH THE SCREEN. body.pTeamOn shrinks and lifts .hero (play.html's
     style block) so the heads rise clear of the panel; the engine derives its entire floor
     plane from hero.clientHeight and re-runs survey() on `resize`
     (play-engine.js:434), so dispatching one synthetic resize is the whole handoff --
     no engine edit, and every head re-lands on one shared floor line. The rAF wait is
     because the class has to have been applied and laid out before the engine measures. */
  function stageShift(on){
   if(on){if(window.PlayViewportOwner)window.PlayViewportOwner.enter("picker");document.body.classList.add("pTeamOn");}
   else{document.body.classList.remove("pTeamOn");if(window.PlayViewportOwner)window.PlayViewportOwner.leave("picker");}
   requestAnimationFrame(function(){try{dispatchEvent(new Event("resize"));}catch(_){}});}
  function openTray(m){if(gameOn())return;mode=(m==="lava")?"lava":"soccer";activeTrig=(mode==="lava"&&lavaBtn)?lavaBtn:teamsBtn;ensureSel();open=true;teamOpen=true;syncGlobal();applyPreview();
   if(host)host.hidden=false;renderTray();
   if(tray&&!host)tray.classList.add("open");
   stageShift(true);battleGate();
   activeTrig.setAttribute("aria-expanded","true");
   var fb=tray&&tray.querySelector(".teamChip, .pBtn");if(fb)try{fb.focus({preventScroll:true});}catch(_){fb.focus();}}
  /* NO outside-click-to-close. That was right for a 300px popover and is wrong for a
     screen: the rest of the viewport is the stage, every head on it is draggable, and one
     stray grab must not throw away the sides you just picked. Back and Escape close it. */
  function closeTray(){open=false;teamOpen=false;editing=false;clearTimeout(undoT);undo=null;if(tray&&!host)tray.classList.remove("open");applyPreview();
   stageShift(false);battleGate();
   if(teamsBtn)teamsBtn.setAttribute("aria-expanded","false");if(lavaBtn)lavaBtn.setAttribute("aria-expanded","false");}
  addEventListener("keydown",function(e){if(e.key==="Escape"&&open)closeTray();});
  function startWithTeams(){syncGlobal();open=false;teamOpen=false;window.__hmTeamPreview=null;if(tray&&!host)tray.classList.remove("open");
   var rc=heads().length;if(rc<1||gameOn()){stageShift(false);battleGate();return;}
   if(window.PlayViewportOwner){
    if(mode==="lava")window.PlayViewportOwner.enter("battle");
    else window.PlayViewportOwner.enter("soccer");
   }
   document.body.classList.remove("pTeamOn");
   if(window.PlayViewportOwner)window.PlayViewportOwner.leave("picker");
   if(rc%2===1&&window.__hmFillerAdd)window.__hmFillerAdd();
   if(mode==="lava"){window.__hmLavaTeams=true;window.__hmBattleReq=performance.now();document.body.classList.add("hmBattle");if(window.__hmNewArena)window.__hmNewArena();}   // Floor is Lava, but in fixed teams
   else{window.__hmLavaTeams=false;try{if(window.__hmSoccerStart)window.__hmSoccerStart();}catch(_){}}
   closeMenuBar();battleGate();}
  teamsBtn.setAttribute("aria-expanded","false");if(lavaBtn)lavaBtn.setAttribute("aria-expanded","false");
  teamsBtn.addEventListener("click",function(e){e.stopPropagation();if(open&&mode==="soccer")closeTray();else{if(open)closeTray();openTray("soccer");}});
  if(lavaBtn)lavaBtn.addEventListener("click",function(e){e.stopPropagation();if(open&&mode==="lava")closeTray();else{if(open)closeTray();openTray("lava");}});
  /* EXPEDITION. Jayden's settled call: it is plain soccer with teams, and the card opens
     the full team screen rather than starting a match behind your back -- the picking IS
     the mode. Same openTray the corner icon calls, so there is one screen, not two.
     (Naming: the codebase calls this mode "Exhibition" in play-engine.js:776 and
     index.html:7704. Not renamed either way this pass -- see the report.) */
  var exp=document.getElementById("pcExped");
  if(exp)exp.addEventListener("click",function(e){e.stopPropagation();if(open)closeTray();else openTray("soccer");});
  window.__hmTeamScreen={open:function(){openTray("soccer");},close:closeTray};
 })();
})();

/* ══════════════════════════════════════════════════════════════════════════════
   SHOW THE CROWD  -- the checkbox at the foot of the mood menu.
   Markup and the full reasoning live in play.html; this is only the latch.
   hero-engine.js owns #moodMenu and dispatches on `e.target.closest(".moodItem")`,
   so a control that is NOT a .moodItem is invisible to it and cannot be mistaken
   for a fifth mood. That is why this file can own the behaviour without forking
   the menu controller.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
 "use strict";
 var KEY="jbPlayCrowd";                       // "0" | "1", and never anything else
 var btn=document.getElementById("moodCrowd");
 if(!btn)return;
 function read(){
  /* Absent means ON. A first visit has no preference, and the page's resting state is
     the crowd visible -- so the default is not stored, it is simply the absence of a
     choice. Only an explicit "0" hides them, which also means a cleared browser or a
     private window lands on the state Jayden asked for rather than on a remembered no. */
  try{return window.localStorage.getItem(KEY)!=="0";}catch(_){return true;}
 }
 function write(on){try{window.localStorage.setItem(KEY,on?"1":"0");}catch(_){}}
 function apply(on){
  document.body.classList.toggle("hmCrowdOff",!on);
  btn.setAttribute("aria-checked",on?"true":"false");
 }
 apply(read());
 btn.addEventListener("click",function(e){
  /* stopPropagation, not preventDefault: hero-engine's outside-click handler closes the
     menu on any click it did not recognise, and a checkbox that closes the surface it
     lives in cannot be used to compare the two states. Ticking it leaves the menu open. */
  e.stopPropagation();
  var next=btn.getAttribute("aria-checked")!=="true";
  write(next);apply(next);
 });
})();

/* ══════════════════════════════════════════════════════════════════════════════
   THE DRAGGABLE MOOD WORD  -- the home page's old headline device, rebuilt here.

   Jayden: "I was thinking we bring back the draggable mood words and recreate the
   h1 on this page, since the Play page kinda turned into what the home page used
   to look like. Make the text actually have that animation, and the buttons."

   HISTORY, because this is a restoration and not an invention. index.html's h1 used
   to end in a live word that cycled between the four moods every 8.5s and could be
   picked up and dropped on Jayden's head to fire that mood. Commit e5bc0dc deleted
   the clause from the HOME page, and the spec that drove it
   (docs/superpowers/specs/2026-08-03-hero-headline.md §7) is explicit that the cut
   was a CLARITY-FOR-RECRUITERS argument -- "the clause was the weakest carrier of
   the site's charm and the strongest tax on its clarity" -- and equally explicit
   about the three things it cost: the moods' only passive announcement, the tug
   that taught the gesture, and the character in the first six seconds. Every one of
   those is a thing the Play page wants and the home page did not. Same device, right
   page. §7 also records "removing the clause removes one entry point, not the
   feature", which is why nothing in hero-engine.js had to change to bring it back.

   IT DOES NOT FORK THE MOOD SYSTEM. A successful drop dispatches a click on the
   REAL .moodItem in #moodMenu, so hero-engine.js runs its own dispatch, its own
   performance and its own queue exactly as it does when you use the menu. There is
   one owner of what a mood means and this is not it.

   THE CAPITALISATION BUG IS DESIGNED OUT, not fixed. The original ghost's text was a
   hardcoded Title Case literal ('Hunger', 'Delight', 'Love', 'Empathy'); when commit
   ee574f0 lowercased the headline's WORDS array it did not touch those five literals,
   so from that day the h1 read "hunger." and the thing in your hand read "Hunger".
   Commit 79add97 added `text-transform:none` to all five ghost rules ten hours later,
   which was a misdiagnosis -- there has never been an uppercase rule anywhere in that
   element's ancestry, so the declaration was inert and the literals are still Title
   Case at HEAD. The ghost below is BUILT FROM THE WORD IT IS LIFTING, so casing,
   punctuation and any future copy change have exactly one source and the whole class
   of bug is gone rather than papered over.
   ══════════════════════════════════════════════════════════════════════════════ */
(function(){
 "use strict";
 var lede=document.getElementById("playLede");
 var slot=lede&&lede.querySelector(".pMoodSlot");
 var line=lede&&lede.querySelector(".pMoodLine");
 var stage=document.getElementById("stage");
 if(!lede||!slot||!line||!stage)return;

 /* The four are named in the SAME ORDER the menu lists them, and each entry carries the
    data-mood the menu keys on plus the glyph class that replaces the word's full stop --
    the same .camDot/.cookieDot/.discoDot/.heartDot artwork the menu items wear, which the
    hero spec (2026-08-05 §66) forbids replacing with newly drawn ones. */
 var MOODS=[
  {word:"empathy.",mood:"empathy",dot:"camDot",   style:"collab"},
  {word:"hunger.", mood:"hunger", dot:"cookieDot",style:"hungry"},
  {word:"delight.",mood:"delight",dot:"discoDot", style:"party"},
  {word:"love.",   mood:"love",   dot:"heartDot", style:"love"}
 ];

 var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
 var CYC_STAG=0.05, DWELL=8500;

 /* THE MOTION LADDER IS READ, NOT RETYPED. Three rungs govern the swap and all three
    already have names in tokens.css; parsing them once at boot costs one style read and
    means a change to the ladder moves this rig with it instead of leaving a literal
    behind. parseFloat("240ms") is 240, so no unit handling is needed.
      --sp-settle-dur   the line's own settle, and the duration --sp-settle is SAMPLED
                        FOR -- tokens.css §6 is explicit that the spring curves are bound
                        to their durations and may not be re-timed (360)
      --dur-state       two jobs, both of them "one state has become another": the point
                        in the exit at which the next word takes over (see cycle()), and
                        the reduced-motion dissolve in both directions (160)
      --sp-bounce-dur   the duration --sp-bounce is SAMPLED FOR, and the only duration it
                        may be run at (§6 again). It is what the dropped letters unwind
                        on, because it is the one curve in the file that OVERSHOOTS
                        enough to see in a rotation -- see settleGlyphs() (860) */
 var CS=getComputedStyle(document.documentElement);
 function ms(name,fallback){var v=parseFloat(CS.getPropertyValue(name));return v>0?v:fallback;}
 var SETTLE_MS=ms("--sp-settle-dur",360), FADE_MS=ms("--dur-state",160),
     BOUNCE_MS=ms("--sp-bounce-dur",860);
 var wi=Math.floor(Math.random()*MOODS.length);
 var cycWord=null,cycTimer=0,cycHold=false,dragging=false,ghost=null,pid=null;
 var tugCount=0,TUG_MAX=3;

 var baseDelay=0;                        // ms of head start the FIRST word gives the static text
 function build(i,defer){
  var m=MOODS[i];
  var w=document.createElement("span");
  w.className="cycw "+m.style;
  w.setAttribute("data-mood",m.mood);
  [].forEach.call(m.word,function(ch,ci){
   var sp=document.createElement("span");
   var isDot=(ch===".");
   sp.className="cyc-ch"+(isDot?" "+m.dot:"")+(defer?"":" in");
   if(!isDot)sp.textContent=ch;
   sp.style.animationDelay=(baseDelay/1000+ci*CYC_STAG).toFixed(3)+"s";
   /* drop the compositing layer once the entrance is over, exactly as the original did --
      a permanently animating span is a permanent layer */
   sp.addEventListener("animationend",function(){sp.classList.remove("in");},{once:true});
   w.appendChild(sp);
  });
  attach(w);
  return w;
 }

 /* ══ THE LINE GROWS AND SHRINKS ═════════════════════════════════════════════════
    Jayden: "make sure to animate the line growing or shrinking in a sleek way."

    THE FOUR WORDS DIFFER IN WIDTH BY UP TO ~84px, and .pLede is text-align:center, so
    every swap changes where "made with" sits by half that. Something has to carry that
    change or the clause snaps sideways.

    WHAT WAS HERE BEFORE, AND WHY IT WENT. The previous rig eased the incoming word's
    min-width from the outgoing word's width down to its own. It was not instant -- it
    was a real 360ms tween and it did stop the snap -- but it had two faults, both
    measured on this page at 1280x900:

      1. IT ANIMATED A LAYOUT PROPERTY ON AN h1. min-width is an input to layout, so
         every frame of the tween re-laid the clause AND re-ran text-wrap:balance on
         .pLede. Benchmarked against this exact element: 0.188ms per invalidation for
         min-width against 0.023ms for the transform pair below, ~8x, on a page whose
         other rAF budget is a crowd of physics heads. This is the same class of work
         the performance pass just took out of the drag path (idle forced-layout reads
         278/s -> 57/s); paying it back on the headline would be a poor trade.
      2. IT MADE THE WORD DRIFT SIDEWAYS AS IT ARRIVED. min-width pads the inline-block
         to the RIGHT of its glyphs, so while the box shrank the line re-centred and the
         new word's letters slid 22px right -- measured: "made" travelled 440.36 -> 462.66
         while "hunger." was still blurring in. The letters were doing two things at once
         and reading as neither.

    WHAT IS HERE NOW. Nothing about the layout is animated at all. The swap lands the new
    word at its FINAL width in a single layout, and then two transforms -- one on the line,
    one on the word, equal and opposite -- put the picture back where the eye left it and
    relax to identity together:

        .pMoodLine   translateX(+d)  ->  0     the static run holds still, then glides
        .cycw        translateX(-d)  ->  0     cancels the line's shift for the word only

    Because they are the same duration and curve they stay in lockstep, so the NET
    transform on the word is zero for the whole tween: the arriving word never moves, and
    the only thing that travels is "made with". That is the sleek reading of this change --
    the eye is on the word that is changing, so the word is the thing that stays put and
    the sentence settles around it. On a centred line the word's CENTRE is invariant under
    a width change anyway (the left edge goes out by d and the right edge in by d), so
    holding it still is not a trick, it is the geometry.

    THE DISTANCE IS MEASURED, NOT DERIVED. Reading the real before/after positions of the
    first static word and the word's own centre costs the same two layout reads as the
    width maths would and is correct in cases the maths is not -- most importantly when the
    clause wraps at a narrow viewport, where "made with" does not move at all and the right
    compensation is zero rather than half the width delta.

    THE CURVE IS --sp-settle, AND ITS DURATION IS --sp-settle-dur. A line finding its
    length is a settle, which is what that spring is for; it is sampled monotonic (no
    overshoot), so type never wobbles, and tokens.css §6 requires the pair be used
    together. The word's own letters keep cycIn/--ease-out: a letter landing and a line
    settling are different objects and it is right that they are not the same curve.

    ONE forced reflow per swap (the void offsetWidth that commits the start transform),
    against 22 layouts per swap before. Reduced motion takes none of it -- see cycle().
    ══════════════════════════════════════════════════════════════════════════════ */
 var settleTimer=0,settleWord=null;

 /* The two numbers the settle needs, read together so the pair costs one layout. */
 function shot(w){
  var wd=line.querySelector(".wd");            // the first static word, if the lede was split
  var r=w?w.getBoundingClientRect():null;
  return {wd:wd?wd.getBoundingClientRect().left:null,
          cx:r?r.left+r.width/2:null,
          w:r?r.width:null};
 }

 /* SNAP TO THE END STATE, never to a half-way one. Called before every measurement, at the
    end of every tween, and the moment a hand picks the word up -- a settle that is still
    running when the next thing happens must leave the sentence where it was GOING, so
    nothing downstream ever measures a transformed rect or inherits a stranded offset. */
 function endSettle(){
  clearTimeout(settleTimer);
  line.style.transition="";line.style.transform="";line.style.willChange="";
  if(settleWord){settleWord.style.transition="";settleWord.style.transform="";settleWord.style.willChange="";}
  settleWord=null;
 }

 function settle(before,w){
  endSettle();
  if(reduce||!before)return;                   // reduced motion changes the word, never moves it
  var after=shot(w);
  /* How far the static run jumped, and how far the word's centre jumped with it. */
  var dLine=(before.wd!=null&&after.wd!=null)?before.wd-after.wd
           :(before.w!=null&&after.w!=null)?(after.w-before.w)/2:0;   // fallback: half the delta
  var dWord=(before.cx!=null&&after.cx!=null)?(before.cx-after.cx)-dLine:-dLine;
  if(Math.abs(dLine)<0.5&&Math.abs(dWord)<0.5)return;
  var ease="transform "+SETTLE_MS+"ms var(--sp-settle)";
  settleWord=w;
  line.style.willChange="transform";w.style.willChange="transform";
  line.style.transition="none";w.style.transition="none";
  line.style.transform="translate3d("+dLine.toFixed(2)+"px,0,0)";
  w.style.transform="translate3d("+dWord.toFixed(2)+"px,0,0)";
  void line.offsetWidth;                       // the one forced reflow, once per swap
  line.style.transition=ease;w.style.transition=ease;
  line.style.transform="translate3d(0,0,0)";
  w.style.transform="translate3d(0,0,0)";
  /* The layer comes off when the tween is over -- a permanently promoted h1 line is a
     permanent layer, the same reason .cyc-ch strips .in on animationend. */
  settleTimer=setTimeout(endSettle,SETTLE_MS+60);
 }

 function place(i,defer){
  endSettle();                                 // never measure a rect that is mid-tween
  endGlyphSettle();                            /* and never measure letters still unwinding
                                                  from a drop -- a rotated glyph widens the
                                                  word's rect, which would poison the
                                                  before/after the line settle is built on */
  var before=(cycWord&&cycWord.parentNode)?shot(cycWord):null;
  var next=build(i,defer);
  if(before){
   cycWord.replaceWith(next);cycWord=next;
   settle(before,next);
  }else{
   slot.appendChild(next);cycWord=next;
  }
  tug(next);
 }

 /* THE WORD STILL CHANGES UNDER REDUCED MOTION. It used to stop dead on whichever mood it
    booted with, which is the failure mode Apple names directly: Reduce Motion asks for a
    different animation, not for the feature to be withdrawn, and the substitution it names
    is a dissolve. The four moods are this page's only passive announcement that the moods
    exist at all, so withdrawing the cycle withdraws information, not just decoration. What
    reduced motion drops is every bit of TRAVEL -- no per-letter stagger, no translateY, no
    blur, and no settle: the clause's new length simply is, at the one moment nothing is
    visible. See the @media block in play.html for the paired keyframes. */
 function nextCycle(ms){
  clearTimeout(cycTimer);
  cycTimer=setTimeout(cycle,ms||DWELL);
 }
 function cycle(){
  if(cycHold||dragging||!cycWord)return;  // never swap out from under a hand
  cycWord.classList.add("out");
  clearTimeout(cycTimer);
  /* WHEN THE NEW WORD ARRIVES IS DERIVED FROM THE OLD ONE, not a constant. The exit is
     staggered per character exactly as the entrance is, so a five-letter word is clear
     4x50ms sooner than an eight-letter one. The old fixed 560 was wrong at both ends: it
     cut "delight." and "empathy." off with 30ms of their last letter still to run, and it
     left "love." sitting as a hole in a full-width slot for 120ms -- the awkward half-empty
     space this swap exists to never show. Measured at 1280x900: the last letter of "love."
     was already under 5% opacity at 333ms and the swap did not come until 560.
     THE HANDOVER IS ONE RUNG EARLY ON PURPOSE. It waits --dur-state (160) of the last
     letter's --dur-state-out (240), not the whole thing. --ease-out is front-loaded, so at
     that point the letter is at ~4% opacity behind 4.8px of blur -- gone to the eye, with
     only the tail of the curve left to run. Cutting the tail is what closes the hole to a
     frame or two: the last letter leaves as the first one arrives, and the line starts
     settling on the same frame, so the word changing and the clause changing are ONE event
     rather than two with a gap between them. The number is a rung, not a fudge factor. */
  var n=cycWord.childElementCount||1;
  var gap=reduce?FADE_MS:(n-1)*CYC_STAG*1000+FADE_MS;
  cycTimer=setTimeout(function(){
   if(cycHold||dragging||!cycWord)return;
   wi=(wi+1)%MOODS.length;place(wi,false);nextCycle();
  },gap);
 }

  /* NO TUG. The word used to nudge itself sideways twice, 900ms after landing, to teach
     that it is draggable. Jayden: "I don't like the jolt hint" -- removed entirely.
     tug() stays as a no-op so its call sites remain honest rather than being unpicked
     one at a time. If the gesture ever needs teaching again it should be taught by the
     word's resting appearance, not by motion -- a hint line is still not the answer,
     which was settled when the same clause was killed on the home page. */
  function tug(){}

 function fire(mood){
  /* One owner of what a mood means. This is the menu's own button, so hero-engine.js's
     dispatch runs unchanged -- including its game gating, its busy queue and its
     "conjure a proxy so he does not chew air" path for hunger. */
  var item=document.querySelector('#moodMenu .moodItem[data-mood="'+mood+'"]');
  if(item)item.click();
 }

 /* ══ WHERE "OVER THE FACE" ACTUALLY IS ══════════════════════════════════════════
    ONE zone for all four moods, rather than the home page original's split between a radial
    test for hunger and a rectangle-with-asymmetric-padding for the other three -- four
    different drop targets for four identical gestures is a difference the visitor cannot
    see, but can feel as inconsistency.

    IT IS THE INK, NOT THE BOX. #face is a transparent cut-out and its element rect is much
    bigger than the head inside it -- most of the top-left and top-right corners are empty
    pixels of hair-gap. data-head-bounds carries the REAL alpha extents, derived from the
    images and already the source of truth for hero-engine.js's overFace() hover test and
    hero-head-transform.js's frame. Reading the same attribute is what stops this page's
    idea of "on the head" drifting away from the other two consumers of it: if the artwork
    is ever recut, all three move together.

    AN ELLIPSE INSCRIBED IN THOSE BOUNDS, NOT THE BOUNDS THEMSELVES. The bounds are an
    axis-aligned bounding box, so its four corners are still empty -- and the corners are
    exactly where a rectangle lies to you, because that is where the hair curves away. A
    head is an ellipse to a much better approximation than it is a rectangle, and the test
    costs the same two multiplies. HEAD_PAD then gives back 6%, because a drop target that
    is pixel-exact is a drop target you keep missing; the pad is a hair of forgiveness at
    the silhouette, not a second, looser zone.

    THIS IS STRICTLY TIGHTER THAN WHAT IT REPLACES, which matters because the number it
    replaces was itself a bug fix. The old test was radius 0.55 x the stage width, chosen
    down from the home page's 0.72 after measuring that at 1440x900 the word's own RESTING
    centre sits 330px from the head's centre while 0.72 of the 466px stage is 335 -- the
    word began the gesture already inside its own drop zone and a 2px slip fired a mood.
    The ellipse's half-width is 0.328 x 1.06 = 0.347 of the stage and its half-height 0.457
    x 1.06 = 0.484, both under 0.55, so that fix is preserved by construction at every
    breakpoint rather than by re-measuring one.

    THE RECT IS READ ONCE PER GESTURE, NOT ONCE PER MOVE. This runs on every pointermove, and
    a getBoundingClientRect there is a forced layout in the drag path -- the exact cost the
    performance pass just took out (long tasks during a drag: 249ms -> 0ms). The head does
    drift while you drag, because hero-engine floats it on the 8fps clock, but that float is
    a few pixels against a zone ~160x210px, so a cached box is wrong by an amount nothing
    can feel and right about the thing the contract measures.
    The read is taken at pointerdown, BEFORE .catchReady can have scaled #stageMorph, so the
    zone is the resting one; the 5.5% lean is then pure hysteresis in the visitor's favour
    and can never feed back into the test that triggered it. */
 var HEAD_PAD=1.06,headBox=null;

 function measureHead(){
  var r=stage.getBoundingClientRect();
  var f=document.getElementById("face");
  var b=((f&&f.getAttribute("data-head-bounds"))||"0.1933 0.0616 0.8484 0.9234")
        .trim().split(/\s+/).map(Number);
  if(b.length!==4||b.some(function(v){return !isFinite(v);}))b=[0.1933,0.0616,0.8484,0.9234];
  headBox={cx:r.left+r.width*(b[0]+b[2])/2,
           cy:r.top+r.height*(b[1]+b[3])/2,
           rx:Math.max(1,r.width*(b[2]-b[0])/2*HEAD_PAD),
           ry:Math.max(1,r.height*(b[3]-b[1])/2*HEAD_PAD)};
 }

 function onHead(x,y){
  if(!headBox)return false;
  var nx=(x-headBox.cx)/headBox.rx, ny=(y-headBox.cy)/headBox.ry;
  return nx*nx+ny*ny<=1;
 }

 /* ══ THE LETTERS WOBBLE IN YOUR HAND ════════════════════════════════════════════
    Jayden: "add the animation back when you drag the letter -- they do a little wobble."

    HE IS ASKING FOR SOMETHING BACK, SO THIS IS A RESTORATION, NOT A DESIGN. The original
    is hero-engine.js's wobbleDrag() (line 755), which drove the home page's dragged
    cookie/disco-ball/heart, and its four ingredients are copied here by value:

      the 8fps clock      hero-engine.js:1425 -- one setInterval at 125ms, commented
                          "MASTER 8fps CLOCK", and wobbleDrag is called from inside it.
                          The stop-motion judder IS the character; the original comment
                          says "squirm like picking up a Mii (8fps stop-motion)". Running
                          this at 60fps would be smoother and would be a different feel.
      the 0.45 smoothing  vel += (dx - vel) * 0.45
      the 0.7 / +-16deg   lean = clamp(vel * 0.7, +-16) -- "follow-through: body trails
                          the motion". This is the ingredient that makes it read as
                          physics: the tilt is the CURSOR'S VELOCITY, so a fling leans
                          hard and a still hand barely moves. Nothing here loops
                          independently of what your hand is doing.
      squash & stretch    sx = 1 - s*0.03 - |lean|*0.0009, sy = 1 + s*0.04

    WHAT IS NEW, AND WHY. The original tilted the whole ghost -- one rigid object, which
    was right when the object was a cookie. The payload here is a WORD, and play.html
    already wraps it one character per inline-block span for exactly this reason. A word
    tilting as a unit is a sticker; letters reacting individually are alive. So the
    original's single lean value is fanned out over the glyphs as a CHAIN:

      the glyph under your thumb chases the raw velocity target
      every other glyph chases its NEIGHBOUR one step nearer that grab point

    which is a cascade of first-order filters, so phase lag accumulates with distance and
    the far end of the word arrives late and smaller without a single hand-written delay.
    That is the stagger, and it is derived from where you actually grabbed rather than
    from the letter index -- grab "delight." by the "t" and the wave runs the other way.

    THE IDLE SQUIRM IS KEPT AND DELIBERATELY DEMOTED. The original also carried a
    pointer-independent pendulum (sin(tk*0.9)*4 + sin(tk*1.7)*1.5, so +-5.5deg) and
    dropping it would lose the "there is something alive in your hand" reading that is
    half of why the original is memorable. But a term that runs regardless of your hand is
    exactly the canned-decoration failure, so it is held to +-4.6deg against the lean's
    +-16 and given a per-glyph phase offset, which turns a wave into a squirm. The lean
    dominates any real movement by better than 3:1; the squirm is what is left when you
    hold still, and holding still is the only time it is the loudest thing.

    NO LAYOUT IS READ AND NONE IS WRITTEN. The tick touches nothing but .style.transform
    on glyphs that are already promoted, off a clock, from state carried in JS -- there is
    no getBoundingClientRect in the loop for tools/performance-idle-contract.py to find.
    The one rect read in the whole gesture is the one pointerdown was already doing.
    ══════════════════════════════════════════════════════════════════════════════ */
 var WOB_MS=125,                                  // the master clock's period, 8fps
     WOB_FOLLOW=0.45,                             // hero-engine.js:758, verbatim
     WOB_LEAN=0.7, WOB_LEAN_MAX=16,               // hero-engine.js:759, verbatim
     SETTLE_STEP=16;                              /* the 16ms per-character step the
                                                     headline's own entrance cascade uses
                                                     (play.html: calc(var(--i) * 16ms)) --
                                                     the settle is the same word rippling,
                                                     so it ripples at the same rate */
 var wob=null;

 /* Start the squirm. gi is the glyph the pointer came down on: the head of the chain. */
 function wobStart(g,gi){
  if(reduce)return;                               // see the reduced-motion note in up()
  var els=[].slice.call(g.children);
  if(!els.length)return;
  wob={els:els,gi:Math.max(0,Math.min(els.length-1,gi)),tk:0,lx:null,vel:0,
       lean:els.map(function(){return 0;}),timer:0};
  wob.timer=setInterval(wobTick,WOB_MS);
 }

 function wobTick(){
  if(!wob||!ghost)return;
  var t=++wob.tk;
  /* Smoothed horizontal cursor velocity, from the position the move handler already
     stored -- the tick never asks the pointer or the DOM anything. */
  if(wob.lx==null)wob.lx=ghost._x;
  var dx=ghost._x-wob.lx;wob.lx=ghost._x;
  wob.vel+=(dx-wob.vel)*WOB_FOLLOW;
  var target=Math.max(-WOB_LEAN_MAX,Math.min(WOB_LEAN_MAX,wob.vel*WOB_LEAN));
  /* Walk OUTWARD from the grab point so a glyph always chases a neighbour that has
     already been updated this tick -- that is what makes the lag accumulate with
     distance instead of every letter lagging the target by the same one step. */
  var gi=wob.gi,n=wob.els.length,d,i;
  for(d=0;d<n;d++){
   for(var s=0;s<2;s++){
    i=s?gi-d:gi+d;
    if(d===0&&s)continue;
    if(i<0||i>=n)continue;
    var src=d===0?target:wob.lean[s?i+1:i-1];
    wob.lean[i]+=(src-wob.lean[i])*WOB_FOLLOW;
   }
  }
  for(i=0;i<n;i++){
   var ph=t*0.9+i*0.8, sv=Math.sin(ph);
   var sway=sv*3.2+Math.sin(t*1.7+i*1.3)*1.4;     // demoted from the original's 4 + 1.5
   var rot=sway+wob.lean[i];
   var sx=1-sv*0.03-Math.abs(wob.lean[i])*0.0009; // squash & stretch, hero-engine.js:763
   var sy=1+sv*0.04;
   var bob=Math.round(sv*2);
   wob.els[i].style.transform="translate3d(0,"+bob+"px,0) rotate("+rot.toFixed(1)+"deg) scale("+sx.toFixed(3)+","+sy.toFixed(3)+")";
  }
 }

 /* ── AND THEN THEY COME TO REST ──────────────────────────────────────────────
    The ghost dies at pointerup, so the settle cannot happen on it. It happens on the REAL
    word, which is the correct object anyway: the letters you were holding are the letters
    that go back into the sentence, and handing the ghost's final angles across is what
    makes the return continuous rather than a cut.

    --sp-bounce, AND IT HAD TO BE THAT ONE. Of the four springs it is the only one whose
    overshoot survives being applied to a rotation: it goes to 1.1065, so a letter left at
    12deg swings ~1.3deg past upright before settling -- visible, and the "little
    overshoot" a hand-thrown object owes you. --sp-pop peaks at 1.0151, which on the same
    12deg is 0.18deg and would not be seen. Its duration is --sp-bounce-dur and may not be
    changed independently (tokens.css §6). Under reduced motion tokens.css already collapses
    every spring duration to 1ms, so this rule needs no @media of its own -- the letters are
    simply upright, which is where they were going.

    THE STAGGER RUNS THE SAME WAY THE WOBBLE DID: delay by distance from the grab point, so
    the letter you were pinching lands first and the word unwinds away from your thumb. */
 var settleGlyphTimer=0,settleGlyphWord=null,takenTimer=0;

 function endGlyphSettle(){
  clearTimeout(settleGlyphTimer);
  if(settleGlyphWord){
   [].forEach.call(settleGlyphWord.querySelectorAll(".cyc-ch"),function(ch){
    ch.style.transition="";ch.style.transform="";ch.style.transitionDelay="";ch.style.willChange="";
   });
   settleGlyphWord.classList.remove("settling");
  }
  settleGlyphWord=null;
 }

 function settleGlyphs(w){
  endGlyphSettle();
  if(!wob||reduce)return;
  var chs=[].slice.call(w.querySelectorAll(".cyc-ch"));
  var n=Math.min(chs.length,wob.els.length);
  if(!n)return;
  var gi=wob.gi,any=false,i;
  for(i=0;i<n;i++){
   if(Math.abs(wob.lean[i])<0.15)continue;
   any=true;
   chs[i].style.willChange="transform";
   chs[i].style.transition="none";
   chs[i].style.transform="rotate("+wob.lean[i].toFixed(1)+"deg)";
  }
  if(!any)return;
  settleGlyphWord=w;
  void w.offsetWidth;                             // one forced reflow, once per drop
  var maxD=0;
  for(i=0;i<n;i++){
   var d=Math.abs(i-gi);if(d>maxD)maxD=d;
   chs[i].style.transition="transform var(--sp-bounce-dur) var(--sp-bounce)";
   chs[i].style.transitionDelay=(d*SETTLE_STEP)+"ms";
   chs[i].style.transform="rotate(0deg)";
  }
  w.classList.add("settling");
  /* The promotion comes off when the last letter is home, for the same reason .cyc-ch
     strips .in on animationend: a span left carrying a layer keeps it forever. */
  settleGlyphTimer=setTimeout(endGlyphSettle,BOUNCE_MS+maxD*SETTLE_STEP+60);
 }

 function wobStop(){
  if(!wob)return;
  clearInterval(wob.timer);
  wob=null;
 }

 function makeGhost(w){
  var g=document.createElement("div");
  g.className="moodDrag";
  g.setAttribute("aria-hidden","true");    // the real word is still in the h1 and still read
  /* BUILT FROM THE WORD, NEVER FROM A LITERAL -- see the header note on ee574f0. */
  [].forEach.call(w.querySelectorAll(".cyc-ch"),function(ch){
   var sp=document.createElement("span");
   sp.className=ch.className.replace(/\bcyc-ch\b/,"mdgl").replace(/\bin\b/,"").trim();
   sp.textContent=ch.textContent;
   g.appendChild(sp);
  });
  /* Match the ghost to the word's OWN computed type rather than to a token, so the thing in
     your hand is the size that left the sentence at every breakpoint. */
  var cs=getComputedStyle(w);
  g.style.fontSize=cs.fontSize;g.style.fontWeight=cs.fontWeight;g.style.letterSpacing=cs.letterSpacing;
  return g;
 }

 function attach(w){
  function release(){if(pid!=null){try{w.releasePointerCapture(pid);}catch(_){}pid=null;}}
  function move(e){
   if(!dragging||!ghost)return;
   ghost._x=e.clientX;ghost._y=e.clientY;
   ghost.style.left=e.clientX+"px";ghost.style.top=e.clientY+"px";
   /* the head's own catch cue, the same class hero-engine's faceTrackTo toggles */
   document.body.classList.toggle("catchReady",onHead(e.clientX,e.clientY));
  }
  function up(){
   if(!dragging)return;
   dragging=false;release();w.classList.remove("grab");
   var hit=ghost&&onHead(ghost._x,ghost._y);
   w.style.opacity="";                     // the word comes home either way
   /* THE ANGLES CROSS OVER BEFORE THE GHOST DIES. settleGlyphs reads wob, so it has to run
      while wob is still standing; it writes the ghost's final lean onto the real letters
      in the same frame the word becomes visible again, which is what makes the return one
      continuous movement rather than a cut back to upright. */
   settleGlyphs(w);wobStop();
   if(ghost){ghost.remove();ghost=null;}
   /* THE LEAN LETS GO HERE, AND HOW IT LETS GO DEPENDS ON WHETHER IT WAS FED. A taken drop
      hands the head over to the mood performance on the settle spring (play.css); an
      abandoned one just retracts. .pMoodTaken is dropped again once that handover is over
      so a later hover-out is never left riding the wrong curve. */
   document.body.classList.remove("catchReady");
   if(hit){
    document.body.classList.add("pMoodTaken");
    clearTimeout(takenTimer);
    takenTimer=setTimeout(function(){document.body.classList.remove("pMoodTaken");},SETTLE_MS+60);
   }
   cycHold=false;
   if(hit)fire(w.getAttribute("data-mood"));
   nextCycle(hit?DWELL:2600);              // a miss puts the word back and resumes sooner
  }
  w.addEventListener("pointerdown",function(e){
   if(dragging)return;
   if(document.body.classList.contains("hmBattle")||document.body.classList.contains("hmSoccer")
    ||document.body.classList.contains("hmRace")||document.body.classList.contains("hmTour"))return;
   e.preventDefault();
   /* A SWAP MUST NEVER FIGHT A DRAG, AND A CANCELLED SWAP MUST NOT STRAND THE WORD.
      Grabbing during the exit used to clear the timer that was going to replace the word
      while leaving .out on it -- animation-fill-mode:both then held it at opacity 0, so the
      word came back from the drop INVISIBLE and stayed that way until the next cycle
      finally swapped it, up to 8.5s later. Dropping .out here restores it in the same frame
      the ghost is built from it, and endSettle() lands any in-flight line settle on its end
      state so the rect this gesture measures is the resting one. */
   w.classList.remove("out");
   endSettle();endGlyphSettle();           // a second grab lands the first one's unwind
   measureHead();                          // the gesture's one read of the drop zone
   var r=w.getBoundingClientRect();
   w.classList.add("grab");
   cycHold=true;clearTimeout(cycTimer);    // freeze the cycler for the whole gesture
   ghost=makeGhost(w);
   document.body.appendChild(ghost);
   ghost._x=r.left+r.width/2;ghost._y=r.top+r.height/2;   // spawns exactly where the word was
   ghost.style.left=ghost._x+"px";ghost.style.top=ghost._y+"px";
   /* WHICH LETTER YOU PINCHED, from the rect this gesture was already reading -- no extra
      layout, and no per-glyph measurement. The word is a single nowrap line of equal-ish
      glyphs, so the fraction across its box is the glyph index to within one letter, which
      is all a stagger origin needs to be. */
   var gn=ghost.childElementCount||1;
   wobStart(ghost,r.width?Math.floor((e.clientX-r.left)/r.width*gn):0);
   /* opacity:0, NOT visibility:hidden and NOT removal. It keeps the headline's layout slot
      (no reflow, no line jump mid-drag) AND keeps the element receiving pointer events,
      which is what makes setPointerCapture on it hold the gesture. */
   w.style.opacity="0";dragging=true;pid=e.pointerId;
   try{w.setPointerCapture(pid);}catch(_){}
  });
  w.addEventListener("pointermove",move);
  w.addEventListener("pointerup",up);
  w.addEventListener("pointercancel",up);
  w.addEventListener("lostpointercapture",up);   // a dropped word can never get stranded
 }

 /* ── THE ENTRANCE ────────────────────────────────────────────────────────────
    "Make the text actually have that animation, and the buttons." The two static
    sentences are split into per-character spans and given an index; the CSS in
    play.html turns that index into a 16ms cascade on the same cycIn keyframes the
    live word uses, so the headline assembles as one object rather than as a block
    of type plus a widget. The live word is given the whole static run as a head
    start so it lands last, which is exactly the sequencing revealAll() used on the
    home page ("the cycling word lands right AFTER ...with, then the cycle begins").

    IT SPLITS TEXT NODES ONLY, and .pMoodSlot is left alone -- the word builds its
    own spans and owns its own stagger. Splitting is skipped entirely under reduced
    motion: there is no animation to carry, and a headline shattered into 60 spans
    is 60 things for a screen reader's character navigation to walk through for no
    benefit. The sentence stays one text node in that case.
    THE GATE IS data-play-ready, not DOMContentLoaded. .playBooting sets
    visibility:hidden on the whole viewport until every initial head has decoded,
    and visibility:hidden does not pause an animation -- an entrance started at load
    would finish behind the curtain. */
 /* CHARACTERS ARE WRAPPED IN WORDS, AND THAT IS NOT TIDINESS. An inline-block per
    character is a break opportunity per character: measured at 390 the first line came
    back as "I made a few g / ames for fun." Each word becomes its own nowrap inline-block
    and the characters live inside it, so the line breaks between words exactly as the
    original text did. This is the same .word > .ch nesting hero-engine.js's makeWord()
    used, for the same reason. */
 function split(){
  var n=0;
  [].forEach.call(lede.querySelectorAll(".pLine"),function(line){
   [].slice.call(line.childNodes).forEach(function(node){
    if(node.nodeType!==3)return;
    var frag=document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach(function(part){
     if(!part)return;
     if(/^\s+$/.test(part)){frag.appendChild(document.createTextNode(part));return;}
     var word=document.createElement("span");
     word.className="wd";
     [].forEach.call(part,function(ch){
      var sp=document.createElement("span");
      sp.className="ch";sp.textContent=ch;sp.style.setProperty("--i",n++);
      word.appendChild(sp);
     });
     frag.appendChild(word);
    });
    line.replaceChild(frag,node);
   });
  });
  return n;
 }

 function enter(){
  if(reduce){place(wi,false);nextCycle();return;}
  var n=split();
  baseDelay=n*16+120;                    // the word lands one beat after the last letter
  place(wi,false);
  baseDelay=0;                           // every later swap starts immediately
  lede.classList.add("isIn");
  var ctas=document.querySelector(".heroCtas");
  if(ctas){
   [].forEach.call(ctas.children,function(el,i){el.style.setProperty("--i",n+4+i*3);});
   ctas.classList.add("isIn");
  }
  nextCycle();
 }

 if(document.body.getAttribute("data-play-ready")==="true")enter();
 else{
  var obs=new MutationObserver(function(){
   if(document.body.getAttribute("data-play-ready")==="true"){obs.disconnect();enter();}
  });
  obs.observe(document.body,{attributes:true,attributeFilter:["data-play-ready"]});
  /* the arena's own boot watchdog gives up at 8s; this one is its backstop, so a page
     that never reports ready still shows a finished headline rather than an empty one */
  setTimeout(function(){if(!lede.classList.contains("isIn")&&!cycWord){obs.disconnect();enter();}},9000);
 }
})();
