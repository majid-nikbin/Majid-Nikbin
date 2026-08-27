import express from 'express';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // Direct 1-Click ZIP Download API Endpoint
  app.get('/api/download-source-zip', async (req, res) => {
    try {
      const zip = new JSZip();
      const rootDir = process.cwd();

      function addDirToZip(dirPath: string, zipFolder: JSZip) {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
          if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
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
