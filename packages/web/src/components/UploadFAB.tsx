import { useRef } from 'react';
import { motion } from 'motion/react';
import { useI18n } from '@smart-files/shared/src/i18n';
import { PlusIcon } from './icons';
import { useUpload } from '../context/UploadContext';

interface UploadFABProps {
  folderId?: string;
  folderName?: string;
}

export function UploadFAB({ folderId, folderName }: UploadFABProps) {
  const { t } = useI18n();
  const { startUpload } = useUpload();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      startUpload(Array.from(files), folderId, folderName);
    }
    e.target.value = '';
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={handleChange}
      />
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => inputRef.current?.click()}
        className="fixed bottom-24 right-4 z-20 w-14 h-14 rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center"
        aria-label={t.upload}
      >
        <PlusIcon className="w-6 h-6" />
      </motion.button>
    </>
  );
}
