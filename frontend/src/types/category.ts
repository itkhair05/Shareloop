/**
 * Category Types matching the ShareLoop Spring Boot backend DTOs
 * Source of truth:
 * - com.shareloop.dto.category.CategoryResponse
 * - com.shareloop.dto.category.CategoryDetailResponse
 */

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Backward compatibility alias for CategoryResponse
 */
export type Category = CategoryResponse;

export interface CategoryDetailResponse extends CategoryResponse {
  activeListingCount: number;
}

/**
 * Backward compatibility alias for CategoryDetailResponse
 */
export type CategoryDetail = CategoryDetailResponse;

export interface CreateCategoryRequest {
  name: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateCategoryRequest {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateCategoryStatusRequest {
  isActive: boolean;
}
