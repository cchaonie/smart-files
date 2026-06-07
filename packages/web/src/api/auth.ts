import apiClient from './client';
import type { LoginCredentials, RegisterData, AuthResponse } from '../types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    localStorage.setItem('access_token', response.data.access_token);
    return response.data;
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/register', data);
    localStorage.setItem('access_token', response.data.access_token);
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem('access_token');
  },

  getToken: (): string | null => {
    return localStorage.getItem('access_token');
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { currentPassword, newPassword });
  },
};
