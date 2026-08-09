const assert=require("node:assert/strict");
const fs=require("node:fs");

const T=require("../time-aware-thumbnails.js");

function deferred(){
 let resolve,reject;
 const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
}

/* `fetched` models the only thing that separates the controller's two paths:
   whether the browser has actually pulled this image down yet. A cover the
   visitor is looking at is complete with a real intrinsic width; an
   <img loading="lazy"> still below the fold is not. Defaults to true so every
   test written before that distinction existed still exercises the
   decode-before-swap path it was written for. */
function target(project,loading,fetched=true){
 const attributes=new Map([
  ["data-time-thumbnail",project],
  ["src","images/cs/"+project+"-cover.webp"],
  ["alt",project+" preserved alt"],
  ["loading",loading],
  ["decoding","async"]
 ]);
 return {
  attributes,
  complete:fetched,
  naturalWidth:fetched?1200:0,
  setAttribute(name,value){attributes.set(name,String(value));},
  getAttribute(name){return attributes.has(name)?attributes.get(name):null;},
  hasAttribute(name){return attributes.has(name);},
  removeAttribute(name){attributes.delete(name);}
 };
}

function harness(initialState="off",fetched=true){
 const images=[target("bearings","eager",fetched),target("apollo","lazy",fetched),
               target("bearings","lazy",fetched),target("apollo","lazy",fetched)];
 const document={querySelectorAll(selector){
  assert.equal(selector,"img[data-time-thumbnail]");
  return images;
 }};
 let listener=null;
 let unsubscribeCalls=0;
 const theme={
  getSnapshot(){return {mode:initialState,state:initialState,theme:initialState==="night"?"dark":"light"};},
  subscribe(next){listener=next;return ()=>{unsubscribeCalls+=1;listener=null;};}
 };
 const pending=[];
 class FakeImage{
  constructor(){
   this.request=deferred();
   this.decode=()=>this.request.promise;
   pending.push(this);
  }
 }
 const windowListeners=new Map();
 const window={
  addEventListener(type,fn){windowListeners.set(type,fn);},
  removeEventListener(type,fn){if(windowListeners.get(type)===fn)windowListeners.delete(type);}
 };
 const controller=T.createController({document,theme,Image:FakeImage,window});
 return {
  images,pending,controller,
  publish(state){assert.ok(listener);listener({mode:state,state,theme:state==="night"?"dark":"light"});},
  pagehide(persisted){const fn=windowListeners.get("pagehide");assert.ok(fn);fn({persisted});},
  unsubscribeCalls:()=>unsubscribeCalls,
  hasPagehide:()=>windowListeners.has("pagehide")
 };
}

function attr(image,name){return image.getAttribute(name);}
function flush(){return new Promise(resolve=>setImmediate(resolve));}

const failures=[];
async function test(name,run){
 try{await run();}
 catch(error){failures.push(name+": "+(error&&error.stack||error));}
}

(async function(){
 await test("all projects and published states resolve to literal source contracts",async()=>{
  const expectedStates=["off","pre-dawn","sunrise","daytime","dusk","sunset","night"];
  assert.deepEqual(T.STATES,expectedStates);
  assert.equal(T.SIZES,"(max-width: 760px) calc(100vw - 48px), (max-width: 1280px) calc(100vw - 80px), 1200px");
  for(const project of ["bearings","apollo"]){
   assert.deepEqual(T.sourceFor(project,"off"),{
    src:"images/cs/"+project+"-cover.webp",
    srcset:"",
    sizes:""
   });
   for(const state of expectedStates.slice(1)){
    assert.deepEqual(T.sourceFor(project,state),{
     src:"images/cs/variants/time/"+project+"/"+state+"-1200.webp",
     srcset:"images/cs/variants/time/"+project+"/"+state+"-1200.webp 1200w, images/cs/variants/time/"+project+"/"+state+"-2400.webp 2400w",
     sizes:T.SIZES
    });
   }
  }
 });

 await test("duplicate instances wait for both responsive preloads and preserve unrelated attributes",async()=>{
  const h=harness("daytime");
  assert.equal(h.pending.length,2);
  assert.equal(h.pending[0].sizes,T.SIZES);
  assert.match(h.pending[0].srcset,/daytime-1200\.webp 1200w, .*daytime-2400\.webp 2400w$/);
  assert.match(h.pending[1].srcset,/daytime-1200\.webp 1200w, .*daytime-2400\.webp 2400w$/);
  h.pending[0].request.resolve();
  await flush();
  /* Bearings has decoded, so both bearings instances swap NOW. Apollo has not,
     so both apollo instances hold their previous cover. This assertion used to
     require all four to wait for both decodes -- that was Promise.all making
     every project hostage to the slowest one, and it is the behaviour that has
     deliberately gone. Duplicates of the SAME project still move together,
     which is what this test is really about. */
  h.images.forEach(image=>{
   const project=attr(image,"data-time-thumbnail");
   if(project==="bearings")assert.match(attr(image,"src"),/daytime-1200\.webp$/);
   else assert.equal(attr(image,"src"),"images/cs/apollo-cover.webp");
  });
  h.pending[1].request.resolve();
  await flush();
  h.images.forEach(image=>{
   const project=attr(image,"data-time-thumbnail");
   assert.equal(attr(image,"src"),"images/cs/variants/time/"+project+"/daytime-1200.webp");
   assert.match(attr(image,"srcset"),/daytime-1200\.webp 1200w, .*daytime-2400\.webp 2400w$/);
   assert.equal(attr(image,"sizes"),T.SIZES);
   assert.equal(attr(image,"alt"),project+" preserved alt");
   assert.equal(attr(image,"decoding"),"async");
  });
  assert.equal(attr(h.images[0],"loading"),"eager");
  assert.equal(attr(h.images[1],"loading"),"lazy");
 });

 await test("an unfetched lazy cover is retargeted without a preload, so loading=lazy still governs",async()=>{
  /* THE POINT OF THE WHOLE CHANGE. A detached new Image() is invisible to
     loading="lazy", so preloading every cover downloaded artwork for
     case studies most visitors never scroll to -- 1.14 MB at DPR 1, 3.16 MB at
     DPR 2, on first paint, defeating all seven lazy attributes in the markup.
     A cover the browser has not fetched now just gets pointed at the new
     source: no Image(), no request, and the lazy attribute decides if and when
     anything is downloaded. */
  const h=harness("daytime",false);
  assert.equal(h.pending.length,0,"nothing may be preloaded on behalf of an unfetched cover");
  h.images.forEach(image=>{
   const project=attr(image,"data-time-thumbnail");
   assert.equal(attr(image,"src"),"images/cs/variants/time/"+project+"/daytime-1200.webp");
   assert.match(attr(image,"srcset"),/daytime-1200\.webp 1200w, .*daytime-2400\.webp 2400w$/);
  });
  assert.equal(attr(h.images[1],"loading"),"lazy");
 });

 await test("a visible cover is still decoded before it is swapped, so it never flickers",async()=>{
  const h=harness("off");
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.publish("night");
  h.images.forEach(image=>assert.match(attr(image,"src"),/-cover\.webp$/));
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/night-1200\.webp$/));
 });

 await test("Off restores exact original src and removes responsive attributes only after decode",async()=>{
  const h=harness("night");
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.publish("off");
  assert.equal(h.pending.length,4);
  h.images.forEach(image=>assert.match(attr(image,"src"),/night-1200\.webp$/));
  h.pending.slice(2).forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>{
   const project=attr(image,"data-time-thumbnail");
   assert.equal(attr(image,"src"),"images/cs/"+project+"-cover.webp");
   assert.equal(image.hasAttribute("srcset"),false);
   assert.equal(image.hasAttribute("sizes"),false);
  });
 });

 await test("rapid retargeting never commits a stale out-of-order state",async()=>{
  const h=harness("off");
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.publish("daytime");
  const daytime=h.pending.slice(2);
  h.publish("sunset");
  const sunset=h.pending.slice(4);
  sunset.forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/sunset-1200\.webp$/));
  daytime.forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/sunset-1200\.webp$/));
 });

 await test("a decode failure is scoped to its own project and cannot hold the others back",async()=>{
  /* This used to assert the opposite -- that one rejection left EVERY cover on
     its previous source. That was Promise.all doing an AND across all six
     projects: the slowest decode gated every other, and a single missing
     variant abandoned the entire state change into an empty handler. Each
     project now stands on its own, so bearings updates and only apollo, which
     actually failed, keeps the picture it already had. */
  const h=harness("off");
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.publish("night");
  h.pending[2].request.resolve();
  h.pending[3].request.reject(new Error("decode failed"));
  await flush();
  h.images.forEach(image=>{
   const project=attr(image,"data-time-thumbnail");
   if(project==="bearings")assert.match(attr(image,"src"),/night-1200\.webp$/);
   else assert.match(attr(image,"src"),/-cover\.webp$/);
  });
  h.publish("off");
  await flush();
  h.publish("night");
  assert.equal(h.pending.length,5);
  h.pending[4].request.resolve();
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/night-1200\.webp$/));
 });

 await test("cleanup ignores persisted pagehide and blocks late commits after final teardown",async()=>{
  const h=harness("daytime");
  h.pagehide(true);
  assert.equal(h.unsubscribeCalls(),0);
  h.pagehide(false);
  assert.equal(h.unsubscribeCalls(),1);
  assert.equal(h.hasPagehide(),false);
  h.pending.forEach(loader=>loader.request.resolve());
  await flush();
  h.images.forEach(image=>assert.match(attr(image,"src"),/-cover\.webp$/));
 });

 await test("home HTML marks exactly four thumbnails and loads the controller once",async()=>{
  const html=fs.readFileSync(require.resolve("../index.html"),"utf8");
  assert.equal((html.match(/data-time-thumbnail="bearings"/g)||[]).length,2);
  assert.equal((html.match(/data-time-thumbnail="apollo"/g)||[]).length,2);
  assert.equal((html.match(/<script src="time-aware-thumbnails\.js" defer><\/script>/g)||[]).length,1);
  assert.equal((html.match(/<img class="csImg"[^>]*data-time-thumbnail=/g)||[]).length,4);
 });

 if(failures.length){
  failures.forEach(failure=>console.error("FAIL "+failure));
  process.exitCode=1;
 }else console.log("time-aware home thumbnails: OK");
})();
