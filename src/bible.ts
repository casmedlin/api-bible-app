const BOOK_NAMES: [string, string][] = [
  ["Gen", "Genesis"],
  ["Exod", "Exodus"],
  ["Lev", "Leviticus"],
  ["Num", "Numbers"],
  ["Deut", "Deuteronomy"],
  ["Josh", "Joshua"],
  ["Judg", "Judges"],
  ["Ruth", "Ruth"],
  ["1Sam", "1 Samuel"],
  ["2Sam", "2 Samuel"],
  ["1Kgs", "1 Kings"],
  ["2Kgs", "2 Kings"],
  ["1Chr", "1 Chronicles"],
  ["2Chr", "2 Chronicles"],
  ["Ezra", "Ezra"],
  ["Neh", "Nehemiah"],
  ["Esth", "Esther"],
  ["Job", "Job"],
  ["Ps", "Psalms"],
  ["Prov", "Proverbs"],
  ["Eccl", "Ecclesiastes"],
  ["Song", "Song of Solomon"],
  ["Isa", "Isaiah"],
  ["Jer", "Jeremiah"],
  ["Lam", "Lamentations"],
  ["Ezek", "Ezekiel"],
  ["Dan", "Daniel"],
  ["Hos", "Hosea"],
  ["Joel", "Joel"],
  ["Amos", "Amos"],
  ["Obad", "Obadiah"],
  ["Jonah", "Jonah"],
  ["Mic", "Micah"],
  ["Nah", "Nahum"],
  ["Hab", "Habakkuk"],
  ["Zephaniah", "Zephaniah"],
  ["Hag", "Haggai"],
  ["Zech", "Zechariah"],
  ["Mal", "Malachi"],
  ["Matt", "Matthew"],
  ["Mark", "Mark"],
  ["Luke", "Luke"],
  ["John", "John"],
  ["Acts", "Acts"],
  ["Rom", "Romans"],
  ["1Cor", "1 Corinthians"],
  ["2Cor", "2 Corinthians"],
  ["Gal", "Galatians"],
  ["Eph", "Ephesians"],
  ["Phil", "Philippians"],
  ["Col", "Colossians"],
  ["1Thess", "1 Thessalonians"],
  ["2Thess", "2 Thessalonians"],
  ["1Tim", "1 Timothy"],
  ["2Tim", "2 Timothy"],
  ["Titus", "Titus"],
  ["Phlm", "Philemon"],
  ["Heb", "Hebrews"],
  ["Jas", "James"],
  ["1Pet", "1 Peter"],
  ["2Pet", "2 Peter"],
  ["1John", "1 John"],
  ["2John", "2 John"],
  ["3John", "3 John"],
  ["Jude", "Jude"],
  ["Rev", "Revelation"],
];

const ALIASES: Record<string, number> = {};
for (let i = 0; i < BOOK_NAMES.length; i++) {
  const [short, full] = BOOK_NAMES[i];
  const n = i + 1;
  ALIASES[short.toLowerCase()] = n;
  ALIASES[full.toLowerCase()] = n;
  ALIASES[full.toLowerCase().replace(/ /g, "")] = n;
}

export function resolveBook(input: string): number | null {
  if (/^\d+$/.test(input)) {
    const n = parseInt(input, 10);
    if (n >= 1 && n <= 66) return n;
  }
  return ALIASES[input.toLowerCase().replace(/\s+/g, "")] ?? null;
}

export type BibleData = {
  books: [string, number][];
  verses: Record<string, Record<string, string[]>>;
};

export function getChapter(
  data: BibleData,
  bookNum: number,
  chapterNum: number,
) {
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

export function getBook(data: BibleData, bookNum: number) {
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

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function u32LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff]);
}

function u16LE(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
}

export type ZipEntry = { name: string; data: Uint8Array };

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const now = new Date();
  const dt = dosDate(now);
  const tm = dosTime(now);

  const localHeaders: Uint8Array[] = [];
  const centralHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = utf8Encode(entry.name);
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
