import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { requestApi, requestKeys } from '@/features/requests/api/request-api';
import {
  useListingRequests,
  useMyRequests,
  useCreateRequest,
  useUpdateRequestStatus,
} from '@/features/requests/hooks/use-requests';
import { listingKeys } from '@/features/listings/api/listing-api';
import { apiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-error';
import type {
  CreateListingRequestDto,
  ListingRequestResponse,
  ListingRequestsQueryParams,
  MyRequestsQueryParams,
  UpdateListingRequestStatusRequest,
} from '@/types/request';
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

const mockRequestResponse: ListingRequestResponse = {
  id: '33333333-3333-3333-3333-333333333333',
  listing: {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Nồi cơm điện Cuckoo',
    listingType: 'GIVEAWAY',
    status: 'ACTIVE',
    price: null,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: '22222222-2222-2222-2222-222222222222',
      displayName: 'Nguyễn Văn A',
    },
  },
  requester: {
    id: '44444444-4444-4444-4444-444444444444',
    displayName: 'Trần Thị B',
  },
  message: 'Tôi rất muốn xin món đồ này!',
  status: 'PENDING',
  createdAt: '2026-10-24T10:00:00Z',
  updatedAt: '2026-10-24T10:00:00Z',
};

const mockPageResponse: PageResponse<ListingRequestResponse> = {
  content: [mockRequestResponse],
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

describe('Listing Request API Client (requestApi)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createRequest posts payload to /api/v1/listings/{listingId}/requests', async () => {
    const listingId = '11111111-1111-1111-1111-111111111111';
    const payload: CreateListingRequestDto = { message: 'Tôi muốn xin đồ này' };
    vi.mocked(apiClient.post).mockResolvedValueOnce(mockRequestResponse);

    const result = await requestApi.createRequest(listingId, payload);

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith(
      `/api/v1/listings/${listingId}/requests`,
      payload
    );
    expect(result).toEqual(mockRequestResponse);
  });

  it('getRequestsForListing calls GET /api/v1/listings/{listingId}/requests with params', async () => {
    const listingId = '11111111-1111-1111-1111-111111111111';
    const params: ListingRequestsQueryParams = { status: 'PENDING', page: 0, size: 20 };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockPageResponse);

    const result = await requestApi.getRequestsForListing(listingId, params);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/listings/${listingId}/requests`,
      { params }
    );
    expect(result).toEqual(mockPageResponse);
  });

  it('getMyRequests calls GET /api/v1/listing-requests/mine with params', async () => {
    const params: MyRequestsQueryParams = { status: 'PENDING', page: 1, size: 10 };
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockPageResponse);

    const result = await requestApi.getMyRequests(params);

    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/listing-requests/mine', { params });
    expect(result).toEqual(mockPageResponse);
  });

  it('updateRequestStatus calls PATCH /api/v1/listing-requests/{requestId}/status', async () => {
    const requestId = '33333333-3333-3333-3333-333333333333';
    const payload: UpdateListingRequestStatusRequest = { status: 'ACCEPTED' };
    const acceptedResponse: ListingRequestResponse = {
      ...mockRequestResponse,
      status: 'ACCEPTED',
    };
    vi.mocked(apiClient.patch).mockResolvedValueOnce(acceptedResponse);

    const result = await requestApi.updateRequestStatus(requestId, payload);

    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    expect(apiClient.patch).toHaveBeenCalledWith(
      `/api/v1/listing-requests/${requestId}/status`,
      payload
    );
    expect(result.status).toBe('ACCEPTED');
  });
});

describe('Listing Request Query Keys (requestKeys)', () => {
  it('builds consistent hierarchical query keys', () => {
    expect(requestKeys.all).toEqual(['requests']);
    expect(requestKeys.mineLists()).toEqual(['requests', 'mine']);
    expect(requestKeys.mine({ page: 0, size: 20 })).toEqual([
      'requests',
      'mine',
      { page: 0, size: 20 },
    ]);
    expect(requestKeys.listingLists()).toEqual(['requests', 'listing']);
    expect(
      requestKeys.listing('11111111-1111-1111-1111-111111111111', { status: 'PENDING' })
    ).toEqual([
      'requests',
      'listing',
      '11111111-1111-1111-1111-111111111111',
      { status: 'PENDING' },
    ]);
  });
});

describe('Listing Request React Query Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useListingRequests', () => {
    it('remains disabled when listingId is undefined or not a valid UUID', () => {
      const { wrapper } = createTestWrapper();

      const { result: undefResult } = renderHook(() => useListingRequests(undefined), { wrapper });
      expect(undefResult.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();

      const { result: invalidResult } = renderHook(() => useListingRequests('not-a-valid-uuid'), { wrapper });
      expect(invalidResult.current.fetchStatus).toBe('idle');
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it('fetches listing requests when listingId is a valid UUID', async () => {
      const listingId = '11111111-1111-1111-1111-111111111111';
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockPageResponse);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useListingRequests(listingId, { status: 'PENDING' }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.get).toHaveBeenCalledWith(
        `/api/v1/listings/${listingId}/requests`,
        { params: { status: 'PENDING' } }
      );
      expect(result.current.data).toEqual(mockPageResponse);
    });
  });

  describe('useMyRequests', () => {
    it('fetches authenticated user requests and returns data', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockPageResponse);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useMyRequests({ page: 0, size: 20 }), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/listing-requests/mine', {
        params: { page: 0, size: 20 },
      });
      expect(result.current.data?.content).toHaveLength(1);
    });
  });

  describe('useCreateRequest mutation', () => {
    it('submits request and invalidates relevant caches on success', async () => {
      const listingId = '11111111-1111-1111-1111-111111111111';
      vi.mocked(apiClient.post).mockResolvedValueOnce(mockRequestResponse);

      const { queryClient, wrapper } = createTestWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateRequest(), { wrapper });

      result.current.mutate({
        listingId,
        payload: { message: 'Muốn xin món này' },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/listings/${listingId}/requests`,
        { message: 'Muốn xin món này' }
      );

      // Verify specific invalidation targets
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.mineLists() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.listing(listingId) });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.listingLists() });
    });

    it('exposes API errors to caller without swallowing them', async () => {
      const listingId = '11111111-1111-1111-1111-111111111111';
      const mockApiError = new ApiError({
        message: 'Duplicate request submitted',
        status: 400,
        error: 'BAD_REQUEST',
      });
      vi.mocked(apiClient.post).mockRejectedValueOnce(mockApiError);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useCreateRequest(), { wrapper });

      result.current.mutate({ listingId });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBe(mockApiError);
      expect(result.current.error?.message).toBe('Duplicate request submitted');
    });
  });

  describe('useUpdateRequestStatus mutation', () => {
    it('updates status and invalidates request and listing caches on success', async () => {
      const requestId = '33333333-3333-3333-3333-333333333333';
      const acceptedResponse: ListingRequestResponse = {
        ...mockRequestResponse,
        status: 'ACCEPTED',
        listing: {
          ...mockRequestResponse.listing,
          status: 'RESERVED',
        },
      };
      vi.mocked(apiClient.patch).mockResolvedValueOnce(acceptedResponse);

      const { queryClient, wrapper } = createTestWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateRequestStatus(), { wrapper });

      result.current.mutate({
        requestId,
        payload: { status: 'ACCEPTED' },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.patch).toHaveBeenCalledWith(
        `/api/v1/listing-requests/${requestId}/status`,
        { status: 'ACCEPTED' }
      );

      // Invalidate requests
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: requestKeys.all });

      // Invalidate listing details to reflect RESERVED status
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: listingKeys.detail(acceptedResponse.listing.id),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listingKeys.lists() });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: listingKeys.mineLists() });
    });

    it('exposes API errors to caller when updating status fails', async () => {
      const requestId = '33333333-3333-3333-3333-333333333333';
      const mockApiError = new ApiError({
        message: 'Only PENDING requests can be accepted',
        status: 400,
        error: 'BAD_REQUEST',
      });
      vi.mocked(apiClient.patch).mockRejectedValueOnce(mockApiError);

      const { wrapper } = createTestWrapper();
      const { result } = renderHook(() => useUpdateRequestStatus(), { wrapper });

      result.current.mutate({
        requestId,
        payload: { status: 'ACCEPTED' },
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBe(mockApiError);
      expect(result.current.error?.message).toBe('Only PENDING requests can be accepted');
    });
  });
});
