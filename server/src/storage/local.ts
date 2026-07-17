import fs from "node:fs/promises";
import path from "node:path";
import type { BlobStorage } from "./types.js";

export function createLocalStorage(baseDir: string): BlobStorage {
  const resolve = (key: string): string => {
    const full = path.resolve(baseDir, key);
    if (!full.startsWith(path.resolve(baseDir))) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return full;
  };

  return {
    async put(key, data) {
      const full = resolve(key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, data);
    },
    async get(key) {
      return fs.readFile(resolve(key));
    },
    async delete(key) {
      await fs.rm(resolve(key), { force: true });
    },
  };
}
