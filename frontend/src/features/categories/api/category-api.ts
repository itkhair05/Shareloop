import { apiClient } from '@/lib/api-client';
import type { CategoryResponse, CategoryDetailResponse } from '@/types/category';

/**
 * Category API Service
 * Encapsulates network operations for public and admin category endpoints.
 */
export const categoryApi = {
  /**
   * Public: Retrieve all active categories ordered alphabetically
   */
  async getCategories(): Promise<CategoryResponse[]> {
    return apiClient.get<CategoryResponse[]>('/api/v1/categories');
  },

  /**
   * Public: Retrieve active category details by slug including active listing count
   */
  async getCategoryBySlug(slug: string): Promise<CategoryDetailResponse> {
    return apiClient.get<CategoryDetailResponse>(`/api/v1/categories/${slug}`);
  },
};

/**
 * React Query Keys for Categories
 */
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  detail: (slug: string) => [...categoryKeys.all, 'detail', slug] as const,
};

export default categoryApi;
