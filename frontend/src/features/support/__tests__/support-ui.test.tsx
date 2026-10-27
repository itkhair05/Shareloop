import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createTestQueryClient } from '@/test/test-utils';
import {
  CreateSupportRequestModal,
  SupportRequestDetailModal,
  MySupportRequestsList,
} from '../index';
import { supportApi } from '../api/support-api';
import type { SupportRequestResponse, MySupportRequestsPage } from '@/types/support';

vi.mock('../api/support-api', () => ({
  supportApi: {
    createSupportRequest: vi.fn(),
    getMySupportRequests: vi.fn(),
    getSupportRequestDetails: vi.fn(),
  },
}));

const mockSupportRequest: SupportRequestResponse = {
  id: 'sup-1111-2222',
  category: 'TRANSACTION_ISSUE',
  subject: 'Không liên lạc được với người nhận',
  description: 'Tôi đã đợi ở địa điểm hẹn 30 phút nhưng người nhận không nghe máy hay trả lời tin nhắn.',
  status: 'IN_PROGRESS',
  transactionId: 'tx-9999',
  adminResponse: 'Chào bạn, Ban quản trị đang liên hệ đối tác để giải quyết.',
  createdAt: '2026-10-25T09:00:00Z',
  updatedAt: '2026-10-25T11:30:00Z',
};

const mockPendingSupportRequest: SupportRequestResponse = {
  id: 'sup-3333-4444',
  category: 'ACCOUNT_ISSUE',
  subject: 'Cần đổi số điện thoại liên kết',
  description: 'Tôi vừa đổi SIM và cần cập nhật số điện thoại xác minh.',
  status: 'PENDING',
  adminResponse: null,
  createdAt: '2026-10-26T14:20:00Z',
  updatedAt: '2026-10-26T14:20:00Z',
};

const mockPageResponse: MySupportRequestsPage = {
  content: [mockSupportRequest, mockPendingSupportRequest],
  totalElements: 2,
  totalPages: 1,
  size: 10,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const mockEmptyPageResponse: MySupportRequestsPage = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 10,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

describe('Support Requests UI (Gửi yêu cầu hỗ trợ & Quản lý yêu cầu)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CreateSupportRequestModal', () => {
    it('disables submit button until subject and description are provided', () => {
      const onClose = vi.fn();

      renderWithProviders(
        <CreateSupportRequestModal isOpen={true} onClose={onClose} />
      );

      expect(screen.getByRole('dialog', { name: /gửi yêu cầu hỗ trợ/i })).toBeInTheDocument();

      const submitBtn = screen.getByRole('button', { name: /gửi yêu cầu/i });
      expect(submitBtn).toBeDisabled();
    });

    it('submits valid support request successfully and displays confirmation', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onSuccess = vi.fn();

      vi.mocked(supportApi.createSupportRequest).mockResolvedValueOnce(mockSupportRequest);

      renderWithProviders(
        <CreateSupportRequestModal
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      );

      // Select category button
      const accountBtn = screen.getByRole('button', { name: /vấn đề về tài khoản/i });
      await user.click(accountBtn);

      // Type subject & description
      const subjectInput = screen.getByLabelText(/tiêu đề yêu cầu/i);
      await user.type(subjectInput, 'Không liên lạc được với người nhận');

      const descInput = screen.getByLabelText(/mô tả chi tiết/i);
      await user.type(
        descInput,
        'Tôi đã đợi ở địa điểm hẹn 30 phút nhưng người nhận không nghe máy hay trả lời tin nhắn.'
      );

      // Submit
      const submitBtn = screen.getByRole('button', { name: /gửi yêu cầu/i });
      expect(submitBtn).toBeEnabled();
      await user.click(submitBtn);

      await waitFor(() => {
        expect(supportApi.createSupportRequest).toHaveBeenCalledWith({
          category: 'ACCOUNT_ISSUE',
          subject: 'Không liên lạc được với người nhận',
          description: 'Tôi đã đợi ở địa điểm hẹn 30 phút nhưng người nhận không nghe máy hay trả lời tin nhắn.',
          transactionId: null,
        });
      });

      // Confirmation screen rendered
      await waitFor(() => {
        expect(screen.getByText(/gửi yêu cầu thành công!/i)).toBeInTheDocument();
        expect(screen.getByText(/#sup-1111/i)).toBeInTheDocument();
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('passes and displays contextual transaction ID when provided', () => {
      renderWithProviders(
        <CreateSupportRequestModal
          isOpen={true}
          onClose={vi.fn()}
          defaultTransactionId="tx-abc-123"
        />
      );

      expect(
        screen.getByText(/yêu cầu này sẽ được gắn kèm thông tin giao dịch/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/tx-abc-123/i)).toBeInTheDocument();
    });
  });

  describe('MySupportRequestsList', () => {
    it('renders list of user support requests with Vietnamese status labels', async () => {
      vi.mocked(supportApi.getMySupportRequests).mockResolvedValueOnce(mockPageResponse);

      renderWithProviders(<MySupportRequestsList />);

      await waitFor(() => {
        expect(screen.getByText('Không liên lạc được với người nhận')).toBeInTheDocument();
        expect(screen.getByText('Cần đổi số điện thoại liên kết')).toBeInTheDocument();
      });

      // Check Vietnamese status badges
      expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Chờ xử lý').length).toBeGreaterThanOrEqual(1);

      // Check category labels
      expect(screen.getByText('Giao dịch')).toBeInTheDocument();
      expect(screen.getByText('Tài khoản')).toBeInTheDocument();

      // Admin response indicator
      expect(screen.getByText(/phản hồi từ admin/i)).toBeInTheDocument();
    });

    it('renders empty state when user has no support requests', async () => {
      vi.mocked(supportApi.getMySupportRequests).mockResolvedValueOnce(mockEmptyPageResponse);

      renderWithProviders(<MySupportRequestsList />);

      await waitFor(() => {
        expect(screen.getByText(/bạn chưa gửi yêu cầu hỗ trợ nào/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /gửi yêu cầu hỗ trợ ngay/i })).toBeInTheDocument();
    });

    it('renders error state with retry button when API fails', async () => {
      vi.mocked(supportApi.getMySupportRequests).mockRejectedValueOnce(new Error('Network error'));

      const queryClient = createTestQueryClient();
      renderWithProviders(<MySupportRequestsList />, { queryClient });

      await waitFor(() => {
        expect(screen.getByText(/không thể tải danh sách yêu cầu/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    });

    it('filters requests by status tab', async () => {
      const user = userEvent.setup();
      vi.mocked(supportApi.getMySupportRequests).mockResolvedValue(mockPageResponse);

      renderWithProviders(<MySupportRequestsList />);

      await waitFor(() => {
        expect(screen.getByText('Không liên lạc được với người nhận')).toBeInTheDocument();
      });

      const inProgressTab = screen.getByRole('button', { name: /^đang xử lý$/i });
      await user.click(inProgressTab);

      await waitFor(() => {
        expect(supportApi.getMySupportRequests).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'IN_PROGRESS' })
        );
      });
    });
  });

  describe('SupportRequestDetailModal', () => {
    it('renders user-visible fields and admin response without internal staff notes', () => {
      renderWithProviders(
        <SupportRequestDetailModal
          request={mockSupportRequest}
          onClose={vi.fn()}
        />
      );

      // Verify title & ID
      expect(screen.getByText('Không liên lạc được với người nhận')).toBeInTheDocument();
      expect(screen.getByText(/sup-1111/i)).toBeInTheDocument();

      // Verify Vietnamese category & status
      expect(screen.getByText('Giao dịch')).toBeInTheDocument();
      expect(screen.getByText('Đang xử lý')).toBeInTheDocument();

      // Verify Subject & Description
      expect(
        screen.getByText(/Tôi đã đợi ở địa điểm hẹn 30 phút nhưng người nhận không nghe máy/i)
      ).toBeInTheDocument();

      // Verify public admin response is present
      expect(screen.getByText(/Phản hồi từ Quản trị viên/i)).toBeInTheDocument();
      expect(
        screen.getByText('Chào bạn, Ban quản trị đang liên hệ đối tác để giải quyết.')
      ).toBeInTheDocument();

      // Verify internal staff notes are NOT present
      expect(screen.queryByText(/adminNotes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/resolutionNotes/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/ghi chú nội bộ/i)).not.toBeInTheDocument();
    });
  });
});
