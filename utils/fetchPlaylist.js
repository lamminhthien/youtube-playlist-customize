import { PLAYLIST_API_URL } from "../constants/config.js";
import { fetchFromApi } from "./apiFetch.js";

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
  const payload = await fetchFromApi(PLAYLIST_API_URL, name, "playlist", playlistId);
  return { name, playlistId, data: payload };
};
