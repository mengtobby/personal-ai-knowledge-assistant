import { type Canvas, type SKRSContext2D, createCanvas, DOMMatrix, Path2D } from "@napi-rs/canvas";
// Falls back to an in-process "fake worker" when no worker thread is available.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker, type Worker } from "tesseract.js";

// pdfjs-dist only auto-polyfills DOMMatrix/Path2D from the native "canvas" package;
// pre-set them from @napi-rs/canvas here so its own (skipped) polyfill attempt doesn't warn.
(globalThis as { DOMMatrix?: unknown }).DOMMatrix ??= DOMMatrix;
(globalThis as { Path2D?: unknown }).Path2D ??= Path2D;

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/bmp"] as const;
type ImageMediaType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isSupportedImageType(mime: string): mime is ImageMediaType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mime);
}

const PDF_RENDER_SCALE = 2;

interface CanvasAndContext {
  canvas: Canvas | null;
  context: SKRSContext2D | null;
}

// pdfjs-dist creates its own temporary canvases internally (e.g. compositing image
// XObjects) via this factory; its built-in Node default shells out to the native
// "canvas" package, which isn't installed here, so we point it at @napi-rs/canvas.
class NapiCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
    if (!canvasAndContext.canvas) throw new Error("Canvas is not specified");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: CanvasAndContext): void {
    if (!canvasAndContext.canvas) throw new Error("Canvas is not specified");
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

let workerPromise: Promise<Worker> | null = null;
function getOcrWorker(): Promise<Worker> {
  workerPromise ??= createWorker("eng");
  return workerPromise;
}

/** Extract text from an image via local Tesseract OCR. */
export async function transcribeImage(data: Buffer, mime: string): Promise<string> {
  if (!isSupportedImageType(mime)) {
    throw new Error(`Unsupported image type: ${mime}`);
  }
  const worker = await getOcrWorker();
  const { data: result } = await worker.recognize(data);
  return result.text.trim();
}

/** Rasterize each page of a scanned PDF and OCR it via local Tesseract. */
export async function transcribeScannedPdf(data: Buffer): Promise<string[]> {
  const worker = await getOcrWorker();
  const doc = await getDocument({
    data: new Uint8Array(data),
    CanvasFactory: NapiCanvasFactory,
  }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = createCanvas(viewport.width, viewport.height);
    const canvasContext = canvas.getContext("2d");

    await page.render({
      canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const { data: result } = await worker.recognize(canvas.toBuffer("image/png"));
    pages.push(result.text.trim());
  }

  return pages.filter((text) => text.length > 0);
}
