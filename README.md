# Personal AI Knowledge Assistant

Upload your files (PDF, DOCX, TXT/MD, CSV, XLSX, images), let the app parse and
index them, then chat with the content. Answers are strictly grounded in your
uploaded files and cite the file (and page/sheet where possible) they came
from. If nothing relevant is found, it says so instead of answering from
general knowledge.

## Run it

```bash
npm install
# copy .env.example to .env and set APP_PASSWORD
# install Ollama (https://ollama.com), then: ollama pull llama3.1
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
| `OLLAMA_URL` | Local Ollama server for chat, default `http://127.0.0.1:11434` |
| `OLLAMA_CHAT_MODEL` | Model to chat with, default `llama3.1` (`ollama pull` it first) |
| `STORAGE_DRIVER` | `local` (default, blobs under `data/blobs`) or `s3` |
| `S3_*` | Endpoint/bucket/credentials for any S3-compatible provider (R2, B2, MinIO, AWS) |

Image/scanned-PDF OCR runs locally via Tesseract — no configuration needed.

## How it works

- **Ingestion** ([server/src/ingest/](server/src/ingest/)): text PDFs via
  `unpdf` (per-page), scanned PDFs and images via local Tesseract OCR
  ([server/src/ocr.ts](server/src/ocr.ts), rasterizing PDF pages with
  `pdfjs-dist` + `@napi-rs/canvas`), DOCX via `mammoth`, CSV/XLSX via SheetJS
  (per-sheet). Chunks of ~1200 chars with overlap, each keeping its source
  location.
- **Embeddings** ([server/src/embeddings.ts](server/src/embeddings.ts)): local
  `all-MiniLM-L6-v2` via transformers.js — no API needed; the model (~90MB)
  downloads to `.model-cache/` on first run.
- **Retrieval** ([server/src/retrieval.ts](server/src/retrieval.ts)):
  brute-force cosine similarity in SQLite; results below a relevance threshold
  are discarded, and an empty result short-circuits to a "not found" reply
  without calling the LLM.
- **Chat** ([server/src/routes/chat.ts](server/src/routes/chat.ts),
  [server/src/llm.ts](server/src/llm.ts)): a local Ollama model answers only
  from retrieved excerpts, cites them as [1]/[2], and returns "not found" if
  the excerpts don't cover the question.
- Re-uploading a file with the same name **replaces** the old version and its
  index. Deleting `data/` resets everything (files, index, chat history).

Everything runs locally — no API keys, no per-request cost. The tradeoff:
chat quality depends on the local model you pick and your machine's
compute, and OCR is text-only (no image "describe this picture" fallback
the way a vision LLM would provide).
