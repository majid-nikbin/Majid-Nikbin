const fs = require('fs');
const path = require('path');

const rawRunNumber = parseInt(process.argv[2] || '1', 10);
// Reset version to start from 1 for Myket store release, incrementing on each build
let myketVersionCode = rawRunNumber;
if (rawRunNumber >= 44) {
  myketVersionCode = rawRunNumber - 43;
} else if (rawRunNumber <= 0 || isNaN(rawRunNumber)) {
  myketVersionCode = 1;
}
const myketVersionName = `1.0.${myketVersionCode}`;

console.log(`==> Configuring Android build for Run #${rawRunNumber} -> Myket Version: ${myketVersionName} (Code: ${myketVersionCode})...`);

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

// 2. Android Manifest Permissions & Myket Package Queries
const manifestPath = path.join(appDir, 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  const permissions = `
    <uses-feature android:name="android.hardware.usb.host" android:required="false" />
    <uses-permission android:name="android.permission.USB_PERMISSION" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="ir.mservices.market.BILLING" />

    <queries>
        <package android:name="ir.mservices.market" />
        <package android:name="com.android.chrome" />
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="myket" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="http" />
        </intent>
    </queries>
`;
  if (!manifest.includes('ACCESS_FINE_LOCATION') || !manifest.includes('ir.mservices.market')) {
    manifest = manifest.replace('</manifest>', `${permissions}</manifest>`);
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    console.log('==> AndroidManifest.xml permissions & Myket queries injected.');
  }
}

// 3. Persistent Fixed Keystore Setup
const rootKeystore = path.join(rootDir, 'mariner-release.keystore');
const b64Keystore = path.join(rootDir, 'mariner-keystore.b64');
const androidKeystore = path.join(androidDir, 'mariner-release.keystore');
const appKeystore = path.join(appDir, 'mariner-release.keystore');

let keystoreBuffer = null;
if (fs.existsSync(rootKeystore) && fs.statSync(rootKeystore).size > 0) {
  keystoreBuffer = fs.readFileSync(rootKeystore);
} else if (fs.existsSync(b64Keystore) && fs.statSync(b64Keystore).size > 0) {
  const b64Data = fs.readFileSync(b64Keystore, 'utf8').trim();
  keystoreBuffer = Buffer.from(b64Data, 'base64');
}

if (keystoreBuffer) {
  fs.writeFileSync(rootKeystore, keystoreBuffer);
  fs.writeFileSync(androidKeystore, keystoreBuffer);
  fs.writeFileSync(appKeystore, keystoreBuffer);
  console.log('==> Persistent keystore verified and placed at android/app/mariner-release.keystore');
} else {
  console.warn('==> Keystore file not found, will build standard debug signed APK.');
}

// 4. Generate Clean & Robust android/app/build.gradle
const buildGradlePath = path.join(appDir, 'build.gradle');
if (fs.existsSync(buildGradlePath)) {
  const cleanBuildGradle = `apply plugin: 'com.android.application'

android {
    namespace "com.mariner.pro"
    compileSdk rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.mariner.pro"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode ${myketVersionCode}
        versionName "${myketVersionName}"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions { 
             // Files and dirs to omit from the packaged assets dir, modified to accommodate modern web apps.
             // Default: https://android.googlesource.com/platform/frameworks/base/+/282e181b58cf72b6ca770dc7ca5f91f135444502/tools/aapt/AaptAssets.cpp#61
            ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
        }
    }
    signingConfigs {
        release {
            def keystoreFile = file('mariner-release.keystore')
            if (keystoreFile.exists()) {
                storeFile keystoreFile
                storePassword 'mariner1234'
                keyAlias 'mariner'
                keyPassword 'mariner1234'
            }
        }
    }
    buildTypes {
        debug {
            def keystoreFile = file('mariner-release.keystore')
            if (keystoreFile.exists()) {
                signingConfig signingConfigs.release
            }
        }
        release {
            def keystoreFile = file('mariner-release.keystore')
            if (keystoreFile.exists()) {
                signingConfig signingConfigs.release
            }
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}

repositories {
    flatDir{
        dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'
    }
}

dependencies {
    implementation fileTree(include: ['*.jar'], dir: 'libs')
    implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"
    implementation "androidx.coordinatorlayout:coordinatorlayout:$androidxCoordinatorLayoutVersion"
    implementation "androidx.core:core-splashscreen:$coreSplashScreenVersion"
    implementation project(':capacitor-android')
    testImplementation "junit:junit:$junitVersion"
    androidTestImplementation "androidx.test.ext:junit:$androidxJunitVersion"
    androidTestImplementation "androidx.test.espresso:espresso-core:$androidxEspressoCoreVersion"
    implementation project(':capacitor-cordova-android-plugins')
}

apply from: 'capacitor.build.gradle'

try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work")
}
`;

  fs.writeFileSync(buildGradlePath, cleanBuildGradle, 'utf8');
  console.log(`==> Successfully updated android/app/build.gradle: versionCode ${myketVersionCode}, versionName ${myketVersionName}, and crash-proof persistent signing.`);
}

// 5. Synchronize src/config/version.ts and package.json so Developer Info matches installed Android version
const versionTsPath = path.join(rootDir, 'src', 'config', 'version.ts');
if (fs.existsSync(versionTsPath)) {
  let vContent = fs.readFileSync(versionTsPath, 'utf8');
  vContent = vContent.replace(/export const APP_VERSION = '[^']+';/, `export const APP_VERSION = '${myketVersionName}';`);
  vContent = vContent.replace(/export const APP_BUILD = '[^']+';/, `export const APP_BUILD = 'Build ${myketVersionCode}';`);
  vContent = vContent.replace(/export const APP_RELEASE_NAME = `[^`]+`;/, `export const APP_RELEASE_NAME = \`Mariner Pro-Link v\${APP_VERSION}\`;`);
  fs.writeFileSync(versionTsPath, vContent, 'utf8');
  console.log(`==> Synchronized src/config/version.ts to v${myketVersionName} (Build ${myketVersionCode})`);
}

const pkgPath = path.join(rootDir, 'package.json');
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = myketVersionName;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`==> Synchronized package.json to v${myketVersionName}`);
  } catch (e) {}
}

console.log('==> Android setup completed successfully!');
