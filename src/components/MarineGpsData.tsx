import React, { useState, useEffect } from 'react';
import { 
  Anchor, 
  MapPin, 
  Satellite, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertTriangle, 
  Sliders, 
  CheckCircle2, 
  LocateFixed,
  Compass
} from 'lucide-react';
import { CoordFormat, GpsData } from '../types';
import { formatMarineDD, formatMarineDDM, formatMarineDMS, formatHeadingDeg } from '../utils/geo';

interface MarineGpsDataProps {
  gps: GpsData;
  magVariation: number;
  hasRealGps: boolean;
  isGpsAcquiring: boolean;
  gpsError: string | null;
  gpsPermissionState: 'granted' | 'prompt' | 'denied' | 'unknown';
  onRequestGps: () => void;
  onSetManualGps?: (lat: number, lon: number) => void;
  isNightMode?: boolean;
}

export const MarineGpsData: React.FC<MarineGpsDataProps> = ({
  gps,
  magVariation,
  hasRealGps,
  isGpsAcquiring,
  gpsError,
  gpsPermissionState,
  onRequestGps,
  onSetManualGps,
  isNightMode = false,
}) => {
  const [coordFormat, setCoordFormat] = useState<CoordFormat>('DDM');
  const [utcTime, setUtcTime] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showManualCoordModal, setShowManualCoordModal] = useState(false);
  const [customLat, setCustomLat] = useState<string>('');
  const [customLon, setCustomLon] = useState<string>('');

  // UTC chronometer clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        `${now.getUTCHours().toString().padStart(2, '0')}:${now
          .getUTCMinutes()
          .toString()
          .padStart(2, '0')}:${now.getUTCSeconds().toString().padStart(2, '0')} UTC`
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCoord = (val: number | null, isLon: boolean) => {
    if (val === null) return isLon ? '---° --.--- E' : '--° --.--- N';
    if (coordFormat === 'DDM') return formatMarineDDM(val, isLon);
    if (coordFormat === 'DMS') return formatMarineDMS(val, isLon);
    return formatMarineDD(val, isLon);
  };

  const copyCoordinates = () => {
    if (gps.latitude === null || gps.longitude === null) return;
    const text = `LAT: ${formatMarineDDM(gps.latitude, false)}, LON: ${formatMarineDDM(gps.longitude, true)}, SOG: ${gps.speedKnots?.toFixed(1) || 0} kts, COG: ${formatHeadingDeg(gps.heading)}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyManualCoords = () => {
    const lat = parseFloat(customLat);
    const lon = parseFloat(customLon);
    if (!isNaN(lat) && !isNaN(lon) && onSetManualGps) {
      onSetManualGps(lat, lon);
      setShowManualCoordModal(false);
    }
  };

  return (
    <div
      id="marine-gps-cluster"
      className={`p-6 rounded-2xl border transition-all ${
        isNightMode
          ? 'bg-zinc-950/80 border-red-900/50 text-red-100 shadow-xl'
          : 'bg-slate-800/40 border-slate-700 text-slate-200 shadow-xl'
      }`}
    >
      {/* Top Header: Title, Real GPS Status Badge & Format Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-700">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Anchor className={`w-4 h-4 ${isNightMode ? 'text-red-400' : 'text-cyan-400'}`} />
          <h2 className="text-xs uppercase font-bold tracking-wider text-slate-300">
            GNSS / GPS Receiver
          </h2>

          {/* Real Phone GPS Live Status Badge */}
          {hasRealGps && gps.latitude !== null ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[11px] font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVE GPS ACTIVE (±{gps.accuracy ? gps.accuracy.toFixed(1) : '3'}m)</span>
            </div>
          ) : isGpsAcquiring ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/50 text-amber-300 text-[11px] font-mono font-bold">
              <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
              <span>SEARCHING SATELLITES...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[11px] font-mono font-bold">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>NO GPS FIX</span>
            </div>
          )}
        </div>

        {/* Action Buttons & Format Selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Refresh / Re-request GPS */}
          <button
            type="button"
            onClick={onRequestGps}
            title="Request Real GPS Position from Device"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 hover:text-white hover:border-cyan-500 text-xs font-bold transition-all"
          >
            <LocateFixed className={`w-3.5 h-3.5 ${isGpsAcquiring ? 'animate-spin' : ''}`} />
            <span>{isGpsAcquiring ? 'Reading...' : 'Refresh GPS'}</span>
          </button>

          {/* Format Selector */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 text-[11px]">
            {(['DDM', 'DMS', 'DD'] as CoordFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => setCoordFormat(fmt)}
                className={`px-2 py-0.5 rounded font-mono font-bold transition-all ${
                  coordFormat === fmt
                    ? isNightMode
                      ? 'bg-red-700 text-white'
                      : 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GPS Warning / Permission Alert Banner if not locked */}
      {!hasRealGps && (
        <div className="my-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Satellite className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <div className="font-bold text-white text-xs">
                {gpsError || 'Acquiring satellite constellation fix from your device...'}
              </div>
              <div className="text-[11px] text-amber-300/80 mt-0.5">
                For live marine position, ensure device <strong>Location / GPS</strong> is enabled and permission is granted.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestGps}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 shadow transition-all"
          >
            Acquire GNSS Fix
          </button>
        </div>
      )}

      {/* Main Coordinates Row (Large High-Visibility Marine Typography) */}
      <div className="py-5 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
        {/* Latitude */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider flex items-center gap-1.5">
            <span>Latitude ({coordFormat})</span>
            {hasRealGps && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
          </span>
          <span className="text-2xl sm:text-3xl font-mono text-white font-bold tracking-tight">
            {formatCoord(gps.latitude, false)}
          </span>
        </div>

        {/* Longitude */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Longitude ({coordFormat})</span>
              {hasRealGps && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </span>
            {hasRealGps && gps.latitude !== null && (
              <button
                type="button"
                onClick={copyCoordinates}
                className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            )}
          </div>
          <span className="text-2xl sm:text-3xl font-mono text-white font-bold tracking-tight">
            {formatCoord(gps.longitude, true)}
          </span>
        </div>

        {/* Altitude & Chrono */}
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
            Altitude / UTC Chronometer
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-mono text-slate-300 font-bold tracking-tight">
              {gps.altitude !== null ? `${gps.altitude.toFixed(1)}m` : '---.-m'}{' '}
              <span className="text-xs text-slate-500 font-normal">MSL</span>
            </span>
            <span className="text-xs font-mono text-cyan-400 font-bold ml-auto">
              {utcTime}
            </span>
          </div>
        </div>
      </div>

      {/* Auxiliary Metrics (SOG, COG, Fix Quality, Accuracy) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-700">
        <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Speed (SOG)</span>
          <span className="text-lg font-mono font-bold text-cyan-400 mt-1">
            {gps.speedKnots !== null ? gps.speedKnots.toFixed(1) : '0.0'} <span className="text-xs text-slate-400 font-normal">kts</span>
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {gps.speedKmh !== null ? `${gps.speedKmh.toFixed(1)} km/h` : '0.0 km/h'}
          </span>
        </div>

        <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Track (COG)</span>
          <span className="text-lg font-mono font-bold text-white mt-1">
            {gps.heading !== null ? `${gps.heading.toFixed(1)}°` : '---.-°'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Var: {magVariation >= 0 ? `+${magVariation.toFixed(1)}°E` : `${magVariation.toFixed(1)}°W`}
          </span>
        </div>

        <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">GNSS Fix Type</span>
          <span className={`text-lg font-mono font-bold mt-1 ${hasRealGps ? 'text-green-400' : 'text-slate-400'}`}>
            {gps.fixType}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {hasRealGps ? `${gps.satellites} Satellites In View` : 'Waiting for lock'}
          </span>
        </div>

        <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Precision / Accuracy</span>
          <span className="text-lg font-mono font-bold text-slate-200 mt-1">
            {gps.accuracy !== null ? `±${gps.accuracy.toFixed(1)}m` : '--'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            HDOP: {gps.hdop > 0 ? gps.hdop.toFixed(1) : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};
