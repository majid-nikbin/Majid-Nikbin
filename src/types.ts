export interface GpsData {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  speedKnots: number | null;
  heading: number | null;
  timestamp: number | null;
}

export interface CompassData {
  magneticHeading: number | null;
  trueHeading: number | null;
  headingAccuracy: number | null;
  pitch: number | null;
  roll: number | null;
}

export interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: number;
}

export interface MarineRoute {
  id: string;
  name: string;
  waypoints: Waypoint[];
  createdAt: number;
}

export interface NavigationSession {
  isNavigating: boolean;
  routeId: string | null;
  targetWaypointId: string | null;
  startTime: number | null;
}

export interface UserTag {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  color?: string;
  createdAt: number;
}

export interface WorkingAreaRecord {
  id: string;
  name: string;
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  savedAt: number;
}

export interface NmeaSentence {
  id: string;
  raw: string;
  timestamp: number;
  type: string;
  talker: string;
}
