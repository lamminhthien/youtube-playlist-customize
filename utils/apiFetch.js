/**
 * Shared fetch helper for the frontend serverless API calls.
 * Centralises error handling and URL construction so fetchPlaylist
 * and fetchChannel stay DRY.
 *
 * @param {string} baseUrl - e.g. PLAYLIST_API_URL or CHANNEL_API_URL
 * @param {string} name - human readable name for error messages
 * @param {string} label - "playlist" | "channel" used in error prefix
 * @param {string} id - id/handle to send as ?id=
 * @returns {Promise<object>} parsed JSON payload when status === "success"
 */
export const fetchFromApi = async (baseUrl, name, label, id) => {
  const params = new URLSearchParams({ id });
  const url = `${baseUrl}?${params.toString()}`;

  const response = await fetch(url, { method: "GET", redirect: "follow" });

  if (!response.ok) {
    throw new Error(`Failed to load ${label}: ${name} (HTTP ${response.status})`);
  }

  const payload = await response.json();

  if (!payload || payload.status !== "success") {
    throw new Error(`Failed to load ${label}: ${name} (${payload?.message || "unknown error"})`);
  }

  return payload;
};
