import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  Minus, 
  Crosshair, 
  Compass, 
  MapPin, 
  MapPinPlus,
  Undo2,
  X,
  Layers, 
  Navigation2, 
  LocateFixed,
  Maximize,
  Maximize2,
  Minimize2,
  Waves,
  Anchor,
  Tag,
  Flag,
  AlertTriangle,
  Radio,
  Clock,
  Gauge,
  Navigation,
  Globe,
  Wifi,
  WifiOff,
  Flame,
  Zap,
  Activity,
  Wind,
  Download,
  HardDrive,
  Trash2,
  CheckCircle2,
  Database,
  Search,
  Sparkles
} from 'lucide-react';
import { GpsData, CompassData, MarineRoute, Waypoint, NavigationSession, UserTag, WorkingAreaRecord } from '../types';
import { WorkingAreaModal } from './WorkingAreaModal';
import { UserTagModal } from './UserTagModal';
import { 
  WORLD_LANDMASSES, 
  INLAND_WATER_BODIES,
  BATHYMETRY_CONTOURS, 
  NAUTICAL_SOUNDINGS,
  MARINE_PLACE_LABELS,
  MARINE_LIGHTHOUSES,
  SHIPPING_LANES_TSS,
  MARINE_ANCHORAGES,
  MARINE_HAZARDS,
  MARINE_OIL_PLATFORMS,
  MARINE_BUOYS,
  SUBMARINE_PIPELINES_AND_CABLES,
  TIDAL_STREAM_VECTORS,
  MarinePlaceLabel,
  MarineLighthouse,
  MarineOilPlatform,
  MarineBuoy
} from '../utils/marineMapData';
import { 
  formatMarineDDM, 
  calculateDistanceNm, 
  calculateBearing,
  formatHeadingDeg,
  formatEta,
  headingToCardinal
} from '../utils/geo';
import {
  LiveTileProvider,
  LIVE_TILE_PROVIDERS,
  renderLiveMapTiles,
  getSavedCustomTileUrl,
  saveCustomTileUrl,
  getCachedTileStats,
  clearTileCache,
  preCacheAreaTiles,
  subscribeTileCacheUpdates
} from '../utils/marineTileLoader';

interface OfflineMarineChartProps {
  gps: GpsData;
  compass: CompassData;
  activeRoute: MarineRoute | null;
  targetWaypoint: Waypoint | null;
  navigationSession: NavigationSession;
  isNightMode?: boolean;
  onMapClickAddWaypoint?: (lat: number, lon: number) => void;
  isAddWaypointMode?: boolean;
  onToggleAddWaypointMode?: () => void;
  onClearLastWaypoint?: () => void;
  onSelectWaypoint?: (wp: Waypoint) => void;
  headingMode?: 'gps' | 'compass';
  onHeadingModeChange?: (mode: 'gps' | 'compass') => void;
}

export const OfflineMarineChart: React.FC<OfflineMarineChartProps> = ({
  gps,
  compass,
  activeRoute,
  targetWaypoint,
  navigationSession,
  isNightMode = false,
  onMapClickAddWaypoint,
  isAddWaypointMode = false,
  onToggleAddWaypointMode,
  onClearLastWaypoint,
  onSelectWaypoint,
  headingMode: headingModeProp,
  onHeadingModeChange: onHeadingModeChangeProp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const waypointCount = activeRoute?.waypoints?.length || 0;

  const handleToggleAddWaypointMode = () => {
    if (onToggleAddWaypointMode) {
      onToggleAddWaypointMode();
    }
  };

  const handleClearLastWaypoint = () => {
    if (onClearLastWaypoint) {
      onClearLastWaypoint();
    }
  };

  // Heading mode state: 'gps' (Course Over Ground, default) or 'compass' (Magnetic sensor)
  const [internalHeadingMode, setInternalHeadingMode] = useState<'gps' | 'compass'>(() => {
    try {
      const saved = localStorage.getItem('mariner_chart_heading_mode_v2');
      if (saved === 'gps' || saved === 'compass') return saved;
    } catch (e) {}
    return 'gps';
  });

  const activeHeadingMode = headingModeProp ?? internalHeadingMode;
  const setHeadingMode = (mode: 'gps' | 'compass') => {
    setInternalHeadingMode(mode);
    try {
      localStorage.setItem('mariner_chart_heading_mode_v2', mode);
    } catch (e) {}
    if (onHeadingModeChangeProp) onHeadingModeChangeProp(mode);
  };

  // Vessel real or reference coordinates (Default Kish Island area)
  const vesselLon = gps.longitude !== null ? gps.longitude : 53.9900;
  const vesselLat = gps.latitude !== null ? gps.latitude : 26.5400;

  // Center state in geographic coordinates [lon, lat]
  const [center, setCenter] = useState<[number, number]>([vesselLon, vesselLat]);

  // Zoom level: 5 = world view, 800 = harbor close-up
  const [zoom, setZoom] = useState<number>(55);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoFollowVessel, setAutoFollowVessel] = useState<boolean>(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  
  // Full Screen State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Map Mode: High-Resolution Marine Tiles (Google/OSM/ESRI with persistent offline cache) vs Pure Vector Nautical Chart
  const [mapMode, setMapMode] = useState<'high_res' | 'vector'>(() => {
    try {
      const saved = localStorage.getItem('mariner_map_mode_v3');
      if (saved === 'high_res' || saved === 'vector') return saved;
    } catch (e) {}
    return 'high_res';
  });

  const [liveProvider, setLiveProvider] = useState<LiveTileProvider>(() => {
    try {
      const saved = localStorage.getItem('mariner_live_provider_v3') as LiveTileProvider;
      if (saved && LIVE_TILE_PROVIDERS.some(p => p.id === saved)) return saved;
    } catch (e) {}
    return 'google_hybrid';
  });

  const [customTileUrlInput, setCustomTileUrlInput] = useState<string>(() => getSavedCustomTileUrl());
  const [showLiveSeamarks, setShowLiveSeamarks] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Persistent Offline Tile Cache Statistics & Pre-caching state
  const [cacheStats, setCacheStats] = useState<{ count: number; estimatedMb: number }>({ count: 0, estimatedMb: 0 });
  const [isPreCaching, setIsPreCaching] = useState<boolean>(false);
  const [preCacheProgress, setPreCacheProgress] = useState<{ done: number; total: number } | null>(null);
  const [preCacheSuccess, setPreCacheSuccess] = useState<string | null>(null);

  // Layer toggles
  const [showBathymetry, setShowBathymetry] = useState<boolean>(true);
  const [showGraticule, setShowGraticule] = useState<boolean>(true);
  const [showSoundings, setShowSoundings] = useState<boolean>(true);
  const [showPlaceLabels, setShowPlaceLabels] = useState<boolean>(true);
  const [showLighthouses, setShowLighthouses] = useState<boolean>(true);
  const [showShippingLanes, setShowShippingLanes] = useState<boolean>(true);
  const [showAnchorages, setShowAnchorages] = useState<boolean>(true);
  const [showHazards, setShowHazards] = useState<boolean>(true);
  const [showOilPlatforms, setShowOilPlatforms] = useState<boolean>(true);
  const [showBuoys, setShowBuoys] = useState<boolean>(true);
  const [showPipelines, setShowPipelines] = useState<boolean>(true);
  const [showTidalStreams, setShowTidalStreams] = useState<boolean>(true);
  const [showRangeRings, setShowRangeRings] = useState<boolean>(true);
  const [showLayersMenu, setShowLayersMenu] = useState<boolean>(false);

  // User Custom Tags & Places (Distinctive vibrant color pins and labels)
  const [userTags, setUserTags] = useState<UserTag[]>(() => {
    try {
      const saved = localStorage.getItem('mariner_user_tags_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [tagToEdit, setTagToEdit] = useState<UserTag | null>(null);
  const [tagInitialCoords, setTagInitialCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [showUserTags, setShowUserTags] = useState<boolean>(true);
  const [isAddFlagMode, setIsAddFlagMode] = useState<boolean>(false);

  // Download Working Area Modal state
  const [isWorkingAreaModalOpen, setIsWorkingAreaModalOpen] = useState<boolean>(false);

  // Touch & Drag tracking for smooth panning and pinch-to-zoom
  const touchDistanceRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number>(0);
  const touchStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const zoomRef = useRef<number>(zoom);
  const centerRef = useRef<[number, number]>(center);
  const animPhaseRef = useRef<number>(0);
  const renderTriggerRef = useRef<number>(0);
  const lastValidGpsHeadingRef = useRef<number | null>(null);
  if (gps.heading !== null && !isNaN(gps.heading)) {
    lastValidGpsHeadingRef.current = gps.heading;
  }

  // Keep zoom and center refs in sync
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  // Persist Map Mode & Provider
  useEffect(() => {
    try {
      localStorage.setItem('mariner_map_mode_v3', mapMode);
    } catch (e) {}
  }, [mapMode]);

  useEffect(() => {
    try {
      localStorage.setItem('mariner_live_provider_v3', liveProvider);
    } catch (e) {}
  }, [liveProvider]);

  // Subscribe to Persistent Tile Cache Updates
  useEffect(() => {
    const updateStats = () => {
      getCachedTileStats().then(setCacheStats);
    };
    updateStats();
    const unsub = subscribeTileCacheUpdates(updateStats);
    return () => unsub();
  }, []);

  // Monitor network connectivity (Do NOT force switch away from high-res tiles when offline!)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle Fullscreen Toggle using pure CSS full-viewport overlay
  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  // Escape key handler for fullscreen exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Auto-center on navigation corridor when navigation starts or target changes
  useEffect(() => {
    if (navigationSession.isNavigating && targetWaypoint) {
      const midLon = (vesselLon + targetWaypoint.longitude) / 2;
      const midLat = (vesselLat + targetWaypoint.latitude) / 2;
      setCenter([midLon, midLat]);
      setAutoFollowVessel(false);

      const dist = calculateDistanceNm(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude);
      if (dist > 180) setZoom(14);
      else if (dist > 90) setZoom(24);
      else if (dist > 45) setZoom(38);
      else if (dist > 20) setZoom(55);
      else if (dist > 8) setZoom(80);
      else setZoom(120);
    }
  }, [navigationSession.isNavigating, targetWaypoint?.id, vesselLat, vesselLon]);

  // Auto-center on vessel if GPS updates and auto-follow is active
  useEffect(() => {
    if (autoFollowVessel && gps.latitude !== null && gps.longitude !== null) {
      setCenter([gps.longitude, gps.latitude]);
    }
  }, [gps.latitude, gps.longitude, autoFollowVessel]);

// Web Mercator standard conformal projection formulas (EPSG:3857)
const lonToMercatorX = (lon: number): number => {
  return (lon + 180) / 360;
};

const latToMercatorY = (lat: number): number => {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
};

const mercatorXToLon = (x: number): number => {
  return x * 360 - 180;
};

const mercatorYToLat = (y: number): number => {
  const y2 = (180 - y * 360) * Math.PI / 180;
  return (180 / Math.PI) * (2 * Math.atan(Math.exp(y2)) - Math.PI / 2);
};

/**
 * Natural spline polygon renderer.
 * Converts sharp polygon vertices into smooth, organic, hydrographically authentic coastlines.
 */
function drawSmoothPolygon(
  ctx: CanvasRenderingContext2D,
  screenPoints: { x: number; y: number }[],
  tension: number = 0.22
) {
  const len = screenPoints.length;
  if (len < 3) return;

  ctx.beginPath();
  ctx.moveTo(screenPoints[0].x, screenPoints[0].y);

  for (let i = 0; i < len; i++) {
    const pPrev = screenPoints[(i - 1 + len) % len];
    const pCur = screenPoints[i];
    const pNext = screenPoints[(i + 1) % len];
    const pNextNext = screenPoints[(i + 2) % len];

    const cp1x = pCur.x + (pNext.x - pPrev.x) * tension;
    const cp1y = pCur.y + (pNext.y - pPrev.y) * tension;
    const cp2x = pNext.x - (pNextNext.x - pCur.x) * tension;
    const cp2y = pNext.y - (pNextNext.y - pCur.y) * tension;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pNext.x, pNext.y);
  }
  ctx.closePath();
}

  // Coordinate Conversion Functions (Standard Web Mercator conformal projection)
  const geoToCanvas = useCallback((lon: number, lat: number, width: number, height: number) => {
    const curZoom = zoomRef.current;
    const curCenter = centerRef.current;
    const worldPixels = curZoom * 3600;
    const cx = lonToMercatorX(curCenter[0]) * worldPixels;
    const cy = latToMercatorY(curCenter[1]) * worldPixels;

    let dLon = ((lon - curCenter[0] + 540) % 360) - 180;
    const px = lonToMercatorX(curCenter[0] + dLon) * worldPixels;
    const py = latToMercatorY(lat) * worldPixels;

    const x = width / 2 + (px - cx);
    const y = height / 2 + (py - cy);
    return { x, y };
  }, []);

  const canvasToGeo = useCallback((x: number, y: number, width: number, height: number) => {
    const curZoom = zoomRef.current;
    const curCenter = centerRef.current;
    const worldPixels = curZoom * 3600;
    const cx = lonToMercatorX(curCenter[0]) * worldPixels;
    const cy = latToMercatorY(curCenter[1]) * worldPixels;

    const px = cx + (x - width / 2);
    const py = cy + (y - height / 2);

    const normX = ((px / worldPixels) % 1 + 1) % 1;
    const lon = mercatorXToLon(normX);
    const lat = mercatorYToLat(py / worldPixels);
    return { lat, lon };
  }, []);

  const triggerTileRedraw = useCallback(() => {
    renderTriggerRef.current = (renderTriggerRef.current + 1) % 1000;
  }, []);

  // Pre-cache marine viewport tiles for offline voyage
  const handlePreCacheCurrentView = useCallback(async () => {
    if (isPreCaching) return;
    setIsPreCaching(true);
    setPreCacheProgress({ done: 0, total: 100 });
    setPreCacheSuccess(null);

    const canvas = canvasRef.current;
    const w = canvas ? canvas.width : 800;
    const h = canvas ? canvas.height : 600;
    const tl = canvasToGeo(0, 0, w, h);
    const br = canvasToGeo(w, h, w, h);

    const minLon = Math.max(-180, Math.min(tl.lon, br.lon));
    const maxLon = Math.min(180, Math.max(tl.lon, br.lon));
    const minLat = Math.max(-85, Math.min(tl.lat, br.lat));
    const maxLat = Math.min(85, Math.max(tl.lat, br.lat));

    const currentZ = Math.max(2, Math.min(18, Math.round(3.8137 + Math.log2(zoom))));
    const minZ = Math.max(2, currentZ - 2);
    const maxZ = Math.min(15, currentZ + 2);

    try {
      const res = await preCacheAreaTiles(
        liveProvider,
        minLon,
        maxLon,
        minLat,
        maxLat,
        minZ,
        maxZ,
        (done, total) => {
          setPreCacheProgress({ done, total });
        }
      );
      if (res.success) {
        setPreCacheSuccess(`Cached ${res.downloaded} tiles! Ready 100% offline.`);
        setTimeout(() => setPreCacheSuccess(null), 4000);
      }
    } catch (e) {
      setPreCacheSuccess('Pre-cache finished with partial tiles.');
      setTimeout(() => setPreCacheSuccess(null), 3000);
    } finally {
      setIsPreCaching(false);
      setPreCacheProgress(null);
      getCachedTileStats().then(setCacheStats);
      triggerTileRedraw();
    }
  }, [isPreCaching, zoom, liveProvider, canvasToGeo, triggerTileRedraw]);

  // Pre-cache predefined regional zone (e.g. Persian Gulf or Caspian Sea)
  const handlePreCacheRegion = useCallback(async (regionName: 'persian_gulf' | 'caspian_sea') => {
    if (isPreCaching) return;
    setIsPreCaching(true);
    setPreCacheProgress({ done: 0, total: 100 });
    setPreCacheSuccess(null);

    const bounds = regionName === 'persian_gulf'
      ? { minLon: 48.0, maxLon: 57.5, minLat: 24.0, maxLat: 30.5 }
      : { minLon: 46.5, maxLon: 54.5, minLat: 36.5, maxLat: 47.0 };

    try {
      const res = await preCacheAreaTiles(
        liveProvider,
        bounds.minLon,
        bounds.maxLon,
        bounds.minLat,
        bounds.maxLat,
        4,
        10,
        (done, total) => {
          setPreCacheProgress({ done, total });
        }
      );
      if (res.success) {
        setPreCacheSuccess(`Pre-cached ${regionName === 'persian_gulf' ? 'Persian Gulf' : 'Caspian Sea'} (${res.downloaded} tiles)!`);
        setTimeout(() => setPreCacheSuccess(null), 5000);
      }
    } catch (e) {
      setPreCacheSuccess('Pre-caching encountered network timeout.');
      setTimeout(() => setPreCacheSuccess(null), 3000);
    } finally {
      setIsPreCaching(false);
      setPreCacheProgress(null);
      getCachedTileStats().then(setCacheStats);
      triggerTileRedraw();
    }
  }, [isPreCaching, liveProvider, triggerTileRedraw]);

  const handleClearCache = useCallback(async () => {
    if (confirm('Clear all stored offline marine map tiles?')) {
      await clearTileCache();
      const stats = await getCachedTileStats();
      setCacheStats(stats);
      triggerTileRedraw();
    }
  }, [triggerTileRedraw]);

  // User Custom Tag Handlers
  const handleSaveUserTag = useCallback((tag: UserTag) => {
    setUserTags((prev) => {
      const exists = prev.some((t) => t.id === tag.id);
      const updated = exists ? prev.map((t) => (t.id === tag.id ? tag : t)) : [...prev, tag];
      try {
        localStorage.setItem('mariner_user_tags_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleDeleteUserTag = useCallback((id: string) => {
    setUserTags((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      try {
        localStorage.setItem('mariner_user_tags_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const handleNavigateToUserTag = useCallback((tag: UserTag) => {
    if (onMapClickAddWaypoint) {
      onMapClickAddWaypoint(tag.latitude, tag.longitude);
    }
  }, [onMapClickAddWaypoint]);

  // Main Canvas Rendering Engine
  const renderChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    animPhaseRef.current = (animPhaseRef.current + 0.04) % (Math.PI * 2);
    const animPhase = animPhaseRef.current;

    // =========================================================================
    // 1. BASE HYDROGRAPHIC WATER & UNDERLYING SHORELINE VECTORS
    // =========================================================================
    // 1. Deep Oceanic Water Base Fill (Admiralty Deep Blue)
    ctx.fillStyle = isNightMode ? '#080404' : '#071626';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw World Landmass Polygons & Outer Coastlines (Warm Nautical Khaki with Organic Spline Curves)
    WORLD_LANDMASSES.forEach((land) => {
      if (land.points.length < 3) return;
      const screenPts = land.points.map(([lon, lat]) => geoToCanvas(lon, lat, width, height));

      // Bounding box screen culling check
      let minX = screenPts[0].x, maxX = screenPts[0].x;
      let minY = screenPts[0].y, maxY = screenPts[0].y;
      for (let i = 1; i < screenPts.length; i++) {
        const pt = screenPts[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      if (maxX < -80 || minX > width + 80 || maxY < -80 || minY > height + 80) {
        return;
      }

      // Draw natural, organic shoreline curves
      drawSmoothPolygon(ctx, screenPts, 0.22);

      // Land fill color: Authentic Nautical Chart Buff / Khaki tone
      ctx.fillStyle = isNightMode ? '#2d2215' : '#d8c79d';
      ctx.fill();

      // Coastal shallow intertidal fringe (gives authentic hydrographic depth)
      ctx.strokeStyle = isNightMode ? 'rgba(110, 79, 37, 0.35)' : 'rgba(18, 72, 99, 0.28)';
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Coastline stroke: Rich ochre shoreline border
      ctx.strokeStyle = isNightMode ? '#6e4f25' : '#9b824f';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });

    // 3. Draw Inland Water Bodies & Major Regional Seas (Caspian Sea, Black Sea, Sea of Azov, Sea of Marmara, Lakes)
    INLAND_WATER_BODIES.forEach((water) => {
      if (water.points.length < 3) return;
      const screenPts = water.points.map(([lon, lat]) => geoToCanvas(lon, lat, width, height));

      let minX = screenPts[0].x, maxX = screenPts[0].x;
      let minY = screenPts[0].y, maxY = screenPts[0].y;
      for (let i = 1; i < screenPts.length; i++) {
        const pt = screenPts[i];
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      if (maxX < -80 || minX > width + 80 || maxY < -80 || minY > height + 80) {
        return;
      }

      drawSmoothPolygon(ctx, screenPts, 0.18);

      // Water fill color (Deep Admiralty Blue)
      ctx.fillStyle = isNightMode ? '#080404' : '#071626';
      ctx.fill();

      // Coastal shallow fringe
      ctx.strokeStyle = isNightMode ? 'rgba(110, 79, 37, 0.35)' : 'rgba(18, 72, 99, 0.28)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Coastline stroke: Rich ochre shoreline border
      ctx.strokeStyle = isNightMode ? '#6e4f25' : '#9b824f';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });

    // Re-draw any islands situated inside inland water bodies (e.g. Ashuradeh in Caspian, Snake Island in Black Sea)
    WORLD_LANDMASSES.filter(l => l.name.includes('Ashuradeh') || l.name.includes('Ogurchinskiy') || l.name.includes('Snake Island')).forEach((island) => {
      if (island.points.length < 3) return;
      const screenPts = island.points.map(([lon, lat]) => geoToCanvas(lon, lat, width, height));
      drawSmoothPolygon(ctx, screenPts, 0.2);
      ctx.fillStyle = isNightMode ? '#2d2215' : '#d8c79d';
      ctx.fill();
      ctx.strokeStyle = isNightMode ? '#6e4f25' : '#9b824f';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    });

    // 4. Draw Bathymetry Depth Zones & Contours
    if (showBathymetry && mapMode === 'vector') {
      BATHYMETRY_CONTOURS.forEach((contour) => {
        if (contour.points.length < 3) return;
        const screenPts = contour.points.map(([lon, lat]) => geoToCanvas(lon, lat, width, height));

        let minX = screenPts[0].x, maxX = screenPts[0].x;
        let minY = screenPts[0].y, maxY = screenPts[0].y;
        for (let i = 1; i < screenPts.length; i++) {
          const pt = screenPts[i];
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
        if (maxX < -80 || minX > width + 80 || maxY < -80 || minY > height + 80) {
          return;
        }

        drawSmoothPolygon(ctx, screenPts, 0.18);

        // Nautical depth color graduation
        if (contour.depthMeters <= 5) {
          ctx.fillStyle = isNightMode ? '#220b0b' : '#1e5f78';
        } else if (contour.depthMeters <= 10) {
          ctx.fillStyle = isNightMode ? '#1c0909' : '#164e63';
        } else if (contour.depthMeters <= 20) {
          ctx.fillStyle = isNightMode ? '#160707' : '#0e3b52';
        } else if (contour.depthMeters <= 50) {
          ctx.fillStyle = isNightMode ? '#120505' : '#0b2b40';
        } else if (contour.depthMeters <= 80) {
          ctx.fillStyle = isNightMode ? '#0e0404' : '#082234';
        } else {
          ctx.fillStyle = isNightMode ? '#0a0303' : '#071a28';
        }
        ctx.fill();

        // Depth Contour boundary line
        ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.28)' : 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Depth Label
        if (zoom > 15 && contour.points.length > 2) {
          const midPt = geoToCanvas(contour.points[0][0], contour.points[0][1], width, height);
          if (midPt.x > 0 && midPt.x < width && midPt.y > 0 && midPt.y < height) {
            ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(56, 189, 248, 0.75)';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(`${contour.depthMeters}m`, midPt.x, midPt.y);
          }
        }
      });
    }

    // =========================================================================
    // 1B. HIGH-RESOLUTION WEB MERCATOR TILES (Live Network + 100% Persistent Offline Cache)
    // =========================================================================
    if (mapMode === 'high_res') {
      renderLiveMapTiles(
        ctx,
        liveProvider,
        zoom,
        geoToCanvas,
        canvasToGeo,
        width,
        height,
        triggerTileRedraw,
        showLiveSeamarks
      );
    } else if (mapMode === 'vector') {
      // High-Definition Electronic Navigational Chart (ENC Vector Nautical Chart)
      renderLiveMapTiles(
        ctx,
        'google_nautical',
        zoom,
        geoToCanvas,
        canvasToGeo,
        width,
        height,
        triggerTileRedraw,
        showLiveSeamarks
      );
    }

    // =========================================================================
    // 2. GEOGRAPHIC GRATICULE (Lat/Lon Grid)
    // =========================================================================
    if (showGraticule) {
      ctx.strokeStyle = isNightMode ? 'rgba(220, 38, 38, 0.14)' : 'rgba(56, 189, 248, 0.16)';
      ctx.lineWidth = 1;
      ctx.fillStyle = isNightMode ? 'rgba(248, 113, 113, 0.7)' : 'rgba(148, 163, 184, 0.8)';
      ctx.font = '9px monospace';

      const bounds = {
        minLon: canvasToGeo(0, height, width, height).lon,
        maxLon: canvasToGeo(width, 0, width, height).lon,
        minLat: canvasToGeo(0, height, width, height).lat,
        maxLat: canvasToGeo(width, 0, width, height).lat,
      };

      const step = 
        zoom > 200000 ? 0.00005 :
        zoom > 80000  ? 0.0001 :
        zoom > 30000  ? 0.0005 :
        zoom > 10000  ? 0.001 :
        zoom > 3000   ? 0.002 :
        zoom > 1000   ? 0.005 :
        zoom > 400    ? 0.01 :
        zoom > 150    ? 0.05 : 
        zoom > 70     ? 0.1 : 
        zoom > 30     ? 0.5 : 
        zoom > 10     ? 1 : 5;

      const startLon = Math.floor(bounds.minLon / step) * step;
      const maxLon = Math.ceil(bounds.maxLon / step) * step;
      const startLat = Math.floor(bounds.minLat / step) * step;
      const maxLat = Math.ceil(bounds.maxLat / step) * step;

      const decimals = step < 0.0001 ? 5 : step < 0.001 ? 4 : step < 0.01 ? 3 : step < 0.1 ? 2 : step < 1 ? 1 : 0;

      // Longitude lines
      for (let lon = startLon; lon <= maxLon; lon += step) {
        const pt = geoToCanvas(lon, center[1], width, height);
        ctx.beginPath();
        ctx.moveTo(pt.x, 0);
        ctx.lineTo(pt.x, height);
        ctx.stroke();

        const label = `${Math.abs(lon).toFixed(decimals)}°${lon >= 0 ? 'E' : 'W'}`;
        ctx.fillText(label, pt.x + 4, height - 8);
      }

      // Latitude lines
      for (let lat = startLat; lat <= maxLat; lat += step) {
        const pt = geoToCanvas(center[0], lat, width, height);
        ctx.beginPath();
        ctx.moveTo(0, pt.y);
        ctx.lineTo(width, pt.y);
        ctx.stroke();

        const label = `${Math.abs(lat).toFixed(decimals)}°${lat >= 0 ? 'N' : 'S'}`;
        ctx.fillText(label, 8, pt.y - 4);
      }
    }

    // =========================================================================
    // 3. SUBMARINE PIPELINES, POWER CABLES & RESTRICTED AREAS
    // =========================================================================
    if (showPipelines && zoom >= 12) {
      SUBMARINE_PIPELINES_AND_CABLES.forEach((pipe) => {
        if (pipe.points.length < 2) return;

        ctx.save();
        ctx.beginPath();
        pipe.points.forEach(([lon, lat], idx) => {
          const pt = geoToCanvas(lon, lat, width, height);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });

        if (pipe.type === 'gas_pipeline') {
          ctx.strokeStyle = isNightMode ? '#ef4444' : '#06b6d4';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([8, 6, 2, 6]);
          ctx.stroke();
        } else if (pipe.type === 'oil_pipeline') {
          ctx.strokeStyle = isNightMode ? '#f97316' : '#eab308';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([10, 4]);
          ctx.stroke();
        } else if (pipe.type === 'power_cable') {
          ctx.strokeStyle = isNightMode ? '#ec4899' : '#d946ef';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        } else if (pipe.type === 'restricted_area') {
          ctx.closePath();
          ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(236, 72, 153, 0.15)';
          ctx.fill();
          ctx.strokeStyle = isNightMode ? '#ef4444' : '#ec4899';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 6]);
          ctx.stroke();
        }

        ctx.setLineDash([]);

        if (zoom >= 20 && pipe.points.length >= 2) {
          const midIdx = Math.floor(pipe.points.length / 2);
          const midPt = geoToCanvas(pipe.points[midIdx][0], pipe.points[midIdx][1], width, height);
          ctx.font = 'bold 8.5px monospace';
          ctx.fillStyle = isNightMode ? '#fca5a5' : '#67e8f9';
          ctx.textAlign = 'center';
          ctx.fillText(pipe.name, midPt.x, midPt.y - 6);
        }
        ctx.restore();
      });
    }

    // =========================================================================
    // 4. TRAFFIC SEPARATION SCHEMES (TSS Shipping Lanes)
    // =========================================================================
    if (showShippingLanes && zoom >= 10) {
      SHIPPING_LANES_TSS.forEach((lane) => {
        if (lane.points.length < 2) return;

        ctx.save();
        ctx.beginPath();
        lane.points.forEach(([lon, lat], idx) => {
          const pt = geoToCanvas(lon, lat, width, height);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });

        if (lane.laneType === 'separation_zone') {
          ctx.strokeStyle = isNightMode ? 'rgba(236, 72, 153, 0.4)' : 'rgba(217, 70, 239, 0.45)';
          ctx.lineWidth = 6;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        } else {
          ctx.strokeStyle = isNightMode ? 'rgba(244, 114, 182, 0.7)' : 'rgba(217, 70, 239, 0.8)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 6]);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Directional arrow on lane
        if (lane.points.length >= 2 && zoom >= 18) {
          const midIdx = Math.floor(lane.points.length / 2);
          const p1 = geoToCanvas(lane.points[midIdx - 1][0], lane.points[midIdx - 1][1], width, height);
          const p2 = geoToCanvas(lane.points[midIdx][0], lane.points[midIdx][1], width, height);
          const arrowX = (p1.x + p2.x) / 2;
          const arrowY = (p1.y + p2.y) / 2;
          const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(angle);
          ctx.fillStyle = isNightMode ? '#f472b6' : '#d946ef';
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(-6, -5);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-6, 5);
          ctx.closePath();
          ctx.fill();

          if (zoom >= 25) {
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = isNightMode ? '#fbcfe8' : '#fae8ff';
            ctx.textAlign = 'center';
            ctx.fillText(lane.name, 0, -8);
          }
          ctx.restore();
        }
        ctx.restore();
      });
    }

    // =========================================================================
    // 5. MARINE ANCHORAGES & HAZARDS
    // =========================================================================
    if (showAnchorages && zoom >= 16) {
      MARINE_ANCHORAGES.forEach((anc) => {
        const pt = geoToCanvas(anc.lon, anc.lat, width, height);
        if (pt.x < -40 || pt.x > width + 40 || pt.y < -40 || pt.y > height + 40) return;

        ctx.save();
        const radiusPx = (anc.radiusNm / 60) * (zoom * 10);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(8, radiusPx), 0, Math.PI * 2);
        ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.6)' : 'rgba(20, 184, 166, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚓', pt.x, pt.y);

        if (zoom >= 24) {
          ctx.font = 'bold 9px sans-serif';
          ctx.fillStyle = isNightMode ? '#fca5a5' : '#5eead4';
          ctx.fillText(anc.name, pt.x, pt.y + 14);
        }
        ctx.restore();
      });
    }

    if (showHazards && zoom >= 18) {
      MARINE_HAZARDS.forEach((haz) => {
        const pt = geoToCanvas(haz.lon, haz.lat, width, height);
        if (pt.x < -30 || pt.x > width + 30 || pt.y < -30 || pt.y > height + 30) return;

        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️', pt.x, pt.y);

        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(`${haz.name} (${haz.depthMeters}m)`, pt.x, pt.y - 10);
        ctx.restore();
      });
    }

    // =========================================================================
    // 6. TIDAL STREAM & OCEAN CURRENT VECTORS
    // =========================================================================
    if (showTidalStreams && zoom >= 14) {
      TIDAL_STREAM_VECTORS.forEach((stream) => {
        const pt = geoToCanvas(stream.lon, stream.lat, width, height);
        if (pt.x < -40 || pt.x > width + 40 || pt.y < -40 || pt.y > height + 40) return;

        ctx.save();
        const rad = ((stream.bearingDeg - 90) * Math.PI) / 180;
        const arrowLen = Math.min(36, Math.max(18, stream.rateKnots * 10));

        ctx.translate(pt.x, pt.y);
        ctx.rotate(rad);

        // Animated flow offset
        const flowOffset = (animPhase * 8) % 12;

        ctx.beginPath();
        ctx.moveTo(-arrowLen / 2, 0);
        ctx.lineTo(arrowLen / 2, 0);
        ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(arrowLen / 2, 0);
        ctx.lineTo(arrowLen / 2 - 6, -3);
        ctx.lineTo(arrowLen / 2 - 4, 0);
        ctx.lineTo(arrowLen / 2 - 6, 3);
        ctx.closePath();
        ctx.fillStyle = isNightMode ? '#ef4444' : '#38bdf8';
        ctx.fill();

        ctx.restore();

        if (zoom >= 22) {
          ctx.font = 'bold 8.5px monospace';
          ctx.fillStyle = isNightMode ? '#fca5a5' : '#7dd3fc';
          ctx.textAlign = 'center';
          ctx.fillText(`🌊 ${stream.rateKnots} kts (${stream.bearingDeg}°)`, pt.x, pt.y + 12);
        }
      });
    }

    // =========================================================================
    // 7. NAUTICAL DEPTH SOUNDINGS (Depth Numbers in meters)
    // =========================================================================
    if (showSoundings && zoom >= 15) {
      NAUTICAL_SOUNDINGS.forEach((snd) => {
        const pt = geoToCanvas(snd.lon, snd.lat, width, height);
        if (pt.x > -20 && pt.x < width + 20 && pt.y > -20 && pt.y < height + 20) {
          let color = '#38bdf8';
          if (snd.depthMeters <= 20) color = '#38bdf8';
          else if (snd.depthMeters <= 60) color = '#0ea5e9';
          else color = '#0284c7';

          if (isNightMode) color = '#f87171';

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.9)' : 'rgba(125, 211, 252, 0.95)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${snd.depthMeters}m`, pt.x, pt.y - 3);
        }
      });
    }

    // =========================================================================
    // 8. OFFSHORE OIL & GAS PLATFORMS
    // =========================================================================
    if (showOilPlatforms && zoom >= 12) {
      MARINE_OIL_PLATFORMS.forEach((platform: MarineOilPlatform) => {
        const pt = geoToCanvas(platform.lon, platform.lat, width, height);
        if (pt.x < -50 || pt.x > width + 50 || pt.y < -50 || pt.y > height + 50) return;

        ctx.save();
        // Platform Icon Box / Structure
        ctx.fillStyle = isNightMode ? '#7f1d1d' : '#f59e0b';
        ctx.fillRect(pt.x - 5, pt.y - 5, 10, 10);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(pt.x - 5, pt.y - 5, 10, 10);

        // Platform Flare / Light Flashing Halo
        const flareIntensity = (Math.sin(animPhase * 4) + 1) / 2;
        const grad = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 14 + flareIntensity * 8);
        grad.addColorStop(0, platform.type === 'flair' ? 'rgba(249, 115, 22, 0.9)' : 'rgba(251, 191, 36, 0.8)');
        grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14 + flareIntensity * 8, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Platform Label Tag
        if (zoom >= 18) {
          ctx.font = 'bold 9px sans-serif';
          const labelText = `🏗️ ${platform.name} [${platform.field}]`;
          ctx.fillStyle = isNightMode ? 'rgba(30, 10, 10, 0.92)' : 'rgba(15, 23, 42, 0.92)';
          const tw = ctx.measureText(labelText).width + 8;
          ctx.fillRect(pt.x + 8, pt.y - 8, tw, 16);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x + 8, pt.y - 8, tw, 16);

          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pt.x + 12, pt.y);
        }
        ctx.restore();
      });
    }

    // =========================================================================
    // 9. NAVIGATION BUOYS (IALA System)
    // =========================================================================
    if (showBuoys && zoom >= 14) {
      MARINE_BUOYS.forEach((buoy: MarineBuoy) => {
        const pt = geoToCanvas(buoy.lon, buoy.lat, width, height);
        if (pt.x < -40 || pt.x > width + 40 || pt.y < -40 || pt.y > height + 40) return;

        ctx.save();
        // Buoy Shape
        ctx.beginPath();
        if (buoy.buoyType === 'starboard') {
          // Green Conical
          ctx.moveTo(pt.x, pt.y - 6);
          ctx.lineTo(pt.x + 4, pt.y + 4);
          ctx.lineTo(pt.x - 4, pt.y + 4);
          ctx.closePath();
          ctx.fillStyle = '#16a34a';
        } else if (buoy.buoyType === 'port') {
          // Red Can
          ctx.rect(pt.x - 4, pt.y - 4, 8, 8);
          ctx.fillStyle = '#dc2626';
        } else {
          // Cardinal / Safe Water / Isolated Danger Sphere
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = buoy.color || '#eab308';
        }
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pulsing Light Flash
        const buoyFlash = (Math.sin(animPhase * 5) + 1) / 2;
        const bGrad = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 10 + buoyFlash * 6);
        bGrad.addColorStop(0, buoy.color === '#dc2626' ? 'rgba(239, 68, 68, 0.8)' : buoy.color === '#16a34a' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(234, 179, 8, 0.8)');
        bGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 10 + buoyFlash * 6, 0, Math.PI * 2);
        ctx.fillStyle = bGrad;
        ctx.fill();

        if (zoom >= 22) {
          ctx.font = 'bold 8.5px monospace';
          const buoyText = `🔘 ${buoy.name} [${buoy.lightChar}]`;
          ctx.fillStyle = isNightMode ? '#fca5a5' : '#cbd5e1';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(buoyText, pt.x + 8, pt.y);
        }
        ctx.restore();
      });
    }

    // =========================================================================
    // 10. MARINE LIGHTHOUSES (Rotating Light Beam)
    // =========================================================================
    if (showLighthouses && zoom >= 12) {
      MARINE_LIGHTHOUSES.forEach((lh: MarineLighthouse) => {
        const pt = geoToCanvas(lh.lon, lh.lat, width, height);
        if (pt.x < -50 || pt.x > width + 50 || pt.y < -50 || pt.y > height + 50) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const flashIntensity = (Math.sin(animPhase * (6 / lh.flashPeriodSec)) + 1) / 2;
        const beamRadius = 12 + flashIntensity * 10;

        const grad = ctx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, beamRadius);
        if (lh.color === 'green') {
          grad.addColorStop(0, `rgba(16, 185, 129, ${0.8 * flashIntensity})`);
          grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        } else if (lh.color === 'red') {
          grad.addColorStop(0, `rgba(239, 68, 68, ${0.8 * flashIntensity})`);
          grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        } else {
          grad.addColorStop(0, `rgba(251, 191, 36, ${0.85 * flashIntensity})`);
          grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
        }

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, beamRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        if (zoom >= 20) {
          ctx.font = 'bold 9px monospace';
          const labelText = `⚡ ${lh.name} [${lh.character}]`;
          ctx.fillStyle = isNightMode ? 'rgba(30, 10, 10, 0.85)' : 'rgba(15, 23, 42, 0.85)';
          const tw = ctx.measureText(labelText).width + 6;
          ctx.fillRect(pt.x + 8, pt.y - 7, tw, 14);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x + 8, pt.y - 7, tw, 14);

          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pt.x + 11, pt.y);
        }
        ctx.restore();
      });
    }

    // =========================================================================
    // 11. MARINE PLACE LABELS (Capitals, World Cities, Islands, Ports, Straits)
    // =========================================================================
    if (showPlaceLabels) {
      MARINE_PLACE_LABELS.forEach((place: MarinePlaceLabel) => {
        if (zoom < place.minZoom) return;

        const pt = geoToCanvas(place.lon, place.lat, width, height);
        if (pt.x < -140 || pt.x > width + 140 || pt.y < -50 || pt.y > height + 50) return;

        // --- GLOBAL OCEANS ---
        if (place.type === 'ocean') {
          ctx.save();
          ctx.font = 'bold 16px sans-serif';
          ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.5)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const spaced = place.name.split('').join(' ');
          ctx.fillText(spaced, pt.x, pt.y);
          ctx.restore();
          return;
        }

        // --- SOVEREIGN COUNTRIES ---
        if (place.type === 'country') {
          ctx.save();
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const tw = ctx.measureText(place.name).width + 12;
          ctx.fillStyle = isNightMode ? 'rgba(30, 15, 10, 0.75)' : 'rgba(15, 23, 42, 0.75)';
          ctx.fillRect(pt.x - tw / 2, pt.y - 8, tw, 16);
          ctx.strokeStyle = isNightMode ? 'rgba(248, 113, 113, 0.5)' : 'rgba(251, 191, 36, 0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x - tw / 2, pt.y - 8, tw, 16);
          ctx.fillStyle = isNightMode ? '#fca5a5' : '#fef08a';
          ctx.fillText(place.name, pt.x, pt.y);
          ctx.restore();
          return;
        }

        if (place.type === 'sea_label') {
          ctx.save();
          ctx.font = 'bold 15px sans-serif';
          ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.22)' : 'rgba(56, 189, 248, 0.3)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(place.name, pt.x, pt.y);
          ctx.restore();
          return;
        }

        if (place.type === 'strait') {
          ctx.save();
          ctx.font = 'italic bold 12px sans-serif';
          ctx.fillStyle = isNightMode ? 'rgba(248, 113, 113, 0.85)' : 'rgba(125, 211, 252, 0.95)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`⚓ ${place.name}`, pt.x, pt.y);
          ctx.restore();
          return;
        }

        // --- PROVINCIAL CAPITALS & MAJOR CITIES ---
        if (place.type === 'provincial_capital') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#dc2626';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7.5, 0, Math.PI * 2);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          ctx.font = 'bold 11px sans-serif';
          const labelText = `⭐ ${place.name}`;
          const tw = ctx.measureText(labelText).width + 8;
          ctx.fillStyle = isNightMode ? 'rgba(35, 15, 10, 0.92)' : 'rgba(15, 23, 42, 0.92)';
          ctx.fillRect(pt.x + 9, pt.y - 9, tw, 18);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(pt.x + 9, pt.y - 9, tw, 18);

          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pt.x + 13, pt.y);
          ctx.restore();
          return;
        }

        // --- GLOBAL WORLD METROPOLISES ---
        if (place.type === 'world_city') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#f97316';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 10px sans-serif';
          const labelText = place.name;
          const tw = ctx.measureText(labelText).width + 8;
          ctx.fillStyle = isNightMode ? 'rgba(25, 10, 10, 0.88)' : 'rgba(15, 23, 42, 0.88)';
          ctx.fillRect(pt.x + 7, pt.y - 8, tw, 16);
          ctx.strokeStyle = 'rgba(249, 115, 22, 0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x + 7, pt.y - 8, tw, 16);

          ctx.fillStyle = '#fdba74';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pt.x + 11, pt.y);
          ctx.restore();
          return;
        }

        // --- ISLANDS ---
        if (place.type === 'island') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = isNightMode ? '#ef4444' : '#38bdf8';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 11px sans-serif';
          const labelText = place.name;
          const tw = ctx.measureText(labelText).width + 8;
          ctx.fillStyle = isNightMode ? 'rgba(20, 5, 5, 0.88)' : 'rgba(15, 23, 42, 0.88)';
          ctx.fillRect(pt.x + 6, pt.y - 8, tw, 16);
          ctx.strokeStyle = isNightMode ? '#7f1d1d' : 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x + 6, pt.y - 8, tw, 16);

          ctx.fillStyle = isNightMode ? '#fca5a5' : '#e0f2fe';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pt.x + 10, pt.y);
          ctx.restore();
          return;
        }

        // --- PORTS & COASTAL CITIES ---
        if (place.type === 'port' || place.type === 'coastal_city') {
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = place.type === 'port' ? '#10b981' : '#f59e0b';
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.font = 'bold 10px sans-serif';
          const labelText = place.name;
          const tw = ctx.measureText(labelText).width + 6;
          ctx.fillStyle = isNightMode ? 'rgba(20, 5, 5, 0.85)' : 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(pt.x + 5, pt.y - 7, tw, 14);
          ctx.strokeStyle = isNightMode ? '#7f1d1d' : 'rgba(100, 116, 139, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(pt.x + 5, pt.y - 7, tw, 14);

          ctx.fillStyle = isNightMode ? '#fca5a5' : place.type === 'port' ? '#6ee7b7' : '#fde68a';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(labelText, pt.x + 8, pt.y);
          ctx.restore();
        }
      });
    }

    // =========================================================================
    // 12. ACTIVE ROUTE & WAYPOINT LEGS (Strict Sequential Order & Navigation Highlighting)
    // =========================================================================
    if (activeRoute && activeRoute.waypoints.length > 0) {
      const wps = [...activeRoute.waypoints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const currentLegIdx = navigationSession.currentLegIndex ?? 0;
      const isRouteNav = navigationSession.isNavigating && navigationSession.isRouteNavigation;

      // 1. Draw Track Line from Vessel Origin to First Destination Waypoint
      const boatPt = geoToCanvas(vesselLon, vesselLat, width, height);
      const firstWpPt = geoToCanvas(wps[0].longitude, wps[0].latitude, width, height);
      const originDist = calculateDistanceNm(vesselLat, vesselLon, wps[0].latitude, wps[0].longitude);
      const originBrg = calculateBearing(vesselLat, vesselLon, wps[0].latitude, wps[0].longitude);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(boatPt.x, boatPt.y);
      ctx.lineTo(firstWpPt.x, firstWpPt.y);
      ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.35)' : 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boatPt.x, boatPt.y);
      ctx.lineTo(firstWpPt.x, firstWpPt.y);
      ctx.strokeStyle = isNightMode ? '#ef4444' : '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.lineDashOffset = -animPhase * 6;
      ctx.stroke();
      ctx.setLineDash([]);

      const odx = firstWpPt.x - boatPt.x;
      const ody = firstWpPt.y - boatPt.y;
      const originLen = Math.hypot(odx, ody);
      if (originLen > 55) {
        const midOX = (boatPt.x + firstWpPt.x) / 2;
        const midOY = (boatPt.y + firstWpPt.y) / 2;
        const originLabel = `${originDist.toFixed(1)} NM • ${formatHeadingDeg(originBrg)}`;
        ctx.font = 'bold 9px monospace';
        const olW = ctx.measureText(originLabel).width + 8;
        ctx.fillStyle = isNightMode ? 'rgba(20, 5, 5, 0.9)' : 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(midOX - olW / 2, midOY - 8, olW, 16);
        ctx.strokeStyle = isNightMode ? '#ef4444' : '#06b6d4';
        ctx.lineWidth = 1;
        ctx.strokeRect(midOX - olW / 2, midOY - 8, olW, 16);
        ctx.fillStyle = isNightMode ? '#fca5a5' : '#67e8f9';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(originLabel, midOX, midOY);
      }
      ctx.restore();

      // 2. Draw overall Route Connection Lines between sequential waypoints
      if (wps.length > 1) {
        for (let i = 0; i < wps.length - 1; i++) {
          const wpA = wps[i];
          const wpB = wps[i + 1];
          const ptA = geoToCanvas(wpA.longitude, wpA.latitude, width, height);
          const ptB = geoToCanvas(wpB.longitude, wpB.latitude, width, height);

          const isPassedLeg = isRouteNav && i < currentLegIdx - 1;
          const isCurrentRouteLeg = isRouteNav && i === currentLegIdx - 1;

          ctx.beginPath();
          ctx.moveTo(ptA.x, ptA.y);
          ctx.lineTo(ptB.x, ptB.y);

          if (isPassedLeg) {
            ctx.strokeStyle = isNightMode ? '#15803d' : '#10b981';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
          } else if (isCurrentRouteLeg) {
            ctx.strokeStyle = isNightMode ? '#ef4444' : '#f59e0b';
            ctx.lineWidth = 3.5;
            ctx.setLineDash([8, 4]);
            ctx.lineDashOffset = -animPhase * 6;
          } else {
            ctx.strokeStyle = activeRoute.color || (isNightMode ? '#ef4444' : '#06b6d4');
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 4]);
          }

          ctx.stroke();
          ctx.setLineDash([]);

          // Directional Arrows and Leg Distance Badges
          const dx = ptB.x - ptA.x;
          const dy = ptB.y - ptA.y;
          const legLen = Math.hypot(dx, dy);
          if (legLen > 40) {
            const angle = Math.atan2(dy, dx);
            const midX = (ptA.x + ptB.x) / 2;
            const midY = (ptA.y + ptB.y) / 2;

            ctx.save();
            ctx.translate(midX, midY);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(-5, -3.5);
            ctx.lineTo(3, 0);
            ctx.lineTo(-5, 3.5);
            ctx.strokeStyle = isCurrentRouteLeg 
              ? (isNightMode ? '#ef4444' : '#f59e0b') 
              : (isNightMode ? '#f87171' : '#38bdf8');
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            if (legLen > 70) {
              const legDistNm = calculateDistanceNm(wpA.latitude, wpA.longitude, wpB.latitude, wpB.longitude);
              const legBrg = calculateBearing(wpA.latitude, wpA.longitude, wpB.latitude, wpB.longitude);
              const legLabel = `${legDistNm.toFixed(1)} NM • ${formatHeadingDeg(legBrg)}`;
              ctx.font = 'bold 8.5px monospace';
              const lw = ctx.measureText(legLabel).width + 8;
              ctx.fillStyle = isNightMode ? 'rgba(20, 5, 5, 0.85)' : 'rgba(15, 23, 42, 0.85)';
              ctx.fillRect(midX - lw / 2, midY + 8, lw, 14);
              ctx.strokeStyle = isNightMode ? '#7f1d1d' : '#0ea5e9';
              ctx.lineWidth = 0.8;
              ctx.strokeRect(midX - lw / 2, midY + 8, lw, 14);
              ctx.fillStyle = isNightMode ? '#fca5a5' : '#7dd3fc';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(legLabel, midX, midY + 15);
            }
          }
        }
      }

      // Draw Individual Waypoint Markers
      wps.forEach((wp, idx) => {
        const pt = geoToCanvas(wp.longitude, wp.latitude, width, height);
        const isTarget = targetWaypoint?.id === wp.id;
        const isPassedWp = isRouteNav && idx < currentLegIdx;

        if (isTarget) {
          const pulseRadius = 14 + Math.sin(animPhase * 3) * 6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.9)';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y - (pulseRadius + 4));
          ctx.lineTo(pt.x, pt.y + (pulseRadius + 4));
          ctx.moveTo(pt.x - (pulseRadius + 4), pt.y);
          ctx.lineTo(pt.x + (pulseRadius + 4), pt.y);
          ctx.strokeStyle = isNightMode ? '#ef4444' : '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, isTarget ? 8 : 6, 0, Math.PI * 2);
        ctx.fillStyle = isTarget 
          ? (isNightMode ? '#ef4444' : '#f59e0b') 
          : isPassedWp
          ? (isNightMode ? '#15803d' : '#10b981')
          : (isNightMode ? '#b91c1c' : '#06b6d4');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = isPassedWp ? '#ffffff' : '#0f172a';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isPassedWp ? '✓' : `${idx + 1}`, pt.x, pt.y);

        ctx.font = 'bold 11px sans-serif';
        const labelText = wp.name;
        const metrics = ctx.measureText(labelText);
        const badgeWidth = metrics.width + 12;

        ctx.fillStyle = isNightMode ? 'rgba(20, 5, 5, 0.9)' : 'rgba(15, 23, 42, 0.9)';
        ctx.fillRect(pt.x + 10, pt.y - 12, badgeWidth, 20);
        ctx.strokeStyle = isTarget 
          ? (isNightMode ? '#ef4444' : '#f59e0b') 
          : isPassedWp
          ? (isNightMode ? '#15803d' : '#10b981')
          : (isNightMode ? '#7f1d1d' : '#0ea5e9');
        ctx.lineWidth = isTarget ? 1.5 : 1;
        ctx.strokeRect(pt.x + 10, pt.y - 12, badgeWidth, 20);

        ctx.fillStyle = isTarget 
          ? (isNightMode ? '#fca5a5' : '#fbbf24') 
          : isPassedWp 
          ? '#6ee7b7'
          : '#f8fafc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, pt.x + 15, pt.y - 2);
      });
    }

    // =========================================================================
    // 12B. USER CUSTOM FLAG MARKS (Distinctive High-Visibility Flags & Labels)
    // =========================================================================
    if (showUserTags && userTags.length > 0) {
      userTags.forEach((tag) => {
        const pt = geoToCanvas(tag.longitude, tag.latitude, width, height);
        if (pt.x < -150 || pt.x > width + 150 || pt.y < -150 || pt.y > height + 150) return;

        const tagColor = tag.color || '#ec4899';
        const pulse = Math.sin(animPhase * 3) * 3;

        // 1. Draw Flagpole
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x, pt.y - 24);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 2. Triangular Nautical Pennant Flag
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y - 24);
        ctx.lineTo(pt.x + 16, pt.y - 17);
        ctx.lineTo(pt.x, pt.y - 10);
        ctx.closePath();
        ctx.fillStyle = tagColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // 3. Ground beacon pin & pulsating ring
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = tagColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = `${tagColor}88`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 4. Distinctive Badge Background with neon border
        const labelText = `⚑ ${tag.name}`;
        ctx.font = 'bold 11px sans-serif';
        const tw = ctx.measureText(labelText).width;
        const badgeW = tw + 14;
        const badgeH = 20;

        ctx.fillStyle = isNightMode ? 'rgba(30, 5, 10, 0.95)' : 'rgba(15, 23, 42, 0.94)';
        ctx.fillRect(pt.x + 18, pt.y - 26, badgeW, badgeH);

        ctx.strokeStyle = tagColor;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(pt.x + 18, pt.y - 26, badgeW, badgeH);

        // 5. White Bold Label text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, pt.x + 25, pt.y - 16);
      });
    }

    // =========================================================================
    // 13. DIRECT NAVIGATION TRACK VISUALIZATION (To Destination Waypoint)
    // =========================================================================
    if (navigationSession.isNavigating && targetWaypoint) {
      const boatPt = geoToCanvas(vesselLon, vesselLat, width, height);
      const targetPt = geoToCanvas(targetWaypoint.longitude, targetWaypoint.latitude, width, height);

      const directDist = calculateDistanceNm(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude);
      const directBrg = calculateBearing(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(boatPt.x, boatPt.y);
      ctx.lineTo(targetPt.x, targetPt.y);
      ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 8;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(boatPt.x, boatPt.y);
      ctx.lineTo(targetPt.x, targetPt.y);
      ctx.strokeStyle = isNightMode ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = -animPhase * 8;
      ctx.stroke();
      ctx.setLineDash([]);

      const dx = targetPt.x - boatPt.x;
      const dy = targetPt.y - boatPt.y;
      const totalLen = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      if (totalLen > 60) {
        const numArrows = Math.min(6, Math.floor(totalLen / 80));
        for (let i = 1; i <= numArrows; i++) {
          const arrowX = boatPt.x + (dx * (i / (numArrows + 1)));
          const arrowY = boatPt.y + (dy * (i / (numArrows + 1)));

          ctx.save();
          ctx.translate(arrowX, arrowY);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-6, -4);
          ctx.lineTo(2, 0);
          ctx.lineTo(-6, 4);
          ctx.strokeStyle = isNightMode ? '#ffffff' : '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }
      }

      const midX = (boatPt.x + targetPt.x) / 2;
      const midY = (boatPt.y + targetPt.y) / 2;
      const navBadgeText = `NAV COURSE: ${directDist.toFixed(1)} NM • ${formatHeadingDeg(directBrg)}`;
      ctx.font = 'bold 10px monospace';
      const badgeW = ctx.measureText(navBadgeText).width + 14;

      ctx.fillStyle = isNightMode ? 'rgba(30, 5, 5, 0.95)' : 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(midX - badgeW / 2, midY - 10, badgeW, 20);
      ctx.strokeStyle = isNightMode ? '#ef4444' : '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(midX - badgeW / 2, midY - 10, badgeW, 20);

      ctx.fillStyle = isNightMode ? '#fca5a5' : '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(navBadgeText, midX, midY);
      ctx.restore();
    }

    // =========================================================================
    // 14. LIVE VESSEL BOAT MARKER & RANGE RINGS (GPS Heading COG in Route/Nav)
    // =========================================================================
    {
      const boatPt = geoToCanvas(vesselLon, vesselLat, width, height);
      const isRouteOrNavActive = navigationSession.isNavigating || !!activeRoute || !!targetWaypoint || isAddWaypointMode;
      const validGpsHeading = (gps.heading !== null && !isNaN(gps.heading)) ? gps.heading : null;
      const headingDeg = activeHeadingMode === 'gps'
        ? (validGpsHeading ?? lastValidGpsHeadingRef.current ?? (compass.trueHeading || compass.magneticHeading || 0))
        : (compass.trueHeading || compass.magneticHeading || validGpsHeading || 0);
      const headingRad = (headingDeg * Math.PI) / 180;

      if (showRangeRings) {
        const boatLatRad = (vesselLat * Math.PI) / 180;
        const cosBoatLat = Math.max(0.15, Math.cos(boatLatRad));
        const nmPixels = (zoom * 10) / (60 * cosBoatLat);
        const mPixels = nmPixels / 1852;

        if (zoom > 1000) {
          // Harbor Docking & Close-Quarters Navigation: Rings in Meters (25m, 50m, 100m, 250m)
          [25, 50, 100, 250].forEach((ringM) => {
            const radius = mPixels * ringM;
            if (radius > 12 && radius < Math.max(width, height) * 1.8) {
              ctx.beginPath();
              ctx.arc(boatPt.x, boatPt.y, radius, 0, Math.PI * 2);
              ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.35)' : 'rgba(56, 189, 248, 0.35)';
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 4]);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(148, 163, 184, 0.85)';
              ctx.font = '8.5px monospace';
              ctx.fillText(`${ringM}m`, boatPt.x + radius + 2, boatPt.y - 2);
            }
          });
        } else if (zoom > 15) {
          // Open Sea / Coastal Navigation: Nautical Miles
          const ringDistances = zoom > 200 ? [0.25, 0.5, 1] : [1, 2, 5];
          ringDistances.forEach((ringNm) => {
            const radius = nmPixels * ringNm;
            if (radius > 12 && radius < Math.max(width, height) * 1.8) {
              ctx.beginPath();
              ctx.arc(boatPt.x, boatPt.y, radius, 0, Math.PI * 2);
              ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.28)';
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 4]);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.6)' : 'rgba(148, 163, 184, 0.8)';
              ctx.font = '8.5px monospace';
              ctx.fillText(`${ringNm}NM`, boatPt.x + radius + 2, boatPt.y - 2);
            }
          });
        }
      }

      // Heading Vector Line
      ctx.beginPath();
      ctx.moveTo(boatPt.x, boatPt.y);
      const vectorLen = Math.max(35, Math.min(120, (gps.speedKnots || 5) * 6));
      const headX = boatPt.x + Math.sin(headingRad) * vectorLen;
      const headY = boatPt.y - Math.cos(headingRad) * vectorLen;
      ctx.lineTo(headX, headY);
      ctx.strokeStyle = isNightMode ? '#ef4444' : '#06b6d4';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(headX, headY);
      ctx.rotate(headingRad);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-4, 4);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fillStyle = isNightMode ? '#ef4444' : '#06b6d4';
      ctx.fill();
      ctx.restore();

      // Vessel Symbol (Nautical Hull)
      ctx.save();
      ctx.translate(boatPt.x, boatPt.y);
      ctx.rotate(headingRad);

      ctx.beginPath();
      ctx.moveTo(0, -12); // Bow
      ctx.lineTo(7, 2);   // Starboard Mid
      ctx.lineTo(5, 10);  // Starboard Stern
      ctx.lineTo(-5, 10); // Port Stern
      ctx.lineTo(-7, 2);  // Port Mid
      ctx.closePath();

      ctx.fillStyle = isNightMode ? '#ef4444' : '#06b6d4';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }

    // =========================================================================
    // 16. NAUTICAL SCALE BAR & ACCURATE DISTANCE INDICATOR (Bottom-Left)
    // =========================================================================
    {
      const barX = 20;
      const barY = height - 26;
      const latRad = (center[1] * Math.PI) / 180;
      const cosLat = Math.max(0.15, Math.cos(latRad));
      
      // Calculate Nautical Miles per pixel at current center latitude
      // 1 degree lat = 60 NM; worldPixels = zoom * 3600
      const nmPerPixel = (360 * cosLat * 60) / (zoom * 3600);

      // Target bar display width around 100 pixels
      const rawNm = nmPerPixel * 100;
      let barNm = 1;
      let barLabel = '1 NM';

      if (rawNm >= 1500) {
        barNm = Math.round(rawNm / 500) * 500;
        barLabel = `${barNm} NM`;
      } else if (rawNm >= 300) {
        barNm = Math.round(rawNm / 100) * 100;
        barLabel = `${barNm} NM`;
      } else if (rawNm >= 60) {
        barNm = Math.round(rawNm / 25) * 25;
        barLabel = `${barNm} NM`;
      } else if (rawNm >= 15) {
        barNm = Math.round(rawNm / 5) * 5;
        barLabel = `${barNm} NM`;
      } else if (rawNm >= 3) {
        barNm = Math.round(rawNm);
        barLabel = `${barNm} NM`;
      } else if (rawNm >= 0.7) {
        barNm = 0.5;
        barLabel = '0.5 NM';
      } else if (rawNm >= 0.15) {
        barNm = 0.1;
        barLabel = `${Math.round(barNm * 1852)} m`;
      } else {
        barNm = rawNm;
        barLabel = `${Math.max(10, Math.round(barNm * 1852))} m`;
      }

      const barWidthPx = barNm / nmPerPixel;

      if (barWidthPx > 10 && barWidthPx < 320) {
        ctx.save();
        // Scale Bar Background Pill
        ctx.fillStyle = isNightMode ? 'rgba(20, 5, 5, 0.85)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(barX - 6, barY - 15, barWidthPx + 12, 22);
        ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX - 6, barY - 15, barWidthPx + 12, 22);

        // Bar line with end ticks
        ctx.beginPath();
        ctx.moveTo(barX, barY - 3);
        ctx.lineTo(barX, barY + 3);
        ctx.moveTo(barX, barY);
        ctx.lineTo(barX + barWidthPx, barY);
        ctx.moveTo(barX + barWidthPx, barY - 3);
        ctx.lineTo(barX + barWidthPx, barY + 3);
        ctx.strokeStyle = isNightMode ? '#ef4444' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.font = 'bold 9px monospace';
        ctx.fillStyle = isNightMode ? '#fca5a5' : '#e0f2fe';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(barLabel, barX + barWidthPx / 2, barY - 3);
        ctx.restore();
      }
    }

  }, [
    center, 
    zoom, 
    vesselLon, 
    vesselLat, 
    gps, 
    compass, 
    activeRoute, 
    targetWaypoint, 
    navigationSession, 
    isNightMode, 
    mapMode,
    liveProvider,
    showLiveSeamarks,
    isOnline,
    showBathymetry, 
    showGraticule, 
    showSoundings, 
    showPlaceLabels, 
    showLighthouses,
    showShippingLanes,
    showAnchorages,
    showHazards,
    showOilPlatforms,
    showBuoys,
    showPipelines,
    showTidalStreams,
    showRangeRings, 
    geoToCanvas, 
    canvasToGeo,
    triggerTileRedraw
  ]);

  // Request Animation Loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      renderChart();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [renderChart]);

  // Resize canvas when container size changes
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      let displayW = 0;
      let displayH = 0;

      if (isFullscreen) {
        displayW = window.innerWidth || document.documentElement.clientWidth || 800;
        displayH = window.innerHeight || document.documentElement.clientHeight || 600;
      } else if (container) {
        const rect = container.getBoundingClientRect();
        displayW = rect.width;
        displayH = rect.height;
      }

      if (displayW <= 0) displayW = container?.clientWidth || window.innerWidth || 800;
      if (displayH <= 0) displayH = container?.clientHeight || 500;

      const targetW = Math.max(200, Math.round(displayW * dpr));
      const targetH = Math.max(200, Math.round(displayH * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
    };

    handleResize();
    const rafId = requestAnimationFrame(handleResize);
    const timer = setTimeout(handleResize, 60);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullscreen]);

  // Mouse Pan / Zoom Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setDragStart({ x: e.clientX, y: e.clientY });
    setAutoFollowVessel(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const coords = canvasToGeo(x, y, rect.width, rect.height);
    setCursorCoords(coords);

    if (!isDraggingRef.current) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;

    const currentZoom = zoomRef.current;
    const worldPixels = currentZoom * 3600;
    const dLon = (dx / worldPixels) * 360;
    const cy = latToMercatorY(centerRef.current[1]) * worldPixels;
    const newCy = cy - dy;
    const newLat = mercatorYToLat(newCy / worldPixels);

    centerRef.current = [centerRef.current[0] - dLon, Math.max(-80, Math.min(80, newLat))];
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      setCenter(centerRef.current);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const geoBefore = canvasToGeo(cursorX, cursorY, rect.width, rect.height);
    const zoomFactor = e.deltaY < 0 ? 1.35 : 0.74;
    const newZoom = Math.max(0.4, Math.min(2500000, zoomRef.current * zoomFactor));

    const worldPixels = newZoom * 3600;
    const targetPx = lonToMercatorX(geoBefore.lon) * worldPixels;
    const targetPy = latToMercatorY(geoBefore.lat) * worldPixels;

    const newCx = targetPx - (cursorX - rect.width / 2);
    const newCy = targetPy - (cursorY - rect.height / 2);

    const newCenterLon = mercatorXToLon(newCx / worldPixels);
    const newCenterLat = mercatorYToLat(newCy / worldPixels);

    zoomRef.current = newZoom;
    centerRef.current = [newCenterLon, Math.max(-80, Math.min(80, newCenterLat))];
    setZoom(newZoom);
    setCenter(centerRef.current);
    setAutoFollowVessel(false);
  };

  // Native Touch & Gesture handling on Canvas: Ultra-fluid 360-degree panning with zero frame drop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeTouchStart = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      if (e.touches.length === 1) {
        const t = e.touches[0];
        dragStartRef.current = { x: t.clientX, y: t.clientY };
        touchStartPosRef.current = { x: t.clientX, y: t.clientY };
        touchStartTimeRef.current = Date.now();
        isDraggingRef.current = true;
        setIsDragging(true);
        setAutoFollowVessel(false);

        // Calculate cursor coordinates on touch
        const rect = canvas.getBoundingClientRect();
        const coords = canvasToGeo(t.clientX - rect.left, t.clientY - rect.top, rect.width, rect.height);
        setCursorCoords(coords);
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchDistanceRef.current = dist;
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    const handleNativeTouchMove = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      if (e.touches.length === 2 && touchDistanceRef.current !== null) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchDistanceRef.current > 0) {
          const factor = newDist / touchDistanceRef.current;
          const newZoom = Math.max(0.4, Math.min(2500000, zoomRef.current * factor));
          zoomRef.current = newZoom;
        }
        touchDistanceRef.current = newDist;
        return;
      }

      if (e.touches.length === 1 && isDraggingRef.current) {
        const t = e.touches[0];
        const dx = t.clientX - dragStartRef.current.x;
        const dy = t.clientY - dragStartRef.current.y;

        const currentZoom = zoomRef.current;
        const worldPixels = currentZoom * 3600;
        const dLon = (dx / worldPixels) * 360;
        const cy = latToMercatorY(centerRef.current[1]) * worldPixels;
        const newCy = cy - dy;
        const newLat = mercatorYToLat(newCy / worldPixels);

        centerRef.current = [centerRef.current[0] - dLon, Math.max(-80, Math.min(80, newLat))];
        dragStartRef.current = { x: t.clientX, y: t.clientY };

        const rect = canvas.getBoundingClientRect();
        const coords = canvasToGeo(t.clientX - rect.left, t.clientY - rect.top, rect.width, rect.height);
        setCursorCoords(coords);
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault();

      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        setCenter(centerRef.current);
        setZoom(zoomRef.current);
      }

      // Check if this was a fast tap (under 350ms, moved < 15px)
      if (e.touches.length === 0) {
        const timeDiff = Date.now() - touchStartTimeRef.current;
        const lastPos = dragStartRef.current;
        const startPos = touchStartPosRef.current;
        const distMoved = Math.hypot(lastPos.x - startPos.x, lastPos.y - startPos.y);

        if (timeDiff < 350 && distMoved < 15) {
          const rect = canvas.getBoundingClientRect();
          const clickX = startPos.x - rect.left;
          const clickY = startPos.y - rect.top;
          const now = Date.now();
          const lastTap = lastTapRef.current;
          const isDoubleTap = !!(
            lastTap && 
            (now - lastTap.time < 450) && 
            Math.hypot(clickX - lastTap.x, clickY - lastTap.y) < 40
          );

          if (isAddWaypointMode) {
            if (isDoubleTap && onMapClickAddWaypoint) {
              const { lat, lon } = canvasToGeo(clickX, clickY, rect.width, rect.height);
              onMapClickAddWaypoint(lat, lon);
              lastTapRef.current = null;
            } else {
              lastTapRef.current = { time: now, x: clickX, y: clickY };
            }
          } else {
            let handledWaypoint = false;
            if (activeRoute && onSelectWaypoint) {
              for (const wp of activeRoute.waypoints) {
                const wpPt = geoToCanvas(wp.longitude, wp.latitude, rect.width, rect.height);
                const d = Math.hypot(clickX - wpPt.x, clickY - wpPt.y);
                if (d <= 25) {
                  onSelectWaypoint(wp);
                  handledWaypoint = true;
                  break;
                }
              }
            }

            // Detect tap on User Custom Tags / Flags
            if (!handledWaypoint && showUserTags && userTags.length > 0) {
              for (const tag of userTags) {
                const tagPt = geoToCanvas(tag.longitude, tag.latitude, rect.width, rect.height);
                const d = Math.hypot(clickX - tagPt.x, clickY - tagPt.y);
                if (d <= 25) {
                  setTagToEdit(tag);
                  setIsTagModalOpen(true);
                  handledWaypoint = true;
                  break;
                }
              }
            }

            // If Flag Placement Mode is active, drop flag at tap location immediately
            if (!handledWaypoint && isAddFlagMode) {
              const geo = canvasToGeo(clickX, clickY, rect.width, rect.height);
              const newTag: UserTag = {
                id: `flag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                name: `Flag ${userTags.length + 1}`,
                latitude: Number(geo.lat.toFixed(5)),
                longitude: Number(geo.lon.toFixed(5)),
                color: '#ec4899',
                createdAt: Date.now()
              };
              setUserTags((prev) => {
                const updated = [...prev, newTag];
                try { localStorage.setItem('mariner_user_tags_v1', JSON.stringify(updated)); } catch {}
                return updated;
              });
              setTagToEdit(newTag);
              setIsTagModalOpen(true);
              setIsAddFlagMode(false);
              handledWaypoint = true;
              lastTapRef.current = null;
            }

            if (!handledWaypoint) {
              if (isDoubleTap) {
                // Mobile double-tap zoom smoothly towards tapped point
                const geoBefore = canvasToGeo(clickX, clickY, rect.width, rect.height);
                const newZoom = Math.min(2500000, zoomRef.current * 2.0);
                const worldPixels = newZoom * 3600;
                const targetPx = lonToMercatorX(geoBefore.lon) * worldPixels;
                const targetPy = latToMercatorY(geoBefore.lat) * worldPixels;
                const newCx = targetPx - (clickX - rect.width / 2);
                const newCy = targetPy - (clickY - rect.height / 2);
                const newCenterLon = mercatorXToLon(newCx / worldPixels);
                const newCenterLat = mercatorYToLat(newCy / worldPixels);

                zoomRef.current = newZoom;
                centerRef.current = [newCenterLon, Math.max(-80, Math.min(80, newCenterLat))];
                setZoom(newZoom);
                setCenter(centerRef.current);
                setAutoFollowVessel(false);
                lastTapRef.current = null;
              } else {
                lastTapRef.current = { time: now, x: clickX, y: clickY };
              }
            }
          }
        }

        isDraggingRef.current = false;
        setIsDragging(false);
        touchDistanceRef.current = null;
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        dragStartRef.current = { x: t.clientX, y: t.clientY };
        isDraggingRef.current = true;
        setIsDragging(true);
        touchDistanceRef.current = null;
      }
    };

    canvas.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleNativeTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleNativeTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleNativeTouchStart);
      canvas.removeEventListener('touchmove', handleNativeTouchMove);
      canvas.removeEventListener('touchend', handleNativeTouchEnd);
      canvas.removeEventListener('touchcancel', handleNativeTouchEnd);
    };
  }, [canvasToGeo, geoToCanvas, isAddWaypointMode, isAddFlagMode, onMapClickAddWaypoint, activeRoute, onSelectWaypoint, isFullscreen, showUserTags, userTags]);

  // Canvas Single Click (Selects existing waypoint/flag or places flag when in flag mode)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isAddWaypointMode) {
      // In Add Waypoint mode, single clicks are reserved for dragging/panning to prevent accidental waypoint drops!
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeRoute && onSelectWaypoint) {
      for (const wp of activeRoute.waypoints) {
        const wpPt = geoToCanvas(wp.longitude, wp.latitude, rect.width, rect.height);
        const dist = Math.hypot(x - wpPt.x, y - wpPt.y);
        if (dist <= 25) {
          onSelectWaypoint(wp);
          return;
        }
      }
    }

    // Detect click on User Custom Flags (allow edit/delete on click)
    if (showUserTags && userTags.length > 0) {
      for (const tag of userTags) {
        const tagPt = geoToCanvas(tag.longitude, tag.latitude, rect.width, rect.height);
        const dist = Math.hypot(x - tagPt.x, y - tagPt.y);
        if (dist <= 25) {
          setTagToEdit(tag);
          setIsTagModalOpen(true);
          return;
        }
      }
    }

    // If Flag Placement Mode is active, drop flag at clicked location
    if (isAddFlagMode) {
      const geo = canvasToGeo(x, y, rect.width, rect.height);
      const newTag: UserTag = {
        id: `flag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `Flag ${userTags.length + 1}`,
        latitude: Number(geo.lat.toFixed(5)),
        longitude: Number(geo.lon.toFixed(5)),
        color: '#ec4899',
        createdAt: Date.now()
      };
      setUserTags((prev) => {
        const updated = [...prev, newTag];
        try { localStorage.setItem('mariner_user_tags_v1', JSON.stringify(updated)); } catch {}
        return updated;
      });
      setTagToEdit(newTag);
      setIsTagModalOpen(true);
      setIsAddFlagMode(false);
      return;
    }
  };

  // Canvas Double Click (Adds waypoint if in mode, or zooms directly to cursor if exploring)
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isAddWaypointMode && onMapClickAddWaypoint) {
      const { lat, lon } = canvasToGeo(x, y, rect.width, rect.height);
      onMapClickAddWaypoint(lat, lon);
    } else if (!isAddWaypointMode) {
      // Fluid double-click zoom directly towards the clicked point
      const geoBefore = canvasToGeo(x, y, rect.width, rect.height);
      const newZoom = Math.min(2500000, zoomRef.current * 2.0);
      const worldPixels = newZoom * 3600;
      const targetPx = lonToMercatorX(geoBefore.lon) * worldPixels;
      const targetPy = latToMercatorY(geoBefore.lat) * worldPixels;
      const newCx = targetPx - (x - rect.width / 2);
      const newCy = targetPy - (y - rect.height / 2);
      const newCenterLon = mercatorXToLon(newCx / worldPixels);
      const newCenterLat = mercatorYToLat(newCy / worldPixels);

      zoomRef.current = newZoom;
      centerRef.current = [newCenterLon, Math.max(-80, Math.min(80, newCenterLat))];
      setZoom(newZoom);
      setCenter(centerRef.current);
      setAutoFollowVessel(false);
    }
  };

  // Center buttons & auto-fit
  const fitAllInView = useCallback(() => {
    const container = containerRef.current;
    const width = container ? container.getBoundingClientRect().width : window.innerWidth;
    const height = container ? container.getBoundingClientRect().height : window.innerHeight;

    let points: [number, number][] = [];
    if (activeRoute && activeRoute.waypoints.length > 0) {
      points = activeRoute.waypoints.map(wp => [wp.longitude, wp.latitude]);
    }

    if (vesselLat && vesselLon) {
      points.push([vesselLon, vesselLat]);
    }

    if (points.length === 0) {
      setCenter([vesselLon || 51.5, vesselLat || 25.3]);
      setZoom(45);
      return;
    }

    if (points.length === 1) {
      setCenter([points[0][0], points[0][1]]);
      setZoom(55);
      return;
    }

    const minLon = Math.min(...points.map(p => p[0]));
    const maxLon = Math.max(...points.map(p => p[0]));
    const minLat = Math.min(...points.map(p => p[1]));
    const maxLat = Math.max(...points.map(p => p[1]));

    const midLon = (minLon + maxLon) / 2;
    const midLat = (minLat + maxLat) / 2;
    setCenter([midLon, midLat]);
    setAutoFollowVessel(false);

    const dLon = Math.max(0.02, maxLon - minLon);
    const dLat = Math.max(0.02, maxLat - minLat);

    const availableWidth = Math.max(200, width * 0.72);
    const availableHeight = Math.max(200, height * 0.65);

    const zoomX = availableWidth / (dLon * 10);
    const zoomY = availableHeight / (dLat * 10);
    const calculatedZoom = Math.max(8, Math.min(220, Math.min(zoomX, zoomY)));

    setZoom(calculatedZoom);
  }, [activeRoute, vesselLat, vesselLon]);

  const centerOnVessel = () => {
    setCenter([vesselLon, vesselLat]);
    setAutoFollowVessel(true);
    setZoom(55);
  };

  const centerOnRoute = () => {
    if (!activeRoute || activeRoute.waypoints.length === 0) return;
    fitAllInView();
  };

  const centerOnCourse = () => {
    if (!targetWaypoint) return;
    const midLon = (vesselLon + targetWaypoint.longitude) / 2;
    const midLat = (vesselLat + targetWaypoint.latitude) / 2;
    setCenter([midLon, midLat]);
    setAutoFollowVessel(false);
  };

  // Live Navigation Values for Fullscreen HUD & Bottom Telemetry Bar
  const directDistanceNm = targetWaypoint 
    ? calculateDistanceNm(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude)
    : (navigationSession.distanceNm || 0);

  const directBearingDeg = targetWaypoint
    ? calculateBearing(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude)
    : (navigationSession.bearingDeg || 0);

  // Sorted waypoints and first waypoint calculation (for route navigation)
  const sortedRouteWaypoints = (activeRoute && activeRoute.waypoints && activeRoute.waypoints.length > 0)
    ? [...activeRoute.waypoints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];
  const firstWaypoint = sortedRouteWaypoints.length > 0 ? sortedRouteWaypoints[0] : targetWaypoint;
  const distanceToFirstWpNm = firstWaypoint
    ? calculateDistanceNm(vesselLat, vesselLon, firstWaypoint.latitude, firstWaypoint.longitude)
    : null;

  const currentSpeedKnots = gps.speedKnots !== null ? gps.speedKnots : 0;
  const isRouteOrNavActive = navigationSession.isNavigating || !!activeRoute || !!targetWaypoint || isAddWaypointMode;
  const validGpsHeading = (gps.heading !== null && !isNaN(gps.heading)) ? gps.heading : null;
  const currentHeading = activeHeadingMode === 'gps'
    ? (validGpsHeading ?? lastValidGpsHeadingRef.current ?? (compass.trueHeading || compass.magneticHeading || 0))
    : (compass.trueHeading || compass.magneticHeading || validGpsHeading || 0);
  const currentEta = navigationSession.etaTimestamp ? formatEta(navigationSession.etaTimestamp) : '---';

  const chartContent = (
    <div 
      ref={containerRef} 
      id="marine-vector-chart-container"
      style={
        isFullscreen
          ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 999999,
              touchAction: 'none',
              backgroundColor: isNightMode ? '#090505' : '#020617',
            }
          : undefined
      }
      className={`select-none ${
        isFullscreen
          ? 'fixed inset-0 z-[999999] w-screen h-screen min-w-full min-h-full rounded-none border-none flex flex-col overflow-hidden m-0 p-0'
          : `relative w-full h-[460px] sm:h-[560px] lg:h-[640px] rounded-2xl overflow-hidden border ${
              isNightMode ? 'bg-[#090505] border-red-900/60' : 'bg-slate-950 border-slate-800'
            }`
      }`}
    >
      {/* Canvas Layer - Edge to Edge in Fullscreen with Native Touch Panning */}
      <canvas
        ref={canvasRef}
        style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', width: '100%', height: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        className={`w-full h-full block select-none ${
          isAddWaypointMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* FULL SCREEN COMPACT HIGH-CONTRAST MARINE NAVIGATION HUD */}
      {isFullscreen && (
        <div className="absolute top-1.5 sm:top-2.5 left-1.5 sm:left-3 right-1.5 sm:right-3 z-30 pointer-events-none flex flex-wrap items-center justify-between gap-1 sm:gap-2 max-w-[calc(100vw-0.75rem)] sm:max-w-none">
          {/* Left Cluster: Compact Marine HUD Readouts */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 font-mono overflow-x-auto no-scrollbar py-0.5 max-w-full sm:max-w-[55vw] shrink-0">
            {/* Vessel Speed (SOG) */}
            <div className={`px-2 py-1 rounded-lg border backdrop-blur-md flex items-center gap-1.5 shadow-lg shrink-0 ${
              isNightMode ? 'bg-red-950/90 border-red-800' : 'bg-slate-900/90 border-slate-700'
            }`}>
              <Gauge className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-[9px] text-slate-400 font-bold hidden xs:inline">SOG</span>
              <span className="text-xs sm:text-sm font-black text-emerald-400 leading-none">
                {currentSpeedKnots.toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-400 leading-none">kts</span>
            </div>

            {/* True Heading (HDT) */}
            <div className={`px-2 py-1 rounded-lg border backdrop-blur-md flex items-center gap-1.5 shadow-lg shrink-0 ${
              isNightMode ? 'bg-red-950/90 border-red-800' : 'bg-slate-900/90 border-slate-700'
            }`}>
              <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="text-[9px] text-slate-400 font-bold hidden xs:inline">
                {isRouteOrNavActive && validGpsHeading !== null ? 'GPS HDG' : 'HDG'}
              </span>
              <span className="text-xs sm:text-sm font-black text-cyan-300 leading-none">
                {currentHeading.toFixed(0)}°
              </span>
              <span className="text-[9px] text-cyan-400 font-bold leading-none">
                {headingToCardinal(currentHeading)}
              </span>
            </div>

            {/* Target Distance (DIST) */}
            {targetWaypoint && (
              <div className={`px-2 py-1 rounded-lg border backdrop-blur-md flex items-center gap-1.5 shadow-lg shrink-0 ${
                isNightMode ? 'bg-red-950/90 border-red-800' : 'bg-slate-900/90 border-slate-700'
              }`}>
                <Navigation className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-[9px] text-slate-400 font-bold hidden xs:inline">DST</span>
                <span className="text-xs sm:text-sm font-black text-amber-400 leading-none">
                  {directDistanceNm.toFixed(1)}
                </span>
                <span className="text-[9px] text-slate-400 leading-none">NM</span>
              </div>
            )}

            {/* Bearing (BRG) */}
            {targetWaypoint && (
              <div className={`hidden md:flex px-2 py-1 rounded-lg border backdrop-blur-md items-center gap-1.5 shadow-lg shrink-0 ${
                isNightMode ? 'bg-red-950/90 border-red-800' : 'bg-slate-900/90 border-slate-700'
              }`}>
                <span className="text-[9px] text-slate-400 font-bold">BRG</span>
                <span className="text-xs sm:text-sm font-black text-cyan-300 leading-none">
                  {formatHeadingDeg(directBearingDeg)}
                </span>
              </div>
            )}

            {/* ETA */}
            {targetWaypoint && (
              <div className={`hidden sm:flex px-2 py-1 rounded-lg border backdrop-blur-md items-center gap-1.5 shadow-lg shrink-0 ${
                isNightMode ? 'bg-red-950/90 border-red-800' : 'bg-slate-900/90 border-slate-700'
              }`}>
                <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="text-[9px] text-slate-400 font-bold">ETA</span>
                <span className="text-xs sm:text-sm font-black text-indigo-300 leading-none">
                  {currentEta}
                </span>
              </div>
            )}

            {/* Route Voyage Navigation Info */}
            {navigationSession.isNavigating && navigationSession.isRouteNavigation && activeRoute && (
              <div className={`hidden lg:flex px-2 py-1 rounded-lg border backdrop-blur-md items-center gap-1.5 shadow-lg shrink-0 ${
                isNightMode ? 'bg-amber-950/90 border-amber-800 text-amber-200' : 'bg-slate-900/90 border-cyan-700 text-cyan-200'
              }`}>
                <Anchor className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="text-[9px] font-bold text-slate-400">
                  {activeRoute.name.length > 10 ? activeRoute.name.substring(0, 10) + '...' : activeRoute.name}
                </span>
                <span className="text-xs font-bold font-mono">
                  L{(navigationSession.currentLegIndex ?? 0) + 1}/{navigationSession.totalLegs || activeRoute.waypoints.length}
                </span>
              </div>
            )}
          </div>

          {/* Right Cluster: Heading Source, Tile/Vector Mode, Pre-cache & Exit Full Screen (Overflow Safe) */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0 max-w-full overflow-x-auto no-scrollbar py-0.5">
            {/* Heading Source Toggle (GPS COG vs Magnetic Compass) */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700 text-xs font-mono shadow-lg backdrop-blur-md shrink-0">
              <button
                type="button"
                onClick={() => setHeadingMode('gps')}
                className={`px-1.5 sm:px-2 py-0.5 rounded transition-all text-[9px] sm:text-[10px] font-bold flex items-center gap-1 ${
                  activeHeadingMode === 'gps'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="GPS Course Over Ground Heading (Default)"
              >
                <Radio className="w-2.5 h-2.5" />
                <span className="hidden xs:inline">GPS </span>COG
              </button>
              <button
                type="button"
                onClick={() => setHeadingMode('compass')}
                className={`px-1.5 sm:px-2 py-0.5 rounded transition-all text-[9px] sm:text-[10px] font-bold flex items-center gap-1 ${
                  activeHeadingMode === 'compass'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Internal Magnetic Compass Sensor"
              >
                <Compass className="w-2.5 h-2.5" />
                <span>COMPASS</span>
              </button>
            </div>

            {/* High-Res Tiles vs Pure Vector Toggle */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700 text-xs font-mono shadow-lg backdrop-blur-md shrink-0">
              <button
                type="button"
                onClick={() => setMapMode('high_res')}
                className={`px-1.5 sm:px-2 py-0.5 rounded transition-all text-[9px] sm:text-[10px] font-bold flex items-center gap-1 ${
                  mapMode === 'high_res'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="High-Resolution Satellite & Marine Tiles (Auto-cached for offline use)"
              >
                <Globe className="w-2.5 h-2.5" />
                <span>TILES</span>
                <span className="text-[8px] px-1 py-0.1 bg-emerald-950/90 text-emerald-300 rounded font-normal">
                  {cacheStats.count}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMapMode('vector')}
                className={`px-1.5 sm:px-2 py-0.5 rounded transition-all text-[9px] sm:text-[10px] font-bold flex items-center gap-1 ${
                  mapMode === 'vector'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Clean Digital Vector Nautical Chart"
              >
                <Layers className="w-2.5 h-2.5" />
                <span>VECTOR</span>
              </button>
            </div>

            {/* Download Working Area Button (Fullscreen) */}
            <button
              type="button"
              onClick={() => setIsWorkingAreaModalOpen(true)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[9px] sm:text-[10px] font-sans flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 backdrop-blur-md transition-all shrink-0"
              title="Download Working Area for fast offline marine navigation"
            >
              <Download className="w-3 h-3" />
              <span>Download Working Area</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Header Floating Status & Mode Bar (When NOT in Fullscreen) */}
      {!isFullscreen && (
        <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none z-20">
          {/* Left: Vessel Position, Heading Mode & Tile Mode */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className={`pointer-events-auto px-2.5 py-1 rounded-lg border backdrop-blur-md text-[11px] font-mono flex items-center gap-1.5 shadow-lg ${
              isNightMode 
                ? 'bg-red-950/85 border-red-800 text-red-300' 
                : 'bg-slate-900/90 border-slate-700 text-slate-200'
            }`}>
              <Compass className={`w-3 h-3 ${isNightMode ? 'text-red-400' : 'text-cyan-400'}`} />
              <span className="hidden xs:inline">Vessel:</span>
              <span className="font-bold text-white">
                {formatMarineDDM(gps.latitude !== null ? gps.latitude : vesselLat, false)}
              </span>
              <span className="text-slate-500">|</span>
              <span className="font-bold text-white">
                {formatMarineDDM(gps.longitude !== null ? gps.longitude : vesselLon, true)}
              </span>
            </div>

            {/* Heading Source Toggle (GPS COG vs Compass) */}
            <div className="pointer-events-auto flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700 text-[10px] font-mono shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={() => setHeadingMode('gps')}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 font-bold ${
                  activeHeadingMode === 'gps'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Course Over Ground from GPS (Default for Navigation & Routes)"
              >
                <Radio className="w-2.5 h-2.5" />
                <span>GPS COG</span>
              </button>
              <button
                type="button"
                onClick={() => setHeadingMode('compass')}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 font-bold ${
                  activeHeadingMode === 'compass'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Internal Magnetic Compass Sensor"
              >
                <Compass className="w-2.5 h-2.5" />
                <span>COMPASS</span>
              </button>
            </div>

            {/* High-Res Tiles vs Vector Toggle */}
            <div className="pointer-events-auto flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700 text-[10px] font-mono shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={() => setMapMode('high_res')}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 font-bold ${
                  mapMode === 'high_res'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="High-Resolution Satellite & Marine Slippy Tiles (Auto-cached for 100% offline use)"
              >
                <Globe className="w-2.5 h-2.5" />
                <span>TILES</span>
                <span className="text-[8px] px-1 py-0.1 bg-emerald-950 text-emerald-300 rounded font-normal">
                  {cacheStats.count}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMapMode('vector')}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 font-bold ${
                  mapMode === 'vector'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Clean Digital Vector Nautical Chart"
              >
                <Layers className="w-2.5 h-2.5" />
                <span>VECTOR</span>
              </button>
            </div>

            {/* Download Working Area Button (Standard Top Bar) */}
            <button
              type="button"
              onClick={() => setIsWorkingAreaModalOpen(true)}
              className="pointer-events-auto px-2.5 py-1 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[10px] font-sans flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 backdrop-blur-md transition-all shrink-0"
              title="Download Working Area for fast offline marine navigation"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Working Area</span>
            </button>

            {!isOnline && mapMode === 'high_res' && (
              <div className="pointer-events-auto px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-[10px] font-mono flex items-center gap-1 shadow">
                <HardDrive className="w-2.5 h-2.5" />
                <span>OFFLINE CACHE ({cacheStats.count})</span>
              </div>
            )}
          </div>

          {/* Right: Live Cursor Coordinate Display & Add Waypoint Banner */}
          <div className="flex items-center gap-1.5">
            {cursorCoords && (
              <div className={`hidden sm:flex pointer-events-auto px-2 py-0.5 rounded-lg border text-[10px] font-mono items-center gap-1 backdrop-blur-md ${
                isNightMode 
                  ? 'bg-red-950/70 border-red-900 text-red-400' 
                  : 'bg-slate-900/70 border-slate-800 text-slate-400'
              }`}>
                <Crosshair className="w-2.5 h-2.5 text-cyan-400" />
                <span>{cursorCoords.lat.toFixed(3)}°N, {cursorCoords.lon.toFixed(3)}°E</span>
              </div>
            )}

            {isAddWaypointMode && (
              <div className="pointer-events-auto px-2.5 py-1 bg-amber-500 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-lg animate-pulse">
                <MapPin className="w-3 h-3" />
                <span>Tap on map to place Waypoint</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pre-cache completion notification banner */}
      {preCacheSuccess && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-xl bg-emerald-900/95 border border-emerald-500 text-white text-xs font-mono font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{preCacheSuccess}</span>
        </div>
      )}

      {/* Floating Active Voyage Guidance Bar on Chart (Non-fullscreen) */}
      {!isFullscreen && navigationSession.isNavigating && targetWaypoint && (
        <div className="absolute top-12 left-2.5 right-14 z-20 pointer-events-none">
          <div className={`pointer-events-auto p-2 rounded-xl border backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-2 text-xs font-mono animate-fadeIn ${
            isNightMode ? 'bg-red-950/90 border-red-700 text-red-200' : 'bg-slate-900/90 border-amber-500/80 text-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
              <span className="text-amber-400 font-bold uppercase text-[10px]">Navigating To:</span>
              <span className="font-bold text-white underline underline-offset-2 text-xs">{targetWaypoint.name}</span>
            </div>

            <div className="flex items-center gap-2.5 text-[11px]">
              <span className="text-slate-400">
                DIST: <strong className="text-amber-400">{directDistanceNm.toFixed(1)} NM</strong>
              </span>
              <span className="text-slate-400">
                BRG: <strong className="text-cyan-300">{formatHeadingDeg(directBearingDeg)}</strong>
              </span>
              <button
                type="button"
                onClick={centerOnCourse}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-600 text-[10px]"
                title="Center course line"
              >
                Center View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Add Waypoint Guidance Banner (Positioned safely at bottom-center away from top HUD & right buttons) */}
      {isAddWaypointMode && (
        <div className={`absolute ${
          navigationSession.isNavigating 
            ? 'bottom-16 sm:bottom-20' 
            : 'bottom-4 sm:bottom-6'
        } left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[calc(100vw-5rem)] sm:max-w-md w-max shadow-2xl animate-fadeIn`}>
          <div className={`p-2 sm:p-2.5 rounded-xl border backdrop-blur-md shadow-2xl flex items-center justify-between gap-2.5 text-xs font-mono ${
            isNightMode ? 'bg-red-950/95 border-amber-500/80 text-amber-200' : 'bg-slate-900/95 border-amber-400 text-slate-100 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-amber-300 truncate">
                  📍 Double-click on chart to place waypoint ({waypointCount}/50)
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 truncate hidden xs:inline">
                  Sequential route waypoints
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {waypointCount > 0 && (
                <button
                  type="button"
                  onClick={handleClearLastWaypoint}
                  className="px-2 py-1 rounded-lg bg-rose-950/80 border border-rose-700 hover:bg-rose-900 text-rose-200 text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                  title="Clear Last Waypoint (Sequential Undo)"
                >
                  <Undo2 className="w-3 h-3" />
                  <span>Undo</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleToggleAddWaypointMode}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Finish adding waypoints"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Add Flag Guidance Banner */}
      {isAddFlagMode && (
        <div className={`absolute ${
          navigationSession.isNavigating 
            ? 'bottom-16 sm:bottom-20' 
            : 'bottom-4 sm:bottom-6'
        } left-1/2 -translate-x-1/2 z-40 pointer-events-auto max-w-[calc(100vw-5rem)] sm:max-w-md w-max shadow-2xl animate-fadeIn`}>
          <div className={`p-2 sm:p-2.5 rounded-xl border backdrop-blur-md shadow-2xl flex items-center justify-between gap-2.5 text-xs font-mono ${
            isNightMode ? 'bg-red-950/95 border-pink-500/80 text-pink-200' : 'bg-slate-900/95 border-pink-500 text-slate-100 shadow-[0_0_20px_rgba(236,72,153,0.3)]'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <Flag className="w-4 h-4 text-pink-400 animate-bounce shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-pink-300 truncate">
                  🚩 Tap anywhere on chart to drop Flag ({userTags.length} flags)
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 truncate hidden xs:inline">
                  Click any placed flag to rename or delete
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddFlagMode(false)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Cancel flag mode"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Right Floating Control Tools (Zoom, Fullscreen, Center, Fit, Add/Clear WP & Layers) */}
      <div className={`absolute ${isFullscreen ? 'top-14 sm:top-15' : 'top-13 sm:top-15'} right-2 sm:right-3.5 flex flex-col gap-1.5 sm:gap-2 pointer-events-auto z-30`}>
        {/* Fullscreen Toggle Button */}
        <button
          id="btn-toggle-fullscreen"
          type="button"
          onClick={toggleFullscreen}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-xl flex items-center justify-center ${
            isFullscreen
              ? 'bg-red-600 border-red-500 text-white animate-pulse'
              : isNightMode
              ? 'bg-red-950/90 border-red-800 text-red-200 hover:bg-red-900'
              : 'bg-slate-900/90 border-cyan-500/60 text-cyan-300 hover:bg-slate-800'
          }`}
          title={isFullscreen ? 'Exit Full Screen' : 'View Full Screen Chart with Marine Navigation HUD'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </button>

        {/* Fit All / Route Overview Button */}
        <button
          type="button"
          onClick={fitAllInView}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-lg flex items-center justify-center ${
            isNightMode 
              ? 'bg-red-950/90 border-red-800 text-red-200 hover:bg-red-900' 
              : 'bg-slate-900/90 border-slate-700 text-cyan-300 hover:bg-slate-800 hover:text-cyan-200'
          }`}
          title="Fit entire route and map on screen"
        >
          <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Add Waypoint Button (Double-click destination to place up to 50 WPs) */}
        <button
          type="button"
          onClick={handleToggleAddWaypointMode}
          className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-xl flex items-center justify-center ${
            isAddWaypointMode
              ? 'bg-amber-500 border-amber-300 text-slate-950 font-black shadow-amber-500/40 scale-105 animate-pulse'
              : isNightMode
              ? 'bg-red-950/90 border-red-800 text-amber-400 hover:bg-red-900'
              : 'bg-slate-900/90 border-slate-700 text-amber-400 hover:bg-slate-800 hover:border-amber-400'
          }`}
          title={isAddWaypointMode ? 'Deactivate Waypoint Add Mode' : `Add Waypoint (Double-Click Map) [${waypointCount}/50]`}
        >
          <MapPinPlus className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          {waypointCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-cyan-500 text-slate-950 text-[9px] font-black font-mono flex items-center justify-center border border-slate-900 leading-none">
              {waypointCount}
            </span>
          )}
        </button>

        {/* Clear Waypoint Button (Sequentially removes from last to first) */}
        <button
          type="button"
          onClick={handleClearLastWaypoint}
          disabled={waypointCount === 0}
          className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-xl flex items-center justify-center ${
            waypointCount === 0
              ? 'opacity-40 cursor-not-allowed bg-slate-900/50 border-slate-800 text-slate-500'
              : isNightMode
              ? 'bg-red-950/90 border-red-800 text-rose-300 hover:bg-rose-900 active:scale-95'
              : 'bg-slate-900/90 border-slate-700 text-rose-400 hover:bg-slate-800 hover:border-rose-400 hover:text-rose-300 active:scale-95'
          }`}
          title={waypointCount > 0 ? `Clear Last Waypoint (Sequential Undo) [${waypointCount} points]` : 'Clear Waypoint (No waypoints to undo)'}
        >
          <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* User Custom Flag Button (Direct single-click toggle placement mode) */}
        <button
          type="button"
          onClick={() => setIsAddFlagMode((prev) => !prev)}
          className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-xl flex items-center justify-center ${
            isAddFlagMode
              ? 'bg-pink-600 border-pink-300 text-white font-black shadow-pink-500/50 scale-105 animate-pulse ring-2 ring-pink-400'
              : isNightMode
              ? 'bg-red-950/90 border-red-800 text-pink-400 hover:bg-red-900'
              : 'bg-slate-900/90 border-slate-700 text-pink-400 hover:bg-slate-800 hover:border-pink-400'
          }`}
          title={isAddFlagMode ? 'Cancel Flag Placement Mode' : `Drop Flag Mark on Chart [${userTags.length} Marks]`}
        >
          <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400" />
          {userTags.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-pink-500 text-white text-[9px] font-black font-mono flex items-center justify-center border border-slate-900 leading-none">
              {userTags.length}
            </span>
          )}
        </button>

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={() => setZoom((prev) => Math.min(2500000, prev * 1.5))}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-lg flex items-center justify-center ${
            isNightMode 
              ? 'bg-red-950/90 border-red-800 text-red-200 hover:bg-red-900' 
              : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-400'
          }`}
          title="Zoom In (Close-up detail - Max 2,500,000x)"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={() => setZoom((prev) => Math.max(0.4, prev * 0.67))}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-lg flex items-center justify-center ${
            isNightMode 
              ? 'bg-red-950/90 border-red-800 text-red-200 hover:bg-red-900' 
              : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-400'
          }`}
          title="Zoom Out (World View)"
        >
          <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Center on Vessel Button */}
        <button
          type="button"
          onClick={centerOnVessel}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-lg flex items-center justify-center ${
            autoFollowVessel 
              ? (isNightMode ? 'bg-red-900 border-red-600 text-white' : 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold') 
              : (isNightMode ? 'bg-red-950/90 border-red-800 text-red-300' : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800')
          }`}
          title="Center & Follow Vessel"
        >
          <LocateFixed className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Layer Controls Toggle */}
        <button
          type="button"
          onClick={() => setShowLayersMenu(!showLayersMenu)}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-lg flex items-center justify-center ${
            showLayersMenu
              ? (isNightMode ? 'bg-red-800 border-red-600 text-white' : 'bg-slate-800 border-cyan-500 text-cyan-300')
              : (isNightMode ? 'bg-red-950/90 border-red-800 text-red-300' : 'bg-slate-900/90 border-slate-700 text-slate-300 hover:bg-slate-800')
          }`}
          title="Chart Layers, Tile Providers & Nautical Features"
        >
          <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
      </div>

      {/* Layers & Map Selection Popup (Clean, focused only on Layer Selection) */}
      {showLayersMenu && (
        <div className={`absolute ${isFullscreen ? 'top-14 sm:top-16' : 'top-14 sm:top-16'} right-12 sm:right-14 z-40 p-3 rounded-2xl border shadow-2xl backdrop-blur-lg flex flex-col gap-2.5 min-w-[260px] max-w-[calc(100vw-60px)] max-h-[80vh] overflow-y-auto text-xs font-sans ${
          isNightMode ? 'bg-red-950/95 border-red-800 text-red-200' : 'bg-slate-900/95 border-slate-700 text-slate-200'
        }`} dir="ltr">
          {/* Header */}
          <div className="pb-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Chart Layers & Overlays</span>
            </span>
            <button
              type="button"
              onClick={() => setShowLayersMenu(false)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 1. Base Map Layer Selection */}
          <div className="pb-2 border-b border-slate-800 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-300">Base Chart Layer:</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setMapMode('high_res')}
                className={`p-2 rounded-xl text-left transition-all flex flex-col gap-0.5 ${
                  mapMode === 'high_res'
                    ? 'bg-emerald-600 text-white font-bold shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <Globe className="w-3 h-3" />
                  <span>Satellite Imagery</span>
                </div>
                <div className="text-[9px] opacity-80 font-mono">High-Res Satellite</div>
              </button>

              <button
                type="button"
                onClick={() => setMapMode('vector')}
                className={`p-2 rounded-xl text-left transition-all flex flex-col gap-0.5 ${
                  mapMode === 'vector'
                    ? 'bg-cyan-600 text-white font-bold shadow'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 text-[11px]">
                  <Layers className="w-3 h-3" />
                  <span>ENC Vector</span>
                </div>
                <div className="text-[9px] opacity-80 font-mono">ECDIS S-52 Style</div>
              </button>
            </div>

            {/* Provider Options when High-Res */}
            {mapMode === 'high_res' && (
              <div className="flex flex-col gap-1 mt-1">
                <span className="text-[9px] text-slate-400 font-bold">Satellite Imagery Source:</span>
                <div className="grid grid-cols-1 gap-1">
                  {LIVE_TILE_PROVIDERS.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setLiveProvider(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-left transition-all text-[10px] flex items-center justify-between ${
                        liveProvider === p.id
                          ? 'bg-cyan-950 border border-cyan-400 text-cyan-200 font-bold'
                          : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <span>{p.name}</span>
                      <span className="text-[8px] opacity-80 font-mono">{p.badge}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Nautical Feature Layers */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-300">Nautical Features & Overlays:</span>

            {/* User Custom Flags Layer */}
            <label className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-pink-950/30 border border-pink-500/30 cursor-pointer hover:bg-pink-950/50">
              <span className="flex items-center gap-1.5 text-pink-300 font-bold text-[11px]">
                <Flag className="w-3.5 h-3.5 text-pink-400" />
                <span>Chart Flag Marks (User Flags)</span>
              </span>
              <input 
                type="checkbox" 
                checked={showUserTags} 
                onChange={(e) => setShowUserTags(e.target.checked)} 
                className="rounded accent-pink-500"
              />
            </label>

            {/* Buoys */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Navigation Buoys & Marks (IALA)</span>
              </span>
              <input 
                type="checkbox" 
                checked={showBuoys} 
                onChange={(e) => setShowBuoys(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* OpenSeaMap Seamarks */}
            {mapMode === 'high_res' && (
              <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                  <span>OpenSeaMap Hydrographic Seamarks</span>
                </span>
                <input 
                  type="checkbox" 
                  checked={showLiveSeamarks} 
                  onChange={(e) => setShowLiveSeamarks(e.target.checked)} 
                  className="rounded accent-cyan-500"
                />
              </label>
            )}

            {/* Oil Rigs */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Offshore Oil & Gas Platforms</span>
              </span>
              <input 
                type="checkbox" 
                checked={showOilPlatforms} 
                onChange={(e) => setShowOilPlatforms(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* Lighthouses */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-yellow-400" />
                <span>Lighthouses & Light Beacons</span>
              </span>
              <input 
                type="checkbox" 
                checked={showLighthouses} 
                onChange={(e) => setShowLighthouses(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* TSS Shipping Lanes */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Traffic Separation Schemes (TSS)</span>
              </span>
              <input 
                type="checkbox" 
                checked={showShippingLanes} 
                onChange={(e) => setShowShippingLanes(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* Submarine Pipelines */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-rose-400" />
                <span>Submarine Pipelines & Power Cables</span>
              </span>
              <input 
                type="checkbox" 
                checked={showPipelines} 
                onChange={(e) => setShowPipelines(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* Depth Soundings */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                <span>Depth Soundings (Bathymetric)</span>
              </span>
              <input 
                type="checkbox" 
                checked={showSoundings} 
                onChange={(e) => setShowSoundings(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* Bathymetry */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Waves className="w-3.5 h-3.5 text-cyan-400" />
                <span>Depth Contours & Gradient Fills</span>
              </span>
              <input 
                type="checkbox" 
                checked={showBathymetry} 
                onChange={(e) => setShowBathymetry(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* Graticule */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-slate-400" />
                <span>Geographic Graticule (Lat/Lon Grid)</span>
              </span>
              <input 
                type="checkbox" 
                checked={showGraticule} 
                onChange={(e) => setShowGraticule(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>

            {/* Range Rings */}
            <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Navigation2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Vessel Range Rings</span>
              </span>
              <input 
                type="checkbox" 
                checked={showRangeRings} 
                onChange={(e) => setShowRangeRings(e.target.checked)} 
                className="rounded accent-cyan-500"
              />
            </label>
          </div>

          {/* Quick link to Working Area Downloader */}
          <div className="pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowLayersMenu(false);
                setIsWorkingAreaModalOpen(true);
              }}
              className="w-full py-2 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Working Area (Offline Storage)</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Marine Navigate HUD: Speed (SOG) & Distance to First Waypoint */}
      {navigationSession.isNavigating && (
        <div className={`absolute bottom-2.5 sm:bottom-3.5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[calc(100vw-1.5rem)] px-3 py-1.5 rounded-xl border shadow-2xl backdrop-blur-md flex items-center gap-2 sm:gap-3 text-xs font-mono animate-fadeIn ${
          isNightMode 
            ? 'bg-red-950/95 border-red-700 text-red-200' 
            : 'bg-slate-900/95 border-amber-500/80 text-slate-100 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
        }`}>
          {/* Speed over Ground (SOG) */}
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SPEED:</span>
            <span className="text-xs sm:text-sm font-black text-emerald-400 leading-none">
              {(gps.speedKnots !== null ? gps.speedKnots : currentSpeedKnots).toFixed(1)}
            </span>
            <span className="text-[9px] text-slate-400 leading-none">kts</span>
          </div>

          <div className="w-px h-4 bg-slate-700/80" />

          {/* Distance to First Waypoint */}
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {activeRoute && activeRoute.waypoints && activeRoute.waypoints.length > 1 ? 'DIST WP1:' : 'DIST WP:'}
            </span>
            <span className="text-xs sm:text-sm font-black text-cyan-300 leading-none">
              {distanceToFirstWpNm !== null ? distanceToFirstWpNm.toFixed(2) : directDistanceNm.toFixed(2)}
            </span>
            <span className="text-[9px] text-slate-400 leading-none">NM</span>
            {firstWaypoint && (
              <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-[80px]">
                ({firstWaypoint.name})
              </span>
            )}
          </div>

          {/* Target Waypoint Distance (if multi-waypoint route) */}
          {activeRoute && activeRoute.waypoints && activeRoute.waypoints.length > 1 && (
            <>
              <div className="hidden xs:block w-px h-4 bg-slate-700/80" />
              <div className="hidden xs:flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">LEG:</span>
                <span className="text-xs sm:text-sm font-black text-amber-400 leading-none">
                  {directDistanceNm.toFixed(2)}
                </span>
                <span className="text-[9px] text-slate-400 leading-none">NM</span>
              </div>
            </>
          )}

          {/* Bearing (BRG) */}
          <div className="hidden md:flex items-center gap-1 border-l border-slate-700/80 pl-2">
            <span className="text-[10px] text-slate-400 font-bold">BRG:</span>
            <span className="text-xs font-black text-white leading-none">
              {formatHeadingDeg(directBearingDeg)}
            </span>
          </div>

          {/* ETA */}
          {currentEta !== '---' && (
            <div className="hidden lg:flex items-center gap-1 border-l border-slate-700/80 pl-2">
              <span className="text-[10px] text-slate-400 font-bold">ETA:</span>
              <span className="text-xs font-black text-indigo-300 leading-none">
                {currentEta}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Right: Clean Status Badge (Hidden in Fullscreen for spotless view) */}
      {!isFullscreen && (
        <div className={`absolute bottom-3 right-3 px-3 py-1 rounded-lg border text-[10px] font-mono backdrop-blur-md pointer-events-none z-20 shadow-md ${
          isNightMode ? 'bg-red-950/80 border-red-900 text-red-400' : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}>
          Zoom: {zoom.toFixed(0)}x • {mapMode === 'high_res' ? `🛰️ High-Res Tiles (${cacheStats.count} cached)` : '📡 Vector Nautical Chart'}
        </div>
      )}

      {/* Download Working Area Modal */}
      <WorkingAreaModal
        isOpen={isWorkingAreaModalOpen}
        onClose={() => setIsWorkingAreaModalOpen(false)}
        gps={gps}
        currentCenter={center}
        currentZoom={zoom}
        viewportBounds={{
          minLon: canvasToGeo(0, 0, 800, 600).lon,
          maxLon: canvasToGeo(800, 600, 800, 600).lon,
          minLat: canvasToGeo(0, 600, 800, 600).lat,
          maxLat: canvasToGeo(800, 0, 800, 600).lat,
        }}
        activeProvider={liveProvider}
        onProviderChange={(p) => setLiveProvider(p)}
        isNightMode={isNightMode}
        onDownloadComplete={() => {
          setMapMode('high_res');
          triggerTileRedraw();
        }}
      />

      {/* User Custom Tag Modal */}
      <UserTagModal
        isOpen={isTagModalOpen}
        onClose={() => {
          setIsTagModalOpen(false);
          setTagToEdit(null);
          setTagInitialCoords(null);
        }}
        tagToEdit={tagToEdit}
        initialCoords={tagInitialCoords}
        gps={gps}
        onSaveTag={handleSaveUserTag}
        onDeleteTag={handleDeleteUserTag}
        onNavigateToTag={handleNavigateToUserTag}
        isNightMode={isNightMode}
      />
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return (
      <>
        <div className={`w-full h-[460px] sm:h-[560px] lg:h-[640px] rounded-2xl border flex flex-col items-center justify-center gap-3 ${
          isNightMode ? 'bg-red-950/20 border-red-900/50 text-red-400' : 'bg-slate-900/40 border-slate-800 text-slate-400'
        }`}>
          <Maximize2 className="w-8 h-8 opacity-40 animate-pulse text-cyan-400" />
          <span className="font-mono text-xs font-bold text-slate-300">Marine Chart is currently in Full Screen</span>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-mono font-bold transition-all shadow-md"
          >
            Restore Embedded View
          </button>
        </div>
        {createPortal(chartContent, document.body)}
      </>
    );
  }

  return chartContent;
};
