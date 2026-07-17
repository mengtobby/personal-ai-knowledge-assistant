"""PDF text extraction via pypdf, with scanned-PDF detection."""

from io import BytesIO

from pypdf import PdfReader

from ..schemas import Segment
from .types import ParsedDocument, ParseError, ParseOutcome, ScannedPdf

# Below this average per page we assume the PDF is scanned/image-based.
MIN_CHARS_PER_PAGE = 30


def parse_pdf(data: bytes) -> ParseOutcome:
    try:
        reader = PdfReader(BytesIO(data))
        if reader.is_encrypted:
            # Try the empty password; many "encrypted" PDFs are only owner-locked.
            if not reader.decrypt(""):
                raise ParseError("This PDF is password-protected and cannot be read.")
        page_texts = [(page.extract_text() or "").strip() for page in reader.pages]
    except ParseError:
        raise
    except Exception as err:
        raise ParseError(f"Could not read this PDF: {err}") from err

    total_pages = len(page_texts)
    total_chars = sum(len(text) for text in page_texts)
    if total_pages > 0 and total_chars / total_pages >= MIN_CHARS_PER_PAGE:
        segments = [
            Segment(text=text, location=f"page {i + 1}")
            for i, text in enumerate(page_texts)
            if text
        ]
        return ParsedDocument(segments=segments, page_count=total_pages)

    return ScannedPdf(page_count=total_pages)
