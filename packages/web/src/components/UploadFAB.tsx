import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '@smart-files/shared/src/i18n';
import { PlusIcon, FolderIcon } from './icons';
import { useUpload } from '../context/UploadContext';

interface UploadFABProps {
  folderId?: string;
  folderName?: string;
}

export function UploadFAB({ folderId, folderName }: UploadFABProps) {
  const { t } = useI18n();
  const { startUpload, startFolderUpload } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      startUpload(Array.from(files), folderId, folderName);
    }
    e.target.value = '';
    setShowMenu(false);
  }

  async function handleFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      await startFolderUpload(Array.from(files), folderId, folderName);
    }
    e.target.value = '';
    setShowMenu(false);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        /** @ts-ignore - webkitdirectory is a Chromium-specific attribute */
        webkitdirectory=""
        className="sr-only"
        onChange={handleFolderChange}
      />

      {/* Upload menu */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30"
              onClick={() => setShowMenu(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-40 right-4 z-40 flex flex-col gap-2"
            >
              <button
                onClick={() => folderInputRef.current?.click()}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <FolderIcon className="w-5 h-5 text-amber-500" />
                {t.uploadFolder}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-lg border border-zinc-200 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <PlusIcon className="w-5 h-5 text-blue-500" />
                {t.uploadFiles}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowMenu(!showMenu)}
        className="fixed bottom-24 right-4 z-20 w-14 h-14 rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center"
        aria-label={t.upload}
      >
        <PlusIcon className="w-6 h-6" />
      </motion.button>
    </>
  );
}
