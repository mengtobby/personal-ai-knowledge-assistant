import { db } from "./db.js";
import { engineEmbedText } from "./engine.js";
import { bufferToVector, cosineSimilarity } from "./vectors.js";

export interface RetrievedChunk {
  chunkId: number;
  fileId: string;
  fileName: string;
  content: string;
  location: string | null;
  score: number;
}

// Tuned for all-MiniLM-L6-v2 cosine scores: related content usually lands
// well above this; unrelated questions fall below it.
export const RELEVANCE_THRESHOLD = 0.35;
const TOP_K = 6;

const listChunks = db.prepare(`
  SELECT c.id AS chunkId, c.file_id AS fileId, f.name AS fileName,
         c.content, c.location, c.embedding
  FROM chunks c
  JOIN files f ON f.id = c.file_id
  WHERE f.status = 'indexed'
`);

interface ChunkWithEmbedding extends Omit<RetrievedChunk, "score"> {
  embedding: Buffer;
}

/** Brute-force cosine search over all indexed chunks (fine at personal scale). */
export async function retrieve(query: string): Promise<RetrievedChunk[]> {
  const queryVector = await engineEmbedText(query);
  const rows = listChunks.all() as ChunkWithEmbedding[];

  const scored = rows.map((row) => ({
    chunkId: row.chunkId,
    fileId: row.fileId,
    fileName: row.fileName,
    content: row.content,
    location: row.location,
    score: cosineSimilarity(queryVector, bufferToVector(row.embedding)),
  }));

  return scored
    .filter((chunk) => chunk.score >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}
