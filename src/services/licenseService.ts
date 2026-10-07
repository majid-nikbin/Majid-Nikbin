/**
 * Licensing, Persistent Hardware Device ID & 30-Day Free Trial Engine
 * 
 * Multi-Tier Persistence & Anti-Reset Protection:
 * 1. Hardware Fingerprint (Screen, CPU cores, GPU canvas renderer, touch points, OS platform).
 * 2. Multi-Tier Local Storage: LocalStorage + Document Cookie (10-Year MaxAge) + IndexedDB.
 * 3. Server-Authoritative Sync (/api/license/trial/sync):
 *    Even if the app is uninstalled, wiped or reinstalled, the server recognizes the exact
 *    Device ID and preserves the true first install timestamp and remaining trial days.
 * 4. Clock Rollback Protection: Tracks monotonic elapsed time to prevent device clock spoofing.
 */

const LICENSE_STORAGE_KEY = 'mariner_license_key_v1';
const DEVICE_ID_STORAGE_KEY = 'mariner_device_id_v1';
const FIRST_INSTALL_KEY = 'mariner_first_install_ts_v1';
const LAST_SEEN_KEY = 'mariner_last_observed_time_v1';
const DEVELOPER_FLAG_KEY = 'mariner_dev_mode_enabled_v1';
const COOKIE_TRIAL_KEY = 'mariner_trial_anchor';

// Developer Master Secret (used for mathematical hash derivation)
const MASTER_SALT = 'MARINER_PRO_NAV_SALT_2026_SECRET_KEY';

// Master password fallback
export const DEVELOPER_PASSCODE = '2450';

// Official Application Support Email for License Requests
export const OFFICIAL_SUPPORT_EMAIL = 'Mariner-pro-link@proton.me';

// Developer Google Email list for instant auto-unlock via Google Account
export const DEVELOPER_GOOGLE_EMAILS = [
  'majid.nikbin@gmail.com',
  'mariner-pro-link@proton.me'
];

const GOOGLE_USER_STORAGE_KEY = 'mariner_google_user_v1';
const AUTO_DEV_UNLOCKED_KEY = 'mariner_dev_auto_unlocked_v1';

// 30 Days Trial Duration (General App is now free & unrestricted; OTG Hardware has 5-Month Warning & 6-Month Myket Expiration)
export const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// OTG Hardware Serial Specific Licensing (5 Months Warning / 6 Months Hard Expiration)
export const OTG_WARNING_DAYS = 150; // 5 months (150 days)
export const OTG_WARNING_MS = OTG_WARNING_DAYS * 24 * 60 * 60 * 1000;
export const OTG_EXPIRATION_DAYS = 180; // 6 months (180 days)
export const OTG_EXPIRATION_MS = OTG_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;

export const OTG_LICENSE_KEY = 'mariner_otg_activated_key_v1';
export const OTG_WARNING_DISMISSED_KEY = 'mariner_otg_warn_dismissed_ts_v1';
export const MYKET_APP_PACKAGE_ID = 'com.mariner.pro';
export const MYKET_DETAILS_INTENT = `myket://details?id=${MYKET_APP_PACKAGE_ID}`;
export const MYKET_WEB_URL = `https://myket.ir/app/${MYKET_APP_PACKAGE_ID}`;

export interface GoogleUserProfile {
  email: string;
  name?: string;
  picture?: string;
  isDeveloper: boolean;
}

export interface LicenseStatus {
  isActivated: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  daysRemaining: number;
  trialTotalDays: number;
  deviceId: string;
  activatedKey?: string;
  activatedAt?: string;
  firstInstallDate: string;
}

export interface OtgLicenseStatus {
  isActivated: boolean;
  isWarningPeriod: boolean;
  isWarningDismissed: boolean;
  isExpired: boolean;
  daysUsed: number;
  daysRemaining: number;
  firstInstallDate: string;
  deviceId: string;
}

// Memory cache of synchronized license status
let cachedLicenseStatus: LicenseStatus | null = null;
let isSyncInProgress = false;

// Cookie helper
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  // 10 years expiration
  const maxAge = 10 * 365 * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// IndexedDB Persistent Store for deep recovery across reinstalls
const IDB_NAME = 'MarinerProLicenseDB';
const IDB_STORE = 'LicenseStore';

async function getFromIndexedDB(key: string): Promise<string | null> {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToIndexedDB(key: string, value: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const store = tx.objectStore(IDB_STORE);
          store.put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Checks if the given email belongs to the developer
 */
export function isDeveloperEmail(email: string): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();
  return DEVELOPER_GOOGLE_EMAILS.some(e => e.toLowerCase() === cleanEmail);
}

/**
 * Gets the saved Google profile from storage
 */
export function getSavedGoogleUser(): GoogleUserProfile | null {
  try {
    const raw = localStorage.getItem(GOOGLE_USER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

/**
 * Saves Google profile and if it belongs to Developer, activates the app permanently
 */
export function saveGoogleUser(profile: { email: string; name?: string; picture?: string }): { isDeveloper: boolean } {
  const cleanEmail = profile.email.trim().toLowerCase();
  const isDev = isDeveloperEmail(cleanEmail);
  
  const userProfile: GoogleUserProfile = {
    email: cleanEmail,
    name: profile.name,
    picture: profile.picture,
    isDeveloper: isDev
  };

  try {
    localStorage.setItem(GOOGLE_USER_STORAGE_KEY, JSON.stringify(userProfile));
    if (isDev) {
      const deviceId = getOrCreateDeviceId();
      const devKey = generateActivationCode(deviceId);
      localStorage.setItem(LICENSE_STORAGE_KEY, devKey);
      localStorage.setItem(DEVELOPER_FLAG_KEY, 'true');
      localStorage.setItem(AUTO_DEV_UNLOCKED_KEY, 'true');
      setCookie(LICENSE_STORAGE_KEY, devKey);
      saveToIndexedDB(LICENSE_STORAGE_KEY, devKey);
    }
  } catch (e) {
    console.warn('Storage error saving google user:', e);
  }

  return { isDeveloper: isDev };
}

/**
 * Generates a stable hardware fingerprint hash that persists across app reinstalls
 */
function generateHardwareFingerprint(): number {
  try {
    let fp = '';
    if (typeof screen !== 'undefined') {
      fp += `${screen.width}x${screen.height}x${screen.colorDepth || 24}x${screen.pixelDepth || 24}`;
    }
    if (typeof navigator !== 'undefined') {
      fp += `_${navigator.hardwareConcurrency || 4}_${navigator.maxTouchPoints || 1}_${navigator.platform || ''}`;
    }
    
    // Canvas GPU fingerprinting (deterministic across uninstalls on same device hardware)
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#06b6d4';
          ctx.fillRect(10, 10, 100, 30);
          ctx.fillStyle = '#f43f5e';
          ctx.fillText('MarinerPro-Hardware-V1', 15, 15);
          fp += `_${canvas.toDataURL().slice(-40)}`;
        }
      } catch {}
    }

    // 32-bit FNV-1a hash
    let hash = 0x811c9dc5;
    for (let i = 0; i < fp.length; i++) {
      hash ^= fp.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  } catch {
    return 0x7a9b4f21;
  }
}

/**
 * Generates or retrieves a unique persistent device ID for this physical device.
 */
export function getOrCreateDeviceId(): string {
  try {
    let devId = localStorage.getItem(DEVICE_ID_STORAGE_KEY) || getCookie(DEVICE_ID_STORAGE_KEY);
    if (devId && devId.startsWith('MAR-')) {
      return devId;
    }

    const hwHash = generateHardwareFingerprint();
    const part1 = ((hwHash >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    const part2 = (hwHash & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    
    devId = `MAR-${part1}-${part2}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, devId);
    setCookie(DEVICE_ID_STORAGE_KEY, devId);
    saveToIndexedDB(DEVICE_ID_STORAGE_KEY, devId);
    return devId;
  } catch {
    return 'MAR-8A2F-9C14';
  }
}

/**
 * Gets or initializes the First Installation Timestamp across multiple persistent storage tiers
 */
export function getFirstInstallTimestamp(): number {
  try {
    const candidates: number[] = [];

    // 1. Check LocalStorage
    const rawLocal = localStorage.getItem(FIRST_INSTALL_KEY);
    if (rawLocal) {
      const ts = parseInt(rawLocal, 10);
      if (!isNaN(ts) && ts > 1700000000000) candidates.push(ts);
    }

    // 2. Check 10-Year Cookie
    const rawCookie = getCookie(COOKIE_TRIAL_KEY);
    if (rawCookie) {
      const ts = parseInt(rawCookie, 10);
      if (!isNaN(ts) && ts > 1700000000000) candidates.push(ts);
    }

    // If any persistent storage retained an install date, use the earliest recorded one
    if (candidates.length > 0) {
      const earliest = Math.min(...candidates);
      // Synchronize all tiers with earliest known install date
      localStorage.setItem(FIRST_INSTALL_KEY, earliest.toString());
      setCookie(COOKIE_TRIAL_KEY, earliest.toString());
      saveToIndexedDB(FIRST_INSTALL_KEY, earliest.toString());
      return earliest;
    }
    
    // First time ever on this device
    const now = Date.now();
    localStorage.setItem(FIRST_INSTALL_KEY, now.toString());
    setCookie(COOKIE_TRIAL_KEY, now.toString());
    saveToIndexedDB(FIRST_INSTALL_KEY, now.toString());
    return now;
  } catch {
    return Date.now();
  }
}

/**
 * Calculates the valid Activation Code for a given Device ID.
 * Formula: Deterministic hash on (DeviceID + MASTER_SALT) -> Format: ACT-XXXX-YYYY-ZZZZ
 */
export function generateActivationCode(deviceId: string): string {
  const cleanDevId = deviceId.trim().toUpperCase();
  const input = `${cleanDevId}:${MASTER_SALT}`;
  
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  let h3 = 0x12345678;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const p1 = (Math.abs(h1) % 0x10000).toString(16).toUpperCase().padStart(4, '0');
  const p2 = (Math.abs(h2) % 0x10000).toString(16).toUpperCase().padStart(4, '0');
  const p3 = (Math.abs(h3) % 0x10000).toString(16).toUpperCase().padStart(4, '0');

  return `ACT-${p1}-${p2}-${p3}`;
}

/**
 * Validates whether an activation key matches the device ID or master bypass passcode
 */
export function verifyActivationCode(deviceId: string, enteredKey: string): boolean {
  if (!enteredKey) return false;
  const cleanKey = enteredKey.trim().toUpperCase().replace(/\s+/g, '');
  
  if (cleanKey === DEVELOPER_PASSCODE || cleanKey === '2450') {
    return true;
  }

  const expectedKey = generateActivationCode(deviceId);
  const cleanExpected = expectedKey.replace(/-/g, '');
  const cleanInput = cleanKey.replace(/-/g, '');

  return cleanKey === expectedKey || cleanInput === cleanExpected;
}

/**
 * Anti-Tamper Clock Verification:
 * Tracks the last observed system timestamp so rolling back device date cannot cheat trial.
 */
function getMonotonicNow(): number {
  const currentNow = Date.now();
  try {
    const rawLast = localStorage.getItem(LAST_SEEN_KEY);
    if (rawLast) {
      const last = parseInt(rawLast, 10);
      if (!isNaN(last) && last > currentNow) {
        // System clock was rolled back backwards! Enforce the forward observed timestamp
        return last;
      }
    }
    localStorage.setItem(LAST_SEEN_KEY, currentNow.toString());
  } catch {}
  return currentNow;
}

/**
 * Retrieves the general application license status.
 * Per user requirements, the core application (GPS, Compass, Route, Charts, Monitor)
 * is now 100% unlocked and free permanently without activation prompts.
 */
export function getLicenseStatus(): LicenseStatus {
  const deviceId = getOrCreateDeviceId();
  const firstInstallTs = getFirstInstallTimestamp();
  
  return {
    isActivated: true,
    isTrialActive: false,
    isTrialExpired: false,
    daysRemaining: 3650,
    trialTotalDays: 365,
    deviceId,
    activatedKey: 'ACT-PERMANENT-MARINER',
    firstInstallDate: new Date(firstInstallTs).toLocaleDateString(),
  };
}

/**
 * Checks if the 5-month OTG warning was dismissed by the user
 */
export function isOtgWarningDismissed(): boolean {
  try {
    const raw = localStorage.getItem(OTG_WARNING_DISMISSED_KEY);
    if (!raw) return false;
    const dismissedTs = parseInt(raw, 10);
    // Dismissal lasts 7 days before softly reminding again
    return Date.now() - dismissedTs < 7 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * User dismisses the 5-month OTG warning banner ("پیام بعد ۵ ماه ظاهر بشه، و مخفی بشه")
 */
export function dismissOtgWarning(): void {
  try {
    localStorage.setItem(OTG_WARNING_DISMISSED_KEY, Date.now().toString());
  } catch {}
}

/**
 * Retrieves the specific OTG Hardware Serial Port License status.
 * - Months 0-5 (0-150 days): Free trial, fully active. No days or warnings mentioned.
 * - Month 5-6 (150-180 days): Warning period ("منقضی می‌شود - خرید از مایکت"), dismissible.
 * - Month 6+ (180+ days): Hardware OTG blocked until purchased on Myket or activated via developer code.
 * - If activated via Myket or Developer PIN (2450): Permanently activated, no purchase needed even after 5 months!
 */
export function getOtgLicenseStatus(): OtgLicenseStatus {
  const deviceId = getOrCreateDeviceId();
  const firstInstallTs = getFirstInstallTimestamp();
  const effectiveNow = getMonotonicNow();

  // Check if developer unlocked or permanent license key is present in any tier
  const savedKey = localStorage.getItem(OTG_LICENSE_KEY) || 
                   localStorage.getItem(LICENSE_STORAGE_KEY) || 
                   getCookie(OTG_LICENSE_KEY) ||
                   getCookie(LICENSE_STORAGE_KEY);
  
  const isDev = isDeveloperModeUnlocked();
  const isMyketPurchased = localStorage.getItem('mariner_myket_purchased') === 'true' || getCookie('mariner_myket_purchased') === 'true';
  const isExplicitlyActivated = localStorage.getItem('mariner_activated') === 'true' || getCookie('mariner_activated') === 'true';

  const isKeyValid = !!(savedKey && (
    savedKey === '2450' ||
    savedKey === DEVELOPER_PASSCODE ||
    savedKey === 'ACT-DEV-PERMANENT-KEY' ||
    savedKey === 'ACT-DEVELOPER-MASTER-KEY' ||
    savedKey === 'MYKET-PURCHASED' ||
    savedKey.startsWith('MYKET_') ||
    verifyActivationCode(deviceId, savedKey)
  ));

  if (isDev || isMyketPurchased || isExplicitlyActivated || isKeyValid) {
    return {
      isActivated: true,
      isWarningPeriod: false,
      isWarningDismissed: false,
      isExpired: false,
      daysUsed: Math.floor((effectiveNow - firstInstallTs) / (1000 * 60 * 60 * 24)),
      daysRemaining: 9999,
      firstInstallDate: new Date(firstInstallTs).toLocaleDateString(),
      deviceId
    };
  }

  const elapsedMs = Math.max(0, effectiveNow - firstInstallTs);
  const daysUsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const remainingUntil6Months = Math.max(0, OTG_EXPIRATION_MS - elapsedMs);
  const daysRemaining = Math.ceil(remainingUntil6Months / (1000 * 60 * 60 * 24));

  if (elapsedMs >= OTG_EXPIRATION_MS) {
    // 6 months expired: Hard lock on OTG serial feature
    return {
      isActivated: false,
      isWarningPeriod: false,
      isWarningDismissed: false,
      isExpired: true,
      daysUsed,
      daysRemaining: 0,
      firstInstallDate: new Date(firstInstallTs).toLocaleDateString(),
      deviceId
    };
  }

  if (elapsedMs >= OTG_WARNING_MS) {
    // 5 months grace period: Warning active, but dismissible
    return {
      isActivated: false,
      isWarningPeriod: true,
      isWarningDismissed: isOtgWarningDismissed(),
      isExpired: false,
      daysUsed,
      daysRemaining,
      firstInstallDate: new Date(firstInstallTs).toLocaleDateString(),
      deviceId
    };
  }

  // Under 5 months: normal active usage
  return {
    isActivated: false,
    isWarningPeriod: false,
    isWarningDismissed: false,
    isExpired: false,
    daysUsed,
    daysRemaining,
    firstInstallDate: new Date(firstInstallTs).toLocaleDateString(),
    deviceId
  };
}

/**
 * Permanently activates the OTG hardware serial port with a valid key or developer PIN
 */
export function activateOtgLicense(key: string): boolean {
  const cleanKey = key.trim();
  const deviceId = getOrCreateDeviceId();

  const isDevPin = cleanKey === DEVELOPER_PASSCODE || cleanKey === '2450';
  const isMasterKey = cleanKey === 'ACT-DEV-PERMANENT-KEY' || cleanKey === 'ACT-DEVELOPER-MASTER-KEY';
  const isMyketKey = cleanKey === 'MYKET-PURCHASED' || cleanKey.startsWith('MYKET_');
  const isValidCode = verifyActivationCode(deviceId, cleanKey);

  if (isDevPin || isMasterKey || isMyketKey || isValidCode) {
    try {
      localStorage.setItem(OTG_LICENSE_KEY, cleanKey);
      localStorage.setItem('mariner_activated', 'true');
      setCookie(OTG_LICENSE_KEY, cleanKey);
      setCookie('mariner_activated', 'true');
      saveToIndexedDB(OTG_LICENSE_KEY, cleanKey);
      if (isDevPin || isMasterKey) {
        setDeveloperMode(true);
      }
      if (isMyketKey) {
        localStorage.setItem('mariner_myket_purchased', 'true');
        setCookie('mariner_myket_purchased', 'true');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mariner_license_activated'));
      }
    } catch {}
    return true;
  }
  return false;
}

/**
 * Activates license after purchase on Myket
 */
export function activateViaMyket(): void {
  try {
    localStorage.setItem('mariner_myket_purchased', 'true');
    localStorage.setItem(OTG_LICENSE_KEY, 'MYKET-PURCHASED');
    localStorage.setItem('mariner_activated', 'true');
    setCookie('mariner_myket_purchased', 'true');
    setCookie(OTG_LICENSE_KEY, 'MYKET-PURCHASED');
    setCookie('mariner_activated', 'true');
    saveToIndexedDB(OTG_LICENSE_KEY, 'MYKET-PURCHASED');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mariner_license_activated'));
    }
  } catch {}
}

/**
 * Authoritative Server Sync for Trial and Activation.
 * Syncs the true original installation date with the backend registry to prevent
 * uninstall/reinstall from resetting the 30-day clock.
 */
export async function syncTrialWithServer(onUpdate?: (status: LicenseStatus) => void): Promise<LicenseStatus> {
  const deviceId = getOrCreateDeviceId();
  const localFirstInstallTs = getFirstInstallTimestamp();

  // Async IndexedDB background recovery
  getFromIndexedDB(FIRST_INSTALL_KEY).then((idbTs) => {
    if (idbTs) {
      const parsed = parseInt(idbTs, 10);
      if (!isNaN(parsed) && parsed > 1700000000000 && parsed < localFirstInstallTs) {
        localStorage.setItem(FIRST_INSTALL_KEY, parsed.toString());
        setCookie(COOKIE_TRIAL_KEY, parsed.toString());
      }
    }
  });

  if (isSyncInProgress) {
    return getLicenseStatus();
  }

  isSyncInProgress = true;

  try {
    const response = await fetch('/api/license/trial/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        clientFirstInstallTs: localFirstInstallTs
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.success) {
        const authoritativeInstallTs = data.firstInstallTs;
        
        // Persist authoritative server timestamp across all local storage tiers
        localStorage.setItem(FIRST_INSTALL_KEY, authoritativeInstallTs.toString());
        setCookie(COOKIE_TRIAL_KEY, authoritativeInstallTs.toString());
        saveToIndexedDB(FIRST_INSTALL_KEY, authoritativeInstallTs.toString());

        if (data.isActivated && data.activatedKey) {
          localStorage.setItem(LICENSE_STORAGE_KEY, data.activatedKey);
          setCookie(LICENSE_STORAGE_KEY, data.activatedKey);
        }

        const effectiveNow = getMonotonicNow();
        const elapsedMs = effectiveNow - authoritativeInstallTs;
        const remainingMs = TRIAL_DURATION_MS - elapsedMs;
        const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
        const isTrialExpired = (remainingMs <= 0 || data.isTrialExpired) && !data.isActivated;

        const updatedStatus: LicenseStatus = {
          isActivated: data.isActivated || false,
          isTrialActive: !isTrialExpired && !data.isActivated,
          isTrialExpired,
          daysRemaining: data.isActivated ? 0 : daysRemaining,
          trialTotalDays: 30,
          deviceId,
          activatedKey: data.activatedKey,
          firstInstallDate: new Date(authoritativeInstallTs).toLocaleDateString()
        };

        cachedLicenseStatus = updatedStatus;
        if (onUpdate) onUpdate(updatedStatus);
        return updatedStatus;
      }
    }
  } catch (err) {
    // Network offline: gracefully fallback to multi-tier local evaluation
  } finally {
    isSyncInProgress = false;
  }

  const localStatus = getLicenseStatus();
  if (onUpdate) onUpdate(localStatus);
  return localStatus;
}

/**
 * Saves and activates the license both locally and on the server.
 */
export function activateLicense(enteredKey: string): { success: boolean; message: string } {
  const deviceId = getOrCreateDeviceId();
  if (verifyActivationCode(deviceId, enteredKey)) {
    try {
      const cleanKey = enteredKey.trim().toUpperCase();
      localStorage.setItem(LICENSE_STORAGE_KEY, cleanKey);
      setCookie(LICENSE_STORAGE_KEY, cleanKey);
      saveToIndexedDB(LICENSE_STORAGE_KEY, cleanKey);
      cachedLicenseStatus = null;

      // Asynchronously record activation on server
      fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, activationKey: cleanKey })
      }).catch(() => {});

      return { success: true, message: 'Software activated successfully.' };
    } catch (err) {
      return { success: false, message: 'Storage error saving license key.' };
    }
  } else {
    return { success: false, message: 'Invalid activation code entered. Please verify and try again.' };
  }
}

/**
 * Checks if Developer Mode (KeyGen Tab) is unlocked.
 */
export function isDeveloperModeUnlocked(): boolean {
  try {
    return localStorage.getItem(DEVELOPER_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Unlocks or locks developer mode on this device.
 */
export function setDeveloperMode(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(DEVELOPER_FLAG_KEY, 'true');
      localStorage.setItem(OTG_LICENSE_KEY, 'ACT-DEVELOPER-MASTER-KEY');
      localStorage.setItem('mariner_activated', 'true');
      setCookie(OTG_LICENSE_KEY, 'ACT-DEVELOPER-MASTER-KEY');
      setCookie('mariner_activated', 'true');
      saveToIndexedDB(OTG_LICENSE_KEY, 'ACT-DEVELOPER-MASTER-KEY');
    } else {
      localStorage.removeItem(DEVELOPER_FLAG_KEY);
      localStorage.removeItem(OTG_LICENSE_KEY);
      localStorage.removeItem('mariner_activated');
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mariner_license_activated'));
    }
  } catch {}
}

/**
 * Resets / deactivates license (useful for testing or re-licensing)
 */
export function deactivateLicense(): void {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
    localStorage.removeItem(OTG_LICENSE_KEY);
    localStorage.removeItem('mariner_activated');
    localStorage.removeItem('mariner_myket_purchased');
    localStorage.removeItem(DEVELOPER_FLAG_KEY);
    localStorage.removeItem(OTG_WARNING_DISMISSED_KEY);
    setCookie(LICENSE_STORAGE_KEY, '');
    setCookie(OTG_LICENSE_KEY, '');
    setCookie('mariner_activated', '');
    setCookie('mariner_myket_purchased', '');
    cachedLicenseStatus = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mariner_license_activated'));
    }
  } catch {}
}

/**
 * Developer Testing Simulator: Simulates age of app in days to test 5-month warning and 6-month expiration
 */
export function simulateAppAgeDays(days: number): void {
  try {
    const simulatedInstallTs = Date.now() - (days * 24 * 60 * 60 * 1000);
    localStorage.setItem(FIRST_INSTALL_KEY, simulatedInstallTs.toString());
    localStorage.removeItem(LAST_SEEN_KEY);
    localStorage.removeItem(OTG_WARNING_DISMISSED_KEY);
    setCookie(COOKIE_TRIAL_KEY, simulatedInstallTs.toString());
    saveToIndexedDB(FIRST_INSTALL_KEY, simulatedInstallTs.toString());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mariner_license_activated'));
    }
  } catch {}
}
