import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminReportsPage } from '../AdminReportsPage';
import { adminReportsApi } from '../api/admin-reports-api';
import { renderWithProviders } from '@/test/test-utils';
import type { AdminReportResponse } from '@/types/admin-report';
import type { PageResponse } from '@/types/api';

vi.mock('../api/admin-reports-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/admin-reports-api')>();
  return {
    ...actual,
    adminReportsApi: {
      ...actual.adminReportsApi,
      getAdminReports: vi.fn(),
      getAdminReportById: vi.fn(),
      updateReportAdmin: vi.fn(),
    },
  };
});

const mockReport1: AdminReportResponse = {
  id: 'rep-1',
  reporterId: 'user-reporter',
  reporterDisplayName: 'Nguyễn Văn Báo Cáo',
  reporterEmail: 'reporter@example.com',
  targetType: 'REVIEW',
  targetId: 'rev-target-123',
  category: 'HARASSMENT',
  description: 'Đánh giá này chứa ngôn từ xúc phạm cá nhân thô tục.',
  status: 'PENDING',
  resolutionNotes: null,
  resolvedById: null,
  resolvedByDisplayName: null,
  resolvedAt: null,
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-20T08:00:00Z',
};

const mockResolvedReport: AdminReportResponse = {
  id: 'rep-2',
  reporterId: 'user-reporter-2',
  reporterDisplayName: 'Trần Thị Khiếu Nại',
  reporterEmail: 'complaint@example.com',
  targetType: 'USER',
  targetId: 'user-scammer-456',
  category: 'FRAUD_OR_SCAM',
  description: 'Người dùng yêu cầu chuyển tiền cọc ngoài ứng dụng.',
  status: 'RESOLVED',
  resolutionNotes: 'Đã xác minh bằng chứng chat và tiến hành cảnh cáo tài khoản.',
  resolvedById: 'admin-1',
  resolvedByDisplayName: 'Admin Quản Trị Viên',
  resolvedAt: '2026-10-21T10:00:00Z',
  createdAt: '2026-10-20T09:00:00Z',
  updatedAt: '2026-10-21T10:00:00Z',
};

const mockPageResponse: PageResponse<AdminReportResponse> = {
  content: [mockReport1, mockResolvedReport],
  totalElements: 2,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminReportsApi.getAdminReports).mockResolvedValue(mockPageResponse);
    vi.mocked(adminReportsApi.getAdminReportById).mockImplementation((id) => {
      if (id === 'rep-1') return Promise.resolve(mockReport1);
      if (id === 'rep-2') return Promise.resolve(mockResolvedReport);
      return Promise.reject(new Error('Report not found'));
    });
  });

  it('renders reports list with status, target badges, and reporter info', async () => {
    renderWithProviders(<AdminReportsPage />);

    expect(screen.getByText('Quản lý báo cáo vi phạm')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Báo Cáo')).toBeInTheDocument();
      expect(screen.getByText('Trần Thị Khiếu Nại')).toBeInTheDocument();
      expect(screen.getByText('Chờ xử lý')).toBeInTheDocument();
      expect(screen.getByText('Đã giải quyết')).toBeInTheDocument();
    });

    expect(adminReportsApi.getAdminReports).toHaveBeenCalled();
  });

  it('filters reports by status and triggers API with status param', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Báo Cáo')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText('Trạng thái hồ sơ');
    await user.selectOptions(statusSelect, 'PENDING');

    await waitFor(() => {
      expect(adminReportsApi.getAdminReports).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING',
        })
      );
    });
  });

  it('opens report detail modal with confidential internal staff notes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Trần Thị Khiếu Nại')).toBeInTheDocument();
    });

    const detailButtons = screen.getAllByRole('button', { name: /Xem hồ sơ/i });
    await user.click(detailButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Hồ sơ báo cáo vi phạm')).toBeInTheDocument();
      expect(screen.getByText('Ghi chú xử lý nội bộ (Dành riêng cho Quản trị viên)')).toBeInTheDocument();
      expect(screen.getByText(/Đã xác minh bằng chứng chat và tiến hành cảnh cáo tài khoản/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Admin Quản Trị Viên/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('opens status transition dialog and submits valid status update payload', async () => {
    const user = userEvent.setup();
    vi.mocked(adminReportsApi.updateReportAdmin).mockResolvedValue({
      ...mockReport1,
      status: 'INVESTIGATING',
      resolutionNotes: 'Bắt đầu đối soát tin nhắn',
    });

    renderWithProviders(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Báo Cáo')).toBeInTheDocument();
    });

    const processButtons = screen.getAllByRole('button', { name: /^Xử lý$/i });
    await user.click(processButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Chuyển trạng thái xử lý báo cáo')).toBeInTheDocument();
    });

    const selectStatus = screen.getByLabelText(/Chọn trạng thái mới/i);
    await user.selectOptions(selectStatus, 'INVESTIGATING');

    const notesInput = screen.getByLabelText(/Ghi chú xử lý nội bộ/i);
    await user.type(notesInput, 'Bắt đầu đối soát tin nhắn');

    const saveBtn = screen.getByRole('button', { name: /Lưu thay đổi trạng thái/i });
    await user.click(saveBtn);

    await waitFor(() => {
      expect(adminReportsApi.updateReportAdmin).toHaveBeenCalledWith('rep-1', {
        status: 'INVESTIGATING',
        resolutionNotes: 'Bắt đầu đối soát tin nhắn',
      });
    });
  });

  it('renders review target link and allows cross-inspecting review details without changing report state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminReportsPage />);

    await waitFor(() => {
      expect(screen.getByText('Nguyễn Văn Báo Cáo')).toBeInTheDocument();
    });

    // Open detail of rep-1 (targetType: REVIEW, targetId: rev-target-123)
    const detailButtons = screen.getAllByRole('button', { name: /Xem hồ sơ/i });
    await user.click(detailButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Xem và kiểm duyệt đánh giá này')).toBeInTheDocument();
    });

    // Click link to inspect review
    const inspectReviewBtn = screen.getByRole('button', { name: /Xem và kiểm duyệt đánh giá này/i });
    await user.click(inspectReviewBtn);

    await waitFor(() => {
      expect(screen.getByText('Chi tiết đánh giá giao dịch')).toBeInTheDocument();
    });
  });
});
