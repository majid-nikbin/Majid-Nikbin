import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Compass, Navigation, Sliders, RefreshCw, X, ShieldAlert, CheckCircle, Gauge, Activity, Plus, Minus } from 'lucide-react';
import { CompassData, GpsData, HeadingSource } from '../types';
import { formatHeadingDeg, headingToCardinal } from '../utils/geo';
import { CompassDampingMode, DisplayRefreshRate } from '../hooks/useSensors';

interface CompassDialProps {
  compass: CompassData;
  gps: GpsData;
  headingSource: HeadingSource;
  onSourceChange: (source: HeadingSource) => void;
  hasRealCompass: boolean;
  hasRealGps: boolean;
  isManualHeading: boolean;
  onManualHeadingChange: (deg: number) => void;
  onResetManual: () => void;
  onRequestPermission: () => void;
  dampingMode?: CompassDampingMode;
  onDampingChange?: (mode: CompassDampingMode) => void;
  displayRefreshRate?: DisplayRefreshRate;
  onRefreshRateChange?: (rate: DisplayRefreshRate) => void;
  headingCorrection?: number;
  onHeadingCorrectionChange?: (offset: number) => void;
  isNightMode?: boolean;
}

// Compute shortest signed angular difference between two angles in degrees (-180 to +180)
function shortestAngleDiff(target: number, current: number): number {
  return ((((target - current) % 360) + 540) % 360) - 180;
}

export const CompassDial: React.FC<CompassDialProps> = ({
  compass,
  gps,
  headingSource,
  onSourceChange,
  hasRealCompass,
  hasRealGps,
  isManualHeading,
  onManualHeadingChange,
  onResetManual,
  onRequestPermission,
  dampingMode = 'smooth',
  onDampingChange,
  displayRefreshRate = '4hz',
  onRefreshRateChange,
  headingCorrection = 0.0,
  onHeadingCorrectionChange,
  isNightMode = false,
}) => {
  const [showManualSlider, setShowManualSlider] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Store last valid GPS heading to prevent snap glitch when vehicle stops or GPS fix momentarily pauses
  const lastValidGpsHeadingRef = useRef<number>(0);
  if (gps.heading !== null && !isNaN(gps.heading)) {
    lastValidGpsHeadingRef.current = gps.heading;
  }

  // Active target heading value depending on selected source
  const activeHeading = useMemo(() => {
    if (headingSource === 'gps') {
      if (gps.heading !== null && !isNaN(gps.heading)) {
        return gps.heading;
      }
      return lastValidGpsHeadingRef.current || compass.trueHeading;
    }
    return compass.magneticHeading;
  }, [headingSource, gps.heading, compass.trueHeading, compass.magneticHeading]);

  const activeCardinal = headingToCardinal(activeHeading);

  // High-performance direct SVG rotation ref (bypasses React DOM re-renders for buttery 60/120fps motion)
  const dialSvgRef = useRef<SVGSVGElement>(null);
  const currentAngleRef = useRef<number>(-activeHeading);
  const targetAngleRef = useRef<number>(-activeHeading);
  const dampingModeRef = useRef<CompassDampingMode>(dampingMode);
  dampingModeRef.current = dampingMode;

  targetAngleRef.current = -activeHeading;

  useEffect(() => {
    let animId: number;
    const animateRotation = () => {
      const target = targetAngleRef.current;
      const diff = shortestAngleDiff(target, currentAngleRef.current);

      if (Math.abs(diff) > 0.02) {
        // Damping factor: heavy = ultra calm, smooth = standard marine, balanced = medium, fast = responsive
        let stepFactor = 0.12;
        if (dampingModeRef.current === 'heavy') stepFactor = 0.06;
        else if (dampingModeRef.current === 'smooth') stepFactor = 0.12;
        else if (dampingModeRef.current === 'balanced') stepFactor = 0.22;
        else if (dampingModeRef.current === 'fast') stepFactor = 0.40;

        const step = diff * stepFactor;
        currentAngleRef.current += step;
        if (dialSvgRef.current) {
          dialSvgRef.current.style.transform = `rotate(${currentAngleRef.current}deg)`;
        }
      }
      animId = requestAnimationFrame(animateRotation);
    };

    animId = requestAnimationFrame(animateRotation);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Generate ticks for 360 degrees
  const ticks = useMemo(() => {
    const items = [];
    for (let deg = 0; deg < 360; deg++) {
      const isCardinal = deg % 90 === 0;
      const isInterCardinal = deg % 45 === 0 && !isCardinal;
      const isMajor = deg % 10 === 0;
      const isMedium = deg % 5 === 0;

      let len = 6;
      let strokeWidth = 1;
      let color = isNightMode ? '#7f1d1d' : '#334155';

      if (isCardinal) {
        len = 16;
        strokeWidth = 2.5;
        color = deg === 0 ? '#ef4444' : isNightMode ? '#f87171' : '#38bdf8';
      } else if (isInterCardinal) {
        len = 12;
        strokeWidth = 2;
        color = isNightMode ? '#dc2626' : '#64748b';
      } else if (isMajor) {
        len = 10;
        strokeWidth = 1.5;
        color = isNightMode ? '#b91c1c' : '#475569';
      } else if (isMedium) {
        len = 7;
        strokeWidth = 1.2;
      }

      items.push({
        deg,
        len,
        strokeWidth,
        color,
        isMajor,
        isCardinal,
      });
    }
    return items;
  }, [isNightMode]);

  // Major degree numbers (000, 030, 060, ..., 330)
  const degreeLabels = useMemo(() => {
    const labels = [];
    for (let deg = 0; deg < 360; deg += 30) {
      if (deg % 90 === 0) continue;
      labels.push({
        deg,
        text: deg.toString().padStart(3, '0'),
      });
    }
    return labels;
  }, []);

  // Format heading with 1 decimal place and leading zeros (e.g. 045.2°)
  const formattedHeadingString = useMemo(() => {
    const val = isNaN(activeHeading) ? 0 : ((activeHeading % 360) + 360) % 360;
    const whole = Math.floor(val).toString().padStart(3, '0');
    const frac = (val - Math.floor(val)).toFixed(1).substring(1); // e.g. .2
    return `${whole}${frac}`;
  }, [activeHeading]);

  return (
    <div
      id="compass-dial-container"
      className={`relative flex flex-col items-center justify-between p-6 rounded-2xl border transition-all select-none ${
        isNightMode
          ? 'bg-zinc-950/80 border-red-900/50 text-red-100 shadow-2xl'
          : 'bg-slate-900/50 border-slate-800 text-slate-200 shadow-2xl backdrop-blur-sm'
      }`}
    >
      {/* Top Header: Label, Source Toggle & Settings */}
      <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Navigation Compass
          </span>
          {headingCorrection !== 0 && (
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 border border-amber-500/50 text-amber-300">
              Offset: {headingCorrection > 0 ? `+${headingCorrection.toFixed(1)}°` : `${headingCorrection.toFixed(1)}°`}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
          {/* Heading Source Toggle */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
            <button
              id="btn-source-magnetic"
              type="button"
              onClick={() => onSourceChange('magnetic')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                headingSource === 'magnetic'
                  ? isNightMode
                    ? 'bg-red-700 text-white'
                    : 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Magnetic
            </button>

            <button
              id="btn-source-gps"
              type="button"
              onClick={() => onSourceChange('gps')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                headingSource === 'gps'
                  ? isNightMode
                    ? 'bg-red-700 text-white'
                    : 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              GPS Track
            </button>
          </div>

          {/* Quick Damping & Refresh Rate Drawer Toggle */}
          <button
            type="button"
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            title="Damping Filter, Refresh Rate & Magnetic Offset Correction"
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border font-bold transition-all ${
              showSettingsDrawer
                ? 'bg-cyan-950 border-cyan-500/80 text-cyan-300 shadow-sm'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px]">Filter / Offset</span>
          </button>

          {/* Manual Heading Slider */}
          <button
            id="btn-toggle-slider"
            type="button"
            onClick={() => setShowManualSlider(!showManualSlider)}
            title="Manual Heading Simulation Slider"
            className={`p-1.5 text-xs rounded-lg border transition-all ${
              isManualHeading || showManualSlider
                ? 'bg-slate-800 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Damping & Refresh Rate & Magnetic Correction Control Drawer */}
      {showSettingsDrawer && (
        <div className="w-full mb-4 p-3.5 bg-slate-950/95 border border-cyan-900/60 rounded-xl flex flex-col gap-3.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Compass Damping, Refresh Rate & Calibration Offset</span>
            </span>
            <button
              type="button"
              onClick={() => setShowSettingsDrawer(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Damping Filter Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Dial Damping Filter
              </label>
              {onDampingChange && (
                <select
                  value={dampingMode}
                  onChange={(e) => onDampingChange(e.target.value as CompassDampingMode)}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-2 font-bold outline-none focus:border-cyan-500"
                >
                  <option value="heavy">Heavy Marine (Ultra-damped / Zero jitter)</option>
                  <option value="smooth">Smooth Marine (Standard fluid motion)</option>
                  <option value="balanced">Balanced (Moderate response)</option>
                  <option value="fast">Fast (Instantaneous / Direct)</option>
                </select>
              )}
              <span className="text-[9px] text-slate-500">
                Heavy mode completely absorbs vessel wave motion & engine vibrations.
              </span>
            </div>

            {/* Display Refresh Rate Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Number Refresh Rate
              </label>
              {onRefreshRateChange && (
                <select
                  value={displayRefreshRate}
                  onChange={(e) => onRefreshRateChange(e.target.value as DisplayRefreshRate)}
                  className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-2 font-bold outline-none focus:border-cyan-500"
                >
                  <option value="1hz">1 Hz (Every 1s - High stability)</option>
                  <option value="2hz">2 Hz (Every 500ms - Smooth reading)</option>
                  <option value="4hz">4 Hz (Every 250ms - Marine standard)</option>
                  <option value="10hz">10 Hz (Every 100ms - Responsive)</option>
                  <option value="max">Continuous (Real-time 60 FPS)</option>
                </select>
              )}
              <span className="text-[9px] text-slate-500">
                Adjusts center digital heading update cadence to eliminate rapid flickering.
              </span>
            </div>

            {/* Magnetic Heading Correction Offset (+/- Deg) */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
                <span>Magnetic Correction Offset</span>
                <span className="font-mono text-cyan-300 text-xs">
                  {headingCorrection > 0 ? `+${headingCorrection.toFixed(1)}°` : `${headingCorrection.toFixed(1)}°`}
                </span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onHeadingCorrectionChange && onHeadingCorrectionChange(Number((headingCorrection - 1.0).toFixed(1)))}
                  className="p-2 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  title="-1.0°"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  step="0.5"
                  value={headingCorrection}
                  onChange={(e) => onHeadingCorrectionChange && onHeadingCorrectionChange(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs font-mono text-center text-cyan-300 rounded-lg p-2 font-bold outline-none focus:border-cyan-500"
                  placeholder="0.0"
                />
                <button
                  type="button"
                  onClick={() => onHeadingCorrectionChange && onHeadingCorrectionChange(Number((headingCorrection + 1.0).toFixed(1)))}
                  className="p-2 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
                  title="+1.0°"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                {headingCorrection !== 0 && (
                  <button
                    type="button"
                    onClick={() => onHeadingCorrectionChange && onHeadingCorrectionChange(0)}
                    className="text-[10px] px-2 py-2 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                    title="Reset to 0"
                  >
                    Reset
                  </button>
                )}
              </div>
              <span className="text-[9px] text-slate-500">
                Calibrate sensor offset to align magnetic heading with true heading (e.g. +3.5° or -2.0°).
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Manual Slider Drawer */}
      {showManualSlider && (
        <div className="w-full mb-4 p-3 bg-slate-950/90 border border-slate-700 rounded-xl flex flex-col gap-2 shadow-inner">
          <div className="flex justify-between items-center text-xs">
            <span className="text-cyan-400 font-bold uppercase tracking-wider text-[10px]">
              Manual Simulation Heading
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-cyan-300 font-bold">{activeHeading.toFixed(1)}°</span>
              {isManualHeading && (
                <button
                  type="button"
                  onClick={onResetManual}
                  className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
                >
                  Reset Sensor
                </button>
              )}
            </div>
          </div>
          <input
            id="manual-heading-slider"
            type="range"
            min="0"
            max="359.9"
            step="0.5"
            value={activeHeading}
            onChange={(e) => onManualHeadingChange(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
        </div>
      )}

      {/* Main 360° Compass Rose Dial */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center my-2">
        {/* Lubber Line Indicator (Top Fixed Pointer) */}
        <div className="absolute top-0 z-20 flex flex-col items-center pointer-events-none">
          <div className="w-0.5 h-6 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-red-500 -mt-0.5" />
        </div>

        {/* Continuous Smooth Non-Jumping Compass Card */}
        <svg
          ref={dialSvgRef}
          viewBox="-160 -160 320 320"
          className="w-full h-full transform will-change-transform"
          style={{ transform: `rotate(${-activeHeading}deg)` }}
        >
          {/* Outer Ring & Crosshair Grid */}
          <circle cx="0" cy="0" r="148" fill="none" stroke="#1e293b" strokeWidth="1" />
          <circle cx="0" cy="0" r="146" fill="none" stroke={isNightMode ? '#7f1d1d' : '#334155'} strokeWidth="2" />
          <circle cx="0" cy="0" r="90" fill="none" stroke="#1e293b" strokeWidth="0.75" strokeDasharray="2,4" />

          {/* 360 Ticks */}
          {ticks.map((t) => (
            <line
              key={t.deg}
              x1="0"
              y1="-146"
              x2="0"
              y2={-146 + t.len}
              stroke={t.color}
              strokeWidth={t.strokeWidth}
              transform={`rotate(${t.deg})`}
            />
          ))}

          {/* 30° Labels */}
          {degreeLabels.map((lbl) => (
            <text
              key={lbl.deg}
              x="0"
              y="-116"
              fill="#64748b"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="central"
              transform={`rotate(${lbl.deg})`}
            >
              {lbl.text}
            </text>
          ))}

          {/* Major Cardinals */}
          <g>
            <text
              x="0"
              y="-114"
              fill="#ef4444"
              fontSize="20"
              fontWeight="900"
              fontFamily="system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
            >
              N
            </text>
            <polygon points="0,-144 -6,-128 6,-128" fill="#ef4444" />

            <text
              x="114"
              y="0"
              fill="#94a3b8"
              fontSize="18"
              fontWeight="800"
              fontFamily="system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
              transform="rotate(90 114 0)"
            >
              E
            </text>

            <text
              x="0"
              y="114"
              fill="#94a3b8"
              fontSize="18"
              fontWeight="800"
              fontFamily="system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
              transform="rotate(180 0 114)"
            >
              S
            </text>

            <text
              x="-114"
              y="0"
              fill="#94a3b8"
              fontSize="18"
              fontWeight="800"
              fontFamily="system-ui, sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
              transform="rotate(270 -114 0)"
            >
              W
            </text>
          </g>
        </svg>

        {/* Center Digital Marine Readout with 1-Decimal Precision */}
        <div
          id="digital-heading-display"
          className="absolute flex flex-col items-center justify-center pointer-events-none"
        >
          <span
            className={`text-3xl sm:text-4xl font-black font-mono tracking-tighter ${
              isNightMode ? 'text-red-400' : 'text-cyan-400'
            }`}
          >
            {formattedHeadingString}°
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs font-mono font-bold text-slate-300">
              {activeCardinal}
            </span>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              {headingSource === 'magnetic' ? 'MAGNETIC' : 'GPS TRACK'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Instruments Metric Row (Speed, COG, True Heading) with 1 decimal precision */}
      <div className="w-full px-4 sm:px-8 mt-6 flex justify-between items-center text-center border-t border-slate-800/80 pt-4">
        <div>
          <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 tracking-wider">
            SPEED
          </div>
          <div className="text-xl font-mono text-white font-bold">
            {gps.speedKnots !== null ? gps.speedKnots.toFixed(1) : '0.0'}{' '}
            <span className="text-xs text-slate-500 font-normal">KTS</span>
          </div>
        </div>

        <div>
          <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 tracking-wider">
            COG
          </div>
          <div className="text-xl font-mono text-white font-bold">
            {gps.heading !== null ? `${gps.heading.toFixed(1)}°` : '---.-°'}
          </div>
        </div>

        <div>
          <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 tracking-wider">
            TRUE HDG
          </div>
          <div className="text-xl font-mono text-cyan-300 font-bold">
            {compass.trueHeading.toFixed(1)}°
          </div>
        </div>
      </div>
    </div>
  );
};
