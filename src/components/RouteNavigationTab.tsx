import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Navigation, 
  MapPin, 
  Plus, 
  Trash2, 
  Play, 
  Square, 
  Compass, 
  ArrowUp, 
  ArrowDown, 
  Edit3, 
  Save, 
  X, 
  Download, 
  Upload, 
  Share2, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Activity, 
  Radio, 
  CornerDownRight, 
  Crosshair, 
  ChevronRight, 
  ChevronLeft,
  Maximize2,
  FolderPlus,
  Route as RouteIcon,
  Flag,
  Anchor,
  HelpCircle,
  Locate,
  Target
} from 'lucide-react';
import { 
  GpsData, 
  CompassData, 
  MarineRoute, 
  Waypoint, 
  NavigationSession 
} from '../types';
import { OfflineMarineChart } from './OfflineMarineChart';
import { 
  formatMarineDDM, 
  calculateDistanceNm, 
  calculateBearing, 
  calculateXteNm, 
  calculateTtgAndEta, 
  formatTtg, 
  formatEta, 
  formatHeadingDeg, 
  nmToKm, 
  parseMarineCoordinate,
  headingToCardinal 
} from '../utils/geo';
import { DEFAULT_SAMPLE_ROUTES } from '../utils/marineMapData';

interface RouteNavigationTabProps {
  gps: GpsData;
  compass: CompassData;
  isNightMode?: boolean;
  onNavSessionChange?: (session: NavigationSession) => void;
}

const STORAGE_KEY_ROUTES = 'mariner_pro_marine_routes_v2';
const STORAGE_KEY_ACTIVE_ROUTE_ID = 'mariner_pro_active_route_id_v2';
const STORAGE_KEY_NAV_SESSION = 'mariner_pro_active_nav_session_v2';
const STORAGE_KEY_TARGET_WP_ID = 'mariner_pro_active_target_wp_id_v2';

export const RouteNavigationTab: React.FC<RouteNavigationTabProps> = ({
  gps,
  compass,
  isNightMode = false,
  onNavSessionChange,
}) => {
  // Routes State loaded from LocalStorage
  const [routes, setRoutes] = useState<MarineRoute[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ROUTES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load saved routes:', e);
    }
    return DEFAULT_SAMPLE_ROUTES;
  });

  const [activeRouteId, setActiveRouteId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ROUTE_ID);
      if (savedId && routes.some(r => r.id === savedId)) return savedId;
    } catch (e) {}
    return routes[0]?.id || '';
  });

  // Save routes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ROUTES, JSON.stringify(routes));
    } catch (e) {
      console.error('Error saving routes to storage:', e);
    }
  }, [routes]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_ROUTE_ID, activeRouteId);
    } catch (e) {}
  }, [activeRouteId]);

  // Current active route object
  const activeRoute = useMemo(() => {
    return routes.find(r => r.id === activeRouteId) || routes[0] || null;
  }, [routes, activeRouteId]);

  // Ensure waypoints inside the active route are strictly sorted by sequential order
  const sortedWaypoints = useMemo(() => {
    if (!activeRoute || !Array.isArray(activeRoute.waypoints)) return [];
    return [...activeRoute.waypoints].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [activeRoute]);

  // Target waypoint from persistent storage
  const [targetWaypointId, setTargetWaypointId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_TARGET_WP_ID) || null;
    } catch (e) {
      return null;
    }
  });

  // Navigation Session State from persistent storage
  const [navSession, setNavSession] = useState<NavigationSession>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NAV_SESSION);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.isNavigating) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to restore navigation session:', e);
    }
    return {
      isNavigating: false,
      isRouteNavigation: false,
      routeId: null,
      waypointId: null,
      targetWaypoint: null,
      previousWaypoint: null,
      currentLegIndex: 0,
      totalLegs: 0,
      routeRemainingDistanceNm: null,
      routeTotalDistanceNm: null,
      autoAdvanceEnabled: true,
      arrivalRadiusNm: 0.08,
      distanceNm: null,
      distanceKm: null,
      bearingDeg: null,
      xteNm: null,
      sogKnots: null,
      cogDeg: null,
      ttgSeconds: null,
      etaTimestamp: null,
      routeEtaTimestamp: null,
      startedAt: null,
    };
  });

  // Selected target waypoint object
  const targetWaypoint = useMemo(() => {
    if (!activeRoute || !targetWaypointId) return null;
    return sortedWaypoints.find(w => w.id === targetWaypointId) || null;
  }, [activeRoute, sortedWaypoints, targetWaypointId]);

  // Save Navigation Session to LocalStorage & propagate to parent
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NAV_SESSION, JSON.stringify(navSession));
      if (onNavSessionChange) {
        onNavSessionChange(navSession);
      }
    } catch (e) {
      console.error('Error persisting nav session:', e);
    }
  }, [navSession, onNavSessionChange]);

  useEffect(() => {
    try {
      if (targetWaypointId) {
        localStorage.setItem(STORAGE_KEY_TARGET_WP_ID, targetWaypointId);
      } else {
        localStorage.removeItem(STORAGE_KEY_TARGET_WP_ID);
      }
    } catch (e) {}
  }, [targetWaypointId]);

  // Lifecycle listeners to preserve navigation during backgrounding / tab switching
  useEffect(() => {
    const handleBackgroundOrExit = () => {
      try {
        localStorage.setItem(STORAGE_KEY_NAV_SESSION, JSON.stringify(navSession));
        if (targetWaypointId) {
          localStorage.setItem(STORAGE_KEY_TARGET_WP_ID, targetWaypointId);
        }
      } catch (e) {}
    };

    document.addEventListener('visibilitychange', handleBackgroundOrExit);
    window.addEventListener('pagehide', handleBackgroundOrExit);
    window.addEventListener('beforeunload', handleBackgroundOrExit);

    return () => {
      document.removeEventListener('visibilitychange', handleBackgroundOrExit);
      window.removeEventListener('pagehide', handleBackgroundOrExit);
      window.removeEventListener('beforeunload', handleBackgroundOrExit);
    };
  }, [navSession, targetWaypointId]);

  // Modals
  const [showCreateRouteModal, setShowCreateRouteModal] = useState<boolean>(false);
  const [newRouteName, setNewRouteName] = useState<string>('');
  const [newRouteDescription, setNewRouteDescription] = useState<string>('');
  const [newRouteColor, setNewRouteColor] = useState<string>('#06b6d4');

  const [showAddWaypointModal, setShowAddWaypointModal] = useState<boolean>(false);
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [wpNameInput, setWpNameInput] = useState<string>('');
  const [wpLatInput, setWpLatInput] = useState<string>('');
  const [wpLonInput, setWpLonInput] = useState<string>('');
  const [wpDescInput, setWpDescInput] = useState<string>('');
  const [isMapPickMode, setIsMapPickMode] = useState<boolean>(false);

  // Custom Delete Confirmations Modals (NO native browser alerts/confirm)
  const [routeToDelete, setRouteToDelete] = useState<MarineRoute | null>(null);
  const [waypointToDelete, setWaypointToDelete] = useState<Waypoint | null>(null);

  // In-app Toast Banner Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 4500);
  };

  // Vessel fallback coordinate if GPS hardware is not broadcasting
  const currentVesselLat = gps.latitude !== null ? gps.latitude : 26.5400;
  const currentVesselLon = gps.longitude !== null ? gps.longitude : 53.9900;

  // Sound chime for waypoint arrival
  const playArrivalChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.2);
      gain2.gain.setValueAtTime(0.25, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.8);
    } catch (e) {}
  };

  // Total Route Distance (Sum of all waypoint legs)
  const totalRouteDistanceNm = useMemo(() => {
    if (!sortedWaypoints || sortedWaypoints.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < sortedWaypoints.length - 1; i++) {
      const a = sortedWaypoints[i];
      const b = sortedWaypoints[i + 1];
      total += calculateDistanceNm(a.latitude, a.longitude, b.latitude, b.longitude);
    }
    return total;
  }, [sortedWaypoints]);

  // Keep track of the last arrived waypoint ID to avoid re-triggering arrival in the same spot
  const lastArrivedWaypointIdRef = useRef<string | null>(null);

  // Calculate live navigation math & handle automatic route waypoint sequencing
  useEffect(() => {
    if (!navSession.isNavigating || !targetWaypoint) {
      return;
    }

    const distNm = calculateDistanceNm(
      currentVesselLat,
      currentVesselLon,
      targetWaypoint.latitude,
      targetWaypoint.longitude
    );
    const distKm = nmToKm(distNm);
    const brg = calculateBearing(
      currentVesselLat,
      currentVesselLon,
      targetWaypoint.latitude,
      targetWaypoint.longitude
    );

    // Cross-track error
    let xte: number | null = null;
    if (navSession.previousWaypoint) {
      xte = calculateXteNm(
        currentVesselLat,
        currentVesselLon,
        navSession.previousWaypoint.latitude,
        navSession.previousWaypoint.longitude,
        targetWaypoint.latitude,
        targetWaypoint.longitude
      );
    }

    const sog = gps.speedKnots || 0;
    const { ttgSeconds, etaTimestamp } = calculateTtgAndEta(distNm, sog);

    // Calculate total remaining distance across all subsequent legs of the route
    let routeRemainingDistNm = distNm;
    let currentIdx = sortedWaypoints.findIndex(w => w.id === targetWaypoint.id);
    if (currentIdx >= 0 && currentIdx < sortedWaypoints.length - 1) {
      for (let i = currentIdx; i < sortedWaypoints.length - 1; i++) {
        const a = sortedWaypoints[i];
        const b = sortedWaypoints[i + 1];
        routeRemainingDistNm += calculateDistanceNm(a.latitude, a.longitude, b.latitude, b.longitude);
      }
    }

    const { etaTimestamp: routeEtaTimestamp } = calculateTtgAndEta(routeRemainingDistNm, sog);

    // AUTO-ADVANCE WAYPOINT LOGIC: Trigger when vessel enters arrival radius
    const arrivalRadius = navSession.arrivalRadiusNm || 0.08; // 0.08 NM (~150 meters)
    if (
      navSession.isRouteNavigation && 
      navSession.autoAdvanceEnabled !== false && 
      distNm <= arrivalRadius &&
      lastArrivedWaypointIdRef.current !== targetWaypoint.id
    ) {
      lastArrivedWaypointIdRef.current = targetWaypoint.id;
      playArrivalChime();

      if (currentIdx >= 0 && currentIdx < sortedWaypoints.length - 1) {
        const nextWp = sortedWaypoints[currentIdx + 1];
        const nextDist = calculateDistanceNm(currentVesselLat, currentVesselLon, nextWp.latitude, nextWp.longitude);
        const nextBrg = calculateBearing(currentVesselLat, currentVesselLon, nextWp.latitude, nextWp.longitude);
        const nextTtg = calculateTtgAndEta(nextDist, sog);

        showToast(
          `🎯 Reached Waypoint ${currentIdx + 1} (${targetWaypoint.name})! Proceeding to Waypoint ${currentIdx + 2}: ${nextWp.name}`,
          'success'
        );

        setTargetWaypointId(nextWp.id);
        setNavSession(prev => ({
          ...prev,
          waypointId: nextWp.id,
          targetWaypoint: nextWp,
          previousWaypoint: targetWaypoint,
          currentLegIndex: currentIdx + 1,
          distanceNm: nextDist,
          distanceKm: nmToKm(nextDist),
          bearingDeg: nextBrg,
          xteNm: 0,
          ttgSeconds: nextTtg.ttgSeconds,
          etaTimestamp: nextTtg.etaTimestamp,
          routeRemainingDistanceNm: routeRemainingDistNm - distNm + nextDist,
        }));
        return;
      } else if (currentIdx === sortedWaypoints.length - 1) {
        showToast(
          `🏁 Route Destination Reached! Arrived at final Waypoint ${sortedWaypoints.length}: ${targetWaypoint.name} ("${activeRoute?.name}")`,
          'success'
        );
      }
    }

    setNavSession(prev => ({
      ...prev,
      targetWaypoint,
      currentLegIndex: currentIdx >= 0 ? currentIdx : 0,
      totalLegs: sortedWaypoints.length,
      routeRemainingDistanceNm: routeRemainingDistNm,
      routeTotalDistanceNm: totalRouteDistanceNm,
      distanceNm: distNm,
      distanceKm: distKm,
      bearingDeg: brg,
      xteNm: xte,
      sogKnots: sog,
      cogDeg: gps.heading,
      ttgSeconds,
      etaTimestamp,
      routeEtaTimestamp,
    }));
  }, [
    gps.latitude, 
    gps.longitude, 
    gps.speedKnots, 
    gps.heading, 
    navSession.isNavigating, 
    navSession.isRouteNavigation,
    navSession.autoAdvanceEnabled,
    navSession.arrivalRadiusNm,
    targetWaypoint, 
    navSession.previousWaypoint, 
    currentVesselLat, 
    currentVesselLon, 
    sortedWaypoints,
    totalRouteDistanceNm,
    activeRoute
  ]);

  // --- Route Handlers ---
  const handleCreateRoute = () => {
    if (!newRouteName.trim()) return;

    const newRoute: MarineRoute = {
      id: `route_${Date.now()}`,
      name: newRouteName.trim(),
      description: newRouteDescription.trim() || undefined,
      color: newRouteColor || '#06b6d4',
      waypoints: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setRoutes(prev => [newRoute, ...prev]);
    setActiveRouteId(newRoute.id);
    setNewRouteName('');
    setNewRouteDescription('');
    setShowCreateRouteModal(false);
    showToast(`Created route "${newRoute.name}"`, 'success');
  };

  const confirmDeleteRoute = () => {
    if (!routeToDelete) return;
    const idToDelete = routeToDelete.id;
    const name = routeToDelete.name;

    if (routes.length <= 1) {
      showToast('You must keep at least one marine route.', 'warn');
      setRouteToDelete(null);
      return;
    }

    if (navSession.isNavigating && navSession.routeId === idToDelete) {
      handleStopNavigation();
    }
    const updated = routes.filter(r => r.id !== idToDelete);
    setRoutes(updated);
    setActiveRouteId(updated[0]?.id || '');
    setRouteToDelete(null);
    showToast(`Deleted route "${name}"`, 'info');
  };

  // --- Waypoint Handlers ---
  const openAddWaypointModal = () => {
    if (!activeRoute) return;
    if (activeRoute.waypoints.length >= 50) {
      showToast('Maximum 50 waypoints limit reached for this route.', 'warn');
      return;
    }

    setEditingWaypoint(null);
    setWpNameInput(`WP${activeRoute.waypoints.length + 1}`);
    if (gps.latitude !== null && gps.longitude !== null) {
      setWpLatInput(gps.latitude.toFixed(6));
      setWpLonInput(gps.longitude.toFixed(6));
    } else {
      setWpLatInput('');
      setWpLonInput('');
    }
    setWpDescInput('');
    setShowAddWaypointModal(true);
  };

  const openEditWaypointModal = (wp: Waypoint) => {
    setEditingWaypoint(wp);
    setWpNameInput(wp.name);
    setWpLatInput(wp.latitude.toFixed(6));
    setWpLonInput(wp.longitude.toFixed(6));
    setWpDescInput(wp.description || '');
    setShowAddWaypointModal(true);
  };

  const handleSaveWaypoint = () => {
    if (!activeRoute) return;

    const lat = parseMarineCoordinate(wpLatInput, false);
    const lon = parseMarineCoordinate(wpLonInput, true);

    if (lat === null || isNaN(lat) || lat < -90 || lat > 90) {
      showToast('Invalid Latitude. Please enter valid coordinate (e.g. 26.5432 or 26° 32.592\' N)', 'warn');
      return;
    }
    if (lon === null || isNaN(lon) || lon < -180 || lon > 180) {
      showToast('Invalid Longitude. Please enter valid coordinate (e.g. 54.0150 or 54° 00.900\' E)', 'warn');
      return;
    }

    const name = wpNameInput.trim() || `WP${activeRoute.waypoints.length + 1}`;

    if (editingWaypoint) {
      const updatedWaypoints = activeRoute.waypoints.map(w => {
        if (w.id === editingWaypoint.id) {
          return {
            ...w,
            name,
            latitude: lat,
            longitude: lon,
            description: wpDescInput.trim() || undefined,
          };
        }
        return w;
      });

      setRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, waypoints: updatedWaypoints, updatedAt: Date.now() } : r));
      showToast(`Updated waypoint "${name}"`, 'success');
    } else {
      const newWp: Waypoint = {
        id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name,
        latitude: lat,
        longitude: lon,
        description: wpDescInput.trim() || undefined,
        order: activeRoute.waypoints.length,
        createdAt: Date.now(),
      };

      const updatedWaypoints = [...activeRoute.waypoints, newWp];
      setRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, waypoints: updatedWaypoints, updatedAt: Date.now() } : r));
      showToast(`Added waypoint "${name}"`, 'success');
    }

    setShowAddWaypointModal(false);
    setIsMapPickMode(false);
  };

  const confirmDeleteWaypoint = () => {
    if (!waypointToDelete || !activeRoute) return;
    const wpId = waypointToDelete.id;
    const name = waypointToDelete.name;

    if (navSession.isNavigating && navSession.waypointId === wpId) {
      handleStopNavigation();
    }
    const filtered = activeRoute.waypoints.filter(w => w.id !== wpId);
    const reordered = filtered.map((w, idx) => ({ ...w, order: idx }));
    setRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, waypoints: reordered, updatedAt: Date.now() } : r));
    if (targetWaypointId === wpId) {
      setTargetWaypointId(null);
    }
    setWaypointToDelete(null);
    showToast(`Deleted waypoint "${name}"`, 'info');
  };

  const handleMoveWaypoint = (index: number, direction: 'up' | 'down') => {
    if (!activeRoute) return;
    const wps = [...activeRoute.waypoints];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= wps.length) return;

    const temp = wps[index];
    wps[index] = wps[targetIdx];
    wps[targetIdx] = temp;

    const reordered = wps.map((w, idx) => ({ ...w, order: idx }));
    setRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, waypoints: reordered, updatedAt: Date.now() } : r));
  };

  const handleMapClickAddWaypoint = (lat: number, lon: number) => {
    if (!activeRoute) return;
    if (activeRoute.waypoints.length >= 50) {
      showToast('Maximum 50 waypoints reached.', 'warn');
      setIsMapPickMode(false);
      return;
    }

    const newWp: Waypoint = {
      id: `wp_${Date.now()}`,
      name: `WP${activeRoute.waypoints.length + 1} (${lat.toFixed(2)}N)`,
      latitude: lat,
      longitude: lon,
      order: activeRoute.waypoints.length,
      createdAt: Date.now(),
    };

    const updatedWaypoints = [...activeRoute.waypoints, newWp];
    setRoutes(prev => prev.map(r => r.id === activeRoute.id ? { ...r, waypoints: updatedWaypoints, updatedAt: Date.now() } : r));
    showToast(`Added waypoint "${newWp.name}" from map`, 'success');
  };

  // --- Navigation Controls ---
  const handleStartRouteNavigation = (startIndex = 0) => {
    if (!activeRoute || sortedWaypoints.length === 0) {
      showToast('Please add at least one Waypoint to this route before navigating.', 'warn');
      return;
    }

    const safeIndex = Math.max(0, Math.min(startIndex, sortedWaypoints.length - 1));
    const targetWp = sortedWaypoints[safeIndex];
    const prevWp = safeIndex > 0 ? sortedWaypoints[safeIndex - 1] : null;

    setTargetWaypointId(targetWp.id);
    lastArrivedWaypointIdRef.current = null;

    const distNm = calculateDistanceNm(currentVesselLat, currentVesselLon, targetWp.latitude, targetWp.longitude);
    const brg = calculateBearing(currentVesselLat, currentVesselLon, targetWp.latitude, targetWp.longitude);
    const sog = gps.speedKnots || 0;
    const { ttgSeconds, etaTimestamp } = calculateTtgAndEta(distNm, sog);

    // Calculate total remaining distance across all subsequent legs of the route
    let routeRemainingDistNm = distNm;
    for (let i = safeIndex; i < sortedWaypoints.length - 1; i++) {
      const a = sortedWaypoints[i];
      const b = sortedWaypoints[i + 1];
      routeRemainingDistNm += calculateDistanceNm(a.latitude, a.longitude, b.latitude, b.longitude);
    }

    const { etaTimestamp: routeEtaTimestamp } = calculateTtgAndEta(routeRemainingDistNm, sog);

    setNavSession({
      isNavigating: true,
      isRouteNavigation: true,
      routeId: activeRoute.id,
      waypointId: targetWp.id,
      targetWaypoint: targetWp,
      previousWaypoint: prevWp,
      currentLegIndex: safeIndex,
      totalLegs: sortedWaypoints.length,
      routeRemainingDistanceNm: routeRemainingDistNm,
      routeTotalDistanceNm: totalRouteDistanceNm,
      autoAdvanceEnabled: true,
      arrivalRadiusNm: 0.08,
      distanceNm: distNm,
      distanceKm: nmToKm(distNm),
      bearingDeg: brg,
      xteNm: null,
      sogKnots: sog,
      cogDeg: gps.heading,
      ttgSeconds,
      etaTimestamp,
      routeEtaTimestamp,
      startedAt: Date.now(),
    });

    showToast(
      `🚀 Started Route Navigation: "${activeRoute.name}" • Leg ${safeIndex + 1} of ${sortedWaypoints.length} (${targetWp.name})`,
      'success'
    );
  };

  const handleStartNavigation = (selectedWp?: Waypoint) => {
    const wp = selectedWp || targetWaypoint;
    if (!wp) {
      showToast('Please select a destination Waypoint first.', 'warn');
      return;
    }

    // If this waypoint belongs to the active route, start route navigation from this waypoint index
    if (activeRoute && sortedWaypoints.length > 0) {
      const idx = sortedWaypoints.findIndex(w => w.id === wp.id);
      if (idx >= 0) {
        handleStartRouteNavigation(idx);
        return;
      }
    }

    setTargetWaypointId(wp.id);
    lastArrivedWaypointIdRef.current = null;

    const distNm = calculateDistanceNm(currentVesselLat, currentVesselLon, wp.latitude, wp.longitude);
    const brg = calculateBearing(currentVesselLat, currentVesselLon, wp.latitude, wp.longitude);
    const sog = gps.speedKnots || 0;
    const { ttgSeconds, etaTimestamp } = calculateTtgAndEta(distNm, sog);

    setNavSession({
      isNavigating: true,
      isRouteNavigation: false,
      routeId: activeRoute?.id || null,
      waypointId: wp.id,
      targetWaypoint: wp,
      previousWaypoint: null,
      currentLegIndex: 0,
      totalLegs: 1,
      routeRemainingDistanceNm: distNm,
      routeTotalDistanceNm: distNm,
      autoAdvanceEnabled: false,
      arrivalRadiusNm: 0.08,
      distanceNm: distNm,
      distanceKm: nmToKm(distNm),
      bearingDeg: brg,
      xteNm: null,
      sogKnots: sog,
      cogDeg: gps.heading,
      ttgSeconds,
      etaTimestamp,
      routeEtaTimestamp: etaTimestamp,
      startedAt: Date.now(),
    });

    showToast(`Navigating to ${wp.name} • Course: ${formatHeadingDeg(brg)} • Distance: ${distNm.toFixed(1)} NM`, 'success');
  };

  const handleStopNavigation = () => {
    setNavSession(prev => ({
      ...prev,
      isNavigating: false,
      startedAt: null,
    }));
    lastArrivedWaypointIdRef.current = null;
    showToast('Marine navigation stopped.', 'info');
  };

  const handleAdvanceNextWaypoint = () => {
    if (!activeRoute || sortedWaypoints.length === 0) return;
    const currentIdx = targetWaypoint ? sortedWaypoints.findIndex(w => w.id === targetWaypoint.id) : 0;
    if (currentIdx >= 0 && currentIdx < sortedWaypoints.length - 1) {
      handleStartRouteNavigation(currentIdx + 1);
    } else {
      showToast('Reached final waypoint of route!', 'success');
      handleStopNavigation();
    }
  };

  const handlePreviousWaypoint = () => {
    if (!activeRoute || sortedWaypoints.length === 0) return;
    const currentIdx = targetWaypoint ? sortedWaypoints.findIndex(w => w.id === targetWaypoint.id) : 0;
    if (currentIdx > 0) {
      handleStartRouteNavigation(currentIdx - 1);
    } else {
      showToast('Already at the first waypoint of route.', 'info');
    }
  };

  const handleToggleAutoAdvance = () => {
    const newState = !(navSession.autoAdvanceEnabled !== false);
    setNavSession(prev => ({
      ...prev,
      autoAdvanceEnabled: newState,
    }));
    showToast(`Auto-Advance Waypoint: ${newState ? 'ENABLED (150m radius)' : 'DISABLED'}`, 'info');
  };

  // Steer guidance calculation
  const steerInfo = useMemo(() => {
    if (!navSession.isNavigating || navSession.bearingDeg === null) return null;
    const currentHeading = compass.trueHeading || gps.heading || 0;
    let diff = (navSession.bearingDeg - currentHeading + 360) % 360;
    if (diff > 180) diff -= 360;

    const absDiff = Math.abs(diff);
    if (absDiff < 2) {
      return { text: 'ON COURSE', color: 'text-emerald-400', dir: 'center', deg: 0 };
    } else if (diff > 0) {
      return { text: `STEER RIGHT ${absDiff.toFixed(0)}°`, color: 'text-amber-400', dir: 'right', deg: absDiff };
    } else {
      return { text: `STEER LEFT ${absDiff.toFixed(0)}°`, color: 'text-amber-400', dir: 'left', deg: absDiff };
    }
  }, [navSession.isNavigating, navSession.bearingDeg, compass.trueHeading, gps.heading]);

  return (
    <div className="flex flex-col gap-6 w-full animate-fadeIn">
      {/* In-app Toast Banner Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 text-xs font-mono animate-bounce transition-all bg-slate-900/95 border-cyan-500/80 text-cyan-200">
          <Target className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
          <span className="font-bold">{toastMessage.text}</span>
          <button 
            type="button" 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 0. Live Marine Compass Heading Instrument Header */}
      <div className={`w-full p-4 sm:p-5 rounded-2xl border shadow-2xl backdrop-blur-md flex flex-col gap-4 ${
        isNightMode 
          ? 'bg-red-950/80 border-red-800 text-red-100' 
          : 'bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border-slate-800 text-slate-100 shadow-xl'
      }`}>
        {/* Top Row: Digital Heading Readout + SOG / COG Instruments */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
              <Compass className="w-7 h-7 animate-pulse" />
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                  VESSEL HEADING (HDT / HDG)
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono border ${
                  compass.calibrated 
                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}>
                  {compass.calibrated ? 'CALIBRATED' : 'LIVE SENSOR'}
                </span>
              </div>

              <div className="flex items-baseline gap-2.5 mt-0.5">
                <span className="text-3xl sm:text-4xl font-black font-mono text-white tracking-tight">
                  {(compass.trueHeading || 0).toFixed(1)}°
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-black">
                  {headingToCardinal(compass.trueHeading || 0)}
                </span>
                <span className="text-xs font-mono text-slate-400 hidden sm:inline">
                  (Mag: {(compass.magneticHeading || 0).toFixed(1)}°)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Marine Cluster: SOG, COG, and Coordinates */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            {/* Speed Over Ground */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
              <span className="text-slate-500 uppercase font-bold text-[10px]">SOG:</span>
              <strong className="text-emerald-400 font-bold text-sm">
                {(gps.speedKnots || 0).toFixed(1)} <span className="text-[10px] font-normal text-slate-400">kts</span>
              </strong>
            </div>

            {/* Course Over Ground */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-2">
              <span className="text-slate-500 uppercase font-bold text-[10px]">COG:</span>
              <strong className="text-cyan-300 font-bold text-sm">
                {formatHeadingDeg(gps.heading)}
              </strong>
            </div>

            {/* Current Coordinates */}
            <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 hidden md:flex items-center gap-2 text-[11px] text-slate-400">
              <span className="text-slate-500 uppercase font-bold text-[10px]">POS:</span>
              <span className="text-slate-200">{formatMarineDDM(gps.latitude, false)}</span>
              <span>•</span>
              <span className="text-slate-200">{formatMarineDDM(gps.longitude, true)}</span>
            </div>
          </div>
        </div>

        {/* Dynamic Horizontal Marine Compass Tape Ribbon */}
        <div className="w-full relative h-11 bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center select-none shadow-inner">
          {/* Center Lubber Line (Vessel Bow Direction) */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-amber-400 z-30 shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 w-0 h-0 border-x-4 border-x-transparent border-t-[6px] border-t-amber-400 z-30" />

          {/* Navigating Target Waypoint Bearing Pointer on the Ribbon */}
          {navSession.isNavigating && navSession.bearingDeg !== null && (
            <div 
              className="absolute top-0 bottom-0 z-30 flex flex-col items-center pointer-events-none transition-all duration-150"
              style={{
                left: `calc(50% + ${((((navSession.bearingDeg - (compass.trueHeading || 0) + 540) % 360) - 180) * 3.5)}px)`
              }}
            >
              <div className="w-0 h-0 border-x-4 border-x-transparent border-b-[6px] border-b-cyan-400" />
              <span className="text-[9px] font-black font-mono text-cyan-300 bg-cyan-950/95 px-1.5 py-0.2 rounded border border-cyan-500/50 mt-0.5 shadow-md">
                WP {formatHeadingDeg(navSession.bearingDeg)}
              </span>
            </div>
          )}

          {/* Continuous Sliding Compass Tape with 3x wrap */}
          <div 
            className="absolute top-0 bottom-0 flex items-center transition-transform duration-100 ease-out"
            style={{
              transform: `translateX(${-((compass.trueHeading || 0) * 3.5)}px)`,
              width: `${360 * 3.5 * 3}px`,
              left: '50%'
            }}
          >
            {[-360, 0, 360].map((offset) => (
              <div key={offset} className="flex relative h-full items-center" style={{ width: `${360 * 3.5}px` }}>
                {Array.from({ length: 72 }).map((_, i) => {
                  const deg = i * 5;
                  const isMajor = deg % 30 === 0;
                  const isCardinal = deg % 90 === 0;
                  const cardinalName = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : null;

                  return (
                    <div 
                      key={deg}
                      className="absolute flex flex-col items-center justify-end h-full pb-1"
                      style={{ left: `${deg * 3.5}px` }}
                    >
                      {isCardinal ? (
                        <span className={`text-[11px] font-black font-mono mb-0.5 ${deg === 0 ? 'text-red-400' : 'text-cyan-300'}`}>
                          {cardinalName}
                        </span>
                      ) : isMajor ? (
                        <span className="text-[9px] font-mono text-slate-400 mb-0.5">
                          {deg.toString().padStart(3, '0')}
                        </span>
                      ) : null}
                      <div className={`w-px ${isCardinal ? 'h-3.5 bg-cyan-400' : isMajor ? 'h-2.5 bg-slate-500' : 'h-1.5 bg-slate-700'}`} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 1. Live Navigation HUD Banner (when Navigation is Active) */}
      {navSession.isNavigating && targetWaypoint && (
        <div className={`w-full p-4 sm:p-5 rounded-2xl border shadow-2xl backdrop-blur-lg flex flex-col gap-4 ${
          isNightMode 
            ? 'bg-red-950/90 border-red-800 text-red-100' 
            : 'bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/80 border-cyan-500/60 text-slate-100 shadow-cyan-950/40'
        }`}>
          {/* Header Row: Target Waypoint & Navigation Mode Badges & Main Action Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400 shrink-0">
                <Navigation className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
                    {navSession.isRouteNavigation ? 'SEQUENTIAL ROUTE NAVIGATION' : 'DIRECT WAYPOINT NAVIGATION'}
                  </span>
                  {navSession.isRouteNavigation && activeRoute && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/50 text-[10px] font-mono text-cyan-300 font-bold">
                      Route: {activeRoute.name} • Leg {(navSession.currentLegIndex ?? 0) + 1} / {navSession.totalLegs || sortedWaypoints.length}
                    </span>
                  )}
                  {navSession.isRouteNavigation && (
                    <button
                      type="button"
                      onClick={handleToggleAutoAdvance}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono border transition-all ${
                        navSession.autoAdvanceEnabled !== false
                          ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                      title="Toggle auto-advancing to next waypoint upon entering arrival radius (150m)"
                    >
                      Auto-Advance: {navSession.autoAdvanceEnabled !== false ? 'ON' : 'OFF'}
                    </button>
                  )}
                </div>
                <div className="text-lg font-bold font-mono text-white flex items-center gap-2 mt-0.5">
                  <span className="text-slate-400 text-sm">Target WP:</span>
                  <span className="text-cyan-300 underline underline-offset-4">{targetWaypoint.name}</span>
                </div>
              </div>
            </div>

            {/* Main Action Buttons: Prev Leg, Next Leg, and STOP NAVIGATION */}
            <div className="flex flex-wrap items-center gap-2">
              {navSession.isRouteNavigation && sortedWaypoints.length > 1 && (
                <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    disabled={(navSession.currentLegIndex ?? 0) <= 0}
                    onClick={handlePreviousWaypoint}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono border border-slate-700 flex items-center gap-1 disabled:opacity-30 transition-all"
                    title="Jump to previous waypoint in route"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev Leg</span>
                  </button>

                  <button
                    type="button"
                    disabled={(navSession.currentLegIndex ?? 0) >= sortedWaypoints.length - 1}
                    onClick={handleAdvanceNextWaypoint}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono border border-slate-700 flex items-center gap-1 disabled:opacity-30 transition-all"
                    title="Jump to next waypoint in route"
                  >
                    <span className="hidden sm:inline">Next Leg</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Red STOP NAVIGATION Button */}
              <button
                id="btn-stop-navigation"
                type="button"
                onClick={handleStopNavigation}
                className="px-4 sm:px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black font-mono tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-red-950/60 border border-red-400 animate-pulse"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>STOP NAVIGATION</span>
              </button>
            </div>
          </div>

          {/* Sequential Route Timeline Stepper (When navigating a full route) */}
          {navSession.isRouteNavigation && sortedWaypoints.length > 1 && (
            <div className="w-full bg-slate-950/90 p-3 rounded-xl border border-slate-800/90 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                  <RouteIcon className="w-3.5 h-3.5 text-cyan-400" />
                  ROUTE WAYPOINT SEQUENCE:
                </span>
                <span className="text-cyan-300">
                  Leg {(navSession.currentLegIndex ?? 0) + 1} of {sortedWaypoints.length}
                </span>
              </div>

              {/* Interactive Stepper Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {sortedWaypoints.map((wp, idx) => {
                  const currentIdx = navSession.currentLegIndex ?? 0;
                  const isCurrent = idx === currentIdx;
                  const isPast = idx < currentIdx;

                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => handleStartRouteNavigation(idx)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap transition-all border shrink-0 ${
                        isCurrent
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-md shadow-amber-950 animate-pulse'
                          : isPast
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                      title={`Click to jump navigation to WP ${idx + 1} (${wp.name})`}
                    >
                      <span>{isPast ? '✓' : `#${idx + 1}`}</span>
                      <span>{wp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nav Instruments 6-Grid Cluster */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Speed (SOG) */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">SOG (Boat Speed)</span>
              <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                {(gps.speedKnots || 0).toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-400">knots</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {(gps.speedKmh || 0).toFixed(1)} km/h
              </span>
            </div>

            {/* Bearing to Waypoint (BRG) */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">BRG (Direct Course)</span>
              <div className="text-xl sm:text-2xl font-black font-mono text-cyan-300">
                {formatHeadingDeg(navSession.bearingDeg)}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                True Great-Circle
              </span>
            </div>

            {/* Distance to Current Waypoint (DIST) */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {navSession.isRouteNavigation ? 'DIST TO LEG WP' : 'DIST TO DEST'}
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-amber-400">
                {navSession.distanceNm !== null ? `${navSession.distanceNm.toFixed(2)} NM` : '--- NM'}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {navSession.distanceKm !== null ? `${navSession.distanceKm.toFixed(1)} km` : '--- km'}
              </span>
            </div>

            {/* Time To Go / Remaining Route Distance */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {navSession.isRouteNavigation ? 'ROUTE REMAINING' : 'TTG (Time To Go)'}
              </span>
              <div className="text-xl sm:text-2xl font-black font-mono text-white">
                {navSession.isRouteNavigation && navSession.routeRemainingDistanceNm !== null
                  ? `${navSession.routeRemainingDistanceNm.toFixed(1)} NM`
                  : formatTtg(navSession.ttgSeconds)}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {navSession.isRouteNavigation
                  ? `Leg TTG: ${formatTtg(navSession.ttgSeconds)}`
                  : `@ ${(gps.speedKnots || 0).toFixed(1)} kts`}
              </span>
            </div>

            {/* Estimated Time of Arrival (ETA) */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase">
                {navSession.isRouteNavigation ? 'ROUTE FINAL ETA' : 'ETA (Arrival Time)'}
              </span>
              <div className="text-base sm:text-lg font-black font-mono text-cyan-200">
                {navSession.isRouteNavigation && navSession.routeEtaTimestamp
                  ? formatEta(navSession.routeEtaTimestamp)
                  : formatEta(navSession.etaTimestamp)}
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {navSession.isRouteNavigation ? `Leg ETA: ${formatEta(navSession.etaTimestamp)}` : 'Direct straight route'}
              </span>
            </div>

            {/* Steer / Course Error Indicator */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col justify-center items-center text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">HEADING STEER</span>
              <div className={`text-xs sm:text-sm font-black font-mono tracking-tight ${steerInfo?.color || 'text-slate-400'}`}>
                {steerInfo?.text || 'MAINTAIN COURSE'}
              </div>
              {navSession.xteNm !== null && (
                <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                  XTE: {Math.abs(navSession.xteNm).toFixed(2)} NM {navSession.xteNm > 0 ? 'R' : 'L'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Interactive Offline Marine Chart & Bathymetry */}
      <div className="w-full flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Anchor className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold font-mono text-slate-300 uppercase tracking-wider">
              Offline Marine Vector Chart & Bathymetry
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Map Pick Mode toggle */}
            <button
              type="button"
              onClick={() => setIsMapPickMode(!isMapPickMode)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md ${
                isMapPickMode 
                  ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse' 
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isMapPickMode ? 'Click Map to Place WP' : 'Pick on Map'}</span>
            </button>
          </div>
        </div>

        {/* Marine Canvas Chart */}
        <OfflineMarineChart
          gps={gps}
          compass={compass}
          activeRoute={activeRoute}
          targetWaypoint={targetWaypoint}
          navigationSession={navSession}
          isNightMode={isNightMode}
          isAddWaypointMode={isMapPickMode}
          onMapClickAddWaypoint={handleMapClickAddWaypoint}
          onSelectWaypoint={(wp) => {
            setTargetWaypointId(wp.id);
            handleStartNavigation(wp);
          }}
        />
      </div>

      {/* 3. Route Selector & Manager Bar */}
      <div className="w-full p-4 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Active Route Dropdown / Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 shrink-0">
              <RouteIcon className="w-5 h-5" />
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                ACTIVE VOYAGE ROUTE
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={activeRouteId}
                  onChange={(e) => {
                    setActiveRouteId(e.target.value);
                    setTargetWaypointId(null);
                  }}
                  className="bg-slate-950 border border-slate-700 text-slate-100 text-sm font-bold font-mono rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-400"
                >
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.waypoints.length} Waypoints)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Route Stats & Tools + PROMINENT "NAVIGATE ROUTE" BUTTON */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Route summary badge */}
            <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-3">
              <span>WPs: <strong className="text-cyan-400">{sortedWaypoints.length}</strong>/50</span>
              <span>Total: <strong className="text-amber-400">{totalRouteDistanceNm.toFixed(1)} NM</strong></span>
            </div>

            {/* NAVIGATE ROUTE BUTTON */}
            {navSession.isNavigating && navSession.isRouteNavigation && navSession.routeId === activeRoute?.id ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAdvanceNextWaypoint}
                  disabled={(navSession.currentLegIndex ?? 0) >= sortedWaypoints.length - 1}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono border border-slate-700 flex items-center gap-1 transition-all disabled:opacity-30"
                  title="Advance to next leg in route"
                >
                  <span>Next Leg</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleStopNavigation}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-black text-xs font-mono rounded-xl flex items-center gap-1.5 shadow-lg shadow-red-950 border border-red-400 animate-pulse transition-all"
                  title="Stop Route Navigation"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>STOP ROUTE</span>
                </button>
              </div>
            ) : (
              <button
                id="btn-navigate-full-route"
                type="button"
                disabled={sortedWaypoints.length === 0}
                onClick={() => handleStartRouteNavigation(0)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs font-mono rounded-xl flex items-center gap-2 shadow-lg shadow-cyan-950/80 transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                title={`Start Sequential Route Navigation across all ${sortedWaypoints.length} Waypoints`}
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>NAVIGATE ROUTE</span>
              </button>
            )}

            {/* New Route Button */}
            <button
              id="btn-create-new-route"
              type="button"
              onClick={() => setShowCreateRouteModal(true)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-xl border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
            >
              <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
              <span>New</span>
            </button>

            {/* Delete Route */}
            {activeRoute && (
              <button
                type="button"
                onClick={() => setRouteToDelete(activeRoute)}
                className="p-2 bg-slate-800 hover:bg-red-950/60 text-slate-400 hover:text-red-400 rounded-xl border border-slate-700 hover:border-red-800 text-xs font-mono"
                title="Delete Current Route"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Route Description note */}
        {activeRoute?.description && (
          <div className="text-xs text-slate-400 italic">
            "{activeRoute.description}"
          </div>
        )}

        {/* 4. Waypoints List Table (Up to 50 Waypoints) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                Waypoints Sequence ({sortedWaypoints.length} / 50)
              </span>
            </div>

            {/* Add Waypoint Button */}
            <button
              id="btn-add-waypoint"
              type="button"
              onClick={openAddWaypointModal}
              className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs font-mono rounded-xl flex items-center gap-1.5 shadow-md shadow-cyan-950 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Waypoint</span>
            </button>
          </div>

          {/* Waypoints Table Container */}
          {activeRoute && sortedWaypoints.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 shadow-inner">
              <table className="w-full text-left text-xs font-mono border-collapse min-w-[620px]">
                <thead>
                  <tr className="bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 w-14 text-center">#</th>
                    <th className="py-3 px-3 w-24 text-center">NAV</th>
                    <th className="py-3 px-3">Waypoint Name</th>
                    <th className="py-3 px-3">Latitude (N/S)</th>
                    <th className="py-3 px-3">Longitude (E/W)</th>
                    <th className="py-3 px-3 text-right">Leg Dist</th>
                    <th className="py-3 px-3 text-right">Bearing</th>
                    <th className="py-3 px-3 text-right w-20">Options</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedWaypoints.map((wp, idx) => {
                    const isTarget = targetWaypointId === wp.id;
                    const isNavigatingThis = navSession.isNavigating && targetWaypointId === wp.id;
                    const isPassedLeg = navSession.isNavigating && navSession.isRouteNavigation && idx < (navSession.currentLegIndex ?? 0);
                    const prevWp = idx > 0 ? sortedWaypoints[idx - 1] : null;
                    const legDist = prevWp 
                      ? calculateDistanceNm(prevWp.latitude, prevWp.longitude, wp.latitude, wp.longitude)
                      : null;
                    const legBrg = prevWp
                      ? calculateBearing(prevWp.latitude, prevWp.longitude, wp.latitude, wp.longitude)
                      : null;

                    return (
                      <tr 
                        key={wp.id} 
                        className={`transition-colors ${
                          isNavigatingThis
                            ? 'bg-amber-950/40 text-amber-200 font-bold border-l-4 border-l-amber-400' 
                            : isPassedLeg
                            ? 'bg-emerald-950/20 text-emerald-300'
                            : isTarget
                            ? 'bg-cyan-950/40 text-cyan-200 font-bold border-l-4 border-l-cyan-400' 
                            : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        {/* 1. Sequence Number & Reorder Controls */}
                        <td className="py-2.5 px-3 shrink-0">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="w-4 text-center font-bold text-slate-400">
                              {isPassedLeg ? '✓' : idx + 1}
                            </span>
                            <div className="flex flex-col gap-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveWaypoint(idx, 'up')}
                                className="p-0.5 text-slate-500 hover:text-cyan-300 disabled:opacity-20 rounded hover:bg-slate-800"
                                title="Move Waypoint Up in Sequence"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === sortedWaypoints.length - 1}
                                onClick={() => handleMoveWaypoint(idx, 'down')}
                                className="p-0.5 text-slate-500 hover:text-cyan-300 disabled:opacity-20 rounded hover:bg-slate-800"
                                title="Move Waypoint Down in Sequence"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 2. Dedicated NAV Button on the LEFT side */}
                        <td className="py-2.5 px-3 shrink-0 text-center">
                          {isNavigatingThis ? (
                            <button
                              type="button"
                              onClick={handleStopNavigation}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] font-mono flex items-center justify-center gap-1 shadow-md shadow-red-950 border border-red-400 animate-pulse mx-auto"
                              title="Stop Navigation to this Waypoint"
                            >
                              <Square className="w-3 h-3 fill-white" />
                              <span>STOP</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStartRouteNavigation(idx)}
                              className="px-2.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-[11px] font-mono flex items-center justify-center gap-1 shadow-md shadow-cyan-950 transition-all hover:scale-105 mx-auto"
                              title={`Navigate route starting from WP ${idx + 1} (${wp.name})`}
                            >
                              <Play className="w-3 h-3 fill-slate-950" />
                              <span>NAV</span>
                            </button>
                          )}
                        </td>

                        {/* 3. Name & Target Badge */}
                        <td className="py-2.5 px-3 font-sans">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-xs font-bold font-mono">{wp.name}</span>
                            {isNavigatingThis && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-mono font-black animate-pulse">
                                ACTIVE LEG
                              </span>
                            )}
                            {isPassedLeg && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-900/80 border border-emerald-600/50 text-emerald-300 text-[9px] font-mono">
                                PASSED
                              </span>
                            )}
                          </div>
                          {wp.description && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {wp.description}
                            </span>
                          )}
                        </td>

                        {/* 4. Latitude */}
                        <td className="py-2.5 px-3 font-mono">
                          {formatMarineDDM(wp.latitude, false)}
                        </td>

                        {/* 5. Longitude */}
                        <td className="py-2.5 px-3 font-mono">
                          {formatMarineDDM(wp.longitude, true)}
                        </td>

                        {/* 6. Leg Distance */}
                        <td className="py-2.5 px-3 font-mono text-right text-amber-300">
                          {legDist !== null ? `${legDist.toFixed(2)} NM` : '---'}
                        </td>

                        {/* 7. Leg Bearing */}
                        <td className="py-2.5 px-3 font-mono text-right text-cyan-300">
                          {legBrg !== null ? formatHeadingDeg(legBrg) : '---'}
                        </td>

                        {/* 8. Action Buttons (Edit & Delete) */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditWaypointModal(wp)}
                              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded-lg transition-colors"
                              title="Edit Waypoint"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setWaypointToDelete(wp)}
                              className="p-1.5 hover:bg-red-950 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                              title="Delete Waypoint"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/40 flex flex-col items-center gap-3">
              <MapPin className="w-8 h-8 text-slate-600" />
              <div className="text-sm font-mono text-slate-400">
                No Waypoints created for this route yet.
              </div>
              <button
                type="button"
                onClick={openAddWaypointModal}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs font-mono rounded-xl flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Waypoint</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Create New Marine Route */}
      {showCreateRouteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 font-mono text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm uppercase">
                <FolderPlus className="w-5 h-5" />
                <span>Create New Marine Route</span>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateRouteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Route Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Kish to Bandar Lengeh"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description / Marine Remarks</label>
                <textarea
                  placeholder="e.g. Commercial fairway voyage route"
                  value={newRouteDescription}
                  onChange={(e) => setNewRouteDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateRouteModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateRoute}
                disabled={!newRouteName.trim()}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl shadow-lg"
              >
                Create Route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add / Edit Waypoint */}
      {showAddWaypointModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 font-mono text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm uppercase">
                <MapPin className="w-5 h-5" />
                <span>{editingWaypoint ? 'Edit Waypoint' : 'Add GPS Waypoint'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWaypointModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Waypoint Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Kish Port Fairway"
                  value={wpNameInput}
                  onChange={(e) => setWpNameInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Latitude (N/S) *</label>
                  <input
                    type="text"
                    placeholder="e.g. 26.5540 or 26° 33.24' N"
                    value={wpLatInput}
                    onChange={(e) => setWpLatInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Longitude (E/W) *</label>
                  <input
                    type="text"
                    placeholder="e.g. 54.0150 or 54° 00.90' E"
                    value={wpLonInput}
                    onChange={(e) => setWpLonInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              </div>

              {/* Use current vessel GPS position button */}
              {gps.latitude !== null && gps.longitude !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setWpLatInput(gps.latitude!.toFixed(6));
                    setWpLonInput(gps.longitude!.toFixed(6));
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono rounded-lg border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <Locate className="w-3.5 h-3.5" />
                  <span>Insert Current Vessel GPS Position</span>
                </button>
              )}

              <div>
                <label className="text-xs text-slate-400 block mb-1">Description / Nautical Note</label>
                <input
                  type="text"
                  placeholder="e.g. Channel entrance buoy #1"
                  value={wpDescInput}
                  onChange={(e) => setWpDescInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddWaypointModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWaypoint}
                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-xl shadow-lg"
              >
                {editingWaypoint ? 'Save Changes' : 'Add Waypoint'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Custom Delete Route Confirmation (NO AIS-PRE...) */}
      {routeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-red-800/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 font-mono text-slate-200">
            <div className="flex items-center gap-3 text-red-400 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm uppercase text-white">Delete Route</h3>
                <span className="text-[11px] text-slate-400">Permanent action</span>
              </div>
            </div>

            <div className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete route: <strong className="text-white bg-slate-950 px-2 py-1 rounded border border-slate-800">"{routeToDelete.name}"</strong>?
              <p className="text-xs text-slate-400 mt-2">
                This will delete all {routeToDelete.waypoints.length} waypoints saved inside this route.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRouteToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoute}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl shadow-lg shadow-red-950/50"
              >
                Delete Route
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Custom Delete Waypoint Confirmation (NO AIS-PRE...) */}
      {waypointToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-red-800/80 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 font-mono text-slate-200">
            <div className="flex items-center gap-3 text-red-400 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm uppercase text-white">Delete Waypoint</h3>
                <span className="text-[11px] text-slate-400">Remove from sequence</span>
              </div>
            </div>

            <div className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to delete waypoint: <strong className="text-white bg-slate-950 px-2 py-1 rounded border border-slate-800">"{waypointToDelete.name}"</strong>?
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setWaypointToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteWaypoint}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl shadow-lg shadow-red-950/50"
              >
                Delete Waypoint
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
