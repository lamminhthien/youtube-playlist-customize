import { PLAY_LIST_ID } from "./playlist.constant.js";
import { fetchPlaylist, renderPlaylist, renderError } from "./utils/index.js";

const container = document.getElementById("playlists-container");
container.innerHTML = "";

const entries = Object.entries(PLAY_LIST_ID);

const handleSuccess = renderPlaylist(container);
const handleError = renderError(container);

Promise.allSettled(entries.map(fetchPlaylist)).then((results) => {
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      handleSuccess(result.value);
    } else {
      handleError(entries[index][0], result.reason);
    }
  });
});
