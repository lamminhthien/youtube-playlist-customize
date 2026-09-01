import { DOWNLOAD_API_URL } from "../constants/config.js";
import { videoIdOf } from "./videoHelpers.js";

/**
 * Regex for a bare 11-char YouTube video id.
 */
const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extract a video id from either a bare id or a full YouTube URL.
 * Mirrors api/download.js:_extractVideoId but for client-side use.
 * @param {string} input
 * @returns {string} 11-char id or ""
 */
export const extractVideoId = (input) => {
  if (!input || typeof input !== "string") return "";
  const s = input.trim();
  if (VIDEO_ID_RE.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) {
      const seg = u.pathname.slice(1).split("/")[0].split("?")[0];
      if (VIDEO_ID_RE.test(seg)) return seg;
    }
    const v = u.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {}
  const m2 = s.match(/([a-zA-Z0-9_-]{11})/);
  if (m2 && VIDEO_ID_RE.test(m2[1])) return m2[1];
  return "";
};

/**
 * Fetch streaming info for a video via our serverless endpoint.
 * Equivalent to `youtube-dl --list-formats` / `yt-dlp --get-url`.
 *
 * @param {string} videoIdOrUrl - bare id or full watch url
 * @returns {Promise<object>} parsed JSON with formats, title, etc.
 */
export const fetchDownloadInfo = async (videoIdOrUrl) => {
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) throw new Error("Invalid YouTube video id or URL.");
  const url = `${DOWNLOAD_API_URL}?id=${encodeURIComponent(videoId)}`;
  const res = await fetch(url, { method: "GET" });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.status !== "success") {
    throw new Error(payload?.message || `Failed to get download info (HTTP ${res.status})`);
  }
  return payload;
};

/**
 * Build a direct download/redirect URL for a specific itag.
 * Hitting this URL in the browser triggers a 302 to the googlevideo URL,
 * which the browser will download or play depending on Content-Type.
 * Mirrors `youtube-dl -f <itag> <url>`.
 *
 * @param {string} videoIdOrUrl
 * @param {number|string} itag
 * @returns {string}
 */
export const buildDownloadUrl = (videoIdOrUrl, itag) => {
  const videoId = extractVideoId(videoIdOrUrl);
  if (!videoId) throw new Error("Invalid video id.");
  return `${DOWNLOAD_API_URL}?id=${encodeURIComponent(videoId)}&itag=${encodeURIComponent(String(itag))}`;
};

/**
 * Trigger a download for a specific format by navigating to the
 * itag redirect URL. Falls back to opening the deciphered URL directly
 * if a format object with .url is supplied.
 *
 * @param {string} videoIdOrUrl
 * @param {object} format - one entry from fetchDownloadInfo().formats
 */
export const downloadFormat = (videoIdOrUrl, format) => {
  if (format?.url) {
    // Direct googlevideo url — open in new tab; browser handles download
    const a = document.createElement("a");
    a.href = format.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const url = buildDownloadUrl(videoIdOrUrl, format.itag);
  window.open(url, "_blank", "noopener,noreferrer");
};

/**
 * Convenience: given a playlist item (has id/url/title), return its video id.
 * @param {object} item
 * @returns {string}
 */
export const videoIdFromItem = (item) => videoIdOf(item) || extractVideoId(item?.url) || "";
