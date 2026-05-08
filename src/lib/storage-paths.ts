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
  // 处理文件名：
  // 1. 移除路径分隔符，只保留文件名部分
  // 2. 替换 null 字节（安全考虑）
  // 3. 字母转小写
  // 4. 连字符(-)统一改为下划线(_)
  // 5. 限制长度避免文件系统限制
  const base = path
    .basename(name)
    .replace(/\0/g, "")
    .toLowerCase()
    .replace(/-/g, "_");
  const trimmed = base.slice(0, 255);
  return trimmed.length > 0 ? trimmed : "unnamed";
}
