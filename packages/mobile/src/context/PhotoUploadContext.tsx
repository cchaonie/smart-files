import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { photosApi } from '../api/photos';
import type { NewPhotoAsset } from '../hooks/usePhotoDetection';

export interface PhotoUploadItem {
  id: string;
  filename: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface PhotoUploadContextType {
  items: PhotoUploadItem[];
  isUploading: boolean;
  badgeCount: number;
  startUpload: (photos: NewPhotoAsset[]) => Promise<void>;
  clearCompleted: () => void;
  retryFailed: () => void;
  markSynced: () => Promise<void>;
}

const PhotoUploadContext = createContext<PhotoUploadContextType | undefined>(undefined);

export function PhotoUploadProvider({ children, onMarkSynced }: { children: React.ReactNode; onMarkSynced?: () => Promise<void> }) {
  const [items, setItems] = useState<PhotoUploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const abortRef = useRef(false);

  const updateItem = useCallback((id: string, patch: Partial<PhotoUploadItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  const sendNotification = useCallback(async (done: number, failed: number) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '照片上传完成',
        body: failed > 0
          ? `${done} 张上传成功，${failed} 张失败`
          : `${done} 张已安全上传到 NAS`,
        data: { type: 'upload_complete' },
      },
      trigger: null,
    });
  }, []);

  const startUpload = useCallback(async (photos: NewPhotoAsset[]) => {
    if (photos.length === 0 || isUploading) return;

    setIsUploading(true);
    abortRef.current = false;

    const initialItems: PhotoUploadItem[] = photos.map(p => ({
      id: p.id,
      filename: p.filename,
      status: 'pending',
      progress: 0,
    }));
    setItems(initialItems);

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
      } catch (error) {
        updateItem(photo.id, {
          status: 'error',
          error: error instanceof Error ? error.message : '上传失败',
        });
      }
    }

    setIsUploading(false);

    const finalItems = [...items];
    const done = finalItems.filter(i => i.status === 'done').length;
    const failed = finalItems.filter(i => i.status === 'error').length;
    await sendNotification(done, failed);

    // Auto-mark synced when all succeed
    if (failed === 0 && done > 0 && onMarkSynced) {
      await onMarkSynced();
    }
  }, [isUploading, items, updateItem, sendNotification, onMarkSynced]);

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(i => i.status !== 'done'));
  }, []);

  const retryFailed = useCallback(() => {
    // Note: actual retry needs re-scanning, this requires caller to pass photos again
    const failed = items.filter(i => i.status === 'error');
    setItems(prev => prev.map(i => i.status === 'error' ? { ...i, status: 'pending', progress: 0 } : i));
  }, [items]);

  const markSynced = useCallback(async () => {
    if (onMarkSynced) await onMarkSynced();
  }, [onMarkSynced]);

  const badgeCount = items.filter(i => i.status === 'pending' || i.status === 'uploading' || i.status === 'error').length;

  return (
    <PhotoUploadContext.Provider value={{
      items, isUploading, badgeCount,
      startUpload, clearCompleted, retryFailed, markSynced,
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
