import { CompassData, GpsData, NmeaConfig, NmeaSentenceConfig, ParsedNmeaData } from '../types';

/**
 * Available NMEA 0183 Sentences configuration catalog
 */
export const AVAILABLE_SENTENCES: NmeaSentenceConfig[] = [
  // Heading Sentences
  {
    id: 'HDG',
    name: 'Heading, Dev & Var ($HCHDG)',
    category: 'heading',
    description: 'Magnetic heading with deviation and magnetic variation calculation for autopilots & ECDIS.',
    sample: '$HCHDG,045.2,,,2.1,E*2C',
    enabled: true,
  },
  {
    id: 'HDT',
    name: 'Heading True ($HCHDT / $HEHDT)',
    category: 'heading',
    description: 'Standard True Heading sentence (degrees True). Supported by marine radars and gyro repeaters.',
    sample: '$HCHDT,047.3,T*2B',
    enabled: true,
  },
  {
    id: 'HDM',
    name: 'Heading Magnetic ($HCHDM)',
    category: 'heading',
    description: 'Direct magnetic heading from internal fluxgate/magnetometer sensor.',
    sample: '$HCHDM,045.2,M*22',
    enabled: false,
  },
  {
    id: 'THS',
    name: 'True Heading & Status ($INTHS)',
    category: 'heading',
    description: 'High integrity True Heading with autonomous fix/valid status code.',
    sample: '$INTHS,047.3,A*1E',
    enabled: false,
  },
  {
    id: 'VHW',
    name: 'Water Speed & Heading ($IIVHW)',
    category: 'heading',
    description: 'True & magnetic heading along with vessel ground speed.',
    sample: '$IIVHW,047.3,T,045.2,M,12.4,N,23.0,K*5C',
    enabled: false,
  },
  // GPS & Navigation Sentences
  {
    id: 'RMC',
    name: 'Recommended Minimum Data ($GPRMC / $GNRMC)',
    category: 'gps',
    description: 'Standard marine GPS sentence with position, Speed Over Ground (SOG), Course Over Ground (COG), date & variation.',
    sample: '$GPRMC,123519.00,A,2517.8420,N,05518.2910,E,12.4,047.3,190826,002.1,E*7E',
    enabled: true,
  },
  {
    id: 'GGA',
    name: 'GPS Fix Data ($GPGGA / $GNGGA)',
    category: 'gps',
    description: 'Time, latitude, longitude, fix quality (1=GPS, 2=DGPS), satellites count, HDOP & altitude above MSL.',
    sample: '$GPGGA,123519.00,2517.8420,N,05518.2910,E,1,08,0.9,15.2,M,-1.5,M,,*47',
    enabled: true,
  },
  {
    id: 'GLL',
    name: 'Geographic Position ($GPGLL / $GNGLL)',
    category: 'gps',
    description: 'Concise latitude, longitude, UTC time of fix and status.',
    sample: '$GPGLL,2517.8420,N,05518.2910,E,123519.00,A,A*69',
    enabled: false,
  },
  {
    id: 'VTG',
    name: 'Course & Ground Speed ($GPVTG / $GNVTG)',
    category: 'motion',
    description: 'Track Made Good (True and Magnetic) and Ground Speed in Knots and Kilometers/hour.',
    sample: '$GPVTG,047.3,T,045.2,M,12.4,N,23.0,K,A*21',
    enabled: true,
  },
  {
    id: 'ZDA',
    name: 'Time & Date ($GPZDA / $GNZDA)',
    category: 'time',
    description: 'UTC Time, day, month, year, and local zone hours & minutes.',
    sample: '$GPZDA,123519.00,19,08,2026,00,00*6B',
    enabled: false,
  },
];

/**
 * Calculates standard NMEA 0183 8-bit XOR Checksum
 * Characters between '$' (or '!') and '*' are XORed together.
 */
export function calculateNmeaChecksum(sentenceWithoutDollarAndStar: string): string {
  let checksum = 0;
  for (let i = 0; i < sentenceWithoutDollarAndStar.length; i++) {
    checksum ^= sentenceWithoutDollarAndStar.charCodeAt(i);
  }
  const hex = checksum.toString(16).toUpperCase();
  return hex.length === 1 ? '0' + hex : hex;
}

/**
 * Append checksum and CRLF to a sentence payload (excluding $)
 */
export function buildNmeaSentence(payloadWithoutDollar: string): string {
  const checksum = calculateNmeaChecksum(payloadWithoutDollar);
  return `$${payloadWithoutDollar}*${checksum}\r\n`;
}

/**
 * Convert decimal degrees to NMEA coordinate format:
 * Lat: DDMM.MMMM (e.g. 25° 17.8420' -> 2517.8420)
 * Lon: DDDMM.MMMM (e.g. 55° 18.2910' -> 05518.2910)
 */
function toNmeaLat(lat: number): { coord: string; hemi: string } {
  const hemi = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = deg.toString().padStart(2, '0');
  const minStr = min.toFixed(4).padStart(7, '0');
  return { coord: `${degStr}${minStr}`, hemi };
}

function toNmeaLon(lon: number): { coord: string; hemi: string } {
  const hemi = lon >= 0 ? 'E' : 'W';
  const abs = Math.abs(lon);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const degStr = deg.toString().padStart(3, '0');
  const minStr = min.toFixed(4).padStart(7, '0');
  return { coord: `${degStr}${minStr}`, hemi };
}

/**
 * Format UTC time in hhmmss.ss
 */
function toNmeaTime(date: Date): string {
  const h = date.getUTCHours().toString().padStart(2, '0');
  const m = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = Math.floor(date.getUTCMilliseconds() / 10).toString().padStart(2, '0');
  return `${h}${m}${s}.${ms}`;
}

/**
 * Format UTC date in ddmmyy
 */
function toNmeaDate(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, '0');
  const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const y = (date.getUTCFullYear() % 100).toString().padStart(2, '0');
  return `${d}${m}${y}`;
}

/**
 * Generate a complete bundle of enabled NMEA 0183 sentences
 */
export function generateNmeaSentences(
  gps: GpsData,
  compass: CompassData,
  config: NmeaConfig
): string[] {
  const sentences: string[] = [];
  const now = new Date();
  const timeStr = toNmeaTime(now);
  const dateStr = toNmeaDate(now);

  const hasGps = gps.latitude !== null && gps.longitude !== null;
  const latData = hasGps ? toNmeaLat(gps.latitude!) : { coord: '', hemi: '' };
  const lonData = hasGps ? toNmeaLon(gps.longitude!) : { coord: '', hemi: '' };
  const status = hasGps ? 'A' : 'V'; // A = Active/Valid, V = Void

  const sogKnots = gps.speedKnots !== null ? gps.speedKnots.toFixed(1) : '0.0';
  const sogKmh = gps.speedKmh !== null ? gps.speedKmh.toFixed(1) : '0.0';
  const cogTrue = gps.heading !== null ? gps.heading.toFixed(1) : compass.trueHeading.toFixed(1);
  const cogMag = compass.magneticHeading.toFixed(1);

  const magVarAbs = Math.abs(config.magVariation).toFixed(1);
  const magVarHemi = config.magVariation >= 0 ? 'E' : 'W';

  const talkerGps = config.talkerIdGps || 'GP';
  const talkerHdg = config.talkerIdHeading || 'HC';

  // 1. HDG - Heading, Dev & Var
  if (config.activeSentences['HDG']) {
    // $HCHDG,heading,deviation,dev_dir,variation,var_dir
    const payload = `${talkerHdg}HDG,${cogMag},,,${magVarAbs},${magVarHemi}`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 2. HDT - Heading True
  if (config.activeSentences['HDT']) {
    // $HCHDT,heading,T
    const payload = `${talkerHdg}HDT,${compass.trueHeading.toFixed(1)},T`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 3. HDM - Heading Magnetic
  if (config.activeSentences['HDM']) {
    // $HCHDM,heading,M
    const payload = `${talkerHdg}HDM,${cogMag},M`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 4. THS - True Heading and Status
  if (config.activeSentences['THS']) {
    // $INTHS,heading,mode (A=Autonomous, E=Estimated, M=Manual, S=Simulator, V=Invalid)
    const mode = compass.calibrated ? 'A' : 'E';
    const payload = `INTHS,${compass.trueHeading.toFixed(1)},${mode}`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 5. VHW - Water Speed and Heading
  if (config.activeSentences['VHW']) {
    // $IIVHW,hdg_true,T,hdg_mag,M,sog_kts,N,sog_kmh,K
    const payload = `IIVHW,${compass.trueHeading.toFixed(1)},T,${cogMag},M,${sogKnots},N,${sogKmh},K`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 6. RMC - Recommended Minimum Specific GPS/Transit Data
  if (config.activeSentences['RMC']) {
    // $GPRMC,hhmmss.ss,status,lat,N,lon,E,sog,cog,ddmmyy,var,E,mode
    const mode = hasGps ? 'A' : 'N';
    const payload = `${talkerGps}RMC,${timeStr},${status},${latData.coord},${latData.hemi},${lonData.coord},${lonData.hemi},${sogKnots},${cogTrue},${dateStr},${magVarAbs},${magVarHemi},${mode}`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 7. GGA - Global Positioning System Fix Data
  if (config.activeSentences['GGA']) {
    // $GPGGA,hhmmss.ss,lat,N,lon,E,fix,sats,hdop,alt,M,geoid,M,dgps_age,dgps_id
    const fixQuality = hasGps ? (gps.fixType === 'DGPS' ? '2' : '1') : '0';
    const sats = gps.satellites.toString().padStart(2, '0');
    const hdop = gps.hdop.toFixed(1);
    const alt = gps.altitude !== null ? gps.altitude.toFixed(1) : '0.0';
    const payload = `${talkerGps}GGA,${timeStr},${latData.coord},${latData.hemi},${lonData.coord},${lonData.hemi},${fixQuality},${sats},${hdop},${alt},M,0.0,M,,`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 8. GLL - Geographic Position - Latitude/Longitude
  if (config.activeSentences['GLL']) {
    // $GPGLL,lat,N,lon,E,hhmmss.ss,status,mode
    const mode = hasGps ? 'A' : 'N';
    const payload = `${talkerGps}GLL,${latData.coord},${latData.hemi},${lonData.coord},${lonData.hemi},${timeStr},${status},${mode}`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 9. VTG - Track Made Good and Ground Speed
  if (config.activeSentences['VTG']) {
    // $GPVTG,cog_true,T,cog_mag,M,sog_kts,N,sog_kmh,K,mode
    const mode = hasGps ? 'A' : 'N';
    const payload = `${talkerGps}VTG,${cogTrue},T,${cogMag},M,${sogKnots},N,${sogKmh},K,${mode}`;
    sentences.push(buildNmeaSentence(payload));
  }

  // 10. ZDA - Time & Date
  if (config.activeSentences['ZDA']) {
    // $GPZDA,hhmmss.ss,dd,mm,yyyy,00,00
    const day = now.getUTCDate().toString().padStart(2, '0');
    const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = now.getUTCFullYear().toString();
    const payload = `${talkerGps}ZDA,${timeStr},${day},${month},${year},00,00`;
    sentences.push(buildNmeaSentence(payload));
  }

  return sentences;
}

/**
 * Validate and parse incoming NMEA 0183 sentence
 */
export function parseNmeaSentence(rawSentence: string): {
  isValid: boolean;
  type: string;
  talker: string;
  summary: string;
  parsed?: ParsedNmeaData;
} {
  const clean = rawSentence.trim();
  if (!clean.startsWith('$') && !clean.startsWith('!')) {
    return { isValid: false, type: 'UNKNOWN', talker: '', summary: 'Invalid header' };
  }

  const starIndex = clean.indexOf('*');
  if (starIndex === -1) {
    return { isValid: false, type: 'UNKNOWN', talker: '', summary: 'Missing checksum delimiter' };
  }

  const sentenceBody = clean.substring(1, starIndex);
  const checksumProvided = clean.substring(starIndex + 1, starIndex + 3).toUpperCase();
  const checksumComputed = calculateNmeaChecksum(sentenceBody);

  const isValid = checksumProvided === checksumComputed;

  const parts = sentenceBody.split(',');
  const header = parts[0] || '';
  const talker = header.length >= 5 ? header.substring(0, 2) : '';
  const type = header.length >= 5 ? header.substring(2) : header;

  const result: ParsedNmeaData = {
    type,
    talker,
    raw: clean,
  };

  let summary = `${header}: `;

  try {
    if (type === 'RMC') {
      // $--RMC,time,status,lat,NS,lon,EW,spd,cog,date,var,varEW,mode
      const status = parts[2];
      const latStr = parts[3];
      const latHemi = parts[4];
      const lonStr = parts[5];
      const lonHemi = parts[6];
      const spd = parseFloat(parts[7]);
      const cog = parseFloat(parts[8]);

      if (latStr && latHemi && lonStr && lonHemi) {
        result.latitude = `${latStr.slice(0, 2)}° ${latStr.slice(2)}' ${latHemi}`;
        result.longitude = `${lonStr.slice(0, 3)}° ${lonStr.slice(3)}' ${lonHemi}`;
      }
      if (!isNaN(spd)) result.sogKnots = spd;
      if (!isNaN(cog)) result.cogTrue = cog;

      summary += `Status: ${status === 'A' ? 'Active' : 'Void'}, SOG: ${isNaN(spd) ? '--' : spd} kts, COG: ${isNaN(cog) ? '--' : cog}°`;
    } else if (type === 'GGA') {
      // $--GGA,time,lat,NS,lon,EW,fix,sats,hdop,alt,M,...
      const latStr = parts[2];
      const latHemi = parts[3];
      const lonStr = parts[4];
      const lonHemi = parts[5];
      const fix = parts[6];
      const sats = parseInt(parts[7], 10);
      const hdop = parseFloat(parts[8]);
      const alt = parseFloat(parts[9]);

      if (latStr && latHemi && lonStr && lonHemi) {
        result.latitude = `${latStr.slice(0, 2)}° ${latStr.slice(2)}' ${latHemi}`;
        result.longitude = `${lonStr.slice(0, 3)}° ${lonStr.slice(3)}' ${lonHemi}`;
      }
      result.fixQuality = fix === '1' ? 'GPS Fix' : fix === '2' ? 'DGPS Fix' : 'No Fix';
      if (!isNaN(sats)) result.satellites = sats;
      if (!isNaN(hdop)) result.hdop = hdop;
      if (!isNaN(alt)) result.altitudeMeters = alt;

      summary += `Fix: ${result.fixQuality}, Sats: ${isNaN(sats) ? '--' : sats}, HDOP: ${isNaN(hdop) ? '--' : hdop}, Alt: ${isNaN(alt) ? '--' : alt}m`;
    } else if (type === 'HDT' || type === 'THS') {
      // $--HDT,heading,T
      const hdg = parseFloat(parts[1]);
      if (!isNaN(hdg)) {
        result.headingTrue = hdg;
        summary += `Heading True: ${hdg.toFixed(1)}°`;
      }
    } else if (type === 'HDG' || type === 'HDM') {
      // $--HDG,heading,...
      const hdg = parseFloat(parts[1]);
      if (!isNaN(hdg)) {
        result.headingMag = hdg;
        summary += `Heading Mag: ${hdg.toFixed(1)}°`;
      }
    } else if (type === 'VTG') {
      // $--VTG,cog_t,T,cog_m,M,spd_n,N,spd_k,K
      const cogT = parseFloat(parts[1]);
      const spdKts = parseFloat(parts[5]);
      if (!isNaN(cogT)) result.cogTrue = cogT;
      if (!isNaN(spdKts)) result.sogKnots = spdKts;
      summary += `COG: ${isNaN(cogT) ? '--' : cogT}°, SOG: ${isNaN(spdKts) ? '--' : spdKts} kts`;
    } else {
      summary += parts.slice(1, 5).join(', ');
    }
  } catch (e) {
    summary += 'Parse Error';
  }

  return {
    isValid,
    type,
    talker,
    summary,
    parsed: result,
  };
}
