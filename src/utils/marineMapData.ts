// High-Definition Marine Nautical Hydrographic Dataset (S-57 / ENC Standard)

export interface LandPolygon {
  name: string;
  points: [number, number][]; // [lon, lat]
}

export interface BathymetryContour {
  depthMeters: number;
  label: string;
  points: [number, number][];
}

export interface NauticalSounding {
  lon: number;
  lat: number;
  depthMeters: number;
}

export interface MarinePlaceLabel {
  name: string;
  nameFa?: string;
  lon: number;
  lat: number;
  type: 'strait' | 'port' | 'island' | 'bay' | 'channel' | 'anchorage';
  minZoom: number;
}

export interface MarineLighthouse {
  name: string;
  lon: number;
  lat: number;
  character: string;
  rangeNm: number;
  color: string;
}

export interface MarineShippingLane {
  name: string;
  points: [number, number][];
}

export interface MarineBuoy {
  name: string;
  lon: number;
  lat: number;
  buoyType: 'port' | 'starboard' | 'cardinal_north' | 'cardinal_south' | 'cardinal_east' | 'cardinal_west' | 'safe_water';
  color: string;
}

export interface MarineHazard {
  name: string;
  lon: number;
  lat: number;
  type: 'wreck' | 'shoal' | 'reef' | 'rock';
  depthMeters: number;
}

// 1. World & Middle East Landmass Polygons
export const WORLD_LANDMASSES: LandPolygon[] = [
  // Iranian Coastline & Northern Persian Gulf
  {
    name: 'Iran Coastline',
    points: [
      [48.5, 30.0], [49.2, 30.3], [50.1, 29.8], [50.8, 29.0], [51.5, 28.0],
      [52.0, 27.8], [52.6, 27.5], [53.5, 27.0], [54.5, 26.8], [55.5, 26.8],
      [56.28, 27.18], // Bandar Abbas
      [57.0, 26.5], [57.5, 25.8], [58.5, 25.6], [60.5, 25.3], [61.5, 25.1],
      [62.0, 25.2], [62.0, 31.0], [48.0, 31.0], [48.5, 30.0]
    ]
  },
  // Arabian Peninsula & Southern Gulf
  {
    name: 'Arabian Peninsula',
    points: [
      [48.0, 30.0], [48.0, 29.5], [48.5, 29.0], [50.0, 26.5], [50.6, 26.0],
      [51.2, 25.2], [51.6, 24.5], [52.5, 24.2], [54.0, 24.4], [55.2, 25.0],
      [55.9, 25.8], [56.35, 26.2], // Musandam Peninsula
      [56.4, 25.6], [56.8, 24.5], [58.5, 23.6], [59.8, 22.5], [55.0, 16.0],
      [44.0, 12.5], [35.0, 28.0], [45.0, 30.0], [48.0, 30.0]
    ]
  },
  // Qeshm Island
  {
    name: 'Qeshm Island',
    points: [
      [55.25, 26.7], [55.6, 26.8], [56.1, 27.0], [56.3, 27.0], [56.3, 26.9],
      [56.1, 26.75], [55.7, 26.65], [55.3, 26.65], [55.25, 26.7]
    ]
  },
  // Kish Island
  {
    name: 'Kish Island',
    points: [
      [53.95, 26.55], [54.08, 26.56], [54.07, 26.5], [53.96, 26.49], [53.95, 26.55]
    ]
  },
  // Hormuz Island
  {
    name: 'Hormuz Island',
    points: [
      [56.44, 27.08], [56.5, 27.09], [56.51, 27.04], [56.45, 27.03], [56.44, 27.08]
    ]
  },
  // Larak Island
  {
    name: 'Larak Island',
    points: [
      [56.33, 26.87], [56.41, 26.88], [56.41, 26.83], [56.34, 26.83], [56.33, 26.87]
    ]
  },
  // Siri Island
  {
    name: 'Siri Island',
    points: [
      [54.5, 25.92], [54.55, 25.92], [54.55, 25.88], [54.5, 25.88], [54.5, 25.92]
    ]
  },
  // Abu Musa Island
  {
    name: 'Abu Musa Island',
    points: [
      [55.01, 25.9], [55.06, 25.91], [55.05, 25.86], [55.01, 25.86], [55.01, 25.9]
    ]
  },
  // Kharg Island
  {
    name: 'Kharg Island',
    points: [
      [50.29, 29.28], [50.34, 29.29], [50.33, 29.22], [50.29, 29.22], [50.29, 29.28]
    ]
  }
];

export const INLAND_WATER_BODIES: LandPolygon[] = [
  // Caspian Sea
  {
    name: 'Caspian Sea',
    points: [
      [47.0, 46.5], [48.0, 47.0], [51.0, 46.8], [53.5, 45.0], [53.0, 40.0],
      [54.0, 37.5], [53.5, 36.8], [50.5, 37.0], [49.0, 37.5], [48.5, 38.5],
      [49.5, 40.5], [47.5, 43.0], [47.0, 46.5]
    ]
  }
];

// 2. Bathymetry Depth Contours
export const BATHYMETRY_CONTOURS: BathymetryContour[] = [
  {
    depthMeters: 10,
    label: '10m',
    points: [[55.0, 26.8], [55.8, 26.9], [56.2, 27.05], [56.6, 26.8], [57.0, 26.0]]
  },
  {
    depthMeters: 20,
    label: '20m',
    points: [[54.5, 26.5], [55.5, 26.6], [56.2, 26.8], [56.7, 26.5], [57.2, 25.8]]
  },
  {
    depthMeters: 50,
    label: '50m',
    points: [[54.0, 26.0], [55.2, 26.3], [56.3, 26.5], [56.8, 26.0], [57.5, 25.5]]
  },
  {
    depthMeters: 100,
    label: '100m',
    points: [[53.0, 25.5], [55.0, 25.8], [56.5, 26.2], [57.2, 25.5], [58.0, 25.0]]
  }
];

// 3. Marine Place Labels
export const MARINE_PLACE_LABELS: MarinePlaceLabel[] = [
  { name: 'Strait of Hormuz', nameFa: 'تنگه هرمز', lon: 56.45, lat: 26.55, type: 'strait', minZoom: 20 },
  { name: 'Bandar Abbas', nameFa: 'بندرعباس', lon: 56.28, lat: 27.18, type: 'port', minZoom: 15 },
  { name: 'Qeshm Island', nameFa: 'جزیره قشم', lon: 55.9, lat: 26.85, type: 'island', minZoom: 15 },
  { name: 'Kish Island', nameFa: 'جزیره کیش', lon: 53.98, lat: 26.53, type: 'island', minZoom: 15 },
  { name: 'Bandar Lengeh', nameFa: 'بندرلنگه', lon: 54.88, lat: 26.55, type: 'port', minZoom: 20 },
  { name: 'Chabahar Port', nameFa: 'بندر چابهار', lon: 60.64, lat: 25.29, type: 'port', minZoom: 15 },
  { name: 'Bushehr Port', nameFa: 'بندر بوشهر', lon: 50.84, lat: 28.97, type: 'port', minZoom: 15 },
  { name: 'Asaluyeh', nameFa: 'عسلویه', lon: 52.61, lat: 27.48, type: 'port', minZoom: 20 },
  { name: 'Bandar Anzali', nameFa: 'بندر انزلی', lon: 49.46, lat: 37.47, type: 'port', minZoom: 15 }
];

// 4. Lighthouses
export const MARINE_LIGHTHOUSES: MarineLighthouse[] = [
  { name: 'Hormuz Light', lon: 56.48, lat: 27.09, character: 'Fl(2) W 10s', rangeNm: 22, color: '#f59e0b' },
  { name: 'Larak Light', lon: 56.41, lat: 26.85, character: 'Fl W 5s', rangeNm: 18, color: '#f59e0b' },
  { name: 'Qeshm East Light', lon: 56.28, lat: 26.96, character: 'Fl(3) W 12s', rangeNm: 15, color: '#f59e0b' },
  { name: 'Kish Light', lon: 54.03, lat: 26.56, character: 'Fl W 7.5s', rangeNm: 20, color: '#f59e0b' },
  { name: 'Ras Dastakan Light', lon: 55.28, lat: 26.54, character: 'Fl(4) W 15s', rangeNm: 16, color: '#f59e0b' }
];

// 5. TSS Shipping Lanes
export const SHIPPING_LANES_TSS: MarineShippingLane[] = [
  {
    name: 'Strait of Hormuz Inbound Lane',
    points: [[57.2, 26.1], [56.7, 26.4], [56.4, 26.6], [55.8, 26.7], [55.0, 26.6]]
  },
  {
    name: 'Strait of Hormuz Outbound Lane',
    points: [[55.0, 26.4], [55.8, 26.5], [56.3, 26.4], [56.6, 26.2], [57.1, 25.9]]
  }
];

// 6. Navigation Buoys
export const MARINE_BUOYS: MarineBuoy[] = [
  { name: 'Hormuz Fairway Buoy', lon: 56.55, lat: 26.5, buoyType: 'safe_water', color: '#ef4444' },
  { name: 'Qeshm Channel Port #1', lon: 56.22, lat: 27.05, buoyType: 'port', color: '#ef4444' },
  { name: 'Qeshm Channel Stbd #2', lon: 56.24, lat: 27.05, buoyType: 'starboard', color: '#22c55e' },
  { name: 'Kish Approach Buoy', lon: 54.08, lat: 26.52, buoyType: 'safe_water', color: '#ef4444' }
];

// 7. Marine Hazards
export const MARINE_HAZARDS: MarineHazard[] = [
  { name: 'Shoal Water Larak', lon: 56.38, lat: 26.81, type: 'shoal', depthMeters: 4.8 },
  { name: 'Submerged Wreck Hormuz', lon: 56.52, lat: 26.98, type: 'wreck', depthMeters: 8.2 },
  { name: 'Rock Awash Qeshm', lon: 55.35, lat: 26.62, type: 'rock', depthMeters: 2.1 }
];

// 8. Nautical Soundings
export const NAUTICAL_SOUNDINGS: NauticalSounding[] = [
  { lon: 56.45, lat: 26.65, depthMeters: 74 },
  { lon: 56.52, lat: 26.6, depthMeters: 88 },
  { lon: 56.35, lat: 26.75, depthMeters: 42 },
  { lon: 56.22, lat: 27.12, depthMeters: 14 },
  { lon: 56.15, lat: 27.15, depthMeters: 9.8 },
  { lon: 55.8, lat: 26.8, depthMeters: 28 },
  { lon: 54.05, lat: 26.58, depthMeters: 22 },
  { lon: 54.0, lat: 26.5, depthMeters: 36 },
  { lon: 54.88, lat: 26.52, depthMeters: 16 }
];
