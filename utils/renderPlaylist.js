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

  section.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur shadow-soft ring-1 ring-slate-200/60">
      <div class="px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-indigo-500 text-white shadow-glow">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 6h16v12H4z"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>
            </svg>
          </span>
          <h2 class="text-xl font-bold text-slate-900 leading-tight">${title}</h2>
        </div>
        <div class="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1">
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
            ${count} video${count === 1 ? "" : "s"}
          </span>
          ${showPlayAll ? `
          <a
            href="${escapeHtml(playAllUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            data-play-all
            aria-label="Play all videos in this playlist on YouTube"
            class="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-indigo-500 text-white text-xs font-semibold px-3 py-1 shadow-glow hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Play all
          </a>` : ""}
        </div>
      </div>

      <div data-player-panel class="hidden px-5 pt-5">
        <div class="relative aspect-video overflow-hidden rounded-xl bg-black shadow-soft">
          <div data-player-frame class="absolute inset-0"></div>
        </div>
        <div class="mt-3 flex items-center justify-between gap-3">
          <h4 data-player-title class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800"></h4>
          <div class="flex items-center gap-2">
            <button type="button" data-player-prev aria-label="Previous video" class="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button type="button" data-player-next aria-label="Next video" class="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button type="button" data-player-close aria-label="Close player" class="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-rose-100 hover:text-rose-600">
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-5">
        ${items.map((item, index) => {
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
              class="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-slate-200/60 hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300"
            >
              <div class="relative aspect-video overflow-hidden bg-slate-200">
                <img
                  src="${safeThumb}"
                  alt="${safeTitle}"
                  loading="lazy"
                  class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-rose-500 shadow-lg ring-1 ring-black/5 backdrop-blur">
                    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </span>
                </div>
                <span class="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                  YouTube
                </span>
              </div>

              <div class="flex flex-col gap-2 p-4 flex-grow">
                <h3 class="text-sm font-semibold text-slate-800 line-clamp-2 group-hover:text-rose-600 transition-colors">
                  ${safeTitle}
                </h3>
                <div class="mt-auto flex items-center justify-between pt-3 text-xs text-slate-400">
                  <span class="inline-flex items-center gap-1">
                    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                    </svg>
                    ${escapeHtml(published)}
                  </span>
                  <span class="inline-flex items-center gap-1 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Watch
                    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 5l7 7-7 7"/>
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          `;
        }).join("")}
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

  section.querySelectorAll("[data-video-index]").forEach((anchor) => {
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
  });

  return section;
};
