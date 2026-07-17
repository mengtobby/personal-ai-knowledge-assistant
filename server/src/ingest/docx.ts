import mammoth from "mammoth";
import type { ParsedDocument } from "./types.js";

export async function parseDocx(data: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer: data });
  const text = result.value.trim();
  if (!text) throw new Error("No text could be extracted from this .docx file.");
  return { segments: [{ text, location: null }], pageCount: null };
}
