import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewApi, reviewKeys } from '../api/review-api';
import type { PageResponse } from '@/types/api';
import type {
  CreateReviewRequest,
  ReviewResponse,
  UserRatingSummaryResponse,
  UserReviewsQueryParams,
} from '@/types/review';
import { isValidUuid } from '@/lib/utils';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve aggregate rating summary for a user.
 * Validates UUID before initiating network request.
 */
export function useUserRatingSummary(userId?: string) {
  const isIdValid = Boolean(userId && (isValidUuid(userId) || userId.trim().length > 0));

  return useQuery<UserRatingSummaryResponse, ApiError>({
    queryKey: reviewKeys.ratingSummary(userId || ''),
    queryFn: () => reviewApi.getUserRatingSummary(userId!),
    enabled: isIdValid,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Hook to retrieve paginated public reviews for a user.
 * Validates UUID before initiating network request.
 */
export function useUserReviews(userId?: string, params?: UserReviewsQueryParams) {
  const isIdValid = Boolean(userId && (isValidUuid(userId) || userId.trim().length > 0));

  return useQuery<PageResponse<ReviewResponse>, ApiError>({
    queryKey: reviewKeys.userReviews(userId || '', params),
    queryFn: () => reviewApi.getUserReviews(userId!, params),
    enabled: isIdValid,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to retrieve reviews for a specific transaction.
 * Validates UUID before initiating network request.
 */
export function useTransactionReviews(transactionId?: string, enabled = true) {
  const isIdValid = Boolean(transactionId && (isValidUuid(transactionId) || transactionId.trim().length > 0));

  return useQuery<ReviewResponse[], ApiError>({
    queryKey: reviewKeys.transactionReviews(transactionId || ''),
    queryFn: () => reviewApi.getTransactionReviews(transactionId!),
    enabled: Boolean(isIdValid && enabled),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Mutation hook to submit a review for a completed transaction.
 * Invalidates transaction reviews, user reviews, and rating summary.
 */
export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation<
    ReviewResponse,
    ApiError,
    { transactionId: string; payload: CreateReviewRequest; revieweeId?: string }
  >({
    mutationFn: ({ transactionId, payload }) =>
      reviewApi.createReview(transactionId, payload),
    onSuccess: (data, variables) => {
      // Invalidate transaction reviews
      queryClient.invalidateQueries({
        queryKey: reviewKeys.transactionReviews(variables.transactionId),
      });
      // Invalidate target user's rating summary & reviews
      const targetUserId = variables.revieweeId || data.reviewee?.id;
      if (targetUserId) {
        queryClient.invalidateQueries({
          queryKey: reviewKeys.ratingSummary(targetUserId),
        });
        queryClient.invalidateQueries({
          queryKey: reviewKeys.userReviews(targetUserId),
        });
      }
      queryClient.invalidateQueries({
        queryKey: reviewKeys.ratingSummaries(),
      });
      queryClient.invalidateQueries({
        queryKey: reviewKeys.userReviewsAll(),
      });
    },
  });
}
