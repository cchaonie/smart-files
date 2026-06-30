import apiClient from './client';

export interface SystemStats {
  cpu: {
    usagePercent: number;
    cores: number;
    model: string;
  };
  memory: {
    totalGb: number;
    usedGb: number;
    usedPercent: number;
  };
  disk: {
    totalGb: number;
    usedGb: number;
    usedPercent: number;
    mount: string;
  };
  temperature: {
    celsius: number;
    zones: { name: string; temp: number }[];
  } | null;
  hostname: string;
}

export const systemApi = {
  getStats: async (): Promise<SystemStats> => {
    const response = await apiClient.get<SystemStats>('/system/stats');
    return response.data;
  },
};
