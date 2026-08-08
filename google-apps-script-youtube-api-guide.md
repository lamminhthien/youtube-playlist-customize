# Google Apps Script: YouTube Playlist REST API Guide

This guide provides step-by-step instructions for creating, configuring, and deploying a lightweight REST API using **Google Apps Script (GAS)** and the **YouTube Data API v3**. This allows you to fetch full YouTube playlist items without exposing API keys or managing custom server infrastructure.

---

## 1. Overview & Architecture

```
[ Frontend / Web App ] 
        │
        ▼ (HTTP GET with `id` param)
[ Google Apps Script Web App ]
        │
        ▼ (Internal Service Call)
[ YouTube Data API v3 Service ]
```

- **Zero Cost & Serverless**: Hosted entirely on Google Cloud infrastructure.
- **Secure**: No exposure of private API keys in client-side code.

---

## 2. Google Apps Script Setup

### Step 1: Create a New Project
1. Navigate to [script.google.com](https://script.google.com/).
2. Click **New Project** in the upper left corner.
3. Rename your project (e.g., `YouTube Playlist API`).

### Step 2: Enable the YouTube Data API v3 Service
1. In the left sidebar, locate **Services** and click the **`+` (Add a service)** button.
   *(If the sidebar is hidden, click the `📁` icon at the top left).*
2. Scroll down and select **YouTube Data API v3**.
3. Keep the default Identifier (`YouTube`) and click **Add**.

---

## 3. Server-Side Script Code

Replace all content in `Code.gs` with the following implementation:

```javascript
/**
 * Google Apps Script Web App Endpoint
 * Handles HTTP GET requests to fetch YouTube playlist items.
 */
function doGet(e) {
  console.log("=== [START] doGet Execution ===");
  console.log("Received Query Parameters:", JSON.stringify(e ? e.parameter : {}));

  // Retrieve playlist ID from query parameter or fallback to default
  var playlistId = (e && e.parameter && e.parameter.id) 
    ? e.parameter.id 
    : 'PLEyKu1JwbU4te4H7bkxp30Fx8ZmsP42Av';

  console.log("Target Playlist ID:", playlistId);

  var videos = [];
  var nextPageToken = '';
  var maxResultsPerPage = 50; // Maximum allowed per request by YouTube API
  var pageCount = 0;

  try {
    // Fetch playlist items with pagination (up to 100 items)
    do {
      pageCount++;
      console.log("Fetching page " + pageCount + " with pageToken: '" + nextPageToken + "'...");

      var response = YouTube.PlaylistItems.list('snippet', {
        playlistId: playlistId,
        maxResults: maxResultsPerPage,
        pageToken: nextPageToken
      });

      if (response && response.items) {
        console.log("Fetched " + response.items.length + " items on page " + pageCount + ".");
        
        response.items.forEach(function(item) {
          videos.push({
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high 
              ? item.snippet.thumbnails.high.url 
              : (item.snippet.thumbnails.default ? item.snippet.thumbnails.default.url : ''),
            publishedAt: item.snippet.publishedAt,
            url: 'https://www.youtube.com/watch?v=' + item.snippet.resourceId.videoId
          });
        });
      }

      nextPageToken = response.nextPageToken;
    } while (nextPageToken && videos.length < 100);

    console.log("=== [SUCCESS] Total videos retrieved: " + videos.length + " ===");

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      totalResults: videos.length,
      items: videos
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("=== [ERROR] Execution failed ===");
    console.error("Error Message:", error.toString());

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper function to test doGet execution directly inside GAS Editor
 */
function testDoGet() {
  var result = doGet({ parameter: { id: 'PLEyKu1JwbU4te4H7bkxp30Fx8ZmsP42Av' } });
  Logger.log(result.getContent());
}
```

---

## 4. Web App Deployment

To publish your script as an accessible REST API:

1. Click **Deploy** > **New deployment** (top right).
2. Click the gear icon (**Select type**) and select **Web app**.
3. Configure deployment options:
   - **Description:** `YouTube Playlist API Endpoint`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` *(Crucial: Do not choose "Only myself" or "Anyone with Google account")*
4. Click **Deploy**.
5. Authorize permissions when prompted.
6. Copy the **Web app URL** (e.g., `https://script.google.com/macros/s/AKfycb.../exec`).

> ⚠️ **Important Deployment Rule**: Whenever you modify code in `Code.gs`, you must re-deploy by selecting **Deploy > Manage deployments > Edit (pencil icon) > Version: New version > Deploy**.

---

## 5. Debugging & Logs

- **`ReferenceError: YouTube is not defined`**: Occurs if the YouTube Data API service was not added to the project. Follow Step 2 under Setup.
- **Handling Redirects (`302 Found`)**: Apps Script endpoints issue a 302 redirect to Google CDN servers. Ensure frontend `fetch()` calls specify `{ redirect: "follow" }`.
- **Viewing Logs**: Click **Executions** (`📑` icon) on the left sidebar to view runtime logs and error traces for each incoming HTTP request.

---

## 6. Client-Side JavaScript Integration Guide

### Reusable Helper Function

```javascript
/**
 * Fetches playlist items from your Google Apps Script endpoint.
 * 
 * @param {string} webAppUrl - Deployed Google Apps Script Web App URL
 * @param {string} [playlistId] - Optional YouTube Playlist ID
 * @returns {Promise<Array>} List of video items
 */
async function fetchYouTubePlaylist(webAppUrl, playlistId) {
  try {
    const url = new URL(webAppUrl);
    if (playlistId) {
      url.searchParams.append('id', playlistId);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Failed to fetch playlist items.');
    }

    return data.items;
  } catch (error) {
    console.error('Error fetching playlist:', error);
    throw error;
  }
}
```

### Response Object Structure

```json
{
  "status": "success",
  "totalResults": 2,
  "items": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Sample Video Title",
      "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "publishedAt": "2024-01-01T00:00:00Z",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    }
  ]
}
```
