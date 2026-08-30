// Vercel serverless function: provides download support for YouTube videos.
// Two modes:
//   - JSON info mode (default): GET /api/download?id=VIDEO_ID
//     Returns { status: "success", title, videoId, formats: [...] , downloadUrl }
//   - Stream mode: GET /api/download?id=VIDEO_ID&download=1
//     Streams the video bytes with Content-Disposition: attachment, proxied
//     through youtubei.js so it works without CORS and with decipher.
//
// The videoId must be exactly 11 characters (YouTube's typical id shape).
import { Innertube } from "youtubei.js";
import { getQueryParam } from "./_youtube.js";

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

let downloadInnertubePromise;

export const DOWNLOAD_INNERTUBE_OPTIONS = {
  lang: "vi",
  location: "VN",
  timezone: "Asia/Ho_Chi_Minh",
  generate_session_locally: true,
  retrieve_player: true,
};

export const getDownloadInnertube = () => {
  if (!downloadInnertubePromise) {
    downloadInnertubePromise = Innertube.create(DOWNLOAD_INNERTUBE_OPTIONS);
  }
  return downloadInnertubePromise;
};

export const _resetDownloadInnertubeForTest = () => {
  downloadInnertubePromise = undefined;
};

export const _setDownloadInnertubeForTest = (promiseOrInstance) => {
  // Accept either a stub instance or a promise resolving to it.
  downloadInnertubePromise = promiseOrInstance instanceof Promise
    ? promiseOrInstance
    : Promise.resolve(promiseOrInstance);
};

const sanitizeFilename = (name) =>
  String(name || "video")
    .replace(/[^\w\-\s.]/g, "")
    .trim()
    .slice(0, 80) || "video";

export default async function handler(req, res) {
  const videoId = getQueryParam(req, "id");

  if (!videoId || typeof videoId !== "string" || !VIDEO_ID_RE.test(videoId)) {
    res.status(400).json({
      status: "error",
      message: "Missing or invalid 'id' query parameter. Expected 11-character YouTube video id.",
    });
    return;
  }

  // Vercel provides req.query, but we also support URL parsing fallback.
  const isDownload =
    getQueryParam(req, "download") !== null ||
    getQueryParam(req, "stream") !== null;

  try {
    const yt = await getDownloadInnertube();
    const info = await yt.getInfo(videoId);

    const playability = info.playability_status?.status;
    if (playability && playability !== "OK" && playability !== "LIVE") {
      // For unplayable videos we still return error instead of streaming.
      if (isDownload) {
        res.status(403).json({
          status: "error",
          message: `Video is not playable: ${playability}`,
        });
        return;
      }
    }

    const title = info.basic_info?.title || info.video_details?.title || videoId;

    if (isDownload) {
      // Stream mode: pipe the actual video bytes to the client as an attachment.
      // Use youtubei.js download helper which handles decipher and chunked fetch.
      const stream = await info.download({
        type: "video+audio",
        quality: "best",
        format: "mp4",
      });

      const filename = `${sanitizeFilename(title)}.mp4`;

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      // Allow download endpoint to be cached briefly at CDN level? No — stream is per-request.
      res.setHeader("Cache-Control", "private, no-cache");
      // Enable CORS for fetch-blob flow if needed.
      res.setHeader("Access-Control-Allow-Origin", "*");

      // `stream` is a WHATWG ReadableStream. Convert to async iterable.
      // Vercel's res is a Node ServerResponse with .write().
      try {
        // Try Node-style: if stream is already Node readable, pipe.
        if (typeof stream.pipe === "function") {
          stream.pipe(res);
          return;
        }

        // WHATWG ReadableStream: use getReader()
        if (typeof stream.getReader === "function") {
          const reader = stream.getReader();
          res.statusCode = 200;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                // value is Uint8Array
                res.write(Buffer.from(value));
              }
            }
          } finally {
            reader.releaseLock?.();
          }
          res.end();
          return;
        }

        // Fallback: async iterable (e.g. mocked stream with Symbol.asyncIterator)
        if (stream[Symbol.asyncIterator]) {
          res.statusCode = 200;
          for await (const chunk of stream) {
            res.write(Buffer.from(chunk));
          }
          res.end();
          return;
        }

        // Last resort: if stream is a Buffer/string
        res.status(200).end(stream);
      } catch (streamErr) {
        console.error(`Stream error for video ${videoId}:`, streamErr);
        if (!res.headersSent) {
          res.status(502).json({
            status: "error",
            message: streamErr?.message || "Failed to stream video.",
          });
        } else {
          try { res.end(); } catch { /* ignore */ }
        }
      }
      return;
    }

    // JSON info mode: return metadata and a direct download URL for client-side
    // progressive download or for constructing a stream link.
    let downloadUrl = "";
    let formats = [];
    try {
      // Choose best muxed format and decipher its URL.
      const bestFormat = info.chooseFormat({ type: "video+audio", quality: "best", format: "mp4" });
      if (bestFormat) {
        // Decipher returns the full googlevideo URL.
        downloadUrl = await bestFormat.decipher(yt.session.player);
        formats = info.streaming_data?.adaptive_formats?.slice(0, 3)?.map((f) => ({
          mimeType: f.mime_type,
          quality: f.quality_label || f.quality,
        })) || [];
        // Also include the chosen format in list for convenience.
        formats.unshift({
          mimeType: bestFormat.mime_type,
          quality: bestFormat.quality_label || bestFormat.quality,
          downloadUrl,
        });
      }
    } catch (e) {
      // Non-fatal: we still return success but without downloadUrl.
      console.warn(`Could not decipher format for ${videoId}:`, e?.message);
    }

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      status: "success",
      videoId,
      title,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      downloadUrl,
      streamUrl: `/api/download?id=${encodeURIComponent(videoId)}&download=1`,
      formats,
    });
  } catch (err) {
    console.error(`Failed to fetch download info for ${videoId} via youtubei.js:`, err);
    const msg = err?.message || "Failed to load video.";
    // Distinguish invalid id vs youtube error
    const isNotFound = /not found|unavailable|does not exist/i.test(msg);
    res.status(isNotFound ? 404 : 502).json({
      status: "error",
      message: msg,
    });
  }
}
