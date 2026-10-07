import React, { useState, useEffect } from 'react';
import { GpsData, CompassData } from '../types';
import { formatNmeaSentence } from '../utils/nmea';
import { Radio, Play, Square, Check, RefreshCw } from 'lucide-react';

interface NmeaTransmitterProps {
  gps: GpsData;
  compass: CompassData;
  isUsbConnected: boolean;
  onSendSentence: (sentence: string) => void;
}

export const NmeaTransmitter: React.FC<NmeaTransmitterProps> = ({
  gps,
  compass,
  isUsbConnected,
  onSendSentence
}) => {
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [rateHz, setRateHz] = useState(1);
  const [sendRmc, setSendRmc] = useState(true);
  const [sendGga, setSendGga] = useState(true);
  const [sendHdg, setSendHdg] = useState(true);

  // Transmission Loop
  useEffect(() => {
    if (!isTransmitting || !isUsbConnected) return;

    const intervalMs = Math.round(1000 / rateHz);
    const timer = setInterval(() => {
      const now = new Date();
      const utcTime = `${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}.00`;
      const utcDate = `${String(now.getUTCDate()).padStart(2, '0')}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCFullYear()).slice(-2)}`;

      const lat = gps.latitude ?? 27.1832;
      const lon = gps.longitude ?? 56.2736;
      const absLat = Math.abs(lat);
      const absLon = Math.abs(lon);
      const latDeg = Math.floor(absLat);
      const latMin = ((absLat - latDeg) * 60).toFixed(4);
      const lonDeg = Math.floor(absLon);
      const lonMin = ((absLon - lonDeg) * 60).toFixed(4);
      const latStr = `${String(latDeg).padStart(2, '0')}${latMin}`;
      const lonStr = `${String(lonDeg).padStart(3, '0')}${lonMin}`;
      const latHemi = lat >= 0 ? 'N' : 'S';
      const lonHemi = lon >= 0 ? 'E' : 'W';
      const spdKts = (gps.speedKnots ?? 0).toFixed(1);
      const cogDeg = (gps.heading ?? compass.trueHeading ?? 0).toFixed(1);
      const hdgDeg = (compass.trueHeading ?? compass.magneticHeading ?? 0).toFixed(1);

      // 1. RMC
      if (sendRmc) {
        const rmcBody = `GPRMC,${utcTime},A,${latStr},${latHemi},${lonStr},${lonHemi},${spdKts},${cogDeg},${utcDate},,,A`;
        onSendSentence(formatNmeaSentence(rmcBody));
      }

      // 2. GGA
      if (sendGga) {
        const ggaBody = `GPGGA,${utcTime},${latStr},${latHemi},${lonStr},${lonHemi},1,08,1.0,${(gps.altitude ?? 5).toFixed(1)},M,,M,,`;
        onSendSentence(formatNmeaSentence(ggaBody));
      }

      // 3. HDG (Magnetic Heading)
      if (sendHdg) {
        const hdgBody = `HCHDG,${hdgDeg},,,,`;
        onSendSentence(formatNmeaSentence(hdgBody));
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isTransmitting, isUsbConnected, rateHz, sendRmc, sendGga, sendHdg, gps, compass, onSendSentence]);

  return (
    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-3 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-white">فرستنده زنده NMEA 0183 (Transmitter)</h2>
            <p className="text-[11px] text-slate-400">ارسال داده سنسورها و GPS به دستگاه‌های دریایی (پل فرماندهی)</p>
          </div>
        </div>

        <button
          type="button"
          disabled={!isUsbConnected}
          onClick={() => setIsTransmitting(!isTransmitting)}
          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow transition-all ${
            isTransmitting
              ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40'
          }`}
        >
          {isTransmitting ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>توقف ارسال</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>شروع ارسال NMEA</span>
            </>
          )}
        </button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
        <label className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={sendRmc}
            onChange={(e) => setSendRmc(e.target.checked)}
            className="rounded text-cyan-500"
          />
          <span className="font-mono text-slate-300">$GPRMC (موقعیت و سرعت)</span>
        </label>

        <label className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={sendGga}
            onChange={(e) => setSendGga(e.target.checked)}
            className="rounded text-cyan-500"
          />
          <span className="font-mono text-slate-300">$GPGGA (Fix & ارتفاع)</span>
        </label>

        <label className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 cursor-pointer">
          <input
            type="checkbox"
            checked={sendHdg}
            onChange={(e) => setSendHdg(e.target.checked)}
            className="rounded text-cyan-500"
          />
          <span className="font-mono text-slate-300">$HCHDG (جهت قطب‌نما)</span>
        </label>

        <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400">فرکانس:</span>
          <select
            value={rateHz}
            onChange={(e) => setRateHz(Number(e.target.value))}
            className="bg-transparent text-cyan-300 font-bold focus:outline-none"
          >
            <option value={1} className="bg-slate-900">1 Hz (یکبار در ثانیه)</option>
            <option value={2} className="bg-slate-900">2 Hz</option>
            <option value={5} className="bg-slate-900">5 Hz</option>
          </select>
        </div>
      </div>
    </div>
  );
};
