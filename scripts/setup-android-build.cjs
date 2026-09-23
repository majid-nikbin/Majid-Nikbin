const fs = require('fs');
const path = require('path');

const runNumber = process.argv[2] || '1';
console.log(`==> Configuring Android build for Run #${runNumber}...`);

const rootDir = process.cwd();
const androidDir = path.join(rootDir, 'android');
const appDir = path.join(androidDir, 'app');
const resDir = path.join(appDir, 'src', 'main', 'res');

// 1. App Icon Setup (Adaptive Icons + All Densities)
const iconCandidates = [
  path.join(rootDir, 'assets', 'icon.png'),
  path.join(rootDir, 'assets', 'icon.jpg'),
  path.join(rootDir, 'public', 'app-icon.jpg'),
  path.join(rootDir, 'public', 'app-icon.png'),
  path.join(rootDir, 'public', 'icon-512.png'),
  path.join(rootDir, 'public', 'icon.png')
];

let selectedIcon = null;
for (const cand of iconCandidates) {
  if (fs.existsSync(cand) && fs.statSync(cand).size > 0) {
    selectedIcon = cand;
    break;
  }
}

if (selectedIcon) {
  console.log(`==> Found App Icon Source: ${selectedIcon}`);
  const densities = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  
  for (const d of densities) {
    const targetFolder = path.join(resDir, d);
    if (!fs.existsSync(targetFolder)) fs.mkdirSync(targetFolder, { recursive: true });
    
    fs.copyFileSync(selectedIcon, path.join(targetFolder, 'ic_launcher.png'));
    fs.copyFileSync(selectedIcon, path.join(targetFolder, 'ic_launcher_round.png'));
    fs.copyFileSync(selectedIcon, path.join(targetFolder, 'ic_launcher_foreground.png'));
  }

  // Modern Android Adaptive Icon XML (API 26+)
  const anydpiDir = path.join(resDir, 'mipmap-anydpi-v26');
  if (!fs.existsSync(anydpiDir)) fs.mkdirSync(anydpiDir, { recursive: true });

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;

  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

  // Background Color
  const valuesDir = path.join(resDir, 'values');
  if (!fs.existsSync(valuesDir)) fs.mkdirSync(valuesDir, { recursive: true });
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0F172A</color>
</resources>
`;
  fs.writeFileSync(path.join(valuesDir, 'ic_launcher_background.xml'), bgXml, 'utf8');
  console.log('==> Adaptive icons configured successfully.');
} else {
  console.warn('==> Warning: No custom icon file found, keeping default.');
}

// 2. Android Manifest Permissions
const manifestPath = path.join(appDir, 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const permissions = `
    <uses-feature android:name="android.hardware.usb.host" android:required="false" />
    <uses-permission android:name="android.permission.USB_PERMISSION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
`;
  if (!manifest.includes('ACCESS_FINE_LOCATION')) {
    manifest = manifest.replace('</manifest>', `${permissions}</manifest>`);
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('==> AndroidManifest.xml permissions injected.');
  }
}

// 3. Persistent Fixed Keystore
const rootKeystore = path.join(rootDir, 'mariner-release.keystore');
const b64Keystore = path.join(rootDir, 'mariner-keystore.b64');
const targetKeystore = path.join(androidDir, 'mariner-release.keystore');

if (!fs.existsSync(rootKeystore) && fs.existsSync(b64Keystore)) {
  const b64Data = fs.readFileSync(b64Keystore, 'utf8').trim();
  fs.writeFileSync(rootKeystore, Buffer.from(b64Data, 'base64'));
}

if (fs.existsSync(rootKeystore)) {
  fs.copyFileSync(rootKeystore, targetKeystore);
  console.log('==> Persistent keystore copied to android/mariner-release.keystore');
}

// 4. Update android/app/build.gradle
const buildGradlePath = path.join(appDir, 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');

  // Strip x86 emulator binaries (saves ~10MB)
  if (!gradle.includes('ndk {')) {
    gradle = gradle.replace(
      'defaultConfig {',
      "defaultConfig {\n        ndk { abiFilters 'armeabi-v7a', 'arm64-v8a' }"
    );
  }

  // Dynamic VersionCode & VersionName
  gradle = gradle.replace(/versionCode \d+/g, `versionCode ${runNumber}`);
  gradle = gradle.replace(/versionName "[^"]*"/g, `versionName "1.0.${runNumber}"`);

  // Configure persistent signing
  const signingConfig = `
    signingConfigs {
        release {
            storeFile file('../../mariner-release.keystore')
            storePassword 'mariner1234'
            keyAlias 'mariner'
            keyPassword 'mariner1234'
        }
    }
`;

  if (!gradle.includes('signingConfigs {')) {
    gradle = gradle.replace('android {', `android {${signingConfig}`);
  }

  gradle = gradle.replace(
    'buildTypes {',
    'buildTypes {\n        debug {\n            signingConfig signingConfigs.release\n        }'
  );
  gradle = gradle.replace(
    'release {',
    'release {\n            signingConfig signingConfigs.release'
  );

  fs.writeFileSync(buildGradlePath, gradle, 'utf8');
  console.log(`==> Updated build.gradle: versionCode ${runNumber}, versionName 1.0.${runNumber}, and persistent Keystore signing.`);
}

console.log('==> Android setup complete!');
