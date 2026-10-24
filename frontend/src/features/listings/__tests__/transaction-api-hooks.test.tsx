import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { transactionApi, transactionKeys } from '@/features/transactions/api/transaction-api';
import {
  useUserTransactions,
  useTransactionDetails,
  useListingTransaction,
  useCompleteTransaction,
  useCancelTransaction,
} from '@/features/transactions/hooks/use-transactions';
import { listingKeys } from '@/features/listings/api/listing-api';
import { requestKeys } from '@/features/requests/api/request-api';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type {
  CancelTransactionRequest,
  TransactionQueryParams,
  TransactionResponse,
} from '@/types/transaction';
import type { PageResponse } from '@/types/api';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockTransactionResponse: TransactionResponse = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  listing: {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Nồi chiên không dầu Lock&Lock',
    listingType: 'GIVEAWAY',
    status: 'RESERVED',
    price: null,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: '22222222-2222-2222-2222-222222222222',
      displayName: 'Nguyễn Văn Chủ',
    },
  },
  listingRequestId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  owner: {
    id: '22222222-2222-2222-2222-222222222222',
    displayName: 'Nguyễn Văn Chủ',
  },
  requester: {
    id: '33333333-3333-3333-3333-333333333333',
    displayName: 'Trần Thị Nhận',
  },
  status: 'IN_PROGRESS',
  ownerCompleted: true,
  requesterCompleted: false,
  ownerCompletedAt: '2026-10-24T12:00:00Z',
  requesterCompletedAt: null,
  myRole: 'OWNER',
  myCompleted: true,
  cancelledBy: null,
  cancelledAt: null,
  cancellationReason: null,
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T12:00:00Z',
};

const mockCompletedTransaction: TransactionResponse = {
  ...mockTransactionResponse,
  status: 'COMPLETED',
  requesterCompleted: true,
  requesterCompletedAt: '2026-10-24T12:30:00Z',
  updatedAt: '2026-10-24T12:30:00Z',
};

const mockCancelledTransaction: TransactionResponse = {
  ...mockTransactionResponse,
  status: 'CANCELLED',
  cancelledBy: {
    id: '22222222-2222-2222-2222-222222222222',
    displayName: 'Nguyễn Văn Chủ',
  },
  cancelledAt: '2026-10-24T13:00:00Z',
  cancellationReason: 'Người nhận không đến lấy đúng hẹn',
  updatedAt: '2026-10-24T13:00:00Z',
};

const mockPageResponse: PageResponse<TransactionResponse> = {
  content: [mockTransactionResponse],
  totalElements: 1,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, wrapper };
}

describe('Transaction API Client (transactionApi)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getUserTransactions calls GET /api/v1/transactions with params', async () => {
    const params: TransactionQueryParams = {
      status: 'IN_PROGRESS',
      role: 'owner',
      page: 0,
      size: 20,
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockPageResponse);

    const result = await transactionApi.getUserTransactions(params);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/transactions', { params });
    expect(result).toEqual(mockPageResponse);
  });

  it('getTransactionDetails calls GET /api/v1/transactions/{id}', async () => {
    const transactionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockTransactionResponse);

    const result = await transactionApi.getTransactionDetails(transactionId);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/transactions/${transactionId}`
    );
    expect(result).toEqual(mockTransactionResponse);
  });

  it('getListingTransaction calls GET /api/v1/listings/{listingId}/transaction', async () => {
    const listingId = '11111111-1111-1111-1111-111111111111';
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockTransactionResponse);

    const result = await transactionApi.getListingTransaction(listingId);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/listings/${listingId}/transaction`
    );
    expect(result).toEqual(mockTransactionResponse);
  });

  it('completeTransaction calls POST /api/v1/transactions/{id}/complete', async () => {
    const transactionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockCompletedTransaction);

    const result = await transactionApi.completeTransaction(transactionId);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/v1/transactions/${transactionId}/complete`
    );
    expect(result).toEqual(mockCompletedTransaction);
  });

  it('cancelTransaction calls POST /api/v1/transactions/{id}/cancel with payload', async () => {
    const transactionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const payload: CancelTransactionRequest = {
      reason: 'Người nhận không đến lấy đúng hẹn',
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockCancelledTransaction);

    const result = await transactionApi.cancelTransaction(transactionId, payload);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/v1/transactions/${transactionId}/cancel`,
      payload
    );
    expect(result).toEqual(mockCancelledTransaction);
  });
});

describe('Transaction React Query Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useUserTransactions', () => {
    it('fetches user transactions and returns paginated result', async () => {
      const { wrapper } = createTestWrapper();
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockPageResponse);

      const params: TransactionQueryParams = { status: 'IN_PROGRESS', page: 0, size: 20 };
      const { result } = renderHook(() => useUserTransactions(params), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockPageResponse);
      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/transactions', { params });
    });

    it('does NOT fetch when enabled option is false', async () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(
        () => useUserTransactions(undefined, { enabled: false }),
        { wrapper }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('propagates ApiError on failure', async () => {
      const { wrapper } = createTestWrapper();
      const mockError = new ApiError({
        message: 'Không có quyền truy cập',
        status: 403,
        error: 'FORBIDDEN',
      });
      vi.mocked(apiClient.get).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useUserTransactions(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe('useTransactionDetails', () => {
    it('fetches transaction details when valid UUID is provided', async () => {
      const { wrapper } = createTestWrapper();
      const transactionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockTransactionResponse);

      const { result } = renderHook(() => useTransactionDetails(transactionId), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockTransactionResponse);
      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/transactions/${transactionId}`);
    });

    it('does not fetch when id is missing or not a valid UUID', async () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useTransactionDetails('invalid-uuid-123'), {
        wrapper,
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('propagates 404 ApiError when transaction is not found', async () => {
      const { wrapper } = createTestWrapper();
      const transactionId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const notFoundError = new ApiError({
        message: 'Giao dịch không tồn tại',
        status: 404,
        error: 'NOT_FOUND',
      });
      vi.mocked(apiClient.get).mockRejectedValueOnce(notFoundError);

      const { result } = renderHook(() => useTransactionDetails(transactionId), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.status).toBe(404);
    });
  });

  describe('useListingTransaction', () => {
    it('fetches active listing transaction when valid listingId is provided', async () => {
      const { wrapper } = createTestWrapper();
      const listingId = '11111111-1111-1111-1111-111111111111';
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockTransactionResponse);

      const { result } = renderHook(() => useListingTransaction(listingId), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockTransactionResponse);
      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/listings/${listingId}/transaction`
      );
    });

    it('does not fetch when listingId is invalid UUID', async () => {
      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useListingTransaction('not-a-uuid'), {
        wrapper,
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useCompleteTransaction', () => {
    it('calls API and invalidates transaction, listing, and request queries on success', async () => {
      const { queryClient, wrapper } = createTestWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockCompletedTransaction);

      const { result } = renderHook(() => useCompleteTransaction(), { wrapper });

      await result.current.mutateAsync(mockTransactionResponse.id);

      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/transactions/${mockTransactionResponse.id}/complete`
      );

      // Verify transaction queries invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: transactionKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: transactionKeys.detail(mockCompletedTransaction.id),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: transactionKeys.listing(mockCompletedTransaction.listing.id),
      });

      // Verify completed listing queries invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: listingKeys.detail(mockCompletedTransaction.listing.id),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listingKeys.lists() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listingKeys.mineLists() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.all });
    });

    it('propagates ApiError when completion fails (e.g. 400 Bad Request)', async () => {
      const { wrapper } = createTestWrapper();
      const badRequestError = new ApiError({
        message: 'Không thể hoàn thành giao dịch đã hủy',
        status: 400,
        error: 'BAD_REQUEST',
      });
      vi.mocked(apiClient.post).mockRejectedValueOnce(badRequestError);

      const { result } = renderHook(() => useCompleteTransaction(), { wrapper });

      await expect(result.current.mutateAsync(mockTransactionResponse.id)).rejects.toEqual(
        badRequestError
      );
    });
  });

  describe('useCancelTransaction', () => {
    it('calls API with reason and invalidates transaction, listing, and request queries on success', async () => {
      const { queryClient, wrapper } = createTestWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockCancelledTransaction);

      const { result } = renderHook(() => useCancelTransaction(), { wrapper });

      const payload: CancelTransactionRequest = {
        reason: 'Người nhận không đến lấy đúng hẹn',
      };
      await result.current.mutateAsync({
        id: mockTransactionResponse.id,
        payload,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/transactions/${mockTransactionResponse.id}/cancel`,
        payload
      );

      // Verify transaction queries invalidated
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: transactionKeys.all });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: transactionKeys.detail(mockCancelledTransaction.id),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: transactionKeys.listing(mockCancelledTransaction.listing.id),
      });

      // Verify restored listing queries invalidated (RESERVED -> ACTIVE)
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: listingKeys.detail(mockCancelledTransaction.listing.id),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listingKeys.lists() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listingKeys.mineLists() });

      // Verify linked request invalidated (marked CANCELLED)
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.all });
    });

    it('propagates ApiError when cancel fails (e.g. 409 Conflict)', async () => {
      const { wrapper } = createTestWrapper();
      const conflictError = new ApiError({
        message: 'Giao dịch đã hoàn tất, không thể hủy',
        status: 400,
        error: 'BAD_REQUEST',
      });
      vi.mocked(apiClient.post).mockRejectedValueOnce(conflictError);

      const { result } = renderHook(() => useCancelTransaction(), { wrapper });

      await expect(
        result.current.mutateAsync({
          id: mockTransactionResponse.id,
          payload: { reason: 'Muốn hủy' },
        })
      ).rejects.toEqual(conflictError);
    });
  });
});
