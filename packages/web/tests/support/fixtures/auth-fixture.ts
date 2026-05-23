import { test as base, APIRequestContext } from '@playwright/test';
import { createUser, User } from '../factories/user-factory';

// Track created users for cleanup
const createdUsers: string[] = [];

export type AuthFixture = {
  auth: {
    loginAs: (email: string, password: string) => Promise<void>;
    registerUser: (overrides?: Partial<User>) => Promise<User>;
    getToken: () => string | null;
  };
  apiURL: string;
};

export const test = base.extend<AuthFixture>({
  apiURL: async ({}, use) => {
    await use(process.env.TEST_API_URL || 'http://localhost:4000/api');
  },

  auth: async ({ page, context, apiURL }, use) => {
    const loginAs = async (email: string, password: string) => {
      // Login via API for speed
      const response = await page.request.post(`${apiURL}/auth/login`, {
        data: { email, password },
      });

      if (!response.ok()) {
        throw new Error(`Login failed: ${await response.text()}`);
      }

      const { access_token } = await response.json();

      // Set token in localStorage
      await page.goto('/');
      await page.evaluate((token) => {
        localStorage.setItem('access_token', token);
      }, access_token);
    };

    const registerUser = async (overrides: Partial<User> = {}): Promise<User> => {
      const user = createUser(overrides);

      const response = await page.request.post(`${apiURL}/auth/register`, {
        data: {
          email: user.email,
          password: user.password,
          name: user.name,
        },
      });

      if (!response.ok()) {
        throw new Error(`Registration failed: ${await response.text()}`);
      }

      const data = await response.json();
      createdUsers.push(data.user.id);

      return { ...user, id: data.user.id };
    };

    const getToken = (): string | null => {
      // This needs to be called after page load
      return null; // Will be retrieved via page.evaluate
    };

    await use({ loginAs, registerUser, getToken });

    // Cleanup: No explicit cleanup needed as we're using test isolation
  },
});

export { expect } from '@playwright/test';
