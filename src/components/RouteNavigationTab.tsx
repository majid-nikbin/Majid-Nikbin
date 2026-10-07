import React, { useState } from 'react';
import { MarineRoute, Waypoint, NavigationSession, GpsData } from '../types';
import { calculateDistanceNm, calculateBearing, formatHeadingDeg, formatEta } from '../utils/geo';
import { Navigation, Plus, Trash2, Play, Square, MapPin, Flag, ChevronRight } from 'lucide-react';

interface RouteNavigationTabProps {
  routes: MarineRoute[];
  activeRoute: MarineRoute | null;
  navigationSession: NavigationSession;
  gps: GpsData;
  onSelectRoute: (route: MarineRoute) => void;
  onCreateRoute: (name: string) => void;
  onDeleteRoute: (routeId: string) => void;
  onStartNavigation: (route: MarineRoute) => void;
  onStopNavigation: () => void;
}

export const RouteNavigationTab: React.FC<RouteNavigationTabProps> = ({
  routes,
  activeRoute,
  navigationSession,
  gps,
  onSelectRoute,
  onCreateRoute,
  onDeleteRoute,
  onStartNavigation,
  onStopNavigation
}) => {
  const [newRouteName, setNewRouteName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName.trim()) return;
    onCreateRoute(newRouteName.trim());
    setNewRouteName('');
  };

  const vesselLat = gps.latitude ?? 27.1832;
  const vesselLon = gps.longitude ?? 56.2736;

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* Active Navigation Dashboard */}
      {navigationSession.isNavigating && activeRoute && (
        <div className="p-4 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 rounded-2xl border border-amber-500/50 shadow-xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-amber-400 animate-pulse" />
              <div>
                <span className="text-xs text-amber-400 font-bold">در حال ناوبری مسیر فعال</span>
                <h3 className="text-sm font-bold text-white">{activeRoute.name}</h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onStopNavigation}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>توقف ناوبری</span>
            </button>
          </div>
        </div>
      )}

      {/* Routes List & Creator */}
      <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white">مدیریت مسیرها و نقاط (Routes & Waypoints)</h3>
          </div>

          <form onSubmit={handleCreate} className="flex items-center gap-1.5">
            <input
              type="text"
              value={newRouteName}
              onChange={(e) => setNewRouteName(e.target.value)}
              placeholder="نام مسیر جدید..."
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ایجاد مسیر</span>
            </button>
          </form>
        </div>

        {routes.length === 0 ? (
          <div className="p-6 text-center text-slate-500 italic text-xs">
            هیچ مسیری ثبت نشده است. روی نقشه یا فرم بالا یک مسیر بسازید.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {routes.map((r) => {
              const isSelected = activeRoute?.id === r.id;
              let totalNm = 0;
              for (let i = 0; i < r.waypoints.length - 1; i++) {
                totalNm += calculateDistanceNm(
                  r.waypoints[i].latitude,
                  r.waypoints[i].longitude,
                  r.waypoints[i + 1].latitude,
                  r.waypoints[i + 1].longitude
                );
              }

              return (
                <div
                  key={r.id}
                  onClick={() => onSelectRoute(r)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/80 shadow-lg'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-cyan-400">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{r.name}</span>
                        {isSelected && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                            انتخاب‌شده
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {r.waypoints.length} نقطه • مسافت کل: {totalNm.toFixed(1)} NM
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartNavigation(r);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow"
                      title="شروع ناوبری به سمت این مسیر"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>ناوبری</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRoute(r.id);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                      title="حذف مسیر"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
