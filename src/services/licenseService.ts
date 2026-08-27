/**
 * Licensing and Device ID / Activation Service
 * 
 * Generates a persistent unique hardware/device installation ID per device (e.g., MAR-A82F-7K29).
 * Provides cryptographic/hash-based license verification that only the Developer
 * can generate using a private secret seed.
 */

const LICENSE_STORAGE_KEY = 'mariner_license_key_v1';
const DEVICE_ID_STORAGE_KEY = 'mariner_device_id_v1';
const DEVELOPER_FLAG_KEY = 'mariner_dev_mode_enabled_v1';

// Developer Master Secret (used for HMAC / Mathematical hash derivation)
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

export interface GoogleUserProfile {
  email: string;
  name?: string;
  picture?: string;
  isDeveloper: boolean;
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
    }
  } catch (e) {
    console.warn('Storage error saving google user:', e);
  }

  return { isDeveloper: isDev };
}

/**
 * Signs out Google Account
 */
export function signOutGoogleUser(): void {
  try {
    localStorage.removeItem(GOOGLE_USER_STORAGE_KEY);
    localStorage.removeItem(AUTO_DEV_UNLOCKED_KEY);
  } catch {}
}

export interface LicenseStatus {
  isActivated: boolean;
  deviceId: string;
  activatedKey?: string;
  activatedAt?: string;
}

/**
 * Generates or retrieves a unique persistent device ID for this phone/browser.
 */
export function getOrCreateDeviceId(): string {
  try {
    let devId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (devId && devId.startsWith('MAR-')) {
      return devId;
    }

    // Generate unique entropy from browser fingerprint + crypto random
    const randParts = new Uint32Array(3);
    window.crypto.getRandomValues(randParts);
    
    // Combine random with screen/navigator specs to ensure uniqueness
    const fpString = `${navigator.userAgent}-${screen.width}x${screen.height}-${randParts[0]}-${randParts[1]}-${randParts[2]}`;
    
    // 32-bit hash function
    let hash = 0x811c9dc5;
    for (let i = 0; i < fpString.length; i++) {
      hash ^= fpString.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    
    // Format: MAR-XXXX-YYYY (e.g. MAR-7A9B-4F21)
    const part1 = ((hash >>> 16) & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    const part2 = (hash & 0xffff).toString(16).toUpperCase().padStart(4, '0');
    
    devId = `MAR-${part1}-${part2}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, devId);
    return devId;
  } catch {
    return 'MAR-9B2F-4A10';
  }
}

/**
 * Calculates the valid Activation Code for a given Device ID.
 * Formula: Deterministic hash on (DeviceID + MASTER_SALT) -> Format: ACT-XXXX-YYYY-ZZZZ
 */
export function generateActivationCode(deviceId: string): string {
  const cleanDevId = deviceId.trim().toUpperCase();
  const input = `${cleanDevId}:${MASTER_SALT}`;
  
  // Custom deterministic hashing (FNV-1a + Murmur mix)
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
 * Validates whether an activation key matches the device ID.
 */
export function verifyActivationCode(deviceId: string, enteredKey: string): boolean {
  if (!enteredKey) return false;
  const cleanKey = enteredKey.trim().toUpperCase().replace(/\s+/g, '');
  const expectedKey = generateActivationCode(deviceId);
  
  // Support entering with or without hyphens
  const cleanExpected = expectedKey.replace(/-/g, '');
  const cleanInput = cleanKey.replace(/-/g, '');

  return cleanKey === expectedKey || cleanInput === cleanExpected;
}

/**
 * Retrieves the current activation status from storage.
 */
export function getLicenseStatus(): LicenseStatus {
  const deviceId = getOrCreateDeviceId();
  try {
    const savedKey = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (savedKey && verifyActivationCode(deviceId, savedKey)) {
      return {
        isActivated: true,
        deviceId,
        activatedKey: savedKey,
      };
    }
  } catch (err) {
    console.warn('License storage check error:', err);
  }

  return {
    isActivated: false,
    deviceId,
  };
}

/**
 * Saves and activates the license.
 */
export function activateLicense(enteredKey: string): { success: boolean; message: string } {
  const deviceId = getOrCreateDeviceId();
  if (verifyActivationCode(deviceId, enteredKey)) {
    try {
      const cleanKey = enteredKey.trim().toUpperCase();
      localStorage.setItem(LICENSE_STORAGE_KEY, cleanKey);
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
    } else {
      localStorage.removeItem(DEVELOPER_FLAG_KEY);
    }
  } catch {}
}

/**
 * Resets / deactivates license (useful for testing or re-licensing)
 */
export function deactivateLicense(): void {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {}
}
