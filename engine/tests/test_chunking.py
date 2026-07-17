from app.chunking import MIN_CHUNK_CHARS, OVERLAP_CHARS, TARGET_CHARS, chunk_segments
from app.schemas import Segment


def test_empty_segments_produce_no_chunks():
    assert chunk_segments([]) == []
    assert chunk_segments([Segment(text="   \n\n  ", location=None)]) == []


def test_short_text_becomes_one_chunk_with_location():
    chunks = chunk_segments([Segment(text="Hello world, this is a note.", location="page 1")])
    assert len(chunks) == 1
    assert chunks[0].content == "Hello world, this is a note."
    assert chunks[0].location == "page 1"


def test_long_text_splits_with_overlap():
    paragraphs = [f"Paragraph {i}. " + ("lorem ipsum " * 30).strip() for i in range(10)]
    text = "\n\n".join(paragraphs)
    chunks = chunk_segments([Segment(text=text, location=None)])

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk.content) <= TARGET_CHARS + OVERLAP_CHARS + 2
    # Consecutive chunks share overlap: the head of chunk N+1 comes from chunk N's tail.
    tail = chunks[0].content[-OVERLAP_CHARS:]
    assert chunks[1].content.startswith(tail)


def test_chunks_never_merge_across_segments():
    segments = [
        Segment(text="Sheet one content that is long enough.", location='sheet "A"'),
        Segment(text="Sheet two content that is long enough.", location='sheet "B"'),
    ]
    chunks = chunk_segments(segments)
    assert [chunk.location for chunk in chunks] == ['sheet "A"', 'sheet "B"']


def test_tiny_trailing_text_merges_into_previous_chunk_of_same_location():
    big = "word " * 300  # forces at least one chunk
    segments = [Segment(text=big + "\n\n" + "tiny", location="page 1")]
    chunks = chunk_segments(segments)
    assert all(len(chunk.content.strip()) >= MIN_CHUNK_CHARS for chunk in chunks)
    assert "tiny" in chunks[-1].content


def test_giant_single_line_is_hard_split():
    text = "x" * (TARGET_CHARS * 3)
    chunks = chunk_segments([Segment(text=text, location=None)])
    assert len(chunks) >= 2
    assert sum(len(c.content) for c in chunks) >= len(text)
