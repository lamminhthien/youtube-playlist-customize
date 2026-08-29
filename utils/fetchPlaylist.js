import { PLAYLIST_API_URL } from "../constants/config.js";

/**
 * Fetch a YouTube playlist via our own serverless endpoint (api/playlist.js),
 * which uses youtubei.js to talk to YouTube's InnerTube API directly — no
 * Google Apps Script and no YouTube Data API key required.
 *
 * The endpoint returns JSON of the form:
 *   { status: "success", feed: { title }, items: [{ id, title, thumbnail, publishedAt, url }] }
 *
 * @param {[string, string]} entry - Tuple of [playlistName, playlistId]
 * @returns {Promise<{ name: string, playlistId: string, data: { items: Array } }>}
 */
export const fetchPlaylist = async ([name, playlistId]) => {
  const params = new URLSearchParams({ id: playlistId });
  const url = `${PLAYLIST_API_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load playlist: ${name} (HTTP ${response.status})`
    );
  }

  const payload = await response.json();

  if (!payload || payload.status !== "success") {
    throw new Error(
      `Failed to load playlist: ${name} (${payload?.message || "unknown error"})`
    );
  }

  return { name, playlistId, data: payload };
};
