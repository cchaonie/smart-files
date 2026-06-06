import { motion } from 'motion/react';
import type { UploadQueueItem, UploadHistoryItem } from '../types';
import { formatBytes } from '@smart-files/shared/src/utils';
import { PauseIcon, PlayIcon, ArrowPathIcon, XMarkIcon, CheckCircleIcon, CloudArrowUpIcon } from './icons';

interface UploadCardProps {
  item: UploadQueueItem;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Queued', color: 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800' },
  uploading: { label: 'Uploading', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  paused: { label: 'Paused', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  done: { label: 'Completed', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  error: { label: 'Error', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
};

export function UploadCard({ item, onPause, onResume, onCancel, onRetry }: UploadCardProps) {
  const status = statusConfig[item.status] ?? statusConfig.pending;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
          <CloudArrowUpIcon className="w-5 h-5 text-zinc-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {formatBytes(item.size)} {item.folderName ? `· ${item.folderName}` : ''}
          </p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${status.color}`}>
          {status.label}
        </span>
      </div>

      {item.status === 'uploading' || item.status === 'paused' ? (
        <div className="mt-3">
          <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${item.progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p className="text-[10px] text-zinc-400 mt-1">{item.progress}%</p>
        </div>
      ) : null}

      {item.error && (
        <p className="text-xs text-red-500 mt-2">{item.error}</p>
      )}

      <div className="flex items-center gap-2 mt-3">
        {item.status === 'uploading' && (
          <button onClick={onPause} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <PauseIcon className="w-4 h-4 text-zinc-600" />
          </button>
        )}
        {item.status === 'paused' && (
          <button onClick={onResume} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <PlayIcon className="w-4 h-4 text-zinc-600" />
          </button>
        )}
        {item.status === 'error' && (
          <button onClick={onRetry} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <ArrowPathIcon className="w-4 h-4 text-zinc-600" />
          </button>
        )}
        {item.status !== 'done' && (
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <XMarkIcon className="w-4 h-4 text-zinc-600" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

interface UploadHistoryCardProps {
  item: UploadHistoryItem;
  onRemove: () => void;
}

export function UploadHistoryCard({ item, onRemove }: UploadHistoryCardProps) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800"
    >
      <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
        <CheckCircleIcon className="w-5 h-5 text-green-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{item.name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {formatBytes(item.size)} {item.folderName ? `· ${item.folderName}` : ''} · {timeAgo(item.completedAt)}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Remove from history"
      >
        <XMarkIcon className="w-4 h-4 text-zinc-400" />
      </button>
    </motion.div>
  );
}
