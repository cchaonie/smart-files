import apiClient from './client';
import { BrowseResponse } from '../types';

export const browse = async (parentId?: string | null): Promise<BrowseResponse> => {
  const params = parentId !== undefined ? { parentId } : {};
  const response = await apiClient.get<BrowseResponse>('/folders/browse', { params });
  return response.data;
};
