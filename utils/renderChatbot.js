import { escapeHtml } from "./escapeHtml.js";
import { getCachedVideos } from "./videoCache.js";
import { getOllamaSettings, saveOllamaSettings, answerQuery } from "./chatProvider.js";

const CHAT_HISTORY_KEY = "yt-chat-history";
const MAX_HISTORY = 50;

const loadHistory = () => {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHistory = (history) => {
  try {
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
  } catch {}
};

export const renderChatbot = () => {
  const wrapper = document.createElement("div");
  wrapper.className = "yt-chatbot";
  wrapper.setAttribute("aria-live", "polite");

  wrapper.innerHTML = `
    <button type="button" class="yt-chatbot-fab" aria-label="Open AI chat" title="Ask about your videos (AI)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="yt-chatbot-fab-icon">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none"/>
        <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/>
      </svg>
      <span class="yt-chatbot-fab-label">AI Chat</span>
    </button>

    <div class="yt-chatbot-panel hidden" role="dialog" aria-modal="false" aria-label="AI Chatbot">
      <div class="yt-chatbot-header">
        <div class="yt-chatbot-header-title">
          <span class="yt-chatbot-dot" aria-hidden="true"></span>
          <strong>Playlist AI</strong>
          <span class="yt-chatbot-sub">Ask about cached videos · Ollama + Web</span>
        </div>
        <div class="yt-chatbot-header-actions">
          <button type="button" class="yt-chatbot-icon-btn" data-action="settings" aria-label="Chat settings" title="Ollama settings">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button type="button" class="yt-chatbot-icon-btn" data-action="close" aria-label="Close chat">×</button>
        </div>
      </div>

      <div class="yt-chatbot-settings hidden" data-settings>
        <div class="yt-chatbot-settings-row">
          <label class="yt-chatbot-label" for="yt-ollama-base">Ollama Base URL</label>
          <input id="yt-ollama-base" class="yt-form-input yt-chatbot-input" placeholder="https://ollama.com (cloud) or http://localhost:11434 (local) — empty = server env" autocomplete="off" />
          <span class="yt-form-hint">Cloud: <code>https://ollama.com</code> + API key. Local: <code>http://localhost:11434</code>. Empty = uses server env (Vercel).</span>
        </div>
        <div class="yt-chatbot-settings-row">
          <label class="yt-chatbot-label" for="yt-ollama-model">Model</label>
          <input id="yt-ollama-model" class="yt-form-input yt-chatbot-input" placeholder="gpt-oss:20b (cloud) or llama3.1 (local) — empty = server default" autocomplete="off" />
        </div>
        <div class="yt-chatbot-settings-row">
          <label class="yt-chatbot-label" for="yt-ollama-key">API Key (Ollama Cloud)</label>
          <input id="yt-ollama-key" type="password" class="yt-form-input yt-chatbot-input" placeholder="Create at https://ollama.com/settings/keys" autocomplete="off" />
          <span class="yt-form-hint">Required for <a href="https://ollama.com/settings/keys" target="_blank" rel="noopener">Ollama Cloud</a>. Leave empty for local Ollama.</span>
        </div>
        <label class="yt-chatbot-toggle">
          <input type="checkbox" data-external-toggle />
          <span>Allow external search (ask Ollama beyond cached videos)</span>
        </label>
        <label class="yt-chatbot-toggle">
          <input type="checkbox" data-web-toggle />
          <span>Enable live web search (free DuckDuckGo / Wikipedia)</span>
        </label>
        <div class="yt-chatbot-settings-actions">
          <button type="button" class="yt-btn yt-btn-primary" data-action="save-settings">Save</button>
          <span class="yt-chatbot-settings-hint" data-settings-hint></span>
        </div>
        <div class="yt-chatbot-cache-info" data-cache-info></div>
      </div>

      <div class="yt-chatbot-messages" data-messages role="log" aria-live="polite"></div>

      <form class="yt-chatbot-form" data-form>
        <input type="text" class="yt-chatbot-textinput" data-input placeholder="Ask about your videos… (e.g. 'find  lofi videos')" autocomplete="off" maxlength="500" />
        <button type="submit" class="yt-btn yt-btn-primary yt-chatbot-send" aria-label="Send">➤</button>
      </form>
      <div class="yt-chatbot-footer">Cached <span data-cache-count>0</span> videos · <button type="button" class="yt-chatbot-link" data-action="clear-cache">clear</button> · <button type="button" class="yt-chatbot-link" data-action="clear-chat">clear chat</button></div>
    </div>
  `;

  const fab = wrapper.querySelector(".yt-chatbot-fab");
  const panel = wrapper.querySelector(".yt-chatbot-panel");
  const messagesEl = wrapper.querySelector("[data-messages]");
  const form = wrapper.querySelector("[data-form]");
  const input = wrapper.querySelector("[data-input]");
  const settingsEl = wrapper.querySelector("[data-settings]");
  const cacheCountEl = wrapper.querySelector("[data-cache-count]");
  const cacheInfoEl = wrapper.querySelector("[data-cache-info]");
  const settingsHint = wrapper.querySelector("[data-settings-hint]");

  const baseInput = wrapper.querySelector("#yt-ollama-base");
  const modelInput = wrapper.querySelector("#yt-ollama-model");
  const keyInput = wrapper.querySelector("#yt-ollama-key");
  const externalToggle = wrapper.querySelector("[data-external-toggle]");
  const webToggle = wrapper.querySelector("[data-web-toggle]");

  let isOpen = false;
  let isThinking = false;

  const refreshCacheCount = () => {
    const count = getCachedVideos().length;
    if (cacheCountEl) cacheCountEl.textContent = String(count);
    if (cacheInfoEl) cacheInfoEl.textContent = `${count} video(s) cached locally. ${count ? "Try: 'recommend unwatched lofi' or 'summarize my playlist'" : "Open a playlist/channel to cache videos first."}`;
  };

  const loadSettingsToForm = () => {
    const s = getOllamaSettings();
    if (baseInput) baseInput.value = s.baseUrl || "";
    if (modelInput) modelInput.value = s.model || "";
    if (keyInput) keyInput.value = s.apiKey || "";
    if (externalToggle) externalToggle.checked = s.useExternal !== false;
    if (webToggle) webToggle.checked = s.useWebSearch !== false;
  };

  const appendMessage = (role, html, isHtml = true) => {
    const row = document.createElement("div");
    row.className = `yt-chatbot-msg yt-chatbot-msg--${role}`;
    const bubble = document.createElement("div");
    bubble.className = "yt-chatbot-bubble";
    if (isHtml) bubble.innerHTML = html;
    else bubble.textContent = html;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  };

  const renderHistory = () => {
    messagesEl.innerHTML = "";
    const history = loadHistory();
    if (!history.length) {
      appendMessage("assistant", `Hi! I can search your <strong>cached videos</strong> (from playlists/channels you’ve opened), ask <strong>Ollama</strong> for broader answers, and search the <strong>live web</strong> (DuckDuckGo + Wikipedia, no API key needed).<br/><br/>Try:<br/>• “find lofi videos”<br/>• “what’s new in Next.js today?”<br/>• “recommend something unwatched”`, true);
    } else {
      for (const turn of history) {
        appendMessage(turn.role === "user" ? "user" : "assistant", turn.content, turn.isHtml !== false);
      }
    }
    refreshCacheCount();
  };

  const persistTurn = (role, content, isHtml = true) => {
    const history = loadHistory();
    history.push({ role, content, isHtml, at: Date.now() });
    saveHistory(history);
  };

  const setOpen = (open) => {
    isOpen = open;
    panel.classList.toggle("hidden", !open);
    fab.setAttribute("aria-expanded", String(open));
    if (open) {
      renderHistory();
      setTimeout(() => input?.focus(), 50);
    }
  };

  fab.addEventListener("click", () => setOpen(!isOpen));
  wrapper.querySelector('[data-action="close"]')?.addEventListener("click", () => setOpen(false));
  wrapper.querySelector('[data-action="settings"]')?.addEventListener("click", () => {
    const willShow = settingsEl.classList.contains("hidden");
    settingsEl.classList.toggle("hidden", !willShow);
    if (willShow) {
      loadSettingsToForm();
      refreshCacheCount();
    }
  });

  wrapper.querySelector('[data-action="save-settings"]')?.addEventListener("click", () => {
    const next = saveOllamaSettings({
      baseUrl: baseInput.value.trim(),
      model: modelInput.value.trim(),
      apiKey: keyInput.value.trim(),
      useExternal: !!externalToggle.checked,
      useWebSearch: !!webToggle.checked,
    });
    if (settingsHint) {
      settingsHint.textContent = "Saved ✓";
      setTimeout(() => (settingsHint.textContent = ""), 1500);
    }
    // also clear key input display? keep value so user sees it's saved
    saveOllamaSettings(next);
  });

  wrapper.querySelector('[data-action="clear-cache"]')?.addEventListener("click", () => {
    try { localStorage.removeItem("yt-video-cache"); } catch {}
    refreshCacheCount();
    appendMessage("assistant", "Video cache cleared. Open a playlist/channel to re-cache.", false);
    persistTurn("assistant", "Video cache cleared. Open a playlist/channel to re-cache.", false);
  });

  wrapper.querySelector('[data-action="clear-chat"]')?.addEventListener("click", () => {
    try { localStorage.removeItem(CHAT_HISTORY_KEY); } catch {}
    renderHistory();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const q = (input.value || "").trim();
    if (!q || isThinking) return;
    input.value = "";
    appendMessage("user", escapeHtml(q), false);
    persistTurn("user", escapeHtml(q), false);

    isThinking = true;
    const thinkingRow = appendMessage("assistant", `<span class="yt-chatbot-thinking">Thinking…</span>`, true);
    form.querySelector("button[type=submit]")?.setAttribute("disabled", "true");

    try {
      const { answer } = await answerQuery(q);
      thinkingRow.remove();
      appendMessage("assistant", answer, true);
      persistTurn("assistant", answer, true);
    } catch (err) {
      thinkingRow.remove();
      const msg = escapeHtml(err.message || "Failed to get answer");
      appendMessage("assistant", `<span style="color:#ff3b30">${msg}</span>`, true);
      persistTurn("assistant", `<span style="color:#ff3b30">${msg}</span>`, true);
    } finally {
      isThinking = false;
      form.querySelector("button[type=submit]")?.removeAttribute("disabled");
      input.focus();
    }
  });

  // Close on outside click / Escape
  document.addEventListener("click", (e) => {
    if (!isOpen) return;
    if (wrapper.contains(e.target)) return;
    // don't auto-close when clicking inside panel already handled; but allow outside click to close on mobile
    // only close if fab not clicked (already toggled)
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) setOpen(false);
  });

  // expose helper for tests
  wrapper._chatbot = { appendMessage, renderHistory, refreshCacheCount, setOpen };

  // initial count
  refreshCacheCount();
  loadSettingsToForm();

  return wrapper;
};
