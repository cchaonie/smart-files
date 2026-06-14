import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useI18n } from '@smart-files/shared/src/i18n';
import { albumsApi } from '../api/albums';
import { AlbumsIcon, PlusIcon, XMarkIcon } from './icons';
import type { Album } from '../types';

interface AlbumPickerProps {
  visible: boolean;
  photoId: string;
  onClose: () => void;
  onAdded?: (albumId: string) => void;
}

export function AlbumPicker({ visible, photoId, onClose, onAdded }: AlbumPickerProps) {
  const { t } = useI18n();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const data = await albumsApi.list();
      setAlbums(data.albums);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadAlbums();
  }, [visible, loadAlbums]);

  async function handleSelect(albumId: string) {
    setAddingId(albumId);
    try {
      await albumsApi.addPhoto(albumId, photoId);
      onAdded?.(albumId);
    } catch {
      // already added or error
    } finally {
      setAddingId(null);
      onClose();
    }
  }

  async function handleCreateAndAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const album = await albumsApi.create({ name: createName.trim() });
      setShowCreate(false);
      setCreateName('');
      await handleSelect(album.id);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-6"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {t.addPhoto}
              </h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <XMarkIcon className="w-5 h-5 text-zinc-500" />
              </button>
            </div>

            {/* Album list */}
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-zinc-300 dark:border-zinc-600 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : albums.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-8">{t.noAlbums}</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1">
                {albums.map((album) => {
                  const adding = addingId === album.id;
                  return (
                    <button
                      key={album.id}
                      onClick={() => void handleSelect(album.id)}
                      disabled={adding}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-50 text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                        <AlbumsIcon className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {album.name}
                        </p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500">
                          {album.photoCount} {t.photos}
                        </p>
                      </div>
                      {adding ? (
                        <div className="w-4 h-4 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
                      ) : (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{t.addPhoto}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Create album */}
            {!showCreate ? (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-1.5 mt-3 py-3 rounded-xl border border-dashed border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>{t.createAlbum}</span>
              </button>
            ) : (
              <form onSubmit={handleCreateAndAdd} className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                <input
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder={t.albumName}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreate(false); setCreateName(''); }}
                    className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !createName.trim()}
                    className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
                  >
                    {creating ? '...' : '创建并添加'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
