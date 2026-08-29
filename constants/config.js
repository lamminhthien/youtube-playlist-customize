// Local Vercel serverless functions that fetch data directly from YouTube's
// InnerTube API via youtubei.js. No Google Apps Script or YouTube Data API
// key required.
// api/playlist.js accepts a required `?id=PLAYLIST_ID` query parameter.
export const PLAYLIST_API_URL = "/api/playlist";
// api/channel.js accepts a required `?id=` query parameter (handle or UC id).
export const CHANNEL_API_URL = "/api/channel";
