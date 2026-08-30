export type HeadingSource = 'magnetic' | 'gps';

export type CoordFormat = 'DDM' | 'DMS' | 'DD';

export interface GpsData {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null; // in m/s
  speedKnots: number | null; // in knots
  speedKmh: number | null; // in km/h
  heading: number | null; // COG in degrees True
  altitudeAccuracy: number | null;
  timestamp: number;
  fixType: '3D Fix' | '2D Fix' | 'DGPS' | 'Simulated' | 'No Fix';
  satellites: number;
  hdop: number;
}

export interface CompassData {
  magneticHeading: number; // 0 - 359.9°
  trueHeading: number; // 0 - 359.9° (with variation applied)
  pitch: number; // inclination -90 to +90
  roll: number; // roll -180 to +180
  accuracy: number | null; // in degrees
  absolute: boolean;
  calibrated: boolean;
}

export interface NmeaSentenceConfig {
  id: string;
  name: string;
  category: 'heading' | 'gps' | 'time' | 'motion';
  description: string;
  sample: string;
  enabled: boolean;
}

export interface NmeaConfig {
  baudRate: number;
  intervalMs: number; // transmission interval (e.g. 1000ms = 1Hz, 200ms = 5Hz)
  talkerIdGps: 'GP' | 'GN' | 'GA' | 'GL';
  talkerIdHeading: 'HC' | 'HE' | 'HD' | 'II' | 'IN';
  magVariation: number; // East is positive, West is negative
  headingCorrection?: number; // Manual offset added to magnetic heading (e.g. +3.5° or -2.0°)
  activeSentences: Record<string, boolean>;
}

export interface SerialPortStatus {
  connected: boolean;
  portName?: string;
  baudRate: number;
  driverType?: string;
  vendorId?: string;
  productId?: string;
  bytesSent: number;
  bytesReceived: number;
  sentencesSent: number;
  sentencesReceived: number;
  isSimulated: boolean;
  error?: string;
}

export interface NmeaLogEntry {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX';
  raw: string;
  sentenceType: string;
  isValidChecksum: boolean;
  parsedSummary?: string;
}

export interface ParsedNmeaData {
  type: string;
  talker: string;
  timestamp?: string;
  latitude?: string;
  longitude?: string;
  sogKnots?: number;
  cogTrue?: number;
  headingMag?: number;
  headingTrue?: number;
  fixQuality?: string;
  satellites?: number;
  hdop?: number;
  altitudeMeters?: number;
  raw: string;
}

export interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
  order: number;
  createdAt: number;
}

export interface MarineRoute {
  id: string;
  name: string;
  description?: string;
  color: string;
  waypoints: Waypoint[];
  createdAt: number;
  updatedAt: number;
}

export interface NavigationSession {
  isNavigating: boolean;
  isRouteNavigation?: boolean; // true if navigating the entire route in sequence
  routeId: string | null;
  waypointId: string | null;
  targetWaypoint: Waypoint | null;
  previousWaypoint: Waypoint | null;
  currentLegIndex?: number; // 0-based index of active target waypoint in the route
  totalLegs?: number; // total number of waypoints in route
  routeRemainingDistanceNm?: number | null; // distance through current waypoint + subsequent legs
  routeTotalDistanceNm?: number | null; // total distance of whole route
  autoAdvanceEnabled?: boolean; // automatically advance to next waypoint upon arrival
  arrivalRadiusNm?: number; // threshold in NM to trigger arrival (default: 0.08 NM / ~150m)
  distanceNm: number | null;
  distanceKm: number | null;
  bearingDeg: number | null;
  xteNm: number | null; // Cross Track Error
  sogKnots: number | null;
  cogDeg: number | null;
  ttgSeconds: number | null; // Time To Go for current leg
  etaTimestamp: number | null; // Estimated Arrival Unix ms for current leg
  routeEtaTimestamp?: number | null; // Estimated Arrival Unix ms for whole route destination
  startedAt: number | null;
}

