import { useState, useEffect, useRef } from 'react';
import { GpsData, CompassData } from '../types';

export function useSensors() {
  const [gps, setGps] = useState<GpsData>({
    latitude: 27.1832,   // Default: Persian Gulf / Strait of Hormuz
    longitude: 56.2736,
    accuracy: null,
    altitude: null,
    speedKnots: null,
    heading: null,
    timestamp: null
  });

  const [compass, setCompass] = useState<CompassData>({
    magneticHeading: 0,
    trueHeading: 0,
    headingAccuracy: null,
    pitch: null,
    roll: null
  });

  const [hasGpsFix, setHasGpsFix] = useState(false);
  const [sensorPermission, setSensorPermission] = useState<'prompt' | 'granted' | 'denied'>('granted');

  const prevHeadingRef = useRef<number>(0);

  // 1. Geolocation Watch
  useEffect(() => {
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedMps = pos.coords.speed;
        const speedKts = speedMps !== null && !isNaN(speedMps) ? speedMps * 1.94384 : null;
        const headingDeg = pos.coords.heading;

        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speedKnots: speedKts,
          heading: headingDeg !== null && !isNaN(headingDeg) ? headingDeg : null,
          timestamp: pos.timestamp
        });
        setHasGpsFix(true);
      },
      (err) => {
        console.warn('Geolocation watch error:', err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // 2. Compass Sensor Watch
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // iOS Safari provides webkitCompassHeading directly
      if ('webkitCompassHeading' in e && typeof (e as any).webkitCompassHeading === 'number') {
        heading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        // Standard Android / Chrome
        heading = (360 - e.alpha) % 360;
      }

      if (heading !== null && !isNaN(heading)) {
        // Smooth heading damping
        const diff = heading - prevHeadingRef.current;
        const normDiff = ((diff + 540) % 360) - 180;
        const smoothed = (prevHeadingRef.current + normDiff * 0.4 + 360) % 360;
        prevHeadingRef.current = smoothed;

        setCompass((prev) => ({
          ...prev,
          magneticHeading: Math.round(smoothed),
          trueHeading: Math.round(smoothed),
          pitch: e.beta ? Math.round(e.beta) : null,
          roll: e.gamma ? Math.round(e.gamma) : null
        }));
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation as any, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as any, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, []);

  return {
    gps,
    compass,
    hasGpsFix,
    sensorPermission
  };
}
