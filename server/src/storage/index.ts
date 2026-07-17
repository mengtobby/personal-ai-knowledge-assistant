import path from "node:path";
import { config } from "../config.js";
import { createLocalStorage } from "./local.js";
import { createS3Storage } from "./s3.js";
import type { BlobStorage } from "./types.js";

export const storage: BlobStorage = config.s3
  ? createS3Storage(config.s3)
  : createLocalStorage(path.join(config.dataDir, "blobs"));

export type { BlobStorage } from "./types.js";
