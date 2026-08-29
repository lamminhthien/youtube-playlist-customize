// Vercel serverless function: fetches a YouTube playlist's videos directly
// from YouTube's InnerTube API via youtubei.js — no API key, no Google Apps
// Script proxy required. Response shape matches what utils/fetchPlaylist.js
// and utils/renderPlaylist.js already expect.
import { Innertube } from "youtubei.js";

// Reused across warm invocations of the same serverless instance so we don't
// re-negotiate an InnerTube session on every request.
let innertubePromise;
const getInnertube = () => {
  if (!innertubePromise) {
    innertubePromise = Innertube.create({
      generate_session_locally: true,
      retrieve_player: false,
    });
  }
  return innertubePromise;
};

const textOf = (t) => t?.text ?? (typeof t === "string" ? t : "");

const pickThumbnail = (thumbnails) => {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return "";
  // Pick the largest by width; arrays aren't guaranteed to be sorted.
  return thumbnails.reduce((best, img) => (
    (img?.width || 0) > (best?.width || 0) ? img : best
  ), thumbnails[0])?.url || "";
};

const relativeDateOf = (node) => {
  const rows = node?.metadata?.metadata?.metadata_rows || [];
  const texts = rows
    .flatMap((row) => row?.metadata_parts || [])
    .map((part) => textOf(part?.text));
  return texts.find((text) => /\bago$/i.test(text)) || null;
};

// youtubei.js renders playlist entries as `LockupView` nodes (content_id,
// metadata.title, content_image.image[]) in current versions, but we fall
// back to the older `id` / `title.text` / `thumbnails[]` shape defensively
// in case a different renderer is returned (e.g. for some mix playlists).
const extractVideo = (node) => {
  if (node?.content_id) {
    return {
      id: node.content_id,
      title: textOf(node.metadata?.title),
      thumbnail: pickThumbnail(node.content_image?.image),
      publishedAt: relativeDateOf(node),
    };
  }

  const id = node?.id || node?.video_id;
  if (!id) return null;
  return {
    id,
    title: textOf(node.title),
    thumbnail: pickThumbnail(node.thumbnails),
    publishedAt: null,
  };
};

const videoUrl = (id) => (id ? `https://www.youtube.com/watch?v=${id}` : "");

const collectVideos = (playlist, items) => {
  for (const video of playlist.videos || []) {
    const extracted = extractVideo(video);
    if (!extracted?.id) continue;
    items.push({ ...extracted, url: videoUrl(extracted.id) });
  }
};


const MAX_CONTINUATION_PAGES = 20;

export default async function handler(req, res) {
  const playlistId =
    req.query?.id ??
    new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("id");

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
