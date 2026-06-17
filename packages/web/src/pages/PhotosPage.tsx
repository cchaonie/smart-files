import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { photosApi } from '../api/photos';
import type { Photo, TagWithCount } from '../types';
import { useI18n } from '@smart-files/shared/src/i18n';
import { CalendarIcon, ImageIcon, XMarkIcon } from '../components/icons';
import { PhotoDetailPage } from './PhotoDetailPage';

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByMonth(photos: Photo[]): Map<string, Photo[]> {
  const map = new Map<string, Photo[]>();
  for (const p of photos) {
    const key = p.capturedAt ? p.capturedAt.slice(0, 7) : 'unknown';
    const group = map.get(key);
    if (group) group.push(p);
    else map.set(key, [p]);
  }
  return map;
}

function groupByDay(photos: Photo[]): Map<string, Photo[]> {
  const map = new Map<string, Photo[]>();
  for (const p of photos) {
    const key = p.capturedAt ? p.capturedAt.slice(0, 10) : 'unknown';
    const group = map.get(key);
    if (group) group.push(p);
    else map.set(key, [p]);
  }
  return map;
}

function formatMonthLabel(yearMonth: string, locale: string): string {
  if (yearMonth === 'unknown') return '';
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  if (locale === 'zh-CN') {
    return `${y}年${m}月`;
  }
  return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
}

function formatDayLabel(dateStr: string, locale: string): string {
  if (dateStr === 'unknown') return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (locale === 'zh-CN') {
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${month}月${day}日 ${weekdays[d.getDay()]}`;
  }
  return d.toLocaleDateString(locale, { month: 'long', day: 'numeric', weekday: 'long' });
}

function getMonthsFromPhotos(photos: Photo[]): string[] {
  const months = new Set<string>();
  for (const p of photos) {
    if (p.capturedAt) months.add(p.capturedAt.slice(0, 7));
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

// ── Date Picker Overlay ──────────────────────────────────────────────────────

function DatePickerOverlay({
  months,
  onSelect,
  onClose,
}: {
  months: string[];
  onSelect: (month: string) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 300, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 300, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute bottom-20 left-4 right-4 max-w-sm mx-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-4 max-h-72 overflow-y-auto"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 text-center">
          {t.jumpToMonth}
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => {
                onSelect(m);
                onClose();
              }}
              className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {formatMonthLabel(m, lang)}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Word Cloud Overlay ───────────────────────────────────────────────────────

function WordCloudOverlay({
  tags,
  selectedTags,
  onToggle,
  onClose,
}: {
  tags: (TagWithCount & { cloudFontSize: number })[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-black/40"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 300, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 300, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="absolute bottom-20 left-4 right-4 max-w-sm mx-auto bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-4 max-h-72 overflow-y-auto"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3 text-center">
          {t.moreTags}
        </h3>
        {tags.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">{t.moreTags}</p>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center py-2">
            {tags.map((s) => {
              const active = selectedTags.includes(s.tag);
              return (
                <button
                  key={s.tag}
                  onClick={() => onToggle(s.tag)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                  style={{ fontSize: s.cloudFontSize }}
                >
                  <span>{s.tag}</span>
                  <span className={`text-[10px] font-normal ${active ? 'text-white/70' : 'text-zinc-400'}`}>
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main PhotosPage ─────────────────────────────────────────────────────────

export function PhotosPage() {
  const { t, lang } = useI18n();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // Tag state
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [wordCloudOpen, setWordCloudOpen] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const fetchingRef = useRef(false);

  // ── Load all tags on mount ───────────────────────────────────────────────

  useEffect(() => {
    photosApi.getTags().then(data => setAllTags(data.tags)).catch(() => {});
  }, []);

  // ── Top 3 tags ──────────────────────────────────────────────────────────

  const topTags = useMemo<TagWithCount[]>(() => {
    if (!allTags) return [];
    return [...allTags].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [allTags]);

  // ── Word cloud tags with font size scaling ──────────────────────────────

  const wordCloudTags = useMemo(() => {
    if (!allTags || allTags.length === 0) return [];
    const counts = allTags.map(t => t.count);
    const minC = Math.min(...counts);
    const maxC = Math.max(...counts);
    const range = maxC - minC || 1;
    return allTags.map(t => ({
      ...t,
      cloudFontSize: 13 + ((t.count - minC) / range) * 13,
    }));
  }, [allTags]);

  // ── Load more (with optional tag filter) ────────────────────────────────

  const loadMore = useCallback(async (reset = false) => {
    if (!reset && fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setError(null);
      if (reset) setLoading(true);
      const data = await photosApi.list(
        reset ? undefined : cursor ?? undefined,
        20,
        selectedTags.length > 0 ? selectedTags : undefined,
      );
      setPhotos(prev => reset ? data.photos : [...prev, ...data.photos]);
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failedToLoad);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [cursor, t.failedToLoad, selectedTags]);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // First fetch on mount
  useEffect(() => {
    void loadMore(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when tag filter changes
  useEffect(() => {
    if (photos.length === 0 && selectedTags.length === 0) return;
    void loadMore(true);
  }, [selectedTags]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore) {
          void loadMoreRef.current(false);
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  // ── Tag filter handlers ─────────────────────────────────────────────────

  const toggleTagFilter = useCallback((tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      return [...prev, tag];
    });
    window.scrollTo(0, 0);
    setCursor(null);
    setHasMore(true);
  }, []);

  const clearTagFilter = useCallback(() => {
    setSelectedTags([]);
    setCursor(null);
    setHasMore(true);
    window.scrollTo(0, 0);
  }, []);

  // Group by month → day
  const groupedByMonth = useMemo(() => groupByMonth(photos), [photos]);
  const monthKeys = useMemo(() => Array.from(groupedByMonth.keys()).sort((a, b) => b.localeCompare(a)), [groupedByMonth]);

  const dayGroupsCache = useMemo(() => {
    const cache = new Map<string, Map<string, Photo[]>>();
    for (const [monthKey, monthPhotos] of groupedByMonth) {
      cache.set(monthKey, groupByDay(monthPhotos));
    }
    return cache;
  }, [groupedByMonth]);

  const handleMonthSelect = useCallback((month: string) => {
    const el = monthRefs.current.get(month);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  const hasActiveFilter = selectedTags.length > 0;

  return (
    <div className="px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {t.photos}
        </h1>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {photos.length > 0 && `${photos.length} ${t.photos}`}
        </span>
      </div>

      {/* Top 3 tag pills + More tags button */}
      {topTags.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-1.5 flex-1 min-w-0">
            {topTags.map(s => {
              const active = selectedTags.includes(s.tag);
              return (
                <button
                  key={s.tag}
                  onClick={() => toggleTagFilter(s.tag)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <span className="truncate">{s.tag}</span>
                  <span className={`text-[10px] font-normal ${active ? 'text-white/70' : 'text-zinc-400'}`}>
                    {s.count}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setWordCloudOpen(true)}
            className="px-3 py-1.5 rounded-full border border-blue-500 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex-shrink-0"
          >
            {t.moreTags}
          </button>
        </div>
      )}

      {/* Active filter bar */}
      {hasActiveFilter && (
        <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-sm font-medium flex-shrink-0"
            >
              {tag}
              <button onClick={() => toggleTagFilter(tag)} className="hover:text-blue-200">
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button
            onClick={clearTagFilter}
            className="inline-flex items-center px-3 py-1.5 rounded-full bg-zinc-500 text-white text-sm font-medium flex-shrink-0 hover:bg-zinc-600 transition-colors"
          >
            {t.clearFilter}
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => void loadMore(true)}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium"
          >
            {t.retry}
          </button>
        </div>
      )}

      {/* Loading state (first load) */}
      {loading && photos.length === 0 && !error && <SkeletonGrid />}

      {/* Empty filtered state */}
      {!loading && !error && photos.length === 0 && hasActiveFilter && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ImageIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">{t.noMatchingPhotos}</p>
          <button
            onClick={clearTagFilter}
            className="px-4 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium"
          >
            {t.clearFilter}
          </button>
        </div>
      )}

      {/* Empty state (no filter) */}
      {!loading && !error && photos.length === 0 && !hasActiveFilter && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ImageIcon className="w-16 h-16 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-400 dark:text-zinc-500">{t.noPhotos}</p>
        </div>
      )}

      {/* Timeline content */}
      {photos.length > 0 && (
        <div className="max-w-3xl mx-auto">
          {monthKeys.map((monthKey) => {
            const dayGroups = dayGroupsCache.get(monthKey);
            if (!dayGroups) return null;
            const dayKeys = Array.from(dayGroups.keys()).sort((a, b) => b.localeCompare(a));

            return (
              <div
                key={monthKey}
                ref={(el) => { monthRefs.current.set(monthKey, el); }}
                className="mb-6"
              >
                <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm pb-2 pt-0 -mx-4 px-4">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {formatMonthLabel(monthKey, lang)}
                  </h2>
                </div>

                {dayKeys.map((dayKey) => {
                  const dayPhotos = dayGroups.get(dayKey)!;
                  return (
                    <div key={dayKey} className="mb-4">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 font-medium">
                        {formatDayLabel(dayKey, lang)}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {dayPhotos.map((photo) => (
                          <button
                            key={photo.id}
                            onClick={() => photo.status === 'READY' && setSelectedPhoto(photo)}
                            className="aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                          >
                            {photo.status === 'READY' ? (
                              <img
                                src={photosApi.thumbnailUrl(photo)}
                                alt={photo.originalName}
                                loading="lazy"
                                className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                              />
                            ) : photo.status === 'PROCESSING' ? (
                              <div className="w-full h-full flex items-center justify-center">
                                <svg className="animate-spin h-6 w-6 text-zinc-400" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-red-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div ref={sentinelRef} className="h-8" />
          {loading && photos.length > 0 && <SkeletonGrid />}
          {!hasMore && photos.length > 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">
              — {t.endOfList} —
            </p>
          )}
        </div>
      )}

      {/* Date picker FAB */}
      <button
        onClick={() => setDatePickerOpen(true)}
        className="fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Date picker"
      >
        <CalendarIcon className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {datePickerOpen && (
          <DatePickerOverlay
            months={getMonthsFromPhotos(photos)}
            onSelect={handleMonthSelect}
            onClose={() => setDatePickerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wordCloudOpen && (
          <WordCloudOverlay
            tags={wordCloudTags}
            selectedTags={selectedTags}
            onToggle={toggleTagFilter}
            onClose={() => setWordCloudOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Photo detail modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <PhotoDetailPage
            photo={selectedPhoto}
            onClose={() => setSelectedPhoto(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
