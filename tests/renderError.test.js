import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { document, KeyboardEvent } from "./_domStub.js";
globalThis.document = document;
globalThis.KeyboardEvent = KeyboardEvent;

const { renderError } = await import("../utils/renderError.js");

describe("renderError", () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test("returns an <section> element with the animate-fadein class", () => {
    const section = renderError("My Playlist", new Error("boom"));
    assert.equal(section.tagName, "SECTION");
    assert.ok(section.className.includes("animate-fadein"));
  });

  test("includes the playlist name in the heading", () => {
    const section = renderError("My Playlist", new Error("boom"));
    const heading = section.querySelector("h2");
    assert.ok(heading);
    assert.ok(heading.textContent.includes("My Playlist"));
  });

  test("escapes HTML-significant characters in the playlist name", () => {
    const section = renderError(
      `<img src=x onerror="alert(1)">`,
      new Error("x")
    );
    const h2 = section.querySelector("h2");
    // The displayed text reflects the original (entities decoded).
    assert.ok(h2.textContent.includes(`<img src=x onerror="alert(1)">`));
    // The serialized HTML keeps the dangerous chars escaped (no live <img> tag).
    assert.ok(!h2.innerHTML.includes("<img src=x"));
    assert.ok(h2.innerHTML.includes("&lt;img"));
  });

  test("includes a 'Couldn't load' prefix in the heading text", () => {
    const section = renderError("My Playlist", new Error("boom"));
    const heading = section.querySelector("h2");
    assert.match(heading.textContent, /Couldn't load/);
  });
});
