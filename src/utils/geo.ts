export function calculateDistanceNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = R * c;
  return km / 1.852; // NM
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180);
  const brg = (Math.atan2(y, x) * 180) / Math.PI;
  return (brg + 360) % 360;
}

export function formatMarineDDM(lat: number | null, lon: number | null): { lat: string; lon: string } {
  if (lat === null || lon === null || isNaN(lat) || isNaN(lon)) {
    return { lat: '--° --.--\' N', lon: '---° --.--\' E' };
  }
  const latHemi = lat >= 0 ? 'N' : 'S';
  const absLat = Math.abs(lat);
  const latDeg = Math.floor(absLat);
  const latMin = ((absLat - latDeg) * 60).toFixed(3);

  const lonHemi = lon >= 0 ? 'E' : 'W';
  const absLon = Math.abs(lon);
  const lonDeg = Math.floor(absLon);
  const lonMin = ((absLon - lonDeg) * 60).toFixed(3);

  return {
    lat: `${String(latDeg).padStart(2, '0')}° ${latMin.padStart(6, '0')}' ${latHemi}`,
    lon: `${String(lonDeg).padStart(3, '0')}° ${lonMin.padStart(6, '0')}' ${lonHemi}`
  };
}

export function formatHeadingDeg(deg: number | null): string {
  if (deg === null || isNaN(deg)) return '---°';
  const clamped = Math.round(((deg % 360) + 360) % 360);
  return `${String(clamped).padStart(3, '0')}°`;
}

export function headingToCardinal(deg: number | null): string {
  if (deg === null || isNaN(deg)) return '--';
  const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return points[idx];
}

export function formatEta(distanceNm: number, speedKnots: number | null): string {
  if (!speedKnots || speedKnots < 0.3) return '--:--';
  const hours = distanceNm / speedKnots;
  if (hours > 99) return '>99h';
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
