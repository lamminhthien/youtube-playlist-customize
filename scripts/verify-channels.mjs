#!/usr/bin/env node
/**
 * Verifies every channel and playlist configured in constants/ can actually
 * be resolved/fetched via youtubei.js before deploying, and that channels
 * return at least one video. Fails the build (non-zero exit code) if any
 * source errors out or comes back empty.
 *
 * Usage: node scripts/verify-channels.mjs
 */

import { Innertube } from "youtubei.js";
import { resolveChannelId, collectVideos } from "../api/_youtube.js";
import { CHANNEL_ID } from "../constants/channels.js";
import { PLAY_LIST_ID } from "../constants/playlist.js";

const verifyChannel = async (yt, name, idOrHandle) => {
  const channelId = await resolveChannelId(yt, idOrHandle);
  let channel = await yt.getChannel(channelId);
  if (channel.has_videos) {
    channel = await channel.getVideos();
  }

  const items = [];
  collectVideos(channel, items);
  if (!items.length) {
    throw new Error("Resolved channel has no videos");
  }
  return items.length;
};

const verifyPlaylist = async (yt, name, playlistId) => {
  const playlist = await yt.getPlaylist(playlistId);
  const items = [];
  collectVideos(playlist, items);
  if (!items.length) {
    throw new Error("Resolved playlist has no videos");
  }
  return items.length;
};

const run = async () => {
  const yt = await Innertube.create({
    generate_session_locally: true,
    retrieve_player: false,
  });

  const checks = [
    ...Object.entries(CHANNEL_ID).map(([name, idOrHandle]) => ({
      kind: "channel",
      name,
      value: idOrHandle,
      run: () => verifyChannel(yt, name, idOrHandle),
    })),
    ...Object.entries(PLAY_LIST_ID).map(([name, playlistId]) => ({
      kind: "playlist",
      name,
      value: playlistId,
      run: () => verifyPlaylist(yt, name, playlistId),
    })),
  ];

  const failures = [];
  for (const check of checks) {
    process.stdout.write(`[verify-channels] Checking ${check.kind} "${check.name}" (${check.value})... `);
    try {
      const videoCount = await check.run();
      console.log(`OK (${videoCount} videos)`);
    } catch (err) {
      console.log("FAILED");
      failures.push({ ...check, error: err?.message || String(err) });
    }
  }

  if (failures.length) {
    console.error("\n[verify-channels] ❌ The following sources failed to resolve/fetch:");
    for (const failure of failures) {
      console.error(`  - ${failure.kind} "${failure.name}" (${failure.value}): ${failure.error}`);
    }
    process.exit(1);
  }

  console.log("\n[verify-channels] ✅ All channels and playlists resolved successfully.");
};

run().catch((err) => {
  console.error("[verify-channels] Unexpected error:", err);
  process.exit(1);
});

