import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transactionApi, transactionKeys } from '../api/transaction-api';
import { listingKeys } from '@/features/listings/api/listing-api';
import { requestKeys } from '@/features/requests/api/request-api';
import type { PageResponse } from '@/types/api';
import type {
  CancelTransactionRequest,
  TransactionQueryParams,
  TransactionResponse,
} from '@/types/transaction';
import { isValidUuid } from '@/lib/utils';
import { appConfig } from '@/lib/config';
import type { ApiError } from '@/lib/api-error';

/**
 * Hook to retrieve transactions involving the current authenticated user.
 * Supports status, role, page, and size filtering.
 */
export function useUserTransactions(
  params?: TransactionQueryParams,
  options?: { enabled?: boolean }
) {
  return useQuery<PageResponse<TransactionResponse>, ApiError>({
    queryKey: transactionKeys.list(params),
    queryFn: () => transactionApi.getUserTransactions(params),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 1, // 1 minute
    retry: (failureCount, error) => {
      if (appConfig.isTest) {
        return false;
      }
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to retrieve transaction details by ID.
 * Validates the transaction UUID format before sending network request.
 */
export function useTransactionDetails(
  id?: string,
  options?: { enabled?: boolean }
) {
  const isIdValid = Boolean(id && isValidUuid(id));

  return useQuery<TransactionResponse, ApiError>({
    queryKey: transactionKeys.detail(id ?? ''),
    queryFn: () => transactionApi.getTransactionDetails(id!),
    enabled: (options?.enabled ?? true) && isIdValid,
    staleTime: 1000 * 60 * 1, // 1 minute
    retry: (failureCount, error) => {
      if (appConfig.isTest) {
        return false;
      }
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to retrieve the active or latest transaction associated with a listing.
 * Validates the listing UUID format before sending network request.
 */
export function useListingTransaction(
  listingId?: string,
  options?: { enabled?: boolean }
) {
  const isIdValid = Boolean(listingId && isValidUuid(listingId));

  return useQuery<TransactionResponse, ApiError>({
    queryKey: transactionKeys.listing(listingId ?? ''),
    queryFn: () => transactionApi.getListingTransaction(listingId!),
    enabled: (options?.enabled ?? true) && isIdValid,
    staleTime: 1000 * 60 * 1, // 1 minute
    retry: (failureCount, error) => {
      if (appConfig.isTest) {
        return false;
      }
      if (
        error?.status === 404 ||
        error?.status === 403 ||
        error?.status === 400 ||
        error?.status === 401
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to confirm transaction completion.
 * When both parties confirm, status transitions to COMPLETED and listing status transitions to COMPLETED.
 * On success, invalidates transaction lists/details, listing-associated transaction, and affected listing queries.
 */
export function useCompleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation<TransactionResponse, ApiError, string>({
    mutationFn: (id: string) => transactionApi.completeTransaction(id),
    onSuccess: (updated) => {
      // Invalidate all transaction queries
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.detail(updated.id) });

      if (updated?.listing?.id) {
        queryClient.invalidateQueries({
          queryKey: transactionKeys.listing(updated.listing.id),
        });

        // If completed, listing status transitions to COMPLETED
        if (updated.status === 'COMPLETED') {
          queryClient.invalidateQueries({
            queryKey: listingKeys.detail(updated.listing.id),
          });
          queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
          queryClient.invalidateQueries({ queryKey: listingKeys.mineLists() });
          queryClient.invalidateQueries({ queryKey: requestKeys.all });
        }
      }
    },
  });
}

/**
 * Mutation variables for cancelling a transaction
 */
export interface CancelTransactionVariables {
  id: string;
  payload?: CancelTransactionRequest;
}

/**
 * Hook to cancel an ongoing transaction.
 * On cancellation, transaction and linked listing request transition to CANCELLED,
 * and the listing status is restored from RESERVED to ACTIVE.
 * On success, invalidates transaction, listing, and request queries.
 */
export function useCancelTransaction() {
  const queryClient = useQueryClient();

  return useMutation<TransactionResponse, ApiError, CancelTransactionVariables>({
    mutationFn: ({ id, payload }) => transactionApi.cancelTransaction(id, payload),
    onSuccess: (updated) => {
      // Invalidate all transaction queries
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: transactionKeys.detail(updated.id) });

      if (updated?.listing?.id) {
        queryClient.invalidateQueries({
          queryKey: transactionKeys.listing(updated.listing.id),
        });

        // Listing was restored from RESERVED to ACTIVE
        queryClient.invalidateQueries({
          queryKey: listingKeys.detail(updated.listing.id),
        });
        queryClient.invalidateQueries({ queryKey: listingKeys.lists() });
        queryClient.invalidateQueries({ queryKey: listingKeys.mineLists() });
      }

      // Linked listing request was updated to CANCELLED
      queryClient.invalidateQueries({ queryKey: requestKeys.all });
    },
  });
}
