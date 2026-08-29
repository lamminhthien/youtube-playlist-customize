// Shared InnerTube helpers for the api/ serverless functions. Prefixed with
// an underscore so Vercel does not expose this file as its own route.
import { Innertube } from "youtubei.js";

// Reused across warm invocations of the same serverless instance so we don't
// re-negotiate an InnerTube session on every request.
let innertubePromise;
export const INNERTUBE_SESSION_OPTIONS = {
  lang: "vi",
  location: "VN",
  timezone: "Asia/Ho_Chi_Minh",
  generate_session_locally: true,
  retrieve_player: false,
};

export const getInnertube = () => {
  if (!innertubePromise) {
    innertubePromise = Innertube.create(INNERTUBE_SESSION_OPTIONS);
  }
  return innertubePromise;
};

export const textOf = (t) => t?.text ?? (typeof t === "string" ? t : "");

export const pickThumbnail = (thumbnails) => {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return "";
  // Pick the largest by width; arrays aren't guaranteed to be sorted.
  return thumbnails.reduce((best, img) => (
    (img?.width || 0) > (best?.width || 0) ? img : best
  ), thumbnails[0])?.url || "";
};

export const relativeDateOf = (node) => {
  const rows = node?.metadata?.metadata?.metadata_rows || [];
  const texts = rows
    .flatMap((row) => row?.metadata_parts || [])
    .map((part) => textOf(part?.text));
  return texts.find((text) => /\bago$/i.test(text)) || null;
};

// youtubei.js renders video entries as `LockupView` nodes (content_id,
// metadata.title, content_image.image[]) in current versions, but we fall
// back to the older `id` / `title.text` / `thumbnails[]` shape defensively
// in case a different renderer is returned (e.g. GridVideo/CompactVideo).
export const extractVideo = (node) => {
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
    publishedAt: textOf(node.published) || null,
  };
};

export const videoUrl = (id) => (id ? `https://www.youtube.com/watch?v=${id}` : "");

export const collectVideos = (feed, items) => {
  for (const video of feed.videos || []) {
    const extracted = extractVideo(video);
    if (!extracted?.id) continue;
    items.push({ ...extracted, url: videoUrl(extracted.id) });
  }
};

export const MAX_CONTINUATION_PAGES = 20;

const CHANNEL_ID_RE = /^UC[\w-]{22}$/;

// Percent-encodes the handle name but keeps a leading "@" literal, since
// InnerTube's resolve_url endpoint only recognizes an unescaped "@".
const encodeHandlePath = (path) =>
  path.startsWith("@") ? `@${encodeURIComponent(path.slice(1))}` : encodeURIComponent(path);

// Some channels' configured "@handle" doesn't actually resolve (e.g. it was
// never claimed or the channel predates handles), but the same name still
// works as a legacy custom URL without the "@". Try both forms.
export const resolveChannelId = async (yt, idOrHandle) => {
  if (CHANNEL_ID_RE.test(idOrHandle)) return idOrHandle;

  const handle = idOrHandle.startsWith("@") ? idOrHandle : `@${idOrHandle}`;
  const candidates = [handle, handle.slice(1)];

  for (const candidate of candidates) {
    const endpoint = await yt.resolveURL(`https://www.youtube.com/${encodeHandlePath(candidate)}`);
    const browseId = endpoint?.payload?.browseId;
    if (browseId) return browseId;
  }

  throw new Error(`Could not resolve channel handle: ${idOrHandle}`);
};
