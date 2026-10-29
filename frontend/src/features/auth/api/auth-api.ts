import { apiClient } from '@/lib/api-client';
import type {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  ResetPasswordRequest,
  UserProfile,
} from '@/types/auth';

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

  /**
   * Request password reset link to be sent via email
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<MessageResponse> {
    return apiClient.post<MessageResponse, ForgotPasswordRequest>('/api/v1/auth/forgot-password', data);
  },

  /**
   * Reset user password using the one-time token
   */
  async resetPassword(data: ResetPasswordRequest): Promise<MessageResponse> {
    return apiClient.post<MessageResponse, ResetPasswordRequest>('/api/v1/auth/reset-password', data);
  },
};

export default authApi;
