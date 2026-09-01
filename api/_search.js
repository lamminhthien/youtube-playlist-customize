// Free web search module - no API key required.
// Tries DuckDuckGo HTML scraping first (general web), falls back to Wikipedia API.
// Also supports optional Tavily/Brave if keys are set (auto-detected).

const DEFAULT_TIMEOUT = 6000;
const MAX_RESULTS = 5;

const stripHtml = (html) => {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
};

const fetchWithTimeout = async (url, opts = {}, timeoutMs = DEFAULT_TIMEOUT) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
};

// Tavily - if TAVILY_API_KEY set
const searchTavily = async (query, limit, timeoutMs) => {
  const key = (process.env.TAVILY_API_KEY || "").trim();
  if (!key) return null;
  try {
    const res = await fetchWithTimeout(
      "https://api.tavily.com/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: "basic",
          include_answer: false,
          max_results: limit,
        }),
      },
      timeoutMs
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = (data.results || []).slice(0, limit).map((r) => ({
      title: stripHtml(r.title || ""),
      url: r.url || "",
      snippet: stripHtml(r.content || "").slice(0, 300),
    })).filter((r) => r.title && r.url);
    if (!results.length) return null;
    return { results, provider: "tavily" };
  } catch {
    return null;
  }
};

// Brave Search API - if BRAVE_API_KEY set
const searchBrave = async (query, limit, timeoutMs) => {
  const key = (process.env.BRAVE_API_KEY || "").trim();
  if (!key) return null;
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { Accept: "application/json", "X-Subscription-Token": key } },
      timeoutMs
    );
    if (!res.ok) return null;
    const data = await res.json();
    const web = data.web?.results || data.results || [];
    const results = web.slice(0, limit).map((r) => ({
      title: stripHtml(r.title || ""),
      url: r.url || "",
      snippet: stripHtml(r.description || "").slice(0, 300),
    })).filter((r) => r.title && r.url);
    if (!results.length) return null;
    return { results, provider: "brave" };
  } catch {
    return null;
  }
};

// DuckDuckGo HTML scraping - free, no key
const searchDuckDuckGo = async (query, limit, timeoutMs) => {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      timeoutMs
    );
    if (!res.ok) return null;
    const html = await res.text();

    // Parse result blocks: each result has result__a (title+url) and result__snippet
    // Use a combined regex that pairs title and snippet across the HTML, since splitting on divs breaks them apart.
    const results = [];
    const pairRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = pairRe.exec(html)) && results.length < limit) {
      let href = m[1] || "";
      let title = stripHtml(m[2] || "");
      let snippet = stripHtml(m[3] || "");
      // DuckDuckGo wraps URLs like //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com...
      if (href.includes("uddg=")) {
        try {
          const u = new URL(href, "https://duckduckgo.com");
          const real = u.searchParams.get("uddg");
          if (real) href = decodeURIComponent(real);
        } catch {}
      }
      if (href.startsWith("//")) href = "https:" + href;
      if (!title || !href || href.startsWith("/") || href.includes("duckduckgo.com")) continue;
      if (!href.startsWith("http")) continue;
      results.push({ title: title.slice(0, 150), url: href, snippet: snippet.slice(0, 300) });
    }

    if (!results.length) return null;
    return { results: results.slice(0, limit), provider: "duckduckgo" };
  } catch {
    return null;
  }
};

// Wikipedia OpenSearch - free, no key, good fallback
const searchWikipedia = async (query, limit, timeoutMs) => {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=${limit}&srprop=snippet`;
    const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, timeoutMs);
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data?.query?.search || [];
    const results = hits.slice(0, limit).map((h) => ({
      title: stripHtml(h.title || ""),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent((h.title || "").replace(/ /g, "_"))}`,
      snippet: stripHtml(h.snippet || "").slice(0, 300),
    })).filter((r) => r.title && r.url);
    if (!results.length) return null;
    return { results, provider: "wikipedia" };
  } catch {
    return null;
  }
};

export const searchWeb = async (query, opts = {}) => {
  const q = (query || "").trim();
  if (!q) return { results: [], provider: "none" };
  const limit = Math.min(Math.max(opts.limit || MAX_RESULTS, 1), 10);
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT;

  // Check if web search is explicitly disabled
  if ((process.env.WEB_SEARCH_ENABLED || "").toLowerCase() === "false") {
    return { results: [], provider: "disabled" };
  }

  // Try paid APIs first if keys exist (best quality)
  const tavily = await searchTavily(q, limit, timeoutMs);
  if (tavily) return tavily;

  const brave = await searchBrave(q, limit, timeoutMs);
  if (brave) return brave;

  // Free providers: DuckDuckGo HTML (general web) first
  const ddg = await searchDuckDuckGo(q, limit, timeoutMs);
  if (ddg && ddg.results.length) return ddg;

  // Fallback to Wikipedia
  const wiki = await searchWikipedia(q, limit, timeoutMs);
  if (wiki) return wiki;

  return { results: [], provider: "none" };
};

export const formatWebContext = (results, provider = "") => {
  if (!results || !results.length) return "";
  const header = provider
    ? `Live web search results (via ${provider}, ${results.length} hits):`
    : `Live web search results (${results.length} hits):`;
  const lines = results.map((r, i) => {
    const idx = i + 1;
    return `[${idx}] "${r.title}" — ${r.snippet || "no snippet"} | URL: ${r.url}`;
  });
  return `${header}\n${lines.join("\n")}\n\nInstructions: Use these search results to answer the user's query accurately. Cite sources with [1], [2] etc. If results are irrelevant, say so and answer from general knowledge.`;
};

// For tests
export const _testExports = { stripHtml, searchTavily, searchBrave, searchDuckDuckGo, searchWikipedia };
