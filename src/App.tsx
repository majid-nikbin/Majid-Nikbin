// Mariner Pro Marine Navigation & NMEA Bridge System v1.1.0
import React, { useState, useEffect, useRef } from 'react';
import { 
  CompassData, 
  GpsData, 
  HeadingSource, 
  NmeaConfig, 
  SerialPortStatus, 
  NavigationSession 
} from './types';
import { useSensors } from './hooks/useSensors';
import { serialService } from './services/serialService';
import { getLicenseStatus, OFFICIAL_SUPPORT_EMAIL } from './services/licenseService';
import { Header, ActiveTab } from './components/Header';
import { CompassDial } from './components/CompassDial';
import { MarineGpsData } from './components/MarineGpsData';
import { RouteNavigationTab } from './components/RouteNavigationTab';
import { NmeaTransmitter } from './components/NmeaTransmitter';
import { NmeaMonitor } from './components/NmeaMonitor';
import { UsbDriverGuide } from './components/UsbDriverGuide';
import { KeyGenTab } from './components/KeyGenTab';
import { ActivationModal } from './components/ActivationModal';
import { formatMarineDDM, formatHeadingDeg } from './utils/geo';
import { Navigation, ArrowRight } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('nav');
  const [headingSource, setHeadingSource] = useState<HeadingSource>('magnetic');
  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [licenseStatus, setLicenseStatus] = useState(() => getLicenseStatus());
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [exitToast, setExitToast] = useState<string | null>(null);

  // Active navigation session state tracked at root level
  const [activeNavSession, setActiveNavSession] = useState<NavigationSession | null>(() => {
    try {
      const saved = localStorage.getItem('mariner_pro_active_nav_session_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.isNavigating) {
          return parsed;
        }
      }
    } catch (e) {}
    return null;
  });

  const lastBackPressTime = useRef<number>(0);
  const activeTabRef = useRef<ActiveTab>(activeTab);
  const showAboutModalRef = useRef<boolean>(showAboutModal);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    showAboutModalRef.current = showAboutModal;
  }, [showAboutModal]);

  // Handle Android Hardware Back Button (Capacitor Native) & Browser PopState Double-Back Protection
  useEffect(() => {
    let backListener: any = null;

    const triggerDoubleBackNotice = () => {
      const now = Date.now();
      if (now - lastBackPressTime.current < 2000) {
        return true; // allow exit
      } else {
        lastBackPressTime.current = now;
        const navNote = activeNavSession?.isNavigating ? ' (Navigation session active)' : '';
        setExitToast(`Press BACK again to exit Mariner Pro${navNote}`);
        setTimeout(() => setExitToast(null), 2500);
        return false;
      }
    };

    const attachCapacitorBackButton = async () => {
      const cap = (window as any).Capacitor;
      if (cap && cap.Plugins && cap.Plugins.App) {
        try {
          backListener = await cap.Plugins.App.addListener('backButton', () => {
            if (showAboutModalRef.current) {
              setShowAboutModal(false);
            } else {
              const shouldExit = triggerDoubleBackNotice();
              if (shouldExit) {
                cap.Plugins.App.exitApp();
              }
            }
          });
        } catch (e) {
          console.warn('Capacitor App plugin not initialized:', e);
        }
      }
    };

    attachCapacitorBackButton();

    // Browser History PopState Double-Back Protection
    window.history.pushState({ app: 'mariner_pro' }, '');
    const handlePopState = () => {
      if (showAboutModalRef.current) {
        setShowAboutModal(false);
        window.history.pushState({ app: 'mariner_pro' }, '');
        return;
      }

      const shouldExit = triggerDoubleBackNotice();
      if (!shouldExit) {
        window.history.pushState({ app: 'mariner_pro' }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeNavSession]);

  // Default NMEA Output Configuration
  const [nmeaConfig, setNmeaConfig] = useState<NmeaConfig>({
    baudRate: 4800,
    intervalMs: 1000,
    talkerIdGps: 'GP',
    talkerIdHeading: 'HC',
    magVariation: 2.0,
    headingCorrection: 0.0,
    activeSentences: {
      HDG: true,
      HDT: true,
      HDM: false,
      THS: false,
      VHW: false,
      RMC: true,
      GGA: true,
      GLL: false,
      VTG: true,
      ZDA: false,
    },
  });

  // Serial status state from service
  const [serialStatus, setSerialStatus] = useState<SerialPortStatus>(serialService.getStatus());

  useEffect(() => {
    const unsub = serialService.subscribeStatus((status) => {
      setSerialStatus(status);
    });
    return () => unsub();
  }, []);

  // Sensor integration (Compass + GPS + Low-Pass Filter)
  const {
    compass,
    gps,
    hasRealGps,
    isGpsAcquiring,
    hasRealCompass,
    gpsError,
    gpsPermissionState,
    isManualHeading,
    dampingMode,
    setDampingMode,
    displayRefreshRate,
    setDisplayRefreshRate,
    setHeadingManual,
    resetToSensorHeading,
    requestCompassPermission,
    requestGpsFix,
    setGpsData,
  } = useSensors(nmeaConfig.magVariation, nmeaConfig.headingCorrection || 0);

  const handleSetManualGps = (lat: number, lon: number) => {
    setGpsData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lon,
      fixType: 'Simulated',
    }));
  };

  return (
    <div
      id="app-root"
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        isNightMode ? 'bg-[#090505] text-red-100' : 'bg-[#0F172A] text-slate-200'
      }`}
    >
      {/* Back Button Exit Warning Toast */}
      {exitToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500/50 text-cyan-300 px-5 py-2.5 rounded-full shadow-2xl text-xs font-bold tracking-wide animate-fadeIn">
          {exitToast}
        </div>
      )}

      {/* Clean Marine Header Navigation */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        serialStatus={serialStatus}
        hasRealGps={hasRealGps}
        hasRealCompass={hasRealCompass}
        isNightMode={isNightMode}
        onToggleNightMode={() => setIsNightMode(!isNightMode)}
        showAboutModal={showAboutModal}
        setShowAboutModal={setShowAboutModal}
        isNavigating={activeNavSession?.isNavigating || false}
      />

      {/* Main Content Area - Fully Scrollable */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto">
        {/* Active Background Navigation Status Banner (When on other tabs) */}
        {activeNavSession && activeNavSession.isNavigating && activeTab !== 'route' && (
          <div className={`p-3.5 sm:p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-md transition-all ${
            isNightMode 
              ? 'bg-red-950/90 border-red-800 text-red-100' 
              : 'bg-slate-900/95 border-amber-500/60 text-slate-100 shadow-amber-950/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shrink-0">
                <Navigation className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                    VOYAGE NAVIGATION RUNNING IN BACKGROUND
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-950 border border-amber-500/50 text-[9px] font-mono text-amber-300">
                    ACTIVE
                  </span>
                </div>
                <div className="text-sm sm:text-base font-bold font-mono text-white flex flex-wrap items-center gap-2">
                  <span>Destination:</span>
                  <span className="text-amber-300 font-bold underline underline-offset-2">
                    {activeNavSession.targetWaypoint?.name || 'Active Waypoint'}
                  </span>
                  {activeNavSession.distanceNm !== null && (
                    <span className="text-xs text-slate-300 font-normal font-mono">
                      • {activeNavSession.distanceNm.toFixed(1)} NM • BRG {formatHeadingDeg(activeNavSession.bearingDeg)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('route')}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black font-mono flex items-center gap-2 transition-all shadow-md shadow-cyan-950"
              >
                <span>View Route & Chart</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Navigation View */}
        <div className={activeTab === 'nav' ? 'flex flex-col gap-6 animate-fadeIn' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Compass Dial Section */}
            <div className="lg:col-span-5 w-full">
              <CompassDial
                compass={compass}
                gps={gps}
                headingSource={headingSource}
                onSourceChange={setHeadingSource}
                hasRealCompass={hasRealCompass}
                hasRealGps={hasRealGps}
                isManualHeading={isManualHeading}
                onManualHeadingChange={setHeadingManual}
                onResetManual={resetToSensorHeading}
                onRequestPermission={requestCompassPermission}
                dampingMode={dampingMode}
                onDampingChange={setDampingMode}
                displayRefreshRate={displayRefreshRate}
                onRefreshRateChange={setDisplayRefreshRate}
                headingCorrection={nmeaConfig.headingCorrection || 0}
                onHeadingCorrectionChange={(offset) => setNmeaConfig((prev) => ({ ...prev, headingCorrection: offset }))}
                isNightMode={isNightMode}
              />
            </div>

            {/* Lower/Right: Marine GNSS / GPS Position Cluster */}
            <div className="lg:col-span-7 w-full flex flex-col gap-6">
              <MarineGpsData
                gps={gps}
                magVariation={nmeaConfig.magVariation}
                hasRealGps={hasRealGps}
                isGpsAcquiring={isGpsAcquiring}
                gpsError={gpsError}
                gpsPermissionState={gpsPermissionState}
                onRequestGps={requestGpsFix}
                onSetManualGps={handleSetManualGps}
                isNightMode={isNightMode}
              />
            </div>
          </div>
        </div>

        {/* Tab 2: Marine Route & Waypoint Navigation & Offline Chart */}
        <div className={activeTab === 'route' ? 'flex flex-col gap-6 animate-fadeIn' : 'hidden'}>
          <RouteNavigationTab
            gps={gps}
            compass={compass}
            isNightMode={isNightMode}
            onNavSessionChange={setActiveNavSession}
          />
        </div>

        {/* Tab 3: NMEA 0183 Output */}
        <div className={activeTab === 'transmit' ? 'flex flex-col gap-6 animate-fadeIn' : 'hidden'}>
          <NmeaTransmitter
            gps={gps}
            compass={compass}
            config={nmeaConfig}
            onConfigChange={setNmeaConfig}
            serialStatus={serialStatus}
            isNightMode={isNightMode}
          />
        </div>

        {/* Tab 3: NMEA 0183 Monitor */}
        <div className={activeTab === 'monitor' ? 'flex flex-col gap-6 animate-fadeIn' : 'hidden'}>
          <NmeaMonitor
            serialStatus={serialStatus}
            isNightMode={isNightMode}
          />
        </div>

        {/* Tab 4: USB OTG & Drivers Guide */}
        <div className={activeTab === 'drivers' ? 'flex flex-col gap-6 animate-fadeIn' : 'hidden'}>
          <UsbDriverGuide isNightMode={isNightMode} />
        </div>

        {/* Tab 5: Developer Key Generator */}
        <div className={activeTab === 'keygen' ? 'flex flex-col gap-6 animate-fadeIn' : 'hidden'}>
          <KeyGenTab isNightMode={isNightMode} />
        </div>
      </main>

      {/* Docked Marine Console Footer Bar */}
      <footer className="mt-auto bg-slate-900 border-t border-slate-700 px-4 sm:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-8 sm:gap-12 w-full md:w-auto justify-between sm:justify-start">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 tracking-wider">
              Latitude
            </span>
            <span className="text-xl sm:text-2xl font-mono text-white font-bold tracking-tight">
              {formatMarineDDM(gps.latitude, false)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 tracking-wider">
              Longitude
            </span>
            <span className="text-xl sm:text-2xl font-mono text-white font-bold tracking-tight">
              {formatMarineDDM(gps.longitude, true)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase mb-0.5 tracking-wider">
              Altitude
            </span>
            <span className="text-xl sm:text-2xl font-mono text-slate-300 font-bold tracking-tight">
              {gps.altitude !== null ? `${gps.altitude.toFixed(1)}m` : '---.-m'}{' '}
              <span className="text-xs text-slate-500 font-normal">MSL</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="flex flex-col items-start md:items-end">
            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
              GNSS Receiver & Hardware Bus
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-2.5 py-1 rounded text-xs font-bold font-mono flex items-center gap-1.5 border ${
                hasRealGps 
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                  : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasRealGps ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                <span>{hasRealGps ? 'GPS: LOCKED' : 'GPS: SEARCHING'}</span>
              </div>

              <div className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 text-xs font-bold font-mono">
                {serialStatus.connected ? 'USB: ACTIVE' : 'USB: STANDBY'}
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Device License / 30-Day Trial Expiration Activation Modal */}
      {!licenseStatus.isActivated && licenseStatus.isTrialExpired && (
        <ActivationModal 
          developerEmail={OFFICIAL_SUPPORT_EMAIL}
          onActivated={() => setLicenseStatus(getLicenseStatus())} 
        />
      )}
    </div>
  );
}
