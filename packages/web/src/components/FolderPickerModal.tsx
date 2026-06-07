import { useCallback, useEffect, useState } from 'react';
import type { Folder } from '../types';
import { filesApi } from '../api/files';
import { useI18n } from '@smart-files/shared/src/i18n';
import { FolderIcon, ChevronRightIcon, HomeIcon, XMarkIcon } from './icons';

export function FolderPickerModal({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (folderId: string | null, folderName: string) => void;
}) {
  const { t } = useI18n();
  const [modalPath, setModalPath] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const modalParentId = modalPath.length === 0 ? null : modalPath[modalPath.length - 1].id;
  const currentName = modalPath.length === 0 ? 'Root' : modalPath[modalPath.length - 1].name;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await filesApi.browse(modalParentId);
      setFolders(data.folders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load folders');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [modalParentId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md sm:mx-4 bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Select Folder</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <XMarkIcon className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-4 py-2 text-sm text-zinc-500 overflow-x-auto">
          <button onClick={() => setModalPath([])} className="flex items-center gap-1 hover:text-zinc-900">
            <HomeIcon className="w-4 h-4" />
          </button>
          {modalPath.map((segment, i) => (
            <span key={segment.id} className="flex items-center gap-1">
              <ChevronRightIcon className="w-3 h-3" />
              <button onClick={() => setModalPath(modalPath.slice(0, i + 1))} className="hover:text-zinc-900 whitespace-nowrap">
                {segment.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => onSelect(modalParentId, currentName)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 mb-2"
          >
            <FolderIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Select "{currentName}"</span>
          </button>

          {loading ? (
            <p className="text-center text-sm text-zinc-500 py-8">{t.loading}</p>
          ) : err ? (
            <p className="text-center text-sm text-red-500 py-8">{err}</p>
          ) : folders.length === 0 ? (
            <p className="text-center text-sm text-zinc-500 py-8">No subfolders</p>
          ) : (
            folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setModalPath(prev => [...prev, { id: folder.id, name: folder.name }])}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-left"
              >
                <FolderIcon className="w-5 h-5 text-amber-500" />
                <span className="text-sm text-zinc-900 dark:text-zinc-100 flex-1">{folder.name}</span>
                <ChevronRightIcon className="w-4 h-4 text-zinc-400" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
