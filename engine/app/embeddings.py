"""Local ONNX embeddings via fastembed (all-MiniLM-L6-v2, L2-normalized)."""

import threading
from typing import TYPE_CHECKING, Optional

import numpy as np

from .config import EMBEDDING_MODEL_ID, MODEL_CACHE_DIR

if TYPE_CHECKING:
    from fastembed import TextEmbedding

_model: Optional["TextEmbedding"] = None
_lock = threading.Lock()

BATCH_SIZE = 32


def get_model() -> "TextEmbedding":
    """Load the model once; safe to call from multiple worker threads."""
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from fastembed import TextEmbedding

                MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)
                _model = TextEmbedding(
                    model_name=EMBEDDING_MODEL_ID, cache_dir=str(MODEL_CACHE_DIR)
                )
    return _model


def model_ready() -> bool:
    return _model is not None


def _normalize(vector: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vector))
    return vector / norm if norm > 0 else vector


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed texts as L2-normalized vectors (cosine similarity == dot product)."""
    if not texts:
        return []
    vectors = get_model().embed(texts, batch_size=BATCH_SIZE)
    return [
        _normalize(np.asarray(vector, dtype=np.float32)).tolist() for vector in vectors
    ]
