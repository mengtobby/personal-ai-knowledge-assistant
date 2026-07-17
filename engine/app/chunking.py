"""Split parsed segments into overlapping chunks sized for embedding.

Faithful port of the previous TypeScript implementation (same constants),
so re-indexed files chunk identically to already-indexed ones.
"""

import re
from dataclasses import dataclass
from typing import Optional

from .schemas import Segment

TARGET_CHARS = 1200
OVERLAP_CHARS = 200
MIN_CHUNK_CHARS = 20


@dataclass(frozen=True)
class Chunk:
    content: str
    location: Optional[str]


def _split_blocks(text: str) -> list[str]:
    """Split text into paragraph-ish blocks, falling back to lines, then hard splits."""
    paragraphs = re.split(r"\n\s*\n", text)
    blocks: list[str] = []
    for paragraph in paragraphs:
        if len(paragraph) <= TARGET_CHARS:
            blocks.append(paragraph)
            continue
        current = ""
        for line in paragraph.split("\n"):
            if current and len(current) + len(line) + 1 > TARGET_CHARS:
                blocks.append(current)
                current = line
            else:
                current = f"{current}\n{line}" if current else line
        if current:
            blocks.append(current)

    # Hard-split any block still over target (e.g. one giant line).
    result: list[str] = []
    for block in blocks:
        if len(block) <= TARGET_CHARS * 1.5:
            result.append(block)
        else:
            result.extend(
                block[i : i + TARGET_CHARS] for i in range(0, len(block), TARGET_CHARS)
            )
    return result


def chunk_segments(segments: list[Segment]) -> list[Chunk]:
    """Chunk segments into ~TARGET_CHARS pieces with a small overlap.

    Never merges across segments so each chunk keeps one source location.
    """
    chunks: list[Chunk] = []
    for segment in segments:
        blocks = [b for b in _split_blocks(segment.text.strip()) if b.strip()]
        current = ""
        for block in blocks:
            if current and len(current) + len(block) + 2 > TARGET_CHARS:
                chunks.append(Chunk(content=current, location=segment.location))
                current = current[-OVERLAP_CHARS:] + "\n\n" + block
            else:
                current = f"{current}\n\n{block}" if current else block

        stripped = current.strip()
        if len(stripped) >= MIN_CHUNK_CHARS:
            chunks.append(Chunk(content=current, location=segment.location))
        elif stripped and chunks and chunks[-1].location == segment.location:
            last = chunks[-1]
            chunks[-1] = Chunk(
                content=f"{last.content}\n\n{current}", location=last.location
            )
        elif stripped:
            chunks.append(Chunk(content=current, location=segment.location))
    return chunks
