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
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
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
  app.get("/api/download-source-zip", async (req, res) => {
    try {
      let addDirToZip = function(dirPath, zipFolder) {
        const items = import_fs.default.readdirSync(dirPath);
        for (const item of items) {
          if (item === "node_modules" || item === ".git" || item === "dist") continue;
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
