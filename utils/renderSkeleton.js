/**
 * Render a skeleton placeholder for a playlist panel while data is loading.
 *
 * Visual structure mirrors `renderPlaylist` so the layout doesn't jump when
 * the real content swaps in. Uses the `.skeleton` shimmer class defined in
 * index.html.
 *
 * @returns {HTMLElement} A `<section>` ready to be inserted into a tab panel.
 */
export const renderSkeleton = () => {
  const section = document.createElement("section");
  section.className = "animate-fadein";
  section.setAttribute("aria-busy", "true");
  section.setAttribute("aria-label", "Loading playlist");

  const rows = Array.from({ length: 6 })
    .map(
      () => `
        <div class="yt-skeleton-row">
          <div class="yt-skeleton-thumb skeleton"></div>
          <div class="yt-skeleton-lines">
            <div class="yt-skeleton-line skeleton" style="width: 70%"></div>
            <div class="yt-skeleton-line skeleton" style="width: 40%"></div>
          </div>
        </div>
      `
    )
    .join("");

  section.innerHTML = `
    <div class="yt-playlist">
      <div class="yt-playlist-header">
        <div class="yt-skeleton-line skeleton" style="width: 160px; height: 16px"></div>
      </div>
      <div class="yt-video-list">
        ${rows}
      </div>
    </div>
  `;

  return section;
};
