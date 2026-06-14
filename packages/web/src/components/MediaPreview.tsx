import { useEffect } from 'react'
import type { FileItem } from '../types'
import { filesApi } from '../api/files'
import { isPreviewableVideo, isPreviewableAudio } from '@smart-files/shared/src/utils'
import { useI18n } from '@smart-files/shared/src/i18n'

function MediaPreview({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const { t } = useI18n();
  /** For photo-linked files, add hint so backend can serve photo-original content */
  const url = file.photoId
    ? `${filesApi.previewUrl(file.id)}&photo=1`
    : filesApi.previewUrl(file.id);
  const isVideo = isPreviewableVideo(file.mimeType, file.name);
  const isAudio = isPreviewableAudio(file.mimeType, file.name);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 rounded-full bg-zinc-800/90 px-3 py-1 text-sm text-white hover:bg-zinc-700"
        onClick={onClose}
      >
        {t.close}
      </button>

      <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
        {isVideo ? (
          <video controls autoPlay className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl">
            <source src={url} type={file.mimeType || 'video/mp4'} />
            {t.unsupportedVideo}
          </video>
        ) : isAudio ? (
          <div className="rounded-xl bg-white px-8 py-12 shadow-2xl dark:bg-zinc-900">
            <p className="mb-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
              {file.name}
            </p>
            <audio controls autoPlay className="w-80">
              <source src={url} type={file.mimeType || 'audio/mpeg'} />
              {t.unsupportedAudio}
            </audio>
          </div>
        ) : (
          <img
            src={url}
            alt={file.name}
            className="max-h-[90vh] max-w-full object-contain shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}

export default MediaPreview
