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

/* base + mesh[0..2] high/pale + mesh[3..5] low/saturated, from each state's
   authored radial stops in hero-time.css. */
var PALETTES={
 "pre-dawn":{base:"#f8fafd",mesh:["#eadcff","#dac0ff","#eadcff","#486ffd","#7f81f3","#c489ff"]},
 sunrise:{base:"#f8fafd",mesh:["#fff1dc","#ffd79b","#fff1dc","#cb83ff","#ff90b9","#ffc977"]},
 daytime:{base:"#f8fafd",mesh:["#d9ebff","#b4d8ff","#d9ebff","#0071c1","#60a8e2","#4d9fdd"]},
 dusk:{base:"#f8fafd",mesh:["#f1f3fa","#ccd5f0","#f1f3fa","#ffb36a","#dfa0d8","#9da8e4"]},
 sunset:{base:"#f8fafd",mesh:["#f5eaff","#ecd8ff","#f5eaff","#ffa577","#ff90a1","#ddadff"]},
 night:{base:"#060a13",mesh:["#0a1530","#16224a","#0a1530","#1d4a93","#5d509b","#2c5bb0"]}
};

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
 window.addEventListener("resize",function(){
  clearTimeout(rt);rt=setTimeout(resize,130);
 });

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
