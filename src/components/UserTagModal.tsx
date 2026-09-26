import React, { useState, useEffect } from 'react';
import { 
  X, 
  Flag, 
  Compass, 
  Trash2, 
  Save, 
  Navigation,
  Sparkles
} from 'lucide-react';
import { UserTag, GpsData } from '../types';
import { formatMarineDDM } from '../utils/geo';

interface UserTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagToEdit: UserTag | null;
  initialCoords: { lat: number; lon: number } | null;
  gps: GpsData;
  onSaveTag: (tag: UserTag) => void;
  onDeleteTag: (id: string) => void;
  onNavigateToTag?: (tag: UserTag) => void;
  isNightMode?: boolean;
}

export const DISTINCTIVE_TAG_COLORS = [
  { name: 'Neon Fuchsia', hex: '#ec4899', border: '#f472b6' },
  { name: 'Vivid Amber', hex: '#f59e0b', border: '#fbbf24' },
  { name: 'Electric Lime', hex: '#84cc16', border: '#a3e635' },
  { name: 'Bright Cyan', hex: '#06b6d4', border: '#22d3ee' },
  { name: 'Cyber Purple', hex: '#a855f7', border: '#c084fc' },
  { name: 'Signal Crimson', hex: '#f43f5e', border: '#fb7185' }
];

export const UserTagModal: React.FC<UserTagModalProps> = ({
  isOpen,
  onClose,
  tagToEdit,
  initialCoords,
  gps,
  onSaveTag,
  onDeleteTag,
  onNavigateToTag,
  isNightMode = false
}) => {
  const [name, setName] = useState<string>('');
  const [lat, setLat] = useState<number>(26.5);
  const [lon, setLon] = useState<number>(54.0);
  const [color, setColor] = useState<string>('#ec4899');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tagToEdit) {
      setName(tagToEdit.name);
      setLat(tagToEdit.latitude);
      setLon(tagToEdit.longitude);
      setColor(tagToEdit.color || '#ec4899');
      setNotes(tagToEdit.notes || '');
    } else if (initialCoords) {
      setName(`Flag ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
      setLat(initialCoords.lat);
      setLon(initialCoords.lon);
      setColor('#ec4899');
      setNotes('');
    } else if (gps.latitude !== null && gps.longitude !== null) {
      setName(`Vessel Flag ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
      setLat(gps.latitude);
      setLon(gps.longitude);
      setColor('#ec4899');
      setNotes('');
    }
    setError(null);
  }, [tagToEdit, initialCoords, isOpen, gps.latitude, gps.longitude]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) {
      setError('Please enter a flag name.');
      return;
    }
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError('Invalid geographic coordinates.');
      return;
    }

    const newTag: UserTag = {
      id: tagToEdit ? tagToEdit.id : `flag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      latitude: lat,
      longitude: lon,
      color,
      notes: notes.trim() || undefined,
      createdAt: tagToEdit ? tagToEdit.createdAt : Date.now()
    };

    onSaveTag(newTag);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn" dir="ltr">
      <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl flex flex-col overflow-hidden text-left font-sans ${
        isNightMode 
          ? 'bg-red-950/95 border-red-800 text-red-100 shadow-[0_0_40px_rgba(220,38,38,0.3)]' 
          : 'bg-slate-900 border-cyan-500/40 text-slate-100 shadow-[0_0_40px_rgba(6,182,212,0.25)]'
      }`}>
        {/* Header */}
        <div className={`px-4 py-3.5 border-b flex items-center justify-between ${
          isNightMode ? 'border-red-900/80 bg-red-900/30' : 'border-slate-800 bg-slate-950/60'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${color}25`, color }}>
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5">
                <span>{tagToEdit ? 'Edit Chart Flag' : 'Chart Flag Marker'}</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Custom named position marker with distinctive high-contrast styling
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

        {/* Form Body */}
        <div className="p-4 flex flex-col gap-3.5 text-xs font-mono">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-[11px]">
              {error}
            </div>
          )}

          {/* Tag Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-300 font-sans">
              Flag Marker Name:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fishing Spot 1, Anchorage A, Reef Hazard"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-bold text-sm focus:border-cyan-400 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Color Palette */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 font-sans">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Marker Color:</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {DISTINCTIVE_TAG_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  className={`h-9 rounded-xl transition-all flex items-center justify-center border-2 ${
                    color === c.hex 
                      ? 'scale-110 shadow-lg ring-2 ring-white/50 border-white' 
                      : 'border-transparent hover:scale-105 opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                >
                  {color === c.hex && (
                    <span className="w-2.5 h-2.5 rounded-full bg-white shadow" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Coordinates in Nautical DDM */}
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 flex items-center gap-1 font-sans">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Geographic Position:</span>
              </span>
              {gps.latitude !== null && (
                <button
                  type="button"
                  onClick={() => {
                    if (gps.latitude !== null && gps.longitude !== null) {
                      setLat(gps.latitude);
                      setLon(gps.longitude);
                    }
                  }}
                  className="text-cyan-400 hover:text-cyan-300 underline font-bold"
                >
                  Set to Vessel Fix
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-center">
                <div className="text-[10px] text-slate-500">Latitude (LAT)</div>
                <div className="font-bold text-white mt-0.5">{formatMarineDDM(lat, false)}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-center">
                <div className="text-[10px] text-slate-500">Longitude (LON)</div>
                <div className="font-bold text-white mt-0.5">{formatMarineDDM(lon, true)}</div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-300 font-sans">Note / Log (Optional):</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 15m depth, sandy seabed, good holding ground"
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex items-center justify-between gap-2 ${
          isNightMode ? 'border-red-900/80 bg-red-900/20' : 'border-slate-800 bg-slate-950/80'
        }`}>
          {tagToEdit ? (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Delete this flag marker?')) {
                  onDeleteTag(tagToEdit.id);
                  onClose();
                }
              }}
              className="px-3 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Flag</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {tagToEdit && onNavigateToTag && (
              <button
                type="button"
                onClick={() => {
                  onNavigateToTag(tagToEdit);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Navigate to Flag</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save Flag</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
