import path from "node:path";
import { isSupportedImageType, transcribeImage } from "../anthropic.js";
import { parseDocx } from "./docx.js";
import { parsePdf } from "./pdf.js";
import { parseWorkbook } from "./sheet.js";
import type { ParsedDocument } from "./types.js";

export const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
] as const;

export function isAllowedFilename(name: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(path.extname(name).toLowerCase());
}

export async function parseFile(name: string, mime: string, data: Buffer): Promise<ParsedDocument> {
  const ext = path.extname(name).toLowerCase();

  switch (ext) {
    case ".pdf":
      return parsePdf(data);
    case ".docx":
      return parseDocx(data);
    case ".xlsx":
    case ".xls":
      return parseWorkbook(data);
    case ".txt":
    case ".md":
    case ".csv": {
      const text = data.toString("utf8").trim();
      if (!text) throw new Error("File is empty.");
      return { segments: [{ text, location: null }], pageCount: null };
    }
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".gif":
    case ".webp": {
      const mediaType = mime === "image/jpg" ? "image/jpeg" : mime;
      if (!isSupportedImageType(mediaType)) {
        throw new Error(`Unsupported image type: ${mime}`);
      }
      const text = await transcribeImage(data, mediaType);
      if (!text) throw new Error("No text or content could be extracted from this image.");
      return { segments: [{ text, location: "image content" }], pageCount: null };
    }
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}
