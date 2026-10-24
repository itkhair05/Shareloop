import { apiClient } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import type {
  CancelTransactionRequest,
  TransactionQueryParams,
  TransactionResponse,
} from '@/types/transaction';

/**
 * Service for Transaction operations (dual-confirmation handoff lifecycle and status management).
 * Encapsulates network operations for all verified backend endpoints in TransactionController.
 */
export const transactionApi = {
  /**
   * List transactions for the authenticated user with optional status and role filtering.
   * GET /api/v1/transactions
   */
  async getUserTransactions(
    params?: TransactionQueryParams
  ): Promise<PageResponse<TransactionResponse>> {
    return apiClient.get<PageResponse<TransactionResponse>>('/api/v1/transactions', {
      params,
    });
  },

  /**
   * Get transaction details by ID.
   * GET /api/v1/transactions/{id}
   */
  async getTransactionDetails(id: string): Promise<TransactionResponse> {
    return apiClient.get<TransactionResponse>(
      `/api/v1/transactions/${encodeURIComponent(id)}`
    );
  },

  /**
   * Get active or latest transaction for a listing.
   * GET /api/v1/listings/{listingId}/transaction
   */
  async getListingTransaction(listingId: string): Promise<TransactionResponse> {
    return apiClient.get<TransactionResponse>(
      `/api/v1/listings/${encodeURIComponent(listingId)}/transaction`
    );
  },

  /**
   * Confirm transaction completion.
   * POST /api/v1/transactions/{id}/complete
   */
  async completeTransaction(id: string): Promise<TransactionResponse> {
    return apiClient.post<TransactionResponse>(
      `/api/v1/transactions/${encodeURIComponent(id)}/complete`
    );
  },

  /**
   * Cancel an ongoing transaction with an optional reason.
   * POST /api/v1/transactions/{id}/cancel
   */
  async cancelTransaction(
    id: string,
    payload?: CancelTransactionRequest
  ): Promise<TransactionResponse> {
    return apiClient.post<TransactionResponse, CancelTransactionRequest>(
      `/api/v1/transactions/${encodeURIComponent(id)}/cancel`,
      payload
    );
  },
};

/**
 * React Query Keys for Transactions
 */
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (params?: TransactionQueryParams) => [...transactionKeys.lists(), params] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  listings: () => [...transactionKeys.all, 'listing'] as const,
  listing: (listingId: string) => [...transactionKeys.listings(), listingId] as const,
};

export default transactionApi;
