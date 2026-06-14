import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import { albumsApi } from '../api/albums';
import { AlbumsIcon, PlusIcon, XMarkIcon } from './icons';
import type { Album } from '../types';

interface AlbumPickerProps {
  visible: boolean;
  photoId: string;
  onClose: () => void;
  onAdded?: (albumId: string) => void;
}

export function AlbumPicker({ visible, photoId, onClose, onAdded }: AlbumPickerProps) {
  const { t } = useI18n();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  // Create album inline
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const res = await albumsApi.list();
      setAlbums(res.albums);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadAlbums();
  }, [visible, loadAlbums]);

  const handleSelect = useCallback(async (albumId: string) => {
    setAddingId(albumId);
    try {
      await albumsApi.addPhoto(albumId, photoId);
      onAdded?.(albumId);
    } catch {
      // already added or error — still close
    } finally {
      setAddingId(null);
      onClose();
    }
  }, [photoId, onAdded, onClose]);

  const handleCreateAndAdd = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const album = await albumsApi.create({ name: newName.trim() });
      setShowCreate(false);
      setNewName('');
      await handleSelect(album.id);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }, [newName, handleSelect]);

  const renderAlbum = useCallback(({ item }: { item: Album }) => {
    const adding = addingId === item.id;
    return (
      <TouchableOpacity
        style={styles.albumRow}
        activeOpacity={0.7}
        onPress={() => handleSelect(item.id)}
        disabled={adding}
      >
        <View style={styles.albumCoverSmall}>
          <AlbumsIcon size={20} color={theme.colors.accentLight} />
        </View>
        <View style={styles.albumInfo}>
          <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.albumMeta}>{item.photoCount} 张照片</Text>
        </View>
        {adding ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <Text style={styles.addText}>{t.addPhoto}</Text>
        )}
      </TouchableOpacity>
    );
  }, [addingId, handleSelect, t.addPhoto]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t.addPhoto}</Text>
            <TouchableOpacity onPress={onClose}>
              <XMarkIcon size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Album list */}
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : albums.length === 0 ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyText}>暂无相册</Text>
            </View>
          ) : (
            <FlatList
              data={albums}
              renderItem={renderAlbum}
              keyExtractor={(item) => item.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Create album button */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => setShowCreate(true)}
          >
            <PlusIcon size={18} color={theme.colors.accent} />
            <Text style={styles.createBtnText}>{t.createAlbum}</Text>
          </TouchableOpacity>

          {/* Inline create form */}
          {showCreate && (
            <View style={styles.createForm}>
              <TextInput
                style={styles.createInput}
                placeholder={t.albumName}
                placeholderTextColor={theme.colors.textTertiary}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={styles.createCancelBtn}
                  onPress={() => { setShowCreate(false); setNewName(''); }}
                >
                  <Text style={styles.createCancelText}>取消</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createConfirmBtn, (!newName.trim() || creating) && styles.disabledBtn]}
                  onPress={handleCreateAndAdd}
                  disabled={!newName.trim() || creating}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.createConfirmText}>创建并添加</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radii['2xl'],
    borderTopRightRadius: theme.radii['2xl'],
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.text,
  },
  list: {
    maxHeight: 320,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  albumCoverSmall: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  albumInfo: {
    flex: 1,
  },
  albumName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  albumMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  addText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  centerState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textTertiary,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
  },
  createBtnText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.accent,
    fontWeight: '600',
  },
  createForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  createInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginBottom: 12,
  },
  createActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  createCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  createCancelText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  createConfirmBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  createConfirmText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});

export default AlbumPicker;
