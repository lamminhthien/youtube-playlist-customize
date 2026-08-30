import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  textOf,
  pickThumbnail,
  relativeDateOf,
  extractVideo,
  videoUrl,
  collectVideos,
  resolveChannelId,
  getQueryParam,
  CHANNEL_ID_RE,
  getInnertube,
  INNERTUBE_SESSION_OPTIONS,
} from "../api/_youtube.js";

describe("textOf", () => {
  test("returns t.text when present", () => {
    assert.equal(textOf({ text: "hello" }), "hello");
  });
  test("returns string as-is when t is string", () => {
    assert.equal(textOf("raw"), "raw");
  });
  test("returns empty string for null/undefined", () => {
    assert.equal(textOf(null), "");
    assert.equal(textOf(undefined), "");
  });
  test("returns empty string for object without text", () => {
    assert.equal(textOf({}), "");
  });
  test("handles numeric text", () => {
    assert.equal(textOf({ text: 0 }), 0);
  });
});

describe("pickThumbnail", () => {
  test("returns empty string for non-array or empty array", () => {
    assert.equal(pickThumbnail(null), "");
    assert.equal(pickThumbnail([]), "");
    assert.equal(pickThumbnail("not array"), "");
  });
  test("picks largest thumbnail by width", () => {
    const thumbs = [
      { url: "small.jpg", width: 100 },
      { url: "large.jpg", width: 800 },
      { url: "medium.jpg", width: 400 },
    ];
    assert.equal(pickThumbnail(thumbs), "large.jpg");
  });
  test("handles missing width fallback", () => {
    const thumbs = [{ url: "a.jpg" }, { url: "b.jpg", width: 10 }];
    assert.equal(pickThumbnail(thumbs), "b.jpg");
  });
  test("handles unordered array with equal widths - returns first max", () => {
    const thumbs = [
      { url: "a.jpg", width: 200 },
      { url: "b.jpg", width: 200 },
    ];
    assert.equal(pickThumbnail(thumbs), "a.jpg");
  });
  test("returns empty string when no url present", () => {
    assert.equal(pickThumbnail([{ width: 100 }]), "");
  });
});

describe("relativeDateOf", () => {
  test("extracts relative date string ending with 'ago'", () => {
    const node = {
      metadata: {
        metadata: {
          metadata_rows: [
            { metadata_parts: [{ text: { text: "1M views" } }, { text: { text: "2 days ago" } }] },
          ],
        },
      },
    };
    assert.equal(relativeDateOf(node), "2 days ago");
  });
  test("returns null when no ago text found", () => {
    const node = {
      metadata: { metadata: { metadata_rows: [{ metadata_parts: [{ text: { text: "1M views" } }] }] } },
    };
    assert.equal(relativeDateOf(node), null);
  });
  test("returns null for missing metadata", () => {
    assert.equal(relativeDateOf(null), null);
    assert.equal(relativeDateOf({}), null);
  });
  test("is case-insensitive for ago", () => {
    const node = {
      metadata: {
        metadata: {
          metadata_rows: [{ metadata_parts: [{ text: { text: "3 Weeks AGO" } }] }],
        },
      },
    };
    assert.equal(relativeDateOf(node), "3 Weeks AGO");
  });
});

describe("extractVideo", () => {
  test("extracts LockupView shape (content_id)", () => {
    const node = {
      content_id: "vid123",
      metadata: { title: { text: "Title" } },
      content_image: { image: [{ url: "thumb.jpg", width: 100 }] },
    };
    const result = extractVideo(node);
    assert.equal(result.id, "vid123");
    assert.equal(result.title, "Title");
    assert.equal(result.thumbnail, "thumb.jpg");
  });

  test("extracts legacy shape via id/title", () => {
    const node = {
      id: "abc",
      title: { text: "Legacy" },
      thumbnails: [{ url: "t.jpg", width: 50 }],
      published: { text: "1 day ago" },
    };
    const result = extractVideo(node);
    assert.equal(result.id, "abc");
    assert.equal(result.title, "Legacy");
    assert.equal(result.publishedAt, "1 day ago");
  });

  test("fallback to video_id when id missing", () => {
    const node = { video_id: "xyz", title: "t" };
    const result = extractVideo(node);
    assert.equal(result.id, "xyz");
  });

  test("returns null when no id found", () => {
    assert.equal(extractVideo({ title: "no id" }), null);
    assert.equal(extractVideo(null), null);
  });

  test("handles string title", () => {
    const node = { id: "a", title: "plain string" };
    const result = extractVideo(node);
    assert.equal(result.title, "plain string");
  });
});

describe("videoUrl", () => {
  test("builds youtube watch url", () => {
    assert.equal(videoUrl("abc"), "https://www.youtube.com/watch?v=abc");
  });
  test("returns empty string for falsy id", () => {
    assert.equal(videoUrl(""), "");
    assert.equal(videoUrl(null), "");
    assert.equal(videoUrl(undefined), "");
  });
});

describe("collectVideos", () => {
  test("pushes extracted videos with url field", () => {
    const feed = {
      videos: [{ content_id: "v1", metadata: { title: { text: "T1" } }, content_image: { image: [] } }],
    };
    const items = [];
    collectVideos(feed, items);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "v1");
    assert.equal(items[0].url, "https://www.youtube.com/watch?v=v1");
  });
  test("skips videos without id", () => {
    const feed = { videos: [{ title: "no id" }, { id: "ok", title: { text: "ok" } }] };
    const items = [];
    collectVideos(feed, items);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "ok");
  });
  test("handles feed without videos array", () => {
    const items = [];
    collectVideos({}, items);
    assert.equal(items.length, 0);
  });
});

describe("resolveChannelId", () => {
  test("returns immediately if id matches CHANNEL_ID_RE", async () => {
    const validId = "UC" + "A".repeat(22);
    const yt = { resolveURL: async () => { throw new Error("should not be called"); } };
    assert.equal(await resolveChannelId(yt, validId), validId);
  });

  test("tries handle with @ and without @, returns first browseId", async () => {
    const yt = {
      resolveURL: async (url) => {
        if (url.includes("@myhandle")) return { payload: { browseId: "UC123" } };
        return { payload: {} };
      },
    };
    const result = await resolveChannelId(yt, "myhandle");
    assert.equal(result, "UC123");
  });

  test("tries second candidate if first fails", async () => {
    let calls = 0;
    const yt = {
      resolveURL: async () => {
        calls += 1;
        if (calls === 1) return { payload: {} };
        return { payload: { browseId: "UC999" } };
      },
    };
    const result = await resolveChannelId(yt, "@test");
    assert.equal(result, "UC999");
    assert.equal(calls, 2);
  });

  test("percent-encodes handle but keeps leading @", async () => {
    let captured = "";
    const yt = {
      resolveURL: async (url) => {
        captured = url;
        return { payload: { browseId: "UC1" } };
      },
    };
    await resolveChannelId(yt, "@hello world");
    assert.ok(captured.includes("@hello%20world"));
    assert.ok(!captured.includes("%40"));
  });

  test("throws if no candidate resolves", async () => {
    const yt = { resolveURL: async () => ({ payload: {} }) };
    await assert.rejects(resolveChannelId(yt, "unknown"), /Could not resolve/);
  });
});

describe("getQueryParam", () => {
  test("prefers req.query over URL parsing", () => {
    const req = { query: { id: "Q1" }, url: "/api/playlist?id=Q2", headers: {} };
    assert.equal(getQueryParam(req, "id"), "Q1");
  });
  test("falls back to URL searchParams", () => {
    const req = { url: "/api/playlist?id=URLID", headers: {} };
    assert.equal(getQueryParam(req, "id"), "URLID");
  });
  test("returns null when missing", () => {
    const req = { url: "/api/playlist", headers: {} };
    assert.equal(getQueryParam(req, "id"), null);
  });
  test("handles missing host gracefully", () => {
    const req = { url: "/api/icon?type=channel&id=UC1", headers: {} };
    assert.equal(getQueryParam(req, "type"), "channel");
  });
});

describe("CHANNEL_ID_RE", () => {
  test("matches valid UC id (22 chars after UC)", () => {
    assert.ok(CHANNEL_ID_RE.test("UC" + "a".repeat(22)));
  });
  test("rejects handle", () => {
    assert.equal(CHANNEL_ID_RE.test("@handle"), false);
  });
  test("rejects short id", () => {
    assert.equal(CHANNEL_ID_RE.test("UCshort"), false);
  });
});

describe("INNERTUBE_SESSION_OPTIONS", () => {
  test("contains expected locale keys", () => {
    assert.equal(INNERTUBE_SESSION_OPTIONS.lang, "vi");
    assert.equal(INNERTUBE_SESSION_OPTIONS.location, "VN");
    assert.equal(INNERTUBE_SESSION_OPTIONS.timezone, "Asia/Ho_Chi_Minh");
  });
});

describe("getInnertube caching", () => {
  test("returns same promise on repeated calls (mocked Innertube.create)", async () => {
    const ytStub = { test: true };
    // Dynamically import to avoid affecting earlier tests; we monkey-patch the module's internal promise via re-import
    // Instead, we verify that two consecutive calls return strictly equal promise objects
    const p1 = getInnertube();
    const p2 = getInnertube();
    // Both should be the same reference (cached promise)
    assert.equal(p1, p2);
    // Clean up: we don't await p1 to avoid network; just check promise shape
    assert.ok(p1 instanceof Promise || typeof p1.then === "function");
  });
});
