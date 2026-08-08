import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { document, KeyboardEvent } from "./_domStub.js";
globalThis.document = document;
globalThis.KeyboardEvent = KeyboardEvent;

const { renderTabs } = await import("../utils/renderTabs.js");

const makeEl = (name) => ({ name, element: document.createElement("div") });

describe("renderTabs", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  test("renders an empty-state message when called with no tabs", () => {
    const render = renderTabs(container);
    render([]);
    assert.equal(container.children.length, 1);
    const only = container.firstElementChild;
    assert.equal(only.textContent, "No playlists configured.");
    assert.ok(only.className.includes("rounded-2xl"));
  });

  test("clears the container before rendering", () => {
    const old = document.createElement("p");
    old.textContent = "stale";
    container.appendChild(old);
    const render = renderTabs(container);
    render([makeEl("A")]);
    assert.ok(!container.textContent.includes("stale"));
  });

  test("renders a tablist with role=tablist and one button per tab", () => {
    const render = renderTabs(container);
    render([makeEl("A"), makeEl("B"), makeEl("C")]);

    const tablist = container.querySelector('[role="tablist"]');
    assert.ok(tablist);
    assert.equal(tablist.getAttribute("aria-label"), "Playlists");

    const tabs = container.querySelectorAll('[role="tab"]');
    assert.equal(tabs.length, 3);
    assert.equal(tabs[0].textContent, "A");
    assert.equal(tabs[1].textContent, "B");
    assert.equal(tabs[2].textContent, "C");
  });

  test("renders one panel per tab, with only the first visible by default", () => {
    const render = renderTabs(container);
    render([makeEl("A"), makeEl("B")]);

    const panels = container.querySelectorAll('[role="tabpanel"]');
    assert.equal(panels.length, 2);
    assert.equal(panels[0].classList.contains("hidden"), false);
    assert.equal(panels[1].classList.contains("hidden"), true);
  });

  test("marks only the first tab as selected initially", () => {
    const render = renderTabs(container);
    render([makeEl("A"), makeEl("B"), makeEl("C")]);

    const tabs = container.querySelectorAll('[role="tab"]');
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(tabs[0].getAttribute("tabindex"), "0");
    assert.equal(tabs[1].getAttribute("aria-selected"), "false");
    assert.equal(tabs[1].getAttribute("tabindex"), "-1");
    assert.equal(tabs[2].getAttribute("aria-selected"), "false");
  });

  test("clicking a tab activates it and shows its panel", () => {
    const render = renderTabs(container);
    render([makeEl("A"), makeEl("B"), makeEl("C")]);

    const tabs = container.querySelectorAll('[role="tab"]');
    const panels = container.querySelectorAll('[role="tabpanel"]');

    tabs[1].dispatchEvent({ type: "click" });

    assert.equal(tabs[0].getAttribute("aria-selected"), "false");
    assert.equal(tabs[1].getAttribute("aria-selected"), "true");
    assert.equal(tabs[2].getAttribute("aria-selected"), "false");

    assert.equal(panels[0].classList.contains("hidden"), true);
    assert.equal(panels[1].classList.contains("hidden"), false);
    assert.equal(panels[2].classList.contains("hidden"), true);
  });

  test("ArrowRight moves selection to the next tab and wraps at the end", () => {
    const render = renderTabs(container);
    render([makeEl("A"), makeEl("B"), makeEl("C")]);

    const tabs = container.querySelectorAll('[role="tab"]');
    tabs[2].dispatchEvent({ type: "click" });
    tabs[2].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));

    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(tabs[2].getAttribute("aria-selected"), "false");
  });

  test("ArrowLeft moves selection to the previous tab and wraps at the start", () => {
    const render = renderTabs(container);
    render([makeEl("A"), makeEl("B"), makeEl("C")]);

    const tabs = container.querySelectorAll('[role="tab"]');
    tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));

    assert.equal(tabs[2].getAttribute("aria-selected"), "true");
    assert.equal(tabs[0].getAttribute("aria-selected"), "false");
  });

  test("Arrow keys other than Left/Right are ignored", () => {
    const render = renderTabs(container);
    render([makeEl("A"), makeEl("B")]);

    const tabs = container.querySelectorAll('[role="tab"]');
    tabs[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));

    assert.equal(tabs[0].getAttribute("aria-selected"), "true");
    assert.equal(tabs[1].getAttribute("aria-selected"), "false");
  });

  test("mounts each tab's element inside its own panel", () => {
    const a = makeEl("A");
    a.element.textContent = "A-CONTENT";
    const b = makeEl("B");
    b.element.textContent = "B-CONTENT";

    const render = renderTabs(container);
    render([a, b]);

    const panels = container.querySelectorAll('[role="tabpanel"]');
    assert.equal(panels[0].textContent, "A-CONTENT");
    assert.equal(panels[1].textContent, "B-CONTENT");
  });
});
