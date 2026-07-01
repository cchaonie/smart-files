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

export interface MemorySize {
  kb: number;
  mb: number;
  gb: number;
}

export interface MemoryDetail {
  total: MemorySize;
  used: MemorySize;
  available: MemorySize;
  free: MemorySize;
  buffers: MemorySize;
  cached: MemorySize;
  shared: MemorySize;
  swap: {
    total: MemorySize;
    used: MemorySize;
    free: MemorySize;
  };
  usedPercent: number;
}

export interface DiskMount {
  filesystem: string;
  mount: string;
  total: MemorySize;
  used: MemorySize;
  free: MemorySize;
  usedPercent: number;
}

export interface DiskDetail {
  mounts: DiskMount[];
  inode: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  } | null;
}

export interface DiskDuItem {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
}

export interface DiskDuResult {
  path: string;
  totalSize: number;
  itemCount: number;
  items: DiskDuItem[];
}

export const systemApi = {
  getStats: async (): Promise<SystemStats> => {
    const response = await apiClient.get<SystemStats>('/system/stats');
    return response.data;
  },
  getMemoryDetail: async (): Promise<MemoryDetail> => {
    const response = await apiClient.get<MemoryDetail>('/system/stats/memory');
    return response.data;
  },
  getDiskDetail: async (): Promise<DiskDetail> => {
    const response = await apiClient.get<DiskDetail>('/system/stats/disk');
    return response.data;
  },
  getDirectorySizes: async (path: string): Promise<DiskDuResult> => {
    const response = await apiClient.get<DiskDuResult>('/system/stats/disk/du', { params: { path } });
    return response.data;
  },
};
