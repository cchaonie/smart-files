import { useState, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { photosApi, type PhotoUploadResult } from '../api/photos';
import type { NewPhotoAsset } from './usePhotoDetection';

export interface PhotoUploadItem {
  id: string;
  filename: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: PhotoUploadResult;
}

export interface PhotoUploadState {
  items: PhotoUploadItem[];
  isUploading: boolean;
  totalCount: number;
  completedCount: number;
  failedCount: number;
}

interface UsePhotoUploadReturn {
  state: PhotoUploadState;
  startUpload: (photos: NewPhotoAsset[]) => Promise<void>;
  retryFailed: () => Promise<void>;
  clearCompleted: () => void;
}

/**
 * Hook that manages uploading a batch of photos to the NAS.
 * Reports progress in real-time and shows a notification on completion.
 */
export function usePhotoUpload(): UsePhotoUploadReturn {
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const isUploadingRef = useRef(false);
  const abortRef = useRef(false);

  const state: PhotoUploadState = {
    items,
    isUploading: isUploadingRef.current,
    get totalCount() {
      return items.length;
    },
    get completedCount() {
      return items.filter((i) => i.status === 'done').length;
    },
    get failedCount() {
      return items.filter((i) => i.status === 'error').length;
    },
  };

  const updateItem = useCallback(
    (id: string, patch: Partial<PhotoUploadItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  const sendNotification = useCallback(
    async (successCount: number, failCount: number) => {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '照片上传完成',
          body:
            failCount > 0
              ? `${successCount} 张上传成功，${failCount} 张失败`
              : `${successCount} 张已安全上传到 NAS`,
          data: { type: 'upload_complete' },
        },
        trigger: null, // immediate
      });
    },
    [],
  );

  const startUpload = useCallback(
    async (photos: NewPhotoAsset[]) => {
      if (photos.length === 0 || isUploadingRef.current) return;

      isUploadingRef.current = true;
      abortRef.current = false;

      // Initialize items
      const initialItems: PhotoUploadItem[] = photos.map((p) => ({
        id: p.id,
        filename: p.filename,
        status: 'pending' as const,
        progress: 0,
      }));
      setItems(initialItems);

      // Upload each photo sequentially (avoid overwhelming the server)
      for (const photo of photos) {
        if (abortRef.current) break;

        updateItem(photo.id, { status: 'uploading', progress: 0 });

        try {
          const captureDate = new Date(photo.creationTime).toISOString();
          const result = await photosApi.upload(
            photo.uri,
            photo.filename,
            photo.mimeType || 'image/jpeg',
            captureDate,
            (progress) => updateItem(photo.id, { progress }),
          );

          updateItem(photo.id, { status: 'done', progress: 100, result });
        } catch (error) {
          updateItem(photo.id, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
          });
        }
      }

      isUploadingRef.current = false;

      // Send completion notification
      const finalItems = await new Promise<PhotoUploadItem[]>((resolve) => {
        setItems((current) => {
          resolve(current);
          return current;
        });
      });

      const done = finalItems.filter((i) => i.status === 'done').length;
      const failed = finalItems.filter((i) => i.status === 'error').length;
      await sendNotification(done, failed);
    },
    [updateItem, sendNotification],
  );

  const retryFailed = useCallback(async () => {
    const failedPhotos = items.filter((i) => i.status === 'error');
    if (failedPhotos.length === 0) return;

    // Rebuild photo assets from error items (no URI stored — need re-scan)
    // This requires the caller to re-scan and pass failed filenames
    // For now, mark them as pending and log
    console.warn('Retry requires re-scanning camera roll for failed files');
  }, [items]);

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status !== 'done'));
  }, []);

  return { state, startUpload, retryFailed, clearCompleted };
}

export default usePhotoUpload;
