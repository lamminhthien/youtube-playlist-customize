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

const WATCHED_STORAGE_KEY = "yt-watched-videos";

// Stored oldest-to-newest so the most recently watched video is always last.
const getWatchedVideos = () => {
  try {
    const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const HISTORY_LIMIT = 20;

const markVideoWatched = (videoId) => {
  if (!videoId) return;
  try {
    const watched = getWatchedVideos().filter((id) => id !== videoId);
    watched.push(videoId);
    localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(watched.slice(-HISTORY_LIMIT)));
  } catch {
    // localStorage unavailable (e.g. private mode quota) — skip persisting.
  }
};

// Rendering every card up front is what makes large channels/playlists feel
// slow (hundreds of DOM nodes at once). Instead we render an initial batch
// and lazily render the rest as the user scrolls near the bottom.
const RENDER_BATCH_SIZE = 24;

const videoCardHtml = (item, index, watchedVideos) => {
  const safeTitle = escapeHtml(item.title);
  const published = formatDate(item.publishedAt);
  const safeLink = escapeHtml(item.url || "#");
  const safeThumb = escapeHtml(thumbnailFor(item));
  const isWatched = watchedVideos.has(videoIdOf(item));

  return `
    <a
      href="${safeLink}"
      target="_blank"
      rel="noopener noreferrer"
      data-video-index="${index}"
      class="yt-video-row${isWatched ? " yt-watched" : ""}"
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

const historyItemHtml = (item, index) => {
  const safeTitle = escapeHtml(item.title);
  const safeThumb = escapeHtml(thumbnailFor(item));

  return `
    <a
      href="${escapeHtml(item.url || "#")}"
      target="_blank"
      rel="noopener noreferrer"
      data-history-index="${index}"
      class="yt-history-item"
    >
      <img src="${safeThumb}" alt="${safeTitle}" loading="lazy" />
      <span class="yt-history-item-title line-clamp-2">${safeTitle}</span>
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
  const watchedOrder = getWatchedVideos();
  const watchedVideos = new Set(watchedOrder);

  // Most-recently-watched first, limited to videos still present in this playlist.
  const historyIndexes = [...watchedOrder]
    .reverse()
    .map((videoId) => items.findIndex((item) => videoIdOf(item) === videoId))
    .filter((index) => index !== -1)
    .slice(0, HISTORY_LIMIT);

  section.innerHTML = `
    <div class="yt-playlist-layout">
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
          ${initialItems.map((item, index) => videoCardHtml(item, index, watchedVideos)).join("")}
        </div>
      </div>

      ${historyIndexes.length ? `
      <aside class="yt-history-panel">
        <h3 class="yt-history-title">Play History</h3>
        <div data-history-list class="yt-history-list">
          ${historyIndexes.map((index) => historyItemHtml(items[index], index)).join("")}
        </div>
      </aside>` : ""}
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
      const index = Number(anchor.getAttribute("data-video-index"));
      if (Number.isNaN(index)) return;

      anchor.classList.add("yt-watched");
      markVideoWatched(videoIdOf(items[index]));

      // Let modified clicks (new tab / new window) and non-primary buttons
      // fall through to the normal link behavior.
      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      openInPlayerTab(index);
    });
  };

  const grid = section.querySelector("[data-video-grid]");
  grid?.querySelectorAll("[data-video-index]").forEach(attachCardClickHandler);

  const attachHistoryClickHandler = (anchor) => {
    anchor.addEventListener("click", (event) => {
      const index = Number(anchor.getAttribute("data-history-index"));
      if (Number.isNaN(index)) return;

      markVideoWatched(videoIdOf(items[index]));

      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      openInPlayerTab(index);
    });
  };

  section.querySelectorAll("[data-history-index]").forEach(attachHistoryClickHandler);

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
        .map((item, i) => videoCardHtml(item, renderedCount + i, watchedVideos))
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
