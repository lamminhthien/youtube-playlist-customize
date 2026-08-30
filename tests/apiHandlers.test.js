import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { Innertube } from "youtubei.js";
import { _resetInnertubeForTest } from "../api/_youtube.js";
import playlistHandler from "../api/playlist.js";
import channelHandler from "../api/channel.js";
import iconHandler from "../api/icon.js";

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
  return res;
};

describe("api/playlist handler", () => {
  let originalCreate;
  beforeEach(() => {
    _resetInnertubeForTest();
    originalCreate = Innertube.create;
  });

  const restore = () => { Innertube.create = originalCreate; _resetInnertubeForTest(); };

  test("returns 400 when id missing", async () => {
    const req = { url: "/api/playlist", headers: {}, query: {} };
    const res = mockRes();
    await playlistHandler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.status, "error");
    restore();
  });

  test("returns 200 with items on success (single page, no continuation)", async () => {
    const fakePlaylist = {
      info: { title: "My PL" },
      title: "My PL",
      videos: [{ content_id: "v1", metadata: { title: { text: "T1" } }, content_image: { image: [{ url: "thumb1.jpg", width: 100 }] } }],
      has_continuation: false,
      getContinuation: async () => { throw new Error("should not be called"); },
    };
    Innertube.create = async () => ({ getPlaylist: async () => fakePlaylist });
    const req = { url: "/api/playlist?id=PL123", headers: { host: "localhost" }, query: { id: "PL123" } };
    const res = mockRes();
    await playlistHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.status, "success");
    assert.equal(res.body.feed.title, "My PL");
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].id, "v1");
    assert.ok(res.headers["Cache-Control"].includes("s-maxage=300"));
    restore();
  });

  test("follows continuations up to MAX pages", async () => {
    let contCalls = 0;
    const page1 = {
      info: { title: "PL" }, videos: [{ id: "a", title: { text: "A" } }], has_continuation: true,
      getContinuation: async () => {
        contCalls += 1;
        return {
          videos: [{ id: "b", title: { text: "B" } }], has_continuation: contCalls < 2,
          getContinuation: async () => ({ videos: [{ id: "c", title: { text: "C" } }], has_continuation: false }),
        };
      },
    };
    Innertube.create = async () => ({ getPlaylist: async () => page1 });
    const req = { url: "/api/playlist?id=PL", headers: {}, query: { id: "PL" } };
    const res = mockRes();
    await playlistHandler(req, res);
    assert.equal(res.body.items.length, 3);
    restore();
  });

  test("returns 502 on youtube error", async () => {
    Innertube.create = async () => ({ getPlaylist: async () => { throw new Error("yt down"); } });
    const req = { url: "/api/playlist?id=PL", headers: {}, query: { id: "PL" } };
    const res = mockRes();
    await playlistHandler(req, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.body.status, "error");
    restore();
  });

  test("falls back to playlist.title string when info.title missing", async () => {
    const fake = { title: "Legacy Title", info: {}, videos: [], has_continuation: false };
    Innertube.create = async () => ({ getPlaylist: async () => fake });
    const req = { url: "/api/playlist?id=PL", headers: {}, query: { id: "PL" } };
    const res = mockRes();
    await playlistHandler(req, res);
    assert.equal(res.body.feed.title, "Legacy Title");
    restore();
  });
});

describe("api/channel handler", () => {
  let originalCreate;
  beforeEach(() => { _resetInnertubeForTest(); originalCreate = Innertube.create; });
  const restore = () => { Innertube.create = originalCreate; _resetInnertubeForTest(); };

  test("returns 400 when id missing", async () => {
    const req = { url: "/api/channel", headers: {}, query: {} };
    const res = mockRes();
    await channelHandler(req, res);
    assert.equal(res.statusCode, 400);
    restore();
  });

  test("returns 200 with channel videos", async () => {
    const fakeChannel = {
      metadata: { title: "Chan Title" },
      header: {},
      has_videos: false,
      videos: [{ content_id: "v1", metadata: { title: { text: "V1" } }, content_image: { image: [] } }],
      has_continuation: false,
    };
    Innertube.create = async () => ({
      resolveURL: async () => ({ payload: { browseId: "UC123" } }),
      getChannel: async () => fakeChannel,
    });
    const req = { url: "/api/channel?id=UC123", headers: {}, query: { id: "UC123" } };
    const res = mockRes();
    await channelHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.feed.title, "Chan Title");
    assert.equal(res.body.items.length, 1);
    restore();
  });

  test("calls getVideos() when channel.has_videos true", async () => {
    let getVideosCalled = false;
    const fakeChannel = {
      metadata: { title: "T" }, has_videos: true,
      getVideos: async () => { getVideosCalled = true; return { videos: [{ id: "v1", title: { text: "V1" } }], has_continuation: false }; },
      videos: [], has_continuation: false,
    };
    Innertube.create = async () => ({
      resolveURL: async () => ({ payload: { browseId: "UC1" } }),
      getChannel: async () => fakeChannel,
    });
    const req = { url: "/api/channel?id=UC1", headers: {}, query: { id: "UC1" } };
    const res = mockRes();
    await channelHandler(req, res);
    assert.ok(getVideosCalled);
    restore();
  });

  test("returns 502 when resolve fails", async () => {
    Innertube.create = async () => ({
      resolveURL: async () => ({ payload: {} }),
      getChannel: async () => { throw new Error("no"); },
    });
    const req = { url: "/api/channel?id=@unknown", headers: {}, query: { id: "@unknown" } };
    const res = mockRes();
    await channelHandler(req, res);
    assert.equal(res.statusCode, 502);
    restore();
  });
});

describe("api/icon handler", () => {
  let originalCreate;
  beforeEach(() => { _resetInnertubeForTest(); originalCreate = Innertube.create; });
  const restore = () => { Innertube.create = originalCreate; _resetInnertubeForTest(); };

  test("returns 400 for missing/invalid params", async () => {
    const req = { url: "/api/icon?id=123", headers: {}, query: { id: "123" } };
    const res = mockRes();
    await iconHandler(req, res);
    assert.equal(res.statusCode, 400);
    restore();
  });

  test("returns channel icon from metadata.thumbnail", async () => {
    const fakeChannel = { metadata: { thumbnail: [{ url: "avatar.jpg", width: 100 }] } };
    Innertube.create = async () => ({
      resolveURL: async () => ({ payload: { browseId: "UC1" } }),
      getChannel: async () => fakeChannel,
    });
    const req = { url: "/api/icon?type=channel&id=UC1", headers: {}, query: { type: "channel", id: "UC1" } };
    const res = mockRes();
    await iconHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.icon, "avatar.jpg");
    assert.ok(res.headers["Cache-Control"].includes("s-maxage=3600"));
    restore();
  });

  test("returns playlist icon from info.thumbnails", async () => {
    const fakePlaylist = { info: { thumbnails: [{ url: "pl.jpg", width: 200 }] }, videos: [] };
    Innertube.create = async () => ({ getPlaylist: async () => fakePlaylist });
    const req = { url: "/api/icon?type=playlist&id=PL1", headers: {}, query: { type: "playlist", id: "PL1" } };
    const res = mockRes();
    await iconHandler(req, res);
    assert.equal(res.body.icon, "pl.jpg");
    restore();
  });

  test("falls back to first video thumbnail when playlist info has no thumbnail", async () => {
    const fakePlaylist = {
      info: {}, videos: [{ content_id: "v1", metadata: { title: { text: "T" } }, content_image: { image: [{ url: "vidthumb.jpg", width: 100 }] } }],
    };
    Innertube.create = async () => ({ getPlaylist: async () => fakePlaylist });
    const req = { url: "/api/icon?type=playlist&id=PL1", headers: {}, query: { type: "playlist", id: "PL1" } };
    const res = mockRes();
    await iconHandler(req, res);
    assert.equal(res.body.icon, "vidthumb.jpg");
    restore();
  });

  test("returns 502 on error", async () => {
    Innertube.create = async () => ({ getPlaylist: async () => { throw new Error("fail"); } });
    const req = { url: "/api/icon?type=playlist&id=PL1", headers: {}, query: { type: "playlist", id: "PL1" } };
    const res = mockRes();
    await iconHandler(req, res);
    assert.equal(res.statusCode, 502);
    restore();
  });
});
