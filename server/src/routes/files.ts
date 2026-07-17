import crypto from "node:crypto";
import express, { type Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { db, type FileRow } from "../db.js";
import { isAllowedFilename, ALLOWED_EXTENSIONS } from "../ingest/parse.js";
import { processFile } from "../ingest/pipeline.js";
import { storage } from "../storage/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
});

const findByName = db.prepare("SELECT * FROM files WHERE name = ?");
const findById = db.prepare("SELECT * FROM files WHERE id = ?");
const listFiles = db.prepare("SELECT * FROM files ORDER BY created_at DESC, name ASC");
const insertFile = db.prepare(
  "INSERT INTO files (id, name, mime, size, storage_key, status) VALUES (?, ?, ?, ?, ?, 'processing')"
);
const deleteFile = db.prepare("DELETE FROM files WHERE id = ?");

function toApi(row: FileRow) {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    status: row.status,
    error: row.error,
    pageCount: row.page_count,
    chunkCount: row.chunk_count,
    createdAt: row.created_at,
  };
}

async function removeFile(row: FileRow): Promise<void> {
  await storage.delete(row.storage_key);
  deleteFile.run(row.id); // chunks cascade
}

export function filesRouter(): Router {
  const router = express.Router();

  router.get("/", (_req, res) => {
    const rows = listFiles.all() as FileRow[];
    res.json({ success: true, data: rows.map(toApi) });
  });

  router.post("/", upload.single("file"), async (req, res) => {
    const uploaded = req.file;
    if (!uploaded) {
      res.status(400).json({ success: false, error: "No file provided" });
      return;
    }
    // Multer decodes originalname as latin1; recover UTF-8 names.
    const name = Buffer.from(uploaded.originalname, "latin1").toString("utf8");
    if (!isAllowedFilename(name)) {
      res.status(400).json({
        success: false,
        error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
      });
      return;
    }

    try {
      // Re-uploading the same filename replaces the previous version.
      const existing = findByName.get(name) as FileRow | undefined;
      if (existing) await removeFile(existing);

      const id = crypto.randomUUID();
      const storageKey = `files/${id}/${name}`;
      await storage.put(storageKey, uploaded.buffer, uploaded.mimetype);
      insertFile.run(id, name, uploaded.mimetype, uploaded.size, storageKey);

      // Index asynchronously; the UI polls status.
      void processFile(id);

      const row = findById.get(id) as FileRow;
      res.status(201).json({ success: true, data: toApi(row), replaced: Boolean(existing) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[files] Upload failed:", message);
      res.status(500).json({ success: false, error: `Upload failed: ${message}` });
    }
  });

  router.delete("/:id", async (req, res) => {
    const row = findById.get(req.params.id) as FileRow | undefined;
    if (!row) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }
    try {
      await removeFile(row);
      res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[files] Delete failed:", message);
      res.status(500).json({ success: false, error: `Delete failed: ${message}` });
    }
  });

  return router;
}
