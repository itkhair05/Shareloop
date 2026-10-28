import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminSupportPage } from '../AdminSupportPage';
import { adminSupportApi } from '../api/admin-support-api';
import { renderWithProviders } from '@/test/test-utils';
import type { AdminSupportRequestResponse } from '@/types/admin-support';
import type { PageResponse } from '@/types/api';

vi.mock('../api/admin-support-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin-support-api')>();
  return {
    ...actual,
    adminSupportApi: {
      ...actual.adminSupportApi,
      getAdminSupportRequests: vi.fn(),
      getAdminSupportRequestById: vi.fn(),
      updateSupportRequestAdmin: vi.fn(),
    },
  };
});

const mockSupportReq1: AdminSupportRequestResponse = {
  id: 'sup-1',
  requesterId: 'user-alice',
  requesterDisplayName: 'Alice Nguyễn',
  requesterEmail: 'alice@example.com',
  transactionId: 'tx-123456',
  category: 'TRANSACTION_ISSUE',
  subject: 'Không thể liên lạc với đối tác nhận đồ',
  description: 'Tôi đã đợi tại điểm hẹn 30 phút nhưng đối tác không tới và không nghe máy.',
  status: 'PENDING',
  adminResponse: null,
  adminNotes: null,
  resolvedById: null,
  resolvedByDisplayName: null,
  resolvedAt: null,
  createdAt: '2026-10-25T08:00:00Z',
  updatedAt: '2026-10-25T08:00:00Z',
};

const mockResolvedReq: AdminSupportRequestResponse = {
  id: 'sup-2',
  requesterId: 'user-bob',
  requesterDisplayName: 'Bob Trần',
  requesterEmail: 'bob@example.com',
  transactionId: null,
  category: 'ACCOUNT_ISSUE',
  subject: 'Yêu cầu hỗ trợ đổi mật khẩu tài khoản',
  description: 'Tôi không nhận được email đặt lại mật khẩu.',
  status: 'RESOLVED',
  adminResponse: 'Ban quản trị đã gửi lại liên kết xác thực vào email của bạn.',
  adminNotes: 'Đã xác minh số điện thoại chính chủ qua SMS và kích hoạt lại token.',
  resolvedById: 'admin-dave',
  resolvedByDisplayName: 'Dave Admin',
  resolvedAt: '2026-10-26T10:00:00Z',
  createdAt: '2026-10-25T09:00:00Z',
  updatedAt: '2026-10-26T10:00:00Z',
};

const mockPageResponse: PageResponse<AdminSupportRequestResponse> = {
  content: [mockSupportReq1, mockResolvedReq],
  totalElements: 2,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

describe('AdminSupportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminSupportApi.getAdminSupportRequests).mockResolvedValue(mockPageResponse);
    vi.mocked(adminSupportApi.getAdminSupportRequestById).mockImplementation((id) => {
      if (id === 'sup-1') return Promise.resolve(mockSupportReq1);
      if (id === 'sup-2') return Promise.resolve(mockResolvedReq);
      return Promise.reject(new Error('Support request not found'));
    });
  });

  it('renders page header and list with requester info, status, and category', async () => {
    renderWithProviders(<AdminSupportPage />);

    expect(screen.getByText('Quản lý yêu cầu hỗ trợ')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Không thể liên lạc với đối tác nhận đồ')).toBeInTheDocument();
      expect(screen.getByText('Yêu cầu hỗ trợ đổi mật khẩu tài khoản')).toBeInTheDocument();
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
      expect(screen.getByText('Bob Trần')).toBeInTheDocument();
      expect(screen.getByText('Sự cố giao dịch')).toBeInTheDocument();
      expect(screen.getByText('Vấn đề tài khoản')).toBeInTheDocument();
      expect(screen.getByText('Chờ xử lý')).toBeInTheDocument();
      expect(screen.getByText('Đã giải quyết')).toBeInTheDocument();
      expect(screen.getByText('Dave Admin')).toBeInTheDocument();
    });

    expect(adminSupportApi.getAdminSupportRequests).toHaveBeenCalled();
  });

  it('filters requests by status and triggers API with status param', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Trạng thái yêu cầu');
    await user.selectOptions(statusSelect, 'PENDING');

    await waitFor(() => {
      expect(adminSupportApi.getAdminSupportRequests).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING',
          page: 0,
        })
      );
    });
  });

  it('filters requests by category and resets pagination to page 0', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText('Danh mục sự cố');
    await user.selectOptions(categorySelect, 'SAFETY_CONCERN');

    await waitFor(() => {
      expect(adminSupportApi.getAdminSupportRequests).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'SAFETY_CONCERN',
          page: 0,
        })
      );
    });
  });

  it('opens detail modal and displays confidential internal notes, public response, and requester email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Bob Trần')).toBeInTheDocument();
    });

    // Click "Xem hồ sơ" for sup-2
    const detailButtons = screen.getAllByRole('button', { name: /Xem hồ sơ/i });
    await user.click(detailButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Chi tiết yêu cầu hỗ trợ')).toBeInTheDocument();
      expect(screen.getByText(/Ghi chú xử lý nội bộ \(Bảo mật\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Dành riêng cho Quản trị viên/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Đã xác minh số điện thoại chính chủ qua SMS/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Ban quản trị đã gửi lại liên kết xác thực vào email của bạn/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText(/bob@example.com/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opens update dialog, submits valid status update, response and internal notes', async () => {
    const user = userEvent.setup();
    vi.mocked(adminSupportApi.updateSupportRequestAdmin).mockResolvedValue({
      ...mockSupportReq1,
      status: 'IN_PROGRESS',
      adminResponse: 'Đang liên hệ với bên đối tác để hỗ trợ bạn.',
      adminNotes: 'Đã gửi cảnh báo tài khoản đối tác qua số hotline.',
    });

    renderWithProviders(<AdminSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
    });

    // Click "Xử lý" for sup-1
    const processButtons = screen.getAllByRole('button', { name: /^Xử lý$/i });
    await user.click(processButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Xử lý yêu cầu hỗ trợ')).toBeInTheDocument();
    });

    const selectStatus = screen.getByLabelText(/Trạng thái xử lý/i);
    await user.selectOptions(selectStatus, 'IN_PROGRESS');

    const responseInput = screen.getByPlaceholderText(/Nhập nội dung giải đáp hoặc hướng dẫn dành cho người dùng/i);
    await user.type(responseInput, 'Đang liên hệ với bên đối tác để hỗ trợ bạn.');

    const notesInput = screen.getByPlaceholderText(/Ghi chú nghiệp vụ, đối soát lịch sử/i);
    await user.type(notesInput, 'Đã gửi cảnh báo tài khoản đối tác qua số hotline.');

    const saveBtn = screen.getByRole('button', { name: /Lưu cập nhật/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(adminSupportApi.updateSupportRequestAdmin).toHaveBeenCalledWith('sup-1', {
        status: 'IN_PROGRESS',
        adminResponse: 'Đang liên hệ với bên đối tác để hỗ trợ bạn.',
        adminNotes: 'Đã gửi cảnh báo tài khoản đối tác qua số hotline.',
      });
    });
  });

  it('displays reopening notice when changing resolved request to in-progress', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Bob Trần')).toBeInTheDocument();
    });

    // Click "Xử lý" for sup-2 (which is RESOLVED)
    const processButtons = screen.getAllByRole('button', { name: /^Xử lý$/i });
    await user.click(processButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Xử lý yêu cầu hỗ trợ')).toBeInTheDocument();
    });

    const selectStatus = screen.getByLabelText(/Trạng thái xử lý/i);
    await user.selectOptions(selectStatus, 'IN_PROGRESS');

    await waitFor(() => {
      expect(
        screen.getByText(/Chuyển trạng thái từ Đã giải quyết \/ Đã đóng về Chờ xử lý hoặc Đang xử lý sẽ xóa thông tin người giải quyết/i)
      ).toBeInTheDocument();
    });
  });

  it('renders empty state when no support requests exist', async () => {
    vi.mocked(adminSupportApi.getAdminSupportRequests).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: true,
    });

    renderWithProviders(<AdminSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy yêu cầu hỗ trợ nào')).toBeInTheDocument();
    });
  });

  it('renders error state with retry action when API call fails', async () => {
    vi.mocked(adminSupportApi.getAdminSupportRequests).mockRejectedValueOnce(
      new Error('Lỗi máy chủ 500')
    );

    renderWithProviders(<AdminSupportPage />);

    await waitFor(() => {
      expect(screen.getByText('Không thể tải danh sách yêu cầu hỗ trợ')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
    });

    vi.mocked(adminSupportApi.getAdminSupportRequests).mockResolvedValueOnce(mockPageResponse);
    const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
    await userEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument();
    });
  });
});
