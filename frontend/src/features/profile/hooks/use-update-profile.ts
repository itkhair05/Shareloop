import { useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../api/profile-api';
import { useAuth } from '@/features/auth';
import type { UpdateProfileRequest, UserProfile } from '@/types/auth';
import type { ApiError } from '@/lib/api-error';

/**
 * Mutation hook for updating the authenticated user's profile.
 * On success, invokes refreshUser() to synchronize auth context and invalidates user queries.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();

  return useMutation<UserProfile, ApiError, UpdateProfileRequest>({
    mutationFn: (payload: UpdateProfileRequest) => profileApi.updateProfile(payload),
    onSuccess: async (updatedUser) => {
      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ['users', updatedUser.id] });
    },
  });
}

export default useUpdateProfile;
