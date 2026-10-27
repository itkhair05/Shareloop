import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import {
  CreateReportModal,
  ReportDetailModal,
  MyReportsList,
} from '../index';
import { reportApi } from '../api/report-api';
import { ApiError } from '@/lib/api-error';
import type { ReportResponse, MyReportsPage } from '@/types/report';

vi.mock('../api/report-api', () => ({
  reportApi: {
    createReport: vi.fn(),
    getMyReports: vi.fn(),
    getReportDetails: vi.fn(),
  },
}));

const mockListingReport: ReportResponse = {
  id: 'rep-1111-2222',
  targetType: 'LISTING',
  targetId: 'listing-abc-123',
  category: 'FRAUD_OR_SCAM',
  description: 'Tin đăng có dấu hiệu lừa đảo yêu cầu chuyển tiền cọc trước khi nhận đồ.',
  status: 'INVESTIGATING',
  createdAt: '2026-10-25T10:00:00Z',
  updatedAt: '2026-10-25T12:00:00Z',
};

const mockUserReport: ReportResponse = {
  id: 'rep-3333-4444',
  targetType: 'USER',
  targetId: 'user-xyz-789',
  category: 'HARASSMENT',
  description: 'Người dùng dùng từ ngữ xúc phạm khi trao đổi qua tin nhắn.',
  status: 'PENDING',
  createdAt: '2026-10-26T15:30:00Z',
  updatedAt: '2026-10-26T15:30:00Z',
};

const mockReportsPage: MyReportsPage = {
  content: [mockListingReport, mockUserReport],
  totalElements: 2,
  totalPages: 1,
  size: 10,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const mockEmptyReportsPage: MyReportsPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 10,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

describe('Violation Reports UI (Báo cáo vi phạm & Quản lý báo cáo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CreateReportModal', () => {
    it('disables submit button until description is provided', () => {
      const onClose = vi.fn();

      renderWithProviders(
        <CreateReportModal
          isOpen={true}
          onClose={onClose}
          targetType="LISTING"
          targetId="listing-abc-123"
          targetTitle="Bàn gỗ học sinh"
        />
      );

      expect(screen.getByRole('dialog', { name: /báo cáo vi phạm/i })).toBeInTheDocument();
      expect(screen.getByText('Bàn gỗ học sinh')).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /gửi báo cáo/i });
      expect(submitBtn).toBeDisabled();
    });

    it('submits report successfully and displays confirmation with report ID', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      vi.mocked(reportApi.createReport).mockResolvedValueOnce(mockListingReport);

      renderWithProviders(
        <CreateReportModal
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          targetType="LISTING"
          targetId="listing-abc-123"
          targetTitle="Bàn gỗ học sinh"
        />
      );

      // Select category
      const categorySelect = screen.getByLabelText(/lý do báo cáo vi phạm/i);
      await user.selectOptions(categorySelect, 'FRAUD_OR_SCAM');

      // Type description
      const descInput = screen.getByLabelText(/mô tả chi tiết bằng chứng/i);
      await user.type(
        descInput,
        'Tin đăng có dấu hiệu lừa đảo yêu cầu chuyển tiền cọc trước khi nhận đồ.'
      );

      // Submit
      const submitBtn = screen.getByRole('button', { name: /gửi báo cáo/i });
      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      await waitFor(() => {
        expect(reportApi.createReport).toHaveBeenCalledWith({
          targetType: 'LISTING',
          targetId: 'listing-abc-123',
          category: 'FRAUD_OR_SCAM',
          description: 'Tin đăng có dấu hiệu lừa đảo yêu cầu chuyển tiền cọc trước khi nhận đồ.',
        });
      });

      // Confirmation screen
      await waitFor(() => {
        expect(screen.getByText(/đã tiếp nhận báo cáo/i)).toBeInTheDocument();
        expect(screen.getByText(/bàn gỗ học sinh/i)).toBeInTheDocument();
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('handles HTTP 409 Conflict duplicate report response with friendly Vietnamese message', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const conflictError = new ApiError({
        message: 'Duplicate active report',
        status: 409,
        error: 'Conflict',
      });
      vi.mocked(reportApi.createReport).mockRejectedValueOnce(conflictError);

      renderWithProviders(
        <CreateReportModal
          isOpen={true}
          onClose={onClose}
          targetType="USER"
          targetId="user-xyz-789"
          targetTitle="Nguyễn Văn A"
        />
      );

      const descInput = screen.getByLabelText(/mô tả chi tiết bằng chứng/i);
      await user.type(descInput, 'Người dùng này liên tục gửi tin nhắn rác quấy rối.');

      const submitBtn = screen.getByRole('button', { name: /gửi báo cáo/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/bạn đã gửi một báo cáo đang chờ xử lý cho người dùng này/i)
        ).toBeInTheDocument();
      });

      // Does not show success screen
      expect(screen.queryByText(/báo cáo đã được tiếp nhận!/i)).not.toBeInTheDocument();
    });
  });

  describe('MyReportsList', () => {
    it('renders list of user reports with target badge, category, and Vietnamese status', async () => {
      vi.mocked(reportApi.getMyReports).mockResolvedValueOnce(mockReportsPage);

      renderWithProviders(<MyReportsList />);

      await waitFor(() => {
        expect(
          screen.getByText(/tin đăng có dấu hiệu lừa đảo yêu cầu chuyển tiền cọc/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/người dùng dùng từ ngữ xúc phạm khi trao đổi/i)
        ).toBeInTheDocument();
      });

      // Check target badges
      expect(screen.getByText('Tin đăng')).toBeInTheDocument();
      expect(screen.getByText('Người dùng')).toBeInTheDocument();

      // Check Vietnamese status badges
      expect(screen.getAllByText('Đang điều tra').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Chờ xử lý').length).toBeGreaterThanOrEqual(1);

      // Check category labels
      expect(screen.getByText(/Lừa đảo \/ Gian lận/i)).toBeInTheDocument();
      expect(screen.getByText(/Quấy rối \/ Khiếm nhã/i)).toBeInTheDocument();
    });

    it('renders empty state when user has no reports', async () => {
      vi.mocked(reportApi.getMyReports).mockResolvedValueOnce(mockEmptyReportsPage);

      renderWithProviders(<MyReportsList />);

      await waitFor(() => {
        expect(screen.getByText(/bạn chưa gửi báo cáo vi phạm nào/i)).toBeInTheDocument();
      });
      expect(
        screen.getByText(/khi phát hiện dấu hiệu lừa đảo/i)
      ).toBeInTheDocument();
    });

    it('filters reports by status tab', async () => {
      const user = userEvent.setup();
      vi.mocked(reportApi.getMyReports).mockResolvedValue(mockReportsPage);

      renderWithProviders(<MyReportsList />);

      await waitFor(() => {
        expect(
          screen.getByText(/tin đăng có dấu hiệu lừa đảo yêu cầu chuyển tiền cọc/i)
        ).toBeInTheDocument();
      });

      const investigatingTab = screen.getByRole('button', { name: /^đang điều tra$/i });
      await user.click(investigatingTab);

      await waitFor(() => {
        expect(reportApi.getMyReports).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'INVESTIGATING' })
        );
      });
    });
  });

  describe('ReportDetailModal', () => {
    it('renders user-visible report details without internal admin notes or reporter secrets', () => {
      renderWithProviders(
        <ReportDetailModal
          report={mockListingReport}
          onClose={vi.fn()}
        />
      );

      // Verify ID and badges
      expect(screen.getByText(/rep-1111/i)).toBeInTheDocument();
      expect(screen.getByText('Tin đăng')).toBeInTheDocument();
      expect(screen.getByText('Lừa đảo / Gian lận')).toBeInTheDocument();
      expect(screen.getByText('Đang điều tra')).toBeInTheDocument();

      // Description
      expect(
        screen.getByText(/Tin đăng có dấu hiệu lừa đảo yêu cầu chuyển tiền cọc trước khi nhận đồ/i)
      ).toBeInTheDocument();

      // Status explanation banner
      expect(
        screen.getByText(/quản trị viên đang xem xét lịch sử tin nhắn/i)
      ).toBeInTheDocument();

      // Ensure NO internal notes or internal admin names
      expect(screen.queryByText(/adminNotes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/resolutionNotes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ghi chú nội bộ/i)).not.toBeInTheDocument();
    });
  });
});
