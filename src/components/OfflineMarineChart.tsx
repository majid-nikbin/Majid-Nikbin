import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  Minus, 
  Crosshair, 
  Compass, 
  MapPin, 
  Layers, 
  Navigation2, 
  LocateFixed,
  Maximize,
  Maximize2,
  Minimize2,
  Waves,
  Anchor,
  Tag,
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
  Wind
} from 'lucide-react';
import { GpsData, CompassData, MarineRoute, Waypoint, NavigationSession } from '../types';
import { 
  WORLD_LANDMASSES, 
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
  renderLiveMapTiles
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
  onSelectWaypoint?: (wp: Waypoint) => void;
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
  onSelectWaypoint,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  // Map Mode: Offline Marine Vector vs Online Live Web Tiles
  const [mapMode, setMapMode] = useState<'offline' | 'live'>('offline');
  const [liveProvider, setLiveProvider] = useState<LiveTileProvider>('esri_ocean');
  const [showLiveSeamarks, setShowLiveSeamarks] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

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

  // Keep zoom and center refs in sync
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setMapMode('offline'); // auto fallback to offline vector if connection drops
    };

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

  // Coordinate Conversion Functions (Equirectangular / Mercator projection at local scale)
  const geoToCanvas = useCallback((lon: number, lat: number, width: number, height: number) => {
    const scale = zoom * 10;
    const x = width / 2 + (lon - center[0]) * scale;
    const y = height / 2 - (lat - center[1]) * scale;
    return { x, y };
  }, [center, zoom]);

  const canvasToGeo = useCallback((x: number, y: number, width: number, height: number) => {
    const scale = zoom * 10;
    const lon = center[0] + (x - width / 2) / scale;
    const lat = center[1] - (y - height / 2) / scale;
    return { lat, lon };
  }, [center, zoom]);

  const triggerTileRedraw = useCallback(() => {
    renderTriggerRef.current = (renderTriggerRef.current + 1) % 1000;
  }, []);

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
    // 1. BASE BACKGROUND / LIVE WEB TILES
    // =========================================================================
    if (mapMode === 'live' && isOnline) {
      // Background fill while tiles load
      ctx.fillStyle = '#071626';
      ctx.fillRect(0, 0, width, height);

      // Render Web Mercator Live Tiles into canvas
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
    } else {
      // 1. Deep Oceanic Water Base Fill (Admiralty Deep Blue)
      ctx.fillStyle = isNightMode ? '#080404' : '#071626';
      ctx.fillRect(0, 0, width, height);

      // 2. Draw Bathymetry Depth Zones & Contours
      if (showBathymetry) {
        BATHYMETRY_CONTOURS.forEach((contour) => {
          if (contour.points.length < 3) return;

          ctx.beginPath();
          contour.points.forEach(([lon, lat], index) => {
            const pt = geoToCanvas(lon, lat, width, height);
            if (index === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();

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
          ctx.lineWidth = 1;
          ctx.stroke();

          // Depth Label
          if (zoom > 20 && contour.points.length > 2) {
            const midPt = geoToCanvas(contour.points[0][0], contour.points[0][1], width, height);
            if (midPt.x > 0 && midPt.x < width && midPt.y > 0 && midPt.y < height) {
              ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.7)' : 'rgba(56, 189, 248, 0.75)';
              ctx.font = 'bold 9px monospace';
              ctx.fillText(`${contour.depthMeters}m`, midPt.x, midPt.y);
            }
          }
        });
      }

      // 3. Draw World Landmass Polygons & Coastlines (Warm Khaki / Mustard Tone)
      WORLD_LANDMASSES.forEach((land) => {
        if (land.points.length < 3) return;

        ctx.beginPath();
        land.points.forEach(([lon, lat], index) => {
          const pt = geoToCanvas(lon, lat, width, height);
          if (index === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();

        // Land fill color: Authentic Nautical Chart Khaki / Mustard tone
        ctx.fillStyle = isNightMode ? '#2d2215' : '#d8c79d';
        ctx.fill();

        // Coastline stroke: Rich ochre shoreline border
        ctx.strokeStyle = isNightMode ? '#6e4f25' : '#9b824f';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      });
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

      const step = zoom > 150 ? 0.05 : zoom > 70 ? 0.1 : zoom > 30 ? 0.5 : zoom > 10 ? 1 : 5;
      const startLon = Math.floor(bounds.minLon / step) * step;
      const maxLon = Math.ceil(bounds.maxLon / step) * step;
      const startLat = Math.floor(bounds.minLat / step) * step;
      const maxLat = Math.ceil(bounds.maxLat / step) * step;

      // Longitude lines
      for (let lon = startLon; lon <= maxLon; lon += step) {
        const pt = geoToCanvas(lon, center[1], width, height);
        ctx.beginPath();
        ctx.moveTo(pt.x, 0);
        ctx.lineTo(pt.x, height);
        ctx.stroke();

        const label = `${Math.abs(lon).toFixed(step < 1 ? 1 : 0)}°${lon >= 0 ? 'E' : 'W'}`;
        ctx.fillText(label, pt.x + 4, height - 8);
      }

      // Latitude lines
      for (let lat = startLat; lat <= maxLat; lat += step) {
        const pt = geoToCanvas(center[0], lat, width, height);
        ctx.beginPath();
        ctx.moveTo(0, pt.y);
        ctx.lineTo(width, pt.y);
        ctx.stroke();

        const label = `${Math.abs(lat).toFixed(step < 1 ? 1 : 0)}°${lat >= 0 ? 'N' : 'S'}`;
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

      // Draw overall Route Connection Lines between sequential waypoints
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

          // Directional Arrows on Route Legs
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
    // 14. LIVE VESSEL BOAT MARKER & RANGE RINGS
    // =========================================================================
    {
      const boatPt = geoToCanvas(vesselLon, vesselLat, width, height);
      const headingDeg = compass.trueHeading || compass.magneticHeading || gps.heading || 0;
      const headingRad = (headingDeg * Math.PI) / 180;

      if (showRangeRings && zoom > 30) {
        const nmPixels = (1 / 60) * (zoom * 10);
        [1, 2, 5].forEach((ringNm) => {
          const radius = nmPixels * ringNm;
          ctx.beginPath();
          ctx.arc(boatPt.x, boatPt.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.18)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = isNightMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.5)';
          ctx.font = '8px monospace';
          ctx.fillText(`${ringNm}NM`, boatPt.x + radius + 2, boatPt.y - 2);
        });
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
    // 15. FLOATING COMPASS ROSE (Top-Left)
    // =========================================================================
    {
      const roseX = 42;
      const roseY = 42;
      const roseRadius = 24;

      ctx.save();
      ctx.translate(roseX, roseY);

      ctx.beginPath();
      ctx.arc(0, 0, roseRadius, 0, Math.PI * 2);
      ctx.fillStyle = isNightMode ? 'rgba(30, 5, 5, 0.75)' : 'rgba(15, 23, 42, 0.75)';
      ctx.fill();
      ctx.strokeStyle = isNightMode ? 'rgba(239, 68, 68, 0.4)' : 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, -roseRadius + 4);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, -3);
      ctx.closePath();
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, roseRadius - 4);
      ctx.lineTo(-5, 0);
      ctx.lineTo(0, 3);
      ctx.closePath();
      ctx.fillStyle = '#94a3b8';
      ctx.fill();

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('N', 0, -roseRadius + 2);
      ctx.restore();
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

    if (!isDragging) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    const scale = zoom * 10;
    const dLon = dx / scale;
    const dLat = dy / scale;

    setCenter(([lon, lat]) => [lon - dLon, lat + dLat]);
    setDragStart({ x: e.clientX, y: e.clientY });
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom((prev) => Math.max(5, Math.min(800, prev * zoomFactor)));
  };

  // Native Touch & Gesture handling on Canvas: Full-gesture in Fullscreen, and natural page scrolling in embedded mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let touchStartClientX = 0;
    let touchStartClientY = 0;
    let isVerticalPageScroll = false;
    let isMapAction = false;

    const handleNativeTouchStart = (e: TouchEvent) => {
      if (isFullscreen) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }

      if (e.touches.length === 1) {
        const t = e.touches[0];
        touchStartClientX = t.clientX;
        touchStartClientY = t.clientY;
        dragStartRef.current = { x: t.clientX, y: t.clientY };
        touchStartPosRef.current = { x: t.clientX, y: t.clientY };
        touchStartTimeRef.current = Date.now();
        isDraggingRef.current = true;
        isVerticalPageScroll = false;
        isMapAction = false;
        setIsDragging(true);
        setAutoFollowVessel(false);

        // Calculate cursor coordinates on touch
        const rect = canvas.getBoundingClientRect();
        const coords = canvasToGeo(t.clientX - rect.left, t.clientY - rect.top, rect.width, rect.height);
        setCursorCoords(coords);
      } else if (e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
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
      if (e.touches.length === 2 && touchDistanceRef.current !== null) {
        if (e.cancelable) e.preventDefault();
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchDistanceRef.current > 0) {
          const factor = newDist / touchDistanceRef.current;
          setZoom((prev) => Math.max(5, Math.min(800, prev * factor)));
        }
        touchDistanceRef.current = newDist;
        return;
      }

      if (e.touches.length === 1 && isDraggingRef.current) {
        const t = e.touches[0];
        const dx = t.clientX - dragStartRef.current.x;
        const dy = t.clientY - dragStartRef.current.y;

        if (isFullscreen) {
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          const currentZoom = zoomRef.current;
          const scale = currentZoom * 10;
          const dLon = dx / scale;
          const dLat = dy / scale;

          setCenter(([lon, lat]) => [lon - dLon, lat + dLat]);
          dragStartRef.current = { x: t.clientX, y: t.clientY };

          const rect = canvas.getBoundingClientRect();
          const coords = canvasToGeo(t.clientX - rect.left, t.clientY - rect.top, rect.width, rect.height);
          setCursorCoords(coords);
        } else {
          // When NOT in fullscreen: allow smooth vertical page scrolling on mobile
          const deltaXFromStart = Math.abs(t.clientX - touchStartClientX);
          const deltaYFromStart = Math.abs(t.clientY - touchStartClientY);

          if (!isVerticalPageScroll && !isMapAction) {
            if (deltaYFromStart > 8 && deltaYFromStart > deltaXFromStart) {
              isVerticalPageScroll = true;
              isDraggingRef.current = false;
              setIsDragging(false);
              return;
            } else if (deltaXFromStart > 8 && deltaXFromStart > deltaYFromStart) {
              isMapAction = true;
            }
          }

          if (isMapAction) {
            if (e.cancelable) e.preventDefault();
            const currentZoom = zoomRef.current;
            const scale = currentZoom * 10;
            const dLon = dx / scale;
            const dLat = dy / scale;

            setCenter(([lon, lat]) => [lon - dLon, lat + dLat]);
            dragStartRef.current = { x: t.clientX, y: t.clientY };
          }
        }
      }
    };

    const handleNativeTouchEnd = (e: TouchEvent) => {
      if (isFullscreen) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
      }

      // Check if this was a fast tap (under 300ms, moved < 8px)
      if (e.touches.length === 0) {
        const timeDiff = Date.now() - touchStartTimeRef.current;
        const lastPos = dragStartRef.current;
        const startPos = touchStartPosRef.current;
        const distMoved = Math.hypot(lastPos.x - startPos.x, lastPos.y - startPos.y);

        if (!isVerticalPageScroll && timeDiff < 300 && distMoved < 8) {
          const rect = canvas.getBoundingClientRect();
          const clickX = startPos.x - rect.left;
          const clickY = startPos.y - rect.top;
          const { lat, lon } = canvasToGeo(clickX, clickY, rect.width, rect.height);

          if (isAddWaypointMode && onMapClickAddWaypoint) {
            onMapClickAddWaypoint(lat, lon);
          } else if (activeRoute && onSelectWaypoint) {
            for (const wp of activeRoute.waypoints) {
              const wpPt = geoToCanvas(wp.longitude, wp.latitude, rect.width, rect.height);
              const d = Math.hypot(clickX - wpPt.x, clickY - wpPt.y);
              if (d <= 25) {
                onSelectWaypoint(wp);
                break;
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
  }, [canvasToGeo, geoToCanvas, isAddWaypointMode, onMapClickAddWaypoint, activeRoute, onSelectWaypoint, isFullscreen]);

  // Canvas Click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { lat, lon } = canvasToGeo(x, y, rect.width, rect.height);

    if (isAddWaypointMode && onMapClickAddWaypoint) {
      onMapClickAddWaypoint(lat, lon);
      return;
    }

    if (activeRoute && onSelectWaypoint) {
      for (const wp of activeRoute.waypoints) {
        const wpPt = geoToCanvas(wp.longitude, wp.latitude, rect.width, rect.height);
        const dist = Math.hypot(x - wpPt.x, y - wpPt.y);
        if (dist <= 20) {
          onSelectWaypoint(wp);
          return;
        }
      }
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

  // Live Navigation Values for Fullscreen HUD
  const directDistanceNm = targetWaypoint 
    ? calculateDistanceNm(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude)
    : (navigationSession.distanceNm || 0);

  const directBearingDeg = targetWaypoint
    ? calculateBearing(vesselLat, vesselLon, targetWaypoint.latitude, targetWaypoint.longitude)
    : (navigationSession.bearingDeg || 0);

  const currentSpeedKnots = gps.speedKnots || 0;
  const currentHeading = compass.trueHeading || compass.magneticHeading || gps.heading || 0;
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
        style={isFullscreen ? { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', width: '100%', height: '100%' } : { userSelect: 'none', WebkitUserSelect: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleCanvasClick}
        className={`w-full h-full block select-none ${
          isAddWaypointMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      />

      {/* FULL SCREEN COMPACT HIGH-CONTRAST MARINE NAVIGATION HUD */}
      {isFullscreen && (
        <div className="absolute top-2 sm:top-3 left-2 sm:left-4 right-2 sm:right-4 z-30 pointer-events-none flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left Cluster: Compact Marine HUD Readouts */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 font-mono overflow-x-auto no-scrollbar py-0.5 max-w-[calc(100vw-140px)] sm:max-w-none">
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
              <span className="text-[9px] text-slate-400 font-bold hidden xs:inline">HDG</span>
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

          {/* Right Cluster: Compact Mode Pill & Exit Full Screen Button */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Live / Offline Toggle */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700 text-xs font-mono shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={() => setMapMode('offline')}
                className={`px-1.5 sm:px-2 py-0.5 rounded transition-all text-[9px] sm:text-[10px] font-bold ${
                  mapMode === 'offline'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Offline Vector Mode"
              >
                OFFLINE
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isOnline) setMapMode('live');
                }}
                disabled={!isOnline}
                className={`px-1.5 sm:px-2 py-0.5 rounded transition-all text-[9px] sm:text-[10px] font-bold ${
                  !isOnline
                    ? 'opacity-30 cursor-not-allowed text-slate-500'
                    : mapMode === 'live'
                    ? 'bg-emerald-600 text-white shadow animate-pulse'
                    : 'text-slate-400 hover:text-white'
                }`}
                title={isOnline ? 'Online Live Map Mode' : 'No Internet'}
              >
                LIVE
              </button>
            </div>

            {/* Exit Full Screen Button */}
            <button
              id="btn-exit-fullscreen-hud"
              type="button"
              onClick={toggleFullscreen}
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] sm:text-xs font-bold font-mono flex items-center gap-1 transition-all shadow-lg border border-red-400 active:scale-95 shrink-0"
              title="Exit Full Screen"
            >
              <Minimize2 className="w-3 h-3" />
              <span>EXIT</span>
            </button>
          </div>
        </div>
      )}

      {/* Top Header Floating Status & Mode Bar (When NOT in Fullscreen) */}
      {!isFullscreen && (
        <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none z-20">
          {/* Left: Vessel Position Badge & Map Mode Switch */}
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

            {/* LIVE vs OFFLINE Segmented Pill */}
            <div className="pointer-events-auto flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-slate-700 text-[10px] font-mono shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={() => setMapMode('offline')}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 font-bold ${
                  mapMode === 'offline'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Offline Vector Marine Chart (No Internet Required)"
              >
                <Radio className="w-2.5 h-2.5" />
                <span>OFFLINE</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isOnline) setMapMode('live');
                }}
                disabled={!isOnline}
                className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 font-bold ${
                  !isOnline
                    ? 'opacity-40 cursor-not-allowed text-slate-500'
                    : mapMode === 'live'
                    ? 'bg-emerald-600 text-white shadow animate-pulse'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isOnline ? 'Online Live Oceanography and Navigation Map' : 'No Internet Connection'}
              >
                <Globe className="w-2.5 h-2.5" />
                <span>LIVE</span>
                {isOnline ? <Wifi className="w-2.5 h-2.5 text-emerald-300" /> : <WifiOff className="w-2.5 h-2.5 text-red-400" />}
              </button>
            </div>
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

      {/* Right Floating Control Tools (Zoom, Fullscreen, Center, Fit & Layers) */}
      <div className={`absolute ${isFullscreen ? 'top-13 sm:top-15' : 'top-13 sm:top-15'} right-2 sm:right-3.5 flex flex-col gap-1.5 sm:gap-2 pointer-events-auto z-30`}>
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

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={() => setZoom((prev) => Math.min(800, prev * 1.3))}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-lg flex items-center justify-center ${
            isNightMode 
              ? 'bg-red-950/90 border-red-800 text-red-200 hover:bg-red-900' 
              : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-400'
          }`}
          title="Zoom In"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>

        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={() => setZoom((prev) => Math.max(5, prev * 0.7))}
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border backdrop-blur-md transition-all shadow-lg flex items-center justify-center ${
            isNightMode 
              ? 'bg-red-950/90 border-red-800 text-red-200 hover:bg-red-900' 
              : 'bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-400'
          }`}
          title="Zoom Out"
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

      {/* Layers & Online Map Settings Popup */}
      {showLayersMenu && (
        <div className={`absolute ${isFullscreen ? 'top-14 sm:top-16' : 'top-14 sm:top-16'} right-12 sm:right-14 z-40 p-3 rounded-xl border shadow-2xl backdrop-blur-lg flex flex-col gap-2.5 min-w-[240px] max-w-[calc(100vw-60px)] max-h-[80vh] overflow-y-auto text-xs font-mono ${
          isNightMode ? 'bg-red-950/95 border-red-800 text-red-200' : 'bg-slate-900/95 border-slate-700 text-slate-200'
        }`}>
          {/* Online Map Provider Selector (When in Live Mode) */}
          <div className="pb-2 border-b border-slate-800 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span>Map Mode</span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                mapMode === 'live' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-cyan-950 text-cyan-300 border border-cyan-700'
              }`}>
                {mapMode === 'live' ? 'ONLINE LIVE' : 'OFFLINE VECTOR'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1 mt-1">
              <button
                type="button"
                onClick={() => setMapMode('offline')}
                className={`px-2 py-1.5 rounded-lg text-left transition-all ${
                  mapMode === 'offline'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📡 OFFLINE
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isOnline) setMapMode('live');
                }}
                disabled={!isOnline}
                className={`px-2 py-1.5 rounded-lg text-left transition-all ${
                  !isOnline
                    ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                    : mapMode === 'live'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🌐 ONLINE LIVE
              </button>
            </div>

            {/* Provider List when Live */}
            {mapMode === 'live' && (
              <div className="mt-2 flex flex-col gap-1">
                <span className="text-[9px] text-slate-400 uppercase font-bold">Online Map Provider:</span>
                {LIVE_TILE_PROVIDERS.map((prov) => (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => setLiveProvider(prov.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-left transition-all text-[11px] flex flex-col ${
                      liveProvider === prov.id
                        ? 'bg-slate-800 border border-cyan-400 text-cyan-300'
                        : 'bg-slate-950/60 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-bold text-white">{prov.name}</span>
                    <span className="text-[9px] text-slate-400">{prov.description}</span>
                  </button>
                ))}

                <label className="flex items-center justify-between gap-2 mt-1 cursor-pointer pt-1 border-t border-slate-800 text-[11px] hover:text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Anchor className="w-3.5 h-3.5 text-cyan-400" />
                    <span>OpenSeaMap Seamarks Layer</span>
                  </span>
                  <input 
                    type="checkbox" 
                    checked={showLiveSeamarks} 
                    onChange={(e) => setShowLiveSeamarks(e.target.checked)} 
                    className="rounded accent-cyan-500"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-800">
            Nautical & Chart Layers
          </div>

          {/* Oil Platforms */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Offshore Oil & Gas Rigs</span>
            </span>
            <input 
              type="checkbox" 
              checked={showOilPlatforms} 
              onChange={(e) => setShowOilPlatforms(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Navigation Buoys */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Navigation Buoys (IALA)</span>
            </span>
            <input 
              type="checkbox" 
              checked={showBuoys} 
              onChange={(e) => setShowBuoys(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Submarine Pipelines */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Submarine Pipelines & Cables</span>
            </span>
            <input 
              type="checkbox" 
              checked={showPipelines} 
              onChange={(e) => setShowPipelines(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Tidal Stream Vectors */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-sky-400" />
              <span>Tidal Streams & Currents</span>
            </span>
            <input 
              type="checkbox" 
              checked={showTidalStreams} 
              onChange={(e) => setShowTidalStreams(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Capitals and Cities */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span>Capitals, Ports & Major Cities</span>
            </span>
            <input 
              type="checkbox" 
              checked={showPlaceLabels} 
              onChange={(e) => setShowPlaceLabels(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Lighthouses */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-yellow-400" />
              <span>Lighthouses & Beacons</span>
            </span>
            <input 
              type="checkbox" 
              checked={showLighthouses} 
              onChange={(e) => setShowLighthouses(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* TSS Lanes */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
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

          {/* Anchorages */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-teal-400" />
              <span>Designated Anchorages</span>
            </span>
            <input 
              type="checkbox" 
              checked={showAnchorages} 
              onChange={(e) => setShowAnchorages(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Marine Hazards */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span>Marine Hazards & Wrecks</span>
            </span>
            <input 
              type="checkbox" 
              checked={showHazards} 
              onChange={(e) => setShowHazards(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Soundings */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
              <span>Depth Soundings (Meters)</span>
            </span>
            <input 
              type="checkbox" 
              checked={showSoundings} 
              onChange={(e) => setShowSoundings(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Bathymetry */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Waves className="w-3.5 h-3.5 text-cyan-400" />
              <span>Bathymetry Depth Zones</span>
            </span>
            <input 
              type="checkbox" 
              checked={showBathymetry} 
              onChange={(e) => setShowBathymetry(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Graticule */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-slate-400" />
              <span>Geographic Graticule (Lat/Lon)</span>
            </span>
            <input 
              type="checkbox" 
              checked={showGraticule} 
              onChange={(e) => setShowGraticule(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>

          {/* Range Rings */}
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-cyan-400">
            <span className="flex items-center gap-1.5">
              <Navigation2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Vessel Range Rings (NM)</span>
            </span>
            <input 
              type="checkbox" 
              checked={showRangeRings} 
              onChange={(e) => setShowRangeRings(e.target.checked)} 
              className="rounded accent-cyan-500"
            />
          </label>
        </div>
      )}

      {/* Bottom Right: Clean Status Badge (Hidden in Fullscreen for spotless view) */}
      {!isFullscreen && (
        <div className={`absolute bottom-3 right-3 px-3 py-1 rounded-lg border text-[10px] font-mono backdrop-blur-md pointer-events-none z-20 shadow-md ${
          isNightMode ? 'bg-red-950/80 border-red-900 text-red-400' : 'bg-slate-900/80 border-slate-800 text-slate-400'
        }`}>
          Zoom: {zoom.toFixed(0)}x • {mapMode === 'live' ? '🌐 Live Online Map' : '📡 Vector Nautical Chart'}
        </div>
      )}
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
