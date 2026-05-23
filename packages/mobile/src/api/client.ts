import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlatformDefaultApiUrl } from '../config/api';

export const apiClient = axios.create({
  baseURL: getPlatformDefaultApiUrl(),
  timeout: 30000,
});

/**
 * Update the API base URL at runtime (e.g. after reading stored config).
 */
export function updateApiBaseUrl(url: string): void {
  apiClient.defaults.baseURL = url;
}

// Request interceptor - add auth token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('access_token');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
