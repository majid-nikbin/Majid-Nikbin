import React, { useState } from 'react';
import { 
  KeyRound, 
  Sparkles, 
  Copy, 
  Check, 
  Smartphone, 
  Send, 
  ShieldCheck, 
  Terminal, 
  Lock, 
  UserCheck
} from 'lucide-react';
import { 
  generateActivationCode, 
  getOrCreateDeviceId,
  OFFICIAL_SUPPORT_EMAIL,
  simulateAppAgeDays,
  deactivateLicense,
  getOtgLicenseStatus,
  activateViaMyket
} from '../services/licenseService';
import { 
  Clock, 
  RotateCcw, 
  ShoppingCart, 
  ShieldAlert, 
  Play 
} from 'lucide-react';

interface KeyGenTabProps {
  isNightMode: boolean;
}

export const KeyGenTab: React.FC<KeyGenTabProps> = ({ isNightMode }) => {
  const [currentDeviceId] = useState<string>(() => getOrCreateDeviceId());
  const [targetDeviceId, setTargetDeviceId] = useState<string>('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [userEmailInput, setUserEmailInput] = useState<string>('');
  const [recentGenerated, setRecentGenerated] = useState<Array<{ id: string; key: string; time: string }>>([]);
  const [otgStatus, setOtgStatus] = useState(() => getOtgLicenseStatus());
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const refreshOtgStatus = (msg?: string) => {
    setOtgStatus(getOtgLicenseStatus());
    if (msg) {
      setSimMessage(msg);
      setTimeout(() => setSimMessage(null), 3000);
    }
  };

  const handleSimulateNormal = () => {
    deactivateLicense();
    simulateAppAgeDays(10);
    refreshOtgStatus('Status: Day 10 (Trial Active & Connected)');
  };

  const handleSimulate5Months = () => {
    deactivateLicense();
    simulateAppAgeDays(155);
    refreshOtgStatus('Status: Day 155 (5-Month Grace Warning Displayed)');
  };

  const handleSimulate6MonthsExpired = () => {
    deactivateLicense();
    simulateAppAgeDays(185);
    refreshOtgStatus('Status: Day 185 (6-Month Trial Expired - Lock Active)');
  };

  const handleSimulateMyketPurchase = () => {
    activateViaMyket();
    refreshOtgStatus('Status: Store Purchase Simulated - Lifetime License Active');
  };

  const handleResetAll = () => {
    deactivateLicense();
    simulateAppAgeDays(0);
    refreshOtgStatus('All license and trial settings reset to Day 0.');
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeviceId.trim()) return;

    const formattedId = targetDeviceId.trim().toUpperCase();
    const key = generateActivationCode(formattedId);
    setGeneratedKey(key);
    
    // Add to history
    setRecentGenerated((prev) => [
      { id: formattedId, key, time: new Date().toLocaleTimeString() },
      ...prev.slice(0, 4)
    ]);
  };

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  const handleEmailKeyToUser = () => {
    if (!generatedKey || !targetDeviceId) return;
    const recipient = userEmailInput.trim() || '';
    const subject = encodeURIComponent(`Mariner Pro-Link Activation Key [${targetDeviceId.toUpperCase()}]`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is your permanent activation license key for Mariner Pro-Link:\n\nDevice ID: ${targetDeviceId.toUpperCase()}\nActivation Key: ${generatedKey}\n\nEnter this key into the app prompt to unlock all features.\n\nBest regards,\nM-Tech\n${OFFICIAL_SUPPORT_EMAIL}`
    );
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full pb-10">
      {/* Top Banner - Compact & Clean */}
      <div 
        className={`p-4 sm:p-5 rounded-2xl border shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isNightMode 
            ? 'bg-zinc-950/90 border-red-900/60 text-red-100' 
            : 'bg-slate-900 border-cyan-500/40 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">Developer License Key Generator</h2>
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                Console
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter target Device ID to produce offline activation key.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono">
          <UserCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Dev:</span>
          <span className="text-emerald-400 font-bold">M-Tech</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Generator Form */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="p-5 sm:p-6 bg-slate-900/90 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                Generate License Code
              </span>
              <button
                type="button"
                onClick={() => setTargetDeviceId(currentDeviceId)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono"
              >
                Use My ID ({currentDeviceId})
              </button>
            </div>

            <form onSubmit={handleGenerate} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  User Device ID:
                </label>
                <input
                  type="text"
                  value={targetDeviceId}
                  onChange={(e) => setTargetDeviceId(e.target.value)}
                  placeholder="MAR-XXXX-YYYY"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-2.5 font-mono text-base font-bold text-white placeholder-slate-600 outline-none uppercase"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-6 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Activation Key</span>
              </button>
            </form>

            {/* Generated Output Card */}
            {generatedKey && (
              <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/50 flex flex-col gap-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    Key for {targetDeviceId.toUpperCase()}:
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">100% Valid</span>
                </div>

                <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-700">
                  <span className="font-mono text-base sm:text-lg font-black text-cyan-300 tracking-wider select-all break-all">
                    {generatedKey}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-md text-xs font-bold transition-all ml-2"
                  >
                    {copiedKey ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Direct Email Sender */}
                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                  <label className="text-[11px] text-slate-400">
                    Send directly to User Email (Optional):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={userEmailInput}
                      onChange={(e) => setUserEmailInput(e.target.value)}
                      placeholder="user@example.com"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleEmailKeyToUser}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-lg flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Myket 6-Month Trial & Purchase Sandbox Simulator */}
          <div className="p-5 bg-slate-900/90 rounded-2xl border border-amber-500/50 shadow-lg flex flex-col gap-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                6-Month Trial & In-App Purchase Simulator (Sandbox Testing)
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                Dev Tool
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans text-left" dir="ltr">
              Use these buttons to instantly simulate and verify all 6-month trial lifecycle states and purchase popups without waiting months:
            </p>

            {simMessage && (
              <div className="p-2.5 bg-emerald-950/90 border border-emerald-500 rounded-xl text-xs font-bold text-emerald-300 text-center animate-fadeIn font-mono">
                {simMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={handleSimulateNormal}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 flex items-center gap-2 transition-all active:scale-95"
              >
                <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-left font-sans text-xs">1. Normal Active (Day 10)</span>
              </button>

              <button
                type="button"
                onClick={handleSimulate5Months}
                className="p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/60 text-amber-200 flex items-center gap-2 transition-all active:scale-95"
              >
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-left font-sans text-xs">2. Day 155 (Grace Warning Banner)</span>
              </button>

              <button
                type="button"
                onClick={handleSimulate6MonthsExpired}
                className="p-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/70 border border-rose-500 text-rose-200 flex items-center gap-2 transition-all active:scale-95"
              >
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-left font-sans text-xs">3. Day 185 (Trial Expired & Locked)</span>
              </button>

              <button
                type="button"
                onClick={handleSimulateMyketPurchase}
                className="p-2.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500 text-cyan-200 flex items-center gap-2 transition-all active:scale-95"
              >
                <ShoppingCart className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-left font-sans text-xs">4. Simulate Store Purchase</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px] font-mono">
              <span className="text-slate-400">
                Current OTG Status: {otgStatus.isActivated ? 'Permanent Active' : otgStatus.isExpired ? '🔒 Expired (Purchase Required)' : otgStatus.isWarningPeriod ? '⚠️ 5-Month Warning' : 'Active Trial'}
              </span>
              <button
                type="button"
                onClick={handleResetAll}
                className="px-2.5 py-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-1 transition-colors"
                title="Reset to Day 0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Key Details & History */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="p-5 bg-slate-900/90 rounded-2xl border border-slate-700/80 shadow-lg flex flex-col gap-3.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Licensing Specifications
            </h3>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Algorithm:</span>
                <span className="text-cyan-400 font-bold">HMAC/SHA Hash-Digest</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Format:</span>
                <span className="text-amber-400 font-bold">ACT-XXXX-YYYY-ZZZZ</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-400">Support Mail:</span>
                <span className="text-slate-200 truncate ml-2">{OFFICIAL_SUPPORT_EMAIL}</span>
              </div>
            </div>

            {/* Recent History */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Recent Generated Keys:
              </span>
              {recentGenerated.length === 0 ? (
                <span className="text-xs text-slate-500 italic">No keys generated in this session yet.</span>
              ) : (
                <div className="space-y-2">
                  {recentGenerated.map((item, idx) => (
                    <div key={idx} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                      <div>
                        <div className="text-white font-bold">{item.id}</div>
                        <div className="text-amber-300 text-[11px]">{item.key}</div>
                      </div>
                      <span className="text-[10px] text-slate-500">{item.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
