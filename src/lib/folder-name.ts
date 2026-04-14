const MAX_LEN = 255;

export function sanitizeFolderName(raw: string): string {
  const t = raw.trim().replace(/[\0-\x1f\\/]/g, "_").replace(/^\.+/, "").slice(0, MAX_LEN);
  return t.length > 0 ? t : "untitled";
}
