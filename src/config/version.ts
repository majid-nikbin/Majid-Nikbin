/**
 * Application Version & Build Information
 * Centrally updated on each release so developer information and UI badges
 * always reflect the latest release version and build date.
 */

export const APP_VERSION = '1.0.1';
export const APP_BUILD = 'Build 1';
export const APP_RELEASE_NAME = `Mariner Pro-Link v${APP_VERSION}`;
export const APP_BUILD_DATE = 'October 2026';
export const APP_CHANGELOG_HIGHLIGHTS = [
  'Deep Zoom up to 2,500,000x for harbors, docks & tactical navigation',
  'Background NMEA 0183 transmission with Screen WakeLock',
  'Navigate HUD: Real-time Speed (SOG) & Distance to First Waypoint',
  'Responsive Fullscreen Map with anti-overflow cache controls',
  'OTG Hardware Serial 5-Month Grace Warning & 6-Month Myket License Engine'
];

/**
 * Local Loopback URL for WebUSB / WebSerial Hardware Driver
 * 100% Offline Local Operation - Served by internal embedded server on port 8080
 */
export function getLocalHardwareMirrorUrl(): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin || '';
    if (origin.startsWith('capacitor:') || (origin.includes('localhost') && !window.location.port)) {
      return 'http://localhost:8080';
    }
    return window.location.href;
  }
  return 'http://localhost:8080';
}

export const WEB_HARDWARE_MIRROR_URL = 'http://localhost:8080';


