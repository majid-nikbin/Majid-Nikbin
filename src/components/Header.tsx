import React from 'react';
import { Compass, Usb, Satellite, Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { GpsData } from '../types';

interface HeaderProps {
  gps: GpsData;
  hasGpsFix: boolean;
  isUsbConnected: boolean;
  usbMode: 'serial' | 'webusb' | null;
  onConnectUsb: () => void;
  onDisconnectUsb: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  gps,
  hasGpsFix,
  isUsbConnected,
  usbMode,
  onConnectUsb,
  onDisconnectUsb
}) => {
  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 px-3 py-2.5 flex items-center justify-between shadow-xl">
      {/* App Branding */}
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 shadow-lg shadow-cyan-950/50">
          <Compass className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-1.5">
            <span>قطب‌نما و ناوبری دریایی</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              PRO
            </span>
          </h1>
          <p className="text-[10px] text-slate-400 font-mono">
            NMEA 0183 USB • 100% OFFLINE CHARTS
          </p>
        </div>
      </div>

      {/* Connection & Status Controls */}
      <div className="flex items-center gap-2">
        {/* GPS Status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono">
          <Satellite className={`w-3.5 h-3.5 ${hasGpsFix ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
          <span className={hasGpsFix ? 'text-emerald-300' : 'text-amber-300'}>
            {hasGpsFix ? 'GPS FIX' : 'SEARCHING'}
          </span>
        </div>

        {/* USB Connect Button (100% Offline Local Connection!) */}
        {isUsbConnected ? (
          <button
            type="button"
            onClick={onDisconnectUsb}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/60 active:scale-95 transition-all"
            title="قطع اتصال پورت USB"
          >
            <Usb className="w-3.5 h-3.5" />
            <span>متصل ({usbMode?.toUpperCase()})</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnectUsb}
            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/60 active:scale-95 transition-all"
            title="اتصال به گیرنده / فرستنده NMEA از طریق USB OTG"
          >
            <Usb className="w-3.5 h-3.5" />
            <span>اتصال USB OTG</span>
          </button>
        )}
      </div>
    </header>
  );
};
