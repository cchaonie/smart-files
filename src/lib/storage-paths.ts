import path from "path";
import fs from "fs/promises";

export function chunkTempDir(uploadRoot: string, userId: string, uploadId: string): string {
  return path.join(uploadRoot, "tmp", userId, uploadId);
}

export function storedFilePath(uploadRoot: string, userId: string, storageKey: string): string {
  return path.join(uploadRoot, "files", userId, storageKey);
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[\0-\x1f]/g, "_").replace(/\\/g, "_");
  const trimmed = base.replace(/^\.+/, "").slice(0, 255);
  return trimmed.length > 0 ? trimmed : "unnamed";
}
