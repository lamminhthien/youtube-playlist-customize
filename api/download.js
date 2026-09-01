// Vercel serverless function: resolves a YouTube video's direct stream URLs
// via youtubei.js (same InnerTube session as playlist/channel). This is the
// server-side equivalent of `youtube-dl` / `yt-dlp --get-url` but without
// needing the Python binary on Vercel.
//
// GET /api/download?id=VIDEO_ID
// GET /api/download?url=https://www.youtube.com/watch?v=VIDEO_ID
// GET /api/download?id=VIDEO_ID&itag=18  -> 302 redirect to chosen format
//     (useful for direct download / `wget` style)
//
// Response (JSON) when itag not specified:
// {
//   status: "success",
//   videoId, title, author, channelId, lengthSeconds,
//   viewCount, isLive, thumbnail,
//   formats: [{ itag, mimeType, qualityLabel, quality, width, height, fps,
//               bitrate, hasAudio, hasVideo, url, contentLength, ... }]
// }
import { getInnertubeForDownload, getQueryParam } from "./_youtube.js";

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const extractVideoId = (raw) => {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  if (VIDEO_ID_RE.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) {
      const seg = u.pathname.slice(1).split("/")[0].split("?")[0];
      if (VIDEO_ID_RE.test(seg)) return seg;
    }
    const v = u.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return v;
    // /embed/VIDEO_ID or /shorts/VIDEO_ID or /v/VIDEO_ID
    const m = u.pathname.match(/\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {}
  // fallback: find 11-char id anywhere
  const m2 = s.match(/([a-zA-Z0-9_-]{11})/);
  if (m2 && VIDEO_ID_RE.test(m2[1])) return m2[1];
  return "";
};

const pickThumbnail = (thumbs) => {
  if (!Array.isArray(thumbs) || !thumbs.length) return "";
  return thumbs.reduce((best, img) => ((img?.width || 0) > (best?.width || 0) ? img : best), thumbs[0])?.url || "";
};

const formatToJson = (f, decipheredUrl) => ({
  itag: f.itag,
  mimeType: f.mime_type || f.mimeType || "",
  quality: f.quality || "",
  qualityLabel: f.quality_label || f.qualityLabel || "",
  width: f.width || null,
  height: f.height || null,
  fps: f.fps || null,
  bitrate: f.bitrate || f.average_bitrate || null,
  audioQuality: f.audio_quality || f.audioQuality || null,
  hasAudio: Boolean(f.has_audio ?? f.hasAudio),
  hasVideo: Boolean(f.has_video ?? f.hasVideo),
  isOriginal: Boolean(f.is_original),
  contentLength: f.content_length ? Number(f.content_length) : null,
  approxDurationMs: f.approx_duration_ms ? Number(f.approx_duration_ms) : null,
  url: decipheredUrl || f.url || "",
});

// Deciphers a Format's URL if it's still ciphered (signatureCipher).
// Requires the player that was fetched with retrieve_player:true + JS evaluator.
const decipherUrl = async (format, player) => {
  if (format.url) return format.url;
  if (typeof format.decipher === "function") {
    try {
      const u = await format.decipher(player);
      return u || "";
    } catch (e) {
      console.warn(`decipher failed for itag ${format.itag}:`, e.message);
      return "";
    }
  }
  return "";
};

export default async function handler(req, res) {
  const rawId = getQueryParam(req, "id") || getQueryParam(req, "url") || getQueryParam(req, "v");
  const videoId = extractVideoId(rawId);

  if (!videoId) {
    res.status(400).json({
      status: "error",
      message: "Missing or invalid 'id' query parameter. Provide a YouTube video id (11 chars) or full watch URL.",
    });
    return;
  }

  // Optional direct redirect mode: ?itag=18
  const requestedItag = getQueryParam(req, "itag");

  try {
    const yt = await getInnertubeForDownload();

    // getInfo decipher streaming URLs; getBasicInfo would leave ciphered urls
    const info = await yt.getInfo(videoId);

    const playability = info.playability_status;
    if (playability?.status && playability.status !== "OK") {
      res.status(404).json({
        status: "error",
        message: playability.reason || `Video unavailable (status: ${playability.status})`,
        playabilityStatus: playability.status,
      });
      return;
    }

    const streamingData = info.streaming_data;
    if (!streamingData || (!streamingData.formats?.length && !streamingData.adaptive_formats?.length)) {
      res.status(404).json({
        status: "error",
        message: "No streaming data available for this video (private, members-only, or age-restricted).",
      });
      return;
    }

    const basic = info.basic_info || {};
    const details = info.page?.[0]?.video_details || info.basic_info || {};

    // Decipher all URLs in parallel (needs JS evaluator + player)
    const player = yt.session?.player;
    const decipherAll = async (list) =>
      Promise.all(
        list.map(async (f) => {
          const url = await decipherUrl(f, player);
          return url;
        })
      );

    const muxedUrls = await decipherAll(streamingData.formats || []);
    const adaptiveUrls = await decipherAll(streamingData.adaptive_formats || []);

    // If itag requested, redirect straight to that stream url (like youtube-dl --get-url)
    if (requestedItag) {
      const itagNum = Number(requestedItag);
      const all = [...(streamingData.formats || []), ...(streamingData.adaptive_formats || [])];
      const allUrls = [...muxedUrls, ...adaptiveUrls];
      const idx = all.findIndex((f) => Number(f.itag) === itagNum);
      if (idx === -1) {
        res.status(404).json({ status: "error", message: `itag ${requestedItag} not found for video ${videoId}` });
        return;
      }
      const chosenUrl = allUrls[idx] || all[idx]?.url;
      if (!chosenUrl) {
        res.status(404).json({ status: "error", message: `itag ${requestedItag} has no deciphered URL (cipher failed)` });
        return;
      }
      // 302 to the deciphered googlevideo url
      res.setHeader("Cache-Control", "private, max-age=60");
      res.redirect(302, chosenUrl);
      return;
    }

    // Build full format list: muxed first (contains both audio+video), then adaptive
    // Filter out formats where decipher failed (empty url) — YouTube may omit adaptive for some videos/clients
    const rawFormats = [
      ...(streamingData.formats || []).map((f, i) => ({ ...formatToJson(f, muxedUrls[i]), hasAudio: true, hasVideo: true, type: "muxed" })),
      ...(streamingData.adaptive_formats || []).map((f, i) => ({ ...formatToJson(f, adaptiveUrls[i]), type: "adaptive" })),
    ];
    const formats = rawFormats.filter((f) => !!f.url);

    // Provide convenience grouping
    const muxed = formats.filter((f) => f.type === "muxed");
    const videoOnly = formats.filter((f) => f.hasVideo && !f.hasAudio);
    const audioOnly = formats.filter((f) => f.hasAudio && !f.hasVideo);

    const title = basic.title || details.title || "";
    const author = basic.author || details.author || basic.channel?.name || "";
    const channelId = basic.channel_id || basic.channel?.id || details.channel_id || "";
    const thumbnail = pickThumbnail(basic.thumbnail) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.status(200).json({
      status: "success",
      videoId,
      title,
      author,
      channelId,
      thumbnail,
      lengthSeconds: basic.duration ?? details.length_seconds ?? null,
      viewCount: basic.view_count ?? null,
      isLive: Boolean(basic.is_live ?? details.is_live),
      isPrivate: Boolean(basic.is_private),
      hlsManifestUrl: streamingData.hls_manifest_url || null,
      dashManifestUrl: streamingData.dash_manifest_url || null,
      expires: streamingData.expires ? streamingData.expires.toISOString() : null,
      // Full list + convenience buckets (mirrors yt-dlp --list-formats)
      formats,
      muxed,
      videoOnly,
      audioOnly,
    });
  } catch (err) {
    console.error(`Failed to fetch download info for ${videoId}:`, err);
    const msg = err?.message || "Failed to resolve video.";
    // Surface InnerTube "not found" as 404, else 502
    const status = /not found|unavailable|private/i.test(msg) ? 404 : 502;
    res.status(status).json({ status: "error", message: msg });
  }
}

// Exported for unit tests
export const _extractVideoId = extractVideoId;
export const _formatToJson = formatToJson;
