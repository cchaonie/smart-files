import { useCallback, useEffect, useState } from 'react'
import type { FileItem, Folder } from '../types'
import { filesApi } from '../api/files'
import { useI18n } from '@smart-files/shared/src/i18n'

function MoveFileModal({
  files,
  onClose,
  onMoved,
}: {
  files: FileItem[];
  onClose: () => void;
  onMoved: () => void;
}) {
  const { t } = useI18n();
  const [modalPath, setModalPath] = useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const modalParentId =
    modalPath.length === 0 ? null : modalPath[modalPath.length - 1].id;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await filesApi.browse(modalParentId);
      setFolders(data.folders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.failedToLoadFolders);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [modalParentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sameLocation = files.every(file =>
    (file.folderId === null && modalParentId === null) || file.folderId === modalParentId
  );

  async function confirmMove() {
    setErr(null);
    try {
      await filesApi.batchMove(files.map(f => f.id), modalParentId);
      onMoved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.moveFailed);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t.moveFileTitle}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {files.length === 1 ? t.moveFileTitle : `Move ${files.length} items`}
          </h3>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {files.length === 1 ? files[0].name : `${files.length} items selected`}
          </p>
        </div>
        <div className="border-b border-zinc-100 px-4 py-2 text-xs dark:border-zinc-800">
          <span className="text-zinc-500">{t.into}</span>
          <button
            type="button"
            className="text-zinc-900 underline dark:text-zinc-100"
            onClick={() => setModalPath([])}
          >
            {t.root}
          </button>
          {modalPath.map((seg, i) => (
            <span key={seg.id}>
              <span className="mx-1 text-zinc-400">/</span>
              <button
                type="button"
                className="text-zinc-900 underline dark:text-zinc-100"
                onClick={() => setModalPath(modalPath.slice(0, i + 1))}
              >
                {seg.name}
              </button>
            </span>
          ))}
        </div>
        <div className="max-h-48 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-2 text-sm text-zinc-500">{t.loadingElipsis}</p>
          ) : folders.length === 0 ? (
            <p className="px-2 py-2 text-sm text-zinc-500">{t.noSubfolders}</p>
          ) : (
            <ul className="space-y-1">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    onClick={() =>
                      setModalPath((p) => [...p, { id: f.id, name: f.name }])
                    }
                  >
                    {f.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {err ? (
          <p className="px-4 py-2 text-sm text-red-600 dark:text-red-400">{err}</p>
        ) : null}
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
            onClick={onClose}
          >
            {t.cancel}
          </button>
          <button
            type="button"
            disabled={sameLocation}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            onClick={() => void confirmMove()}
          >
            {t.moveHere}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MoveFileModal
