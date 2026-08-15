#!/usr/bin/env node
/**
 * Injects a timestamp-based version into sw.js CACHE_NAME before deploy.
 * Replaces any existing `playlist-hub-v<anything>` with `playlist-hub-v<timestamp>`.
 *
 * Usage: node scripts/bump-cache-version.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = join(__dirname, "..", "sw.js");

const timestamp = new Date()
  .toISOString()
  .replace(/[-:T]/g, "")
  .slice(0, 12); // e.g. "202608151243"

const newCacheName = `playlist-hub-v${timestamp}`;
const src = readFileSync(swPath, "utf8");
const updated = src.replace(
  /const CACHE_NAME = "playlist-hub-v[^"]*";/,
  `const CACHE_NAME = "${newCacheName}";`
);

if (src === updated) {
  console.warn("[bump-cache] ⚠️  CACHE_NAME pattern not found — nothing changed.");
  process.exit(1);
}

writeFileSync(swPath, updated, "utf8");
console.log(`[bump-cache] ✅  CACHE_NAME set to "${newCacheName}"`);
