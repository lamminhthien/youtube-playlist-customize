export const renderPlaylist = (container) => ({ name, data }) => {
  const section = document.createElement("section");
  section.innerHTML = `
    <header class="mb-4 border-b pb-2">
      <h2 class="text-2xl font-bold text-gray-900">${data.feed.title || name}</h2>
      <p class="text-gray-500 mt-1">By ${data.feed.author || "YouTube Channel"}</p>
    </header>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
      ${data.items.map((item) => {
        const videoId = item.link.split("v=")[1]?.split("&")[0];
        const thumbnailUrl = item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        return `
          <a href="${item.link}" target="_blank" rel="noopener noreferrer"
             class="bg-white rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow duration-300 flex flex-col group">
            <div class="relative w-full aspect-video bg-gray-200 overflow-hidden">
              <img src="${thumbnailUrl}" alt="${item.title}"
                   class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                   loading="lazy">
            </div>
            <div class="p-4 flex flex-col flex-grow">
              <h3 class="text-base font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                ${item.title}
              </h3>
              <span class="text-xs text-gray-400 mt-auto pt-4">
                Published: ${new Date(item.pubDate).toLocaleDateString()}
              </span>
            </div>
          </a>
        `;
      }).join("")}
    </div>
  `;
  container.appendChild(section);
};
