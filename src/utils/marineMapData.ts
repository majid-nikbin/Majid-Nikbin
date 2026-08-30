/**
 * Offline Marine World Coastlines, Islands, Cities, Provincial Capitals, Ports,
 * Bathymetry Contours, Soundings, Lighthouses & Traffic Separation Schemes (TSS)
 * High-density offline vector nautical dataset for Persian Gulf, Gulf of Oman,
 * Caspian Sea, Red Sea, Mediterranean, and Global Continents.
 */

export interface LandPolygon {
  name: string;
  points: [number, number][]; // [lon, lat]
}

export interface BathymetryDepthContour {
  depthMeters: number;
  label: string;
  points: [number, number][]; // [lon, lat]
}

export interface MarineSounding {
  lon: number;
  lat: number;
  depthMeters: number;
  type?: 'deep' | 'shelf' | 'shoal' | 'trench';
}

export type PlaceLabelType = 
  | 'provincial_capital' 
  | 'world_city' 
  | 'island' 
  | 'port' 
  | 'coastal_city' 
  | 'strait' 
  | 'sea_label' 
  | 'shoal';

export interface MarinePlaceLabel {
  name: string;
  lon: number;
  lat: number;
  type: PlaceLabelType;
  minZoom: number; // minimum zoom level to display label
  isMajor?: boolean;
}

export interface MarineLighthouse {
  name: string;
  lon: number;
  lat: number;
  character: string; // e.g. "Fl(2) 10s 25M"
  color: 'white' | 'red' | 'green' | 'yellow';
  rangeNm: number;
  flashPeriodSec: number;
}

export interface MarineShippingLane {
  name: string;
  laneType: 'inbound' | 'outbound' | 'separation_zone' | 'fairway';
  points: [number, number][];
  directionDeg?: number;
}

export interface MarineHazard {
  name: string;
  lon: number;
  lat: number;
  depthMeters: number;
  type: 'wreck' | 'shoal' | 'reef' | 'rock';
}

export interface MarineAnchorage {
  name: string;
  lon: number;
  lat: number;
  radiusNm: number;
  type: 'commercial' | 'tanker' | 'general';
}

export interface MarineOilPlatform {
  name: string;
  field: string;
  lon: number;
  lat: number;
  type: 'oil_rig' | 'gas_platform' | 'flair' | 'loading_buoy';
  lights: string; // e.g. "Mo(U) 15s White"
}

export interface MarineBuoy {
  name: string;
  lon: number;
  lat: number;
  buoyType: 'port' | 'starboard' | 'cardinal_north' | 'cardinal_south' | 'cardinal_east' | 'cardinal_west' | 'safe_water' | 'isolated_danger' | 'special';
  lightChar: string; // e.g. "Q.R", "Fl.G.3s", "VQ(6)+LFl.10s", "Iso.4s"
  color: string;
}

export interface SubmarinePipeline {
  name: string;
  type: 'gas_pipeline' | 'oil_pipeline' | 'power_cable' | 'restricted_area';
  points: [number, number][];
}

export interface TidalStreamVector {
  name: string;
  lon: number;
  lat: number;
  bearingDeg: number;
  rateKnots: number;
}

// =========================================================================
// 1. World & Regional Coastlines & Landmass Polygons
// =========================================================================
export const WORLD_LANDMASSES: LandPolygon[] = [
  // Eurasia & Middle East (Detailed North Persian Gulf, Oman, Caspian, Med)
  {
    name: 'Eurasia & Middle East',
    points: [
      [-9.5, 36.0], [-9.0, 39.0], [-9.5, 43.0], [-1.0, 43.5], [5.0, 43.0],
      [3.0, 42.0], [0.0, 40.0], [5.0, 37.0], [10.0, 38.0], [15.0, 38.0],
      [16.0, 41.0], [13.0, 45.5], [15.0, 45.0], [19.0, 42.0], [20.0, 39.5],
      [24.0, 37.0], [26.0, 40.0], [29.0, 41.0], [35.0, 42.0], [40.0, 43.5],
      [44.0, 43.0], [48.0, 42.0], [49.5, 40.0], [50.0, 41.5], [53.0, 40.0], // Caspian West
      [54.0, 37.5], [53.5, 36.8], [52.0, 36.7], [50.0, 37.3], [49.0, 37.5], // Caspian South (Anzali, Nowshahr, Babolsar, Gorgan)
      [48.8, 38.4], [49.5, 40.0],
      [48.0, 36.0], [46.0, 38.0], [44.0, 37.0], [40.0, 37.0], [36.0, 36.0],
      [35.0, 33.0], [34.5, 31.5], [33.0, 31.0], [32.5, 29.5], // Sinai / Red Sea
      [34.5, 28.0], [37.0, 25.0], [40.0, 20.0], [42.5, 16.0], [43.5, 12.5], // Red Sea East (Arabia)
      [45.0, 12.8], [48.0, 14.0], [51.0, 15.5], [54.0, 17.0], [58.0, 20.5], // Arabian Sea / Oman
      [59.5, 22.5], [58.5, 24.0], [56.8, 25.6], [56.3, 26.2], [56.0, 26.4], // Musandam Peninsula
      [55.9, 25.8], [55.3, 25.2], [54.4, 24.5], [52.5, 24.1], [51.6, 24.6], // UAE (Ras Al Khaimah, Dubai, Abu Dhabi)
      [51.2, 25.3], [51.6, 26.1], [50.8, 26.1], [50.7, 25.0], // Qatar Peninsula
      [50.1, 26.4], [48.8, 28.5], [48.3, 29.3], [48.0, 29.9], // Saudi & Kuwait (Kuwait Bay)
      [48.5, 30.0], [48.7, 30.4], [49.1, 30.5], [50.0, 30.1], [50.3, 29.6], // Arvand / Khuzestan (Abadan, Mahshahr, Hendijan, Genaveh)
      [50.8, 29.0], [51.1, 28.5], [51.9, 27.8], [52.3, 27.5], [52.6, 27.1], // Bushehr, Kangan, Asaluyeh, Siraf
      [53.3, 26.9], [53.8, 26.8], [54.3, 26.7], [54.9, 26.5], [55.5, 26.8], // Parsian, Charak, Aftab, Bandar Lengeh, Khamir
      [56.0, 27.1], [56.3, 27.2], [56.8, 27.1], [57.1, 26.8], [57.8, 25.6], // Bandar Abbas, Hormoz Strait, Sirik, Jask
      [58.5, 25.5], [59.5, 25.4], [60.6, 25.3], [61.5, 25.2], [62.0, 25.1], // Makran Coast (Pozm, Konarak, Chabahar, Gwadar)
      [67.0, 24.5], [70.0, 21.0], [73.0, 15.0], [77.5, 8.0],  // India West
      [80.0, 13.0], [85.0, 20.0], [90.0, 22.0], [98.0, 10.0], [100.0, 5.0], // Bay of Bengal / Malacca
      [104.0, 1.2], [108.0, 15.0], [120.0, 30.0], [122.0, 38.0], [130.0, 42.0], // East Asia
      [140.0, 50.0], [160.0, 60.0], [170.0, 65.0], [170.0, 70.0], [100.0, 75.0], // Siberia
      [60.0, 70.0], [40.0, 70.0], [20.0, 70.0], [10.0, 60.0], [5.0, 53.0],
      [-5.0, 48.0], [-9.5, 36.0]
    ]
  },
  // Persian Gulf Key Islands (Detailed coastlines)
  {
    name: 'Kish Island',
    points: [
      [53.90, 26.51], [53.94, 26.56], [54.02, 26.57], [54.08, 26.54],
      [54.07, 26.49], [53.98, 26.48], [53.92, 26.49], [53.90, 26.51]
    ]
  },
  {
    name: 'Qeshm Island',
    points: [
      [55.28, 26.65], [55.50, 26.75], [55.85, 26.90], [56.25, 27.02],
      [56.35, 26.95], [56.10, 26.78], [55.70, 26.62], [55.35, 26.55],
      [55.28, 26.65]
    ]
  },
  {
    name: 'Hormuz Island',
    points: [
      [56.42, 27.08], [56.49, 27.10], [56.52, 27.05], [56.48, 27.00],
      [56.43, 27.02], [56.42, 27.08]
    ]
  },
  {
    name: 'Larak Island',
    points: [
      [56.32, 26.88], [56.41, 26.89], [56.43, 26.83], [56.34, 26.82], [56.32, 26.88]
    ]
  },
  {
    name: 'Hendorabi Island',
    points: [
      [53.60, 26.67], [53.66, 26.68], [53.67, 26.65], [53.61, 26.64], [53.60, 26.67]
    ]
  },
  {
    name: 'Lavan Island',
    points: [
      [53.22, 26.78], [53.38, 26.83], [53.42, 26.80], [53.25, 26.75], [53.22, 26.78]
    ]
  },
  {
    name: 'Shidvar Island',
    points: [
      [53.45, 26.79], [53.48, 26.80], [53.47, 26.78], [53.45, 26.79]
    ]
  },
  {
    name: 'Faror Island',
    points: [
      [54.48, 26.28], [54.54, 26.31], [54.53, 26.26], [54.49, 26.25], [54.48, 26.28]
    ]
  },
  {
    name: 'Bani Faror Island',
    points: [
      [54.43, 26.12], [54.46, 26.13], [54.45, 26.10], [54.43, 26.12]
    ]
  },
  {
    name: 'Siri Island',
    points: [
      [54.49, 25.89], [54.55, 25.92], [54.57, 25.88], [54.51, 25.87], [54.49, 25.89]
    ]
  },
  {
    name: 'Abu Musa Island',
    points: [
      [55.01, 25.86], [55.06, 25.90], [55.07, 25.86], [55.02, 25.85], [55.01, 25.86]
    ]
  },
  {
    name: 'Greater Tunb Island',
    points: [
      [55.28, 26.25], [55.33, 26.27], [55.33, 26.24], [55.29, 26.23], [55.28, 26.25]
    ]
  },
  {
    name: 'Lesser Tunb Island',
    points: [
      [55.15, 26.24], [55.18, 26.25], [55.17, 26.23], [55.15, 26.24]
    ]
  },
  {
    name: 'Kharg Island',
    points: [
      [50.28, 29.21], [50.34, 29.29], [50.35, 29.24], [50.30, 29.20], [50.28, 29.21]
    ]
  },
  {
    name: 'Khargu Island',
    points: [
      [50.34, 29.32], [50.37, 29.36], [50.36, 29.33], [50.34, 29.32]
    ]
  },
  {
    name: 'Farsi Island',
    points: [
      [50.16, 27.98], [50.19, 28.00], [50.18, 27.98], [50.16, 27.98]
    ]
  },
  {
    name: 'Bahrain',
    points: [
      [50.40, 26.00], [50.65, 26.25], [50.62, 25.80], [50.45, 25.90], [50.40, 26.00]
    ]
  },
  // Africa
  {
    name: 'Africa',
    points: [
      [-17.0, 15.0], [-13.0, 9.0], [-5.0, 5.0], [10.0, 4.0], [12.0, -5.0],
      [15.0, -20.0], [18.5, -34.5], [26.0, -33.5], [32.5, -28.0], [40.0, -15.0],
      [41.0, -4.0], [51.0, 10.5], [43.5, 12.5], [40.0, 20.0], [32.5, 29.5],
      [25.0, 32.0], [10.0, 37.0], [0.0, 36.0], [-5.0, 36.0], [-10.0, 30.0],
      [-17.0, 21.0], [-17.0, 15.0]
    ]
  },
  // Americas - North & South
  {
    name: 'North America',
    points: [
      [-168.0, 65.0], [-160.0, 55.0], [-125.0, 48.0], [-120.0, 34.0], [-110.0, 23.0],
      [-97.0, 26.0], [-80.0, 25.0], [-75.0, 35.0], [-65.0, 44.0], [-55.0, 50.0],
      [-65.0, 60.0], [-90.0, 70.0], [-130.0, 70.0], [-168.0, 65.0]
    ]
  },
  {
    name: 'South America',
    points: [
      [-80.0, 8.0], [-77.0, -5.0], [-70.0, -20.0], [-72.0, -45.0], [-68.0, -55.0],
      [-55.0, -35.0], [-35.0, -5.0], [-50.0, 0.0], [-60.0, 10.0], [-75.0, 11.0],
      [-80.0, 8.0]
    ]
  },
  // Australia
  {
    name: 'Australia',
    points: [
      [115.0, -22.0], [115.0, -34.0], [135.0, -35.0], [148.0, -38.0], [153.0, -28.0],
      [145.0, -15.0], [130.0, -12.0], [122.0, -16.0], [115.0, -22.0]
    ]
  },
  {
    name: 'British Isles',
    points: [[-5.0, 50.0], [1.5, 51.5], [0.0, 58.0], [-5.0, 58.5], [-5.0, 50.0]]
  },
  {
    name: 'Japan',
    points: [
      [130.0, 32.0], [135.0, 34.0], [141.0, 38.0], [145.0, 44.0], [140.0, 44.0],
      [132.0, 34.0], [130.0, 32.0]
    ]
  },
  {
    name: 'Madagascar',
    points: [[43.5, -12.0], [50.0, -15.5], [47.5, -25.5], [44.0, -25.0], [43.5, -12.0]]
  },
  {
    name: 'Sri Lanka',
    points: [[79.8, 9.8], [81.8, 8.6], [81.3, 6.0], [79.9, 6.9], [79.8, 9.8]]
  }
];

// =========================================================================
// 2. Comprehensive Place Labels (Provincial Capitals, World Cities, Ports)
// =========================================================================
export const MARINE_PLACE_LABELS: MarinePlaceLabel[] = [
  // --- PROVINCIAL CAPITALS & MAJOR CITIES ---
  { name: 'Tehran', lon: 51.39, lat: 35.69, type: 'provincial_capital', minZoom: 5, isMajor: true },
  { name: 'Isfahan', lon: 51.67, lat: 32.65, type: 'provincial_capital', minZoom: 7, isMajor: true },
  { name: 'Shiraz', lon: 52.54, lat: 29.59, type: 'provincial_capital', minZoom: 7, isMajor: true },
  { name: 'Tabriz', lon: 46.29, lat: 38.08, type: 'provincial_capital', minZoom: 7, isMajor: true },
  { name: 'Mashhad', lon: 59.61, lat: 36.30, type: 'provincial_capital', minZoom: 7, isMajor: true },
  { name: 'Ahvaz', lon: 48.67, lat: 31.32, type: 'provincial_capital', minZoom: 7, isMajor: true },
  { name: 'Bandar Abbas', lon: 56.28, lat: 27.18, type: 'provincial_capital', minZoom: 10, isMajor: true },
  { name: 'Bushehr', lon: 50.84, lat: 28.98, type: 'provincial_capital', minZoom: 10, isMajor: true },
  { name: 'Kerman', lon: 57.08, lat: 30.28, type: 'provincial_capital', minZoom: 7 },
  { name: 'Yazd', lon: 54.36, lat: 31.89, type: 'provincial_capital', minZoom: 7 },
  { name: 'Rasht', lon: 49.58, lat: 37.28, type: 'provincial_capital', minZoom: 8 },
  { name: 'Sari', lon: 53.06, lat: 36.57, type: 'provincial_capital', minZoom: 8 },
  { name: 'Gorgan', lon: 54.43, lat: 36.84, type: 'provincial_capital', minZoom: 8 },
  { name: 'Zahedan', lon: 60.86, lat: 29.50, type: 'provincial_capital', minZoom: 7 },
  { name: 'Kermanshah', lon: 47.07, lat: 34.31, type: 'provincial_capital', minZoom: 8 },
  { name: 'Hamadan', lon: 48.51, lat: 34.80, type: 'provincial_capital', minZoom: 8 },
  { name: 'Sanandaj', lon: 46.99, lat: 35.31, type: 'provincial_capital', minZoom: 8 },
  { name: 'Urmia', lon: 45.07, lat: 37.55, type: 'provincial_capital', minZoom: 8 },
  { name: 'Qom', lon: 50.88, lat: 34.64, type: 'provincial_capital', minZoom: 8 },
  { name: 'Qazvin', lon: 50.00, lat: 36.27, type: 'provincial_capital', minZoom: 8 },
  { name: 'Zanjan', lon: 48.48, lat: 36.67, type: 'provincial_capital', minZoom: 8 },
  { name: 'Arak', lon: 49.69, lat: 34.09, type: 'provincial_capital', minZoom: 8 },
  { name: 'Khorramabad', lon: 48.35, lat: 33.49, type: 'provincial_capital', minZoom: 8 },
  { name: 'Ilam', lon: 46.42, lat: 33.64, type: 'provincial_capital', minZoom: 8 },
  { name: 'Semnan', lon: 53.39, lat: 35.58, type: 'provincial_capital', minZoom: 8 },
  { name: 'Birjand', lon: 59.22, lat: 32.87, type: 'provincial_capital', minZoom: 8 },
  { name: 'Bojnord', lon: 57.33, lat: 37.47, type: 'provincial_capital', minZoom: 8 },
  { name: 'Yasuj', lon: 51.59, lat: 30.67, type: 'provincial_capital', minZoom: 8 },
  { name: 'Shahrekord', lon: 50.86, lat: 32.33, type: 'provincial_capital', minZoom: 8 },
  { name: 'Chabahar', lon: 60.64, lat: 25.29, type: 'port', minZoom: 10, isMajor: true },

  // --- MAJOR GLOBAL METROPOLISES & REGIONAL CAPITALS ---
  { name: 'Dubai', lon: 55.27, lat: 25.20, type: 'world_city', minZoom: 6, isMajor: true },
  { name: 'Abu Dhabi', lon: 54.37, lat: 24.45, type: 'world_city', minZoom: 7, isMajor: true },
  { name: 'Doha', lon: 51.53, lat: 25.28, type: 'world_city', minZoom: 7, isMajor: true },
  { name: 'Manama', lon: 50.58, lat: 26.22, type: 'world_city', minZoom: 8, isMajor: true },
  { name: 'Kuwait City', lon: 47.98, lat: 29.38, type: 'world_city', minZoom: 7, isMajor: true },
  { name: 'Muscat', lon: 58.54, lat: 23.58, type: 'world_city', minZoom: 7, isMajor: true },
  { name: 'Riyadh', lon: 46.72, lat: 24.69, type: 'world_city', minZoom: 6, isMajor: true },
  { name: 'Jeddah', lon: 39.17, lat: 21.54, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Karachi', lon: 67.01, lat: 24.86, type: 'world_city', minZoom: 6, isMajor: true },
  { name: 'Mumbai', lon: 72.88, lat: 19.07, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'New Delhi', lon: 77.21, lat: 28.61, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Colombo', lon: 79.86, lat: 6.93, type: 'port', minZoom: 5 },
  { name: 'Singapore', lon: 103.82, lat: 1.35, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'Bangkok', lon: 100.50, lat: 13.75, type: 'world_city', minZoom: 5 },
  { name: 'Tokyo', lon: 139.69, lat: 35.69, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'Shanghai', lon: 121.47, lat: 31.23, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'Beijing', lon: 116.41, lat: 39.90, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'Hong Kong', lon: 114.17, lat: 22.32, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Istanbul', lon: 28.98, lat: 41.01, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Cairo', lon: 31.24, lat: 30.04, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Alexandria', lon: 29.92, lat: 31.20, type: 'port', minZoom: 6 },
  { name: 'Suez Port', lon: 32.55, lat: 29.97, type: 'port', minZoom: 7 },
  { name: 'London', lon: -0.13, lat: 51.51, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'Paris', lon: 2.35, lat: 48.86, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'Rotterdam', lon: 4.48, lat: 51.92, type: 'port', minZoom: 5 },
  { name: 'Rome', lon: 12.50, lat: 41.90, type: 'world_city', minZoom: 5 },
  { name: 'Moscow', lon: 37.62, lat: 55.75, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'New York', lon: -74.01, lat: 40.71, type: 'world_city', minZoom: 3, isMajor: true },
  { name: 'Los Angeles', lon: -118.24, lat: 34.05, type: 'world_city', minZoom: 3 },
  { name: 'Sydney', lon: 151.21, lat: -33.87, type: 'world_city', minZoom: 3 },
  { name: 'Cape Town', lon: 18.42, lat: -33.92, type: 'world_city', minZoom: 4 },

  // --- PERSIAN GULF KEY ISLANDS ---
  { name: 'Kish Island', lon: 53.99, lat: 26.53, type: 'island', minZoom: 12, isMajor: true },
  { name: 'Qeshm Island', lon: 55.90, lat: 26.85, type: 'island', minZoom: 12, isMajor: true },
  { name: 'Hormuz Island', lon: 56.46, lat: 27.05, type: 'island', minZoom: 18 },
  { name: 'Larak Island', lon: 56.36, lat: 26.85, type: 'island', minZoom: 18 },
  { name: 'Hendorabi Island', lon: 53.64, lat: 26.66, type: 'island', minZoom: 18 },
  { name: 'Lavan Island', lon: 53.32, lat: 26.80, type: 'island', minZoom: 18 },
  { name: 'Shidvar Island', lon: 53.46, lat: 26.79, type: 'island', minZoom: 28 },
  { name: 'Faror Island', lon: 54.50, lat: 26.28, type: 'island', minZoom: 20 },
  { name: 'Bani Faror', lon: 54.44, lat: 26.11, type: 'island', minZoom: 30 },
  { name: 'Siri Island', lon: 54.53, lat: 25.90, type: 'island', minZoom: 20 },
  { name: 'Abu Musa Island', lon: 55.04, lat: 25.88, type: 'island', minZoom: 20 },
  { name: 'Greater Tunb', lon: 55.30, lat: 26.25, type: 'island', minZoom: 20 },
  { name: 'Lesser Tunb', lon: 55.16, lat: 26.24, type: 'island', minZoom: 25 },
  { name: 'Kharg Island', lon: 50.31, lat: 29.24, type: 'island', minZoom: 18 },
  { name: 'Khargu Island', lon: 50.35, lat: 29.34, type: 'island', minZoom: 30 },
  { name: 'Farsi Island', lon: 50.17, lat: 27.99, type: 'island', minZoom: 25 },
  { name: 'Hengam Island', lon: 55.88, lat: 26.63, type: 'island', minZoom: 20 },

  // --- KEY COASTAL PORTS & HARBORS ---
  { name: 'Shahid Rajaee Port', lon: 56.06, lat: 27.10, type: 'port', minZoom: 20, isMajor: true },
  { name: 'Bandar Lengeh', lon: 54.88, lat: 26.55, type: 'port', minZoom: 15 },
  { name: 'Bandar Charak', lon: 54.27, lat: 26.73, type: 'port', minZoom: 20 },
  { name: 'Bandar Aftab', lon: 53.95, lat: 26.71, type: 'port', minZoom: 22 },
  { name: 'Bandar Chiruyeh', lon: 53.73, lat: 26.70, type: 'port', minZoom: 25 },
  { name: 'Bandar Moqam', lon: 53.48, lat: 26.97, type: 'port', minZoom: 25 },
  { name: 'Parsian Port', lon: 53.04, lat: 27.01, type: 'coastal_city', minZoom: 20 },
  { name: 'Asaluyeh Port', lon: 52.61, lat: 27.48, type: 'port', minZoom: 15, isMajor: true },
  { name: 'Nakhl Taqi', lon: 52.58, lat: 27.50, type: 'port', minZoom: 24 },
  { name: 'Kangan', lon: 52.06, lat: 27.83, type: 'coastal_city', minZoom: 20 },
  { name: 'Siraf Port', lon: 52.34, lat: 27.67, type: 'port', minZoom: 25 },
  { name: 'Deyyer Port', lon: 51.94, lat: 27.84, type: 'port', minZoom: 20 },
  { name: 'Bordekhoon', lon: 51.48, lat: 28.06, type: 'coastal_city', minZoom: 25 },
  { name: 'Lavar Coastal Pier', lon: 51.27, lat: 28.45, type: 'port', minZoom: 26 },
  { name: 'Bandar Genaveh', lon: 50.51, lat: 29.58, type: 'port', minZoom: 18 },
  { name: 'Bandar Deylam', lon: 50.16, lat: 30.05, type: 'port', minZoom: 20 },
  { name: 'Bandar Rig', lon: 50.64, lat: 29.49, type: 'port', minZoom: 24 },
  { name: 'Bandar Mahshahr', lon: 49.19, lat: 30.56, type: 'port', minZoom: 18 },
  { name: 'Bandar Imam Khomeini', lon: 49.08, lat: 30.43, type: 'port', minZoom: 18 },
  { name: 'Khorramshahr Port', lon: 48.18, lat: 30.43, type: 'port', minZoom: 18 },
  { name: 'Abadan Port', lon: 48.30, lat: 30.33, type: 'port', minZoom: 18 },
  { name: 'Arvandkenar Pier', lon: 48.53, lat: 30.03, type: 'port', minZoom: 24 },
  { name: 'Bandar Pol', lon: 55.73, lat: 26.98, type: 'port', minZoom: 22 },
  { name: 'Bandar Khamir', lon: 55.59, lat: 26.95, type: 'port', minZoom: 22 },
  { name: 'Laft Port (Qeshm)', lon: 55.77, lat: 26.90, type: 'port', minZoom: 22 },
  { name: 'Bandar Sirik', lon: 57.08, lat: 26.51, type: 'port', minZoom: 22 },
  { name: 'Bandar Jask', lon: 57.77, lat: 25.64, type: 'port', minZoom: 18 },
  { name: 'Pozm Bay', lon: 60.18, lat: 25.35, type: 'port', minZoom: 22 },
  { name: 'Konarak', lon: 60.40, lat: 25.36, type: 'port', minZoom: 20 },
  { name: 'Ramin Port', lon: 60.75, lat: 25.27, type: 'port', minZoom: 24 },
  { name: 'Beris Fishing Port', lon: 61.18, lat: 25.14, type: 'port', minZoom: 22 },
  { name: 'Pasabandar (Gwadar Bay)', lon: 61.42, lat: 25.07, type: 'port', minZoom: 22 },
  { name: 'Bandar Anzali', lon: 49.46, lat: 37.47, type: 'port', minZoom: 15 },
  { name: 'Astara Port', lon: 48.88, lat: 38.43, type: 'port', minZoom: 18 },
  { name: 'Nowshahr Port', lon: 51.50, lat: 36.65, type: 'port', minZoom: 18 },
  { name: 'Babolsar Port', lon: 52.65, lat: 36.71, type: 'port', minZoom: 20 },
  { name: 'Amirabad Port', lon: 53.37, lat: 36.85, type: 'port', minZoom: 18 },
  { name: 'Bandar Turkmen', lon: 54.04, lat: 36.90, type: 'port', minZoom: 20 },
  { name: 'Sharjah', lon: 55.40, lat: 25.35, type: 'coastal_city', minZoom: 20 },
  { name: 'Ras Al Khaimah', lon: 55.94, lat: 25.80, type: 'port', minZoom: 20 },
  { name: 'Fujairah Port', lon: 56.35, lat: 25.12, type: 'port', minZoom: 18, isMajor: true },
  { name: 'Khor Fakkan Port', lon: 56.36, lat: 25.35, type: 'port', minZoom: 20 },
  { name: 'Dammam Port', lon: 50.10, lat: 26.43, type: 'port', minZoom: 18 },
  { name: 'Jubail Industrial Port', lon: 49.65, lat: 27.01, type: 'port', minZoom: 18 },
  { name: 'Ras Laffan Gas Terminal', lon: 51.56, lat: 25.92, type: 'port', minZoom: 18 },
  { name: 'Sohar Port', lon: 56.74, lat: 24.36, type: 'port', minZoom: 20 },

  // --- SEAS & STRAITS ---
  { name: 'PERSIAN GULF', lon: 52.00, lat: 26.80, type: 'sea_label', minZoom: 4 },
  { name: 'STRAIT OF HORMUZ', lon: 56.40, lat: 26.55, type: 'strait', minZoom: 12 },
  { name: 'GULF OF OMAN', lon: 59.00, lat: 24.50, type: 'sea_label', minZoom: 4 },
  { name: 'CASPIAN SEA', lon: 51.50, lat: 39.00, type: 'sea_label', minZoom: 4 },
  { name: 'RED SEA', lon: 38.00, lat: 20.00, type: 'sea_label', minZoom: 4 },
  { name: 'MEDITERRANEAN SEA', lon: 18.00, lat: 35.00, type: 'sea_label', minZoom: 4 },
  { name: 'ARABIAN SEA', lon: 65.00, lat: 18.00, type: 'sea_label', minZoom: 4 },
  { name: 'INDIAN OCEAN', lon: 75.00, lat: 0.00, type: 'sea_label', minZoom: 3 }
];

// =========================================================================
// 3. Marine Lighthouses & Navigation Aids
// =========================================================================
export const MARINE_LIGHTHOUSES: MarineLighthouse[] = [
  { name: 'Kish East Light', lon: 54.04, lat: 26.54, character: 'Fl(2) 10s 25M', color: 'white', rangeNm: 25, flashPeriodSec: 10 },
  { name: 'Kish West Point', lon: 53.91, lat: 26.50, character: 'Fl W 5s 18M', color: 'white', rangeNm: 18, flashPeriodSec: 5 },
  { name: 'Qeshm Island Light', lon: 56.27, lat: 27.00, character: 'Fl(3) 15s 22M', color: 'white', rangeNm: 22, flashPeriodSec: 15 },
  { name: 'Hormuz Island Light', lon: 56.48, lat: 27.07, character: 'Fl W 8s 20M', color: 'white', rangeNm: 20, flashPeriodSec: 8 },
  { name: 'Larak Island Light', lon: 56.38, lat: 26.85, character: 'Fl(2) 12s 24M', color: 'white', rangeNm: 24, flashPeriodSec: 12 },
  { name: 'Faror Island Light', lon: 54.51, lat: 26.29, character: 'Fl(4) 20s 25M', color: 'white', rangeNm: 25, flashPeriodSec: 20 },
  { name: 'Lavan Island Light', lon: 53.30, lat: 26.81, character: 'Fl W 6s 19M', color: 'white', rangeNm: 19, flashPeriodSec: 6 },
  { name: 'Hendorabi Light', lon: 53.66, lat: 26.67, character: 'Fl(2) 8s 16M', color: 'white', rangeNm: 16, flashPeriodSec: 8 },
  { name: 'Abu Musa Light', lon: 55.05, lat: 25.88, character: 'Fl W 5s 20M', color: 'white', rangeNm: 20, flashPeriodSec: 5 },
  { name: 'Greater Tunb Light', lon: 55.31, lat: 26.26, character: 'Fl(2) 10s 22M', color: 'white', rangeNm: 22, flashPeriodSec: 10 },
  { name: 'Bushehr Harbor Light', lon: 50.82, lat: 28.99, character: 'Fl(2) W 15s 23M', color: 'white', rangeNm: 23, flashPeriodSec: 15 },
  { name: 'Kharg Island Light', lon: 50.32, lat: 29.26, character: 'Fl W 10s 26M', color: 'white', rangeNm: 26, flashPeriodSec: 10 },
  { name: 'Asaluyeh Port Light', lon: 52.60, lat: 27.46, character: 'Fl G 4s 12M', color: 'green', rangeNm: 12, flashPeriodSec: 4 },
  { name: 'Ras Al Khaimah Light', lon: 55.95, lat: 25.82, character: 'Fl W 5s 18M', color: 'white', rangeNm: 18, flashPeriodSec: 5 },
  { name: 'Mina Rashid Light (Dubai)', lon: 55.26, lat: 25.26, character: 'Fl(3) 12s 20M', color: 'white', rangeNm: 20, flashPeriodSec: 12 },
  { name: 'Fujairah Breakwater Light', lon: 56.36, lat: 25.14, character: 'Fl G 5s 15M', color: 'green', rangeNm: 15, flashPeriodSec: 5 },
  { name: 'Chabahar Fairway Light', lon: 60.62, lat: 25.28, character: 'Fl(2) W 10s 20M', color: 'white', rangeNm: 20, flashPeriodSec: 10 },
  { name: 'Bandar Anzali Light', lon: 49.46, lat: 37.48, character: 'Fl(2) G 8s 14M', color: 'green', rangeNm: 14, flashPeriodSec: 8 }
];

// =========================================================================
// 4. Traffic Separation Schemes (TSS) & Shipping Fairways
// =========================================================================
export const SHIPPING_LANES_TSS: MarineShippingLane[] = [
  // Strait of Hormuz Inbound Lane (Entering Persian Gulf from Oman Sea)
  {
    name: 'Hormuz Inbound Lane (TSS)',
    laneType: 'inbound',
    directionDeg: 285,
    points: [
      [56.80, 26.10], [56.55, 26.35], [56.25, 26.48], [55.80, 26.45], [55.20, 26.40], [54.50, 26.45]
    ]
  },
  // Strait of Hormuz Outbound Lane (Exiting Persian Gulf to Oman Sea)
  {
    name: 'Hormuz Outbound Lane (TSS)',
    laneType: 'outbound',
    directionDeg: 105,
    points: [
      [54.50, 26.65], [55.20, 26.60], [55.80, 26.65], [56.30, 26.68], [56.65, 26.50], [56.95, 26.25]
    ]
  },
  // Separation Zone
  {
    name: 'Hormuz TSS Separation Zone',
    laneType: 'separation_zone',
    points: [
      [54.50, 26.55], [55.20, 26.50], [55.80, 26.55], [56.28, 26.58], [56.60, 26.42], [56.88, 26.18]
    ]
  },
  // Persian Gulf Central Deepwater Tanker Fairway (Kish / Faror / Kharg Corridor)
  {
    name: 'Persian Gulf Central Tanker Route',
    laneType: 'fairway',
    directionDeg: 300,
    points: [
      [54.50, 26.50], [53.80, 26.90], [52.80, 27.50], [51.50, 28.30], [50.50, 29.00], [49.20, 29.80]
    ]
  }
];

// =========================================================================
// 5. Marine Anchorages & Recommended Anchorage Zones
// =========================================================================
export const MARINE_ANCHORAGES: MarineAnchorage[] = [
  { name: 'Kish Commercial Anchorage', lon: 54.03, lat: 26.58, radiusNm: 1.5, type: 'commercial' },
  { name: 'Shahid Rajaee Outer Anchorage', lon: 56.05, lat: 27.05, radiusNm: 2.5, type: 'commercial' },
  { name: 'Bandar Abbas Naval & General Anchorage', lon: 56.25, lat: 27.12, radiusNm: 2.0, type: 'general' },
  { name: 'Bushehr Outer Anchorage', lon: 50.78, lat: 28.95, radiusNm: 2.0, type: 'commercial' },
  { name: 'Kharg Oil Terminal Waiting Area', lon: 50.38, lat: 29.22, radiusNm: 3.0, type: 'tanker' },
  { name: 'Asaluyeh Gas Carrier Anchorage', lon: 52.55, lat: 27.42, radiusNm: 2.5, type: 'tanker' },
  { name: 'Fujairah Offshore Bunker Anchorage', lon: 56.45, lat: 25.20, radiusNm: 4.0, type: 'tanker' },
  { name: 'Dubai Drydocks & Outer Anchorage', lon: 55.22, lat: 25.28, radiusNm: 2.5, type: 'commercial' }
];

// =========================================================================
// 6. Marine Hazards, Shoals & Submerged Obstructions
// =========================================================================
export const MARINE_HAZARDS: MarineHazard[] = [
  { name: 'Faror Shoal (3.8m)', lon: 54.42, lat: 26.24, depthMeters: 3.8, type: 'shoal' },
  { name: 'Nayband Submerged Reef', lon: 52.62, lat: 27.35, depthMeters: 2.1, type: 'reef' },
  { name: 'Kish South Coral Bank', lon: 53.98, lat: 26.47, depthMeters: 4.2, type: 'reef' },
  { name: 'Hendorabi Reef Edge', lon: 53.59, lat: 26.65, depthMeters: 2.8, type: 'reef' },
  { name: 'Bushehr Coastal Shallows', lon: 50.80, lat: 29.05, depthMeters: 3.5, type: 'shoal' },
  { name: 'Sirri Submerged Rock', lon: 54.48, lat: 25.86, depthMeters: 4.0, type: 'rock' }
];

// =========================================================================
// 7. High-Resolution Bathymetry Depth Contours for Marine Navigation
// =========================================================================
export const BATHYMETRY_CONTOURS: BathymetryDepthContour[] = [
  // 5m Coastal Very Shallow Shoreline Contour
  {
    depthMeters: 5,
    label: '5m Coastal Very Shallow',
    points: [
      [48.5, 30.0], [49.2, 30.3], [50.1, 29.8], [50.8, 29.1], [51.3, 28.3],
      [52.2, 27.6], [53.3, 26.8], [54.0, 26.7], [54.8, 26.7], [55.6, 27.1],
      [56.3, 27.1], [56.1, 26.9], [55.3, 26.3], [54.2, 25.6], [52.6, 24.9],
      [51.6, 25.9], [50.3, 26.9], [48.5, 30.0]
    ]
  },
  // Persian Gulf Coastal Shelf (10m - 20m)
  {
    depthMeters: 10,
    label: '10m Coastal Depth',
    points: [
      [48.6, 29.9], [49.5, 30.1], [50.2, 29.7], [50.9, 28.9], [51.5, 28.1],
      [52.4, 27.4], [53.5, 26.7], [54.2, 26.6], [55.0, 26.6], [55.8, 27.0],
      [56.4, 27.0], [56.2, 26.8], [55.4, 26.2], [54.4, 25.5], [52.8, 24.8],
      [51.8, 25.8], [50.5, 26.8], [48.6, 29.9]
    ]
  },
  {
    depthMeters: 20,
    label: '20m Coastal Shelf',
    points: [
      [48.8, 29.8], [49.8, 29.4], [51.2, 28.2], [52.8, 27.2], [53.7, 26.5],
      [54.6, 26.3], [55.5, 26.4], [56.2, 26.6], [56.4, 26.0], [54.8, 25.3],
      [52.0, 24.8], [50.8, 26.5], [48.8, 29.8]
    ]
  },
  // Persian Gulf Deep Navigation Channel (40m - 80m)
  {
    depthMeters: 50,
    label: '50m Navigation Channel',
    points: [
      [49.4, 29.2], [50.5, 28.6], [51.8, 27.6], [53.2, 26.8], [54.2, 26.3],
      [55.2, 26.1], [55.9, 26.3], [55.5, 25.8], [53.8, 25.8], [51.5, 26.8],
      [49.4, 29.2]
    ]
  },
  {
    depthMeters: 80,
    label: '80m Deep Trench (Hormuz Channel)',
    points: [
      [52.8, 27.0], [53.8, 26.6], [54.6, 26.3], [55.5, 26.3], [56.2, 26.4],
      [56.5, 26.2], [55.8, 26.0], [54.5, 26.0], [53.5, 26.3], [52.8, 27.0]
    ]
  },
  // Gulf of Oman Deep Continental Shelf (200m - 2000m)
  {
    depthMeters: 200,
    label: '200m Continental Edge',
    points: [
      [56.8, 25.8], [58.0, 25.0], [60.5, 24.5], [63.0, 24.0],
      [64.0, 23.0], [60.0, 23.5], [58.5, 24.2], [57.2, 25.2],
      [56.8, 25.8]
    ]
  },
  {
    depthMeters: 1000,
    label: '1000m Oceanic Abyss',
    points: [
      [57.5, 24.8], [59.0, 24.2], [62.0, 23.8], [65.0, 22.0],
      [62.0, 21.0], [58.8, 22.8], [57.5, 24.8]
    ]
  },
  // Caspian Sea Deep Basins
  {
    depthMeters: 100,
    label: '100m Caspian Slope',
    points: [
      [49.5, 38.0], [51.0, 38.2], [52.5, 37.8], [53.2, 37.3],
      [52.0, 37.0], [50.0, 37.4], [49.5, 38.0]
    ]
  },
  {
    depthMeters: 500,
    label: '500m Caspian Abyss',
    points: [
      [50.5, 38.6], [51.8, 38.8], [52.2, 38.0], [51.0, 37.8], [50.5, 38.6]
    ]
  }
];

// =========================================================================
// 8. High-Density Nautical Depth Soundings (in meters)
// =========================================================================
export const NAUTICAL_SOUNDINGS: MarineSounding[] = [
  // Kish Island & Charak / Lengeh Waters
  { lon: 53.90, lat: 26.60, depthMeters: 28, type: 'shelf' },
  { lon: 53.95, lat: 26.65, depthMeters: 22, type: 'shelf' },
  { lon: 54.02, lat: 26.62, depthMeters: 24, type: 'shelf' },
  { lon: 54.12, lat: 26.54, depthMeters: 38, type: 'shelf' },
  { lon: 54.05, lat: 26.45, depthMeters: 46, type: 'deep' },
  { lon: 53.92, lat: 26.42, depthMeters: 52, type: 'deep' },
  { lon: 53.80, lat: 26.50, depthMeters: 48, type: 'deep' },
  { lon: 54.20, lat: 26.58, depthMeters: 42, type: 'deep' },
  { lon: 54.40, lat: 26.60, depthMeters: 58, type: 'deep' },
  { lon: 54.60, lat: 26.58, depthMeters: 64, type: 'deep' },
  { lon: 54.80, lat: 26.52, depthMeters: 34, type: 'shelf' },
  { lon: 54.86, lat: 26.54, depthMeters: 16, type: 'shoal' },

  // Hendorabi & Lavan waters
  { lon: 53.60, lat: 26.72, depthMeters: 19, type: 'shelf' },
  { lon: 53.65, lat: 26.60, depthMeters: 42, type: 'deep' },
  { lon: 53.30, lat: 26.85, depthMeters: 14, type: 'shoal' },
  { lon: 53.35, lat: 26.70, depthMeters: 56, type: 'deep' },
  { lon: 53.10, lat: 26.75, depthMeters: 62, type: 'deep' },

  // Faror, Siri, Abu Musa & Tunbs Waters
  { lon: 54.50, lat: 26.35, depthMeters: 68, type: 'deep' },
  { lon: 54.52, lat: 26.18, depthMeters: 74, type: 'deep' },
  { lon: 54.55, lat: 25.80, depthMeters: 58, type: 'deep' },
  { lon: 55.05, lat: 25.95, depthMeters: 64, type: 'deep' },
  { lon: 55.30, lat: 26.32, depthMeters: 78, type: 'deep' },
  { lon: 55.18, lat: 26.30, depthMeters: 82, type: 'deep' },

  // Qeshm Island & Strait of Hormuz Waters
  { lon: 55.35, lat: 26.60, depthMeters: 42, type: 'deep' },
  { lon: 55.60, lat: 26.55, depthMeters: 68, type: 'deep' },
  { lon: 55.80, lat: 26.65, depthMeters: 76, type: 'deep' },
  { lon: 56.10, lat: 26.80, depthMeters: 62, type: 'deep' },
  { lon: 56.30, lat: 27.05, depthMeters: 18, type: 'shoal' },
  { lon: 56.25, lat: 27.12, depthMeters: 12, type: 'shoal' },
  { lon: 56.40, lat: 26.92, depthMeters: 88, type: 'deep' },
  { lon: 56.55, lat: 26.70, depthMeters: 96, type: 'deep' },
  { lon: 56.45, lat: 26.40, depthMeters: 104, type: 'deep' },
  { lon: 56.65, lat: 26.25, depthMeters: 118, type: 'deep' },

  // Bushehr, Asaluyeh & Northern Persian Gulf
  { lon: 52.60, lat: 27.42, depthMeters: 28, type: 'shelf' },
  { lon: 52.40, lat: 27.35, depthMeters: 54, type: 'deep' },
  { lon: 51.90, lat: 27.75, depthMeters: 36, type: 'shelf' },
  { lon: 50.80, lat: 28.90, depthMeters: 18, type: 'shoal' },
  { lon: 50.40, lat: 29.10, depthMeters: 38, type: 'shelf' },
  { lon: 50.30, lat: 29.30, depthMeters: 15, type: 'shoal' },
  { lon: 49.20, lat: 29.60, depthMeters: 19, type: 'shoal' },
  { lon: 48.80, lat: 29.90, depthMeters: 11, type: 'shoal' },

  // Gulf of Oman (Makran Trench & Continental Slope)
  { lon: 57.20, lat: 25.60, depthMeters: 210, type: 'deep' },
  { lon: 57.80, lat: 25.50, depthMeters: 450, type: 'deep' },
  { lon: 58.50, lat: 25.00, depthMeters: 850, type: 'deep' },
  { lon: 59.80, lat: 24.60, depthMeters: 1420, type: 'trench' },
  { lon: 60.60, lat: 25.10, depthMeters: 85, type: 'shelf' },
  { lon: 60.65, lat: 25.26, depthMeters: 16, type: 'shoal' },
  { lon: 61.50, lat: 24.80, depthMeters: 1850, type: 'trench' },
  { lon: 63.00, lat: 24.00, depthMeters: 2600, type: 'trench' },

  // Caspian Sea
  { lon: 50.20, lat: 37.60, depthMeters: 35, type: 'shoal' },
  { lon: 51.00, lat: 38.50, depthMeters: 450, type: 'deep' },
  { lon: 52.00, lat: 37.80, depthMeters: 680, type: 'deep' },
  { lon: 53.50, lat: 37.00, depthMeters: 42, type: 'shelf' }
];

// =========================================================================
// 9. Offshore Oil & Gas Platforms
// =========================================================================
export const MARINE_OIL_PLATFORMS: MarineOilPlatform[] = [
  // South Pars Gas Field Complex
  { name: 'South Pars SPD-1', field: 'South Pars', lon: 52.12, lat: 27.22, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 2/3', field: 'South Pars', lon: 52.20, lat: 27.15, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 4/5', field: 'South Pars', lon: 52.32, lat: 27.08, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 12 (Deep)', field: 'South Pars', lon: 52.48, lat: 26.92, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 14', field: 'South Pars', lon: 52.38, lat: 26.85, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Flare Complex', field: 'South Pars', lon: 52.25, lat: 27.18, type: 'flair', lights: 'Continuous Flare' },

  // Salman Oil & Gas Complex
  { name: 'Salman 2DP Complex', field: 'Salman Field', lon: 53.33, lat: 25.88, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Salman KPP Platform', field: 'Salman Field', lon: 53.38, lat: 25.92, type: 'gas_platform', lights: 'Mo(U) 15s White' },

  // Siri Island Oil Fields
  { name: 'Siri A Platform', field: 'Siri Field', lon: 54.52, lat: 25.88, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Siri C & D Complex', field: 'Siri Field', lon: 54.45, lat: 25.82, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Nosrat Platform', field: 'Siri Field', lon: 54.38, lat: 25.75, type: 'oil_rig', lights: 'Mo(U) 15s White' },

  // Reshadat & Resalat
  { name: 'Reshadat Complex', field: 'Reshadat Field', lon: 53.82, lat: 25.90, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Resalat Platform', field: 'Resalat Field', lon: 53.88, lat: 25.85, type: 'oil_rig', lights: 'Mo(U) 15s White' },

  // Foroozan & Aboozar
  { name: 'Foroozan F-18 Rig', field: 'Foroozan Field', lon: 50.25, lat: 29.25, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Foroozan Living Quarters', field: 'Foroozan Field', lon: 50.28, lat: 29.28, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Aboozar Complex (AA/AB)', field: 'Aboozar Field', lon: 50.15, lat: 29.35, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Nowruz Platform', field: 'Nowruz Field', lon: 49.88, lat: 29.52, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Soroush Oil Platform', field: 'Soroush Field', lon: 49.70, lat: 29.10, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Dorood 1 & 2 Offshore', field: 'Dorood Field', lon: 50.38, lat: 29.28, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Kharg Sea Island SPM', field: 'Kharg Terminal', lon: 50.36, lat: 29.21, type: 'loading_buoy', lights: 'Q.Fl.W' },

  // Qatar North Field Platforms
  { name: 'North Field Alpha (Qatar)', field: 'North Field', lon: 51.80, lat: 26.35, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'Al-Shaheen Platform', field: 'Al-Shaheen', lon: 51.92, lat: 26.55, type: 'oil_rig', lights: 'Mo(U) 15s White' }
];

// =========================================================================
// 10. Navigation Buoys & Aids (IALA Buoyage System)
// =========================================================================
export const MARINE_BUOYS: MarineBuoy[] = [
  // Kish Island Approach Buoys
  { name: 'Kish Fairway Safe Water', lon: 54.02, lat: 26.57, buoyType: 'safe_water', lightChar: 'Iso.4s', color: '#ef4444' },
  { name: 'Kish Port Red Can (Port)', lon: 54.018, lat: 26.558, buoyType: 'port', lightChar: 'Q.R', color: '#dc2626' },
  { name: 'Kish Port Green Cone (Stbd)', lon: 54.015, lat: 26.555, buoyType: 'starboard', lightChar: 'Fl.G.3s', color: '#16a34a' },
  { name: 'Kish South Coral Mark', lon: 53.95, lat: 26.48, buoyType: 'cardinal_south', lightChar: 'VQ(6)+LFl.10s', color: '#eab308' },

  // Strait of Hormuz Cardinal & Fairway Buoys
  { name: 'Hormuz North Cardinal Buoy', lon: 56.32, lat: 26.42, buoyType: 'cardinal_north', lightChar: 'VQ.W', color: '#eab308' },
  { name: 'Hormuz South Cardinal Buoy', lon: 56.45, lat: 26.15, buoyType: 'cardinal_south', lightChar: 'VQ(6)+LFl.10s', color: '#eab308' },
  { name: 'Tunb Island Shoal Buoy', lon: 55.28, lat: 26.32, buoyType: 'isolated_danger', lightChar: 'Fl(2).5s', color: '#0f172a' },

  // Rajaee & Bandar Abbas Fairway
  { name: 'Rajaee Port Fairway Buoy', lon: 56.02, lat: 27.02, buoyType: 'safe_water', lightChar: 'Mo(A).8s', color: '#ef4444' },
  { name: 'Rajaee Channel Stbd Buoy No 1', lon: 56.04, lat: 27.06, buoyType: 'starboard', lightChar: 'Fl.G.2.5s', color: '#16a34a' },
  { name: 'Rajaee Channel Port Buoy No 2', lon: 56.05, lat: 27.06, buoyType: 'port', lightChar: 'Fl.R.2.5s', color: '#dc2626' },

  // Bushehr & Asaluyeh Channel Buoys
  { name: 'Bushehr Outer Fairway Buoy', lon: 50.75, lat: 28.98, buoyType: 'safe_water', lightChar: 'LFl.10s', color: '#ef4444' },
  { name: 'Asaluyeh Port Entrance Buoy', lon: 52.55, lat: 27.48, buoyType: 'starboard', lightChar: 'Fl.G.4s', color: '#16a34a' },
  { name: 'Kharg Island West Danger Buoy', lon: 50.28, lat: 29.25, buoyType: 'isolated_danger', lightChar: 'Fl(2).W.6s', color: '#0f172a' },

  // Chabahar Bay
  { name: 'Chabahar Fairway Safe Water', lon: 60.60, lat: 25.30, buoyType: 'safe_water', lightChar: 'Iso.6s', color: '#ef4444' }
];

// =========================================================================
// 11. Submarine Pipelines, Power Cables & Restricted Zones
// =========================================================================
export const SUBMARINE_PIPELINES_AND_CABLES: SubmarinePipeline[] = [
  // South Pars to Asaluyeh Gas Trunklines (32-inch subsea lines)
  {
    name: 'South Pars Subsea Gas Trunkline 1',
    type: 'gas_pipeline',
    points: [
      [52.12, 27.22], [52.25, 27.32], [52.40, 27.40], [52.58, 27.48]
    ]
  },
  {
    name: 'South Pars Subsea Gas Trunkline 2',
    type: 'gas_pipeline',
    points: [
      [52.32, 27.08], [52.42, 27.25], [52.50, 27.38], [52.60, 27.48]
    ]
  },
  // Siri Island to Kish Island Subsea Gas Pipeline
  {
    name: 'Siri-Kish Gas Submarine Pipeline',
    type: 'gas_pipeline',
    points: [
      [54.52, 25.90], [54.30, 26.15], [54.15, 26.35], [54.02, 26.52]
    ]
  },
  // Kharg Island Oil Feed Pipeline Corridor
  {
    name: 'Genaveh-Kharg Subsea Crude Pipeline',
    type: 'oil_pipeline',
    points: [
      [50.51, 29.56], [50.45, 29.45], [50.35, 29.30], [50.32, 29.24]
    ]
  },
  // Bandar Abbas to Qeshm Island Submarine Power Cable
  {
    name: 'Bandar Abbas-Qeshm HV Subsea Cable',
    type: 'power_cable',
    points: [
      [56.12, 27.10], [56.16, 27.02], [56.18, 26.96], [56.20, 26.92]
    ]
  },
  // Restricted Anchoring / Naval Security Zone
  {
    name: 'Bushehr Maritime Protection Zone',
    type: 'restricted_area',
    points: [
      [50.80, 28.90], [50.90, 28.90], [50.90, 28.80], [50.80, 28.80], [50.80, 28.90]
    ]
  }
];

// =========================================================================
// 12. Marine Tidal Stream & Oceanic Current Vectors
// =========================================================================
export const TIDAL_STREAM_VECTORS: TidalStreamVector[] = [
  { name: 'Hormuz Inflow Flood Current', lon: 56.45, lat: 26.35, bearingDeg: 295, rateKnots: 2.8 },
  { name: 'Hormuz Central Deep Stream', lon: 56.15, lat: 26.50, bearingDeg: 285, rateKnots: 2.2 },
  { name: 'Kish South Channel Drift', lon: 53.95, lat: 26.42, bearingDeg: 275, rateKnots: 1.4 },
  { name: 'Faror Channel Tidal Stream', lon: 54.60, lat: 26.20, bearingDeg: 280, rateKnots: 1.8 },
  { name: 'Asaluyeh Coastal Current', lon: 52.40, lat: 27.35, bearingDeg: 305, rateKnots: 1.2 },
  { name: 'Kharg Island Ebb Current', lon: 50.42, lat: 29.18, bearingDeg: 145, rateKnots: 1.6 },
  { name: 'Gulf of Oman Oceanic Inflow', lon: 58.20, lat: 24.80, bearingDeg: 310, rateKnots: 1.8 },
  { name: 'Chabahar Bay Coastal Drift', lon: 60.50, lat: 25.20, bearingDeg: 290, rateKnots: 1.1 },
  { name: 'Caspian Southern Shore Gyre', lon: 51.50, lat: 37.40, bearingDeg: 90, rateKnots: 0.8 }
];

// =========================================================================
// 13. Default Marine Route (Kish Island)
// =========================================================================
export const DEFAULT_SAMPLE_ROUTES = [
  {
    id: 'route_kish_island',
    name: 'Kish Island',
    description: 'Kish Island marine navigation route. Add more waypoints or create new routes.',
    color: '#06b6d4', // Cyan
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    waypoints: [
      {
        id: 'wp_kish_harbor',
        name: 'Kish Port Fairway',
        latitude: 26.5540,
        longitude: 54.0150,
        description: 'Main passenger & commercial port fairway entrance of Kish Island',
        order: 0,
        createdAt: Date.now() - 86400000
      }
    ]
  }
];
