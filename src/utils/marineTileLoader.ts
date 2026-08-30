/**
 * Marine Live Tile Loader & Web Mercator Tile Caching Engine
 * Supports ESRI World Ocean Bathymetry, CartoDB Voyager (Unblocked & Fast),
 * ESRI High-Resolution Satellite, OpenStreetMap, and OpenSeaMap Seamarks Overlay.
 */

export type LiveTileProvider = 'esri_ocean' | 'carto_voyager' | 'esri_satellite' | 'osm';

export interface TileProviderOption {
  id: LiveTileProvider;
  name: string;
  description: string;
  maxZoom: number;
}

export const LIVE_TILE_PROVIDERS: TileProviderOption[] = [
  {
    id: 'esri_ocean',
    name: 'ESRI Ocean & Bathymetry',
    description: 'Specialized marine bathymetry, depth contours, coastal seabed topography',
    maxZoom: 16
  },
  {
    id: 'carto_voyager',
    name: 'CartoDB Voyager (Fast & Unfiltered)',
    description: 'High-speed raster tiles with sharp coastal boundaries and port features',
    maxZoom: 18
  },
  {
    id: 'esri_satellite',
    name: 'ESRI World Satellite Imagery',
    description: 'High-resolution realistic satellite imagery of sea, reefs, and coastlines',
    maxZoom: 18
  },
  {
    id: 'osm',
    name: 'OpenStreetMap Nautical Standard',
    description: 'Standard world map with streets, ports, and navigational landmarks',
    maxZoom: 18
  }
];

const TILE_CACHE = new Map<string, HTMLImageElement>();
const MAX_CACHE_SIZE = 300;

export function getLiveTileUrl(provider: LiveTileProvider, z: number, x: number, y: number): string {
  // Wrap X for world wrap-around
  const maxTile = 1 << z;
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;

  switch (provider) {
    case 'esri_ocean':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/${z}/${y}/${wrappedX}`;
    case 'carto_voyager': {
      const subdomains = ['a', 'b', 'c', 'd'];
      const sub = subdomains[(wrappedX + y) % subdomains.length];
      return `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${wrappedX}/${y}.png`;
    }
    case 'esri_satellite':
      return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${wrappedX}`;
    case 'osm': {
      const subdomains = ['a', 'b', 'c'];
      const sub = subdomains[(wrappedX + y) % subdomains.length];
      return `https://${sub}.tile.openstreetmap.org/${z}/${wrappedX}/${y}.png`;
    }
    default:
      return `https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/${z}/${y}/${wrappedX}`;
  }
}

export function getOpenSeaMapTileUrl(z: number, x: number, y: number): string {
  const maxTile = 1 << z;
  const wrappedX = ((x % maxTile) + maxTile) % maxTile;
  return `https://tiles.openseamap.org/seamark/${z}/${wrappedX}/${y}.png`;
}

function fetchTileImage(url: string, onLoaded?: () => void): HTMLImageElement | null {
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
    // Keep placeholder or delete to avoid re-request loop
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
  // Approximate slippy tile zoom level (discrete integer)
  // formula: Z = clamp(round(3.8137 + log2(zoom)), 1, maxZoom)
  const providerOpt = LIVE_TILE_PROVIDERS.find(p => p.id === provider);
  const maxZ = providerOpt ? providerOpt.maxZoom : 17;
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
      const img = fetchTileImage(url, onTileLoaded);

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
