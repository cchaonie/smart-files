import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { uploadApi, CHUNK_SIZE } from '../api/upload';
import type { UploadQueueItem, UploadHistoryItem } from '../types';

const ACTIVE_SESSIONS_KEY = 'sf_active_sessions';
const MAX_PARALLEL_KEY = 'sf_max_parallel';

interface UploadContextType {
  uploads: UploadQueueItem[];
  history: UploadHistoryItem[];
  badgeCount: number;
  startUpload: (files: File[], folderId?: string, folderName?: string) => void;
  pauseUpload: (id: number) => void;
  resumeUpload: (id: number) => void;
  cancelUpload: (id: number) => void;
  retryUpload: (id: number) => void;
  pauseAll: () => void;
  resumeAll: () => void;
  cancelAll: () => void;
  clearHistory: () => void;
  removeFromHistory: (id: number) => void;
  maxParallel: number;
  setMaxParallel: (n: number) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [uploads, setUploads] = useState<UploadQueueItem[]>([]);
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [maxParallel, setMaxParallelState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(MAX_PARALLEL_KEY) || '5'); }
    catch { return 5; }
  });

  const nextIdRef = useRef(Date.now());
  const filesById = useRef<Map<number, { file: File; folderId?: string }>>(new Map());
  const pausedRef = useRef<Set<number>>(new Set());
  const abortRef = useRef<Set<number>>(new Set());
  const persistKeyRef = useRef<Map<number, string>>(new Map());
  const runningIdsRef = useRef<Set<number>>(new Set());
  const activeSessionIds = useRef<Set<string>>(new Set());

  // Persist maxParallel to localStorage
  useEffect(() => {
    localStorage.setItem(MAX_PARALLEL_KEY, JSON.stringify(maxParallel));
  }, [maxParallel]);

  // Sync active session IDs to localStorage
  function persistActiveSessions() {
    try {
      localStorage.setItem(ACTIVE_SESSIONS_KEY, JSON.stringify([...activeSessionIds.current]));
    } catch {}
  }

  // On mount, cancel any stale upload sessions from a previous page load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSIONS_KEY);
      if (raw) {
        const staleIds = JSON.parse(raw) as string[];
        if (staleIds.length > 0) {
          Promise.all(staleIds.map(id => uploadApi.cancelSession(id).catch(() => {})));
        }
      }
    } catch {}
    localStorage.removeItem(ACTIVE_SESSIONS_KEY);
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sf_upload_history');
      if (raw) {
        const parsed = JSON.parse(raw) as UploadHistoryItem[];
        setHistory(parsed);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // Persist history to localStorage (max 50 items)
  useEffect(() => {
    try {
      localStorage.setItem('sf_upload_history', JSON.stringify(history.slice(-50)));
    } catch {
      // ignore storage errors
    }
  }, [history]);

  // Auto-move completed uploads to history
  useEffect(() => {
    const doneItems = uploads.filter((u) => u.status === 'done');
    if (doneItems.length === 0) return;

    setHistory((prev) => {
      const newItems: UploadHistoryItem[] = doneItems.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        folderId: item.folderId,
        folderName: item.folderName,
        completedAt: new Date().toISOString(),
      }));
      return [...prev, ...newItems].slice(-50);
    });

    setUploads((prev) => prev.filter((u) => u.status !== 'done'));
  }, [uploads]);

  // Core upload runner — reads folderId from filesById ref (no uploads dependency)
  const runUpload = useCallback(
    async (file: File, itemId: number) => {
      const meta = filesById.current.get(itemId);
      const folderId = meta?.folderId;

      try {
        setUploads((prev) =>
          prev.map((u) => (u.id === itemId ? { ...u, status: 'uploading' } : u))
        );

        const session = await uploadApi.createSession(file.name, file.size, folderId);
        persistKeyRef.current.set(itemId, session.uploadId);
        activeSessionIds.current.add(session.uploadId);
        persistActiveSessions();

        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadedChunks = new Set<number>();

        while (uploadedChunks.size < totalChunks && !abortRef.current.has(itemId)) {
          while (pausedRef.current.has(itemId) && !abortRef.current.has(itemId)) {
            await new Promise((r) => setTimeout(r, 200));
          }
          if (abortRef.current.has(itemId)) break;

          const nextIndex = uploadedChunks.size;
          const start = nextIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);
          const arrayBuffer = await chunk.arrayBuffer();

          try {
            await uploadApi.uploadChunk(session.uploadId, nextIndex, arrayBuffer);
            uploadedChunks.add(nextIndex);
            const progress = Math.round((uploadedChunks.size / totalChunks) * 100);
            setUploads((prev) =>
              prev.map((u) => (u.id === itemId ? { ...u, progress } : u))
            );
          } catch {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        if (!abortRef.current.has(itemId)) {
          await uploadApi.completeUpload(session.uploadId, file.type);
          activeSessionIds.current.delete(session.uploadId);
          persistActiveSessions();
          setUploads((prev) =>
            prev.map((u) => (u.id === itemId ? { ...u, status: 'done', progress: 100 } : u))
          );
        } else {
          // Aborted — cancel server-side session
          uploadApi.cancelSession(session.uploadId).catch(() => {});
          activeSessionIds.current.delete(session.uploadId);
          persistActiveSessions();
          setUploads((prev) =>
            prev.map((u) =>
              u.id === itemId ? { ...u, status: 'error', error: 'Upload cancelled' } : u
            )
          );
        }
      } catch (e) {
        // Clean up session ID tracking on failure
        const sid = persistKeyRef.current.get(itemId);
        if (sid) {
          activeSessionIds.current.delete(sid);
          persistActiveSessions();
        }
        setUploads((prev) =>
          prev.map((u) =>
            u.id === itemId
              ? { ...u, status: 'error', error: e instanceof Error ? e.message : 'Upload failed' }
              : u
          )
        );
      } finally {
        persistKeyRef.current.delete(itemId);
        abortRef.current.delete(itemId);
        runningIdsRef.current.delete(itemId);
      }
    },
    []
  );

  // Keep a ref to the latest runUpload so the queue effect always uses the current one
  const runUploadRef = useRef(runUpload);
  useEffect(() => {
    runUploadRef.current = runUpload;
  }, [runUpload]);

  // Queue processor: start pending uploads up to maxParallel concurrency
  useEffect(() => {
    const pendingItems = uploads.filter(
      (u) => u.status === 'pending' && !runningIdsRef.current.has(u.id)
    );
    const availableSlots = maxParallel - runningIdsRef.current.size;
    if (availableSlots <= 0 || pendingItems.length === 0) return;

    const itemsToStart = pendingItems.slice(0, availableSlots);
    for (const item of itemsToStart) {
      const meta = filesById.current.get(item.id);
      if (!meta) continue;

      runningIdsRef.current.add(item.id);
      runUploadRef.current(meta.file, item.id);
    }
  }, [uploads, maxParallel]);

  const startUpload = useCallback((files: File[], folderId?: string, folderName?: string) => {
    const items: UploadQueueItem[] = files.map((file) => {
      const id = nextIdRef.current++;
      filesById.current.set(id, { file, folderId });
      return {
        id,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending' as const,
        folderId,
        folderName,
      };
    });
    setUploads((prev) => [...prev, ...items]);
  }, []);

  const pauseUpload = useCallback((id: number) => {
    pausedRef.current.add(id);
    setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, status: 'paused' } : u)));
  }, []);

  const resumeUpload = useCallback((id: number) => {
    pausedRef.current.delete(id);
    setUploads((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        return { ...u, status: runningIdsRef.current.has(id) ? 'uploading' : 'pending' };
      })
    );
  }, []);

  const cancelUpload = useCallback((id: number) => {
    abortRef.current.add(id);
    pausedRef.current.delete(id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
    filesById.current.delete(id);
    // Cancel server-side session if one exists
    const sid = persistKeyRef.current.get(id);
    if (sid) {
      uploadApi.cancelSession(sid).catch(() => {});
      activeSessionIds.current.delete(sid);
      persistActiveSessions();
    }
    persistKeyRef.current.delete(id);
    runningIdsRef.current.delete(id);
  }, []);

  const retryUpload = useCallback((id: number) => {
    abortRef.current.delete(id);
    pausedRef.current.delete(id);
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: 'pending', progress: 0, error: undefined } : u))
    );
  }, []);

  const pauseAll = useCallback(() => {
    setUploads((prev) =>
      prev.map((u) => {
        if (u.status === 'uploading' || u.status === 'pending') {
          pausedRef.current.add(u.id);
          return { ...u, status: 'paused' };
        }
        return u;
      })
    );
  }, []);

  const resumeAll = useCallback(() => {
    setUploads((prev) =>
      prev.map((u) => {
        if (u.status === 'paused') {
          pausedRef.current.delete(u.id);
          return { ...u, status: runningIdsRef.current.has(u.id) ? 'uploading' : 'pending' };
        }
        return u;
      })
    );
  }, []);

  const cancelAll = useCallback(() => {
    uploads.forEach((u) => {
      abortRef.current.add(u.id);
      const sid = persistKeyRef.current.get(u.id);
      if (sid) {
        uploadApi.cancelSession(sid).catch(() => {});
        activeSessionIds.current.delete(sid);
      }
    });
    pausedRef.current.clear();
    filesById.current.clear();
    persistKeyRef.current.clear();
    runningIdsRef.current.clear();
    activeSessionIds.current.clear();
    persistActiveSessions();
    setUploads([]);
  }, [uploads]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const removeFromHistory = useCallback((id: number) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const setMaxParallel = useCallback((n: number) => {
    setMaxParallelState(Math.max(1, Math.min(10, n)));
  }, []);

  const badgeCount = uploads.filter(
    (u) => u.status === 'pending' || u.status === 'uploading' || u.status === 'paused' || u.status === 'error',
  ).length;

  return (
    <UploadContext.Provider
      value={{
        uploads,
        history,
        badgeCount,
        startUpload,
        pauseUpload,
        resumeUpload,
        cancelUpload,
        retryUpload,
        pauseAll,
        resumeAll,
        cancelAll,
        clearHistory,
        removeFromHistory,
        maxParallel,
        setMaxParallel,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (context === undefined) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};
