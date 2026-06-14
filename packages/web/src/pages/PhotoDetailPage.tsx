import { motion } from 'motion/react';
import { photosApi } from '../api/photos';
import type { Photo } from '../types';
import { useI18n } from '@smart-files/shared/src/i18n';
import { formatBytes } from '@smart-files/shared/src/utils';
import { XMarkIcon } from '../components/icons';

export function formatCaptured(capturedAt: string | null, locale: string): string {
  if (!capturedAt) return '—';
  const d = new Date(capturedAt);
  return d.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function PhotoDetailPage({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { t, lang } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative max-w-lg w-full bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Preview image */}
        <div className="relative flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 max-h-[80vh] overflow-hidden">
          <img
            src={photosApi.previewUrl(photo)}
            alt={photo.originalName}
            className="object-contain max-h-[80vh] w-full"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = target.parentElement?.querySelector('.img-fallback');
              if (fallback) (fallback as HTMLElement).style.display = 'flex';
            }}
          />
          <div className="img-fallback hidden absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
            {t.failedToLoad}
          </div>
        </div>

        {/* Metadata */}
        <div className="p-4 space-y-3">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {photo.originalName}
          </p>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <p>{t.captured}: {formatCaptured(photo.capturedAt, lang)}</p>
            {photo.width && photo.height && (
              <p>{t.dimensions}: {photo.width} × {photo.height}</p>
            )}
            <p>{formatBytes(BigInt(photo.fileSize))}</p>
          </div>

          {/* Tags */}
          {photo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {photo.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[11px] font-medium"
                >
                  {tag.tag}
                  {tag.confidence !== null && ` (${Math.round(tag.confidence * 100)}%)`}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
