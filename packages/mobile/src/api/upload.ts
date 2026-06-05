import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './client';
import { UploadSession } from '../types';
import * as FileSystem from 'expo-file-system/legacy';

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

  completeUpload: async (sessionId: string, mimeType?: string): Promise<{ file: { id: string; name: string; size: string } }> => {
    const response = await apiClient.post(`/upload/session/${sessionId}/complete`, { mimeType });
    return response.data;
  },

  uploadFile: async (
    uri: string,
    fileName: string,
    mimeType: string,
    folderId: string | null,
    onProgress: (progress: number) => void
  ): Promise<void> => {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    const totalSize = fileInfo.size;

    // Create upload session
    const session = await uploadApi.createSession(fileName, totalSize, folderId || undefined);

    // Read and upload chunks
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunkSize = end - start;

      // Read chunk
      const chunkBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: start,
        length: chunkSize,
      });

      // Convert base64 to ArrayBuffer
      const binaryString = atob(chunkBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j);
      }

      // Upload chunk
      await uploadApi.uploadChunk(session.uploadId, i, bytes.buffer);
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    // Complete upload
    await uploadApi.completeUpload(session.uploadId, mimeType);
  },
};

export { CHUNK_SIZE };
