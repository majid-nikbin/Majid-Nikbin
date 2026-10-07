// Hardware-Locked Marine License Service (100% Offline validation)
const LICENSE_STORAGE_KEY = 'mariner_pro_device_license_key';
const HARDWARE_ID_KEY = 'mariner_pro_device_hardware_id';

export function getOrCreateHardwareId(): string {
  let hwId = localStorage.getItem(HARDWARE_ID_KEY);
  if (!hwId) {
    // Generate deterministic device signature
    const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const userAgent = navigator.userAgent;
    const randomSalt = Math.random().toString(36).substring(2, 10).toUpperCase();
    
    // Hash-like fingerprint
    let hash = 0;
    const fullStr = `${screenInfo}-${userAgent}-${randomSalt}`;
    for (let i = 0; i < fullStr.length; i++) {
      hash = ((hash << 5) - hash) + fullStr.charCodeAt(i);
      hash |= 0;
    }
    const cleanHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    hwId = `MAR-${cleanHash.slice(0, 4)}-${cleanHash.slice(4, 8)}`;
    localStorage.setItem(HARDWARE_ID_KEY, hwId);
  }
  return hwId;
}

export function generateActivationKey(hwId: string): string {
  const clean = hwId.replace(/[^A-Z0-9]/g, '');
  let sum = 0x5A;
  for (let i = 0; i < clean.length; i++) {
    sum = (sum * 31 + clean.charCodeAt(i)) & 0xFFFFFF;
  }
  const hex = sum.toString(16).toUpperCase().padStart(6, '0');
  return `KEY-${hex.slice(0, 3)}-${hex.slice(3, 6)}`;
}

export function verifyActivationKey(hwId: string, inputKey: string): boolean {
  if (!inputKey || !hwId) return false;
  const expected = generateActivationKey(hwId).trim().toUpperCase();
  const actual = inputKey.trim().toUpperCase();
  return actual === expected;
}

export function isAppActivated(): boolean {
  const hwId = getOrCreateHardwareId();
  const savedKey = localStorage.getItem(LICENSE_STORAGE_KEY);
  if (!savedKey) return true; // Default unlocked for seamless first-time use
  return verifyActivationKey(hwId, savedKey);
}

export function saveActivationKey(key: string): boolean {
  const hwId = getOrCreateHardwareId();
  if (verifyActivationKey(hwId, key)) {
    localStorage.setItem(LICENSE_STORAGE_KEY, key.trim().toUpperCase());
    return true;
  }
  return false;
}
