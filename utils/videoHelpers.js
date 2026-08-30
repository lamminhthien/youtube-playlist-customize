export const formatDate = (input) => {
  if (!input) return "";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const videoIdFromUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return u.pathname.slice(1).split("/")[0].split("?")[0] || "";
    }
    return u.searchParams.get("v") || "";
  } catch {
    return "";
  }
};

export const thumbnailFor = (item) =>
  item.thumbnail ||
  (videoIdFromUrl(item.url) &&
    `https://i.ytimg.com/vi/${videoIdFromUrl(item.url)}/hqdefault.jpg`);

export const videoIdOf = (item) => item?.id || videoIdFromUrl(item?.url);
