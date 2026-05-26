import apiClient from './client';

export interface ShareResponse {
  id: string;
  token: string;
  fileId: string;
  fileName: string;
  fileSize: string;
  mimeType: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  downloadCount: number;
  createdAt: string;
}

export interface ShareInfo {
  token: string;
  fileName: string;
  fileSize: string;
  mimeType: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  downloadCount: number;
  fileCreatedAt: string;
  shareCreatedAt: string;
}

export const sharesApi = {
  create: async (
    fileId: string,
    opts?: { password?: string; expiresInHours?: number }
  ): Promise<ShareResponse> => {
    const response = await apiClient.post<ShareResponse>('/shares', {
      fileId,
      ...opts,
    });
    return response.data;
  },

  list: async (): Promise<ShareResponse[]> => {
    const response = await apiClient.get<ShareResponse[]>('/shares');
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/shares/${id}`);
  },

  getShareInfo: async (token: string): Promise<ShareInfo> => {
    const response = await apiClient.get<ShareInfo>(`/share/${token}`);
    return response.data;
  },

  verifyShare: async (token: string, password?: string): Promise<void> => {
    await apiClient.post(`/share/${token}/verify`, { password });
  },

  shareDownloadUrl: (token: string, password?: string): string => {
    const base = `${apiClient.defaults.baseURL}/share/${token}/download`;
    return password ? `${base}?password=${encodeURIComponent(password)}` : base;
  },
};
