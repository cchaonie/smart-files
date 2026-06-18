import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './client';
import { UploadSession } from '../types';
import { File } from 'expo-file-system';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB — 5MB was too chatty for large files

export const uploadApi = {
  createSession: async (
    fileName: string,
    totalSize: number,
    folderId?: string
  ): Promise<UploadSession> => {
    const response = await apiClient.post<UploadSession>('/upload/session', {
      fileName,
      totalSize: String(totalSize),
      chunkSize: CHUNK_SIZE,
      folderId,
    });
    return response.data;
  },

  getSession: async (sessionId: string): Promise<{
    receivedIndexes: number[];
    totalChunks: number;
    chunkSize: number;
    totalSize: string;
  }> => {
    const response = await apiClient.get(`/upload/session/${sessionId}`);
    return response.data;
  },

  uploadChunk: async (
    sessionId: string,
    chunkIndex: number,
    chunkData: ArrayBuffer
  ): Promise<void> => {
    // Use fetch directly instead of axios to avoid Hermes Blob limitation
    const token = await AsyncStorage.getItem('access_token');
    const baseUrl = apiClient.defaults.baseURL;
    const url = `${baseUrl}/upload/session/${sessionId}/chunk?index=${chunkIndex}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        Authorization: `Bearer ${token}`,
      },
      body: chunkData,
    });

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.status}`);
    }
  },

  completeUpload: async (sessionId: string, mimeType?: string): Promise<{ status: string }> => {
    const response = await apiClient.post(`/upload/session/${sessionId}/complete`, { mimeType });
    return response.data;
  },

  /**
   * Wait for an async upload to finish by polling getSession.
   * Resolves when status becomes 'completed', throws on 'failed' or timeout.
   */
  waitForCompletion: async (
    sessionId: string,
    maxRetries = 300,
    intervalMs = 1000,
  ): Promise<{ file: { id: string; name: string; size: string } }> => {
    for (let i = 0; i < maxRetries; i++) {
      const response = await apiClient.get(`/upload/session/${sessionId}`);
      const { status, file } = response.data;

      if (status === 'completed') {
        return { file };
      }
      if (status === 'failed') {
        throw new Error('Upload failed during file assembly');
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error('Upload completion timed out');
  },

  uploadFile: async (
    uri: string,
    fileName: string,
    mimeType: string,
    folderId: string | null,
    onProgress: (progress: number) => void
  ): Promise<void> => {
    const file = new File(uri);
    const totalSize = file.size;
    if (totalSize <= 0) {
      throw new Error('File does not exist or cannot be read');
    }

    const session = await uploadApi.createSession(fileName, totalSize, folderId || undefined);
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const handle = file.open();

    try {
      for (let i = 0; i < totalChunks; i++) {
        const toRead = Math.min(CHUNK_SIZE, totalSize - handle.offset!);
        const bytes = handle.readBytes(toRead);
        await uploadApi.uploadChunk(session.uploadId, i, bytes.buffer);
        onProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      await uploadApi.completeUpload(session.uploadId, mimeType);
    } finally {
      handle.close();
    }
  },
};

export { CHUNK_SIZE };
