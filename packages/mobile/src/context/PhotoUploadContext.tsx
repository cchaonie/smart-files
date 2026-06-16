/**
 * PhotoUploadContext — Upload state management with background support.
 *
 * This context wraps the persistent UploadQueue (AsyncStorage) so that:
 *   - All upload state survives app restarts and background transitions
 *   - When app goes to background, uploads continue via BackgroundUpload task
 *   - When app comes to foreground, state is re-read from the queue
 */
import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import { AppState, AppStateStatus } from 'react-native';
import {
  getQueue,
  setQueue,
  updateItem as updateQueueItem,
  clearCompleted as clearQueueCompleted,
  setUploadsActive,
  getUploadsActive,
  enqueue,
  UploadQueueItem,
} from '../services/UploadQueue';
import {
  startBackgroundUpload,
  stopBackgroundUpload,
  registerBackgroundUpload,
} from '../services/BackgroundUpload';
import { photosApi } from '../api/photos';
import { uploadApi, CHUNK_SIZE } from '../api/upload';
import type { NewPhotoAsset } from '../hooks/usePhotoDetection';
import * as FileSystem from 'expo-file-system/legacy';

export type UploadStatus = 'pending' | 'uploading' | 'paused' | 'done' | 'error';

export interface UploadItem {
  id: string;
  filename: string;
  type: 'photo' | 'file';
  status: UploadStatus;
  progress: number;
  error?: string;
  uri?: string;
  mimeType?: string;
}

interface UploadedPhoto {
  assetId: string;
  filename: string;
}

interface PhotoUploadContextType {
  /** Current upload items for UI display */
  items: UploadItem[];
  /** Whether any upload is in progress */
  isUploading: boolean;
  /** Badge count for tab icon */
  badgeCount: number;
  /** Tracked uploaded photos for cleanup */
  uploadedPhotos: UploadedPhoto[];
  isCleaningUp: boolean;
  cleanupResult: {
    success: number;
    failed: number;
    errors: string[];
  } | null;

  /** Start uploading a batch of photos */
  startUpload: (photos: NewPhotoAsset[], deviceModel?: string) => Promise<void>;
  /** Start uploading files (from DocumentPicker) */
  startFileUpload: (
    files: { uri: string; name: string; mimeType: string; size?: number }[],
    folderId?: string | null,
  ) => Promise<void>;
  /** Pause a single upload */
  pauseUpload: (id: string) => void;
  /** Resume a single upload */
  resumeUpload: (id: string) => void;
  /** Cancel a single upload */
  cancelUpload: (id: string) => void;
  /** Retry a single failed upload */
  retryUpload: (id: string) => void;
  /** Pause all active uploads */
  pauseAll: () => void;
  /** Resume all paused uploads */
  resumeAll: () => void;
  /** Cancel all uploads */
  cancelAll: () => void;
  /** Remove completed items from the list */
  clearCompleted: () => Promise<void>;
  /** Retry all failed uploads */
  retryFailed: () => Promise<void>;
  /** Delete uploaded photos from camera roll */
  cleanupCompletedPhotos: () => Promise<void>;
  /** Dismiss cleanup result */
  dismissCleanupResult: () => void;
  /** Mark sync timestamp (for photo detection) */
  markSynced: () => Promise<void>;
  /** Force re-read queue from AsyncStorage (used after background return) */
  refreshQueue: () => Promise<void>;
}

const PhotoUploadContext = createContext<PhotoUploadContextType | undefined>(
  undefined,
);

export function PhotoUploadProvider({
  children,
  onMarkSynced,
  onAssetUploaded,
}: {
  children: React.ReactNode;
  onMarkSynced?: () => Promise<void>;
  onAssetUploaded?: (assetId: string) => Promise<void>;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const abortRef = useRef(false);
  const pausedRef = useRef<Set<string>>(new Set());
  const uploadedPhotosRef = useRef<UploadedPhoto[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  // Track whether we're currently processing in foreground
  const isProcessingRef = useRef(false);

  // Request notification permissions on mount
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  // Load queue from AsyncStorage on mount
  useEffect(() => {
    loadQueueFromStorage();
    registerBackgroundUpload();
  }, []);

  // Listen for app state changes → hand off to/from background task
  useEffect(() => {
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  async function loadQueueFromStorage() {
    const queue = await getQueue();
    setItems(
      queue.map((q) => ({
        id: q.id,
        filename: q.filename,
        type: q.type,
        status: q.status,
        progress: q.progress,
        error: q.error,
        uri: q.uri,
        mimeType: q.mimeType,
      })),
    );
    const hasActive = queue.some(
      (q) => q.status === 'pending' || q.status === 'uploading',
    );
    setIsUploading(hasActive);

    // Resume processing items that were left in 'uploading' or 'paused' state
    const stale = queue.filter((q) => q.status === 'uploading' || q.status === 'paused');
    for (const item of stale) {
      await updateQueueItem(item.id, { status: 'pending', progress: 0 });
    }
    if (stale.length > 0) {
      const updated = await getQueue();
      setItems(
        updated.map((q) => ({
          id: q.id,
          filename: q.filename,
          type: q.type,
          status: q.status,
          progress: q.progress,
          error: q.error,
          uri: q.uri,
          mimeType: q.mimeType,
        })),
      );
    }

    // Load uploaded photos ref from tracking
    try {
      const raw = await AsyncStorage.getItem('uploaded_photos_tracking');
      if (raw) {
        const parsed: UploadedPhoto[] = JSON.parse(raw);
        uploadedPhotosRef.current = parsed;
        setUploadedPhotos(parsed);
      }
    } catch {}
  }

  async function handleAppStateChange(nextState: AppStateStatus) {
    const prevState = appStateRef.current;
    appStateRef.current = nextState;

    const hasPending = items.some(
      (i) => i.status === 'pending' || i.status === 'uploading',
    );

    if (
      prevState === 'active' &&
      (nextState === 'inactive' || nextState === 'background') &&
      hasPending &&
      !isProcessingRef.current
    ) {
      // App going to background with active uploads → hand off to background task
      await startBackgroundUpload();
    } else if (
      (prevState === 'background' || prevState === 'inactive') &&
      nextState === 'active'
    ) {
      // App returned to foreground → stop background task, re-read queue
      await stopBackgroundUpload();
      await loadQueueFromStorage();

      // Show notification summary if new uploads completed in background
      const queue = await getQueue();
      const doneCount = queue.filter((i) => i.status === 'done').length;
      const failedCount = queue.filter((i) => i.status === 'error').length;
      if (doneCount > 0 || failedCount > 0) {
        // Update uploaded photos tracking
        const raw = await AsyncStorage.getItem('uploaded_photos_tracking');
        if (raw) {
          const tracked: UploadedPhoto[] = JSON.parse(raw);
          uploadedPhotosRef.current = tracked;
          setUploadedPhotos(tracked);
        }
      }
    }
  }

  // ── Photo upload (single file, XHR/FormData) ───────────────────────────

  async function uploadSinglePhoto(
    item: UploadQueueItem,
  ): Promise<void> {
    await updateQueueItem(item.id, { status: 'uploading', progress: 0 });
    try {
      // Check if paused before starting
      if (pausedRef.current.has(item.id)) {
        await updateQueueItem(item.id, { status: 'paused' });
        return;
      }
      await photosApi.upload(
        item.uri,
        item.filename,
        item.mimeType || 'image/jpeg',
        item.captureDate,
        (pct) => {
          updateQueueItem(item.id, { progress: pct });
        },
        item.deviceModel,
      );
      await updateQueueItem(item.id, { status: 'done', progress: 100 });
      if (item.sourceAssetId) {
        uploadedPhotosRef.current.push({
          assetId: item.sourceAssetId,
          filename: item.filename,
        });
      }
      await AsyncStorage.setItem(
        'uploaded_photos_tracking',
        JSON.stringify(uploadedPhotosRef.current),
      );
      // Mark this specific asset as synced so it won't be re-detected
      if (item.sourceAssetId && onAssetUploaded) {
        await onAssetUploaded(item.sourceAssetId);
      }
    } catch (err) {
      await updateQueueItem(item.id, {
        status: 'error',
        error: err instanceof Error ? err.message : '上传失败',
      });
      throw err;
    }
  }

  // ── File upload (chunked) ─────────────────────────────────────────────

  async function uploadSingleFile(item: UploadQueueItem): Promise<void> {
    await updateQueueItem(item.id, { status: 'uploading', progress: 0 });

    try {
      // Create upload session
      const fileInfo = await FileSystem.getInfoAsync(
        item.uri,
      );
      if (!fileInfo.exists) throw new Error('File does not exist');
      const totalSize = fileInfo.size || item.size || 0;

      const session = await uploadApi.createSession(
        item.filename,
        totalSize,
        item.folderId || undefined,
      );

      // Upload chunks
      const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) throw new Error('已取消');

        // Check if paused — busy-wait until resumed or cancelled
        while (pausedRef.current.has(item.id) && !abortRef.current) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (abortRef.current) throw new Error('已取消');

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalSize);
        const chunkSize = end - start;

        const chunkBase64 = await FileSystem.readAsStringAsync(
          item.uri,
          {
            encoding: FileSystem.EncodingType.Base64,
            position: start,
            length: chunkSize,
          },
        );

        const binaryString = atob(chunkBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++)
          bytes[j] = binaryString.charCodeAt(j);

        await uploadApi.uploadChunk(session.uploadId, i, bytes.buffer);
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        await updateQueueItem(item.id, { progress });
      }

      // Complete upload
      await uploadApi.completeUpload(session.uploadId, item.mimeType);
      await uploadApi.waitForCompletion(session.uploadId);
      await updateQueueItem(item.id, { status: 'done', progress: 100 });
    } catch (err) {
      await updateQueueItem(item.id, {
        status: 'error',
        error: err instanceof Error ? err.message : '上传失败',
      });
      throw err;
    }
  }

  // ── Batch upload processors ───────────────────────────────────────────

  const startUpload = useCallback(
    async (photos: NewPhotoAsset[], deviceModel?: string) => {
      if (photos.length === 0 || isProcessingRef.current) return;

      // Enqueue items
      const items: UploadQueueItem[] = photos.map((p) => ({
        id: `photo_${p.id}_${Date.now()}`,
        sourceAssetId: p.id,
        type: 'photo',
        uri: p.uri,
        filename: p.filename,
        mimeType: p.mimeType || 'image/jpeg',
        captureDate: new Date(p.creationTime).toISOString(),
        deviceModel,
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
      }));
      await enqueue(items);
      await loadQueueFromStorage();

      // Process in foreground
      await processForegroundQueue();
    },
    [],
  );

  const startFileUpload = useCallback(
    async (
      files: { uri: string; name: string; mimeType: string; size?: number }[],
      folderId?: string | null,
    ) => {
      if (files.length === 0) return;

      const items: UploadQueueItem[] = files.map((f) => ({
        id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'file',
        uri: f.uri,
        filename: f.name,
        mimeType: f.mimeType || 'application/octet-stream',
        size: f.size,
        folderId: folderId || null,
        status: 'pending',
        progress: 0,
        createdAt: Date.now(),
      }));
      await enqueue(items);
      await loadQueueFromStorage();

      // Process in foreground
      await processForegroundQueue();
    },
    [],
  );

  /**
   * Process the upload queue in foreground.
   * If the app goes to background during processing, the remaining items
   * are picked up by the background task.
   */
  async function processForegroundQueue() {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    abortRef.current = false;

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Check if app is still in foreground
        if (appStateRef.current !== 'active') {
          // App went to background — hand off to background task
          await setUploadsActive(true);
          await startBackgroundUpload();
          return;
        }

        if (abortRef.current) {
          await cancelPendingInQueue();
          return;
        }

        const queue = await getQueue();
        const next = queue.find(
          (i) => i.status === 'pending' && !pausedRef.current.has(i.id),
        );
        if (!next) break; // All done or all paused

        try {
          if (next.type === 'photo') {
            await uploadSinglePhoto(next);
          } else {
            await uploadSingleFile(next);
          }
        } catch {
          // Error already recorded in updateQueueItem
        }

        // Update UI
        const updated = await getQueue();
        setItems(
          updated.map((q) => ({
            id: q.id,
            filename: q.filename,
            type: q.type,
            status: q.status,
            progress: q.progress,
            error: q.error,
            uri: q.uri,
            mimeType: q.mimeType,
          })),
        );
      }

      // All items processed
      const queue = await getQueue();
      const doneCount = queue.filter((i) => i.status === 'done').length;
      const failedCount = queue.filter((i) => i.status === 'error').length;

      await setUploadsActive(false);
      setIsUploading(false);

      // Save uploaded photos tracking
      await AsyncStorage.setItem(
        'uploaded_photos_tracking',
        JSON.stringify(uploadedPhotosRef.current),
      );
      setUploadedPhotos([...uploadedPhotosRef.current]);

      // Send notification
      if (doneCount > 0 || failedCount > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '上传完成',
            body:
              failedCount > 0
                ? `${doneCount} 个上传成功，${failedCount} 个失败`
                : `全部 ${doneCount} 项已安全上传`,
            data: { type: 'upload_complete', done: doneCount, failed: failedCount },
          },
          trigger: null,
        });
      }

      // Auto-mark synced when all photos succeed
      const allPhotos = queue.filter((i) => i.type === 'photo');
      const allDone =
        allPhotos.length > 0 &&
        allPhotos.every((i) => i.status === 'done');
      if (allDone && onMarkSynced) {
        await onMarkSynced();
      }
    } finally {
      isProcessingRef.current = false;
      setIsUploading(false);
    }
  }

  async function cancelPendingInQueue() {
    const queue = await getQueue();
    for (const item of queue) {
      if (item.status === 'pending') {
        await updateQueueItem(item.id, {
          status: 'error',
          error: '已取消',
        });
      }
    }
    const updated = await getQueue();
    setItems(
      updated.map((q) => ({
        id: q.id,
        filename: q.filename,
        type: q.type,
        status: q.status,
        progress: q.progress,
        error: q.error,
        uri: q.uri,
        mimeType: q.mimeType,
      })),
    );
  }

  // ── Public API methods ─────────────────────────────────────────────────

  const clearCompleted = useCallback(async () => {
    await clearQueueCompleted();
    const queue = await getQueue();
    setItems(
      queue.map((q) => ({
        id: q.id,
        filename: q.filename,
        type: q.type,
        status: q.status,
        progress: q.progress,
        error: q.error,
        uri: q.uri,
        mimeType: q.mimeType,
      })),
    );
  }, []);

  const retryFailed = useCallback(async () => {
    const queue = await getQueue();
    for (const item of queue) {
      if (item.status === 'error') {
        await updateQueueItem(item.id, {
          status: 'pending',
          progress: 0,
          error: undefined,
        });
      }
    }
    const updated = await getQueue();
    setItems(
      updated.map((q) => ({
        id: q.id,
        filename: q.filename,
        type: q.type,
        status: q.status,
        progress: q.progress,
        error: q.error,
        uri: q.uri,
        mimeType: q.mimeType,
      })),
    );

    // Start processing retries
    if (!isProcessingRef.current) {
      processForegroundQueue();
    }
  }, []);

  // ── Per-item pause/resume/cancel/retry ────────────────────────────────

  const pauseUpload = useCallback((id: string) => {
    pausedRef.current.add(id);
    void updateQueueItem(id, { status: 'paused' }).then(() => loadQueueFromStorage());
  }, []);

  const resumeUpload = useCallback((id: string) => {
    pausedRef.current.delete(id);
    void updateQueueItem(id, { status: 'pending', progress: 0 }).then(() => {
      loadQueueFromStorage();
      if (!isProcessingRef.current) {
        processForegroundQueue();
      }
    });
  }, []);

  const cancelUpload = useCallback((id: string) => {
    abortRef.current = true; // Signal current upload to stop
    pausedRef.current.delete(id);
    void (async () => {
      await updateQueueItem(id, { status: 'done', progress: 100 });
      abortRef.current = false;
      await loadQueueFromStorage();
    })();
  }, []);

  const retryUpload = useCallback((id: string) => {
    abortRef.current = false;
    pausedRef.current.delete(id);
    void updateQueueItem(id, { status: 'pending', progress: 0, error: undefined }).then(() => {
      loadQueueFromStorage();
      if (!isProcessingRef.current) {
        processForegroundQueue();
      }
    });
  }, []);

  // ── Bulk pause/resume/cancel ──────────────────────────────────────────

  const pauseAll = useCallback(async () => {
    const queue = await getQueue();
    for (const item of queue) {
      if (item.status === 'pending' || item.status === 'uploading') {
        pausedRef.current.add(item.id);
        await updateQueueItem(item.id, { status: 'paused' });
      }
    }
    await loadQueueFromStorage();
  }, []);

  const resumeAll = useCallback(async () => {
    const queue = await getQueue();
    for (const item of queue) {
      if (item.status === 'paused') {
        pausedRef.current.delete(item.id);
        await updateQueueItem(item.id, { status: 'pending', progress: 0 });
      }
    }
    await loadQueueFromStorage();
    if (!isProcessingRef.current) {
      processForegroundQueue();
    }
  }, []);

  const cancelAll = useCallback(async () => {
    abortRef.current = true;
    pausedRef.current.clear();
    const queue = await getQueue();
    for (const item of queue) {
      if (item.status !== 'done') {
        await updateQueueItem(item.id, { status: 'done', progress: 100 });
      }
    }
    abortRef.current = false;
    await loadQueueFromStorage();
  }, []);

  const cleanupCompletedPhotos = useCallback(async () => {
    const toCleanup = uploadedPhotosRef.current;
    if (toCleanup.length === 0) return;

    setIsCleaningUp(true);
    setCleanupResult(null);

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const photo of toCleanup) {
      try {
        await MediaLibrary.deleteAssetsAsync([photo.assetId]);
        success++;
      } catch (error) {
        failed++;
        errors.push(
          `${photo.filename}: ${error instanceof Error ? error.message : '删除失败'}`,
        );
      }
    }

    setCleanupResult({ success, failed, errors });
    setIsCleaningUp(false);

    if (failed === 0) {
      uploadedPhotosRef.current = [];
      setUploadedPhotos([]);
      await AsyncStorage.removeItem('uploaded_photos_tracking');
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '本地清理完成',
        body:
          failed > 0
            ? `${success} 张已删除，${failed} 张删除失败`
            : `已释放 ${success} 张照片的本地存储空间`,
        data: { type: 'cleanup_complete' },
      },
      trigger: null,
    });
  }, []);

  const dismissCleanupResult = useCallback(() => {
    setCleanupResult(null);
  }, []);

  const markSynced = useCallback(async () => {
    if (onMarkSynced) await onMarkSynced();
  }, [onMarkSynced]);

  const refreshQueue = useCallback(async () => {
    await loadQueueFromStorage();
  }, []);

  const badgeCount = items.filter(
    (i) =>
      i.status === 'pending' || i.status === 'uploading' || i.status === 'paused' || i.status === 'error',
  ).length;

  return (
    <PhotoUploadContext.Provider
      value={{
        items,
        isUploading,
        badgeCount,
        uploadedPhotos,
        isCleaningUp,
        cleanupResult,
        startUpload,
        startFileUpload,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        retryUpload,
        pauseAll,
        resumeAll,
        cancelAll,
        clearCompleted,
        retryFailed,
        cleanupCompletedPhotos,
        dismissCleanupResult,
        markSynced,
        refreshQueue,
      }}
    >
      {children}
    </PhotoUploadContext.Provider>
  );
}

export function usePhotoUploadContext() {
  const ctx = useContext(PhotoUploadContext);
  if (!ctx)
    throw new Error(
      'usePhotoUploadContext must be used within PhotoUploadProvider',
    );
  return ctx;
}

export default PhotoUploadContext;
