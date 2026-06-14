import { apiClient } from './client';
import type { Photo, PhotoTimelineResponse, TagWithCount } from '../types';

function authUrl(path: string): string {
  const token = localStorage.getItem('access_token');
  const url = `${apiClient.defaults.baseURL}${path}`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

export const photosApi = {
  list: async (cursor?: string, limit: number = 20, tag?: string): Promise<PhotoTimelineResponse> => {
    const params: Record<string, string | number> = { limit };
    if (cursor) params.cursor = cursor;
    if (tag) params.tag = tag;
    const res = await apiClient.get<PhotoTimelineResponse>('/photos', { params });
    return res.data;
  },
  getById: async (id: string): Promise<Photo> => {
    const res = await apiClient.get<Photo>(`/photos/${id}`);
    return res.data;
  },
  getTags: async (q?: string): Promise<{ tags: TagWithCount[] }> => {
    const params: Record<string, string> = {};
    if (q) params.q = q;
    const res = await apiClient.get<{ tags: TagWithCount[] }>('/photos/tags', { params });
    return res.data;
  },
  thumbnailUrl: (photo: Pick<Photo, 'id'>): string => authUrl(`/photos/${photo.id}/thumbnail`),
  previewUrl: (photo: Pick<Photo, 'id'>): string => authUrl(`/photos/${photo.id}/preview`),
};
