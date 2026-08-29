import { CHANNEL_API_URL } from "../constants/config.js";

/**
 * Fetch a YouTube channel's recent uploads via our own serverless endpoint
 * (api/channel.js), which uses youtubei.js to talk to YouTube's InnerTube
 * API directly — no Google Apps Script and no YouTube Data API key required.
 *
 * The endpoint returns JSON of the form:
 *   { status: "success", feed: { title }, items: [{ id, title, thumbnail, publishedAt, url }] }
 *
 * @param {[string, string]} entry - Tuple of [channelName, channelHandleOrId]
 * @returns {Promise<{ name: string, playlistId: undefined, data: { items: Array } }>}
 */
export const fetchChannel = async ([name, channelId]) => {
  const params = new URLSearchParams({ id: channelId });
  const url = `${CHANNEL_API_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to load channel: ${name} (HTTP ${response.status})`
    );
  }

  const payload = await response.json();

  if (!payload || payload.status !== "success") {
    throw new Error(
      `Failed to load channel: ${name} (${payload?.message || "unknown error"})`
    );
  }

  return { name, playlistId: undefined, data: payload };
};
