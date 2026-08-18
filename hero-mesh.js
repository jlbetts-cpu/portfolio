/* ===========================================================================
   THE MERGE.  2026-08-18. Jayden: "on the hero of the index there is a
   gradient for the time of day -- add the ACTUAL gradient there and change it
   for the time of day, a merge of both."

   Both halves already existed and had never met: fluid-mesh.js is the site's
   own WebGL gradient (the Lab's engine, the workspace's look), and
   hero-time-presets.js has carried a full FluidMesh config PER TIME STATE --
   colors, nodes, melt, flow, glow -- since it was written, consumed by nobody.
   This file is only the introduction: a canvas inside #heroTimeClip, the
   preset for the current data-time-state, and a MutationObserver so the mesh
   follows the site's clock exactly like the radial layers under it do.

   DEGRADATION IS THE RADIALS. The canvas sits over the authored radial
   gradients; no WebGL (FluidMesh returns null) or any error and the canvas
   is removed, leaving the hero exactly as it shipped yesterday. That is why
   the radial layers are NOT deleted.

   THE ENTRANCE lives here too: <head> adds html.jbHeroIntro before first
   paint (full-bleed hero, square corners); this file releases it after the
   fonts settle, and hero-time.css transitions min-height and radius on
   --ease-out -- the gradient arrives full-screen and settles into the softer
   shape. Reduced motion never gets the class, so there is nothing to release.
   =========================================================================== */
(function(){
"use strict";

function release(){
 var root=document.documentElement;
 root.className=root.className.replace(/\s*jbHeroIntro/g,"");
}

function boot(){
 var hero=document.querySelector(".surface--hero");
 var clip=document.getElementById("heroTimeClip");

 /* the settle: one beat after load so the full-screen frame is actually seen */
 if(document.documentElement.className.indexOf("jbHeroIntro")!==-1){
  setTimeout(release,650);
 }

 if(!hero||!clip||!window.FluidMesh||!window.HeroTimeModel)return;
 var PRESETS=window.HeroTimeModel.PRESETS;
 if(!PRESETS)return;

 var canvas=document.createElement("canvas");
 canvas.className="heroMeshCanvas";
 canvas.setAttribute("aria-hidden","true");
 clip.appendChild(canvas);

 /* HERO TUNE -- palettes and layout, per state.
    The Lab presets are dark-based cinema (uCol[0] paints the whole frame);
    every hero state except night keeps INK text (--time-ink:var(--c950)), and
    the sunset preset's #19172B base drowned the headline. LOOKED at, twice.
    The radial layers already solved this: their stop lists are light-biased
    by construction. So the mesh borrows each state's AUTHORED radial stops --
    same sky, now alive -- with uCol[0] as the page-light base. Night keeps
    its preset colours (the theme flips to light-on-dark there, and it was
    the best-looking state untouched).
    LAYOUT: one shared composition instead of the presets' L-to-R ramp, which
    bunched all visible chroma right-of-centre at hero aspect: a white feather
    up top to soften the band edge, the saturated core low centre-left, and
    lighter tails reaching both edges. */
 var HERO_COLORS={
  "pre-dawn":["#f8fafd","#486ffd","#7f81f3","#c489ff","#dac0ff"],
  sunrise:["#f8fafd","#cb83ff","#ff90b9","#ffc977","#ffd79b"],
  daytime:["#f8fafd","#0071c1","#60a8e2","#b4d8ff","#d9ebff"],
  dusk:["#f8fafd","#ffb36a","#dfa0d8","#9da8e4","#ccd5f0"],
  sunset:["#f8fafd","#ffa577","#ff90a1","#ddadff","#ecd8ff"],
  night:["#050810","#1D4A93","#102A58","#0A1530","#6FA9FF"]
 };
 var HERO_NODES=[
  {x:.50,y:.55,size:.70,len:.30,ang:.04},
  {x:.38,y:1.02,size:.80,len:.26,ang:-.08},
  {x:.68,y:.96,size:.72,len:.22,ang:.12},
  {x:.16,y:.92,size:.60,len:.18,ang:-.16},
  {x:.88,y:.90,size:.58,len:.16,ang:.18}
 ];
 function tune(state){
  var c=JSON.parse(JSON.stringify(PRESETS[state]||PRESETS.daytime));
  c.colors=(HERO_COLORS[state]||HERO_COLORS.daytime).slice();
  c.nodes=JSON.parse(JSON.stringify(HERO_NODES));
  c.glow*=.9;
  return c;
 }

 var current=hero.getAttribute("data-time-state")||"daytime";
 var cfg=tune(current);
 var mesh=null;
 try{
  mesh=new FluidMesh(canvas,cfg);
 }catch(err){mesh=null;}
 if(!mesh){
  if(canvas.parentNode)canvas.parentNode.removeChild(canvas);
  return;
 }

 new MutationObserver(function(){
  var state=hero.getAttribute("data-time-state");
  if(state&&state!==current&&PRESETS[state]){
   current=state;
   try{mesh.set(tune(state));}catch(err){}
  }
 }).observe(hero,{attributes:true,attributeFilter:["data-time-state"]});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
