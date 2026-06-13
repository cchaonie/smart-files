import { apiClient } from './client';
import type { Photo, PhotoTimelineResponse, TagWithCount } from '../types';

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
};
