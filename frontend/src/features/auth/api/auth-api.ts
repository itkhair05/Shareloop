import { apiClient } from '@/lib/api-client';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@/types/auth';

/**
 * Authentication API Service
 * Encapsulates all authentication network operations with the backend.
 */
export const authApi = {
  /**
   * Log in an existing user with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse, LoginRequest>('/api/v1/auth/login', credentials);
  },

  /**
   * Register a new user account
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse, RegisterRequest>('/api/v1/auth/register', data);
  },

  /**
   * Fetch currently authenticated user profile
   */
  async getCurrentUser(): Promise<UserProfile> {
    return apiClient.get<UserProfile>('/api/v1/auth/me');
  },
};

export default authApi;
