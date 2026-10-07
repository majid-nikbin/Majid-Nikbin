import React, { useState } from 'react';
import { NmeaSentence } from '../types';
import { Terminal, Play, Pause, Trash2, Usb, Send } from 'lucide-react';

interface NmeaMonitorProps {
  sentences: NmeaSentence[];
  isUsbConnected: boolean;
  onClear: () => void;
  onSendSentence: (sentence: string) => void;
  onConnectUsb: (baudRate: number) => void;
}

export const NmeaMonitor: React.FC<NmeaMonitorProps> = ({
  sentences,
  isUsbConnected,
  onClear,
  onSendSentence,
  onConnectUsb
}) => {
  const [isPaused, setIsPaused] = useState(false);
  const [baudRate, setBaudRate] = useState<number>(4800);
  const [customInput, setCustomInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onSendSentence(customInput.trim());
    setCustomInput('');
  };

  const displayed = isPaused ? sentences.slice(0, 100) : sentences.slice(-100);

  return (
    <div className="flex flex-col h-full bg-slate-900/80 rounded-2xl border border-slate-800 p-3 shadow-xl">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-white">مانیتور جملات NMEA 0183</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
            {sentences.length} پیام
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Baud Rate */}
          <select
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none"
            title="نرخ باد پورت سریال"
          >
            <option value={4800}>4800 Baud (NMEA 0183)</option>
            <option value={9600}>9600 Baud</option>
            <option value={38400}>38400 Baud (AIS)</option>
            <option value={115200}>115200 Baud</option>
          </select>

          {/* Pause / Resume */}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title={isPaused ? 'ادامه نمایش' : 'توقف موقت'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* Clear */}
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="پاک کردن لیست"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto p-2.5 my-2 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] leading-relaxed flex flex-col-reverse">
        {displayed.length === 0 ? (
          <div className="text-slate-500 italic text-center my-auto">
            در انتظار دریافت داده از پورت سریال NMEA...
          </div>
        ) : (
          displayed.slice().reverse().map((s) => (
            <div key={s.id} className="py-0.5 border-b border-slate-900/50 flex items-start gap-2">
              <span className="text-slate-500 select-none text-[9px] shrink-0">
                {new Date(s.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-cyan-300 font-bold shrink-0">[{s.type}]</span>
              <span className="text-slate-300 break-all">{s.raw}</span>
            </div>
          ))
        )}
      </div>

      {/* Manual NMEA Send Form */}
      <form onSubmit={handleSend} className="flex items-center gap-2 pt-2 border-t border-slate-800">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          placeholder="$GPRMC,... یا $HCHDG,..."
          className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={!isUsbConnected}
          className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 shadow transition-all"
        >
          <Send className="w-3 h-3" />
          <span>ارسال</span>
        </button>
      </form>
    </div>
  );
};
