const assert = require("node:assert/strict");
const T = require("../time-aware-thumbnails.js");

const originals = {
  bearings: "images/cs/bearings-cover.webp",
  apollo: "images/cs/apollo-cover.webp",
  strata: "images/cs/strata-cover.webp",
  cluster: "images/cs/cluster/cluster-cover.webp",
  ucdavis: "images/cs/ucrec/cover.webp",
  r3shore: "images/cs/r3shore.webp"
};

function image(project) {
  const attributes = new Map([
    ["src", originals[project]],
    ["alt", project + " original alt"],
    ["loading", "lazy"],
    ["decoding", "async"]
  ]);
  const article = {getAttribute(name) { return name === "data-slug" ? project : null; }};
  return {
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
    closest(selector) { return selector === ".csItem[data-slug]" ? article : null; }
  };
}

function flush() { return new Promise(resolve => setImmediate(resolve)); }

(async function () {
  assert.deepEqual(T.PROJECTS, ["bearings", "apollo", "strata", "cluster", "ucdavis", "r3shore"]);
  for (const project of T.PROJECTS) {
    assert.deepEqual(T.sourceFor(project, "off"), {src: originals[project], srcset: "", sizes: ""});
    const variant = project === "ucdavis" ? "ucrec" : project;
    assert.deepEqual(T.sourceFor(project, "dusk"), {
      src: `images/cs/variants/time/${variant}/dusk-1200.webp`,
      srcset: `images/cs/variants/time/${variant}/dusk-1200.webp 1200w, images/cs/variants/time/${variant}/dusk-2400.webp 2400w`,
      sizes: T.SIZES
    });
  }

  const images = T.PROJECTS.map(image);
  const document = {
    documentElement: {},
    querySelectorAll(selector) {
      if (selector === "img[data-time-thumbnail]") return [];
      if (selector === ".csItem img.csImg") return images;
      throw new Error("unexpected selector " + selector);
    }
  };
  let publish;
  const theme = {
    getSnapshot() { return {state: "night"}; },
    subscribe(listener) { publish = listener; return function () {}; }
  };
  class ImmediateImage {
    decode() { return Promise.resolve(); }
  }
  const controller = T.createController({document, theme, Image: ImmediateImage, window: null});
  await flush();
  images.forEach((node, index) => {
    const project = T.PROJECTS[index];
    const variant = project === "ucdavis" ? "ucrec" : project;
    assert.equal(node.getAttribute("src"), `images/cs/variants/time/${variant}/night-1200.webp`);
    assert.match(node.getAttribute("srcset"), new RegExp(`${variant}/night-2400\\.webp 2400w$`));
    assert.equal(node.getAttribute("alt"), project + " original alt");
  });

  publish({state: "off"});
  await flush();
  images.forEach((node, index) => {
    assert.equal(node.getAttribute("src"), originals[T.PROJECTS[index]]);
    assert.equal(node.hasAttribute("srcset"), false);
    assert.equal(node.hasAttribute("sizes"), false);
  });
  controller.destroy();
  console.log("time thumbnail integration: OK");
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
