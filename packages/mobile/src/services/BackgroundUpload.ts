/**
 * BackgroundUpload — expo-task-manager based background upload task.
 *
 * This task picks up pending uploads from the queue and processes them
 * outside the React component lifecycle. When the app goes to background,
 * we start this task; when it returns to foreground, we stop it and let
 * the React context take over.
 */
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getQueue,
  updateItem,
  setUploadsActive,
  getUploadsActive,
  UploadQueueItem,
} from './UploadQueue';
import { getPlatformDefaultApiUrl } from '../config/api';

/** Name of the background upload task (used across app + background) */
export const BACKGROUND_UPLOAD_TASK = 'BACKGROUND_UPLOAD';

/** Max items to process per background tick (time-limited on iOS ~30s) */
const MAX_PER_TICK = 2;

/** Minimum interval between background runs (ms) */
const POLL_INTERVAL_MS = 5000;

// ─── Shared upload helpers (used by both foreground and background) ─────────

/**
 * Upload a single photo via FormData + XMLHttpRequest (supports progress).
 * Returns a promise that resolves when the upload completes.
 */
function uploadPhoto(
  item: UploadQueueItem,
  token: string,
  baseUrl: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `${baseUrl}/photos/upload`;
    const formData = new FormData();
    formData.append('file', {
      uri: item.uri,
      name: item.filename,
      type: item.mimeType || 'image/jpeg',
    } as any);
    if (item.captureDate) formData.append('captureDate', item.captureDate);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress)
        onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.message || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

/**
 * Upload a file chunk (low-level helper).
 */
async function uploadFileChunk(
  uploadId: string,
  chunkIndex: number,
  chunkData: ArrayBuffer,
  token: string,
  baseUrl: string,
): Promise<void> {
  const url = `${baseUrl}/upload/session/${uploadId}/chunk?index=${chunkIndex}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      Authorization: `Bearer ${token}`,
    },
    body: chunkData,
  });
  if (!response.ok)
    throw new Error(`Chunk upload failed: ${response.status}`);
}

// ─── Background task registration ───────────────────────────────────────────

TaskManager.defineTask(BACKGROUND_UPLOAD_TASK, async () => {
  try {
    const stillActive = await getUploadsActive();
    if (!stillActive) return BackgroundFetch.BackgroundFetchResult.NoData;

    const queue = await getQueue();
    const pending = queue.filter(
      (i) => i.status === 'pending' || i.status === 'uploading',
    );
    if (pending.length === 0) {
      await setUploadsActive(false);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const token = await AsyncStorage.getItem('access_token');
    if (!token) {
      await setUploadsActive(false);
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const baseUrl = getPlatformDefaultApiUrl();

    // Process up to MAX_PER_TICK items
    const toProcess = pending.slice(0, MAX_PER_TICK);
    for (const item of toProcess) {
      try {
        await updateItem(item.id, { status: 'uploading', progress: 0 });

        if (item.type === 'photo') {
          await uploadPhoto(item, token, baseUrl, (pct) => {
            updateItem(item.id, { progress: pct });
          });
          await updateItem(item.id, { status: 'done', progress: 100 });
        } else {
          // File upload with chunking
          await processFileUpload(item, token, baseUrl);
        }
      } catch (err) {
        await updateItem(item.id, {
          status: 'error',
          error: err instanceof Error ? err.message : '上传失败',
        });
      }
    }

    // Send notification if all remaining items are terminal
    const updatedQueue = await getQueue();
    const remaining = updatedQueue.filter(
      (i) => i.status === 'pending' || i.status === 'uploading',
    );
    if (remaining.length === 0) {
      await setUploadsActive(false);
      const doneCount = updatedQueue.filter((i) => i.status === 'done').length;
      const failedCount = updatedQueue.filter(
        (i) => i.status === 'error',
      ).length;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '上传完成',
          body:
            failedCount > 0
              ? `${doneCount} 张上传成功，${failedCount} 张失败`
              : `全部 ${doneCount} 项已安全上传`,
          data: { type: 'upload_complete', done: doneCount, failed: failedCount },
        },
        trigger: null,
      });
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    // More items remain — background task will be re-triggered
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    // Swallow errors so the task doesn't crash the app
    console.warn('[BackgroundUpload] Task error:', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Process a chunked file upload.
 */
async function processFileUpload(
  item: UploadQueueItem,
  token: string,
  baseUrl: string,
): Promise<void> {
  // For progress reporting
  const report = (pct: number) => updateItem(item.id, { progress: pct });

  // Read the file
  const fileSystem = require('expo-file-system');
  const fileInfo = await fileSystem.FileSystem.getInfoAsync(item.uri);
  if (!fileInfo.exists) throw new Error('File does not exist');
  const totalSize = fileInfo.size || item.size || 0;

  // Use the shared upload.ts API via direct fetch
  const CHUNK_SIZE = 10 * 1024 * 1024;

  if (!item.uploadId) {
    // Create session
    const res = await fetch(`${baseUrl}/upload/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: item.filename,
        totalSize: String(totalSize),
        chunkSize: CHUNK_SIZE,
        folderId: item.folderId || undefined,
      }),
    });
    if (!res.ok) throw new Error('Failed to create upload session');
    const session = await res.json();
    item.uploadId = session.uploadId;
    item.totalChunks = session.totalChunks;
    await updateItem(item.id, { uploadId: session.uploadId, totalChunks: session.totalChunks });
  }

  // Get session status to find missing chunks
  const sessionRes = await fetch(
    `${baseUrl}/upload/session/${item.uploadId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const status = await sessionRes.json();
  const received = new Set<number>(status.receivedIndexes || []);
  const totalChunks = status.totalChunks || item.totalChunks || 1;
  const chunkSize = status.chunkSize || CHUNK_SIZE;

  const missing: number[] = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!received.has(i)) missing.push(i);
  }
  if (missing.length === 0) {
    // All chunks uploaded — complete the session
    await completeFileUpload(item, token, baseUrl);
    return;
  }

  let doneCount = received.size;
  for (const index of missing) {
    const start = index * chunkSize;
    const chunkSizeActual = Math.min(start + chunkSize, totalSize) - start;
    const chunkBase64 = await fileSystem.FileSystem.readAsStringAsync(
      item.uri,
      {
        encoding: fileSystem.FileSystem.EncodingType.Base64,
        position: start,
        length: chunkSizeActual,
      },
    );
    const binaryString = atob(chunkBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let j = 0; j < binaryString.length; j++)
      bytes[j] = binaryString.charCodeAt(j);

    await uploadFileChunk(item.uploadId!, index, bytes.buffer, token, baseUrl);
    doneCount += 1;
    report(Math.round((doneCount / totalChunks) * 100));
  }

  await completeFileUpload(item, token, baseUrl);
}

async function completeFileUpload(
  item: UploadQueueItem,
  token: string,
  baseUrl: string,
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/upload/session/${item.uploadId}/complete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mimeType: item.mimeType }),
    },
  );
  if (!res.ok) throw new Error('Failed to complete upload');

  // Wait for async completion
  for (let i = 0; i < 300; i++) {
    const pollRes = await fetch(
      `${baseUrl}/upload/session/${item.uploadId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const pollData = await pollRes.json();
    if (pollData.status === 'completed') {
      await updateItem(item.id, { status: 'done', progress: 100 });
      return;
    }
    if (pollData.status === 'failed') {
      throw new Error('Upload failed during file assembly');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Upload completion timed out');
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Register the background upload task with expo-background-fetch.
 * Call this on app startup.
 */
export async function registerBackgroundUpload(): Promise<void> {
  const BackgroundFetch = require('expo-background-fetch');
  const status = await BackgroundFetch.getStatusAsync();
  const isActive = await getUploadsActive();

  if (isActive) {
    // If we have pending uploads, register a periodic fetch
    await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
      minimumInterval: 60, // 1 minute minimum on Android
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}

/**
 * Start background upload processing.
 * Called when the app goes to background with active uploads.
 */
export async function startBackgroundUpload(): Promise<void> {
  await setUploadsActive(true);
  const BackgroundFetch = require('expo-background-fetch');
  await BackgroundFetch.registerTaskAsync(BACKGROUND_UPLOAD_TASK, {
    minimumInterval: 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

/**
 * Stop background upload processing.
 * Called when the app returns to foreground.
 */
export async function stopBackgroundUpload(): Promise<void> {
  await setUploadsActive(false);
  const BackgroundFetch = require('expo-background-fetch');
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_UPLOAD_TASK);
  } catch {
    // Task may not be registered
  }
}

/**
 * Check if background task is registered.
 */
export async function isBackgroundTaskRegistered(): Promise<boolean> {
  return TaskManager.isTaskRegisteredAsync(BACKGROUND_UPLOAD_TASK);
}
