interface Env {
  ASSETS: Fetcher;
}

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
    headers: { "content-type": "application/json" },
  });
}

function jsonCors(data: unknown, cache: string): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": cache,
    },
  });
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const apiPath = url.pathname.replace(/^\/api\//, "");

  // /api/manifest
  if (apiPath === "manifest" || apiPath === "manifest/") {
    return serveStatic("/bibles/manifest.json", env, url.origin);
  }

  // /api/bibles/...
  if (apiPath.startsWith("bibles/")) {
    const segs = apiPath.slice(7).split("/");

    // /api/bibles/:lang/:code/:book/:chapter
    if (segs.length === 4) {
      const [lang, code, bookInput, chapterInput] = segs;
      const bookNum = resolveBook(bookInput);
      if (!bookNum) return json({ error: `Invalid book "${bookInput}"` }, 400);
      const chapterNum = parseInt(chapterInput, 10);
      if (isNaN(chapterNum) || chapterNum < 1)
        return json({ error: "Invalid chapter number" }, 400);

      const data = await loadVersion(lang, code, env, url.origin);
      if (!data)
        return json(
          { error: `Bible version "${lang}/${code}" not found` },
          404,
        );
      const chapter = getChapter(data, bookNum, chapterNum);
      if (!chapter)
        return json(
          { error: `Chapter ${chapterNum} not found in book ${bookNum}` },
          404,
        );
      return jsonCors(chapter, "public, max-age=31536000, immutable");
    }

    // /api/bibles/:lang/:code/:book
    if (segs.length === 3) {
      const [lang, code, bookInput] = segs;
      const bookNum = resolveBook(bookInput);
      if (!bookNum) return json({ error: `Invalid book "${bookInput}"` }, 400);

      const data = await loadVersion(lang, code, env, url.origin);
      if (!data)
        return json(
          { error: `Bible version "${lang}/${code}" not found` },
          404,
        );
      const book = getBook(data, bookNum);
      if (!book)
        return json({ error: `Book ${bookNum} not found` }, 404);
      return jsonCors(book, "public, max-age=31536000, immutable");
    }

    // /api/bibles/:lang/:code or /api/bibles/:path (fallback)
    return serveStatic(
      `/bibles/${apiPath.slice(7)}.json`,
      env,
      url.origin,
      apiPath,
    );
  }

  return json({ error: "Not found" }, 404);
}

async function loadVersion(
  lang: string,
  code: string,
  env: Env,
  origin: string,
) {
  const res = await env.ASSETS.fetch(
    new URL(`/bibles/${lang}/${code}.json`, origin),
  );
  if (res.status !== 200) return null;
  try {
    return (await res.json()) as BibleData;
  } catch {
    return null;
  }
}

async function serveStatic(
  staticPath: string,
  env: Env,
  origin: string,
  apiPath?: string,
): Promise<Response> {
  try {
    const assetUrl = new URL(staticPath, origin);
    const response = await env.ASSETS.fetch(assetUrl);
    if (response.status === 200) {
      return new Response(response.body, {
        headers: {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch {}
  return json(
    { error: `Bible version "${apiPath || staticPath}" not found` },
    404,
  );
}

type BibleData = {
  books: [string, number][];
  verses: Record<string, Record<string, string[]>>;
};

function getChapter(
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
