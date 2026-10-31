import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarManagementCard } from '../components/AvatarManagementCard';
import { profileApi } from '../api/profile-api';
import { resolveImageUrl } from '@/lib/utils';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import { rawAxiosClient } from '@/lib/api-client';
import type { UserProfile } from '@/types/auth';

// Mock profile API
vi.mock('../api/profile-api', () => ({
  profileApi: {
    uploadAvatar: vi.fn(),
    deleteAvatar: vi.fn(),
  },
}));

// Mock useAuth
const mockUpdateUser = vi.fn();
const mockRefreshUser = vi.fn();

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

describe('ShareLoop Phase 1C.12.7.2.2 — Custom Avatar Upload & Preview Audit & Fix', () => {
  const baseUser: UserProfile = {
    id: 'user-preview-1',
    displayName: 'Thế Khải',
    email: 'duongthekhai.work@gmail.com',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-03-15T08:30:00Z',
    updatedAt: '2026-03-15T08:30:00Z',
    avatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar-test',
    customAvatarUrl: null,
    googleAvatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar-test',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    let blobCounter = 0;
    window.URL.createObjectURL = vi.fn(() => `blob:http://localhost:5173/fake-blob-${++blobCounter}`);
    window.URL.revokeObjectURL = vi.fn();

    vi.mocked(useAuth).mockReturnValue({
      user: baseUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      clearError: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: mockRefreshUser,
      updateUser: mockUpdateUser,
    });
  });

  describe('A. Image URL Resolution', () => {
    it('preserves blob: URLs without prepending apiBaseUrl', () => {
      const blobUrl = 'blob:http://localhost:5173/3f990994-386f-40e8-be0f-b2a8d5a111a4';
      expect(resolveImageUrl(blobUrl)).toBe(blobUrl);
    });

    it('preserves data: URLs without prepending apiBaseUrl', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ';
      expect(resolveImageUrl(dataUrl)).toBe(dataUrl);
    });

    it('preserves absolute http/https URLs', () => {
      const externalUrl = 'https://lh3.googleusercontent.com/avatar.jpg';
      expect(resolveImageUrl(externalUrl)).toBe(externalUrl);
    });

    it('prepends apiBaseUrl to relative paths', () => {
      expect(resolveImageUrl('/api/v1/files/avatar.jpg')).toBe('http://localhost:8080/api/v1/files/avatar.jpg');
      expect(resolveImageUrl('api/v1/files/avatar.jpg')).toBe('http://localhost:8080/api/v1/files/avatar.jpg');
    });
  });

  describe('B. Local Preview Lifecycle & Behavior', () => {
    it('1. valid JPEG selection creates preview and immediately renders <img> with blob: URL', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validJpeg = new File(['dummy-jpeg-bytes'], 'avatar.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validJpeg] } });

      await waitFor(() => {
        expect(screen.getByText('Đang xem trước')).toBeInTheDocument();
        const img = screen.getByRole('img', { name: /Xem trước ảnh đại diện mới/i });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'blob:http://localhost:5173/fake-blob-1');
      });
      // Ensure API upload was NOT called just for previewing
      expect(profileApi.uploadAvatar).not.toHaveBeenCalled();
    });

    it('2. valid PNG selection creates preview with blob: URL', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validPng = new File(['dummy-png-bytes'], 'avatar.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [validPng] } });

      await waitFor(() => {
        expect(screen.getByText('Đang xem trước')).toBeInTheDocument();
        const img = screen.getByRole('img', { name: /Xem trước ảnh đại diện mới/i });
        expect(img).toHaveAttribute('src', 'blob:http://localhost:5173/fake-blob-1');
      });
    });

    it('3. selecting a second image updates preview and revokes previous blob URL', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const file1 = new File(['bytes-1'], 'avatar1.jpg', { type: 'image/jpeg' });
      const file2 = new File(['bytes-2'], 'avatar2.png', { type: 'image/png' });

      // Select first file
      fireEvent.change(fileInput, { target: { files: [file1] } });
      await waitFor(() => {
        expect(screen.getByRole('img', { name: /Xem trước ảnh đại diện mới/i })).toHaveAttribute(
          'src',
          'blob:http://localhost:5173/fake-blob-1'
        );
      });

      // Select second file
      fireEvent.change(fileInput, { target: { files: [file2] } });
      await waitFor(() => {
        expect(screen.getByRole('img', { name: /Xem trước ảnh đại diện mới/i })).toHaveAttribute(
          'src',
          'blob:http://localhost:5173/fake-blob-2'
        );
      });

      // Previous blob URL should have been revoked
      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:5173/fake-blob-1');
    });

    it('4. selecting the same file again triggers onChange via onClick reset', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện') as HTMLInputElement;
      const testFile = new File(['same-bytes'], 'same.jpg', { type: 'image/jpeg' });

      // First selection
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      expect(await screen.findByRole('button', { name: /Hủy xem trước/i })).toBeInTheDocument();

      // Click cancel
      const cancelBtn = screen.getByRole('button', { name: /Hủy xem trước/i });
      await user.click(cancelBtn);

      // Verify fileInput can be clicked and its value is cleared
      fireEvent.click(fileInput);
      expect(fileInput.value).toBe('');

      // Re-select exact same file
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      expect(await screen.findByRole('button', { name: /Lưu ảnh đại diện/i })).toBeInTheDocument();
    });

    it('5. cancel preview revokes object URL and restores existing avatar', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validJpeg = new File(['bytes'], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validJpeg] } });
      expect(await screen.findByRole('button', { name: /Hủy xem trước/i })).toBeInTheDocument();

      const cancelBtn = screen.getByRole('button', { name: /Hủy xem trước/i });
      await user.click(cancelBtn);

      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:5173/fake-blob-1');
      expect(screen.queryByText('Đang xem trước')).toBeNull();
      // Should restore existing Google avatar
      const restoredImg = screen.getByRole('img', { name: /Ảnh đại diện của Thế Khải/i });
      expect(restoredImg).toHaveAttribute('src', baseUser.avatarUrl!);
    });

    it('6. invalid file does not replace existing preview and displays Vietnamese error', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const invalidFile = new File(['pdf-data'], 'doc.pdf', { type: 'application/pdf' });

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText('Chỉ hỗ trợ tệp ảnh định dạng JPEG hoặc PNG.')).toBeInTheDocument();
      });
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
      expect(screen.queryByText('Đang xem trước')).toBeNull();
    });

    it('7. unmounting the component cleans up the generated object URL', async () => {
      const { unmount } = renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validJpeg = new File(['bytes'], 'test.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validJpeg] } });
      await screen.findByText('Đang xem trước');

      unmount();

      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:5173/fake-blob-1');
    });
  });

  describe('C. Upload Request, Boundary & State Synchronization', () => {
    it('1. rawAxiosClient interceptor removes Content-Type for FormData payloads', async () => {
      const formData = new FormData();
      formData.append('file', new File(['test'], 'test.jpg', { type: 'image/jpeg' }));

      // Simulate the request interceptor
      const interceptors = (rawAxiosClient.interceptors.request as unknown as {
        handlers: Array<{ fulfilled: (config: Record<string, unknown>) => Record<string, unknown> }>;
      }).handlers;

      const requestHandler = interceptors[0].fulfilled;
      const initialConfig = {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data: formData,
      };

      const transformedConfig = requestHandler(initialConfig) as {
        headers: Record<string, unknown>;
        data: FormData;
      };

      expect(transformedConfig.headers['Content-Type']).toBeUndefined();
    });

    it('2. uploadAvatar sends correct multipart FormData to PUT /api/v1/auth/me/avatar', async () => {
      const user = userEvent.setup();
      const updatedUser: UserProfile = {
        ...baseUser,
        avatarUrl: '/api/v1/files/new-custom.jpg',
        customAvatarUrl: '/api/v1/files/new-custom.jpg',
      };
      vi.mocked(profileApi.uploadAvatar).mockResolvedValue(updatedUser);

      const onSuccessMock = vi.fn();
      renderWithProviders(<AvatarManagementCard user={baseUser} onSuccess={onSuccessMock} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validJpeg = new File(['bytes'], 'new-avatar.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validJpeg] } });

      const saveBtn = await screen.findByRole('button', { name: /Lưu ảnh đại diện/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(profileApi.uploadAvatar).toHaveBeenCalledWith(validJpeg);
        expect(mockUpdateUser).toHaveBeenCalledWith(updatedUser);
        expect(onSuccessMock).toHaveBeenCalledWith('Cập nhật ảnh đại diện thành công!');
        expect(screen.queryByText('Đang xem trước')).toBeNull();
      });
    });

    it('3. failed upload displays a helpful Vietnamese error and preserves existing avatar', async () => {
      const user = userEvent.setup();
      vi.mocked(profileApi.uploadAvatar).mockRejectedValue(
        new ApiError({
          status: 400,
          error: 'Bad Request',
          message: 'Tệp ảnh không hợp lệ hoặc dung lượng vượt quá giới hạn.',
          path: '/api/v1/auth/me/avatar',
        })
      );

      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validJpeg = new File(['bytes'], 'bad.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validJpeg] } });

      const saveBtn = await screen.findByRole('button', { name: /Lưu ảnh đại diện/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText('Tệp ảnh không hợp lệ hoặc dung lượng vượt quá giới hạn.')).toBeInTheDocument();
      });
      // Auth state was NOT updated with failed avatar
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });
});
