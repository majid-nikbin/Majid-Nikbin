import React, { useState, useEffect } from 'react';
import { useSensors } from './hooks/useSensors';
import { Header } from './components/Header';
import { OfflineMarineChart } from './components/OfflineMarineChart';
import { CompassDial } from './components/CompassDial';
import { MarineGpsData } from './components/MarineGpsData';
import { RouteNavigationTab } from './components/RouteNavigationTab';
import { NmeaMonitor } from './components/NmeaMonitor';
import { NmeaTransmitter } from './components/NmeaTransmitter';
import { KeyGenTab } from './components/KeyGenTab';
import { UsbDriverGuide } from './components/UsbDriverGuide';
import { MarineRoute, Waypoint, NavigationSession, NmeaSentence } from './types';
import { serialService } from './services/serialService';
import { parseNmeaSentence } from './utils/nmea';
import { Compass, Map, Route, Terminal, Shield, Usb, Radio } from 'lucide-react';

export function App() {
  const { gps, compass, hasGpsFix } = useSensors();

  // Tab State
  const [activeTab, setActiveTab] = useState<'chart' | 'compass' | 'routes' | 'nmea' | 'license'>('chart');

  // USB State
  const [isUsbConnected, setIsUsbConnected] = useState(false);
  const [usbMode, setUsbMode] = useState<'serial' | 'webusb' | null>(null);
  const [showUsbGuide, setShowUsbGuide] = useState(false);

  // NMEA Messages State
  const [nmeaSentences, setNmeaSentences] = useState<NmeaSentence[]>([]);

  // Routes & Navigation State
  const [routes, setRoutes] = useState<MarineRoute[]>(() => {
    try {
      const saved = localStorage.getItem('mariner_saved_routes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'default_strait',
        name: 'مسیر تنگه هرمز به قشم',
        waypoints: [
          { id: 'w1', name: 'بندرعباس اسکله', latitude: 27.145, longitude: 56.28, createdAt: 1 },
          { id: 'w2', name: 'کانال ورودی هرمز', latitude: 26.98, longitude: 56.35, createdAt: 2 },
          { id: 'w3', name: 'بویه لارک', latitude: 26.85, longitude: 56.4, createdAt: 3 },
          { id: 'w4', name: 'اسکله قشم', latitude: 26.96, longitude: 56.27, createdAt: 4 }
        ],
        createdAt: Date.now()
      }
    ];
  });

  const [activeRoute, setActiveRoute] = useState<MarineRoute | null>(routes[0] || null);
  const [navigationSession, setNavigationSession] = useState<NavigationSession>({
    isNavigating: false,
    routeId: null,
    targetWaypointId: null,
    startTime: null
  });

  // Save routes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mariner_saved_routes', JSON.stringify(routes));
    } catch {}
  }, [routes]);

  // Handle incoming NMEA sentences from USB
  useEffect(() => {
    serialService.setOnSentence((raw) => {
      const parsed = parseNmeaSentence(raw);
      const newSentence: NmeaSentence = {
        id: `nmea_${Date.now()}_${Math.random()}`,
        raw,
        timestamp: Date.now(),
        type: parsed?.type || 'RAW',
        talker: parsed?.talker || 'II'
      };
      setNmeaSentences((prev) => [...prev.slice(-300), newSentence]);
    });
  }, []);

  // USB Connect Handlers (100% Offline Local Operation)
  const handleConnectUsb = async (baudRate = 4800) => {
    try {
      const res = await serialService.connect(baudRate);
      setIsUsbConnected(true);
      setUsbMode(res.mode);
      setShowUsbGuide(false);
    } catch (err: any) {
      console.warn('USB Connect error:', err);
      // If failed, show helpful local guide
      setShowUsbGuide(true);
    }
  };

  const handleDisconnectUsb = async () => {
    await serialService.disconnect();
    setIsUsbConnected(false);
    setUsbMode(null);
  };

  const handleSendNmea = (sentence: string) => {
    serialService.sendSentence(sentence);
  };

  // Route Handlers
  const handleCreateRoute = (name: string) => {
    const newRoute: MarineRoute = {
      id: `route_${Date.now()}`,
      name,
      waypoints: [],
      createdAt: Date.now()
    };
    setRoutes((prev) => [...prev, newRoute]);
    setActiveRoute(newRoute);
  };

  const handleDeleteRoute = (routeId: string) => {
    setRoutes((prev) => prev.filter((r) => r.id !== routeId));
    if (activeRoute?.id === routeId) {
      setActiveRoute(null);
      if (navigationSession.isNavigating) {
        setNavigationSession({ isNavigating: false, routeId: null, targetWaypointId: null, startTime: null });
      }
    }
  };

  const handleAddWaypointToRoute = (wp: Waypoint) => {
    if (!activeRoute) return;
    const updated = {
      ...activeRoute,
      waypoints: [...activeRoute.waypoints, wp]
    };
    setRoutes((prev) => prev.map((r) => (r.id === activeRoute.id ? updated : r)));
    setActiveRoute(updated);
  };

  const handleRemoveWaypointFromRoute = (wpId: string) => {
    if (!activeRoute) return;
    const updated = {
      ...activeRoute,
      waypoints: activeRoute.waypoints.filter((w) => w.id !== wpId)
    };
    setRoutes((prev) => prev.map((r) => (r.id === activeRoute.id ? updated : r)));
    setActiveRoute(updated);
  };

  const handleStartNavigation = (route: MarineRoute) => {
    setActiveRoute(route);
    setNavigationSession({
      isNavigating: true,
      routeId: route.id,
      targetWaypointId: route.waypoints[0]?.id || null,
      startTime: Date.now()
    });
    setActiveTab('chart');
  };

  const handleStopNavigation = () => {
    setNavigationSession({
      isNavigating: false,
      routeId: null,
      targetWaypointId: null,
      startTime: null
    });
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        gps={gps}
        hasGpsFix={hasGpsFix}
        isUsbConnected={isUsbConnected}
        usbMode={usbMode}
        onConnectUsb={() => handleConnectUsb(4800)}
        onDisconnectUsb={handleDisconnectUsb}
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'chart' && (
          <OfflineMarineChart
            gps={gps}
            compass={compass}
            routes={routes}
            activeRoute={activeRoute}
            navigationSession={navigationSession}
            userTags={[]}
            workingAreas={[]}
            onAddWaypointToRoute={handleAddWaypointToRoute}
            onRemoveWaypointFromRoute={handleRemoveWaypointFromRoute}
            onStartNavigation={handleStartNavigation}
            onStopNavigation={handleStopNavigation}
          />
        )}

        {activeTab === 'compass' && (
          <div className="h-full overflow-y-auto p-4 flex flex-col gap-4 max-w-2xl mx-auto">
            <CompassDial compass={compass} gps={gps} />
            <MarineGpsData gps={gps} />
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="h-full overflow-y-auto p-4 max-w-3xl mx-auto">
            <RouteNavigationTab
              routes={routes}
              activeRoute={activeRoute}
              navigationSession={navigationSession}
              gps={gps}
              onSelectRoute={setActiveRoute}
              onCreateRoute={handleCreateRoute}
              onDeleteRoute={handleDeleteRoute}
              onStartNavigation={handleStartNavigation}
              onStopNavigation={handleStopNavigation}
            />
          </div>
        )}

        {activeTab === 'nmea' && (
          <div className="h-full overflow-y-auto p-4 flex flex-col gap-4 max-w-4xl mx-auto">
            <NmeaTransmitter
              gps={gps}
              compass={compass}
              isUsbConnected={isUsbConnected}
              onSendSentence={handleSendNmea}
            />
            <NmeaMonitor
              sentences={nmeaSentences}
              isUsbConnected={isUsbConnected}
              onClear={() => setNmeaSentences([])}
              onSendSentence={handleSendNmea}
              onConnectUsb={handleConnectUsb}
            />
          </div>
        )}

        {activeTab === 'license' && (
          <div className="h-full overflow-y-auto p-4">
            <KeyGenTab />
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="w-full bg-slate-900/95 border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl backdrop-blur-md z-30">
        <button
          type="button"
          onClick={() => setActiveTab('chart')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'chart'
              ? 'text-cyan-400 font-bold bg-cyan-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Map className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">نقشه و چارت</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compass')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'compass'
              ? 'text-cyan-400 font-bold bg-cyan-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">قطب‌نما و GPS</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('routes')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'routes'
              ? 'text-cyan-400 font-bold bg-cyan-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">مسیرها</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('nmea')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'nmea'
              ? 'text-cyan-400 font-bold bg-cyan-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">پورت NMEA</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('license')}
          className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'license'
              ? 'text-cyan-400 font-bold bg-cyan-950/50'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">لایسنس</span>
        </button>
      </nav>

      {/* USB Driver Guide Modal */}
      {showUsbGuide && (
        <UsbDriverGuide
          onClose={() => setShowUsbGuide(false)}
          onConnectUsb={() => handleConnectUsb(4800)}
        />
      )}
    </div>
  );
}
