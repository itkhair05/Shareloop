import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type { PublicUserProfile, UpdateProfileRequest, UserProfile } from '@/types/auth';
import type { ListingSummaryResponse } from '@/types/listing';

/**
 * Profile API service
 * Handles profile retrieval, public profiles, active listings, and updates.
 */
export const profileApi = {
  /**
   * Update the authenticated user's profile
   * PUT /api/v1/auth/me
   */
  async updateProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
    return apiClient.put<UserProfile, UpdateProfileRequest>('/api/v1/auth/me', payload);
  },

  /**
   * Upload or replace custom avatar for the authenticated user
   * PUT /api/v1/auth/me/avatar
   */
  async uploadAvatar(file: File): Promise<UserProfile> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.put<UserProfile, FormData>('/api/v1/auth/me/avatar', formData);
  },

  /**
   * Delete custom avatar for the authenticated user
   * DELETE /api/v1/auth/me/avatar
   */
  async deleteAvatar(): Promise<UserProfile> {
    return apiClient.delete<UserProfile>('/api/v1/auth/me/avatar');
  },

  /**
   * Retrieve public user profile by userId
   * GET /api/v1/users/{userId}
   */
  async getPublicUserProfile(userId: string): Promise<PublicUserProfile> {
    return apiClient.get<PublicUserProfile>(`/api/v1/users/${encodeURIComponent(userId)}`);
  },

  /**
   * Retrieve public ACTIVE listings owned by a user
   * GET /api/v1/users/{userId}/listings
   */
  async getUserActiveListings(
    userId: string,
    params?: { page?: number; size?: number }
  ): Promise<PageResponse<ListingSummaryResponse>> {
    return apiClient.get<PageResponse<ListingSummaryResponse>>(
      `/api/v1/users/${encodeURIComponent(userId)}/listings`,
      { params }
    );
  },
};

/**
 * Stable query key factories for User Profile data
 */
export const profileKeys = {
  all: ['users'] as const,
  publicProfile: (userId: string) => [...profileKeys.all, 'public-profile', userId] as const,
  activeListings: (userId: string, params?: { page?: number; size?: number }) =>
    [...profileKeys.all, 'active-listings', userId, params] as const,
};

export default profileApi;
