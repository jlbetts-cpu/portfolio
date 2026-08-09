const assert=require("node:assert/strict");
const S=require("../site-theme-state.js");
const at=(h,m=0)=>new Date(2026,7,6,h,m,0,0);

[[3,59,"night"],[4,0,"pre-dawn"],[6,0,"sunrise"],
 [9,0,"daytime"],[17,0,"dusk"],[18,30,"sunset"],
 [20,30,"night"],[23,59,"night"]].forEach(([h,m,state])=>
  assert.equal(S.resolveAutomatic(at(h,m)),state));

assert.equal(S.normalizeMode("garbage"),"auto");
/* THE DEFAULT IS AN HOUR, AND IT IS NOT WHAT normalizeMode ANSWERS. One names
   the absence of a preference, the other an unreadable one; they were the same
   value while auto was also the default and they are different questions. */
assert.equal(S.DEFAULT_MODE,"daytime");
assert.ok(S.MODES.indexOf(S.DEFAULT_MODE)!==-1);
assert.equal(S.normalizeMode(null),"auto");
assert.equal(S.resolveState("off",at(12)),"off");
S.MODES.slice(1).forEach(mode=>assert.equal(S.resolveState(mode,at(12)),mode));

assert.equal(S.themeForState("night"),"dark");
S.STATES.filter(state=>state!=="night").forEach(state=>
  assert.equal(S.themeForState(state),"light"));
assert.equal(S.themeForState("off"),"light");

const offSnapshot=S.resolveSnapshot("off",at(23));
assert.deepEqual(offSnapshot,{mode:"off",state:"off",theme:"light"});
assert.ok(Object.isFrozen(offSnapshot));
const automaticSnapshot=S.resolveSnapshot("garbage",at(20,30));
assert.deepEqual(automaticSnapshot,{mode:"auto",state:"night",theme:"dark"});
assert.ok(Object.isFrozen(automaticSnapshot));

assert.equal(S.msUntilNextBoundary(at(3,59)),60_000);
assert.equal(S.msUntilNextBoundary(at(18,29)),60_000);
assert.equal(S.msUntilNextBoundary(at(20,30)),7*60*60_000+30*60_000);
assert.equal(S.msUntilNextBoundary(at(23,59)),4*60*60_000+60_000);
