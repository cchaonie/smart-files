import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Image,
  ScrollView,
  Linking,
  TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { filesApi, foldersApi } from '../api/files';
import { uploadApi, CHUNK_SIZE } from '../api/upload';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import {
  FolderIcon, FolderOpenIcon, PlusIcon, TrashIcon,
  MagnifyingGlassIcon, ArrowPathIcon, EllipsisVerticalIcon,
  ChevronRightIcon,
} from '../components/icons';
import type { FileItem, Folder, UploadProgress } from '../types';
import type { PhotoDetectionResult } from '../hooks/usePhotoDetection';
import { usePhotoUploadContext } from '../context/PhotoUploadContext';
import PhotoUploadPrompt from '../components/PhotoUploadPrompt';
import UploadProgressRow from '../components/UploadProgressRow';
import FilePreviewModal from '../components/FilePreviewModal';
import ActionSheet, { type ActionItem } from '../components/ActionSheet';
import RenameFileModal from '../components/RenameFileModal';
import ShareFileModal from '../components/ShareFileModal';
import MoveFileModal from '../components/MoveFileModal';
import CreateFolderModal from '../components/CreateFolderModal';
import RenameFolderModal from '../components/RenameFolderModal';

// Shared utilities
let formatBytes: (n: bigint) => string;
try {
  formatBytes = require('@smart-files/shared/src/utils').formatBytes;
} catch {
  formatBytes = (n: bigint): string => {
    if (n < 1024n) return `${n} B`;
    const kb = 1024n, mb = kb * kb, gb = mb * kb;
    if (n < mb) return `${(Number(n) / Number(kb)).toFixed(1)} KB`;
    if (n < gb) return `${(Number(n) / Number(mb)).toFixed(1)} MB`;
    return `${(Number(n) / Number(gb)).toFixed(2)} GB`;
  };
}

function isPreviewableImage(mimeType: string | null, name: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  const ext = name.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
}

export function FilesScreen({ photoDetection }: { photoDetection: PhotoDetectionResult }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { startUpload } = usePhotoUploadContext();

  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);

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

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);

  // Upload state
  const [uploadItems, setUploadItems] = useState<UploadProgress[]>([]);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);
  const persistKeyRef = useRef<Map<number, string>>(new Map());
  const [parallelCount, setParallelCount] = useState(5);
  const nextUploadId = useRef(0);
  const fileMetaByItemId = useRef<Map<number, { uri: string; name: string; mimeType: string; size: number }>>(new Map());

  // Modal state
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetTitle, setActionSheetTitle] = useState('');
  const [actionSheetActions, setActionSheetActions] = useState<ActionItem[]>([]);
  const [renameFileTarget, setRenameFileTarget] = useState<FileItem | null>(null);
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileItem[] | null>(null);

  const currentParentId = path.length === 0 ? null : path[path.length - 1].id;

  // --- Data loading ---
  const loadData = useCallback(async () => {
    if (!user) return;
    setListError(null);
    setIsLoading(true);
    try {
      const data = await filesApi.browse(currentParentId);
      setFolders(data.folders ?? []);
      setFiles(data.files ?? []);
    } catch (e: any) {
      if (e?.response?.status === 401) { await logout(); return; }
      setListError(e instanceof Error ? e.message : '加载失败');
      setFolders([]); setFiles([]);
    } finally { setIsLoading(false); }
  }, [currentParentId, user, logout]);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Search ---
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await filesApi.search(searchQuery);
        setSearchResults(res);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- Folder ops ---
  async function handleCreateFolder(name: string) {
    try {
      await foldersApi.createFolder({ name, parentId: currentParentId || undefined });
      await loadData();
    } catch (e) {
      Alert.alert('错误', e instanceof Error ? e.message : '创建失败');
    }
  }

  async function handleRenameFolder(folder: Folder, name: string) {
    try {
      await foldersApi.renameFolder(folder.id, name);
      setPath(p => p.map(s => s.id === folder.id ? { ...s, name } : s));
      await loadData();
    } catch (e) { Alert.alert('错误', e instanceof Error ? e.message : '重命名失败'); }
  }

  async function handleDeleteFolder(folder: Folder) {
    Alert.alert('删除', `确认删除"${folder.name}"？只能删除空文件夹。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try {
          await foldersApi.deleteFolder(folder.id);
          setPath(p => p.filter(s => s.id !== folder.id));
          await loadData();
        } catch (e) { Alert.alert('错误', e instanceof Error ? e.message : '删除失败'); }
      }},
    ]);
  }

  // --- File ops ---
  async function handleDeleteFile(fileId: string) {
    Alert.alert('删除', '确认删除？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try { await filesApi.deleteFile(fileId); await loadData(); }
        catch (e) { Alert.alert('错误', e instanceof Error ? e.message : '删除失败'); }
      }},
    ]);
  }

  async function handleRenameFile(file: FileItem, name: string) {
    try { await filesApi.renameFile(file.id, name); await loadData(); }
    catch (e) { Alert.alert('错误', e instanceof Error ? e.message : '重命名失败'); }
  }

  function handleDownloadFile(file: FileItem) {
    Linking.openURL(filesApi.downloadUrl(file.id)).catch(() =>
      Alert.alert('错误', '无法打开下载链接'));
  }

  function showFileActions(file: FileItem) {
    const isImage = isPreviewableImage(file.mimeType, file.name);
    setActionSheetTitle(file.name);
    setActionSheetActions([
      { key: 'preview', label: isImage ? '预览' : '播放', icon: isImage ? '🖼️' : '▶️', onPress: () => setPreviewFile(file) },
      { key: 'share', label: '分享', icon: '🔗', onPress: () => setShareTarget(file) },
      { key: 'download', label: '下载', icon: '⬇️', onPress: () => handleDownloadFile(file) },
      { key: 'rename', label: '重命名', icon: '✏️', onPress: () => setRenameFileTarget(file) },
      { key: 'move', label: '移动', icon: '📁', onPress: () => setMoveTarget(file) },
      { key: 'delete', label: '删除', icon: '🗑️', danger: true, onPress: () => handleDeleteFile(file.id) },
    ]);
    setActionSheetVisible(true);
  }

  function showFolderActions(folder: Folder) {
    setActionSheetTitle(folder.name);
    setActionSheetActions([
      { key: 'open', label: '打开', icon: '📂', onPress: () => setPath(p => [...p, { id: folder.id, name: folder.name }]) },
      { key: 'rename', label: '重命名', icon: '✏️', onPress: () => setRenameTarget(folder) },
      { key: 'delete', label: '删除', icon: '🗑️', danger: true, onPress: () => handleDeleteFolder(folder) },
    ]);
    setActionSheetVisible(true);
  }

  // --- Upload ---
  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      runUploadQueue(result.assets);
    } catch { Alert.alert('错误', '选择文件失败'); }
  }

  // ... Upload logic (kept from original HomeScreen, simplified here)
  async function runUpload(meta: { uri: string; name: string; mimeType: string; size: number }, itemId: number) {
    const updateItem = (patch: Partial<UploadProgress>) =>
      setUploadItems(prev => prev.map(it => it.id === itemId ? { ...it, ...patch } : it));

    updateItem({ status: 'uploading', progress: 0 });
    const folderKey = currentParentId ?? 'root';
    const persistKey = `upload:${folderKey}:${meta.name}:${meta.size}`;
    persistKeyRef.current.set(itemId, persistKey);

    try {
      const existingId = await getSessionStorage(persistKey);
      let uploadId: string, chunkSize = CHUNK_SIZE, totalChunks: number;

      if (existingId) {
        try {
          const existing = await uploadApi.getSession(existingId);
          uploadId = existingId; chunkSize = existing.chunkSize; totalChunks = existing.totalChunks;
        } catch {
          await removeSessionStorage(persistKey);
          const created = await uploadApi.createSession(meta.name, meta.size, currentParentId || undefined);
          uploadId = created.uploadId; chunkSize = created.chunkSize; totalChunks = created.totalChunks;
          await setSessionStorage(persistKey, uploadId);
        }
      } else {
        const created = await uploadApi.createSession(meta.name, meta.size, currentParentId || undefined);
        uploadId = created.uploadId; chunkSize = created.chunkSize; totalChunks = created.totalChunks;
        await setSessionStorage(persistKey, uploadId);
      }

      for (;;) {
        if (abortRef.current) throw new Error('Aborted');
        while (pausedRef.current) { await new Promise(r => setTimeout(r, 200)); if (abortRef.current) throw new Error('Aborted'); }

        const status = await uploadApi.getSession(uploadId);
        const received = new Set(status.receivedIndexes);
        const missing: number[] = [];
        for (let i = 0; i < status.totalChunks; i++) if (!received.has(i)) missing.push(i);
        if (missing.length === 0) break;

        let doneCount = received.size;
        for (const index of missing) {
          while (pausedRef.current) { await new Promise(r => setTimeout(r, 200)); if (abortRef.current) throw new Error('Aborted'); }
          const start = index * chunkSize;
          const chunkSizeActual = Math.min(start + chunkSize, meta.size) - start;
          const chunkBase64 = await FileSystem.readAsStringAsync(meta.uri, {
            encoding: FileSystem.EncodingType.Base64, position: start, length: chunkSizeActual,
          });
          const binaryString = atob(chunkBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
          await uploadApi.uploadChunk(uploadId, index, bytes.buffer);
          doneCount += 1;
          updateItem({ progress: Math.round((doneCount / totalChunks) * 100) });
        }
      }

      await uploadApi.completeUpload(uploadId, meta.mimeType);
      await uploadApi.waitForCompletion(uploadId);
      await removeSessionStorage(persistKey);
      updateItem({ status: 'done', progress: 100 });
    } catch (e) {
      updateItem({ status: 'error', error: (e as Error).message !== 'Aborted' ? (e instanceof Error ? e.message : '上传失败') : '已取消' });
    } finally { persistKeyRef.current.delete(itemId); }
  }

  function runUploadQueue(assets: { uri: string; name: string; mimeType?: string; size?: number }[]) {
    pausedRef.current = false; abortRef.current = false;
    const items: UploadProgress[] = assets.map(a => ({
      id: nextUploadId.current++, name: a.name, progress: 0, status: 'pending', uri: a.uri,
      mimeType: a.mimeType || 'application/octet-stream',
    }));
    items.forEach((item, i) => fileMetaByItemId.current.set(item.id, {
      uri: assets[i].uri, name: assets[i].name, mimeType: assets[i].mimeType || 'application/octet-stream', size: assets[i].size || 0,
    }));
    setUploadItems(prev => [...prev, ...items]);

    const queue = items.slice();
    let index = 0;
    const processNext = async () => {
      while (index < queue.length) {
        if (abortRef.current) { setUploadItems(prev => prev.map(it =>
          queue.slice(index).some(q => q.id === it.id) && it.status === 'pending'
            ? { ...it, status: 'error', error: '已取消' } : it)); return; }
        const item = queue[index++];
        const meta = fileMetaByItemId.current.get(item.id);
        if (meta && item.status === 'pending') await runUpload(meta, item.id);
      }
    };
    const workers = Array(Math.min(parallelCount, queue.length)).fill(null).map(() => processNext());
    Promise.all(workers).then(() => loadData());
  }

  async function retryUpload(itemId: number) {
    const meta = fileMetaByItemId.current.get(itemId);
    if (!meta) return;
    abortRef.current = false; pausedRef.current = false;
    await runUpload(meta, itemId); await loadData();
  }

  // -----------------------------------------------------------------------
  // Photo upload handlers
  // -----------------------------------------------------------------------
  async function handlePhotoUpload() {
    setShowPhotoPrompt(false);
    const photos = photoDetection.newPhotos;
    if (photos.length === 0) return;

    // Start upload via context
    startUpload(photos);
  }

  function handlePhotoLater() {
    setShowPhotoPrompt(false);
    photoDetection.dismissPrompt();
  }

  // Storage helpers
  const sessionStore = useRef<Map<string, string>>(new Map());
  async function getSessionStorage(key: string) { return sessionStore.current.get(key) ?? null; }
  async function setSessionStorage(key: string, value: string) { sessionStore.current.set(key, value); }
  async function removeSessionStorage(key: string) { sessionStore.current.delete(key); }

  // --- Render ---
  const empty = !isLoading && folders.length === 0 && files.length === 0;
  const hasUploads = uploadItems.length > 0;
  const allUploadsDone = uploadItems.every(it => it.status === 'done' || it.status === 'error');

  const renderItem = ({ item }: { item: Folder | FileItem }) => {
    if ('mimeType' in item) {
      const file = item as FileItem;
      const previewable = isPreviewableImage(file.mimeType, file.name);
      return (
        <TouchableOpacity style={styles.fileRow} activeOpacity={0.7}
          onPress={() => setPreviewFile(file)}
          onLongPress={() => showFileActions(file)}
        >
          <View style={styles.fileInfo}>
            <View style={[styles.thumbBox, previewable ? undefined : styles.thumbPlaceholder]}>
              {previewable ? (
                <Image source={{ uri: filesApi.previewUrl(file.id) }} style={styles.thumbImage} />
              ) : (
                <Text style={styles.thumbText}>{file.name.split('.').pop()?.toUpperCase().slice(0, 3) || '?'}</Text>
              )}
            </View>
            <View style={styles.fileDetails}>
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileSize}>
                {formatBytes(BigInt(file.size))} · {new Date(file.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.actionDot} onPress={() => showFileActions(file)}>
            <EllipsisVerticalIcon size={18} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }
    const folder = item as Folder;
    return (
      <TouchableOpacity style={styles.fileRow} activeOpacity={0.7}
        onPress={() => setPath(p => [...p, { id: folder.id, name: folder.name }])}
        onLongPress={() => showFolderActions(folder)}
      >
        <View style={styles.fileInfo}>
          <View style={[styles.thumbBox, { backgroundColor: '#fef3c7' }]}>
            <FolderIcon size={22} color="#d97706" />
          </View>
          <View style={styles.fileDetails}>
            <Text style={[styles.fileName, { color: theme.colors.accent }]}>{folder.name}</Text>
            <Text style={styles.fileSize}>文件夹 · {new Date(folder.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.actionDot} onPress={() => showFolderActions(folder)}>
          <EllipsisVerticalIcon size={18} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.yourFiles}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowSearch(!showSearch)} style={styles.headerBtn}>
            <MagnifyingGlassIcon size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutText}>{t.signOut}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <MagnifyingGlassIcon size={16} color={theme.colors.textTertiary} />
          <ScrollView horizontal style={styles.searchInputScroll}>
            <TextInput
              style={styles.searchInput}
              placeholder="搜索文件..."
              placeholderTextColor={theme.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </ScrollView>
          {searchQuery ? (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Breadcrumb */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.breadcrumbBar}>
        <TouchableOpacity onPress={() => setPath([])}>
          <Text style={[styles.breadcrumbLink, path.length === 0 && styles.breadcrumbActive]}>全部文件</Text>
        </TouchableOpacity>
        {path.map((seg, i) => (
          <View key={seg.id} style={styles.breadcrumbSeg}>
            <ChevronRightIcon size={12} color={theme.colors.textTertiary} />
            <TouchableOpacity onPress={() => setPath(path.slice(0, i + 1))}>
              <Text style={[styles.breadcrumbLink, i === path.length - 1 && styles.breadcrumbActive]}>{seg.name}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setCreateFolderVisible(true)}>
          <PlusIcon size={16} color={theme.colors.textSecondary} />
          <Text style={styles.actionBtnText}>新建文件夹</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={pickFiles}>
          <Text style={styles.actionBtnText}>上传</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={loadData}>
          <ArrowPathIcon size={16} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Photo upload prompt */}
      {showPhotoPrompt && (
        <PhotoUploadPrompt
          count={photoDetection.count}
          isLoading={photoDetection.isLoading}
          onUpload={handlePhotoUpload}
          onLater={handlePhotoLater}
        />
      )}

      {/* Upload section */}
      {hasUploads ? (
        <View style={styles.uploadSection}>
          <ScrollView style={styles.uploadList} nestedScrollEnabled>
            <View style={styles.uploadControls}>
              <Text style={styles.uploadLabel}>并行: </Text>
              <TouchableOpacity onPress={() => setParallelCount(c => Math.max(1, c - 1))} style={styles.parallelBtn}>
                <Text style={styles.parallelBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.parallelCount}>{parallelCount}</Text>
              <TouchableOpacity onPress={() => setParallelCount(c => Math.min(10, c + 1))} style={styles.parallelBtn}>
                <Text style={styles.parallelBtnText}>+</Text>
              </TouchableOpacity>
            </View>
            {uploadItems.map(item => (
              <UploadProgressRow key={item.id} item={item} onRetry={retryUpload} />
            ))}
            <View style={styles.uploadActionsRow}>
              <TouchableOpacity style={styles.uploadActionBtn} onPress={() => { pausedRef.current = !pausedRef.current; }}>
                <Text style={styles.uploadActionBtnText}>{pausedRef.current ? '继续' : '暂停'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.uploadActionBtn, styles.uploadDanger]} onPress={() => {
                abortRef.current = true; pausedRef.current = false;
                persistKeyRef.current.forEach(k => removeSessionStorage(k));
                persistKeyRef.current.clear();
              }}>
                <Text style={styles.uploadDangerText}>取消全部</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.uploadActionBtn} onPress={() => { if (allUploadsDone) setUploadItems([]); }}>
                <Text style={styles.uploadActionBtnText}>清除已完成</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* File list */}
      {listError ? <Text style={styles.errorText}>{listError}</Text> : null}

      {/* Search results */}
      {searchResults ? (
        <FlatList
          data={searchResults}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.fileRow} onPress={() => setPreviewFile(item)}>
              <View style={styles.fileInfo}>
                <View style={[styles.thumbBox, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbText}>{item.name.split('.').pop()?.toUpperCase().slice(0,3) || '?'}</Text>
                </View>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.fileSize}>{formatBytes(BigInt(item.size))}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
        />
      ) : (
        <FlatList
          data={[...folders, ...files]}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadData} tintColor={theme.colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📁</Text>
              <Text style={styles.emptyTitle}>{isLoading ? '加载中...' : '此文件夹为空'}</Text>
              <Text style={styles.emptySubtitle}>点击上方"上传"添加文件</Text>
            </View>
          }
          contentContainerStyle={empty ? styles.listEmpty : undefined}
        />
      )}

      {/* Modals */}
      <CreateFolderModal visible={createFolderVisible} onClose={() => setCreateFolderVisible(false)} onCreate={handleCreateFolder} />
      {renameTarget && <RenameFolderModal visible initialName={renameTarget.name} onClose={() => setRenameTarget(null)} onRename={name => handleRenameFolder(renameTarget, name)} />}
      {previewFile && <FilePreviewModal file={previewFile} visible={!!previewFile} onClose={() => setPreviewFile(null)} onOpenExternal={url => Linking.openURL(url).catch(() => Alert.alert('错误', '无法打开'))} />}
      {moveTarget && <MoveFileModal file={moveTarget} onClose={() => setMoveTarget(null)} onMoved={() => loadData()} />}
      {renameFileTarget && <RenameFileModal visible fileName={renameFileTarget.name} onClose={() => setRenameFileTarget(null)} onRename={name => handleRenameFile(renameFileTarget, name)} />}
      {shareTarget && <ShareFileModal file={shareTarget} visible={!!shareTarget} onClose={() => setShareTarget(null)} />}
      <ActionSheet visible={actionSheetVisible} title={actionSheetTitle} actions={actionSheetActions} onClose={() => setActionSheetVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  headerTitle: { fontSize: 22, fontWeight: '600', color: theme.colors.text },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBtn: { padding: 4 },
  logoutText: { fontSize: 14, color: theme.colors.accent, fontWeight: '500' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 2, borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.zinc100, gap: 6,
  },
  searchInputScroll: { flex: 1 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.text },
  searchClear: { fontSize: 14, color: theme.colors.textTertiary, padding: 4 },

  // Breadcrumb
  breadcrumbBar: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight },
  breadcrumbSeg: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbLink: { fontSize: 13, color: theme.colors.textSecondary, marginHorizontal: 4 },
  breadcrumbActive: { color: theme.colors.accent, fontWeight: '500' },

  // Action bar
  actionBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight, backgroundColor: theme.colors.zinc50,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radii.md,
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border,
  },
  actionBtnText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },

  // Upload
  uploadSection: { maxHeight: 280, borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight, backgroundColor: theme.colors.zinc50 },
  uploadList: { paddingHorizontal: 16, paddingVertical: 8 },
  uploadControls: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  uploadLabel: { fontSize: 12, color: theme.colors.textTertiary },
  parallelBtn: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  parallelBtnText: { fontSize: 16, color: theme.colors.textSecondary },
  parallelCount: { fontSize: 14, fontWeight: '600', marginHorizontal: 8, minWidth: 20, textAlign: 'center' },
  uploadActionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  uploadActionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  uploadActionBtnText: { fontSize: 12, color: theme.colors.textSecondary },
  uploadDanger: { borderColor: theme.colors.danger },
  uploadDangerText: { fontSize: 12, color: theme.colors.danger },

  // File rows
  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
  },
  fileInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  thumbBox: {
    width: 44, height: 44, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.zinc100,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbPlaceholder: { backgroundColor: theme.colors.zinc100 },
  thumbImage: { width: 44, height: 44, borderRadius: theme.radii.md },
  thumbText: { fontSize: 10, fontWeight: '600', color: theme.colors.textTertiary },
  fileDetails: { marginLeft: 12, flex: 1 },
  fileName: { fontSize: 15, color: theme.colors.text },
  fileSize: { fontSize: 12, color: theme.colors.textTertiary, marginTop: 2 },
  actionDot: { padding: 8 },

  // Errors, empty
  errorText: { color: theme.colors.danger, fontSize: 14, textAlign: 'center', padding: 16 },
  listEmpty: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4 },
});

// Missing import I need to add

