import { getStoredApiUrl } from './storage';

const DEFAULT_API_URL = 'http://localhost:4000/api';

export function getPlatformDefaultApiUrl(): string {
  return DEFAULT_API_URL;
}

/**
 * Build-time override via EXPO_PUBLIC_API_URL.
 */
export function getBuildTimeApiUrl(): string | undefined {
  return process.env.EXPO_PUBLIC_API_URL;
}

/**
 * Resolve the API URL to use.
 *
 * Priority:
 *   1. Stored user-configured URL (AsyncStorage)
 *   2. EXPO_PUBLIC_API_URL environment variable
 *   3. Default (http://localhost:4000)
 */
export async function resolveApiUrl(): Promise<string> {
  const stored = await getStoredApiUrl();
  if (stored) return stored;

  const buildTime = getBuildTimeApiUrl();
  if (buildTime) return buildTime;

  return DEFAULT_API_URL;
}

/**
 * Extract a human-readable message from an Axios/network error.
 */
export function getApiErrorMessage(error: any): string {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }
  if (error?.message) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if an error looks like a connection/network error.
 */
export function isNetworkError(error: any): boolean {
  return (
    !error?.response &&
    (error?.message?.toLowerCase().includes('network') ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ENOTFOUND' ||
      error?.code === 'ETIMEDOUT')
  );
}
