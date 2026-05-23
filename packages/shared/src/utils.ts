export function formatBytes(n: bigint): string {
  if (n < 1024n) return `${n} B`;
  const kb = 1024n;
  const mb = kb * kb;
  const gb = mb * kb;
  if (n < mb) return `${(Number(n) / Number(kb)).toFixed(1)} KB`;
  if (n < gb) return `${(Number(n) / Number(mb)).toFixed(1)} MB`;
  return `${(Number(n) / Number(gb)).toFixed(2)} GB`;
}

export function isPreviewableImage(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  const ext = name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
}
