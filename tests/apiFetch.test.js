import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { document } from "./_domStub.js";
globalThis.document = document;

const { fetchFromApi } = await import("../utils/apiFetch.js");

describe("fetchFromApi", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  const restore = () => { globalThis.fetch = originalFetch; };

  test("builds URL with id param and delegates to fetch", async () => {
    let capturedUrl;
    globalThis.fetch = async (url) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: async () => ({ status: "success", items: [] }) };
    };
    try {
      await fetchFromApi("/api/playlist", "My List", "playlist", "PL123");
      assert.equal(capturedUrl, "/api/playlist?id=PL123");
    } finally { restore(); }
  });

  test("percent-encodes id via URLSearchParams", async () => {
    let captured;
    globalThis.fetch = async (url) => {
      captured = url;
      return { ok: true, status: 200, json: async () => ({ status: "success" }) };
    };
    try {
      await fetchFromApi("/api/playlist", "N", "playlist", "a & b");
      assert.equal(captured, "/api/playlist?id=a+%26+b");
    } finally { restore(); }
  });

  test("returns payload on success", async () => {
    const payload = { status: "success", feed: { title: "T" } };
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => payload });
    try {
      const result = await fetchFromApi("/api/channel", "Ch", "channel", "UC1");
      assert.deepEqual(result, payload);
    } finally { restore(); }
  });

  test("throws with label and name on HTTP error", async () => {
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
    try {
      await assert.rejects(fetchFromApi("/api/playlist", "My List", "playlist", "PL1"), /Failed to load playlist: My List.*HTTP 404/);
    } finally { restore(); }
  });

  test("throws with API message when status !== success", async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ status: "error", message: "quota" }) });
    try {
      await assert.rejects(fetchFromApi("/api/channel", "Ch", "channel", "UC1"), /quota/);
    } finally { restore(); }
  });

  test("uses 'unknown error' when payload.message missing", async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ status: "error" }) });
    try {
      await assert.rejects(fetchFromApi("/api/playlist", "P", "playlist", "id"), /unknown error/);
    } finally { restore(); }
  });

  test("propagates network errors", async () => {
    globalThis.fetch = async () => { throw new TypeError("Network"); };
    try {
      await assert.rejects(fetchFromApi("/api/playlist", "P", "playlist", "id"), /Network/);
    } finally { restore(); }
  });
});
