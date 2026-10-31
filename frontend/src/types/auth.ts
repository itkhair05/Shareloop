/**
 * Authentication and User Types matching backend models
 */

export type UserRole = 'USER' | 'ADMIN';

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  phoneNumber?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  hasPassword?: boolean;
  avatarUrl?: string | null;
  customAvatarUrl?: string | null;
  googleAvatarUrl?: string | null;
}

export interface AuthResponse {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  accessToken: string;
  tokenType: string;
  avatarUrl?: string | null;
}

export interface AuthTokens {
  accessToken: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  displayName: string;
  phoneNumber?: string | null;
}

export interface PublicUserProfile {
  id: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  avatarUrl?: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface MessageResponse {
  message: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface GoogleAccountStatusResponse {
  linked: boolean;
  provider: string;
  email: string | null;
  linkedAt: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface SetPasswordRequest {
  newPassword: string;
}
