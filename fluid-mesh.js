(function(){
/* FluidMesh — a no-dependency WebGL fluid gradient.
   FIELD: five colour SOURCES blended per-pixel by inverse-distance weighting in
   OKLAB. A source is a SEGMENT, not just a point (IQ sdSegment) — length+angle
   turn a spot into a swooping band with metric-correct falloff. Per-source size
   scales its reach (Shepard d/size). Sources orbit slowly (per-node phase);
   a gentle low-frequency warp melts boundaries. Exposure multiplies OKLab L
   (dark bodies stay clean). FRINGE: radial RGB-split — the field is sampled
   three times along the radial direction, one per channel, ramping toward the
   limb: real chromatic dispersion, not a painted ring. Light brightens + locally
   rotates hue. Jimenez interleaved-gradient-noise dither kills banding.
   HALO: pass a second small canvas; the same shader renders it every 3rd frame
   — a live, GPU-only, synchronized reflection.
   new FluidMesh(canvas, cfg) -> {set(cfg), destroy()} | null if no WebGL
   cfg:{colors:[5 hex], nodes:[5x{x,y,size,len,ang}], light:[x,y], glow, melt,
       sweep, flow, grain, fringe, expo, orb(0|1), haloCanvas?} */
function FluidMesh(canvas,cfg){
  "use strict";
  function abort(error){
    dead=true;
    if(raf){cancelAnimationFrame(raf);raf=0;}
    if(typeof cfg.onError==="function")try{cfg.onError(error);}catch(onError){}
  }
  var VS="attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}";
  var FS=""+
"#extension GL_OES_standard_derivatives : enable\n"+
"precision highp float;\n"+
"uniform vec2 uRes;uniform float uTime;\n"+
"uniform float uMelt,uSweep,uGlow,uGrain,uFringe,uExpo,uOrb,uWob,uFeath,uGlass,uSph;\n"+
"uniform float uForm,uBend,uFoldA,uFoldSh,uContour,uDpr,uTension,uRim,uLayer;\n"+
"uniform vec2 uLight;uniform vec3 uCol[5];\n"+
"uniform vec2 uPos[5];uniform float uSize[5];uniform float uLen[5];uniform float uAng[5];\n"+
"float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n"+
"/* Ashima/stegu 2D simplex — isotropic gradients, no value-noise grid bias */\n"+
"vec3 permute3(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}\n"+
"float snoise(vec2 v){\n"+
" const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);\n"+
" vec2 i=floor(v+dot(v,C.yy));\n"+
" vec2 x0=v-i+dot(i,C.xx);\n"+
" vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);\n"+
" vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;\n"+
" i=mod(i,289.0);\n"+
" vec3 p=permute3(permute3(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));\n"+
" vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);\n"+
" m=m*m;m=m*m;\n"+
" vec3 x=2.*fract(p*C.www)-1.;\n"+
" vec3 h=abs(x)-0.5;\n"+
" vec3 ox=floor(x+0.5);\n"+
" vec3 a0=x-ox;\n"+
" m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);\n"+
" vec3 g;\n"+
" g.x=a0.x*x0.x+h.x*x0.y;\n"+
" g.yz=a0.yz*x12.xz+h.yz*x12.yw;\n"+
" return 130.*dot(m,g);\n"+
"}\n"+
"float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*(snoise(p)*.5+.5);p*=2.03;a*=.5;}return v;}\n"+
"/* true piecewise sRGB EOTF/OETF — pow(2.2) drifts hue in the darks, and this\n"+
"   pipeline is colour-critical now that it feeds Display-P3 */\n"+
"vec3 srgbDec(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}\n"+
"vec3 srgbEnc(vec3 c){return mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(.0031308,c));}\n"+
"/* linear sRGB -> linear Display-P3 (column-major) */\n"+
"const mat3 SRGB2P3=mat3(.822462,.033194,.017083, .177538,.966806,.072397, 0.,0.,.910520);\n"+
"uniform float uP3;\n"+
"vec3 srgb2ok(vec3 c){c=srgbDec(clamp(c,0.,1.));\n"+
" float l=dot(c,vec3(.4122214708,.5363325363,.0514459929));\n"+
" float m=dot(c,vec3(.2119034982,.6806995451,.1073969566));\n"+
" float s=dot(c,vec3(.0883024619,.2817188376,.6299787005));\n"+
" l=pow(l,1./3.);m=pow(m,1./3.);s=pow(s,1./3.);\n"+
" return vec3(.2104542553*l+.7936177850*m-.0040720468*s,\n"+
"  1.9779984951*l-2.4285922050*m+.4505937099*s,\n"+
"  .0259040371*l+.7827717662*m-.8086757660*s);}\n"+
"vec3 ok2srgb(vec3 c){\n"+
" float l=c.x+.3963377774*c.y+.2158037573*c.z;\n"+
" float m=c.x-.1055613458*c.y-.0638541728*c.z;\n"+
" float s=c.x-.0894841775*c.y-1.2914855480*c.z;\n"+
" l=l*l*l;m=m*m*m;s=s*s*s;\n"+
" vec3 r=vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,\n"+
"  -1.2684380046*l+2.6097574011*m-.3413193965*s,\n"+
"  -.0041960863*l-.7034186147*m+1.7076147010*s);\n"+
" return max(r,0.);} /* returns LINEAR — encode at output */\n"+
"float sdSeg(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;\n"+
" float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);return length(pa-ba*h);}\n"+
"vec3 sphPt(vec2 q){\n"+
" /* disc -> hemisphere. r2 clamped BEFORE the sqrt (limb stability); the .62\n"+
"    exponent compresses features toward the limb — the planet-poster look. */\n"+
" float r2=min(dot(q,q),.985);\n"+
" return normalize(vec3(q,pow(1.-r2,.62)));\n"+
"}\n"+
"vec3 field(vec2 p,float aspect,float gT){\n"+
" /* GAUSSIAN mixture (influence that ENDS — the anti-muddle), evaluated ON THE\n"+
"    SPHERE in planet mode: sources become 3D directions, bands become planes\n"+
"    whose great-circle intersections ARC across the disc and taper at the limb\n"+
"    — the complexity of the reference forms is spherical geometry, not extra\n"+
"    colours. Chord distance, never acos (derivative blows up at the limb). */\n"+
" float soft=mix(.06,.24,uMelt);\n"+
" vec3 acc=srgb2ok(uCol[0])*6e-4;float tot=6e-4;\n"+
" /* LAYERED pass: the references are stacked airbrush passes with occlusion\n"+
"    order — each mass keeps ITS OWN edge through an intersection instead of\n"+
"    mutually averaging into smudge. Node 5 paints last, on top. */\n"+
" vec3 colL=srgb2ok(uCol[0]);\n"+
" float w1=0.,w2=0.;\n"+
" bool sph=uSph>.5;\n"+
" vec3 P=sph?sphPt((p-vec2(.5))*2.):vec3(0.);\n"+
" for(int i=0;i<5;i++){\n"+
"  float fi=float(i);\n"+
"  float sp=.35+.11*fi;\n"+
"  float ph=fi*2.39996;\n"+
"  float orad=uSweep*(.09+.03*fi);\n"+
"  vec2 c=uPos[i]+orad*vec2(sin(uTime*sp+ph),cos(uTime*sp*.83+ph*1.7));\n"+
"  float an=uAng[i]+.10*sin(uTime*.23+ph);\n"+
"  float d;float tapM=1.;\n"+
"  if(sph){\n"+
"   vec3 N=sphPt((c-vec2(.5))*1.84);\n"+
"   float chN=length(P-N);\n"+
"   if(uLen[i]<.01){d=chN;}\n"+
"   else{\n"+
"    vec3 t3=vec3(cos(an),sin(an),0.);\n"+
"    t3=normalize(t3-N*dot(t3,N));\n"+
"    float planeD=dot(P,normalize(cross(N,t3)));\n"+
"    float capX=max(0.,chN-uLen[i]*2.4);\n"+
"    d=sqrt(planeD*planeD*1.9+capX*capX);\n"+
"   }\n"+
"   d*=.62; /* chord units run 0..2; rescale toward disc units */\n"+
"  }else{\n"+
"   /* STREAMS: the flat capsule gains CURVATURE — colour rivers bend in gentle\n"+
"      S-arcs (per-node alternating sign) and taper like brush strokes. The\n"+
"      Planet path above is untouched. */\n"+
"   vec2 cA=vec2((c.x-.5)*aspect+.5,c.y);\n"+
"   vec2 t=vec2(cos(an),sin(an));\n"+
"   vec2 rel=p-cA;\n"+
"   float uu=dot(rel,t),vv=dot(rel,vec2(-t.y,t.x));\n"+
"   float L=max(uLen[i],1e-4);\n"+
"   if(uForm>.5){\n"+
"    float bnd=uBend*(mod(fi,2.)<1.?1.:-1.)*(.5+.18*fi);\n"+
"    vv-=bnd*(uu*uu)/max(L,.10);\n"+
"    tapM=1.-.5*clamp(abs(uu)/(L*2.4+1e-4),0.,1.);\n"+
"   }\n"+
"   d=sqrt(pow(max(0.,abs(uu)-L*2.2),2.)+vv*vv);\n"+
"  }\n"+
"  float sg=max(uSize[i],.05)*soft*tapM;\n"+
"  /* TENSION: the reference crescents have a TAUT edge facing the light and a\n"+
"     feathered dissolve behind — asymmetric falloff per mass, sharp flank\n"+
"     toward the light, broad flank away */\n"+
"  if(uTension>0.){\n"+
"   vec2 cA2=vec2((c.x-.5)*aspect+.5,c.y);\n"+
"   vec2 lpF=vec2((uLight.x-.5)*aspect+.5,1.-uLight.y);\n"+
"   vec2 toL=lpF-cA2;vec2 toP=p-cA2;\n"+
"   float fl=dot(normalize(toP+vec2(1e-5)),normalize(toL+vec2(1e-5)));\n"+
"   sg*=mix(1.+uTension*.55,1.-uTension*.45,smoothstep(-.6,.6,fl));\n"+
"  }\n"+
"  /* grain IN the colour: the static triangular noise perturbs the distance\n"+
"     BEFORE the falloff — transitions dissolve into stochastic dot clouds\n"+
"     while mass cores stay clean, the riso construction */\n"+
"  d+=gT*sg*uGrain*1.4;\n"+
"  float wt=exp(-(d*d)/(2.*sg*sg));\n"+
"  vec3 okC=srgb2ok(uCol[i]);\n"+
"  acc+=okC*wt;tot+=wt;\n"+
"  colL=mix(colL,okC,clamp(wt*1.15,0.,1.));\n"+
"  if(wt>w1){w2=w1;w1=wt;}else if(wt>w2){w2=wt;}\n"+
" }\n"+
" vec3 col=mix(acc/tot,colL,clamp(uLayer,0.,1.));\n"+
" /* the glass seam: where two colours BALANCE, luminance lifts — boundaries\n"+
"    glow faintly brighter than either side, like dye layers in backlit glass */\n"+
" float g=4.*w1*w2/((w1+w2)*(w1+w2)+1e-6);\n"+
" /* where colours balance, chroma RISES — reference intersections glow with\n"+
"    saturated new hues instead of washing toward grey */\n"+
" col.x+=g*uGlass*.085;col.yz*=(1.+g*uGlass*.34);\n"+
" return col;\n"+
"}\n"+
"void main(){\n"+
" float aspect=uRes.x/uRes.y;\n"+
" vec2 uv=gl_FragCoord.xy/uRes;\n"+
" vec2 uvA=vec2((uv.x-.5)*aspect+.5,uv.y);\n"+
" vec2 p;\n"+
" if(uForm>4.5&&uForm<5.5){\n"+
"  /* MARBLE: Quilez double-warp f(p+f(p)) at high frequency — the fine liquid\n"+
"     swirl of marbled paper; Wobble drives the swirl amplitude */\n"+
"  vec2 qm=uvA*3.2;\n"+
"  vec2 w1=vec2(fbm(qm+uTime*.10),fbm(qm+vec2(4.7,2.1)-uTime*.08));\n"+
"  vec2 w2=vec2(fbm(qm*1.7+(w1-.5)*2.4+uTime*.06),\n"+
"               fbm(qm*1.7+(w1-.5)*2.4+vec2(2.3,5.1)));\n"+
"  p=uvA+(w2-.5)*uWob*.55;\n"+
" }else{\n"+
"  /* Quilez three-level domain warp f(p+f(p+f(p))): organic without turbulence\n"+
"     because the amplitude stays small relative to feature size */\n"+
"  vec2 q=uvA*1.35;\n"+
"  vec2 w0=vec2(fbm(q+vec2(1.7,9.2)),fbm(q+vec2(8.3,2.8)));\n"+
"  vec2 w1=vec2(fbm(q+w0*.42+uTime*.14),fbm(q+w0*.42+vec2(4.7,2.1)-uTime*.11));\n"+
"  /* wobble decoupled from softness: the references' boundaries are CALM */\n"+
"  p=uvA+(w1-.5)*uWob*.38;\n"+
" }\n"+
" /* PLEATS AS GLASS: each strip is a rib of glass over the gradient — it\n"+
"    REFRACTS the field beneath (displaced sampling), it doesn't paint stripes */\n"+
" float stripEdge=0.;\n"+
" if(uForm>3.5&&uForm<4.5){\n"+
"  float pAng=uBend*3.14159;\n"+
"  vec2 dirP=vec2(cos(pAng),sin(pAng));\n"+
"  float freq=mix(8.,36.,uFoldA);\n"+
"  float thP=dot(uvA,dirP)*freq+uTime*.05;\n"+
"  float ph01=fract(thP/6.28318);\n"+
"  p+=dirP*(ph01-.5)*.05;\n"+
"  stripEdge=smoothstep(.93,1.,ph01)+smoothstep(.07,0.,ph01);\n"+
" }\n"+
" /* chromatic fringe: sample the field per-channel along the radial direction,\n"+
"    zero at centre, max at the limb (planet mode only) */\n"+
" /* STATIC print grain: triangular noise (two hashes subtracted — no clumping)\n"+
"    on CSS-pixel cells (device-pixel hash is sub-pixel mush at high DPR), and\n"+
"    NO time term — grain is frozen into the print, it never crawls */\n"+
" vec2 gc=floor(gl_FragCoord.xy/max(uDpr,1.));\n"+
" float gT=hash(gc)-hash(gc+vec2(7.31,3.17));\n"+
" float rr=length(uv-.5);\n"+
" vec2 rdir=rr>1e-4?normalize(uvA-vec2(.5)):vec2(0.);\n"+
" float off=uFringe*uOrb*.028*smoothstep(.28,.5,rr);\n"+
" vec3 okR=field(p-rdir*off,aspect,gT);\n"+
" vec3 okG=off>0.?field(p,aspect,gT):okR;\n"+
" vec3 okB=off>0.?field(p+rdir*off,aspect,gT):okR;\n"+
" okG.x*=uExpo;okR.x*=uExpo;okB.x*=uExpo;\n"+
" okG.yz*=1.08;okR.yz*=1.08;okB.yz*=1.08;\n"+
" vec2 lp=vec2((uLight.x-.5)*aspect+.5,uLight.y);\n"+
" float ld=distance(uvA,lp);\n"+
" float lw=smoothstep(.62,.04,ld)*uGlow;\n"+
" float ang=lw*1.25,ca=cos(ang),sa=sin(ang);\n"+
" okG.yz=mat2(ca,-sa,sa,ca)*okG.yz;okG.x+=lw*.28;okG.yz*=(1.-.33*lw);\n"+
" okR.yz=mat2(ca,-sa,sa,ca)*okR.yz;okR.x+=lw*.28;okR.yz*=(1.-.33*lw);\n"+
" okB.yz=mat2(ca,-sa,sa,ca)*okB.yz;okB.x+=lw*.28;okB.yz*=(1.-.33*lw);\n"+
" /* SILK: satin fold shading — ridge luminance follows a drape direction with\n"+
"    organic phase, plus a narrow specular sheen riding the fold crests; chroma\n"+
"    thins slightly under the sheen the way lit satin washes out. */\n"+
" if(uForm>1.5&&uForm<2.5){\n"+
"  float fAng=uBend*3.14159;\n"+
"  vec2 dirF=vec2(cos(fAng),sin(fAng));\n"+
"  float th=dot(uvA,dirF)*4.6+1.5*fbm(uvA*1.15+uTime*.05)+uTime*.07;\n"+
"  float sn=sin(th);\n"+
"  float shade=uFoldA*.15*sn*abs(sn);\n"+
"  float hl=pow(max(cos(th),0.),22.)*uFoldSh;\n"+
"  float cd=1.-.22*hl;\n"+
"  okR.x+=shade+hl*.20;okG.x+=shade+hl*.20;okB.x+=shade+hl*.20;\n"+
"  okR.yz*=cd;okG.yz*=cd;okB.yz*=cd;\n"+
" }\n"+
" /* glass rib edges: thin bright lines where the strips meet, chroma thinning\n"+
"    under the highlight — the refraction itself happened before sampling */\n"+
" if(uForm>3.5&&uForm<4.5){\n"+
"  float hlE=stripEdge*uFoldSh;\n"+
"  float cdP=1.-.16*hlE;\n"+
"  okR.x+=hlE*.14;okG.x+=hlE*.14;okB.x+=hlE*.14;\n"+
"  okR.yz*=cdP;okG.yz*=cdP;okB.yz*=cdP;\n"+
" }\n"+
" /* CONTOUR LIGHTING — the statement lines. The field is shaded by its own\n"+
"    screen-space derivatives: tight curves catch light like real folds, and\n"+
"    fast colour boundaries sharpen into deliberate drawn lines that belong to\n"+
"    the gradient because they ARE the gradient. */\n"+
" if(uContour>0.){\n"+
"  float Lc=okG.x;\n"+
"  vec2 gv=vec2(dFdx(Lc),dFdy(Lc));\n"+
"  float mag=length(gv)*min(uRes.x,uRes.y)*.5;\n"+
"  vec2 li=normalize(uvA-lp+vec2(1e-4));\n"+
"  float shade=clamp(dot(gv,li)*min(uRes.x,uRes.y)*.5,-1.,1.);\n"+
"  float lineB=smoothstep(.4,1.8,mag);\n"+
"  float addC=uContour*(.11*lineB-.055*shade);\n"+
"  okR.x+=addC;okG.x+=addC;okB.x+=addC;\n"+
" }\n"+
" /* THE SPECULAR RIM: a bright warm arc INSIDE the silhouette facing the\n"+
"    light, limb shading opposite — in-shader, so it fades with the feathered\n"+
"    edge instead of drawing a ring over it */\n"+
" float specG=0.;\n"+
" if(uOrb>.5&&uRim>0.){\n"+
"  float rr2=length(uv-.5)*2.;\n"+
"  float limb=smoothstep(.70,.94,rr2)*(1.-smoothstep(.97,1.05,rr2));\n"+
"  vec2 rd2=normalize(uvA-vec2(.5)+vec2(1e-5));\n"+
"  vec2 ld2=normalize(lp-vec2(.5)+vec2(1e-5));\n"+
"  float face=dot(rd2,ld2);\n"+
"  float spec=limb*smoothstep(.1,.9,face)*uRim;\n"+
"  float shad=limb*smoothstep(.1,.9,-face)*uRim;\n"+
"  specG=spec;\n"+
"  float dR=spec*.32-shad*.20;\n"+
"  okR.x+=dR;okG.x+=dR;okB.x+=dR;\n"+
"  float cc=1.-.28*spec;\n"+
"  okR.yz*=cc;okG.yz*=cc;okB.yz*=cc;\n"+
" }\n"+
" vec3 linR=ok2srgb(okR),linG=ok2srgb(okG),linB=ok2srgb(okB);\n"+
" /* wide gamut: on P3 buffers the saturated cores get the extra chroma the\n"+
"    reference packs actually live in; sRGB displays fall back untouched */\n"+
" if(uP3>.5){linR=SRGB2P3*linR;linG=SRGB2P3*linG;linB=SRGB2P3*linB;}\n"+
" vec3 rgb=vec3(srgbEnc(linR).r,srgbEnc(linG).g,srgbEnc(linB).b);\n"+
" /* Jimenez interleaved-gradient-noise dither + dialable film grain */\n"+
" float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));\n"+
" /* residual paper tooth only — the real grain already happened inside the\n"+
"    colour mixing; this stays STATIC and small */\n"+
" rgb+=(ign-.5)*(2./255.)+gT*uGrain*.05;\n"+
" /* the feathered limb: the sphere dissolves into its own halo — no line where\n"+
"    the form ends and the glow begins. Premultiplied alpha over a transparent\n"+
"    canvas; the live halo behind shows through the fade. */\n"+
" float aF=1.;\n"+
" if(uOrb>.5&&uFeath>0.){\n"+
"  float rE=length((uv-.5)*2.);\n"+
"  aF=1.-smoothstep(.985-uFeath*.30,.99,rE);\n"+
" }\n"+
" /* the specular escapes the silhouette: rim light wraps past the edge */\n"+
" aF=max(aF,specG*.55);\n"+
" gl_FragColor=vec4(rgb*aF,aF);\n"+
"}";
  function makeRenderer(cv,fixed,alphaOn){
    var gl=cv.getContext("webgl",{antialias:true,alpha:!!alphaOn,premultipliedAlpha:true})||
           cv.getContext("experimental-webgl");
    if(!gl)return null;
    /* Display-P3 buffer where the platform allows (Baseline 2024); sRGB otherwise */
    var p3On=false;
    if("drawingBufferColorSpace" in gl){
      try{gl.drawingBufferColorSpace="display-p3";
        p3On=(gl.drawingBufferColorSpace==="display-p3");}catch(e){}
    }
    var prog,lost=false,U={};
    var derivOK=!!gl.getExtension("OES_standard_derivatives");
    function loc(n){if(!(n in U))U[n]=gl.getUniformLocation(prog,n);return U[n];}
    function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
    function setup(){
      U={}; /* uniform locations re-cached per program (context restore) */
      prog=gl.createProgram();
      gl.attachShader(prog,sh(gl.VERTEX_SHADER,VS));
      gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,FS));
      gl.linkProgram(prog);gl.useProgram(prog);
      var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      var loc=gl.getAttribLocation(prog,"aP");
      gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    }
    function size(){
      if(fixed){var FW=fixed.length?fixed[0]:fixed,FH=fixed.length?fixed[1]:fixed;
        if(cv.width!==FW||cv.height!==FH){cv.width=FW;cv.height=FH;gl.viewport(0,0,FW,FH);}return;}
      var dpr=Math.min(window.devicePixelRatio||1,cfg.dprCap||2.25);
      var w=cv.clientWidth,h=cv.clientHeight;
      if(!w||!h)return;
      var W=Math.round(w*dpr),H=Math.round(h*dpr);
      if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;gl.viewport(0,0,W,H);}
    }
    function hex2rgb(h){var n=parseInt(h.slice(1),16);
      return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];}
    function render(t,c,feath,orbOv,sphOv){
      if(lost)return;
      size();
      gl.useProgram(prog);
      var u=loc; /* cached — getUniformLocation per frame is prototype hygiene */
      gl.uniform1f(u("uP3"),p3On?1:0);
      gl.uniform2f(u("uRes"),cv.width,cv.height);
      gl.uniform1f(u("uTime"),t);
      gl.uniform1f(u("uMelt"),c.melt);gl.uniform1f(u("uSweep"),c.sweep);
      gl.uniform1f(u("uGlow"),c.glow);gl.uniform1f(u("uGrain"),c.grain);
      gl.uniform1f(u("uFringe"),c.fringe);gl.uniform1f(u("uExpo"),c.expo);
      gl.uniform1f(u("uOrb"),orbOv!==undefined?orbOv:c.orb);gl.uniform1f(u("uWob"),c.wob||0);
      gl.uniform1f(u("uSph"),sphOv!==undefined?sphOv:(c.sph||0));
      gl.uniform1f(u("uFeath"),feath||0);gl.uniform1f(u("uGlass"),c.glass||0);
      gl.uniform1f(u("uForm"),c.form||0);gl.uniform1f(u("uBend"),c.bend||0);
      gl.uniform1f(u("uFoldA"),c.foldA||0);gl.uniform1f(u("uFoldSh"),c.foldSh||0);
      gl.uniform1f(u("uContour"),derivOK?(c.contour||0):0);
      gl.uniform1f(u("uDpr"),Math.min(window.devicePixelRatio||1,cfg.dprCap||2.25));
      gl.uniform1f(u("uTension"),c.tension||0);gl.uniform1f(u("uRim"),c.rim||0);
      gl.uniform1f(u("uLayer"),c.layer||0);
      gl.uniform2f(u("uLight"),c.light[0],1.-c.light[1]);
      for(var i=0;i<5;i++){
        var col=hex2rgb(c.colors[i]);
        gl.uniform3f(u("uCol["+i+"]"),col[0],col[1],col[2]);
        var nd=c.nodes[i];
        gl.uniform2f(u("uPos["+i+"]"),nd.x,1.-nd.y);
        gl.uniform1f(u("uSize["+i+"]"),nd.size);
        gl.uniform1f(u("uLen["+i+"]"),nd.len);
        gl.uniform1f(u("uAng["+i+"]"),-nd.ang);
      }
      gl.drawArrays(gl.TRIANGLES,0,3);
    }
    cv.addEventListener("webglcontextlost",function(e){e.preventDefault();lost=true;},false);
    cv.addEventListener("webglcontextrestored",function(){
      lost=false;
      try{setup();}catch(error){lost=true;abort(error);}
    },false);
    try{setup();}catch(error){lost=true;abort(error);return null;}
    return{render:render};
  }
  var main=makeRenderer(canvas,0,true);
  if(!main)return null;
  var haloR=cfg.haloCanvas?makeRenderer(cfg.haloCanvas,64,false):null;
  var raf=0,t=0,last=0,dead=false,fc=0,paused=false;
  var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  function frame(now){
    raf=0;
    if(dead||paused)return;
    var dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    t+=dt*(0.04+cfg.flow*0.30);
    main.render(t,cfg,cfg.edgeF||0);
    /* the halo evaluates the FLAT field: a glow continues outward — spherical
       maths beyond the disc clamps to one pale limb colour and rings.
       Only the Planet form wears a halo. */
    if(haloR&&fc%3===0&&(cfg.form||0)===0)haloR.render(t,cfg,0,0);
    fc++;
    if(!paused&&!reduce&&cfg.flow>0&&!document.hidden)raf=requestAnimationFrame(frame);
  }
  function kick(){if(!raf&&!dead&&!paused){last=0;raf=requestAnimationFrame(frame);}}
  function pause(){paused=true;if(raf){cancelAnimationFrame(raf);raf=0;}}
  function resume(){if(dead)return;paused=false;kick();}
  function renderOnce(){if(dead)return;main.render(t,cfg,cfg.edgeF||0);}
  document.addEventListener("visibilitychange",function(){if(!document.hidden)kick();});
  window.addEventListener("resize",kick);
  kick();
  return{
    set:function(next){for(var k in next)cfg[k]=next[k];kick();},
    pause:pause,
    resume:resume,
    renderOnce:renderOnce,
    destroy:function(){dead=true;if(raf)cancelAnimationFrame(raf);},
    time:function(){return t;},
    /* hi-res still: renders the CURRENT frame into an offscreen buffer and
       returns the canvas — call .toBlob on it in the same task (no
       preserveDrawingBuffer cost) */
    snapshot:function(w,h){
      var cv2=document.createElement("canvas");cv2.width=w;cv2.height=h;
      var r2=makeRenderer(cv2,[w,h],cfg.orb===1);
      if(!r2)return null;
      r2.render(t,cfg,(cfg.orb===1)?(cfg.edgeF||0):0);
      return cv2;
    },
    canvas:canvas
  };
}

window.FluidMesh=FluidMesh;
}());
