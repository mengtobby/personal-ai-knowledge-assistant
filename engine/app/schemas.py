"""Pydantic models for the engine's HTTP API."""

from typing import Literal, Optional

from pydantic import BaseModel, Field


class Segment(BaseModel):
    """A parsed piece of a document that carries its own source location."""

    text: str
    location: Optional[str] = None


class ChunkOut(BaseModel):
    content: str
    location: Optional[str] = None
    embedding: list[float]


class IngestOk(BaseModel):
    status: Literal["ok"] = "ok"
    page_count: Optional[int] = None
    chunks: list[ChunkOut]


class IngestNeedsOcr(BaseModel):
    """Returned for scanned PDFs; the caller OCRs and comes back via /process-text."""

    status: Literal["needs_ocr"] = "needs_ocr"
    page_count: Optional[int] = None


class ProcessTextRequest(BaseModel):
    segments: list[Segment] = Field(min_length=1)


class ProcessTextResponse(BaseModel):
    chunks: list[ChunkOut]


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=256)


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    model_ready: bool
