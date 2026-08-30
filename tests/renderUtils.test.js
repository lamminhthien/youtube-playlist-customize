import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { document } from "./_domStub.js";
globalThis.document = document;

// Simple localStorage mock
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value.toString()),
  clear: () => storage.clear(),
};

import { renderPicker } from "../utils/renderPicker.js";

describe("renderPicker", () => {
  let container;
  let originalFetch;

  beforeEach(() => {
    container = document.createElement("div");
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("renders a grid of buttons for the provided entries", () => {
    const entries = [
      ["Channel A", "idA"],
      ["Channel B", "idB"],
    ];
    const onSelect = () => {};
    renderPicker(container, entries, "channel", onSelect);

    const buttons = container.querySelectorAll(".yt-picker-item");
    assert.equal(buttons.length, 2);

    const names = [...buttons].map((btn) => btn.querySelector(".yt-picker-name").textContent);
    assert.deepEqual(names, ["Channel A", "Channel B"]);
  });

  test("calls onSelect with correct index when a button is clicked", () => {
    const entries = [
      ["Channel A", "idA"],
      ["Channel B", "idB"],
    ];
    let selectedIndex = null;
    const onSelect = (index) => {
      selectedIndex = index;
    };
    renderPicker(container, entries, "channel", onSelect);

    const buttons = container.querySelectorAll(".yt-picker-item");
    buttons[1].dispatchEvent(new Event("click"));
    assert.equal(selectedIndex, 1);
  });

  test("renders initials in the avatar by default", () => {
    const entries = [["John Doe", "idA"]];
    renderPicker(container, entries, "channel", () => {});

    const avatar = container.querySelector(".yt-picker-avatar");
    assert.equal(avatar.textContent.trim(), "JD");
  });

  test("swaps initials for an image when fetchIcon resolves", async () => {
    const entries = [["Channel A", "idA"]];

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "success", icon: "http://icon.url" }),
    });

    renderPicker(container, entries, "channel", () => {});

    // Wait for the promise in renderPicker to resolve
    await new Promise((resolve) => setTimeout(resolve, 10));

    const avatar = container.querySelector(".yt-picker-avatar");
    const img = avatar.querySelector("img");
    assert.ok(img, "Expected an img tag in the avatar");
    assert.equal(img.getAttribute("src"), "http://icon.url");
    assert.equal(avatar.style.background, "transparent");
  });

  test("keeps initials if fetchIcon fails or returns empty", async () => {
    const entries = [["Channel A", "idA"]];

    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
    });

    renderPicker(container, entries, "channel", () => {});

    await new Promise((resolve) => setTimeout(resolve, 10));

    const avatar = container.querySelector(".yt-picker-avatar");
    assert.equal(avatar.querySelector("img"), null);
    assert.ok(avatar.textContent.includes("C"));
  });
});

import { renderPlayHistory } from "../utils/renderPlayHistory.js";

describe("renderPlayHistory", () => {
  let originalOpen;
  let lastOpenedUrl;

  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    originalOpen = globalThis.window.open;
    lastOpenedUrl = null;
    globalThis.window.open = (url) => {
      lastOpenedUrl = url;
      return url;
    };
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.window.open = originalOpen;
  });

  test("renders empty state when history is empty", () => {
    const section = renderPlayHistory();
    assert.ok(section.textContent.includes("No watched videos yet."));
    assert.ok(section.querySelector(".yt-empty"));
  });

  test("renders a list of watched videos in reverse chronological order", () => {
    const history = [
      { id: "v1", title: "First", url: "url1", thumbnail: "t1", watchedAt: 1000 },
      { id: "v2", title: "Second", url: "url2", thumbnail: "t2", watchedAt: 2000 },
    ];
    localStorage.setItem("yt-watched-videos", JSON.stringify(history));

    const section = renderPlayHistory();
    const rows = section.querySelectorAll(".yt-video-row");
    assert.equal(rows.length, 2);

    // v2 should be first because of .reverse()
    assert.ok(rows[0].textContent.includes("Second"));
    assert.ok(rows[1].textContent.includes("First"));
  });

  test("opens the player tab with correct params when a row is clicked", () => {
    const history = [
      { id: "v1", title: "First", url: "url1", thumbnail: "t1", watchedAt: 1000 },
      { id: "v2", title: "Second", url: "url2", thumbnail: "t2", watchedAt: 2000 },
    ];
    localStorage.setItem("yt-watched-videos", JSON.stringify(history));

    const section = renderPlayHistory();
    const rows = section.querySelectorAll(".yt-video-row");

    // Click the first row (which is v2)
    rows[0].dispatchEvent(new Event("click"));

    const openUrl = lastOpenedUrl;
    assert.ok(openUrl && openUrl.includes("v=v2"));
    assert.ok(openUrl.includes("i=0"));
    assert.ok(openUrl.includes("title=Second"));
  });

  test("updates the player queue in localStorage on click", () => {
    const history = [
      { id: "v1", title: "First" },
      { id: "v2", title: "Second" },
    ];
    localStorage.setItem("yt-watched-videos", JSON.stringify(history));

    const section = renderPlayHistory();
    const rows = section.querySelectorAll(".yt-video-row");
    rows[0].dispatchEvent(new Event("click"));

    const queue = JSON.parse(localStorage.getItem("yt-player-queue"));
    assert.deepEqual(queue.items, [
      { id: "v2", title: "Second" },
      { id: "v1", title: "First" },
    ]);
  });
});
