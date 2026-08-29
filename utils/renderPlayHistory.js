import { escapeHtml } from "./escapeHtml.js";
import { formatDate } from "./videoHelpers.js";
import { getWatchedVideos } from "./watchHistory.js";

const QUEUE_STORAGE_KEY = "yt-player-queue";

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
        <img src="${safeThumb}" alt="${safeTitle}" loading="lazy" />
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

  section.innerHTML = `
    <div class="yt-playlist">
      <div class="yt-playlist-header">
        <h2 class="yt-playlist-title">Play History</h2>
        <span class="yt-count-badge">${count} video${count === 1 ? "" : "s"}</span>
      </div>

      <div class="yt-video-list">
        ${count
          ? history.map((entry, index) => historyCardHtml(entry, index)).join("")
          : `<div class="yt-empty rounded-2xl">No watched videos yet.</div>`}
      </div>
    </div>
  `;

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

  section.querySelectorAll("[data-history-index]").forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const index = Number(anchor.getAttribute("data-history-index"));
      if (Number.isNaN(index)) return;

      if (event.button && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      openInPlayerTab(index);
    });
  });

  return section;
};