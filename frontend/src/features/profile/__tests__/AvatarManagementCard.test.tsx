import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarManagementCard } from '../components/AvatarManagementCard';
import { profileApi } from '../api/profile-api';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
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

describe('AvatarManagementCard Component', () => {
  const baseUser: UserProfile = {
    id: 'user-uuid-1',
    displayName: 'Nguyễn Văn Minh',
    email: 'minh.nguyen@shareloop.org',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-03-15T08:30:00Z',
    updatedAt: '2026-03-15T08:30:00Z',
    avatarUrl: null,
    customAvatarUrl: null,
    googleAvatarUrl: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock URL.createObjectURL and URL.revokeObjectURL
    window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake-preview-url');
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

  describe('Avatar Display & Status Texts', () => {
    it('1 & 4. displays custom avatar and correct status text when custom avatar is active', () => {
      const userWithCustom: UserProfile = {
        ...baseUser,
        avatarUrl: '/api/v1/files/avatars/custom.jpg',
        customAvatarUrl: '/api/v1/files/avatars/custom.jpg',
        googleAvatarUrl: 'https://lh3.googleusercontent.com/a/google-photo',
      };

      renderWithProviders(<AvatarManagementCard user={userWithCustom} />);

      expect(screen.getByText('Ảnh tùy chỉnh')).toBeInTheDocument();
      expect(screen.getByText('Ảnh đại diện tùy chỉnh đang hoạt động')).toBeInTheDocument();

      const img = screen.getByRole('img', { name: /Ảnh đại diện của Nguyễn Văn Minh/i });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'http://localhost:8080/api/v1/files/avatars/custom.jpg');
    });

    it('2 & 5. displays Google avatar and correct status text when Google fallback is active', () => {
      const userWithGoogle: UserProfile = {
        ...baseUser,
        avatarUrl: 'https://lh3.googleusercontent.com/a/google-photo',
        customAvatarUrl: null,
        googleAvatarUrl: 'https://lh3.googleusercontent.com/a/google-photo',
      };

      renderWithProviders(<AvatarManagementCard user={userWithGoogle} />);

      expect(screen.getByText('Đồng bộ từ Google')).toBeInTheDocument();
      expect(screen.getByText('Đang sử dụng ảnh đại diện từ tài khoản Google')).toBeInTheDocument();

      const img = screen.getByRole('img', { name: /Ảnh đại diện của Nguyễn Văn Minh/i });
      expect(img).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/google-photo');
    });

    it('3 & 6. displays initials fallback and correct status text when neither avatar exists', () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      expect(screen.getByText('Chưa thiết lập')).toBeInTheDocument();
      expect(screen.getByText('Chưa có ảnh đại diện (Hiển thị chữ cái viết tắt)')).toBeInTheDocument();
      expect(screen.getByText('NM')).toBeInTheDocument();
    });

    it('16. does NOT render delete button when user has no custom avatar', () => {
      const userWithGoogleOnly: UserProfile = {
        ...baseUser,
        avatarUrl: 'https://lh3.googleusercontent.com/a/google-photo',
        googleAvatarUrl: 'https://lh3.googleusercontent.com/a/google-photo',
        customAvatarUrl: null,
      };

      renderWithProviders(<AvatarManagementCard user={userWithGoogleOnly} />);

      expect(screen.queryByRole('button', { name: /Xóa ảnh tùy chỉnh/i })).toBeNull();
      expect(screen.getByRole('button', { name: /Tải lên ảnh mới/i })).toBeInTheDocument();
    });

    it('renders delete button when user has an active custom avatar', () => {
      const userWithCustom: UserProfile = {
        ...baseUser,
        avatarUrl: '/api/v1/files/custom.jpg',
        customAvatarUrl: '/api/v1/files/custom.jpg',
      };

      renderWithProviders(<AvatarManagementCard user={userWithCustom} />);

      expect(screen.getByRole('button', { name: /Xóa ảnh tùy chỉnh/i })).toBeInTheDocument();
    });
  });

  describe('File Validation', () => {
    it('7. rejects invalid file MIME type (e.g. PDF or text file)', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const invalidFile = new File(['dummy content'], 'document.pdf', { type: 'application/pdf' });

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText('Chỉ hỗ trợ tệp ảnh định dạng JPEG hoặc PNG.')).toBeInTheDocument();
      });
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('8. rejects file larger than 5 MiB', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      // Create a 6MB dummy file
      const largeFile = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText('Dung lượng ảnh vượt quá giới hạn tối đa 5MB.')).toBeInTheDocument();
      });
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });

    it('rejects empty file (0 bytes)', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [emptyFile] } });

      await waitFor(() => {
        expect(screen.getByText('Tệp ảnh không hợp lệ hoặc rỗng.')).toBeInTheDocument();
      });
      expect(window.URL.createObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('Image Preview & Cancellation', () => {
    it('9 & 10. allows valid JPEG and PNG to be previewed', async () => {
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validJpeg = new File(['valid jpeg'], 'photo.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validJpeg] } });

      await waitFor(() => {
        expect(window.URL.createObjectURL).toHaveBeenCalledWith(validJpeg);
        expect(screen.getByText('Đang xem trước')).toBeInTheDocument();
        expect(screen.getByText('Xem trước ảnh mới được chọn')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Lưu ảnh đại diện/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Hủy xem trước/i })).toBeInTheDocument();
        const img = screen.getByRole('img', { name: /Xem trước ảnh đại diện mới/i });
        expect(img).toHaveAttribute('src', 'blob:http://localhost/fake-preview-url');
      });
    });

    it('11. cancel preview revokes object URL, resets file input, and does not call upload API', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện') as HTMLInputElement;
      const validPng = new File(['valid png'], 'photo.png', { type: 'image/png' });

      fireEvent.change(fileInput, { target: { files: [validPng] } });

      const cancelBtn = await screen.findByRole('button', { name: /Hủy xem trước/i });
      await user.click(cancelBtn);

      expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/fake-preview-url');
      expect(screen.queryByRole('button', { name: /Lưu ảnh đại diện/i })).toBeNull();
      expect(profileApi.uploadAvatar).not.toHaveBeenCalled();
      expect(fileInput.value).toBe('');
    });

    it('18. allows selecting the same file again after cancellation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện') as HTMLInputElement;
      const testFile = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });

      // First selection
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      expect(await screen.findByRole('button', { name: /Hủy xem trước/i })).toBeInTheDocument();

      // Cancel
      const cancelBtn = screen.getByRole('button', { name: /Hủy xem trước/i });
      await user.click(cancelBtn);

      // Re-select exact same file
      fireEvent.change(fileInput, { target: { files: [testFile] } });
      expect(await screen.findByRole('button', { name: /Lưu ảnh đại diện/i })).toBeInTheDocument();
    });
  });

  describe('Upload Flow', () => {
    it('12. successful upload calls API, updates AuthContext, and calls onSuccess', async () => {
      const user = userEvent.setup();
      const onSuccessMock = vi.fn();
      const updatedProfile: UserProfile = {
        ...baseUser,
        avatarUrl: '/api/v1/files/avatars/new-custom.jpg',
        customAvatarUrl: '/api/v1/files/avatars/new-custom.jpg',
      };
      vi.mocked(profileApi.uploadAvatar).mockResolvedValueOnce(updatedProfile);

      renderWithProviders(<AvatarManagementCard user={baseUser} onSuccess={onSuccessMock} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validFile = new File(['valid'], 'new-avatar.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      const saveBtn = await screen.findByRole('button', { name: /Lưu ảnh đại diện/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(profileApi.uploadAvatar).toHaveBeenCalledWith(validFile);
        expect(mockUpdateUser).toHaveBeenCalledWith(updatedProfile);
        expect(onSuccessMock).toHaveBeenCalledWith('Cập nhật ảnh đại diện thành công!');
        expect(window.URL.revokeObjectURL).toHaveBeenCalled();
      });
    });

    it('13. failed upload displays error message and retains previous state', async () => {
      const user = userEvent.setup();
      const error = new ApiError({
        message: 'Tệp ảnh không hợp lệ từ máy chủ',
        status: 400,
        error: 'Bad Request',
      });
      vi.mocked(profileApi.uploadAvatar).mockRejectedValueOnce(error);

      renderWithProviders(<AvatarManagementCard user={baseUser} />);

      const fileInput = screen.getByLabelText('Chọn tệp ảnh đại diện');
      const validFile = new File(['valid'], 'avatar.jpg', { type: 'image/jpeg' });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      const saveBtn = await screen.findByRole('button', { name: /Lưu ảnh đại diện/i });
      await user.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText('Tệp ảnh không hợp lệ từ máy chủ')).toBeInTheDocument();
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  describe('Delete Flow & Fallbacks', () => {
    it('14. successful deletion restores Google avatar when present', async () => {
      const user = userEvent.setup();
      const onSuccessMock = vi.fn();
      const userWithBoth: UserProfile = {
        ...baseUser,
        avatarUrl: '/api/v1/files/avatars/custom.jpg',
        customAvatarUrl: '/api/v1/files/avatars/custom.jpg',
        googleAvatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar',
      };

      const profileAfterDelete: UserProfile = {
        ...userWithBoth,
        customAvatarUrl: null,
        avatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar',
      };
      vi.mocked(profileApi.deleteAvatar).mockResolvedValueOnce(profileAfterDelete);

      renderWithProviders(<AvatarManagementCard user={userWithBoth} onSuccess={onSuccessMock} />);

      // Open confirm dialog
      const deleteBtn = screen.getByRole('button', { name: /Xóa ảnh tùy chỉnh/i });
      await user.click(deleteBtn);

      // Confirm dialog appears
      expect(screen.getByRole('dialog', { name: /Xóa ảnh đại diện tùy chỉnh\?/i })).toBeInTheDocument();
      expect(screen.getByText(/tự động khôi phục và hiển thị ảnh đại diện từ tài khoản Google/i)).toBeInTheDocument();

      // Confirm delete
      const confirmBtn = screen.getByRole('button', { name: /^Xóa ảnh$/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(profileApi.deleteAvatar).toHaveBeenCalledTimes(1);
        expect(mockUpdateUser).toHaveBeenCalledWith(profileAfterDelete);
        expect(onSuccessMock).toHaveBeenCalledWith('Đã xóa ảnh đại diện tùy chỉnh thành công!');
      });
    });

    it('15. successful deletion without Google avatar restores default initials fallback', async () => {
      const user = userEvent.setup();
      const userWithCustomOnly: UserProfile = {
        ...baseUser,
        avatarUrl: '/api/v1/files/avatars/custom.jpg',
        customAvatarUrl: '/api/v1/files/avatars/custom.jpg',
        googleAvatarUrl: null,
      };

      const profileAfterDelete: UserProfile = {
        ...userWithCustomOnly,
        customAvatarUrl: null,
        avatarUrl: null,
      };
      vi.mocked(profileApi.deleteAvatar).mockResolvedValueOnce(profileAfterDelete);

      renderWithProviders(<AvatarManagementCard user={userWithCustomOnly} />);

      const deleteBtn = screen.getByRole('button', { name: /Xóa ảnh tùy chỉnh/i });
      await user.click(deleteBtn);

      expect(screen.getByText(/hiển thị ảnh đại diện mặc định bằng chữ cái viết tắt/i)).toBeInTheDocument();

      const confirmBtn = screen.getByRole('button', { name: /^Xóa ảnh$/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(profileApi.deleteAvatar).toHaveBeenCalledTimes(1);
        expect(mockUpdateUser).toHaveBeenCalledWith(profileAfterDelete);
      });
    });

    it('handles delete failure gracefully with error alert', async () => {
      const user = userEvent.setup();
      const userWithCustom: UserProfile = {
        ...baseUser,
        avatarUrl: '/api/v1/files/avatars/custom.jpg',
        customAvatarUrl: '/api/v1/files/avatars/custom.jpg',
      };
      vi.mocked(profileApi.deleteAvatar).mockRejectedValueOnce(
        new ApiError({ message: 'Không thể xóa ảnh lúc này', status: 500, error: 'Server Error' })
      );

      renderWithProviders(<AvatarManagementCard user={userWithCustom} />);

      const deleteBtn = screen.getByRole('button', { name: /Xóa ảnh tùy chỉnh/i });
      await user.click(deleteBtn);

      const confirmBtn = screen.getByRole('button', { name: /^Xóa ảnh$/i });
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText('Không thể xóa ảnh lúc này')).toBeInTheDocument();
      });
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });
});
