import { createContext, useContext } from 'react';
import { ApiError } from '@/lib/api-error';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@/types/auth';

export interface AuthContextValue {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: ApiError | null;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<AuthResponse>;
  logout: () => void;
  clearError: () => void;
  refreshUser: () => Promise<UserProfile | null>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
