import { thumbnailFor, videoIdOf } from "./videoHelpers.js";

const WATCHED_STORAGE_KEY = "yt-watched-videos";
const HISTORY_LIMIT = 50;

// Entries are stored oldest-to-newest so the most recently watched video is always last.
export const getWatchedVideos = () => {
  try {
    const raw = localStorage.getItem(WATCHED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const markVideoWatched = (item) => {
  const videoId = videoIdOf(item);
  if (!videoId) return;
  try {
    const entry = {
      id: videoId,
      title: item.title || "",
      url: item.url || `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: thumbnailFor(item),
      watchedAt: Date.now(),
    };
    const watched = getWatchedVideos().filter((it) => it.id !== videoId);
    watched.push(entry);
    localStorage.setItem(WATCHED_STORAGE_KEY, JSON.stringify(watched.slice(-HISTORY_LIMIT)));
  } catch {
    // localStorage unavailable (e.g. private mode quota) — skip persisting.
  }
};
