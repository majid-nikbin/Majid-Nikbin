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
  Key,
  Share2
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

  // Robust clipboard copy with fallback for all mobile browsers/iframes
  const copyToClipboard = async (text: string): Promise<boolean> => {
    let success = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch (err) {
      console.warn('navigator.clipboard failed, attempting execCommand fallback:', err);
    }

    if (!success) {
      try {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '0';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        el.setSelectionRange(0, 99999);
        success = document.execCommand('copy');
        document.body.removeChild(el);
      } catch (e) {
        console.error('execCommand fallback failed:', e);
      }
    }
    return success;
  };

  // Copy Device ID to clipboard
  const handleCopyDeviceId = async () => {
    const ok = await copyToClipboard(deviceId);
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 3000);
    }
  };

  // Copy both Device ID and full email text, then open email client
  const [copyEmailSuccess, setCopyEmailSuccess] = useState<boolean>(false);
  const handleSendEmail = async () => {
    const emailSubject = `Mariner Pro-Link Activation Request [${deviceId}]`;
    const emailBody = `Hello,\n\nPlease provide the activation key for my Mariner Pro-Link installation.\n\nMy Device ID:\n${deviceId}\n\nThank you.\nSupport: ${developerEmail}`;
    
    // First copy complete text to clipboard so user never loses it on mobile
    await copyToClipboard(`Device ID: ${deviceId}\n\nRecipient: ${developerEmail}\n\n${emailBody}`);
    setCopyEmailSuccess(true);
    setTimeout(() => setCopyEmailSuccess(false), 4000);

    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(emailBody);
    
    // Open mailto link
    try {
      const mailtoUrl = `mailto:${developerEmail}?subject=${subject}&body=${body}`;
      window.location.href = mailtoUrl;
    } catch (e) {
      console.warn('Could not launch mailto protocol:', e);
    }
  };

  // Mobile Web Share API support (WhatsApp, Telegram, Gmail, SMS, etc.)
  const [canShare] = useState<boolean>(() => typeof navigator !== 'undefined' && !!navigator.share);
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mariner Pro-Link Device ID',
          text: `Mariner Pro-Link Activation Request\nDevice ID: ${deviceId}\nDeveloper Email: ${developerEmail}`
        });
      } catch (e) {
        console.warn('Share dismissed or failed:', e);
      }
    } else {
      handleCopyDeviceId();
    }
  };
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

  const [copiedEmailOnly, setCopiedEmailOnly] = useState<boolean>(false);
  const handleCopyEmailOnly = async () => {
    const ok = await copyToClipboard(developerEmail);
    if (ok) {
      setCopiedEmailOnly(true);
      setTimeout(() => setCopiedEmailOnly(false), 2500);
    }
  };

  return (
    <div 
      id="activation-overlay" 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto"
      dir="ltr"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden my-auto text-slate-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 p-4 sm:p-6 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSecretIconTap}
              title="Mariner Security"
              className="p-2.5 sm:p-3 bg-cyan-500/10 border border-cyan-400/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              <Lock className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">Mariner Pro-Link Activation</h2>
              <p className="text-[11px] sm:text-xs text-cyan-300/80 mt-0.5">Marine Navigation & Electronic Heading System</p>
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

        <div className="p-4 sm:p-6 flex flex-col gap-5">

          {/* Device ID Display & Transmission Card */}
          <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 flex flex-col gap-3.5 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Your Hardware Device ID:</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono font-bold">
                Unique Device Token
              </span>
            </div>

            {/* Input with 1-Tap Select & Copy Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  readOnly
                  value={deviceId}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-slate-900 px-3.5 py-2.5 rounded-lg border border-cyan-500/50 font-mono text-base font-bold text-cyan-300 tracking-wider text-center sm:text-left select-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  title="Click or tap to select all"
                />
              </div>

              <button
                type="button"
                onClick={handleCopyDeviceId}
                className={`px-4 py-2.5 rounded-lg border text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
                  copiedId
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border-cyan-500/60'
                }`}
                title="Copy Device ID to clipboard"
              >
                {copiedId ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-cyan-300" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              To activate your software, copy the unique Device ID above and email it to technical support to obtain your permanent lifetime activation key.
            </p>

            {/* Action Buttons: Copy & Email, Share, and Copy Email */}
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
              {/* Primary: Copy & Launch Email */}
              <button
                type="button"
                onClick={handleSendEmail}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3.5 bg-gradient-to-r from-blue-700 to-cyan-700 hover:from-blue-600 hover:to-cyan-600 text-white border border-cyan-400/50 rounded-lg text-xs font-bold transition-all shadow-lg active:scale-98"
                title="Copies request to clipboard and opens your email client"
              >
                <Mail className="w-4 h-4 text-cyan-200 shrink-0" />
                <span>Copy & Email Device ID</span>
                <Send className="w-3.5 h-3.5 ml-auto text-cyan-200" />
              </button>

              {copyEmailSuccess && (
                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/60 text-[11px] text-emerald-300 text-center font-mono">
                  ✓ Device ID and activation request copied to clipboard! You can paste it into email or chat.
                </div>
              )}

              {/* Secondary Row: Share API & Copy Email Address */}
              <div className="flex flex-wrap items-center gap-2">
                {canShare && (
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5"
                    title="Share via WhatsApp, Telegram, Gmail, SMS, etc."
                  >
                    <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Share Device ID</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyEmailOnly}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:border-cyan-500/50 rounded-lg text-[11px] font-mono transition-all flex items-center justify-center gap-1.5"
                  title="Copy developer email address"
                >
                  {copiedEmailOnly ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-bold">Email Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>{developerEmail}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
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

