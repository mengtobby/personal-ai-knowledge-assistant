"""Ingest engine: document parsing, chunking and embeddings as a local HTTP service.

The TypeScript server owns auth, storage, SQLite and the Anthropic API; this
service owns the CPU-heavy text processing so it never blocks the API server.
"""

import logging
import threading
from contextlib import asynccontextmanager
from typing import Union

from fastapi import FastAPI, File, HTTPException, UploadFile

from .chunking import chunk_segments
from .embeddings import embed_texts, get_model, model_ready
from .parsing.parse import parse_file
from .parsing.types import ParseError, ScannedPdf
from .schemas import (
    ChunkOut,
    EmbedRequest,
    EmbedResponse,
    HealthResponse,
    IngestNeedsOcr,
    IngestOk,
    ProcessTextRequest,
    ProcessTextResponse,
    Segment,
)

logger = logging.getLogger("engine")
logging.basicConfig(level=logging.INFO, format="[engine] %(levelname)s %(message)s")

MAX_UPLOAD_BYTES = 50 * 1024 * 1024


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Warm the embedding model in the background (first run downloads ~90MB).
    def warm() -> None:
        try:
            get_model()
            logger.info("Embedding model ready")
        except Exception:
            logger.exception("Failed to load embedding model")

    threading.Thread(target=warm, daemon=True).start()
    yield


app = FastAPI(title="knowledge-assistant-engine", lifespan=lifespan)


def _embed_chunks(segments: list[Segment]) -> list[ChunkOut]:
    chunks = chunk_segments(segments)
    if not chunks:
        raise HTTPException(status_code=422, detail="No indexable text found in this file.")
    vectors = embed_texts([chunk.content for chunk in chunks])
    return [
        ChunkOut(content=chunk.content, location=chunk.location, embedding=vector)
        for chunk, vector in zip(chunks, vectors)
    ]


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(model_ready=model_ready())


@app.post("/ingest", response_model=Union[IngestOk, IngestNeedsOcr])
def ingest(file: UploadFile = File(...)) -> Union[IngestOk, IngestNeedsOcr]:
    """Parse, chunk and embed one file. Scanned PDFs are returned for OCR."""
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File is too large (max 50MB).")

    try:
        outcome = parse_file(file.filename or "", data)
    except ParseError as err:
        raise HTTPException(status_code=422, detail=str(err)) from err

    if isinstance(outcome, ScannedPdf):
        return IngestNeedsOcr(page_count=outcome.page_count)
    return IngestOk(page_count=outcome.page_count, chunks=_embed_chunks(outcome.segments))


@app.post("/process-text", response_model=ProcessTextResponse)
def process_text(request: ProcessTextRequest) -> ProcessTextResponse:
    """Chunk and embed pre-extracted text (image and scanned-PDF OCR output)."""
    return ProcessTextResponse(chunks=_embed_chunks(request.segments))


@app.post("/embed", response_model=EmbedResponse)
def embed(request: EmbedRequest) -> EmbedResponse:
    """Embed raw texts (used by the TS server for retrieval queries)."""
    return EmbedResponse(embeddings=embed_texts(request.texts))
