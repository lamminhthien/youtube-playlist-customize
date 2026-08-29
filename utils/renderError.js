import { escapeHtml } from "./escapeHtml.js";

export const renderError = (name, err) => {
  console.error(err);
  const section = document.createElement("section");
  section.className = "animate-fadein";
  section.innerHTML = `
    <div class="yt-error">
      <h2 class="yt-error-title">Couldn't load "${escapeHtml(name)}"</h2>
      <p class="yt-error-body">
        We had trouble fetching this playlist. Please check your connection and try again in a moment.
      </p>
    </div>
  `;
  return section;
};
