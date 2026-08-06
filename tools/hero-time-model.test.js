const assert=require("node:assert/strict");
const M=require("../hero-time-presets.js");
const S=require("../site-theme-state.js");
const at=(h,m=0)=>new Date(2026,7,6,h,m,0,0);

assert.equal(M.resolveAutomatic,S.resolveAutomatic);
assert.equal(M.resolveState,S.resolveState);
assert.equal(M.normalizeMode,S.normalizeMode);
assert.equal(M.msUntilNextBoundary,S.msUntilNextBoundary);
assert.equal(Object.hasOwn(M,"BOUNDARIES"),false);

[[3,59,"night"],[4,0,"pre-dawn"],[6,0,"sunrise"],
 [9,0,"daytime"],[17,0,"dusk"],[18,30,"sunset"],
 [20,30,"night"],[23,59,"night"]].forEach(([h,m,want])=>
  assert.equal(M.resolveAutomatic(at(h,m)),want));

assert.equal(M.normalizeMode("sunset"),"sunset");
assert.equal(M.normalizeMode("garbage"),"auto");
assert.equal(M.resolveState("off",at(12)),"off");
assert.equal(M.resolveState("auto",at(12)),"daytime");
M.MODES.slice(1).forEach(mode=>assert.equal(M.resolveState(mode,at(12)),mode));
assert.equal(M.msUntilNextBoundary(at(3,59)),60_000);
assert.equal(M.msUntilNextBoundary(at(18,29)),60_000);
assert.equal(M.msUntilNextBoundary(at(20,30)),7*60*60_000+30*60_000);
assert.equal(M.msUntilNextBoundary(at(5,59)),60_000);
assert.equal(M.msUntilNextBoundary(at(20,29)),60_000);
assert.equal(M.msUntilNextBoundary(at(23,59)),4*60*60_000+60_000);
assert.ok(Object.isFrozen(M.PRESETS));
assert.deepEqual(M.MODES,["auto","off","pre-dawn","sunrise","daytime","dusk","sunset","night"]);
assert.deepEqual(M.STATES,["pre-dawn","sunrise","daytime","dusk","sunset","night"]);
M.STATES.forEach(state=>{
 assert.ok(Object.isFrozen(M.PRESETS[state]));
 assert.ok(Object.isFrozen(M.PRESETS[state].colors));
 assert.ok(Object.isFrozen(M.PRESETS[state].light));
 assert.ok(Object.isFrozen(M.PRESETS[state].nodes));
 assert.ok(Object.isFrozen(M.PRESETS[state].nodes[0]));
 assert.equal(M.PRESETS[state].nodes.length,5);
});

const a=M.PRESETS.sunrise,b=M.PRESETS.night;
assert.deepEqual(M.interpolatePreset(a,b,0),a);
assert.deepEqual(M.interpolatePreset(a,b,1),b);
const mid=M.interpolatePreset(a,b,.5);
assert.notDeepEqual(mid.colors,a.colors);
assert.equal(mid.nodes.length,5);
assert.equal(a.nodes[0].x,M.PRESETS.sunrise.nodes[0].x);
assert.notStrictEqual(M.interpolatePreset(a,b,0),a);
assert.notStrictEqual(M.interpolatePreset(a,b,0).nodes,a.nodes);
assert.deepEqual(M.interpolatePreset(a,b,-1),a);
assert.deepEqual(M.interpolatePreset(a,b,2),b);
