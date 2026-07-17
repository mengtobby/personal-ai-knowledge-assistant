import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(rootDir, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

export interface S3Settings {
  endpoint: string | undefined;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

function loadS3Settings(): S3Settings | null {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "s3") return null;
  return {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "auto",
    bucket: required("S3_BUCKET"),
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  };
}

export const config = {
  rootDir,
  port: Number(process.env.PORT ?? 8787),
  engineUrl: process.env.ENGINE_URL || `http://127.0.0.1:${process.env.ENGINE_PORT || 8788}`,
  dataDir: path.resolve(rootDir, process.env.DATA_DIR ?? "./data"),
  appPassword: required("APP_PASSWORD"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  chatModel: process.env.CHAT_MODEL ?? "claude-sonnet-5",
  ocrModel: process.env.OCR_MODEL ?? "claude-haiku-4-5-20251001",
  s3: loadS3Settings(),
  maxUploadBytes: 50 * 1024 * 1024,
} as const;
