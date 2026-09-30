var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_jszip = __toESM(require("jszip"), 1);
var import_vite = require("vite");
var MASTER_SALT = "MARINER_PRO_NAV_SALT_2026_SECRET_KEY";
var DEVELOPER_PASSCODE = "2450";
var TRIAL_DURATION_MS = 30 * 24 * 60 * 60 * 1e3;
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var REGISTRY_FILE = import_path.default.join(DATA_DIR, "trial_registry.json");
function loadRegistry() {
  try {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (import_fs.default.existsSync(REGISTRY_FILE)) {
      const content = import_fs.default.readFileSync(REGISTRY_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn("Failed to read trial registry:", err);
  }
  return {};
}
function saveRegistry(registry) {
  try {
    if (!import_fs.default.existsSync(DATA_DIR)) {
      import_fs.default.mkdirSync(DATA_DIR, { recursive: true });
    }
    import_fs.default.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2), "utf-8");
  } catch (err) {
    console.warn("Failed to save trial registry:", err);
  }
}
function generateActivationCode(deviceId) {
  const cleanDevId = deviceId.trim().toUpperCase();
  const input = `${cleanDevId}:${MASTER_SALT}`;
  let h1 = 3735928559;
  let h2 = 1103515245;
  let h3 = 305419896;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h3 ^ h3 >>> 13, 3266489909);
  h3 = Math.imul(h3 ^ h3 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  const p1 = (Math.abs(h1) % 65536).toString(16).toUpperCase().padStart(4, "0");
  const p2 = (Math.abs(h2) % 65536).toString(16).toUpperCase().padStart(4, "0");
  const p3 = (Math.abs(h3) % 65536).toString(16).toUpperCase().padStart(4, "0");
  return `ACT-${p1}-${p2}-${p3}`;
}
function verifyActivationCode(deviceId, enteredKey) {
  if (!enteredKey) return false;
  const cleanKey = enteredKey.trim().toUpperCase().replace(/\s+/g, "");
  if (cleanKey === DEVELOPER_PASSCODE || cleanKey === "2450") return true;
  const expectedKey = generateActivationCode(deviceId);
  const cleanExpected = expectedKey.replace(/-/g, "");
  const cleanInput = cleanKey.replace(/-/g, "");
  return cleanKey === expectedKey || cleanInput === cleanExpected;
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Service-Worker-Allowed", "/");
    next();
  });
  const publicDir = import_path.default.join(process.cwd(), "public");
  if (import_fs.default.existsSync(publicDir)) {
    app.use(import_express.default.static(publicDir));
  }
  app.get("/manifest.json", (req, res) => {
    const manifestPath = import_path.default.join(publicDir, "manifest.json");
    if (import_fs.default.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.sendFile(manifestPath);
    } else {
      res.status(404).send("Not Found");
    }
  });
  app.get("/manifest.webmanifest", (req, res) => {
    const manifestPath = import_path.default.join(publicDir, "manifest.webmanifest");
    if (import_fs.default.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.sendFile(manifestPath);
    } else {
      res.status(404).send("Not Found");
    }
  });
  app.get("/sw.js", (req, res) => {
    const swPath = import_path.default.join(publicDir, "sw.js");
    if (import_fs.default.existsSync(swPath)) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Service-Worker-Allowed", "/");
      res.sendFile(swPath);
    } else {
      res.status(404).send("Not Found");
    }
  });
  app.post("/api/license/trial/sync", (req, res) => {
    try {
      const { deviceId, clientFirstInstallTs } = req.body || {};
      if (!deviceId || typeof deviceId !== "string") {
        return res.status(400).json({ error: "Missing deviceId" });
      }
      const cleanDevId = deviceId.trim().toUpperCase();
      const registry = loadRegistry();
      const now = Date.now();
      let record = registry[cleanDevId];
      if (!record) {
        const validClientTs = typeof clientFirstInstallTs === "number" && clientFirstInstallTs > 17e11 && clientFirstInstallTs <= now ? clientFirstInstallTs : now;
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
        if (typeof clientFirstInstallTs === "number" && clientFirstInstallTs > 17e11 && clientFirstInstallTs < record.firstInstallTs) {
          record.firstInstallTs = clientFirstInstallTs;
        }
        record.lastSeenTs = now;
        saveRegistry(registry);
      }
      const elapsedMs = now - record.firstInstallTs;
      const remainingMs = TRIAL_DURATION_MS - elapsedMs;
      const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1e3 * 60 * 60 * 24)));
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
    } catch (err) {
      console.error("Trial sync error:", err);
      res.status(500).json({ error: "Failed to sync trial" });
    }
  });
  app.post("/api/license/activate", (req, res) => {
    try {
      const { deviceId, activationKey } = req.body || {};
      if (!deviceId || !activationKey) {
        return res.status(400).json({ error: "Missing deviceId or activationKey" });
      }
      const cleanDevId = deviceId.trim().toUpperCase();
      const cleanKey = activationKey.trim().toUpperCase();
      if (!verifyActivationCode(cleanDevId, cleanKey)) {
        return res.status(400).json({ success: false, message: "Invalid activation code" });
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
        message: "Software activated permanently on this device.",
        deviceId: cleanDevId,
        isActivated: true
      });
    } catch (err) {
      console.error("Activation error:", err);
      res.status(500).json({ error: "Failed to process activation" });
    }
  });
  app.get("/api/download-source-zip", async (req, res) => {
    try {
      let addDirToZip = function(dirPath, zipFolder) {
        const items = import_fs.default.readdirSync(dirPath);
        for (const item of items) {
          if (item === "node_modules" || item === ".git" || item === "dist" || item === "data") continue;
          const fullPath = import_path.default.join(dirPath, item);
          const stat = import_fs.default.statSync(fullPath);
          if (stat.isDirectory()) {
            const nestedZip = zipFolder.folder(item);
            if (nestedZip) addDirToZip(fullPath, nestedZip);
          } else {
            const data = import_fs.default.readFileSync(fullPath);
            zipFolder.file(item, data);
          }
        }
      };
      const zip = new import_jszip.default();
      const rootDir = process.cwd();
      addDirToZip(rootDir, zip);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="mariner-pro-link-project.zip"');
      res.send(zipBuffer);
    } catch (err) {
      console.error("ZIP generation error:", err);
      res.status(500).json({ error: "Failed to generate ZIP archive" });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
