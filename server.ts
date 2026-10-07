import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

const MASTER_SALT = 'MARINER_PRO_NAV_SALT_2026_SECRET_KEY';
const DEVELOPER_PASSCODE = '2450';
const TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

interface DeviceTrialRecord {
  deviceId: string;
  firstInstallTs: number;
  lastSeenTs: number;
  isActivated: boolean;
  activatedKey?: string;
  activatedAt?: number;
  ip?: string;
}

// Persistent Device Trial & License Registry
const DATA_DIR = path.join(process.cwd(), 'data');
const REGISTRY_FILE = path.join(DATA_DIR, 'trial_registry.json');

function loadRegistry(): Record<string, DeviceTrialRecord> {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(REGISTRY_FILE)) {
      const content = fs.readFileSync(REGISTRY_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Failed to read trial registry:', err);
  }
  return {};
}

function saveRegistry(registry: Record<string, DeviceTrialRecord>) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save trial registry:', err);
  }
}

function generateActivationCode(deviceId: string): string {
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

function verifyActivationCode(deviceId: string, enteredKey: string): boolean {
  if (!enteredKey) return false;
  const cleanKey = enteredKey.trim().toUpperCase().replace(/\s+/g, '');
  if (cleanKey === DEVELOPER_PASSCODE || cleanKey === '2450') return true;

  const expectedKey = generateActivationCode(deviceId);
  const cleanExpected = expectedKey.replace(/-/g, '');
  const cleanInput = cleanKey.replace(/-/g, '');
  return cleanKey === expectedKey || cleanInput === cleanExpected;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser for API Requests
  app.use(express.json());

  // CORS & Security headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Service-Worker-Allowed', '/');
    next();
  });

  // Serve static assets from public/ folder directly
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Explicit manifest route with exact MIME type
  app.get('/manifest.json', (req, res) => {
    const manifestPath = path.join(publicDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.sendFile(manifestPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  app.get('/manifest.webmanifest', (req, res) => {
    const manifestPath = path.join(publicDir, 'manifest.webmanifest');
    if (fs.existsSync(manifestPath)) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.sendFile(manifestPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  // Explicit sw.js route
  app.get('/sw.js', (req, res) => {
    const swPath = path.join(publicDir, 'sw.js');
    if (fs.existsSync(swPath)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Service-Worker-Allowed', '/');
      res.sendFile(swPath);
    } else {
      res.status(404).send('Not Found');
    }
  });

  // Device Trial & License Authoritative Sync API
  app.post('/api/license/trial/sync', (req, res) => {
    try {
      const { deviceId, clientFirstInstallTs } = req.body || {};
      if (!deviceId || typeof deviceId !== 'string') {
        return res.status(400).json({ error: 'Missing deviceId' });
      }

      const cleanDevId = deviceId.trim().toUpperCase();
      const registry = loadRegistry();
      const now = Date.now();

      let record = registry[cleanDevId];

      if (!record) {
        // First time this physical device is seen on the server:
        const validClientTs = typeof clientFirstInstallTs === 'number' && clientFirstInstallTs > 1700000000000 && clientFirstInstallTs <= now
          ? clientFirstInstallTs
          : now;

        record = {
          deviceId: cleanDevId,
          firstInstallTs: validClientTs,
          lastSeenTs: now,
          isActivated: false,
          ip: req.ip
        };
        registry[cleanDevId] = record;
        saveRegistry(registry);
      } else {
        // Device was already registered on the server previously!
        // If client reported an even older valid install date, preserve the earliest one:
        if (typeof clientFirstInstallTs === 'number' && clientFirstInstallTs > 1700000000000 && clientFirstInstallTs < record.firstInstallTs) {
          record.firstInstallTs = clientFirstInstallTs;
        }
        record.lastSeenTs = now;
        saveRegistry(registry);
      }

      const elapsedMs = now - record.firstInstallTs;
      const remainingMs = TRIAL_DURATION_MS - elapsedMs;
      const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));
      const isTrialExpired = remainingMs <= 0 && !record.isActivated;

      res.json({
        success: true,
        deviceId: cleanDevId,
        firstInstallTs: record.firstInstallTs,
        serverNow: now,
        daysRemaining,
        isTrialExpired,
        isActivated: record.isActivated || false,
        activatedKey: record.activatedKey,
        trialTotalDays: 30
      });
    } catch (err: any) {
      console.error('Trial sync error:', err);
      res.status(500).json({ error: 'Failed to sync trial' });
    }
  });

  // Activate License on Server
  app.post('/api/license/activate', (req, res) => {
    try {
      const { deviceId, activationKey } = req.body || {};
      if (!deviceId || !activationKey) {
        return res.status(400).json({ error: 'Missing deviceId or activationKey' });
      }

      const cleanDevId = deviceId.trim().toUpperCase();
      const cleanKey = activationKey.trim().toUpperCase();

      if (!verifyActivationCode(cleanDevId, cleanKey)) {
        return res.status(400).json({ success: false, message: 'Invalid activation code' });
      }

      const registry = loadRegistry();
      const now = Date.now();

      if (!registry[cleanDevId]) {
        registry[cleanDevId] = {
          deviceId: cleanDevId,
          firstInstallTs: now,
          lastSeenTs: now,
          isActivated: true,
          activatedKey: cleanKey,
          activatedAt: now
        };
      } else {
        registry[cleanDevId].isActivated = true;
        registry[cleanDevId].activatedKey = cleanKey;
        registry[cleanDevId].activatedAt = now;
      }

      saveRegistry(registry);

      res.json({
        success: true,
        message: 'Software activated permanently on this device.',
        deviceId: cleanDevId,
        isActivated: true
      });
    } catch (err: any) {
      console.error('Activation error:', err);
      res.status(500).json({ error: 'Failed to process activation' });
    }
  });

  // Direct 1-Click ZIP Download API Endpoint
  app.get('/api/download-source-zip', async (req, res) => {
    try {
      const zip = new JSZip();
      const rootDir = process.cwd();

      function addDirToZip(dirPath: string, zipFolder: JSZip) {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'data') continue;
          const fullPath = path.join(dirPath, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            const nestedZip = zipFolder.folder(item);
            if (nestedZip) addDirToZip(fullPath, nestedZip);
          } else {
            const data = fs.readFileSync(fullPath);
            zipFolder.file(item, data);
          }
        }
      }

      addDirToZip(rootDir, zip);
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="mariner-pro-link-project.zip"');
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('ZIP generation error:', err);
      res.status(500).json({ error: 'Failed to generate ZIP archive' });
    }
  });

  // Vite development middleware vs production static
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
