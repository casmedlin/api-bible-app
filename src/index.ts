import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { resolveBook, getChapter, getBook, buildZip, type BibleData } from "./bible";

const PORT = parseInt(
  process.env.BIBLE_API_PORT || process.env.PORT || "3002",
  10,
);
const DATA_DIR = path.resolve(__dirname, "../public/bibles");

const app = express();
app.use(cors());
app.use(express.json());

const LANDING_PAGE = path.resolve(__dirname, "../cloudflare-mode/index.html");
app.get("/", (_req, res) => {
  res.type("html").sendFile(LANDING_PAGE, (err) => {
    if (err) {
      res
        .status(200)
        .send(
          "Bible API is running. See /api/manifest for available versions.",
        );
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

function loadVersion(lang: string, code: string): BibleData | null {
  const filePath = path.join(DATA_DIR, lang, `${code}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// /api/bibles/:lang/:code/:book/:chapter
app.get(
  "/api/bibles/:lang/:code/:book/:chapter",
  (req, res) => {
    const { lang, code } = req.params;
    const bookNum = resolveBook(req.params.book);
    if (!bookNum) {
      res.status(400).json({ error: `Invalid book "${req.params.book}"` });
      return;
    }
    const chapterNum = parseInt(req.params.chapter, 10);
    if (isNaN(chapterNum) || chapterNum < 1) {
      res.status(400).json({ error: "Invalid chapter number" });
      return;
    }
    const data = loadVersion(lang, code);
    if (!data) {
      res
        .status(404)
        .json({ error: `Bible version "${lang}/${code}" not found` });
      return;
    }
    const chapter = getChapter(data, bookNum, chapterNum);
    if (!chapter) {
      res.status(404).json({
        error: `Chapter ${chapterNum} not found in book ${bookNum}`,
      });
      return;
    }
    res.json(chapter);
  },
);

// /api/bibles/:lang/:code/:book
app.get(
  "/api/bibles/:lang/:code/:book",
  (req, res) => {
    const { lang, code } = req.params;
    const bookNum = resolveBook(req.params.book);
    if (!bookNum) {
      res.status(400).json({ error: `Invalid book "${req.params.book}"` });
      return;
    }
    const data = loadVersion(lang, code);
    if (!data) {
      res
        .status(404)
        .json({ error: `Bible version "${lang}/${code}" not found` });
      return;
    }
    const book = getBook(data, bookNum);
    if (!book) {
      res.status(404).json({ error: `Book ${bookNum} not found` });
      return;
    }
    res.json(book);
  },
);

// /api/bibles/:lang/:code
app.get("/api/bibles/:lang/:code", (req, res) => {
  const { lang, code } = req.params;
  const data = loadVersion(lang, code);
  if (!data) {
    res
      .status(404)
      .json({ error: `Bible version "${lang}/${code}" not found` });
    return;
  }
  res.json(data);
});

// /api/bibles/:path(*) - catch-all for flat paths
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

// /api/download/:lang/:code - single version download
app.get("/api/download/:lang/:code", (req, res) => {
  const { lang, code } = req.params;
  const filePath = path.join(DATA_DIR, lang, `${code}.json`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: `Bible version "${lang}/${code}" not found` });
    return;
  }
  const fileName = `${lang}_${code}.json`;
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Type", "application/json");
  fs.createReadStream(filePath).pipe(res);
});

// /api/download/:lang - download all versions in a language as ZIP
app.get("/api/download/:lang", (req, res) => {
  const { lang } = req.params;
  const langDir = path.join(DATA_DIR, lang);
  if (!fs.existsSync(langDir) || !fs.statSync(langDir).isDirectory()) {
    res.status(404).json({ error: `Language "${lang}" not found` });
    return;
  }
  const files = fs.readdirSync(langDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    res.status(404).json({ error: `No versions found for language "${lang}"` });
    return;
  }
  const entries = files.map((f) => ({
    name: `${lang}/${f}`,
    data: fs.readFileSync(path.join(langDir, f)),
  }));
  const zip = buildZip(entries);
  const fileName = `bibles_${lang}.zip`;
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Content-Type", "application/zip");
  res.send(Buffer.from(zip));
});

app.listen(PORT, () => {
  console.log(`Bible API server running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
