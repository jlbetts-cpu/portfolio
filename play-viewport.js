(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.document) root.PlayViewportOwner = api.createController();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LEGAL = new Set(["picker", "soccer", "battle", "race", "tournament"]);

  function createController(options) {
    options = options || {};
    var win = options.window || (typeof window !== "undefined" ? window : null);
    var doc = options.document || (win && win.document) || null;
    var body = options.body || (doc && doc.body) || null;
    if (!body) throw new Error("Play viewport owner requires a body");

    var requestFrame = options.requestAnimationFrame ||
      (win && win.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : function (fn) { return setTimeout(fn, 0); });
    var cancelFrame = options.cancelAnimationFrame ||
      (win && win.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win) : function (id) { clearTimeout(id); });
    var scrollTo = options.scrollTo ||
      (win && win.scrollTo ? win.scrollTo.bind(win) : function () {});
    var owners = new Set();
    var restoreFrame = 0;
    var generation = 0;
    var captured = null;

    function validate(name) {
      if (!LEGAL.has(name)) throw new Error("Unknown Play viewport owner: " + name);
    }

    function sync() {
      var isActive = owners.size > 0;
      body.classList.toggle("playViewportOwned", isActive);
      if (isActive) body.dataset.playViewportOwners = Array.from(owners).sort().join(" ");
      else delete body.dataset.playViewportOwners;
    }

    function cancelPendingRestore() {
      generation += 1;
      if (restoreFrame) {
        cancelFrame(restoreFrame);
        restoreFrame = 0;
      }
    }

    function enter(name) {
      validate(name);
      if (owners.has(name)) return;
      if (owners.size === 0) {
        cancelPendingRestore();
        var activeElement = doc && doc.activeElement;
        captured = {
          x: win && Number.isFinite(win.scrollX) ? win.scrollX : 0,
          y: win && Number.isFinite(win.scrollY) ? win.scrollY : 0,
          focus: activeElement && activeElement !== body && typeof activeElement.focus === "function"
            ? activeElement
            : null,
        };
      }
      owners.add(name);
      sync();
    }

    function leave(name) {
      validate(name);
      if (!owners.delete(name)) return;
      sync();
      if (owners.size) return;

      var restore = captured;
      captured = null;
      var restoreGeneration = ++generation;
      restoreFrame = requestFrame(function () {
        restoreFrame = 0;
        if (restoreGeneration !== generation || owners.size || !restore) return;
        scrollTo(restore.x, restore.y);
        var focus = restore.focus;
        if (!focus || focus.isConnected === false || typeof focus.focus !== "function") return;
        try { focus.focus({ preventScroll: true }); }
        catch (_) { try { focus.focus(); } catch (__) {} }
      });
    }

    function destroy() {
      cancelPendingRestore();
      owners.clear();
      captured = null;
      sync();
    }

    return {
      enter: enter,
      leave: leave,
      has: function (name) { validate(name); return owners.has(name); },
      active: function () { return owners.size > 0; },
      destroy: destroy,
    };
  }

  return { createController: createController };
});
