/* eslint-disable no-console */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import Database from "better-sqlite3";

const BASE = "https://github.com/Jaden-J/OfflineBible-Data/raw/master";
const TMP = "/tmp/bible-data";
const OUTPUT = path.resolve(process.cwd(), "public", "bibles");
const CACHE = path.resolve(process.cwd(), ".bible-cache");

interface VerseRow {
  book: string;
  verse: number;
  unformatted: string;
}

const LANG_LABELS: Record<string, string> = {
  af: "Afrikaans",
  akp: "Akposso",
  ar: "Arabic",
  bc: "Bacama",
  btx: "Batak Karo",
  cb: "Cebuano",
  cnh: "Chin (Hakha)",
  cy: "Cheyenne",
  de: "German",
  dt: "Ditammari",
  en: "English",
  es: "Spanish",
  fi: "Finnish",
  fj: "Fijian",
  fr: "French",
  grc: "Greek (Ancient)",
  ha: "Hausa",
  he: "Hebrew",
  hi: "Hindi",
  hl: "Hmong (Lus)",
  hr: "Croatian",
  ht: "Haitian Creole",
  ib: "Iban",
  id: "Indonesian",
  ig: "Igbo",
  il: "Ilocano",
  it: "Italian",
  ja: "Japanese",
  jr: "Jarai",
  kj: "Kwangali",
  kp: "Kpelle",
  kr: "Karaboro",
  la: "Latin",
  lg: "Luganda",
  mi: "Maori",
  ml: "Malayalam",
  mr: "Marathi",
  ms: "Malay",
  my: "Burmese",
  nb: "Norwegian (Bokmål)",
  ne: "Nepali",
  ng: "Ndonga",
  nl: "Dutch",
  no: "Norwegian",
  ns: "Nsenga",
  ny: "Nyanja (Chichewa)",
  nyn: "Nyankole",
  nz: "Nzema",
  or: "Oriya",
  pa: "Punjabi",
  pg: "Papua New Guinea",
  pl: "Polish",
  pm: "Pampanga",
  pt: "Portuguese",
  ro: "Romanian",
  ru: "Russian",
  rw: "Kinyarwanda",
  sk: "Slovak",
  smk: "Sambal",
  sn: "Shona",
  so: "Somali",
  sp: "Sango",
  ss: "Swati",
  sw: "Swahili",
  ta: "Tamil",
  te: "Telugu",
  th: "Thai",
  tl: "Tagalog",
  tn: "Tswana",
  to: "Tonga",
  tr: "Turkish",
  ts: "Tsonga",
  tw: "Twi",
  ur: "Urdu",
  ve: "Venda",
  vi: "Vietnamese",
  xh: "Xhosa",
  yo: "Yoruba",
  zh: "Chinese",
  zo: "Zou",
  zu: "Zulu",
};

function getVersionLabel(lang: string, version: string): string {
  return `${LANG_LABELS[lang] || lang} — ${version}`;
}

async function downloadZip(zipFileName: string): Promise<string> {
  const zipPath = path.join(CACHE, zipFileName);
  if (fs.existsSync(zipPath)) {
    return zipPath;
  }

  const url = `${BASE}/${zipFileName}`;
  console.log(`  downloading ${zipFileName}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  fs.mkdirSync(CACHE, { recursive: true });
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(zipPath, buf);
  return zipPath;
}

function extractSqlite(zipPath: string, zipFileName: string): string {
  const dirName = zipFileName.replace(".zip", "");
  const dirPath = path.join(TMP, dirName);
  const cacheDbPath = path.join(TMP, `${dirName}.sqlite3`);

  if (fs.existsSync(cacheDbPath)) return cacheDbPath;

  fs.mkdirSync(dirPath, { recursive: true });

  // Check if already extracted
  let found = fs.readdirSync(dirPath).find(
    (f) => f.endsWith(".sqlite3") || f.endsWith(".db"),
  );
  if (found) {
    const fp = path.join(dirPath, found);
    fs.renameSync(fp, cacheDbPath);
    return cacheDbPath;
  }

  execSync(`unzip -o "${zipPath}" -d "${dirPath}"`, { stdio: "pipe" });

  found = fs.readdirSync(dirPath).find(
    (f) => f.endsWith(".sqlite3") || f.endsWith(".db"),
  );
  if (found) {
    const fp = path.join(dirPath, found);
    fs.renameSync(fp, cacheDbPath);
    return cacheDbPath;
  }

  // Check subdirectories
  const subdirs = fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  for (const subdir of subdirs) {
    const subPath = path.join(dirPath, subdir.name);
    found = fs.readdirSync(subPath).find(
      (f) => f.endsWith(".sqlite3") || f.endsWith(".db"),
    );
    if (found) {
      const fp = path.join(subPath, found);
      fs.renameSync(fp, cacheDbPath);
      return cacheDbPath;
    }
  }

  throw new Error(`No SQLite found in ${dirPath}`);
}

const CANON_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
  "Mark", "Luke", "John", "Acts", "Romans",
  "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
  "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy",
  "Titus", "Philemon", "Hebrews", "James", "1 Peter",
  "2 Peter", "1 John", "2 John", "3 John", "Jude",
  "Revelation",
];

const BOOK_ABBR_TO_ID: Record<string, number> = {
  Gen: 1, Exod: 2, Lev: 3, Num: 4, Deut: 5, Josh: 6, Judg: 7, Ruth: 8,
  "1Sam": 9, "2Sam": 10, "1Kgs": 11, "2Kgs": 12, "1Chr": 13, "2Chr": 14,
  Ezra: 15, Neh: 16, Esth: 17, Job: 18, Ps: 19, Prov: 20, Eccl: 21,
  Song: 22, Isa: 23, Jer: 24, Lam: 25, Ezek: 26, Dan: 27, Hos: 28,
  Joel: 29, Amos: 30, Obad: 31, Jonah: 32, Mic: 33, Nah: 34, Hab: 35,
  Zeph: 36, Hag: 37, Zech: 38, Mal: 39, Matt: 40, Mark: 41, Luke: 42,
  John: 43, Acts: 44, Rom: 45, "1Cor": 46, "2Cor": 47, Gal: 48, Eph: 49,
  Phil: 50, Col: 51, "1Thess": 52, "2Thess": 53, "1Tim": 54, "2Tim": 55,
  Titus: 56, Phlm: 57, Heb: 58, Jas: 59, "1Pet": 60, "2Pet": 61,
  "1John": 62, "2John": 63, "3John": 64, Jude: 65, Rev: 66,
};

function convertToJson(
  dbPath: string,
): {
  books: [string, number][];
  verses: Record<string, Record<string, string[]>>;
} {
  const db = new Database(dbPath);

  // Check for books table
  const tableInfo = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table'",
    )
    .all() as { name: string }[];

  const hasBooksTable = tableInfo.some((t) =>
    ["books", "book", "book_names"].includes(t.name.toLowerCase()),
  );

  const bookNameForAbbr: Record<string, string> = {};

  if (hasBooksTable) {
    const booksTable = tableInfo.find((t) =>
      ["books", "book", "book_names"].includes(t.name.toLowerCase()),
    );
    if (booksTable) {
      const rows = db.prepare(
        `SELECT * FROM "${booksTable.name}" ORDER BY number`,
      ).all() as Record<string, unknown>[];
      for (const r of rows) {
        const abbr = String(r.name || "");
        const name = String(
          r.human || r.name || r.book_name || r.title || r.local_name || "",
        );
        if (abbr) bookNameForAbbr[abbr] = name;
      }
    }
  }

  const rows = db
    .prepare(
      "SELECT book, verse, unformatted FROM verses ORDER BY book, verse",
    )
    .all() as VerseRow[];

  const uniqueBooks: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!seen.has(row.book)) {
      seen.add(row.book);
      uniqueBooks.push(row.book);
    }
  }

  const books: [string, number][] = [];
  const chapterSet = new Set<string>();
  const chapterCounts: Record<string, Set<string>> = {};
  let bookIndex = 0;
  let currentBook = "";

  for (const row of rows) {
    if (row.book !== currentBook) {
      if (currentBook && bookIndex > 0) {
        books[bookIndex - 1] = [
          books[bookIndex - 1]?.[0] || currentBook,
          chapterSet.size,
        ];
      }
      currentBook = row.book;
      chapterSet.clear();
      bookIndex =
        BOOK_ABBR_TO_ID[currentBook] ??
        uniqueBooks.indexOf(currentBook) + 1;
      if (!chapterCounts[String(bookIndex)]) {
        chapterCounts[String(bookIndex)] = new Set();
      }
    }
    const chapter = String(Math.floor(row.verse));
    chapterSet.add(chapter);
    if (chapterCounts[String(bookIndex)]) {
      chapterCounts[String(bookIndex)]?.add(chapter);
    }
  }
  if (currentBook && bookIndex > 0) {
    const name =
      bookNameForAbbr[currentBook] ||
      CANON_BOOKS[bookIndex - 1] ||
      currentBook;
    books[bookIndex - 1] = [name, chapterSet.size];
  }

  const verses: Record<string, Record<string, string[]>> = {};
  for (const row of rows) {
    const bookId = String(
      BOOK_ABBR_TO_ID[row.book] ?? uniqueBooks.indexOf(row.book) + 1,
    );
    const chapter = String(Math.floor(row.verse));
    const text = (row.unformatted || "").trim();
    if (!text) continue;

    if (!verses[bookId]) verses[bookId] = {};
    if (!verses[bookId][chapter]) verses[bookId][chapter] = [];
    verses[bookId][chapter].push(text);
  }

  db.close();

  // Fix chapter counts
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    if (book) {
      const bid = String(i + 1);
      const chapters = verses[bid];
      if (chapters) {
        books[i] = [book[0], Object.keys(chapters).length];
      }
    }
  }

  return { books, verses };
}

async function getAllZips(): Promise<{ lang: string; zip: string }[]> {
  // Use GitHub API to list all zip files
  const resp = await fetch(
    "https://api.github.com/repos/Jaden-J/OfflineBible-Data/git/trees/master?recursive=1",
  );
  const data = (await resp.json()) as { tree: { path: string }[] };

  const zips: { lang: string; zip: string }[] = [];
  for (const item of data.tree) {
    if (!item.path.endsWith(".zip")) continue;
    const rest = item.path.slice("bibledata-".length, -".zip".length);
    const parts = rest.split("-");
    if (parts.length >= 2 && parts[0]) {
      const lang = parts[0];
      zips.push({ lang, zip: item.path });
    }
  }
  return zips;
}

async function main() {
  console.log("Fetching zip list from GitHub...");
  const allZips = await getAllZips();
  console.log(`Found ${allZips.length} zip files across ${new Set(allZips.map(z => z.lang)).size} languages\n`);

  fs.mkdirSync(OUTPUT, { recursive: true });

  // Group manifest by language
  const manifest: Record<string, { label: string; versions: { code: string; label: string }[] }> = {};

  for (const { lang, zip } of allZips) {
    const rest = zip.slice("bibledata-".length, -".zip".length);
    const parts = rest.split("-");
    const code = parts.slice(1).join("-");

    const langDir = path.join(OUTPUT, lang);
    const outPath = path.join(langDir, `${code}.json`);

    if (fs.existsSync(outPath)) {
      const json = JSON.parse(fs.readFileSync(outPath, "utf-8"));
      const books = json.books as [string, number][];
      const verses = json.verses as Record<string, Record<string, string[]>>;
      const bookCount = books.length;
      const chapterCount = books.reduce((a: number, b: [string, number]) => a + b[1], 0);
      const verseCount = Object.values(verses).reduce(
        (a: number, b: Record<string, string[]>) =>
          a + Object.values(b).reduce((c: number, d: string[]) => c + d.length, 0),
        0,
      );
      console.log(`[skip] ${lang}/${code} — ${bookCount}b/${chapterCount}c/${verseCount}v`);
    } else {
      console.log(`[process] ${lang}/${code}...`);
      try {
        const zipPath = await downloadZip(zip);
        const dbPath = extractSqlite(zipPath, zip);
        const { books, verses } = convertToJson(dbPath);
        fs.mkdirSync(langDir, { recursive: true });
        fs.writeFileSync(outPath, JSON.stringify({ books, verses }));

        const bookCount = books.length;
        const chapterCount = books.reduce((a, b) => a + b[1], 0);
        const verseCount = Object.values(verses).reduce(
          (a, b) => a + Object.values(b).reduce((c, d) => c + d.length, 0),
          0,
        );
        console.log(`  -> ${bookCount}b/${chapterCount}c/${verseCount}v`);
      } catch (err) {
        console.error(`  FAILED: ${err}`);
        continue;
      }
    }

    if (!manifest[lang]) {
      manifest[lang] = { label: LANG_LABELS[lang] || lang, versions: [] };
    }
    manifest[lang].versions.push({
      code: `${lang}/${code}`,
      label: getVersionLabel(lang, code),
    });
  }

  // Write grouped manifest for webpack/dev server
  fs.writeFileSync(
    path.join(OUTPUT, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );
  // Also write to src/data so it can be imported directly (bundled with app.js)
  fs.writeFileSync(
    path.resolve(process.cwd(), "src", "data", "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const totalVersions = Object.values(manifest).reduce(
    (a, b) => a + b.versions.length,
    0,
  );
  const totalSize = fs
    .readdirSync(OUTPUT, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".json"))
    .reduce((a, d) => a + fs.statSync(path.join(d.parentPath, d.name)).size, 0);
  console.log(
    `\nDone. ${Object.keys(manifest).length} languages, ${totalVersions} versions, ${(totalSize / 1024 / 1024).toFixed(0)}MB`,
  );
}

main().catch(console.error);
