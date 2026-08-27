import React from 'react';
import { 
  Usb, 
  CheckCircle2, 
  ExternalLink, 
  Info, 
  AlertTriangle,
  Layers,
  Cable,
  Workflow
} from 'lucide-react';

interface UsbDriverGuideProps {
  isNightMode?: boolean;
}

export const UsbDriverGuide: React.FC<UsbDriverGuideProps> = ({ isNightMode = false }) => {
  const drivers = [
    {
      name: 'CH340 / CH341 / CH343',
      vendor: 'WCH (WinChipHead)',
      desc: 'Most widely used USB-to-TTL UART converter in marine serial adapters, Arduino modules, and RS-422/RS-485 dongles.',
      status: 'Fully Supported via WebUSB & Web Serial',
      highlight: true
    },
    {
      name: 'CP2102 / CP2104 / CP2108',
      vendor: 'Silicon Labs',
      desc: 'High stability baud rate generator commonly found in commercial marine navigation bridges and autopilot interfaces.',
      status: 'Fully Supported via Native CDC ACM',
      highlight: true
    },
    {
      name: 'FT232R / FT232H / FTDI',
      vendor: 'FTDI Chip',
      desc: 'Standard commercial marine interface chipset with low latency and accurate bit timing for high baud rates.',
      status: 'Fully Supported',
      highlight: true
    },
    {
      name: 'PL2303 / PL2303HX / GT',
      vendor: 'Prolific Technology',
      desc: 'Standard USB to serial bridge used in legacy GPS receivers and chartplotter connection cables.',
      status: 'Supported via CDC ACM',
      highlight: false
    },
    {
      name: 'MAX485 / SP3485 (RS-485 / RS-422)',
      vendor: 'Maxim / Exar Transceivers',
      desc: 'Differential marine bus transceiver paired with USB-UART chips for long-distance RS-422 NMEA 0183 transmission.',
      status: 'Standard Marine Recommended',
      highlight: true
    }
  ];

  return (
    <div
      id="usb-driver-guide-panel"
      className={`p-6 rounded-2xl border transition-all flex flex-col gap-6 ${
        isNightMode
          ? 'bg-zinc-950/80 border-red-900/50 text-red-100 shadow-xl'
          : 'bg-slate-800/40 border-slate-700 text-slate-200 shadow-xl'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-900 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Usb className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Marine USB OTG Hardware & Driver Compatibility
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Plug-and-play USB Serial and RS-422/RS-485 converters for Android smartphones and tablets
            </p>
          </div>
        </div>
      </div>

      {/* Driver Chips Grid */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Supported Marine USB-to-UART & Differential Bridge Chipsets
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {drivers.map((drv, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                drv.highlight
                  ? 'bg-slate-900 border-cyan-500/40'
                  : 'bg-slate-900/70 border-slate-700'
              }`}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono text-sm">{drv.name}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-[11px] font-bold text-cyan-400">{drv.vendor}</span>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">{drv.desc}</p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-400">Driver Status:</span>
                <span className="text-emerald-400 font-bold">{drv.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marine NMEA 0183 Wiring & Hardware Connection Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Step 1: OTG Setup */}
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <Cable className="w-4 h-4" />
            <span>1. Android USB OTG Host Setup</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
            <li>
              Plug the <strong className="text-white">USB Type-C OTG Host adapter</strong> into your smartphone.
            </li>
            <li>
              Connect your USB-to-Serial converter module (CH340, CP2102, FTDI, or MAX485 dongle) to the OTG adapter.
            </li>
            <li>
              <strong className="text-amber-400">Important phone setting:</strong> On Xiaomi, Realme, Oppo, and OnePlus devices, go to <em>Settings &gt; Additional Settings &gt; OTG Connection</em> and toggle it <strong className="text-green-400">ON</strong>.
            </li>
          </ul>
        </div>

        {/* Step 2: RS-422 Differential Wiring Standard */}
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-700 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Workflow className="w-4 h-4" />
            <span>2. Marine NMEA 0183 Wiring Standard (RS-422 / RS-485)</span>
          </div>
          <div className="text-xs text-slate-300 space-y-1.5 font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex justify-between">
              <span className="text-green-400">Phone TX+ (A)</span>
              <span className="text-slate-400">→ Chartplotter / ECDIS RX+ (In A)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400">Phone TX- (B)</span>
              <span className="text-slate-400">→ Chartplotter / ECDIS RX- (In B)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cyan-400">Phone RX+ (A)</span>
              <span className="text-slate-400">← Heading Sensor / GPS TX+ (Out A)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Ground / Shield</span>
              <span className="text-slate-400">⏚ Common Boat Vessel Ground / Cable Shield</span>
            </div>
          </div>
        </div>
      </div>

      {/* Browser Web Serial Flag Notice */}
      <div className="p-4 bg-slate-900 border border-cyan-500/30 rounded-xl flex items-start gap-3 text-xs text-slate-300">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-1">
          <p className="font-bold text-white">Browser USB Serial Access:</p>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Chrome on Android natively communicates directly with the USB serial converter. When prompted by the browser, select your USB Serial device from the popup list to grant access.
          </p>
        </div>
      </div>
    </div>
  );
};
