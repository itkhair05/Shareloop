import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileApi } from '../api/profile-api';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type { UserProfile } from '@/types/auth';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    put: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('profileApi avatar operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUpdatedProfile: UserProfile = {
    id: 'user-uuid-1',
    displayName: 'Nguyễn Văn Minh',
    email: 'minh.nguyen@shareloop.org',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-03-15T08:30:00Z',
    updatedAt: '2026-10-31T10:00:00Z',
    avatarUrl: '/api/v1/files/avatars/user-uuid-1.jpg',
    customAvatarUrl: '/api/v1/files/avatars/user-uuid-1.jpg',
    googleAvatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar-test',
  };

  describe('uploadAvatar', () => {
    it('sends FormData with field name "file" via PUT /api/v1/auth/me/avatar', async () => {
      vi.mocked(apiClient.put).mockResolvedValueOnce(mockUpdatedProfile);

      const fakeFile = new File(['test image content'], 'avatar.jpg', { type: 'image/jpeg' });
      const result = await profileApi.uploadAvatar(fakeFile);

      expect(apiClient.put).toHaveBeenCalledTimes(1);
      const [url, formData] = vi.mocked(apiClient.put).mock.calls[0];
      expect(url).toBe('/api/v1/auth/me/avatar');
      expect(formData).toBeInstanceOf(FormData);
      expect((formData as FormData).get('file')).toEqual(fakeFile);
      expect(result).toEqual(mockUpdatedProfile);
    });

    it('propagates ApiError when upload fails', async () => {
      const error = new ApiError({
        message: 'Invalid file format',
        status: 400,
        error: 'Bad Request',
      });
      vi.mocked(apiClient.put).mockRejectedValueOnce(error);

      const fakeFile = new File(['bad content'], 'avatar.txt', { type: 'text/plain' });
      await expect(profileApi.uploadAvatar(fakeFile)).rejects.toThrow('Invalid file format');
    });
  });

  describe('deleteAvatar', () => {
    it('calls DELETE /api/v1/auth/me/avatar without payload', async () => {
      const profileAfterDelete: UserProfile = {
        ...mockUpdatedProfile,
        customAvatarUrl: null,
        avatarUrl: mockUpdatedProfile.googleAvatarUrl,
      };
      vi.mocked(apiClient.delete).mockResolvedValueOnce(profileAfterDelete);

      const result = await profileApi.deleteAvatar();

      expect(apiClient.delete).toHaveBeenCalledTimes(1);
      expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/auth/me/avatar');
      expect(result).toEqual(profileAfterDelete);
      expect(result.customAvatarUrl).toBeNull();
      expect(result.avatarUrl).toBe('https://lh3.googleusercontent.com/a/google-avatar-test');
    });

    it('propagates ApiError when delete fails', async () => {
      const error = new ApiError({
        message: 'Internal server error',
        status: 500,
        error: 'Server Error',
      });
      vi.mocked(apiClient.delete).mockRejectedValueOnce(error);

      await expect(profileApi.deleteAvatar()).rejects.toThrow('Internal server error');
    });
  });
});
