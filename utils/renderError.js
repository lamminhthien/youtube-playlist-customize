import { escapeHtml } from "./escapeHtml.js";

export const renderError = (name, err) => {
  console.error(err);
  const section = document.createElement("section");
  section.className = "animate-fadein";
  section.innerHTML = `
    <div class="rounded-2xl bg-white/80 backdrop-blur shadow-soft ring-1 ring-rose-200/60 p-8 text-center">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-500 ring-4 ring-rose-50">
        <svg viewBox="0 0 24 24" class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="text-lg font-bold text-slate-900">Couldn't load "${escapeHtml(name)}"</h2>
      <p class="mt-2 text-sm text-slate-500 max-w-md mx-auto">
        We had trouble fetching this playlist. Please check your connection and try again in a moment.
      </p>
    </div>
  `;
  return section;
};
