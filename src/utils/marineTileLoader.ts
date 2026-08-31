/**
 * Marine Live Tile Loader & Web Mercator Tile Caching Engine
 * 
 * Optimized for global & Iran regional accessibility (No VPN required):
 * - Google Satellite (High-res coastal & reefs, unfiltered in Iran)
 * - Google Marine Hybrid (Satellite + place/port names, unfiltered in Iran)
 * - Google Roadmap / Nautical (Fast vector raster, unfiltered in Iran)
 * - OpenStreetMap Fast Unblocked Mirrors (tile.openstreetmap.de, osm.fr)
 * - ESRI World Ocean & Bathymetry
 * - ESRI World Satellite Imagery
 * - Custom Tile Server URL template (e.g. https://tile-server/{z}/{x}/{y}.png)
 * - OpenSeaMap Seamarks Nautical Overlay
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
    badge: '🇮🇷 No VPN Required',
    description: 'High-resolution satellite with coastal labels, ports, and sea borders (Unblocked)',
    maxZoom: 20
  },
  {
    id: 'google_satellite',
    name: 'Google World Satellite',
    badge: '🇮🇷 No VPN Required',
    description: 'Crystal-clear satellite imagery of coastlines, shallow reefs, and seabed (Unblocked)',
    maxZoom: 20
  },
  {
    id: 'google_nautical',
    name: 'Google Standard Roadmap',
    badge: '🇮🇷 No VPN Required',
    description: 'Fast raster roadmap with clear ports, marinas, and coastal land details',
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

const TILE_CACHE = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 400;
const CUSTOM_TILE_STORAGE_KEY = 'mariner_custom_tile_url_v1';

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
      // Google hybrid (satellite + labels) - Highly accessible in Iran without VPN
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=y&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'google_satellite': {
      // Google raw satellite - Unblocked in Iran
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=s&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'google_nautical': {
      // Google standard roadmap/coastal - Unblocked in Iran
      const s = (wrappedX + y) % 4;
      return `https://mt${s}.google.com/vt/lyrs=m&x=${wrappedX}&y=${y}&z=${z}`;
    }
    case 'osm_mirror_de': {
      // German OSM Mirror - Fast and unfiltered in Iran
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

function fetchTileImage(
  url: string, 
  onLoaded?: () => void, 
  fallbackUrl?: string
): HTMLImageElement | null {
  if (TILE_CACHE.has(url)) {
    const img = TILE_CACHE.get(url)!;
    if (img.complete && img.naturalWidth > 0) {
      return img;
    }
    return null;
  }

  // Enforce LRU cache prune
  if (TILE_CACHE.size >= MAX_CACHE_SIZE) {
    const firstKey = TILE_CACHE.keys().next().value;
    if (firstKey) TILE_CACHE.delete(firstKey);
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  
  img.onload = () => {
    if (onLoaded) onLoaded();
  };

  img.onerror = () => {
    // If primary URL failed (e.g. timeout or blocked) and fallback is available, try fallback
    if (fallbackUrl && fallbackUrl !== url) {
      img.onerror = null;
      img.src = fallbackUrl;
    }
  };

  TILE_CACHE.set(url, img);
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
 * Render Web Mercator slippy tiles to Canvas
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
  // Slippy tile zoom level (discrete integer)
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

  // Render base tiles
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const bounds = tileToGeoBounds(tx, ty, z);
      const pTopLeft = geoToCanvas(bounds.minLon, bounds.maxLat, width, height);
      const pBottomRight = geoToCanvas(bounds.maxLon, bounds.minLat, width, height);

      const tileWidth = pBottomRight.x - pTopLeft.x;
      const tileHeight = pBottomRight.y - pTopLeft.y;

      const url = getLiveTileUrl(provider, z, tx, ty);
      // Failover URL if non-Google fails: use Google hybrid as unblocked fallback
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
