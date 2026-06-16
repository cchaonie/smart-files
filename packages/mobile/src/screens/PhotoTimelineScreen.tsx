import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions, ScrollView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photosApi } from '../api/photos';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import { PhotosIcon, CalendarIcon, XMarkIcon } from '../components/icons';
import PhotoUploadPrompt from '../components/PhotoUploadPrompt';
import { usePhotoUploadContext } from '../context/PhotoUploadContext';
import type { Photo, TagWithCount } from '../types';
import type { PhotoDetectionResult } from '../hooks/usePhotoDetection';
import { PhotoDetailScreen } from './PhotoDetailScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SPACING = 2;
const THUMB_SIZE = (SCREEN_WIDTH - ITEM_SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

function getMonthsFromPhotos(photos: Photo[]): string[] {
  const months = new Set<string>();
  for (const p of photos) {
    if (p.capturedAt) months.add(p.capturedAt.slice(0, 7));
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

function formatMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${y}年${m}月`;
}

export function PhotoTimelineScreen({ photoDetection }: { photoDetection?: PhotoDetectionResult }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { startUpload } = usePhotoUploadContext();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Tag word cloud state
  const [allTags, setAllTags] = useState<TagWithCount[] | null>(null);
  const [showTagCloud, setShowTagCloud] = useState(false);

  const monthRefs = useRef<Map<string, View | null>>(new Map());
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Photo detection state
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);

  // Photo detection — show prompt when new photos found
  useEffect(() => {
    if (!photoDetection) return;
    if (
      photoDetection.count > 0 &&
      !photoDetection.isPromptDismissed &&
      !photoDetection.isLoading
    ) {
      setShowPhotoPrompt(true);
    } else {
      setShowPhotoPrompt(false);
    }
  }, [photoDetection?.count, photoDetection?.isPromptDismissed, photoDetection?.isLoading]);

  async function handlePhotoUpload() {
    setShowPhotoPrompt(false);
    if (!photoDetection) return;
    const newPhotos = photoDetection.newPhotos;
    if (newPhotos.length === 0) return;
    startUpload(newPhotos);
  }

  function handlePhotoLater() {
    setShowPhotoPrompt(false);
    photoDetection?.dismissPrompt();
  }

  // Load all tags once on mount for top3 + word cloud
  useEffect(() => {
    photosApi.getTags().then(data => {
      setAllTags(data.tags as TagWithCount[]);
    }).catch(() => {});
  }, []);

  // Top 3 tags by count
  const topTags = useMemo<TagWithCount[]>(() => {
    if (!allTags) return [];
    return [...allTags].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [allTags]);

  // Compute font sizes for word cloud (min=13, max=26)
  const wordCloudTags = useMemo(() => {
    if (!allTags || allTags.length === 0) return [];
    const counts = allTags.map(t => t.count);
    const minC = Math.min(...counts);
    const maxC = Math.max(...counts);
    const range = maxC - minC || 1;
    return allTags.map(t => ({
      ...t,
      cloudFontSize: 13 + ((t.count - minC) / range) * 13, // 13 -> 26
    }));
  }, [allTags]);

  const loadPhotos = useCallback(async (reset = false) => {
    if (loading && !reset) return;
    setError(null);
    setLoading(true);
    try {
      const res = await photosApi.list(
        reset ? undefined : cursor ?? undefined,
        20,
        selectedTags.length > 0 ? selectedTags : undefined,
      );
      const newPhotos = reset ? res.photos : [...photos, ...res.photos];
      setPhotos(newPhotos);
      setCursor(res.nextCursor);
      setHasMore(res.nextCursor !== null);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, photos, selectedTags]);

  // Initial load
  useEffect(() => {
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on tag change
  useEffect(() => {
    if (photos.length === 0 && selectedTags.length === 0) return;
    setCursor(null);
    setHasMore(true);
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && !error) {
      loadPhotos(false);
    }
  }, [loading, hasMore, error, loadPhotos]);

  const handleRetry = useCallback(() => {
    loadPhotos(true);
  }, [loadPhotos]);

  const handlePhotoPress = useCallback((photo: Photo) => {
    setSelectedPhoto(photo);
  }, []);

  const toggleTagFilter = useCallback((tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) return prev.filter(t => t !== tag);
      return [...prev, tag];
    });
  }, []);

  const clearTagFilter = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const months = useMemo(() => getMonthsFromPhotos(photos), [photos]);

  const handleMonthSelect = useCallback((month: string) => {
    setShowMonthPicker(false);
    const ref = monthRefs.current.get(month);
    ref?.measureInWindow((x, y) => {
      // Scroll to the month section — we use ref-based approach
    });
  }, []);

  const renderPhoto = useCallback(({ item }: { item: Photo }) => (
    <TouchableOpacity
      style={styles.photoCell}
      activeOpacity={0.8}
      onPress={() => handlePhotoPress(item)}
    >
      <Image
        source={{ uri: photosApi.thumbnailUrl(item) }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
    </TouchableOpacity>
  ), [handlePhotoPress]);

  const renderFooter = useCallback(() => {
    if (loading && photos.length > 0) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      );
    }
    if (!hasMore && photos.length > 0) {
      return (
        <View style={styles.footerText}>
          <Text style={styles.endText}>{t.endOfList}</Text>
        </View>
      );
    }
    return null;
  }, [loading, photos.length, hasMore, t.endOfList]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryText}>{t.mobileRetry}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <PhotosIcon size={48} color={theme.colors.textTertiary} />
        <Text style={styles.emptyText}>{t.mobileNoPhotos}</Text>
      </View>
    );
  }, [loading, error, handleRetry, t.mobileNoPhotos, t.mobileRetry]);

  // Initial loading
  if (loading && photos.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.mobilePhotos}</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with actions */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t.mobilePhotos}</Text>
        <TouchableOpacity
          style={styles.timelineBtn}
          onPress={() => setShowMonthPicker(true)}
        >
          <CalendarIcon size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Top 3 tags row */}
      {topTags.length > 0 && (
        <View style={styles.tagBar}>
          <View style={styles.tagPills}>
            {topTags.map(s => {
              const active = selectedTags.includes(s.tag);
              return (
                <TouchableOpacity
                  key={s.tag}
                  style={[styles.topTagPill, active && styles.topTagPillActive]}
                  onPress={() => toggleTagFilter(s.tag)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.topTagText, active && styles.topTagTextActive]}>
                    {s.tag}
                    {active ? '' : ''}
                  </Text>
                  <Text style={[styles.topTagCount, active && styles.topTagCountActive]}>
                    {s.count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={styles.moreTagBtn}
            onPress={() => setShowTagCloud(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.moreTagBtnText}>{t.moreTags}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active filter pills */}
      {selectedTags.length > 0 && (
        <View style={styles.activeTagRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12 }}>
              {selectedTags.map(tag => (
                <View key={tag} style={styles.activeTagPill}>
                  <Text style={styles.activeTagText}>{tag}</Text>
                  <TouchableOpacity onPress={() => toggleTagFilter(tag)}>
                    <XMarkIcon size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={clearTagFilter} style={styles.activeTagPillClear}>
                <Text style={{ fontSize: 12, color: '#fff' }}>{t.clearFilter}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Photo upload prompt */}
      {showPhotoPrompt && photoDetection && (
        <PhotoUploadPrompt
          count={photoDetection.count}
          isLoading={photoDetection.isLoading}
          onUpload={handlePhotoUpload}
          onLater={handlePhotoLater}
        />
      )}

      {/* Photo grid */}
      <FlatList
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={photos.length === 0 ? styles.emptyContainer : styles.listContent}
        columnWrapperStyle={photos.length > 0 ? styles.columnWrapper : undefined}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* Month picker modal */}
      <Modal visible={showMonthPicker} transparent animationType="fade" onRequestClose={() => setShowMonthPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.monthPicker}>
            <Text style={styles.monthPickerTitle}>跳转到</Text>
            <ScrollView style={styles.monthList}>
              {months.map(m => (
                <TouchableOpacity
                  key={m}
                  style={styles.monthRow}
                  onPress={() => handleMonthSelect(m)}
                >
                  <Text style={styles.monthRowText}>{formatMonthLabel(m)}</Text>
                </TouchableOpacity>
              ))}
              {months.length === 0 && (
                <Text style={styles.monthEmpty}>暂无月份</Text>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Word Cloud Modal */}
      <Modal visible={showTagCloud} transparent animationType="fade" onRequestClose={() => setShowTagCloud(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.wordCloudModal}>
            {/* Header */}
            <View style={styles.wordCloudHeader}>
              <Text style={styles.wordCloudTitle}>{t.moreTags}</Text>
              <TouchableOpacity onPress={() => setShowTagCloud(false)}>
                <XMarkIcon size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            {/* Tag cloud */}
            <ScrollView style={styles.wordCloudContent} showsVerticalScrollIndicator={false}>
              <View style={styles.wordCloudWrap}>
                {wordCloudTags.length === 0 && (
                  <Text style={styles.wordCloudEmpty}>暂无标签</Text>
                )}
                {wordCloudTags.map(s => {
                  const active = selectedTags.includes(s.tag);
                  return (
                    <TouchableOpacity
                      key={s.tag}
                      style={[
                        styles.cloudTagItem,
                        active && styles.cloudTagItemActive,
                      ]}
                      onPress={() => {
                        toggleTagFilter(s.tag);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.cloudTagText,
                          { fontSize: s.cloudFontSize },
                          active && styles.cloudTagTextActive,
                        ]}
                      >
                        {s.tag}
                      </Text>
                      <Text style={[styles.cloudTagCount, active && styles.cloudTagCountActive]}>
                        {s.count}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Photo detail overlay */}
      {selectedPhoto && (
        <PhotoDetailScreen
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: '700',
    color: theme.colors.text,
  },
  timelineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Top 3 tags bar ──────────────────────────────────────
  tagBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  tagPills: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  topTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.zinc100,
    borderRadius: theme.radii.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  topTagPillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  topTagText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  topTagTextActive: {
    color: '#fff',
  },
  topTagCount: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    fontWeight: '400',
  },
  topTagCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  moreTagBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radii.full,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  moreTagBtnText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '500',
  },

  // ── Active filter pills ─────────────────────────────────
  activeTagRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  activeTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeTagText: {
    color: '#fff',
    fontSize: theme.fontSize.sm,
    fontWeight: '500',
  },
  activeTagPillClear: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.textTertiary,
    borderRadius: theme.radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  // ── Word cloud modal ────────────────────────────────────
  wordCloudModal: {
    width: '85%',
    maxHeight: '70%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 20,
  },
  wordCloudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  wordCloudTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  wordCloudContent: {
    maxHeight: 350,
  },
  wordCloudWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  cloudTagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.zinc100,
    borderRadius: theme.radii.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cloudTagItemActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  cloudTagText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
    lineHeight: undefined,
  },
  cloudTagTextActive: {
    color: '#fff',
  },
  cloudTagCount: {
    fontSize: 10,
    color: theme.colors.textTertiary,
    fontWeight: '400',
  },
  cloudTagCountActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  wordCloudEmpty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // ── Shared ──────────────────────────────────────────────
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  columnWrapper: {
    gap: ITEM_SPACING,
  },
  photoCell: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: theme.colors.zinc200,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  emptyText: {
    marginTop: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.textTertiary,
  },
  errorText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPicker: {
    width: '70%',
    maxHeight: '60%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 20,
  },
  monthPickerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 12,
  },
  monthList: {
    maxHeight: 300,
  },
  monthRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  monthRowText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.accent,
    fontWeight: '500',
  },
  monthEmpty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 20,
  },
});

export default PhotoTimelineScreen;
