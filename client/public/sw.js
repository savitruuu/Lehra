/**
 * Lehra's service worker.
 *
 * Two jobs. The first is the one that is easy to miss: a manifest alone does
 * not make a site installable on Android - Chrome also wants a service worker
 * with a fetch handler before it will offer "Install app" rather than a plain
 * home-screen shortcut. Installed is what puts the app in standalone mode, and
 * standalone is what lets window.close() actually close it.
 *
 * The second is worth having for its own sake: a practice tool should not stop
 * working because the wifi did. Riyaaz happens in rooms with bad signal.
 *
 * The caching is runtime rather than precache-on-install, deliberately. Vite
 * emits hashed filenames that change every build, so a hand-written precache
 * list would be wrong the moment it was written - and precaching the whole app
 * would mean pulling 7.4MB of audio on first load whether or not the player
 * ever reaches for those instruments.
 */

const VERSION = "v1";
const SHELL_CACHE = `lehra-shell-${VERSION}`;
const ASSET_CACHE = `lehra-assets-${VERSION}`;
const AUDIO_CACHE = `lehra-audio-${VERSION}`;

const CACHES = [SHELL_CACHE, ASSET_CACHE, AUDIO_CACHE];

self.addEventListener("install", (event) => {
  // The document is the only file whose URL is stable across builds, so it is
  // the only thing worth naming up front.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.add("/")).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CACHES.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/** Cache-first: for URLs whose contents can never change under the same name. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Only full 200s. A 206 from a range request is a slice of a file, and
  // storing one would hand back a fragment as though it were the whole sample.
  if (response.ok && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first: for the document, which must never be a build behind. */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The accounts API is never cached - a stale answer to "who is signed in" is
  // worse than no answer.
  if (url.pathname.startsWith("/api/")) return;

  // Range requests stream the tanpura samples; let the network serve them
  // rather than trying to satisfy a byte range out of the cache.
  if (request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE));
    return;
  }

  if (url.pathname.startsWith("/audio/")) {
    event.respondWith(cacheFirst(request, AUDIO_CACHE));
    return;
  }

  if (url.pathname.startsWith("/assets/") || /\.(png|svg|json)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
