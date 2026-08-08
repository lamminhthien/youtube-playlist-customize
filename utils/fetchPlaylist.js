import { APPS_SCRIPT_URL } from "../config.constants.js";

/**
 * Fetch a YouTube playlist via the deployed Google Apps Script Web App proxy.
 *
 * The Apps Script returns JSON of the form:
 *   { status: "success", message: "...", items: [{ id, title, thumbnail, publishedAt, url }] }
 *
 * @param {[string, string]} entry - Tuple of [playlistName, playlistId]
 * @returns {Promise<{ name: string, playlistId: string, data: { items: Array } }>}
 */
export const fetchPlaylist = async ([name, playlistId]) => {
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.append("id", playlistId);

  const response = await fetch(url.toString(), {
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
