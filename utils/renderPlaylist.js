import { escapeHtml } from "./escapeHtml.js";
import { printRssLink } from "./printRssLink.js";

const formatDate = (input) => {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const renderPlaylist = ({ name, playlistId, rssUrl, data }) => {
  const section = document.createElement("section");
  section.className = "animate-fadein";

  const title = escapeHtml(data.feed.title || name);
  const author = escapeHtml(data.feed.author || "YouTube Channel");
  const count = Array.isArray(data.items) ? data.items.length : 0;
  const safeRssUrl = escapeHtml(rssUrl || printRssLink(playlistId));
  const safePlaylistId = escapeHtml(playlistId || "");

  section.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur shadow-soft ring-1 ring-slate-200/60">
      <div class="px-6 pt-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100">
        <div class="flex items-center gap-3">
          <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-indigo-500 text-white shadow-glow">
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 6h16v12H4z"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>
            </svg>
          </span>
          <div>
            <h2 class="text-xl font-bold text-slate-900 leading-tight">${title}</h2>
            <p class="text-xs text-slate-500 mt-0.5">by <span class="font-medium text-slate-700">${author}</span></p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            data-rss-copy
            data-rss-url="${safeRssUrl}"
            data-playlist-id="${safePlaylistId}"
            title="Copy RSS feed URL"
            aria-label="Copy RSS feed URL"
            class="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-600 ring-1 ring-slate-200 hover:text-rose-600 hover:ring-rose-200 hover:bg-rose-50 text-xs font-medium px-3 py-1 transition-colors"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 11a9 9 0 0 1 9 9"/>
              <path d="M4 4a16 16 0 0 1 16 16"/>
              <circle cx="5" cy="19" r="1.5" fill="currentColor"/>
            </svg>
            <span data-rss-label>RSS</span>
          </button>
          <a
            href="${safeRssUrl}"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium px-3 py-1 transition-colors"
            aria-label="Open RSS feed in new tab"
            title="Open RSS feed"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Feed
          </a>
          <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium px-3 py-1">
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
            </svg>
            ${count} video${count === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-5">
        ${(data.items || []).map((item) => {
          const videoId = (item.link || "").split("v=")[1]?.split("&")[0];
          const thumbnailUrl =
            item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          const safeTitle = escapeHtml(item.title);
          const published = formatDate(item.pubDate);
          const safeLink = escapeHtml(item.link || "#");

          return `
            <a
              href="${safeLink}"
              target="_blank"
              rel="noopener noreferrer"
              class="group relative flex flex-col overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-slate-200/60 hover:shadow-glow hover:-translate-y-0.5 transition-all duration-300"
            >
              <div class="relative aspect-video overflow-hidden bg-slate-200">
                <img
                  src="${escapeHtml(thumbnailUrl)}"
                  alt="${safeTitle}"
                  loading="lazy"
                  class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <!-- gradient scrim -->
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <!-- play button -->
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-rose-500 shadow-lg ring-1 ring-black/5 backdrop-blur">
                    <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </span>
                </div>
                <!-- top-right badge -->
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

  const copyBtn = section.querySelector("[data-rss-copy]");
  if (copyBtn) {
    const label = copyBtn.querySelector("[data-rss-label]");
    const originalLabel = label ? label.textContent : "RSS";
    copyBtn.addEventListener("click", async () => {
      const url = copyBtn.getAttribute("data-rss-url");
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        if (label) {
          label.textContent = "Copied!";
          setTimeout(() => {
            label.textContent = originalLabel;
          }, 1500);
        }
      } catch (err) {
        console.error("Failed to copy RSS URL", err);
      }
    });
  }

  return section;
};
