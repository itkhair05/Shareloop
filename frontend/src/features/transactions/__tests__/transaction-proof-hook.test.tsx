import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { transactionApi } from '../api/transaction-api';
import { useTransactionProof } from '../hooks/use-transaction-proof';
import { ApiError } from '@/lib/api-error';
import { downloadBlobFile } from '@/lib/file-download';

vi.mock('../api/transaction-api', () => ({
  transactionApi: {
    downloadTransactionProof: vi.fn(),
  },
}));

vi.mock('@/lib/file-download', () => ({
  downloadBlobFile: vi.fn(),
  parseContentDispositionFilename: vi.fn(),
}));

const TX_ID = '3f6f4f58-2a33-4f9a-9d21-9e2d71d4a101';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTransactionProof', () => {
  it('tải thành công: trả về null, kích hoạt download với blob và tên tệp', async () => {
    const blob = new Blob(['%PDF-fake'], { type: 'application/pdf' });
    vi.mocked(transactionApi.downloadTransactionProof).mockResolvedValue({
      blob,
      filename: `shareloop-transaction-proof-${TX_ID}.pdf`,
    });

    const { result } = renderHook(() => useTransactionProof());

    let message: string | null = '';
    await act(async () => {
      message = await result.current.downloadProof(TX_ID);
    });

    expect(message).toBeNull();
    expect(transactionApi.downloadTransactionProof).toHaveBeenCalledTimes(1);
    expect(transactionApi.downloadTransactionProof).toHaveBeenCalledWith(TX_ID);
    expect(downloadBlobFile).toHaveBeenCalledWith(blob, `shareloop-transaction-proof-${TX_ID}.pdf`);
    expect(result.current.error).toBeNull();
    expect(result.current.isDownloading).toBe(false);
  });

  it('thất bại: trả về thông báo tiếng Việt theo status và lưu vào state error', async () => {
    vi.mocked(transactionApi.downloadTransactionProof).mockRejectedValue(
      new ApiError({ message: 'raw', status: 409, error: 'Conflict' })
    );

    const { result } = renderHook(() => useTransactionProof());

    let message: string | null = '';
    await act(async () => {
      message = await result.current.downloadProof(TX_ID);
    });

    expect(message).toBe(
      'Chỉ có thể tải tài liệu sau khi cả hai bên xác nhận hoàn tất giao dịch.'
    );
    expect(result.current.error).toBe(
      'Chỉ có thể tải tài liệu sau khi cả hai bên xác nhận hoàn tất giao dịch.'
    );
    expect(downloadBlobFile).not.toHaveBeenCalled();
  });

  it('chặn tải trùng lặp khi đang trong một lượt tải', async () => {
    let resolveFirst!: (value: { blob: Blob; filename: string }) => void;
    vi.mocked(transactionApi.downloadTransactionProof).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );

    const { result } = renderHook(() => useTransactionProof());

    let firstPromise!: Promise<string | null>;
    let secondPromise!: Promise<string | null>;
    act(() => {
      firstPromise = result.current.downloadProof(TX_ID);
      secondPromise = result.current.downloadProof(TX_ID);
    });

    expect(transactionApi.downloadTransactionProof).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({ blob: new Blob(['%PDF']), filename: 'proof.pdf' });
    });

    const [firstMessage, secondMessage] = await Promise.all([firstPromise, secondPromise]);
    expect(firstMessage).toBeNull();
    expect(secondMessage).toBeNull();
    expect(downloadBlobFile).toHaveBeenCalledTimes(1);
  });

  it('isDownloading chuyển true trong lúc tải và false sau khi xong', async () => {
    let resolveDownload!: (value: { blob: Blob; filename: string }) => void;
    vi.mocked(transactionApi.downloadTransactionProof).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        })
    );

    const { result } = renderHook(() => useTransactionProof());

    act(() => {
      void result.current.downloadProof(TX_ID);
    });

    expect(result.current.isDownloading).toBe(true);

    await act(async () => {
      resolveDownload({ blob: new Blob(['%PDF']), filename: 'proof.pdf' });
    });

    expect(result.current.isDownloading).toBe(false);
  });

  it('clearError xóa thông báo lỗi', async () => {
    vi.mocked(transactionApi.downloadTransactionProof).mockRejectedValue(
      new ApiError({ message: 'raw', status: 404, error: 'Not Found' })
    );

    const { result } = renderHook(() => useTransactionProof());

    await act(async () => {
      await result.current.downloadProof(TX_ID);
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});
