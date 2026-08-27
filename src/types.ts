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
