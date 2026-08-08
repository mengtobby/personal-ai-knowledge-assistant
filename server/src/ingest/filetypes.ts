import path from "node:path";

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".bmp"] as const;

export const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls",
  ...IMAGE_EXTENSIONS,
] as const;

export function fileExtension(name: string): string {
  return path.extname(name).toLowerCase();
}

export function isAllowedFilename(name: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function isImageFilename(name: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}
