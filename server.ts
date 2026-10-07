import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = "";
const __dirname = process.cwd();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Marine Compass & NMEA Server running on port ${PORT}`);
});
