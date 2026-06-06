import { motion } from 'motion/react';
import type { FileItem, Folder } from '../types';
import PreviewThumb from './PreviewThumb';
import { FolderIcon, EllipsisVerticalIcon } from './icons';
import { formatBytes, isPreviewable } from '@smart-files/shared/src/utils';

interface FileCardProps {
  item: FileItem | Folder;
  isFolder: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick: () => void;
  onAction: () => void;
}

export function FileCard({ item, isFolder, isSelected, onSelect, onClick, onAction }: FileCardProps) {
  const fileItem = !isFolder ? (item as FileItem) : null;

  return (
    <motion.div
      layout
      whileTap={{ scale: 0.98 }}
      className={`flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="w-5 h-5 rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
          onClick={e => e.stopPropagation()}
        />
      )}

      <div className="flex-shrink-0" onClick={onClick}>
        {isFolder ? (
          <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <FolderIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
        ) : fileItem ? (
          <PreviewThumb file={fileItem} size={48} />
        ) : null}
      </div>

      <div className="flex-1 min-w-0" onClick={onClick}>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.name}</p>
        {fileItem && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {formatBytes(parseInt(fileItem.size))} · {new Date(fileItem.createdAt).toLocaleDateString()}
          </p>
        )}
        {isFolder && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Folder</p>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onAction(); }}
        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Actions"
      >
        <EllipsisVerticalIcon className="w-5 h-5 text-zinc-400" />
      </button>
    </motion.div>
  );
}
