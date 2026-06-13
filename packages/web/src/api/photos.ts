import { apiClient } from './client';
import type { Photo, PhotoTimelineResponse } from '../types';

export const photosApi = {
  list: async (cursor?: string, limit: number = 20): Promise<PhotoTimelineResponse> => {
    const params: Record<string, string | number> = { limit };
    if (cursor) params.cursor = cursor;
    const res = await apiClient.get<PhotoTimelineResponse>('/photos', { params });
    return res.data;
  },
  getById: async (id: string): Promise<Photo> => {
    const res = await apiClient.get<Photo>(`/photos/${id}`);
    return res.data;
  },
};
