const TAB_BASE = [
  "px-4",
  "py-2",
  "-mb-px",
  "border-b-2",
  "text-sm",
  "transition-colors",
  "focus:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-blue-500",
];

const ACTIVE_TAB = ["border-blue-500", "text-blue-600", "font-semibold"];
const INACTIVE_TAB = ["border-transparent", "text-gray-500", "hover:text-gray-700", "font-medium"];

export const renderTabs = (container) => (tabs) => {
  if (!tabs.length) {
    const empty = document.createElement("p");
    empty.className = "text-gray-500";
    empty.textContent = "No playlists configured.";
    container.appendChild(empty);
    return;
  }

  const wrapper = document.createElement("div");

  const tablist = document.createElement("div");
  tablist.setAttribute("role", "tablist");
  tablist.className = "flex flex-wrap border-b border-gray-200 mb-6";

  const tabBtns = [];
  const panels = [];

  const setActive = (activeIndex) => {
    tabBtns.forEach((btn, i) => {
      const isActive = i === activeIndex;
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
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
    panel.className = index === 0 ? "tab-panel" : "tab-panel hidden";
    panel.appendChild(tab.element);
    panels.push(panel);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", index === 0 ? "true" : "false");
    btn.textContent = tab.name;
    btn.className = [...TAB_BASE, ...(index === 0 ? ACTIVE_TAB : INACTIVE_TAB)].join(" ");
    btn.addEventListener("click", () => setActive(index));
    tabBtns.push(btn);
  });

  tablist.append(...tabBtns);
  wrapper.append(tablist, ...panels);
  container.appendChild(wrapper);
};
