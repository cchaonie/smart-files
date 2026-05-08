import apiClient from './client';
import { FileItem, Folder, BrowseResponse } from '../types';

export const filesApi = {
  browse: async (folderId?: string | null): Promise<BrowseResponse> => {
    const params = folderId !== undefined ? { folderId } : {};
    const response = await apiClient.get<BrowseResponse>('/folders/browse', { params });
    return response.data;
  },

  listFiles: async (folderId?: string): Promise<{ files: FileItem[] }> => {
    const params = folderId !== undefined ? { folderId } : {};
    const response = await apiClient.get('/files', { params });
    return response.data;
  },

  deleteFile: async (id: string): Promise<void> => {
    await apiClient.delete(`/files/${id}`);
  },

  downloadUrl: (id: string): string => {
    return `${apiClient.defaults.baseURL}/files/${id}/download`;
  },

  previewUrl: (id: string): string => {
    return `${apiClient.defaults.baseURL}/files/${id}/preview`;
  },
};

export const foldersApi = {
  createFolder: async (name: string, parentId?: string): Promise<Folder> => {
    const response = await apiClient.post<Folder>('/folders', { name, parentId });
    return response.data;
  },

  renameFolder: async (id: string, name: string): Promise<Folder> => {
    const response = await apiClient.patch<Folder>(`/folders/${id}`, { name });
    return response.data;
  },

  deleteFolder: async (id: string): Promise<void> => {
    await apiClient.delete(`/folders/${id}`);
  },
};
