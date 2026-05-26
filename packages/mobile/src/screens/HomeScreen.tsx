import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Image,
  ActivityIndicator,
  Pressable,
  Linking,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { filesApi, foldersApi } from '../api/files';
import { sharesApi } from '../api/shares';
import { uploadApi, CHUNK_SIZE } from '../api/upload';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { FileItem, Folder, UploadProgress } from '../types';

// ---------------------------------------------------------------------------
// Shared utilities (import from shared package with local fallback)
// ---------------------------------------------------------------------------
let formatBytes: (n: bigint) => string;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  formatBytes = require('@smart-files/shared/src/utils').formatBytes;
} catch {
  formatBytes = (n: bigint): string => {
    if (n < 1024n) return `${n} B`;
    const kb = 1024n;
    const mb = kb * kb;
    const gb = mb * kb;
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

// ---------------------------------------------------------------------------
// Upload progress item
// ---------------------------------------------------------------------------
function UploadProgressRow({
  item,
  onRetry,
}: {
  item: UploadProgress;
  onRetry: (id: number) => void;
}) {
  const label =
    item.status === 'done'
      ? 'Done'
      : item.status === 'error'
        ? 'Error'
        : item.status === 'uploading'
          ? 'Uploading'
          : 'Pending';

  const barColor =
    item.status === 'error'
      ? '#ef4444'
      : item.status === 'done'
        ? '#22c55e'
        : '#3b82f6';

  return (
    <View style={styles.uploadItem}>
      <View style={styles.uploadItemHeader}>
        <Text style={styles.uploadItemLabel} numberOfLines={1}>
          {label}
          {' \u00B7 '}
          {item.name}
        </Text>
        {(item.status === 'uploading' || item.status === 'done') && (
          <Text style={styles.uploadItemPercent}>{item.progress}%</Text>
        )}
      </View>
      <View style={styles.progressBarBg}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${item.progress}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      {item.error ? (
        <View style={styles.uploadErrorRow}>
          <Text style={styles.uploadErrorText} numberOfLines={1}>
            {item.error}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => onRetry(item.id)}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Image preview modal
// ---------------------------------------------------------------------------
function ImagePreviewModal({
  file,
  onClose,
}: {
  file: FileItem;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.previewOverlay} onPress={onClose}>
        <Pressable style={styles.previewContent} onPress={() => {}}>
          <TouchableOpacity style={styles.previewCloseBtn} onPress={onClose}>
            <Text style={styles.previewCloseText}>Close</Text>
          </TouchableOpacity>
          <Image
            source={{ uri: filesApi.previewUrl(file.id) }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Move file modal
// ---------------------------------------------------------------------------
function MoveFileModal({
  file,
  onClose,
  onMoved,
}: {
  file: FileItem;
  onClose: () => void;
  onMoved: () => void;
}) {
  const [modalPath, setModalPath] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const modalParentId =
    modalPath.length === 0 ? null : modalPath[modalPath.length - 1].id;

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await filesApi.browse(modalParentId);
      setFolders(data.folders);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load folders');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [modalParentId]);

  useEffect(() => {
    load();
  }, [load]);

  const sameLocation =
    (file.folderId === null && modalParentId === null) ||
    file.folderId === modalParentId;

  async function confirmMove() {
    setErr(null);
    try {
      await filesApi.moveFile(file.id, modalParentId);
      onMoved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Move failed');
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Move file</Text>
          <TouchableOpacity
            disabled={sameLocation}
            onPress={() => confirmMove()}
          >
            <Text
              style={[
                styles.modalDone,
                sameLocation && styles.modalDoneDisabled,
              ]}
            >
              Move here
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.moveBreadcrumb}>
          <Text style={styles.moveBreadcrumbLabel}>Into: </Text>
          <TouchableOpacity onPress={() => setModalPath([])}>
            <Text style={styles.moveBreadcrumbLink}>Root</Text>
          </TouchableOpacity>
          {modalPath.map((seg, i) => (
            <TouchableOpacity
              key={seg.id}
              onPress={() => setModalPath(modalPath.slice(0, i + 1))}
            >
              <Text style={styles.moveBreadcrumbLink}>
                {' / '}
                {seg.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={folders}
          keyExtractor={(f) => f.id}
          contentContainerStyle={styles.moveFolderList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={styles.moveFolderRow}
              onPress={() =>
                setModalPath((p) => [...p, { id: f.id, name: f.name }])
              }
            >
              <Text style={styles.moveFolderName}>{f.name}</Text>
              <Text style={styles.moveFolderArrow}>{'>'}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ marginTop: 20 }} />
            ) : (
              <Text style={styles.moveEmpty}>No subfolders</Text>
            )
          }
        />

        {err ? (
          <Text style={styles.moveError}>{err}</Text>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create folder modal
// ---------------------------------------------------------------------------
function CreateFolderModal({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.dialogBox} onPress={() => {}}>
          <Text style={styles.dialogTitle}>New folder</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Folder name"
            placeholderTextColor="#999"
            style={styles.dialogInput}
            autoFocus
            onSubmitEditing={handleCreate}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity onPress={onClose} style={styles.dialogBtn}>
              <Text style={styles.dialogBtnCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreate}
              style={[styles.dialogBtn, styles.dialogBtnPrimary]}
            >
              <Text style={styles.dialogBtnPrimaryText}>Create</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Rename folder modal
// ---------------------------------------------------------------------------
function RenameFolderModal({
  visible,
  initialName,
  onClose,
  onRename,
}: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  const handleRename = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onRename(trimmed);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.dialogBox} onPress={() => {}}>
          <Text style={styles.dialogTitle}>Rename folder</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Folder name"
            placeholderTextColor="#999"
            style={styles.dialogInput}
            autoFocus
            onSubmitEditing={handleRename}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity onPress={onClose} style={styles.dialogBtn}>
              <Text style={styles.dialogBtnCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRename}
              style={[styles.dialogBtn, styles.dialogBtnPrimary]}
            >
              <Text style={styles.dialogBtnPrimaryText}>Rename</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Share file modal
// ---------------------------------------------------------------------------
function ShareFileModal({
  file,
  onClose,
}: {
  file: FileItem;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [expiresIn, setExpiresIn] = useState('');
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setLoading(true); setErr(null);
    try {
      const result = await sharesApi.createShare(file.id, password || undefined, expiresIn || undefined);
      setShareLink(`${apiClient.defaults.baseURL}/share/${result.token}`);
    } catch (e: any) {
      setErr(e.message || 'Failed to create share link');
    } finally { setLoading(false); }
  }

  const expiryOptions = [
    { label: '1 hour', value: '1h' },
    { label: '24 hours', value: '24h' },
    { label: '7 days', value: '7d' },
    { label: '30 days', value: '30d' },
    { label: 'Never', value: '' },
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.dialogBox} onPress={() => {}}>
          {shareLink ? (
            <>
              <Text style={styles.dialogTitle}>Share link created</Text>
              <Text selectable style={{ fontSize: 13, color: '#007AFF', marginBottom: 12, textAlign: 'center' }}>
                {shareLink}
              </Text>
              <TouchableOpacity onPress={onClose} style={[styles.dialogBtn, styles.dialogBtnPrimary, { alignSelf: 'center' }]}>
                <Text style={styles.dialogBtnPrimaryText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.dialogTitle}>Share {file.name}</Text>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>Password (optional)</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Leave empty for no password"
                placeholderTextColor="#999"
                secureTextEntry
                style={styles.dialogInput}
              />
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Expires</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {expiryOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setExpiresIn(opt.value)}
                    style={{
                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
                      borderWidth: 1,
                      borderColor: expiresIn === opt.value ? '#007AFF' : '#ccc',
                      backgroundColor: expiresIn === opt.value ? '#e8f0fe' : '#fff',
                    }}
                  >
                    <Text style={{ fontSize: 12, color: expiresIn === opt.value ? '#007AFF' : '#333' }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {err ? <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{err}</Text> : null}
              <View style={styles.dialogActions}>
                <TouchableOpacity onPress={onClose} style={styles.dialogBtn}>
                  <Text style={styles.dialogBtnCancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={create} style={[styles.dialogBtn, styles.dialogBtnPrimary]} disabled={loading}>
                  <Text style={styles.dialogBtnPrimaryText}>{loading ? '...' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}


// ---------------------------------------------------------------------------
// Rename file modal
// ---------------------------------------------------------------------------
function RenameFileModal({
  visible,
  file,
  onClose,
  onRename,
}: {
  visible: boolean;
  file: FileItem | null;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(file?.name || '');
  useEffect(() => { if (file) setName(file.name); }, [file]);

  const handle = () => {
    const t = name.trim();
    if (!t) return;
    onRename(t);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.dialogBox} onPress={() => {}}>
          <Text style={styles.dialogTitle}>Rename file</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="File name"
            placeholderTextColor="#999"
            style={styles.dialogInput}
            autoFocus
            onSubmitEditing={handle}
          />
          <View style={styles.dialogActions}>
            <TouchableOpacity onPress={onClose} style={styles.dialogBtn}>
              <Text style={styles.dialogBtnCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handle} style={[styles.dialogBtn, styles.dialogBtnPrimary]}>
              <Text style={styles.dialogBtnPrimaryText}>Rename</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen (main)
// ---------------------------------------------------------------------------
export function HomeScreen() {
  const { logout } = useAuth();
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
  // Stores file metadata by itemId for retry
  const fileMetaByItemId = useRef<
    Map<number, { uri: string; name: string; mimeType: string; size: number }>
  >(new Map());

  // Modal state
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null);
  const [renameFileTarget, setRenameFileTarget] = useState<FileItem | null>(null);
  const [shareTarget, setShareTarget] = useState<FileItem | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Trash state
  const [viewingTrash, setViewingTrash] = useState(false);
  const [trashFiles, setTrashFiles] = useState<any[] | null>(null);
  const [trashLoading, setTrashLoading] = useState(false);

  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectedUploadIds, setSelectedUploadIds] = useState<Set<number>>(new Set());
  const [selectedTrashIds, setSelectedTrashIds] = useState<Set<string>>(new Set());

  const currentParentId =
    path.length === 0 ? null : path[path.length - 1].id;

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------
  const loadData = useCallback(async () => {
    setListError(null);
    setIsLoading(true);
    try {
      const data = await filesApi.browse(currentParentId);
      setFolders(data.folders ?? []);
      setFiles(data.files ?? []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Failed to load files');
      setFolders([]);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentParentId]);



... [OUTPUT TRUNCATED - 7395 chars omitted out of 57395 total] ...

ring.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }

          await uploadApi.uploadChunk(uploadId, index, bytes.buffer);

          doneCount += 1;
          updateItem({ progress: Math.round((doneCount / totalChunks) * 100) });
        }
      }
    };

    try {
      await uploadAllChunks();

      await uploadApi.completeUpload(uploadId, meta.mimeType || undefined);

      await removeSessionStorage(persistKey);
      persistKeyRef.current.delete(itemId);
      updateItem({ status: 'done', progress: 100 });
    } catch (e) {
      if ((e as Error).message !== 'Aborted') {
        updateItem({
          status: 'error',
          error: e instanceof Error ? e.message : 'Upload failed',
        });
      } else {
        updateItem({ status: 'error', error: 'Cancelled' });
      }
    } finally {
      persistKeyRef.current.delete(itemId);
    }
  }

  function runUploadQueue(
    assets: { uri: string; name: string; mimeType?: string; size?: number }[],
  ) {
    pausedRef.current = false;
    abortRef.current = false;

    const items: UploadProgress[] = assets.map((a) => ({
      id: nextUploadId.current++,
      name: a.name,
      progress: 0,
      status: 'pending' as const,
      uri: a.uri,
      mimeType: a.mimeType || 'application/octet-stream',
    }));

    items.forEach((item, i) => {
      fileMetaByItemId.current.set(item.id, {
        uri: assets[i].uri,
        name: assets[i].name,
        mimeType: assets[i].mimeType || 'application/octet-stream',
        size: assets[i].size || 0,
      });
    });

    setUploadItems((prev) => [...prev, ...items]);

    const queue = items.slice();
    let index = 0;

    const processNext = async () => {
      while (index < queue.length) {
        if (abortRef.current) {
          const remainingIndex = index;
          setUploadItems((prev) =>
            prev.map((it) =>
              queue.slice(remainingIndex).some((q) => q.id === it.id) &&
              it.status === 'pending'
                ? { ...it, status: 'error', error: 'Cancelled' }
                : it,
            ),
          );
          return;
        }

        const item = queue[index++];
        const meta = fileMetaByItemId.current.get(item.id);
        if (meta && item.status === 'pending') {
          await runUpload(meta, item.id);
        }
      }
    };

    const workers = Array(Math.min(parallelCount, queue.length))
      .fill(null)
      .map(() => processNext());

    Promise.all(workers).then(() => loadData());
  }

  async function retryUpload(itemId: number) {
    const meta = fileMetaByItemId.current.get(itemId);
    if (!meta) return;
    abortRef.current = false;
    pausedRef.current = false;
    await runUpload(meta, itemId);
    await loadData();
  }

  // -----------------------------------------------------------------------
  // Simple in-memory session storage (replaces sessionStorage)
  // -----------------------------------------------------------------------
  const sessionStore = useRef<Map<string, string>>(new Map());

  async function getSessionStorage(key: string): Promise<string | null> {
    return sessionStore.current.get(key) ?? null;
  }

  async function setSessionStorage(key: string, value: string) {
    sessionStore.current.set(key, value);
  }

  async function removeSessionStorage(key: string) {
    sessionStore.current.delete(key);
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------
  const empty = !isLoading && folders.length === 0 && files.length === 0;

  const hasUploads = uploadItems.length > 0;
  const allUploadsDone = uploadItems.every(
    (it) => it.status === 'done' || it.status === 'error',
  );

  const renderItem = ({ item }: { item: Folder | FileItem }) => {
    if ('mimeType' in item) {
      // File
      const file = item as FileItem;
      const previewable = isPreviewableImage(file.mimeType, file.name);
      return (
        <View style={[styles.fileRow, selectedFileIds.has(file.id) && { backgroundColor: '#f0f7ff' }]}>
          <TouchableOpacity onPress={() => toggleFileSelect(file.id)} style={{ paddingRight: 8 }}>
            <Text style={{ fontSize: 18, color: selectedFileIds.has(file.id) ? '#007AFF' : '#ccc' }}>
              {selectedFileIds.has(file.id) ? '☑' : '☐'}
            </Text>
          </TouchableOpacity>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          activeOpacity={0.7}
          onPress={() => {
            if (previewable) setPreviewFile(file);
          }}
          onLongPress={() => showFileActions(file)}
        >
          <View style={styles.fileInfo}>
            {previewable ? (
              <Image
                source={{ uri: filesApi.previewUrl(file.id) }}
                style={styles.thumbImage}
              />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbPlaceholderText}>—</Text>
              </View>
            )}
            <View style={styles.fileDetails}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>
                {formatBytes(BigInt(file.size))}
                {' \u00B7 '}
                {new Date(file.createdAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionDots}
            onPress={() => showFileActions(file)}
          >
            <Text style={styles.actionDotsText}>{'\u22EE'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Folder
    const folder = item as Folder;
    return (
      <TouchableOpacity
        style={styles.fileRow}
        activeOpacity={0.7}
        onPress={() =>
          setPath((p) => [...p, { id: folder.id, name: folder.name }])
        }
        onLongPress={() => showFolderActions(folder)}
      >
        <View style={{ width: 26 }} />
        <View style={styles.fileInfo}>
          <View style={styles.folderIcon}>
            <Text style={styles.folderIconText}>{'\uD83D\uDCC1'}</Text>
          </View>
          <View style={styles.fileDetails}>
            <Text style={styles.folderName} numberOfLines={1}>
              {folder.name}
            </Text>
            <Text style={styles.fileSize}>
              {new Date(folder.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.actionDots}
          onPress={() => showFolderActions(folder)}
        >
          <Text style={styles.actionDotsText}>{'\u22EE'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Files</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => {
            setViewingTrash(!viewingTrash);
            if (!viewingTrash) loadTrash();
            else { setSearchResults(null); setSearchQuery(''); }
          }}>
            <Text style={styles.logout}>{viewingTrash ? '← Files' : '🗑 Trash'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Breadcrumb */}
      {!viewingTrash && (
      <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.breadcrumbBar}
        contentContainerStyle={styles.breadcrumbContent}
      >
        <TouchableOpacity onPress={() => setPath([])}>
          <Text style={styles.breadcrumbLink}>Root</Text>
        </TouchableOpacity>
        {path.map((seg, i) => (
          <View key={seg.id} style={styles.breadcrumbSegment}>
            <Text style={styles.breadcrumbSep}>{' / '}</Text>
            <TouchableOpacity
              onPress={() => setPath(path.slice(0, i + 1))}
            >
              <Text style={styles.breadcrumbLink}>{seg.name}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      </>
      )}

      {/* Search bar */}
      {!viewingTrash && (
      <View style={styles.searchBar}>
        <TextInput
          value={searchQuery}
          onChangeText={(v) => { setSearchQuery(v); setTimeout(() => doSearch(v), 300); }}
          onSubmitEditing={() => doSearch(searchQuery)}
          placeholder="Search files…"
          placeholderTextColor="#999"
          style={styles.searchInput}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults(null); }}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      )}

      {/* Action bar */}
      {!viewingTrash && (
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCreateFolderVisible(true)}
        >
          <Text style={styles.actionBtnText}>{'\u002B'} Folder</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={pickFiles}>
          <Text style={styles.actionBtnText}>{'\u2191'} Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={loadData}>
          <Text style={styles.actionBtnText}>{'\u21BB'}</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* Upload section */}
      {!viewingTrash && hasUploads ? (
        <View style={styles.uploadSection}>
          <ScrollView
            style={styles.uploadList}
            nestedScrollEnabled
          >
            {/* Batch upload actions */}
            {selectedUploadIds.size > 0 && (
              <View style={styles.batchBar}>
                <Text style={styles.batchBarText}>{selectedUploadIds.size} selected</Text>
                <TouchableOpacity onPress={() => {
                  setUploadItems(p => p.filter(it => !selectedUploadIds.has(it.id)));
                  setSelectedUploadIds(new Set());
                }}>
                  <Text style={styles.batchBarAction}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  setUploadItems(p => p.filter(it => !(selectedUploadIds.has(it.id) && (it.status === 'done' || it.status === 'error'))));
                  setSelectedUploadIds(new Set());
                }}>
                  <Text style={styles.batchBarAction}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}
            {/* Parallel count control */}
            <View style={styles.uploadControls}>
              <Text style={styles.uploadControlsLabel}>Parallel: </Text>
              <TouchableOpacity
                style={styles.parallelBtn}
                onPress={() => setParallelCount((c) => Math.max(1, c - 1))}
              >
                <Text style={styles.parallelBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.parallelCount}>{parallelCount}</Text>
              <TouchableOpacity
                style={styles.parallelBtn}
                onPress={() => setParallelCount((c) => Math.min(10, c + 1))}
              >
                <Text style={styles.parallelBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {uploadItems.map((item) => (
              <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => toggleUploadSelect(item.id)} style={{ paddingRight: 8 }}>
                  <Text style={{ fontSize: 18, color: selectedUploadIds.has(item.id) ? '#007AFF' : '#ccc' }}>
                    {selectedUploadIds.has(item.id) ? '☑' : '☐'}
                  </Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <UploadProgressRow item={item} onRetry={retryUpload} />
                </View>
              </View>
            ))}

            <View style={styles.uploadActionsRow}>
              <TouchableOpacity
                style={styles.uploadActionBtn}
                onPress={() => {
                  pausedRef.current = !pausedRef.current;
                }}
              >
                <Text style={styles.uploadActionBtnText}>
                  {pausedRef.current ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.uploadActionBtn, styles.uploadActionBtnDanger]}
                onPress={() => {
                  abortRef.current = true;
                  pausedRef.current = false;
                  persistKeyRef.current.forEach((key) => {
                    removeSessionStorage(key);
                  });
                  persistKeyRef.current.clear();
                }}
              >
                <Text style={styles.uploadActionBtnDangerText}>
                  Cancel all
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadActionBtn}
                onPress={() => {
                  if (allUploadsDone) setUploadItems([]);
                }}
              >
                <Text style={styles.uploadActionBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      ) : null}

      {/* Content list */}
      {listError && !viewingTrash ? (
        <Text style={styles.errorText}>{listError}</Text>
      ) : null}

      {/* Trash view */}
      {viewingTrash ? (
        <View style={{ flex: 1 }}>
          {trashFiles && trashFiles.length > 0 && (
            <TouchableOpacity style={styles.emptyTrashBtn} onPress={handleEmptyTrash}>
              <Text style={styles.emptyTrashText}>Empty trash</Text>
            </TouchableOpacity>
          )}
          {selectedTrashIds.size > 0 && (
            <View style={styles.batchBar}>
              <Text style={styles.batchBarText}>{selectedTrashIds.size} selected</Text>
              <TouchableOpacity onPress={handleBatchRestore}>
                <Text style={[styles.batchBarAction, { color: '#22c55e' }]}>Restore</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleBatchPurge}>
                <Text style={[styles.batchBarAction, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          <FlatList
            data={trashFiles || []}
            keyExtractor={(f: any) => f.id}
            refreshControl={<RefreshControl refreshing={trashLoading} onRefresh={loadTrash} />}
            renderItem={({ item }: { item: any }) => (
              <View style={[styles.fileRow, selectedTrashIds.has(item.id) && { backgroundColor: '#f0f7ff' }]}>
                <TouchableOpacity onPress={() => toggleTrashSelect(item.id)} style={{ paddingRight: 8 }}>
                  <Text style={{ fontSize: 18, color: selectedTrashIds.has(item.id) ? '#007AFF' : '#ccc' }}>
                    {selectedTrashIds.has(item.id) ? '☑' : '☐'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.fileInfo}>
                  <View style={styles.thumbPlaceholder}><Text style={styles.thumbPlaceholderText}>🗑</Text></View>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.fileSize}>{item.folderName || 'Root'} · {new Date(item.deletedAt).toLocaleDateString()}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => handleRestoreFile(item.id)}>
                    <Text style={{ color: '#22c55e', fontSize: 13 }}>Restore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handlePurgeFile(item.id)}>
                    <Text style={{ color: '#ef4444', fontSize: 13 }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{trashLoading ? 'Loading…' : 'Trash is empty'}</Text>
              </View>
            }
          />
        </View>
      ) : searchResults !== null ? (
        /* Search results */
        <FlatList
          data={searchResults}
          keyExtractor={(f: any) => f.id}
          renderItem={({ item }: { item: any }) => (
            <TouchableOpacity style={styles.fileRow} onPress={() => {
              setSearchResults(null); setSearchQuery('');
              if (item.folderId) setPath([{ id: item.folderId, name: item.folderName }]);
            }}>
              <View style={styles.fileInfo}>
                <View style={styles.thumbPlaceholder}><Text style={styles.thumbPlaceholderText}>🔍</Text></View>
                <View style={styles.fileDetails}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.fileSize}>{item.folderName || 'Root'} · {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{searchLoading ? 'Searching…' : 'No matching files'}</Text>
            </View>
          }
        />
      ) : (
        /* Normal file list */
      <>
      {selectedFileIds.size > 0 && (
        <View style={styles.batchBar}>
          <Text style={styles.batchBarText}>{selectedFileIds.size} selected</Text>
          <TouchableOpacity onPress={handleBatchDelete}>
            <Text style={[styles.batchBarAction, { color: '#ef4444' }]}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedFileIds(new Set())}>
            <Text style={styles.batchBarAction}>Deselect</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={[...folders, ...files]}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadData} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {isLoading ? 'Loading\u2026' : 'No files in this folder'}
            </Text>
          </View>
        }
        contentContainerStyle={
          folders.length === 0 && files.length === 0
            ? styles.listEmpty
            : undefined
        }
      />
      </>
      )}

      {/* Modals */}
      <CreateFolderModal
        visible={createFolderVisible}
        onClose={() => setCreateFolderVisible(false)}
        onCreate={handleCreateFolder}
      />

      {renameTarget ? (
        <RenameFolderModal
          visible
          initialName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onRename={(name) => handleRenameFolder(renameTarget, name)}
        />
      ) : null}

      {previewFile ? (
        <ImagePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      ) : null}

      {moveTarget ? (
        <MoveFileModal
          file={moveTarget}
          onClose={() => setMoveTarget(null)}
          onMoved={() => loadData()}
        />
      ) : null}

      {shareTarget ? (
        <ShareFileModal
          file={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      ) : null}

      <RenameFileModal
        visible={renameFileTarget !== null}
        file={renameFileTarget}
        onClose={() => setRenameFileTarget(null)}
        onRename={(name) => {
          if (renameFileTarget) handleRenameFile(renameFileTarget, name);
        }}
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  logout: {
    color: '#007AFF',
    fontSize: 16,
  },

  // Breadcrumb
  breadcrumbBar: {
    maxHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  breadcrumbContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  breadcrumbLink: {
    color: '#007AFF',
    fontSize: 14,
  },
  breadcrumbSegment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbSep: {
    color: '#999',
    fontSize: 14,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },

  // Upload section
  uploadSection: {
    maxHeight: 280,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fafafa',
  },
  uploadList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  uploadControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadControlsLabel: {
    fontSize: 12,
    color: '#666',
  },
  parallelBtn: {
    width: 28,
    height: 28,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parallelBtnText: {
    fontSize: 16,
    color: '#333',
  },
  parallelCount: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
    minWidth: 20,
    textAlign: 'center',
  },

  // Upload item
  uploadItem: {
    marginBottom: 10,
  },
  uploadItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  uploadItemLabel: {
    fontSize: 12,
    color: '#555',
    flex: 1,
    marginRight: 8,
  },
  uploadItemPercent: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  uploadErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  uploadErrorText: {
    fontSize: 11,
    color: '#ef4444',
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  retryBtnText: {
    fontSize: 11,
    color: '#ef4444',
  },
  uploadActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  uploadActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  uploadActionBtnText: {
    fontSize: 12,
    color: '#333',
  },
  uploadActionBtnDanger: {
    borderColor: '#ef4444',
  },
  uploadActionBtnDangerText: {
    fontSize: 12,
    color: '#ef4444',
  },

  // File / folder rows
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileDetails: {
    marginLeft: 10,
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    color: '#222',
  },
  folderName: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  folderIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f0f8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderIconText: {
    fontSize: 22,
  },
  thumbImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  thumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholderText: {
    color: '#aaa',
    fontSize: 16,
  },

  // Action dots
  actionDots: {
    paddingLeft: 12,
    paddingVertical: 8,
  },
  actionDotsText: {
    fontSize: 20,
    color: '#666',
  },

  // Batch bar
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f7ff',
    borderBottomWidth: 1,
    borderBottomColor: '#d0e0f0',
  },
  batchBarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    flex: 1,
  },
  batchBarAction: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  searchClear: {
    fontSize: 16,
    color: '#999',
    paddingLeft: 8,
  },

  // Empty trash
  emptyTrashBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  emptyTrashText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#999',
    fontSize: 15,
  },
  listEmpty: {
    flexGrow: 1,
  },

  // Error text
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dialogBtnCancel: {
    fontSize: 15,
    color: '#666',
  },
  dialogBtnPrimary: {
    backgroundColor: '#007AFF',
  },
  dialogBtnPrimaryText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },

  // Image preview
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  previewCloseText: {
    color: '#fff',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: '80%',
  },

  // Move file modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCancel: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalDone: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalDoneDisabled: {
    color: '#ccc',
  },
  moveBreadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  moveBreadcrumbLabel: {
    fontSize: 14,
    color: '#666',
  },
  moveBreadcrumbLink: {
    fontSize: 14,
    color: '#007AFF',
  },
  moveFolderList: {
    paddingVertical: 4,
  },
  moveFolderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  moveFolderName: {
    fontSize: 15,
    color: '#007AFF',
  },
  moveFolderArrow: {
    fontSize: 15,
    color: '#999',
  },
  moveEmpty: {
    textAlign: 'center',
    paddingVertical: 30,
    color: '#999',
  },
  moveError: {
    color: '#ef4444',
    fontSize: 13,
    padding: 16,
    textAlign: 'center',
  },
});