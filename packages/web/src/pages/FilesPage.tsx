import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { useSearchParams } from 'react-router-dom'
import { filesApi, foldersApi } from '../api/files'
import type { FileItem, Folder } from '../types'
import { formatBytes, isPreviewable } from '@smart-files/shared/src/utils'
import { useI18n, tFormat } from '@smart-files/shared/src/i18n'
import MoveFileModal from '../components/MoveFileModal'
import ShareModal from '../components/ShareModal'
import MediaPreview from '../components/MediaPreview'
import { FileCard } from '../components/FileCard'
import { UploadFAB } from '../components/UploadFAB'
import { BatchActionsBar } from '../components/BatchActionsBar'
import { BottomSheet } from '../components/BottomSheet'
import { EmptyState } from '../components/EmptyState'
import {
  FolderIcon, TrashIcon, MagnifyingGlassIcon,
  CloudArrowUpIcon, EyeIcon, ArrowRightIcon
} from '../components/icons'

const PATH_STORAGE_KEY = 'smartfiles:filesPagePath';

function loadStoredPath(): { id: string; name: string }[] {
  try {
    const raw = sessionStorage.getItem(PATH_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function storePath(path: { id: string; name: string }[]) {
  sessionStorage.setItem(PATH_STORAGE_KEY, JSON.stringify(path));
}

export function FilesPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const folderIdFromUrl = searchParams.get('folder');

  // On mount: URL param takes precedence → fetch path from API if needed
  const [path, setPath] = useState<{ id: string; name: string }[]>(() => {
    if (folderIdFromUrl) {
      // URL has a folder → we'll fetch the path in a mount effect
      return [];
    }
    // No URL param → try sessionStorage cache
    const stored = loadStoredPath();
    return stored;
  });
  const [initialPathDone, setInitialPathDone] = useState(!folderIdFromUrl);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [moveTargets, setMoveTargets] = useState<FileItem[]>([]);
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

  // Multi-select + action sheet state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [actionFile, setActionFile] = useState<FileItem | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());
  const currentParentId = path.length === 0 ? null : path[path.length - 1].id;

  function toggleFileSelect(id: string) {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleFolderSelect(id: string) {
    setSelectedFolderIds(prev => {
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
    setSelectedFolderIds(new Set());
    setSelectedTrashIds(new Set());
  }

  async function handleBatchDelete() {
    if (!window.confirm(tFormat(t.deleteConfirm, { n: selectedFileIds.size + selectedFolderIds.size }))) return;
    try {
      if (selectedFileIds.size > 0) await filesApi.batchDelete(Array.from(selectedFileIds));
      for (const fid of selectedFolderIds) await foldersApi.deleteFolder(fid);
      setSelectedFileIds(new Set());
      setSelectedFolderIds(new Set());
      setIsSelecting(false);
      await loadBrowse();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.batchDeleteFailed);
    }
  }

  async function handleBatchRestore() {
    try {
      await filesApi.batchRestore(Array.from(selectedTrashIds));
      setSelectedTrashIds(new Set());
      await loadTrash();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.batchRestoreFailed);
    }
  }

  async function handleBatchPurge() {
    if (!window.confirm(tFormat(t.deleteSelectedConfirm, { n: selectedTrashIds.size }))) return;
    try {
      await filesApi.batchPurge(Array.from(selectedTrashIds));
      setSelectedTrashIds(new Set());
      await loadTrash();
    } catch (err) {
      alert(err instanceof Error ? err.message : t.batchPurgeFailed);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        clearAllSelections();
        setIsSelecting(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mount effect: if URL has a folder param, fetch the ancestor path from API
  useEffect(() => {
    if (!folderIdFromUrl) return;
    foldersApi.getFolderPath(folderIdFromUrl)
      .then(folderPath => {
        setPath(folderPath);
        setInitialPathDone(true);
      })
      .catch(() => {
        // Folder was deleted or invalid — stay at root, clear URL param
        setPath([]);
        setInitialPathDone(true);
        setSearchParams({}, { replace: true });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync path to URL + sessionStorage whenever it changes (after initial mount)
  useEffect(() => {
    if (!initialPathDone) return;
    storePath(path);
    const lastId = path.length > 0 ? path[path.length - 1].id : null;
    if (lastId) {
      setSearchParams({ folder: lastId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [path, initialPathDone, setSearchParams]);

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
    if (!initialPathDone) return;
    void loadBrowse();
  }, [loadBrowse, initialPathDone]);

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

  async function handleRestore(id: string) {
    try {
      await filesApi.restoreFile(id);
      await loadTrash();
    } catch {
      alert(t.restoreFailed);
    }
  }

  async function handlePurge(id: string) {
    if (!window.confirm(t.confirmDeleteTitle)) return;
    try {
      await filesApi.purgeFile(id);
      await loadTrash();
    } catch {
      alert(t.deleteFailed);
    }
  }

  async function handleEmptyTrash() {
    if (!window.confirm(tFormat(t.deleteSelectedConfirm, { n: trashFiles?.length ?? 0 }))) return;
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
    const name = window.prompt(t.renameFolder, folder.name);
    if (!name || name === folder.name) return;
    try {
      await foldersApi.renameFolder(folder.id, name);
      await loadBrowse();
    } catch {
      alert(t.renameFailed);
    }
  }

  async function deleteFolder(folder: Folder) {
    if (!window.confirm(tFormat(t.deleteFolderConfirm, { name: folder.name }))) return;
    try {
      await foldersApi.deleteFolder(folder.id);
      await loadBrowse();
    } catch {
      alert(t.deleteFailed);
    }
  }

  function openActionSheet(file: FileItem) {
    setActionFile(file);
    setShowActionSheet(true);
  }

  function closeActionSheet() {
    setActionFile(null);
    setShowActionSheet(false);
  }

  function handleAction(action: string) {
    if (!actionFile) return;
    switch (action) {
      case 'preview':
        if (isPreviewable(actionFile.mimeType, actionFile.name)) setPreviewFile(actionFile);
        break;
      case 'share':
        setShareTarget(actionFile);
        break;
      case 'move':
        setMoveTargets([actionFile]);
        break;
      case 'download':
        window.open(filesApi.downloadUrl(actionFile.id), '_blank');
        break;
      case 'rename': {
        const newName = window.prompt(t.newNamePrompt, actionFile.name);
        if (newName && newName !== actionFile.name) {
          filesApi.renameFile(actionFile.id, newName).then(() => loadBrowse()).catch(() => {});
        }
        break;
      }
      case 'delete':
        if (window.confirm(t.deleteFile)) {
          filesApi.deleteFile(actionFile.id).then(() => loadBrowse()).catch(() => {});
        }
        break;
    }
    closeActionSheet();
  }

  const empty = !loading && folders.length === 0 && files.length === 0;
  const currentFolderName = path.length === 0 ? t.root : path[path.length - 1].name;

  return (
    <div className="px-4 py-6">
      {/* Header with breadcrumb */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          {viewingTrash ? (
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t.trashTitle}</h1>
          ) : (
            <nav className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400 overflow-x-auto pb-0.5">
              <button onClick={() => setPath([])} className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline whitespace-nowrap">
                {t.root}
              </button>
              {path.map((seg, i) => (
                <span key={seg.id} className="flex items-center gap-1 min-w-0">
                  <span className="text-zinc-400 shrink-0">/</span>
                  <button
                    onClick={() => setPath(path.slice(0, i + 1))}
                    className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline truncate"
                  >
                    {seg.name}
                  </button>
                </span>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {!viewingTrash && (
            <>
              <button
                onClick={() => setIsSelecting(!isSelecting)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {isSelecting ? t.done : t.select}
              </button>
              {isSelecting && (
                <button
                  onClick={() => {
                    const allFileIds = files.map(f => f.id);
                    const allFolderIds = folders.map(f => f.id);
                    const allSelected = [...allFileIds, ...allFolderIds].every(id => selectedFileIds.has(id) || selectedFolderIds.has(id));
                    if (allSelected) {
                      setSelectedFileIds(new Set());
                      setSelectedFolderIds(new Set());
                    } else {
                      setSelectedFileIds(new Set(allFileIds));
                      setSelectedFolderIds(new Set(allFolderIds));
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {[...files, ...folders].every(i => selectedFileIds.has(i.id) || selectedFolderIds.has(i.id)) ? '取消全选' : '全选'}
                </button>
              )}
            </>
          )}
          <button
            onClick={() => {
              setViewingTrash(!viewingTrash);
              if (!viewingTrash) { setSearchResults(null); setSearchQuery(''); void loadTrash(); }
              else { void loadBrowse(); }
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label={viewingTrash ? t.backToFiles : t.trash}
          >
            <TrashIcon className={`w-4 h-4 ${viewingTrash ? 'text-blue-500' : 'text-zinc-500'}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      {!viewingTrash && (
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pl-9 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="text-zinc-400 text-[10px]">✕</span>
            </button>
          )}
        </div>
      )}

      {/* Trash View */}
      {viewingTrash ? (
        <div>
          {trashLoading ? (
            <p className="text-sm text-zinc-500 py-8 text-center">{t.loadingElipsis}</p>
          ) : !trashFiles || trashFiles.length === 0 ? (
            <EmptyState
              icon={<TrashIcon className="w-16 h-16" />}
              title={t.trashEmpty}
            />
          ) : (
            <>
              {/* 全选 / 批量操作栏 */}
              <div className="mb-3 flex items-center gap-3">
                <button
                  onClick={() => {
                    const allIds = trashFiles.map(f => f.id);
                    const allSelected = allIds.every(id => selectedTrashIds.has(id));
                    if (allSelected) {
                      setSelectedTrashIds(new Set());
                    } else {
                      setSelectedTrashIds(new Set(allIds));
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  {trashFiles.every(f => selectedTrashIds.has(f.id)) ? t.deselectAll : t.selectAll}
                </button>
              </div>
              {selectedTrashIds.size > 0 && (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-2">
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {tFormat(t.selectedCount, { n: selectedTrashIds.size })}
                  </span>
                  <div className="flex-1" />
                  <button onClick={() => void handleBatchRestore()} className="text-sm text-green-600 dark:text-green-400 font-medium">
                    {t.restore}
                  </button>
                  <button onClick={() => void handleBatchPurge()} className="text-sm text-red-600 dark:text-red-400 font-medium">
                    {t.deletePermanently}
                  </button>
                  <button onClick={() => setSelectedTrashIds(new Set())} className="text-sm text-zinc-600 dark:text-zinc-400">
                    {t.deselect}
                  </button>
                </div>
              )}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {trashFiles.map((f) => (
                  <div
                    key={f.id}
                    className={`flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 ${selectedTrashIds.has(f.id) ? 'bg-zinc-50 dark:bg-zinc-800/50' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTrashIds.has(f.id)}
                      onChange={() => toggleTrashSelect(f.id)}
                      className="w-5 h-5 rounded border-zinc-300 text-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{f.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {formatBytes(BigInt(f.size))} · {f.folderName || t.root} · {new Date(f.deletedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => void handleRestore(f.id)} className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {t.restore}
                      </button>
                      <button onClick={() => void handlePurge(f.id)} className="text-sm text-red-600 dark:text-red-400 font-medium">
                        {t.deletePermanently}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {trashFiles.length > 0 && (
                <button
                  onClick={() => void handleEmptyTrash()}
                  className="w-full mt-4 py-3 rounded-xl border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  {t.emptyTrash}
                </button>
              )}
            </>
          )}
        </div>
      ) : searchResults === null ? (
        <>
          {/* Folder creation */}
          <form className="flex items-center gap-2 mb-3" onSubmit={createFolder}>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder={t.folderName}
              className="flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium"
            >
              {t.create}
            </button>
          </form>

          {/* File list */}
          {listError ? (
            <p className="text-sm text-red-600 py-8 text-center">{listError}</p>
          ) : loading ? (
            <p className="text-sm text-zinc-500 py-8 text-center">{t.loadingElipsis}</p>
          ) : empty ? (
            <EmptyState
              icon={<FolderIcon className="w-16 h-16" />}
              title={t.folderEmpty}
              subtitle="Upload your first file to get started"
            />
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {folders.map(folder => (
                <div key={folder.id} className={`flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 ${isSelecting && selectedFolderIds.has(folder.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                  {isSelecting ? (
                    <input
                      type="checkbox"
                      checked={selectedFolderIds.has(folder.id)}
                      onChange={() => toggleFolderSelect(folder.id)}
                      className="w-5 h-5 rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div className="w-5" />
                  )}
                  <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <FolderIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{folder.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Folder</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPath(p => [...p, { id: folder.id, name: folder.name }])}
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      {t.open}
                    </button>
                    <button
                      onClick={() => void renameFolder(folder)}
                      className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-500"
                    >
                      {t.rename}
                    </button>
                    <button
                      onClick={() => void deleteFolder(folder)}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-500"
                    >
                      {t.delete}
                    </button>
                  </div>
                </div>
              ))}
              {files.map(file => (
                <FileCard
                  key={file.id}
                  item={file}
                  isFolder={false}
                  isSelected={selectedFileIds.has(file.id)}
                  onSelect={isSelecting ? () => toggleFileSelect(file.id) : undefined}
                  onClick={() => { if (isPreviewable(file.mimeType, file.name)) setPreviewFile(file); }}
                  onAction={() => openActionSheet(file)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Search Results */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t.searchResults}</h2>
            <button onClick={clearSearch} className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              {t.clearSearch}
            </button>
          </div>
          {searchLoading ? (
            <p className="text-sm text-zinc-500 py-8 text-center">{t.searching}</p>
          ) : searchResults.length === 0 ? (
            <EmptyState
              icon={<MagnifyingGlassIcon className="w-16 h-16" />}
              title={t.noMatchingFiles}
            />
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {searchResults.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{f.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {formatBytes(BigInt(f.size))} · {f.folderName || t.root}
                    </p>
                  </div>
                  <a
                    href={filesApi.downloadUrl(f.id)}
                    className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    download={f.name}
                  >
                    {t.download}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB */}
      {!viewingTrash && searchResults === null && <UploadFAB folderId={currentParentId ?? undefined} folderName={currentFolderName} />}

      {/* Batch actions bar */}
      <AnimatePresence>
        {(isSelecting && (selectedFileIds.size > 0 || selectedFolderIds.size > 0)) && (
          <BatchActionsBar
            count={selectedFileIds.size + selectedFolderIds.size}
            onMove={() => {
              const targets = files.filter(f => selectedFileIds.has(f.id));
              if (targets.length > 0) setMoveTargets(targets);
            }}
            onDelete={handleBatchDelete}
            onCancel={() => { setIsSelecting(false); clearAllSelections(); }}
          />
        )}
      </AnimatePresence>

      {/* Action Sheet */}
      <BottomSheet isOpen={showActionSheet} onClose={closeActionSheet} title={actionFile?.name}>
        <div className="flex flex-col">
          {actionFile && isPreviewable(actionFile.mimeType, actionFile.name) && (
            <button onClick={() => handleAction('preview')} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
              <EyeIcon className="w-5 h-5 text-zinc-500" />
              <span className="text-sm text-zinc-900 dark:text-zinc-100">{t.preview}</span>
            </button>
          )}
          <button onClick={() => handleAction('share')} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
            <CloudArrowUpIcon className="w-5 h-5 text-zinc-500" />
            <span className="text-sm text-zinc-900 dark:text-zinc-100">{t.share}</span>
          </button>
          <button onClick={() => handleAction('move')} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
            <FolderIcon className="w-5 h-5 text-zinc-500" />
            <span className="text-sm text-zinc-900 dark:text-zinc-100">{t.moveFile}</span>
          </button>
          <button onClick={() => handleAction('download')} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
            <ArrowRightIcon className="w-5 h-5 text-zinc-500" />
            <span className="text-sm text-zinc-900 dark:text-zinc-100">{t.download}</span>
          </button>
          <button onClick={() => handleAction('rename')} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg">
            <span className="text-sm text-zinc-900 dark:text-zinc-100">{t.rename}</span>
          </button>
          <button onClick={() => handleAction('delete')} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
            <TrashIcon className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-600 dark:text-red-400">{t.delete}</span>
          </button>
        </div>
      </BottomSheet>

      {/* Modals */}
      {shareTarget && <ShareModal file={shareTarget} onClose={() => setShareTarget(null)} />}
      {previewFile && <MediaPreview file={previewFile} onClose={() => setPreviewFile(null)} />}
      {moveTargets.length > 0 && (
        <MoveFileModal
          files={moveTargets}
          onClose={() => { setMoveTargets([]); setSelectedFileIds(new Set()); }}
          onMoved={() => { void loadBrowse(); clearAllSelections(); setIsSelecting(false); }}
        />
      )}
    </div>
  );
}
