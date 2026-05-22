import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

const PORT = parseInt(process.env.BIBLE_API_PORT || process.env.PORT || "3002", 10);
const DATA_DIR = path.resolve(__dirname, "../public/bibles");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the API landing page at the root
const LANDING_PAGE = path.resolve(__dirname, "../cloudflare-mode/index.html");
app.get("/", (_req, res) => {
  res.type("html").sendFile(LANDING_PAGE, (err) => {
    if (err) {
      res.status(200).send("Bible API is running. See /api/manifest for available versions.");
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/manifest", (_req, res) => {
  const filePath = path.join(DATA_DIR, "manifest.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json(manifest);
  } catch {
    res.status(500).json({ error: "Failed to load manifest" });
  }
});

app.get("/api/bibles/:lang/:code", (req, res) => {
  const { lang, code } = req.params;
  const filePath = path.join(DATA_DIR, lang, `${code}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json(data);
  } catch {
    res
      .status(404)
      .json({ error: `Bible version "${lang}/${code}" not found` });
  }
});

app.get("/api/bibles/:path(*)", (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.path}.json`);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    res.json(data);
  } catch {
    res
      .status(404)
      .json({ error: `Bible version "${req.params.path}" not found` });
  }
});

app.listen(PORT, () => {
  console.log(`Bible API server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
