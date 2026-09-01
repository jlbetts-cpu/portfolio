/* Vanilla ES5, no build step.
   1. marks <html> .js so the hero entrance can hide-then-reveal (CSS does the
      motion; without JS nothing is ever hidden)
   2. reads ?scheme= (harbour | coral | plum), remembers it, applies data-scheme
   3. with ?present in the URL, draws the scheme picker so Linda can flip
      between them on any page. Site chrome never shows it. */
(function(){
  var d=document,root=d.documentElement,SCHEMES=['harbour','coral','plum'];
  root.className+=' js';

  var q=location.search.replace(/^\?/,'').split('&'),i,kv,scheme=null,present=false;
  for(i=0;i<q.length;i++){kv=q[i].split('=');if(kv[0]==='scheme')scheme=decodeURIComponent(kv[1]||'');if(kv[0]==='present')present=true}
  try{
    if(scheme!==null){if(scheme)localStorage.setItem('di.scheme',scheme);else localStorage.removeItem('di.scheme')}
    else scheme=localStorage.getItem('di.scheme');
  }catch(e){}
  function apply(s){
    if(SCHEMES.indexOf(s)<0)s=SCHEMES[0];
    root.setAttribute('data-scheme',s);
    var b=d.querySelectorAll('.picker [data-scheme]');
    for(var j=0;j<b.length;j++)b[j].setAttribute('aria-pressed',b[j].getAttribute('data-scheme')===s?'true':'false');
  }
  if(scheme)apply(scheme);

  /* the entrance waits for the font so the title does not reflow mid-rise,
     capped at 400ms so a slow font never holds the page */
  var done=false;function ready(){if(done)return;done=true;root.className+=' ready'}
  if(d.fonts&&d.fonts.ready){d.fonts.ready.then(ready,ready);setTimeout(ready,400)}else{setTimeout(ready,0)}

  if(present){
    var bar=d.createElement('div');bar.className='picker';bar.setAttribute('role','group');bar.setAttribute('aria-label','Colour scheme');
    for(i=0;i<SCHEMES.length;i++){
      var btn=d.createElement('button');btn.type='button';btn.className='ctl ctl--nav';
      btn.setAttribute('data-scheme',SCHEMES[i]);btn.textContent=SCHEMES[i].charAt(0).toUpperCase()+SCHEMES[i].slice(1);
      btn.onclick=function(){var s=this.getAttribute('data-scheme');try{localStorage.setItem('di.scheme',s)}catch(e){}apply(s)};
      bar.appendChild(btn);
    }
    d.body.appendChild(bar);
    apply(root.getAttribute('data-scheme')||SCHEMES[0]);
  }
})();
