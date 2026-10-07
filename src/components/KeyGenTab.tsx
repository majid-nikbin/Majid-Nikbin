import React, { useState, useEffect } from 'react';
import { Key, Copy, Check, ShieldCheck, Cpu } from 'lucide-react';
import { getOrCreateHardwareId, generateActivationKey, saveActivationKey, isAppActivated } from '../services/licenseService';

export const KeyGenTab: React.FC = () => {
  const [hwId, setHwId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [isActivated, setIsActivated] = useState(true);

  useEffect(() => {
    const id = getOrCreateHardwareId();
    setHwId(id);
    const key = generateActivationKey(id);
    setLicenseKey(key);
    setIsActivated(isAppActivated());
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(licenseKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 shadow-xl flex flex-col gap-4 font-sans max-w-xl mx-auto">
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <div>
          <h2 className="text-sm font-bold text-white">مدیریت لایسنس و شناسه سخت‌افزاری</h2>
          <p className="text-[11px] text-slate-400">فعال‌سازی ۱۰۰٪ آفلاین و بدون نیاز به اینترنت</p>
        </div>
      </div>

      {/* Hardware ID Display */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-1">
        <span className="text-xs text-slate-400">شناسه سخت‌افزاری دستگاه شما (Hardware ID):</span>
        <span className="text-base font-black font-mono text-cyan-400 tracking-wider">
          {hwId}
        </span>
      </div>

      {/* Key Display & Copy */}
      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col gap-2">
        <span className="text-xs text-slate-400">کد فعال‌سازی اختصاصی این دستگاه (License Key):</span>
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-black font-mono text-emerald-400 tracking-wider">
            {licenseKey}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1 shadow"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'کپی شد' : 'کپی کلید'}</span>
          </button>
        </div>
      </div>

      <div className="text-[11px] text-slate-400 leading-relaxed">
        برنامه به صورت مادام‌العمر بر روی این دستگاه فعال است و برای اعتبارسنجی نیازی به هیچ سرور یا اینترنت ندارد.
      </div>
    </div>
  );
};
