"""Dispatch a file to the right parser by extension.

Images are handled by the TypeScript server (Claude vision OCR) and never
reach the engine; scanned PDFs are detected here and bounced back for OCR.
"""

from pathlib import PurePosixPath, PureWindowsPath

from ..schemas import Segment
from .docx import parse_docx
from .pdf import parse_pdf
from .sheet import parse_workbook
from .types import ParsedDocument, ParseError, ParseOutcome

TEXT_EXTENSIONS = {".txt", ".md", ".csv"}
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".xls"} | TEXT_EXTENSIONS


def _extension(name: str) -> str:
    # Handle both path styles defensively; uploads normally send a bare name.
    bare = PureWindowsPath(PurePosixPath(name).name).name
    return PurePosixPath(bare).suffix.lower()


def parse_file(name: str, data: bytes) -> ParseOutcome:
    ext = _extension(name)
    if not data:
        raise ParseError("File is empty.")

    if ext == ".pdf":
        return parse_pdf(data)
    if ext == ".docx":
        return parse_docx(data)
    if ext in (".xlsx", ".xls"):
        return parse_workbook(data, ext)
    if ext in TEXT_EXTENSIONS:
        text = data.decode("utf-8", errors="replace").strip()
        if not text:
            raise ParseError("File is empty.")
        return ParsedDocument(segments=[Segment(text=text, location=None)])

    raise ParseError(f"Unsupported file type: {ext or name}")
