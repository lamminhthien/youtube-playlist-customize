// Vercel serverless function: fetches a YouTube playlist's videos directly
// from YouTube's InnerTube API via youtubei.js — no API key, no Google Apps
// Script proxy required. Response shape matches what utils/fetchPlaylist.js
// and utils/renderPlaylist.js already expect.
import { getInnertube, collectVideos, MAX_CONTINUATION_PAGES, getQueryParam } from "./_youtube.js";

export default async function handler(req, res) {
  const playlistId = getQueryParam(req, "id");

  if (!playlistId || typeof playlistId !== "string") {
    res.status(400).json({
      status: "error",
      message: "Missing required 'id' query parameter.",
    });
    return;
  }

  try {
    const yt = await getInnertube();
    let playlist = await yt.getPlaylist(playlistId);

    const items = [];
    collectVideos(playlist, items);

    let guard = 0;
    while (playlist.has_continuation && guard < MAX_CONTINUATION_PAGES) {
      playlist = await playlist.getContinuation();
      collectVideos(playlist, items);
      guard += 1;
    }

    const title =
      playlist.info?.title ??
      (typeof playlist.title === "string" ? playlist.title : playlist.title?.text) ??
      "";

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    res.status(200).json({
      status: "success",
      feed: { title },
      items,
    });
  } catch (err) {
    console.error(`Failed to fetch playlist ${playlistId} via youtubei.js:`, err);
    res.status(502).json({
      status: "error",
      message: err?.message || "Failed to load playlist.",
    });
  }
}
