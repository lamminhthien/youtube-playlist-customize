// Vercel serverless function: fetches a YouTube channel's recent uploads
// directly from YouTube's InnerTube API via youtubei.js. Accepts a required
// `?id=` query parameter — either an `@handle` or a `UC...` channel id.
import { getInnertube, collectVideos, resolveChannelId, MAX_CONTINUATION_PAGES } from "./_youtube.js";

export default async function handler(req, res) {
  const channelHandle =
    req.query?.id ??
    new URL(req.url, `http://${req.headers.host || "localhost"}`).searchParams.get("id");

  if (!channelHandle || typeof channelHandle !== "string") {
    res.status(400).json({
      status: "error",
      message: "Missing required 'id' query parameter.",
    });
    return;
  }

  try {
    const yt = await getInnertube();
    const channelId = await resolveChannelId(yt, channelHandle);

    let channel = await yt.getChannel(channelId);
    const title =
      channel.metadata?.title ||
      channel.header?.author?.name ||
      channelHandle;

    if (channel.has_videos) {
      channel = await channel.getVideos();
    }

    const items = [];
    collectVideos(channel, items);

    let guard = 0;
    while (channel.has_continuation && guard < MAX_CONTINUATION_PAGES) {
      channel = await channel.getContinuation();
      collectVideos(channel, items);
      guard += 1;
    }

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
    console.error(`Failed to fetch channel ${channelHandle} via youtubei.js:`, err);
    res.status(502).json({
      status: "error",
      message: err?.message || "Failed to load channel videos.",
    });
  }
}
