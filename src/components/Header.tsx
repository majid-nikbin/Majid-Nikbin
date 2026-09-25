import React, { useState, useEffect } from 'react';
import { 
  Anchor, 
  Compass, 
  Moon, 
  Sun, 
  Radio, 
  Activity, 
  Smartphone,
  Navigation,
  WifiOff,
  Wifi,
  ShieldCheck,
  Info,
  Mail,
  X,
  KeyRound,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Route as RouteIcon,
  Check,
  ShoppingCart,
  ExternalLink
} from 'lucide-react';
import { SerialPortStatus } from '../types';
import { 
  getLicenseStatus, 
  getOtgLicenseStatus,
  activateOtgLicense,
  OFFICIAL_SUPPORT_EMAIL,
  isDeveloperModeUnlocked,
  setDeveloperMode,
  DEVELOPER_PASSCODE,
  MYKET_DETAILS_INTENT,
  MYKET_WEB_URL
} from '../services/licenseService';
import { Browser } from '@capacitor/browser';
import { APP_VERSION, APP_BUILD } from '../config/version';

export type ActiveTab = 'nav' | 'route' | 'transmit' | 'monitor' | 'drivers';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  serialStatus: SerialPortStatus;
  hasRealGps: boolean;
  hasRealCompass: boolean;
  isNightMode: boolean;
  onToggleNightMode: () => void;
  showAboutModal?: boolean;
  setShowAboutModal?: (show: boolean) => void;
  isNavigating?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  serialStatus,
  hasRealGps,
  hasRealCompass,
  isNightMode,
  onToggleNightMode,
  showAboutModal: externalShowAboutModal,
  setShowAboutModal: externalSetShowAboutModal,
  isNavigating = false,
}) => {
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);
  const [wakeLockToast, setWakeLockToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(false);
  
  const [localShowAboutModal, setLocalShowAboutModal] = useState<boolean>(false);
  const showAboutModal = externalShowAboutModal !== undefined ? externalShowAboutModal : localShowAboutModal;
  const setShowAboutModal = externalSetShowAboutModal || setLocalShowAboutModal;

  const [showDevPinPrompt, setShowDevPinPrompt] = useState<boolean>(false);
  const [devClickCount, setDevClickCount] = useState<number>(0);
  const [devPinInput, setDevPinInput] = useState<string>('');
  const [devPinError, setDevPinError] = useState<string | null>(null);
  const [isDevUnlocked, setIsDevUnlocked] = useState<boolean>(() => isDeveloperModeUnlocked());
  const [otgLicense, setOtgLicense] = useState(() => getOtgLicenseStatus());

  const isActivated = otgLicense.isActivated || isDevUnlocked;

  // Listen for real-time license activation across components
  useEffect(() => {
    const handleLicenseUpdate = () => {
      setOtgLicense(getOtgLicenseStatus());
      setIsDevUnlocked(isDeveloperModeUnlocked());
    };
    window.addEventListener('mariner_license_activated', handleLicenseUpdate);
    window.addEventListener('storage', handleLicenseUpdate);
    return () => {
      window.removeEventListener('mariner_license_activated', handleLicenseUpdate);
      window.removeEventListener('storage', handleLicenseUpdate);
    };
  }, []);

  // Listen for online / offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if service worker is active and caching assets
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      setIsOfflineCached(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Screen Wake Lock Handler
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && wakeLockActive) {
        try {
          if ('wakeLock' in navigator) {
            const sentinel = await (navigator as any).wakeLock.request('screen');
            setWakeLockSentinel(sentinel);
          }
        } catch (err) {
          console.warn('Wake Lock re-acquire failed:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wakeLockActive]);

  const toggleWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        if (!wakeLockActive) {
          const sentinel = await (navigator as any).wakeLock.request('screen');
          setWakeLockSentinel(sentinel);
          setWakeLockActive(true);
          showToastMessage('Screen Sleep: DISABLED (Display will stay ON)');
          sentinel.addEventListener('release', () => {
            setWakeLockActive(false);
          });
        } else if (wakeLockSentinel) {
          await wakeLockSentinel.release();
          setWakeLockSentinel(null);
          setWakeLockActive(false);
          showToastMessage('Screen Sleep: NORMAL (System timeout active)');
        }
      } catch (err) {
        console.warn('Wake Lock error:', err);
        showToastMessage('Wake Lock not supported on this browser');
      }
    } else {
      showToastMessage('Wake Lock API not available in this browser');
    }
  };

  const showToastMessage = (msg: string) => {
    setWakeLockToast(msg);
    setTimeout(() => setWakeLockToast(null), 3000);
  };

  const handleDevPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = devPinInput.trim();
    if (!clean) return;
    if (clean === DEVELOPER_PASSCODE || clean === '2450') {
      setDeveloperMode(true);
      activateOtgLicense(DEVELOPER_PASSCODE);
      setIsDevUnlocked(true);
      setShowDevPinPrompt(false);
      setDevPinInput('');
      setDevPinError(null);
      showToastMessage('✓ Developer Mode Active');
    } else {
      setDevPinError('رمز عبور نامعتبر است');
    }
  };

  return (
    <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-30 shadow-md">
      {/* Wake Lock Status Notification Bar / Toast */}
      {wakeLockToast && (
        <div className="bg-emerald-900/90 border-b border-emerald-500/50 text-emerald-200 text-[11px] font-mono font-bold py-1 px-4 text-center tracking-wider animate-fadeIn">
          {wakeLockToast}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Left: Brand Identity (Clickable to open About & Info Modal) */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div
            id="brand-header-info"
            onClick={() => setShowAboutModal(true)}
            className="flex items-center gap-3 cursor-pointer group select-none transition-transform active:scale-98"
            title="Click to view Mariner Pro info, developer details & email"
          >
            <img
              src="./app-icon.jpg"
              alt="Mariner Pro"
              className="w-9 h-9 rounded-xl object-cover border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.25)] group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all"
            />

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm sm:text-base tracking-wider text-white group-hover:text-cyan-300 transition-colors">
                  MARINER <span className="text-cyan-400 group-hover:text-cyan-300">PRO-LINK</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/40 text-[10px] font-mono text-cyan-300 font-bold shadow-sm">
                  v{APP_VERSION}
                </span>
              </div>
              {isActivated && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="px-1.5 py-0.2 rounded bg-emerald-950/90 border border-emerald-500/80 text-[8px] sm:text-[9px] font-mono text-emerald-400 font-black tracking-widest uppercase inline-flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.35)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ACTIVATED
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                <span className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasRealCompass ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  {hasRealCompass ? 'IMU 60Hz' : 'Gyro Ready'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasRealGps ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                    }`}
                  />
                  {hasRealGps ? 'GNSS Lock' : 'GPS Waiting'}
                </span>
              </div>
            </div>
          </div>

          {/* Mobile Right Controls: Night Mode & Screen Stay ON */}
          <div className="flex md:hidden items-center gap-2">
            {/* Screen Sleep Lock Toggle Button (Mobile) */}
            <button
              id="btn-wakelock-mobile"
              type="button"
              onClick={toggleWakeLock}
              className={`p-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                wakeLockActive
                  ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Keep Screen Awake (Prevents phone display from turning off)"
            >
              {wakeLockActive ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4" />}
            </button>

            {/* Night Red Mode Toggle (Mobile) */}
            <button
              id="btn-night-mode-mobile"
              type="button"
              onClick={onToggleNightMode}
              className={`p-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                isNightMode
                  ? 'bg-red-950 border-red-800 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Night Watch Red Mode"
            >
              {isNightMode ? <Sun className="w-4 h-4 text-red-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="grid grid-cols-4 md:flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
          <button
            id="tab-btn-nav"
            type="button"
            onClick={() => onTabChange('nav')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold font-mono transition-all select-none min-w-0 ${
              activeTab === 'nav'
                ? isNightMode
                  ? 'bg-red-900/80 text-white border border-red-700 shadow-sm'
                  : 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Nav</span>
          </button>

          <button
            id="tab-btn-route"
            type="button"
            onClick={() => onTabChange('route')}
            className={`relative flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold font-mono transition-all select-none min-w-0 ${
              activeTab === 'route'
                ? isNightMode
                  ? 'bg-red-900/80 text-white border border-red-700 shadow-sm'
                  : 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950 font-black'
                : isNavigating
                ? 'bg-amber-950/60 border border-amber-500/50 text-amber-300 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Route</span>
            {isNavigating && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
            )}
          </button>

          <button
            id="tab-btn-transmit"
            type="button"
            onClick={() => onTabChange('transmit')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold font-mono transition-all select-none min-w-0 ${
              activeTab === 'transmit'
                ? isNightMode
                  ? 'bg-red-900/80 text-white border border-red-700 shadow-sm'
                  : 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate"><span className="hidden sm:inline">NMEA </span>Output</span>
          </button>

          <button
            id="tab-btn-monitor"
            type="button"
            onClick={() => onTabChange('monitor')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-3.5 py-2 rounded-lg text-[11px] sm:text-xs font-bold font-mono transition-all select-none min-w-0 ${
              activeTab === 'monitor'
                ? isNightMode
                  ? 'bg-red-900/80 text-white border border-red-700 shadow-sm'
                  : 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate"><span className="hidden sm:inline">NMEA </span>Monitor</span>
          </button>
        </nav>

        {/* Right: Marine Status Indicators & Night Vision Toggle (Desktop) */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Offline PWA Ready Badge */}
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border bg-slate-900/90 border-slate-800 text-[11px] font-mono select-none"
            title="100% Offline Standalone Capable (Cached with Service Worker)"
          >
            <WifiOff className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Offline:</span>
            <span className="text-cyan-300 font-bold">READY</span>
          </div>

          {/* Screen Stay ON Toggle (Desktop) */}
          <button
            id="btn-wakelock-desktop"
            type="button"
            onClick={toggleWakeLock}
            className={`p-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              wakeLockActive
                ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Keep Screen Awake (Display Always ON for helm watch)"
          >
            {wakeLockActive ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Night Vision Red Light Toggle (Desktop) */}
          <button
            id="btn-night-mode-desktop"
            type="button"
            onClick={onToggleNightMode}
            className={`p-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              isNightMode
                ? 'bg-red-950 border-red-800 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Night Watch Red Mode"
          >
            {isNightMode ? <Sun className="w-4 h-4 text-red-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* About & Developer Info Modal (Clean & Compact) */}
      {showAboutModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl flex flex-col gap-4 text-left transition-all ${
              isNightMode
                ? 'bg-zinc-950 border-red-900/80 text-red-100'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src="./app-icon.jpg"
                  alt="Mariner Pro-Link"
                  className="w-11 h-11 rounded-xl object-cover shadow-lg border border-slate-700"
                />
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Mariner Pro-Link
                  </h3>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    version: v{APP_VERSION} Release
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* App Details Card */}
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 flex flex-col gap-3 font-sans">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Developer
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = devClickCount + 1;
                    setDevClickCount(next);
                    if (next >= 5) {
                      setShowDevPinPrompt((prev) => !prev);
                      setDevClickCount(0);
                    }
                  }}
                  className="text-sm font-bold text-white font-mono hover:text-cyan-300 transition-colors cursor-pointer select-none"
                  title="Developer"
                >
                  M-Tech
                </button>
              </div>

              {/* Developer PIN Prompt - Only triggered after 5 taps on Developer name */}
              {showDevPinPrompt && (
                <form
                  onSubmit={handleDevPinSubmit}
                  className="p-3 bg-slate-900 border border-slate-700 rounded-xl flex flex-col gap-2 animate-fadeIn"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Developer PIN:</span>
                    </span>
                    {isDevUnlocked && (
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        UNLOCKED
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={devPinInput}
                      onChange={(e) => {
                        setDevPinInput(e.target.value);
                        setDevPinError(null);
                      }}
                      placeholder="••••"
                      autoFocus
                      className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white outline-none"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold font-mono rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      Submit
                    </button>
                  </div>
                  {devPinError && (
                    <span className="text-[11px] text-rose-400 font-mono">{devPinError}</span>
                  )}
                </form>
              )}

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Official Support Email
                </span>
                <a
                  href={`mailto:${OFFICIAL_SUPPORT_EMAIL}`}
                  className="text-xs font-mono font-bold text-cyan-400 hover:underline"
                >
                  {OFFICIAL_SUPPORT_EMAIL}
                </a>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Software Version
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded shadow-sm">
                  v{APP_VERSION} ({APP_BUILD})
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Architecture
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  NMEA 0183 & Marine PWA
                </span>
              </div>

              {/* Feedback via Email */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Feedback
                </span>
                <a
                  href={`mailto:${OFFICIAL_SUPPORT_EMAIL}?subject=Mariner%20Pro-Link%20Feedback%20%26%20Suggestions&body=Hi%20Mariner%20Team%2C%0A%0AHere%20is%20my%20feedback%20regarding%20the%20app%3A%0A`}
                  className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 rounded-lg text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5 transition-all shadow-sm"
                  title="Feedback"
                >
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Feedback</span>
                </a>
              </div>

              {/* Myket Link / Purchase */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Myket Store
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await Browser.open({ url: MYKET_DETAILS_INTENT, windowName: '_system' });
                    } catch {
                      window.open(MYKET_WEB_URL, '_blank');
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded-lg text-xs font-bold text-amber-300 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  title="صفحه برنامه در مایکت"
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-400" />
                  <span>مایکت (Myket)</span>
                  <ExternalLink className="w-3 h-3 text-amber-400/80" />
                </button>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Core Navigation
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                  ✓ Unlocked & Free
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  License Status
                </span>
                {isActivated ? (
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    ACTIVATED
                  </span>
                ) : (
                  <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
                    Official Release
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="w-full py-2.5 px-3 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

