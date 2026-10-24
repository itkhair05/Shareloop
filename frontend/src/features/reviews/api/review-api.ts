import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  CreateReviewRequest,
  ReviewResponse,
  UserRatingSummaryResponse,
  UserReviewsQueryParams,
} from '@/types/review';

/**
 * Service for fetching user reviews, transaction reviews, and rating summaries
 */
export const reviewApi = {
  /**
   * Submit a review for a completed transaction.
   * POST /api/v1/transactions/{transactionId}/reviews
   */
  async createReview(
    transactionId: string,
    payload: CreateReviewRequest
  ): Promise<ReviewResponse> {
    return apiClient.post<ReviewResponse>(
      `/api/v1/transactions/${encodeURIComponent(transactionId)}/reviews`,
      payload
    );
  },

  /**
   * Retrieve reviews for a transaction (participants or ADMIN).
   * GET /api/v1/transactions/{transactionId}/reviews
   */
  async getTransactionReviews(
    transactionId: string
  ): Promise<ReviewResponse[]> {
    return apiClient.get<ReviewResponse[]>(
      `/api/v1/transactions/${encodeURIComponent(transactionId)}/reviews`
    );
  },

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
  transactionReviewsAll: () => [...reviewKeys.all, 'transaction-reviews'] as const,
  transactionReviews: (transactionId: string) =>
    [...reviewKeys.transactionReviewsAll(), transactionId] as const,
};

export default reviewApi;
