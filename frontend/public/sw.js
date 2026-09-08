'use strict';

const BUILD_VERSION = '__TRUYENHUB_BUILD_VERSION__';
const SHELL_CACHE_PREFIX = 'truyenhub-shell-';
const PRIVATE_CACHE_PREFIX = 'truyenhub-offline-assets-';
const SHELL_CACHE = `${SHELL_CACHE_PREFIX}${BUILD_VERSION}`;
const SHELL_MANIFEST_URL = '/pwa-assets.json';
const FALLBACK_SHELL_ASSETS = [
  '/index.html',
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
];
const MAX_MESSAGE_ASSETS = 2000;

const privateCachesByClient = new Map();

self.addEventListener('install', (event) => {
  event.waitUntil(cacheExplicitShellManifest());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(SHELL_CACHE_PREFIX) && name !== SHELL_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin && isApiPath(url.pathname)) {
    // Authentication and API responses always remain network-only.
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkNavigationOrShell(request));
    return;
  }

  const clientId = event.clientId || event.resultingClientId;
  event.respondWith(explicitCacheOrNetwork(request, privateCachesByClient.get(clientId) || null));
});

self.addEventListener('message', (event) => {
  const command = parseCommand(event.data);
  const clientId = event.source && typeof event.source.id === 'string' ? event.source.id : null;
  if (!command) {
    reply(event, { success: false });
    return;
  }

  if (command.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (command.type === 'SET_PRIVATE_SCOPE') {
    if (!clientId) {
      reply(event, { success: false });
      return;
    }
    if (command.scopeHash) {
      privateCachesByClient.set(clientId, `${PRIVATE_CACHE_PREFIX}${command.scopeHash}`);
    } else {
      privateCachesByClient.delete(clientId);
    }
    reply(event, { success: true });
    return;
  }

  if (command.type === 'CLEAR_PRIVATE_CACHES') {
    privateCachesByClient.clear();
    event.waitUntil(deletePrivateCaches().then(() => reply(event, { success: true })));
    return;
  }

  const privateCacheName = clientId ? privateCachesByClient.get(clientId) : null;
  if (!privateCacheName || command.scopeHash !== scopeHashFromCache(privateCacheName)) {
    reply(event, { success: false });
    return;
  }

  if (command.type === 'CACHE_MANIFEST_ASSETS') {
    event.waitUntil(
      cacheExplicitPrivateAssets(privateCacheName, command.assets).then((cached) =>
        reply(event, { success: true, cached }),
      ),
    );
    return;
  }

  event.waitUntil(
    removeExplicitPrivateAssets(privateCacheName, command.assets).then((removed) =>
      reply(event, { success: true, removed }),
    ),
  );
});

async function cacheExplicitShellManifest() {
  const cache = await caches.open(SHELL_CACHE);
  let assets = FALLBACK_SHELL_ASSETS;
  try {
    const response = await fetch(SHELL_MANIFEST_URL, { cache: 'no-store' });
    if (response.ok) {
      const manifest = await response.json();
      if (isShellManifest(manifest)) assets = manifest.assets;
    }
  } catch {
    // A minimal public shell still makes the first worker install deterministic.
  }

  await Promise.all(
    assets
      .filter((asset) => isAllowedAsset(asset, false))
      .map(async (asset) => {
        try {
          const response = await fetch(asset, { cache: 'no-store', credentials: 'omit' });
          if (response.ok) await cache.put(asset, response);
        } catch {
          // One optional chunk must not prevent the worker from installing.
        }
      }),
  );
}

async function networkNavigationOrShell(request) {
  try {
    const response = await fetch(request);
    if (response.ok) return response;
  } catch {
    // Fall through to the immutable shell snapshot.
  }
  const shell = await caches.open(SHELL_CACHE);
  return (await shell.match('/index.html')) || (await shell.match('/')) || Response.error();
}

async function explicitCacheOrNetwork(request, privateCacheName) {
  const shell = await (await caches.open(SHELL_CACHE)).match(request);
  if (shell) return shell;
  if (privateCacheName) {
    const privateResponse = await (await caches.open(privateCacheName)).match(request);
    if (privateResponse) return privateResponse;
  }
  return fetch(request);
}

async function cacheExplicitPrivateAssets(privateCacheName, assets) {
  const allowed = normalizeAssets(assets, true);
  const cache = await caches.open(privateCacheName);
  let cached = 0;
  for (const asset of allowed) {
    try {
      const response = await fetch(asset, { cache: 'no-store', credentials: 'omit' });
      if (response.ok || response.type === 'opaque') {
        await cache.put(asset, response);
        cached += 1;
      }
    } catch {
      // IndexedDB remains the authoritative offline media store.
    }
  }
  return cached;
}

async function removeExplicitPrivateAssets(privateCacheName, assets) {
  const cache = await caches.open(privateCacheName);
  const allowed = normalizeAssets(assets, true);
  const results = await Promise.all(allowed.map((asset) => cache.delete(asset)));
  return results.filter(Boolean).length;
}

async function deletePrivateCaches() {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX))
      .map((name) => caches.delete(name)),
  );
}

function normalizeAssets(value, allowCrossOrigin) {
  if (!Array.isArray(value) || value.length > MAX_MESSAGE_ASSETS) return [];
  return [...new Set(value)].filter((asset) => isAllowedAsset(asset, allowCrossOrigin));
}

function isAllowedAsset(value, allowCrossOrigin) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return false;
  let url;
  try {
    url = new URL(value, self.location.origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.origin !== self.location.origin) return allowCrossOrigin && url.protocol === 'https:';
  return !isApiPath(url.pathname);
}

function isApiPath(pathname) {
  try {
    const decoded = decodeURIComponent(pathname);
    return decoded === '/api' || decoded.startsWith('/api/');
  } catch {
    return true;
  }
}

function isShellManifest(value) {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray(value.assets) &&
    value.assets.length <= MAX_MESSAGE_ASSETS
  );
}

function parseCommand(value) {
  if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null;
  if (value.type === 'SKIP_WAITING' || value.type === 'CLEAR_PRIVATE_CACHES') {
    return { type: value.type };
  }
  if (value.type === 'SET_PRIVATE_SCOPE') {
    if (value.scopeHash !== null && !isScopeHash(value.scopeHash)) return null;
    return { type: value.type, scopeHash: value.scopeHash };
  }
  if (value.type !== 'CACHE_MANIFEST_ASSETS' && value.type !== 'REMOVE_MANIFEST_ASSETS') {
    return null;
  }
  if (!isScopeHash(value.scopeHash) || !Array.isArray(value.assets)) return null;
  return { type: value.type, scopeHash: value.scopeHash, assets: value.assets };
}

function isScopeHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function scopeHashFromCache(cacheName) {
  return cacheName.slice(PRIVATE_CACHE_PREFIX.length);
}

function reply(event, payload) {
  event.ports[0]?.postMessage(payload);
}
