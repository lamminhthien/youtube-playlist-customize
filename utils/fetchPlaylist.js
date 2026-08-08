import { printRssLink } from "./printRssLink.js";

export const fetchPlaylist = async ([name, playlistId]) => {
  const rssUrl = printRssLink(playlistId);
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (data.status !== "ok") {
    throw new Error(`Failed to load playlist: ${name}`);
  }

  return { name, playlistId, rssUrl, data };
};
