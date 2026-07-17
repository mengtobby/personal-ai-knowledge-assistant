"""Engine configuration, loaded from the repo root .env (shared with the TS server)."""

import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(ROOT_DIR / ".env")

ENGINE_PORT = int(os.environ.get("ENGINE_PORT", "8788"))

# Same model family the previous Node implementation used (all-MiniLM-L6-v2),
# so vectors already stored in SQLite remain comparable.
EMBEDDING_MODEL_ID = os.environ.get(
    "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
MODEL_CACHE_DIR = ROOT_DIR / ".model-cache" / "fastembed"
