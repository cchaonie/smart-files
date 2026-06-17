import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { photosApi } from '../api/photos';
import type { Photo, PhotoTag } from '../types';
import { useI18n } from '@smart-files/shared/src/i18n';
import { formatBytes } from '@smart-files/shared/src/utils';
import { XMarkIcon, AlbumsIcon } from '../components/icons';
import { AlbumPicker } from '../components/AlbumPicker';

export function formatCaptured(capturedAt: string | null, locale: string): string {
  if (!capturedAt) return '—';
  const d = new Date(capturedAt);
  return d.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function PhotoDetailPage({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [showAlbumPicker, setShowAlbumPicker] = useState(false);

  // Tag management state
  const [tags, setTags] = useState<PhotoTag[]>(photo.tags);
  const [newTagText, setNewTagText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // ── Autocomplete debounced search ─────────────────────────────────────

  useEffect(() => {
    if (newTagText.trim().length === 0) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await photosApi.getTags(newTagText.trim());
        const existing = new Set(tags.map(t => t.tag));
        const filtered = res.tags
          .map(t => t.tag)
          .filter(t => !existing.has(t))
          .slice(0, 8);
        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
      } catch { /* ignore */ }
    }, 200);

    return () => clearTimeout(timer);
  }, [newTagText, tags]);

  // ── Click-outside to close suggestions ────────────────────────────────

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Add tag ──────────────────────────────────────────────────────────

  const handleAddTag = useCallback(async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;

    if (tags.some(t => t.tag === trimmed)) {
      setNewTagText('');
      setShowSuggestions(false);
      return;
    }

    setAddingTag(true);
    setNewTagText('');
    setShowSuggestions(false);
    try {
      await photosApi.addTag(photo.id, trimmed);
      setTags(prev => [...prev, { tag: trimmed, confidence: null }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.includes('already exists')) {
        console.error('Failed to add tag:', e);
      }
    } finally {
      setAddingTag(false);
    }
  }, [tags, photo.id]);

  // ── Remove tag ───────────────────────────────────────────────────────

  const handleRemoveTag = useCallback(async (tag: string) => {
    setRemovingTag(tag);
    try {
      await photosApi.removeTag(photo.id, tag);
      setTags(prev => prev.filter(t => t.tag !== tag));
    } catch (e: unknown) {
      console.error('Failed to remove tag:', e);
    } finally {
      setRemovingTag(null);
    }
  }, [photo.id]);

  // ── Select suggestion ────────────────────────────────────────────────

  const handleSelectSuggestion = useCallback((tag: string) => {
    void handleAddTag(tag);
  }, [handleAddTag]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="relative max-w-lg w-full bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Preview image */}
        <div className="relative flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 max-h-[80vh] overflow-hidden">
          <img
            src={photosApi.previewUrl(photo)}
            alt={photo.originalName}
            className="object-contain max-h-[80vh] w-full"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = target.parentElement?.querySelector('.img-fallback');
              if (fallback) (fallback as HTMLElement).style.display = 'flex';
            }}
          />
          <div className="img-fallback hidden absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
            {t.failedToLoad}
          </div>
        </div>

        {/* Metadata + Tags */}
        <div className="p-4 space-y-3">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {photo.originalName}
          </p>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
            <p>{t.captured}: {formatCaptured(photo.capturedAt, lang)}</p>
            {photo.width && photo.height && (
              <p>{t.dimensions}: {photo.width} × {photo.height}</p>
            )}
            <p>{formatBytes(BigInt(photo.fileSize))}</p>
          </div>

          {/* Tags as removable pills */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((photoTag, i) => (
                <span
                  key={`${photoTag.tag}-${i}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-600 text-white text-xs font-medium"
                >
                  {photoTag.tag}
                  {photoTag.confidence !== null && (
                    <span className="text-white/70">({Math.round(photoTag.confidence * 100)}%)</span>
                  )}
                  <button
                    onClick={() => handleRemoveTag(photoTag.tag)}
                    disabled={removingTag === photoTag.tag}
                    className="ml-0.5 p-0.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {removingTag === photoTag.tag ? (
                      <svg className="animate-spin h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <XMarkIcon className="w-2.5 h-2.5" />
                    )}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Add tag input */}
          <div className="flex items-center gap-2">
            <div ref={suggestionsRef} className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={newTagText}
                onChange={e => setNewTagText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAddTag(newTagText); } }}
                placeholder={t.addTagPlaceholder}
                disabled={addingTag}
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleSelectSuggestion(tag)}
                      className="w-full px-3 py-2 text-sm text-left text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => void handleAddTag(newTagText)}
              disabled={!newTagText.trim() || addingTag}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
            >
              {addingTag ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          </div>

          {/* Add to album */}
          <button
            onClick={() => setShowAlbumPicker(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
          >
            <AlbumsIcon className="w-4 h-4" />
            <span>{t.addPhoto}</span>
          </button>
        </div>

        {/* Album picker */}
        <AlbumPicker
          visible={showAlbumPicker}
          photoId={photo.id}
          onClose={() => setShowAlbumPicker(false)}
        />
      </motion.div>
    </motion.div>
  );
}
