import { AxiosError } from 'axios';
import { apiClient, rawAxiosClient } from '@/lib/api-client';
import { ApiError, normalizeApiError } from '@/lib/api-error';
import { parseContentDispositionFilename } from '@/lib/file-download';
import type { PageResponse } from '@/types/api';
import type {
  CancelTransactionRequest,
  TransactionQueryParams,
  TransactionResponse,
} from '@/types/transaction';

/**
 * PDF proof document downloaded for a COMPLETED transaction.
 */
export interface TransactionProofDownload {
  blob: Blob;
  filename: string;
}

/**
 * Error responses for the proof endpoint arrive as JSON inside a Blob
 * (the request uses responseType 'blob'), so they must be parsed manually
 * before they can be normalized into an ApiError.
 */
async function normalizeProofDownloadError(error: unknown): Promise<ApiError> {
  if (
    error instanceof AxiosError &&
    error.response?.data instanceof Blob
  ) {
    const status = error.response.status ?? 500;
    let message = 'Transaction proof download failed';
    try {
      const parsed = JSON.parse(await error.response.data.text()) as {
        message?: string;
      };
      if (parsed?.message) message = parsed.message;
    } catch {
      // Keep the generic message when the Blob body is not readable JSON.
    }
    return new ApiError({
      message,
      status,
      error: 'Request failed',
    });
  }
  return normalizeApiError(error);
}

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

  /**
   * Download the PDF confirmation document for a COMPLETED transaction.
   * GET /api/v1/transactions/{id}/proof
   * Errors arrive as JSON inside a Blob and are normalized into ApiError.
   */
  async downloadTransactionProof(id: string): Promise<TransactionProofDownload> {
    try {
      const response = await rawAxiosClient.get<Blob>(
        `/api/v1/transactions/${encodeURIComponent(id)}/proof`,
        {
          responseType: 'blob',
          headers: { Accept: 'application/pdf, application/json' },
        }
      );

      const rawDisposition = response.headers?.['content-disposition'];
      const disposition = Array.isArray(rawDisposition) ? rawDisposition[0] : rawDisposition;

      return {
        blob: response.data,
        filename:
          parseContentDispositionFilename(
            typeof disposition === 'string' ? disposition : null
          ) ?? `shareloop-transaction-proof-${id}.pdf`,
      };
    } catch (error) {
      throw await normalizeProofDownloadError(error);
    }
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
