/* What the page takes from Some Wins (Jayden, 2026-11-17: "just like the materials and like structurally I feel like
   somewins is stronger ... adding the fades and like just making it feel more like the somewins app but obviously
   developmental improv"). Two parts:

   1. THE LIQUID. A WebGL port of the app's `blockMesh` and `inkMesh` (Strata/Shaders/LiquidMesh.metal): the field warped
      by fBm noise, colour points worked out from the shape's own colour (deeper, lighter, a step of hue either way) and
      mixed over it so it still reads as itself, the seams lifted so they grow richer and never grey, grain in the
      colour. Still, as the app's tower is: a picture, not a movie.
      - the main action (.btn--primary): the app's liquid ink, near-black, charcoal and graphite.
      No WebGL: the button stays the flat ink. (The 3-5-3's flat drawings wore the block liquid until they became
      3D renders on 2026-11-17.)

   2. THE SCROLL. Some Wins' two scroll-linked moves, one pass a frame and only while scrolling: the China film grows
      the last 8% into its place as it comes up the screen, and the closing line's words light up one after another as
      it is read. Under reduced motion neither runs and both simply sit in place. */
(function () {
  'use strict';
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 2. the scroll ---------- */
  var film = document.querySelector('.watch .film');
  var lead = document.querySelector('.close__lead');
  var words = [];
  if (!still && lead) {
    // plain spans: a screen reader still reads the line as one sentence (a label on a <p> is not allowed, axe)
    lead.innerHTML = lead.textContent.trim().split(/\s+/).map(function (w) {
      return '<span>' + w.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</span>';
    }).join(' ');
    words = [].slice.call(lead.querySelectorAll('span'));
  }
  function between(el, from, to) {
    // 0 when the element's top is `from` of the way down the screen, 1 at `to` (Some Wins' own)
    var top = el.getBoundingClientRect().top / window.innerHeight;
    return Math.min(1, Math.max(0, (from - top) / (from - to)));
  }
  var queued = false;
  function move() {
    queued = false;
    if (film) film.style.setProperty('--p', between(film, 1, 0.35).toFixed(3));
    if (words.length) {
      var lit = between(lead, 0.85, 0.35) * (words.length + 2);
      for (var i = 0; i < words.length; i++) words[i].style.setProperty('--lit', Math.min(1, Math.max(0, lit - i)).toFixed(2));
    }
  }
  function ask() { if (!queued) { queued = true; requestAnimationFrame(move); } }
  if (!still) {
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', ask);
    move();
  }

  /* ---------- 1. the liquid ---------- */
  var cv = document.createElement('canvas');
  var gl = cv.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) return;

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 size;uniform vec3 base;uniform float seed;uniform float strength;uniform float ink;uniform float dpr;',
    'float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);float a=h(i),b=h(i+vec2(1,0)),c=h(i+vec2(0,1)),d=h(i+vec2(1,1));',
    ' vec2 u=f*f*(3.-2.*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p=p*2.+17.3;a*=.5;}return v;}',
    'vec3 hue(vec3 c,float t){mat3 Y=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312);',
    ' mat3 R=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);vec3 q=Y*c;float a=t*6.2831853,cs=cos(a),sn=sin(a);',
    ' q.yz=vec2(q.y*cs-q.z*sn,q.y*sn+q.z*cs);return clamp(R*q,0.,1.);}',
    'void main(){',
    ' vec2 pos=vec2(gl_FragCoord.x,size.y-gl_FragCoord.y);',
    ' float unit=max(min(size.x,size.y),1.);vec2 uv=pos/unit;vec2 span=size/unit;vec3 col;',
    ' if(ink>.5){',
    // inkMesh: the ink with charcoal, graphite and the faintest cool and warm flowing through it
    '  vec2 q=vec2(fbm(uv*1.4+seed),fbm(uv*1.4+vec2(5.2,1.3)-seed));vec2 w=uv+.5*(q-.5);',
    '  vec3 c0=vec3(.10,.095,.09),c1=vec3(.34,.33,.32),c2=vec3(.15,.16,.19),c3=vec3(.24,.21,.18);',
    '  vec3 num=base*.6;float den=.6;vec2 d;float wt;',
    '  d=w-vec2(.15,.7)*span;wt=exp(-dot(d,d)*1.6);num+=c0*wt;den+=wt;',
    '  d=w-vec2(.55,.25)*span;wt=exp(-dot(d,d)*1.6);num+=c1*wt;den+=wt;',
    '  d=w-vec2(.85,.75)*span;wt=exp(-dot(d,d)*1.6);num+=c2*wt;den+=wt;',
    '  d=w-vec2(.35,.2)*span;wt=exp(-dot(d,d)*1.6);num+=c3*wt;den+=wt;',
    '  col=num/den;',
    '  vec2 cell=floor(pos/dpr);col+=(h(cell)+h(cell+7.13)-1.)*.045;',
    ' } else {',
    // blockMesh: the shape's own colour, deeper, lighter, warmer and cooler, at 0.85
    '  float t=seed*13.7;',
    '  vec2 q=vec2(fbm(uv*1.6+t+seed*3.1),fbm(uv*1.6+vec2(5.2,1.3)-t+seed*1.7));vec2 w=uv+.45*(q-.5);',
    '  vec3 cs[4];cs[0]=base*.70;cs[1]=mix(base,vec3(1.),.32);cs[2]=hue(base,.055);cs[3]=hue(base,-.05);',
    '  vec3 num=base*.35;float den=.35;',
    '  for(int i=0;i<4;i++){float fi=float(i);',
    '   vec2 c=vec2(h(vec2(seed,fi)),h(vec2(fi,seed+3.)))*span;',
    '   c+=.18*vec2(sin(t*(1.1+fi*.3)+fi),cos(t*(.9+fi*.25)+fi*1.7));',
    '   vec2 d=w-c;float wt=exp(-dot(d,d)*3.2);num+=cs[i]*wt;den+=wt;}',
    '  col=mix(base,num/den,strength);',
    '  float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,1.06);',
    '  vec2 cell=floor(pos/dpr);col+=(h(cell)+h(cell+7.13)-1.)*.018*strength;',
    ' }',
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  } catch (e) { return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['size', 'base', 'seed', 'strength', 'ink', 'dpr'].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });

  function rgb(str) {
    var m = str && str.match(/\d+(\.\d+)?/g);
    return m && m.length >= 3 ? [m[0] / 255, m[1] / 255, m[2] / 255] : null;
  }
  function paint(w, h, base, seed, ink, dpr) {
    cv.width = w; cv.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.size, w, h);
    gl.uniform3f(U.base, base[0], base[1], base[2]);
    gl.uniform1f(U.seed, seed);
    gl.uniform1f(U.strength, 0.85);
    gl.uniform1f(U.ink, ink ? 1 : 0);
    gl.uniform1f(U.dpr, dpr);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return cv.toDataURL('image/png');
  }
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // the main action, in liquid ink, over the page's own ink; a hidden one (the dialog's, the menu's) is drawn at the
  // size it opens to, and `cover` fits it
  var ink = rgb(getComputedStyle(document.querySelector('.btn--primary') || document.body).backgroundColor) || [0.082, 0.078, 0.114];
  var btns = document.querySelectorAll('.btn--primary');
  for (var b = 0; b < btns.length; b++) {
    var r = btns[b].getBoundingClientRect();
    var bw = Math.round((r.width || 320) * dpr), bh = Math.round((r.height || 54) * dpr);
    btns[b].style.setProperty('--liquid-ink', 'url(' + paint(bw, bh, ink, 0.3 + b * 0.17, true, dpr) + ')');
  }

})();
