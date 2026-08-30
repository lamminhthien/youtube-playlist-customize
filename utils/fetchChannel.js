import { CHANNEL_API_URL } from "../constants/config.js";
import { fetchFromApi } from "./apiFetch.js";

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
  const payload = await fetchFromApi(CHANNEL_API_URL, name, "channel", channelId);
  return { name, playlistId: undefined, data: payload };
};
