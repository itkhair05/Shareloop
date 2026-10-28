import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  AdminUserResponse,
  AdminUsersQueryParams,
  UpdateUserRoleAdminRequest,
  UpdateUserStatusAdminRequest,
} from '@/types/admin-user';

/**
 * Standard Query Keys for Admin Users caching and invalidation
 */
export const adminUserKeys = {
  all: ['admin', 'users'] as const,
  lists: () => [...adminUserKeys.all, 'list'] as const,
  list: (params?: AdminUsersQueryParams) => [...adminUserKeys.lists(), params ?? {}] as const,
  details: () => [...adminUserKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminUserKeys.details(), id] as const,
};

export const adminUsersApi = {
  /**
   * List users with optional search, role, status filters, pagination, and sorting.
   * Requires ADMIN role.
   */
  getAdminUsers(params?: AdminUsersQueryParams): Promise<PageResponse<AdminUserResponse>> {
    const cleanParams: Record<string, unknown> = {};

    if (params) {
      if (params.search && params.search.trim()) {
        cleanParams.search = params.search.trim();
      }
      if (params.role) {
        cleanParams.role = params.role;
      }
      if (params.status) {
        cleanParams.status = params.status;
      }
      if (params.page !== undefined && params.page >= 0) {
        cleanParams.page = params.page;
      }
      if (params.size !== undefined && params.size > 0) {
        cleanParams.size = params.size;
      }
      if (params.sortBy) {
        cleanParams.sortBy = params.sortBy;
      }
      if (params.sortDirection) {
        cleanParams.sortDirection = params.sortDirection;
      }
    }

    return apiClient.get<PageResponse<AdminUserResponse>>('/api/v1/admin/users', {
      params: cleanParams,
    });
  },

  /**
   * Retrieve administrative user details by ID.
   * Requires ADMIN role.
   */
  getAdminUserById(id: string): Promise<AdminUserResponse> {
    return apiClient.get<AdminUserResponse>(`/api/v1/admin/users/${id}`);
  },

  /**
   * Update user account status (ACTIVE, SUSPENDED, DEACTIVATED).
   * Requires ADMIN role.
   */
  updateUserStatus(
    id: string,
    payload: UpdateUserStatusAdminRequest
  ): Promise<AdminUserResponse> {
    return apiClient.patch<AdminUserResponse>(`/api/v1/admin/users/${id}/status`, payload);
  },

  /**
   * Update user role (USER, ADMIN).
   * Requires ADMIN role.
   */
  updateUserRole(
    id: string,
    payload: UpdateUserRoleAdminRequest
  ): Promise<AdminUserResponse> {
    return apiClient.patch<AdminUserResponse>(`/api/v1/admin/users/${id}/role`, payload);
  },
};

export default adminUsersApi;
