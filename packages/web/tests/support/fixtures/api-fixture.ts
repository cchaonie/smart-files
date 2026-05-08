import { test as base, APIRequestContext } from '@playwright/test';

export type ApiFixture = {
  api: {
    request: APIRequestContext;
    baseURL: string;
    get: (endpoint: string) => Promise<Response>;
    post: (endpoint: string, data: unknown) => Promise<Response>;
    put: (endpoint: string, data: unknown) => Promise<Response>;
    patch: (endpoint: string, data: unknown) => Promise<Response>;
    delete: (endpoint: string) => Promise<Response>;
  };
};

export const test = base.extend<ApiFixture>({
  api: async ({ page, request }, use) => {
    const baseURL = process.env.TEST_API_URL || 'http://localhost:4000';

    // Helper to get auth token from localStorage
    const getAuthHeaders = async (): Promise<Record<string, string>> => {
      const token = await page.evaluate(() => localStorage.getItem('access_token'));
      return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const api = {
      request,
      baseURL,

      get: async (endpoint: string): Promise<Response> => {
        const headers = await getAuthHeaders();
        return request.get(`${baseURL}${endpoint}`, { headers });
      },

      post: async (endpoint: string, data: unknown): Promise<Response> => {
        const headers = await getAuthHeaders();
        return request.post(`${baseURL}${endpoint}`, {
          headers,
          data,
        });
      },

      put: async (endpoint: string, data: unknown): Promise<Response> => {
        const headers = await getAuthHeaders();
        return request.put(`${baseURL}${endpoint}`, {
          headers,
          data,
        });
      },

      patch: async (endpoint: string, data: unknown): Promise<Response> => {
        const headers = await getAuthHeaders();
        return request.patch(`${baseURL}${endpoint}`, {
          headers,
          data,
        });
      },

      delete: async (endpoint: string): Promise<Response> => {
        const headers = await getAuthHeaders();
        return request.delete(`${baseURL}${endpoint}`, { headers });
      },
    };

    await use(api);
  },
});

export { expect } from '@playwright/test';
