#!/usr/bin/env node
/* base-contract.js -- the rules the base was built on, MEASURED, not declared.

   Every rule here is one from CLAUDE.md §3 and each was chosen because it is
   the kind that drifts silently: a fourth text size, a 500 weight, a box-shadow
   on a card, a 40px button, a stylesheet linked without a stamp. The gate
   opens every page at 390 and 1440 in each colour scheme and reads computed
   styles and rendered boxes. It prints FAIL and exits 1 on any failure; a gate
   that prints FAIL and exits 0 has already happened once on the portfolio.

   Run:   NODE_PATH=<dir with playwright> node tools/base-contract.js
          --shots <dir>   also write a full-page PNG per page/viewport/scheme
          --self-test     re-inject the bugs and PASS only if every one is caught
   Env:   PORT (default 4771), PW_CHROMIUM (path to a chromium binary)

   It serves the site itself on 127.0.0.1 -- never localhost (CLAUDE.md, traps)
   -- and shuts the server down when it is done. */
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
const PORT=+(process.env.PORT||4771);
const args=process.argv.slice(2);
const SELF=args.includes('--self-test');
const SHOTS=args.includes('--shots')?args[args.indexOf('--shots')+1]:null;
const PAGES=['index.html','about.html','services.html','schemes.html'];
const VIEWPORTS=[{w:390,h:844},{w:1440,h:900}];
const SCHEMES=['harbour','coral','plum'];
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
let pw;try{pw=require('playwright')}catch(e){console.error('FAIL needs playwright on NODE_PATH');process.exit(2)}

const fails=[];const cats=new Set();
function fail(cat,msg){fails.push(cat+': '+msg);cats.add(cat)}

/* ── static checks: things a browser cannot see ── */
function staticChecks(){
  const html={};PAGES.forEach(p=>html[p]=fs.readFileSync(path.join(ROOT,p),'utf8'));
  for(const p of PAGES){
    const links=html[p].match(/<link[^>]+rel="stylesheet"[^>]*>/g)||[];
    for(const l of links)if(!/\?v=\w+/.test(l))fail('stamp',p+' links a stylesheet without ?v=: '+l);
    if(/<(em|i)\b/.test(html[p]))fail('italic',p+' uses <em>/<i>; no italic face is loaded');
  }
  const strip=s=>s.replace(/ aria-current="page"/g,'');
  const part=(p,tag)=>{const m=html[p].match(new RegExp('<'+tag+' class="'+(tag==='header'?'top':'foot')+'"[\\s\\S]*?</'+tag+'>'));return m?strip(m[0]):null};
  for(const tag of['header','footer']){
    const ref=part(PAGES[0],tag);
    for(const p of PAGES.slice(1))if(part(p,tag)!==ref)fail('shared',p+' <'+tag+'> differs from index.html');
  }
  for(const f of fs.readdirSync(ROOT).filter(f=>f.endsWith('.css'))){
    const css=fs.readFileSync(path.join(ROOT,f),'utf8');
    if(f!=='tokens.css'&&/--accent\s*:/.test(css))fail('accent',f+' rebinds --accent');
    if(/font-style\s*:\s*italic/.test(css))fail('italic',f+' sets font-style:italic');
    if(/font-weight\s*:\s*(?!400|600)\d/.test(css))fail('weight',f+' declares a weight other than 400/600');
    for(const m of css.matchAll(/box-shadow\s*:\s*([^;}]+)/g))if(m[1].trim()!=='none')fail('shadow',f+' declares box-shadow: '+m[1].trim());
  }
}

function serve(){return new Promise(res=>{const s=http.createServer((rq,rs)=>{
  let u=decodeURIComponent(rq.url.split('?')[0]);if(u==='/')u='/index.html';
  const f=path.normalize(path.join(ROOT,u));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){rs.writeHead(404);rs.end();return}
  rs.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(rs)
});s.listen(PORT,'127.0.0.1',()=>res(s))})}

/* runs in the page */
function probe(){
  const out={sizes:{},weights:{},styles:{},shadows:[],tap:[],contrast:[],overflow:document.documentElement.scrollWidth-window.innerWidth,
    sheets:[...document.styleSheets].map(s=>{try{return s.cssRules.length}catch(e){return -1}}),hidden:[]};
  const vis=el=>{const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')return false;const r=el.getBoundingClientRect();return r.width>0&&r.height>0};
  /* rgb(), rgba(), and the color(srgb r g b / a) Chromium returns for color-mix() */
  const parse=c=>{const m=c.match(/[\d.]+/g)||[0,0,0,1];if(/^color\(srgb/.test(c))return{r:m[0]*255,g:m[1]*255,b:m[2]*255,a:m[3]===undefined?1:+m[3]};return{r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]}};
  /* honest compositing, top-down: collect layers then blend */
  const layers=el=>{const L=[];while(el&&el.nodeType===1){const c=parse(getComputedStyle(el).backgroundColor);if(c.a>0){L.push(c);if(c.a>=1)break}el=el.parentElement}return L};
  const blend=L=>{let r=255,g=255,b=255;for(let i=L.length-1;i>=0;i--){const c=L[i];r=c.r*c.a+r*(1-c.a);g=c.g*c.a+g*(1-c.a);b=c.b*c.a+b*(1-c.a)}return{r,g,b}};
  const lum=c=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
  const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  const fg=el=>{const c=parse(getComputedStyle(el).color);return c.a>=1?c:blend([c].concat(layers(el)))};
  for(const el of document.querySelectorAll('body *')){
    if(!vis(el)||el.classList.contains('vh'))continue;
    const cs=getComputedStyle(el);
    if(cs.boxShadow!=='none')out.shadows.push(el.tagName+'.'+el.className);
    let hasText=false;for(const n of el.childNodes)if(n.nodeType===3&&n.nodeValue.trim())hasText=true;
    if(el.matches('input'))hasText=true;
    if(hasText){out.sizes[cs.fontSize]=(out.sizes[cs.fontSize]||0)+1;out.weights[cs.fontWeight]=(out.weights[cs.fontWeight]||0)+1;out.styles[cs.fontStyle]=1}
    if(el.matches('a,button,input,[role=button]')&&!el.classList.contains('skip')){
      const r=el.getBoundingClientRect();const inline=!!el.closest('p,blockquote,.prose');
      if(!inline&&(r.width<44||r.height<44))out.tap.push(el.tagName+'.'+el.className+' '+Math.round(r.width)+'x'+Math.round(r.height));
    }
    if(el.classList.contains('enter')&&cs.opacity!=='1')out.hidden.push(el.className);
  }
  const pairs=[['main p:not(.muted):not(.todo):not(.label)',4.5],['.muted',4.5],['.todo',4.5],['.ctl--primary',4.5],['.ctl--nav',4.5],['.ctl--quiet',4.5],['.card__go',4.5],['.band p',4.5],['.ctl--on-band',4.5],['.moment',3],['.foot li a',4.5],['.quote footer',4.5]];
  for(const[sel,min]of pairs){const el=[...document.querySelectorAll(sel)].find(vis);if(!el)continue;const r=ratio(fg(el),blend(layers(el)));out.contrast.push([sel,+r.toFixed(2),min])}
  const ph=document.querySelector('.field--on-band');
  if(ph){const c=parse(getComputedStyle(ph,'::placeholder').color);out.contrast.push(['.field--on-band::placeholder',+ratio(c.a>=1?c:blend([c].concat(layers(ph))),blend(layers(ph))).toFixed(2),4.5])}
  return out;
}

(async()=>{
  staticChecks();
  const server=await serve();
  const browser=await pw.chromium.launch(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{});
  const INJECT='.ctl--primary{min-height:40px}.card{box-shadow:0 2px 8px rgba(0,0,0,.2)}.facts p{font-weight:500}.hero__lead{font-size:21px}.muted{color:#aab}';
  try{
    for(const vp of VIEWPORTS)for(const scheme of SCHEMES)for(const p of PAGES){
      const ctx=await browser.newContext({viewport:{width:vp.w,height:vp.h},deviceScaleFactor:1});
      const page=await ctx.newPage();const errs=[];page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
      await page.goto(`http://127.0.0.1:${PORT}/${p}?scheme=${scheme}`,{waitUntil:'load'});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>document.documentElement.classList.contains('ready'));
      await page.waitForTimeout(900); /* the entrance: 500ms + 4×60ms stagger */
      if(SELF)await page.addStyleTag({content:INJECT});
      const r=await page.evaluate(probe);
      const tag=`${p}@${vp.w}/${scheme}`;
      if(errs.length)fail('js',tag+' '+errs.join(' | '));
      r.sheets.forEach((n,i)=>{if(n<=0)fail('css',tag+' stylesheet #'+i+' has no live rules')});
      const sizes=Object.keys(r.sizes);if(sizes.length>3)fail('sizes',tag+' has '+sizes.length+' text sizes: '+sizes.join(' '));
      const w=Object.keys(r.weights).filter(x=>x!=='400'&&x!=='600');if(w.length)fail('weight',tag+' computed weights '+w.join(' '));
      if(Object.keys(r.styles).some(s=>s!=='normal'))fail('italic',tag+' computed font-style '+Object.keys(r.styles).join(' '));
      if(r.shadows.length)fail('shadow',tag+' '+r.shadows.slice(0,3).join(', '));
      if(r.tap.length)fail('tap',tag+' '+r.tap.slice(0,4).join(', '));
      for(const[sel,got,min]of r.contrast)if(got<min)fail('contrast',tag+' '+sel+' '+got+' < '+min);
      if(r.overflow>0)fail('overflow',tag+' scrolls sideways by '+r.overflow+'px');
      if(r.hidden.length)fail('entrance',tag+' still hidden after the entrance: '+r.hidden.join(', '));
      if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await page.screenshot({path:path.join(SHOTS,`${p.replace('.html','')}-${vp.w}-${scheme}.png`),fullPage:true})}
      await ctx.close();
    }
    /* reduced motion: nothing hidden, nothing moving, on first paint */
    {const ctx=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const page=await ctx.newPage();
     await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
     const bad=await page.evaluate(()=>[...document.querySelectorAll('.enter')].filter(e=>getComputedStyle(e).opacity!=='1'||getComputedStyle(e).transform!=='none').length);
     if(bad)fail('motion','reduced-motion still hides/moves '+bad+' hero elements');await ctx.close()}
    /* focus is visible: Tab lands on the skip link and it draws a ring */
    {const ctx=await browser.newContext({viewport:{width:1440,height:900}});const page=await ctx.newPage();
     await page.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'load'});await page.keyboard.press('Tab');
     const f=await page.evaluate(()=>{const a=document.activeElement,cs=getComputedStyle(a);return{cls:a.className,top:a.getBoundingClientRect().top,ring:cs.outlineStyle!=='none'&&parseFloat(cs.outlineWidth)>=2}});
     if(!/skip/.test(f.cls)||f.top<0||!f.ring)fail('focus','first Tab: '+JSON.stringify(f));await ctx.close()}
  }finally{await browser.close();server.close()}

  if(SELF){
    const want=['tap','shadow','weight','sizes','contrast'];const missed=want.filter(c=>!cats.has(c));
    if(missed.length){console.log('FAIL self-test: injected bugs not caught: '+missed.join(', '));process.exit(1)}
    console.log('PASS self-test: caught '+want.join(', '));process.exit(0);
  }
  if(fails.length){console.log('FAIL '+fails.length);for(const f of fails)console.log('  '+f);process.exit(1)}
  console.log('PASS base-contract: '+PAGES.length+' pages × '+VIEWPORTS.length+' viewports × '+SCHEMES.length+' schemes, sizes/weights/shadows/tap/contrast/overflow/entrance/motion/focus');
})().catch(e=>{console.log('FAIL '+e.stack);process.exit(1)});
