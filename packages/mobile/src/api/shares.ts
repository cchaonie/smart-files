import apiClient from './client';

export const sharesApi = {
  createShare: async (fileId: string, password?: string, expiresIn?: string) => {
    const r = await apiClient.post('/shares', { fileId, password, expiresIn });
    return r.data;
  },

  listShares: async () => {
    const r = await apiClient.get('/shares');
    return r.data;
  },

  deleteShare: async (id: string): Promise<void> => {
    await apiClient.delete(`/shares/${id}`);
  },

  getShareInfo: async (token: string) => {
    const r = await apiClient.get(`/share/${token}`);
    return r.data;
  },

  verifySharePassword: async (token: string, password: string) => {
    const r = await apiClient.post(`/share/${token}/verify`, { password });
    return r.data;
  },

  downloadShareUrl: (token: string): string => {
    return `${apiClient.defaults.baseURL}/share/${token}/download`;
  },
};
