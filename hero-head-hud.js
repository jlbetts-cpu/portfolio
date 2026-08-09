/* ── TEMPORARY: HEAD PLACEMENT READOUT ───────────────────────────────────────
   Behind ?hud=1, matching the engine's existing dev flags (?wraf=1, ?hide=1).
   Default off and it returns before touching anything, so it cannot reach a
   visitor and costs nothing when absent.

   WHY IT DOES ARITHMETIC RATHER THAN JUST PRINTING NUMBERS. What Jayden
   manipulates and what we author are two different coordinate systems:
   dragging writes TRANSFORM (--hero-head-x/-y/-scale/-rotate), while the
   resting composition is LAYOUT (--hero-peek-width / --hero-peek-shift-x /
   --hero-peek-depth), deliberately, so reset() returns exactly home and the
   entrance lands on it. A readout of the raw transform would be useless for
   authoring. So the panel converts: place the head, read off the layout tokens
   that would MAKE that the resting position, copy, paste.

   IT READS STATE, IT DOES NOT PARTICIPATE IN IT. No clamping, no writing of
   any --hero-head-* value, no listeners on the transform beyond the public
   event. Deleting this file and its one <script> tag in index.html removes it
   completely.

   TO REMOVE: delete hero-head-hud.js and the single script line in index.html
   that loads it. Nothing else references it. */
(function(){
 "use strict";
 if(!/[?&]hud=1(&|$)/.test(location.search))return;

 var PANEL_ID="heroHeadHud";
 function px(v){return Math.round(v);}

 function ready(){
  var api=window.__heroHeadTransform;
  var wrap=document.getElementById("heroHeadTransform");
  var hero=document.getElementById("main");
  if(!api||!wrap||!hero){setTimeout(ready,120);return;}

  var panel=document.createElement("div");
  panel.id=PANEL_ID;
  panel.setAttribute("aria-live","off");
  /* Legible over all six skies, which means it cannot rely on either end of
     the range: a near-opaque dark slab carries the text, and a light hairline
     keeps its edge findable against night as well as noon. Top-right, clear of
     the head (bottom-left) and the CTAs (centre). */
  panel.style.cssText=[
   "position:fixed","top:12px","right:12px","z-index:99999",
   "font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
   "color:#f2f4f8","background:rgba(12,13,16,.92)",
   "border-radius:10px","padding:10px 12px",
   "box-shadow:0 0 0 1px rgba(255,255,255,.28),0 6px 22px rgba(0,0,0,.45)",
   "min-width:272px","pointer-events:auto","user-select:text",
   "-webkit-backdrop-filter:blur(6px)","backdrop-filter:blur(6px)"
  ].join(";");
  document.body.appendChild(panel);

  /* --hero-peek-offset is a token, and a custom property's computed value is
     an unresolved token stream, so it cannot simply be parsed. A throwaway
     probe resolves it to real pixels without touching the head. */
  function resolveLength(expr){
   var probe=document.createElement("div");
   probe.style.cssText="position:absolute;visibility:hidden;height:"+expr;
   wrap.parentNode.appendChild(probe);
   var v=probe.getBoundingClientRect().height;
   probe.remove();
   return v;
  }

  function layoutNow(){
   /* offsetLeft/offsetTop/offsetWidth are LAYOUT -- unaffected by the
      transform the head is currently carrying, which is exactly what is
      needed to recover the authored values. */
   var parent=wrap.offsetParent||wrap.parentNode;
   var ph=parent.getBoundingClientRect().height;
   var offset=resolveLength("var(--hero-peek-offset)");
   return {
    width:wrap.offsetWidth,
    shiftX:wrap.offsetLeft-parent.getBoundingClientRect().width/2,
    /* bottom:calc(depth * -1 + offset) => offsetTop = H - h + depth - offset */
    depth:wrap.offsetTop-ph+wrap.offsetHeight+offset,
    offset:offset
   };
  }

  /* The same rule hero-head-transform.js clamps against, applied to where the
     head WOULD rest if the current position were baked in. A HUD that reported
     a position the clamp will not allow would hide exactly the bug class that
     already cost this project a round -- the resting position being illegal
     under its own clamp. */
  function legality(box){
   var h=hero.getBoundingClientRect();
   var bar=document.querySelector(".jbStick .jbNav")||document.querySelector(".jbStick");
   var ceiling=0;
   if(bar){var b=bar.getBoundingClientRect();
    if(b.bottom>h.top&&b.top<h.bottom&&b.width>0)ceiling=Math.min(b.bottom,h.bottom)-h.top;}
   var share=parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue("--hero-head-min-visible"))||.42;
   var gap=parseFloat(getComputedStyle(hero).getPropertyValue("--hero-head-safe-gap"))||0;
   var needX=Math.min(Math.max(box.width*share,gap),h.width);
   var needY=Math.min(Math.max(box.height*share,gap),Math.max(1,h.height-ceiling));
   var visX=Math.min(box.right,h.width)-Math.max(box.left,0);
   var visY=Math.min(box.bottom,h.height)-Math.max(box.top,ceiling);
   return {ok:visX>=needX-.5&&visY>=needY-.5,
    visX:visX,needX:needX,visY:visY,needY:needY};
  }

  var lastTokens="";
  function render(){
   var st=api.getState();
   var L=layoutNow();
   var mobile=innerWidth<=760;
   /* Scale is about the head's own centre, so it changes the head's SIZE but
      not where its centre sits -- width and shift convert independently. */
   var newWidth=px(L.width*st.scale);
   var newShift=px(L.shiftX+st.x);
   /* bottom is negative depth, so dragging up (negative y) means hanging less. */
   var newDepth=px(L.depth+st.y);
   var leg=st.box?legality(st.box):null;

   var tokens=
    "--hero-peek-width:"+newWidth+"px;\n"+
    "--hero-peek-shift-x:"+newShift+"px;\n"+
    "--hero-peek-depth:"+newDepth+"px;";
   lastTokens=tokens;

   panel.innerHTML=""+
    "<div style='font-weight:700;letter-spacing:.04em'>HEAD PLACEMENT &nbsp;<span style='opacity:.6;font-weight:400'>?hud=1</span></div>"+
    "<div style='opacity:.62;margin:2px 0 7px'>viewport "+innerWidth+"×"+innerHeight+
      " — "+(mobile?"MOBILE rung (≤760)":"DESKTOP rung (&gt;760)")+"</div>"+

    "<div style='opacity:.62'>live transform</div>"+
    "<div>x "+st.x.toFixed(1)+" &nbsp; y "+st.y.toFixed(1)+
      " &nbsp; scale "+st.scale.toFixed(3)+" &nbsp; rot "+st.rotate.toFixed(1)+"°</div>"+

    "<div style='opacity:.62;margin-top:7px'>paste these to move the resting position here</div>"+
    "<pre id='hudTokens' style='margin:3px 0 0;white-space:pre;font:inherit'>"+tokens+"</pre>"+

    (leg?("<div style='margin-top:7px;padding:4px 6px;border-radius:6px;"+
      (leg.ok?"background:rgba(40,150,90,.28);color:#c6f4d8"
             :"background:rgba(190,60,60,.32);color:#ffd6d6")+"'>"+
      (leg.ok?"LEGAL under the reachability clamp"
             :"ILLEGAL — the clamp will not let the head rest here")+
      "<br><span style='opacity:.8'>visible x "+px(leg.visX)+"/"+px(leg.needX)+
      " &nbsp; y "+px(leg.visY)+"/"+px(leg.needY)+" needed</span></div>"):"")+

    "<div style='opacity:.62;margin-top:7px'>defaults</div>"+
    "<div style='opacity:.85'>desktop 336px / -136px<br>"+
      "≤760 clamp(206px, 100vw-112px, 336px) / -42px<br>"+
      "depth = 40% of width &nbsp; scale .24–2.2, rest 1</div>"+
    (st.rotate?"<div style='margin-top:6px;color:#ffe1a8'>rotation is not part of the resting composition — "+
      "the head rests level, so "+st.rotate.toFixed(1)+"° will not be baked in.</div>":"")+

    "<button id='hudCopy' style='margin-top:8px;width:100%;min-height:30px;"+
      "font:inherit;color:#0c0d10;background:#f2f4f8;border:0;border-radius:7px;"+
      "cursor:pointer'>Copy tokens</button>";

   panel.querySelector("#hudCopy").addEventListener("click",function(){
    var btn=this;
    var done=function(ok){btn.textContent=ok?"Copied":"Select the text above";};
    try{
     navigator.clipboard.writeText(lastTokens).then(function(){done(true);},function(){done(false);});
    }catch(e){done(false);}
    setTimeout(function(){btn.textContent="Copy tokens";},1400);
   });
  }

  render();
  /* The transform module already announces every change; the HUD listens
     rather than polling, and adds a resize hook because the resting tokens
     fork at 760. */
  addEventListener("heroheadtransform",render);
  addEventListener("resize",render);
  /* The float moves the head continuously without firing that event, so a slow
     tick keeps the readout honest without a per-frame cost. */
  setInterval(render,250);
 }

 if(document.readyState==="loading")
  addEventListener("DOMContentLoaded",ready);
 else ready();
})();
