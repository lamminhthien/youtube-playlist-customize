export const renderError = (name, err) => {
  console.error(err);
  const section = document.createElement("section");
  section.innerHTML = `
    <header class="mb-4 border-b pb-2">
      <h2 class="text-2xl font-bold text-gray-900">${name}</h2>
    </header>
    <p class="text-red-500">Failed to load playlist "${name}".</p>
  `;
  return section;
};
