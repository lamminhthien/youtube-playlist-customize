import { searchWeb, formatWebContext } from "./_search.js";

// Vercel serverless function: proxies chat requests to Ollama with optional live web search.
// Supports:
//  - Local Ollama:   OLLAMA_BASE_URL=http://localhost:11434 (or any host)
//  - Ollama Cloud:   OLLAMA_BASE_URL=https://ollama.com (+ OLLAMA_API_KEY)
//    Cloud API base is https://ollama.com/api — we normalize both forms.
//  - Web search:     Free DuckDuckGo + Wikipedia (no key). Optional Tavily/Brave if TAVILY_API_KEY/BRAVE_API_KEY set.
// Env vars: OLLAMA_BASE_URL, OLLAMA_MODEL, OLLAMA_API_KEY, TAVILY_API_KEY, BRAVE_API_KEY, WEB_SEARCH_ENABLED
// Request body: { messages: [{role, content}], context: string, useExternal: bool, useWebSearch?: bool, baseUrl?, model?, apiKey? }

const buildPrompt = (messages, context, useExternal, webContext = "") => {
  const userQuery = messages?.[messages.length - 1]?.content || "";
  const contextBlock = context ? `Cached video library (from user's playlists/channels):\n${context}\n` : "";
  const webBlock = webContext ? `\n${webContext}\n` : "";
  const system = useExternal
    ? `You are a helpful assistant for a YouTube playlist app. You have access to the user's cached video library below and live web search results when available. Answer helpfully. If the question is about videos, prioritize matching titles from the cached library and include video URLs when relevant. If web search results are provided, use them to give up-to-date answers and cite sources with [1], [2] etc. If the question is outside the library and no web results, answer from general knowledge but mention that it's outside their cached library. Keep answers concise and friendly.`
    : `You are a helpful assistant for a YouTube playlist app. You ONLY know about the user's cached video library below. If the question cannot be answered from the cached library, say you don't have that information in the local cache and suggest opening relevant playlists/channels. Do not hallucinate videos.`;

  return { system, userQuery, contextBlock, webBlock };
};

const toOllamaChatUrl = (baseUrl) => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  // Allow both host form (https://ollama.com) and full API base (https://ollama.com/api)
  if (trimmed.endsWith("/api")) return `${trimmed}/chat`;
  return `${trimmed}/api/chat`;
};

const callOllama = async ({ baseUrl, model, apiKey, messages, context, useExternal, webContext }) => {
  const url = toOllamaChatUrl(baseUrl);
  const { system, userQuery, contextBlock, webBlock } = buildPrompt(messages, context, useExternal, webContext);

  const systemContent = `${system}\n\n${contextBlock}${webBlock}`;

  const ollamaMessages = [
    { role: "system", content: systemContent },
    // include prior conversation if provided (excluding last which we already use)
    ...messages.slice(0, -1).filter((m) => m.role === "user" || m.role === "assistant"),
    { role: "user", content: userQuery },
  ];

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  // Resolve model: explicit arg > env > cloud-default vs local-default
  const effectiveKeyForModel = (apiKey || process.env.OLLAMA_API_KEY || "").trim();
  const fallbackModel = effectiveKeyForModel ? "gpt-oss:20b" : "llama3.1";
  const effectiveModel = (model || process.env.OLLAMA_MODEL || fallbackModel).trim();

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: effectiveModel,
      messages: ollamaMessages,
      stream: false,
      options: { temperature: 0.7 },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  // Ollama /api/chat returns { message: { content }, done: true, ... }
  // Some deployments return { response } for /api/generate
  const answer = data?.message?.content || data?.response || "";
  if (!answer) throw new Error("Empty response from Ollama");
  return answer;
};

// Fallback: generate a local-only answer when Ollama is not configured
// If webResults are available, include them even without Ollama.
const localFallbackAnswer = (messages, context, webResults = null) => {
  const q = messages?.[messages.length - 1]?.content || "";
  // Simple heuristic: mention context snippet
  const snippet = context ? context.split("\n").slice(0, 5).join("\n") : "No cached videos.";

  let webSection = "";
  if (webResults?.results?.length) {
    const webLines = webResults.results.map((r, i) => `[${i + 1}] ${r.title} — ${r.snippet} (${r.url})`).join("\n");
    webSection = `\n\nLive web results (via ${webResults.provider}):\n${webLines}`;
  }

  const ollamaHint = `Ollama is not configured (set OLLAMA_BASE_URL + OLLAMA_API_KEY env for Ollama Cloud at https://ollama.com, or configure in chat settings). Here's what I found locally for "${q}":\n\n${snippet}${webSection}\n\nTip: Open a playlist/channel to cache more videos.\n- For Ollama Cloud: create an API key at https://ollama.com/settings/keys, set OLLAMA_API_KEY and OLLAMA_BASE_URL=https://ollama.com (model e.g. gpt-oss:20b or gpt-oss:120b)\n- For local Ollama: set OLLAMA_BASE_URL=http://localhost:11434 and model llama3.1`;

  // If we have web results but no Ollama, synthesize a helpful answer from web snippets alone
  if (webResults?.results?.length) {
    const top = webResults.results.slice(0, 3).map((r, i) => `- [${r.title}](${r.url}): ${r.snippet}`).join("\n");
    return `${ollamaHint}\n\n---\nWeb summary for "${q}" (without LLM):\n${top}\n\nConfigure Ollama for a synthesized answer.`;
  }

  return ollamaHint;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { messages, context, useExternal, useWebSearch, baseUrl, model, apiKey } = req.body || {};

  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ success: false, message: "messages array is required" });
  }

  const wantExternal = useExternal !== false;
  const wantWebSearch = useWebSearch !== false && wantExternal && (process.env.WEB_SEARCH_ENABLED || "").toLowerCase() !== "false";
  const effectiveKey = (apiKey || process.env.OLLAMA_API_KEY || "").trim();
  // Cloud default: if API key is set but no baseUrl, assume https://ollama.com
  const rawBase = (baseUrl || process.env.OLLAMA_BASE_URL || (effectiveKey ? "https://ollama.com" : "")).trim();
  const effectiveBaseUrl = rawBase;
  const fallbackModel = effectiveKey ? "gpt-oss:20b" : "llama3.1";
  const effectiveModel = (model || process.env.OLLAMA_MODEL || fallbackModel).trim();

  const userQuery = messages?.[messages.length - 1]?.content || "";

  // Fetch live web results in parallel when external is allowed
  let webResults = null;
  let webContext = "";
  if (wantWebSearch && userQuery.trim()) {
    try {
      webResults = await searchWeb(userQuery, { limit: 5 });
      if (webResults?.results?.length) {
        webContext = formatWebContext(webResults.results, webResults.provider);
      }
    } catch (e) {
      console.warn("Web search failed:", e?.message || e);
    }
  }

  // If external search not wanted, or no Ollama configured, return local + web fallback
  if (!wantExternal || !effectiveBaseUrl) {
    const answer = localFallbackAnswer(messages, context, webResults);
    return res.status(200).json({
      success: true,
      answer,
      source: !effectiveBaseUrl ? (webResults?.results?.length ? "web-local-no-ollama" : "local-no-ollama") : "local",
      model: null,
      webResults: webResults?.results || [],
      webProvider: webResults?.provider || "none",
    });
  }

  try {
    const answer = await callOllama({
      baseUrl: effectiveBaseUrl,
      model: effectiveModel,
      apiKey: effectiveKey,
      messages,
      context,
      useExternal: wantExternal,
      webContext,
    });
    return res.status(200).json({
      success: true,
      answer,
      source: webResults?.results?.length ? "ollama+web" : "ollama",
      model: effectiveModel,
      webResults: webResults?.results || [],
      webProvider: webResults?.provider || "none",
    });
  } catch (err) {
    console.error("Ollama call failed:", err);
    // Return 200 with local fallback so the UI can still show something, but include error hint
    const fallback = localFallbackAnswer(messages, context, webResults);
    return res.status(200).json({
      success: true,
      answer: `${fallback}\n\n(Ollama error: ${err.message})`,
      source: "local-fallback",
      model: effectiveModel,
      ollamaError: err.message,
      webResults: webResults?.results || [],
      webProvider: webResults?.provider || "none",
    });
  }
}

// For unit tests
export const _testExports = { buildPrompt, callOllama, localFallbackAnswer, toOllamaChatUrl, formatWebContext };
