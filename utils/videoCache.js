// Video cache persisted in localStorage for chatbot / local search.
// Fetched playlist/channel payloads are merged into a deduplicated store so the
// chatbot can answer questions even after navigation or reload.

export const VIDEO_CACHE_KEY = "yt-video-cache";
export const VIDEO_CACHE_LIMIT = 2000;

// Normalize a raw video item into cache shape.
export const normalizeVideoForCache = (item, sourceName = "") => {
  if (!item || typeof item !== "object") return null;
  const id = item.id || "";
  const title = (item.title || "").trim();
  const url = item.url || (id ? `https://www.youtube.com/watch?v=${id}` : "");
  if (!id && !title) return null;
  return {
    id: id || url || title,
    title: title || "Untitled",
    url,
    thumbnail: item.thumbnail || "",
    publishedAt: item.publishedAt || "",
    source: sourceName || "",
  };
};

export const getCachedVideos = () => {
  try {
    const raw = localStorage.getItem(VIDEO_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Merge new videos into cache, deduplicated by id+url, capped at limit (oldest evicted).
export const saveVideosToCache = (videos, sourceName = "") => {
  if (!Array.isArray(videos) || !videos.length) return getCachedVideos();
  const normalized = videos.map((v) => normalizeVideoForCache(v, sourceName)).filter(Boolean);
  if (!normalized.length) return getCachedVideos();

  const existing = getCachedVideos();
  const seen = new Set(existing.map((v) => v.id || v.url));
  const merged = [...existing];
  for (const v of normalized) {
    const key = v.id || v.url;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(v);
    } else {
      // update existing entry's title/thumbnail if changed
      const idx = merged.findIndex((e) => (e.id || e.url) === key);
      if (idx !== -1) merged[idx] = { ...merged[idx], ...v };
    }
  }
  const sliced = merged.slice(-VIDEO_CACHE_LIMIT);
  try {
    localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(sliced));
  } catch {
    // quota exceeded or localStorage unavailable — best effort, keep in-memory fallback
  }
  return sliced;
};

export const clearVideoCache = () => {
  try {
    localStorage.removeItem(VIDEO_CACHE_KEY);
  } catch {}
};

/**
 * Simple local keyword search over cached videos.
 * Tokenizes query, scores by title coverage, returns top N matches.
 */
export const searchCachedVideos = (query, limit = 8) => {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);
  const videos = getCachedVideos();
  if (!videos.length) return [];

  const scored = videos
    .map((v) => {
      const titleLower = (v.title || "").toLowerCase();
      const sourceLower = (v.source || "").toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (titleLower.includes(tok)) score += 2;
        if (sourceLower.includes(tok)) score += 1;
      }
      // exact phrase boost
      if (titleLower.includes(q)) score += 3;
      return { video: v, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.video);

  return scored;
};

// For tests: inject raw array without touching localStorage quoting edge cases
export const _setCachedVideosForTest = (videos) => {
  try {
    localStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(videos));
  } catch {}
};
