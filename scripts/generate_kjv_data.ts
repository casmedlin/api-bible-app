/* eslint-disable no-console */
import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = "/tmp/kjv/kjv.sqlite3";

interface VerseRow {
  book: string;
  verse: number;
  unformatted: string;
}

const BOOK_IDS: Record<string, number> = {
  Gen: 1, Exod: 2, Lev: 3, Num: 4, Deut: 5,
  Josh: 6, Judg: 7, Ruth: 8, "1Sam": 9, "2Sam": 10,
  "1Kgs": 11, "2Kgs": 12, "1Chr": 13, "2Chr": 14, Ezra: 15,
  Neh: 16, Esth: 17, Job: 18, Ps: 19, Prov: 20,
  Eccl: 21, Song: 22, Isa: 23, Jer: 24, Lam: 25,
  Ezek: 26, Dan: 27, Hos: 28, Joel: 29, Amos: 30,
  Obad: 31, Jonah: 32, Mic: 33, Nah: 34, Hab: 35,
  Zeph: 36, Hag: 37, Zech: 38, Mal: 39, Matt: 40,
  Mark: 41, Luke: 42, John: 43, Acts: 44, Rom: 45,
  "1Cor": 46, "2Cor": 47, Gal: 48, Eph: 49, Phil: 50,
  Col: 51, "1Thess": 52, "2Thess": 53, "1Tim": 54, "2Tim": 55,
  Titus: 56, Phlm: 57, Heb: 58, Jas: 59, "1Pet": 60,
  "2Pet": 61, "1John": 62, "2John": 63, "3John": 64, Jude: 65,
  Rev: 66,
};

function generate() {
  const db = new Database(DB_PATH);
  const rows = db.prepare("SELECT book, verse, unformatted FROM verses ORDER BY book, verse").all() as VerseRow[];

  const data: Record<string, Record<string, string[]>> = {};

  for (const row of rows) {
    const bookId = BOOK_IDS[row.book];
    if (!bookId) {
      console.warn(`Unknown book: ${row.book}`);
      continue;
    }
    const bookKey = String(bookId);
    const chapter = String(Math.floor(row.verse));
    const text = row.unformatted.trim();

    if (!data[bookKey]) {
      data[bookKey] = {};
    }
    if (!data[bookKey][chapter]) {
      data[bookKey][chapter] = [];
    }
    data[bookKey][chapter].push(text);
  }

  const dir = path.resolve(process.cwd(), "src", "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "kjv.json"), JSON.stringify(data));

  const chapterCount = Object.values(data).reduce((a, b) => a + Object.keys(b).length, 0);
  const verseCount = Object.values(data).reduce(
    (a, b) => a + Object.values(b).reduce((c, d) => c + d.length, 0),
    0,
  );
  console.log(`Saved KJV data to src/data/kjv.json`);
  console.log(`Books: ${Object.keys(data).length}, Chapters: ${chapterCount}, Verses: ${verseCount}`);

  db.close();
}

generate();
