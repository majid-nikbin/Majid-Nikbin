import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Copy,
  Download,
  Search,
  Send,
  Trash2,
  XCircle,
  Zap,
  Radio,
  Usb,
  Cable
} from 'lucide-react';
import { NmeaLogEntry, SerialPortStatus } from '../types';
import { parseNmeaSentence } from '../utils/nmea';
import { serialService } from '../services/serialService';

interface NmeaMonitorProps {
  serialStatus: SerialPortStatus;
  isNightMode?: boolean;
}

export const NmeaMonitor: React.FC<NmeaMonitorProps> = ({
  serialStatus,
  isNightMode = false,
}) => {
  const [logs, setLogs] = useState<NmeaLogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'RX' | 'TX'>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedBaud, setSelectedBaud] = useState<number>(serialStatus.baudRate || 4800);
  const [customSentence, setCustomSentence] = useState<string>('$HEHDT,045.0,T');
  const [selectedLog, setSelectedLog] = useState<NmeaLogEntry | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to live log stream
  useEffect(() => {
    const unsub = serialService.subscribeLog((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry];
        if (next.length > 500) {
          return next.slice(next.length - 500);
        }
        return next;
      });
    });

    return () => unsub();
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Direct WebUSB connection from monitor
  const handleConnectWebUsb = async () => {
    setIsConnecting(true);
    try {
      await serialService.connectWebUsb(selectedBaud);
    } catch (err) {
      console.warn('WebUSB Connect error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  // Direct WebSerial connection from monitor
  const handleConnectWebSerial = async () => {
    setIsConnecting(true);
    try {
      await serialService.connectWebSerial(selectedBaud);
    } catch (err) {
      console.warn('WebSerial Connect error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectSimulator = () => {
    serialService.connectSimulated(selectedBaud);
  };

  const handleDisconnect = async () => {
    await serialService.disconnect();
  };

  const handleClearLogs = () => {
    setLogs([]);
    setSelectedLog(null);
  };

  const handleCopyLogs = () => {
    const raw = logs.map((l) => `[${l.timestamp}] [${l.direction}] ${l.raw}`).join('\n');
    navigator.clipboard?.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLog = () => {
    const content = logs.map((l) => `[${l.timestamp}] ${l.raw}`).join('\r\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nmea_0183_log_${new Date().toISOString().substring(0, 19).replace(/[:T]/g, '-')}.nmea`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSendCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSentence.trim()) return;

    let payload = customSentence.trim();
    if (!payload.includes('*')) {
      const body = payload.startsWith('$') || payload.startsWith('!') ? payload.substring(1) : payload;
      let cks = 0;
      for (let i = 0; i < body.length; i++) cks ^= body.charCodeAt(i);
      const hex = cks.toString(16).toUpperCase().padStart(2, '0');
      payload = `$${body}*${hex}\r\n`;
    } else if (!payload.endsWith('\r\n')) {
      payload += '\r\n';
    }

    await serialService.writeSentences([payload]);
    setCustomSentence('');
  };

  const filteredLogs = logs.filter((log) => {
    if (directionFilter !== 'ALL' && log.direction !== directionFilter) return false;
    if (searchFilter) {
      const q = searchFilter.toUpperCase();
      return log.raw.toUpperCase().includes(q) || log.sentenceType.toUpperCase().includes(q);
    }
    return true;
  });

  const latestParsed = selectedLog
    ? parseNmeaSentence(selectedLog.raw)
    : logs.length > 0
    ? parseNmeaSentence(logs[logs.length - 1].raw)
    : null;

  return (
    <div
      id="nmea-monitor-container"
      className={`p-6 rounded-2xl border transition-all flex flex-col gap-6 ${
        isNightMode
          ? 'bg-zinc-950/80 border-red-900/50 text-red-100 shadow-xl'
          : 'bg-slate-800/40 border-slate-700 text-slate-200 shadow-xl'
      }`}
    >
      {/* Header & Connection Controls directly in Monitor Tab */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              serialStatus.connected
                ? isNightMode
                  ? 'bg-red-700 text-white'
                  : 'bg-cyan-600 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                NMEA Data Stream Monitor
              </h2>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-widest ${
                  serialStatus.connected
                    ? 'bg-green-900/30 border border-green-500/50 text-green-400'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {serialStatus.connected ? 'LISTENING ACTIVE' : 'STANDBY'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {serialStatus.connected
                ? `${serialStatus.driverType || 'USB Device'} • RX: ${serialStatus.sentencesReceived} • TX: ${serialStatus.sentencesSent}`
                : 'Receive, decode, and analyze raw NMEA 0183 sentences via USB OTG'}
            </p>
          </div>
        </div>

        {/* USB Connection Actions right inside Monitor tab */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {!serialStatus.connected ? (
            <>
              <select
                id="select-monitor-baud"
                value={selectedBaud}
                onChange={(e) => setSelectedBaud(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-2 font-mono outline-none"
              >
                <option value={4800}>4800</option>
                <option value={9600}>9600</option>
                <option value={19200}>19200</option>
                <option value={38400}>38400 (AIS)</option>
                <option value={57600}>57600</option>
                <option value={115200}>115200</option>
              </select>

              <button
                id="btn-monitor-webusb"
                type="button"
                onClick={handleConnectWebUsb}
                disabled={isConnecting}
                title="Connect via WebUSB (Best for Android & MAX485)"
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all shadow-md ${
                  isNightMode
                    ? 'bg-red-700 hover:bg-red-600 text-white'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                }`}
              >
                <Usb className="w-3.5 h-3.5" />
                <span>{isConnecting ? 'Connecting...' : 'Connect USB'}</span>
              </button>

              <button
                id="btn-monitor-simulator"
                type="button"
                onClick={handleConnectSimulator}
                title="Virtual loopback testing"
                className="px-2.5 py-2 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              >
                Simulator
              </button>
            </>
          ) : (
            <button
              id="btn-monitor-disconnect"
              type="button"
              onClick={handleDisconnect}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 hover:bg-rose-900"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Live Decoded Sentence Inspector Card */}
      {latestParsed && latestParsed.parsed && (
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2 font-bold text-slate-300">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>
                Decoded NMEA Sentence:{' '}
                <span className="font-mono text-cyan-400 font-bold">
                  ${latestParsed.talker}{latestParsed.type}
                </span>
              </span>
            </div>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded font-mono font-bold ${
                latestParsed.isValid
                  ? 'bg-green-900/30 border border-green-500/50 text-green-400'
                  : 'bg-rose-900/30 border border-rose-500/50 text-rose-400'
              }`}
            >
              {latestParsed.isValid ? 'CHECKSUM OK' : 'CHECKSUM ERROR'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {latestParsed.parsed.latitude && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Position</span>
                <span className="font-mono font-bold text-white mt-0.5 block">
                  {latestParsed.parsed.latitude}, {latestParsed.parsed.longitude}
                </span>
              </div>
            )}

            {latestParsed.parsed.headingTrue !== undefined && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">True Heading</span>
                <span className="font-mono font-bold text-cyan-400 mt-0.5 block">
                  {latestParsed.parsed.headingTrue.toFixed(1)}° True
                </span>
              </div>
            )}

            {latestParsed.parsed.sogKnots !== undefined && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Speed Over Ground</span>
                <span className="font-mono font-bold text-green-400 mt-0.5 block">
                  {latestParsed.parsed.sogKnots.toFixed(1)} kts
                </span>
              </div>
            )}

            {latestParsed.parsed.cogTrue !== undefined && (
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Course Over Ground</span>
                <span className="font-mono font-bold text-amber-400 mt-0.5 block">
                  {latestParsed.parsed.cogTrue.toFixed(1)}° True
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Terminal Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Direction Filter */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
          <button
            type="button"
            onClick={() => setDirectionFilter('ALL')}
            className={`px-3 py-1 rounded font-bold transition-all ${
              directionFilter === 'ALL'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setDirectionFilter('RX')}
            className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition-all ${
              directionFilter === 'RX'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
            <span>RX In</span>
          </button>
          <button
            type="button"
            onClick={() => setDirectionFilter('TX')}
            className={`flex items-center gap-1 px-3 py-1 rounded font-bold transition-all ${
              directionFilter === 'TX'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpCircle className="w-3.5 h-3.5" />
            <span>TX Out</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            placeholder="Filter sentence (HDT, RMC, GGA)..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-3 py-2 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
              autoScroll
                ? 'bg-slate-900 border-cyan-500/60 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {autoScroll ? 'Scroll: ON' : 'Scroll: PAUSED'}
          </button>

          <button
            type="button"
            onClick={handleCopyLogs}
            title="Copy logs"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownloadLog}
            title="Download .nmea file"
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleClearLogs}
            title="Clear logs"
            className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-800/40"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal View matching Professional Polish design */}
      <div
        id="nmea-terminal-feed"
        className="h-80 sm:h-96 bg-[#020617] rounded-2xl border border-slate-700 p-4 font-mono text-[11px] text-green-500 overflow-y-auto leading-relaxed shadow-inner flex flex-col gap-1 select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="m-auto text-center text-slate-600 py-12 flex flex-col items-center gap-2">
            <Activity className="w-8 h-8 opacity-40 animate-pulse" />
            <p className="text-slate-500">Awaiting NMEA 0183 sentence traffic...</p>
            <p className="text-[10px] text-slate-600">Connect USB OTG or start transmission to view live sentence stream.</p>
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isSelected = selectedLog?.id === entry.id;
            return (
              <div
                key={entry.id}
                onClick={() => setSelectedLog(entry)}
                className={`px-2 py-1 rounded cursor-pointer transition-colors flex items-start gap-2.5 ${
                  isSelected
                    ? 'bg-slate-800/80 border-l-2 border-cyan-400'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="text-slate-600 text-[10px] shrink-0 pt-0.5">
                  {entry.timestamp}
                </span>

                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold shrink-0 ${
                    entry.direction === 'RX'
                      ? 'bg-green-950 text-green-400 border border-green-800'
                      : 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                  }`}
                >
                  {entry.direction}
                </span>

                <span
                  className={`flex-1 break-all ${
                    entry.direction === 'RX' ? 'text-green-400' : 'text-cyan-300'
                  }`}
                >
                  {entry.raw}
                </span>

                {entry.isValidChecksum ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                )}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Manual Injector */}
      <form onSubmit={handleSendCustom} className="flex items-center gap-2">
        <input
          id="input-manual-sentence"
          type="text"
          placeholder="Send custom NMEA sentence or command (e.g. $HCHDT,090.0,T)..."
          value={customSentence}
          onChange={(e) => setCustomSentence(e.target.value)}
          className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 text-xs rounded-lg px-4 py-2.5 font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
        />
        <button
          type="submit"
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Sentence</span>
        </button>
      </form>
    </div>
  );
};
