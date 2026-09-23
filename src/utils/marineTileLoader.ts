/**
 * Marine Live Tile Loader & Persistent Web Mercator Tile Caching Engine
 * 
 * Features:
 * - Persistent CacheStorage ('mariner_live_tiles_v2') for 100% offline playback
 * - Automatic background caching of every viewed tile
 * - Pre-caching manager: Download current marine view or region for sailing offline
 * - Cache statistics (tile count and storage size)
 * - Seamless fallback: Cached High-Res Tiles -> Live Tiles -> Vector Shorelines
 * - Optimized for global and Iran accessibility (Google Satellite, Google Hybrid, OSM Mirrors, ESRI Ocean)
 */

export type LiveTileProvider = 
  | 'google_hybrid'
  | 'google_satellite'
  | 'google_nautical'
  | 'osm_mirror_de'
  | 'esri_ocean'
  | 'esri_satellite'
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
    id: 'google_hybrid',
    name: 'Google Marine Hybrid',
    badge: '🛰️ Recommended',
    description: 'High-resolution satellite with coastal labels, ports, and sea borders',
    maxZoom: 20
  },
  {
    id: 'google_satellite',
    name: 'Google World Satellite',
    badge: '🌍 Satellite',
    description: 'Crystal-clear satellite imagery of coastlines, shallow reefs, and seabed',
    maxZoom: 20
  },
  {
    id: 'google_nautical',
    name: 'Google Standard Nautical/Road',
    badge: '⚡ Fast Vector',
    description: 'Clear raster roadmap with highlighted ports, marinas, and coastal land details',
    maxZoom: 19
  },
  {
    id: 'osm_mirror_de',
    name: 'OpenStreetMap Fast Mirror',
    badge: '⚡ Fast CDN',
    description: 'Unfiltered high-speed European mirror of OpenStreetMap nautical standard',
    maxZoom: 19
  },
  {
    id: 'esri_ocean',
    name: 'ESRI Ocean & Bathymetry',
    badge: '🌊 Depth & Seabed',
    description: 'Specialized marine bathymetry, depth contours, coastal seabed topography',
    maxZoom: 16
  },
  {
    id: 'esri_satellite',
    name: 'ESRI World Imagery',
    badge: '🛰️ Global Sat',
    description: 'Alternative high-resolution satellite imagery',
    maxZoom: 18
  },
  {
    id: 'custom',
    name: 'Custom Tile Server URL',
    badge: '⚙️ Custom XYZ',
    description: 'Enter your own tile server URL template ({z}/{x}/{y}.png)',
    maxZoom: 22
  }
];

export const TILE_CACHE_NAME = 'mariner_live_tiles_v2';
const TILE_MEMORY_CACHE = new Map<string, HTMLImageElement>();
const PENDING_REQUESTS = new Set<string>();
const MAX_MEMORY_CACHE = 800;
const CUSTOM_TILE_STORAGE_KEY = 'mariner_custom_tile_url_v1';

// Cache event subscribers
type CacheListener = () => void;
const cacheListeners = new Set<CacheListener>();

export function subscribeTileCacheUpdates(listener: CacheListener): () => void {
  cacheListeners.add(listener);
  return () => {
    cacheListeners.delete(listener);
  };
}

function notifyCacheUpdated() {
  cacheListeners.forEach(fn => {
    try { fn(); } catch {}
  });
}

export function getSavedCustomTileUrl(): string {
  try {
    const saved = localStorage.getItem(CUSTOM_TILE_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
}

export function saveCustomTileUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(CUSTOM_TILE_STORAGE_KEY, url.trim());
    }
  } catch {}
}

export function getLiveTileUrl(provider: LiveTileProvider, z: number, x: number, y: number): string {
  // Wrap X for 360-degree world wrap-around
  const maxTile = 1 << z;
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;

  switch (provider) {
    case 'google_hybrid': {
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=y&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'google_satellite': {
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=s&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'google_nautical': {
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=m&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'osm_mirror_de': {
      return `https://tile.openstreetmap.de/${z}/${wrappedX}/${y}.png`;
    }
    case 'esri_ocean':
      return `https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/${z}/${y}/${wrappedX}`;
    case 'esri_satellite':
      return `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${wrappedX}`;
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
      return `https://mt${s}.google.com/vt/lyrs=y&x=${wrappedX}&y=${y}&z=${z}`;
    }
  }
}

export function getOpenSeaMapTileUrl(z: number, x: number, y: number): string {
  const maxTile = 1 << z;
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;
  return `https://tiles.openseamap.org/seamark/${z}/${wrappedX}/${y}.png`;
}

/**
 * Fetch tile image with multi-tier caching:
 * 1. Memory cache (Instant)
 * 2. Persistent Browser CacheStorage (Works 100% offline!)
 * 3. Network fetch + save to CacheStorage (When online)
 */
function fetchTileImage(
  url: string, 
  onLoaded?: () => void, 
  fallbackUrl?: string
): HTMLImageElement | null {
  // 1. Check in-memory image cache
  if (TILE_MEMORY_CACHE.has(url)) {
    const img = TILE_MEMORY_CACHE.get(url)!;
    if (img.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }

  // 2. Prevent redundant parallel requests
  if (PENDING_REQUESTS.has(url)) {
    return null;
  }
  PENDING_REQUESTS.add(url);

  // Prune memory cache if too large
  if (TILE_MEMORY_CACHE.size >= MAX_MEMORY_CACHE) {
    const firstKey = TILE_MEMORY_CACHE.keys().next().value;
    if (firstKey) TILE_MEMORY_CACHE.delete(firstKey);
  }

  // 3. Asynchronously check Persistent CacheStorage first
  const loadFromCacheOrNetwork = async () => {
    try {
      let cache: Cache | null = null;
      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          cache = await caches.open(TILE_CACHE_NAME);
        } catch (e) {}
      }

      // Check if tile already exists in persistent CacheStorage (Offline hit!)
      if (cache) {
        const cachedResponse = await cache.match(url);
        if (cachedResponse && cachedResponse.ok) {
          const blob = await cachedResponse.blob();
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            TILE_MEMORY_CACHE.set(url, img);
            PENDING_REQUESTS.delete(url);
            if (onLoaded) onLoaded();
          };
          img.onerror = () => {
            PENDING_REQUESTS.delete(url);
            URL.revokeObjectURL(objectUrl);
          };
          img.src = objectUrl;
          return;
        }
      }

      // If offline and not in cache, we cannot fetch over network
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        PENDING_REQUESTS.delete(url);
        return;
      }

      // If online and not in cache, fetch and store permanently in CacheStorage!
      try {
        const netResponse = await fetch(url, { mode: 'cors' });
        if (netResponse.ok) {
          if (cache) {
            // Save to CacheStorage for offline use
            await cache.put(url, netResponse.clone());
            notifyCacheUpdated();
          }
          const blob = await netResponse.blob();
          const objectUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            TILE_MEMORY_CACHE.set(url, img);
            PENDING_REQUESTS.delete(url);
            if (onLoaded) onLoaded();
          };
          img.onerror = () => {
            PENDING_REQUESTS.delete(url);
            URL.revokeObjectURL(objectUrl);
          };
          img.src = objectUrl;
          return;
        }
      } catch (fetchErr) {
        // Fetch failed (CORS or network dip), fallback to direct Image tag
      }

      // Fallback: Direct Image Loading
      const directImg = new Image();
      directImg.crossOrigin = 'anonymous';
      directImg.onload = () => {
        TILE_MEMORY_CACHE.set(url, directImg);
        PENDING_REQUESTS.delete(url);

        // Try to capture into CacheStorage via canvas
        if (cache) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = directImg.naturalWidth || 256;
            canvas.height = directImg.naturalHeight || 256;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(directImg, 0, 0);
              canvas.toBlob(async (blob) => {
                if (blob && cache) {
                  await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
                  notifyCacheUpdated();
                }
              }, 'image/png');
            }
          } catch (e) {}
        }

        if (onLoaded) onLoaded();
      };

      directImg.onerror = () => {
        PENDING_REQUESTS.delete(url);
        if (fallbackUrl && fallbackUrl !== url) {
          fetchTileImage(fallbackUrl, onLoaded);
        }
      };

      directImg.src = url;
    } catch (e) {
      PENDING_REQUESTS.delete(url);
    }
  };

  loadFromCacheOrNetwork();
  return null;
}

// Convert tile x, y, z to geographic bounds [minLon, minLat, maxLon, maxLat]
export function tileToGeoBounds(x: number, y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  const n2 = Math.PI - (2 * Math.PI * (y + 1)) / Math.pow(2, z);
  const minLon = (x / Math.pow(2, z)) * 360 - 180;
  const maxLon = ((x + 1) / Math.pow(2, z)) * 360 - 180;
  const maxLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const minLat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n2) - Math.exp(-n2)));
  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Render Web Mercator slippy tiles to Canvas with offline cache rendering
 */
export function renderLiveMapTiles(
  ctx: CanvasRenderingContext2D,
  provider: LiveTileProvider,
  zoom: number,
  geoToCanvas: (lon: number, lat: number, width: number, height: number) => { x: number; y: number },
  canvasToGeo: (x: number, y: number, width: number, height: number) => { lat: number; lon: number },
  width: number,
  height: number,
  onTileLoaded: () => void,
  showSeamarks: boolean = true
) {
  const providerOpt = LIVE_TILE_PROVIDERS.find(p => p.id === provider);
  const maxZ = providerOpt ? providerOpt.maxZoom : 19;
  const continuousZ = 3.8137 + Math.log2(zoom);
  const z = Math.max(1, Math.min(maxZ, Math.round(continuousZ)));

  // Calculate viewport geo bounding box
  const topLeftGeo = canvasToGeo(0, 0, width, height);
  const bottomRightGeo = canvasToGeo(width, height, width, height);

  const minLon = Math.max(-180, Math.min(topLeftGeo.lon, bottomRightGeo.lon));
  const maxLon = Math.min(180, Math.max(topLeftGeo.lon, bottomRightGeo.lon));
  const maxLat = Math.min(85.0511, Math.max(topLeftGeo.lat, bottomRightGeo.lat));
  const minLat = Math.max(-85.0511, Math.min(topLeftGeo.lat, bottomRightGeo.lat));

  // Convert geo bounds to tile bounds
  const numTiles = 1 << z;
  const minTileX = Math.floor(((minLon + 180) / 360) * numTiles);
  const maxTileX = Math.floor(((maxLon + 180) / 360) * numTiles);

  const latToTileY = (lat: number) => {
    const latRad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * numTiles
    );
  };

  const minTileY = Math.max(0, latToTileY(maxLat));
  const maxTileY = Math.min(numTiles - 1, latToTileY(minLat));

  // Render base tiles (both live and persistent cached)
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const bounds = tileToGeoBounds(tx, ty, z);
      const pTopLeft = geoToCanvas(bounds.minLon, bounds.maxLat, width, height);
      const pBottomRight = geoToCanvas(bounds.maxLon, bounds.minLat, width, height);

      const tileWidth = pBottomRight.x - pTopLeft.x;
      const tileHeight = pBottomRight.y - pTopLeft.y;

      const url = getLiveTileUrl(provider, z, tx, ty);
      const fallbackUrl = provider !== 'google_hybrid' 
        ? `https://mt1.google.com/vt/lyrs=y&x=${((tx % numTiles) + numTiles) % numTiles}&y=${ty}&z=${z}` 
        : undefined;

      const img = fetchTileImage(url, onTileLoaded, fallbackUrl);

      if (img) {
        ctx.drawImage(img, pTopLeft.x, pTopLeft.y, tileWidth, tileHeight);
      }

      // Draw OpenSeaMap Seamarks layer on top of base tile if enabled
      if (showSeamarks && z >= 8) {
        const seamarkUrl = getOpenSeaMapTileUrl(z, tx, ty);
        const seamarkImg = fetchTileImage(seamarkUrl, onTileLoaded);
        if (seamarkImg) {
          ctx.drawImage(seamarkImg, pTopLeft.x, pTopLeft.y, tileWidth, tileHeight);
        }
      }
    }
  }
}

/**
 * Get current persistent tile cache statistics
 */
export async function getCachedTileStats(): Promise<{ count: number; estimatedMb: number }> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cache = await caches.open(TILE_CACHE_NAME);
      const keys = await cache.keys();
      const count = keys.length;
      // Average tile is ~25 KB
      const estimatedMb = Number(((count * 25) / 1024).toFixed(1));
      return { count, estimatedMb };
    }
  } catch (e) {}
  return { count: 0, estimatedMb: 0 };
}

/**
 * Clear all persistent tile cache from storage
 */
export async function clearTileCache(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      await caches.delete(TILE_CACHE_NAME);
      TILE_MEMORY_CACHE.clear();
      PENDING_REQUESTS.clear();
      notifyCacheUpdated();
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Pre-cache an area for 100% offline sailing.
 * Downloads tiles across selected zoom levels and saves to CacheStorage.
 */
export async function preCacheAreaTiles(
  provider: LiveTileProvider,
  minLon: number,
  maxLon: number,
  minLat: number,
  maxLat: number,
  minZoom: number = 5,
  maxZoom: number = 12,
  onProgress?: (done: number, total: number) => void
): Promise<{ success: boolean; downloaded: number }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { success: false, downloaded: 0 };
  }

  const cache = await caches.open(TILE_CACHE_NAME);
  const urlsToDownload: string[] = [];

  const latToTileY = (lat: number, numTiles: number) => {
    const latRad = (lat * Math.PI) / 180;
    return Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * numTiles
    );
  };

  // Enumerate all tiles in the bounding box
  for (let z = minZoom; z <= maxZoom; z++) {
    const numTiles = 1 << z;
    const minTileX = Math.floor(((minLon + 180) / 360) * numTiles);
    const maxTileX = Math.floor(((maxLon + 180) / 360) * numTiles);

    const minTileY = Math.max(0, latToTileY(maxLat, numTiles));
    const maxTileY = Math.min(numTiles - 1, latToTileY(minLat, numTiles));

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        const url = getLiveTileUrl(provider, z, tx, ty);
        urlsToDownload.push(url);
      }
    }
  }

  // Deduplicate and cap to safe batch (max 1,200 tiles per pre-cache job)
  const uniqueUrls = Array.from(new Set(urlsToDownload)).slice(0, 1200);
  const total = uniqueUrls.length;
  let done = 0;

  for (const url of uniqueUrls) {
    try {
      const already = await cache.match(url);
      if (!already) {
        const resp = await fetch(url, { mode: 'cors' });
        if (resp.ok) {
          await cache.put(url, resp);
        }
      }
    } catch (e) {}

    done++;
    if (onProgress) onProgress(done, total);
  }

  notifyCacheUpdated();
  return { success: true, downloaded: done };
}
