import React from 'react';
import { CompassData, GpsData } from '../types';
import { formatHeadingDeg, headingToCardinal } from '../utils/geo';

interface CompassDialProps {
  compass: CompassData;
  gps: GpsData;
}

export const CompassDial: React.FC<CompassDialProps> = ({ compass, gps }) => {
  const heading = (gps.speedKnots && gps.speedKnots > 1 && gps.heading !== null)
    ? gps.heading
    : (compass.trueHeading || compass.magneticHeading || 0);

  const cardinal = headingToCardinal(heading);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-slate-900/60 rounded-2xl border border-slate-800 shadow-xl">
      {/* Compass Dial Card */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-slate-700 bg-slate-950 shadow-2xl flex items-center justify-center overflow-hidden">
        {/* Fixed Top Lubber Line Marker (Vessel Bow) */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-red-500 z-20 drop-shadow" />

        {/* Rotating Dial Ring */}
        <div
          className="absolute inset-2 rounded-full transition-transform duration-100 ease-out flex items-center justify-center"
          style={{ transform: `rotate(${-heading}deg)` }}
        >
          {/* Degree Ticks */}
          {Array.from({ length: 72 }).map((_, i) => {
            const deg = i * 5;
            const isMajor = deg % 30 === 0;
            const isCardinal = deg % 90 === 0;
            return (
              <div
                key={deg}
                className="absolute inset-0 flex justify-center"
                style={{ transform: `rotate(${deg}deg)` }}
              >
                <div
                  className={`w-0.5 ${
                    isCardinal
                      ? 'h-4 bg-red-400'
                      : isMajor
                      ? 'h-3 bg-cyan-400'
                      : 'h-1.5 bg-slate-600'
                  }`}
                />
              </div>
            );
          })}

          {/* Cardinal Labels */}
          <span className="absolute top-5 font-bold text-base text-red-500 font-mono">N</span>
          <span className="absolute right-5 font-bold text-base text-cyan-400 font-mono">E</span>
          <span className="absolute bottom-5 font-bold text-base text-cyan-400 font-mono">S</span>
          <span className="absolute left-5 font-bold text-base text-cyan-400 font-mono">W</span>
        </div>

        {/* Center Digital Heading Readout */}
        <div className="relative z-10 flex flex-col items-center justify-center bg-slate-900/90 w-28 h-28 rounded-full border-2 border-slate-700 shadow-xl">
          <span className="text-2xl sm:text-3xl font-black font-mono text-cyan-400">
            {formatHeadingDeg(heading)}
          </span>
          <span className="text-xs font-bold text-slate-300 font-mono tracking-wider">
            {cardinal}
          </span>
        </div>
      </div>

      {/* Auxiliary Pitch & Roll Readouts */}
      <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-400">
        <div>PITCH: <span className="text-slate-200 font-bold">{compass.pitch ?? 0}°</span></div>
        <div>ROLL: <span className="text-slate-200 font-bold">{compass.roll ?? 0}°</span></div>
      </div>
    </div>
  );
};
