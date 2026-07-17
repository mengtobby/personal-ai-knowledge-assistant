import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { anthropicAvailable } from "./anthropic.js";
import { authRouter, requireAuth } from "./auth.js";
import { config } from "./config.js";
import { initEmbeddings } from "./embeddings.js";
import { chatRouter } from "./routes/chat.js";
import { filesRouter } from "./routes/files.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ success: true, anthropicConfigured: anthropicAvailable() });
});

app.use("/api/auth", authRouter());
app.use("/api/files", requireAuth, filesRouter());
app.use("/api/chat", requireAuth, chatRouter());

// Serve the built frontend in production (web/dist exists after `npm run build`).
const webDist = path.join(config.rootDir, "web", "dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({
      success: false,
      error: `File is too large (max ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB)`,
    });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[server] Unhandled error:", message);
  res.status(500).json({ success: false, error: message });
});

app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
  console.log(`[server] Storage driver: ${config.s3 ? "s3" : "local"}`);
  if (!anthropicAvailable()) {
    console.warn(
      "[server] ANTHROPIC_API_KEY is not set — uploads and retrieval work, but chat answers and image/scanned-PDF OCR are disabled."
    );
  }
  // Warm the embedding model in the background (first run downloads ~90MB).
  void initEmbeddings()
    .then(() => console.log("[server] Embedding model ready"))
    .catch((err) => console.error("[server] Failed to load embedding model:", err));
});
