# Bible API

Free, public JSON API serving **196 Bible translations** across **80+ languages**. No API key required. No rate limits.

Built on data from [OfflineBible-Data](https://github.com/Jaden-J/OfflineBible-Data) by [Jaden-J](https://github.com/Jaden-J).

---

## Quick Start

```bash
# Fetch KJV Genesis chapter 1 (by book number)
curl https://apibible.wbem.org/api/bibles/en/kjv/1/1

# Same chapter using book name
curl https://apibible.wbem.org/api/bibles/en/kjv/gen/1

# Fetch whole book of Psalms
curl https://apibible.wbem.org/api/bibles/en/kjv/ps/19

# Get the full list of available versions
curl https://apibible.wbem.org/api/manifest
```

## API Reference

### `GET /health`
Returns `{ "status": "ok" }`.

### `GET /api/manifest`
Returns the full manifest of all available languages and Bible versions. Languages are keyed by ISO language code; each contains a `label` and array of `versions`.

**Response shape:**
```json
{
  "en": {
    "label": "English",
    "versions": [
      { "code": "en/kjv", "label": "English — kjv" },
      { "code": "en/esv", "label": "English — esv" }
    ]
  }
}
```

### `GET /api/bibles/:lang/:code`
Fetch an entire Bible version. The response is a JSON object with `books` (array of `[name, chapter_count]`) and `verses` (keyed by book number → chapter number → verse array).

**Example:** `/api/bibles/en/kjv`

### `GET /api/bibles/:lang/:code/:book`
Fetch a single book (all chapters). `:book` accepts a book number (1–66) or name (`gen`, `exod`, `ps`, `matt`, etc.).

**Example:** `/api/bibles/en/kjv/gen` returns all chapters of Genesis from KJV.

### `GET /api/bibles/:lang/:code/:book/:chapter`
Fetch a single chapter's verses.

**Example:** `/api/bibles/en/esv/gen/1` returns ESV Genesis chapter 1. Also works with book numbers: `/api/bibles/en/kjv/1/1`.

### `GET /api/bibles/:path`
Flat-path access (legacy). Only works for full version files.

### Data Format
```json
{
  "books": [
    ["Gen", 50],
    ["Exod", 40]
  ],
  "verses": {
    "1": {
      "1": ["In the beginning God created the heaven and the earth."],
      "2": ["And the earth was without form, and void..."]
    }
  }
}
```
- `books` — array of `[bookName, chapterCount]` tuples, in canonical order
- `verses` — object keyed by book number (1-based) → chapter number → array of verse strings

### Available English Versions

| Version | Code | Endpoint |
|---|---|---|
| King James Version | `kjv` | `/api/bibles/en/kjv` |
| New International Version (2011) | `niv2011` | `/api/bibles/en/niv2011` |
| English Standard Version | `esv` | `/api/bibles/en/esv` |
| New Living Translation | `nlt` | `/api/bibles/en/nlt` |
| New American Standard Bible | `nasb` | `/api/bibles/en/nasb` |
| American Standard Version | `asv` | `/api/bibles/en/asv` |
| World English Bible | `web` | `/api/bibles/en/web` |
| Young's Literal Translation | `ylt` | `/api/bibles/en/ylt` |
| And 50+ more... | | |

See `/api/manifest` for all 196 versions across all 80+ languages.

---

## Deployment

Two deployment modes are supported.

### Option A: Node.js / Express (VPS or local)

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or with auto-reload for development
npm run dev
```

The server listens on the port from `BIBLE_API_PORT` env var (default `3002`).

### Option B: Cloudflare Pages (recommended)

The `cloudflare-mode/` directory is pre-configured for Cloudflare Pages with Functions (edge workers).

```bash
cd cloudflare-mode

# Install
npm install

# Build (copies bible data from public/bibles/)
npm run build

# Deploy to Cloudflare Pages
npm run deploy

# Local preview
npm run dev
```

**First time deploy?** Run `wrangler login` to authenticate, then `npm run deploy`. The dashboard URL will be shown after deployment.

### Cloudflare Pages Configuration

- `wrangler.toml` — project name and compatibility date
- `_headers` — CORS, caching, and security headers
- `_redirects` — URL redirects
- `functions/api/[[path]].ts` — edge function that serves bible data from static assets with proper headers

---

## Project Structure

```
├── src/
│   └── index.ts              # Express API server
├── public/
│   └── bibles/               # Canonical bible data (gitignored)
├── cloudflare-mode/
│   ├── wrangler.toml          # CF Pages config
│   ├── _headers               # Custom HTTP headers
│   ├── _redirects             # URL redirect rules
│   ├── index.html             # SEO-optimized landing page
│   ├── functions/
│   │   └── api/[[path]].ts    # Cloudflare Functions handler
│   └── bibles/                # Generated copy (gitignored)
├── scripts/
│   ├── generate_bible_data.ts
│   └── generate_kjv_data.ts
├── package.json
└── tsconfig.json
```

---

## SEO

The root page (`/`) is an optimized HTML landing page that includes:

- **Semantic HTML5** — proper heading hierarchy, nav, main, footer
- **Meta tags** — title, description, keywords, author, robots
- **Open Graph** — `og:title`, `og:description`, `og:type`, `og:url`, `og:locale`
- **Twitter Card** — `twitter:card`, `twitter:title`, `twitter:description`
- **JSON-LD structured data** — WebAPI schema for rich search results
- **Canonical URL** — prevents duplicate content issues
- **Viewport & mobile-friendly** — responsive design
- **Fast loading** — zero external dependencies, inline CSS, no framework overhead

---

## Development

```bash
# Type check
npx tsc --noEmit

# Generate bible data (from OfflineBible-Data source)
npm run generate-data
```

---

## License

Data sourced from [OfflineBible-Data](https://github.com/Jaden-J/OfflineBible-Data) by [Jaden-J](https://github.com/Jaden-J). The API server code is available under the MIT license.
