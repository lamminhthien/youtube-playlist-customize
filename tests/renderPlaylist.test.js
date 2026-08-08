import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { document, KeyboardEvent } from "./_domStub.js";
globalThis.document = document;
globalThis.KeyboardEvent = KeyboardEvent;

const { renderPlaylist } = await import("../utils/renderPlaylist.js");
const { printRssLink } = await import("../utils/printRssLink.js");

const baseData = {
  feed: {
    title: "My Playlist",
    author: "Cool Channel",
  },
  items: [
    {
      title: "First Video",
      link: "https://www.youtube.com/watch?v=abc123XYZ",
      pubDate: "Wed, 07 Aug 2026 12:00:00 GMT",
    },
    {
      title: "Second Video",
      link: "https://www.youtube.com/watch?v=def456UVW",
      pubDate: "Thu, 08 Aug 2026 09:30:00 GMT",
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
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: baseData,
    });
    assert.equal(section.tagName, "SECTION");
    assert.ok(section.className.includes("animate-fadein"));
  });

  test("renders the playlist title and author", () => {
    const section = renderPlaylist({
      name: "ignored-name",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: baseData,
    });
    assert.ok(section.querySelector("h2").textContent.includes("My Playlist"));
    assert.ok(section.textContent.includes("Cool Channel"));
  });

  test("falls back to the playlist name when feed.title is missing", () => {
    const section = renderPlaylist({
      name: "Fallback Name",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: { feed: {}, items: [] },
    });
    assert.ok(section.querySelector("h2").textContent.includes("Fallback Name"));
  });

  test("falls back to 'YouTube Channel' when feed.author is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: { feed: { title: "T" }, items: [] },
    });
    assert.ok(section.textContent.includes("YouTube Channel"));
  });

  test("renders the correct video count, pluralized", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: baseData,
    });
    assert.match(section.textContent, /2\s+videos/);

    const single = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: { feed: { title: "T" }, items: [{ title: "only" }] },
    });
    assert.match(single.textContent, /1\s+video(?!s)/);
  });

  test("escapes feed title and author to prevent XSS", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: {
        feed: {
          title: `<script>alert("x")</script>`,
          author: `<img onerror=alert(1) src=x>`,
        },
        items: [],
      },
    });
    const html = section.innerHTML;
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(!html.includes("<img onerror="));
  });

  test("escapes item titles", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: {
        feed: { title: "T" },
        items: [{ title: `<svg/onload=alert(1)>`, link: "#" }],
      },
    });
    // Locate the h3 holding the item title; the escaped content lives there.
    const h3 = section.querySelector("h3");
    assert.ok(h3.textContent.includes("<svg/onload=alert(1)>"));
    // The serialized HTML must keep the entity form (no live <svg/onload> tag from the title).
    assert.ok(!h3.innerHTML.includes("<svg/onload"));
    assert.ok(h3.innerHTML.includes("&lt;svg"));
  });

  test("uses provided rssUrl when available", () => {
    const rssUrl = "https://example.com/custom-feed";
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl,
      data: baseData,
    });
    const copyBtn = section.querySelector("[data-rss-copy]");
    assert.equal(copyBtn.getAttribute("data-rss-url"), rssUrl);
    const feedLink = section.querySelector('a[target="_blank"]');
    assert.equal(feedLink.getAttribute("href"), rssUrl);
  });

  test("falls back to printRssLink(playlistId) when rssUrl is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: undefined,
      data: baseData,
    });
    const copyBtn = section.querySelector("[data-rss-copy]");
    assert.equal(copyBtn.getAttribute("data-rss-url"), printRssLink("PL123"));
  });

  test("escapes the rssUrl when embedding it in attributes", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: `https://example.com/?a="b"&c='d'`,
      data: baseData,
    });
    const html = section.innerHTML;
    assert.ok(!html.includes(`"b"&c=`));
    assert.ok(html.includes("&quot;b&quot;"));
    assert.ok(html.includes("&#39;d&#39;"));
  });

  test("stores the playlist id on the copy button", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: baseData,
    });
    assert.equal(
      section.querySelector("[data-rss-copy]").getAttribute("data-playlist-id"),
      "PL123"
    );
  });

  test("uses YouTube hqdefault.jpg fallback thumbnail when item.thumbnail is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: {
        feed: { title: "T" },
        items: [{ title: "V", link: "https://www.youtube.com/watch?v=VIDID" }],
      },
    });
    const img = section.querySelector("img");
    assert.equal(
      img.getAttribute("src"),
      "https://i.ytimg.com/vi/VIDID/hqdefault.jpg"
    );
  });

  test("prefers item.thumbnail over the hqdefault fallback", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: {
        feed: { title: "T" },
        items: [
          {
            title: "V",
            link: "https://www.youtube.com/watch?v=abc",
            thumbnail: "https://example.com/custom.jpg",
          },
        ],
      },
    });
    const img = section.querySelector("img");
    assert.equal(img.getAttribute("src"), "https://example.com/custom.jpg");
  });

  test("renders anchors with target=_blank and rel=noopener for items", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: baseData,
    });
    const anchors = section.querySelectorAll('a[target="_blank"]');
    assert.ok(anchors.length >= 2);
    anchors.forEach((a) => {
      assert.ok(a.getAttribute("rel").includes("noopener"));
    });
  });

  test("falls back to '#' when item.link is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: {
        feed: { title: "T" },
        items: [{ title: "V" }],
      },
    });
    // The Feed link is the first `a[target=_blank]`; the item link is the next one.
    const anchors = section.querySelectorAll('a[target="_blank"]');
    const itemAnchor = anchors[anchors.length - 1];
    assert.equal(itemAnchor.getAttribute("href"), "#");
  });

  test("renders nothing inside the grid when items is missing", () => {
    const section = renderPlaylist({
      name: "My Playlist",
      playlistId: "PL123",
      rssUrl: printRssLink("PL123"),
      data: { feed: { title: "T" } },
    });
    assert.ok(!section.textContent.includes("Watch"));
  });

  describe("copy-to-clipboard interaction", () => {
    let originalClipboard;

    beforeEach(() => {
      originalClipboard = globalThis.navigator?.clipboard;
    });

    afterEach(() => {
      if (globalThis.navigator) {
        globalThis.navigator.clipboard = originalClipboard;
      }
    });

    function setClipboard(impl) {
      // navigator is a getter-only on Node 24; defineProperty works around it.
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        writable: true,
        value: { clipboard: impl },
      });
    }

    test("copies the rss URL and flashes 'Copied!' on success", async () => {
      const calls = [];
      setClipboard({
        writeText: async (s) => {
          calls.push(s);
        },
      });

      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL123",
        rssUrl: printRssLink("PL123"),
        data: baseData,
      });
      const btn = section.querySelector("[data-rss-copy]");
      const label = btn.querySelector("[data-rss-label]");

      await btn.dispatchEvent({ type: "click" });

      assert.deepEqual(calls, [printRssLink("PL123")]);
      assert.equal(label.textContent, "Copied!");

      await new Promise((r) => setTimeout(r, 1600));
      assert.equal(label.textContent, "RSS");
    });

    test("does nothing when the data-rss-url attribute is empty", async () => {
      const calls = [];
      setClipboard({
        writeText: async (s) => {
          calls.push(s);
        },
      });

      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL123",
        rssUrl: "",
        data: baseData,
      });
      const btn = section.querySelector("[data-rss-copy]");
      btn.setAttribute("data-rss-url", "");

      await btn.dispatchEvent({ type: "click" });
      assert.equal(calls.length, 0);
    });

    test("logs and swallows clipboard errors", async () => {
      const errs = [];
      console.error = (...args) => errs.push(args);
      setClipboard({
        writeText: async () => {
          throw new Error("denied");
        },
      });

      const section = renderPlaylist({
        name: "My Playlist",
        playlistId: "PL123",
        rssUrl: printRssLink("PL123"),
        data: baseData,
      });
      const btn = section.querySelector("[data-rss-copy]");
      const label = btn.querySelector("[data-rss-label]");

      await btn.dispatchEvent({ type: "click" });

      assert.ok(errs.length > 0);
      assert.equal(label.textContent, "RSS");
    });
  });
});
