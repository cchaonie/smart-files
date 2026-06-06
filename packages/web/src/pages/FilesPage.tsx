import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { filesApi, foldersApi } from '../api/files'
import { uploadApi, CHUNK_SIZE } from '../api/upload'
import type { FileItem, Folder, UploadProgress } from '../types'
import { formatBytes, isPreviewable } from '@smart-files/shared/src/utils'
import { useI18n, tFormat } from '@smart-files/shared/src/i18n'
import PreviewThumb from '../components/PreviewThumb'
import MoveFileModal from '../components/MoveFileModal'
import ShareModal from '../components/ShareModal'
import MediaPreview from '../components/MediaPreview'

export function FilesPage() {
  const { logout } = useAuth()
  const { t } = useI18n();
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const currentParentId = path.length === 0 ? null : path[path.length - 1].id;

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [newFolderName, setNewFolderName] = useState('');

  const [uploadItems, setUploadItems] = useState<UploadProgress[]>([]);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const persistKeyRef = useRef<Map<number, string>>(new Map());
  const [parallelCount, setParallelCount] = useState(5);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
  const [viewingTrash, setViewingTrash] = useState(false);
  const [trashFiles, setTrashFiles] = useState<Array<{
    id: string; name: string; size: string; folderName: string | null;
    deletedAt: string; folderId: string | null;
  }> | null>(null);
  const [trashLoading, setTrashLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; name: string; size: string; mimeType: string | null;
    folderId: string | null; createdAt: string; folderName: string | null;
  }> | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesByItemId = useRef<Map<number, File>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<number>>(new Set());
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());

  function toggleFileSelect(id: string) {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiles() {
    setSelectedFileIds(prev => 
      prev.size === files.length ? new Set() : new Set(files.map(f => f.id))
    );
  }

  function toggleUploadSelect(id: number) {
    setSelectedUploadIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleTrashSelect(id: string) {
    setSelectedTrashIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearAllSelections() {
    setSelectedFileIds(new Set());
    setSelectedUploadIds(new Set());
    setSelectedTrashIds(new Set());
  }

  async function handleBatchDelete() {
    if (!confirm(tFormat(t.deleteConfirm, { n: selectedFileIds.size }))) return;
    try {
      await filesApi.batchDelete(Array.from(selectedFileIds));
      setSelectedFileIds(new Set());
      await loadBrowse();
    } catch (err) { alert(err instanceof Error ? err.message : t.batchDeleteFailed); }
  }

  async function handleBatchRestore() {
    try {
      await filesApi.batchRestore(Array.from(selectedTrashIds));
      setSelectedTrashIds(new Set());
      await loadTrash();
    } catch (err) { alert(err instanceof Error ? err.message : t.batchRestoreFailed); }
  }

  async function handleBatchPurge() {
    if (!confirm(tFormat(t.deleteSelectedConfirm, { n: selectedTrashIds.size }))) return;
    try {
      await filesApi.batchPurge(Array.from(selectedTrashIds));
      setSelectedTrashIds(new Set());
      await loadTrash();
    } catch (err) { alert(err instanceof Error ? err.message : t.batchPurgeFailed); }
  }

  // Escape to deselect
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') clearAllSelections();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadBrowse = useCallback(async () => {
    setListError(null);
    setLoading(true);
    try {
      const data = await filesApi.browse(currentParentId);
      setFolders(data.folders);
      setFiles(data.files);
    } catch (e) {
      setListError(e instanceof Error ? e.message : t.failedToLoad);
      setFolders([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [currentParentId]);

  useEffect(() => {
    void loadBrowse();
  }, [loadBrowse]);

  async function doSearch(q: string) {
    const trimmed = q.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const results = await filesApi.search(trimmed);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(value), 300);
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults(null);
    setSearchLoading(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }

  async function loadTrash() {
    setTrashLoading(true);
    try {
      const files = await filesApi.listTrash();
      setTrashFiles(files);
    } catch {
      setTrashFiles([]);
    } finally {
      setTrashLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    const files = fileList && fileList.length > 0 ? Array.from(fileList) : [];

    e.target.value = '';

    if (files.length > 0) {
      void runUploadQueue(files);
    }
  }

  async function retryUpload(itemId: number) {
    const file = filesByItemId.current.get(itemId);
    if (!file) return;
    abortRef.current = false;
    pausedRef.current = false;
    await runUpload(file, itemId);
    await loadBrowse();
  }

  async function removeFile(id: string) {
    if (!confirm(t.deleteFile)) return;
    try {
      await filesApi.deleteFile(id);
      await loadBrowse();
    } catch (e) {
      alert(e instanceof Error ? e.message : t.deleteFailed);
    }
  }

  async function runUpload(file: File, itemId: number) {
    try {
      setUploadItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'uploading' } : item));
      const session = await uploadApi.createSession(file.name, file.size, currentParentId ?? undefined);
      persistKeyRef.current.set(itemId, session.uploadId);

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadedChunks = new Set<number>();

      while (uploadedChunks.size < totalChunks && !abortRef.current) {
        while (pausedRef.current && !abortRef.current) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (abortRef.current) break;

        const nextIndex = uploadedChunks.size;
        const start = nextIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();

        try {
          await uploadApi.uploadChunk(session.uploadId, nextIndex, arrayBuffer);
          uploadedChunks.add(nextIndex);
          const progress = Math.round((uploadedChunks.size / totalChunks) * 100);
          setUploadItems(prev => prev.map(item => item.id === itemId ? { ...item, progress } : item));
        } catch {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      if (!abortRef.current) {
        await uploadApi.completeUpload(session.uploadId, file.type);
        await uploadApi.waitForCompletion(session.uploadId);
        setUploadItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'done', progress: 100 } : item));
      } else {
        setUploadItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'error', error: t.aborted } : item));
      }
    } catch (e) {
      setUploadItems(prev => prev.map(item => item.id === itemId ? { ...item, status: 'error', error: e instanceof Error ? e.message : t.uploadFailed } : item));
    }
  }

  async function runUploadQueue(files: File[]) {
    const items: UploadProgress[] = files.map((file, i) => {
      const id = Date.now() + i;
      filesByItemId.current.set(id, file);
      return { id, name: file.name, progress: 0, status: 'pending' as const };
    });
    setUploadItems(prev => [...prev, ...items]);

    const running = new Set<Promise<void>>();
    for (const item of items) {
      const task = runUpload(filesByItemId.current.get(item.id)!, item.id).then(() => { running.delete(task); });
      running.add(task);
      if (running.size >= parallelCount) {
        await Promise.race(running);
      }
    }
    await Promise.all(running);
    await loadBrowse();
  }

  async function handleRestore(id: string) {
    try {
      await filesApi.restoreFile(id);
      await loadTrash();
    } catch {
      alert(t.restoreFailed);
    }
  }

  async function handlePurge(id: string) {
    if (!confirm(t.confirmDeleteTitle)) return;
    try {
      await filesApi.purgeFile(id);
      await loadTrash();
    } catch {
      alert(t.deleteFailed);
    }
  }

  async function handleEmptyTrash() {
    if (!confirm(t.deleteSelectedConfirm.replace('{n}', String(trashFiles?.length ?? 0)))) return;
    try {
      await filesApi.emptyTrash();
      await loadTrash();
    } catch {
      alert(t.batchPurgeFailed);
    }
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await foldersApi.createFolder({ name: newFolderName.trim(), parentId: currentParentId ?? undefined });
      setNewFolderName('');
      await loadBrowse();
    } catch {
      alert(t.createFolderFailed);
    }
  }

  async function renameFolder(folder: Folder) {
    const name = prompt(t.renameFolder, folder.name);
    if (!name || name === folder.name) return;
    try {
      await foldersApi.renameFolder(folder.id, name);
      await loadBrowse();
    } catch {
      alert(t.renameFailed);
    }
  }

  async function deleteFolder(folder: Folder) {
    if (!confirm(tFormat(t.deleteFolderConfirm, { name: folder.name }))) return;
    try {
      await foldersApi.deleteFolder(folder.id);
      await loadBrowse();
    } catch {
      alert(t.deleteFailed);
    }
  }

  const empty = !loading && folders.length === 0 && files.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {t.yourFiles}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t.filesSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setViewingTrash(!viewingTrash);
            if (!viewingTrash) loadTrash();
          }}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {viewingTrash ? `← ${t.backToFiles}` : `🗑️ ${t.trash}`}
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = '/';
          }}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {t.signOut}
        </button>
      </header>

      <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        <button
          type="button"
          className="font-medium text-zinc-900 underline dark:text-zinc-100"
          onClick={() => setPath([])}
        >
          {t.root}
        </button>
        {path.map((seg, i) => (
          <span key={seg.id} className="flex items-center gap-1">
            <span className="text-zinc-400">/</span>
            <button
              type="button"
              className="font-medium text-zinc-900 underline dark:text-zinc-100"
              onClick={() => setPath(path.slice(0, i + 1))}
            >
              {seg.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); doSearch(searchQuery); } }}
          placeholder={t.searchPlaceholder}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 pl-10 text-sm text-zinc-900 placeholder-zinc-400 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder-zinc-500"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500">🔍</span>
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        )}
      </div>

      {viewingTrash ? (
        <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              🗑️ {t.trashTitle}
            </h2>
            {trashFiles && trashFiles.length > 0 && (
              <button
                type="button"
                onClick={() => void handleEmptyTrash()}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              >
                {t.emptyTrash}
              </button>
            )}
          </div>
          {trashLoading ? (
            <p className="text-sm text-zinc-500">{t.loadingElipsis}</p>
          ) : !trashFiles || trashFiles.length === 0 ? (
            <p className="text-sm text-zinc-500">{t.trashEmpty}</p>
          ) : (
            <>
            {selectedTrashIds.size > 0 && (
              <div className="mb-3 flex items-center gap-3 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 dark:border-zinc-600 dark:bg-zinc-800">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {tFormat(t.selectedCount, { n: selectedTrashIds.size })}
                </span>
                <button
                  type="button"
                  className="text-sm text-green-600 underline dark:text-green-400"
                  onClick={() => void handleBatchRestore()}
                >
                  {t.restore}
                </button>
                <button
                  type="button"
                  className="text-sm text-red-600 underline dark:text-red-400"
                  onClick={() => void handleBatchPurge()}
                >
                  {t.deletePermanently}
                </button>
                <button
                  type="button"
                  className="text-sm text-zinc-600 underline dark:text-zinc-400"
                  onClick={() => setSelectedTrashIds(new Set())}
                >
                  {t.deselect}
                </button>
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="w-10 px-4 py-2"></th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">{t.colName}</th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">{t.colFolder}</th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">{t.colSize}</th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">{t.colDeleted}</th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">{t.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {trashFiles.map((f) => (
                    <tr key={f.id} className={`border-t border-zinc-100 dark:border-zinc-800 ${
                      selectedTrashIds.has(f.id) ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                    }`}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={selectedTrashIds.has(f.id)}
                          onChange={() => toggleTrashSelect(f.id)}
                          className="h-4 w-4 rounded"
                        />
                      </td>
                      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">{f.name}</td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {f.folderName || t.root}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {formatBytes(BigInt(f.size))}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {new Date(f.deletedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="text-green-600 underline dark:text-green-400"
                            onClick={() => void handleRestore(f.id)}
                          >
                            {t.restore}
                          </button>
                          <button
                            type="button"
                            className="text-red-600 underline dark:text-red-400"
                            onClick={() => void handlePurge(f.id)}
                          >
                            {t.deletePermanently}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      ) : (
      <>

      {searchResults === null ? (
      <>

      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <form className="flex flex-wrap items-end gap-2" onSubmit={createFolder}>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            {t.newFolder}
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t.folderName}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t.create}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-6 dark:border-zinc-600 dark:bg-zinc-900/50">
        <input
          id="file-upload"
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={onFileChange}
        />
        <label
          htmlFor="file-upload"
          className="flex cursor-pointer flex-col items-center gap-2 text-center"
        >
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {t.uploadIntoFolder}
          </span>
          <span className="text-xs text-zinc-500">
            {tFormat(t.chunkInfo, { n: CHUNK_SIZE / (1024 * 1024) })}
          </span>
          <span className="mt-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            {t.chooseFiles}
          </span>
        </label>
        {uploadItems.length > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-700">
              <span className="text-xs text-zinc-600 dark:text-zinc-400">
                {t.parallelUploads}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  onClick={() => setParallelCount((c) => Math.max(1, c - 1))}
                >
                  -
                </button>
                <span className="min-w-[1.5rem] text-center text-xs font-medium">
                  {parallelCount}
                </span>
                <button
                  type="button"
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                  onClick={() => setParallelCount((c) => Math.min(10, c + 1))}
                >
                  +
                </button>
              </div>
            </div>
            {uploadItems.map((item) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={selectedUploadIds.has(item.id)}
                    onChange={() => toggleUploadSelect(item.id)}
                    className="h-3.5 w-3.5 rounded"
                  />
                  <span className="truncate pr-2">
                    {item.status === 'done'
                      ? t.done
                      : item.status === 'error'
                      ? t.error
                      : item.status === 'uploading'
                      ? t.uploading
                      : t.pending}
                    {' · '}
                    {item.name}
                  </span>
                  {item.status === 'uploading' || item.status === 'done' ? (
                    <span>{item.progress}%</span>
                  ) : null}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className={`h-full transition-all ${
                      item.status === 'error'
                        ? 'bg-red-500 dark:bg-red-400'
                        : item.status === 'done'
                        ? 'bg-green-600 dark:bg-green-400'
                        : 'bg-zinc-800 dark:bg-zinc-200'
                    }`}
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                {item.error ? (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {item.error}
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-red-300 px-2 py-0.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
                      onClick={() => void retryUpload(item.id)}
                    >
                      {t.retry}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                onClick={() => {
                  pausedRef.current = !pausedRef.current;
                }}
              >
                {t.pauseResume}
              </button>
              <button
                type="button"
                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:text-red-300"
                onClick={() => {
                  abortRef.current = true;
                  pausedRef.current = false;
                  persistKeyRef.current.forEach((key) => {
                    sessionStorage.removeItem(key);
                  });
                  persistKeyRef.current.clear();
                }}
              >
                {t.cancelAll}
              </button>
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
                onClick={() => {
                  const allDone = uploadItems.every(
                    (it) => it.status === 'done' || it.status === 'error'
                  );
                  if (allDone) setUploadItems([]);
                }}
              >
                {t.clearCompleted}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            {t.contents}
          </h2>
          <button
            type="button"
            onClick={() => void loadBrowse()}
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            {t.refresh}
          </button>
        </div>
        {listError ? <p className="text-sm text-red-600">{listError}</p> : null}
        {loading ? (
          <p className="text-sm text-zinc-500">{t.loadingElipsis}</p>
        ) : empty ? (
          <p className="text-sm text-zinc-500">{t.folderEmpty}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            {selectedFileIds.size > 0 && (
              <div className="mb-3 flex items-center gap-3 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-2 dark:border-zinc-600 dark:bg-zinc-800">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  {tFormat(t.selectedCount, { n: selectedFileIds.size })}
                </span>
                <button
                  type="button"
                  className="text-sm text-red-600 underline dark:text-red-400"
                  onClick={() => void handleBatchDelete()}
                >
                  {t.delete}
                </button>
                <button
                  type="button"
                  className="text-sm text-zinc-600 underline dark:text-zinc-400"
                  onClick={clearAllSelections}
                >
                  {t.deselect}
                </button>
              </div>
            )}
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      checked={files.length > 0 && selectedFileIds.size === files.length}
                      onChange={toggleSelectAllFiles}
                      className="h-4 w-4 rounded"
                    />
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    {t.preview}
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    {t.colName}
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    {t.colSize}
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    {t.colAdded}
                  </th>
                  <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                    {t.colActions}
                  </th>
                </tr>
              </thead>
              <tbody>
                {folders.map((folder) => (
                  <tr
                    key={`d-${folder.id}`}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-4 py-2 align-middle text-zinc-400">—</td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                      <span className="mr-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        {t.folderLabel}
                      </span>
                      {folder.name}
                    </td>
                    <td className="px-4 py-2 text-zinc-500">—</td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(folder.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-zinc-900 underline dark:text-zinc-100"
                          onClick={() =>
                            setPath((p) => [
                              ...p,
                              { id: folder.id, name: folder.name },
                            ])
                          }
                        >
                          {t.open}
                        </button>
                        <button
                          type="button"
                          className="text-zinc-700 underline dark:text-zinc-300"
                          onClick={() => void renameFolder(folder)}
                        >
                          {t.rename}
                        </button>
                        <button
                          type="button"
                          className="text-red-600 underline dark:text-red-400"
                          onClick={() => void deleteFolder(folder)}
                        >
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {files.map((f) => (
                  <tr
                    key={f.id}
                    className={`border-t border-zinc-100 dark:border-zinc-800 ${
                      selectedFileIds.has(f.id) ? 'bg-zinc-100 dark:bg-zinc-800' : ''
                    }`}
                  >
                    <td className="px-4 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={selectedFileIds.has(f.id)}
                        onChange={() => toggleFileSelect(f.id)}
                        className="h-4 w-4 rounded"
                      />
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <PreviewThumb file={f} onOpen={() => setPreviewFile(f)} />
                    </td>
                    <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                      {f.name}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {formatBytes(BigInt(f.size))}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                      {new Date(f.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {isPreviewable(f.mimeType, f.name) ? (
                          <button
                            type="button"
                            className="text-zinc-900 underline dark:text-zinc-100"
                            onClick={() => setPreviewFile(f)}
                          >
                            {t.preview}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-zinc-700 underline dark:text-zinc-300"
                          onClick={() => setShareTarget(f)}
                        >
                          {t.share}
                        </button>
                        <button
                          type="button"
                          className="text-zinc-700 underline dark:text-zinc-300"
                          onClick={() => setMoveTarget(f)}
                        >
                          {t.moveFile}
                        </button>
                        <a
                          href={filesApi.downloadUrl(f.id)}
                          className="text-zinc-900 underline dark:text-zinc-100"
                          download={f.name}
                        >
                          {t.download}
                        </a>
                        <button
                          type="button"
                          className="text-zinc-700 underline dark:text-zinc-300"
                          onClick={() => {
                            const name = window.prompt(t.newNamePrompt, f.name);
                            if (name && name.trim()) {
                              filesApi.renameFile(f.id, name.trim()).then(() => loadBrowse());
                            }
                          }}
                        >
                          {t.rename}
                        </button>
                        <button
                          type="button"
                          className="text-red-600 underline dark:text-red-400"
                          onClick={() => void removeFile(f.id)}
                        >
                          {t.delete}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {shareTarget && <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />}

      {previewFile && <MediaPreview file={previewFile} onClose={() => setPreviewFile(null)} />}

      {moveTarget ? (
        <MoveFileModal
          file={moveTarget}
          onClose={() => setMoveTarget(null)}
          onMoved={() => loadBrowse()}
        />
      ) : null}

      </>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
              {t.searchResults}
            </h2>
            <button
              type="button"
              onClick={clearSearch}
              className="text-sm text-zinc-600 underline dark:text-zinc-400"
            >
              {t.clearSearch}
            </button>
          </div>
          {searchLoading ? (
            <p className="text-sm text-zinc-500">{t.searching}</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-zinc-500">{t.noMatchingFiles}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      {t.colName}
                    </th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      {t.colFolder}
                    </th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      {t.colSize}
                    </th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      {t.colAdded}
                    </th>
                    <th className="px-4 py-2 font-medium text-zinc-700 dark:text-zinc-300">
                      {t.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((f) => (
                    <tr
                      key={f.id}
                      className="border-t border-zinc-100 dark:border-zinc-800"
                    >
                      <td className="px-4 py-2 text-zinc-900 dark:text-zinc-100">
                        {f.name}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {f.folderName ? (
                          <button
                            type="button"
                            className="underline hover:text-zinc-900 dark:hover:text-zinc-200"
                            onClick={() => {
                              // Navigate to the folder if we have folderId
                              // We don't have full path, but we can reset and use folder info
                              if (f.folderId) {
                                // Set path to navigate into the folder
                                // This is a simple approach: just set the folder
                                setSearchResults(null);
                                setSearchQuery('');
                                setPath([{ id: f.folderId, name: f.folderName || t.unknownFolder }]);
                              }
                            }}
                          >
                            {f.folderName}
                          </button>
                        ) : (
                          <span className="text-zinc-400">{t.root}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {formatBytes(BigInt(f.size))}
                      </td>
                      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                        {new Date(f.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={filesApi.downloadUrl(f.id)}
                            className="text-zinc-900 underline dark:text-zinc-100"
                            download={f.name}
                          >
                            {t.download}
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      </>
      )}
    </div>
  );
}