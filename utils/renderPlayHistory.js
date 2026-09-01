import { escapeHtml } from "./escapeHtml.js";
import { formatDate } from "./videoHelpers.js";
import { getWatchedVideos } from "./watchHistory.js";

const QUEUE_STORAGE_KEY = "yt-player-queue";
const HISTORY_BATCH = 20;

const historyCardHtml = (entry, index) => {
  const safeTitle = escapeHtml(entry.title || "Untitled video");
  const safeThumb = escapeHtml(entry.thumbnail || "");
  const safeLink = escapeHtml(entry.url || "#");
  const watchedAt = formatDate(entry.watchedAt);

  return `
    <a
      href="${safeLink}"
      target="_blank"
      rel="noopener noreferrer"
      data-history-index="${index}"
      class="yt-video-row"
    >
      <div class="yt-thumb-wrap">
        <img src="${safeThumb}" alt="${safeTitle}" loading="lazy" decoding="async" width="480" height="270" />
        <span class="yt-play-orb" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v14l11-7z"/></svg></span>
        <span class="yt-play-badge">▶</span>
      </div>
      <div class="yt-video-meta">
        <h3 class="yt-video-title line-clamp-2">${safeTitle}</h3>
        <span class="yt-video-date">Watched ${escapeHtml(watchedAt)}</span>
      </div>
    </a>
  `;
};

export const renderPlayHistory = () => {
  const section = document.createElement("section");
  section.className = "animate-fadein";

  const history = [...getWatchedVideos()].reverse();
  const count = history.length;

  const initial = history.slice(0, HISTORY_BATCH);
  section.innerHTML = `
    <div class="yt-playlist">
      <div class="yt-playlist-header">
        <div>
          <h2 class="yt-playlist-title">Play History</h2>
          <div class="yt-playlist-subtitle">${count ? `Your last ${count} watches — resume anytime` : "No watches yet"}</div>
        </div>
        <span class="yt-count-badge">${count} video${count === 1 ? "" : "s"}</span>
      </div>

      <div class="yt-video-list" data-history-grid>
        ${count
          ? initial.map((entry, index) => historyCardHtml(entry, index)).join("")
          : `<div class="yt-empty rounded-2xl"><strong>No watched videos yet.</strong><br/>Tap any episode to start your history.</div>`}
      </div>
    </div>
  `;

  const grid = section.querySelector("[data-history-grid]");
  let rendered = initial.length;

  const openInPlayerTab = (index) => {
    const entry = history[index];
    if (!entry?.id) return;

    try {
      const queue = history.map((it) => ({ id: it.id, title: it.title || "" }));
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify({ items: queue, listId: "" }));
    } catch {}

    const params = new URLSearchParams({ v: entry.id, i: String(index), title: entry.title || "YouTube video player" });
    window.open(`player.html?${params.toString()}`, "_blank", "noopener,noreferrer");
  };

  // Tier B: per-card listeners for stub+browser compat (50 max, low overhead)
  // Delegation would need bubbling which stub lacks, so keep direct attach + pagination
  const attachHistoryHandler = (anchor) => {
    anchor.addEventListener("click", (event) => {
      const index = Number(anchor.getAttribute("data-history-index"));
      if (Number.isNaN(index)) return;
      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openInPlayerTab(index);
    });
  };
  grid?.querySelectorAll("[data-history-index]").forEach(attachHistoryHandler);

  if (grid && rendered < count) {
    const playlistEl = section.querySelector(".yt-playlist");
    const wrap = document.createElement("div");
    wrap.className = "yt-load-more-wrap";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "yt-load-more";
    const remaining = count - rendered;
    btn.textContent = `Load more — ${remaining} remaining · ${rendered} of ${count}`;
    wrap.appendChild(btn);
    playlistEl.appendChild(wrap);

    const update = () => {
      const rem = count - rendered;
      if (rem <= 0) {
        btn.textContent = "All caught up ✓";
        btn.disabled = true;
        setTimeout(() => (wrap.style.display = "none"), 600);
        return;
      }
      btn.textContent = `Load more — ${rem} remaining · ${rendered} of ${count}`;
    };

    btn.addEventListener("click", () => {
      const next = history.slice(rendered, rendered + HISTORY_BATCH);
      const temp = document.createElement("div");
      temp.innerHTML = next.map((e, i) => historyCardHtml(e, rendered + i)).join("");
      [...temp.children].forEach((card) => {
        grid.appendChild(card);
        attachHistoryHandler(card);
      });
      rendered += next.length;
      update();
    });
  }

  return section;
};
