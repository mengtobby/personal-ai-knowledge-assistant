/** A parsed piece of a document that carries its own source location (page, sheet...). */
export interface ParsedSegment {
  text: string;
  location: string | null;
}

export interface ParsedDocument {
  segments: ParsedSegment[];
  pageCount: number | null;
}
