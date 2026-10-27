import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoryApi, categoryKeys } from '../api/category-api';
import type {
  CategoryResponse,
  CategoryDetailResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  UpdateCategoryStatusRequest,
} from '@/types/category';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve active community categories (Public)
 */
export function useCategories() {
  return useQuery<CategoryResponse[]>({
    queryKey: categoryKeys.all,
    queryFn: () => categoryApi.getCategories(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to retrieve all categories (both active and inactive) with active listing counts (Admin)
 */
export function useAdminCategories() {
  return useQuery<CategoryDetailResponse[], ApiError>({
    queryKey: categoryKeys.adminLists(),
    queryFn: () => categoryApi.getAdminCategories(),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Mutation hook to create a new category (Admin)
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation<CategoryResponse, ApiError, CreateCategoryRequest>({
    mutationFn: (payload) => categoryApi.createCategory(payload),
    onSuccess: () => {
      // Invalidate all category queries (public, admin list, and details)
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      // Invalidate admin dashboard stats so totalCategories count refreshes
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
    },
  });
}

/**
 * Mutation hook to update an existing category details (Admin)
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation<CategoryResponse, ApiError, { id: string; payload: UpdateCategoryRequest }>({
    mutationFn: ({ id, payload }) => categoryApi.updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

/**
 * Mutation hook to activate or deactivate an existing category (Admin)
 */
export function useUpdateCategoryStatus() {
  const queryClient = useQueryClient();

  return useMutation<CategoryResponse, ApiError, { id: string; payload: UpdateCategoryStatusRequest }>({
    mutationFn: ({ id, payload }) => categoryApi.updateCategoryStatus(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
    },
  });
}

export default useCategories;
