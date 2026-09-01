import { escapeHtml } from "./escapeHtml.js";
import { formatDate, videoIdFromUrl, thumbnailFor, videoIdOf } from "./videoHelpers.js";
import { getWatchedVideos, markVideoWatched } from "./watchHistory.js";

// Rendering every card up front is what makes large channels/playlists feel
// slow (hundreds of DOM nodes at once). Instead we render an initial batch
// and lazily render the rest as the user scrolls near the bottom.
const RENDER_BATCH_SIZE = 24;

const videoCardHtml = (item, index, watchedVideos) => {
  const safeTitle = escapeHtml(item.title);
  const published = formatDate(item.publishedAt);
  const safeLink = escapeHtml(item.url || "#");
  const safeThumb = escapeHtml(thumbnailFor(item));
  const vid = videoIdOf(item);
  const isWatched = watchedVideos.has(vid);
  // Images use decoding="async" + loading="lazy" to avoid blocking main thread
  // and to let the browser defer off-screen decodes (critical on Android).
  return `
    <div class="yt-video-row-wrap${isWatched ? " yt-watched" : ""}" data-video-index="${index}" data-title="${safeTitle.toLowerCase()}">
      <a
        href="${safeLink}"
        target="_blank"
        rel="noopener noreferrer"
        data-video-link
        class="yt-video-row yt-video-row--link"
      >
        <div class="yt-thumb-wrap">
          <img src="${safeThumb}" alt="${safeTitle}" loading="lazy" decoding="async" width="480" height="270" />
          <span class="yt-play-orb" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v14l11-7z"/></svg></span>
          <span class="yt-play-badge">▶</span>
        </div>
        <div class="yt-video-meta">
          <h3 class="yt-video-title line-clamp-2">${safeTitle}</h3>
          <span class="yt-video-date">${escapeHtml(published)}</span>
        </div>
      </a>
    </div>
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
  const watchedVideos = new Set(getWatchedVideos().map((entry) => entry.id));

  const unwatchedCount = items.filter((it) => !watchedVideos.has(videoIdOf(it))).length;

  section.innerHTML = `
    <div class="yt-playlist">
      <div class="yt-playlist-header">
        <div>
          <h2 class="yt-playlist-title">${title}</h2>
          <div class="yt-playlist-subtitle">${escapeHtml(name)} · ${count} episodes${unwatchedCount ? ` · <span style="color:#5856d6;font-weight:700">${unwatchedCount} unwatched</span>` : ""}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="yt-count-badge">${count} video${count === 1 ? "" : "s"}</span>
          ${showPlayAll ? `
          <a
            href="${escapeHtml(playAllUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            data-play-all
            aria-label="Play all videos in this playlist on YouTube"
            class="yt-btn yt-btn-primary"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v14l11-7z"/></svg>
            Play all
          </a>` : ""}
        </div>
      </div>

      ${count ? `
      <div class="yt-toolbar">
        <label class="yt-search-wrap" aria-label="Search videos">
          <svg class="yt-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20L16.65 16.65"/></svg>
          <input type="search" class="yt-search-input" placeholder="Search episodes…" autocomplete="off" data-search-input />
        </label>
        <div class="yt-filter-group" role="group" aria-label="Filter videos">
          <button type="button" class="yt-filter-chip active" data-filter="all">All</button>
          <button type="button" class="yt-filter-chip" data-filter="unwatched">Unwatched</button>
          <button type="button" class="yt-filter-chip" data-filter="watched">Watched</button>
        </div>
      </div>` : ""}

      <div data-video-grid class="yt-video-list">
        ${initialItems.map((item, index) => videoCardHtml(item, index, watchedVideos)).join("")}
      </div>
      ${count ? `<div data-empty-state class="hidden" style="padding: 28px; text-align:center; color:#86868b; font-size:13px; font-weight:500">No videos match your search.</div>` : ""}
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

  const grid = section.querySelector("[data-video-grid]");
  const searchInput = section.querySelector("[data-search-input]");
  const filterChips = section.querySelectorAll("[data-filter]");
  const emptyState = section.querySelector("[data-empty-state]");
  let activeFilter = "all";
  let searchQuery = "";

  const applyFilters = () => {
    const cards = grid ? grid.querySelectorAll("[data-video-index]") : [];
    let visible = 0;
    cards.forEach((card) => {
      const title = (card.getAttribute("data-title") || "").toLowerCase();
      const isWatched = card.classList.contains("yt-watched");
      const matchesSearch = !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "watched" && isWatched) ||
        (activeFilter === "unwatched" && !isWatched);
      const show = matchesSearch && matchesFilter;
      card.style.display = show ? "" : "none";
      if (show) visible += 1;
    });
    if (emptyState) emptyState.classList.toggle("hidden", visible !== 0);
  };

  // Debounce filter updates via rAF so typing/search doesn't thrash layout
  // when hundreds of cards are present (Android jank).
  let filterRaf = null;
  const scheduleApplyFilters = () => {
    if (filterRaf !== null) return;
    const cb = () => {
      filterRaf = null;
      applyFilters();
    };
    if (typeof requestAnimationFrame !== "undefined") {
      filterRaf = requestAnimationFrame(cb);
    } else {
      cb();
    }
  };

  const attachCardClickHandler = (wrap) => {
    const link = wrap.querySelector("[data-video-link]");
    const index = Number(wrap.getAttribute("data-video-index"));

    if (!link) return;
    link.addEventListener("click", (event) => {
      if (Number.isNaN(index)) return;

      wrap.classList.add("yt-watched");
      markVideoWatched(items[index]);
      // keep filter in sync — if filtering unwatched, hide card immediately
      setTimeout(scheduleApplyFilters, 30);

      // Let modified clicks (new tab / new window) and non-primary buttons
      // fall through to the normal link behavior.
      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      openInPlayerTab(index);
    });
  };

  searchInput?.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    scheduleApplyFilters();
  });
  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      activeFilter = chip.getAttribute("data-filter") || "all";
      filterChips.forEach((c) => c.classList.toggle("active", c === chip));
      scheduleApplyFilters();
    });
  });

  grid?.querySelectorAll("[data-video-index]").forEach(attachCardClickHandler);

  // Lazily render remaining cards in batches as the user scrolls near the
  // bottom, instead of building hundreds of DOM nodes for large channels
  // and playlists up front. Uses a rAF-batched observer with a large rootMargin
  // so the next batch is ready *before* the user reaches the bottom (pre-load
  // viewport) and avoids long tasks that jank scroll on Android.
  let renderedCount = initialItems.length;
  if (grid && renderedCount < items.length) {
    const hasIO = typeof IntersectionObserver !== "undefined";
    if (hasIO) {
      const sentinel = document.createElement("div");
      sentinel.setAttribute("data-sentinel", "");
      sentinel.style.height = "1px";
      sentinel.style.width = "100%";
      // content-visibility can't apply to sentinel; keep it tiny but observable
      sentinel.style.contain = "strict";
      grid.appendChild(sentinel);

      let ticking = false;
      const scheduleBatch = () => {
        if (ticking) return;
        ticking = true;
        const run = () => {
          ticking = false;
          const nextItems = items.slice(renderedCount, renderedCount + RENDER_BATCH_SIZE);
          if (!nextItems.length) {
            observer.disconnect();
            sentinel.remove();
            return;
          }
          // Use a DocumentFragment-equivalent via temp container to batch DOM insert
          const temp = document.createElement("div");
          temp.innerHTML = nextItems
            .map((item, i) => videoCardHtml(item, renderedCount + i, watchedVideos))
            .join("");
          const cards = [...temp.children];
          cards.forEach((card) => {
            grid.insertBefore(card, sentinel);
            attachCardClickHandler(card);
          });
          renderedCount += nextItems.length;
          scheduleApplyFilters();

          if (renderedCount >= items.length) {
            observer.disconnect();
            sentinel.remove();
          }
        };
        // Prefer idle callback for non-urgent batch work, fallback to rAF
        if (typeof requestIdleCallback !== "undefined") {
          requestIdleCallback(run, { timeout: 200 });
        } else if (typeof requestAnimationFrame !== "undefined") {
          requestAnimationFrame(run);
        } else {
          run();
        }
      };

      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        scheduleBatch();
      }, {
        // Pre-load next batch 600px before sentinel enters viewport
        rootMargin: "600px 0px",
        threshold: 0,
      });
      observer.observe(sentinel);
    } else {
      // Fallback for environments without IntersectionObserver (e.g. old WebView):
      // render remaining items in idle chunks so we don't block first paint.
      const renderChunkIdle = () => {
        if (renderedCount >= items.length) return;
        const nextItems = items.slice(renderedCount, renderedCount + RENDER_BATCH_SIZE);
        const temp = document.createElement("div");
        temp.innerHTML = nextItems
          .map((item, i) => videoCardHtml(item, renderedCount + i, watchedVideos))
          .join("");
        [...temp.children].forEach((card) => {
          grid.appendChild(card);
          attachCardClickHandler(card);
        });
        renderedCount += nextItems.length;
        scheduleApplyFilters();
        if (renderedCount < items.length) {
          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(renderChunkIdle, { timeout: 300 });
          } else {
            setTimeout(renderChunkIdle, 32);
          }
        }
      };
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(renderChunkIdle, { timeout: 300 });
      } else {
        setTimeout(renderChunkIdle, 32);
      }
    }
  }

  return section;
};
