# Getting Started | YouTube.js

# [Getting Started](#getting-started)

## [Prerequisites](#prerequisites)

YouTube.js runs on Node.js, Deno, and modern browsers.

It requires a runtime with the following features:

-   [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
    -   On Node, we use [undici](https://github.com/nodejs/undici)'s fetch implementation, which requires Node.js 16.8+. If you need to use an older version, you may provide your own fetch implementation. See [providing your own fetch implementation](#custom-fetch) for more information.
    -   The `Response` object returned by fetch must thus be spec compliant and return a `ReadableStream` object if you want to use the `VideoInfo#download` method. (Implementations like `node-fetch` return a non-standard `Readable` object.)
-   [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) and [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) are required.

## [Installation](#installation)

```bash
# NPM
npm install youtubei.js@latest

# Yarn
yarn add youtubei.js@latest

# Git (edge version)
npm install github:LuanRT/YouTube.js

# Deno
deno add npm:youtubei.js@latest
```

Deno (deprecated):

```typescript
import { Innertube } from 'https://deno.land/x/youtubei/deno.ts';
```

## [Basic Usage](#basic-usage)

```typescript
import { Innertube } from 'youtubei.js';
const innertube = await Innertube.create(/* options */);
```

### [Configuration Options](#configuration-options)

#### [`lang` (string)](#lang-string)

-   **Description**: Language for the session.
-   **Default**: `en`

#### [`location` (string)](#location-string)

-   **Description**: Geolocation setting.
-   **Default**: `US`

#### [`user_agent` (string)](#user-agent-string)

-   **Description**: User agent for InnerTube requests.
-   **Default**: `undefined`

#### [`account_index` (number)](#account-index-number)

-   **Description**: The account index to use. This is useful if you have multiple accounts logged in. Works only with cookies.
-   **Default**: `0`

#### [`on_behalf_of_user` (string)](#on-behalf-of-user-string)

-   **Description**: Page ID of the YouTube profile/channel to use, if the logged-in account has multiple profiles.
-   **Default**: `undefined`

#### [`visitor_data` (string)](#visitor-data-string)

-   **Description**: A persistent visitor data string that allows YouTube to provide tailored content even when not logged in.
-   **Default**: `undefined`

#### [`po_token` (string)](#po-token-string)

-   **Description**: Session-bound Proof of Origin Token (attestation token) used to confirm the request is from a real client.
-   **Default**: `undefined`

#### [`player_id` (string)](#player-id-string)

-   **Description**: Player ID override. Can be used to work around temporary issues when YouTube introduces breaking changes by forcing an older player.
-   **Default**: `undefined`

#### [`retrieve_player` (boolean)](#retrieve-player-boolean)

-   **Description**: Specifies whether to retrieve the JS player. Disabling this will make session creation faster, but deciphering formats will not be possible.
-   **Default**: `true`

#### [`enable_safety_mode` (boolean)](#enable-safety-mode-boolean)

-   **Description**: Enables YouTube's safety mode, which prevents potentially unsafe content from being loaded.
-   **Default**: `false`

#### [`retrieve_innertube_config` (boolean)](#retrieve-innertube-config-boolean)

-   **Description**: Specifies whether to retrieve the InnerTube config. Useful for "onesie" requests.
-   **Default**: `true`

#### [`generate_session_locally` (boolean)](#generate-session-locally-boolean)

-   **Description**: Generates session data locally instead of retrieving it from YouTube for better performance. This is ignored if a session is already cached.
-   **Default**: `false`

#### [`fast_fail` (boolean)](#fast-fail-boolean)

-   **Description**: If set to `true`, session creation will fail if it's not possible to retrieve session data from YouTube. If `false`, a local fallback will be used.
-   **Default**: `false`

#### [`enable_session_cache` (boolean)](#enable-session-cache-boolean)

-   **Description**: Caches session data for future use.
-   **Default**: `true`

#### [`device_category` (string)](#device-category-string)

-   **Description**: Platform type for session (`DESKTOP`, `MOBILE`, etc.).
-   **Default**: `DESKTOP`

#### [`client_type` (string)](#client-type-string)

-   **Description**: InnerTube client type (`WEB`, `ANDROID`, etc.).
-   **Default**: `WEB`

#### [`timezone` (string)](#timezone-string)

-   **Description**: Time zone for the session.
-   **Default**: `*`

#### [`cache` (ICache)](#cache-icache)

-   **Description**: Cache implementation.
-   **Default**: `undefined`

#### [`cookie` (string)](#cookie-string)

-   **Description**: Cookies for authenticated sessions.
-   **Default**: `undefined`

#### [`fetch` (FetchFunction)](#fetch-fetchfunction)

-   **Description**: Custom fetch implementation.
-   **Default**: `fetch`

## [Providing a Custom JavaScript Interpreter](#providing-a-custom-javascript-interpreter)

Some features, such as deciphering streaming URLs, require executing YouTube's obfuscated JavaScript code. YouTube.js does **not** include a built-in interpreter for this purpose, so you must provide your own.

Below is an example using JavaScript's `Function` constructor:

```typescript
import { Innertube, Platform, Types } from 'youtubei.js/web';

Platform.shim.eval = async (data: Types.BuildScriptResult) => {
  return new Function(data.output)();;
};

const innertube = await Innertube.create(/* options */);
// ...
```


# YouTube.js

## [Extending the library](#extending-the-library)

YouTube.js is modular and easy to extend. Most of the methods, classes, and utilities used internally are exposed and can be used to implement your own extensions without having to modify the library's source code.

For example, let's say we want to implement a method to retrieve video info. We can do that by using an instance of the `Actions` class:

```typescript
import { Innertube, UniversalCache } from 'youtubei.js';

const yt = await Innertube.create({ cache: new UniversalCache(true) });

async function getVideoInfo(videoId: string) {
  const videoInfo = await yt.actions.execute('/player', {
    // You can add any additional payloads here, and they'll merge with the default payload sent to InnerTube.
    videoId,
    client: 'YTMUSIC', // InnerTube client to use.
    parse: true // tells YouTube.js to parse the response (not sent to InnerTube).
  });

  return videoInfo;
}

const videoInfo = await getVideoInfo('jLTOuvBTLxA');
console.info(videoInfo);
```

Alternatively, suppose we locate a `NavigationEndpoint` in a parsed response (e.g., a button). We can easily call it like this:

```typescript
import { Innertube, UniversalCache, YTNodes } from 'youtubei.js';

const yt = await Innertube.create({ cache: new UniversalCache(true) });

const artist = await yt.music.getArtist('UC52ZqHVQz5OoGhvbWiRal6g');
const albums = artist.sections[1].as(YTNodes.MusicCarouselShelf);

// Let's imagine that we wish to click on the “More” button:
const button = albums.as(YTNodes.MusicCarouselShelf).header?.more_content;

if (button) {
  // Having ensured that it exists, we can then call its navigation endpoint using the following code:
  const page = await button.endpoint.call(yt.actions, { parse: true });
  console.info(page);
}
```

## [Using the parser](#using-the-parser)

YouTube.js' parser enables you to parse InnerTube responses and convert their nodes into strongly-typed objects that are simple to manipulate. Additionally, it provides numerous utility methods.

Here's an example:

```typescript
// See ./examples/parser

import { Parser, YTNodes } from 'youtubei.js';
import { readFileSync } from 'fs';

// YouTube Music's artist page response
const data = readFileSync('./artist.json').toString();

const page = Parser.parseResponse(JSON.parse(data));

const header = page.header?.item().as(YTNodes.MusicImmersiveHeader, YTNodes.MusicVisualHeader);

console.info('Header:', header);

// The parser uses a proxy object to add type safety and utility methods for working with InnerTube's data arrays:
const tab = page.contents?.item().as(YTNodes.SingleColumnBrowseResults).tabs.firstOfType(YTNodes.Tab);

if (!tab)
  throw new Error('Target tab not found');

if (!tab.content)
  throw new Error('Target tab appears to be empty');

const sections = tab.content?.as(YTNodes.SectionList).contents.as(YTNodes.MusicCarouselShelf, YTNodes.MusicDescriptionShelf, YTNodes.MusicShelf);

console.info('Sections:', sections);
```

Documentation for the parser can be found [here](https://github.com/LuanRT/YouTube.js/blob/main/src/parser).