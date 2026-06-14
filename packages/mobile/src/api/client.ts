import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlatformDefaultApiUrl } from '../config/api';

export const apiClient = axios.create({
  baseURL: getPlatformDefaultApiUrl(),
  timeout: 30000,
});

/** Cached auth token for use in URLs passed to <Image> (bypasses axios). */
let _authToken: string | null = null;

export function getAuthToken(): string | null {
  return _authToken;
}

export async function refreshAuthToken(): Promise<void> {
  _authToken = await AsyncStorage.getItem('access_token');
}

/**
 * Append ?token= to a URL so the backend's JWT strategy can authenticate
 * requests that don't go through axios (e.g. <Image>).
 */
export function withAuth(url: string): string {
  if (!_authToken) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(_authToken)}`;
}

/**
 * Update the API base URL at runtime (e.g. after reading stored config).
 */
export function updateApiBaseUrl(url: string): void {
  apiClient.defaults.baseURL = url;
}

// Request interceptor - add auth token + keep cached copy
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      _authToken = token;
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
      _authToken = null;
      await AsyncStorage.removeItem('access_token');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
