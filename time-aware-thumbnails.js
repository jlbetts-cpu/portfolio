(function(root,factory){
 var api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(!root||!root.document)return;
 root.TimeAwareThumbnails=api;
 function start(){
  if(root.HomeTimeThumbnails||!root.SiteTheme)return;
  root.HomeTimeThumbnails=api.createController({
   document:root.document,
   theme:root.SiteTheme,
   Image:root.Image,
   window:root
  });
 }
 /* IT NO LONGER WAITS FOR THE WHOLE DOCUMENT. index.html now loads this
    immediately after the last cover, so every element it touches is parsed by
    the time it runs -- waiting for DOMContentLoaded there would re-introduce
    the 721ms gap this move exists to close, because the wait was never about
    THIS script being ready, it was about the covers being parsed.
    THE READY BRANCH IS KEPT for every other caller: any page that loads this
    from <head>, and the tests that do, still get the old behaviour. The guard
    is "are the covers here yet", asked directly, instead of "has the whole
    document finished", used as a proxy for it. */
 if(root.document.querySelector(".csImg")||root.document.readyState!=="loading")start();
 else root.document.addEventListener("DOMContentLoaded",start,{once:true});
})(typeof window!=="undefined"?window:null,function(){
 "use strict";

 var STATES=Object.freeze(["off","pre-dawn","sunrise","daytime","dusk","sunset","night"]);
 /* THE SLUG HERE IS THE PAGE'S data-slug, NOT ITS FILENAME, and two of the five
    new ones do not agree with their file: head-maker-study.html is "headmaker"
    and gradientlab-study.html is "gradientlab", and since 2026-09-01 a third,
    workspace-study.html, is "workspace" -- named that way because the built app
    already owns the /workspace/ directory, so the page could not be
    workspace.html. The href sniff at the bottom of
    projectFor() therefore cannot find Head Maker on its own -- it looks for
    "<project>.html" -- so every new card must carry data-time-thumbnail or sit
    in a .csItem[data-slug]. Both of those are checked BEFORE the href, so a
    card that declares itself is never at the mercy of the filename.
    "gradientlab" would in fact match gradientlab-study.html by accident, and
    would ALSO match a plain link to the tool at gradientlab.html; declaring the
    attribute is what keeps that from being luck. "workspace" does not match
    workspace-study.html at all, so its card MUST keep data-slug="workspace". */
 var PROJECTS=Object.freeze(["bearings","apollo","strata","cluster","ucdavis","r3shore",
                             "workspace","headmaker","gradientlab","engine","yowmings"]);
 /* Off. Each is the SAME picture as that project's six states with no grade
    applied, so switching the clock off changes the light and nothing else.
    Yowmings is the exception and deliberately so: its Off is the match plate
    the Home card and the case-study hero already load, untouched. */
 var ORIGINALS=Object.freeze({
  bearings:"images/cs/bearings-cover.webp",
  apollo:"images/cs/apollo-cover.webp",
  strata:"images/cs/strata-cover.webp",
  cluster:"images/cs/cluster/cluster-cover.webp",
  ucdavis:"images/cs/ucrec/cover.webp",
  r3shore:"images/cs/r3shore.webp",
  workspace:"images/cs/study/workspace/cover.webp",
  headmaker:"images/cs/study/headmaker/cover.webp",
  gradientlab:"images/cs/study/gradientlab/cover.webp",
  engine:"images/cs/study/engine/cover.webp",
  yowmings:"images/cs/yowmings/card-1200.webp"
 });
 var VARIANT_DIRS=Object.freeze({
  bearings:"bearings",apollo:"apollo",strata:"strata",cluster:"cluster",
  ucdavis:"ucrec",r3shore:"r3shore",
  workspace:"workspace",headmaker:"headmaker",gradientlab:"gradientlab",
  engine:"engine",yowmings:"yowmings"
 });
 var SIZES="(max-width: 760px) calc(100vw - 48px), (max-width: 1280px) calc(100vw - 80px), 1200px";

 function normalizeState(state){return STATES.indexOf(state)!==-1?state:"off";}

 function sourceFor(project,state){
  if(PROJECTS.indexOf(project)===-1)return null;
  var next=normalizeState(state);
  if(next==="off")return {src:ORIGINALS[project],srcset:"",sizes:""};
  var base="images/cs/variants/time/"+VARIANT_DIRS[project]+"/"+next;
  return {
   src:base+"-1200.webp",
   srcset:base+"-1200.webp 1200w, "+base+"-2400.webp 2400w",
   sizes:SIZES
  };
 }

 function createController(options){
  var opts=options||{};
  var doc=opts.document;
  var theme=opts.theme;
  var ImageCtor=opts.Image;
  var win=opts.window;
  if(!doc||!theme||typeof theme.getSnapshot!=="function"||typeof theme.subscribe!=="function"||typeof ImageCtor!=="function"){
   return {destroy:function(){},request:function(){}};
  }

  var targets=Array.prototype.slice.call(doc.querySelectorAll("img[data-time-thumbnail]"));
  if(doc.documentElement){
   Array.prototype.slice.call(doc.querySelectorAll(".csItem img.csImg")).forEach(function(image){
    if(targets.indexOf(image)===-1)targets.push(image);
   });
  }
  var groups={};
  PROJECTS.forEach(function(project){groups[project]=[];});
  function projectFor(image){
   var explicit=image.getAttribute("data-time-thumbnail");
   if(PROJECTS.indexOf(explicit)!==-1)return explicit;
   var article=typeof image.closest==="function"&&image.closest(".csItem[data-slug]");
   var slug=article&&article.getAttribute("data-slug");
   if(PROJECTS.indexOf(slug)!==-1)return slug;
   var anchor=typeof image.closest==="function"&&image.closest("a[href]");
   var href=anchor&&anchor.getAttribute("href")||"";
   var src=image.getAttribute("src")||"";
   for(var i=0;i<PROJECTS.length;i++){
    var project=PROJECTS[i];
    if(href.indexOf(project+".html")!==-1||src===ORIGINALS[project])return project;
   }
   return null;
  }
  targets.forEach(function(image){
   var project=projectFor(image);
   if(groups[project])groups[project].push(image);
  });
  var cache=new Map();
  var requestId=0;
  var requestedState="off";
  var destroyed=false;
  var unsubscribe=function(){};

  function preload(descriptor){
   var key=descriptor.srcset||descriptor.src;
   if(cache.has(key))return cache.get(key);
   var loader=new ImageCtor();
   var promise;
   if(typeof loader.decode==="function"){
    if(descriptor.sizes)loader.sizes=descriptor.sizes;
    if(descriptor.srcset)loader.srcset=descriptor.srcset;
    loader.src=descriptor.src;
    promise=Promise.resolve().then(function(){return loader.decode();});
   }else{
    promise=new Promise(function(resolve,reject){loader.onload=resolve;loader.onerror=reject;});
    if(descriptor.sizes)loader.sizes=descriptor.sizes;
    if(descriptor.srcset)loader.srcset=descriptor.srcset;
    loader.src=descriptor.src;
   }
   var guarded=promise.catch(function(error){cache.delete(key);throw error;});
   cache.set(key,guarded);
   return guarded;
  }

  function commit(image,descriptor){
   if(descriptor.srcset){
    image.setAttribute("sizes",descriptor.sizes);
    image.setAttribute("srcset",descriptor.srcset);
    image.setAttribute("src",descriptor.src);
   }else{
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.setAttribute("src",descriptor.src);
   }
  }

  var fadeNodes=[];

  function dropGhost(ghost){
   if(!ghost)return;
   var at=fadeNodes.indexOf(ghost);
   if(at!==-1)fadeNodes.splice(at,1);
   if(ghost.__timeFadeTimer&&win&&typeof win.clearTimeout==="function")win.clearTimeout(ghost.__timeFadeTimer);
   ghost.__timeFadeTimer=0;
   if(ghost.parentNode)ghost.parentNode.removeChild(ghost);
   if(ghost.__timeFadeOwner&&ghost.__timeFadeOwner.__timeFadeNode===ghost)ghost.__timeFadeOwner.__timeFadeNode=null;
   ghost.__timeFadeOwner=null;
  }

  /* CROSS-FADE A COVER THAT IS ALREADY ON SCREEN.
     The old picture is lifted into a ghost stacked over the cover, the cover is
     repointed underneath it, and the ghost is faded out. Two orderings matter
     and both are load-bearing:

     1. THE GHOST IS PROVEN PAINTABLE BEFORE THE COVER MOVES. If we repointed
        first and appended after, there is a frame where the new picture is
        uncovered -- a flash of exactly the cut this function exists to remove.
        The ghost's src is the one the browser is displaying this instant, so it
        is a memory-cache hit and `complete` is almost always already true; the
        decode path below is the honest version of "almost always".
     2. THE FADE STARTS ON A LATER FRAME THAN THE APPEND. A node appended and
        given its end state in the same frame has no start state to interpolate
        from and snaps. The double rAF is that, not superstition.

     Cleanup runs from transitionend AND from a timer, because transitionend
     does not fire for a zero-duration transition and does not fire at all if
     the node is display:none in a panel the visitor switched away from
     mid-fade. Either path is idempotent. */
  function crossFade(image,descriptor){
   var previous=image.getAttribute("src")||"";
   var snapshot=image.currentSrc||previous;
   var frame=image.parentNode;
   /* EVERY ESCAPE HERE FALLS BACK TO commit(), the exact behaviour that shipped
      before this function existed. The cross-fade is the enhancement; putting
      the right picture on screen is the job, and it still happens when the
      enhancement cannot. */
   if(previous===descriptor.src||!snapshot||!frame||
      typeof doc.createElement!=="function"||typeof frame.appendChild!=="function"){
    commit(image,descriptor);
    return;
   }
   dropGhost(image.__timeFadeNode);
   var ghost=doc.createElement("img");
   ghost.className="csImgOut";
   ghost.setAttribute("alt","");
   ghost.setAttribute("aria-hidden","true");
   ghost.setAttribute("role","presentation");
   ghost.decoding="sync";
   ghost.src=snapshot;
   ghost.__timeFadeOwner=image;
   image.__timeFadeNode=ghost;
   fadeNodes.push(ghost);

   function begin(){
    if(destroyed||image.__timeFadeNode!==ghost){dropGhost(ghost);return;}
    frame.appendChild(ghost);
    commit(image,descriptor);
    ghost.addEventListener("transitionend",function(event){
     if(!event||event.propertyName==="opacity")dropGhost(ghost);
    });
    if(win&&typeof win.setTimeout==="function"){
     ghost.__timeFadeTimer=win.setTimeout(function(){dropGhost(ghost);},2000);
    }
    var raf=win&&typeof win.requestAnimationFrame==="function"?win.requestAnimationFrame.bind(win):null;
    if(raf)raf(function(){raf(function(){
     if(ghost.parentNode)ghost.setAttribute("data-time-fade","out");
    });});
    else ghost.setAttribute("data-time-fade","out");
   }

   if(ghost.complete&&ghost.naturalWidth>0)begin();
   else if(typeof ghost.decode==="function")ghost.decode().then(begin,begin);
   else{
    ghost.onload=begin;
    ghost.onerror=function(){dropGhost(ghost);commit(image,descriptor);};
   }
  }

  /* Below this, an arrival is indistinguishable from having always been there,
     so it is not animated. Above it, the visitor watched an empty frame and the
     picture should land rather than appear. */
  var ARRIVE_THRESHOLD=120;

  function inClosedPanel(image){
   var panel=typeof image.closest==="function"&&image.closest(".csPanel");
   return !!(panel&&panel.classList&&!panel.classList.contains("on"));
  }

  /* A COVER THAT IS ARRIVING RATHER THAN CHANGING.
     Only reached for an image the browser has not fetched, which on this page
     means a lazy one below the fold. It fades in over the frame that was
     already holding its space, instead of appearing between two paints.

     A COVER IN A CLOSED PANEL IS SKIPPED, and this is the whole safety story
     rather than a detail. .csPanel{display:none} means the browser never
     fetches those images and their load event never fires, so pre-hiding one
     buys nothing -- nobody is looking at it -- and costs everything: measured,
     four covers in the closed "fun" panel sat at opacity 0, and a visitor who
     opened that panel inside the backstop window would have found it empty.
     Fading in something nobody can see is pure risk, so it is not done.

     The mark is cleared on load, on error, and by a backstop timer. The
     backstop degrades to the OLD behaviour -- an un-faded pop -- rather than to
     an invisible cover, which is the right direction to fail in.

     Every DOM method used here is feature-tested, because the arrival fade is a
     nicety and the cover is not. Anything missing means no fade, never a cover
     left at opacity 0 -- and it keeps the controller usable against the plain
     object literals tools/time-aware-thumbnails.test.js stands in for images. */
  function markArrival(image){
   if(image.__timeArriveBound)return;
   if(typeof image.addEventListener!=="function"||typeof image.setAttribute!=="function")return;
   if(inClosedPanel(image))return;
   image.__timeArriveBound=true;
   image.setAttribute("data-time-arrive","pending");
   var settled=false;
   var since=(win&&win.performance&&typeof win.performance.now==="function")?win.performance.now():0;

   /* NEVER ANIMATE SOMETHING THAT WAS ALREADY THERE.
      A cover served from cache resolves in a handful of milliseconds, and
      fading that in for 360ms would make a fast load look slower than it is --
      the site paying an animation tax for a problem it did not have. Under the
      threshold the mark is simply dropped, which returns the element to the
      markup's own opacity:1 with no transition declared for that state, so it
      appears on the very next paint. The fade is reserved for a cover that
      genuinely made the visitor wait. */
   function reveal(){
    if(settled)return;
    settled=true;
    var waited=((win&&win.performance&&typeof win.performance.now==="function")?win.performance.now():0)-since;
    if(waited<ARRIVE_THRESHOLD)image.removeAttribute("data-time-arrive");
    else image.setAttribute("data-time-arrive","in");
   }
   image.addEventListener("load",reveal);
   /* A cover that failed to load is revealed rather than un-marked: "in" is
      opacity 1, so the broken-image state the visitor would have seen anyway is
      what they see, and no path leaves the element transparent. */
   image.addEventListener("error",reveal);
   if(win&&typeof win.setTimeout==="function")win.setTimeout(reveal,8000);
  }

  /* HAS THE BROWSER ACTUALLY FETCHED THIS ONE YET?
     This is the whole question, and it is answerable without touching layout.
     An <img loading="lazy"> that is still below the fold has not been fetched,
     so complete/naturalWidth are false -- and an image the visitor is looking
     at has been, so they are true. That single flag separates the two cases
     this controller has to treat differently, with no getBoundingClientRect
     and no IntersectionObserver. */
  function alreadyFetched(image){
   return !!(image.complete&&image.naturalWidth>0);
  }

  /* WHY THIS NO LONGER PRELOADS EVERYTHING.
     It used to hand all six covers to `new Image()` and wait on Promise.all
     before committing any of them. Three things were wrong with that.
     1. A detached Image() is invisible to loading="lazy". Seven of the eight
        covers on the home page carry that attribute, and this defeated every
        one of them -- 1.14 MB at DPR 1 and 3.16 MB at DPR 2 pulled on first
        paint for artwork most visitors never scroll to. Lazy hints a script
        overrides are worse than none, because the markup looks optimised.
     2. Promise.all is an AND: the slowest of six decodes held the other five
        back, and one rejection abandoned the entire state change -- into an
        empty handler, so nothing retried and nothing said why.
     3. It re-ran in full on every theme flip and every time-of-day boundary.
     Each project is now independent, and each image gets the treatment its
     own markup asked for: one already on screen is decoded before the swap,
     so the picture never flickers mid-change; one the browser has not fetched
     is simply pointed at the new source, and stays as lazy as it was
     declared. Nothing is downloaded on behalf of a cover nobody has scrolled
     to yet. */
  function request(state){
   if(destroyed)return;
   var next=normalizeState(state);
   var id=++requestId;
   requestedState=next;
   PROJECTS.forEach(function(project){
    var images=groups[project];
    if(!images.length)return;
    var descriptor=sourceFor(project,next);
    var visible=[],deferred=[],i;
    for(i=0;i<images.length;i++)(alreadyFetched(images[i])?visible:deferred).push(images[i]);
    /* Not yet fetched: hand it the new source and let loading="lazy" decide
       when, or whether, it is ever worth a request. It has no picture to be
       cross-faded from, so it gets the arrival fade instead -- the two branches
       here are exactly the skeleton-vs-cross-fade question, and the answer
       differs between them because one of them genuinely has nothing on screen
       and the other one does. */
    for(i=0;i<deferred.length;i++){markArrival(deferred[i]);commit(deferred[i],descriptor);}
    if(!visible.length)return;
    /* On screen: decode first so the swap is invisible. A failure here leaves
       the cover that is currently up exactly where it is, which is the right
       answer -- committing a source that would not decode replaces a good
       picture with a broken one. It is now scoped to this project, so a single
       missing variant can no longer take the other five down with it. */
    preload(descriptor).then(function(){
     if(destroyed||id!==requestId||next!==requestedState)return;
     for(var j=0;j<visible.length;j++)crossFade(visible[j],descriptor);
    },function(){});
   });
  }

  function onSnapshot(snapshot){request(snapshot&&snapshot.state);}
  function onPageHide(event){if(!event.persisted)destroy();}
  function destroy(){
   if(destroyed)return;
   destroyed=true;
   requestId+=1;
   unsubscribe();
   if(win&&typeof win.removeEventListener==="function")win.removeEventListener("pagehide",onPageHide);
   /* A ghost outliving its controller would sit over a cover at whatever
      opacity it had reached. Copy first: dropGhost splices the array. */
   fadeNodes.slice().forEach(dropGhost);
   cache.clear();
  }

  unsubscribe=theme.subscribe(onSnapshot);
  if(win&&typeof win.addEventListener==="function")win.addEventListener("pagehide",onPageHide);
  onSnapshot(theme.getSnapshot());
  return {destroy:destroy,request:request};
 }

 return {STATES:STATES,PROJECTS:PROJECTS,ORIGINALS:ORIGINALS,VARIANT_DIRS:VARIANT_DIRS,SIZES:SIZES,sourceFor:sourceFor,createController:createController};
});
