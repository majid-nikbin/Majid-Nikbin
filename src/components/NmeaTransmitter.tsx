import React, { useState, useEffect } from 'react';
import { 
  Cable, 
  Play, 
  Radio, 
  Check, 
  Usb, 
  AlertTriangle,
  X,
  Zap,
  Globe,
  ExternalLink,
  Copy
} from 'lucide-react';
import { CompassData, GpsData, NmeaConfig, SerialPortStatus } from '../types';
import { AVAILABLE_SENTENCES, generateNmeaSentences } from '../utils/nmea';
import { serialService } from '../services/serialService';
import { Browser } from '@capacitor/browser';

interface NmeaTransmitterProps {
  gps: GpsData;
  compass: CompassData;
  config: NmeaConfig;
  onConfigChange: (newConfig: NmeaConfig) => void;
  serialStatus: SerialPortStatus;
  isNightMode?: boolean;
}

export const NmeaTransmitter: React.FC<NmeaTransmitterProps> = ({
  gps,
  compass,
  config,
  onConfigChange,
  serialStatus,
  isNightMode = false,
}) => {
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [liveSentences, setLiveSentences] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [showChromeModal, setShowChromeModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Unblocked GitHub Pages Mirror URL (100% Accessible in Iran without VPN & Verified Working)
  const GITHUB_PAGES_MIRROR_URL = "https://majid-nikbin.github.io/Majid-Nikbin/";
  const FALLBACK_APP_URL = "https://majid-nikbin.github.io/Majid-Nikbin/";

  // Check if running inside installed Android APK (Capacitor)
  const isInsideApk = typeof window !== 'undefined' && (
    !!(window as any).Capacitor?.isNativePlatform?.() || 
    window.location.protocol === 'capacitor:' || 
    (window.location.protocol === 'http:' && window.location.hostname === 'localhost')
  );

  // Generate real-time preview of sentences
  useEffect(() => {
    const generated = generateNmeaSentences(gps, compass, config);
    setLiveSentences(generated);
  }, [gps, compass, config]);

  // Transmit interval loop when enabled & port connected
  useEffect(() => {
    if (!isTransmitting || !serialStatus.connected) return;

    const interval = setInterval(async () => {
      const sentences = generateNmeaSentences(gps, compass, config);
      await serialService.writeSentences(sentences);
    }, config.intervalMs);

    return () => clearInterval(interval);
  }, [isTransmitting, serialStatus.connected, gps, compass, config]);

  // Click on "Connect USB OTG" (Direct hardware connection in Chrome / WebUSB)
  const handleConnectUsbClick = async () => {
    setIsConnecting(true);
    setConnectError(null);

    // If inside APK or WebUSB/WebSerial is not supported in this environment
    if (!serialService.isWebUsbSupported() && !serialService.isWebSerialSupported()) {
      setIsConnecting(false);
      setShowChromeModal(true);
      return;
    }

    try {
      await serialService.connect(config.baudRate);
      setIsTransmitting(true);
    } catch (err: any) {
      console.warn('USB Connection issue:', err);
      // User cancelled picker dialog
      if (err.name === 'NotFoundError' || err.message?.includes('No device selected') || err.message?.includes('cancelled')) {
        setIsConnecting(false);
        return;
      }
      if (!serialService.isWebUsbSupported() && !serialService.isWebSerialSupported()) {
        setShowChromeModal(true);
      } else {
        setConnectError(err.message || 'Could not connect to USB hardware device. Check OTG cable connection.');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Directly launches Google Chrome browser with unblocked GitHub Pages Mirror
  const handleOpenInChrome = async (customUrl?: string) => {
    const targetUrl = customUrl || GITHUB_PAGES_MIRROR_URL;
    try {
      // 1. Try official Capacitor Browser plugin
      await Browser.open({ url: targetUrl, windowName: '_system' });
      setShowChromeModal(false);
      return;
    } catch (e) {
      console.warn('Capacitor browser open fallback:', e);
    }

    // 2. Android Chrome Intent direct launch
    try {
      const chromeIntentUrl = `googlechrome://navigate?url=${encodeURIComponent(targetUrl)}`;
      window.location.href = chromeIntentUrl;
      setTimeout(() => {
        window.open(targetUrl, '_blank');
      }, 500);
    } catch (err) {
      window.open(targetUrl, '_blank');
    }
    setShowChromeModal(false);
  };

  const handleCopyLink = (url?: string) => {
    const targetUrl = url || GITHUB_PAGES_MIRROR_URL;
    navigator.clipboard?.writeText(targetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDisconnect = async () => {
    setIsTransmitting(false);
    await serialService.disconnect();
  };

  const toggleSentence = (id: string) => {
    const current = !config.activeSentences || !config.activeSentences[id] ? false : true;
    onConfigChange({
      ...config,
      activeSentences: {
        ...config.activeSentences,
        [id]: !current,
      },
    });
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    AVAILABLE_SENTENCES.forEach((s) => {
      next[s.id] = true;
    });
    onConfigChange({ ...config, activeSentences: next });
  };

  const deselectAll = () => {
    onConfigChange({ ...config, activeSentences: {} });
  };

  return (
    <div
      id="nmea-transmitter-panel"
      className={`p-5 rounded-2xl border transition-all flex flex-col gap-5 ${
        isNightMode
          ? 'bg-zinc-950/80 border-red-900/50 text-red-100 shadow-xl'
          : 'bg-slate-800/40 border-slate-700 text-slate-200 shadow-xl'
      }`}
    >
      {/* Connection Error Banner */}
      {connectError && (
        <div className="p-3.5 bg-rose-950/80 border border-rose-600/60 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{connectError}</span>
          </div>
          <button
            type="button"
            onClick={() => setConnectError(null)}
            className="p-1 text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              serialStatus.connected
                ? isNightMode
                  ? 'bg-red-700 text-white'
                  : 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Cable className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                USB OTG Port Controller
              </h2>
              <span
                className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-widest ${
                  serialStatus.connected
                    ? 'bg-green-900/30 border border-green-500/50 text-green-400'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {serialStatus.connected
                  ? 'USB HARDWARE CONNECTED'
                  : 'STANDBY'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {serialStatus.connected
                ? `${serialStatus.driverType || 'Serial Device'} • ${serialStatus.baudRate} bps • ${serialStatus.sentencesSent} packets sent`
                : 'MAX485 / CH340 / CP2102 / FTDI OTG Controller'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!serialStatus.connected ? (
            <button
              id="btn-connect-usb-otg"
              type="button"
              onClick={handleConnectUsbClick}
              disabled={isConnecting}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all shadow-md ${
                isNightMode
                  ? 'bg-red-700 hover:bg-red-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_12px_rgba(34,211,238,0.3)]'
              }`}
            >
              <Usb className="w-4 h-4" />
              <span>{isConnecting ? 'Connecting...' : 'Connect USB OTG'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                id="btn-toggle-tx"
                type="button"
                onClick={() => setIsTransmitting(!isTransmitting)}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  isTransmitting
                    ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-950/50'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {isTransmitting ? <Radio className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4" />}
                <span>{isTransmitting ? 'TX Active' : 'Start TX'}</span>
              </button>

              <button
                id="btn-disconnect-usb"
                type="button"
                onClick={handleDisconnect}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Continue in Chrome Browser Modal for USB Serial Access */}
      {showChromeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowChromeModal(false)}
        >
          <div 
            className="relative max-w-md w-full bg-slate-900 border border-cyan-500/60 rounded-2xl p-6 shadow-2xl flex flex-col gap-4 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <Globe className="w-5 h-5 text-cyan-400" />
                <span>USB Serial Access</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChromeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct Link Info */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <span className="text-[11px] font-mono text-emerald-400 font-semibold">GitHub Pages Mirror (No VPN Required):</span>
              <div className="text-xs font-mono text-cyan-300 break-all select-all bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800">
                {GITHUB_PAGES_MIRROR_URL}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleCopyLink(GITHUB_PAGES_MIRROR_URL)}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenInChrome(GITHUB_PAGES_MIRROR_URL)}
                className="w-full sm:w-auto px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/60 uppercase tracking-wider font-mono"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Continue in Chrome Browser</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interface Configuration Grid */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Interface Configuration
          </h3>
          <div className="text-[10px] text-slate-500 uppercase font-mono">
            IEC 61162-1
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Baud Rate */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-medium">Baud Rate (bps)</label>
            <select
              disabled={serialStatus.connected}
              value={config.baudRate}
              onChange={(e) =>
                onConfigChange({ ...config, baudRate: Number(e.target.value) })
              }
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300 outline-none disabled:opacity-50"
            >
              <option value={4800}>4800 (Standard NMEA)</option>
              <option value={9600}>9600 (Fast GPS)</option>
              <option value={38400}>38400 (High-Speed AIS)</option>
              <option value={115200}>115200 (Telemetry)</option>
            </select>
          </div>

          {/* Transmit Rate */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-medium">Transmit Rate</label>
            <select
              value={config.intervalMs}
              onChange={(e) =>
                onConfigChange({ ...config, intervalMs: Number(e.target.value) })
              }
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none"
            >
              <option value={100}>10 Hz (100ms)</option>
              <option value={200}>5 Hz (200ms)</option>
              <option value={500}>2 Hz (500ms)</option>
              <option value={1000}>1 Hz (1000ms)</option>
            </select>
          </div>

          {/* Talker ID GPS */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-medium">GNSS Talker</label>
            <select
              value={config.talkerIdGps}
              onChange={(e) =>
                onConfigChange({ ...config, talkerIdGps: e.target.value })
              }
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none"
            >
              <option value="GP">GP (GPS)</option>
              <option value="GN">GN (Combined GNSS)</option>
              <option value="GL">GL (GLONASS)</option>
              <option value="GA">GA (Galileo)</option>
            </select>
          </div>

          {/* Talker ID Heading */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-medium">Heading Talker</label>
            <select
              value={config.talkerIdHeading}
              onChange={(e) =>
                onConfigChange({ ...config, talkerIdHeading: e.target.value })
              }
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-white outline-none"
            >
              <option value="HC">HC (Magnetic Compass)</option>
              <option value="HE">HE (North Gyro)</option>
              <option value="HN">HN (Non-North Gyro)</option>
              <option value="TI">TI (Turn Indicator)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sentence Selection Matrix - Compact, clean buttons without bulky sub-descriptions */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Active NMEA 0183 Sentence Matrix
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
            >
              Select All
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={deselectAll}
              className="text-[11px] font-mono text-slate-400 hover:text-slate-300 underline"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {AVAILABLE_SENTENCES.map((item) => {
            const isActive = !config.activeSentences || !config.activeSentences[item.id] ? false : true;
            return (
              <div
                key={item.id}
                onClick={() => toggleSentence(item.id)}
                className={`px-3 py-2 rounded-xl border cursor-pointer select-none transition-all flex items-center justify-between gap-2 ${
                  isActive
                    ? 'bg-slate-900 border-cyan-500/60 shadow-sm'
                    : 'bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-cyan-500 text-slate-950'
                        : 'border border-slate-600 bg-slate-800'
                    }`}
                  >
                    {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <span className="font-mono font-bold text-xs text-white">{item.id}</span>
                </div>

                <span
                  className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    item.category === 'heading'
                      ? 'bg-blue-950/80 text-blue-300 border border-blue-800/80'
                      : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
                  }`}
                >
                  {item.category === 'heading' ? 'HDG' : 'GPS'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time NMEA Outflow Terminal Preview */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Output Payload Stream Preview (Live Checksums)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {liveSentences.length} active
          </span>
        </div>

        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-green-400 space-y-1 overflow-x-auto shadow-inner max-h-36">
          {liveSentences.length > 0 ? (
            liveSentences.map((line, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-slate-600 select-none">{String(idx + 1).padStart(2, '0')}</span>
                <span className="text-white font-bold">{line.substring(0, 6)}</span>
                <span className="text-emerald-300">{line.substring(6)}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-500 italic">No active sentences selected in matrix.</div>
          )}
        </div>
      </div>
    </div>
  );
};
