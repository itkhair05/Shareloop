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
}
