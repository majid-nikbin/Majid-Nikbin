import React from 'react';
import { GpsData } from '../types';
import { formatMarineDDM, formatHeadingDeg } from '../utils/geo';
import { Navigation, Gauge, Crosshair, Mountain } from 'lucide-react';

interface MarineGpsDataProps {
  gps: GpsData;
}

export const MarineGpsData: React.FC<MarineGpsDataProps> = ({ gps }) => {
  const ddm = formatMarineDDM(gps.latitude, gps.longitude);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {/* SOG Speed */}
      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col justify-between shadow">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>سرعت شناور (SOG)</span>
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-black font-mono text-amber-400">
            {gps.speedKnots !== null ? gps.speedKnots.toFixed(1) : '0.0'}
          </span>
          <span className="text-xs text-slate-400 font-mono">KTS</span>
        </div>
      </div>

      {/* COG Course */}
      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col justify-between shadow">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>جهت حرکت (COG)</span>
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-black font-mono text-cyan-400">
            {formatHeadingDeg(gps.heading)}
          </span>
          <span className="text-xs text-slate-400 font-mono">DEG</span>
        </div>
      </div>

      {/* Latitude DDM */}
      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col justify-between shadow">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>عرض جغرافیایی (LAT)</span>
          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="mt-1">
          <span className="text-sm font-bold font-mono text-emerald-300">
            {ddm.lat}
          </span>
        </div>
      </div>

      {/* Longitude DDM */}
      <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col justify-between shadow">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>طول جغرافیایی (LON)</span>
          <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="mt-1">
          <span className="text-sm font-bold font-mono text-emerald-300">
            {ddm.lon}
          </span>
        </div>
      </div>
    </div>
  );
};
