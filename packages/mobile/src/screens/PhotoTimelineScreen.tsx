import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions, TextInput, ScrollView, Modal,
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
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagSearch, setTagSearch] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<TagWithCount[]>([]);

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

  // Tag search debounce
  useEffect(() => {
    if (!tagSearch.trim()) { setTagSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const data = await photosApi.getTags(tagSearch.trim());
        setTagSuggestions(data.tags as TagWithCount[]);
      } catch { setTagSuggestions([]); }
    }, 200);
    return () => clearTimeout(timer);
  }, [tagSearch]);

  const loadPhotos = useCallback(async (reset = false) => {
    if (loading && !reset) return;
    setError(null);
    setLoading(true);
    try {
      const res = await photosApi.list(
        reset ? undefined : cursor ?? undefined,
        20,
        activeTag ?? undefined,
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
  }, [cursor, loading, photos, activeTag]);

  // Initial load
  useEffect(() => {
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on tag change
  useEffect(() => {
    if (photos.length === 0 && activeTag === null) return;
    setCursor(null);
    setHasMore(true);
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTag]);

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

  const applyTagFilter = useCallback((tag: string) => {
    setActiveTag(tag);
    setTagSearch('');
    setTagSuggestions([]);
  }, []);

  const clearTagFilter = useCallback(() => {
    setActiveTag(null);
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

      {/* Tag search bar */}
      <View style={styles.tagSearchBar}>
        <TextInput
          style={styles.tagSearchInput}
          placeholder="搜索标签..."
          placeholderTextColor={theme.colors.textTertiary}
          value={tagSearch}
          onChangeText={setTagSearch}
        />
        {tagSuggestions.length > 0 && (
          <View style={styles.tagSuggestions}>
            {tagSuggestions.map(s => (
              <TouchableOpacity
                key={s.tag}
                style={styles.tagSuggestionRow}
                onPress={() => applyTagFilter(s.tag)}
              >
                <Text style={styles.tagSuggestionText}>{s.tag}</Text>
                <Text style={styles.tagSuggestionCount}>{s.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Active filter pill */}
      {activeTag && (
        <View style={styles.activeTagRow}>
          <View style={styles.activeTagPill}>
            <Text style={styles.activeTagText}>{activeTag}</Text>
            <TouchableOpacity onPress={clearTagFilter}>
              <XMarkIcon size={14} color="#fff" />
            </TouchableOpacity>
          </View>
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
  tagSearchBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    zIndex: 10,
  },
  tagSearchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  tagSuggestions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    maxHeight: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  tagSuggestionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  tagSuggestionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  tagSuggestionCount: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
  },
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
