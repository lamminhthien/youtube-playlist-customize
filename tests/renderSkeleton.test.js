import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { document } from "./_domStub.js";
globalThis.document = document;

const { renderSkeleton } = await import("../utils/renderSkeleton.js");

describe("renderSkeleton", () => {
  test("returns a <section> with animate-fadein class and aria-busy=true", () => {
    const section = renderSkeleton();
    assert.equal(section.tagName, "SECTION");
    assert.ok(section.className.includes("animate-fadein"));
    assert.equal(section.getAttribute("aria-busy"), "true");
  });

  test("renders placeholder cards so layout does not jump on real load", () => {
    const section = renderSkeleton();
    // Six placeholder cards × 2 skeleton divs each (thumb + lines) = 12 .skeleton nodes.
    const all = section.querySelectorAll(".skeleton");
    assert.ok(all.length >= 6, `expected several .skeleton nodes, got ${all.length}`);
  });
});
