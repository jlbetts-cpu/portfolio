/* ===========================================================================
   THE LIFELINE GRADIENT, VERBATIM.  2026-08-18, second pass.

   The first pass mounted fluid-mesh.js (the Lab's engine) with the time
   presets. Jayden: "that is not the same gradient... some of the gradients
   look blurry and not premium." He is right -- FluidMesh paints huge soft
   Gaussians; the Lifeline band is a DIFFERENT shader: six drifting control
   points sharpened by domain-warped simplex noise, a 1.34 saturation lift, a
   soft vignette and in-shader dither. That crispness is the look.

   So this file is that shader, ported line-for-line from
   lifeline/src/components/hero-backdrop.tsx (buildFrag + useMeshGL) to ES5.
   React was never the ingredient -- the shader is a string and the driver is
   raw WebGL there too. Same control-point drift, same warp, same ripple that
   follows the pointer, same grain. What changes per time-of-day is ONLY the
   six colours + base, exactly how Lifeline swaps palettes per month: the
   palettes below are each state's AUTHORED radial stops (light-biased so the
   ink headline survives; night stays dark because night flips the theme).
   Saturated stops sit on the three LOW control points, pale ones on the three
   high points, so the colour mass lives at the floor like the radials.

   The radial layers under the canvas remain the no-WebGL fallback. The
   entrance (html.jbHeroIntro, released here) is unchanged from pass one.
   The head and mini-head animations belong to hero-engine.js /
   hero-head-transform.js and are not touched by any of this.
   =========================================================================== */
(function(){
"use strict";

/* points: bx,by base; ax,ay drift amplitude; fx,fy drift freq; ph,p2 phase.
   VERBATIM from hero-backdrop.tsx. Points 0-2 ride high, 3-5 ride low. */
var POINTS=[
 {bx:.66,by:.24,ax:.20,ay:.16,fx:1.6,fy:1.9,ph:0.0,p2:1.3},
 {bx:.90,by:.40,ax:.18,ay:.16,fx:2.1,fy:1.5,ph:1.7,p2:0.4},
 {bx:.22,by:.30,ax:.20,ay:.15,fx:1.4,fy:2.0,ph:2.6,p2:2.0},
 {bx:.58,by:.66,ax:.22,ay:.16,fx:2.3,fy:1.7,ph:0.7,p2:2.6},
 {bx:.86,by:.78,ax:.18,ay:.16,fx:2.0,fy:1.6,ph:3.1,p2:1.5},
 {bx:.30,by:.80,ax:.23,ay:.17,fx:1.7,fy:2.1,ph:4.2,p2:0.8}
];
var MESH_K=6.2,CREAM_W=.06;
var HEAT=[1,.74,.55,1,.72,.70]; /* per-point weight the ASCII field reads */
var RAMP=[" "," ","·",":","-","+","=","*","#"];

/* ── the palette generator, ported from lifeline/src/lib/palette.ts ────────
   make() turns ONE brand hex into the six control-point colours + base via
   HSL shades -- the exact recipe the workspace band uses (January Glacier is
   make("#64a5dd") and daytime here is that call verbatim). Time-of-day is
   one brand hue per state through the same recipe, which is precisely how
   Lifeline does months. Night is hand-held darker: the formula's pale base
   would glow in a dark room. */
function hexRgb(hex){var n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255];}
function rgbHsl(c){
 var r=c[0]/255,g2=c[1]/255,b=c[2]/255;
 var mx=Math.max(r,g2,b),mn=Math.min(r,g2,b),l=(mx+mn)/2;
 if(mx===mn)return[0,0,l];
 var d=mx-mn,s=l>.5?d/(2-mx-mn):d/(mx+mn),h;
 if(mx===r)h=((g2-b)/d+(g2<b?6:0))*60;
 else if(mx===g2)h=((b-r)/d+2)*60;
 else h=((r-g2)/d+4)*60;
 return[h,s,l];
}
function hslRgb(c){
 var h=c[0],s=c[1],l=c[2];
 function f(n){var k=(n+h/30)%12;var a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1));}
 return[f(0)*255,f(8)*255,f(4)*255];
}
function shade(hex,dl,ds){
 var h=rgbHsl(hexRgb(hex));
 return hslRgb([h[0],Math.max(0,Math.min(1,h[1]+(ds||0))),Math.max(0,Math.min(1,h[2]+dl))]);
}
function rgbHex(c){
 var out="#";
 for(var i=0;i<3;i++){var v=Math.round(Math.max(0,Math.min(255,c[i]))).toString(16);out+=v.length===1?"0"+v:v;}
 return out;
}
function make(brand){
 return{
  base:rgbHex(shade(brand,.44,-.20)),
  mesh:[
   brand,
   rgbHex(shade(brand,.13,.02)),
   rgbHex(shade(brand,.30,-.06)),
   rgbHex(shade(brand,-.14,.10)),
   rgbHex(shade(brand,.19,0)),
   rgbHex(shade(brand,.07,.04))
  ]
 };
}
var PALETTES={
 "pre-dawn":make("#7a82e0"),
 sunrise:make("#ec9d57"),
 daytime:make("#64a5dd"), /* January Glacier -- the workspace band, verbatim */
 dusk:make("#9d82d8"),
 sunset:make("#ee7b4f"),
 night:{base:"#0a1428",mesh:["#1d4a93","#2c5bb0","#16224a","#0f1b3d","#243d7a","#1a2f61"]}
};

/* the ASCII field reads the SAME control points as the gradient */
function warmth(nx,ny,t){
 var num=0,den=CREAM_W;
 for(var i=0;i<POINTS.length;i++){
  var p=POINTS[i];
  var dx=nx-(p.bx+p.ax*Math.sin(t*p.fx+p.ph));
  var dy=ny-(p.by+p.ay*Math.cos(t*p.fy+p.p2));
  var wt=Math.exp(-(dx*dx+dy*dy)*MESH_K);
  num+=wt*HEAT[i];den+=wt;
 }
 return num/den;
}

var GRAIN="data:image/svg+xml,"+encodeURIComponent(
 "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.0' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>");

function vec3(hex){
 var n=parseInt(hex.slice(1),16);
 return (((n>>16)&255)/255).toFixed(4)+","+(((n>>8)&255)/255).toFixed(4)+","+((n&255)/255).toFixed(4);
}
function g(n){return n.toFixed(4);}

var VERT="attribute vec2 a_pos; void main(){ gl_Position=vec4(a_pos,0.0,1.0); }";

function buildFrag(pal){
 var accum="";
 for(var i=0;i<POINTS.length;i++){
  var p=POINTS[i];
  accum+="{ vec2 d=w-vec2("+g(p.bx)+"+"+g(p.ax)+"*sin(t*"+g(p.fx)+"+"+g(p.ph)+"),"+
   g(p.by)+"+"+g(p.ay)+"*cos(t*"+g(p.fy)+"+"+g(p.p2)+")); wt=exp(-dot(d,d)*"+g(MESH_K)+
   "); num+=wt*vec3("+vec3(pal.mesh[i])+"); den+=wt; }\n";
 }
 return "precision highp float;\n"+
 "uniform vec2 u_res; uniform float u_time; uniform vec2 u_mouse; uniform float u_mact;\n"+
 "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}\n"+
 "vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}\n"+
 "vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}\n"+
 "float snoise(vec2 v){\n"+
 " const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);\n"+
 " vec2 i=floor(v+dot(v,C.yy));\n"+
 " vec2 x0=v-i+dot(i,C.xx);\n"+
 " vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);\n"+
 " vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1;\n"+
 " i=mod289(i);\n"+
 " vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));\n"+
 " vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);\n"+
 " m=m*m; m=m*m;\n"+
 " vec3 x=2.0*fract(p*C.www)-1.0;\n"+
 " vec3 h=abs(x)-0.5;\n"+
 " vec3 ox=floor(x+0.5);\n"+
 " vec3 a0=x-ox;\n"+
 " m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);\n"+
 " vec3 gg;\n"+
 " gg.x=a0.x*x0.x+h.x*x0.y;\n"+
 " gg.yz=a0.yz*x12.xz+h.yz*x12.yw;\n"+
 " return 130.0*dot(m,gg);\n"+
 "}\n"+
 "float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<4;i++){ v+=a*snoise(p); p=p*2.0+17.3; a*=0.5; } return v; }\n"+
 "float hash21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }\n"+
 "float ign(vec2 p){ return fract(52.9829189*fract(0.06711056*p.x+0.00583715*p.y)); }\n"+
 "void main(){\n"+
 " vec2 uv=vec2(gl_FragCoord.x,u_res.y-gl_FragCoord.y)/u_res.xy;\n"+
 " float t=u_time*0.10;\n"+
 " float breath=1.0+0.13*sin(u_time*0.45);\n"+
 " vec2 uvb=(uv-0.5)*(1.0+0.05*sin(u_time*0.4))+0.5;\n"+
 " vec2 q=vec2(fbm(uvb*2.3+t),fbm(uvb*2.3+vec2(5.2,1.3)-t));\n"+
 " vec2 warp=vec2(fbm(uvb*2.3+1.7*q+t*0.6),fbm(uvb*2.3+1.7*q+vec2(3.7,1.9)-t))*(0.26*breath);\n"+
 " vec2 w=uvb+warp;\n"+
 " float mdist=distance(uv,u_mouse);\n"+
 " float ripple=sin(mdist*26.0-u_time*3.2)*exp(-mdist*5.0)*u_mact*0.065;\n"+
 " w+=(mdist>0.0001?normalize(uv-u_mouse):vec2(0.0))*ripple;\n"+
 " vec3 num=vec3("+vec3(pal.base)+")*"+g(CREAM_W)+"; float den="+g(CREAM_W)+"; float wt;\n"+
 accum+
 " { vec2 d=w-u_mouse; wt=u_mact*exp(-dot(d,d)*"+g(MESH_K)+")*1.3; num+=wt*vec3("+vec3(pal.mesh[3])+"); den+=wt; }\n"+
 " vec3 col=num/den;\n"+
 " float lum=dot(col,vec3(0.299,0.587,0.114));\n"+
 " col=clamp(mix(vec3(lum),col,1.34),0.0,1.0);\n"+
 " float dd=distance(uv,vec2(0.5,0.44));\n"+
 " col*=1.0-smoothstep(0.80,1.30,dd)*0.07;\n"+
 " col+=(hash21(gl_FragCoord.xy+fract(u_time))-0.5)*0.018;\n"+
 " col+=(ign(gl_FragCoord.xy+mod(u_time*57.0,8.0))-0.5)*(2.5/255.0);\n"+
 " gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);\n"+
 "}";
}

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

 if(!hero||!clip)return;

 var canvas=document.createElement("canvas");
 canvas.className="heroMeshCanvas";
 canvas.setAttribute("aria-hidden","true");
 clip.appendChild(canvas);

 var gl=canvas.getContext("webgl",{antialias:false,alpha:false,depth:false,premultipliedAlpha:false});
 if(!gl){if(canvas.parentNode)canvas.parentNode.removeChild(canvas);return;}

 var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
 var prog=null,uRes=null,uTime=null,uMouse=null,uMact=null;

 function mk(type,src){
  var s=gl.createShader(type);
  gl.shaderSource(s,src);gl.compileShader(s);
  return s;
 }
 function build(pal){
  if(prog)gl.deleteProgram(prog);
  prog=gl.createProgram();
  gl.attachShader(prog,mk(gl.VERTEX_SHADER,VERT));
  gl.attachShader(prog,mk(gl.FRAGMENT_SHADER,buildFrag(pal)));
  gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return false;
  gl.useProgram(prog);
  var buf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(prog,"a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  uRes=gl.getUniformLocation(prog,"u_res");
  uTime=gl.getUniformLocation(prog,"u_time");
  uMouse=gl.getUniformLocation(prog,"u_mouse");
  uMact=gl.getUniformLocation(prog,"u_mact");
  return true;
 }

 var current=hero.getAttribute("data-time-state")||"daytime";
 if(!build(PALETTES[current]||PALETTES.daytime)){
  if(canvas.parentNode)canvas.parentNode.removeChild(canvas);
  return;
 }

 var W=1,H=1,SCALE=.72; /* Lifeline's own render scale -- the softness of the
                           band comes partly from here and it is cheap */
 function draw(time,mx,my,ma){
  gl.uniform2f(uRes,W,H);gl.uniform1f(uTime,time);
  gl.uniform2f(uMouse,mx,my);gl.uniform1f(uMact,ma);
  gl.drawArrays(gl.TRIANGLES,0,3);
 }
 function resize(){
  var rc=clip.getBoundingClientRect();
  W=Math.max(1,Math.floor(rc.width*SCALE));
  H=Math.max(1,Math.floor(rc.height*SCALE));
  canvas.width=W;canvas.height=H;
  gl.viewport(0,0,W,H);
  if(reduce)draw(12,.5,.5,0);
 }
 resize();
 var rt=0;
 /* THE SQUISH, named by Jayden: the entrance settles the band 100svh->236px
    and the sidebar collapse changes its width, and neither fires a window
    resize -- so both canvases kept their intro-sized buffers and the browser
    stretched them to fit. A ResizeObserver on the clip itself hears every
    geometry change the band can make; the window listener stays only as the
    no-RO fallback. buildAscii is wired in below once it exists. */
 var relayout=function(){resize();};
 function scheduleRelayout(){clearTimeout(rt);rt=setTimeout(function(){relayout();},130);}
 if(window.ResizeObserver)new ResizeObserver(scheduleRelayout).observe(clip);
 else window.addEventListener("resize",scheduleRelayout);

 /* the ripple follows the pointer, as on the Lifeline band */
 var tgt={x:.5,y:.5,a:0};
 window.addEventListener("pointermove",function(e){
  var rc=clip.getBoundingClientRect();
  var x=(e.clientX-rc.left)/rc.width,y=(e.clientY-rc.top)/rc.height;
  if(x<0||x>1||y<0||y>1){tgt.a=0;return;}
  tgt.x=x;tgt.y=y;tgt.a=1;
 },{passive:true});
 clip.addEventListener("pointerleave",function(){tgt.a=0;});

 var t0=(window.performance&&performance.now)?performance.now():Date.now();
 var mx=.5,my=.5,ma=0;
 function render(now){
  mx+=(tgt.x-mx)*.05;my+=(tgt.y-my)*.05;ma+=(tgt.a-ma)*.04;
  draw((now-t0)/1000,mx,my,ma);
  requestAnimationFrame(render);
 }
 if(!reduce)requestAnimationFrame(render);

 /* ── the ASCII field, ported from HeroBackdrop -- same control points, white
    glyphs churning where the gradient is hot, screen-blended over it ─────── */
 var ascii=document.createElement("canvas");
 ascii.className="heroAsciiCanvas";
 ascii.setAttribute("aria-hidden","true");
 clip.appendChild(ascii);
 var ctx2=ascii.getContext("2d");
 if(ctx2){
  var CELL=21,aW=0,aH=0,cols=0,rows=0,phase=null;
  var buildAscii=function(){
   var rc=clip.getBoundingClientRect();
   aW=Math.ceil(rc.width);aH=Math.ceil(rc.height);
   var dpr=Math.min(window.devicePixelRatio||1,2);
   ascii.width=aW*dpr;ascii.height=aH*dpr;
   ctx2.setTransform(dpr,0,0,dpr,0,0);
   ctx2.textAlign="center";ctx2.textBaseline="middle";
   ctx2.font='12px "Geist",ui-sans-serif,system-ui,sans-serif';
   cols=Math.ceil(aW/CELL)+1;rows=Math.ceil(aH/CELL)+1;
   phase=new Float32Array(cols*rows);
   for(var i=0;i<phase.length;i++)phase[i]=Math.random()*Math.PI*2;
  };
  var asciiFrame=function(ms){
   var tRaw=reduce?6:ms/1000;
   var t=tRaw*.10;
   ctx2.clearRect(0,0,aW,aH);
   for(var r=0;r<rows;r++){
    var cy=r*CELL+CELL/2;
    for(var c=0;c<cols;c++){
     var cx=c*CELL+CELL/2;
     var nx=cx/aW,nyc=cy/aH;
     var ph=phase[r*cols+c];
     var n=warmth(nx,nyc,t);
     if(n<0)n=0;else if(n>1)n=1;
     var mInfl=0,pushX=0,pushY=0;
     if(ma>.01){
      var dxm=nx-mx,dym=nyc-my;
      var dm=Math.sqrt(dxm*dxm+dym*dym);
      mInfl=Math.max(0,1-dm/.36)*ma;
      if(mInfl>0&&dm>.0001){var pk=mInfl*7;pushX=(dxm/dm)*pk;pushY=(dym/dm)*pk;}
     }
     var nn=Math.min(1,n+mInfl*.4);
     var churn=nn+.17*Math.sin(tRaw*1.1+ph);
     var gi=(Math.max(0,Math.min(1,churn))*RAMP.length)|0;
     if(gi>=RAMP.length)gi=RAMP.length-1;
     var ch=RAMP[gi];
     if(ch===" ")continue;
     var twinkle=.5+.5*Math.sin(tRaw*1.3+ph*1.3);
     var a=(.11+.62*nn)*twinkle;
     if(a<.02)continue;
     var wob=reduce?0:1;
     var x=cx+pushX+wob*2.2*Math.sin(tRaw*.9+ph);
     var y=cy+pushY+wob*2.2*Math.cos(tRaw*.8+ph*1.2);
     ctx2.fillStyle="rgba(255,255,255,"+a.toFixed(3)+")";
     ctx2.fillText(ch,x,y);
    }
   }
  };
  var asciiLoop=function(ms){asciiFrame(ms);requestAnimationFrame(asciiLoop);};
  buildAscii();
  if(reduce)asciiFrame(0);else requestAnimationFrame(asciiLoop);
  /* join the clip's ResizeObserver relayout: both canvases rebuild from the
     same geometry change, so neither can squish alone */
  relayout=function(){resize();buildAscii();if(reduce){draw(12,.5,.5,0);asciiFrame(0);}};
 }

 /* ── the grain, same recipe as the band's soft-light turbulence ─────────── */
 var grain=document.createElement("div");
 grain.className="heroGrainLayer";
 grain.setAttribute("aria-hidden","true");
 grain.style.backgroundImage='url("'+GRAIN+'")';
 clip.appendChild(grain);

 new MutationObserver(function(){
  var state=hero.getAttribute("data-time-state");
  if(state&&state!==current&&PALETTES[state]){
   current=state;
   /* rebuild the program for the new palette -- rare and cheap, exactly how
      Lifeline swaps months */
   build(PALETTES[state]);
   if(reduce)draw(12,.5,.5,0);
  }
 }).observe(hero,{attributes:true,attributeFilter:["data-time-state"]});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
