import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  ReviewResponse,
  UserRatingSummaryResponse,
  UserReviewsQueryParams,
} from '@/types/review';

/**
 * Service for fetching user reviews and rating summaries
 */
export const reviewApi = {
  /**
   * Retrieve aggregate star rating summary and breakdown for a user.
   * GET /api/v1/users/{userId}/rating-summary
   */
  async getUserRatingSummary(userId: string): Promise<UserRatingSummaryResponse> {
    return apiClient.get<UserRatingSummaryResponse>(
      `/api/v1/users/${encodeURIComponent(userId)}/rating-summary`
    );
  },

  /**
   * Retrieve paginated reviews received by a user.
   * GET /api/v1/users/{userId}/reviews
   */
  async getUserReviews(
    userId: string,
    params?: UserReviewsQueryParams
  ): Promise<PageResponse<ReviewResponse>> {
    return apiClient.get<PageResponse<ReviewResponse>>(
      `/api/v1/users/${encodeURIComponent(userId)}/reviews`,
      { params }
    );
  },
};

/**
 * Query key factories for Reviews and Rating Summaries
 */
export const reviewKeys = {
  all: ['reviews'] as const,
  ratingSummaries: () => [...reviewKeys.all, 'rating-summary'] as const,
  ratingSummary: (userId: string) => [...reviewKeys.ratingSummaries(), userId] as const,
  userReviewsAll: () => [...reviewKeys.all, 'user-reviews'] as const,
  userReviews: (userId: string, params?: UserReviewsQueryParams) =>
    [...reviewKeys.userReviewsAll(), userId, params] as const,
};

export default reviewApi;
