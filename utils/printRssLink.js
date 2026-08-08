// Build the public YouTube RSS feed URL for a given playlist ID.
export const printRssLink = (playlistId) =>
  `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
