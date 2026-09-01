import { escapeHtml } from "./escapeHtml.js";
import { formatDate, videoIdFromUrl, thumbnailFor, videoIdOf } from "./videoHelpers.js";
import { getWatchedVideos, markVideoWatched } from "./watchHistory.js";
import { fetchDownloadInfo, buildDownloadUrl } from "./download.js";

// Tier B: pagination limits DOM growth. Initial batch + explicit Load More
// keeps steady-state DOM ~24-72 nodes instead of 500. content-visibility
// handles off-screen skip, but not creating nodes at all is stronger.
const RENDER_BATCH_SIZE = 24;

const downloadIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v14"/><path d="M7 14l5 5 5-5"/><path d="M3 21h18"/></svg>`;

const videoCardHtml = (item, index, watchedVideos) => {
  const safeTitle = escapeHtml(item.title);
  const published = formatDate(item.publishedAt);
  const safeLink = escapeHtml(item.url || "#");
  const safeThumb = escapeHtml(thumbnailFor(item));
  const vid = videoIdOf(item);
  const isWatched = watchedVideos.has(vid);
  const safeVid = escapeHtml(vid || "");
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
          ${safeVid ? `<button type="button" class="yt-download-btn" data-download-btn="${safeVid}" data-download-title="${safeTitle}" aria-label="Get link & download ${safeTitle}" title="Get link & download">${downloadIconSvg}</button>` : ""}
        </div>
        <div class="yt-video-meta">
          <h3 class="yt-video-title line-clamp-2">${safeTitle}</h3>
          <span class="yt-video-date">${escapeHtml(published)}</span>
          ${safeVid ? `<div class="yt-card-actions"><button type="button" class="yt-card-action" data-download-btn="${safeVid}" data-download-title="${safeTitle}">${downloadIconSvg} Get link & download</button><button type="button" class="yt-card-action" data-copy-link="${safeLink}" title="Copy YouTube link">Copy link</button></div>` : ""}
        </div>
      </a>
    </div>
  `;
};

// ---------- Download modal (youtube-dl style) ----------
let activeDlModal = null;

const closeDownloadModal = () => {
  if (!activeDlModal) return;
  const el = activeDlModal;
  activeDlModal = null;
  el.classList.add("yt-hidden");
  setTimeout(() => el.remove(), 260);
  document.removeEventListener("keydown", onDlEsc);
};

const onDlEsc = (e) => {
  if (e.key === "Escape") closeDownloadModal();
};

const formatBytes = (n) => {
  if (!n || Number.isNaN(Number(n))) return "";
  const bytes = Number(n);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatLabel = (f) => {
  const parts = [];
  if (f.qualityLabel) parts.push(f.qualityLabel);
  else if (f.quality) parts.push(f.quality);
  if (f.mimeType) parts.push(f.mimeType.split(";")[0]);
  if (f.fps) parts.push(`${f.fps}fps`);
  if (f.hasAudio && f.hasVideo) parts.push("muxed");
  else if (f.hasAudio && !f.hasVideo) parts.push("audio only");
  else if (!f.hasAudio && f.hasVideo) parts.push("video only");
  return parts.join(" · ");
};

const createDownloadModal = (videoId, title) => {
  closeDownloadModal();
  const overlay = document.createElement("div");
  overlay.className = "yt-dl-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `Download ${title}`);
  activeDlModal = overlay;

  const safeTitle = escapeHtml(title || videoId);
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

  overlay.innerHTML = `
    <div class="yt-dl-modal">
      <div class="yt-dl-header">
        <div style="min-width:0;flex:1">
          <h3 class="yt-dl-title">${safeTitle}</h3>
          <div class="yt-dl-subtitle">${escapeHtml(watchUrl)}</div>
        </div>
        <button type="button" class="yt-dl-close" aria-label="Close">×</button>
      </div>
      <div class="yt-dl-body">
        <div class="yt-dl-loading"><svg class="yt-spinner" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" opacity="0.12"/><path class="yt-spinner-path" d="M25 5 A20 20 0 0 1 45 25" fill="none" stroke-width="4" stroke-linecap="round"/></svg> Fetching formats…</div>
      </div>
    </div>
  `;

  const body = overlay.querySelector(".yt-dl-body");
  const closeBtn = overlay.querySelector(".yt-dl-close");
  closeBtn.addEventListener("click", closeDownloadModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDownloadModal();
  });
  document.addEventListener("keydown", onDlEsc);

  // Input row: paste any YouTube URL to fetch (youtube-dl style)
  const loadFormats = async (id) => {
    try {
      body.innerHTML = `<div class="yt-dl-loading"><svg class="yt-spinner" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" opacity="0.12"/><path class="yt-spinner-path" d="M25 5 A20 20 0 0 1 45 25" fill="none" stroke-width="4" stroke-linecap="round"/></svg> Fetching formats…</div>`;
      const data = await fetchDownloadInfo(id);
      const all = Array.isArray(data.formats) ? data.formats : [];
      const muxed = Array.isArray(data.muxed) ? data.muxed : all.filter((f) => f.hasAudio && f.hasVideo);
      const audioOnly = Array.isArray(data.audioOnly) ? data.audioOnly : all.filter((f) => f.hasAudio && !f.hasVideo);
      const videoOnly = Array.isArray(data.videoOnly) ? data.videoOnly : all.filter((f) => f.hasVideo && !f.hasAudio);

      const renderGroup = (label, list) => {
        if (!list.length) return "";
        const rows = list
          .map((f) => {
            const directUrl = f.url || buildDownloadUrl(id, f.itag);
            const sub = [f.mimeType?.split(";")[0] || "", f.contentLength ? formatBytes(f.contentLength) : "", f.bitrate ? `${Math.round(f.bitrate / 1000)} kbps` : ""].filter(Boolean).join(" · ");
            return `
              <div class="yt-dl-format">
                <div class="yt-dl-format-meta">
                  <div class="yt-dl-format-label">${escapeHtml(formatLabel(f))} <span style="color:#86868b;font-weight:600">· itag ${escapeHtml(String(f.itag))}</span></div>
                  <div class="yt-dl-format-sub">${escapeHtml(sub || f.mimeType || "")}</div>
                </div>
                <div class="yt-dl-format-actions">
                  <a href="${escapeHtml(directUrl)}" target="_blank" rel="noopener noreferrer" class="yt-dl-btn yt-dl-btn--primary" title="Open / download via direct link">Download</a>
                  <button type="button" class="yt-dl-btn" data-copy-url="${escapeHtml(directUrl)}">Copy link</button>
                </div>
              </div>`;
          })
          .join("");
        return `<div class="yt-dl-section"><h4 class="yt-dl-section-title">${escapeHtml(label)} · ${list.length}</h4>${rows}</div>`;
      };

      const hlsBlock = data.hlsManifestUrl
        ? `<div class="yt-dl-section"><h4 class="yt-dl-section-title">HLS manifest</h4><div class="yt-dl-format"><div class="yt-dl-format-meta"><div class="yt-dl-format-label">HLS (adaptive)</div><div class="yt-dl-format-sub" style="word-break:break-all">${escapeHtml(data.hlsManifestUrl)}</div></div><div class="yt-dl-format-actions"><a href="${escapeHtml(data.hlsManifestUrl)}" target="_blank" rel="noopener noreferrer" class="yt-dl-btn yt-dl-btn--primary">Open</a><button type="button" class="yt-dl-btn" data-copy-url="${escapeHtml(data.hlsManifestUrl)}">Copy</button></div></div></div>`
        : "";

      body.innerHTML = `
        <div class="yt-dl-input-row">
          <input class="yt-dl-input" type="text" placeholder="Paste YouTube link or id (e.g. https://www.youtube.com/watch?v=...)" value="${escapeHtml(watchUrl)}" data-dl-input />
          <button type="button" class="yt-btn yt-btn-primary" data-dl-fetch>Fetch</button>
        </div>
        <div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap">
          <a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer" class="yt-dl-btn">Open on YouTube</a>
          <button type="button" class="yt-dl-btn" data-copy-url="${escapeHtml(watchUrl)}">Copy watch link</button>
          <span style="font-size:11.5px;color:#86868b;align-self:center">${escapeHtml(data.title || "")} ${data.author ? `· ${escapeHtml(data.author)}` : ""}</span>
        </div>
        ${renderGroup("Muxed (audio+video) — like youtube-dl default", muxed)}
        ${renderGroup("Video only (adaptive)", videoOnly)}
        ${renderGroup("Audio only", audioOnly)}
        ${hlsBlock}
        ${!muxed.length && !videoOnly.length && !audioOnly.length ? `<div class="yt-dl-empty">No formats returned for this video.</div>` : ""}
      `;

      const input = body.querySelector("[data-dl-input]");
      const fetchBtn = body.querySelector("[data-dl-fetch]");
      const doFetch = () => {
        const raw = input.value.trim();
        if (!raw) return;
        // re-open modal for new id (reuse current overlay)
        const newId = (() => {
          try {
            const u = new URL(raw);
            const v = u.searchParams.get("v");
            if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
            const m = raw.match(/([a-zA-Z0-9_-]{11})/);
            return m ? m[1] : raw;
          } catch {
            const m = raw.match(/([a-zA-Z0-9_-]{11})/);
            return m ? m[1] : raw;
          }
        })();
        if (!/^[a-zA-Z0-9_-]{11}$/.test(newId)) {
          body.insertAdjacentHTML("afterbegin", `<div class="yt-dl-error" style="margin-bottom:10px">Invalid YouTube id or URL.</div>`);
          return;
        }
        overlay.querySelector(".yt-dl-title").textContent = newId;
        overlay.querySelector(".yt-dl-subtitle").textContent = `https://www.youtube.com/watch?v=${newId}`;
        loadFormats(newId);
      };
      fetchBtn.addEventListener("click", doFetch);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doFetch();
      });

      body.querySelectorAll("[data-copy-url]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const url = btn.getAttribute("data-copy-url") || "";
          try {
            await navigator.clipboard.writeText(url);
            const prev = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => (btn.textContent = prev), 1200);
          } catch {
            window.prompt("Copy link:", url);
          }
        });
      });
    } catch (err) {
      body.innerHTML = `<div class="yt-dl-error">${escapeHtml(err?.message || "Failed to fetch download info.")}</div><div style="margin-top:10px"><button type="button" class="yt-dl-btn" data-dl-retry>Retry</button></div>`;
      const retry = body.querySelector("[data-dl-retry]");
      retry?.addEventListener("click", () => loadFormats(id));
    }
  };

  document.body.appendChild(overlay);
  // trigger entrance
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.remove("yt-hidden")));
  loadFormats(videoId);
};

const openDownloadModal = (videoId, title) => {
  if (!videoId) return;
  createDownloadModal(videoId, title || videoId);
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
    // Download / copy buttons take priority (they live inside the <a> but must not trigger navigation)
    const dlBtn = event.target.closest?.("[data-download-btn]");
    if (dlBtn && grid.contains(dlBtn)) {
      event.preventDefault();
      event.stopPropagation();
      const vid = dlBtn.getAttribute("data-download-btn");
      const t = dlBtn.getAttribute("data-download-title") || "";
      openDownloadModal(vid, t);
      return;
    }
    const copyBtn = event.target.closest?.("[data-copy-link]");
    if (copyBtn && grid.contains(copyBtn)) {
      event.preventDefault();
      event.stopPropagation();
      const url = copyBtn.getAttribute("data-copy-link") || "";
      if (url) {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(url).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            setTimeout(() => (copyBtn.textContent = orig), 1200);
          }).catch(() => window.prompt("Copy link:", url));
        } else {
          window.prompt("Copy link:", url);
        }
      }
      return;
    }

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
