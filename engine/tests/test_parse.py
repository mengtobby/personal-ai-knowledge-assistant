import csv
from io import BytesIO, StringIO

import pytest

from app.parsing.parse import parse_file
from app.parsing.types import ParsedDocument, ParseError, ScannedPdf


def test_plain_text_file():
    outcome = parse_file("notes.txt", "Line one\n\nLine two".encode("utf-8"))
    assert isinstance(outcome, ParsedDocument)
    assert outcome.segments[0].text == "Line one\n\nLine two"
    assert outcome.segments[0].location is None
    assert outcome.page_count is None


def test_markdown_and_csv_are_treated_as_text():
    for name in ("readme.md", "data.csv"):
        outcome = parse_file(name, b"a,b,c")
        assert isinstance(outcome, ParsedDocument)


def test_empty_file_raises():
    with pytest.raises(ParseError, match="empty"):
        parse_file("notes.txt", b"")
    with pytest.raises(ParseError, match="empty"):
        parse_file("notes.txt", b"   \n  ")


def test_invalid_utf8_is_replaced_not_fatal():
    outcome = parse_file("notes.txt", b"ok \xff\xfe bytes")
    assert isinstance(outcome, ParsedDocument)
    assert "ok" in outcome.segments[0].text


def test_unsupported_extension_raises():
    with pytest.raises(ParseError, match="Unsupported"):
        parse_file("archive.zip", b"PK\x03\x04")


def test_extension_is_case_insensitive_and_path_safe():
    outcome = parse_file("C:\\evil\\..\\NOTES.TXT", b"hello there friend")
    assert isinstance(outcome, ParsedDocument)


def test_corrupt_pdf_raises_parse_error():
    with pytest.raises(ParseError, match="PDF"):
        parse_file("doc.pdf", b"%PDF-1.4 not really a pdf")


def test_text_pdf_extracts_pages():
    pypdf = pytest.importorskip("pypdf")
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buffer = BytesIO()
    writer.write(buffer)

    outcome = parse_file("doc.pdf", buffer.getvalue())
    # A blank page has no text, so it is detected as scanned.
    assert isinstance(outcome, ScannedPdf)
    assert outcome.page_count == 1


def test_xlsx_roundtrip():
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.title = "Budget"
    sheet.append(["item", "cost"])
    sheet.append(["rent", 1200])
    buffer = BytesIO()
    workbook.save(buffer)

    outcome = parse_file("budget.xlsx", buffer.getvalue())
    assert isinstance(outcome, ParsedDocument)
    assert outcome.segments[0].location == 'sheet "Budget"'
    rows = list(csv.reader(StringIO(outcome.segments[0].text)))
    assert rows[0] == ["item", "cost"]
    assert rows[1] == ["rent", "1200"]


def test_docx_roundtrip():
    docx = pytest.importorskip("docx")
    document = docx.Document()
    document.add_paragraph("First paragraph.")
    document.add_paragraph("Second paragraph.")
    table = document.add_table(rows=1, cols=2)
    table.rows[0].cells[0].text = "cell A"
    table.rows[0].cells[1].text = "cell B"
    buffer = BytesIO()
    document.save(buffer)

    outcome = parse_file("doc.docx", buffer.getvalue())
    assert isinstance(outcome, ParsedDocument)
    text = outcome.segments[0].text
    assert "First paragraph." in text
    assert "Second paragraph." in text
    assert "cell A | cell B" in text
