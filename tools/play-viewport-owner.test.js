const assert = require("node:assert/strict");
const { createController } = require("../play-viewport.js");

function makeHarness({ scrollX = 0, scrollY = 0, focusId = "launch", cancelWorks = true } = {}) {
  const classes = new Set();
  const raf = [];
  const events = [];
  const body = {
    classList: {
      contains(name) { return classes.has(name); },
      toggle(name, on) {
        if (on) classes.add(name);
        else classes.delete(name);
      },
    },
    dataset: {},
  };
  const focus = {
    id: focusId,
    isConnected: true,
    focus(options) {
      events.push(["focus", this.id, options]);
    },
  };
  const windowObject = { scrollX, scrollY };

  return {
    body,
    focus,
    events,
    options: {
      body,
      window: windowObject,
      document: { body, activeElement: focus },
      requestAnimationFrame(callback) {
        raf.push(callback);
        return raf.length;
      },
      cancelAnimationFrame(id) {
        if (cancelWorks && raf[id - 1]) raf[id - 1] = null;
      },
      scrollTo(x, y) {
        events.push(["scroll", x, y]);
      },
    },
    flushAnimationFrame() {
      const pending = raf.splice(0);
      for (const callback of pending) if (callback) callback();
    },
  };
}

function testNestedOwnersRestoreOnlyAfterFinalLeave() {
  // Catches duplicate named owners behaving like numeric references or nested
  // owners restoring the hub while another arena is still active.
  const h = makeHarness({ scrollX: 7, scrollY: 412, focusId: "pcExped" });
  const owner = createController(h.options);

  owner.enter("picker");
  owner.enter("picker");
  assert.equal(h.body.classList.contains("playViewportOwned"), true);
  assert.equal(h.body.dataset.playViewportOwners, "picker");

  owner.enter("soccer");
  assert.equal(h.body.dataset.playViewportOwners, "picker soccer");
  owner.leave("picker");
  owner.leave("picker");
  assert.equal(owner.active(), true);
  assert.equal(owner.has("soccer"), true);
  assert.deepEqual(h.events, []);

  owner.leave("soccer");
  assert.equal(h.body.classList.contains("playViewportOwned"), false);
  assert.equal("playViewportOwners" in h.body.dataset, false);
  assert.deepEqual(h.events, []);
  h.flushAnimationFrame();
  assert.deepEqual(h.events, [
    ["scroll", 7, 412],
    ["focus", "pcExped", { preventScroll: true }],
  ]);
}

function testStaleRestoreCannotStealAReplacementArena() {
  // Catches a final-leave rAF restoring old scroll/focus after a rapid relaunch.
  const h = makeHarness({ scrollX: 7, scrollY: 412, focusId: "pcExped", cancelWorks: false });
  const owner = createController(h.options);

  owner.enter("picker");
  owner.leave("picker");
  owner.enter("race");
  h.flushAnimationFrame();

  assert.equal(owner.active(), true);
  assert.equal(h.body.dataset.playViewportOwners, "race");
  assert.deepEqual(h.events, []);
}

function testValidationMissingLeaveAndDestroy() {
  // Catches invalid lifecycle names, destructive missing leaves, and teardown
  // restoring focus to an element that has already left the document.
  const h = makeHarness({ scrollX: 7, scrollY: 412, focusId: "pcExped" });
  const owner = createController(h.options);

  assert.throws(() => owner.enter("unknown"), /Unknown Play viewport owner/);
  assert.throws(() => owner.leave("unknown"), /Unknown Play viewport owner/);
  owner.leave("soccer");
  assert.equal(owner.active(), false);

  owner.enter("tournament");
  h.focus.isConnected = false;
  owner.leave("tournament");
  owner.destroy();
  h.flushAnimationFrame();

  assert.equal(owner.active(), false);
  assert.equal(h.body.classList.contains("playViewportOwned"), false);
  assert.equal("playViewportOwners" in h.body.dataset, false);
  assert.deepEqual(h.events, []);
}

testNestedOwnersRestoreOnlyAfterFinalLeave();
testStaleRestoreCannotStealAReplacementArena();
testValidationMissingLeaveAndDestroy();
console.log("play viewport owner unit contract: PASS");
