import { escapeHtml } from "./escapeHtml.js";

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
 * Render a grid of selectable icons (one per entry name) into `container`.
 * Calling `onSelect(index)` is deferred until the user picks an entry, so no
 * video data is fetched up front.
 *
 * @param {HTMLElement} container
 * @param {string[]} names
 * @param {(index: number) => void} onSelect
 */
export const renderPicker = (container, names, onSelect) => {
  const grid = document.createElement("div");
  grid.className = "yt-picker-grid";

  names.forEach((name, index) => {
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
  });

  container.appendChild(grid);
};
