import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { ApiError } from '@/lib/api-error';
import { rawAxiosClient } from '@/lib/api-client';
import {
  transactionApi,
  type TransactionProofDownload,
} from '../api/transaction-api';

vi.mock('@/lib/api-client', () => ({
  rawAxiosClient: {
    get: vi.fn(),
  },
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const TX_ID = '3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101';

function blobErrorResponse(status: number, body: unknown): AxiosError {
  const blob =
    body instanceof Blob
      ? body
      : new Blob([JSON.stringify(body)], { type: 'application/json' });
  return new AxiosError('Request failed with status code ' + status, undefined, undefined, undefined, {
    status,
    statusText: 'Error',
    data: blob,
    headers: {},
    config: {} as never,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('transactionApi.downloadTransactionProof', () => {
  it('gọi endpoint proof với responseType blob và Accept application/pdf', async () => {
    const blob = new Blob(['%PDF-fake'], { type: 'application/pdf' });
    vi.mocked(rawAxiosClient.get).mockResolvedValue({
      data: blob,
      headers: {
        'content-disposition':
          'attachment; filename="shareloop-transaction-proof-3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101.pdf"',
      },
    } as never);

    const result: TransactionProofDownload = await transactionApi.downloadTransactionProof(TX_ID);

    expect(rawAxiosClient.get).toHaveBeenCalledWith(
      `/api/v1/transactions/${TX_ID}/proof`,
      {
        responseType: 'blob',
        headers: { Accept: 'application/pdf, application/json' },
      }
    );
    expect(result.blob).toBe(blob);
    expect(result.filename).toBe(
      'shareloop-transaction-proof-3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101.pdf'
    );
  });

  it('mã hóa UUID khi ghép URL', async () => {
    vi.mocked(rawAxiosClient.get).mockResolvedValue({
      data: new Blob(['%PDF-fake']),
      headers: {},
    } as never);

    await transactionApi.downloadTransactionProof('uuid cần mã hóa');

    expect(rawAxiosClient.get).toHaveBeenCalledWith(
      '/api/v1/transactions/uuid%20c%E1%BA%A7n%20m%C3%A3%20h%C3%B3a/proof',
      expect.anything()
    );
  });

  it('dùng tên tệp dự phòng khi backend không trả Content-Disposition', async () => {
    vi.mocked(rawAxiosClient.get).mockResolvedValue({
      data: new Blob(['%PDF-fake']),
      headers: {},
    } as never);

    const result = await transactionApi.downloadTransactionProof(TX_ID);

    expect(result.filename).toBe(`shareloop-transaction-proof-${TX_ID}.pdf`);
  });

  it('không tin tưởng tên tệp thô từ server (loại bỏ đường dẫn/ký tự không an toàn)', async () => {
    vi.mocked(rawAxiosClient.get).mockResolvedValue({
      data: new Blob(['%PDF-fake']),
      headers: {
        'content-disposition': 'attachment; filename="../../../evil.pdf"',
      },
    } as never);

    const result = await transactionApi.downloadTransactionProof(TX_ID);

    expect(result.filename).toBe('evil.pdf');
  });

  it('phân tích lỗi JSON bên trong Blob và giữ nguyên HTTP status (409)', async () => {
    vi.mocked(rawAxiosClient.get).mockRejectedValue(
      blobErrorResponse(409, { message: 'Giao dịch chưa hoàn tất nên chưa thể tải tài liệu xác nhận.' })
    );

    const caught = await transactionApi.downloadTransactionProof(TX_ID).catch((e) => e);

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.status).toBe(409);
    expect(caught.message).toBe(
      'Giao dịch chưa hoàn tất nên chưa thể tải tài liệu xác nhận.'
    );
  });

  it('phân tích lỗi Blob cho 401/403/404', async () => {
    const cases: Array<[number, string]> = [
      [401, 'Unauthorized'],
      [403, 'Access Denied'],
      [404, 'Transaction not found'],
    ];

    for (const [status, message] of cases) {
      vi.mocked(rawAxiosClient.get).mockRejectedValueOnce(
        blobErrorResponse(status, { message })
      );

      const caught = await transactionApi.downloadTransactionProof(TX_ID).catch((e) => e);
      expect(caught).toBeInstanceOf(ApiError);
      expect(caught.status).toBe(status);
      expect(caught.message).toBe(message);
    }
  });

  it('giữ nguyên ApiError từ tầng client cho lỗi không phải Blob', async () => {
    const networkError = new ApiError({
      message: 'Network Error',
      status: 0,
      error: 'Network Error',
      isNetworkError: true,
    });
    vi.mocked(rawAxiosClient.get).mockRejectedValue(networkError);

    const caught = await transactionApi.downloadTransactionProof(TX_ID).catch((e) => e);

    expect(caught).toBe(networkError);
  });

  it('xử lý an toàn khi Blob lỗi không phải JSON hợp lệ', async () => {
    const plainBlob = new Blob(['not json'], { type: 'application/json' });
    vi.mocked(rawAxiosClient.get).mockRejectedValue(blobErrorResponse(500, plainBlob));

    const caught = await transactionApi.downloadTransactionProof(TX_ID).catch((e) => e);

    expect(caught).toBeInstanceOf(ApiError);
    expect(caught.status).toBe(500);
  });
});
