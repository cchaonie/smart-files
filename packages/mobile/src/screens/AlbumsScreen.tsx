import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import { albumsApi } from '../api/albums';
import { PlusIcon, AlbumsIcon } from '../components/icons';
import { AlbumDetailScreen } from './AlbumDetailScreen';
import { FamilyTimelineScreen } from './FamilyTimelineScreen';
import PhotoUploadPrompt from '../components/PhotoUploadPrompt';
import type { Album } from '../types';
import type { PhotoDetectionResult } from '../hooks/usePhotoDetection';
import { usePhotoUploadContext } from '../context/PhotoUploadContext';

export function AlbumsScreen({ photoDetection }: { photoDetection: PhotoDetectionResult }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { startUpload } = usePhotoUploadContext();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photo detection state
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);

  // Create album modal
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  // Detail overlay
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  // Family timeline overlay
  const [showFamilyTimeline, setShowFamilyTimeline] = useState(false);

  const loadAlbums = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await albumsApi.list();
      setAlbums(res.albums);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlbums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Photo detection — show prompt when new photos found
  useEffect(() => {
    if (
      photoDetection.count > 0 &&
      !photoDetection.isPromptDismissed &&
      !photoDetection.isLoading
    ) {
      setShowPhotoPrompt(true);
    } else {
      setShowPhotoPrompt(false);
    }
  }, [photoDetection.count, photoDetection.isPromptDismissed, photoDetection.isLoading]);

  async function handlePhotoUpload() {
    setShowPhotoPrompt(false);
    const photos = photoDetection.newPhotos;
    if (photos.length === 0) return;
    startUpload(photos);
  }

  function handlePhotoLater() {
    setShowPhotoPrompt(false);
    photoDetection.dismissPrompt();
  }

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await albumsApi.create({ name: newName.trim() });
      setShowCreate(false);
      setNewName('');
      loadAlbums();
    } catch (e: any) {
      Alert.alert('错误', e instanceof Error ? e.message : '创建失败');
    }
  }, [newName, loadAlbums]);

  const handleDelete = useCallback((album: Album) => {
    Alert.alert('删除相册', `确认删除"${album.name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive', onPress: async () => {
          try {
            await albumsApi.delete(album.id);
            loadAlbums();
          } catch (e: any) {
            Alert.alert('错误', e instanceof Error ? e.message : '删除失败');
          }
        },
      },
    ]);
  }, [loadAlbums]);

  const renderAlbum = useCallback(({ item }: { item: Album }) => (
    <TouchableOpacity
      style={styles.albumCard}
      activeOpacity={0.7}
      onPress={() => setSelectedAlbum(item)}
      onLongPress={() => handleDelete(item)}
    >
      <View style={styles.albumCover}>
        <AlbumsIcon size={36} color={theme.colors.accentLight} />
      </View>
      <View style={styles.albumInfo}>
        <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.albumMeta}>
          {item.photoCount} 张照片 · {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  ), [handleDelete]);

  const renderEmpty = useCallback(() => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAlbums}>
            <Text style={styles.retryText}>{t.mobileRetry}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <AlbumsIcon size={48} color={theme.colors.textTertiary} />
        <Text style={styles.emptyText}>暂无相册</Text>
      </View>
    );
  }, [loading, error, loadAlbums, t.mobileRetry]);

  if (loading && albums.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>相册</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>相册</Text>
        <TouchableOpacity
          style={styles.familyTimelineBtn}
          onPress={() => setShowFamilyTimeline(true)}
        >
          <Text style={styles.familyTimelineBtnText}>家庭动态</Text>
        </TouchableOpacity>
      </View>

      {/* Photo upload prompt — new photos detected in camera roll */}
      {showPhotoPrompt && (
        <PhotoUploadPrompt
          count={photoDetection.count}
          isLoading={photoDetection.isLoading}
          onUpload={handlePhotoUpload}
          onLater={handlePhotoLater}
        />
      )}

      <FlatList
        data={albums}
        renderItem={renderAlbum}
        keyExtractor={(item) => item.id}
        contentContainerStyle={albums.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating + button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        activeOpacity={0.8}
        onPress={() => setShowCreate(true)}
      >
        <PlusIcon size={24} color="#fff" />
      </TouchableOpacity>

      {/* Create album modal */}
      <Modal visible={showCreate} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>新建相册</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="相册名称"
              placeholderTextColor={theme.colors.textTertiary}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowCreate(false); setNewName(''); }}
              >
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, !newName.trim() && styles.modalConfirmDisabled]}
                onPress={handleCreate}
                disabled={!newName.trim()}
              >
                <Text style={styles.modalConfirmText}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Album detail overlay */}
      {selectedAlbum && (
        <AlbumDetailScreen
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
          onDeleted={() => { setSelectedAlbum(null); loadAlbums(); }}
        />
      )}

      {/* Family timeline overlay */}
      {showFamilyTimeline && (
        <FamilyTimelineScreen onClose={() => setShowFamilyTimeline(false)} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: theme.fontSize['2xl'],
    fontWeight: '700',
    color: theme.colors.text,
  },
  familyTimelineBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  familyTimelineBtnText: {
    color: '#fff',
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
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
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    marginBottom: 12,
    padding: 14,
    ...theme.shadows.sm,
  },
  albumCover: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  albumInfo: {
    flex: 1,
  },
  albumName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  albumMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
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
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: 24,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  modalConfirmBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  modalConfirmDisabled: {
    opacity: 0.5,
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});

export default AlbumsScreen;
