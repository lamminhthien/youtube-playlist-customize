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

      <div data-player-panel class="hidden yt-player-panel">
        <div class="yt-player-frame-wrap">
          <div data-player-frame></div>
        </div>
        <div class="yt-player-controls">
          <h4 data-player-title class="yt-player-title"></h4>
          <div class="yt-player-buttons">
            <button type="button" data-player-prev aria-label="Previous video" class="yt-icon-btn">◀</button>
            <button type="button" data-player-next aria-label="Next video" class="yt-icon-btn">▶</button>
            <button type="button" data-player-close aria-label="Close player" class="yt-icon-btn">✕</button>
          </div>
        </div>
      </div>

      <div data-video-grid class="yt-video-list">
        ${initialItems.map((item, index) => videoCardHtml(item, index)).join("")}
      </div>
    </div>
  `;

  // Lightweight inline player: no iframe is ever loaded for a video until
  // the user actually clicks it, and only one iframe exists per playlist
  // section at a time (reused across next/prev navigation).
  const panel = section.querySelector("[data-player-panel]");
  const frame = section.querySelector("[data-player-frame]");
  const playerTitle = section.querySelector("[data-player-title]");
  const prevBtn = section.querySelector("[data-player-prev]");
  const nextBtn = section.querySelector("[data-player-next]");
  const closeBtn = section.querySelector("[data-player-close]");

  let currentIndex = -1;

  const playAt = (index) => {
    const item = items[index];
    const videoId = videoIdOf(item);
    if (!item || !videoId) return;

    currentIndex = index;
    frame.innerHTML = `
      <iframe
        src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1"
        title="${escapeHtml(item.title || "YouTube video player")}"
        class="h-full w-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    `;
    playerTitle.textContent = item.title || "";
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex >= items.length - 1;
    panel.classList.remove("hidden");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const closePlayer = () => {
    frame.innerHTML = "";
    panel.classList.add("hidden");
    currentIndex = -1;
  };

  prevBtn?.addEventListener("click", () => {
    if (currentIndex > 0) playAt(currentIndex - 1);
  });
  nextBtn?.addEventListener("click", () => {
    if (currentIndex < items.length - 1) playAt(currentIndex + 1);
  });
  closeBtn?.addEventListener("click", closePlayer);

  const attachCardClickHandler = (anchor) => {
    anchor.addEventListener("click", (event) => {
      // Let modified clicks (new tab / new window) and non-primary buttons
      // fall through to the normal link behavior.
      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const index = Number(anchor.getAttribute("data-video-index"));
      if (Number.isNaN(index)) return;

      event.preventDefault();
      playAt(index);
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
