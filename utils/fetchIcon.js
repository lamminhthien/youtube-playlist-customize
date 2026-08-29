import { ICON_API_URL } from "../constants/config.js";

/**
 * Fetch just a channel avatar or playlist thumbnail via api/icon.js.
 * Resolves to an empty string (never throws) so callers can fall back to a
 * placeholder icon on any failure.
 *
 * @param {"channel"|"playlist"} type
 * @param {string} id - channel handle/UC id, or playlist id
 * @returns {Promise<string>}
 */
export const fetchIcon = async (type, id) => {
  try {
    const params = new URLSearchParams({ type, id });
    const response = await fetch(`${ICON_API_URL}?${params.toString()}`, {
      method: "GET",
      redirect: "follow",
    });
    if (!response.ok) return "";

    const payload = await response.json();
    if (!payload || payload.status !== "success") return "";
    return payload.icon || "";
  } catch {
    return "";
  }
};
