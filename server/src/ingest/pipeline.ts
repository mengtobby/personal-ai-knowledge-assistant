import { db, type FileRow } from "../db.js";
import { embedTexts, vectorToBuffer } from "../embeddings.js";
import { storage } from "../storage/index.js";
import { chunkSegments } from "./chunk.js";
import { parseFile } from "./parse.js";

const getFile = db.prepare("SELECT * FROM files WHERE id = ?");
const setStatus = db.prepare("UPDATE files SET status = ?, error = ? WHERE id = ?");
const setIndexed = db.prepare(
  "UPDATE files SET status = 'indexed', error = NULL, page_count = ?, chunk_count = ? WHERE id = ?"
);
const insertChunk = db.prepare(
  "INSERT INTO chunks (file_id, seq, content, location, embedding) VALUES (?, ?, ?, ?, ?)"
);
const deleteChunks = db.prepare("DELETE FROM chunks WHERE file_id = ?");

/** Parse, chunk, embed and index one uploaded file. Updates the file's status row. */
export async function processFile(fileId: string): Promise<void> {
  const file = getFile.get(fileId) as FileRow | undefined;
  if (!file) return;

  try {
    const data = await storage.get(file.storage_key);
    const parsed = await parseFile(file.name, file.mime, data);
    const chunks = chunkSegments(parsed.segments);
    if (chunks.length === 0) {
      throw new Error("No indexable text found in this file.");
    }

    const vectors = await embedTexts(chunks.map((chunk) => chunk.content));

    db.transaction(() => {
      deleteChunks.run(fileId);
      chunks.forEach((chunk, i) => {
        insertChunk.run(fileId, i, chunk.content, chunk.location, vectorToBuffer(vectors[i]));
      });
      setIndexed.run(parsed.pageCount, chunks.length, fileId);
    })();
    console.log(`[ingest] Indexed "${file.name}": ${chunks.length} chunks`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] Failed to index "${file.name}":`, message);
    setStatus.run("error", message, fileId);
  }
}
