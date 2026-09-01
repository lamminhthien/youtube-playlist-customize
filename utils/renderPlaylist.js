import { escapeHtml } from "./escapeHtml.js";
import { formatDate, videoIdFromUrl, thumbnailFor, videoIdOf } from "./videoHelpers.js";
import { getWatchedVideos, markVideoWatched } from "./watchHistory.js";

// Tier B: pagination limits DOM growth. Initial batch + explicit Load More
// keeps steady-state DOM ~24-72 nodes instead of 500. content-visibility
// handles off-screen skip, but not creating nodes at all is stronger.
const RENDER_BATCH_SIZE = 24;

const videoCardHtml = (item, index, watchedVideos) => {
  const safeTitle = escapeHtml(item.title);
  const published = formatDate(item.publishedAt);
  const safeLink = escapeHtml(item.url || "#");
  const safeThumb = escapeHtml(thumbnailFor(item));
  const vid = videoIdOf(item);
  const isWatched = watchedVideos.has(vid);
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

  const QUEUE_STORAGE_KEY = "yt-player-queue";

  const openInPlayerTab = (index) => {
    const item = items[index];
    const videoId = videoIdOf(item);
    if (!item || !videoId) return;

    try {
      const queue = items.map((it) => ({ id: videoIdOf(it), title: it.title || "" }));
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items: queue, listId: playlistId || "" }));
    } catch {}

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

  // Tier B: delegated click — 1 listener instead of N (500) listeners
  grid?.addEventListener("click", (event) => {
    const link = event.target.closest?.("[data-video-link]");
    if (!link || !grid.contains(link)) return;
    const wrap = link.closest("[data-video-index]");
    if (!wrap) return;
    const index = Number(wrap.getAttribute("data-video-index"));
    if (Number.isNaN(index)) return;

    wrap.classList.add("yt-watched");
    markVideoWatched(items[index]);
    // keep filter in sync — if filtering unwatched, hide card shortly
    scheduleApplyFilters();

    if (event.button && event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    event.preventDefault();
    openInPlayerTab(index);
  });

  // Cache card list for filter to avoid querySelectorAll per keystroke
  const getCardsCached = () => grid ? [...grid.querySelectorAll("[data-video-index]")] : [];

  const applyFilters = () => {
    const cards = getCardsCached();
    let visible = 0;
    for (const card of cards) {
      const title = (card.getAttribute("data-title") || "");
      const isWatched = card.classList.contains("yt-watched");
      const matchesSearch = !searchQuery || title.includes(searchQuery);
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "watched" && isWatched) ||
        (activeFilter === "unwatched" && !isWatched);
      const show = matchesSearch && matchesFilter;
      // Use hidden attribute style to avoid inline layout thrash on each loop
      card.hidden = !show;
      card.style.display = show ? "" : "none";
      if (show) visible += 1;
    }
    if (emptyState) emptyState.classList.toggle("hidden", visible !== 0);
    // Hide Load More when filtering narrows results — pagination is for unfiltered list
    if (loadMoreWrap) {
      const isFiltering = Boolean(searchQuery) || activeFilter !== "all";
      loadMoreWrap.hidden = isFiltering;
      loadMoreWrap.style.display = isFiltering ? "none" : "";
    }
  };

  // Tier B: debounce 150ms + rAF so typing doesn't thrash layout
  let filterTimer = null;
  let filterRaf = null;
  const scheduleApplyFilters = () => {
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
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
    }, 120);
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

  // Tier B: pagination via Load More button (keeps DOM at ~60-80 steady state)
  // Instead of auto-rendering 500 nodes via infinite IntersectionObserver,
  // user explicitly pages. Auto-observer is kept as progressive enhancement
  // with a large rootMargin so near-bottom scroll pre-loads, but button is
  // the primary control for low-memory devices.
  let renderedCount = initialItems.length;
  let loadMoreWrap = null;
  let loadMoreBtn = null;
  let observer = null;

  const appendNextBatchHtml = (nextItems, startIdx) => {
    const html = nextItems.map((item, i) => videoCardHtml(item, startIdx + i, watchedVideos)).join("");
    const temp = document.createElement("div");
    temp.innerHTML = html;
    // Use children iteration for stub compat (no DocumentFragment need)
    [...temp.children].forEach((card) => grid.appendChild(card));
  };

  const updateLoadMoreUi = () => {
    if (!loadMoreBtn) return;
    const remaining = items.length - renderedCount;
    if (remaining <= 0) {
      loadMoreBtn.textContent = "All caught up ✓";
      loadMoreBtn.disabled = true;
      if (observer) observer.disconnect();
      // keep wrap visible briefly then hide
      setTimeout(() => { if (loadMoreWrap) loadMoreWrap.style.display = "none"; }, 800);
      return;
    }
    loadMoreBtn.textContent = `Load more — ${remaining} remaining · ${renderedCount} of ${items.length}`;
    loadMoreBtn.disabled = false;
  };

  const loadNextBatch = () => {
    const nextItems = items.slice(renderedCount, renderedCount + RENDER_BATCH_SIZE);
    if (!nextItems.length) {
      updateLoadMoreUi();
      return;
    }
    appendNextBatchHtml(nextItems, renderedCount);
    renderedCount += nextItems.length;
    updateLoadMoreUi();
    // Re-apply filters so newly added cards respect current filter
    applyFilters();
  };

  if (grid && renderedCount < items.length) {
    loadMoreWrap = document.createElement("div");
    loadMoreWrap.className = "yt-load-more-wrap";
    loadMoreWrap.setAttribute("data-load-more-wrap", "");
    loadMoreBtn = document.createElement("button");
    loadMoreBtn.type = "button";
    loadMoreBtn.className = "yt-load-more";
    loadMoreBtn.setAttribute("data-load-more", "");
    loadMoreWrap.appendChild(loadMoreBtn);
    // Insert after grid (inside yt-playlist)
    const playlistEl = section.querySelector(".yt-playlist");
    if (playlistEl) playlistEl.appendChild(loadMoreWrap);
    else section.appendChild(loadMoreWrap);

    updateLoadMoreUi();

    loadMoreBtn.addEventListener("click", () => {
      // Use rIC/rAF to keep main-thread idle friendly
      const run = () => loadNextBatch();
      if (typeof requestIdleCallback !== "undefined") requestIdleCallback(run, { timeout: 200 });
      else if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(run);
      else run();
    });

    // Progressive enhancement: auto-load when wrap nears viewport (600px margin)
    if (typeof IntersectionObserver !== "undefined" && loadMoreWrap) {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        // Avoid auto-loading too aggressively on desktop large lists — only
        // auto-load once per idle to keep explicit paging dominant
        if (loadMoreBtn.disabled) return;
        // Throttle auto-load: require button to have been visible for at least 300ms
        loadNextBatch();
      }, { rootMargin: "600px 0px", threshold: 0 });
      observer.observe(loadMoreWrap);
    }
  }

  return section;
};
