import { apiClient } from '@/lib/api-client';
import type {
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  GoogleAccountStatusResponse,
  GoogleLoginRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  ResetPasswordRequest,
  SetPasswordRequest,
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
   * Log in or register using a verified Google ID Token
   */
  async loginWithGoogle(data: GoogleLoginRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse, GoogleLoginRequest>('/api/v1/auth/google', data);
  },

  /**
   * Explicitly link a verified Google account to the authenticated session
   */
  async linkGoogleAccount(data: GoogleLoginRequest): Promise<GoogleAccountStatusResponse> {
    return apiClient.post<GoogleAccountStatusResponse, GoogleLoginRequest>('/api/v1/auth/google/link', data);
  },

  /**
   * Get Google account linking status and safe metadata
   */
  async getGoogleAccountStatus(): Promise<GoogleAccountStatusResponse> {
    return apiClient.get<GoogleAccountStatusResponse>('/api/v1/auth/google/status');
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

  /**
   * Change existing password for authenticated user
   */
  async changePassword(data: ChangePasswordRequest): Promise<MessageResponse> {
    return apiClient.post<MessageResponse, ChangePasswordRequest>('/api/v1/auth/change-password', data);
  },

  /**
   * Set initial password for Google-only account without password
   */
  async setPassword(data: SetPasswordRequest): Promise<MessageResponse> {
    return apiClient.post<MessageResponse, SetPasswordRequest>('/api/v1/auth/set-password', data);
  },
};

export default authApi;
