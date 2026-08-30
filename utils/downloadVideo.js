import { DOWNLOAD_API_URL } from "../constants/config.js";

/**
 * Build API URLs for the download endpoint.
 * @param {string} videoId - 11-character YouTube video id (or id extracted via videoIdOf)
 */
export const getDownloadApiUrl = (videoId) =>
  `${DOWNLOAD_API_URL}?id=${encodeURIComponent(videoId)}`;

export const getDownloadStreamUrl = (videoId) =>
  `${DOWNLOAD_API_URL}?id=${encodeURIComponent(videoId)}&download=1`;

/**
 * Trigger a browser download for a YouTube video via the server-side streaming
 * endpoint. Creates a hidden anchor pointing at `/api/download?id=...&download=1`
 * which sends Content-Disposition: attachment, so the browser saves the file
 * instead of navigating.
 *
 * The download is same-origin, so the `download` attribute and Content-Disposition
 * both work without CORS issues.
 *
 * @param {string} videoId
 * @param {string} [title] - used for filename fallback (server also sanitizes)
 */
export const triggerDownload = (videoId, title) => {
  if (!videoId) return;
  const url = getDownloadStreamUrl(videoId);
  const anchor = document.createElement("a");
  anchor.href = url;
  // Hint filename; server's Content-Disposition is authoritative.
  anchor.setAttribute("download", `${(title || videoId).slice(0, 80)}.mp4`);
  anchor.style.display = "none";
  // Must be in DOM for Firefox to trigger
  document.body.appendChild(anchor);
  anchor.click();
  // Cleanup after a tick so navigation starts
  setTimeout(() => anchor.remove(), 1000);
};

/**
 * Fetch JSON metadata for a video (title, downloadUrl, thumbnail).
 * Useful if you want to present format choices before triggering download.
 * @param {string} videoId
 * @returns {Promise<object>}
 */
export const fetchDownloadInfo = async (videoId) => {
  const response = await fetch(getDownloadApiUrl(videoId), {
    method: "GET",
    redirect: "follow",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.message || `Download info failed (HTTP ${response.status})`);
  }
  const payload = await response.json();
  if (!payload || payload.status !== "success") {
    throw new Error(payload?.message || "Failed to get download info");
  }
  return payload;
};
