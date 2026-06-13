import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { photosApi } from '../api/photos';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import { PhotosIcon } from '../components/icons';
import type { Photo } from '../types';
import { PhotoDetailScreen } from './PhotoDetailScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SPACING = 2;
const THUMB_SIZE = (SCREEN_WIDTH - ITEM_SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export function PhotoTimelineScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const loadPhotos = useCallback(async (reset = false) => {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await photosApi.list(reset ? undefined : cursor ?? undefined);
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

  const handlePhotoPress = useCallback((photo: Photo) => {
    setSelectedPhoto(photo);
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.mobilePhotos}</Text>
      </View>

      {/* Tag filter bar (placeholder for future story) */}
      {/* <View style={styles.filterBar}>
        <Text style={styles.filterText}>筛选：宝宝 ✕</Text>
      </View> */}

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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: theme.fontSize['2xl'],
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

export default PhotoTimelineScreen;
