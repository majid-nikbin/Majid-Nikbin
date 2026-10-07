/**
 * Marine Geographic Utilities & Formatting
 */

/**
 * Format decimal degrees to Marine standard DDM (Degrees Decimal Minutes)
 * e.g., 27.20575 -> 27° 12.345' N
 */
export function formatMarineDDM(val: number | null, isLongitude: boolean): string {
  if (val === null || isNaN(val)) return '--° --.---' + (isLongitude ? ' E' : ' N');
  
  const hemisphere = isLongitude
    ? val >= 0 ? 'E' : 'W'
    : val >= 0 ? 'N' : 'S';
    
  const absVal = Math.abs(val);
  const degrees = Math.floor(absVal);
  const minutes = (absVal - degrees) * 60;
  
  const degPadded = isLongitude
    ? degrees.toString().padStart(3, '0')
    : degrees.toString().padStart(2, '0');
    
  const minFormatted = minutes.toFixed(3).padStart(6, '0');
  
  return `${degPadded}° ${minFormatted}' ${hemisphere}`;
}

/**
 * Format decimal degrees to DMS (Degrees Minutes Seconds)
 * e.g., 27.20575 -> 27° 12' 20.7" N
 */
export function formatMarineDMS(val: number | null, isLongitude: boolean): string {
  if (val === null || isNaN(val)) return `--° --' --.-"` + (isLongitude ? ' E' : ' N');

  const hemisphere = isLongitude
    ? val >= 0 ? 'E' : 'W'
    : val >= 0 ? 'N' : 'S';

  const absVal = Math.abs(val);
  const degrees = Math.floor(absVal);
  const minFull = (absVal - degrees) * 60;
  const minutes = Math.floor(minFull);
  const seconds = (minFull - minutes) * 60;

  const degPadded = isLongitude
    ? degrees.toString().padStart(3, '0')
    : degrees.toString().padStart(2, '0');

  const minPadded = minutes.toString().padStart(2, '0');
  const secFormatted = seconds.toFixed(1).padStart(4, '0');

  return `${degPadded}° ${minPadded}' ${secFormatted}" ${hemisphere}`;
}

/**
 * Format decimal degrees directly
 */
export function formatMarineDD(val: number | null, isLongitude: boolean): string {
  if (val === null || isNaN(val)) return '---.------°';
  const hemisphere = isLongitude ? (val >= 0 ? 'E' : 'W') : (val >= 0 ? 'N' : 'S');
  return `${Math.abs(val).toFixed(6)}° ${hemisphere}`;
}

/**
 * Convert m/s to knots
 */
export function msToKnots(ms: number | null): number | null {
  if (ms === null || isNaN(ms)) return null;
  return ms * 1.943844;
}

/**
 * Convert m/s to km/h
 */
export function msToKmh(ms: number | null): number | null {
  if (ms === null || isNaN(ms)) return null;
  return ms * 3.6;
}

/**
 * Convert heading degree (0-360) into 16-wind cardinal direction abbreviation
 */
export function headingToCardinal(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const cardinals = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return cardinals[index];
}

/**
 * Format heading to 3 digits padded (e.g. 045°, 002°)
 */
export function formatHeadingDeg(deg: number | null): string {
  if (deg === null || isNaN(deg)) return '---°';
  const normalized = ((Math.round(deg) % 360) + 360) % 360;
  return `${normalized.toString().padStart(3, '0')}°`;
}

/**
 * Calculate Great-Circle Distance between two coordinates in Nautical Miles (NM)
 */
export function calculateDistanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3440.065; // Earth radius in nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert Nautical Miles to Kilometers
 */
export function nmToKm(nm: number): number {
  return nm * 1.852;
}

/**
 * Calculate Great-Circle Initial Bearing (0 - 359.9°) from origin to target
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.cos(toRad(lon2 - lon1));

  const bearingRad = Math.atan2(y, x);
  return (toDeg(bearingRad) + 360) % 360;
}

/**
 * Calculate Cross Track Error (XTE) in nautical miles
 * Positive = Right of track, Negative = Left of track
 */
export function calculateXteNm(
  vesselLat: number,
  vesselLon: number,
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const R = 3440.065; // Earth radius in NM
  const toRad = (d: number) => (d * Math.PI) / 180;

  const d13 = calculateDistanceNm(fromLat, fromLon, vesselLat, vesselLon) / R;
  const brg13 = toRad(calculateBearing(fromLat, fromLon, vesselLat, vesselLon));
  const brg12 = toRad(calculateBearing(fromLat, fromLon, toLat, toLon));

  const dXt = Math.asin(Math.sin(d13) * Math.sin(brg13 - brg12));
  return dXt * R;
}

/**
 * Calculate Estimated Time Enroute (TTG) in seconds and ETA timestamp (Unix ms)
 */
export function calculateTtgAndEta(
  distanceNm: number,
  speedKnots: number
): { ttgSeconds: number | null; etaTimestamp: number | null } {
  if (speedKnots < 0.2 || isNaN(speedKnots) || !isFinite(speedKnots)) {
    return { ttgSeconds: null, etaTimestamp: null };
  }

  const hours = distanceNm / speedKnots;
  const seconds = Math.round(hours * 3600);
  const eta = Date.now() + seconds * 1000;

  return {
    ttgSeconds: seconds,
    etaTimestamp: eta,
  };
}

/**
 * Format Time To Go (TTG) into human readable string
 */
export function formatTtg(seconds: number | null): string {
  if (seconds === null || seconds < 0 || isNaN(seconds)) return '--:--:--';
  if (seconds > 86400 * 30) return '> 30 Days';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    return `${days}d ${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format ETA Timestamp into readable clock time and date
 */
export function formatEta(timestamp: number | null): string {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  
  if (isToday) {
    return `${timeStr} (Today)`;
  }
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${timeStr} (${dateStr})`;
}

/**
 * Parse flexible marine coordinate inputs (DD, DDM, DMS, with or without hemisphere letters)
 */
export function parseMarineCoordinate(input: string, isLongitude: boolean = false): number | null {
  if (!input || typeof input !== 'string') return null;
  const clean = input.trim().toUpperCase();

  // Try direct decimal number
  const num = parseFloat(clean);
  if (!isNaN(num) && /^-?\d+(\.\d+)?$/.test(clean)) {
    if (isLongitude && num >= -180 && num <= 180) return num;
    if (!isLongitude && num >= -90 && num <= 90) return num;
  }

  // Detect Hemisphere sign
  let sign = 1;
  if (clean.includes('S') || clean.includes('W') || clean.startsWith('-')) {
    sign = -1;
  }

  // Remove letter suffixes and non-digit separators
  const sanitized = clean.replace(/[NSEW°'"]/g, ' ').trim();
  const parts = sanitized.split(/\s+/).filter(Boolean).map(p => parseFloat(p)).filter(n => !isNaN(n));

  if (parts.length === 1) {
    const val = parts[0] * sign;
    return val;
  } else if (parts.length === 2) {
    // Degrees + Decimal Minutes (DDM: e.g. 26 32.54)
    const deg = parts[0];
    const min = parts[1];
    const val = (deg + (min / 60)) * sign;
    return val;
  } else if (parts.length >= 3) {
    // Degrees + Minutes + Seconds (DMS: e.g. 26 32 30.5)
    const deg = parts[0];
    const min = parts[1];
    const sec = parts[2];
    const val = (deg + (min / 60) + (sec / 3600)) * sign;
    return val;
  }

  return null;
}

