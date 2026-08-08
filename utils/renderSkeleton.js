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

  const cards = Array.from({ length: 6 })
    .map(
      () => `
        <div class="rounded-xl bg-white shadow-soft ring-1 ring-slate-200/60 overflow-hidden">
          <div class="aspect-video skeleton"></div>
          <div class="p-4 flex flex-col gap-2">
            <div class="h-4 w-3/4 rounded skeleton"></div>
            <div class="h-3 w-1/2 rounded skeleton"></div>
          </div>
        </div>
      `
    )
    .join("");

  section.innerHTML = `
    <div class="rounded-2xl bg-white/80 backdrop-blur shadow-soft ring-1 ring-slate-200/60 p-6">
      <div class="flex items-center gap-3 mb-5">
        <div class="h-9 w-9 rounded-xl skeleton"></div>
        <div class="h-5 w-40 rounded skeleton"></div>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        ${cards}
      </div>
    </div>
  `;

  return section;
};
