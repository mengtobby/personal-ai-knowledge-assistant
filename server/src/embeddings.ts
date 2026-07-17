import path from "node:path";
import { config } from "./config.js";

// Local embedding model (no API key needed). ~90MB download on first run,
// cached under .model-cache/ afterwards.
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import("@huggingface/transformers");
      env.cacheDir = path.join(config.rootDir, ".model-cache");
      const extractor = await pipeline("feature-extraction", MODEL_ID);
      return extractor as unknown as FeatureExtractor;
    })();
  }
  return extractorPromise;
}

/** Warm up the model so the first upload/query doesn't pay the load cost. */
export async function initEmbeddings(): Promise<void> {
  await getExtractor();
}

export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const results: Float32Array[] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const output = await extractor(batch, { pooling: "mean", normalize: true });
    for (const vector of output.tolist()) {
      results.push(Float32Array.from(vector));
    }
  }
  return results;
}

export async function embedText(text: string): Promise<Float32Array> {
  const [vector] = await embedTexts([text]);
  return vector;
}

/** Vectors are L2-normalized, so cosine similarity is just the dot product. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function bufferToVector(buffer: Buffer): Float32Array {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
}

export function vectorToBuffer(vector: Float32Array): Buffer {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}
