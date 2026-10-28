import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  AdminReviewResponse,
  AdminReviewsQueryParams,
  ModerateReviewRequest,
} from '@/types/admin-review';

/**
 * React Query Keys for Admin Reviews
 */
export const adminReviewKeys = {
  all: ['admin', 'reviews'] as const,
  lists: () => [...adminReviewKeys.all, 'list'] as const,
  list: (params?: AdminReviewsQueryParams) => [...adminReviewKeys.lists(), params ?? {}] as const,
  details: () => [...adminReviewKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminReviewKeys.details(), id] as const,
};

export const adminReviewsApi = {
  /**
   * List reviews with optional isHidden, rating, keyword search, pagination, and sorting.
   * Requires ADMIN role.
   */
  getAdminReviews(params?: AdminReviewsQueryParams): Promise<PageResponse<AdminReviewResponse>> {
    const cleanParams: Record<string, unknown> = {};

    if (params) {
      if (params.isHidden !== undefined) {
        cleanParams.isHidden = params.isHidden;
      }
      if (params.rating !== undefined) {
        cleanParams.rating = params.rating;
      }
      if (params.search && params.search.trim()) {
        cleanParams.search = params.search.trim();
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

    return apiClient.get<PageResponse<AdminReviewResponse>>('/api/v1/admin/reviews', {
      params: cleanParams,
    });
  },

  /**
   * Retrieve administrative review details by ID.
   * Requires ADMIN role.
   */
  getAdminReviewById(reviewId: string): Promise<AdminReviewResponse> {
    return apiClient.get<AdminReviewResponse>(`/api/v1/admin/reviews/${reviewId}`);
  },

  /**
   * Soft-moderate (hide) an inappropriate review.
   * Requires a JSON body with moderation reason.
   * Requires ADMIN role.
   */
  moderateReview(reviewId: string, payload: ModerateReviewRequest): Promise<void> {
    return apiClient.delete<void>(`/api/v1/admin/reviews/${reviewId}`, {
      data: payload,
    });
  },

  /**
   * Restore a previously hidden review.
   * Requires ADMIN role.
   */
  restoreReview(reviewId: string): Promise<AdminReviewResponse> {
    return apiClient.post<AdminReviewResponse>(`/api/v1/admin/reviews/${reviewId}/restore`);
  },
};

export default adminReviewsApi;
