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

  completeUpload: async (sessionId: string, mimeType?: string): Promise<{ file: { id: string; name: string; size: string } }> => {
    const response = await apiClient.post(`/upload/session/${sessionId}/complete`, { mimeType });
    return response.data;
  },
};

export { CHUNK_SIZE };
