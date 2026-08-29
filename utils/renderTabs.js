import { escapeHtml } from "./escapeHtml.js";
import { renderError } from "./renderError.js";
import { renderSkeleton } from "./renderSkeleton.js";

const TAB_BASE = ["yt-tab"];

const ACTIVE_TAB = ["yt-tab-active"];

const INACTIVE_TAB = ["yt-tab-inactive"];

export const renderTabs = (container) => (tabs) => {
  container.innerHTML = "";

  if (!tabs.length) {
    const empty = document.createElement("div");
    empty.className = "yt-empty rounded-2xl";
    empty.textContent = "No playlists configured.";
    container.appendChild(empty);
    return;
  }

  const wrapper = document.createElement("div");

  const tablist = document.createElement("div");
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Playlists");
  tablist.className = "yt-tabbar";

  const tabBtns = [];
  const panels = [];

  const setActive = (activeIndex) => {
    tabBtns.forEach((btn, i) => {
      const isActive = i === activeIndex;
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
      btn.classList.remove(...(isActive ? INACTIVE_TAB : ACTIVE_TAB));
      btn.classList.add(...(isActive ? ACTIVE_TAB : INACTIVE_TAB));
    });
    panels.forEach((panel, i) => {
      panel.classList.toggle("hidden", i !== activeIndex);
    });
    loadTabContent(panels[activeIndex], tabs[activeIndex]);
  };

  /**
   * Invoke a tab's optional `load` function on first activation, then swap
   * the panel's children with the resolved element (or an error state).
   * Subsequent activations are a no-op once the tab has finished loading.
   */
  const loadTabContent = async (panel, tab) => {
    if (!tab || typeof tab.load !== "function" || tab._loaded) return;
    tab._loaded = true;
    panel.setAttribute("aria-busy", "true");
    try {
      const element = await tab.load();
      if (element && element.nodeType === 1) {
        panel.replaceChildren(element);
      }
    } catch (err) {
      panel.replaceChildren(renderError(tab.name, err));
    } finally {
      panel.removeAttribute("aria-busy");
    }
  };

  tabs.forEach((tab, index) => {
    const panel = document.createElement("div");
    panel.setAttribute("role", "tabpanel");
    panel.className = index === 0 ? "" : "hidden";
    // Lazy tabs may omit `element`; their content arrives via the `load`
    // callback the first time they become active.
    if (tab.element) {
      panel.appendChild(tab.element);
    }
    panels.push(panel);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", index === 0 ? "true" : "false");
    btn.setAttribute("tabindex", index === 0 ? "0" : "-1");
    btn.textContent = tab.name;
    btn.className = [
      ...TAB_BASE,
      ...(index === 0 ? ACTIVE_TAB : INACTIVE_TAB),
    ].join(" ");
    btn.addEventListener("click", () => {
      setActive(index);
      btn.focus();
    });
    btn.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = (index + dir + tabBtns.length) % tabBtns.length;
      setActive(next);
      tabBtns[next].focus();
    });
    tabBtns.push(btn);
  });

  tablist.append(...tabBtns);
  wrapper.append(tablist, ...panels);
  container.appendChild(wrapper);

  // Kick off the lazy load for the initially-active tab so the user sees
  // real content (not just a skeleton) without an extra click.
  loadTabContent(panels[0], tabs[0]);
};
