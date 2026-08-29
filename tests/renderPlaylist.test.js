import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { document, KeyboardEvent } from "./_domStub.js";
globalThis.document = document;
globalThis.KeyboardEvent = KeyboardEvent;

const { renderPlaylist } = await import("../utils/renderPlaylist.js");

const baseData = {
  feed: {
    title: "My Playlist",
  },
  items: [
    {
      id: "abc123XYZ",
      title: "First Video",
      url: "https://www.youtube.com/watch?v=abc123XYZ",
      publishedAt: "2026-08-07T12:00:00Z",
    },
    {
      id: "def456UVW",
      title: "Second Video",
      url: "https://www.youtube.com/watch?v=def456UVW",
      publishedAt: "2026-08-08T09:30:00Z",
    },
  ],
};

describe("renderPlaylist", () => {
  let originalConsoleError;

  beforeEach(() => {
    originalConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test("returns a <section> element with the animate-fadein class", () => {
    const section = renderPlaylist({ name: "My Playlist", data: baseData });
    assert.equal(section.tagName, "SECTION");
    assert.ok(section.className.includes("animate-fadein"));
  });

  test("renders the playlist title from feed.title", () => {
    const section = renderPlaylist({ name: "ignored-name", data: baseData });
    assert.ok(section.querySelector("h2").textContent.includes("My Playlist"));
  });

  test("falls back to the playlist name when feed.title is missing", () => {
    const section = renderPlaylist({
      name: "Fallback Name",
      data: { items: [] },
    });
    assert.ok(section.querySelector("h2").textContent.includes("Fallback Name"));
  });

  test("renders the correct video count, pluralized", () => {
    const section = renderPlaylist({ name: "My Playlist", data: baseData });
    assert.match(section.textContent, /2\s+videos/);

    const single = renderPlaylist({
      name: "My Playlist",
      data: { feed: { title: "T" }, items: [{ title: "only" }] },
    });
    assert.match(single.textContent, /1\s+video(?!s)/);
  });

  test("escapes feed title to prevent XSS", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      data: {
        feed: { title: `<script>alert("x")</script>` },
        items: [],
      },
    });
    const html = section.innerHTML;
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
  });

  test("escapes item titles", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      data: {
        feed: { title: "T" },
        items: [{ title: `<svg/onload=alert(1)>`, url: "#" }],
      },
    });
    const h3 = section.querySelector("h3");
    assert.ok(h3.textContent.includes("<svg/onload=alert(1)>"));
    // The serialized HTML must keep the entity form (no live <svg/onload> tag from the title).
    assert.ok(!h3.innerHTML.includes("<svg/onload"));
    assert.ok(h3.innerHTML.includes("&lt;svg"));
  });

  test("uses YouTube hqdefault.jpg fallback when item.thumbnail is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      data: {
        feed: { title: "T" },
        items: [{ title: "V", url: "https://www.youtube.com/watch?v=VIDID" }],
      },
    });
    const img = section.querySelector("img");
    assert.equal(
      img.getAttribute("src"),
      "https://i.ytimg.com/vi/VIDID/hqdefault.jpg"
    );
  });

  test("supports youtu.be short URLs when building fallback thumbnail", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      data: {
        feed: { title: "T" },
        items: [{ title: "V", url: "https://youtu.be/VIDID2" }],
      },
    });
    const img = section.querySelector("img");
    assert.equal(
      img.getAttribute("src"),
      "https://i.ytimg.com/vi/VIDID2/hqdefault.jpg"
    );
  });

  test("prefers item.thumbnail over the hqdefault fallback", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      data: {
        feed: { title: "T" },
        items: [
          {
            title: "V",
            url: "https://www.youtube.com/watch?v=abc",
            thumbnail: "https://example.com/custom.jpg",
          },
        ],
      },
    });
    const img = section.querySelector("img");
    assert.equal(img.getAttribute("src"), "https://example.com/custom.jpg");
  });

  test("renders anchors with target=_blank and rel=noopener for items", () => {
    const section = renderPlaylist({ name: "My Playlist", data: baseData });
    const anchors = section.querySelectorAll('a[target="_blank"]');
    assert.ok(anchors.length >= 2);
    anchors.forEach((a) => {
      assert.ok(a.getAttribute("rel").includes("noopener"));
    });
  });

  test("uses item.url as the anchor href", () => {
    const section = renderPlaylist({ name: "My Playlist", data: baseData });
    const anchors = section.querySelectorAll('a[target="_blank"]');
    // Two item anchors pointing at the two videos.
    const hrefs = [...anchors].map((a) => a.getAttribute("href")).sort();
    assert.deepEqual(hrefs, [
      "https://www.youtube.com/watch?v=abc123XYZ",
      "https://www.youtube.com/watch?v=def456UVW",
    ]);
  });

  test("falls back to '#' when item.url is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      data: {
        feed: { title: "T" },
        items: [{ title: "V" }],
      },
    });
    const anchors = section.querySelectorAll('a[target="_blank"]');
    const itemAnchor = anchors[anchors.length - 1];
    assert.equal(itemAnchor.getAttribute("href"), "#");
  });

  test("renders nothing inside the grid when items is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      data: { feed: { title: "T" } },
    });
    assert.ok(!section.textContent.includes("Watch"));
  });

  test("does not render any RSS/Feed UI (removed in the Apps Script migration)", () => {
    const section = renderPlaylist({ name: "My Playlist", data: baseData });
    assert.equal(section.querySelector("[data-rss-copy]"), null);
    assert.equal(section.querySelector('[aria-label*="RSS"]'), null);
    assert.equal(section.querySelector('[aria-label*="Feed"]'), null);
  });

  describe("Play all button", () => {
    test("renders a Play all link when a playlistId is provided and items exist", () => {
      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL123ABC",
        data: baseData,
      });
      const link = section.querySelector("[data-play-all]");
      assert.ok(link, "Expected a [data-play-all] anchor to be rendered");
      assert.equal(link.tagName, "A");
      assert.equal(link.getAttribute("target"), "_blank");
      assert.ok(link.getAttribute("rel").includes("noopener"));
      assert.match(link.textContent, /Play all/);
    });

    test("Play all link points at the first video URL with the playlist ID", () => {
      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL123ABC",
        data: baseData,
      });
      const link = section.querySelector("[data-play-all]");
      // first item in baseData is abc123XYZ; `&` is HTML-escaped in the attr.
      assert.equal(
        link.getAttribute("href"),
        "https://www.youtube.com/watch?v=abc123XYZ&amp;list=PL123ABC"
      );
    });

    test("percent-encodes playlist IDs that need it", () => {
      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL with space & symbols",
        data: baseData,
      });
      const link = section.querySelector("[data-play-all]");
      // encodeURIComponent uses %20 for spaces and %26 for `&`; the latter
      // is then HTML-escaped to `&amp;` in the attribute string.
      assert.equal(
        link.getAttribute("href"),
        "https://www.youtube.com/watch?v=abc123XYZ&amp;list=PL%20with%20space%20%26%20symbols"
      );
    });

    test("Play all URL is escaped to prevent injection via playlistId", () => {
      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: `"><img src=x onerror=alert(1)>`,
        data: baseData,
      });
      const link = section.querySelector("[data-play-all]");
      assert.ok(link);
      // No live <img> tag from the playlistId anywhere in the rendered markup.
      assert.ok(!section.innerHTML.includes(`"><img`));
      assert.ok(!section.innerHTML.includes(`onerror=alert`));
    });

    test("does NOT render a Play all link when playlistId is missing", () => {
      const section = renderPlaylist({
        name: "My Playlist",
        data: baseData,
      });
      assert.equal(section.querySelector("[data-play-all]"), null);
    });

    test("does NOT render a Play all link when items are empty", () => {
      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL123ABC",
        data: { feed: { title: "T" }, items: [] },
      });
      assert.equal(section.querySelector("[data-play-all]"), null);
    });

    test("falls back to /playlist URL when items exist but first has no parseable video ID", () => {
      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL123ABC",
        data: {
          feed: { title: "T" },
          items: [{ title: "no url here" }],
        },
      });
      const link = section.querySelector("[data-play-all]");
      assert.equal(
        link.getAttribute("href"),
        "https://www.youtube.com/playlist?list=PL123ABC"
      );
    });  });
});
