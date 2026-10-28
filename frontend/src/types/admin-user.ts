import type { UserRole, UserStatus } from './auth';

/**
 * Administrative User Representation
 * Matches backend GET /api/v1/admin/users and GET /api/v1/admin/users/{id}
 */
export interface AdminUserResponse {
  id: string;
  displayName: string;
  email: string;
  phoneNumber?: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query parameters for administrative user listing
 */
export interface AdminUsersQueryParams {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  size?: number;
  sortBy?: 'createdAt' | 'displayName' | 'email' | 'role' | 'status' | string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Request payload to update user status
 * Matches backend PATCH /api/v1/admin/users/{id}/status
 */
export interface UpdateUserStatusAdminRequest {
  status: UserStatus;
}

/**
 * Request payload to update user role
 * Matches backend PATCH /api/v1/admin/users/{id}/role
 */
export interface UpdateUserRoleAdminRequest {
  role: UserRole;
}
