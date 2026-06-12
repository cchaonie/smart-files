import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './client';

export interface PhotoUploadResult {
  id: string;
  status: 'PROCESSING';
  storageKey: string;
  sha256: string;
}

export interface PhotoListItem {
  id: string;
  storageKey: string;
  sha256: string;
  status: string;
  thumbnailPath: string | null;
  previewPath: string | null;
  captureDate: string;
  createdAt: string;
  tags?: { tag: string }[];
}

export const photosApi = {
  /**
   * Upload a single photo file to the server.
   * Uses multipart/form-data via fetch for reliable binary upload.
   */
  upload: async (
    uri: string,
    fileName: string,
    mimeType: string,
    captureDate?: string,
    onProgress?: (progress: number) => void,
  ): Promise<PhotoUploadResult> => {
    const token = await AsyncStorage.getItem('access_token');
    const baseUrl = apiClient.defaults.baseURL;
    const url = `${baseUrl}/photos/upload`;

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: fileName,
      type: mimeType,
    } as any);
    if (captureDate) {
      formData.append('captureDate', captureDate);
    }

    return new Promise<PhotoUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
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
  },

  /**
   * List photos with pagination.
   */
  list: async (params?: {
    page?: number;
    limit?: number;
    tag?: string;
    before?: string;
    after?: string;
  }): Promise<{ data: PhotoListItem[]; total: number; page: number }> => {
    const response = await apiClient.get('/photos', { params });
    return response.data;
  },
};

export default photosApi;
