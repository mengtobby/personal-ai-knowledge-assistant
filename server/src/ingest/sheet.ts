import * as XLSX from "xlsx";
import type { ParsedDocument, ParsedSegment } from "./types.js";

/** Parse .xlsx/.xls: one segment per sheet, as CSV text. */
export function parseWorkbook(data: Buffer): ParsedDocument {
  const workbook = XLSX.read(data, { type: "buffer" });
  const segments: ParsedSegment[] = workbook.SheetNames.map((name) => ({
    text: XLSX.utils.sheet_to_csv(workbook.Sheets[name]).trim(),
    location: `sheet "${name}"`,
  })).filter((segment) => segment.text.length > 0);
  if (segments.length === 0) throw new Error("Workbook contains no data.");
  return { segments, pageCount: null };
}
