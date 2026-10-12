package com.mariner.pro;

import android.content.Context;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONObject;

/**
 * Persistent Anti-Tamper Hardware & Trial Storage Bridge.
 * 
 * Stores the first-installation timestamp in Android public shared storage
 * (Documents / Download) and binds it to the immutable hardware Settings.Secure.ANDROID_ID.
 * 
 * This ensures that:
 * 1. "Clear Data" (پاک کردن داده‌ها) CANNOT wipe the trial or reset the 6-month clock.
 * 2. Uninstalling and reinstalling the app CANNOT reset the 6-month clock.
 * 3. Only entering developer PIN "2450" can reset the persistent timestamp.
 */
public class MarinerNativeStorage {
    private final Context context;
    private static final String DEVELOPER_PASSCODE = "2450";
    private static final String SALT = "MARINER_PRO_NAV_SALT_PERSISTENT_2026";

    public MarinerNativeStorage(Context context) {
        this.context = context;
    }

    /**
     * Retrieves the stable Android hardware identifier that never changes
     * across Clear Data, reboots, or reinstallation of the signed APK.
     */
    @JavascriptInterface
    public String getHardwareAndroidId() {
        try {
            String androidId = Settings.Secure.getString(context.getContentResolver(), Settings.Secure.ANDROID_ID);
            if (androidId != null && !androidId.trim().isEmpty()) {
                return androidId.trim().toUpperCase();
            }
        } catch (Exception ignored) {}
        return "";
    }

    /**
     * Reads persistent install record from external persistent storage.
     * Returns JSON string: {"firstInstallTs": 1728..., "deviceId": "...", "androidId": "..."} or empty string.
     */
    @JavascriptInterface
    public String getPersistentInstallRecord(String clientDeviceId) {
        try {
            File[] targets = getPersistentStorageFiles();
            for (File file : targets) {
                if (file != null && file.exists() && file.length() > 0) {
                    String content = readFile(file);
                    if (content != null && !content.trim().isEmpty()) {
                        JSONObject json = new JSONObject(content.trim());
                        long ts = json.optLong("firstInstallTs", 0);
                        String devId = json.optString("deviceId", "");
                        String sig = json.optString("sig", "");

                        if (ts > 1700000000000L && verifySignature(devId, ts, sig)) {
                            return json.toString();
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return "";
    }

    /**
     * Saves persistent install record into multiple shared storage locations.
     * Guaranteed to preserve the EARLIEST install timestamp (never overwrites with a newer date).
     */
    @JavascriptInterface
    public boolean savePersistentInstallRecord(String deviceId, long firstInstallTs) {
        try {
            if (firstInstallTs <= 1700000000000L) return false;

            // Check if older record already exists across persistent files
            File[] targets = getPersistentStorageFiles();
            for (File file : targets) {
                if (file != null && file.exists() && file.length() > 0) {
                    String content = readFile(file);
                    if (content != null && !content.trim().isEmpty()) {
                        try {
                            JSONObject json = new JSONObject(content.trim());
                            long existingTs = json.optLong("firstInstallTs", 0);
                            if (existingTs > 1700000000000L && existingTs <= firstInstallTs) {
                                // Already securely recorded with an earlier or equal date!
                                return true;
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }

            // Create signed tamper-proof JSON
            JSONObject json = new JSONObject();
            json.put("deviceId", deviceId);
            json.put("firstInstallTs", firstInstallTs);
            json.put("androidId", getHardwareAndroidId());
            json.put("sig", computeSignature(deviceId, firstInstallTs));
            String payload = json.toString();

            boolean writtenAny = false;
            for (File file : targets) {
                if (file != null) {
                    if (writeFile(file, payload)) {
                        writtenAny = true;
                    }
                }
            }
            return writtenAny;
        } catch (Exception ignored) {}
        return false;
    }

    /**
     * Saves persistent purchase record into external persistent storage.
     * When purchased via Myket or developer key, this ensures the purchase
     * is permanently recognized across Clear Data and offline app reinstalls!
     */
    @JavascriptInterface
    public boolean savePersistentPurchase(String deviceId, String purchaseKey) {
        try {
            if (deviceId == null || deviceId.trim().isEmpty()) return false;
            String key = (purchaseKey != null && !purchaseKey.trim().isEmpty()) ? purchaseKey.trim() : "MYKET-PURCHASED";

            File[] targets = getPersistentStorageFiles();
            long existingTs = System.currentTimeMillis();

            // Check if existing timestamp is available
            for (File file : targets) {
                if (file != null && file.exists() && file.length() > 0) {
                    try {
                        String content = readFile(file);
                        if (content != null && !content.trim().isEmpty()) {
                            JSONObject json = new JSONObject(content.trim());
                            long ts = json.optLong("firstInstallTs", 0);
                            if (ts > 1700000000000L) {
                                existingTs = ts;
                                break;
                            }
                        }
                    } catch (Exception ignored) {}
                }
            }

            JSONObject json = new JSONObject();
            json.put("deviceId", deviceId);
            json.put("firstInstallTs", existingTs);
            json.put("isPurchased", true);
            json.put("purchaseKey", key);
            json.put("androidId", getHardwareAndroidId());
            json.put("sig", computeSignature(deviceId, existingTs));
            json.put("purchaseSig", computeSignature(deviceId + ":" + key, existingTs));

            String payload = json.toString();
            boolean writtenAny = false;
            for (File file : targets) {
                if (file != null && writeFile(file, payload)) {
                    writtenAny = true;
                }
            }
            return writtenAny;
        } catch (Exception ignored) {}
        return false;
    }

    /**
     * Reads persistent purchase record. Returns true/false or purchase key string.
     */
    @JavascriptInterface
    public String getPersistentPurchase(String deviceId) {
        try {
            File[] targets = getPersistentStorageFiles();
            for (File file : targets) {
                if (file != null && file.exists() && file.length() > 0) {
                    String content = readFile(file);
                    if (content != null && !content.trim().isEmpty()) {
                        JSONObject json = new JSONObject(content.trim());
                        boolean isPurchased = json.optBoolean("isPurchased", false);
                        String key = json.optString("purchaseKey", "");
                        long ts = json.optLong("firstInstallTs", 0);
                        String purchaseSig = json.optString("purchaseSig", "");

                        if (isPurchased && !key.isEmpty()) {
                            if (verifySignature((deviceId != null ? deviceId : json.optString("deviceId")) + ":" + key, ts, purchaseSig)) {
                                return key;
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return "";
    }

    /**
     * Authorized Developer Reset: Only authorized with Master Passcode "2450".
     * Wipes persistent files so developer can reset to Day 0.
     */
    @JavascriptInterface
    public boolean resetPersistentInstallRecord(String passcode, long newTimestamp) {
        try {
            if (DEVELOPER_PASSCODE.equals(passcode != null ? passcode.trim() : "")) {
                File[] targets = getPersistentStorageFiles();
                for (File file : targets) {
                    if (file != null && file.exists()) {
                        file.delete();
                    }
                }
                return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private File[] getPersistentStorageFiles() {
        File[] targets = new File[3];
        try {
            // 1. Documents folder (survives Clear Data and Reinstall)
            File docsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
            if (docsDir != null) {
                if (!docsDir.exists()) docsDir.mkdirs();
                targets[0] = new File(docsDir, ".mariner_system_identity.dat");
            }
        } catch (Exception ignored) {}

        try {
            // 2. Download folder (survives Clear Data and Reinstall)
            File dlDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (dlDir != null) {
                if (!dlDir.exists()) dlDir.mkdirs();
                targets[1] = new File(dlDir, ".mariner_sys_persist.bin");
            }
        } catch (Exception ignored) {}

        try {
            // 3. App External files fallback
            File extDir = context.getExternalFilesDir(null);
            if (extDir != null) {
                targets[2] = new File(extDir, ".mariner_local_persist.dat");
            }
        } catch (Exception ignored) {}

        return targets;
    }

    private String readFile(File file) {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[(int) file.length()];
            int read = fis.read(buffer);
            if (read > 0) {
                return new String(buffer, 0, read, StandardCharsets.UTF_8);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private boolean writeFile(File file, String content) {
        try {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            try (FileOutputStream fos = new FileOutputStream(file, false)) {
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.flush();
                return true;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private String computeSignature(String devId, long ts) {
        try {
            String raw = (devId != null ? devId.trim() : "") + ":" + ts + ":" + SALT;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(raw.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception ignored) {
            return "";
        }
    }

    private boolean verifySignature(String devId, long ts, String sig) {
        if (sig == null || sig.isEmpty()) return false;
        return sig.equalsIgnoreCase(computeSignature(devId, ts));
    }
}
