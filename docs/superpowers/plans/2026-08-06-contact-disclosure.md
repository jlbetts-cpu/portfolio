# Shared Contact Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Contact a visible, semantic, token-styled disclosure on all ten shipping pages, with correct mouse, keyboard, touch, dark-mode, reduced-motion, and forced-colors behavior.

**Architecture:** Keep the existing `.jbDisc` / `.jbDiscGo` / `.jbDiscMenu` shared-header boundary and make `.jbDiscGo` one semantic button containing the envelope, label, and inline chevron. `header.js` remains the single behavior owner: it coordinates disclosure state, pointer delays, focus, click/touch, menu keyboard navigation, outside dismissal, and one-open-at-a-time exclusivity. A Node VM harness tests the controller without adding a DOM dependency, while Python HTML/CSS contracts prevent the ten copied header instances from drifting.

**Tech Stack:** Static HTML, token-driven CSS, vanilla ES5 JavaScript, Node.js built-in test runner and `vm`, Python 3 standard-library HTML parsing, local browser verification.

## Global Constraints

- Keep the existing envelope icon and `Contact` label.
- Add one small inline chevron inside the same nav item; there is no separate caret button.
- The trigger is exactly `<button type="button">`, is visually unfilled at rest, and keeps the header's shared icon stroke, ink, spacing, hit target, hover material, active material, and focus tokens.
- The chevron changes orientation when expanded and does not transition when `prefers-reduced-motion: reduce` is active.
- The menu contains exactly LinkedIn, Instagram, and Email, in that order, with the existing icons and destinations.
- LinkedIn remains `https://www.linkedin.com/in/jaydenbetts`; Instagram remains `https://www.instagram.com/jaydenleebetts`; Email remains `mailto:jaydenlbetts@gmail.com`.
- LinkedIn and Instagram retain `target="_blank" rel="noopener noreferrer"`; Email does not gain external-window attributes.
- Remove every touch-only Contact destination row and separator. Contact never navigates to `#contact` or `index.html#contact` after this change.
- Desktop fine pointer: hover after the existing 120 ms dwell, keyboard focus, or click opens the menu. The existing 260 ms pointer-leave grace period remains.
- Touch/coarse pointer: the first tap opens the menu; only one of the three menu links performs an action.
- Escape closes and returns focus to the Contact trigger. Outside click and focus leaving the disclosure close without moving focus.
- `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, button semantics, menu semantics, and link names remain accurate.
- Only one `.jbNav .jbDisc` may be open at a time, including future shared-header disclosures.
- Reuse the current `.jbDiscMenu` paper/ink material variables and the future site-wide theme's semantic overrides; do not duplicate theme colors in this feature.
- Preserve all unrelated header destinations, active-page state, sticky/fixed behavior, back-link behavior, page content, and footer content.
- Shipping pages are exactly `index.html`, `about.html`, `apollo.html`, `bearings.html`, `cluster.html`, `strata.html`, `ucdavis.html`, `play.html`, `headmaker.html`, and `gradientlab.html`. Do not modify `header-prototype.html`, `index-local-preview.html`, specimens, or audit utilities.
- Add no package, framework, network request, or third-party dependency.
- Keep production JavaScript ES5-compatible with the existing `header.js` style.

---

## File map

- Create `tools/header-disclosure.test.js`: dependency-free VM/DOM harness for shared disclosure interaction, timing, exclusivity, keyboard movement, and focus restoration.
- Create `tools/header-contact-markup-check.py`: parses all ten shipping pages and locks the button/menu/link contract and exact external destinations.
- Create `tools/header-contact-style-check.py`: locks chevron geometry/state, existing menu clamps, reduced motion, forced colors, current-color theming, and removal of touch-row CSS.
- Modify `header.js`: replace the touch-row/navigation-era disclosure controller with button disclosure behavior and one shared document dismissal listener.
- Modify `header.css`: style the inline chevron, remove dead `.jbDiscTouch` rules, preserve the shared menu surface/clamps, and add reduced-motion and forced-colors rules.
- Modify `index.html:1575-1587`: replace Contact's anchor/touch row with the shared button/menu markup.
- Modify `about.html:463-465`: replace Contact's anchor/touch row with the shared button/menu markup.
- Modify `apollo.html:665-677`: update the stale split-control comment and shared Contact markup.
- Modify `bearings.html:641-653`: update the stale split-control comment and shared Contact markup.
- Modify `cluster.html:641-653`: update the stale split-control comment and shared Contact markup.
- Modify `strata.html:658-670`: update the stale split-control comment and shared Contact markup.
- Modify `ucdavis.html:690-702`: update the stale split-control comment and shared Contact markup.
- Modify `play.html:585-597`: update the stale split-control comment and shared Contact markup.
- Modify `headmaker.html:589-601`: update the stale split-control comment and shared Contact markup.
- Modify `gradientlab.html:462-474`: update the stale split-control comment and shared Contact markup.

---

### Task 1: Make the shared disclosure controller input-correct

**Files:**
- Create: `tools/header-disclosure.test.js`
- Modify: `header.js:64-165`

**Interfaces:**
- Consumes: `.jbNav`, each `.jbDisc` wrapper, its `.jbDiscGo` trigger, and its `.jbDiscMenu` popup.
- Consumes menu items through the exact selector `[role="menuitem"]`.
- Produces no global API. Open state is represented only by `wrap.classList.contains("open")` and `trigger.getAttribute("aria-expanded") === "true"`.
- Pointer hover opens after `DISC_OPEN_DELAY = 120`; pointer leave closes after `DISC_CLOSE_DELAY = 260` unless focus or hover has returned.
- `ArrowDown`, `ArrowUp`, `Home`, and `End` move focus among menu items. Escape closes and focuses the trigger.

- [ ] **Step 1: Write the VM behavior harness and failing tests**

Create this complete test file:

```js
// tools/header-disclosure.test.js
const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const vm=require("node:vm");

const source=fs.readFileSync(require.resolve("../header.js"),"utf8");

function makeClock(){
 let now=0,nextId=0,jobs=[];
 return {
  setTimeout(fn,delay){
   const job={id:++nextId,at:now+(delay||0),fn,cancelled:false};
   jobs.push(job);return job.id;
  },
  clearTimeout(id){jobs.forEach(job=>{if(job.id===id)job.cancelled=true;});},
  tick(ms){
   const end=now+ms;
   for(;;){
    jobs.sort((a,b)=>a.at-b.at||a.id-b.id);
    const job=jobs.find(candidate=>!candidate.cancelled&&candidate.at<=end);
    if(!job)break;
    job.cancelled=true;now=job.at;job.fn();
   }
   now=end;
  }
 };
}

function makeHarness({fine=true,count=2}={}){
 const clock=makeClock();
 let document;

 class FakeElement{
  constructor(name){
   this.name=name;this.listeners={};this.attributes=new Map();this.children=[];
   this.parentNode=null;this.ownerWrap=null;this.hovered=false;
   const values=new Set();
   this.classList={
    add:(...names)=>names.forEach(name=>values.add(name)),
    remove:(...names)=>names.forEach(name=>values.delete(name)),
    contains:name=>values.has(name),
    toggle:(name,on)=>on?values.add(name):values.delete(name)
   };
   this.style={};
  }
  addEventListener(type,handler){(this.listeners[type]||(this.listeners[type]=[])).push(handler);}
  emit(type,event={}){
   event.type=type;if(!event.target)event.target=this;
   event.defaultPrevented=false;event.propagationStopped=false;
   event.preventDefault=()=>{event.defaultPrevented=true;};
   event.stopPropagation=()=>{event.propagationStopped=true;};
   (this.listeners[type]||[]).slice().forEach(handler=>handler(event));
   return event;
  }
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.has(name)?this.attributes.get(name):null;}
  hasAttribute(name){return this.attributes.has(name);}
  appendChild(child){child.parentNode=this;this.children.push(child);return child;}
  contains(target){
   for(let node=target;node;node=node.parentNode)if(node===this)return true;
   return false;
  }
  matches(selector){return selector===":hover"&&this.hovered;}
  getBoundingClientRect(){return {left:0,top:0,width:0,height:0};}
  focus(){
   if(document.activeElement===this)return;
   const previous=document.activeElement;
   if(previous&&previous.ownerWrap)previous.ownerWrap.emit("focusout",{target:previous,relatedTarget:this});
   document.activeElement=this;
   if(this.ownerWrap)this.ownerWrap.emit("focusin",{target:this,relatedTarget:previous});
  }
 }

 const disclosures=[];
 for(let index=0;index<count;index+=1){
  const wrap=new FakeElement("wrap"+index);
  const go=new FakeElement("go"+index);
  const menu=new FakeElement("menu"+index);
  go.ownerWrap=wrap;menu.ownerWrap=wrap;go.parentNode=wrap;menu.parentNode=wrap;
  go.setAttribute("aria-expanded","false");
  const items=["LinkedIn","Instagram","Email"].map(label=>{
   const item=new FakeElement(label);item.ownerWrap=wrap;item.parentNode=menu;
   item.setAttribute("role","menuitem");return item;
  });
  menu.children=items;
  wrap.querySelector=selector=>selector===".jbDiscGo"?go:selector===".jbDiscMenu"?menu:null;
  menu.querySelectorAll=selector=>selector==='[role="menuitem"]'?items:[];
  disclosures.push({wrap,go,menu,items});
 }

 const nav=new FakeElement("nav");
 nav.querySelector=selector=>selector===".jbHome"?null:null;
 nav.querySelectorAll=selector=>selector===".jbDisc"?disclosures.map(entry=>entry.wrap):[];
 nav.closest=()=>null;
 const body=new FakeElement("body");
 const root=new FakeElement("root");
 const docListeners={};
 document={
  body,documentElement:root,activeElement:null,
  querySelector:selector=>selector===".jbNav"?nav:null,
  createElement:name=>new FakeElement(name),
  addEventListener(type,handler){(docListeners[type]||(docListeners[type]=[])).push(handler);},
  emit(type,event={}){(docListeners[type]||[]).forEach(handler=>handler(event));}
 };
 const window={
  document,
  matchMedia(query){return {matches:fine&&query==="(hover:hover) and (pointer:fine)"};}
 };
 window.window=window;
 const context={
  window,document,
  setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,
  requestAnimationFrame:()=>1,
  addEventListener(){},
  MutationObserver:function(){this.observe=function(){};}
 };
 vm.runInNewContext(source,context,{filename:"header.js"});

 function pointerActivate(index){
  const entry=disclosures[index];
  entry.go.emit("pointerdown",{pointerType:fine?"mouse":"touch"});
  entry.go.focus();
  entry.go.emit("click");
 }
 return {clock,document,disclosures,pointerActivate,FakeElement};
}

function isOpen(entry){
 return entry.wrap.classList.contains("open")&&entry.go.getAttribute("aria-expanded")==="true";
}

test("fine-pointer hover keeps the existing dwell and leave grace periods",()=>{
 const h=makeHarness({fine:true,count:1});
 const entry=h.disclosures[0];
 entry.wrap.hovered=true;entry.wrap.emit("mouseenter");
 h.clock.tick(119);assert.equal(isOpen(entry),false);
 h.clock.tick(1);assert.equal(isOpen(entry),true);
 entry.wrap.hovered=false;entry.wrap.emit("mouseleave");
 h.clock.tick(259);assert.equal(isOpen(entry),true);
 h.clock.tick(1);assert.equal(isOpen(entry),false);
});

test("keyboard focus opens and focus leaving closes",()=>{
 const h=makeHarness({count:1});
 const entry=h.disclosures[0];
 entry.go.focus();assert.equal(isOpen(entry),true);
 const outside=new h.FakeElement("outside");outside.focus();
 h.clock.tick(0);assert.equal(isOpen(entry),false);
});

test("first coarse-pointer tap opens and a second trigger tap closes",()=>{
 const h=makeHarness({fine:false,count:1});
 const entry=h.disclosures[0];
 h.pointerActivate(0);assert.equal(isOpen(entry),true);
 h.pointerActivate(0);assert.equal(isOpen(entry),false);
});

test("opening one shared disclosure closes the previous disclosure",()=>{
 const h=makeHarness({count:2});
 h.disclosures[0].go.focus();assert.equal(isOpen(h.disclosures[0]),true);
 h.disclosures[1].go.focus();
 assert.equal(isOpen(h.disclosures[0]),false);
 assert.equal(isOpen(h.disclosures[1]),true);
});

test("outside click closes without stealing focus",()=>{
 const h=makeHarness({count:1});
 const entry=h.disclosures[0];entry.go.focus();
 const outside=new h.FakeElement("outside");
 h.document.emit("click",{target:outside});
 assert.equal(isOpen(entry),false);
 assert.equal(h.document.activeElement,entry.go);
});

test("Escape closes and returns focus without focusin reopening",()=>{
 const h=makeHarness({count:1});
 const entry=h.disclosures[0];entry.items[1].focus();
 entry.wrap.emit("keydown",{key:"Escape",target:entry.items[1]});
 h.clock.tick(0);
 assert.equal(isOpen(entry),false);
 assert.equal(h.document.activeElement,entry.go);
});

test("menu arrow keys, Home, and End move among menu links",()=>{
 const h=makeHarness({count:1});
 const entry=h.disclosures[0];entry.go.focus();
 entry.wrap.emit("keydown",{key:"ArrowDown",target:entry.go});
 assert.equal(h.document.activeElement,entry.items[0]);
 entry.wrap.emit("keydown",{key:"End",target:entry.items[0]});
 assert.equal(h.document.activeElement,entry.items[2]);
 entry.wrap.emit("keydown",{key:"ArrowDown",target:entry.items[2]});
 assert.equal(h.document.activeElement,entry.items[0]);
 entry.wrap.emit("keydown",{key:"ArrowUp",target:entry.items[0]});
 assert.equal(h.document.activeElement,entry.items[2]);
 entry.wrap.emit("keydown",{key:"Home",target:entry.items[2]});
 assert.equal(h.document.activeElement,entry.items[0]);
});

test("choosing a menu link closes without cancelling its action",()=>{
 const h=makeHarness({count:1});
 const entry=h.disclosures[0];entry.go.focus();
 const click=entry.menu.emit("click",{target:entry.items[0]});
 assert.equal(isOpen(entry),false);
 assert.equal(click.defaultPrevented,false);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tools/header-disclosure.test.js`  
Expected: FAIL in at least the coarse-pointer click, one-open-at-a-time, arrow-key, and menu-choice cases because the current controller only intercepts click under `(hover:none)`, has no shared exclusivity, and has no menu-key handling.

- [ ] **Step 3: Replace the disclosure controller with the tested state machine**

Keep the scroll and active-indicator sections unchanged. Replace the current disclosure block, including `.jbDiscTouch` DOM removal and its per-wrapper document click handler, with this implementation and update the preceding prose comment to describe the approved button disclosure rather than deleted carets/navigation:

```js
var DISC_OPEN_DELAY  = 120;
var DISC_CLOSE_DELAY = 260;
var disclosures=[];

function menuItemFrom(menu,target){
  while(target&&target!==menu){
    if(target.getAttribute&&target.getAttribute("role")==="menuitem") return target;
    target=target.parentNode;
  }
  return null;
}

[].forEach.call(nav.querySelectorAll(".jbDisc"), function(wrap){
  if(wrap.id === "moodbar") return;
  var go=wrap.querySelector(".jbDiscGo");
  var menu=wrap.querySelector(".jbDiscMenu");
  if(!go||!menu) return;
  var openT=0,closeT=0,suppressFocusOpen=false,entry;

  function clearTimers(){clearTimeout(openT);clearTimeout(closeT);openT=closeT=0;}
  function isOpen(){return wrap.classList.contains("open");}
  function close(){
    clearTimers();wrap.classList.remove("open");go.setAttribute("aria-expanded","false");
  }
  function open(){
    clearTimers();
    disclosures.forEach(function(other){if(other!==entry)other.close();});
    wrap.classList.add("open");go.setAttribute("aria-expanded","true");
  }
  function items(){return [].slice.call(menu.querySelectorAll('[role="menuitem"]'));}
  function focusItem(index){
    var list=items();if(!list.length)return;
    list[(index+list.length)%list.length].focus();
  }

  entry={wrap:wrap,go:go,menu:menu,open:open,close:close,isOpen:isOpen};
  disclosures.push(entry);

  wrap.addEventListener("focusin",function(){if(!suppressFocusOpen)open();});
  wrap.addEventListener("focusout",function(){
    closeT=setTimeout(function(){if(!wrap.contains(document.activeElement))close();},0);
  });

  go.addEventListener("pointerdown",function(){suppressFocusOpen=true;});
  go.addEventListener("pointercancel",function(){suppressFocusOpen=false;});
  go.addEventListener("click",function(e){
    e.preventDefault();suppressFocusOpen=false;
    if(isOpen())close();else open();
  });

  wrap.addEventListener("keydown",function(e){
    var list=items(),current=list.indexOf(e.target);
    if(e.key==="Escape"&&isOpen()){
      e.preventDefault();e.stopPropagation();suppressFocusOpen=true;
      close();go.focus();
      setTimeout(function(){suppressFocusOpen=false;},0);
      return;
    }
    if(e.target===go&&(e.key==="ArrowDown"||e.key==="ArrowUp")){
      e.preventDefault();open();focusItem(e.key==="ArrowDown"?0:list.length-1);return;
    }
    if(current<0)return;
    if(e.key==="ArrowDown"){e.preventDefault();focusItem(current+1);}
    else if(e.key==="ArrowUp"){e.preventDefault();focusItem(current-1);}
    else if(e.key==="Home"){e.preventDefault();focusItem(0);}
    else if(e.key==="End"){e.preventDefault();focusItem(list.length-1);}
  });

  menu.addEventListener("click",function(e){if(menuItemFrom(menu,e.target))close();});

  if(window.matchMedia&&window.matchMedia("(hover:hover) and (pointer:fine)").matches){
    wrap.addEventListener("mouseenter",function(){
      clearTimeout(closeT);if(!isOpen())openT=setTimeout(open,DISC_OPEN_DELAY);
    });
    wrap.addEventListener("mouseleave",function(){
      clearTimeout(openT);
      closeT=setTimeout(function(){
        if(!wrap.matches(":hover")&&!wrap.contains(document.activeElement))close();
      },DISC_CLOSE_DELAY);
    });
  }
});

document.addEventListener("click",function(e){
  disclosures.forEach(function(entry){
    if(entry.isOpen()&&!entry.wrap.contains(e.target))entry.close();
  });
});
```

The `pointerdown` guard is required: browsers focus a button before dispatching its click. Without the guard, `focusin` would open and the same first click would immediately toggle it closed. The Escape suppression is also required: focusing the trigger from a menu link emits `focusin`, which must not reopen the menu that Escape just closed.

- [ ] **Step 4: Run controller and syntax tests GREEN**

```bash
node --test tools/header-disclosure.test.js
node --check header.js
```

Expected: eight subtests pass and the syntax check exits 0.

- [ ] **Step 5: Commit the shared behavior**

```bash
git add header.js tools/header-disclosure.test.js
git commit -m "Make header disclosures input-correct"
```

---

### Task 2: Ship one semantic Contact button and menu on every page

**Files:**
- Create: `tools/header-contact-markup-check.py`
- Modify: `index.html:1575-1587`
- Modify: `about.html:463-465`
- Modify: `apollo.html:665-677`
- Modify: `bearings.html:641-653`
- Modify: `cluster.html:641-653`
- Modify: `strata.html:658-670`
- Modify: `ucdavis.html:690-702`
- Modify: `play.html:585-597`
- Modify: `headmaker.html:589-601`
- Modify: `gradientlab.html:462-474`

**Interfaces:**
- Produces one `button.jbDiscGo[data-nav-item="contact"]` per shipping page, with `type="button"`, `aria-label="Contact"`, `aria-haspopup="menu"`, `aria-expanded="false"`, and `aria-controls="jbContactMenu"`.
- Produces one `div#jbContactMenu.jbDiscMenu[role="menu"][aria-label="Contact options"]` per shipping page.
- Produces exactly three `a[role="menuitem"]` children named LinkedIn, Instagram, and Email in that order.
- Produces one decorative `svg.jbDiscChevron[aria-hidden="true"]` inside the trigger; it is not a second interactive element or tab stop.

- [ ] **Step 1: Write the failing ten-page markup contract**

```python
# tools/header-contact-markup-check.py
from html.parser import HTMLParser
from pathlib import Path

PAGES = (
    "index.html", "about.html", "apollo.html", "bearings.html", "cluster.html",
    "strata.html", "ucdavis.html", "play.html", "headmaker.html", "gradientlab.html",
)

EXPECTED_LINKS = (
    ("LinkedIn", "https://www.linkedin.com/in/jaydenbetts", "_blank", {"noopener", "noreferrer"}),
    ("Instagram", "https://www.instagram.com/jaydenleebetts", "_blank", {"noopener", "noreferrer"}),
    ("Email", "mailto:jaydenlbetts@gmail.com", None, set()),
)

class ContactParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.wrappers = 0
        self.triggers = []
        self.chevrons = []
        self.trigger_icons = []
        self.trigger_label = []
        self.in_trigger = False
        self.in_trigger_label = False
        self.menus = []
        self.in_menu = False
        self.active_link = None
        self.links = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        classes = set(data.get("class", "").split())
        if {"jbDisc", "jbContact"}.issubset(classes):
            self.wrappers += 1
        if "jbDiscGo" in classes:
            self.triggers.append((tag, data))
            self.in_trigger = True
        elif self.in_trigger and tag == "svg":
            self.trigger_icons.append(classes)
        elif self.in_trigger and "jbLbl" in classes:
            self.in_trigger_label = True
        if self.in_trigger and "jbDiscChevron" in classes:
            self.chevrons.append((tag, data))
        if data.get("id") == "jbContactMenu":
            self.in_menu = True
            self.menus.append((tag, data))
        elif self.in_menu and tag == "a":
            self.active_link = {"attrs": data, "text": []}

    def handle_data(self, data):
        if self.active_link is not None:
            self.active_link["text"].append(data)
        elif self.in_trigger_label:
            self.trigger_label.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.active_link is not None:
            text = " ".join("".join(self.active_link["text"]).split())
            self.links.append((text, self.active_link["attrs"]))
            self.active_link = None
        elif tag == "span" and self.in_trigger_label:
            self.in_trigger_label = False
        elif tag == "button" and self.in_trigger:
            self.in_trigger = False
        elif tag == "div" and self.in_menu:
            self.in_menu = False

for page_name in PAGES:
    source = Path(page_name).read_text(encoding="utf-8")
    parser = ContactParser()
    parser.feed(source)
    parser.close()

    assert parser.wrappers == 1, (page_name, parser.wrappers)
    assert len(parser.triggers) == 1, (page_name, parser.triggers)
    tag, trigger = parser.triggers[0]
    assert tag == "button", (page_name, tag)
    assert trigger.get("type") == "button", (page_name, trigger)
    assert trigger.get("data-nav-item") == "contact", (page_name, trigger)
    assert trigger.get("aria-label") == "Contact", (page_name, trigger)
    assert trigger.get("aria-haspopup") == "menu", (page_name, trigger)
    assert trigger.get("aria-expanded") == "false", (page_name, trigger)
    assert trigger.get("aria-controls") == "jbContactMenu", (page_name, trigger)
    assert "href" not in trigger, (page_name, trigger)
    assert " ".join("".join(parser.trigger_label).split()) == "Contact", (page_name, parser.trigger_label)
    assert len(parser.trigger_icons) == 2, (page_name, parser.trigger_icons)
    assert "gIco" in parser.trigger_icons[0], (page_name, parser.trigger_icons)
    assert "jbDiscChevron" in parser.trigger_icons[1], (page_name, parser.trigger_icons)

    assert len(parser.chevrons) == 1, (page_name, parser.chevrons)
    chevron_tag, chevron = parser.chevrons[0]
    assert chevron_tag == "svg", (page_name, chevron_tag)
    assert chevron.get("aria-hidden") == "true", (page_name, chevron)
    assert chevron.get("viewbox") == "0 0 24 24", (page_name, chevron)

    assert len(parser.menus) == 1, (page_name, parser.menus)
    menu_tag, menu = parser.menus[0]
    assert menu_tag == "div", (page_name, menu_tag)
    assert menu.get("role") == "menu", (page_name, menu)
    assert menu.get("aria-label") == "Contact options", (page_name, menu)
    assert "jbDiscMenu" in set(menu.get("class", "").split()), (page_name, menu)

    assert len(parser.links) == 3, (page_name, parser.links)
    for (actual_name, attrs), (name, href, target, rel) in zip(parser.links, EXPECTED_LINKS):
        assert actual_name == name, (page_name, actual_name, name)
        assert attrs.get("role") == "menuitem", (page_name, name, attrs)
        assert attrs.get("href") == href, (page_name, name, attrs)
        assert attrs.get("target") == target, (page_name, name, attrs)
        assert set(attrs.get("rel", "").split()) == rel, (page_name, name, attrs)

    assert "jbDiscTouch" not in source, page_name

print(f"contact markup: OK ({len(PAGES)} pages)")
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `python3 tools/header-contact-markup-check.py`  
Expected: FAIL on `index.html` because the current trigger is an `<a aria-haspopup="true" href="#contact">`, the menu lacks `role="menu"`, and the redundant `.jbDiscTouch` destination exists.

- [ ] **Step 3: Replace Contact markup identically across all ten headers**

Use this exact structure on every shipping page, preserving each page's surrounding group indentation. Do not change Work, About, Play, Home, Back, active-page attributes, footer markup, or script/style links.

```html
<span class="jbDisc jbContact">
 <button class="jbDiscGo" data-nav-item="contact" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="jbContactMenu" aria-label="Contact"><svg class="gIco" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z"/><path d="M3 7l9 6l9 -6"/></svg><span class="jbLbl">Contact</span><svg class="jbDiscChevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6l6 -6"/></svg></button>
 <div class="jbDiscMenu" id="jbContactMenu" role="menu" aria-label="Contact options"><a role="menuitem" href="https://www.linkedin.com/in/jaydenbetts" target="_blank" rel="noopener noreferrer"><svg class="gIco" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11l0 5"/><path d="M8 8l0 .01"/><path d="M12 16l0 -5"/><path d="M16 16v-3a2 2 0 0 0 -4 0"/><path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z"/></svg>LinkedIn</a><a role="menuitem" href="https://www.instagram.com/jaydenleebetts" target="_blank" rel="noopener noreferrer"><svg class="gIco" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4m0 4a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z"/><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M16.5 7.5l0 .01"/></svg>Instagram</a><a role="menuitem" href="mailto:jaydenlbetts@gmail.com"><svg class="gIco" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z"/><path d="M3 7l9 6l9 -6"/></svg>Email</a></div>
</span>
```

On the nine pages that currently carry the obsolete split-control comment, replace it with this accurate comment. `about.html` currently has no local Contact comment and does not need one added.

```html
<!-- CONTACT is one disclosure button: envelope, label, and inline chevron share
     one nav item and one 44px target. It never navigates to the footer. The menu
     keeps LinkedIn, Instagram, and Email in that order; header.js owns hover,
     focus, click/touch, Escape, outside dismissal, and exclusive open state. -->
```

- [ ] **Step 4: Run the markup and behavior contracts GREEN**

```bash
python3 tools/header-contact-markup-check.py
node --test tools/header-disclosure.test.js
node --check header.js
git diff --check
```

Expected: the markup checker reports `contact markup: OK (10 pages)`, all eight behavior tests pass, and both syntax/diff checks exit 0.

- [ ] **Step 5: Commit the semantic markup**

```bash
git add index.html about.html apollo.html bearings.html cluster.html strata.html ucdavis.html play.html headmaker.html gradientlab.html tools/header-contact-markup-check.py
git commit -m "Make Contact a semantic header disclosure"
```

---

### Task 3: Style the chevron and accessibility modes from shared tokens

**Files:**
- Create: `tools/header-contact-style-check.py`
- Modify: `header.css:644-812`

**Interfaces:**
- Consumes: `.jbDiscChevron` inside `.jbDiscGo`, and the controller-owned `aria-expanded` value.
- Produces: an 11 px `--ico-xs` current-color chevron using the header's 1.5 px non-scaling stroke.
- Expanded orientation is selected by `.jbDiscGo[aria-expanded="true"] .jbDiscChevron`.
- Preserves `.jbDiscMenu` width clamp `min(var(--menu-w), calc(100vw - var(--sp-32)))`, height clamp `var(--menu-max-h)`, and internal vertical scrolling.
- Forced colors exposes the otherwise box-shadow-only menu boundary with `1px solid CanvasText`.

- [ ] **Step 1: Write the failing shared-style contract**

```python
# tools/header-contact-style-check.py
import re
from pathlib import Path

css = Path("header.css").read_text(encoding="utf-8")
compact = re.sub(r"\s+", "", css)

required = (
    ".jbDiscChevron{width:var(--ico-xs);height:var(--ico-xs);flex:00var(--ico-xs);display:block;fill:none;stroke:currentColor;stroke-width:1.5;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;transition:transformvar(--ease-out-dur)var(--ease-out)}",
    '.jbDiscGo[aria-expanded="true"].jbDiscChevron{transform:rotate(180deg)}',
    "max-width:min(var(--menu-w),calc(100vw-var(--sp-32)))",
    "max-height:var(--menu-max-h);overflow-y:auto",
    "@media(prefers-reduced-motion:reduce){.jbDiscMenu,.jbDisc.open.jbDiscMenu,.jbDiscChevron{transition:none}}",
    "@media(forced-colors:active){.jbDiscMenu{border:1pxsolidCanvasText;box-shadow:none}.jbDiscChevron{forced-color-adjust:auto}}",
)
for fragment in required:
    assert fragment in compact, fragment

assert "background:var(--nav-mat)" in compact
assert "box-shadow:var(--nav-rim)" in compact
assert "jbDiscTouch" not in css
assert ".jbNav[data-surface=\"ink\"]" in css
print("contact styles: OK")
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `python3 tools/header-contact-style-check.py`  
Expected: FAIL because `.jbDiscChevron` and disclosure-specific reduced-motion/forced-colors rules do not exist, and `.jbDiscTouch` CSS remains.

- [ ] **Step 3: Replace the obsolete no-caret/touch-row CSS with the approved disclosure styling**

Keep `.jbDisc{position:relative;display:inline-flex;align-items:center}` and all existing menu surface, row, open, clamp, and responsive-anchor rules. Add the chevron immediately after `.jbDisc`:

```css
.jbDiscChevron{width:var(--ico-xs);height:var(--ico-xs);flex:0 0 var(--ico-xs);
  display:block;fill:none;stroke:currentColor;stroke-width:1.5;
  vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round;
  transition:transform var(--ease-out-dur) var(--ease-out)}
.jbDiscGo[aria-expanded="true"] .jbDiscChevron{transform:rotate(180deg)}
```

Delete the entire `.jbDiscTouch` default and `@media(hover:none)` block. Rewrite the disclosure and panel comments so they state these current facts: Contact is one button rather than a split/link control; its three children remain one hit target; click works for both fine and coarse pointers; the panel has three action links and no duplicated destination; its surface is shared by paper/ink theme variables.

Append these exact accessibility overrides after the open/menu transition rules, after any equal-specificity declarations they must override:

```css
@media(prefers-reduced-motion:reduce){
  .jbDiscMenu,.jbDisc.open .jbDiscMenu,.jbDiscChevron{transition:none}
}
@media(forced-colors:active){
  .jbDiscMenu{border:1px solid CanvasText;box-shadow:none}
  .jbDiscChevron{forced-color-adjust:auto}
}
```

Do not add a filled Contact-only background, a separate caret hit target, new hard-coded light/dark colors, a cast shadow, or a second menu width. The existing direct-button selectors already give `.jbDiscGo` the same nav font, padding, `--bar-item-h`, 44 px expanded target, hover material, focus outline, press scale, and mobile icon treatment as Work/About/Play.

- [ ] **Step 4: Run style, markup, behavior, token, and syntax checks GREEN**

```bash
python3 tools/header-contact-style-check.py
python3 tools/header-contact-markup-check.py
node --test tools/header-disclosure.test.js
node --check header.js
python3 tools/token-audit.py
git diff --check
```

Expected: both Python contracts print `OK`, all eight Node subtests pass, token audit reports zero errors, and syntax/diff checks exit 0.

- [ ] **Step 5: Commit shared disclosure styling**

```bash
git add header.css tools/header-contact-style-check.py
git commit -m "Style Contact disclosure states"
```

---

### Task 4: Verify every shipping header and regression gate

**Files:**
- Test only: `header.js`, `header.css`, all ten shipping HTML pages, and the three new test files.

**Interfaces:**
- No new interface. This task proves the HTML/CSS/controller contract on real pages and input modes.

- [ ] **Step 1: Run the complete automated regression suite from fresh output**

```bash
python3 tools/header-contact-markup-check.py
python3 tools/header-contact-style-check.py
node --test tools/header-disclosure.test.js
node tools/hero-time-model.test.js
node tools/hero-time-controller.test.js
python3 tools/hero-specimen-check.py
python3 tools/token-audit.py
node --check header.js
node --check hero-time.js
node --check hero-engine.js
git diff --check
```

Expected: every command exits 0; the two Contact contracts report `OK`, the disclosure suite reports eight passing tests, the existing hero-time tests retain their success output, and token audit reports zero errors.

- [ ] **Step 2: Serve the worktree and inspect the live contract**

From the worktree root, run:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

On each page, open Contact and run this diagnostic in the browser console:

```js
(()=>{
 const trigger=document.querySelector(".jbContact .jbDiscGo");
 const menu=document.getElementById(trigger.getAttribute("aria-controls"));
 const rect=menu.getBoundingClientRect();
 return {
  trigger:{tag:trigger.tagName,type:trigger.type,name:trigger.getAttribute("aria-label"),
   haspopup:trigger.getAttribute("aria-haspopup"),expanded:trigger.getAttribute("aria-expanded")},
  items:[...menu.querySelectorAll('[role="menuitem"]')].map(link=>({
   name:link.textContent.trim(),href:link.getAttribute("href"),target:link.getAttribute("target"),rel:link.getAttribute("rel")
  })),
  openCount:document.querySelectorAll(".jbNav .jbDisc.open").length,
  menuRect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
  viewport:{width:innerWidth,height:innerHeight},
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
 };
})()
```

Required on every route: `BUTTON`, `type: "button"`, name `Contact`, `haspopup: "menu"`, `expanded: "true"`, three exact items in order, `openCount: 1`, `overflow: 0`, and the menu rectangle fully inside a 16 px viewport gutter.

- [ ] **Step 3: Verify fine-pointer interaction at desktop width**

At 1280 × 800 on `index.html`, `about.html`, one case study (`apollo.html`), `play.html`, and `gradientlab.html`:

1. Cross Contact without dwelling: it remains closed through 119 ms.
2. Hover for at least 120 ms: it opens; move into the panel without loss.
3. Leave trigger and panel: it remains open through 259 ms and closes at 260 ms when focus is not inside.
4. Click the trigger from closed: it opens immediately. Click the same trigger again: it closes.
5. Click outside: it closes and does not move focus.
6. Confirm hover/focus material matches Work/About/Play, the trigger remains unfilled at rest, and envelope/label/chevron behave as one control.

- [ ] **Step 4: Verify keyboard-only behavior and accessible focus**

On `index.html` and a Back-header page such as `apollo.html`, use no pointer:

1. Tab to Contact: focus opens the menu and the trigger reports `aria-expanded="true"`.
2. Press ArrowDown: LinkedIn receives focus. ArrowDown wraps through Instagram and Email; ArrowUp wraps backward; Home and End move to the first and last links.
3. Tab through the three links and out of the wrapper: focus leaving closes the menu.
4. Reopen, focus Instagram, press Escape: the menu closes, `aria-expanded` becomes `false`, and focus returns to Contact without reopening.
5. Confirm a visible focus ring on trigger and links in light, dark, and forced-colors modes.

- [ ] **Step 5: Verify touch/coarse pointer at both required mobile sizes**

Using device emulation with touch and a coarse pointer, test `index.html`, `about.html`, all five case studies, `play.html`, `headmaker.html`, and `gradientlab.html` at both 390 × 844 and 320 × 800.

Required on every page and size:

- First tap on Contact opens; it does not navigate, change the URL fragment, or scroll to the footer.
- The only menu rows are LinkedIn, Instagram, and Email; there is no repeated Contact row or separator.
- Each menu row is at least 44 px tall and the Contact trigger remains at least 44 × 44 px.
- Menu left is at least 16 px, menu right is at most `innerWidth - 16`, menu bottom is reachable, and internal scroll activates only when the viewport height requires it.
- `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- Tapping outside closes. Tapping one of the three rows follows that row's unchanged `href` and does not invoke a footer destination.

- [ ] **Step 6: Verify light/dark surfaces and motion preferences**

Run the ten-page, three-size route matrix once with `<html data-theme="light">` and once with `<html data-theme="dark">` after the site-wide theme plan is present. If this plan is executed first, exercise the existing shared dark header surface with `document.querySelector('.jbNav').setAttribute('data-surface','ink')`, then restore `paper` after capture.

For both surfaces, confirm the menu consumes the header surface/rim tokens, icons and chevron inherit current ink, text remains readable, external destinations do not change, and Contact does not become a filled CTA. With `prefers-reduced-motion: reduce`, opening/closing and chevron orientation settle immediately with no transition; functionality and focus behavior remain unchanged.

- [ ] **Step 7: Verify forced colors**

Emulate `forced-colors: active`, open Contact by keyboard and by click, and confirm:

- The menu has a visible system-colored 1 px boundary rather than relying on suppressed box shadow.
- Trigger and each menu item retain visible focus outlines.
- Envelope, chevron, and menu icons remain visible in system colors.
- Expanded/collapsed orientation, `aria-expanded`, link order, and dismissal behavior remain intact.

- [ ] **Step 8: Review the final diff and commit only if verification required a correction**

Run:

```bash
git diff --stat
git diff --check
git status --short
```

Confirm the diff contains only `header.js`, `header.css`, the ten shipping pages, and the three new test files. If browser verification exposed a defect, add a focused failing assertion to the appropriate test first, make the minimal fix, rerun Task 4 Step 1, and commit those verified files with a message naming the defect. If no correction was needed, do not create an empty commit.

---

## Completion gate

Before claiming completion, invoke `superpowers:verification-before-completion`, review the entire branch diff, and use `superpowers:requesting-code-review`. Completion requires:

- Fresh passing output from every automated command in Task 4 Step 1.
- All ten shipping pages passing the markup contract with one button trigger, one menu, one chevron, and three exact action links.
- No `.jbDiscTouch` markup, CSS, or JavaScript and no Contact trigger `href` to a footer.
- Fine-pointer hover/focus/click, touch first-tap, outside click, focus leave, Escape focus return, menu arrow movement, link activation, and one-open-at-a-time behavior verified.
- Desktop, 390 × 844, and 320 × 800 checks complete with no horizontal overflow and the menu inside a 16 px viewport gutter.
- Paper/light, ink/dark, reduced-motion, and forced-colors checks complete.
- LinkedIn and Instagram retaining `_blank` plus `noopener noreferrer`; Email retaining only its `mailto:` destination.
- No unrelated destination, active-page, sticky/fixed, back-link, hero, footer, page-content, prototype, or specimen change in the final diff.
