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
