import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Install the minimal DOM stub on globalThis BEFORE importing the SUT.
import { document } from "./_domStub.js";
globalThis.document = document;

const { escapeHtml } = await import("../utils/escapeHtml.js");
const { printRssLink } = await import("../utils/printRssLink.js");
const { fetchPlaylist } = await import("../utils/fetchPlaylist.js");

describe("escapeHtml", () => {
  test("escapes the five HTML-significant characters", () => {
    assert.equal(
      escapeHtml(`<script>"a" & 'b'</script>`),
      "&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;"
    );
  });

  test("escapes ampersands first to avoid double-escaping later replacements", () => {
    // The `&` in `&lt;` (already-escaped content) must NOT become `&amp;lt;`
    assert.equal(escapeHtml("&lt;"), "&amp;lt;");
  });

  test("returns an empty string when input is undefined", () => {
    assert.equal(escapeHtml(), "");
  });

  test("returns the string 'null' when input is null (String(null) coerces)", () => {
    // Documented behaviour of the helper: it uses String(...) coercion, which
    // renders null as "null". If you want strict-null handling, that would be
    // a source change.
    assert.equal(escapeHtml(null), "null");
  });

  test("returns an empty string when input is empty string", () => {
    assert.equal(escapeHtml(""), "");
  });

  test("coerces non-string inputs to strings", () => {
    assert.equal(escapeHtml(42), "42");
    assert.equal(escapeHtml(true), "true");
    assert.equal(escapeHtml(false), "false");
  });

  test("leaves text without HTML-significant characters untouched", () => {
    assert.equal(escapeHtml("Hello world 123"), "Hello world 123");
  });

  test("handles unicode and emoji without modification", () => {
    assert.equal(escapeHtml("Mùa hè 🎵"), "Mùa hè 🎵");
  });

  test("escapes quotes needed for attribute safety", () => {
    assert.equal(escapeHtml(`"hi"`), "&quot;hi&quot;");
    assert.equal(escapeHtml("it's"), "it&#39;s");
  });
});

describe("printRssLink", () => {
  test("builds a YouTube RSS feed URL using the given playlist id", () => {
    assert.equal(
      printRssLink("PLEyKu1JwbU4te4H7bkxp30Fx8ZmsP42Av"),
      "https://www.youtube.com/feeds/videos.xml?playlist_id=PLEyKu1JwbU4te4H7bkxp30Fx8ZmsP42Av"
    );
  });

  test("preserves underscores and dashes in playlist ids", () => {
    assert.equal(
      printRssLink("PL_abc-123_XYZ"),
      "https://www.youtube.com/feeds/videos.xml?playlist_id=PL_abc-123_XYZ"
    );
  });

  test("does NOT percent-encode the playlist id (caller's responsibility)", () => {
    // printRssLink does no encoding by design — fetchPlaylist wraps it with encodeURIComponent.
    assert.equal(
      printRssLink("PL with space"),
      "https://www.youtube.com/feeds/videos.xml?playlist_id=PL with space"
    );
  });

  test("handles empty playlist id by producing a URL with empty query value", () => {
    assert.equal(
      printRssLink(""),
      "https://www.youtube.com/feeds/videos.xml?playlist_id="
    );
  });
});

describe("fetchPlaylist", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  function restore() {
    globalThis.fetch = originalFetch;
  }

  test("calls rss2json with an encoded YouTube RSS URL", async () => {
    globalThis.fetch = async (url) => {
      return {
        json: async () => ({ status: "ok", feed: {}, items: [] }),
        _url: url,
      };
    };
    try {
      await fetchPlaylist(["My Playlist", "PL123"]);
      // Re-run with a spy to assert the URL.
      let captured;
      globalThis.fetch = async (url) => {
        captured = url;
        return { json: async () => ({ status: "ok", feed: {}, items: [] }) };
      };
      await fetchPlaylist(["My Playlist", "PL123"]);
      assert.equal(
        captured,
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
          printRssLink("PL123")
        )}`
      );
    } finally {
      restore();
    }
  });

  test("returns { name, playlistId, rssUrl, data } on success", async () => {
    const apiPayload = {
      status: "ok",
      feed: { title: "My Playlist", author: "Channel" },
      items: [{ title: "Video 1" }, { title: "Video 2" }],
    };
    globalThis.fetch = async () => ({
      json: async () => apiPayload,
    });
    try {
      const result = await fetchPlaylist(["My Playlist", "PL123"]);
      assert.deepEqual(result, {
        name: "My Playlist",
        playlistId: "PL123",
        rssUrl: printRssLink("PL123"),
        data: apiPayload,
      });
    } finally {
      restore();
    }
  });

  test("throws an error containing the playlist name when status is not 'ok'", async () => {
    globalThis.fetch = async () => ({
      json: async () => ({ status: "error", message: "bad feed" }),
    });
    try {
      await assert.rejects(
        fetchPlaylist(["My Playlist", "PL123"]),
        /Failed to load playlist: My Playlist/
      );
    } finally {
      restore();
    }
  });

  test("propagates network errors from fetch", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("NetworkError");
    };
    try {
      await assert.rejects(
        fetchPlaylist(["My Playlist", "PL123"]),
        /NetworkError/
      );
    } finally {
      restore();
    }
  });

  test("propagates json parsing errors", async () => {
    globalThis.fetch = async () => ({
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    try {
      await assert.rejects(
        fetchPlaylist(["My Playlist", "PL123"]),
        /Unexpected token/
      );
    } finally {
      restore();
    }
  });
});
