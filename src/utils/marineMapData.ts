/**
 * Offline Marine World Coastlines, Inland Seas, Islands, Cities, Ports,
 * Bathymetry Contours, Soundings, Lighthouses & Traffic Separation Schemes (TSS).
 * High-density offline vector nautical dataset for Persian Gulf, Gulf of Oman,
 * Caspian Sea, Black Sea, Sea of Azov, Mediterranean, Red Sea, and Global Continents.
 */

export interface LandPolygon {
  name: string;
  points: [number, number][]; // [lon, lat]
}

export interface WaterBodyPolygon {
  name: string;
  points: [number, number][]; // [lon, lat]
  type?: 'inland_sea' | 'lake' | 'gulf' | 'strait';
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
  | 'ocean'
  | 'country'
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
// 1. World & Regional Landmass Polygons (Continents & Outer Coasts)
// =========================================================================
// 1. World & Regional Landmass Polygons (Clean Non-Overlapping Continents)
// =========================================================================
export const WORLD_LANDMASSES: LandPolygon[] = [
  // Eurasia Mainland (Europe, Russia, Central Asia, East Asia, South Asia & Iran)
  {
    name: 'Eurasia Mainland',
    points: [
      // Iberian Peninsula & Atlantic Europe
      [-9.5, 36.0], [-9.0, 37.0], [-9.4, 38.8], [-8.9, 41.8], [-9.2, 43.0], [-1.9, 43.4], [1.5, 48.0],
      [-4.7, 48.5], [-1.5, 49.7], [1.0, 50.0], [3.2, 51.4], [5.0, 52.5], [8.0, 54.0], [8.6, 57.1],
      [10.5, 57.7], [12.6, 56.1], [14.0, 54.0], [18.6, 54.6], [21.0, 55.7], [22.6, 57.8], [24.8, 59.5],
      [28.0, 60.1], [25.0, 65.0], [21.5, 63.5], [18.0, 60.0], [12.0, 58.0], [10.5, 59.9], [5.0, 62.0],
      [14.0, 68.2], [28.0, 71.1], [35.0, 69.0], [44.0, 68.0], [50.0, 68.5], [69.0, 73.0], [77.0, 77.0],
      [105.0, 77.8], [130.0, 72.0], [150.0, 71.0], [170.0, 68.0], [180.0, 65.5], [170.0, 64.0],
      // Kamchatka & Sea of Okhotsk
      [162.0, 58.0], [156.8, 51.0], [158.5, 53.0], [150.0, 59.0], [141.0, 53.5], [140.0, 46.5],
      // East Asia & Southeast Asia
      [131.0, 42.8], [129.5, 36.0], [126.0, 34.5], [124.5, 38.0], [122.0, 39.0], [118.0, 39.0],
      [120.5, 34.0], [121.8, 31.2], [122.0, 30.0], [120.0, 26.5], [116.5, 23.5], [114.2, 22.3],
      [110.0, 20.8], [108.0, 21.5], [107.0, 16.5], [109.0, 12.0], [107.0, 10.3], [105.0, 8.5],
      [100.5, 7.0], [103.8, 1.3], [101.0, 3.0], [98.5, 8.0], [98.0, 12.5], [96.0, 17.0],
      [92.5, 21.0], [89.0, 22.0], [87.0, 21.5], [85.0, 19.5], [80.0, 13.0], [77.5, 8.1],
      // India & Arabian Sea
      [73.0, 15.0], [72.8, 19.0], [70.0, 21.0], [68.8, 22.5], [67.0, 24.0],
      // Makran Coast (Pakistan & Iran)
      [62.5, 25.1], [61.75, 25.1], [61.5, 25.15], [60.65, 25.28], [60.2, 25.35],
      [59.5, 25.4], [58.5, 25.55], [57.8, 25.62], [57.75, 25.64], // Cape Jask
      // Strait of Hormuz North & Persian Gulf Iranian Shore
      [57.3, 25.85], [57.1, 26.5], [56.9, 27.1], [56.28, 27.18], // Bandar Abbas
      [56.05, 27.1], [55.85, 27.05], [55.6, 26.95], [55.0, 26.6], // Bandar Lengeh
      [54.88, 26.55], [54.25, 26.7], [53.9, 26.65], [53.6, 26.75], // Chiruyeh / Charak
      [53.3, 26.85], [53.0, 27.05], [52.65, 27.35], [52.6, 27.46], // Asaluyeh / Nayband
      [52.35, 27.5], [52.05, 27.8], [51.9, 27.85], [51.4, 28.0], // Kangan / Taheri
      [51.1, 28.45], [50.95, 28.85], [50.84, 28.98], [50.8, 29.05], // Bushehr Peninsula
      [50.62, 29.48], [50.5, 29.58], [50.15, 30.05], // Genaveh / Deylam
      [49.75, 30.05], [49.6, 30.15], [49.1, 30.2], [49.2, 30.5], // Bandar Mahshahr / Khor Musa
      [48.6, 29.9], [48.45, 30.0], [48.2, 30.4], // Arvand Rood (Shatt al-Arab)
      // Mesopotamia Inland Corridor (Iraq / Syria / Turkey border to Mediterranean Levant)
      [47.0, 31.5], [44.4, 33.3], [41.0, 35.5], [37.5, 36.5],
      // Mediterranean Levant Coast
      [35.9, 35.8], [35.5, 34.0], [34.8, 32.5], [34.4, 31.4],
      // Anatolia / Southern Turkey Coast
      [34.0, 36.5], [32.0, 36.3], [30.5, 36.8], [28.0, 36.6], [27.3, 37.0], [26.5, 38.4], [26.2, 40.0],
      // Greece & Aegean Sea Coast
      [24.0, 40.5], [23.5, 38.0], [22.5, 37.0], [21.5, 38.0], [20.0, 39.5],
      // Adriatic Sea & Italian Peninsula
      [18.5, 42.0], [14.5, 45.0], [12.5, 44.5], [15.0, 41.0], [16.5, 39.0], [15.5, 38.2], [14.5, 41.0], [10.0, 43.5], [7.5, 43.7],
      // Southern France & Spain Mediterranean Coast
      [5.3, 43.3], [3.0, 42.5], [2.2, 41.4], [0.0, 39.5], [-2.0, 37.5], [-4.4, 36.7], [-5.6, 36.0] // Strait of Gibraltar North
    ]
  },

  // Arabian Peninsula (Saudi Arabia, UAE, Qatar, Oman, Yemen, Kuwait - Clean Non-Overlapping Polygon)
  {
    name: 'Arabian Peninsula',
    points: [
      // Kuwait & Persian Gulf Southern Coast
      [48.0, 30.0], [48.3, 29.3], [48.8, 28.5], [49.5, 27.5], [50.1, 26.7], [50.2, 26.0],
      // Qatar Peninsula
      [50.8, 25.0], [51.2, 24.6], [51.6, 25.3], [51.6, 26.1], [51.2, 26.0], [50.8, 25.5],
      // UAE Coast
      [51.6, 24.3], [52.5, 24.1], [54.0, 24.4], [55.3, 25.2], [55.9, 25.8],
      // Musandam Peninsula (Strait of Hormuz South)
      [56.2, 26.2], [56.45, 26.4], [56.35, 26.1],
      // Oman Gulf Coast
      [56.35, 25.1], [56.8, 24.3], [58.5, 23.6], [59.5, 22.6], [59.8, 22.5],
      // Arabian Sea Coast (Oman & Yemen)
      [58.5, 20.5], [55.5, 18.0], [54.0, 17.0], [51.0, 15.5], [49.1, 14.5], [45.0, 12.8],
      // Bab-el-Mandeb Strait
      [43.4, 12.6],
      // Red Sea East Coast (Yemen & Saudi Arabia)
      [42.9, 14.8], [42.5, 16.9], [41.5, 19.0], [39.2, 21.5], [38.0, 24.1], [35.7, 27.3],
      // Gulf of Aqaba East Coast
      [34.9, 29.5],
      // Northern Desert Boundary
      [36.5, 30.0], [39.0, 31.0], [42.0, 31.0], [45.0, 30.5], [47.5, 30.0], [48.0, 30.0]
    ]
  },

  // Africa Continent
  {
    name: 'Africa',
    points: [
      // Mediterranean Coast: Port Said, Alexandria, Libya, Tunisia, Algeria, Morocco
      [32.3, 31.3], [29.9, 31.2], [20.0, 32.1], [13.2, 32.9], [10.2, 36.8], [3.0, 36.8], [-5.8, 35.8],
      // Atlantic Coast: Morocco, Western Sahara, Mauritania, Senegal
      [-7.6, 33.6], [-15.0, 24.0], [-16.5, 19.0], [-17.5, 14.7], [-13.0, 9.0], [-10.8, 6.3], [-7.5, 4.3],
      // Gulf of Guinea & West Africa
      [1.5, 6.0], [3.4, 6.4], [9.0, 4.5], [10.0, -1.0], [12.0, -6.0],
      // Southern Atlantic Coast: Angola, Namibia, South Africa
      [13.2, -8.8], [13.5, -12.5], [14.5, -22.9], [18.4, -34.4], [25.6, -34.0], [31.0, -29.9],
      // Indian Ocean Coast: Mozambique, Tanzania, Kenya, Somalia
      [32.6, -25.9], [35.0, -23.5], [40.5, -15.0], [39.3, -6.8], [39.7, -4.0], [42.0, 1.0], [45.3, 2.0], [51.2, 11.8],
      // Horn of Africa & Gulf of Aden
      [49.0, 11.8], [43.1, 11.6],
      // Red Sea West Coast (Eritrea, Sudan, Egypt)
      [43.0, 13.0], [39.5, 15.6], [37.2, 19.6], [35.0, 24.0], [33.8, 27.2], [32.5, 29.9],
      // Suez Isthmus
      [32.3, 31.3]
    ]
  },
  // Americas - North America
  {
    name: 'North America',
    points: [
      [-168.0, 65.5], [-162.0, 56.0], [-152.0, 58.0], [-140.0, 60.0], [-130.0, 54.0],
      [-125.0, 49.0], [-124.0, 42.0], [-122.0, 37.5], [-117.0, 32.5], [-115.0, 29.0],
      [-110.0, 23.0], [-108.0, 26.0], [-104.0, 20.0], [-97.0, 16.0], [-92.0, 14.5],
      [-87.0, 13.0], [-83.0, 8.5], [-77.5, 8.0], [-80.0, 9.5], [-84.0, 15.5],
      [-88.0, 16.0], [-90.0, 21.0], [-97.0, 26.0], [-94.0, 29.5], [-88.0, 30.5],
      [-82.0, 25.0], [-80.0, 25.5], [-75.0, 35.0], [-71.0, 41.5], [-66.0, 44.5],
      [-53.0, 47.0], [-56.0, 51.5], [-64.0, 60.0], [-80.0, 62.0], [-85.0, 55.0],
      [-92.0, 60.0], [-85.0, 70.0], [-100.0, 74.0], [-130.0, 70.0], [-150.0, 71.0],
      [-168.0, 65.5]
    ]
  },
  // Americas - South America
  {
    name: 'South America',
    points: [
      [-77.5, 8.0], [-76.0, 4.0], [-81.0, -4.5], [-78.0, -10.0], [-72.0, -20.0],
      [-71.0, -32.0], [-74.0, -45.0], [-75.0, -52.0], [-67.0, -55.5], [-65.0, -54.0],
      [-65.0, -45.0], [-58.0, -38.5], [-55.0, -35.0], [-48.0, -27.0], [-43.0, -23.0],
      [-38.5, -13.0], [-35.0, -5.5], [-44.0, -2.5], [-51.0, 0.0], [-60.0, 9.0],
      [-71.5, 12.0], [-75.0, 10.5], [-77.5, 8.0]
    ]
  },
  // Australia
  {
    name: 'Australia',
    points: [
      [115.0, -21.8], [113.8, -26.0], [115.0, -34.3], [122.0, -34.0], [128.0, -32.0],
      [136.0, -35.0], [140.0, -38.0], [146.5, -39.0], [150.0, -37.0], [153.5, -28.0],
      [150.0, -22.0], [145.5, -15.0], [142.5, -10.8], [137.0, -15.0], [136.0, -12.0],
      [130.0, -12.0], [124.0, -16.5], [118.0, -20.0], [115.0, -21.8]
    ]
  },
  // Antarctica
  {
    name: 'Antarctica',
    points: [
      [-60.0, -64.0], [-55.0, -70.0], [-20.0, -72.0], [0.0, -70.0], [30.0, -69.0],
      [60.0, -67.0], [90.0, -66.0], [120.0, -66.0], [150.0, -68.0], [170.0, -73.0],
      [-170.0, -78.0], [-140.0, -75.0], [-110.0, -73.0], [-80.0, -73.0], [-65.0, -68.0],
      [-60.0, -64.0]
    ]
  },
  // Greenland
  {
    name: 'Greenland',
    points: [
      [-44.0, 60.0], [-50.0, 65.0], [-54.0, 72.0], [-60.0, 78.0], [-40.0, 83.0],
      [-20.0, 80.0], [-20.0, 72.0], [-35.0, 65.0], [-44.0, 60.0]
    ]
  },
  // British Isles & Ireland
  {
    name: 'Great Britain',
    points: [
      [-5.0, 50.0], [-3.0, 50.5], [1.4, 51.3], [1.7, 52.8], [0.1, 53.6],
      [-1.5, 55.0], [-2.0, 57.5], [-3.0, 58.6], [-5.0, 58.5], [-5.5, 56.5],
      [-4.0, 54.5], [-3.0, 53.3], [-5.0, 51.7], [-5.0, 50.0]
    ]
  },
  {
    name: 'Ireland',
    points: [
      [-6.0, 53.0], [-6.0, 54.0], [-7.5, 55.3], [-10.0, 54.0], [-10.5, 52.0],
      [-8.5, 51.5], [-6.0, 52.2], [-6.0, 53.0]
    ]
  },
  // Iceland
  {
    name: 'Iceland',
    points: [
      [-22.0, 63.8], [-24.5, 65.0], [-22.0, 66.5], [-16.0, 66.5], [-13.5, 65.0],
      [-15.0, 64.0], [-19.0, 63.5], [-22.0, 63.8]
    ]
  },
  // Japan (Honshu / Hokkaido / Kyushu)
  {
    name: 'Japan Main Islands',
    points: [
      [130.5, 31.5], [132.0, 33.5], [135.5, 34.5], [140.0, 35.5], [142.0, 39.5],
      [141.0, 43.0], [145.5, 43.5], [143.0, 45.5], [140.5, 42.0], [139.0, 37.0],
      [136.0, 36.5], [131.0, 34.0], [130.0, 32.5], [130.5, 31.5]
    ]
  },
  // Indonesia & Malaysia (Sumatra, Java, Borneo, Sulawesi)
  {
    name: 'Sumatra',
    points: [
      [95.5, 5.5], [99.0, 2.5], [103.0, -1.0], [106.0, -5.5], [104.5, -5.8],
      [101.5, -3.5], [97.5, 2.0], [95.5, 5.5]
    ]
  },
  {
    name: 'Java',
    points: [
      [106.0, -6.0], [110.0, -6.8], [114.5, -8.0], [114.0, -8.7], [108.5, -7.7],
      [105.5, -6.8], [106.0, -6.0]
    ]
  },
  {
    name: 'Borneo',
    points: [
      [109.0, 1.5], [113.0, 4.0], [117.0, 4.5], [119.0, 1.5], [117.0, -3.5],
      [112.0, -3.0], [109.5, -1.0], [109.0, 1.5]
    ]
  },
  {
    name: 'Sulawesi',
    points: [
      [120.0, 1.0], [125.0, 1.5], [122.0, -1.0], [123.0, -5.0], [120.0, -5.5],
      [119.0, -3.0], [120.0, 1.0]
    ]
  },
  // Philippines
  {
    name: 'Philippines',
    points: [
      [121.0, 18.5], [122.5, 16.0], [124.0, 13.0], [126.0, 8.0], [124.5, 6.0],
      [122.0, 8.0], [120.0, 14.0], [120.5, 17.5], [121.0, 18.5]
    ]
  },
  // Papua New Guinea
  {
    name: 'New Guinea',
    points: [
      [131.0, -1.0], [137.0, -2.5], [144.0, -3.5], [150.5, -10.5], [147.0, -8.5],
      [141.0, -9.0], [135.0, -5.0], [131.0, -1.0]
    ]
  },
  // New Zealand
  {
    name: 'New Zealand North',
    points: [
      [173.0, -35.0], [176.0, -37.5], [178.5, -37.5], [177.0, -40.0], [175.0, -41.5],
      [174.5, -39.0], [174.0, -36.0], [173.0, -35.0]
    ]
  },
  {
    name: 'New Zealand South',
    points: [
      [173.0, -41.0], [174.0, -42.0], [171.0, -45.0], [168.5, -46.5], [166.5, -46.0],
      [168.0, -44.0], [171.5, -42.0], [173.0, -41.0]
    ]
  },
  // Madagascar
  {
    name: 'Madagascar',
    points: [[43.5, -12.0], [50.0, -15.5], [47.5, -25.5], [44.0, -25.0], [43.5, -12.0]]
  },
  // Sri Lanka
  {
    name: 'Sri Lanka',
    points: [[79.8, 9.8], [81.8, 8.6], [81.3, 6.0], [79.9, 6.9], [79.8, 9.8]]
  },
  // Caribbean - Cuba & Hispaniola
  {
    name: 'Cuba',
    points: [
      [-85.0, 21.8], [-82.0, 23.2], [-76.0, 21.5], [-74.2, 20.2], [-76.5, 19.8],
      [-81.0, 22.0], [-84.0, 21.8], [-85.0, 21.8]
    ]
  },
  // Mediterranean Islands
  {
    name: 'Cyprus',
    points: [[32.3, 35.0], [33.8, 35.5], [34.6, 35.7], [33.7, 34.9], [32.8, 34.7], [32.3, 35.0]]
  },
  {
    name: 'Crete',
    points: [[23.5, 35.3], [24.5, 35.4], [26.2, 35.2], [25.7, 35.0], [24.0, 35.1], [23.5, 35.3]]
  },
  {
    name: 'Sicily',
    points: [[12.4, 38.0], [15.1, 38.3], [15.3, 36.6], [14.0, 36.8], [12.4, 37.7], [12.4, 38.0]]
  },
  {
    name: 'Sardinia',
    points: [[8.2, 40.9], [9.7, 41.2], [9.6, 39.2], [8.5, 39.0], [8.2, 40.9]]
  },
  {
    name: 'Corsica',
    points: [[9.4, 43.0], [9.5, 42.0], [9.2, 41.4], [8.6, 42.0], [9.4, 43.0]]
  },

  // --- PERSIAN GULF KEY ISLANDS (High-Density Nautical Shorelines) ---
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
    name: 'Hengam Island',
    points: [
      [55.85, 26.64], [55.91, 26.68], [55.93, 26.61], [55.87, 26.59], [55.85, 26.64]
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
    name: 'Bahrain Island',
    points: [
      [50.40, 26.00], [50.65, 26.25], [50.62, 25.80], [50.45, 25.90], [50.40, 26.00]
    ]
  },
  // Caspian Sea Islands
  {
    name: 'Ashuradeh Island',
    points: [
      [54.00, 36.84], [54.06, 36.85], [54.05, 36.83], [53.99, 36.83], [54.00, 36.84]
    ]
  },
  {
    name: 'Ogurchinskiy Island (Caspian)',
    points: [
      [53.00, 38.80], [53.10, 39.10], [53.05, 39.12], [52.95, 38.85], [53.00, 38.80]
    ]
  },
  // Black Sea Islands
  {
    name: 'Snake Island (Zmiinyi)',
    points: [
      [30.19, 45.25], [30.22, 45.26], [30.21, 45.24], [30.19, 45.25]
    ]
  }
];

// =========================================================================
// 2. High-Precision Inland Water Bodies & Major Regional Seas
// =========================================================================
export const INLAND_WATER_BODIES: WaterBodyPolygon[] = [
  // --- CASPIAN SEA ---
  // Geographically authentic closed polygon with full northern, eastern, southern & western coastlines
  {
    name: 'Caspian Sea',
    type: 'inland_sea',
    points: [
      // Iranian Southern Shore: Astara to Gorgan Bay
      [48.87, 38.43], // Astara (Iran)
      [48.91, 38.00], // Lavandevil / Talesh
      [49.15, 37.56], // Rezvanshahr
      [49.44, 37.48], // Bandar Anzali West Pier
      [49.47, 37.49], // Bandar Anzali Lagoon Mouth
      [49.52, 37.47], // Bandar Anzali East Pier
      [49.95, 37.43], // Kiashahr (Sefidrood Estuary)
      [50.21, 37.21], // Chamkhaleh
      [50.32, 37.14], // Roodsar
      [50.68, 36.92], // Chaboksar / Ramsar
      [50.88, 36.83], // Tonekabon
      [51.48, 36.66], // Chalus / Nowshahr
      [52.00, 36.58], // Sisangan / Noor
      [52.27, 36.63], // Mahmoodabad
      [52.52, 36.69], // Fereydunkenar
      [52.65, 36.71], // Babolsar
      [52.95, 36.78], // Juybar
      [53.12, 36.81], // Farahabad (Sari)
      [53.37, 36.85], // Amirabad Port (Behshahr)
      [53.50, 36.87], // Miankaleh Spit Base
      [53.75, 36.88], // Miankaleh Outer Coast
      [54.02, 36.85], // Ashuradeh Tip
      [54.07, 36.90], // Bandar Torkaman
      [54.04, 37.10], // Gomishan
      [53.97, 37.47], // Atrek River Mouth (Iran/Turkmenistan border)
      // Turkmenistan Shore
      [53.85, 37.46], // Esenguly
      [53.78, 37.75], // Ekerem
      [53.25, 39.20], // Alaja Bay
      [53.12, 39.42], // Hazar (Cheleken Peninsula)
      [53.20, 39.60], // Turkmenbashi Bay South
      [52.98, 40.02], // Turkmenbashi Port (Krasnovodsk)
      [52.75, 40.40], // Guvlymayak
      [52.85, 41.05], // Garabogazköl (Kara-Bogaz-Gol) Inlet
      // Kazakhstan Shore (Mangyshlak Peninsula)
      [52.65, 42.75], // Kendirli Bay
      [51.65, 43.20], // Kuryk Port
      [51.15, 43.65], // Aktau
      [50.25, 44.55], // Bautino / Fort-Shevchenko
      [50.20, 44.65], // Cape Tyub-Karagan
      [50.70, 44.75], // Mangyshlak Bay
      [51.85, 45.35], // Buzachi Peninsula
      [53.20, 45.80], // Dead Kultuk Bay
      // Northern Shallow Shelf: Kazakhstan & Russia (Ural & Volga Deltas)
      [53.05, 46.25], // Prorva / Tengiz Coast
      [52.70, 46.50], // Emba Mouth
      [51.70, 46.90], // Atyrau (Ural River Mouth)
      [50.90, 46.80], // Zhanbay
      [49.95, 46.55], // Kurmangazy
      [49.30, 46.35], // Kigach River (Kazakh/Russia border)
      [48.80, 45.75], // Volga Delta East Channels
      [47.85, 45.50], // Volga Delta Central Channels (Astrakhan Gateway)
      [47.45, 45.38], // Lagan (Kalmykia)
      [47.55, 44.75], // Kaspiyskiy
      [47.30, 44.40], // Kizlyar Bay
      [47.60, 43.90], // Agrakhan Peninsula
      // Dagestan (Russia) & Azerbaijan Shore
      [47.52, 43.25], // Sulak River Mouth
      [47.50, 42.98], // Makhachkala
      [47.62, 42.88], // Kaspiysk
      [47.88, 42.57], // Izberbash
      [48.30, 42.06], // Derbent Port
      [48.55, 41.85], // Samur River Delta (Russia/Azerbaijan border)
      [48.70, 41.75], // Nabran
      [48.85, 41.55], // Khachmaz
      [49.12, 41.15], // Siazan
      [49.45, 40.85], // Gilazi
      [49.65, 40.58], // Sumqayit
      [49.85, 40.55], // Absheron Peninsula North
      [50.36, 40.30], // Cape Shakhova (Absheron Peninsula Tip)
      [49.85, 40.36], // Baku Bay & Port
      [49.45, 40.18], // Gobustan
      [49.41, 39.98], // Alat Port
      [49.35, 39.38], // Kura River Delta
      [49.05, 39.05], // Gizilagaj Bay
      [48.85, 38.75], // Lankaran
      [48.87, 38.43]  // Astara (Closing Caspian Sea polygon)
    ]
  },

  // --- BLACK SEA ---
  // Geographically authentic closed polygon: Turkey, Georgia, Russia, Ukraine, Romania, Bulgaria
  {
    name: 'Black Sea',
    type: 'inland_sea',
    points: [
      // Southern Shore (Turkey): Bosphorus to Georgia Border
      [29.11, 41.23], // Bosphorus North Entrance (Rumelifeneri)
      [29.61, 41.18], // Sile
      [30.22, 41.17], // Kefken
      [30.70, 41.10], // Karasu
      [31.42, 41.28], // Kdz Eregli
      [31.78, 41.45], // Zonguldak
      [32.39, 41.75], // Amasra
      [32.98, 41.89], // Cide
      [33.77, 41.98], // Inebolu
      [34.95, 42.10], // Cape Ince (Northernmost Point of Anatolia)
      [35.15, 42.02], // Sinop Peninsula
      [36.00, 41.72], // Bafra (Kizilirmak Delta)
      [36.35, 41.30], // Samsun Port
      [37.28, 41.13], // Unye
      [37.88, 40.98], // Ordu
      [38.38, 40.92], // Giresun
      [39.73, 41.01], // Trabzon Port
      [40.52, 41.03], // Rize
      [41.00, 41.19], // Ardesen
      [41.42, 41.40], // Hopa Port
      [41.55, 41.52], // Sarp (Turkey/Georgia border)
      // Eastern Shore (Georgia, Abkhazia & Russian Coast)
      [41.64, 41.64], // Batumi Port (Georgia)
      [41.77, 41.82], // Kobuleti
      [41.67, 42.15], // Poti Port (Rioni Mouth)
      [41.57, 42.38], // Anaklia
      [41.02, 43.00], // Sukhumi Bay
      [40.35, 43.15], // Pitsunda Cape
      [40.01, 43.39], // Gagra / Psou Mouth
      [39.72, 43.58], // Sochi Port
      [39.07, 44.10], // Tuapse Oil Port
      [38.08, 44.56], // Gelendzhik Bay
      [37.78, 44.72], // Novorossiysk (Tsemes Bay - Major Freight Port)
      [37.31, 44.89], // Anapa
      [36.74, 45.11], // Cape Zhelezny Rog (Taman Peninsula)
      [36.55, 45.20], // Kerch Strait South Entrance
      // Crimean Southern & Western Coast
      [36.47, 45.36], // Kerch City
      [35.85, 45.00], // Cape Opuk
      [35.38, 45.03], // Feodosia Bay
      [34.97, 44.85], // Sudak
      [34.41, 44.67], // Alushta
      [34.17, 44.50], // Yalta Port
      [33.74, 44.38], // Cape Sarych (Southernmost point of Crimea)
      [33.60, 44.50], // Balaklava
      [33.52, 44.62], // Sevastopol Naval Harbor
      [33.38, 44.58], // Cape Khersones
      [33.37, 45.19], // Yevpatoria Bay
      [32.50, 45.35], // Cape Tarkhankut (Western point of Crimea)
      [33.15, 45.78], // Bakal Spit
      // Northern & Western Shore (Ukraine, Romania, Bulgaria)
      [32.40, 46.10], // Dzharylhach Bay / Skadovsk
      [31.60, 46.35], // Kinburn Spit / Tendrivska Bay
      [31.55, 46.61], // Dnieper-Bug Estuary (Ochakiv)
      [31.02, 46.62], // Pivdennyi Port (Yuzhne)
      [30.74, 46.48], // Odessa Port
      [30.65, 46.30], // Chornomorsk
      [30.45, 46.07], // Dniester Liman (Zatoka)
      [30.00, 45.85], // Tuzly Lagoons
      [29.70, 45.45], // Danube Delta (Kiliya Branch)
      [29.66, 45.15], // Danube Delta (Sulina Main Navigation Canal)
      [29.60, 44.88], // Danube Delta (Sfântu Gheorghe)
      [28.85, 44.68], // Lake Razelm Gura Portitei
      [28.66, 44.18], // Constanța Port (Romania - Major Black Sea Hub)
      [28.58, 43.81], // Mangalia
      [28.47, 43.36], // Cape Kaliakra (Bulgaria)
      [27.92, 43.21], // Varna Bay & Port (Bulgaria)
      [27.90, 42.70], // Cape Emine
      [27.47, 42.50], // Burgas Gulf & Port
      [27.69, 42.42], // Sozopol
      [27.94, 42.10], // Tsarevo / Ahtopol
      [28.03, 41.98], // Rezovo (Bulgaria/Turkey border)
      [27.98, 41.88], // Igneada
      [28.09, 41.63], // Kiyikoy
      [28.68, 41.35], // Karaburun
      [29.11, 41.23]  // Bosphorus North (Closing Black Sea polygon)
    ]
  },

  // --- SEA OF AZOV ---
  {
    name: 'Sea of Azov',
    type: 'inland_sea',
    points: [
      [36.65, 45.25], // Kerch Strait (Taman side)
      [36.68, 45.35], // Port Kavkaz
      [37.38, 45.32], // Temryuk (Kuban Mouth)
      [38.17, 46.05], // Primorsko-Akhtarsk
      [38.28, 46.71], // Yeysk Spit
      [39.35, 47.10], // Don River Delta / Taganrog Bay
      [38.93, 47.21], // Taganrog
      [38.08, 47.11], // Novoazovsk
      [37.55, 47.10], // Mariupol Port
      [36.78, 46.75], // Berdyansk Spit & Port
      [36.35, 46.72], // Prymorsk
      [35.37, 46.36], // Fedotova Spit
      [34.80, 46.18], // Henichesk
      [35.15, 45.75], // Arabat Spit Central
      [35.50, 45.30], // Arabat Spit South
      [36.47, 45.36], // Kerch City
      [36.65, 45.25]  // Closing Sea of Azov
    ]
  },

  // --- SEA OF MARMARA ---
  {
    name: 'Sea of Marmara',
    type: 'inland_sea',
    points: [
      [29.00, 41.01], // Istanbul / Bosphorus South
      [29.35, 40.85], // Pendik / Tuzla
      [29.90, 40.75], // Izmit Gulf
      [29.30, 40.65], // Yalova
      [28.90, 40.40], // Gemlik
      [28.30, 40.35], // Mudanya / Bandirma
      [27.60, 40.38], // Erdek Peninsula
      [26.70, 40.40], // Gallipoli (Gelibolu) / Dardanelles
      [26.25, 40.15], // Canakkale Strait
      [26.90, 40.55], // Sarkoy
      [27.50, 40.95], // Tekirdag
      [28.25, 41.05], // Silivri
      [28.75, 40.97], // Bakirkoy (Istanbul)
      [29.00, 41.01]  // Closing Sea of Marmara
    ]
  },

  // --- LAKE URMIA ---
  {
    name: 'Lake Urmia',
    type: 'lake',
    points: [
      [45.10, 37.95], [45.35, 38.25], [45.60, 38.00], [45.75, 37.60],
      [45.55, 37.20], [45.25, 37.15], [45.15, 37.45], [45.05, 37.75],
      [45.10, 37.95]
    ]
  },

  // --- LAKE VAN ---
  {
    name: 'Lake Van',
    type: 'lake',
    points: [
      [42.70, 38.60], [43.10, 38.95], [43.70, 38.80], [43.40, 38.45],
      [42.90, 38.35], [42.70, 38.60]
    ]
  },

  // --- ARAL SEA ---
  {
    name: 'North Aral Sea',
    type: 'lake',
    points: [
      [60.30, 46.50], [61.20, 46.85], [61.60, 46.50], [60.80, 46.10], [60.30, 46.50]
    ]
  }
];

// =========================================================================
// 3. Comprehensive Place Labels (Capitals, World Cities, Ports & Seas)
// =========================================================================
export const MARINE_PLACE_LABELS: MarinePlaceLabel[] = [
  // --- IRANIAN PROVINCIAL CAPITALS & MAJOR HUBS ---
  { name: 'Tehran', lon: 51.39, lat: 35.69, type: 'provincial_capital', minZoom: 4, isMajor: true },
  { name: 'Isfahan', lon: 51.67, lat: 32.65, type: 'provincial_capital', minZoom: 5, isMajor: true },
  { name: 'Shiraz', lon: 52.54, lat: 29.59, type: 'provincial_capital', minZoom: 5, isMajor: true },
  { name: 'Tabriz', lon: 46.29, lat: 38.08, type: 'provincial_capital', minZoom: 5, isMajor: true },
  { name: 'Mashhad', lon: 59.61, lat: 36.30, type: 'provincial_capital', minZoom: 5, isMajor: true },
  { name: 'Ahvaz', lon: 48.67, lat: 31.32, type: 'provincial_capital', minZoom: 6, isMajor: true },
  { name: 'Bandar Abbas', lon: 56.28, lat: 27.18, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Bushehr', lon: 50.84, lat: 28.98, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Chabahar', lon: 60.64, lat: 25.29, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Bandar Anzali', lon: 49.46, lat: 37.47, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Rasht', lon: 49.58, lat: 37.28, type: 'provincial_capital', minZoom: 6 },
  { name: 'Sari', lon: 53.06, lat: 36.57, type: 'provincial_capital', minZoom: 6 },
  { name: 'Gorgan', lon: 54.43, lat: 36.84, type: 'provincial_capital', minZoom: 6 },
  { name: 'Nowshahr', lon: 51.50, lat: 36.65, type: 'port', minZoom: 7 },
  { name: 'Babolsar', lon: 52.65, lat: 36.71, type: 'port', minZoom: 7 },
  { name: 'Amirabad Port', lon: 53.37, lat: 36.85, type: 'port', minZoom: 7 },
  { name: 'Bandar Torkaman', lon: 54.07, lat: 36.90, type: 'port', minZoom: 7 },
  { name: 'Astara', lon: 48.87, lat: 38.43, type: 'port', minZoom: 7 },
  { name: 'Ramsar', lon: 50.68, lat: 36.92, type: 'coastal_city', minZoom: 7 },
  { name: 'Kish Island', lon: 53.99, lat: 26.54, type: 'island', minZoom: 6, isMajor: true },
  { name: 'Qeshm Island', lon: 55.85, lat: 26.85, type: 'island', minZoom: 6, isMajor: true },
  { name: 'Asaluyeh', lon: 52.60, lat: 27.46, type: 'port', minZoom: 7 },
  { name: 'Kangan', lon: 52.05, lat: 27.83, type: 'port', minZoom: 8 },
  { name: 'Kharg Island', lon: 50.32, lat: 29.25, type: 'island', minZoom: 7 },
  { name: 'Jask', lon: 57.77, lat: 25.64, type: 'port', minZoom: 7 },
  { name: 'Konarak', lon: 60.40, lat: 25.36, type: 'port', minZoom: 8 },

  // --- CASPIAN SEA INTERNATIONAL PORTS & METROPOLISES ---
  { name: 'Baku', lon: 49.86, lat: 40.40, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Sumqayit', lon: 49.65, lat: 40.58, type: 'coastal_city', minZoom: 7 },
  { name: 'Lankaran', lon: 48.85, lat: 38.75, type: 'port', minZoom: 7 },
  { name: 'Derbent', lon: 48.30, lat: 42.06, type: 'port', minZoom: 6 },
  { name: 'Makhachkala', lon: 47.50, lat: 42.98, type: 'port', minZoom: 6 },
  { name: 'Astrakhan', lon: 48.04, lat: 46.35, type: 'port', minZoom: 5, isMajor: true },
  { name: 'Atyrau', lon: 51.92, lat: 47.11, type: 'port', minZoom: 6 },
  { name: 'Aktau', lon: 51.17, lat: 43.65, type: 'port', minZoom: 6 },
  { name: 'Turkmenbashi', lon: 52.98, lat: 40.02, type: 'port', minZoom: 6 },
  { name: 'Hazar', lon: 53.12, lat: 39.42, type: 'port', minZoom: 8 },

  // --- CAUCASUS (Between Black Sea and Caspian Sea) ---
  { name: 'Tbilisi', lon: 44.82, lat: 41.71, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Yerevan', lon: 44.51, lat: 40.18, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Caucasus Mountains', lon: 45.50, lat: 42.50, type: 'sea_label', minZoom: 5 },

  // --- BLACK SEA PORTS & CITIES ---
  { name: 'Istanbul', lon: 28.97, lat: 41.00, type: 'world_city', minZoom: 4, isMajor: true },
  { name: 'Trabzon', lon: 39.73, lat: 41.01, type: 'port', minZoom: 6 },
  { name: 'Samsun', lon: 36.35, lat: 41.30, type: 'port', minZoom: 6 },
  { name: 'Sinop', lon: 35.15, lat: 42.02, type: 'port', minZoom: 7 },
  { name: 'Rize', lon: 40.52, lat: 41.03, type: 'port', minZoom: 8 },
  { name: 'Batumi', lon: 41.64, lat: 41.64, type: 'port', minZoom: 6 },
  { name: 'Poti', lon: 41.67, lat: 42.15, type: 'port', minZoom: 7 },
  { name: 'Sukhumi', lon: 41.02, lat: 43.00, type: 'port', minZoom: 7 },
  { name: 'Sochi', lon: 39.72, lat: 43.58, type: 'port', minZoom: 6 },
  { name: 'Novorossiysk', lon: 37.78, lat: 44.72, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Tuapse', lon: 39.07, lat: 44.10, type: 'port', minZoom: 7 },
  { name: 'Kerch', lon: 36.47, lat: 45.36, type: 'port', minZoom: 6 },
  { name: 'Sevastopol', lon: 33.52, lat: 44.62, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Yalta', lon: 34.17, lat: 44.50, type: 'port', minZoom: 7 },
  { name: 'Odessa', lon: 30.74, lat: 46.48, type: 'port', minZoom: 5, isMajor: true },
  { name: 'Constanța', lon: 28.66, lat: 44.18, type: 'port', minZoom: 6, isMajor: true },
  { name: 'Varna', lon: 27.92, lat: 43.21, type: 'port', minZoom: 6 },
  { name: 'Burgas', lon: 27.47, lat: 42.50, type: 'port', minZoom: 7 },

  // --- PERSIAN GULF REGIONAL CAPITALS ---
  { name: 'Dubai', lon: 55.27, lat: 25.20, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Abu Dhabi', lon: 54.37, lat: 24.45, type: 'world_city', minZoom: 6, isMajor: true },
  { name: 'Doha', lon: 51.53, lat: 25.28, type: 'world_city', minZoom: 6, isMajor: true },
  { name: 'Manama', lon: 50.58, lat: 26.22, type: 'world_city', minZoom: 6, isMajor: true },
  { name: 'Kuwait City', lon: 47.97, lat: 29.37, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Muscat', lon: 58.40, lat: 23.60, type: 'world_city', minZoom: 5, isMajor: true },
  { name: 'Fujairah', lon: 56.33, lat: 25.12, type: 'port', minZoom: 7 },

  // --- MAJOR GLOBAL SEAS, GULFS & STRAITS ---
  { name: 'PERSIAN GULF', lon: 52.00, lat: 26.80, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'STRAIT OF HORMUZ', lon: 56.40, lat: 26.55, type: 'strait', minZoom: 6, isMajor: true },
  { name: 'GULF OF OMAN', lon: 59.00, lat: 24.50, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'ARABIAN SEA', lon: 65.00, lat: 18.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'CASPIAN SEA', lon: 51.20, lat: 39.50, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'BLACK SEA', lon: 35.00, lat: 43.40, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'SEA OF AZOV', lon: 37.00, lat: 46.00, type: 'sea_label', minZoom: 5 },
  { name: 'SEA OF MARMARA', lon: 28.30, lat: 40.70, type: 'sea_label', minZoom: 6 },
  { name: 'BOSPHORUS', lon: 29.05, lat: 41.12, type: 'strait', minZoom: 8 },
  { name: 'DARDANELLES', lon: 26.40, lat: 40.20, type: 'strait', minZoom: 8 },
  { name: 'RED SEA', lon: 38.00, lat: 20.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'GULF OF ADEN', lon: 48.00, lat: 12.50, type: 'sea_label', minZoom: 4, isMajor: true },
  { name: 'BAB-EL-MANDEB', lon: 43.35, lat: 12.60, type: 'strait', minZoom: 6, isMajor: true },
  { name: 'SUEZ CANAL', lon: 32.35, lat: 30.70, type: 'strait', minZoom: 7, isMajor: true },
  { name: 'MEDITERRANEAN SEA', lon: 18.00, lat: 35.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'STRAIT OF GIBRALTAR', lon: -5.60, lat: 35.95, type: 'strait', minZoom: 6, isMajor: true },
  { name: 'NORTH SEA', lon: 3.00, lat: 56.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'BALTIC SEA', lon: 19.50, lat: 57.50, type: 'sea_label', minZoom: 4, isMajor: true },
  { name: 'ENGLISH CHANNEL', lon: -0.50, lat: 50.20, type: 'strait', minZoom: 5, isMajor: true },
  { name: 'NORWEGIAN SEA', lon: 3.00, lat: 66.00, type: 'sea_label', minZoom: 3 },
  { name: 'BARENTS SEA', lon: 40.00, lat: 74.00, type: 'sea_label', minZoom: 3 },
  { name: 'BAY OF BENGAL', lon: 88.00, lat: 15.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'ANDAMAN SEA', lon: 95.00, lat: 10.00, type: 'sea_label', minZoom: 4 },
  { name: 'STRAIT OF MALACCA', lon: 101.50, lat: 2.50, type: 'strait', minZoom: 5, isMajor: true },
  { name: 'SOUTH CHINA SEA', lon: 114.00, lat: 14.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'EAST CHINA SEA', lon: 126.00, lat: 29.00, type: 'sea_label', minZoom: 4 },
  { name: 'YELLOW SEA', lon: 124.00, lat: 35.00, type: 'sea_label', minZoom: 4 },
  { name: 'SEA OF JAPAN', lon: 135.00, lat: 39.00, type: 'sea_label', minZoom: 4 },
  { name: 'SEA OF OKHOTSK', lon: 150.00, lat: 54.00, type: 'sea_label', minZoom: 3 },
  { name: 'BERING SEA', lon: -175.00, lat: 58.00, type: 'sea_label', minZoom: 3 },
  { name: 'BERING STRAIT', lon: -168.90, lat: 65.80, type: 'strait', minZoom: 5, isMajor: true },
  { name: 'PHILIPPINE SEA', lon: 132.00, lat: 18.00, type: 'sea_label', minZoom: 3 },
  { name: 'JAVA SEA', lon: 111.00, lat: -5.00, type: 'sea_label', minZoom: 4 },
  { name: 'TIMOR SEA', lon: 128.00, lat: -11.00, type: 'sea_label', minZoom: 4 },
  { name: 'CORAL SEA', lon: 154.00, lat: -18.00, type: 'sea_label', minZoom: 3 },
  { name: 'TASMAN SEA', lon: 160.00, lat: -38.00, type: 'sea_label', minZoom: 3 },
  { name: 'BASS STRAIT', lon: 146.00, lat: -39.50, type: 'strait', minZoom: 5 },
  { name: 'TORRES STRAIT', lon: 142.50, lat: -10.30, type: 'strait', minZoom: 6 },
  { name: 'TAIWAN STRAIT', lon: 119.50, lat: 24.50, type: 'strait', minZoom: 6 },
  { name: 'GULF OF THAILAND', lon: 101.50, lat: 9.50, type: 'sea_label', minZoom: 4 },
  { name: 'CARIBBEAN SEA', lon: -73.00, lat: 15.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'GULF OF MEXICO', lon: -90.00, lat: 25.00, type: 'sea_label', minZoom: 3, isMajor: true },
  { name: 'PANAMA CANAL', lon: -79.90, lat: 9.10, type: 'strait', minZoom: 6, isMajor: true },
  { name: 'STRAIT OF MAGELLAN', lon: -70.50, lat: -53.20, type: 'strait', minZoom: 5, isMajor: true },
  { name: 'DRAKE PASSAGE', lon: -63.00, lat: -59.00, type: 'strait', minZoom: 4, isMajor: true },
  { name: 'GULF OF GUINEA', lon: 2.00, lat: 3.00, type: 'sea_label', minZoom: 4 },
  { name: 'GULF OF ALASKA', lon: -145.00, lat: 57.00, type: 'sea_label', minZoom: 4 },
  { name: 'GULF OF CALIFORNIA', lon: -110.50, lat: 26.50, type: 'sea_label', minZoom: 4 },
  { name: 'LABRADOR SEA', lon: -55.00, lat: 58.00, type: 'sea_label', minZoom: 3 },
  { name: 'HUDSON BAY', lon: -85.00, lat: 60.00, type: 'sea_label', minZoom: 3 },

  // --- OCEANS OF THE WORLD ---
  { name: 'NORTH PACIFIC OCEAN', lon: -160.00, lat: 28.00, type: 'ocean', minZoom: 1, isMajor: true },
  { name: 'SOUTH PACIFIC OCEAN', lon: -120.00, lat: -25.00, type: 'ocean', minZoom: 1, isMajor: true },
  { name: 'NORTH ATLANTIC OCEAN', lon: -38.00, lat: 32.00, type: 'ocean', minZoom: 1, isMajor: true },
  { name: 'SOUTH ATLANTIC OCEAN', lon: -18.00, lat: -25.00, type: 'ocean', minZoom: 1, isMajor: true },
  { name: 'INDIAN OCEAN', lon: 78.00, lat: -15.00, type: 'ocean', minZoom: 1, isMajor: true },
  { name: 'ARCTIC OCEAN', lon: 0.00, lat: 82.00, type: 'ocean', minZoom: 1, isMajor: true },
  { name: 'SOUTHERN OCEAN', lon: 0.00, lat: -60.00, type: 'ocean', minZoom: 1, isMajor: true },

  // --- COUNTRIES OF THE WORLD ---
  { name: 'IRAN', lon: 53.70, lat: 32.40, type: 'country', minZoom: 3, isMajor: true },
  { name: 'SAUDI ARABIA', lon: 45.00, lat: 23.80, type: 'country', minZoom: 3, isMajor: true },
  { name: 'UAE', lon: 54.50, lat: 24.00, type: 'country', minZoom: 4, isMajor: true },
  { name: 'OMAN', lon: 57.00, lat: 21.50, type: 'country', minZoom: 4, isMajor: true },
  { name: 'IRAQ', lon: 43.70, lat: 33.20, type: 'country', minZoom: 4, isMajor: true },
  { name: 'TURKEY', lon: 35.20, lat: 39.00, type: 'country', minZoom: 3, isMajor: true },
  { name: 'RUSSIA', lon: 60.00, lat: 58.00, type: 'country', minZoom: 2, isMajor: true },
  { name: 'CHINA', lon: 104.00, lat: 35.00, type: 'country', minZoom: 2, isMajor: true },
  { name: 'INDIA', lon: 79.00, lat: 21.00, type: 'country', minZoom: 3, isMajor: true },
  { name: 'JAPAN', lon: 138.00, lat: 36.00, type: 'country', minZoom: 3, isMajor: true },
  { name: 'SOUTH KOREA', lon: 128.00, lat: 36.50, type: 'country', minZoom: 4 },
  { name: 'INDONESIA', lon: 118.00, lat: -2.00, type: 'country', minZoom: 3, isMajor: true },
  { name: 'PHILIPPINES', lon: 122.00, lat: 13.00, type: 'country', minZoom: 4 },
  { name: 'VIETNAM', lon: 108.00, lat: 16.00, type: 'country', minZoom: 4 },
  { name: 'THAILAND', lon: 101.00, lat: 15.00, type: 'country', minZoom: 4 },
  { name: 'MALAYSIA', lon: 102.00, lat: 4.00, type: 'country', minZoom: 4 },
  { name: 'PAKISTAN', lon: 69.00, lat: 30.00, type: 'country', minZoom: 4 },
  { name: 'UNITED STATES', lon: -98.00, lat: 38.50, type: 'country', minZoom: 2, isMajor: true },
  { name: 'CANADA', lon: -105.00, lat: 55.00, type: 'country', minZoom: 2, isMajor: true },
  { name: 'MEXICO', lon: -102.00, lat: 23.50, type: 'country', minZoom: 3, isMajor: true },
  { name: 'BRAZIL', lon: -51.00, lat: -14.00, type: 'country', minZoom: 2, isMajor: true },
  { name: 'ARGENTINA', lon: -64.00, lat: -34.00, type: 'country', minZoom: 3, isMajor: true },
  { name: 'CHILE', lon: -71.00, lat: -32.00, type: 'country', minZoom: 3 },
  { name: 'COLOMBIA', lon: -73.00, lat: 4.00, type: 'country', minZoom: 4 },
  { name: 'UNITED KINGDOM', lon: -1.80, lat: 53.00, type: 'country', minZoom: 3, isMajor: true },
  { name: 'FRANCE', lon: 2.20, lat: 46.50, type: 'country', minZoom: 3, isMajor: true },
  { name: 'GERMANY', lon: 10.40, lat: 51.20, type: 'country', minZoom: 3, isMajor: true },
  { name: 'ITALY', lon: 12.50, lat: 42.50, type: 'country', minZoom: 3, isMajor: true },
  { name: 'SPAIN', lon: -3.70, lat: 40.40, type: 'country', minZoom: 3, isMajor: true },
  { name: 'NORWAY', lon: 8.50, lat: 61.00, type: 'country', minZoom: 4 },
  { name: 'SWEDEN', lon: 15.00, lat: 62.00, type: 'country', minZoom: 4 },
  { name: 'GREECE', lon: 22.00, lat: 39.00, type: 'country', minZoom: 4 },
  { name: 'EGYPT', lon: 30.00, lat: 26.50, type: 'country', minZoom: 3, isMajor: true },
  { name: 'SOUTH AFRICA', lon: 24.00, lat: -29.00, type: 'country', minZoom: 3, isMajor: true },
  { name: 'AUSTRALIA', lon: 133.00, lat: -25.00, type: 'country', minZoom: 2, isMajor: true },
  { name: 'NEW ZEALAND', lon: 174.00, lat: -41.00, type: 'country', minZoom: 3 },

  // --- MAJOR GLOBAL CITIES & SEAPORTS ---
  { name: 'London', lon: -0.12, lat: 51.50, type: 'world_city', minZoom: 3, isMajor: true },
  { name: 'Rotterdam Port', lon: 4.48, lat: 51.92, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Hamburg Port', lon: 9.99, lat: 53.55, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Antwerp Port', lon: 4.40, lat: 51.22, type: 'port', minZoom: 5, isMajor: true },
  { name: 'Marseille', lon: 5.37, lat: 43.30, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Barcelona', lon: 2.17, lat: 41.38, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Rome', lon: 12.49, lat: 41.90, type: 'world_city', minZoom: 4 },
  { name: 'Athens (Piraeus)', lon: 23.64, lat: 37.94, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Alexandria', lon: 29.92, lat: 31.20, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Port Said', lon: 32.30, lat: 31.26, type: 'port', minZoom: 5, isMajor: true },
  { name: 'Suez Port', lon: 32.55, lat: 29.97, type: 'port', minZoom: 5, isMajor: true },
  { name: 'Jeddah', lon: 39.19, lat: 21.54, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Mumbai', lon: 72.87, lat: 19.07, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Karachi', lon: 67.00, lat: 24.86, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Colombo', lon: 79.86, lat: 6.93, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Singapore Port', lon: 103.85, lat: 1.29, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Port Klang', lon: 101.40, lat: 3.00, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Bangkok', lon: 100.50, lat: 13.75, type: 'world_city', minZoom: 4 },
  { name: 'Ho Chi Minh City', lon: 106.63, lat: 10.82, type: 'world_city', minZoom: 4 },
  { name: 'Jakarta', lon: 106.84, lat: -6.20, type: 'world_city', minZoom: 3, isMajor: true },
  { name: 'Manila', lon: 120.98, lat: 14.60, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Hong Kong Port', lon: 114.16, lat: 22.32, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Shenzhen Port', lon: 114.05, lat: 22.54, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Guangzhou', lon: 113.26, lat: 23.13, type: 'world_city', minZoom: 4 },
  { name: 'Shanghai Port', lon: 121.47, lat: 31.23, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Ningbo-Zhoushan', lon: 121.55, lat: 29.87, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Qingdao Port', lon: 120.38, lat: 36.06, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Tianjin Port', lon: 117.20, lat: 39.12, type: 'port', minZoom: 4 },
  { name: 'Beijing', lon: 116.40, lat: 39.90, type: 'world_city', minZoom: 3, isMajor: true },
  { name: 'Seoul', lon: 126.97, lat: 37.56, type: 'world_city', minZoom: 3, isMajor: true },
  { name: 'Busan Port', lon: 129.07, lat: 35.18, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Tokyo', lon: 139.69, lat: 35.68, type: 'world_city', minZoom: 3, isMajor: true },
  { name: 'Yokohama Port', lon: 139.63, lat: 35.44, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Kobe Port', lon: 135.19, lat: 34.69, type: 'port', minZoom: 4 },
  { name: 'Vladivostok', lon: 131.88, lat: 43.11, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Sydney', lon: 151.20, lat: -33.86, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Melbourne', lon: 144.96, lat: -37.81, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Brisbane', lon: 153.02, lat: -27.47, type: 'port', minZoom: 4 },
  { name: 'Fremantle (Perth)', lon: 115.74, lat: -32.05, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Auckland', lon: 174.76, lat: -36.85, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Cape Town', lon: 18.42, lat: -33.92, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Durban Port', lon: 31.02, lat: -29.85, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Lagos', lon: 3.37, lat: 6.52, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Rio de Janeiro', lon: -43.17, lat: -22.90, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Santos Port (São Paulo)', lon: -46.33, lat: -23.96, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Buenos Aires', lon: -58.38, lat: -34.60, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Valparaiso', lon: -71.61, lat: -33.04, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Callao (Lima)', lon: -77.15, lat: -12.05, type: 'port', minZoom: 4, isMajor: true },
  { name: 'New York / New Jersey Port', lon: -74.00, lat: 40.71, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Los Angeles Port', lon: -118.24, lat: 33.74, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Long Beach Port', lon: -118.19, lat: 33.77, type: 'port', minZoom: 4, isMajor: true },
  { name: 'San Francisco', lon: -122.41, lat: 37.77, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Seattle', lon: -122.33, lat: 47.60, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Vancouver Port', lon: -123.12, lat: 49.28, type: 'port', minZoom: 3, isMajor: true },
  { name: 'Houston Port', lon: -95.36, lat: 29.76, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Miami Port', lon: -80.19, lat: 25.76, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Panama City (Balboa)', lon: -79.56, lat: 8.95, type: 'port', minZoom: 4, isMajor: true },
  { name: 'Colon (Cristobal)', lon: -79.90, lat: 9.35, type: 'port', minZoom: 5, isMajor: true }
];

// =========================================================================
// 4. Marine Lighthouses & Navigation Aids
// =========================================================================
export const MARINE_LIGHTHOUSES: MarineLighthouse[] = [
  // Persian Gulf & Oman Sea
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
  { name: 'Chabahar Fairway Light', lon: 60.62, lat: 25.28, character: 'Fl(2) W 10s 20M', color: 'white', rangeNm: 20, flashPeriodSec: 10 },

  // Caspian Sea Lighthouses
  { name: 'Bandar Anzali Light', lon: 49.46, lat: 37.48, character: 'Fl(2) G 8s 14M', color: 'green', rangeNm: 14, flashPeriodSec: 8 },
  { name: 'Nowshahr Harbor Light', lon: 51.50, lat: 36.65, character: 'Fl R 4s 12M', color: 'red', rangeNm: 12, flashPeriodSec: 4 },
  { name: 'Amirabad Port Light', lon: 53.37, lat: 36.85, character: 'Fl W 6s 16M', color: 'white', rangeNm: 16, flashPeriodSec: 6 },
  { name: 'Absheron Light (Baku)', lon: 50.36, lat: 40.30, character: 'Fl(2) W 12s 22M', color: 'white', rangeNm: 22, flashPeriodSec: 12 },
  { name: 'Derbent Light', lon: 48.30, lat: 42.06, character: 'Fl W 5s 18M', color: 'white', rangeNm: 18, flashPeriodSec: 5 },

  // Black Sea Lighthouses
  { name: 'Rumelifeneri (Bosphorus North)', lon: 29.11, lat: 41.23, character: 'Fl(2) W 12s 20M', color: 'white', rangeNm: 20, flashPeriodSec: 12 },
  { name: 'Sinop Inceburun Light', lon: 34.95, lat: 42.10, character: 'Fl W 8s 18M', color: 'white', rangeNm: 18, flashPeriodSec: 8 },
  { name: 'Trabzon Port Light', lon: 39.73, lat: 41.01, character: 'Fl G 5s 14M', color: 'green', rangeNm: 14, flashPeriodSec: 5 },
  { name: 'Batumi Light', lon: 41.64, lat: 41.64, character: 'Fl W 7.5s 16M', color: 'white', rangeNm: 16, flashPeriodSec: 7.5 },
  { name: 'Sevastopol Khersones Light', lon: 33.38, lat: 44.58, character: 'Fl(3) W 15s 24M', color: 'white', rangeNm: 24, flashPeriodSec: 15 },
  { name: 'Constanța Light', lon: 28.66, lat: 44.18, character: 'Fl W 10s 22M', color: 'white', rangeNm: 22, flashPeriodSec: 10 }
];

// =========================================================================
// 5. Traffic Separation Schemes (TSS) & Shipping Fairways
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
  // Hormuz Separation Zone
  {
    name: 'Hormuz TSS Separation Zone',
    laneType: 'separation_zone',
    points: [
      [54.50, 26.55], [55.20, 26.50], [55.80, 26.55], [56.28, 26.58], [56.60, 26.42], [56.88, 26.18]
    ]
  },
  // Persian Gulf Central Tanker Route
  {
    name: 'Persian Gulf Central Tanker Route',
    laneType: 'fairway',
    directionDeg: 300,
    points: [
      [54.50, 26.50], [53.80, 26.90], [52.80, 27.50], [51.50, 28.30], [50.50, 29.00], [49.20, 29.80]
    ]
  },
  // Caspian Sea Central Shipping Corridor
  {
    name: 'Caspian Sea Main Shipping Corridor',
    laneType: 'fairway',
    directionDeg: 355,
    points: [
      [50.00, 37.60], [50.20, 38.50], [50.60, 40.00], [50.40, 41.50], [49.50, 43.50], [48.50, 45.50]
    ]
  },
  // Black Sea Main Shipping Corridor
  {
    name: 'Black Sea Bosphorus Corridor',
    laneType: 'fairway',
    directionDeg: 45,
    points: [
      [29.20, 41.30], [30.50, 42.20], [32.50, 43.00], [35.00, 43.60], [37.20, 44.20]
    ]
  }
];

// =========================================================================
// 6. Marine Anchorages & Recommended Anchorage Zones
// =========================================================================
export const MARINE_ANCHORAGES: MarineAnchorage[] = [
  { name: 'Kish Commercial Anchorage', lon: 54.03, lat: 26.58, radiusNm: 1.5, type: 'commercial' },
  { name: 'Shahid Rajaee Outer Anchorage', lon: 56.05, lat: 27.05, radiusNm: 2.5, type: 'commercial' },
  { name: 'Bandar Abbas Naval & General Anchorage', lon: 56.25, lat: 27.12, radiusNm: 2.0, type: 'general' },
  { name: 'Bushehr Outer Anchorage', lon: 50.78, lat: 28.95, radiusNm: 2.0, type: 'commercial' },
  { name: 'Kharg Oil Terminal Waiting Area', lon: 50.38, lat: 29.22, radiusNm: 3.0, type: 'tanker' },
  { name: 'Asaluyeh Gas Carrier Anchorage', lon: 52.55, lat: 27.42, radiusNm: 2.5, type: 'tanker' },
  { name: 'Fujairah Offshore Bunker Anchorage', lon: 56.45, lat: 25.20, radiusNm: 4.0, type: 'tanker' },
  { name: 'Bandar Anzali Outer Anchorage', lon: 49.50, lat: 37.52, radiusNm: 2.0, type: 'commercial' },
  { name: 'Baku Bay Roadstead Anchorage', lon: 49.92, lat: 40.35, radiusNm: 2.5, type: 'commercial' },
  { name: 'Istanbul Bosphorus North Roadstead', lon: 29.15, lat: 41.28, radiusNm: 3.0, type: 'commercial' }
];

// =========================================================================
// 7. Marine Hazards, Shoals & Submerged Obstructions
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
// 8. High-Resolution Bathymetry Depth Contours
// =========================================================================
export const BATHYMETRY_CONTOURS: BathymetryDepthContour[] = [
  // Persian Gulf Coastal 5m & 10m
  {
    depthMeters: 5,
    label: '5m Persian Gulf Coastal',
    points: [
      [48.5, 30.0], [49.2, 30.3], [50.1, 29.8], [50.8, 29.1], [51.3, 28.3],
      [52.2, 27.6], [53.3, 26.8], [54.0, 26.7], [54.8, 26.7], [55.6, 27.1],
      [56.3, 27.1], [56.1, 26.9], [55.3, 26.3], [54.2, 25.6], [52.6, 24.9],
      [51.6, 25.9], [50.3, 26.9], [48.5, 30.0]
    ]
  },
  {
    depthMeters: 10,
    label: '10m Persian Gulf Shelf',
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
    label: '80m Hormuz Deep Trench',
    points: [
      [52.8, 27.0], [53.8, 26.6], [54.6, 26.3], [55.5, 26.3], [56.2, 26.4],
      [56.5, 26.2], [55.8, 26.0], [54.5, 26.0], [53.5, 26.3], [52.8, 27.0]
    ]
  },
  // Gulf of Oman Deep Waters
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
  // Caspian Sea Bathymetry Contours
  {
    depthMeters: 20,
    label: '20m Caspian Shelf',
    points: [
      [49.2, 37.6], [50.0, 37.5], [51.5, 37.0], [53.0, 37.0], [53.6, 37.3],
      [53.4, 38.0], [53.0, 39.0], [52.8, 40.5], [51.0, 44.0], [49.5, 45.0],
      [48.0, 44.5], [47.8, 43.0], [48.4, 41.5], [49.6, 40.2], [49.0, 38.5],
      [49.2, 37.6]
    ]
  },
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
    label: '500m Caspian Deep Basin',
    points: [
      [50.5, 38.6], [51.8, 38.8], [52.2, 38.0], [51.0, 37.8], [50.5, 38.6]
    ]
  },
  // Black Sea Bathymetry Contours
  {
    depthMeters: 100,
    label: '100m Black Sea Shelf Break',
    points: [
      [29.5, 41.5], [31.5, 41.5], [35.0, 42.2], [38.0, 41.2], [41.2, 41.8],
      [40.8, 42.8], [39.0, 44.0], [37.0, 44.8], [35.0, 44.8], [33.0, 44.4],
      [31.5, 45.0], [29.8, 44.5], [28.8, 43.5], [28.5, 42.2], [29.5, 41.5]
    ]
  },
  {
    depthMeters: 1000,
    label: '1000m Black Sea Deep Plain',
    points: [
      [30.5, 42.0], [33.5, 42.5], [37.0, 42.5], [39.5, 42.8],
      [38.0, 43.8], [35.5, 44.2], [33.0, 43.8], [31.0, 43.0], [30.5, 42.0]
    ]
  }
];

// =========================================================================
// 9. High-Density Nautical Soundings (in meters)
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

  // Gulf of Oman
  { lon: 57.20, lat: 25.60, depthMeters: 210, type: 'deep' },
  { lon: 57.80, lat: 25.50, depthMeters: 450, type: 'deep' },
  { lon: 58.50, lat: 25.00, depthMeters: 850, type: 'deep' },
  { lon: 59.80, lat: 24.60, depthMeters: 1420, type: 'trench' },
  { lon: 60.60, lat: 25.10, depthMeters: 85, type: 'shelf' },
  { lon: 60.65, lat: 25.26, depthMeters: 16, type: 'shoal' },
  { lon: 61.50, lat: 24.80, depthMeters: 1850, type: 'trench' },

  // Caspian Sea Soundings
  { lon: 49.48, lat: 37.52, depthMeters: 14, type: 'shoal' },
  { lon: 49.80, lat: 37.65, depthMeters: 32, type: 'shelf' },
  { lon: 50.20, lat: 37.60, depthMeters: 45, type: 'shelf' },
  { lon: 51.00, lat: 38.50, depthMeters: 480, type: 'deep' },
  { lon: 51.52, lat: 36.72, depthMeters: 28, type: 'shoal' },
  { lon: 52.00, lat: 37.80, depthMeters: 740, type: 'deep' },
  { lon: 53.38, lat: 36.90, depthMeters: 18, type: 'shoal' },
  { lon: 53.50, lat: 37.00, depthMeters: 42, type: 'shelf' },
  { lon: 49.95, lat: 40.32, depthMeters: 24, type: 'shoal' },
  { lon: 48.35, lat: 42.10, depthMeters: 38, type: 'shoal' },

  // Black Sea Soundings
  { lon: 29.25, lat: 41.35, depthMeters: 55, type: 'shelf' },
  { lon: 35.10, lat: 42.15, depthMeters: 92, type: 'shelf' },
  { lon: 39.75, lat: 41.05, depthMeters: 48, type: 'shoal' },
  { lon: 41.60, lat: 41.68, depthMeters: 35, type: 'shoal' },
  { lon: 33.45, lat: 44.65, depthMeters: 64, type: 'shelf' },
  { lon: 30.80, lat: 46.42, depthMeters: 18, type: 'shoal' },
  { lon: 28.72, lat: 44.15, depthMeters: 26, type: 'shoal' },
  { lon: 34.00, lat: 43.00, depthMeters: 2150, type: 'deep' }
];

// =========================================================================
// 10. Offshore Oil & Gas Platforms
// =========================================================================
export const MARINE_OIL_PLATFORMS: MarineOilPlatform[] = [
  // South Pars Gas Field Complex
  { name: 'South Pars SPD-1', field: 'South Pars', lon: 52.12, lat: 27.22, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 2/3', field: 'South Pars', lon: 52.20, lat: 27.15, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 4/5', field: 'South Pars', lon: 52.32, lat: 27.08, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 12 (Deep)', field: 'South Pars', lon: 52.48, lat: 26.92, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Phase 14', field: 'South Pars', lon: 52.38, lat: 26.85, type: 'gas_platform', lights: 'Mo(U) 15s White' },
  { name: 'South Pars Flare Complex', field: 'South Pars', lon: 52.25, lat: 27.18, type: 'flair', lights: 'Continuous Flare' },

  // Salman, Siri, Foroozan
  { name: 'Salman 2DP Complex', field: 'Salman Field', lon: 53.33, lat: 25.88, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Siri A Platform', field: 'Siri Field', lon: 54.52, lat: 25.88, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Reshadat Complex', field: 'Reshadat Field', lon: 53.82, lat: 25.90, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Foroozan F-18 Rig', field: 'Foroozan Field', lon: 50.25, lat: 29.25, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Aboozar Complex (AA/AB)', field: 'Aboozar Field', lon: 50.15, lat: 29.35, type: 'oil_rig', lights: 'Mo(U) 15s White' },
  { name: 'Kharg Sea Island SPM', field: 'Kharg Terminal', lon: 50.36, lat: 29.21, type: 'loading_buoy', lights: 'Q.Fl.W' }
];

// =========================================================================
// 11. Navigation Buoys & Aids (IALA Buoyage System)
// =========================================================================
export const MARINE_BUOYS: MarineBuoy[] = [
  { name: 'Kish Fairway Safe Water', lon: 54.02, lat: 26.57, buoyType: 'safe_water', lightChar: 'Iso.4s', color: '#ef4444' },
  { name: 'Kish Port Red Can (Port)', lon: 54.018, lat: 26.558, buoyType: 'port', lightChar: 'Q.R', color: '#dc2626' },
  { name: 'Kish Port Green Cone (Stbd)', lon: 54.015, lat: 26.555, buoyType: 'starboard', lightChar: 'Fl.G.3s', color: '#16a34a' },
  { name: 'Kish South Coral Mark', lon: 53.95, lat: 26.48, buoyType: 'cardinal_south', lightChar: 'VQ(6)+LFl.10s', color: '#eab308' },
  { name: 'Hormuz North Cardinal Buoy', lon: 56.32, lat: 26.42, buoyType: 'cardinal_north', lightChar: 'VQ.W', color: '#eab308' },
  { name: 'Hormuz South Cardinal Buoy', lon: 56.45, lat: 26.15, buoyType: 'cardinal_south', lightChar: 'VQ(6)+LFl.10s', color: '#eab308' },
  { name: 'Rajaee Port Fairway Buoy', lon: 56.02, lat: 27.02, buoyType: 'safe_water', lightChar: 'Mo(A).8s', color: '#ef4444' },
  { name: 'Bushehr Outer Fairway Buoy', lon: 50.75, lat: 28.98, buoyType: 'safe_water', lightChar: 'LFl.10s', color: '#ef4444' },
  { name: 'Asaluyeh Port Entrance Buoy', lon: 52.55, lat: 27.48, buoyType: 'starboard', lightChar: 'Fl.G.4s', color: '#16a34a' },
  { name: 'Kharg Island West Danger Buoy', lon: 50.28, lat: 29.25, buoyType: 'isolated_danger', lightChar: 'Fl(2).W.6s', color: '#0f172a' },
  { name: 'Chabahar Fairway Safe Water', lon: 60.60, lat: 25.30, buoyType: 'safe_water', lightChar: 'Iso.6s', color: '#ef4444' },
  { name: 'Bandar Anzali Fairway Buoy', lon: 49.48, lat: 37.52, buoyType: 'safe_water', lightChar: 'Mo(A).8s', color: '#ef4444' },
  { name: 'Nowshahr Approach Buoy', lon: 51.52, lat: 36.68, buoyType: 'starboard', lightChar: 'Fl.G.3s', color: '#16a34a' }
];

// =========================================================================
// 12. Submarine Pipelines, Power Cables & Restricted Zones
// =========================================================================
export const SUBMARINE_PIPELINES_AND_CABLES: SubmarinePipeline[] = [
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
  {
    name: 'Siri-Kish Gas Submarine Pipeline',
    type: 'gas_pipeline',
    points: [
      [54.52, 25.90], [54.30, 26.15], [54.15, 26.35], [54.02, 26.52]
    ]
  },
  {
    name: 'Genaveh-Kharg Subsea Crude Pipeline',
    type: 'oil_pipeline',
    points: [
      [50.51, 29.56], [50.45, 29.45], [50.35, 29.30], [50.32, 29.24]
    ]
  },
  {
    name: 'Bandar Abbas-Qeshm HV Subsea Cable',
    type: 'power_cable',
    points: [
      [56.12, 27.10], [56.16, 27.02], [56.18, 26.96], [56.20, 26.92]
    ]
  },
  {
    name: 'Bushehr Maritime Protection Zone',
    type: 'restricted_area',
    points: [
      [50.80, 28.90], [50.90, 28.90], [50.90, 28.80], [50.80, 28.80], [50.80, 28.90]
    ]
  }
];

// =========================================================================
// 13. Marine Tidal Stream & Current Vectors
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
  { name: 'Caspian Southern Shore Gyre', lon: 51.50, lat: 37.40, bearingDeg: 90, rateKnots: 0.8 },
  { name: 'Black Sea Rim Current', lon: 35.00, lat: 42.80, bearingDeg: 270, rateKnots: 1.2 }
];

// =========================================================================
// 14. Default Marine Routes
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
