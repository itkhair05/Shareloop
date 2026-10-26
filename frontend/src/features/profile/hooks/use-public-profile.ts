import { useQuery } from '@tanstack/react-query';
import { profileApi, profileKeys } from '../api/profile-api';
import { isValidUuid } from '@/lib/utils';
import type { PageResponse } from '@/types/api';
import type { PublicUserProfile } from '@/types/auth';
import type { ListingSummaryResponse } from '@/types/listing';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve public user profile by userId.
 * Only initiates network request when userId is a valid UUID format.
 */
export function usePublicUserProfile(userId?: string) {
  const isIdValid = Boolean(userId && isValidUuid(userId));

  return useQuery<PublicUserProfile, ApiError>({
    queryKey: profileKeys.publicProfile(userId || ''),
    queryFn: () => profileApi.getPublicUserProfile(userId!),
    enabled: isIdValid,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to retrieve paginated public ACTIVE listings owned by a user.
 * Only initiates network request when userId is a valid UUID format.
 */
export function useUserActiveListings(
  userId?: string,
  params?: { page?: number; size?: number }
) {
  const isIdValid = Boolean(userId && isValidUuid(userId));

  return useQuery<PageResponse<ListingSummaryResponse>, ApiError>({
    queryKey: profileKeys.activeListings(userId || '', params),
    queryFn: () => profileApi.getUserActiveListings(userId!, params),
    enabled: isIdValid,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
