import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { CreateReviewModal } from '@/features/reviews/components/CreateReviewModal';
import { CreateReportModal } from '@/features/reports/components/CreateReportModal';
import { CreateSupportRequestModal } from '@/features/support/components/CreateSupportRequestModal';
import { ReportDetailModal } from '@/features/reports/components/ReportDetailModal';
import { SupportRequestDetailModal } from '@/features/support/components/SupportRequestDetailModal';
import { SupportDetailModal as AdminSupportDetailModal } from '@/features/admin/components/SupportDetailModal';
import { attachmentApi } from '@/features/attachments';
import { reviewApi } from '@/features/reviews/api/review-api';
import { reportApi } from '@/features/reports/api/report-api';
import { supportApi } from '@/features/support/api/support-api';
import { adminSupportApi } from '@/features/admin/api/admin-support-api';
import { clearPrivateImageCache } from '@/lib/private-image-cache';
import type { TransactionResponse } from '@/types/transaction';
import type { ReviewResponse } from '@/types/review';
import type { ReportResponse } from '@/types/report';
import type { SupportRequestResponse } from '@/types/support';
import type { AdminSupportRequestResponse } from '@/types/admin-support';
import type { FileUploadResponse } from '@/types/file';

vi.mock('@/features/attachments/api/attachment-api', () => ({
  attachmentApi: {
    uploadAttachmentImage: vi.fn(),
    getPrivateAttachmentImage: vi.fn(),
    isSupportedPrivateImageUrl: vi.fn(),
  },
  isSupportedPrivateImageUrl: vi.fn(),
}));

vi.mock('@/features/reviews/api/review-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/reviews/api/review-api')>();
  return {
    ...actual,
    reviewApi: {
      ...actual.reviewApi,
      createReview: vi.fn(),
      getTransactionReviews: vi.fn(),
    },
  };
});

vi.mock('@/features/reports/api/report-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/reports/api/report-api')>();
  return {
    ...actual,
    reportApi: {
      ...actual.reportApi,
      createReport: vi.fn(),
    },
  };
});

vi.mock('@/features/support/api/support-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/support/api/support-api')>();
  return {
    ...actual,
    supportApi: {
      ...actual.supportApi,
      createSupportRequest: vi.fn(),
    },
  };
});

vi.mock('@/features/admin/api/admin-support-api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/admin/api/admin-support-api')>();
  return {
    ...actual,
    adminSupportApi: {
      ...actual.adminSupportApi,
      getAdminSupportRequestById: vi.fn(),
    },
  };
});

const FILE_ID_A = '11111111-1111-4111-8111-111111111111';
const FILE_ID_B = '22222222-2222-4222-8222-222222222222';

const REPORT_IMAGE_URL = `/api/v1/reports/attachments/${FILE_ID_B}`;
const SUPPORT_IMAGE_URL = `/api/v1/support-requests/attachments/${FILE_ID_A}`;

const mockTransaction: TransactionResponse = {
  id: 'tx-11111111-2222-3333-4444-555555555555',
  listing: {
    id: 'listing-1',
    title: 'Bàn phím cơ AKKO',
    listingType: 'GIVEAWAY',
    status: 'COMPLETED',
    price: null,
    currency: 'VND',
    city: 'TP. Hồ Chí Minh',
    owner: { id: 'owner-user-1', displayName: 'Nguyễn Văn Chủ' },
  },
  listingRequestId: 'req-1',
  owner: { id: 'owner-user-1', displayName: 'Nguyễn Văn Chủ' },
  requester: { id: 'requester-user-2', displayName: 'Trần Thị Nhận' },
  status: 'COMPLETED',
  ownerCompleted: true,
  requesterCompleted: true,
  ownerCompletedAt: '2026-10-24T12:00:00Z',
  requesterCompletedAt: '2026-10-24T12:30:00Z',
  myRole: 'OWNER',
  myCompleted: true,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T12:30:00Z',
};

const mockReviewResponse: ReviewResponse = {
  id: 'rev-uuid-1',
  transactionId: mockTransaction.id,
  listing: {
    id: mockTransaction.listing.id,
    title: mockTransaction.listing.title,
    listingType: mockTransaction.listing.listingType,
    status: 'COMPLETED',
    price: null,
    currency: null,
    city: mockTransaction.listing.city,
    owner: mockTransaction.listing.owner,
  },
  reviewer: mockTransaction.owner,
  reviewee: mockTransaction.requester,
  rating: 5,
  comment: null,
  createdAt: '2026-10-24T14:00:00Z',
};

const mockReportResponse: ReportResponse = {
  id: 'rep-1111-2222',
  targetType: 'LISTING',
  targetId: 'listing-abc-123',
  category: 'FRAUD_OR_SCAM',
  description: 'Tin đăng yêu cầu chuyển cọc trước khi nhận đồ.',
  status: 'PENDING',
  createdAt: '2026-10-25T10:00:00Z',
  updatedAt: '2026-10-25T10:00:00Z',
};

const mockSupportResponse: SupportRequestResponse = {
  id: 'sup-1111-2222',
  category: 'TRANSACTION_ISSUE',
  subject: 'Không liên lạc được với người nhận',
  description: 'Tôi đã đợi ở địa điểm hẹn 30 phút nhưng người nhận không phản hồi.',
  status: 'PENDING',
  adminResponse: null,
  createdAt: '2026-10-25T09:00:00Z',
  updatedAt: '2026-10-25T09:00:00Z',
};

function uploadResponse(id: string): FileUploadResponse {
  return {
    id,
    filename: 'bang-chung.jpg',
    contentType: 'image/jpeg',
    size: 1024,
    url: `/api/v1/files/${id}`,
  };
}

function imageFile(name = 'bang-chung.jpg'): File {
  return new File([new Uint8Array(16)], name, {
    type: 'image/jpeg',
    lastModified: 1,
  });
}

function privateBlob(): Blob {
  return new Blob(['private-evidence'], { type: 'image/jpeg' });
}

let objectUrlCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  clearPrivateImageCache();
  objectUrlCounter = 0;
  URL.createObjectURL = vi.fn(
    () => `blob:domain-${++objectUrlCounter}`
  ) as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  clearPrivateImageCache();
  vi.restoreAllMocks();
});

describe('Biểu mẫu đính kèm ảnh theo miền', () => {
  it('đánh giá: gửi kèm imageIds sau khi ảnh tải lên hoàn tất', async () => {
    const user = userEvent.setup();
    vi.mocked(attachmentApi.uploadAttachmentImage).mockResolvedValue(
      uploadResponse(FILE_ID_A)
    );
    vi.mocked(reviewApi.createReview).mockResolvedValue(mockReviewResponse);

    renderWithProviders(
      <CreateReviewModal isOpen onClose={vi.fn()} transaction={mockTransaction} />
    );

    await user.click(screen.getByRole('button', { name: '5 sao' }));
    await user.upload(
      screen.getByLabelText(/Hình ảnh đính kèm/),
      imageFile('danh-gia.jpg')
    );

    const submit = screen.getByRole('button', { name: /Gửi đánh giá/ });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    expect(reviewApi.createReview).toHaveBeenCalledWith(
      mockTransaction.id,
      expect.objectContaining({ rating: 5, imageIds: [FILE_ID_A] })
    );
  });

  it('đánh giá: không gửi imageIds khi không đính kèm ảnh', async () => {
    const user = userEvent.setup();
    vi.mocked(reviewApi.createReview).mockResolvedValue(mockReviewResponse);

    renderWithProviders(
      <CreateReviewModal isOpen onClose={vi.fn()} transaction={mockTransaction} />
    );

    await user.click(screen.getByRole('button', { name: '4 sao' }));
    await user.click(screen.getByRole('button', { name: /Gửi đánh giá/ }));

    expect(reviewApi.createReview).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(reviewApi.createReview).mock.calls[0][1];
    expect(payload).not.toHaveProperty('imageIds');
  });

  it('báo cáo: gửi imageIds và bỏ ảnh đã xóa khỏi payload', async () => {
    const user = userEvent.setup();
    vi.mocked(attachmentApi.uploadAttachmentImage)
      .mockResolvedValueOnce(uploadResponse(FILE_ID_A))
      .mockResolvedValueOnce(uploadResponse(FILE_ID_B));
    vi.mocked(reportApi.createReport).mockResolvedValue(mockReportResponse);

    renderWithProviders(
      <CreateReportModal
        isOpen
        onClose={vi.fn()}
        targetType="LISTING"
        targetId="listing-abc-123"
        targetTitle="Bàn phím cơ AKKO"
      />
    );

    await user.type(
      screen.getByLabelText(/Mô tả chi tiết bằng chứng/),
      'Tin đăng yêu cầu chuyển cọc trước khi nhận đồ.'
    );

    const input = screen.getByLabelText(/Hình ảnh đính kèm/);
    await user.upload(input, [
      imageFile('bang-chung-1.jpg'),
      imageFile('bang-chung-2.png'),
    ]);

    const submit = screen.getByRole('button', { name: /Gửi báo cáo/ });
    await waitFor(() => expect(submit).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Xóa ảnh 1' }));
    await user.click(submit);

    expect(reportApi.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ imageIds: [FILE_ID_B] })
    );
  });

  it('báo cáo: chặn gửi khi ảnh còn đang tải lên', async () => {
    const user = userEvent.setup();
    let resolveUpload!: (value: FileUploadResponse) => void;
    vi.mocked(attachmentApi.uploadAttachmentImage).mockReturnValue(
      new Promise<FileUploadResponse>((resolve) => {
        resolveUpload = resolve;
      })
    );

    renderWithProviders(
      <CreateReportModal
        isOpen
        onClose={vi.fn()}
        targetType="LISTING"
        targetId="listing-abc-123"
      />
    );

    await user.type(
      screen.getByLabelText(/Mô tả chi tiết bằng chứng/),
      'Bằng chứng đang được tải lên.'
    );
    await user.upload(
      screen.getByLabelText(/Hình ảnh đính kèm/),
      imageFile('dang-tai.jpg')
    );

    const submit = screen.getByRole('button', { name: /Gửi báo cáo/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Đang tải ảnh lên/)).toBeInTheDocument();

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(
      screen.getByText(
        'Vui lòng chờ ảnh tải lên hoàn tất hoặc xử lý ảnh tải lên thất bại trước khi gửi.'
      )
    ).toBeInTheDocument();
    expect(reportApi.createReport).not.toHaveBeenCalled();

    resolveUpload(uploadResponse(FILE_ID_A));
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it('hỗ trợ: gửi imageIds với đúng purpose SUPPORT', async () => {
    const user = userEvent.setup();
    vi.mocked(attachmentApi.uploadAttachmentImage).mockResolvedValue(
      uploadResponse(FILE_ID_A)
    );
    vi.mocked(supportApi.createSupportRequest).mockResolvedValue(mockSupportResponse);

    renderWithProviders(
      <CreateSupportRequestModal isOpen onClose={vi.fn()} />
    );

    await user.type(
      screen.getByLabelText(/Tiêu đề yêu cầu/),
      'Không liên lạc được với người nhận'
    );
    await user.type(
      screen.getByLabelText(/Mô tả chi tiết/),
      'Tôi đã đợi ở địa điểm hẹn 30 phút nhưng người nhận không phản hồi.'
    );
    await user.upload(
      screen.getByLabelText(/Hình ảnh đính kèm/),
      imageFile('ho-tro.jpg')
    );

    const submit = screen.getByRole('button', { name: /Gửi yêu cầu/ });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    expect(attachmentApi.uploadAttachmentImage).toHaveBeenCalledWith(
      expect.any(File),
      'SUPPORT',
      expect.any(AbortSignal)
    );
    expect(supportApi.createSupportRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Không liên lạc được với người nhận',
        imageIds: [FILE_ID_A],
      })
    );
  });
});

describe('Thư viện ảnh trong màn hình chi tiết', () => {
  it('người gửi xem ảnh bằng chứng báo cáo qua API có xác thực', async () => {
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockResolvedValue(
      privateBlob()
    );

    renderWithProviders(
      <ReportDetailModal
        report={{
          ...mockReportResponse,
          images: [{ id: FILE_ID_B, url: REPORT_IMAGE_URL }],
        }}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByRole('list', {
        name: 'Hình ảnh bằng chứng bạn đã gửi',
      })
    ).toBeInTheDocument();
    const image = await screen.findByAltText('Hình ảnh đính kèm 1');
    expect(image.getAttribute('src')).toMatch(/^blob:/);
    expect(attachmentApi.getPrivateAttachmentImage).toHaveBeenCalledWith(
      REPORT_IMAGE_URL,
      expect.any(AbortSignal)
    );
  });

  it('người gửi xem ảnh đính kèm yêu cầu hỗ trợ', async () => {
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockResolvedValue(
      privateBlob()
    );

    renderWithProviders(
      <SupportRequestDetailModal
        request={{
          ...mockSupportResponse,
          images: [{ id: FILE_ID_A, url: SUPPORT_IMAGE_URL }],
        }}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByRole('list', {
        name: 'Hình ảnh bạn đã gửi kèm',
      })
    ).toBeInTheDocument();
    await screen.findByAltText('Hình ảnh đính kèm 1');
  });

  it('quản trị viên xem ảnh đính kèm yêu cầu hỗ trợ sau khi tải chi tiết', async () => {
    const adminRequest: AdminSupportRequestResponse = {
      ...mockSupportResponse,
      requesterDisplayName: 'Trần Thị Gửi',
      requesterEmail: 'gui@example.com',
      images: [{ id: FILE_ID_A, url: SUPPORT_IMAGE_URL }],
    };

    vi.mocked(adminSupportApi.getAdminSupportRequestById).mockResolvedValue(
      adminRequest
    );
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockResolvedValue(
      privateBlob()
    );

    renderWithProviders(
      <AdminSupportDetailModal
        isOpen
        requestId={mockSupportResponse.id}
        onClose={vi.fn()}
      />
    );

    expect(
      await screen.findByRole('list', { name: 'Hình ảnh đính kèm' })
    ).toBeInTheDocument();
    await screen.findByAltText('Hình ảnh đính kèm 1');

    expect(adminSupportApi.getAdminSupportRequestById).toHaveBeenCalledWith(
      mockSupportResponse.id
    );
    expect(attachmentApi.getPrivateAttachmentImage).toHaveBeenCalledWith(
      SUPPORT_IMAGE_URL,
      expect.any(AbortSignal)
    );
  });

  it('không hiển thị thư viện khi không có ảnh', () => {
    renderWithProviders(
      <ReportDetailModal report={mockReportResponse} onClose={vi.fn()} />
    );

    expect(
      screen.queryByRole('list', { name: /Hình ảnh bằng chứng/ })
    ).not.toBeInTheDocument();
    expect(attachmentApi.getPrivateAttachmentImage).not.toHaveBeenCalled();
  });
});
