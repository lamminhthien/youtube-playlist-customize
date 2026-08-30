// Vercel serverless function: provides download support for YouTube videos.
// Two modes:
//   - JSON info mode (default): GET /api/download?id=VIDEO_ID
//     Returns { status: "success", title, videoId, formats: [...] , downloadUrl }
//   - Stream mode: GET /api/download?id=VIDEO_ID&download=1
//     Streams the video bytes with Content-Disposition: attachment, proxied
//     through youtubei.js so it works without CORS and with decipher.
//
// The videoId must be exactly 11 characters (YouTube's typical id shape).
import { Innertube, Platform } from "youtubei.js";
import { getQueryParam } from "./_youtube.js";

// youtubei.js requires a JS evaluator for signature decipher (n/sig).
// The default `Platform.shim.eval` throws. Provide a Node-compatible shim
// using the Function constructor as documented in ytjs.dev.
if (typeof Platform.shim.eval === "function" && Platform.shim.eval.toString().includes("must provide")) {
  Platform.shim.eval = async (data, env) => {
    const props = [];
    if (env?.n) props.push(`n: exportedVars.nFunction("${env.n}")`);
    if (env?.sig) props.push(`sig: exportedVars.sigFunction("${env.sig}")`);
    // Fallback generic if neither n nor sig (should not happen)
    if (!props.length) return {};
    const code = `${data.output}\nreturn { ${props.join(", ")} }`;
    return new Function(code)();
  };
}

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

const DOWNLOAD_FORMAT_CANDIDATES = [
  { type: "video+audio", quality: "best", format: "mp4" },
  { type: "video+audio", quality: "best" },
  { type: "video+audio", quality: "bestefficiency", format: "mp4" },
  { type: "video+audio", quality: "bestefficiency" },
  { type: "video", quality: "best", format: "mp4" },
  { type: "video", quality: "best" },
  { type: "audio", quality: "best", format: "mp4" },
  { type: "audio", quality: "best" },
];

const getMimeContentType = (mime) => {
  if (!mime) return "video/mp4";
  return mime.split(";")[0].trim() || "video/mp4";
};

const getExtensionForMime = (mime) => {
  const base = getMimeContentType(mime);
  if (base.includes("webm")) return "webm";
  if (base.includes("mp4")) return "mp4";
  if (base.includes("audio")) return base.includes("webm") ? "webm" : "m4a";
  return "mp4";
};

const tryChooseBestFormat = (info) => {
  for (const opts of DOWNLOAD_FORMAT_CANDIDATES) {
    try {
      const fmt = info.chooseFormat(opts);
      if (fmt) return { format: fmt, options: opts };
    } catch {
      // try next candidate
    }
  }
  return null;
};

const tryDownloadWithFallback = async (info) => {
  let lastErr;
  for (const opts of DOWNLOAD_FORMAT_CANDIDATES) {
    try {
      // Quick check: does chooseFormat succeed for these opts?
      // If not, skip download attempt to avoid unnecessary error noise.
      try {
        info.chooseFormat(opts);
      } catch (chooseErr) {
        // Only skip if it's the classic No matching formats error; otherwise still try download
        if (/No matching formats found/i.test(chooseErr?.message || "")) {
          lastErr = chooseErr;
          continue;
        }
      }
      const stream = await info.download(opts);
      const format = info.chooseFormat(opts);
      return { stream, format, options: opts };
    } catch (e) {
      lastErr = e;
      if (!/No matching formats found|No valid URL to decipher|must provide your own JavaScript evaluator/i.test(e?.message || "")) {
        // For non-format errors (e.g. UNPLAYABLE, FETCH_FAILED) don't continue silently - break
        // but still allow fallback for FETCH_FAILED? Keep trying next candidate for robustness
        if (/UNPLAYABLE|LOGIN_REQUIRED|Streaming data not available/i.test(e?.message || "")) throw e;
      }
    }
  }
  throw lastErr || new Error("No matching formats found");
};

const hasUsableStreamingData = (info) => {
  const sd = info?.streaming_data;
  if (!sd) return false;
  const all = [...(sd.formats || []), ...(sd.adaptive_formats || [])];
  // SABR-only responses have no url/cipher at all
  return all.some((f) => f.url || f.cipher || f.signature_cipher);
};

const fetchInfoWithFallback = async (videoId, primaryYt) => {
  let primaryInfo;
  try {
    primaryInfo = await primaryYt.getInfo(videoId);
    if (hasUsableStreamingData(primaryInfo)) {
      return { info: primaryInfo, yt: primaryYt };
    }
    console.warn(`Primary WEB client returned SABR-only data for ${videoId} (no decipherable URLs), trying fallback clients`);
  } catch (e) {
    // Remember error to rethrow if fallbacks also fail
    primaryInfo = null;
    const msg = e?.message || "";
    const isFallbackWorthy = /No valid URL|No matching formats|must provide.*evaluator|SABR|Streaming data not available/i.test(msg) || !hasUsableStreamingData(primaryInfo);
    if (!isFallbackWorthy) throw e;
    console.warn(`Primary client failed for ${videoId}: ${msg} — trying fallback clients`);
  }

  // Fallback: try MWEB/IOS/Android via getBasicInfo — these are often exempt from forced SABR
  // MWEB is prioritized because it often still has a muxed (video+audio) progressive
  // format (itag 18 360p) that can be downloaded in a single request, avoiding
  // the chunked 403 issues seen with high-res adaptive streams.
  const { ClientType } = await import("youtubei.js");
  const fallbackClients = [
    ClientType.MWEB,
    ClientType.IOS,
    ClientType.ANDROID,
    ClientType.TV,
  ];
  let lastErr;
  for (const clientType of fallbackClients) {
    try {
      const fallbackYt = await Innertube.create({
        ...DOWNLOAD_INNERTUBE_OPTIONS,
        client_type: clientType,
      });
      // getBasicInfo avoids the broken `next` parser that causes "Cannot read properties of null (reading 'as')"
      const info = await fallbackYt.getBasicInfo(videoId);
      if (hasUsableStreamingData(info)) {
        console.log(`Fallback client ${clientType} succeeded for ${videoId}`);
        return { info, yt: fallbackYt };
      }
      lastErr = new Error(`Fallback ${clientType} returned no usable URLs`);
    } catch (e) {
      lastErr = e;
      console.warn(`Fallback client ${clientType} failed for ${videoId}: ${e?.message}`);
    }
  }
  // If all fallbacks failed but we had a primaryInfo (even SABR-only), return it as last resort so at least metadata can be returned
  if (primaryInfo) return { info: primaryInfo, yt: primaryYt };
  throw lastErr || new Error("No matching formats found");
};

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
    const primaryYt = await getDownloadInnertube();
    const { info, yt } = await fetchInfoWithFallback(videoId, primaryYt);

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
      // YouTube often has no muxed (video+audio) mp4 for many videos — only
      // adaptive video-only / audio-only streams. Fall back gracefully.
      const { stream, format } = await tryDownloadWithFallback(info);

      const mimeType = format?.mime_type || "video/mp4";
      const ext = getExtensionForMime(mimeType);
      const filename = `${sanitizeFilename(title)}.${ext}`;

      res.setHeader("Content-Type", getMimeContentType(mimeType));
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
      const chosen = tryChooseBestFormat(info);
      if (chosen?.format) {
        const bestFormat = chosen.format;
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
