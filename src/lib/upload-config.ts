const mb = (n: number) => BigInt(n) * 1024n * 1024n;

export function getUploadRoot(): string {
  return process.env.UPLOAD_ROOT ?? "./data/storage";
}

export function maxFileSizeBytes(): bigint {
  const raw = process.env.MAX_FILE_SIZE_BYTES;
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return mb(10 * 1024);
}

export function defaultChunkSize(): number {
  const raw = process.env.DEFAULT_CHUNK_SIZE_BYTES;
  if (raw && /^\d+$/.test(raw)) return Math.min(Math.max(parseInt(raw, 10), 256 * 1024), 32 * 1024 * 1024);
  return 5 * 1024 * 1024;
}

export function maxChunkCount(): number {
  const raw = process.env.MAX_CHUNKS;
  if (raw && /^\d+$/.test(raw)) return parseInt(raw, 10);
  return 50_000;
}
