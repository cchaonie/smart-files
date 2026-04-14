const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.bmp',
  '.avif',
]);

const EXTENSION_TO_IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
};

function imageMimeFromExtension(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return null;
  return EXTENSION_TO_IMAGE_MIME[lower.slice(dot)] ?? null;
}

/** Content-Type for inline image preview: prefer stored image/*, else infer from extension. */
export function previewImageContentType(
  mimeType: string | null,
  fileName: string,
): string {
  const mt = mimeType?.trim();
  if (mt) {
    const lower = mt.toLowerCase();
    if (lower.startsWith('image/')) return mt;
  }
  return imageMimeFromExtension(fileName) ?? 'application/octet-stream';
}

export function isPreviewableImage(
  mimeType: string | null,
  fileName: string,
): boolean {
  const mt = mimeType?.toLowerCase().trim();
  if (mt && mt.startsWith('image/')) return true;
  const lower = fileName.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(lower.slice(dot));
}
