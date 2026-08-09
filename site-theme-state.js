(function(root,factory){
 var api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(root)root.SiteThemeState=api;
})(typeof window!=="undefined"?window:globalThis,function(){
 "use strict";

 var MODES=Object.freeze(["auto","off","pre-dawn","sunrise","daytime","dusk","sunset","night"]);
 var STATES=Object.freeze(MODES.slice(2));
 var BOUNDARIES=[4*60,6*60,9*60,17*60,18*60+30,20*60+30];
 /* ── WHAT AN UNVISITED PAGE RENDERS ─────────────────────────────────────────
    It was "auto": the sky followed the visitor's own clock. Lovely idea, wrong
    first impression -- a recruiter opening this at 11pm landed on the near-black
    hero, which is the least legible state and the one every lighting subtlety is
    hardest to see in. Daytime is the legible baseline: brightest sky, clearest
    type contrast, and the state the work reads fastest against. Discovering the
    other five then becomes a reward rather than a lottery decided by the hour
    someone happened to click the link.
    "auto" is DEMOTED, NOT REMOVED: it is still in the menu, it still follows the
    real clock, and someone who picks it still gets their own hour. What changed
    is only what happens when nobody has chosen. That distinction is why
    site-theme.js now WRITES "auto" to storage instead of representing it by the
    key's absence -- absence used to mean auto, and it has to mean "has not
    chosen" for a default to exist at all.
    normalizeMode still answers "auto" for garbage on purpose. This names the
    absence of a preference; that names an unreadable one, and they are not the
    same question. */
 var DEFAULT_MODE="daytime";

 function normalizeMode(value){
  return MODES.indexOf(value)!==-1?value:"auto";
 }

 function resolveAutomatic(date){
  var minutes=date.getHours()*60+date.getMinutes();
  if(minutes<4*60||minutes>=20*60+30)return "night";
  if(minutes<6*60)return "pre-dawn";
  if(minutes<9*60)return "sunrise";
  if(minutes<17*60)return "daytime";
  if(minutes<18*60+30)return "dusk";
  return "sunset";
 }

 function resolveState(mode,date){
  var normalized=normalizeMode(mode);
  return normalized==="auto"?resolveAutomatic(date):normalized;
 }

 function themeForState(state){
  return state==="night"?"dark":"light";
 }

 function resolveSnapshot(mode,date){
  var normalized=normalizeMode(mode);
  var state=resolveState(normalized,date);
  return Object.freeze({mode:normalized,state:state,theme:themeForState(state)});
 }

 function msUntilNextBoundary(date){
  var current=date.getTime();
  var next;
  BOUNDARIES.forEach(function(boundary){
   var candidate=new Date(date.getFullYear(),date.getMonth(),date.getDate(),0,boundary,0,0);
   if(candidate.getTime()<=current)candidate.setDate(candidate.getDate()+1);
   if(!next||candidate.getTime()<next.getTime())next=candidate;
  });
  return next.getTime()-current;
 }

 return {MODES:MODES,STATES:STATES,DEFAULT_MODE:DEFAULT_MODE,normalizeMode:normalizeMode,resolveAutomatic:resolveAutomatic,resolveState:resolveState,themeForState:themeForState,resolveSnapshot:resolveSnapshot,msUntilNextBoundary:msUntilNextBoundary};
});
