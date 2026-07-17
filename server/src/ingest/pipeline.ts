import {
  anthropicAvailable,
  isSupportedImageType,
  transcribeImage,
  transcribeScannedPdf,
} from "../anthropic.js";
import { db, type FileRow } from "../db.js";
import {
  engineIngest,
  engineProcessText,
  type EngineChunk,
} from "../engine.js";
import { storage } from "../storage/index.js";
import { vectorToBuffer } from "../vectors.js";
import { isImageFilename } from "./filetypes.js";
import type { ParsedSegment } from "./types.js";

const MAX_OCR_PAGES = 100;
const MAX_OCR_BYTES = 30 * 1024 * 1024;

const getFile = db.prepare("SELECT * FROM files WHERE id = ?");
const setStatus = db.prepare("UPDATE files SET status = ?, error = ? WHERE id = ?");
const setIndexed = db.prepare(
  "UPDATE files SET status = 'indexed', error = NULL, page_count = ?, chunk_count = ? WHERE id = ?"
);
const insertChunk = db.prepare(
  "INSERT INTO chunks (file_id, seq, content, location, embedding) VALUES (?, ?, ?, ?, ?)"
);
const deleteChunks = db.prepare("DELETE FROM chunks WHERE file_id = ?");

/** OCR an image via Claude vision, then chunk + embed the text in the engine. */
async function ingestImage(file: FileRow, data: Buffer): Promise<EngineChunk[]> {
  const mediaType = file.mime === "image/jpg" ? "image/jpeg" : file.mime;
  if (!isSupportedImageType(mediaType)) {
    throw new Error(`Unsupported image type: ${file.mime}`);
  }
  const text = await transcribeImage(data, mediaType);
  if (!text) throw new Error("No text or content could be extracted from this image.");
  return engineProcessText([{ text, location: "image content" }]);
}

/** OCR a scanned PDF via Claude vision, then chunk + embed the pages in the engine. */
async function ingestScannedPdf(data: Buffer, pageCount: number | null): Promise<EngineChunk[]> {
  if (!anthropicAvailable()) {
    throw new Error(
      "This PDF appears to be scanned (no embedded text). Set ANTHROPIC_API_KEY in .env to enable OCR."
    );
  }
  if ((pageCount ?? 0) > MAX_OCR_PAGES || data.byteLength > MAX_OCR_BYTES) {
    throw new Error(`Scanned PDF is too large for OCR (limit: ${MAX_OCR_PAGES} pages / 30MB).`);
  }
  const pages = await transcribeScannedPdf(data);
  const segments: ParsedSegment[] = pages
    .map((text, i) => ({ text: text.trim(), location: `page ${i + 1}` }))
    .filter((segment) => segment.text.length > 0);
  if (segments.length === 0) {
    throw new Error("No text could be extracted from this scanned PDF.");
  }
  return engineProcessText(segments);
}

/** Parse, chunk, embed and index one uploaded file. Updates the file's status row. */
export async function processFile(fileId: string): Promise<void> {
  const file = getFile.get(fileId) as FileRow | undefined;
  if (!file) return;

  try {
    const data = await storage.get(file.storage_key);

    let chunks: EngineChunk[];
    let pageCount: number | null = null;
    if (isImageFilename(file.name)) {
      chunks = await ingestImage(file, data);
    } else {
      const result = await engineIngest(file.name, file.mime, data);
      pageCount = result.pageCount;
      chunks =
        result.status === "needs_ocr"
          ? await ingestScannedPdf(data, result.pageCount)
          : result.chunks;
    }
    if (chunks.length === 0) {
      throw new Error("No indexable text found in this file.");
    }

    db.transaction(() => {
      deleteChunks.run(fileId);
      chunks.forEach((chunk, i) => {
        insertChunk.run(
          fileId,
          i,
          chunk.content,
          chunk.location,
          vectorToBuffer(Float32Array.from(chunk.embedding))
        );
      });
      setIndexed.run(pageCount, chunks.length, fileId);
    })();
    console.log(`[ingest] Indexed "${file.name}": ${chunks.length} chunks`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] Failed to index "${file.name}":`, message);
    setStatus.run("error", message, fileId);
  }
}
