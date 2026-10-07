import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function downloadProjectZip() {
  const zip = new JSZip();

  // Root files
  zip.file('package.json', JSON.stringify({
    "name": "mariner-pro-link-nmea0183",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "tsx server.ts",
      "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
      "start": "node dist/server.cjs",
      "lint": "tsc --noEmit",
      "build:android": "npx cap sync android"
    },
    "dependencies": {
      "@tailwindcss/vite": "^4.0.0-beta.8",
      "express": "^4.21.2",
      "file-saver": "^2.0.5",
      "jszip": "^3.10.1",
      "lucide-react": "^0.475.0",
      "motion": "^12.4.7",
      "react": "^18.3.1",
      "react-dom": "^18.3.1",
      "tailwindcss": "^4.0.0-beta.8"
    },
    "devDependencies": {
      "@types/express": "^5.0.0",
      "@types/file-saver": "^2.0.7",
      "@types/node": "^22.13.4",
      "@types/react": "^18.3.18",
      "@types/react-dom": "^18.3.5",
      "@vitejs/plugin-react": "^4.3.4",
      "esbuild": "^0.25.0",
      "tsx": "^4.19.2",
      "typescript": "~5.7.2",
      "vite": "^6.1.0"
    }
  }, null, 2));

  zip.file('tsconfig.json', JSON.stringify({
    "compilerOptions": {
      "target": "ES2020",
      "useDefineForClassFields": true,
      "lib": ["ES2020", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "skipLibCheck": true,
      "moduleResolution": "bundler",
      "allowImportingTsExtensions": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "moduleDetection": "force",
      "noEmit": true,
      "jsx": "react-jsx",
      "strict": true,
      "noUnusedLocals": false,
      "noUnusedParameters": false,
      "noFallthroughCasesInSwitch": true
    },
    "include": ["src"]
  }, null, 2));

  zip.file('vite.config.ts', `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`);

  zip.file('capacitor.config.json', JSON.stringify({
    "appId": "com.mariner.prolink",
    "appName": "Mariner Pro-Link",
    "webDir": "dist",
    "bundledWebRuntime": false
  }, null, 2));

  zip.file('README.md', `# Mariner Pro-Link (Marine Compass, GPS & NMEA 0183 USB Transceiver)

## Features
- Marine Compass with true & magnetic heading with Marine Low-Pass Kalman damping filter.
- High-visibility GNSS / GPS Marine Position (DDM, DMS, DD formats).
- Full NMEA 0183 Transceiver & Live Monitor (HDG, HDT, RMC, GGA, VTG, VHW, etc.).
- Direct Android USB OTG & WebUSB hardware support (CP210x, CH340, FTDI, PL2303, MAX485).
- 100% Offline operation capability for sea vessels.

## Quick Start on Laptop / Android Studio
1. \`npm install\`
2. \`npm run dev\` (starts on http://localhost:3000)

## Build Standalone Android APK with Android Studio
1. \`npm run build\`
2. \`npx cap add android\`
3. \`npx cap open android\`
4. In Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
`);

  // Fetch actual live files from server
  try {
    const fetchAndZip = async (url: string, zipPath: string) => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const content = await res.text();
          zip.file(zipPath, content);
        }
      } catch (e) {}
    };

    await Promise.all([
      fetchAndZip('/index.html', 'index.html'),
      fetchAndZip('/manifest.json', 'public/manifest.json'),
      fetchAndZip('/sw.js', 'public/sw.js'),
      fetchAndZip('/src/main.tsx', 'src/main.tsx'),
      fetchAndZip('/src/App.tsx', 'src/App.tsx'),
      fetchAndZip('/src/index.css', 'src/index.css'),
      fetchAndZip('/src/types.ts', 'src/types.ts'),
      fetchAndZip('/src/components/Header.tsx', 'src/components/Header.tsx'),
      fetchAndZip('/src/components/CompassDial.tsx', 'src/components/CompassDial.tsx'),
      fetchAndZip('/src/components/MarineGpsData.tsx', 'src/components/MarineGpsData.tsx'),
      fetchAndZip('/src/components/NmeaTransmitter.tsx', 'src/components/NmeaTransmitter.tsx'),
      fetchAndZip('/src/components/NmeaMonitor.tsx', 'src/components/NmeaMonitor.tsx'),
      fetchAndZip('/src/components/UsbDriverGuide.tsx', 'src/components/UsbDriverGuide.tsx'),
      fetchAndZip('/src/components/InstallAppModal.tsx', 'src/components/InstallAppModal.tsx'),
      fetchAndZip('/src/hooks/useSensors.ts', 'src/hooks/useSensors.ts'),
      fetchAndZip('/src/services/serialService.ts', 'src/services/serialService.ts'),
      fetchAndZip('/src/services/webUsbDriver.ts', 'src/services/webUsbDriver.ts'),
      fetchAndZip('/src/utils/geo.ts', 'src/utils/geo.ts'),
      fetchAndZip('/src/utils/nmea.ts', 'src/utils/nmea.ts'),
    ]);
  } catch (err) {
    console.warn('Zip gather error:', err);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, 'mariner-pro-link-full-project.zip');
}
