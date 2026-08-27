import { useEffect, useRef, useState, useCallback } from 'react';
import { CompassData, GpsData } from '../types';
import { msToKmh, msToKnots } from '../utils/geo';

export type CompassDampingMode = 'heavy' | 'smooth' | 'balanced' | 'fast';
export type DisplayRefreshRate = '1hz' | '2hz' | '4hz' | '10hz' | 'max';

// Calculate the shortest signed angular difference between two angles in degrees (-180 to +180)
function shortestAngleDiff(target: number, current: number): number {
  return ((((target - current) % 360) + 540) % 360) - 180;
}

export function useSensors(magneticVariation: number = 0, headingCorrection: number = 0) {
  // Damping filter setting: 'heavy' (ultra-damped marine), 'smooth' (fluid), 'balanced', 'fast'
  const [dampingMode, setDampingMode] = useState<CompassDampingMode>('smooth');
  const [displayRefreshRate, setDisplayRefreshRate] = useState<DisplayRefreshRate>('4hz');

  // Compass State
  const [compass, setCompass] = useState<CompassData>({
    magneticHeading: 0,
    trueHeading: 0,
    pitch: 0,
    roll: 0,
    accuracy: null,
    absolute: false,
    calibrated: true,
  });

  // GPS State - Starts with null coordinates until real GPS is received
  const [gps, setGps] = useState<GpsData>({
    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    speed: 0,
    speedKnots: 0,
    speedKmh: 0,
    heading: null,
    altitudeAccuracy: null,
    timestamp: Date.now(),
    fixType: 'No Fix',
    satellites: 0,
    hdop: 0,
  });

  const [hasRealGps, setHasRealGps] = useState<boolean>(false);
  const [isGpsAcquiring, setIsGpsAcquiring] = useState<boolean>(true);
  const [hasRealCompass, setHasRealCompass] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsPermissionState, setGpsPermissionState] = useState<'granted' | 'prompt' | 'denied' | 'unknown'>('unknown');
  const [isManualHeading, setIsManualHeading] = useState<boolean>(false);

  // Filter state refs: Continuous Unit Vector Low-Pass filter
  const vecXRef = useRef<number>(1);
  const vecYRef = useRef<number>(0);
  const currentFilteredHeadingRef = useRef<number>(0);
  const rawTargetHeadingRef = useRef<number | null>(null);
  const lastValidRawHeadingRef = useRef<number | null>(null);
  const currentPitchRef = useRef<number>(0);
  const currentRollRef = useRef<number>(0);
  const lastStateUpdateHeadingRef = useRef<number>(0);
  const lastStateUpdateTimeRef = useRef<number>(0);

  const dampingModeRef = useRef<CompassDampingMode>(dampingMode);
  dampingModeRef.current = dampingMode;

  const displayRefreshRateRef = useRef<DisplayRefreshRate>(displayRefreshRate);
  displayRefreshRateRef.current = displayRefreshRate;

  const magVarRef = useRef(magneticVariation);
  magVarRef.current = magneticVariation;

  const hdgCorrectionRef = useRef(headingCorrection);
  hdgCorrectionRef.current = headingCorrection;

  const activeSensorSourceRef = useRef<'sensor_api' | 'absolute_event' | 'webkit_event' | 'standard_event' | null>(null);

  // 1. High-Performance Marine Gyro Unit-Vector Smoothing Engine
  useEffect(() => {
    let active = true;
    let animFrameId: number | null = null;
    let targetPitch = 0;
    let targetRoll = 0;
    let targetAccuracy: number | null = null;
    let targetAbsolute = false;

    // 60FPS continuous vector trigonometric smoothing
    const processFilter = () => {
      if (!active) return;

      if (rawTargetHeadingRef.current !== null && !isManualHeading) {
        const targetDeg = rawTargetHeadingRef.current;
        const currentDeg = currentFilteredHeadingRef.current;
        const angularDelta = Math.abs(shortestAngleDiff(targetDeg, currentDeg));

        // Marine adaptive smoothing coefficient
        let alpha = 0.08;
        let deadband = 0.25;

        if (dampingModeRef.current === 'heavy') {
          alpha = 0.04;
          deadband = 0.6;
        } else if (dampingModeRef.current === 'smooth') {
          alpha = 0.08;
          deadband = 0.3;
        } else if (dampingModeRef.current === 'balanced') {
          alpha = 0.18;
          deadband = 0.15;
        } else if (dampingModeRef.current === 'fast') {
          alpha = 0.36;
          deadband = 0.08;
        }

        // Adaptive responsiveness: If heading moves rapidly (turning boat/car), increase alpha dynamically
        if (angularDelta > 25) {
          alpha = Math.min(0.65, alpha * 3.0);
        } else if (angularDelta < deadband) {
          // Deadband filter: Kill micro sensor jitter completely when steady
          alpha = 0;
        }

        if (alpha > 0) {
          // Target unit vector
          const targetRad = (targetDeg * Math.PI) / 180;
          const targetX = Math.sin(targetRad);
          const targetY = Math.cos(targetRad);

          // Exponential moving average on trigonometric vectors
          vecXRef.current += (targetX - vecXRef.current) * alpha;
          vecYRef.current += (targetY - vecYRef.current) * alpha;

          // Normalize vector to heading degrees
          const filteredRad = Math.atan2(vecXRef.current, vecYRef.current);
          let filteredDeg = (filteredRad * 180) / Math.PI;
          filteredDeg = ((filteredDeg % 360) + 360) % 360;
          currentFilteredHeadingRef.current = filteredDeg;
        }

        // Smooth pitch & roll
        currentPitchRef.current += (targetPitch - currentPitchRef.current) * 0.08;
        currentRollRef.current += (targetRoll - currentRollRef.current) * 0.08;

        // User-configurable State Update Rate Limiter
        let intervalMs = 250; // default 4Hz (Marine standard)
        if (displayRefreshRateRef.current === '1hz') intervalMs = 1000;
        else if (displayRefreshRateRef.current === '2hz') intervalMs = 500;
        else if (displayRefreshRateRef.current === '4hz') intervalMs = 250;
        else if (displayRefreshRateRef.current === '10hz') intervalMs = 100;
        else if (displayRefreshRateRef.current === 'max') intervalMs = 30;

        const now = performance.now();
        const headingDiffFromLastUpdate = Math.abs(shortestAngleDiff(currentFilteredHeadingRef.current, lastStateUpdateHeadingRef.current));
        const timeDiff = now - lastStateUpdateTimeRef.current;

        // Only commit React state update when timer expired AND change is meaningful, or if large turn occurred
        if (timeDiff >= intervalMs || (headingDiffFromLastUpdate > 2.0 && timeDiff > 60)) {
          lastStateUpdateHeadingRef.current = currentFilteredHeadingRef.current;
          lastStateUpdateTimeRef.current = now;

          // Apply manual calibration/correction offset to raw magnetic heading, then add variation for true heading
          const correctedMag = (((currentFilteredHeadingRef.current + hdgCorrectionRef.current) % 360) + 360) % 360;
          const trueHdg = (((correctedMag + magVarRef.current) % 360) + 360) % 360;

          setCompass({
            magneticHeading: Number(correctedMag.toFixed(1)),
            trueHeading: Number(trueHdg.toFixed(1)),
            pitch: Math.round(currentPitchRef.current),
            roll: Math.round(currentRollRef.current),
            accuracy: targetAccuracy,
            absolute: targetAbsolute,
            calibrated: targetAccuracy !== null ? targetAccuracy <= 15 : true,
          });
        }
      }

      animFrameId = requestAnimationFrame(processFilter);
    };

    animFrameId = requestAnimationFrame(processFilter);

    // Get screen orientation angle offset (portrait vs landscape)
    const getScreenOrientationAngle = (): number => {
      if (typeof window === 'undefined') return 0;
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number') {
        return window.screen.orientation.angle;
      }
      if (typeof (window as any).orientation === 'number') {
        return (window as any).orientation;
      }
      return 0;
    };

    // Calculate 3D tilt-compensated azimuth from Euler angles (alpha, beta, gamma)
    const computeTiltCompensatedHeading = (alpha: number, beta: number, gamma: number): number => {
      const rad = Math.PI / 180;
      const a = alpha * rad;
      const b = beta * rad;
      const g = gamma * rad;

      const cA = Math.cos(a), sA = Math.sin(a);
      const cB = Math.cos(b), sB = Math.sin(b);
      const cG = Math.cos(g), sG = Math.sin(g);

      // Device Y-axis (top of screen) projected to horizontal ground plane
      const yX = -cA * sB * sG - sA * cG;
      const yY = -sA * sB * sG + cA * cG;

      let azimuth = Math.atan2(-yX, yY) * (180 / Math.PI);
      const screenOffset = getScreenOrientationAngle();
      azimuth = (azimuth + screenOffset) % 360;
      return ((azimuth % 360) + 360) % 360;
    };

    // Safe update handler with glitch-rejection
    const handleNewRawHeading = (heading: number, pitch: number, roll: number, accuracy: number | null, isAbsolute: boolean) => {
      if (isNaN(heading)) return;

      // Glitch filter: If sudden spike > 120° in a single event, verify before jumping
      if (lastValidRawHeadingRef.current !== null) {
        const jump = Math.abs(shortestAngleDiff(heading, lastValidRawHeadingRef.current));
        if (jump > 120 && targetAccuracy !== null && targetAccuracy > 20) {
          return; // ignore rogue sensor glitch
        }
      }

      setHasRealCompass(true);
      lastValidRawHeadingRef.current = heading;
      rawTargetHeadingRef.current = heading;
      targetPitch = pitch;
      targetRoll = roll;
      targetAccuracy = accuracy;
      targetAbsolute = isAbsolute;

      // Initialize vectors on first valid frame
      if (vecXRef.current === 1 && vecYRef.current === 0) {
        const rad = (heading * Math.PI) / 180;
        vecXRef.current = Math.sin(rad);
        vecYRef.current = Math.cos(rad);
        currentFilteredHeadingRef.current = heading;
      }
    };

    // A. Native Generic Sensor API (AbsoluteOrientationSensor) for Android Chrome
    let absoluteSensorInstance: any = null;
    if (typeof window !== 'undefined' && 'AbsoluteOrientationSensor' in window) {
      try {
        absoluteSensorInstance = new (window as any).AbsoluteOrientationSensor({ frequency: 60, referenceFrame: 'device' });
        absoluteSensorInstance.addEventListener('reading', () => {
          if (!active) return;
          const q = absoluteSensorInstance.quaternion;
          if (q && q.length === 4) {
            activeSensorSourceRef.current = 'sensor_api';
            const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
            const r01 = 2 * (qx * qy - qw * qz);
            const r11 = 1 - 2 * (qx * qx + qz * qz);
            let heading = Math.atan2(-r01, r11) * (180 / Math.PI);
            const screenOffset = getScreenOrientationAngle();
            heading = ((heading + screenOffset) % 360 + 360) % 360;

            // Pitch & Roll from quaternion
            const sinPitch = 2 * (qw * qx - qy * qz);
            const pitch = Math.asin(Math.max(-1, Math.min(1, sinPitch))) * (180 / Math.PI);
            const roll = Math.atan2(2 * (qw * qy + qz * qx), 1 - 2 * (qx * qx + qy * qy)) * (180 / Math.PI);

            handleNewRawHeading(heading, pitch, roll, 3, true);
          }
        });
        absoluteSensorInstance.start();
      } catch (err) {
        absoluteSensorInstance = null;
      }
    }

    // B. Absolute Orientation Event (Android Chrome)
    const handleAbsoluteOrientation = (e: any) => {
      if (!active || activeSensorSourceRef.current === 'sensor_api') return;

      if (e.alpha !== null && typeof e.alpha === 'number') {
        activeSensorSourceRef.current = 'absolute_event';
        const beta = e.beta !== null ? e.beta : 0;
        const gamma = e.gamma !== null ? e.gamma : 0;

        // Apply 3D tilt compensation
        const heading = computeTiltCompensatedHeading(e.alpha, beta, gamma);
        handleNewRawHeading(heading, beta, gamma, e.webkitCompassAccuracy || 5, true);
      }
    };

    // C. Standard Orientation Event (iOS Safari webkitCompassHeading & Fallback)
    const handleStandardOrientation = (e: any) => {
      if (!active) return;
      if (activeSensorSourceRef.current === 'sensor_api' || activeSensorSourceRef.current === 'absolute_event') return;

      // iOS Safari webkitCompassHeading
      if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
        activeSensorSourceRef.current = 'webkit_event';
        const beta = e.beta !== null ? e.beta : 0;
        const gamma = e.gamma !== null ? e.gamma : 0;
        const screenOffset = getScreenOrientationAngle();
        const heading = ((e.webkitCompassHeading + screenOffset) % 360 + 360) % 360;
        handleNewRawHeading(heading, beta, gamma, e.webkitCompassAccuracy || 5, true);
      } else if (e.alpha !== null && typeof e.alpha === 'number' && e.absolute) {
        activeSensorSourceRef.current = 'absolute_event';
        const beta = e.beta !== null ? e.beta : 0;
        const gamma = e.gamma !== null ? e.gamma : 0;
        const heading = computeTiltCompensatedHeading(e.alpha, beta, gamma);
        handleNewRawHeading(heading, beta, gamma, 5, true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientationabsolute' as any, handleAbsoluteOrientation, true);
      window.addEventListener('deviceorientation', handleStandardOrientation, true);
    }

    return () => {
      active = false;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (absoluteSensorInstance) {
        try {
          absoluteSensorInstance.stop();
        } catch (e) {}
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('deviceorientationabsolute' as any, handleAbsoluteOrientation, true);
        window.removeEventListener('deviceorientation', handleStandardOrientation, true);
      }
    };
  }, [isManualHeading]);

  // Handle GPS position callback
  const handlePositionSuccess = useCallback((pos: GeolocationPosition) => {
    setHasRealGps(true);
    setIsGpsAcquiring(false);
    setGpsError(null);
    setGpsPermissionState('granted');

    const spd = pos.coords.speed !== null && !isNaN(pos.coords.speed) && pos.coords.speed >= 0 ? pos.coords.speed : 0;
    const spdKts = msToKnots(spd);
    const spdKmh = msToKmh(spd);
    const cog = pos.coords.heading !== null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0 ? pos.coords.heading : null;

    const acc = pos.coords.accuracy || 5;
    const satellitesEstimate = acc < 5 ? 12 : acc < 10 ? 9 : acc < 20 ? 7 : 5;
    const hdopEstimate = Math.max(0.6, Number((acc / 5).toFixed(1)));

    setGps({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      altitude: pos.coords.altitude !== null && !isNaN(pos.coords.altitude) ? pos.coords.altitude : null,
      accuracy: pos.coords.accuracy,
      speed: spd,
      speedKnots: spdKts,
      speedKmh: spdKmh,
      heading: cog,
      altitudeAccuracy: pos.coords.altitudeAccuracy,
      timestamp: pos.timestamp || Date.now(),
      fixType: acc < 8 ? 'DGPS' : '3D Fix',
      satellites: satellitesEstimate,
      hdop: hdopEstimate,
    });
  }, []);

  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    setIsGpsAcquiring(false);
    let msg = 'Unknown GPS Error';
    if (err.code === 1) {
      msg = 'Location access is blocked by your browser. Please allow Location permissions in browser settings.';
      setGpsPermissionState('denied');
    } else if (err.code === 2) {
      msg = 'GPS satellite signal unavailable. Please ensure device Location / GPS is turned ON.';
    } else if (err.code === 3) {
      msg = 'Satellite acquisition timed out. Retrying GPS fix...';
    }
    console.warn('Geolocation error:', err.code, err.message);
    setGpsError(msg);
  }, []);

  // 2. Active GPS fetcher
  const requestGpsFix = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by this browser');
      setIsGpsAcquiring(false);
      return;
    }

    setIsGpsAcquiring(true);
    setGpsError(null);

    // High Accuracy GNSS request
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePositionSuccess(pos);
      },
      (err) => {
        if (err.code === 3) {
          navigator.geolocation.getCurrentPosition(
            handlePositionSuccess,
            handlePositionError,
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
          );
        } else {
          handlePositionError(err);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [handlePositionSuccess, handlePositionError]);

  // 3. Geolocation Watcher & Permissions query
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by this device/browser');
      setIsGpsAcquiring(false);
      return;
    }

    // Check permission status
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as any }).then((status) => {
        setGpsPermissionState(status.state as any);
        status.onchange = () => {
          setGpsPermissionState(status.state as any);
          if (status.state === 'granted') {
            requestGpsFix();
          }
        };
      }).catch(() => {});
    }

    // Initial fix request
    requestGpsFix();

    // Continuous watch position
    const watchId = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      (err) => {
        if (err.code !== 3) {
          handlePositionError(err);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [handlePositionSuccess, handlePositionError, requestGpsFix]);

  // Request iOS sensor permissions
  const requestCompassPermission = useCallback(async () => {
    if (
      typeof (DeviceOrientationEvent as any) !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        return response === 'granted';
      } catch (err) {
        console.warn('Sensor permission error:', err);
        return false;
      }
    }
    return true;
  }, []);

  // Manual heading adjustment helper
  const setHeadingManual = useCallback((deg: number) => {
    setIsManualHeading(true);
    const normalized = ((deg % 360) + 360) % 360;
    currentFilteredHeadingRef.current = normalized;
    const rad = (normalized * Math.PI) / 180;
    vecXRef.current = Math.sin(rad);
    vecYRef.current = Math.cos(rad);

    const trueHdg = ((normalized + magVarRef.current) % 360 + 360) % 360;

    setCompass((prev) => ({
      ...prev,
      magneticHeading: normalized,
      trueHeading: trueHdg,
    }));
  }, []);

  const resetToSensorHeading = useCallback(() => {
    setIsManualHeading(false);
  }, []);

  return {
    compass,
    gps,
    hasRealGps,
    isGpsAcquiring,
    hasRealCompass,
    gpsError,
    gpsPermissionState,
    isManualHeading,
    dampingMode,
    setDampingMode,
    displayRefreshRate,
    setDisplayRefreshRate,
    setHeadingManual,
    resetToSensorHeading,
    requestCompassPermission,
    requestGpsFix,
    setGpsData: setGps,
  };
}
