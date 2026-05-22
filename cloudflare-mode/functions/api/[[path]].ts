const DATA_BASE =
  "https://raw.githubusercontent.com/casmedlin/api-bible-app/main/public/bibles";

const BOOK_NAMES: [string, string][] = [
  ["Gen", "Genesis"], ["Exod", "Exodus"], ["Lev", "Leviticus"],
  ["Num", "Numbers"], ["Deut", "Deuteronomy"], ["Josh", "Joshua"],
  ["Judg", "Judges"], ["Ruth", "Ruth"], ["1Sam", "1 Samuel"],
  ["2Sam", "2 Samuel"], ["1Kgs", "1 Kings"], ["2Kgs", "2 Kings"],
  ["1Chr", "1 Chronicles"], ["2Chr", "2 Chronicles"], ["Ezra", "Ezra"],
  ["Neh", "Nehemiah"], ["Esth", "Esther"], ["Job", "Job"],
  ["Ps", "Psalms"], ["Prov", "Proverbs"], ["Eccl", "Ecclesiastes"],
  ["Song", "Song of Solomon"], ["Isa", "Isaiah"], ["Jer", "Jeremiah"],
  ["Lam", "Lamentations"], ["Ezek", "Ezekiel"], ["Dan", "Daniel"],
  ["Hos", "Hosea"], ["Joel", "Joel"], ["Amos", "Amos"],
  ["Obad", "Obadiah"], ["Jonah", "Jonah"], ["Mic", "Micah"],
  ["Nah", "Nahum"], ["Hab", "Habakkuk"], ["Zephaniah", "Zephaniah"],
  ["Hag", "Haggai"], ["Zech", "Zechariah"], ["Mal", "Malachi"],
  ["Matt", "Matthew"], ["Mark", "Mark"], ["Luke", "Luke"],
  ["John", "John"], ["Acts", "Acts"], ["Rom", "Romans"],
  ["1Cor", "1 Corinthians"], ["2Cor", "2 Corinthians"], ["Gal", "Galatians"],
  ["Eph", "Ephesians"], ["Phil", "Philippians"], ["Col", "Colossians"],
  ["1Thess", "1 Thessalonians"], ["2Thess", "2 Thessalonians"], ["1Tim", "1 Timothy"],
  ["2Tim", "2 Timothy"], ["Titus", "Titus"], ["Phlm", "Philemon"],
  ["Heb", "Hebrews"], ["Jas", "James"], ["1Pet", "1 Peter"],
  ["2Pet", "2 Peter"], ["1John", "1 John"], ["2John", "2 John"],
  ["3John", "3 John"], ["Jude", "Jude"], ["Rev", "Revelation"],
];

const ALIASES: Record<string, number> = {};
for (let i = 0; i < BOOK_NAMES.length; i++) {
  const [short, full] = BOOK_NAMES[i];
  const n = i + 1;
  ALIASES[short.toLowerCase()] = n;
  ALIASES[full.toLowerCase()] = n;
  ALIASES[full.toLowerCase().replace(/ /g, "")] = n;
}

function resolveBook(input: string): number | null {
  if (/^\d+$/.test(input)) {
    const n = parseInt(input, 10);
    if (n >= 1 && n <= 66) return n;
  }
  return ALIASES[input.toLowerCase().replace(/\s+/g, "")] ?? null;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function jsonCached(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

type BibleData = {
  books: [string, number][];
  verses: Record<string, Record<string, string[]>>;
};

async function loadVersion(lang: string, code: string): Promise<BibleData | null> {
  const url = `${DATA_BASE}/${lang}/${code}.json`;
  const res = await fetch(url);
  if (res.status !== 200) return null;
  try {
    return (await res.json()) as BibleData;
  } catch {
    return null;
  }
}

function getChapter(data: BibleData, bookNum: number, chapterNum: number) {
  const bookKey = String(bookNum);
  const bookEntry = data.books[bookNum - 1];
  if (!bookEntry) return null;
  const chapters = data.verses[bookKey];
  if (!chapters) return null;
  const chapterKey = String(chapterNum);
  const verses = chapters[chapterKey];
  if (!verses) return null;
  return {
    book: bookEntry[0],
    bookNumber: bookNum,
    chapter: chapterNum,
    totalChapters: bookEntry[1],
    verses,
  };
}

function getBook(data: BibleData, bookNum: number) {
  const bookEntry = data.books[bookNum - 1];
  if (!bookEntry) return null;
  const bookKey = String(bookNum);
  const chapters = data.verses[bookKey];
  if (!chapters) return null;
  return {
    book: bookEntry[0],
    bookNumber: bookNum,
    totalChapters: bookEntry[1],
    chapters,
  };
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(date: Date): number {
  const h = date.getHours() << 11;
  const m = date.getMinutes() << 5;
  const s = Math.floor(date.getSeconds() / 2);
  return h | m | s;
}

function dosDate(date: Date): number {
  const y = (date.getFullYear() - 1980) << 9;
  const mo = (date.getMonth() + 1) << 5;
  const d = date.getDate();
  return y | mo | d;
}

function u32LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]);
}

function u16LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
}

function buildZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const now = new Date();
  const dt = dosDate(now);
  const tm = dosTime(now);
  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;
  const encoder = new TextEncoder();

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    local.set(u32LE(0x04034b50), 0);
    local.set(u16LE(20), 4);
    local.set(u16LE(0x0800), 6);
    local.set(u16LE(0), 8);
    local.set(u16LE(dt), 10);
    local.set(u16LE(tm), 12);
    local.set(u32LE(crc), 14);
    local.set(u32LE(size), 18);
    local.set(u32LE(size), 22);
    local.set(u16LE(nameBytes.length), 26);
    local.set(u16LE(0), 28);
    local.set(nameBytes, 30);
    localHeaders.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    central.set(u32LE(0x02014b50), 0);
    central.set(u16LE(20), 4);
    central.set(u16LE(20), 6);
    central.set(u16LE(0x0800), 8);
    central.set(u16LE(0), 10);
    central.set(u16LE(dt), 12);
    central.set(u16LE(tm), 14);
    central.set(u32LE(crc), 16);
    central.set(u32LE(size), 20);
    central.set(u32LE(size), 24);
    central.set(u16LE(nameBytes.length), 28);
    central.set(u16LE(0), 30);
    central.set(u16LE(0), 32);
    central.set(u16LE(0), 34);
    central.set(u16LE(0), 36);
    central.set(u32LE(0), 38);
    central.set(u32LE(offset), 42);
    central.set(nameBytes, 46);
    centralHeaders.push(central);
    offset += 30 + nameBytes.length + size;
  }

  const centralSize = centralHeaders.reduce((s, h) => s + h.length, 0);
  const eocd = new Uint8Array(22);
  eocd.set(u32LE(0x06054b50), 0);
  eocd.set(u16LE(0), 4);
  eocd.set(u16LE(0), 6);
  eocd.set(u16LE(entries.length), 8);
  eocd.set(u16LE(entries.length), 10);
  eocd.set(u32LE(centralSize), 12);
  eocd.set(u32LE(offset), 16);
  eocd.set(u16LE(0), 20);

  const parts = [...localHeaders, ...centralHeaders, eocd];
  const total = parts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const apiPath = url.pathname.replace(/^\/api\//, "");

  if (apiPath === "manifest" || apiPath === "manifest/") {
    const manifestUrl = `${DATA_BASE}/manifest.json`;
    const res = await fetch(manifestUrl);
    if (res.status !== 200) return json({ error: "Failed to load manifest" }, 500);
    return new Response(res.body, {
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  }

  // /api/download/:lang/:code
  if (apiPath.startsWith("download/")) {
    const segs = apiPath.slice(9).split("/");

    if (segs.length === 1) {
      const [lang] = segs;
      const manifestUrl = `${DATA_BASE}/manifest.json`;
      const manifestRes = await fetch(manifestUrl);
      if (manifestRes.status !== 200) return json({ error: "Failed to load manifest" }, 500);
      const manifest: Record<string, { label: string; versions: { code: string; label: string }[] }> = await manifestRes.json();
      const langInfo = manifest[lang];
      if (!langInfo) return json({ error: `Language "${lang}" not found` }, 404);

      const base = `${url.protocol}//${url.host}`;
      const versions = langInfo.versions.map((v: { code: string; label: string }) => {
        const code = v.code.split("/")[1];
        return { label: v.label, code, url: `${base}/api/download/${lang}/${code}` };
      });
      return jsonCached({ language: langInfo.label, code: lang, count: versions.length, versions });
    }

    if (segs.length === 2) {
      const [lang, code] = segs;
      const fileUrl = `${DATA_BASE}/${lang}/${code}.json`;
      const fileRes = await fetch(fileUrl);
      if (fileRes.status !== 200) return json({ error: `Bible version "${lang}/${code}" not found` }, 404);
      const buf = await fileRes.arrayBuffer();
      return new Response(buf, {
        headers: {
          "content-type": "application/json",
          "content-disposition": `attachment; filename="${lang}_${code}.json"`,
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }

    return json({ error: "Invalid download path" }, 400);
  }

  if (apiPath.startsWith("bibles/")) {
    const segs = apiPath.slice(7).split("/");

    if (segs.length === 4) {
      const [lang, code, bookInput, chapterInput] = segs;
      const bookNum = resolveBook(bookInput);
      if (!bookNum) return json({ error: `Invalid book "${bookInput}"` }, 400);
      const chapterNum = parseInt(chapterInput, 10);
      if (isNaN(chapterNum) || chapterNum < 1) return json({ error: "Invalid chapter number" }, 400);
      const data = await loadVersion(lang, code);
      if (!data) return json({ error: `Bible version "${lang}/${code}" not found` }, 404);
      const chapter = getChapter(data, bookNum, chapterNum);
      if (!chapter) return json({ error: `Chapter ${chapterNum} not found` }, 404);
      return jsonCached(chapter);
    }

    if (segs.length === 3) {
      const [lang, code, bookInput] = segs;
      const bookNum = resolveBook(bookInput);
      if (!bookNum) return json({ error: `Invalid book "${bookInput}"` }, 400);
      const data = await loadVersion(lang, code);
      if (!data) return json({ error: `Bible version "${lang}/${code}" not found` }, 404);
      const book = getBook(data, bookNum);
      if (!book) return json({ error: `Book ${bookNum} not found` }, 404);
      return jsonCached(book);
    }

    if (segs.length >= 2) {
      const [lang, code] = segs;
      const data = await loadVersion(lang, code);
      if (!data) return json({ error: `Bible version "${lang}/${code}" not found` }, 404);
      return jsonCached(data);
    }
  }

  return json({ error: "Not found" }, 404);
}
