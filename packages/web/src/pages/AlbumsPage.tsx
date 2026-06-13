import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@smart-files/shared/src/i18n';
import { albumsApi } from '../api/albums';
import type { Album } from '../types';
import { AlbumsIcon, PlusIcon, ImageIcon, XMarkIcon } from '../components/icons';
import { AnimatePresence, motion } from 'motion/react';

function SkeletonCards() {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-zinc-200 dark:bg-zinc-800 h-24" />
      ))}
    </div>
  );
}

function formatDate(dateStr: string, lang: string): string {
  const d = new Date(dateStr);
  if (lang === 'zh-CN') {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return d.toLocaleDateString(lang, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function AlbumsPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await albumsApi.list();
      setAlbums(data.albums);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [t.failedToLoad]);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await albumsApi.create({ name: createName.trim(), description: createDescription.trim() || undefined });
      setShowCreate(false);
      setCreateName('');
      setCreateDescription('');
      await loadAlbums();
    } catch {
      alert(t.createAlbum);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {t.albums}
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          <span>{t.createAlbum}</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => void loadAlbums()}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && <SkeletonCards />}

      {/* Empty state */}
      {!loading && !error && albums.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlbumsIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">{t.noAlbums}</p>
        </div>
      )}

      {/* Album list */}
      {!loading && !error && albums.length > 0 && (
        <div className="space-y-3">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => navigate(`/albums/${album.id}`)}
              className="w-full text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {album.name}
                  </h3>
                  {album.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {album.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {album.photoCount} {t.photos}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDate(album.createdAt, lang)}
                    </span>
                  </div>
                </div>
                <ImageIcon className="w-10 h-10 text-zinc-300 dark:text-zinc-600 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Album Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
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
                  {t.createAlbum}
                </h2>
                <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <XMarkIcon className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.albumName}
                  </label>
                  <input
                    type="text"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    placeholder={t.albumName}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {t.albumDescription}
                  </label>
                  <textarea
                    value={createDescription}
                    onChange={e => setCreateDescription(e.target.value)}
                    placeholder={t.albumDescription}
                    rows={3}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creating || !createName.trim()}
                  className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium disabled:opacity-50"
                >
                  {creating ? t.uploading : t.create}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
