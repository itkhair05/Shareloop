import { useQuery } from '@tanstack/react-query';
import { reviewApi, reviewKeys } from '../api/review-api';
import type { PageResponse } from '@/types/api';
import type {
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
