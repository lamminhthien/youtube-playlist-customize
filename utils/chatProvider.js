// Chat provider abstraction: local search fallback + Ollama proxy via /api/chat
// Also manages Ollama settings persisted in localStorage.

import { searchCachedVideos, getCachedVideos } from "./videoCache.js";
import { escapeHtml } from "./escapeHtml.js";
import { renderMarkdown } from "./markdown.js";

export const CHAT_API_URL = "/api/chat";
export const OLLAMA_SETTINGS_KEY = "yt-ollama-settings";

export const DEFAULT_OLLAMA_SETTINGS = {
  baseUrl: "", // e.g. http://localhost:11434 or https://ollama.example.com ; empty = use server env
  model: "", // e.g. llama3.1 ; empty = server default
  apiKey: "", // optional bearer for hosted Ollama
  useExternal: true, // allow searching outside local cache (via LLM)
};

export const getOllamaSettings = () => {
  try {
    const raw = localStorage.getItem(OLLAMA_SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_OLLAMA_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_OLLAMA_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_OLLAMA_SETTINGS };
  }
};

export const saveOllamaSettings = (settings) => {
  const merged = { ...DEFAULT_OLLAMA_SETTINGS, ...settings };
  try {
    localStorage.setItem(OLLAMA_SETTINGS_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
};

// Build a compact context string from cached videos for the LLM prompt.
// Keep it small to avoid token blow-up; truncate to ~40 items.
export const buildVideoContext = (limit = 40) => {
  const videos = getCachedVideos();
  if (!videos.length) return "No videos cached yet. User hasn't fetched any playlist or channel.";
  const slice = videos.slice(-limit);
  return slice
    .map((v, i) => `${i + 1}. "${v.title}" | source: ${v.source || "-"} | id: ${v.id} | url: ${v.url} | date: ${v.publishedAt || "-"}`)
    .join("\n");
};

export const formatLocalSearchAnswer = (query, results) => {
  if (!results.length) {
    return `No local matches for "${query}". Try browsing a playlist/channel first so I can cache videos, or enable external search to ask Ollama more broadly.`;
  }
  const lines = results.map((v) => `- <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.title)}</a> <span style="color:#86868b">(${escapeHtml(v.source || "")})</span>`);
  return `Found ${results.length} matching video(s) in your cached library for "${escapeHtml(query)}":<br/><br/>${lines.join("<br/>")}`;
};

// Call the server proxy. Returns { answer, source, error }.
export const callChatApi = async (messages, opts = {}) => {
  const settings = getOllamaSettings();
  const body = {
    messages,
    context: opts.context ?? buildVideoContext(),
    useExternal: opts.useExternal ?? settings.useExternal,
    // per-request overrides (from settings UI) — server will prefer these over env
    baseUrl: settings.baseUrl || undefined,
    model: settings.model || undefined,
    apiKey: settings.apiKey || undefined,
  };

  const res = await fetch(CHAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Chat API error HTTP ${res.status}`);
  }
  return data; // { answer, source, model }
};

// High-level helper used by the UI:
// 1) always runs local search so we can show cached results instantly
// 2) if useExternal is true, also calls Ollama (or falls back to local-only answer on failure)
export const answerQuery = async (query) => {
  const q = (query || "").trim();
  if (!q) throw new Error("Empty query");
  const localResults = searchCachedVideos(q, 8);
  const localAnswer = formatLocalSearchAnswer(q, localResults);

  const settings = getOllamaSettings();
  if (!settings.useExternal) {
    return { answer: localAnswer, source: "local", localResults };
  }

  // Try Ollama via proxy; on failure return local answer with note
  try {
    const messages = [{ role: "user", content: q }];
    const data = await callChatApi(messages, { context: buildVideoContext() });
    // data.answer is markdown from Ollama — render to HTML
    let combined = data.answer || "";
    const rendered = renderMarkdown(combined);
    const ollamaBlock = `<div class="yt-md"><strong>Ollama says:</strong><br/><br/>${rendered}</div>`;
    if (localResults.length) {
      combined = `${localAnswer}<br/><br/><hr style="margin:12px 0;border:none;border-top:1px solid rgba(0,0,0,0.08)"/><br/>${ollamaBlock}`;
    } else {
      combined = rendered;
    }
    return { answer: combined, source: data.source || "ollama", localResults, rawAnswer: data.answer };
  } catch (err) {
    const note = `<br/><br/><span style="color:#ff3b30;font-size:12px">Ollama unavailable: ${escapeHtml(err.message)}. Showing local results only. Configure Ollama in settings (gear icon).</span>`;
    return { answer: localAnswer + note, source: "local-fallback", localResults, error: err.message };
  }
};
