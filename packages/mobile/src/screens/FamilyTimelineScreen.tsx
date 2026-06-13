import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import { albumsApi } from '../api/albums';
import { photosApi } from '../api/photos';
import { XMarkIcon, PhotosIcon } from '../components/icons';
import type { Photo } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SPACING = 2;
const THUMB_SIZE = (SCREEN_WIDTH - ITEM_SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

interface FamilyTimelineScreenProps {
  onClose: () => void;
}

export function FamilyTimelineScreen({ onClose }: FamilyTimelineScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPhotos = useCallback(async (reset = false) => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await albumsApi.familyTimeline(reset ? undefined : cursor ?? undefined);
      const newPhotos = reset ? res.photos : [...photos, ...res.photos];
      setPhotos(newPhotos);
      setCursor(res.nextCursor);
      setHasMore(res.nextCursor !== null);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, photos]);

  useEffect(() => {
    loadPhotos(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore && !error) {
      loadPhotos(false);
    }
  }, [loading, hasMore, error, loadPhotos]);

  const handleRetry = useCallback(() => {
    loadPhotos(true);
  }, [loadPhotos]);

  const renderPhoto = useCallback(({ item }: { item: Photo }) => (
    <View style={styles.photoCell}>
      <Image
        source={{ uri: photosApi.thumbnailUrl(item) }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
    </View>
  ), []);

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
        <Text style={styles.emptyText}>暂无家庭动态</Text>
      </View>
    );
  }, [loading, error, handleRetry, t.mobileRetry]);

  // Initial loading
  if (loading && photos.length === 0) {
    return (
      <View style={styles.overlay}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <XMarkIcon size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>家庭动态</Text>
          <View style={styles.closeBtn} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.overlay}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <XMarkIcon size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>家庭动态</Text>
        <View style={styles.closeBtn} />
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
    zIndex: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  closeBtn: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
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
});

export default FamilyTimelineScreen;
