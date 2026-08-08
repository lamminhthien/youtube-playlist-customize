export const fetchPlaylist = async ([name, playlistId]) => {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  if (data.status !== "ok") {
    throw new Error(`Failed to load playlist: ${name}`);
  }

  return { name, data };
};
