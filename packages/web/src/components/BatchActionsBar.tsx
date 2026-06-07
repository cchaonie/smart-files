import { motion } from 'motion/react';
import { useI18n } from '@smart-files/shared/src/i18n';
import { FolderIcon, TrashIcon, XMarkIcon } from './icons';

interface BatchActionsBarProps {
  count: number;
  onMove: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function BatchActionsBar({ count, onMove, onDelete, onCancel }: BatchActionsBarProps) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      exit={{ y: 100 }}
      className="fixed bottom-20 left-4 right-4 z-20 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl shadow-xl p-3 flex items-center gap-2"
    >
      <span className="text-sm font-medium px-2">{t.selectedCount.replace('{n}', String(count))}</span>
      <div className="flex-1" />
      <button
        onClick={onMove}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-sm font-medium transition-colors"
      >
        <FolderIcon className="w-4 h-4" />
        {t.moveFile}
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-medium transition-colors"
      >
        <TrashIcon className="w-4 h-4" />
        {t.delete}
      </button>
      <button
        onClick={onCancel}
        className="p-2 rounded-xl hover:bg-zinc-700 transition-colors"
        aria-label="Cancel selection"
      >
        <XMarkIcon className="w-5 h-5" />
      </button>
    </motion.div>
  );
}
