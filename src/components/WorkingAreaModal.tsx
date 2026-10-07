import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  HardDrive, 
  CheckCircle2, 
  Compass, 
  Trash2, 
  Layers, 
  Globe
} from 'lucide-react';
import { 
  LiveTileProvider, 
  LIVE_TILE_PROVIDERS, 
  estimateWorkingAreaTiles, 
  preCacheAreaTiles,
  getSavedWorkingAreas,
  saveWorkingAreaRecord,
  deleteWorkingAreaRecord,
  clearTileCache,
  getCachedTileStats
} from '../utils/marineTileLoader';
import { WorkingAreaRecord, GpsData } from '../types';

interface WorkingAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  gps: GpsData;
  currentCenter: [number, number];
  currentZoom: number;
  viewportBounds: { minLon: number; maxLon: number; minLat: number; maxLat: number };
  activeProvider: LiveTileProvider;
  onProviderChange: (p: LiveTileProvider) => void;
  isNightMode?: boolean;
  onDownloadComplete?: () => void;
}

export const WorkingAreaModal: React.FC<WorkingAreaModalProps> = ({
  isOpen,
  onClose,
  gps,
  currentCenter,
  currentZoom,
  viewportBounds,
  activeProvider,
  onProviderChange,
  isNightMode = false,
  onDownloadComplete
}) => {
  // Preset selection: Viewport, Persian Gulf, Caspian Sea, Gulf of Oman
  type AreaPreset = 'viewport' | 'persian_gulf' | 'caspian_sea' | 'oman_sea';
  const [selectedPreset, setSelectedPreset] = useState<AreaPreset>('viewport');
  const [qualityMode, setQualityMode] = useState<'standard' | 'high_res'>('high_res');

  // Download state
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ done: number; total: number; currentZoom: number } | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [cacheStats, setCacheStats] = useState<{ count: number; estimatedMb: number }>({ count: 0, estimatedMb: 0 });
  const [savedAreas, setSavedAreas] = useState<WorkingAreaRecord[]>([]);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Load cache stats and saved areas on open
  useEffect(() => {
    if (isOpen) {
      getCachedTileStats().then(setCacheStats);
      setSavedAreas(getSavedWorkingAreas());
      setDownloadSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate bounding box based on selected preset
  const getSelectedBounds = () => {
    switch (selectedPreset) {
      case 'viewport': {
        return {
          name: 'Current Chart Viewport',
          minLon: viewportBounds.minLon,
          maxLon: viewportBounds.maxLon,
          minLat: viewportBounds.minLat,
          maxLat: viewportBounds.maxLat
        };
      }
      case 'persian_gulf': {
        return {
          name: 'Persian Gulf & Strait of Hormuz',
          minLon: 48.2,
          maxLon: 57.0,
          minLat: 24.5,
          maxLat: 30.5
        };
      }
      case 'caspian_sea': {
        return {
          name: 'Caspian Sea (South & Central Basin)',
          minLon: 48.5,
          maxLon: 54.5,
          minLat: 36.5,
          maxLat: 42.0
        };
      }
      case 'oman_sea': {
        return {
          name: 'Gulf of Oman & Makran Coast',
          minLon: 56.5,
          maxLon: 62.0,
          minLat: 24.0,
          maxLat: 26.5
        };
      }
    }
  };

  const currentBounds = getSelectedBounds();
  const minZoom = qualityMode === 'high_res' ? 6 : 5;
  const maxZoom = qualityMode === 'high_res' ? 14 : 12;

  const estimate = estimateWorkingAreaTiles(
    currentBounds.minLon,
    currentBounds.maxLon,
    currentBounds.minLat,
    currentBounds.maxLat,
    minZoom,
    maxZoom
  );

  // Start Download
  const handleStartDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setProgress({ done: 0, total: estimate.totalTiles, currentZoom: minZoom });
    setDownloadSuccess(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await preCacheAreaTiles(
        activeProvider,
        currentBounds.minLon,
        currentBounds.maxLon,
        currentBounds.minLat,
        currentBounds.maxLat,
        minZoom,
        maxZoom,
        (done, total, z) => {
          setProgress({ done, total, currentZoom: z });
        },
        controller.signal
      );

      if (res.success) {
        // Save working area record
        const record: WorkingAreaRecord = {
          id: `wa_${Date.now()}`,
          name: currentBounds.name,
          provider: activeProvider,
          minLon: currentBounds.minLon,
          maxLon: currentBounds.maxLon,
          minLat: currentBounds.minLat,
          maxLat: currentBounds.maxLat,
          minZoom,
          maxZoom,
          tileCount: res.downloaded,
          downloadedAt: Date.now()
        };
        saveWorkingAreaRecord(record);
        setSavedAreas(getSavedWorkingAreas());

        setDownloadSuccess(`Area "${currentBounds.name}" successfully cached (${res.downloaded.toLocaleString()} tiles). 100% ready for offline sailing.`);
        if (onDownloadComplete) onDownloadComplete();
      } else {
        setDownloadSuccess('Download canceled by user.');
      }
    } catch {
      setDownloadSuccess('Download failed. Please check internet connection.');
    } finally {
      setIsDownloading(false);
      setProgress(null);
      getCachedTileStats().then(setCacheStats);
    }
  };

  // Cancel Download
  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsDownloading(false);
    setProgress(null);
  };

  // Clear All Cache
  const handleClearAll = async () => {
    if (window.confirm('Delete all cached offline map tiles from this device?')) {
      await clearTileCache();
      getCachedTileStats().then(setCacheStats);
      setSavedAreas([]);
      setDownloadSuccess('Tile storage cleared.');
    }
  };

  const percent = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn" dir="ltr">
      <div className={`relative w-full max-w-xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden text-left font-sans ${
        isNightMode 
          ? 'bg-red-950/95 border-red-800 text-red-100 shadow-[0_0_50px_rgba(220,38,38,0.3)]' 
          : 'bg-slate-900 border-cyan-500/40 text-slate-100 shadow-[0_0_50px_rgba(6,182,212,0.25)]'
      }`}>
        {/* Header */}
        <div className={`px-4 py-3.5 border-b flex items-center justify-between ${
          isNightMode ? 'border-red-900/80 bg-red-900/30' : 'border-slate-800 bg-slate-950/60'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isNightMode ? 'bg-red-900/60 text-amber-300' : 'bg-cyan-500/20 text-cyan-400'}`}>
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Download Working Area</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  100% Offline Ready
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Pre-cache high-resolution marine charts on device for ultra-smooth offline panning
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 text-xs font-mono">
          {/* Storage Status Bar */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] font-bold text-white">Stored Offline Tile Cache:</div>
                <div className="text-[10px] text-emerald-300 font-bold">
                  {cacheStats.count.toLocaleString()} tiles ({cacheStats.estimatedMb} MB)
                </div>
              </div>
            </div>
            {cacheStats.count > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isDownloading}
                className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800/60 text-red-300 text-[10px] flex items-center gap-1 transition-all"
                title="Clear all stored tiles"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Cache</span>
              </button>
            )}
          </div>

          {/* Success Banner */}
          {downloadSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-[11px] leading-relaxed animate-fadeIn">
              {downloadSuccess}
            </div>
          )}

          {/* Preset Area Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 font-sans">
              <Compass className="w-3.5 h-3.5" />
              <span>Select Navigation Working Zone:</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedPreset('viewport')}
                disabled={isDownloading}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  selectedPreset === 'viewport'
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-white text-[11px] flex items-center justify-between font-sans">
                  <span>Current Chart Viewport</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300">Exact View</span>
                </div>
                <div className="text-[10px] text-slate-400">Download the exact area currently visible on screen</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset('persian_gulf')}
                disabled={isDownloading}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  selectedPreset === 'persian_gulf'
                    ? 'bg-amber-950/80 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-white text-[11px] font-sans">Persian Gulf & Hormuz Strait</div>
                <div className="text-[10px] text-slate-400">Complete basin: Bushehr, Asaluyeh, Kish, Qeshm & Bandar Abbas</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset('caspian_sea')}
                disabled={isDownloading}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  selectedPreset === 'caspian_sea'
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-white text-[11px] font-sans">Caspian Sea Basin</div>
                <div className="text-[10px] text-slate-400">Anzali, Nowshahr, Babolsar, Amirabad & Turkmen</div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset('oman_sea')}
                disabled={isDownloading}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  selectedPreset === 'oman_sea'
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-white text-[11px] font-sans">Gulf of Oman & Makran Coast</div>
                <div className="text-[10px] text-slate-400">Passage from Jask to Chabahar & Pasabandar</div>
              </button>
            </div>
          </div>

          {/* Quality & Detail Level */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5 font-sans">
              <Layers className="w-3.5 h-3.5" />
              <span>Detail & Zoom Level:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQualityMode('high_res')}
                disabled={isDownloading}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  qualityMode === 'high_res'
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-md ring-1 ring-emerald-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-white text-[11px] flex items-center justify-between font-sans">
                  <span>High Detail & Coastal Zoom</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-900/60 text-emerald-300">Up to Zoom 14</span>
                </div>
                <div className="text-[10px] text-slate-400">Harbor entrances, marinas, islands, channels and coastal shoals</div>
              </button>

              <button
                type="button"
                onClick={() => setQualityMode('standard')}
                disabled={isDownloading}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                  qualityMode === 'standard'
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 shadow-md ring-1 ring-emerald-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-white text-[11px] flex items-center justify-between font-sans">
                  <span>Standard Passage Navigation</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-300">Up to Zoom 12</span>
                </div>
                <div className="text-[10px] text-slate-400">Smaller storage size, fast download, ideal for open water passages</div>
              </button>
            </div>
          </div>

          {/* Tile Provider Selector */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-sans">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Base Imagery Source:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {LIVE_TILE_PROVIDERS.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onProviderChange(p.id)}
                  disabled={isDownloading}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    activeProvider === p.id
                      ? 'bg-slate-800 border-cyan-400 text-cyan-300 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[10px] text-white font-bold">{p.name}</div>
                  <div className="text-[8px] text-slate-400">{p.badge}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Download Progress Bar */}
          {isDownloading && progress && (
            <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/50 flex flex-col gap-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Downloading tiles (Zoom Level {progress.currentZoom})...</span>
                </span>
                <span className="font-mono font-bold text-white">{percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-150" 
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Downloaded: {progress.done.toLocaleString()} of {progress.total.toLocaleString()} tiles</span>
                <button
                  type="button"
                  onClick={handleCancelDownload}
                  className="text-red-400 hover:text-red-300 underline font-bold"
                >
                  Cancel Download
                </button>
              </div>
            </div>
          )}

          {/* Previously Saved Working Areas */}
          {savedAreas.length > 0 && !isDownloading && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Saved Offline Areas on this Device:
              </span>
              <div className="flex flex-col gap-1">
                {savedAreas.map((area) => (
                  <div key={area.id} className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white">{area.name}</span>
                        <span className="text-slate-500 ml-1.5">({area.tileCount.toLocaleString()} tiles • Zoom {area.minZoom}-{area.maxZoom})</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        deleteWorkingAreaRecord(area.id);
                        setSavedAreas(getSavedWorkingAreas());
                      }}
                      className="text-slate-500 hover:text-red-400 p-1"
                      title="Remove from list"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          isNightMode ? 'border-red-900/80 bg-red-900/20' : 'border-slate-800 bg-slate-950/80'
        }`}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Estimate:</span>
            <span className="font-bold text-cyan-300 font-mono">
              ~{estimate.totalTiles.toLocaleString()} tiles ({estimate.estimatedMb} MB)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleStartDownload}
              disabled={isDownloading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Downloading...' : 'Download & Cache Offline'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
