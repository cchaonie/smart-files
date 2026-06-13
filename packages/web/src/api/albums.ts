import { apiClient } from './client';
import type { Album, ShareEntry, Photo } from '../types';

export const albumsApi = {
  list: async (): Promise<{ albums: Album[] }> => {
    const res = await apiClient.get('/albums');
    return res.data;
  },
  getById: async (id: string): Promise<Album> => {
    const res = await apiClient.get(`/albums/${id}`);
    return res.data;
  },
  create: async (data: { name: string; description?: string }): Promise<Album> => {
    const res = await apiClient.post('/albums', data);
    return res.data;
  },
  update: async (id: string, data: { name?: string; description?: string }): Promise<Album> => {
    const res = await apiClient.patch(`/albums/${id}`, data);
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/albums/${id}`);
  },
  listShares: async (id: string): Promise<{ shares: ShareEntry[] }> => {
    const res = await apiClient.get(`/albums/${id}/shares`);
    return res.data;
  },
  share: async (id: string, userId: string, role: string): Promise<any> => {
    const res = await apiClient.post(`/albums/${id}/share`, { userId, role });
    return res.data;
  },
  unshare: async (albumId: string, userId: string): Promise<void> => {
    await apiClient.delete(`/albums/${albumId}/share/${userId}`);
  },
  listPhotos: async (albumId: string): Promise<{ photos: Photo[] }> => {
    const res = await apiClient.get(`/albums/${albumId}/photos`);
    return res.data;
  },
  addPhoto: async (albumId: string, photoId: string): Promise<any> => {
    const res = await apiClient.post(`/albums/${albumId}/photos`, { photoId });
    return res.data;
  },
  removePhoto: async (albumId: string, photoId: string): Promise<void> => {
    await apiClient.delete(`/albums/${albumId}/photos/${photoId}`);
  },
};

export const usersApi = {
  search: async (q: string): Promise<{ users: { id: string; name: string | null; email: string }[] }> => {
    const res = await apiClient.get('/users/search', { params: { q } });
    return res.data;
  },
};
