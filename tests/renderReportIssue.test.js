import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { document, KeyboardEvent } from "./_domStub.js";
globalThis.document = document;
globalThis.KeyboardEvent = KeyboardEvent;

// Provide minimal window & FormData shims needed by renderReportIssue
if (!globalThis.window) globalThis.window = {};
globalThis.window.location = globalThis.window.location || { href: "http://localhost/" };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((cb) => setTimeout(cb, 0));

// Minimal FormData shim that reads from the form's elements.
class FakeFormData {
  constructor(form) {
    this._map = new Map();
    // collect inputs/selects/textareas by name attribute
    const collect = (root) => {
      for (const c of root.childNodes) {
        if (c.nodeType !== 1) continue;
        const name = c.getAttribute && c.getAttribute("name");
        if (name) {
          // value property may be set via innerHTML parsing; fallback to attribute
          const val = c.value !== undefined ? c.value : (c.getAttribute("value") || "");
          // For select, find selected option
          if (c.tagName === "SELECT") {
            const opts = c.querySelectorAll("option");
            let sel = "";
            for (const o of opts) {
              if (o.getAttribute("selected") !== null || o.selected) { sel = o.getAttribute("value") || o.textContent; break; }
            }
            // default to first option if none selected
            if (!sel && opts.length) sel = opts[0].getAttribute("value") || opts[0].textContent;
            // if value was set directly on select, prefer that
            this._map.set(name, c.value || sel);
          } else {
            this._map.set(name, c.value !== undefined ? c.value : (c.textContent || ""));
          }
        }
        if (c.childNodes) collect(c);
      }
    };
    collect(form);
  }
  get(k) { return this._map.get(k) ?? ""; }
}
globalThis.FormData = FakeFormData;

const { renderReportIssueButton, createReportIssueModal, openReportIssueModal } = await import("../utils/renderReportIssue.js");

describe("renderReportIssueButton", () => {
  test("creates button with Feedback label and ghost class", () => {
    const btn = renderReportIssueButton(() => {});
    assert.equal(btn.tagName, "BUTTON");
    assert.ok(btn.className.includes("yt-btn-ghost"));
    assert.ok(btn.textContent.includes("Feedback"));
    assert.equal(btn.getAttribute("aria-label"), "Report an issue");
  });
  test("invokes callback on click", () => {
    let called = 0;
    const btn = renderReportIssueButton(() => { called += 1; });
    btn.dispatchEvent({ type: "click" });
    assert.equal(called, 1);
  });
});

describe("createReportIssueModal", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; document.body.innerHTML = ""; });
  afterEach(() => { globalThis.fetch = originalFetch; document.body.innerHTML = ""; });

  test("creates overlay with dialog role and form fields", () => {
    const overlay = createReportIssueModal();
    assert.equal(overlay.getAttribute("role"), "dialog");
    assert.equal(overlay.getAttribute("aria-modal"), "true");
    assert.ok(overlay.querySelector("#issue-title"));
    assert.ok(overlay.querySelector("#issue-description"));
    assert.ok(overlay.querySelector("#issue-type"));
    assert.ok(overlay.querySelector('[data-action="cancel"]'));
    assert.ok(overlay.querySelector('[data-action="submit"]'));
  });

  test("close button removes overlay and calls onClose", async () => {
    let closed = 0;
    const overlay = createReportIssueModal(() => { closed += 1; });
    document.body.appendChild(overlay);
    const closeBtn = overlay.querySelector(".yt-modal-close");
    closeBtn.dispatchEvent({ type: "click" });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(closed, 1);
    assert.equal(document.body.querySelector(".yt-modal-overlay"), null);
  });

  test("clicking overlay backdrop closes, clicking inside does not", async () => {
    const overlay = createReportIssueModal();
    document.body.appendChild(overlay);
    // click inside modal should not close
    const modal = overlay.querySelector(".yt-modal");
    overlay.dispatchEvent({ type: "click", target: modal });
    assert.ok(document.body.querySelector(".yt-modal-overlay"));
    // click on overlay itself closes
    overlay.dispatchEvent({ type: "click", target: overlay });
    await new Promise((r) => setTimeout(r, 200));
    assert.equal(document.body.querySelector(".yt-modal-overlay"), null);
  });

  test("escapes issueUrl and issueNumber in success message (XSS protection)", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, issueUrl: '"><img src=x onerror=alert(1)>', issueNumber: '<b>1</b>' }),
    });
    const overlay = createReportIssueModal();
    document.body.appendChild(overlay);
    const form = overlay.querySelector(".yt-modal-form");
    // set form values so FormData reads them
    const titleInput = overlay.querySelector("#issue-title");
    const descInput = overlay.querySelector("#issue-description");
    const typeSelect = overlay.querySelector("#issue-type");
    titleInput.value = "Title";
    descInput.value = "Desc";
    typeSelect.value = "bug";
    // Trigger submit handlers: our stub's FakeFormData reads .value
    const handlers = form._listeners["submit"] || [];
    for (const h of handlers) await h({ preventDefault() {}, target: form });
    // wait for async fetch
    await new Promise((r) => setTimeout(r, 20));
    const msg = overlay.querySelector(".yt-modal-message");
    assert.ok(!msg.innerHTML.includes('"><img'), "should not contain raw injection");
    assert.ok(msg.innerHTML.includes("&lt;img") || msg.innerHTML.includes("&quot;") || !msg.innerHTML.includes("<img"));
    assert.ok(msg.innerHTML.includes("&lt;b&gt;") || !msg.innerHTML.includes("<b>1</b>"));
  });

  test("shows error message when API returns success:false", async () => {
    globalThis.fetch = async () => ({
      ok: true, status: 200, json: async () => ({ success: false, message: "quota exceeded" }),
    });
    const overlay = createReportIssueModal();
    document.body.appendChild(overlay);
    overlay.querySelector("#issue-title").value = "T";
    overlay.querySelector("#issue-description").value = "D";
    overlay.querySelector("#issue-type").value = "bug";
    const form = overlay.querySelector(".yt-modal-form");
    for (const h of form._listeners["submit"]) await h({ preventDefault() {} });
    await new Promise((r) => setTimeout(r, 20));
    const msg = overlay.querySelector(".yt-modal-message");
    assert.ok(msg.textContent.includes("quota exceeded") || msg.textContent.includes("Failed"));
    assert.ok(!msg.classList.contains("hidden"));
  });

  test("shows network error on fetch rejection", async () => {
    globalThis.fetch = async () => { throw new Error("Network"); };
    const origError = console.error; console.error = () => {};
    const overlay = createReportIssueModal();
    document.body.appendChild(overlay);
    overlay.querySelector("#issue-title").value = "T";
    overlay.querySelector("#issue-description").value = "D";
    overlay.querySelector("#issue-type").value = "bug";
    const form = overlay.querySelector(".yt-modal-form");
    for (const h of form._listeners["submit"]) await h({ preventDefault() {} });
    await new Promise((r) => setTimeout(r, 20));
    const msg = overlay.querySelector(".yt-modal-message");
    assert.ok(msg.textContent.includes("Network error"));
    console.error = origError;
  });
});

describe("openReportIssueModal (event listener lifecycle)", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  afterEach(() => { document.body.innerHTML = ""; });

  test("does not create duplicate modal if one already exists", () => {
    const existing = document.createElement("div");
    existing.className = "yt-modal-overlay";
    document.body.appendChild(existing);
    openReportIssueModal();
    assert.equal(document.body.querySelectorAll(".yt-modal-overlay").length, 1);
  });

  test("registers and cleans up Escape key listener on close", async () => {
    let keydownListeners = [];
    const origAdd = document.addEventListener;
    const origRemove = document.removeEventListener;
    document.addEventListener = (type, fn) => { if (type === "keydown") keydownListeners.push(fn); };
    document.removeEventListener = (type, fn) => { if (type === "keydown") keydownListeners = keydownListeners.filter((f) => f !== fn); };
    try {
      openReportIssueModal();
      assert.equal(keydownListeners.length, 1, "should register one keydown listener");
      const overlay = document.body.querySelector(".yt-modal-overlay");
      assert.ok(overlay);
      // simulate close via close button (which triggers onClose cleanup)
      overlay.querySelector(".yt-modal-close").dispatchEvent({ type: "click" });
      await new Promise((r) => setTimeout(r, 200));
      assert.equal(keydownListeners.length, 0, "listener should be removed after close via button");
    } finally {
      document.addEventListener = origAdd;
      document.removeEventListener = origRemove;
    }
  });

  test("Escape key triggers close", async () => {
    let keydownHandler;
    const origAdd = document.addEventListener;
    const origRemove = document.removeEventListener;
    document.addEventListener = (type, fn) => { if (type === "keydown") keydownHandler = fn; };
    document.removeEventListener = () => {};
    try {
      document.body.innerHTML = "";
      openReportIssueModal();
      assert.ok(keydownHandler, "handler registered");
      const overlay = document.body.querySelector(".yt-modal-overlay");
      // Escape should click close button
      let closeClicked = false;
      overlay.querySelector(".yt-modal-close").addEventListener("click", () => { closeClicked = true; });
      keydownHandler({ key: "Escape" });
      assert.ok(closeClicked);
    } finally {
      document.addEventListener = origAdd;
      document.removeEventListener = origRemove;
      document.body.innerHTML = "";
    }
  });
});
