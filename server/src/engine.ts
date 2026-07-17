import { config } from "./config.js";
import type { ParsedSegment } from "./ingest/types.js";

/** A chunk returned by the Python engine, embedding included. */
export interface EngineChunk {
  content: string;
  location: string | null;
  embedding: number[];
}

export type IngestResult =
  | { status: "ok"; pageCount: number | null; chunks: EngineChunk[] }
  | { status: "needs_ocr"; pageCount: number | null };

/** An error the engine reported for this specific input (bad file, no text...). */
export class EngineInputError extends Error {}

async function engineFetch<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.engineUrl}${path}`, init);
  } catch (err) {
    throw new Error(
      `Ingest engine is unreachable at ${config.engineUrl}. Start it with "npm run dev:engine".`,
      { cause: err }
    );
  }
  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: unknown) =>
        body && typeof body === "object" && "detail" in body ? String(body.detail) : null
      )
      .catch(() => null);
    const message = detail ?? `Engine request ${path} failed with status ${response.status}`;
    if (response.status >= 400 && response.status < 500) throw new EngineInputError(message);
    throw new Error(message);
  }
  return (await response.json()) as T;
}

interface RawIngestResponse {
  status: "ok" | "needs_ocr";
  page_count: number | null;
  chunks?: EngineChunk[];
}

/** Parse + chunk + embed one file in the engine. */
export async function engineIngest(name: string, mime: string, data: Buffer): Promise<IngestResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: mime }), name);
  const body = await engineFetch<RawIngestResponse>("/ingest", { method: "POST", body: form });

  if (body.status === "needs_ocr") {
    return { status: "needs_ocr", pageCount: body.page_count };
  }
  return { status: "ok", pageCount: body.page_count, chunks: body.chunks ?? [] };
}

/** Chunk + embed pre-extracted text (used for image and scanned-PDF OCR output). */
export async function engineProcessText(segments: ParsedSegment[]): Promise<EngineChunk[]> {
  const body = await engineFetch<{ chunks: EngineChunk[] }>("/process-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments }),
  });
  return body.chunks;
}

/** Embed one query text for retrieval. */
export async function engineEmbedText(text: string): Promise<Float32Array> {
  const body = await engineFetch<{ embeddings: number[][] }>("/embed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [text] }),
  });
  return Float32Array.from(body.embeddings[0]);
}

export async function engineHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${config.engineUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
