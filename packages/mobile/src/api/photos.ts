import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './client';
import type { Photo, PhotoTimelineResponse } from '../types';

export interface PhotoUploadResult {
  id: string;
  status: 'PROCESSING';
  storageKey: string;
  sha256: string;
}

export const photosApi = {
  upload: async (
    uri: string, fileName: string, mimeType: string,
    captureDate?: string, onProgress?: (progress: number) => void,
  ): Promise<PhotoUploadResult> => {
    const token = await AsyncStorage.getItem('access_token');
    const baseUrl = apiClient.defaults.baseURL;
    const url = `${baseUrl}/photos/upload`;
    const formData = new FormData();
    formData.append('file', { uri, name: fileName, type: mimeType } as any);
    if (captureDate) formData.append('captureDate', captureDate);
    return new Promise<PhotoUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else {
          try { const err = JSON.parse(xhr.responseText); reject(new Error(err.message || `Upload failed: ${xhr.status}`)); }
          catch { reject(new Error(`Upload failed: ${xhr.status}`)); }
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  },

  list: async (cursor?: string, limit: number = 20): Promise<PhotoTimelineResponse> => {
    const params: Record<string, string | number> = { limit };
    if (cursor) params.cursor = cursor;
    const res = await apiClient.get('/photos', { params });
    return res.data;
  },

  getById: async (id: string): Promise<Photo> => {
    const res = await apiClient.get(`/photos/${id}`);
    return res.data;
  },

  thumbnailUrl: (photo: Pick<Photo, 'id'>): string => {
    return `${apiClient.defaults.baseURL}/api/photos/${photo.id}/thumbnail`;
  },

  previewUrl: (photo: Pick<Photo, 'id'>): string => {
    return `${apiClient.defaults.baseURL}/api/photos/${photo.id}/preview`;
  },
};

export default photosApi;
