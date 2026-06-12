import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import { photosApi } from '../api/photos';
import type { NewPhotoAsset } from '../hooks/usePhotoDetection';

export interface PhotoUploadItem {
  id: string;
  filename: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface UploadedPhoto {
  assetId: string;
  filename: string;
}

interface PhotoUploadContextType {
  items: PhotoUploadItem[];
  isUploading: boolean;
  badgeCount: number;
  uploadedPhotos: UploadedPhoto[];
  isCleaningUp: boolean;
  cleanupResult: { success: number; failed: number; errors: string[] } | null;
  startUpload: (photos: NewPhotoAsset[]) => Promise<void>;
  clearCompleted: () => void;
  cleanupCompletedPhotos: () => Promise<void>;
  dismissCleanupResult: () => void;
  retryFailed: () => void;
  markSynced: () => Promise<void>;
}

const PhotoUploadContext = createContext<PhotoUploadContextType | undefined>(undefined);

export function PhotoUploadProvider({ children, onMarkSynced }: { children: React.ReactNode; onMarkSynced?: () => Promise<void> }) {
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const abortRef = useRef(false);
  // Track completed photo asset IDs for local cleanup
  const uploadedPhotosRef = useRef<UploadedPhoto[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);

  // Request notification permissions on mount
  useEffect(() => {
    Notifications.requestPermissionsAsync();
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<PhotoUploadItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  const sendNotification = useCallback(async (done: number, failed: number, batchId: string) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '照片上传完成',
        body: failed > 0
          ? `${done} 张上传成功，${failed} 张失败。点击查看详情`
          : `${done} 张已安全上传到 NAS，点击清理本地副本`,
        data: { type: 'upload_complete', batchId, done, failed },
      },
      trigger: null,
    });
  }, []);

  const startUpload = useCallback(async (photos: NewPhotoAsset[]) => {
    if (photos.length === 0 || isUploading) return;

    setIsUploading(true);
    abortRef.current = false;

    const batchId = Date.now().toString();

    const initialItems: PhotoUploadItem[] = photos.map(p => ({
      id: p.id,
      filename: p.filename,
      status: 'pending',
      progress: 0,
    }));
    setItems(initialItems);
    setCleanupResult(null);

    for (const photo of photos) {
      if (abortRef.current) break;
      updateItem(photo.id, { status: 'uploading', progress: 0 });

      try {
        const captureDate = new Date(photo.creationTime).toISOString();
        await photosApi.upload(
          photo.uri, photo.filename, photo.mimeType || 'image/jpeg',
          captureDate,
          (progress) => updateItem(photo.id, { progress }),
        );
        updateItem(photo.id, { status: 'done', progress: 100 });
        // Track for cleanup
        uploadedPhotosRef.current.push({ assetId: photo.id, filename: photo.filename });
      } catch (error) {
        updateItem(photo.id, {
          status: 'error',
          error: error instanceof Error ? error.message : '上传失败',
        });
      }
    }

    setIsUploading(false);

    const doneCount = uploadedPhotosRef.current.length;
    const failedCount = photos.length - doneCount;
    await sendNotification(doneCount, failedCount, batchId);

    // Sync ref to state
    setUploadedPhotos([...uploadedPhotosRef.current]);

    // Auto-mark synced when all succeed
    if (failedCount === 0 && doneCount > 0 && onMarkSynced) {
      await onMarkSynced();
    }
  }, [isUploading, updateItem, sendNotification, onMarkSynced]);

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
        errors.push(`${photo.filename}: ${error instanceof Error ? error.message : '删除失败'}`);
      }
    }

    setCleanupResult({ success, failed, errors });
    setIsCleaningUp(false);

    // Clear tracked photos after cleanup
    if (failed === 0) {
      uploadedPhotosRef.current = [];
      setUploadedPhotos([]);
    }

    // Send result notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '本地清理完成',
        body: failed > 0
          ? `${success} 张已删除，${failed} 张删除失败`
          : `已释放 ${success} 张照片的本地存储空间`,
        data: { type: 'cleanup_complete' },
      },
      trigger: null,
    });
  }, []);

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(i => i.status !== 'done'));
  }, []);

  const dismissCleanupResult = useCallback(() => {
    setCleanupResult(null);
  }, []);

  const retryFailed = useCallback(() => {
    setItems(prev => prev.map(i => i.status === 'error' ? { ...i, status: 'pending', progress: 0 } : i));
  }, []);

  const markSynced = useCallback(async () => {
    if (onMarkSynced) await onMarkSynced();
  }, [onMarkSynced]);

  const badgeCount = items.filter(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error').length;

  return (
    <PhotoUploadContext.Provider value={{
      items, isUploading, badgeCount,
      uploadedPhotos, isCleaningUp, cleanupResult,
      startUpload, clearCompleted, cleanupCompletedPhotos,
      dismissCleanupResult, retryFailed, markSynced,
    }}>
      {children}
    </PhotoUploadContext.Provider>
  );
}

export function usePhotoUploadContext() {
  const ctx = useContext(PhotoUploadContext);
  if (!ctx) throw new Error('usePhotoUploadContext must be used within PhotoUploadProvider');
  return ctx;
}

export default PhotoUploadContext;
