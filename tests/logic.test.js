import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  formatDate,
  videoIdFromUrl,
  thumbnailFor,
  videoIdOf,
} from "../utils/videoHelpers.js";

describe("videoHelpers", () => {
  describe("formatDate", () => {
    test("formats a valid date string", () => {
      // Use a fixed date to avoid timezone issues in tests
      // 2023-01-01 in UTC
      const date = "2023-01-01T00:00:00Z";
      const result = formatDate(date);
      // result will depend on locale, but should be a non-empty string
      assert.ok(result.length > 0);
    });

    test("returns empty string for null/undefined", () => {
      assert.equal(formatDate(null), "");
      assert.equal(formatDate(undefined), "");
    });

    test("returns original string for invalid date", () => {
      assert.equal(formatDate("not-a-date"), "not-a-date");
    });
  });

  describe("videoIdFromUrl", () => {
    test("extracts ID from youtu.be short URL", () => {
      assert.equal(videoIdFromUrl("https://youtu.be/abc123xyz"), "abc123xyz");
    });

    test("extracts ID from youtube.com/watch?v= URL", () => {
      assert.equal(videoIdFromUrl("https://www.youtube.com/watch?v=abc123xyz"), "abc123xyz");
    });

    test("returns empty string for URL without video ID", () => {
      assert.equal(videoIdFromUrl("https://www.youtube.com/"), "");
    });

    test("returns empty string for invalid URL", () => {
      assert.equal(videoIdFromUrl("not-a-url"), "");
    });

    test("returns empty string for null/undefined", () => {
      assert.equal(videoIdFromUrl(null), "");
      assert.equal(videoIdFromUrl(undefined), "");
    });
  });

  describe("thumbnailFor", () => {
    test("prefers item.thumbnail when provided", () => {
      const item = { thumbnail: "http://custom.jpg", url: "https://youtu.be/abc" };
      assert.equal(thumbnailFor(item), "http://custom.jpg");
    });

    test("uses hqdefault fallback when item.thumbnail is missing", () => {
      const item = { url: "https://youtu.be/abc" };
      assert.equal(thumbnailFor(item), "https://i.ytimg.com/vi/abc/hqdefault.jpg");
    });

    test("returns empty string if no thumbnail and no parseable video ID", () => {
      const item = { url: "https://google.com" };
      assert.equal(thumbnailFor(item), "");
    });
  });

  describe("videoIdOf", () => {
    test("prefers item.id", () => {
      const item = { id: "id123", url: "https://youtu.be/abc" };
      assert.equal(videoIdOf(item), "id123");
    });

    test("falls back to URL extraction", () => {
      const item = { url: "https://youtu.be/abc" };
      assert.equal(videoIdOf(item), "abc");
    });

    test("returns empty string for empty/invalid item", () => {
      assert.equal(videoIdOf(null), "");
      assert.equal(videoIdOf({}), "");
    });
  });
});

import {
  getWatchedVideos,
  markVideoWatched,
} from "../utils/watchHistory.js";

// Simple localStorage mock
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, value) => storage.set(key, value.toString()),
  clear: () => storage.clear(),
};

describe("watchHistory", () => {
  beforeEach(() => {
    storage.clear();
  });

  test("getWatchedVideos returns empty array by default", () => {
    assert.deepEqual(getWatchedVideos(), []);
  });

  test("markVideoWatched adds a video to history", () => {
    const item = { id: "v1", title: "Video 1", url: "https://youtu.be/v1" };
    markVideoWatched(item);
    const history = getWatchedVideos();
    assert.equal(history.length, 1);
    assert.equal(history[0].id, "v1");
    assert.equal(history[0].title, "Video 1");
  });

  test("markVideoWatched avoids duplicates by moving to end", () => {
    const item1 = { id: "v1", title: "Video 1" };
    const item2 = { id: "v2", title: "Video 2" };
    markVideoWatched(item1);
    markVideoWatched(item2);
    markVideoWatched(item1); // Rewatch v1

    const history = getWatchedVideos();
    assert.equal(history.length, 2);
    assert.equal(history[1].id, "v1"); // v1 should be the most recent
  });

  test("markVideoWatched respects HISTORY_LIMIT", () => {
    for (let i = 0; i < 60; i++) {
      markVideoWatched({ id: `v${i}`, title: `Video ${i}` });
    }
    const history = getWatchedVideos();
    assert.equal(history.length, 50);
    assert.equal(history[0].id, "v10"); // First 10 dropped
    assert.equal(history[49].id, "v59");
  });

  test("markVideoWatched handles missing item properties gracefully", () => {
    markVideoWatched({ id: "v1" });
    const history = getWatchedVideos();
    assert.equal(history[0].title, "");
    assert.equal(history[0].url, "https://www.youtube.com/watch?v=v1");
  });

  test("getWatchedVideos returns empty array on corrupted JSON", () => {
    localStorage.setItem("yt-watched-videos", "invalid-json");
    assert.deepEqual(getWatchedVideos(), []);
  });

  test("markVideoWatched does nothing if video ID cannot be determined", () => {
    markVideoWatched({ title: "No ID" });
    assert.deepEqual(getWatchedVideos(), []);
  });
});
