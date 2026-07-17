# Personal AI Knowledge Assistant

Upload your files (PDF, DOCX, TXT/MD, CSV, XLSX, images), let the app parse and
index them, then chat with the content. Answers are strictly grounded in your
uploaded files and cite the file (and page/sheet where possible) they came
from. If nothing relevant is found, it says so instead of answering from
general knowledge.

## Run it

```bash
npm install
# copy .env.example to .env, set APP_PASSWORD and ANTHROPIC_API_KEY
npm run dev
```

- Backend: http://localhost:8787 (Express + SQLite + local vector search)
- Frontend dev server: http://localhost:5173 (proxies /api to the backend)

For a production-style single process (backend serves the built UI):

```bash
npm run build
npm start        # everything on http://localhost:8787
```

## Configuration (.env)

| Variable | Purpose |
|---|---|
| `APP_PASSWORD` | Login password (required) |
| `ANTHROPIC_API_KEY` | Enables chat answers + image/scanned-PDF OCR (required for chat) |
| `CHAT_MODEL` | Default `claude-sonnet-5` |
| `OCR_MODEL` | Vision model for images/scanned PDFs, default `claude-haiku-4-5-20251001` |
| `STORAGE_DRIVER` | `local` (default, blobs under `data/blobs`) or `s3` |
| `S3_*` | Endpoint/bucket/credentials for any S3-compatible provider (R2, B2, MinIO, AWS) |

## How it works

- **Ingestion** ([server/src/ingest/](server/src/ingest/)): text PDFs via
  `unpdf` (per-page), scanned PDFs and images via Claude vision, DOCX via
  `mammoth`, CSV/XLSX via SheetJS (per-sheet). Chunks of ~1200 chars with
  overlap, each keeping its source location.
- **Embeddings** ([server/src/embeddings.ts](server/src/embeddings.ts)): local
  `all-MiniLM-L6-v2` via transformers.js — no API needed; the model (~90MB)
  downloads to `.model-cache/` on first run.
- **Retrieval** ([server/src/retrieval.ts](server/src/retrieval.ts)):
  brute-force cosine similarity in SQLite; results below a relevance threshold
  are discarded, and an empty result short-circuits to a "not found" reply
  without calling the LLM.
- **Chat** ([server/src/routes/chat.ts](server/src/routes/chat.ts)): Claude
  answers only from retrieved excerpts, cites them as [1]/[2], and returns
  "not found" if the excerpts don't cover the question.
- Re-uploading a file with the same name **replaces** the old version and its
  index. Deleting `data/` resets everything (files, index, chat history).
