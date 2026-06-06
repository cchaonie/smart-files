import apiClient from './client';
import type { UploadSession } from '../types';

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
    const blob = new Blob([chunkData]);
    await apiClient.put(`/upload/session/${sessionId}/chunk?index=${chunkIndex}`, blob, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  },

  completeUpload: async (sessionId: string, mimeType?: string): Promise<{ status: string }> => {
    const response = await apiClient.post(`/upload/session/${sessionId}/complete`, { mimeType });
    return response.data;
  },

  /**
   * Wait for an async upload to finish by polling getSession.
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
};

export { CHUNK_SIZE };
