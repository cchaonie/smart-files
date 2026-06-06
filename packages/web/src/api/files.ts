import apiClient from './client';
import type { Folder, BrowseResponse, CreateFolderRequest } from '../types';

export const filesApi = {
  browse: async (parentId?: string | null): Promise<BrowseResponse> => {
    const params: Record<string, string> = {};
    if (parentId === null) {
      params.parentId = '';
    } else if (parentId !== undefined) {
      params.parentId = parentId;
    }
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
    const token = localStorage.getItem('access_token');
    const url = `${apiClient.defaults.baseURL}/files/${id}/preview`;
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  },

  search: async (q: string) => {
    const response = await apiClient.get('/files/search', { params: { q } });
    return response.data.results;
  },

  listTrash: async () => {
    const response = await apiClient.get('/files/trash');
    return response.data.files;
  },

  restoreFile: async (id: string): Promise<void> => {
    await apiClient.post(`/files/${id}/restore`);
  },

  purgeFile: async (id: string): Promise<void> => {
    await apiClient.delete(`/files/${id}/permanent`);
  },

  emptyTrash: async () => {
    const response = await apiClient.delete('/files/trash/empty');
    return response.data;
  },

  moveFile: async (id: string, folderId: string | null): Promise<void> => {
    await apiClient.patch(`/files/${id}`, { folderId });
  },

  renameFile: async (id: string, name: string) => {
    const r = await apiClient.patch(`/files/${id}`, { name });
    return r.data;
  },

  batchDelete: async (ids: string[]): Promise<void> => {
    await apiClient.post('/files/batch/delete', { ids });
  },

  batchMove: async (ids: string[], folderId: string | null): Promise<void> => {
    await apiClient.post('/files/batch/move', { ids, folderId });
  },

  batchRestore: async (ids: string[]): Promise<void> => {
    await apiClient.post('/files/batch/restore', { ids });
  },

  batchPurge: async (ids: string[]): Promise<void> => {
    await apiClient.delete('/files/batch/permanent', { data: { ids } });
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
