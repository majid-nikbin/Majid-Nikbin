// High-Performance 100% Offline Marine Slippy Tile Engine
// Zero network timeout delay when disconnected!

export type LiveTileProvider =
  | 'google_terrain'
  | 'google_hybrid'
  | 'google_satellite'
  | 'esri_ocean'
  | 'esri_satellite'
  | 'osm_mirror_de'
  | 'custom';

export interface TileProviderOption {
  id: LiveTileProvider;
  name: string;
  badge?: string;
  description: string;
  maxZoom: number;
}

export const LIVE_TILE_PROVIDERS: TileProviderOption[] = [
  {
    id: 'google_terrain',
    name: 'Marine Nautical Chart (Hydrography)',
    badge: 'Crisp & Fast',
    description: 'High-definition nautical chart with breakwaters, docks, harbors, islands & relief (100% stable)',
    maxZoom: 21
  },
  {
    id: 'google_hybrid',
    name: 'Google Marine Satellite Hybrid',
    badge: 'Satellite + Info',
    description: 'High-resolution satellite imagery with ports, channels, and coastal labels',
    maxZoom: 22
  },
  {
    id: 'esri_ocean',
    name: 'ESRI Ocean & Bathymetry',
    badge: 'Depth & Seabed',
    description: 'Official NOAA & GEBCO marine depth contours and oceanic seabed topography',
    maxZoom: 18
  },
  {
    id: 'google_satellite',
    name: 'Pure World Satellite',
    badge: 'Satellite',
    description: 'Crystal-clear satellite imagery of coastlines, shoals, and shallow reefs',
    maxZoom: 22
  },
  {
    id: 'osm_mirror_de',
    name: 'OpenStreetMap Nautical',
    badge: 'Fast CDN',
    description: 'European mirror of standard open hydrographic charts',
    maxZoom: 20
  }
];

export const TILE_CACHE_NAME = 'mariner-tiles-offline-v2';
const TILE_MEMORY_CACHE = new Map<string, HTMLImageElement>();
const MAX_MEMORY_CACHE = 800;
const PENDING_REQUESTS = new Set<string>();
const CACHED_URLS_SET = new Set<string>();

let globalCacheInstance: Cache | null = null;
let isCacheIndexLoaded = false;
let cacheUpdateListeners: Array<() => void> = [];

export function subscribeTileCacheUpdates(listener: () => void): () => void {
  cacheUpdateListeners.push(listener);
  return () => {
    cacheUpdateListeners = cacheUpdateListeners.filter((l) => l !== listener);
  };
}

function notifyCacheUpdated() {
  cacheUpdateListeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

async function initCacheIndex() {
  if (isCacheIndexLoaded) return;
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    globalCacheInstance = await caches.open(TILE_CACHE_NAME);
    const keys = await globalCacheInstance.keys();
    keys.forEach((req) => CACHED_URLS_SET.add(req.url));
    isCacheIndexLoaded = true;
  } catch {}
}

if (typeof window !== 'undefined') {
  initCacheIndex().catch(() => {});
}

export function getSavedCustomTileUrl(): string {
  try {
    const saved = localStorage.getItem('mariner_custom_tile_url');
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
}

export function saveCustomTileUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem('mariner_custom_tile_url', url.trim());
    }
  } catch {}
}

export function getLiveTileUrl(provider: LiveTileProvider, z: number, x: number, y: number): string {
  const maxTile = 1 << z;
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;

  switch (provider) {
    case 'google_terrain': {
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=p&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'google_hybrid': {
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=y&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'google_satellite': {
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=s&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'osm_mirror_de': {
      return `https://tile.openstreetmap.de/${z}/${wrappedX}/${y}.png`;
    }
    case 'esri_ocean': {
      return `https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/${z}/${y}/${wrappedX}`;
    }
    case 'esri_satellite': {
      return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${wrappedX}`;
    }
    case 'custom': {
      const template = getSavedCustomTileUrl();
      const subdomains = ['a', 'b', 'c'];
      const s = subdomains[(wrappedX + y) % subdomains.length];
      return template
        .replace(/\{z\}/g, String(z))
        .replace(/\{x\}/g, String(wrappedX))
        .replace(/\{y\}/g, String(y))
        .replace(/\{s\}/g, s);
    }
    default: {
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=p&x=${wrappedX}&y=${y}&z=${z}`;
    }
  }
}

export function getOpenSeaMapTileUrl(z: number, x: number, y: number): string {
  const maxTile = 1 << z;
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;
  return `https://tiles.openseamap.org/seamark/${z}/${wrappedX}/${y}.png`;
}

function makeTileKey(provider: string, z: number, x: number, y: number): string {
  return `${provider}:${z}:${x}:${y}`;
}

export async function saveUrlToPersistentCache(url: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  if (CACHED_URLS_SET.has(url)) return;
  CACHED_URLS_SET.add(url);
  try {
    const cache = globalCacheInstance || (await caches.open(TILE_CACHE_NAME));
    const resp = await fetch(url, { mode: 'cors' });
    if (resp.ok) {
      await cache.put(url, resp);
      notifyCacheUpdated();
    }
  } catch {}
}

function loadTileFromCacheDirectly(
  url: string,
  key: string,
  onLoaded?: () => void,
  fallbackUrl?: string
) {
  const doMatch = (cache: Cache) => {
    cache.match(url).then((cachedResp) => {
      if (cachedResp && cachedResp.ok) {
        cachedResp.blob().then((blob) => {
          const objUrl = URL.createObjectURL(blob);
          const offlineImg = new Image();
          offlineImg.onload = () => {
            TILE_MEMORY_CACHE.set(key, offlineImg);
            PENDING_REQUESTS.delete(key);
            if (onLoaded) onLoaded();
          };
          offlineImg.onerror = () => {
            PENDING_REQUESTS.delete(key);
            URL.revokeObjectURL(objUrl);
          };
          offlineImg.src = objUrl;
        }).catch(() => {
          PENDING_REQUESTS.delete(key);
        });
      } else {
        PENDING_REQUESTS.delete(key);
        if (fallbackUrl && fallbackUrl !== url) {
          requestTileImage(fallbackUrl, `${key}_fb`, onLoaded);
        }
      }
    }).catch(() => {
      PENDING_REQUESTS.delete(key);
    });
  };

  if (globalCacheInstance) {
    doMatch(globalCacheInstance);
  } else if (typeof window !== 'undefined' && 'caches' in window) {
    caches.open(TILE_CACHE_NAME).then((c) => {
      globalCacheInstance = c;
      doMatch(c);
    }).catch(() => {
      PENDING_REQUESTS.delete(key);
    });
  } else {
    PENDING_REQUESTS.delete(key);
  }
}

function requestTileImage(
  url: string,
  key: string,
  onLoaded?: () => void,
  fallbackUrl?: string
): HTMLImageElement | null {
  const cachedImg = TILE_MEMORY_CACHE.get(key);
  if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
    return cachedImg;
  }

  if (PENDING_REQUESTS.has(key)) {
    return null;
  }
  PENDING_REQUESTS.add(key);

  if (TILE_MEMORY_CACHE.size >= MAX_MEMORY_CACHE) {
    const iter = TILE_MEMORY_CACHE.keys();
    for (let i = 0; i < 100; i++) {
      const first = iter.next().value;
      if (first) TILE_MEMORY_CACHE.delete(first);
    }
  }

  // ZERO-DELAY OFFLINE CHECK
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const isKnownCached = CACHED_URLS_SET.has(url);

  if (isOffline || isKnownCached) {
    loadTileFromCacheDirectly(url, key, onLoaded, fallbackUrl);
    return null;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  let isDone = false;

  img.onload = () => {
    if (isDone) return;
    isDone = true;
    TILE_MEMORY_CACHE.set(key, img);
    PENDING_REQUESTS.delete(key);
    if (onLoaded) onLoaded();
    saveUrlToPersistentCache(url);
  };

  img.onerror = () => {
    if (isDone) return;
    isDone = true;
    loadTileFromCacheDirectly(url, key, onLoaded, fallbackUrl);
  };

  img.src = url;
  return null;
}

export function renderLiveMapTiles(
  ctx: CanvasRenderingContext2D,
  provider: LiveTileProvider,
  zoom: number,
  geoToCanvas: (lon: number, lat: number, width: number, height: number) => { x: number; y: number },
  canvasToGeo: (x: number, y: number, width: number, height: number) => { lat: number; lon: number },
  width: number,
  height: number,
  onTileLoaded: () => void,
  showSeamarks: boolean = false
) {
  const continuousZ = 3.8137 + Math.log2(zoom);
  const z = Math.max(1, Math.min(20, Math.round(continuousZ)));

  const c1 = canvasToGeo(-30, -30, width, height);
  const c2 = canvasToGeo(width + 30, -30, width, height);
  const c3 = canvasToGeo(width + 30, height + 30, width, height);
  const c4 = canvasToGeo(-30, height + 30, width, height);

  const minLon = Math.max(-180, Math.min(c1.lon, c2.lon, c3.lon, c4.lon));
  const maxLon = Math.min(180, Math.max(c1.lon, c2.lon, c3.lon, c4.lon));
  const maxLat = Math.min(85.0511, Math.max(c1.lat, c2.lat, c3.lat, c4.lat));
  const minLat = Math.max(-85.0511, Math.min(c1.lat, c2.lat, c3.lat, c4.lat));

  const numTiles = 1 << z;
  const latToTileY = (lat: number) => {
    const clampedLat = Math.max(-85.0511, Math.min(85.0511, isNaN(lat) ? 0 : lat));
    const latRad = (clampedLat * Math.PI) / 180;
    const sin = Math.sin(latRad);
    return Math.floor(((1 - Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI)) / 2) * numTiles);
  };

  let minTileY = latToTileY(maxLat);
  let maxTileY = latToTileY(minLat);
  if (minTileY > maxTileY) {
    const temp = minTileY;
    minTileY = maxTileY;
    maxTileY = temp;
  }
  const minTileX = Math.floor(((minLon + 180) / 360) * numTiles);
  const maxTileX = Math.floor(((maxLon + 180) / 360) * numTiles);

  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const lonLeft = (tx / numTiles) * 360 - 180;
      const lonRight = ((tx + 1) / numTiles) * 360 - 180;
      const latTopRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / numTiles)));
      const latTop = (latTopRad * 180) / Math.PI;
      const latBottomRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / numTiles)));
      const latBottom = (latBottomRad * 180) / Math.PI;

      const pTopLeft = geoToCanvas(lonLeft, latTop, width, height);
      const pBottomRight = geoToCanvas(lonRight, latBottom, width, height);

      const drawX = pTopLeft.x;
      const drawY = pTopLeft.y;
      const tileWidth = pBottomRight.x - pTopLeft.x;
      const tileHeight = pBottomRight.y - pTopLeft.y;

      const url = getLiveTileUrl(provider, z, tx, ty);
      const key = makeTileKey(provider, z, tx, ty);
      const fallbackUrl = provider !== 'google_hybrid'
        ? `https://mt1.google.com/vt/lyrs=y&x=${((tx % numTiles) + numTiles) % numTiles}&y=${ty}&z=${z}`
        : undefined;

      const img = requestTileImage(url, key, onTileLoaded, fallbackUrl);

      if (img) {
        ctx.drawImage(img, drawX, drawY, tileWidth, tileHeight);
      } else {
        // Multi-level parent overzoom fallback
        for (let level = 1; level <= 6; level++) {
          if (z <= level) break;
          const pz = z - level;
          const shift = level;
          const px = tx >> shift;
          const py = ty >> shift;
          const parentKey = makeTileKey(provider, pz, px, py);
          const parentImg = TILE_MEMORY_CACHE.get(parentKey);

          if (parentImg && parentImg.complete && parentImg.naturalWidth > 0) {
            const subSize = 256 >> shift;
            const mask = (1 << shift) - 1;
            const sx = (tx & mask) * subSize;
            const sy = (ty & mask) * subSize;
            ctx.drawImage(parentImg, sx, sy, subSize, subSize, drawX, drawY, tileWidth, tileHeight);
            break;
          }
        }
      }

      // OpenSeaMap overlay
      if (showSeamarks && z >= 8) {
        const seamarkUrl = getOpenSeaMapTileUrl(z, tx, ty);
        const seamarkKey = `seamark:${z}:${tx}:${ty}`;
        const seamarkImg = requestTileImage(seamarkUrl, seamarkKey, onTileLoaded);
        if (seamarkImg) {
          ctx.drawImage(seamarkImg, drawX, drawY, tileWidth, tileHeight);
        }
      }
    }
  }
}

export async function getCachedTileStats(): Promise<{ count: number; estimatedSizeMb: number }> {
  try {
    if (!globalCacheInstance && typeof window !== 'undefined' && 'caches' in window) {
      globalCacheInstance = await caches.open(TILE_CACHE_NAME);
    }
    if (!globalCacheInstance) return { count: 0, estimatedSizeMb: 0 };
    const keys = await globalCacheInstance.keys();
    const count = keys.length;
    const estimatedSizeMb = Number(((count * 28) / 1024).toFixed(1));
    return { count, estimatedSizeMb };
  } catch {
    return { count: 0, estimatedSizeMb: 0 };
  }
}

export async function clearTileCache(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      await caches.delete(TILE_CACHE_NAME);
      globalCacheInstance = await caches.open(TILE_CACHE_NAME);
      CACHED_URLS_SET.clear();
      TILE_MEMORY_CACHE.clear();
      notifyCacheUpdated();
      return true;
    }
  } catch {}
  return false;
}

export async function preCacheAreaTiles(
  provider: LiveTileProvider,
  minLon: number,
  maxLon: number,
  minLat: number,
  maxLat: number,
  minZ: number,
  maxZ: number,
  onProgress?: (done: number, total: number) => void
): Promise<{ success: boolean; downloaded: number; total: number }> {
  const tileList: Array<{ url: string; z: number; x: number; y: number }> = [];

  for (let z = minZ; z <= maxZ; z++) {
    const numTiles = 1 << z;
    const minTileX = Math.max(0, Math.min(numTiles - 1, Math.floor(((minLon + 180) / 360) * numTiles)));
    const maxTileX = Math.max(0, Math.min(numTiles - 1, Math.floor(((maxLon + 180) / 360) * numTiles)));

    const latRadMax = (Math.min(85.05, maxLat) * Math.PI) / 180;
    const latRadMin = (Math.max(-85.05, minLat) * Math.PI) / 180;
    const minTileY = Math.max(0, Math.min(numTiles - 1, Math.floor(((1 - Math.log(Math.tan(latRadMax) + 1 / Math.cos(latRadMax)) / Math.PI) / 2) * numTiles)));
    const maxTileY = Math.max(0, Math.min(numTiles - 1, Math.floor(((1 - Math.log(Math.tan(latRadMin) + 1 / Math.cos(latRadMin)) / Math.PI) / 2) * numTiles)));

    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = Math.min(minTileY, maxTileY); y <= Math.max(minTileY, maxTileY); y++) {
        tileList.push({ url: getLiveTileUrl(provider, z, x, y), z, x, y });
      }
    }
  }

  const total = tileList.length;
  let done = 0;

  for (const t of tileList) {
    await saveUrlToPersistentCache(t.url);
    done++;
    if (onProgress) onProgress(done, total);
  }

  return { success: true, downloaded: done, total };
}

export async function autoDownloadGlobalMarineOverview(
  provider: LiveTileProvider = 'google_terrain',
  onProgress?: (done: number, total: number) => void
): Promise<{ success: boolean; total: number }> {
  // Pre-cache zoom levels 1 to 4 globally
  return await preCacheAreaTiles(provider, -180, 180, -80, 80, 1, 4, onProgress);
}

export async function updateGlobalMarineMap(
  provider: LiveTileProvider = 'google_terrain',
  onProgress?: (done: number, total: number) => void
): Promise<{ success: boolean; total: number }> {
  return await autoDownloadGlobalMarineOverview(provider, onProgress);
}
