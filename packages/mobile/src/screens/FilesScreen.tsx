import React, { useCallback, useEffect, useState } from 'react';
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
import { filesApi, foldersApi } from '../api/files';
import { useAuth } from '../context/AuthContext';
import { useI18n, tFormat } from '@smart-files/shared/src/i18n';
import { theme } from '../theme';
import {
  FolderIcon, FolderOpenIcon, PlusIcon, TrashIcon,
  MagnifyingGlassIcon, ArrowPathIcon, EllipsisVerticalIcon,
  ChevronRightIcon, XMarkIcon,
} from '../components/icons';
import type { FileItem, Folder } from '../types';
import { useUploadContext } from '../context/UploadContext';
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

export function FilesScreen() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { startFileUpload } = useUploadContext();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileItem[] | null>(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMoveTargets, setBatchMoveTargets] = useState<FileItem[] | null>(null);

  // Trash state
  const [viewingTrash, setViewingTrash] = useState(false);
  const [trashFiles, setTrashFiles] = useState<Array<{
    id: string; name: string; size: string; folderName: string | null;
    deletedAt: string; folderId: string | null;
  }> | null>(null);
  const [trashLoading, setTrashLoading] = useState(false);
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());

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

  // --- Selection ---
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setIsSelecting(false);
  }

  async function handleBatchDelete() {
    const count = selectedIds.size;
    Alert.alert('删除', `确认删除选中的 ${count} 个项目？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        try {
          const fileIds = files.filter(f => selectedIds.has(f.id)).map(f => f.id);
          const folderIds = folders.filter(f => selectedIds.has(f.id)).map(f => f.id);
          if (fileIds.length > 0) await filesApi.batchDelete(fileIds);
          for (const fid of folderIds) await foldersApi.deleteFolder(fid);
          clearSelection();
          await loadData();
        } catch (e) {
          Alert.alert('错误', e instanceof Error ? e.message : '批量删除失败');
        }
      }},
    ]);
  }

  function handleBatchMove() {
    const targetFiles = files.filter(f => selectedIds.has(f.id));
    if (targetFiles.length === 0) {
      Alert.alert('提示', '请选择要移动的文件');
      return;
    }
    setBatchMoveTargets(targetFiles);
  }

  // --- Trash ---
  function toggleTrashSelect(id: string) {
    setSelectedTrashIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function loadTrash() {
    setTrashLoading(true);
    try {
      const files = await filesApi.listTrash();
      setTrashFiles(files);
    } catch {
      setTrashFiles([]);
    } finally {
      setTrashLoading(false);
    }
  }

  async function handleRestore(id: string) {
    try {
      await filesApi.restoreFile(id);
      await loadTrash();
    } catch { Alert.alert('Error', t.restoreFailed); }
  }

  async function handlePurge(id: string) {
    Alert.alert(t.confirmDeleteTitle, '', [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => {
        try { await filesApi.purgeFile(id); await loadTrash(); }
        catch { Alert.alert('Error', t.deleteFailed); }
      }},
    ]);
  }

  async function handleBatchRestoreTrash() {
    try {
      await filesApi.batchRestore(Array.from(selectedTrashIds));
      setSelectedTrashIds(new Set());
      await loadTrash();
    } catch { Alert.alert('Error', t.batchRestoreFailed); }
  }

  async function handleBatchPurgeTrash() {
    Alert.alert(tFormat(t.deleteSelectedConfirm, { n: selectedTrashIds.size }), '', [
      { text: t.cancel, style: 'cancel' },
      { text: t.deletePermanently, style: 'destructive', onPress: async () => {
        try {
          await filesApi.batchPurge(Array.from(selectedTrashIds));
          setSelectedTrashIds(new Set());
          await loadTrash();
        } catch { Alert.alert('Error', t.batchDeleteFailed); }
      }},
    ]);
  }

  async function handleEmptyTrash() {
    if (!trashFiles) return;
    Alert.alert(tFormat(t.deleteSelectedConfirm, { n: trashFiles.length }), '', [
      { text: t.cancel, style: 'cancel' },
      { text: t.deletePermanently, style: 'destructive', onPress: async () => {
        try { await filesApi.emptyTrash(); await loadTrash(); }
        catch { Alert.alert('Error', t.batchPurgeFailed); }
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
      { key: 'rename', label: t.rename, icon: '✏️', onPress: () => setRenameTarget(folder) },
      { key: 'delete', label: t.delete, icon: '🗑️', danger: true, onPress: () => handleDeleteFolder(folder) },
    ]);
    setActionSheetVisible(true);
  }

  // --- Upload ---
  async function pickFiles() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      // Start upload via background service (runs even when app backgrounds)
      const assets = result.assets.map(a => ({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType || 'application/octet-stream',
        size: a.size || 0,
      }));
      startFileUpload(assets, currentParentId);
    } catch { Alert.alert('错误', '选择文件失败'); }
  }

  // --- Render ---
  const empty = !isLoading && folders.length === 0 && files.length === 0;

  const renderItem = ({ item }: { item: Folder | FileItem }) => {
    if ('mimeType' in item) {
      const file = item as FileItem;
      const previewable = isPreviewableImage(file.mimeType, file.name);
      const isSelected = selectedIds.has(file.id);
      return (
        <TouchableOpacity style={[styles.fileRow, isSelecting && isSelected && styles.selectedRow]} activeOpacity={0.7}
          onPress={() => {
            if (isSelecting) {
              toggleSelect(file.id);
            } else {
              setPreviewFile(file);
            }
          }}
          onLongPress={() => { if (!isSelecting) showFileActions(file); }}
        >
          {isSelecting && (
            <View style={styles.checkbox}>
              <View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]}>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </View>
          )}
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
          {!isSelecting && (
            <TouchableOpacity style={styles.actionDot} onPress={() => showFileActions(file)}>
              <EllipsisVerticalIcon size={18} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      );
    }
    const folder = item as Folder;
    const isSelected = selectedIds.has(folder.id);
    return (
      <TouchableOpacity style={[styles.fileRow, isSelecting && isSelected && styles.selectedRow]} activeOpacity={0.7}
        onPress={() => {
          if (isSelecting) {
            toggleSelect(folder.id);
          } else {
            setPath(p => [...p, { id: folder.id, name: folder.name }]);
          }
        }}
        onLongPress={() => { if (!isSelecting) showFolderActions(folder); }}
      >
        {isSelecting && (
          <View style={styles.checkbox}>
            <View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]}>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </View>
        )}
        <View style={styles.fileInfo}>
          <View style={[styles.thumbBox, { backgroundColor: '#fef3c7' }]}>
            <FolderIcon size={22} color="#d97706" />
          </View>
          <View style={styles.fileDetails}>
            <Text style={[styles.fileName, { color: theme.colors.accent }]}>{folder.name}</Text>
            <Text style={styles.fileSize}>文件夹 · {new Date(folder.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        {!isSelecting && (
          <TouchableOpacity style={styles.actionDot} onPress={() => showFolderActions(folder)}>
            <EllipsisVerticalIcon size={18} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with breadcrumb merged */}
      <View style={[styles.header, path.length > 0 && { paddingVertical: 8 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerBreadcrumbScroll} contentContainerStyle={styles.headerBreadcrumbContent}>
          <TouchableOpacity onPress={() => setPath([])}>
            <Text style={[styles.headerBreadcrumbLink, path.length === 0 && styles.headerBreadcrumbActive]}>
              {t.yourFiles}
            </Text>
          </TouchableOpacity>
          {path.map((seg, i) => (
            <View key={seg.id} style={styles.headerBreadcrumbSeg}>
              <ChevronRightIcon size={12} color={theme.colors.textTertiary} />
              <TouchableOpacity onPress={() => setPath(path.slice(0, i + 1))}>
                <Text style={[styles.headerBreadcrumbLink, i === path.length - 1 && styles.headerBreadcrumbActive]}>
                  {seg.name}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => { setIsSelecting(!isSelecting); if (isSelecting) setSelectedIds(new Set()); }} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>{isSelecting ? '完成' : '选择'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>{t.signOut}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search bar — hidden in trash view */}
      {!viewingTrash && (<View style={styles.searchBar}>
        <MagnifyingGlassIcon size={14} color={theme.colors.textTertiary} />
        <ScrollView horizontal style={styles.searchInputScroll}>
          <TextInput
            style={styles.searchInput}
            placeholder="搜索文件..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </ScrollView>
        {searchQuery ? (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>)}

      {/* Action bar */}
      <View style={styles.actionBar}>
        {isSelecting && !viewingTrash ? (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              const allIds = [...folders, ...files].map(i => i.id);
              if (allIds.every(id => selectedIds.has(id))) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(allIds));
              }
            }}>
              <Text style={styles.actionBtnText}>
                {[...folders, ...files].every(i => selectedIds.has(i.id)) ? t.deselectAll : t.selectAll}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectCount}>
              {tFormat(t.selectedCount, { n: selectedIds.size })}
            </Text>
          </>
        ) : viewingTrash ? (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              if (!trashFiles) return;
              const allIds = trashFiles.map(f => f.id);
              if (allIds.every(id => selectedTrashIds.has(id))) {
                setSelectedTrashIds(new Set());
              } else {
                setSelectedTrashIds(new Set(allIds));
              }
            }}>
              <Text style={styles.actionBtnText}>
                {trashFiles && trashFiles.every(f => selectedTrashIds.has(f.id)) ? t.deselectAll : t.selectAll}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectCount}>{t.trashTitle}</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              setViewingTrash(false);
              setSelectedTrashIds(new Set());
              setTrashFiles(null);
              loadData();
            }}>
              <Text style={styles.actionBtnText}>{t.backToFiles}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setCreateFolderVisible(true)}>
              <PlusIcon size={16} color={theme.colors.textSecondary} />
              <Text style={styles.actionBtnText}>{t.newFolder}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={pickFiles}>
              <Text style={styles.actionBtnText}>{t.upload}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => { setViewingTrash(true); setSearchQuery(''); setSearchResults(null); loadTrash(); }}>
              <TrashIcon size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={loadData}>
              <ArrowPathIcon size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* File list wrapper — takes remaining flex space */}
      <View style={styles.listWrapper}>

      {/* Trash view */}
      {viewingTrash ? (
        <FlatList
          data={trashFiles ?? []}
          renderItem={({ item }) => {
            const isSelected = selectedTrashIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.fileRow, isSelected && styles.selectedRow]}
                activeOpacity={0.7}
                onPress={() => toggleTrashSelect(item.id)}
                onLongPress={() => {
                  Alert.alert(item.name, undefined, [
                    { text: t.restore, onPress: () => handleRestore(item.id) },
                    { text: t.deletePermanently, style: 'destructive', onPress: () => handlePurge(item.id) },
                    { text: t.cancel, style: 'cancel' },
                  ]);
                }}
              >
                <View style={styles.checkbox}>
                  <View style={[styles.checkboxBox, isSelected && styles.checkboxChecked]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </View>
                <View style={styles.fileInfo}>
                  <View style={[styles.thumbBox, styles.thumbPlaceholder]}>
                    <Text style={styles.thumbText}>{item.name.split('.').pop()?.toUpperCase().slice(0, 3) || '?'}</Text>
                  </View>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.fileSize}>
                      {formatBytes(BigInt(item.size))} · {(item.folderName || t.root)} · {new Date(item.deletedAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.actionDot} onPress={() => handleRestore(item.id)}>
                  <Text style={{ fontSize: 18 }}>↩</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionDot} onPress={() => handlePurge(item.id)}>
                  <Text style={{ fontSize: 18, color: '#ef4444' }}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={trashLoading} onRefresh={loadTrash} tintColor={theme.colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🗑️</Text>
              <Text style={styles.emptyTitle}>{trashLoading ? '加载中...' : t.trashEmpty}</Text>
            </View>
          }
          contentContainerStyle={!trashFiles || trashFiles.length === 0 ? styles.listEmpty : undefined}
          ListFooterComponent={
            trashFiles && trashFiles.length > 0 ? (
              <TouchableOpacity
                onPress={handleEmptyTrash}
                style={{ paddingVertical: 16, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 13, color: theme.colors.danger }}>{t.emptyTrash}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      ) : listError ? <Text style={styles.errorText}>{listError}</Text> : null}

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

      </View>{/* end listWrapper */}

      {/* Batch action bar for files */}
      {selectedIds.size > 0 && !viewingTrash && (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarCount}>已选择 {selectedIds.size} 项</Text>
          <View style={styles.batchBarActions}>
            <TouchableOpacity style={styles.batchBarBtn} onPress={handleBatchMove}>
              <FolderIcon size={16} color="#fff" />
              <Text style={styles.batchBarBtnText}>移动</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.batchBarBtn, styles.batchBarBtnDanger]} onPress={handleBatchDelete}>
              <TrashIcon size={16} color="#fff" />
              <Text style={styles.batchBarBtnText}>删除</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.batchBarBtn} onPress={clearSelection}>
              <XMarkIcon size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Batch action bar for trash */}
      {selectedTrashIds.size > 0 && viewingTrash && (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarCount}>{tFormat(t.selectedCount, { n: selectedTrashIds.size })}</Text>
          <View style={styles.batchBarActions}>
            <TouchableOpacity style={styles.batchBarBtn} onPress={handleBatchRestoreTrash}>
              <Text style={styles.batchBarBtnText}>{t.restore}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.batchBarBtn, styles.batchBarBtnDanger]} onPress={handleBatchPurgeTrash}>
              <Text style={styles.batchBarBtnText}>{t.deletePermanently}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.batchBarBtn} onPress={() => setSelectedTrashIds(new Set())}>
              <XMarkIcon size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modals */}
      <CreateFolderModal visible={createFolderVisible} onClose={() => setCreateFolderVisible(false)} onCreate={handleCreateFolder} />
      {renameTarget && <RenameFolderModal visible initialName={renameTarget.name} onClose={() => setRenameTarget(null)} onRename={name => handleRenameFolder(renameTarget, name)} />}
      {previewFile && <FilePreviewModal file={previewFile} visible={!!previewFile} onClose={() => setPreviewFile(null)} onOpenExternal={url => Linking.openURL(url).catch(() => Alert.alert('错误', '无法打开'))} />}
      {moveTarget && <MoveFileModal files={[moveTarget]} onClose={() => setMoveTarget(null)} onMoved={() => loadData()} />}
      {batchMoveTargets && <MoveFileModal files={batchMoveTargets} onClose={() => setBatchMoveTargets(null)} onMoved={() => { clearSelection(); loadData(); }} />}
      {renameFileTarget && <RenameFileModal visible fileName={renameFileTarget.name} onClose={() => setRenameFileTarget(null)} onRename={name => handleRenameFile(renameFileTarget, name)} />}
      {shareTarget && <ShareFileModal file={shareTarget} visible={!!shareTarget} onClose={() => setShareTarget(null)} />}
      <ActionSheet visible={actionSheetVisible} title={actionSheetTitle} actions={actionSheetActions} onClose={() => setActionSheetVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },

  // Header (merged with breadcrumb)
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight,
    minHeight: 44,
  },
  headerBreadcrumbScroll: { flex: 1, marginRight: 8 },
  headerBreadcrumbContent: { alignItems: 'center', gap: 3 },
  headerBreadcrumbSeg: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  headerBreadcrumbLink: { fontSize: 15, color: theme.colors.textSecondary },
  headerBreadcrumbActive: { color: theme.colors.text, fontWeight: '600' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  headerBtn: { padding: 4 },
  headerBtnText: { fontSize: 13, color: theme.colors.accent, fontWeight: '500' },

  // File list wrapper
  listWrapper: { flex: 1 },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 4, marginBottom: 2,
    paddingHorizontal: 10, paddingVertical: 0, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.zinc100, gap: 4,
  },
  searchInputScroll: { flex: 1 },
  searchInput: { flex: 1, paddingVertical: 7, fontSize: 13, color: theme.colors.text },
  searchClear: { fontSize: 13, color: theme.colors.textTertiary, padding: 2 },

  // (breadcrumb merged into header above)

  // Action bar
  actionBar: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, gap: 6,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight, backgroundColor: theme.colors.zinc50,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radii.sm,
    backgroundColor: '#fff', borderWidth: 1, borderColor: theme.colors.border,
  },
  actionBtnText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  selectCount: { fontSize: 12, color: theme.colors.textSecondary },

  // Upload (compact collapsible)
  uploadSection: { borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight, backgroundColor: theme.colors.zinc50 },
  uploadBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8,
  },
  uploadBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  uploadBarIcon: { fontSize: 12 },
  uploadBarText: { fontSize: 12, color: theme.colors.textSecondary },
  uploadBarArrow: { fontSize: 12, color: theme.colors.textTertiary },
  uploadExpanded: { paddingHorizontal: 12, paddingBottom: 8, maxHeight: 180 },
  uploadMoreText: { fontSize: 12, color: theme.colors.textTertiary, textAlign: 'center', paddingVertical: 6 },
  uploadActionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  uploadActionBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  uploadActionBtnText: { fontSize: 11, color: theme.colors.textSecondary },
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

  // Selection
  checkbox: { width: 24, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  checkboxBox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: theme.colors.textTertiary, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkmark: { fontSize: 13, color: '#fff', fontWeight: '700' },
  selectedRow: { backgroundColor: theme.colors.accent + '15' },

  // Batch action bar
  batchBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1c1c1e', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  batchBarCount: { fontSize: 14, fontWeight: '600', color: '#fff' },
  batchBarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batchBarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  batchBarBtnDanger: { backgroundColor: '#ef4444' },
  batchBarBtnText: { fontSize: 14, color: '#fff', fontWeight: '500' },

  // Errors, empty
  errorText: { color: theme.colors.danger, fontSize: 14, textAlign: 'center', padding: 16 },
  listEmpty: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.text },
  emptySubtitle: { fontSize: 13, color: theme.colors.textTertiary, marginTop: 4 },
});

