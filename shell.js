/* ===========================================================================
   shell.js -- the home system's small hands.  2026-08-18, final shape.

   THE SIDEBAR IS GONE. Jayden, twice: "maybe I dont even want the side bar
   anymore" and then "you added the side bar back which is not what I asked
   for." What he kept from the React home is the ICON, not the rail: the
   white mark floating at the band's top-left, an invisible header. This
   file no longer injects any rail; it does four small jobs:

   1. THE MARK on the home band -- a plain link home, white over the
      gradient. Nothing expands. (The pill bar is hidden on home desktop and
      REDESIGNED, not hidden, everywhere else -- home-shell.css owns that.)
   2. FRESH COVERS -- the card grid loads the 12-variant time cover for the
      hero's current state, re-pointed when the state changes, with the base
      cover as fallback. (The legacy thumbnail engine's choreography left one
      cover per load decoded-but-unpainted in a grid; its full story is in
      git 5a3648c..ec30b10.)
   3. THE DESCRIPTION LINE under each card title -- the React card he chose
      carries one; the vanilla meta row had title+year only.
   4. FEATURED RETIRES -- "just case studies and extras": the Case Studies
      tab becomes the landing view; the Featured button hides (CSS pins it
      too, because the tab engine rebuilds its row after DCL -- measured).

   Old localStorage("jbSideOpen") is cleaned up so no stale state survives.
   Desktop only where it touches layout; the mobile page is untouched.
   =========================================================================== */
(function(){
"use strict";
if(!window.matchMedia||!matchMedia("(min-width:961px)").matches)return;
try{localStorage.removeItem("jbSideOpen");}catch(e){}

var LOGO='<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M9.38 6.33Q8.81 5.88 8.81 5.22Q8.81 4.56 9.02 4.11Q9.23 3.66 9.64 3.34Q10.5 2.65 12.08 2.65Q13.59 2.65 14.07 3.87Q14.22 4.22 14.22 4.65Q14.22 5.08 13.87 5.48Q13.53 5.88 13.01 6.16Q12.49 6.45 11.89 6.6Q11.29 6.76 10.82 6.76Q10.36 6.76 10.01 6.65Q9.66 6.54 9.38 6.33ZM6.68 20.73Q6.26 22.35 5.92 23.6Q5.57 24.85 5.15 25.72Q4.73 26.58 4.16 27.03Q3.58 27.48 2.86 27.48Q2.15 27.48 1.71 27.32Q1.27 27.16 0.93 26.92Q0.24 26.43 0 25.82Q1.03 25 5.29 16.53Q7.69 11.74 8.78 9.81Q9.23 9.01 9.95 9.01Q10.36 9.01 10.89 9.28Q8.94 13.14 7.63 17.43Q10.21 16.98 12.48 15.01Q13.18 14.4 13.62 13.74Q14.22 13.7 14.22 14.23Q14.22 14.44 13.89 15.23Q13.57 16.01 12.77 17.03Q11.98 18.05 10.99 18.81Q9.06 20.31 6.68 20.73ZM19.4 10.16Q21.18 9.11 22.86 9.11Q25.54 9.11 26.23 11.15Q26.45 11.78 26.45 12.71Q26.45 14.72 24.96 16.86Q26.21 16.68 27.37 15.87Q28.54 15.05 29.4 13.74Q30 13.7 30 14.23Q30 14.44 29.87 14.75Q27.35 20.86 17.63 20.86H17.6Q15.81 20.86 14.64 19.81Q13.37 18.66 13.37 16.59Q13.37 14.05 18.01 7.39Q19.97 4.55 21.37 2.96Q21.75 2.52 22.4 2.52Q23.12 2.52 23.45 3.05Q20.72 7.33 19.4 10.16ZM18.04 13.83Q17.86 14.67 17.86 15.24Q17.86 15.81 18.21 16.2Q18.55 16.59 19.1 16.59Q19.66 16.59 20.23 16.4Q20.8 16.21 21.34 15.88Q21.88 15.54 22.37 15.1Q22.86 14.66 23.24 14.14Q24.03 13.02 24.03 12.03Q24.03 11.39 23.71 11.06Q23.18 10.5 22.53 10.5Q21.87 10.5 21.19 10.78Q20.52 11.05 19.92 11.51Q18.63 12.48 18.04 13.83Z"/></svg>';

/* 1 · the mark, home only */
if(document.body.getAttribute("data-nav")==="home"){
 var mark=document.createElement("a");
 mark.className="jbHomeMark";
 mark.href="index.html";
 mark.setAttribute("aria-label","Jayden Betts, home");
 mark.innerHTML=LOGO;
 document.body.appendChild(mark);
}

/* 2+3 · fresh time covers + the description line */
var VARIANT_BASE="images/cs/variants/time/";
var ORIGINALS={
 bearings:"images/cs/bearings-cover.webp",
 apollo:"images/cs/apollo-cover.webp",
 cluster:"images/cs/cluster/cluster-cover.webp",
 strata:"images/cs/strata-cover.webp",
 ucrec:"images/cs/ucrec/cover.webp"
};
var LINES={
 bearings:"Group trips without the group-chat chaos.",
 apollo:"An ADHD-native social app with no streaks, no counts, and no color.",
 cluster:"Find your people at a school of 40,000.",
 strata:"Habits that stack into a tower you built.",
 ucrec:"Campus recreation, redesigned end to end."
};
function coverState(){
 var hero=document.querySelector(".surface--hero");
 var st=hero&&hero.getAttribute("data-time-state");
 return (st&&st!=="off")?st:"daytime";
}
function freshCovers(){
 var state=coverState();
 var imgs=document.querySelectorAll(".csPanel .csImg");
 for(var i=0;i<imgs.length;i++){
  (function(old){
   var item=old.closest?old.closest(".csItem"):null;
   var slug=item&&item.getAttribute("data-slug");
   if(!slug)return;
   if(slug==="ucdavis")slug="ucrec";
   var im=old.__jbFresh?old:document.createElement("img");
   im.className="csImg";
   im.alt=old.alt||"";
   im.decoding="async";
   im.__jbFresh=true;
   im.onerror=function(){if(ORIGINALS[slug])im.src=ORIGINALS[slug];im.onerror=null;};
   im.src=VARIANT_BASE+slug+"/"+state+"-1200.webp";
   if(im!==old&&old.parentNode)old.parentNode.replaceChild(im,old);
   /* the description line, once */
   var meta=item.querySelector(".csMeta");
   var name=meta&&meta.querySelector(".csName");
   if(meta&&name&&!meta.querySelector(".csLine")&&LINES[slug]){
    var line=document.createElement("span");
    line.className="csLine";
    line.textContent=LINES[slug];
    name.insertAdjacentElement("afterend",line);
   }
  })(imgs[i]);
 }
}
/* the sun wears its state name, like the React control ("Daytime") */
var STATE_LABEL={"pre-dawn":"Pre-dawn",sunrise:"Sunrise",daytime:"Daytime",dusk:"Dusk",sunset:"Sunset",night:"Night",off:"Off"};
function labelSun(){
 var btn=document.querySelector(".heroTimeBtn");
 if(!btn)return;
 var lbl=btn.querySelector(".jbTimeLbl");
 if(!lbl){lbl=document.createElement("span");lbl.className="jbTimeLbl";btn.appendChild(lbl);}
 lbl.textContent=STATE_LABEL[coverState()]||"Daytime";
}

function watchCovers(){
 freshCovers();
 labelSun();
 var hero=document.querySelector(".surface--hero");
 if(hero&&window.MutationObserver){
  new MutationObserver(function(){freshCovers();labelSun();}).observe(hero,{attributes:true,attributeFilter:["data-time-state"]});
 }
}

/* 4 · Featured retires; Case Studies greets */
function retireFeatured(){
 var cs=document.querySelector('.csTab[data-tab="cs"]');
 var fun=document.querySelector('.csTab[data-tab="fun"]');
 if(!cs||!fun)return;
 cs.style.display="none";
 if(cs.classList.contains("on"))fun.click();
}

/* the control row: the time menu moves INTO the tab row so both sit on the
   same measured box -- alignment by construction, not by matching numbers
   (measured 9px/24px drift when they lived in different parents) */
function unifyControlRow(){
 var ctas=document.querySelector(".surface--hero .heroCtas");
 var tabs=document.querySelector(".cases nav.csTabs");
 if(ctas&&tabs&&ctas.parentElement!==tabs)tabs.insertBefore(ctas,tabs.firstChild);
}

function boot(){
 watchCovers();
 unifyControlRow();
 /* after LOAD: the tab engine builds late and a click before its listeners
    exist switches nothing (measured) */
 window.addEventListener("load",function(){setTimeout(retireFeatured,120);});
 retireFeatured();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
