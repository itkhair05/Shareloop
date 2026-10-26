import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditProfileModal } from '../components/EditProfileModal';
import { profileApi } from '../api/profile-api';
import { renderWithProviders, createTestQueryClient } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import type { UserProfile } from '@/types/auth';

// Mock profileApi
vi.mock('../api/profile-api', () => ({
  profileApi: {
    updateProfile: vi.fn(),
  },
}));

// Mock useAuth refreshUser
const mockRefreshUser = vi.fn().mockResolvedValue(null);
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isLoading: false,
    refreshUser: mockRefreshUser,
  }),
}));

const mockUser: UserProfile = {
  id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  displayName: 'Nguyễn Văn Minh',
  email: 'minh.nguyen@shareloop.org',
  phoneNumber: '+84912345678',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-03-15T08:30:00Z',
  updatedAt: '2026-03-15T08:30:00Z',
};

describe('EditProfileModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with pre-populated values and read-only email', () => {
    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByRole('dialog', { name: /Chỉnh sửa hồ sơ/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Tên hiển thị/i)).toHaveValue('Nguyễn Văn Minh');
    expect(screen.getByLabelText(/Số điện thoại/i)).toHaveValue('+84912345678');
    expect(screen.getByLabelText(/Địa chỉ email/i)).toHaveValue('minh.nguyen@shareloop.org');
    expect(screen.getByLabelText(/Địa chỉ email/i)).toHaveAttribute('readonly');
  });

  it('disables save button when no fields are modified (not dirty)', () => {
    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });
    expect(submitBtn).toBeDisabled();
  });

  it('validates required and minimum length for display name in Vietnamese', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByLabelText(/Tên hiển thị/i);
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });

    // Clear name
    await user.clear(nameInput);
    expect(submitBtn).not.toBeDisabled();
    await user.click(submitBtn);

    expect(screen.getByText('Tên hiển thị không được để trống')).toBeInTheDocument();
    expect(profileApi.updateProfile).not.toHaveBeenCalled();

    // Type 1 character (< 2)
    await user.type(nameInput, 'A');
    await user.click(submitBtn);

    expect(screen.getByText('Tên hiển thị phải có ít nhất 2 ký tự')).toBeInTheDocument();
    expect(profileApi.updateProfile).not.toHaveBeenCalled();
  });

  it('rejects invalid phone numbers matching backend constraints (starts with 0 or letters)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    const phoneInput = screen.getByLabelText(/Số điện thoại/i);
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });

    // Local 0-prefixed number is NOT accepted by backend regex ^\+?[1-9]\d{1,14}$
    await user.clear(phoneInput);
    await user.type(phoneInput, '0912345678');
    await user.click(submitBtn);

    expect(
      screen.getByText(/Số điện thoại phải theo định dạng quốc tế/i)
    ).toBeInTheDocument();
    expect(profileApi.updateProfile).not.toHaveBeenCalled();
  });

  it('submits valid updates with correct payload and refreshes user', async () => {
    const user = userEvent.setup();
    const updatedUser: UserProfile = {
      ...mockUser,
      displayName: 'Nguyễn Văn Minh An',
      phoneNumber: '+84987654321',
      updatedAt: '2026-10-27T10:00:00Z',
    };
    vi.mocked(profileApi.updateProfile).mockResolvedValueOnce(updatedUser);

    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByLabelText(/Tên hiển thị/i);
    const phoneInput = screen.getByLabelText(/Số điện thoại/i);
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });

    await user.clear(nameInput);
    await user.type(nameInput, 'Nguyễn Văn Minh An');
    await user.clear(phoneInput);
    await user.type(phoneInput, '+84987654321');

    await user.click(submitBtn);

    await waitFor(() => {
      expect(profileApi.updateProfile).toHaveBeenCalledWith({
        displayName: 'Nguyễn Văn Minh An',
        phoneNumber: '+84987654321',
      });
    });

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalledWith(updatedUser);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('normalizes empty or whitespace phone number to null', async () => {
    const user = userEvent.setup();
    const updatedUser: UserProfile = {
      ...mockUser,
      displayName: 'Nguyễn Văn Minh',
      phoneNumber: null,
    };
    vi.mocked(profileApi.updateProfile).mockResolvedValueOnce(updatedUser);

    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    const phoneInput = screen.getByLabelText(/Số điện thoại/i);
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });

    await user.clear(phoneInput);
    await user.type(phoneInput, '   '); // Whitespace-only

    await user.click(submitBtn);

    await waitFor(() => {
      expect(profileApi.updateProfile).toHaveBeenCalledWith({
        displayName: 'Nguyễn Văn Minh',
        phoneNumber: null,
      });
    });
  });

  it('displays API validation errors and preserves user input on failure', async () => {
    const user = userEvent.setup();
    const apiError = new ApiError({
      message: 'Validation failed for request object',
      status: 400,
      error: 'Bad Request',
      fieldErrors: {
        phoneNumber: 'Phone number format is invalid on server',
      },
    });
    vi.mocked(profileApi.updateProfile).mockRejectedValueOnce(apiError);

    const queryClient = createTestQueryClient();
    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />,
      { queryClient }
    );

    const nameInput = screen.getByLabelText(/Tên hiển thị/i);
    const phoneInput = screen.getByLabelText(/Số điện thoại/i);
    const submitBtn = screen.getByRole('button', { name: /Lưu thay đổi/i });

    await user.clear(nameInput);
    await user.type(nameInput, 'Tên Đã Thay Đổi');
    await user.clear(phoneInput);
    await user.type(phoneInput, '+84912345679');

    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Phone number format is invalid on server')).toBeInTheDocument();
    });

    // Inputs are preserved
    expect(nameInput).toHaveValue('Tên Đã Thay Đổi');
    expect(phoneInput).toHaveValue('+84912345679');
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('cancels without submitting when clicking Hủy button or Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <EditProfileModal
        isOpen={true}
        onClose={mockOnClose}
        user={mockUser}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /Hủy/i });
    await user.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(profileApi.updateProfile).not.toHaveBeenCalled();

    // Trigger escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
