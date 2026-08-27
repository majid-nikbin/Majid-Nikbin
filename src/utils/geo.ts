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
