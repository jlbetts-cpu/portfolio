/* ===========================================================================
   shell.js -- the workspace sidebar, one source for every page.  2026-08-18.

   Jayden: "still not the same as the lifeline workspace in sizing and spacing
   and not collapsible plus other tabs need the same care."

   This is app-shell.tsx's sidebar rebuilt in ES5, to its own numbers: 272px
   open, items 9px 12px at 13px/500 on a 4px radius, ink pill when active,
   px-4 blocks, the top block's MEASURED height published as --band-h so the
   home band's floor rides the divider exactly (the workspace's own trick).
   Collapse is the workspace gesture verbatim: hover the mark and it becomes
   the panel icon in place, click and the rail closes to nothing (360ms on
   the settle curve); collapsed, the mark stays fixed where it always was --
   white over the home band, ink past it -- and clicking it reopens.
   State persists in localStorage("jbSideOpen"). Desktop only: under 961px
   this script does nothing and the pill-bar page is untouched.

   Runs SYNCHRONOUSLY right after <body> opens so the sidebar exists at first
   paint -- home-shell.css reserves the column with body padding at the same
   width, so nothing pops.
   =========================================================================== */
(function(){
"use strict";
if(!window.matchMedia||!matchMedia("(min-width:961px)").matches)return;

var LOGO='<svg class="jbSideMark" viewBox="0 0 30 30" aria-hidden="true"><path d="M9.38 6.33Q8.81 5.88 8.81 5.22Q8.81 4.56 9.02 4.11Q9.23 3.66 9.64 3.34Q10.5 2.65 12.08 2.65Q13.59 2.65 14.07 3.87Q14.22 4.22 14.22 4.65Q14.22 5.08 13.87 5.48Q13.53 5.88 13.01 6.16Q12.49 6.45 11.89 6.6Q11.29 6.76 10.82 6.76Q10.36 6.76 10.01 6.65Q9.66 6.54 9.38 6.33ZM6.68 20.73Q6.26 22.35 5.92 23.6Q5.57 24.85 5.15 25.72Q4.73 26.58 4.16 27.03Q3.58 27.48 2.86 27.48Q2.15 27.48 1.71 27.32Q1.27 27.16 0.93 26.92Q0.24 26.43 0 25.82Q1.03 25 5.29 16.53Q7.69 11.74 8.78 9.81Q9.23 9.01 9.95 9.01Q10.36 9.01 10.89 9.28Q8.94 13.14 7.63 17.43Q10.21 16.98 12.48 15.01Q13.18 14.4 13.62 13.74Q14.22 13.7 14.22 14.23Q14.22 14.44 13.89 15.23Q13.57 16.01 12.77 17.03Q11.98 18.05 10.99 18.81Q9.06 20.31 6.68 20.73ZM19.4 10.16Q21.18 9.11 22.86 9.11Q25.54 9.11 26.23 11.15Q26.45 11.78 26.45 12.71Q26.45 14.72 24.96 16.86Q26.21 16.68 27.37 15.87Q28.54 15.05 29.4 13.74Q30 13.7 30 14.23Q30 14.44 29.87 14.75Q27.35 20.86 17.63 20.86H17.6Q15.81 20.86 14.64 19.81Q13.37 18.66 13.37 16.59Q13.37 14.05 18.01 7.39Q19.97 4.55 21.37 2.96Q21.75 2.52 22.4 2.52Q23.12 2.52 23.45 3.05Q20.72 7.33 19.4 10.16ZM18.04 13.83Q17.86 14.67 17.86 15.24Q17.86 15.81 18.21 16.2Q18.55 16.59 19.1 16.59Q19.66 16.59 20.23 16.4Q20.8 16.21 21.34 15.88Q21.88 15.54 22.37 15.1Q22.86 14.66 23.24 14.14Q24.03 13.02 24.03 12.03Q24.03 11.39 23.71 11.06Q23.18 10.5 22.53 10.5Q21.87 10.5 21.19 10.78Q20.52 11.05 19.92 11.51Q18.63 12.48 18.04 13.83Z"/></svg>';
var PANEL='<svg class="jbSidePanelIco" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>';

function icon(use){return '<svg class="uiIcon" viewBox="0 0 24 24" aria-hidden="true"><use href="ui-icons.svg#'+use+'"/></svg>';}
var NOTEBOOK='<svg class="uiIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M16 2v20"/></svg>';

var NAV=[
 {id:"work",href:"index.html",label:"Work",ico:icon("lucide-briefcase-business")},
 {id:"about",href:"about.html",label:"About",ico:icon("lucide-user-round")},
 {id:"play",href:"play.html",label:"Play",ico:icon("lucide-gamepad-2")},
 {id:"workspace",href:"workspace/",label:"Workspace",ico:NOTEBOOK}
];
var MAP={home:"work",work:"work",about:"about",games:"play",play:"play"};
var active=MAP[document.body.getAttribute("data-nav")]||"";

var open=true;
try{open=localStorage.getItem("jbSideOpen")!=="0";}catch(e){}
if(!open)document.documentElement.className+=" jbSideClosed";

var aside=document.createElement("aside");
aside.className="jbSide";
aside.setAttribute("aria-label","Primary");
var items="";
for(var i=0;i<NAV.length;i++){
 var n=NAV[i];
 items+='<a class="jbSideItem'+(n.id===active?" is-active":"")+'" href="'+n.href+'"'+
  (n.id===active?' aria-current="page"':"")+'>'+n.ico+n.label+"</a>";
}
aside.innerHTML=
 '<div class="jbSideInner">'+
  '<div class="jbSideTop" id="jbSideTop">'+
   '<div class="jbSideLogoRow">'+
    '<button class="jbSideLogoBtn" id="jbSideCollapse" type="button" aria-label="Collapse sidebar">'+LOGO+PANEL+'</button>'+
   '</div>'+
   '<nav class="jbSideNav" aria-label="Site">'+items+'</nav>'+
  '</div>'+
  '<div class="jbSideBottom">'+
   '<a class="jbSideItem" href="mailto:jaydenlbetts@gmail.com">'+icon("lucide-mail")+'Contact</a>'+
   '<a class="jbSideItem" href="Jayden-Betts-Resume.pdf" target="_blank" rel="noopener noreferrer">'+icon("lucide-arrow-left")+'Résumé</a>'+
  '</div>'+
 '</div>';
document.body.insertBefore(aside,document.body.firstChild);

/* collapsed: the mark stays exactly where it always was and reopens the rail */
var expand=document.createElement("button");
expand.className="jbSideExpand";
expand.type="button";
expand.setAttribute("aria-label","Expand sidebar");
expand.innerHTML=LOGO+PANEL;
document.body.insertBefore(expand,aside.nextSibling);

function persist(){try{localStorage.setItem("jbSideOpen",open?"1":"0");}catch(e){}}
document.getElementById("jbSideCollapse").addEventListener("click",function(){
 open=false;document.documentElement.className+=" jbSideClosed";persist();
});
expand.addEventListener("click",function(){
 open=true;
 document.documentElement.className=document.documentElement.className.replace(/\s*jbSideClosed/g,"");
 persist();
});

/* --band-h: the top block's measured height, the workspace's own alignment
   trick -- the home band's floor and this divider are the same line */
var top=document.getElementById("jbSideTop");
function setBand(){
 document.documentElement.style.setProperty("--band-h",Math.round(top.getBoundingClientRect().height)+"px");
}
function whenReady(){
 setBand();
 if(window.ResizeObserver)new ResizeObserver(setBand).observe(top);
 window.addEventListener("resize",setBand);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",whenReady);
else whenReady();

/* over the home band the collapsed mark is white, past it ink -- measured
   against the live band height, like the workspace's scrolledPastBand */
function syncBand(){
 var onBand=document.body.getAttribute("data-nav")==="home"&&
  window.scrollY<(top.getBoundingClientRect().height-44);
 expand.className="jbSideExpand"+(onBand?" on-band":"");
}
window.addEventListener("scroll",syncBand,{passive:true});
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",syncBand);
else syncBand();
})();
