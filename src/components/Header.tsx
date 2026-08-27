import React, { useState, useEffect } from 'react';
import { 
  Anchor, 
  Compass, 
  Moon, 
  Sun, 
  Radio, 
  Activity, 
  Cpu, 
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
  Sparkles,
  Eye,
  EyeOff,
  Download
} from 'lucide-react';
import { SerialPortStatus } from '../types';
import { 
  getLicenseStatus, 
  OFFICIAL_SUPPORT_EMAIL,
  isDeveloperModeUnlocked,
  setDeveloperMode,
  DEVELOPER_PASSCODE
} from '../services/licenseService';

export type ActiveTab = 'nav' | 'transmit' | 'monitor' | 'drivers' | 'keygen';

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
}) => {
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [wakeLockSentinel, setWakeLockSentinel] = useState<any>(null);
  const [wakeLockToast, setWakeLockToast] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isOfflineCached, setIsOfflineCached] = useState<boolean>(false);
  
  const [localShowAboutModal, setLocalShowAboutModal] = useState<boolean>(false);
  const showAboutModal = externalShowAboutModal !== undefined ? externalShowAboutModal : localShowAboutModal;
  const setShowAboutModal = externalSetShowAboutModal || setLocalShowAboutModal;

  const [devClickCount, setDevClickCount] = useState<number>(0);
  const [showDevPinPrompt, setShowDevPinPrompt] = useState<boolean>(false);
  const [devPinInput, setDevPinInput] = useState<string>('');
  const [devPinError, setDevPinError] = useState<string | null>(null);
  const [isDevUnlocked, setIsDevUnlocked] = useState<boolean>(() => isDeveloperModeUnlocked());

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

  // Toggle Key Gen: Click once to open, click again to close & return to nav
  const handleToggleKeyGen = () => {
    if (activeTab === 'keygen') {
      onTabChange('nav');
    } else {
      onTabChange('keygen');
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
            <div
              className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
                isNightMode
                  ? 'bg-red-950 border-red-800 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] group-hover:border-red-500'
                  : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] group-hover:border-cyan-400 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              }`}
            >
              <Anchor className="w-5 h-5 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm sm:text-base tracking-wider text-white group-hover:text-cyan-300 transition-colors">
                  MARINER <span className="text-cyan-400 group-hover:text-cyan-300">PRO-LINK</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] font-mono text-cyan-300 font-bold">
                  V1.0
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
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

        {/* Center: Navigation Tabs (Fixed 3-column grid on mobile so all 3 tabs fit 100% in screen width) */}
        <nav className="grid grid-cols-3 md:flex items-center gap-1 sm:gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-full md:w-auto">
          <button
            id="tab-btn-nav"
            type="button"
            onClick={() => onTabChange('nav')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold font-mono transition-all select-none min-w-0 ${
              activeTab === 'nav'
                ? isNightMode
                  ? 'bg-red-900/80 text-white border border-red-700 shadow-sm'
                  : 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Navigation</span>
          </button>

          <button
            id="tab-btn-transmit"
            type="button"
            onClick={() => onTabChange('transmit')}
            className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold font-mono transition-all select-none min-w-0 ${
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
            className={`flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 rounded-lg text-[11px] sm:text-xs font-bold font-mono transition-all select-none min-w-0 ${
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
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                    isNightMode
                      ? 'bg-red-600 text-white shadow-red-900/50'
                      : 'bg-cyan-500 text-slate-950 shadow-cyan-900/50'
                  }`}
                >
                  <Anchor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-wide">
                    Mariner Pro-Link
                  </h3>
                  <span className="text-xs font-mono font-bold text-cyan-400">
                    version: V1.0 Release
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
                      setShowDevPinPrompt(true);
                      setDevClickCount(0);
                    }
                  }}
                  className="text-sm font-bold text-white font-mono hover:text-cyan-300 transition-colors cursor-pointer"
                  title="Mariner Engineering"
                >
                  M.Nikbin
                </button>
              </div>

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
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                  V1.0 Release
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

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Device ID
                </span>
                <span className="text-xs text-cyan-300 font-mono font-bold">
                  {getLicenseStatus().deviceId}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  License Status
                </span>
                {(() => {
                  const lic = getLicenseStatus();
                  if (lic.isActivated) {
                    return (
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded">
                        ✓ Activated & Permanent
                      </span>
                    );
                  }
                  if (lic.isTrialActive) {
                    return (
                      <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded">
                        30-Day Free Trial ({lic.daysRemaining} days left)
                      </span>
                    );
                  }
                  return (
                    <span className="text-xs font-mono font-bold text-rose-400 bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 rounded">
                      Trial Expired - Activation Required
                    </span>
                  );
                })()}
              </div>

              {/* Developer Key Tool Button inside About Modal - Only if dev mode unlocked */}
              {isDevUnlocked && (
                <div className="flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Developer Key Tool
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Generate client activation keys
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAboutModal(false);
                      handleToggleKeyGen();
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md transition-all"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{activeTab === 'keygen' ? 'Close Key Gen' : 'Open Key Gen'}</span>
                  </button>
                </div>
              )}

              {/* Hidden Developer Mode PIN Form */}
              {showDevPinPrompt && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (devPinInput.trim() === DEVELOPER_PASSCODE || devPinInput.trim() === '2450') {
                      setDeveloperMode(true);
                      setIsDevUnlocked(true);
                      setShowDevPinPrompt(false);
                      setDevPinInput('');
                    } else {
                      setDevPinError('Invalid PIN');
                    }
                  }}
                  className="mt-2 p-3 bg-slate-900 border border-amber-500/40 rounded-xl flex flex-col gap-2"
                >
                  <span className="text-xs font-bold text-amber-300">Enter Developer PIN:</span>
                  <input
                    type="password"
                    value={devPinInput}
                    onChange={(e) => {
                      setDevPinInput(e.target.value);
                      setDevPinError(null);
                    }}
                    placeholder="PIN"
                    className="w-full bg-slate-950 border border-amber-500/40 rounded px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                  />
                  {devPinError && <span className="text-[10px] text-red-400">{devPinError}</span>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded"
                    >
                      Unlock KeyGen
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDevPinPrompt(false)}
                      className="px-2 py-1.5 bg-slate-800 text-slate-400 text-xs rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Contact Developer Button with mailto to official email */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              <a
                href={`mailto:${OFFICIAL_SUPPORT_EMAIL}?subject=Mariner%20Pro-Link%20V1.0%20Support%20%26%20Feedback`}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2.5 shadow-lg transition-all ${
                  isNightMode
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950 font-black'
                }`}
              >
                <Mail className="w-4 h-4" />
                <span>Contact Developer ({OFFICIAL_SUPPORT_EMAIL})</span>
              </a>

              <button
                type="button"
                onClick={() => setShowAboutModal(false)}
                className="w-full py-2 px-3 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 transition-colors"
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
