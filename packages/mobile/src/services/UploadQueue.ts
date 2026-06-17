/**
 * UploadQueue — A persistent upload queue backed by AsyncStorage.
 *
 * This is the single source of truth for upload state.
 * It can be read/written from both React components and background tasks.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'upload_queue';
const ACTIVE_KEY = 'upload_active';

export type UploadType = 'photo' | 'file';

export interface UploadQueueItem {
  /** Unique identifier for this upload */
  id: string;
  /** Camera roll asset ID (for photo uploads) */
  sourceAssetId?: string;
  /** 'photo' or 'file' to determine the upload API */
  type: UploadType;
  /** Local file URI */
  uri: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes (for file uploads) */
  size?: number;
  /** Capture date ISO string (for photos) */
  captureDate?: string;
  /** Destination folder ID (for files) */
  folderId?: string | null;
  /** Device model for photo sync folder organization */
  deviceModel?: string;
  /** Current status */
  status: 'pending' | 'uploading' | 'paused' | 'done' | 'error';
  /** Progress percentage 0–100 */
  progress: number;
  /** Error message if status === 'error' */
  error?: string;
  /** Chunked upload session ID (for file uploads) */
  uploadId?: string;
  /** Total chunks for chunked upload */
  totalChunks?: number;
  /** Timestamp when item was created */
  createdAt: number;
}

/**
 * Read the full upload queue from AsyncStorage.
 */
export async function getQueue(): Promise<UploadQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Write the full upload queue to AsyncStorage.
 */
export async function setQueue(items: UploadQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

/**
 * Enqueue one or more new upload items.
 */
export async function enqueue(items: UploadQueueItem[]): Promise<void> {
  const queue = await getQueue();
  queue.push(...items);
  await setQueue(queue);
}

/**
 * Update a single item in the queue (by id).
 */
export async function updateItem(
  id: string,
  patch: Partial<UploadQueueItem>,
): Promise<void> {
  const queue = await getQueue();
  const idx = queue.findIndex((i) => i.id === id);
  if (idx === -1) return;
  queue[idx] = { ...queue[idx], ...patch };
  await setQueue(queue);
}

/**
 * Remove items from the queue matching a predicate.
 */
export async function removeItems(
  predicate: (item: UploadQueueItem) => boolean,
): Promise<void> {
  const queue = await getQueue();
  await setQueue(queue.filter((i) => !predicate(i)));
}

/**
 * Remove all completed items from the queue.
 */
export async function clearCompleted(): Promise<void> {
  await removeItems((i) => i.status === 'done');
}

/**
 * Get counts by status.
 */
export async function getStatusCounts(): Promise<{
  pending: number;
  uploading: number;
  paused: number;
  done: number;
  error: number;
  total: number;
  active: number;
}> {
  const queue = await getQueue();
  let pending = 0,
    uploading = 0,
    paused = 0,
    done = 0,
    error = 0;
  for (const i of queue) {
    if (i.status === 'pending') pending++;
    else if (i.status === 'uploading') uploading++;
    else if (i.status === 'paused') paused++;
    else if (i.status === 'done') done++;
    else if (i.status === 'error') error++;
  }
  return {
    pending,
    uploading,
    paused,
    done,
    error,
    total: queue.length,
    active: pending + uploading + paused + error,
  };
}

/**
 * Mark whether uploads are active (for background task coordination).
 */
export async function setUploadsActive(active: boolean): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_KEY, active ? '1' : '0');
}

export async function getUploadsActive(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(ACTIVE_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export default {
  getQueue,
  setQueue,
  enqueue,
  updateItem,
  removeItems,
  clearCompleted,
  getStatusCounts,
  setUploadsActive,
  getUploadsActive,
};
