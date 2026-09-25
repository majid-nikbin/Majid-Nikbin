import React, { useState, useEffect, useRef } from 'react';
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
  Moon,
  ShieldCheck,
  Cpu,
  Lock,
  ShoppingCart,
  Clock,
  KeyRound,
  Copy,
  Info
} from 'lucide-react';
import { CompassData, GpsData, NmeaConfig, SerialPortStatus } from '../types';
import { AVAILABLE_SENTENCES, generateNmeaSentences } from '../utils/nmea';
import { serialService } from '../services/serialService';
import { Browser } from '@capacitor/browser';
import { backgroundKeepAlive } from '../utils/backgroundKeepAlive';
import { 
  getOtgLicenseStatus, 
  dismissOtgWarning, 
  activateOtgLicense, 
  activateViaMyket,
  MYKET_DETAILS_INTENT, 
  MYKET_WEB_URL,
  OFFICIAL_SUPPORT_EMAIL 
} from '../services/licenseService';
import { WEB_HARDWARE_MIRROR_URL } from '../config/version';

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
  const [otgLicense, setOtgLicense] = useState(() => getOtgLicenseStatus());
  const [showMyketModal, setShowMyketModal] = useState<boolean>(false);
  const [otgKeyInput, setOtgKeyInput] = useState<string>('');
  const [otgKeyError, setOtgKeyError] = useState<string | null>(null);
  const [otgKeySuccess, setOtgKeySuccess] = useState<boolean>(false);

  const [backgroundMode, setBackgroundMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mariner_nmea_bg_keepalive') !== 'false';
    } catch {
      return true;
    }
  });

  // Refresh OTG license status on mount, tab focus, or activation event
  useEffect(() => {
    const handleUpdate = () => {
      setOtgLicense(getOtgLicenseStatus());
    };
    handleUpdate();
    window.addEventListener('mariner_license_activated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('mariner_license_activated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleDismissWarning = () => {
    dismissOtgWarning();
    setOtgLicense(getOtgLicenseStatus());
  };

  const handleOpenMyket = async () => {
    try {
      await Browser.open({ url: MYKET_DETAILS_INTENT, windowName: '_system' });
      return;
    } catch {}
    try {
      window.location.href = MYKET_DETAILS_INTENT;
      setTimeout(() => {
        window.open(MYKET_WEB_URL, '_blank');
      }, 600);
    } catch {
      window.open(MYKET_WEB_URL, '_blank');
    }
  };

  const handleConfirmMyketPurchase = () => {
    activateViaMyket();
    setOtgKeySuccess(true);
    setOtgLicense(getOtgLicenseStatus());
    setTimeout(() => {
      setShowMyketModal(false);
      setOtgKeySuccess(false);
    }, 1500);
  };

  const handleActivateOtgKey = (e: React.FormEvent) => {
    e.preventDefault();
    setOtgKeyError(null);
    const key = otgKeyInput.trim();
    if (!key) {
      setOtgKeyError('لطفاً کد فعال‌سازی یا PIN دولوپر را وارد کنید');
      return;
    }
    const success = activateOtgLicense(key);
    if (success) {
      setOtgKeySuccess(true);
      setOtgLicense(getOtgLicenseStatus());
      setTimeout(() => {
        setShowMyketModal(false);
        setOtgKeySuccess(false);
        setOtgKeyInput('');
      }, 1500);
    } else {
      setOtgKeyError('کد یا PIN وارد شده نامعتبر است. لطفاً از مایکت خرید کنید یا با پشتیبانی تماس بگیرید.');
    }
  };

  // Background fallback URL for WebUSB/WebSerial hardware driver runtime
  const HARDWARE_SERIAL_FALLBACK_URL = WEB_HARDWARE_MIRROR_URL;

  // Check if running inside installed Android APK (Capacitor)
  const isInsideApk = typeof window !== 'undefined' && (
    !!(window as any).Capacitor?.isNativePlatform?.() || 
    window.location.protocol === 'capacitor:' || 
    (window.location.protocol === 'http:' && window.location.hostname === 'localhost')
  );

  // Keep latest sensor values in refs to avoid restarting the interval timer on every sensor tick
  const latestGpsRef = useRef(gps);
  const latestCompassRef = useRef(compass);
  const latestConfigRef = useRef(config);

  useEffect(() => {
    latestGpsRef.current = gps;
    latestCompassRef.current = compass;
    latestConfigRef.current = config;
  }, [gps, compass, config]);

  // Generate real-time preview of sentences
  useEffect(() => {
    const generated = generateNmeaSentences(gps, compass, config);
    setLiveSentences(generated);
  }, [gps, compass, config]);

  // Transmit interval loop with Background & Sleep Keep-Alive
  useEffect(() => {
    if (!isTransmitting || !serialStatus.connected) {
      backgroundKeepAlive.stop();
      return;
    }

    const sendSentenceTick = async () => {
      const sentences = generateNmeaSentences(
        latestGpsRef.current,
        latestCompassRef.current,
        latestConfigRef.current
      );
      await serialService.writeSentences(sentences);
    };

    if (backgroundMode) {
      // Unthrottled Web Worker + Silent Audio Loop + Screen WakeLock
      backgroundKeepAlive.start(config.intervalMs, sendSentenceTick);
    } else {
      backgroundKeepAlive.stop();
      const interval = setInterval(sendSentenceTick, config.intervalMs);
      return () => clearInterval(interval);
    }

    return () => {
      backgroundKeepAlive.stop();
    };
  }, [isTransmitting, serialStatus.connected, config.intervalMs, backgroundMode]);

  const toggleBackgroundMode = () => {
    const next = !backgroundMode;
    setBackgroundMode(next);
    try {
      localStorage.setItem('mariner_nmea_bg_keepalive', next ? 'true' : 'false');
    } catch {}
  };

  // Click on "Connect USB OTG" (Direct hardware connection in Chrome / WebUSB)
  const handleConnectUsbClick = async () => {
    const currentOtg = getOtgLicenseStatus();
    setOtgLicense(currentOtg);
    if (currentOtg.isExpired) {
      setShowChromeModal(false);
      setShowMyketModal(true);
      return;
    }

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

  // Directly launches Google Chrome browser with WebUSB/WebSerial runtime silently in background
  const handleOpenInChrome = async () => {
    const currentOtg = getOtgLicenseStatus();
    setOtgLicense(currentOtg);
    if (currentOtg.isExpired) {
      setShowChromeModal(false);
      setShowMyketModal(true);
      return;
    }

    // If running in a web browser on a public domain, use the current origin/href; otherwise fallback to the mirror
    let targetUrl = HARDWARE_SERIAL_FALLBACK_URL;
    if (typeof window !== 'undefined' && window.location.origin) {
      const origin = window.location.origin;
      const isLocalOrCapacitor = origin.includes('localhost') || origin.startsWith('capacitor:') || origin.startsWith('http://localhost');
      if (!isLocalOrCapacitor) {
        targetUrl = window.location.href;
      }
    }

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

      {/* 5-Month Grace Warning Banner (Dismissible per user request: 'پیام بعد ۵ ماه ظاهر بشه، و مخفی بشه') */}
      {otgLicense.isWarningPeriod && !otgLicense.isWarningDismissed && (
        <div className="p-3.5 bg-amber-950/90 border border-amber-500/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-lg animate-fadeIn">
          <div className="flex items-start sm:items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0 animate-pulse" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-amber-300">
                ⚠️ مهلت استفاده از پورت OTG تا ۱ ماه آینده ({otgLicense.daysRemaining} روز دیگر) منقضی می‌شود.
              </span>
              <span className="text-[11px] text-amber-200/80">
                برای ادامه اتصال و تبادل دیتا با سخت‌افزار، لطفاً برنامه را از طریق مایکت خریداری فرمایید.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleOpenMyket}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>خرید از مایکت</span>
            </button>
            <button
              type="button"
              onClick={handleDismissWarning}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg border border-slate-700 transition-colors"
              title="مخفی کردن موقت این پیام"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}

      {/* 6-Month Hard Expiration Banner */}
      {otgLicense.isExpired && (
        <div className="p-3.5 bg-rose-950/90 border border-rose-600 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200 shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-rose-200">
                🔒 مهلت ۶ ماهه استفاده رایگان از پورت OTG به پایان رسیده است.
              </span>
              <span className="text-[11px] text-rose-300/80">
                جهت برقراری اتصال به پورت سریال، لطفاً نسخه فعال شده را از مایکت خریداری فرمایید.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowMyketModal(true)}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-lg transition-all active:scale-95 self-end sm:self-auto"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>خرید لایسنس از مایکت</span>
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

      {/* Background Transmission & Screen Sleep Keep-Alive Card */}
      <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-inner">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            backgroundMode 
              ? isTransmitting 
                ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                : 'bg-cyan-700/60 text-cyan-200'
              : 'bg-slate-800 text-slate-500'
          }`}>
            <Moon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Background TX & Screen-Off Keep-Alive
              </span>
              <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                backgroundMode && isTransmitting
                  ? 'bg-emerald-950 border border-emerald-500/60 text-emerald-300'
                  : backgroundMode
                  ? 'bg-cyan-950 border border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800 border border-slate-700 text-slate-400'
              }`}>
                {backgroundMode && isTransmitting
                  ? 'ACTIVE BACKGROUND SERVICE'
                  : backgroundMode
                  ? 'READY FOR SLEEP MODE'
                  : 'DISABLED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              {backgroundMode
                ? 'Continuous NMEA transmission remains active when phone screen turns off or locks (Web Worker + Audio Heartbeat).'
                : 'Background mode disabled: Transmission will pause when screen locks.'}
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          onClick={toggleBackgroundMode}
          className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
            backgroundMode
              ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300 hover:bg-emerald-600/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750 hover:text-slate-200'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${
            backgroundMode 
              ? isTransmitting ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400' 
              : 'bg-slate-500'
          }`} />
          <span>{backgroundMode ? 'Keep-Alive: ON' : 'Keep-Alive: OFF'}</span>
        </button>
      </div>

      {/* Continue in Chrome Browser Modal for USB Serial Access - Concise, Minimal English */}
      {showChromeModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowChromeModal(false)}
        >
          <div 
            className="relative max-w-sm w-full bg-slate-900 border border-cyan-500/60 rounded-2xl p-5 shadow-2xl flex flex-col gap-3.5 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <Usb className="w-4 h-4 text-cyan-400" />
                <span>USB OTG Serial Port</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChromeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hardware Interface Info - Concise English words */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Chrome Web Serial Engine</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                Direct USB OTG access for CH340, CP2102, FTDI, and MAX485 adapters.
              </p>
              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="text-emerald-400">Driver: Ready</span>
                <span className="text-slate-500">NMEA 0183</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowChromeModal(false)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleOpenInChrome}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/60 uppercase tracking-wider font-mono transition-all active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Chrome</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Myket Purchase & OTG License Expiration Modal (Triggered after 6 months) */}
      {showMyketModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setShowMyketModal(false)}
        >
          <div 
            className="relative max-w-md w-full bg-slate-900 border border-amber-500/70 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <span>خرید لایسنس اتصال OTG از مایکت</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMyketModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Explanation */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                <Lock className="w-4 h-4 shrink-0" />
                <span>مهلت استفاده آزمایشی از پورت OTG به پایان رسیده است</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans text-right" dir="rtl">
                امکان اتصال فیزیکی به کابل OTG و ارسال داده‌های NMEA به دستگاه‌های ناوبری جانبی نیاز به فعال‌سازی از مایکت دارد.
                بخش‌های نقشه، موقعیت‌یابی ماهواره‌ای، روت‌بندی و قطب‌نما همچنان برای شما به‌صورت ۱۰۰٪ رایگان فعال باقی می‌مانند.
              </p>
            </div>

            {/* Direct Myket Purchase Button */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleOpenMyket}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all active:scale-98 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>خرید و تمدید لایسنس از مایکت (Myket)</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>

              <button
                type="button"
                onClick={handleConfirmMyketPurchase}
                className="w-full py-2 px-3 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>خرید را در مایکت انجام دادم (ثبت و فعال‌سازی دائمی)</span>
              </button>
            </div>

            {/* Offline Key Entry Form (for manual keys or developer bypass) */}
            <form onSubmit={handleActivateOtgKey} className="pt-3 border-t border-slate-800 flex flex-col gap-2">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-cyan-400" />
                <span>کد فعال‌سازی دارید؟</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={otgKeyInput}
                  onChange={(e) => {
                    setOtgKeyInput(e.target.value);
                    setOtgKeyError(null);
                  }}
                  placeholder="کد فعال‌سازی را وارد نمایید"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-lg border border-slate-700 transition-colors shrink-0 cursor-pointer"
                >
                  فعال‌سازی
                </button>
              </div>
              {otgKeyError && (
                <span className="text-[11px] text-rose-400 font-mono">{otgKeyError}</span>
              )}
              {otgKeySuccess && (
                <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  اتصال OTG با موفقیت به صورت دائمی فعال گردید!
                </span>
              )}
            </form>

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowMyketModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 text-xs rounded-lg"
              >
                بستن
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
