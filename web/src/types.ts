export interface FileEntry {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: "processing" | "indexed" | "error";
  error: string | null;
  pageCount: number | null;
  chunkCount: number;
  createdAt: string;
}

export interface Citation {
  n: number;
  file: string;
  location: string | null;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
}
