import { useState, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { useI18n, tFormat } from '@smart-files/shared/src/i18n';
import { useUpload } from '../context/UploadContext';
import { filesApi } from '../api/files';
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    const target = targetFolderRef.current;
    if (!fileList || fileList.length === 0) {
      e.target.value = '';
      return;
    }

    const selectedFiles = Array.from(fileList);
    const folderId = target.folderId;
    const uniqueFiles: File[] = [];
    const skipped: { file: File; message: string }[] = [];

    // Track which names have already been checked against the server in this batch
    const serverChecked = new Set<string>();

    for (const file of selectedFiles) {
      // 1) Check upload queue (pending / uploading / paused)
      const inQueue = uploads.some(
        u => u.name === file.name && u.folderId === folderId && (u.status === 'pending' || u.status === 'uploading' || u.status === 'paused')
      );
      if (inQueue) {
        skipped.push({ file, message: tFormat(t.fileAlreadyUploading, { name: file.name }) });
        continue;
      }

      // 2) Check server for already-uploaded files (only once per unique name)
      if (!serverChecked.has(file.name)) {
        serverChecked.add(file.name);
        try {
          const result = await filesApi.checkFileExists(file.name, folderId);
          if (result.exists) {
            skipped.push({ file, message: tFormat(t.fileAlreadyUploaded, { name: file.name, path: result.file!.path }) });
            continue;
          }
        } catch {
          // Server check failed — allow upload anyway
        }
      }

      uniqueFiles.push(file);
    }

    // Show all skip messages at once
    if (skipped.length > 0) {
      const messages = skipped.map(s => s.message);
      // Group duplicate names
      const uniqueMessages = [...new Set(messages)];
      alert(uniqueMessages.join('\n\n'));
    }

    // Upload only the unique files
    if (uniqueFiles.length > 0) {
      startUpload(uniqueFiles, folderId, target.folderName);
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
