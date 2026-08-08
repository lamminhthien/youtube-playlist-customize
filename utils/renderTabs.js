import { escapeHtml } from "./escapeHtml.js";

const TAB_BASE = [
  "relative",
  "px-4",
  "py-2",
  "rounded-full",
  "text-sm",
  "font-medium",
  "transition-all",
  "duration-200",
  "focus:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-rose-400",
  "focus-visible:ring-offset-2",
];

const ACTIVE_TAB = [
  "bg-gradient-to-r",
  "from-rose-500",
  "to-indigo-500",
  "text-white",
  "shadow-glow",
];

const INACTIVE_TAB = [
  "bg-white/70",
  "text-slate-600",
  "ring-1",
  "ring-slate-200",
  "hover:text-slate-900",
  "hover:bg-white",
];

export const renderTabs = (container) => (tabs) => {
  container.innerHTML = "";

  if (!tabs.length) {
    const empty = document.createElement("div");
    empty.className =
      "rounded-2xl bg-white/80 backdrop-blur p-10 text-center text-slate-500 shadow-soft ring-1 ring-slate-200/60";
    empty.textContent = "No playlists configured.";
    container.appendChild(empty);
    return;
  }

  const wrapper = document.createElement("div");

  const tablist = document.createElement("div");
  tablist.setAttribute("role", "tablist");
  tablist.setAttribute("aria-label", "Playlists");
  tablist.className = "flex flex-wrap items-center gap-2 mb-6";

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
  };

  tabs.forEach((tab, index) => {
    const panel = document.createElement("div");
    panel.setAttribute("role", "tabpanel");
    panel.className = index === 0 ? "" : "hidden";
    panel.appendChild(tab.element);
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
};
