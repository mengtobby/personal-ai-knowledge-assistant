"""Shared parsing result types and errors."""

from dataclasses import dataclass
from typing import Optional, Union

from ..schemas import Segment


class ParseError(Exception):
    """A user-facing parsing failure (unsupported/corrupt/empty file)."""


@dataclass(frozen=True)
class ParsedDocument:
    segments: list[Segment]
    page_count: Optional[int] = None


@dataclass(frozen=True)
class ScannedPdf:
    """PDF with little or no embedded text; the caller must OCR it."""

    page_count: int


ParseOutcome = Union[ParsedDocument, ScannedPdf]
