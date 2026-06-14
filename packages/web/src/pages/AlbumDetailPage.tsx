import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useI18n } from '@smart-files/shared/src/i18n';
import { photosApi } from '../api/photos';
import { albumsApi, usersApi } from '../api/albums';
import type { Album, Photo, ShareEntry } from '../types';
import { ArrowRightIcon, ImageIcon, XMarkIcon, UserIcon, PlusIcon } from '../components/icons';

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 gap-2 animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

export function AlbumDetailPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);

  // Share dialog state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [selectedRole, setSelectedRole] = useState<'VIEWER' | 'CONTRIBUTOR'>('VIEWER');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAlbum = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [albumData, photosData] = await Promise.all([
        albumsApi.getById(id),
        albumsApi.listPhotos(id),
      ]);
      setAlbum(albumData);
      setPhotos(photosData.photos);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failedToLoad);
    } finally {
      setLoading(false);
    }
  }, [id, t.failedToLoad]);

  const loadShares = useCallback(async () => {
    if (!id) return;
    try {
      const data = await albumsApi.listShares(id);
      setShares(data.shares);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    void loadAlbum();
  }, [loadAlbum]);

  // Debounced user search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await usersApi.search(searchQuery.trim());
        setSearchResults(data.users);
      } catch { /* ignore */ } finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  function openShareDialog() {
    setShowShare(true);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUserId(null);
    setSelectedRole('VIEWER');
    void loadShares();
  }

  async function handleShare() {
    if (!id || !selectedUserId) return;
    try {
      await albumsApi.share(id, selectedUserId, selectedRole);
      setSelectedUserId(null);
      setSearchQuery('');
      setSearchResults([]);
      await loadShares();
    } catch {
      alert(t.share);
    }
  }

  async function handleUnshare(userId: string) {
    if (!id) return;
    try {
      await albumsApi.unshare(id, userId);
      await loadShares();
    } catch {
      alert(t.revoke);
    }
  }

  return (
    <div className="px-4 py-6 pb-20">
      {/* Back button */}
      <button
        onClick={() => navigate('/albums')}
        className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 mb-4 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
      >
        <ArrowRightIcon className="w-4 h-4 rotate-180" />
        <span>{t.albums}</span>
      </button>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => void loadAlbum()}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <>
          <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse mb-2" />
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse mb-6" />
          <SkeletonGrid />
        </>
      )}

      {/* Album header */}
      {!loading && !error && album && (
        <>
          <div className="flex items-start justify-between gap-3 mb-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                {album.name}
              </h1>
              {album.description && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{album.description}</p>
              )}
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
                {album.photoCount} {t.photos}
              </p>
            </div>
            <button
              onClick={openShareDialog}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium shrink-0"
            >
              <UserIcon className="w-4 h-4" />
              <span>{t.share}</span>
            </button>
          </div>

          {/* Photo grid */}
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <ImageIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-600" />
              <p className="text-sm text-zinc-400 dark:text-zinc-500">{t.noPhotos}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                >
                  {photo.status === 'READY' ? (
                    <img
                      src={photosApi.thumbnailUrl(photo)}
                      alt={photo.originalName}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : photo.status === 'PROCESSING' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 text-zinc-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-red-400">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Share Dialog */}
      <AnimatePresence>
        {showShare && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setShowShare(false)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white dark:bg-zinc-900 rounded-t-2xl shadow-xl border-t border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t.share}</h2>
                <button onClick={() => setShowShare(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <XMarkIcon className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              {/* User search */}
              <div className="relative mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t.userSearch}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="animate-spin h-4 w-4 text-zinc-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mb-4 space-y-1">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full px-4 py-2.5 text-sm text-left rounded-lg transition-colors flex items-center justify-between ${
                        selectedUserId === user.id
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>{user.name || user.email}</span>
                      {user.name && <span className="text-xs text-zinc-400">{user.email}</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Role selector + share button */}
              {selectedUserId && (
                <div className="flex items-center gap-3 mb-4">
                  <select
                    value={selectedRole}
                    onChange={e => setSelectedRole(e.target.value as 'VIEWER' | 'CONTRIBUTOR')}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="VIEWER">{t.viewer}</option>
                    <option value="CONTRIBUTOR">{t.contributor}</option>
                  </select>
                  <button
                    onClick={() => void handleShare()}
                    className="flex-1 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium"
                  >
                    <PlusIcon className="w-4 h-4 inline mr-1" />
                    {t.share}
                  </button>
                </div>
              )}

              {/* Current shares */}
              {shares.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{t.sharedWith}</h3>
                  <div className="space-y-1">
                    {shares.map((share) => (
                      <div
                        key={share.userId}
                        className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                            {share.userName || share.userId}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {share.role === 'VIEWER' ? t.viewer : t.contributor}
                          </p>
                        </div>
                        <button
                          onClick={() => void handleUnshare(share.userId)}
                          className="text-xs text-red-500 hover:text-red-600 font-medium shrink-0 ml-2"
                        >
                          {t.revoke}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
