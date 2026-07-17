"""DOCX text extraction via python-docx (paragraphs and tables, in order)."""

from io import BytesIO

import docx
from docx.document import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

from ..schemas import Segment
from .types import ParsedDocument, ParseError


def _iter_block_text(document: Document) -> list[str]:
    """Walk body elements in document order, keeping both paragraphs and tables."""
    blocks: list[str] = []
    for element in document.element.body.iterchildren():
        if element.tag.endswith("}p"):
            text = Paragraph(element, document).text.strip()
            if text:
                blocks.append(text)
        elif element.tag.endswith("}tbl"):
            table = Table(element, document)
            rows = [
                " | ".join(cell.text.strip() for cell in row.cells)
                for row in table.rows
            ]
            rows = [row for row in rows if row.strip(" |")]
            if rows:
                blocks.append("\n".join(rows))
    return blocks


def parse_docx(data: bytes) -> ParsedDocument:
    try:
        document = docx.Document(BytesIO(data))
        blocks = _iter_block_text(document)
    except Exception as err:
        raise ParseError(f"Could not read this .docx file: {err}") from err

    text = "\n\n".join(blocks).strip()
    if not text:
        raise ParseError("No text could be extracted from this .docx file.")
    return ParsedDocument(segments=[Segment(text=text, location=None)])
