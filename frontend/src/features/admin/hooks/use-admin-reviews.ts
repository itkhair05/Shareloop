import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminReviewKeys, adminReviewsApi } from '../api/admin-reviews-api';
import type {
  AdminReviewResponse,
  AdminReviewsQueryParams,
  ModerateReviewRequest,
} from '@/types/admin-review';
import type { PageResponse } from '@/types/api';

/**
 * Hook to fetch paginated admin reviews with filters and search
 */
export function useAdminReviews(params?: AdminReviewsQueryParams) {
  return useQuery<PageResponse<AdminReviewResponse>, Error>({
    queryKey: adminReviewKeys.list(params),
    queryFn: () => adminReviewsApi.getAdminReviews(params),
    placeholderData: (previousData) => previousData,
    staleTime: 30000,
  });
}

/**
 * Hook to fetch single admin review details by ID
 */
export function useAdminReviewDetail(reviewId: string | null) {
  return useQuery<AdminReviewResponse, Error>({
    queryKey: adminReviewKeys.detail(reviewId ?? ''),
    queryFn: () => {
      if (!reviewId) throw new Error('Review ID is required');
      return adminReviewsApi.getAdminReviewById(reviewId);
    },
    enabled: Boolean(reviewId),
    staleTime: 30000,
  });
}

/**
 * Mutation hook to soft-moderate (hide) a review
 */
export function useModerateReview() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { reviewId: string; payload: ModerateReviewRequest }>({
    mutationFn: ({ reviewId, payload }) => adminReviewsApi.moderateReview(reviewId, payload),
    onSuccess: (_, { reviewId }) => {
      // Invalidate admin review lists and specific review details
      queryClient.invalidateQueries({ queryKey: adminReviewKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminReviewKeys.detail(reviewId) });
      // Invalidate general reviews cache if cached in the application
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

/**
 * Mutation hook to restore a previously hidden review
 */
export function useRestoreReview() {
  const queryClient = useQueryClient();

  return useMutation<AdminReviewResponse, Error, { reviewId: string }>({
    mutationFn: ({ reviewId }) => adminReviewsApi.restoreReview(reviewId),
    onSuccess: (data, { reviewId }) => {
      // Invalidate and update admin review lists and details
      queryClient.invalidateQueries({ queryKey: adminReviewKeys.lists() });
      queryClient.setQueryData(adminReviewKeys.detail(reviewId), data);
      // Invalidate general reviews and rating summaries
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}
