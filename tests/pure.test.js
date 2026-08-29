import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { document } from "./_domStub.js";
globalThis.document = document;

const { escapeHtml } = await import("../utils/escapeHtml.js");
const { fetchPlaylist } = await import("../utils/fetchPlaylist.js");
const { fetchChannel } = await import("../utils/fetchChannel.js");
const { fetchIcon } = await import("../utils/fetchIcon.js");
const { PLAYLIST_API_URL, CHANNEL_API_URL, ICON_API_URL } = await import("../constants/config.js");

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

describe("fetchPlaylist (local youtubei.js API endpoint)", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  function restore() {
    globalThis.fetch = originalFetch;
  }

  test("calls the local API endpoint with ?id=<playlistId>", async () => {
    let captured;
    globalThis.fetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "success", items: [] }),
      };
    };
    try {
      await fetchPlaylist(["My Playlist", "PL123"]);
      assert.equal(captured.url, `${PLAYLIST_API_URL}?id=PL123`);
      assert.equal(captured.init.method, "GET");
      assert.equal(captured.init.redirect, "follow");
    } finally {
      restore();
    }
  });

  test("percent-encodes playlist IDs that need it", async () => {
    let captured;
    globalThis.fetch = async (url) => {
      captured = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "success", items: [] }),
      };
    };
    try {
      await fetchPlaylist(["My Playlist", "PL with space & symbols"]);
      // URLSearchParams uses application/x-www-form-urlencoded encoding
      // (spaces become '+', '&' is encoded as '%26' so it doesn't split params).
      assert.equal(
        captured,
        `${PLAYLIST_API_URL}?id=PL+with+space+%26+symbols`
      );
    } finally {
      restore();
    }
  });

  test("returns { name, playlistId, data } on success", async () => {
    const apiPayload = {
      status: "success",
      message: "OK",
      items: [
        { id: "abc", title: "Video 1", url: "https://www.youtube.com/watch?v=abc" },
        { id: "def", title: "Video 2", url: "https://www.youtube.com/watch?v=def" },
      ],
    };
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => apiPayload,
    });
    try {
      const result = await fetchPlaylist(["My Playlist", "PL123"]);
      assert.deepEqual(result, {
        name: "My Playlist",
        playlistId: "PL123",
        data: apiPayload,
      });
    } finally {
      restore();
    }
  });

  test("throws an error containing the playlist name when status is not 'success'", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
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

  test("uses the API's message in the thrown error when present", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "error", message: "quota exceeded" }),
    });
    try {
      await assert.rejects(
        fetchPlaylist(["My Playlist", "PL123"]),
        /quota exceeded/
      );
    } finally {
      restore();
    }
  });

  test("throws when the HTTP response is not ok", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    try {
      await assert.rejects(
        fetchPlaylist(["My Playlist", "PL123"]),
        /HTTP 500/
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
      ok: true,
      status: 200,
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

describe("fetchChannel (local youtubei.js API endpoint)", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  function restore() {
    globalThis.fetch = originalFetch;
  }

  test("calls the local API endpoint with ?id=<channelId>", async () => {
    let captured;
    globalThis.fetch = async (url, init) => {
      captured = { url, init };
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "success", items: [] }),
      };
    };
    try {
      await fetchChannel(["My Channel", "UC123"]);
      assert.equal(captured.url, `${CHANNEL_API_URL}?id=UC123`);
      assert.equal(captured.init.method, "GET");
      assert.equal(captured.init.redirect, "follow");
    } finally {
      restore();
    }
  });

  test("returns { name, playlistId: undefined, data } on success", async () => {
    const apiPayload = {
      status: "success",
      feed: { title: "Channel Title" },
      items: [
        { id: "v1", title: "Video 1" },
      ],
    };
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => apiPayload,
    });
    try {
      const result = await fetchChannel(["My Channel", "UC123"]);
      assert.deepEqual(result, {
        name: "My Channel",
        playlistId: undefined,
        data: apiPayload,
      });
    } finally {
      restore();
    }
  });

  test("throws an error containing the channel name when status is not 'success'", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "error", message: "bad channel" }),
    });
    try {
      await assert.rejects(
        fetchChannel(["My Channel", "UC123"]),
        /Failed to load channel: My Channel/
      );
    } finally {
      restore();
    }
  });

  test("throws when the HTTP response is not ok", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    try {
      await assert.rejects(
        fetchChannel(["My Channel", "UC123"]),
        /HTTP 404/
      );
    } finally {
      restore();
    }
  });
});

describe("fetchIcon (local youtubei.js API endpoint)", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  function restore() {
    globalThis.fetch = originalFetch;
  }

  test("calls the local API endpoint with ?type=...&id=...", async () => {
    let captured;
    globalThis.fetch = async (url) => {
      captured = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: "success", icon: "http://icon.url" }),
      };
    };
    try {
      const result = await fetchIcon("channel", "UC123");
      assert.equal(captured, `${ICON_API_URL}?type=channel&id=UC123`);
      assert.equal(result, "http://icon.url");
    } finally {
      restore();
    }
  });

  test("returns empty string when HTTP response is not ok", async () => {
    globalThis.fetch = async () => ({
      ok: false,
      status: 404,
    });
    try {
      const result = await fetchIcon("channel", "UC123");
      assert.equal(result, "");
    } finally {
      restore();
    }
  });

  test("returns empty string when status is not 'success'", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "error" }),
    });
    try {
      const result = await fetchIcon("channel", "UC123");
      assert.equal(result, "");
    } finally {
      restore();
    }
  });

  test("returns empty string when icon property is missing", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ status: "success" }),
    });
    try {
      const result = await fetchIcon("channel", "UC123");
      assert.equal(result, "");
    } finally {
      restore();
    }
  });

  test("returns empty string when fetch throws", async () => {
    globalThis.fetch = async () => {
      throw new Error("Network Error");
    };
    try {
      const result = await fetchIcon("channel", "UC123");
      assert.equal(result, "");
    } finally {
      restore();
    }
  });
});
