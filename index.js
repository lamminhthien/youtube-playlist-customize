import { PLAY_LIST_ID } from "./constants/playlist.js";
import {
  fetchPlaylist,
  renderPlaylist,
  renderError,
  renderTabs,
  renderSkeleton,
} from "./utils/index.js";

const container = document.getElementById("playlists-container");
const entries = Object.entries(PLAY_LIST_ID);

// Each tab gets:
//   - `element`: an immediate skeleton placeholder (visible in the active tab).
//   - `load`: a lazy fetcher triggered the first time the tab is activated.
//             Cached after first run via the `_loaded` flag inside renderTabs.
const buildLoader = ([name, playlistId]) => async () => {
  try {
    const data = await fetchPlaylist([name, playlistId]);
    return renderPlaylist(data);
  } catch (err) {
    return renderError(name, err);
  }
};

const tabs = entries.map(([name, playlistId]) => ({
  name,
  element: renderSkeleton(),
  load: buildLoader([name, playlistId]),
}));

container.innerHTML = "";
renderTabs(container)(tabs);
