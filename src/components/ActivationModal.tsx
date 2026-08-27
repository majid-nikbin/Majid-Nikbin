import React, { useState } from 'react';
import { 
  KeyRound, 
  ShieldCheck, 
  Mail, 
  Copy, 
  Check, 
  Smartphone, 
  AlertCircle, 
  Lock, 
  Send,
  Key
} from 'lucide-react';
import { 
  getOrCreateDeviceId, 
  activateLicense,
  generateActivationCode,
  OFFICIAL_SUPPORT_EMAIL,
  DEVELOPER_PASSCODE,
  setDeveloperMode
} from '../services/licenseService';

interface ActivationModalProps {
  onActivated: () => void;
  developerEmail?: string;
  onDeveloperUnlocked?: () => void;
}

export const ActivationModal: React.FC<ActivationModalProps> = ({ 
  onActivated,
  developerEmail = OFFICIAL_SUPPORT_EMAIL,
  onDeveloperUnlocked
}) => {
  const [deviceId] = useState<string>(() => getOrCreateDeviceId());
  const [enteredCode, setEnteredCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [clickCount, setClickCount] = useState<number>(0);
  const [showPasscodePrompt, setShowPasscodePrompt] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Copy Device ID to clipboard
  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  // Submit entered activation key
  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (!enteredCode.trim()) {
      setErrorMessage('Please enter the activation code.');
      return;
    }

    const result = activateLicense(enteredCode);
    if (result.success) {
      onActivated();
    } else {
      setErrorMessage(result.message);
    }
  };

  // Send request email to developer
  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Mariner Pro-Link Activation Request [${deviceId}]`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease provide the activation key for my Mariner Pro-Link installation.\n\nMy Device ID:\n${deviceId}\n\nThank you.`
    );
    window.location.href = `mailto:${developerEmail}?subject=${subject}&body=${body}`;
  };

  // Secret developer tap trigger (clicking lock icon or version badge 5 times prompts passcode)
  const handleSecretIconTap = () => {
    const nextCount = clickCount + 1;
    setClickCount(nextCount);
    if (nextCount >= 5) {
      setShowPasscodePrompt(true);
      setClickCount(0);
    }
  };

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPass = passcodeInput.trim();
    if (cleanPass === DEVELOPER_PASSCODE || cleanPass === '2450') {
      const devId = getOrCreateDeviceId();
      const devKey = generateActivationCode(devId);
      try {
        localStorage.setItem('mariner_license_key_v1', devKey);
        localStorage.setItem('mariner_dev_mode_enabled_v1', 'true');
      } catch {}
      setDeveloperMode(true);
      setShowPasscodePrompt(false);
      if (onDeveloperUnlocked) onDeveloperUnlocked();
      onActivated();
    } else {
      setPasscodeError('Invalid Developer Passcode.');
    }
  };

  return (
    <div 
      id="activation-overlay" 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto"
      dir="ltr"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 p-5 sm:p-6 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSecretIconTap}
              title="Mariner Security"
              className="p-3 bg-cyan-500/10 border border-cyan-400/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              <Lock className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Mariner Pro-Link Activation</h2>
              <p className="text-xs text-cyan-300/80 mt-0.5">Marine Navigation & Electronic Heading System</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleSecretIconTap}
            className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-400 font-bold hover:bg-slate-700 cursor-pointer"
          >
            V1.0
          </button>
        </div>

        <div className="p-5 sm:p-6 flex flex-col gap-6">

          {/* Device ID Display Card */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                Hardware Device ID:
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                Unique Device Token
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-900/90 px-4 py-3 rounded-lg border border-cyan-500/40">
              <span className="font-mono text-base sm:text-lg font-bold text-cyan-300 tracking-wider select-all">
                {deviceId}
              </span>
              <button
                type="button"
                onClick={handleCopyDeviceId}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-md text-xs font-bold transition-all"
              >
                {copiedId ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-green-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              To activate this software, please send your unique Device ID to support. You will receive a permanent activation key.
            </p>

            {/* Email Request Button */}
            <button
              type="button"
              onClick={handleSendEmail}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-xs font-medium transition-all group"
            >
              <Mail className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span>Email Activation Request to:</span>
              <span className="font-mono text-cyan-300 text-[11px] font-bold">{developerEmail}</span>
              <Send className="w-3.5 h-3.5 ml-auto text-slate-400" />
            </button>
          </div>

          {/* Activation Key Form */}
          <form onSubmit={handleActivate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="input-activation-code" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-amber-400" />
                Enter Received Activation Key:
              </label>
              
              <input
                id="input-activation-code"
                type="text"
                value={enteredCode}
                onChange={(e) => {
                  setEnteredCode(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="ACT-XXXX-YYYY-ZZZZ"
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-3 text-center font-mono text-base sm:text-lg font-bold text-white placeholder-slate-600 outline-none transition-all tracking-wider uppercase"
              />
            </div>

            {errorMessage && (
              <div className="flex items-center gap-2 p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              id="btn-submit-activation"
              type="submit"
              className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>Verify & Unlock Application</span>
            </button>
          </form>

          {/* Secret Developer Passcode Prompt (Triggered after 5 clicks on Lock icon or V1.0 badge) */}
          {showPasscodePrompt && (
            <form onSubmit={handlePasscodeSubmit} className="p-4 bg-slate-950 border border-amber-500/40 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-400" />
                  Developer Authorization
                </span>
                <span className="text-[10px] text-amber-400 font-mono">Master Mode</span>
              </div>
              <input
                type="password"
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value);
                  setPasscodeError(null);
                }}
                placeholder="Enter Developer PIN"
                className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none"
              />
              {passcodeError && (
                <span className="text-[11px] text-red-400">{passcodeError}</span>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-all"
                >
                  Unlock Developer Mode & App
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasscodePrompt(false)}
                  className="px-3 py-2 bg-slate-800 text-slate-400 text-xs rounded-lg hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};

