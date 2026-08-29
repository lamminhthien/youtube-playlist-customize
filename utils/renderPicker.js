import { escapeHtml } from "./escapeHtml.js";
import { fetchIcon } from "./fetchIcon.js";

// Deterministic pastel color per name so each icon looks distinct but stable
// across reloads (no randomness).
const colorFor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 65%, 55%)`;
};

const initialsFor = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

/**
 * Render a grid of selectable icons (one per entry) into `container`.
 * Calling `onSelect(index)` is deferred until the user picks an entry, so no
 * video data is fetched up front. Each icon starts as an initials placeholder
 * and is swapped for a real channel/playlist thumbnail once `fetchIcon`
 * resolves, without blocking rendering or selection on that fetch.
 *
 * @param {HTMLElement} container
 * @param {[string, string][]} entries - Tuples of [name, channelId/playlistId]
 * @param {"channel"|"playlist"} type
 * @param {(index: number) => void} onSelect
 */
export const renderPicker = (container, entries, type, onSelect) => {
  const grid = document.createElement("div");
  grid.className = "yt-picker-grid";

  entries.forEach(([name, id], index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "yt-picker-item";

    btn.innerHTML = `
      <span class="yt-picker-avatar" style="background:${colorFor(name)}">
        ${escapeHtml(initialsFor(name))}
      </span>
      <span class="yt-picker-name">${escapeHtml(name)}</span>
    `;

    btn.addEventListener("click", () => onSelect(index));
    grid.appendChild(btn);

    fetchIcon(type, id).then((iconUrl) => {
      if (!iconUrl) return;
      const avatar = btn.querySelector(".yt-picker-avatar");
      if (!avatar) return;
      avatar.style.background = "transparent";
      avatar.innerHTML = `<img src="${escapeHtml(iconUrl)}" alt="" class="yt-picker-img" loading="lazy" />`;
    });
  });

  container.appendChild(grid);
};

