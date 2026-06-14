import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { photosApi } from '../api/photos';
import type { Photo, PhotoTimelineResponse } from '../types';
import { useI18n } from '@smart-files/shared/src/i18n';
import { ImageIcon } from '../components/icons';

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

// ── Family Timeline Page ─────────────────────────────────────────────────────

export function FamilyTimelinePage() {
  const { t, lang } = useI18n();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const fetchingRef = useRef(false);

  const loadMore = useCallback(async (reset = false) => {
    if (!reset && fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      setError(null);
      if (reset) setLoading(true);
      const params: Record<string, string | number> = { limit: 20 };
      if (!reset && cursor) params.cursor = cursor;
      const res = await apiClient.get<PhotoTimelineResponse>('/family-timeline', { params });
      const data = res.data;
      setPhotos(prev => reset ? data.photos : [...prev, ...data.photos]);
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failedToLoad);
    } finally {
      fetchingRef.current = false;
      setLoading(false);
    }
  }, [cursor, t.failedToLoad]);

  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // First fetch on mount
  useEffect(() => {
    void loadMore(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Group by month -> day
  const groupedByMonth = useMemo(() => groupByMonth(photos), [photos]);
  const monthKeys = useMemo(() => Array.from(groupedByMonth.keys()).sort((a, b) => b.localeCompare(a)), [groupedByMonth]);

  // Day grouping inside each month
  const dayGroupsCache = useMemo(() => {
    const cache = new Map<string, Map<string, Photo[]>>();
    for (const [monthKey, monthPhotos] of groupedByMonth) {
      cache.set(monthKey, groupByDay(monthPhotos));
    }
    return cache;
  }, [groupedByMonth]);

  return (
    <div className="px-4 py-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {t.familyTimeline}
        </h1>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {photos.length > 0 && `${photos.length} ${t.photos}`}
        </span>
      </div>

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

      {/* Empty state */}
      {!loading && !error && photos.length === 0 && (
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
                {/* Sticky month header */}
                <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm pb-2 pt-0 -mx-4 px-4">
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {formatMonthLabel(monthKey, lang)}
                  </h2>
                </div>

                {/* Day groups within month */}
                {dayKeys.map((dayKey) => {
                  const dayPhotos = dayGroups.get(dayKey)!;
                  return (
                    <div key={dayKey} className="mb-4">
                      {/* Day label */}
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 font-medium">
                        {formatDayLabel(dayKey, lang)}
                      </p>

                      {/* Photo grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {dayPhotos.map((photo) => (
                          <div
                            key={photo.id}
                            className="aspect-square rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800"
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
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-8" />
          {loading && photos.length > 0 && <SkeletonGrid />}
          {!hasMore && photos.length > 0 && (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center py-4">
              — {t.endOfList} —
            </p>
          )}
        </div>
      )}
    </div>
  );
}
