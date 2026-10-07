import React from 'react';
import { Usb, ExternalLink, CheckCircle2, ShieldCheck, Cpu, RefreshCw } from 'lucide-react';
import { serialService } from '../services/serialService';

interface UsbDriverGuideProps {
  onClose: () => void;
  onConnectUsb: () => void;
}

export const UsbDriverGuide: React.FC<UsbDriverGuideProps> = ({ onClose, onConnectUsb }) => {
  const isWebSerial = serialService.isWebSerialSupported();
  const isWebUsb = serialService.isWebUsbSupported();
  const localAppUrl = serialService.getLocalLoopbackUrl();

  const handleOpenLocalInChrome = () => {
    // Open inside local browser / loopback to this exact local app (ZERO GITHUB URLS!)
    window.open(localAppUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 font-sans">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <Usb className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">راهنمای اتصال مستقیم USB OTG</h3>
              <p className="text-[11px] text-slate-400">بدون نیاز به اینترنت • اجرای ۱۰۰٪ محلی و آفلاین</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3 text-xs leading-relaxed text-slate-300">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">۱. اتصال مبدل سخت‌افزاری با کابل OTG:</strong>
              مبدل USB به سریال (CH340، CP2102، FTDI یا دستگاه NMEA) را با کابل OTG به گوشی متصل نمایید.
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">۲. مجوز دسترسی و نرخ تبادل (Baud Rate):</strong>
              نرخ پیش‌فرض دریانوردی ۴۸۰۰ باد است (برای AIS عدد ۳۸۴۰۰). پنجره درخواست اجازه اتصال به دستگاه روی صفحه باز خواهد شد.
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white block mb-0.5">۳. باز کردن مستقیم در مرورگر Chrome:</strong>
              در صورتی که در برنامه وب‌ویو هستید، برای فعال‌سازی کامل پورت سریال می‌توانید همین صفحه را مستقیماً در مرورگر Chrome باز کنید:
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleOpenLocalInChrome}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold flex items-center gap-1.5 border border-slate-700 active:scale-95 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>اجرای مستقیم در Chrome (Loopback محلی)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              onConnectUsb();
            }}
            className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
          >
            <Usb className="w-4 h-4" />
            <span>تلاش برای اتصال به پورت USB</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
