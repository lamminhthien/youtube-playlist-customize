// Vercel serverless function: fetches just a channel avatar or playlist
// thumbnail via youtubei.js — no video list is requested, so this stays
// cheap enough to call for every entry shown in the picker UI.
import { getInnertube, pickThumbnail, extractVideo, resolveChannelId, getQueryParam } from "./_youtube.js";

const channelIcon = async (yt, idOrHandle) => {
  const channelId = await resolveChannelId(yt, idOrHandle);
  const channel = await yt.getChannel(channelId);
  return (
    pickThumbnail(channel.metadata?.thumbnail) ||
    pickThumbnail(channel.metadata?.avatar) ||
    pickThumbnail(channel.header?.content?.author?.thumbnails) ||
    ""
  );
};

const playlistIcon = async (yt, playlistId) => {
  const playlist = await yt.getPlaylist(playlistId);
  const fromInfo = pickThumbnail(playlist.info?.thumbnails);
  if (fromInfo) return fromInfo;
  // Fall back to the first page's first video thumbnail (no continuation
  // pages are fetched — this only needs whatever load already happened).
  const firstVideo = (playlist.videos || [])
    .map(extractVideo)
    .find((video) => video?.thumbnail);
  return firstVideo?.thumbnail || "";
};

export default async function handler(req, res) {
  const type = getQueryParam(req, "type");
  const id = getQueryParam(req, "id");

  if (!id || (type !== "channel" && type !== "playlist")) {
    res.status(400).json({
      status: "error",
      message: "Missing or invalid 'type'/'id' query parameters.",
    });
    return;
  }

  try {
    const yt = await getInnertube();
    const icon = type === "channel" ? await channelIcon(yt, id) : await playlistIcon(yt, id);

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.status(200).json({ status: "success", icon });
  } catch (err) {
    console.error(`Failed to fetch icon for ${type} ${id}:`, err);
    res.status(502).json({
      status: "error",
      message: err?.message || "Failed to load icon.",
    });
  }
}
