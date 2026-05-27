import { useState } from 'react'
import type { FileItem } from '../types'
import { filesApi } from '../api/files'
import { isPreviewableVideo, isPreviewableAudio, isPreviewableImage } from '@smart-files/shared/src/utils'
import { useI18n } from '@smart-files/shared/src/i18n'

function PreviewThumb({ file, onOpen }: { file: FileItem; onOpen: () => void }) {
  const { t } = useI18n();
  const [broken, setBroken] = useState(false);

  const isVideo = isPreviewableVideo(file.mimeType, file.name);
  const isAudio = isPreviewableAudio(file.mimeType, file.name);
  const isImage = isPreviewableImage(file.mimeType, file.name);

  if (!isImage && !isVideo && !isAudio) {
    return (
      <span className="inline-flex h-12 w-12 items-center justify-center text-zinc-400 dark:text-zinc-500">
        —
      </span>
    );
  }

  if (broken && isImage) {
    return (
      <div
        className="h-12 w-12 shrink-0 rounded border border-zinc-200 bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700"
        title={t.previewUnavailable}
      />
    );
  }

  const icon = isVideo ? '▶' : isAudio ? '♪' : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-600 dark:focus:ring-zinc-500"
      title={isVideo ? t.playVideo : isAudio ? t.playAudio : t.preview}
    >
      {icon ? (
        <span className="flex h-full w-full items-center justify-center bg-zinc-100 text-lg dark:bg-zinc-800">
          {icon}
        </span>
      ) : (
        <img
          src={filesApi.previewUrl(file.id)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </button>
  );
}

export default PreviewThumb
