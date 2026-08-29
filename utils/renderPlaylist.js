import { escapeHtml } from "./escapeHtml.js";

const formatDate = (input) => {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const videoIdFromUrl = (url) => {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1);
    }
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
};

const thumbnailFor = (item) =>
  item.thumbnail ||
  (videoIdFromUrl(item.url) &&
    `https://i.ytimg.com/vi/${videoIdFromUrl(item.url)}/hqdefault.jpg`);

const videoIdOf = (item) => item?.id || videoIdFromUrl(item?.url);

// Rendering every card up front is what makes large channels/playlists feel
// slow (hundreds of DOM nodes at once). Instead we render an initial batch
// and lazily render the rest as the user scrolls near the bottom.
const RENDER_BATCH_SIZE = 24;

const videoCardHtml = (item, index) => {
  const safeTitle = escapeHtml(item.title);
  const published = formatDate(item.publishedAt);
  const safeLink = escapeHtml(item.url || "#");
  const safeThumb = escapeHtml(thumbnailFor(item));

  return `
    <a
      href="${safeLink}"
      target="_blank"
      rel="noopener noreferrer"
      data-video-index="${index}"
      class="yt-video-row"
    >
      <div class="yt-thumb-wrap">
        <img src="${safeThumb}" alt="${safeTitle}" loading="lazy" />
        <span class="yt-play-badge">▶</span>
      </div>
      <div class="yt-video-meta">
        <h3 class="yt-video-title line-clamp-2">${safeTitle}</h3>
        <span class="yt-video-date">${escapeHtml(published)}</span>
      </div>
    </a>
  `;
};

export const renderPlaylist = ({ name, playlistId, data }) => {
  const section = document.createElement("section");
  section.className = "animate-fadein";

  const items = Array.isArray(data.items) ? data.items : [];
  const title = escapeHtml(data.feed?.title || name);
  const count = items.length;
  const firstVideoId = videoIdFromUrl(data.items?.[0]?.url);
  const playAllUrl = firstVideoId
    ? `https://www.youtube.com/watch?v=${firstVideoId}&list=${encodeURIComponent(playlistId || "")}`
    : `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId || "")}`;
  const showPlayAll = Boolean(playlistId) && count > 0;
  const initialItems = items.slice(0, RENDER_BATCH_SIZE);

  section.innerHTML = `
    <div class="yt-playlist">
      <div class="yt-playlist-header">
        <h2 class="yt-playlist-title">${title}</h2>
        <div>
          <span class="yt-count-badge">${count} video${count === 1 ? "" : "s"}</span>
          ${showPlayAll ? `
          <a
            href="${escapeHtml(playAllUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            data-play-all
            aria-label="Play all videos in this playlist on YouTube"
            class="yt-btn"
          >
            ▶ Play all
          </a>` : ""}
        </div>
      </div>

      <div data-video-grid class="yt-video-list">
        ${initialItems.map((item, index) => videoCardHtml(item, index)).join("")}
      </div>
    </div>
  `;

  // Clicking a video opens a single dedicated tab (player.html) that plays
  // the whole queue back-to-back, auto-advancing to the next video when one
  // ends, instead of juggling an inline player embedded in this page.
  const QUEUE_STORAGE_KEY = "yt-player-queue";

  const openInPlayerTab = (index) => {
    const item = items[index];
    const videoId = videoIdOf(item);
    if (!item || !videoId) return;

    try {
      const queue = items.map((it) => ({ id: videoIdOf(it), title: it.title || "" }));
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items: queue, listId: playlistId || "" }));
    } catch {
      // localStorage unavailable (e.g. private mode quota) — player.html falls back to a single video.
    }

    const params = new URLSearchParams({ v: videoId, i: String(index), title: item.title || "YouTube video player" });
    if (playlistId) params.set("list", playlistId);
    window.open(`player.html?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  const attachCardClickHandler = (anchor) => {
    anchor.addEventListener("click", (event) => {
      // Let modified clicks (new tab / new window) and non-primary buttons
      // fall through to the normal link behavior.
      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const index = Number(anchor.getAttribute("data-video-index"));
      if (Number.isNaN(index)) return;

      event.preventDefault();
      openInPlayerTab(index);
    });
  };

  const grid = section.querySelector("[data-video-grid]");
  grid?.querySelectorAll("[data-video-index]").forEach(attachCardClickHandler);

  // Lazily render remaining cards in batches as the user scrolls near the
  // bottom, instead of building hundreds of DOM nodes for large channels
  // and playlists up front.
  let renderedCount = initialItems.length;
  if (grid && renderedCount < items.length && typeof IntersectionObserver !== "undefined") {
    const sentinel = document.createElement("div");
    sentinel.style.height = "1px";
    grid.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;

      const nextItems = items.slice(renderedCount, renderedCount + RENDER_BATCH_SIZE);
      if (!nextItems.length) return;

      const temp = document.createElement("div");
      temp.innerHTML = nextItems
        .map((item, i) => videoCardHtml(item, renderedCount + i))
        .join("");
      [...temp.children].forEach((card) => {
        grid.insertBefore(card, sentinel);
        attachCardClickHandler(card);
      });
      renderedCount += nextItems.length;

      if (renderedCount >= items.length) {
        observer.disconnect();
        sentinel.remove();
      }
    });
    observer.observe(sentinel);
  }

  return section;
};
