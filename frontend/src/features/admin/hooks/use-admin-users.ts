import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminUsersApi, adminUserKeys } from '../api/admin-users-api';
import type {
  AdminUserResponse,
  AdminUsersQueryParams,
  UpdateUserRoleAdminRequest,
  UpdateUserStatusAdminRequest,
} from '@/types/admin-user';
import type { PageResponse } from '@/types/api';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve paginated administrative user listing with filters
 */
export function useAdminUsers(params?: AdminUsersQueryParams) {
  return useQuery<PageResponse<AdminUserResponse>, ApiError>({
    queryKey: adminUserKeys.list(params),
    queryFn: () => adminUsersApi.getAdminUsers(params),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to retrieve administrative details of a specific user
 */
export function useAdminUserDetail(id: string | null) {
  return useQuery<AdminUserResponse, ApiError>({
    queryKey: id ? adminUserKeys.detail(id) : ['admin', 'users', 'detail', 'none'],
    queryFn: () => adminUsersApi.getAdminUserById(id!),
    enabled: Boolean(id),
    staleTime: 1000 * 30,
  });
}

/**
 * Mutation hook to update a user's account status (ACTIVE, SUSPENDED, DEACTIVATED)
 */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminUserResponse,
    ApiError,
    { id: string; payload: UpdateUserStatusAdminRequest }
  >({
    mutationFn: ({ id, payload }) => adminUsersApi.updateUserStatus(id, payload),
    onSuccess: (updatedUser) => {
      // Invalidate all admin user queries
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      // Invalidate specific user detail
      queryClient.setQueryData(adminUserKeys.detail(updatedUser.id), updatedUser);
      // Invalidate admin dashboard statistics
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
    },
  });
}

/**
 * Mutation hook to update a user's role (USER, ADMIN)
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation<
    AdminUserResponse,
    ApiError,
    { id: string; payload: UpdateUserRoleAdminRequest }
  >({
    mutationFn: ({ id, payload }) => adminUsersApi.updateUserRole(id, payload),
    onSuccess: (updatedUser) => {
      // Invalidate all admin user queries
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
      // Invalidate specific user detail
      queryClient.setQueryData(adminUserKeys.detail(updatedUser.id), updatedUser);
      // Invalidate admin dashboard statistics
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
    },
  });
}
