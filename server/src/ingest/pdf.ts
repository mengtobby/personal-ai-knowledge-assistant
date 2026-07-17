import { extractText, getDocumentProxy } from "unpdf";
import { anthropicAvailable, transcribeScannedPdf } from "../anthropic.js";
import type { ParsedDocument, ParsedSegment } from "./types.js";

// Below this average per page we assume the PDF is scanned/image-based.
const MIN_CHARS_PER_PAGE = 30;
const MAX_OCR_PAGES = 100;
const MAX_OCR_BYTES = 30 * 1024 * 1024;

export async function parsePdf(data: Buffer): Promise<ParsedDocument> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { totalPages, text: pageTexts } = await extractText(pdf, { mergePages: false });

  const totalChars = pageTexts.reduce((sum, page) => sum + page.trim().length, 0);
  if (totalPages > 0 && totalChars / totalPages >= MIN_CHARS_PER_PAGE) {
    const segments: ParsedSegment[] = pageTexts
      .map((text, i) => ({ text: text.trim(), location: `page ${i + 1}` }))
      .filter((segment) => segment.text.length > 0);
    return { segments, pageCount: totalPages };
  }

  // Little or no embedded text: treat as scanned and OCR via Claude vision.
  if (!anthropicAvailable()) {
    throw new Error(
      "This PDF appears to be scanned (no embedded text). Set ANTHROPIC_API_KEY in .env to enable OCR."
    );
  }
  if (totalPages > MAX_OCR_PAGES || data.byteLength > MAX_OCR_BYTES) {
    throw new Error(
      `Scanned PDF is too large for OCR (limit: ${MAX_OCR_PAGES} pages / 30MB).`
    );
  }
  const ocrPages = await transcribeScannedPdf(data);
  const segments: ParsedSegment[] = ocrPages
    .map((text, i) => ({ text: text.trim(), location: `page ${i + 1}` }))
    .filter((segment) => segment.text.length > 0);
  return { segments, pageCount: totalPages };
}
