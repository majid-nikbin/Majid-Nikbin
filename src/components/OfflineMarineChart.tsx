import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  Globe,
  Navigation2,
  Square,
  Sparkles,
  Database,
  Loader2,
  CheckCircle2,
  Trash2,
  Maximize2,
  Minimize2,
  Flame,
  Radio,
  Clock,
  Gauge
} from 'lucide-react';
import { GpsData, CompassData, MarineRoute, Waypoint, NavigationSession, UserTag, WorkingAreaRecord } from '../types';
import {
  WORLD_LANDMASSES,
  INLAND_WATER_BODIES,
  BATHYMETRY_CONTOURS,
  MARINE_PLACE_LABELS,
  MARINE_LIGHTHOUSES,
  SHIPPING_LANES_TSS,
  MARINE_BUOYS,
  MARINE_HAZARDS,
  NAUTICAL_SOUNDINGS
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
  renderLiveMapTiles,
  getCachedTileStats,
  clearTileCache,
  preCacheAreaTiles,
  subscribeTileCacheUpdates,
  autoDownloadGlobalMarineOverview
} from '../utils/marineTileLoader';

interface OfflineMarineChartProps {
  gps: GpsData;
  compass: CompassData;
  routes: MarineRoute[];
  activeRoute: MarineRoute | null;
  navigationSession: NavigationSession;
  userTags: UserTag[];
  workingAreas: WorkingAreaRecord[];
  onAddWaypointToRoute?: (waypoint: Waypoint) => void;
  onRemoveWaypointFromRoute?: (waypointId: string) => void;
  onStartNavigation?: (route: MarineRoute, targetWp?: Waypoint) => void;
  onStopNavigation?: () => void;
  onSaveWorkingArea?: (area: WorkingAreaRecord) => void;
  onDeleteWorkingArea?: (areaId: string) => void;
}

export const OfflineMarineChart: React.FC<OfflineMarineChartProps> = ({
  gps,
  compass,
  routes,
  activeRoute,
  navigationSession,
  userTags,
  workingAreas,
  onAddWaypointToRoute,
  onRemoveWaypointFromRoute,
  onStartNavigation,
  onStopNavigation
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Map viewport state: center [lon, lat], zoom
  const [center, setCenter] = useState<[number, number]>([
    gps.longitude ?? 56.2736,
    gps.latitude ?? 27.1832
  ]);
  const [zoom, setZoom] = useState<number>(35); // Initial marine zoom
  const [mapMode, setMapMode] = useState<'chart' | 'satellite'>('chart');
  const [isFollowVessel, setIsFollowVessel] = useState<boolean>(true);
  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [showSeamarks, setShowSeamarks] = useState<boolean>(true);
  const [showRangeRings, setShowRangeRings] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isAddWaypointMode, setIsAddWaypointMode] = useState<boolean>(false);

  // Cache stats state
  const [cacheStats, setCacheStats] = useState({ count: 0, estimatedSizeMb: 0 });
  const [isCachingCurrentView, setIsCachingCurrentView] = useState(false);
  const [cacheSuccessMsg, setCacheSuccessMsg] = useState('');

  // Mouse / Touch interaction refs
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);

  // Active navigation target
  const targetWaypoint = activeRoute?.waypoints.find(
    (w) => w.id === navigationSession.targetWaypointId
  ) || activeRoute?.waypoints[0];

  const vesselLon = gps.longitude ?? center[0];
  const vesselLat = gps.latitude ?? center[1];

  // Auto-follow vessel
  useEffect(() => {
    if (isFollowVessel && gps.longitude !== null && gps.latitude !== null) {
      setCenter([gps.longitude, gps.latitude]);
    }
  }, [isFollowVessel, gps.longitude, gps.latitude]);

  // Update cache stats on mount and subscription
  useEffect(() => {
    const updateStats = () => {
      getCachedTileStats().then(setCacheStats);
    };
    updateStats();
    const unsub = subscribeTileCacheUpdates(updateStats);
    return () => unsub();
  }, []);

  // Web Mercator coordinate transformations
  const geoToCanvas = useCallback(
    (lon: number, lat: number, width: number, height: number): { x: number; y: number } => {
      const centerLon = center[0];
      const centerLat = center[1];
      const centerLatRad = (centerLat * Math.PI) / 180;
      const cosCenterLat = Math.max(0.15, Math.cos(centerLatRad));

      const dx = (lon - centerLon) * (zoom * 10 * cosCenterLat);
      const dy = -(lat - centerLat) * (zoom * 10);

      return {
        x: width / 2 + dx,
        y: height / 2 + dy
      };
    },
    [center, zoom]
  );

  const canvasToGeo = useCallback(
    (x: number, y: number, width: number, height: number): { lon: number; lat: number } => {
      const centerLon = center[0];
      const centerLat = center[1];
      const centerLatRad = (centerLat * Math.PI) / 180;
      const cosCenterLat = Math.max(0.15, Math.cos(centerLatRad));

      const dx = x - width / 2;
      const dy = y - height / 2;

      const lon = centerLon + dx / (zoom * 10 * cosCenterLat);
      const lat = centerLat - dy / (zoom * 10);

      return { lon, lat };
    },
    [center, zoom]
  );

  // Trigger tile redraw on async load
  const triggerRedraw = useCallback(() => {
    drawChart();
  }, []);

  // Main Canvas Rendering Loop
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Water Background
    ctx.fillStyle = isNightMode ? '#070f1e' : (mapMode === 'chart' ? '#c7e6f4' : '#071626');
    ctx.fillRect(0, 0, width, height);

    // 2. High-Resolution Slippy Map Tiles (Zero-delay offline cache!)
    const provider: LiveTileProvider = mapMode === 'chart' ? 'google_terrain' : 'google_hybrid';
    renderLiveMapTiles(
      ctx,
      provider,
      zoom,
      geoToCanvas,
      canvasToGeo,
      width,
      height,
      triggerRedraw,
      showSeamarks
    );

    // 3. World Landmasses Fallback
    WORLD_LANDMASSES.forEach((land) => {
      if (land.points.length < 3) return;
      ctx.beginPath();
      const first = geoToCanvas(land.points[0][0], land.points[0][1], width, height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < land.points.length; i++) {
        const pt = geoToCanvas(land.points[i][0], land.points[i][1], width, height);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fillStyle = isNightMode ? '#1e293b' : '#ede3cd';
      ctx.fill();
      ctx.strokeStyle = isNightMode ? '#334155' : '#8c6f3e';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    // 4. Inland Waters
    INLAND_WATER_BODIES.forEach((water) => {
      if (water.points.length < 3) return;
      ctx.beginPath();
      const first = geoToCanvas(water.points[0][0], water.points[0][1], width, height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < water.points.length; i++) {
        const pt = geoToCanvas(water.points[i][0], water.points[i][1], width, height);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.fillStyle = isNightMode ? '#070f1e' : '#c7e6f4';
      ctx.fill();
      ctx.strokeStyle = isNightMode ? '#334155' : '#8c6f3e';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    // 5. TSS Shipping Lanes
    SHIPPING_LANES_TSS.forEach((lane) => {
      if (lane.points.length < 2) return;
      ctx.beginPath();
      const first = geoToCanvas(lane.points[0][0], lane.points[0][1], width, height);
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < lane.points.length; i++) {
        const pt = geoToCanvas(lane.points[i][0], lane.points[i][1], width, height);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(217, 70, 239, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 6. Navigation Buoys & Lighthouses
    MARINE_LIGHTHOUSES.forEach((light) => {
      const pt = geoToCanvas(light.lon, light.lat, width, height);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = light.color;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      if (zoom > 20) {
        ctx.fillStyle = isNightMode ? '#f8fafc' : '#0f172a';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(light.name, pt.x + 8, pt.y + 3);
      }
    });

    MARINE_BUOYS.forEach((buoy) => {
      const pt = geoToCanvas(buoy.lon, buoy.lat, width, height);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = buoy.color;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 7. Routes and Waypoints
    if (activeRoute && activeRoute.waypoints.length > 0) {
      ctx.beginPath();
      const firstWp = geoToCanvas(activeRoute.waypoints[0].longitude, activeRoute.waypoints[0].latitude, width, height);
      ctx.moveTo(firstWp.x, firstWp.y);
      for (let i = 1; i < activeRoute.waypoints.length; i++) {
        const wp = activeRoute.waypoints[i];
        const pt = geoToCanvas(wp.longitude, wp.latitude, width, height);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();

      activeRoute.waypoints.forEach((wp, idx) => {
        const pt = geoToCanvas(wp.longitude, wp.latitude, width, height);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f59e0b';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(idx + 1), pt.x, pt.y + 3);
        ctx.textAlign = 'left';
      });
    }

    // 8. Navigation Direct Track to Destination Waypoint
    if (navigationSession.isNavigating && targetWaypoint) {
      const boatPt = geoToCanvas(vesselLon, vesselLat, width, height);
      const targetPt = geoToCanvas(targetWaypoint.longitude, targetWaypoint.latitude, width, height);

      ctx.beginPath();
      ctx.moveTo(boatPt.x, boatPt.y);
      ctx.lineTo(targetPt.x, targetPt.y);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 9. Range Rings around Vessel
    const boatPt = geoToCanvas(vesselLon, vesselLat, width, height);
    if (showRangeRings) {
      const nmPixels = (zoom * 10) / 60;
      [0.5, 1, 2, 5].forEach((ringNm) => {
        const radius = nmPixels * ringNm;
        if (radius > 15 && radius < Math.max(width, height) * 1.5) {
          ctx.beginPath();
          ctx.arc(boatPt.x, boatPt.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = isNightMode ? '#ef4444' : '#64748b';
          ctx.font = '8px monospace';
          ctx.fillText(`${ringNm}NM`, boatPt.x + radius + 3, boatPt.y - 2);
        }
      });
    }

    // 10. VESSEL BOAT ICON & HEADING VECTOR LINE (With Vivid RED outline!)
    const headingDeg = (gps.speedKnots && gps.speedKnots > 1 && gps.heading !== null)
      ? gps.heading
      : (compass.trueHeading || compass.magneticHeading || 0);
    const headingRad = (headingDeg * Math.PI) / 180;

    // Heading Vector Line (with bold Red casing / border for superior visibility on blue sea)
    const vectorLen = Math.max(40, Math.min(140, (gps.speedKnots || 5) * 6));
    const headX = boatPt.x + Math.sin(headingRad) * vectorLen;
    const headY = boatPt.y - Math.cos(headingRad) * vectorLen;

    // Red Outer Casing Border
    ctx.beginPath();
    ctx.moveTo(boatPt.x, boatPt.y);
    ctx.lineTo(headX, headY);
    ctx.strokeStyle = '#dc2626'; // Vivid Red border
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner Blue Core line
    ctx.beginPath();
    ctx.moveTo(boatPt.x, boatPt.y);
    ctx.lineTo(headX, headY);
    ctx.strokeStyle = isNightMode ? '#ef4444' : '#0284c7'; // Rich bright blue core
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrow tip with Red border and Blue fill
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(headingRad);
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-5, 4);
    ctx.lineTo(5, 4);
    ctx.closePath();
    ctx.fillStyle = isNightMode ? '#ef4444' : '#0284c7';
    ctx.fill();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Triangular Vessel Hull Symbol with Vivid RED Outline
    ctx.save();
    ctx.translate(boatPt.x, boatPt.y);
    ctx.rotate(headingRad);

    ctx.beginPath();
    ctx.moveTo(0, -13); // Bow
    ctx.lineTo(8, 2);   // Starboard Mid
    ctx.lineTo(5.5, 11);  // Starboard Stern
    ctx.lineTo(-5.5, 11); // Port Stern
    ctx.lineTo(-8, 2);  // Port Mid
    ctx.closePath();

    // Hull Fill (Cyan / Blue)
    ctx.fillStyle = isNightMode ? '#ef4444' : '#0ea5e9';
    ctx.fill();

    // High-contrast Red Outer Stroke (خط دور قرمز پررنگ متمایز از آبی دریا)
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2.8;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Center Position Dot
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }, [
    center,
    zoom,
    mapMode,
    isNightMode,
    showSeamarks,
    showRangeRings,
    vesselLon,
    vesselLat,
    gps,
    compass,
    activeRoute,
    navigationSession,
    targetWaypoint,
    geoToCanvas,
    canvasToGeo,
    triggerRedraw
  ]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      drawChart();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawChart]);

  // Redraw when dependencies change
  useEffect(() => {
    drawChart();
  }, [drawChart]);

  // Touch and Mouse Pan / Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    setIsFollowVessel(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const oldCenterGeo = canvasToGeo(width / 2, height / 2, width, height);
    const newCenterGeo = canvasToGeo(width / 2 - dx, height / 2 - dy, width, height);

    setCenter([newCenterGeo.lon, newCenterGeo.lat]);
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.25 : 0.8;
    setZoom((prev) => Math.max(1, Math.min(5000, prev * factor)));
  };

  // Touch Drag & Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsFollowVessel(false);
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingRef.current) {
      const dx = e.touches[0].clientX - lastMousePosRef.current.x;
      const dy = e.touches[0].clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      const newCenterGeo = canvasToGeo(width / 2 - dx, height / 2 - dy, width, height);
      setCenter([newCenterGeo.lon, newCenterGeo.lat]);
    } else if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / touchStartDistRef.current;
      touchStartDistRef.current = currentDist;
      setZoom((prev) => Math.max(1, Math.min(5000, prev * (1 + (ratio - 1) * 0.8))));
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    touchStartDistRef.current = null;
  };

  // Canvas Click: Add Waypoint
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAddWaypointMode || !onAddWaypointToRoute) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    const geo = canvasToGeo(x, y, width, height);
    const newWp: Waypoint = {
      id: `wp_${Date.now()}`,
      name: `WP-${(activeRoute?.waypoints.length || 0) + 1}`,
      latitude: Number(geo.lat.toFixed(5)),
      longitude: Number(geo.lon.toFixed(5)),
      createdAt: Date.now()
    };
    onAddWaypointToRoute(newWp);
    setIsAddWaypointMode(false);
  };

  // One-click Download Viewport for 100% Offline
  const handleCacheCurrentView = async () => {
    setIsCachingCurrentView(true);
    setCacheSuccessMsg('');
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      const nw = canvasToGeo(0, 0, width, height);
      const se = canvasToGeo(width, height, width, height);

      const minLon = Math.min(nw.lon, se.lon);
      const maxLon = Math.max(nw.lon, se.lon);
      const minLat = Math.min(nw.lat, se.lat);
      const maxLat = Math.max(nw.lat, se.lat);

      const continuousZ = 3.8137 + Math.log2(zoom);
      const currentZ = Math.max(1, Math.min(18, Math.round(continuousZ)));
      const minZ = Math.max(1, currentZ - 1);
      const maxZ = Math.min(18, currentZ + 1);

      const provider: LiveTileProvider = mapMode === 'chart' ? 'google_terrain' : 'google_hybrid';
      const res = await preCacheAreaTiles(provider, minLon, maxLon, minLat, maxLat, minZ, maxZ);
      setCacheSuccessMsg(`ذخیره شد: ${res.downloaded} قطعه نقشه برای حالت آفلاین`);
      getCachedTileStats().then(setCacheStats);
    } catch {
      setCacheSuccessMsg('خطا در ذخیره‌سازی آفلاین');
    } finally {
      setIsCachingCurrentView(false);
      setTimeout(() => setCacheSuccessMsg(''), 4000);
    }
  };

  const navDistNm = targetWaypoint
    ? calculateDistanceNm(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude)
    : 0;
  const navBrgDeg = targetWaypoint
    ? calculateBearing(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude)
    : 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 font-sans ${
        isFullscreen ? 'fixed inset-0 z-50' : 'min-h-[460px]'
      }`}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Top Map Toolbar */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
        {/* Layer Toggle (CHART vs SATELLITE) */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 shadow-2xl backdrop-blur-md pointer-events-auto">
          <button
            type="button"
            onClick={() => setMapMode('chart')}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              mapMode === 'chart'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-100'
            }`}
            title="Marine Nautical Chart (Hydrography, Docks & Relief)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>CHART</span>
          </button>
          <button
            type="button"
            onClick={() => setMapMode('satellite')}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
              mapMode === 'satellite'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-100'
            }`}
            title="High-Resolution Satellite Imagery"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>SATELLITE</span>
          </button>
        </div>

        {/* Navigation Quick Status Bar */}
        {navigationSession.isNavigating && targetWaypoint && (
          <div className="flex items-center gap-2 bg-slate-900/95 px-3 py-1.5 rounded-xl border border-amber-500/70 shadow-2xl backdrop-blur-md text-xs font-mono pointer-events-auto">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Navigation2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>{targetWaypoint.name}</span>
            </span>
            <span className="text-slate-300 font-bold">{navDistNm.toFixed(1)} NM</span>
            <span className="text-cyan-400 font-bold">{formatHeadingDeg(navBrgDeg)}</span>
            <button
              type="button"
              onClick={onStopNavigation}
              className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white shadow"
              title="توقف ناوبری"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </div>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Quick Offline Cache Button */}
          <button
            type="button"
            onClick={handleCacheCurrentView}
            disabled={isCachingCurrentView}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-cyan-300 hover:text-white font-bold text-xs flex items-center gap-1.5 shadow-2xl backdrop-blur-md transition-all active:scale-95 disabled:opacity-50"
            title="ذخیره آفلاین محدوده فعلی نقشه"
          >
            {isCachingCurrentView ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Database className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="hidden sm:inline">ذخیره آفلاین</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white shadow-2xl backdrop-blur-md transition-all"
            title="تمام صفحه"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Floating Action Notifications */}
      {cacheSuccessMsg && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-1.5 z-20 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{cacheSuccessMsg}</span>
        </div>
      )}

      {/* Bottom Floating Map Controls (Zoom, Center Vessel, Add Waypoint) */}
      <div className="absolute bottom-4 right-3 flex flex-col gap-2 z-10">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(5000, z * 1.35))}
          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:text-white shadow-2xl backdrop-blur-md active:scale-95 transition-all"
          title="بزرگ‌نمایی"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(1, z * 0.74))}
          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:text-white shadow-2xl backdrop-blur-md active:scale-95 transition-all"
          title="کوچک‌نمایی"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setIsFollowVessel(true);
            if (gps.longitude && gps.latitude) {
              setCenter([gps.longitude, gps.latitude]);
            }
          }}
          className={`p-2.5 rounded-xl border shadow-2xl backdrop-blur-md active:scale-95 transition-all ${
            isFollowVessel
              ? 'bg-cyan-600 text-white border-cyan-400'
              : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:text-white'
          }`}
          title="مرکز روی موقعیت شناور"
        >
          <Crosshair className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsAddWaypointMode(!isAddWaypointMode)}
          className={`p-2.5 rounded-xl border shadow-2xl backdrop-blur-md active:scale-95 transition-all ${
            isAddWaypointMode
              ? 'bg-amber-600 text-white border-amber-400 animate-pulse'
              : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:text-white'
          }`}
          title="افزودن نقطه مسیر روی نقشه"
        >
          <MapPinPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom-Left Marine Status Hud */}
      <div className="absolute bottom-4 left-3 flex flex-col gap-1 bg-slate-900/90 p-2 rounded-xl border border-slate-800 shadow-2xl backdrop-blur-md text-[10px] font-mono pointer-events-none z-10">
        <div className="text-cyan-400 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>OFFLINE READY ({cacheStats.count} TILES)</span>
        </div>
        <div className="text-slate-300">
          SOG: <span className="text-amber-400 font-bold">{gps.speedKnots ? gps.speedKnots.toFixed(1) : '0.0'} KTS</span>
          {' • '}
          COG: <span className="text-cyan-300 font-bold">{formatHeadingDeg(gps.heading)}</span>
        </div>
        <div className="text-slate-400 text-[9px]">
          POS: {formatMarineDDM(gps.latitude, gps.longitude).lat} - {formatMarineDDM(gps.latitude, gps.longitude).lon}
        </div>
      </div>
    </div>
  );
};
