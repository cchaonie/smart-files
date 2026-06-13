import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Dimensions, Modal, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import { albumsApi, usersApi } from '../api/albums';
import { photosApi } from '../api/photos';
import {
  XMarkIcon, PlusIcon, ArrowLeftIcon, AlbumsIcon,
  TrashIcon,
} from '../components/icons';
import type { Album, Photo, ShareEntry } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SPACING = 2;
const THUMB_SIZE = (SCREEN_WIDTH - ITEM_SPACING * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

interface AlbumDetailScreenProps {
  album: Album;
  onClose: () => void;
  onDeleted?: () => void;
}

export function AlbumDetailScreen({ album, onClose, onDeleted }: AlbumDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Share modal state
  const [showShare, setShowShare] = useState(false);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState('VIEWER');

  const loadPhotos = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await albumsApi.listPhotos(album.id);
      setPhotos(res.photos ?? []);
    } catch (e: any) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [album.id]);

  const loadShares = useCallback(async () => {
    setSharesLoading(true);
    try {
      const res = await albumsApi.listShares(album.id);
      setShares(res.shares ?? []);
    } catch {
      // ignore
    } finally {
      setSharesLoading(false);
    }
  }, [album.id]);

  useEffect(() => {
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await usersApi.search(searchQuery);
        setSearchResults(res.users ?? []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleShare = useCallback(async (userId: string) => {
    try {
      await albumsApi.share(album.id, userId, selectedRole);
      loadShares();
      setSearchQuery('');
      setSearchResults([]);
    } catch (e: any) {
      Alert.alert('错误', e instanceof Error ? e.message : '分享失败');
    }
  }, [album.id, selectedRole, loadShares]);

  const handleUnshare = useCallback(async (userId: string) => {
    Alert.alert('取消分享', '确认取消该用户的访问权限？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认', style: 'destructive', onPress: async () => {
          try {
            await albumsApi.unshare(album.id, userId);
            loadShares();
          } catch (e: any) {
            Alert.alert('错误', e instanceof Error ? e.message : '取消分享失败');
          }
        },
      },
    ]);
  }, [album.id, loadShares]);

  const handleDelete = useCallback(() => {
    Alert.alert('删除相册', `确认删除"${album.name}"？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive', onPress: async () => {
          try {
            await albumsApi.delete(album.id);
            onDeleted?.();
          } catch (e: any) {
            Alert.alert('错误', e instanceof Error ? e.message : '删除失败');
          }
        },
      },
    ]);
  }, [album.id, album.name, onDeleted]);

  const openShareModal = useCallback(async () => {
    setShowShare(true);
    loadShares();
  }, [loadShares]);

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
    return null;
  }, [loading, photos.length]);

  if (loading && photos.length === 0) {
    return (
      <View style={styles.overlay}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <ArrowLeftIcon size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>{album.name}</Text>
            <Text style={styles.headerMeta}>{album.photoCount} 张照片</Text>
          </View>
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
        <TouchableOpacity onPress={onClose} style={styles.backBtn}>
          <ArrowLeftIcon size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{album.name}</Text>
          <Text style={styles.headerMeta}>{photos.length} 张照片</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={openShareModal} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>分享</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
            <TrashIcon size={18} color={theme.colors.danger} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <XMarkIcon size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadPhotos}>
            <Text style={styles.retryLink}>{t.mobileRetry}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Photo grid */}
      <FlatList
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={photos.length === 0 ? styles.emptyContainer : styles.listContent}
        columnWrapperStyle={photos.length > 0 ? styles.columnWrapper : undefined}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.centerState}>
              <AlbumsIcon size={48} color={theme.colors.textTertiary} />
              <Text style={styles.emptyText}>相册为空</Text>
            </View>
          ) : null
        }
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
      />

      {/* Share modal */}
      <Modal visible={showShare} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>分享相册</Text>
              <TouchableOpacity onPress={() => setShowShare(false)}>
                <XMarkIcon size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Role toggle */}
            <View style={styles.roleToggle}>
              <TouchableOpacity
                style={[styles.roleOption, selectedRole === 'VIEWER' && styles.roleOptionActive]}
                onPress={() => setSelectedRole('VIEWER')}
              >
                <Text style={[styles.roleText, selectedRole === 'VIEWER' && styles.roleTextActive]}>仅查看</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, selectedRole === 'EDITOR' && styles.roleOptionActive]}
                onPress={() => setSelectedRole('EDITOR')}
              >
                <Text style={[styles.roleText, selectedRole === 'EDITOR' && styles.roleTextActive]}>可编辑</Text>
              </TouchableOpacity>
            </View>

            {/* User search */}
            <TextInput
              style={styles.searchInput}
              placeholder="搜索用户..."
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searching && <ActivityIndicator size="small" color={theme.colors.accent} />}
            {searchResults.map((user) => (
              <TouchableOpacity
                key={user.id}
                style={styles.userRow}
                onPress={() => handleShare(user.id)}
              >
                <Text style={styles.userName}>{user.name || user.email}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </TouchableOpacity>
            ))}

            {/* Existing shares */}
            {shares.length > 0 && (
              <>
                <Text style={styles.sharesSectionTitle}>已分享给</Text>
                {shares.map((share) => (
                  <View key={share.userId} style={styles.shareRow}>
                    <Text style={styles.shareName} numberOfLines={1}>
                      {share.userName || share.userId}
                    </Text>
                    <Text style={styles.shareRole}>{share.role}</Text>
                    <TouchableOpacity onPress={() => handleUnshare(share.userId)}>
                      <Text style={styles.revokeText}>取消</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.text,
  },
  headerMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    padding: 6,
  },
  headerBtnText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.accent,
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: theme.fontSize.md,
    color: theme.colors.textTertiary,
  },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  errorText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.danger,
  },
  retryLink: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii['2xl'],
    borderTopRightRadius: theme.radii['2xl'],
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.zinc100,
    borderRadius: theme.radii.md,
    padding: 4,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: theme.radii.md,
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  roleText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  roleTextActive: {
    color: theme.colors.accent,
    fontWeight: '600',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  userName: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    fontWeight: '500',
  },
  userEmail: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
  },
  sharesSectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  shareName: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  shareRole: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    marginRight: 12,
    textTransform: 'capitalize',
  },
  revokeText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.danger,
    fontWeight: '600',
  },
});

export default AlbumDetailScreen;
