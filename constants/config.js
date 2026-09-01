// Local Vercel serverless functions that fetch data directly from YouTube's
// InnerTube API via youtubei.js. No Google Apps Script or YouTube Data API
// key required.
// api/playlist.js accepts a required `?id=PLAYLIST_ID` query parameter.
export const PLAYLIST_API_URL = "/api/playlist";
// api/channel.js accepts a required `?id=` query parameter (handle or UC id).
export const CHANNEL_API_URL = "/api/channel";
// api/icon.js accepts `?type=channel|playlist&id=` and returns just a
// thumbnail URL, without fetching any video list.
export const ICON_API_URL = "/api/icon";
export const CHAT_API_URL = "/api/chat";
// api/download.js accepts `?id=VIDEO_ID` or `?url=WATCH_URL` and returns
// streaming formats (like youtube-dl --list-formats / --get-url). When
// `&itag=18` is appended the endpoint 302-redirects to the raw googlevideo URL.
export const DOWNLOAD_API_URL = "/api/download";
