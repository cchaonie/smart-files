import apiClient from './client';
import type { FileItem, Folder, BrowseResponse, CreateFolderRequest } from '../types';

export const filesApi = {
  browse: async (parentId?: string | null): Promise<BrowseResponse> => {
    const params = parentId !== undefined ? { parentId } : {};
    const response = await apiClient.get<BrowseResponse>('/folders/browse', { params });
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

  moveFile: async (id: string, folderId: string | null): Promise<void> => {
    await apiClient.patch(`/files/${id}`, { folderId });
  },
};

export const foldersApi = {
  createFolder: async (data: CreateFolderRequest): Promise<Folder> => {
    const response = await apiClient.post<Folder>('/folders', data);
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
