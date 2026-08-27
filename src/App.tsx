// Mariner Pro Marine Navigation & NMEA Bridge System v1.1.0
import React, { useState, useEffect, useRef } from 'react';
import { CompassData, GpsData, HeadingSource, NmeaConfig, SerialPortStatus } from './types';
import { useSensors } from './hooks/useSensors';
import { serialService } from './services/serialService';
import { getLicenseStatus, OFFICIAL_SUPPORT_EMAIL } from './services/licenseService';
import { Header, ActiveTab } from './components/Header';
import { CompassDial } from './components/CompassDial';
import { MarineGpsData } from './components/MarineGpsData';
import { NmeaTransmitter } from './components/NmeaTransmitter';
import { NmeaMonitor } from './components/NmeaMonitor';
import { UsbDriverGuide } from './components/UsbDriverGuide';
import { KeyGenTab } from './components/KeyGenTab';
import { ActivationModal } from './components/ActivationModal';
import { formatMarineDDM } from './utils/geo';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('nav');
  const [headingSource, setHeadingSource] = useState<HeadingSource>('magnetic');
  const [isNightMode, setIsNightMode] = useState<boolean>(false);
  const [licenseStatus, setLicenseStatus] = useState(() => getLicenseStatus());
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [exitToast, setExitToast] = useState<string | null>(null);

  const lastBackPressTime = useRef<number>(0);
  const activeTabRef = useRef<ActiveTab>(activeTab);
  const showAboutModalRef = useRef<boolean>(showAboutModal);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    showAboutModalRef.current = showAboutModal;
  }, [showAboutModal]);

  // Handle Android Hardware Back Button (Capacitor Native)
  useEffect(() => {
    let backListener: any = null;

    const attachCapacitorBackButton = async () => {
      const cap = (window as any).Capacitor;
      if (cap && cap.Plugins && cap.Plugins.App) {
        try {
          backListener = await cap.Plugins.App.addListener('backButton', () => {
            if (showAboutModalRef.current) {
              setShowAboutModal(false);
            } else {
              const now = Date.now();
              if (now - lastBackPressTime.current < 2000) {
                cap.Plugins.App.exitApp();
              } else {
                lastBackPressTime.current = now;
                setExitToast('Press BACK again to exit Mariner Pro');
                setTimeout(() => setExitToast(null), 2000);
              }
            }
          });
        } catch (e) {
          console.warn('Capacitor App plugin not initialized:', e);
        }
      }
    };

    attachCapacitorBackButton();

    return () => {
      if (backListener && typeof backListener.remove === 'function') {
        backListener.remove();
      }
    };
  }, []);

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
      />

      {/* Main Content Area - Fully Scrollable */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6 overflow-y-auto">
        {/* Tab 1: Navigation View */}
        {activeTab === 'nav' && (
          <div className="flex flex-col gap-6">
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
        )}

        {/* Tab 2: NMEA 0183 Output */}
        {activeTab === 'transmit' && (
          <NmeaTransmitter
            gps={gps}
            compass={compass}
            config={nmeaConfig}
            onConfigChange={setNmeaConfig}
            serialStatus={serialStatus}
            isNightMode={isNightMode}
          />
        )}

        {/* Tab 3: NMEA 0183 Monitor */}
        {activeTab === 'monitor' && (
          <NmeaMonitor
            serialStatus={serialStatus}
            isNightMode={isNightMode}
          />
        )}

        {/* Tab 4: USB OTG & Drivers Guide */}
        {activeTab === 'drivers' && (
          <UsbDriverGuide isNightMode={isNightMode} />
        )}

        {/* Tab 5: Developer Key Generator */}
        {activeTab === 'keygen' && (
          <KeyGenTab isNightMode={isNightMode} />
        )}
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
