(function(root,factory){
 var api=factory();
 if(typeof module!=="undefined"&&module.exports)module.exports=api;
 if(!root||!root.document)return;
 root.TimeAwareThumbnails=api;
 function start(){
  if(root.HomeTimeThumbnails||!root.SiteTheme)return;
  root.HomeTimeThumbnails=api.createController({
   document:root.document,
   theme:root.SiteTheme,
   Image:root.Image,
   window:root
  });
 }
 if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
})(typeof window!=="undefined"?window:null,function(){
 "use strict";

 var STATES=Object.freeze(["off","pre-dawn","sunrise","daytime","dusk","sunset","night"]);
 var PROJECTS=Object.freeze(["bearings","apollo","strata","cluster"]);
 var ORIGINALS=Object.freeze({
  bearings:"images/cs/bearings-cover.webp",
  apollo:"images/cs/apollo-cover.webp",
  strata:"images/cs/strata-cover.webp",
  cluster:"images/cs/cluster/cluster-cover.webp"
 });
 var SIZES="(max-width: 760px) calc(100vw - 48px), (max-width: 1280px) calc(100vw - 80px), 1200px";

 function normalizeState(state){return STATES.indexOf(state)!==-1?state:"off";}

 function sourceFor(project,state){
  if(PROJECTS.indexOf(project)===-1)return null;
  var next=normalizeState(state);
  if(next==="off")return {src:ORIGINALS[project],srcset:"",sizes:""};
  var base="images/cs/variants/time/"+project+"/"+next;
  return {
   src:base+"-1200.webp",
   srcset:base+"-1200.webp 1200w, "+base+"-2400.webp 2400w",
   sizes:SIZES
  };
 }

 function createController(options){
  var opts=options||{};
  var doc=opts.document;
  var theme=opts.theme;
  var ImageCtor=opts.Image;
  var win=opts.window;
  if(!doc||!theme||typeof theme.getSnapshot!=="function"||typeof theme.subscribe!=="function"||typeof ImageCtor!=="function"){
   return {destroy:function(){},request:function(){}};
  }

  var targets=Array.prototype.slice.call(doc.querySelectorAll("img[data-time-thumbnail]"));
  if(doc.documentElement){
   Array.prototype.slice.call(doc.querySelectorAll(".csItem img.csImg")).forEach(function(image){
    if(targets.indexOf(image)===-1)targets.push(image);
   });
  }
  var groups={bearings:[],apollo:[],strata:[],cluster:[]};
  function projectFor(image){
   var explicit=image.getAttribute("data-time-thumbnail");
   if(PROJECTS.indexOf(explicit)!==-1)return explicit;
   var article=typeof image.closest==="function"&&image.closest(".csItem[data-slug]");
   var slug=article&&article.getAttribute("data-slug");
   if(PROJECTS.indexOf(slug)!==-1)return slug;
   var anchor=typeof image.closest==="function"&&image.closest("a[href]");
   var href=anchor&&anchor.getAttribute("href")||"";
   var src=image.getAttribute("src")||"";
   for(var i=0;i<PROJECTS.length;i++){
    var project=PROJECTS[i];
    if(href.indexOf(project+".html")!==-1||src===ORIGINALS[project])return project;
   }
   return null;
  }
  targets.forEach(function(image){
   var project=projectFor(image);
   if(groups[project])groups[project].push(image);
  });
  var cache=new Map();
  var requestId=0;
  var requestedState="off";
  var destroyed=false;
  var unsubscribe=function(){};

  function preload(descriptor){
   var key=descriptor.srcset||descriptor.src;
   if(cache.has(key))return cache.get(key);
   var loader=new ImageCtor();
   var promise;
   if(typeof loader.decode==="function"){
    if(descriptor.sizes)loader.sizes=descriptor.sizes;
    if(descriptor.srcset)loader.srcset=descriptor.srcset;
    loader.src=descriptor.src;
    promise=Promise.resolve().then(function(){return loader.decode();});
   }else{
    promise=new Promise(function(resolve,reject){loader.onload=resolve;loader.onerror=reject;});
    if(descriptor.sizes)loader.sizes=descriptor.sizes;
    if(descriptor.srcset)loader.srcset=descriptor.srcset;
    loader.src=descriptor.src;
   }
   var guarded=promise.catch(function(error){cache.delete(key);throw error;});
   cache.set(key,guarded);
   return guarded;
  }

  function commit(image,descriptor){
   if(descriptor.srcset){
    image.setAttribute("sizes",descriptor.sizes);
    image.setAttribute("srcset",descriptor.srcset);
    image.setAttribute("src",descriptor.src);
   }else{
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.setAttribute("src",descriptor.src);
   }
  }

  function request(state){
   if(destroyed)return;
   var next=normalizeState(state);
   var id=++requestId;
   requestedState=next;
   var descriptors={};
   var jobs=[];
   PROJECTS.forEach(function(project){
    if(!groups[project].length)return;
    var descriptor=sourceFor(project,next);
    descriptors[project]=descriptor;
    jobs.push(preload(descriptor));
   });
   Promise.all(jobs).then(function(){
    if(destroyed||id!==requestId||next!==requestedState)return;
    PROJECTS.forEach(function(project){
     var descriptor=descriptors[project];
     if(!descriptor)return;
     groups[project].forEach(function(image){commit(image,descriptor);});
    });
   },function(){
    /* Keep the previously decoded image visible. A later state publication can retry. */
   });
  }

  function onSnapshot(snapshot){request(snapshot&&snapshot.state);}
  function onPageHide(event){if(!event.persisted)destroy();}
  function destroy(){
   if(destroyed)return;
   destroyed=true;
   requestId+=1;
   unsubscribe();
   if(win&&typeof win.removeEventListener==="function")win.removeEventListener("pagehide",onPageHide);
   cache.clear();
  }

  unsubscribe=theme.subscribe(onSnapshot);
  if(win&&typeof win.addEventListener==="function")win.addEventListener("pagehide",onPageHide);
  onSnapshot(theme.getSnapshot());
  return {destroy:destroy,request:request};
 }

 return {STATES:STATES,PROJECTS:PROJECTS,ORIGINALS:ORIGINALS,SIZES:SIZES,sourceFor:sourceFor,createController:createController};
});
