import { PLAY_LIST_ID } from "./constants/playlist.js";
import { CHANNEL_ID } from "./constants/channels.js";
import {
  fetchPlaylist,
  fetchChannel,
  renderPlaylist,
  renderError,
  renderTabs,
  renderSkeleton,
} from "./utils/index.js";

// Each entry tab gets:
//   - `element`: an immediate skeleton placeholder (visible in the active tab).
//   - `load`: a lazy fetcher triggered the first time the tab is activated.
//             Cached after first run via the `_loaded` flag inside renderTabs.
const buildEntryTabs = (entries, fetcher) =>
  entries.map(([name, id]) => ({
    name,
    element: renderSkeleton(),
    load: async () => {
      try {
        const data = await fetcher([name, id]);
        return renderPlaylist(data);
      } catch (err) {
        return renderError(name, err);
      }
    },
  }));

// Top-level "Channels" / "Custom Playlist" tabs. Each is itself lazily
// loaded — its nested tab bar (and the first entry's data) is only built the
// first time the section is activated, so both sections never render at once.
const buildSection = (name, entries, fetcher) => ({
  name,
  load: async () => {
    const wrapper = document.createElement("div");
    renderTabs(wrapper)(buildEntryTabs(entries, fetcher));
    return wrapper;
  },
});

const container = document.getElementById("app-container");
container.innerHTML = "";
renderTabs(container)([
  buildSection("Channels", Object.entries(CHANNEL_ID), fetchChannel),
  buildSection("Custom Playlist", Object.entries(PLAY_LIST_ID), fetchPlaylist),
]);


