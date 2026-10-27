import { apiClient } from '@/lib/api-client';
import type {
  CategoryResponse,
  CategoryDetailResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  UpdateCategoryStatusRequest,
} from '@/types/category';

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

  /**
   * Admin: Retrieve all categories (active and inactive) with active listing count
   */
  async getAdminCategories(): Promise<CategoryDetailResponse[]> {
    return apiClient.get<CategoryDetailResponse[]>('/api/v1/admin/categories');
  },

  /**
   * Admin: Create a new category
   */
  async createCategory(payload: CreateCategoryRequest): Promise<CategoryResponse> {
    return apiClient.post<CategoryResponse>('/api/v1/admin/categories', payload);
  },

  /**
   * Admin: Update category details by ID
   */
  async updateCategory(id: string, payload: UpdateCategoryRequest): Promise<CategoryResponse> {
    return apiClient.put<CategoryResponse>(`/api/v1/admin/categories/${id}`, payload);
  },

  /**
   * Admin: Activate or deactivate a category
   */
  async updateCategoryStatus(id: string, payload: UpdateCategoryStatusRequest): Promise<CategoryResponse> {
    return apiClient.patch<CategoryResponse>(`/api/v1/admin/categories/${id}/status`, payload);
  },
};

/**
 * React Query Keys for Categories
 */
export const categoryKeys = {
  all: ['categories'] as const,
  lists: () => [...categoryKeys.all, 'list'] as const,
  adminLists: () => [...categoryKeys.all, 'admin'] as const,
  detail: (slug: string) => [...categoryKeys.all, 'detail', slug] as const,
};

export default categoryApi;
