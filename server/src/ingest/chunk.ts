import type { ParsedSegment } from "./types.js";

export interface Chunk {
  content: string;
  location: string | null;
}

const TARGET_CHARS = 1200;
const OVERLAP_CHARS = 200;
const MIN_CHUNK_CHARS = 20;

/** Split text into paragraph-ish blocks, falling back to lines, then hard splits. */
function splitBlocks(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const blocks: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length <= TARGET_CHARS) {
      blocks.push(paragraph);
      continue;
    }
    let current = "";
    for (const line of paragraph.split("\n")) {
      if (current && current.length + line.length + 1 > TARGET_CHARS) {
        blocks.push(current);
        current = line;
      } else {
        current = current ? `${current}\n${line}` : line;
      }
    }
    if (current) blocks.push(current);
  }
  // Hard-split any block still over target (e.g. one giant line).
  return blocks.flatMap((block) => {
    if (block.length <= TARGET_CHARS * 1.5) return [block];
    const pieces: string[] = [];
    for (let i = 0; i < block.length; i += TARGET_CHARS) {
      pieces.push(block.slice(i, i + TARGET_CHARS));
    }
    return pieces;
  });
}

/**
 * Chunk parsed segments into ~TARGET_CHARS pieces with a small overlap,
 * never merging across segments so each chunk keeps one source location.
 */
export function chunkSegments(segments: ParsedSegment[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const segment of segments) {
    const blocks = splitBlocks(segment.text.trim()).filter((block) => block.trim().length > 0);
    let current = "";
    for (const block of blocks) {
      if (current && current.length + block.length + 2 > TARGET_CHARS) {
        chunks.push({ content: current, location: segment.location });
        current = current.slice(-OVERLAP_CHARS) + "\n\n" + block;
      } else {
        current = current ? `${current}\n\n${block}` : block;
      }
    }
    if (current.trim().length >= MIN_CHUNK_CHARS) {
      chunks.push({ content: current, location: segment.location });
    } else if (current.trim() && chunks.length > 0 && chunks[chunks.length - 1].location === segment.location) {
      const last = chunks[chunks.length - 1];
      chunks[chunks.length - 1] = { ...last, content: `${last.content}\n\n${current}` };
    } else if (current.trim()) {
      chunks.push({ content: current, location: segment.location });
    }
  }
  return chunks;
}
