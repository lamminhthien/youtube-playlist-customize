export const renderError = (container) => (name, err) => {
  const errorEl = document.createElement("p");
  errorEl.className = "text-red-500";
  errorEl.textContent = `Failed to load playlist "${name}".`;
  console.error(err);
  container.appendChild(errorEl);
};
