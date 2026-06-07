import { useState, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { useI18n } from '@smart-files/shared/src/i18n';
import { useUpload } from '../context/UploadContext';
import { UploadCard, UploadHistoryCard } from '../components/UploadCard';
import { EmptyState } from '../components/EmptyState';
import { FolderPickerModal } from '../components/FolderPickerModal';
import { CloudArrowUpIcon, PauseIcon, PlayIcon, XMarkIcon } from '../components/icons';

export function UploadsPage() {
  const { t } = useI18n();
  const {
    uploads,
    history,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryUpload,
    pauseAll,
    resumeAll,
    cancelAll,
    clearHistory,
    removeFromHistory,
    maxParallel,
    setMaxParallel,
  } = useUpload();

  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetFolderRef = useRef<{ folderId?: string; folderName?: string }>({});

  const activeUploads = uploads.filter(u => u.status !== 'done');
  const hasActive = activeUploads.length > 0;

  function handleAddFiles() {
    setShowFolderPicker(true);
  }

  function handleFolderSelected(folderId: string | null, folderName: string) {
    setShowFolderPicker(false);
    targetFolderRef.current = { folderId: folderId ?? undefined, folderName };
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    const target = targetFolderRef.current;
    if (files && files.length > 0) {
      startUpload(Array.from(files), target.folderId, target.folderName);
    }
    e.target.value = '';
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t.uploads}</h1>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />

      {hasActive && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
          <button onClick={pauseAll} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700">
            <PauseIcon className="w-4 h-4" />
          </button>
          <button onClick={resumeAll} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700">
            <PlayIcon className="w-4 h-4" />
          </button>
          <button onClick={cancelAll} className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700">
            <XMarkIcon className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-zinc-500">{t.parallelUploads}:</span>
            <button
              onClick={() => setMaxParallel(Math.max(1, maxParallel - 1))}
              className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-sm"
            >-</button>
            <span className="text-sm font-medium w-4 text-center">{maxParallel}</span>
            <button
              onClick={() => setMaxParallel(Math.min(10, maxParallel + 1))}
              className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-sm"
            >+</button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {activeUploads.map(item => (
          <UploadCard
            key={item.id}
            item={item}
            onPause={() => pauseUpload(item.id)}
            onResume={() => resumeUpload(item.id)}
            onCancel={() => cancelUpload(item.id)}
            onRetry={() => retryUpload(item.id)}
          />
        ))}
      </AnimatePresence>

      {history.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{t.history}</h2>
            <button
              onClick={clearHistory}
              className="text-xs text-red-500 hover:text-red-600 font-medium"
            >
              {t.clearHistory}
            </button>
          </div>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            {history.map(item => (
              <UploadHistoryCard
                key={item.id}
                item={item}
                onRemove={() => removeFromHistory(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {!hasActive && history.length === 0 && (
        <EmptyState
          icon={<CloudArrowUpIcon className="w-16 h-16" />}
          title={t.noUploadsYet}
          subtitle={t.uploadSubtitle}
          action={
            <button
              onClick={handleAddFiles}
              className="px-4 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium"
            >
              {t.addFiles}
            </button>
          }
        />
      )}

      <FolderPickerModal
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleFolderSelected}
      />
    </div>
  );
}
