import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!config.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env to enable chat and OCR.");
  }
  if (!client) client = new Anthropic({ apiKey: config.anthropicApiKey });
  return client;
}

export function anthropicAvailable(): boolean {
  return Boolean(config.anthropicApiKey);
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function isSupportedImageType(mime: string): mime is ImageMediaType {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(mime);
}

/** Extract text (or a description, for text-free images) from an image via Claude vision. */
export async function transcribeImage(data: Buffer, mime: string): Promise<string> {
  if (!isSupportedImageType(mime)) {
    throw new Error(`Unsupported image type: ${mime}`);
  }
  const response = await getAnthropic().messages.create({
    model: config.ocrModel,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mime, data: data.toString("base64") },
          },
          {
            type: "text",
            text: "Transcribe all text in this image verbatim. If the image contains little or no text, describe its contents in detail instead. Output only the transcription/description, no preamble.",
          },
        ],
      },
    ],
  });
  return textOf(response).trim();
}

/** Extract per-page text from a scanned (image-based) PDF via Claude vision. */
export async function transcribeScannedPdf(data: Buffer): Promise<string[]> {
  const response = await getAnthropic().messages.create({
    model: config.ocrModel,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: data.toString("base64") },
          },
          {
            type: "text",
            text: 'Transcribe the full text of this document page by page. Before each page, output a marker line exactly like "=== PAGE 1 ===". Transcribe verbatim; describe figures briefly in [brackets]. Output nothing else.',
          },
        ],
      },
    ],
  });
  const raw = textOf(response);
  const pages = raw
    .split(/^=== PAGE \d+ ===\s*$/m)
    .map((page) => page.trim())
    .filter((page) => page.length > 0);
  return pages.length > 0 ? pages : [raw.trim()];
}
