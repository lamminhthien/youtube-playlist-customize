import { PLAY_LIST_ID } from "./playlist.constant.js";
import { fetchPlaylist, renderPlaylist, renderError, renderTabs } from "./utils/index.js";

const container = document.getElementById("playlists-container");
const entries = Object.entries(PLAY_LIST_ID);

Promise.allSettled(entries.map(fetchPlaylist)).then((results) => {
  container.innerHTML = "";

  const tabs = results.map((result, index) => {
    const [name] = entries[index];
    const element =
      result.status === "fulfilled"
        ? renderPlaylist(result.value)
        : renderError(name, result.reason);
    return { name, element };
  });

  renderTabs(container)(tabs);
});
