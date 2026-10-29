import { apiClient } from '@/lib/api-client';
import type {
  AdminTransactionQueryParams,
  AdminTransactionsPageResponse,
} from '@/types/admin-transaction';

export const adminTransactionQueryKeys = {
  all: ['admin', 'transactions'] as const,
  lists: () => [...adminTransactionQueryKeys.all, 'list'] as const,
  list: (params?: AdminTransactionQueryParams) =>
    [...adminTransactionQueryKeys.lists(), params] as const,
  details: () => [...adminTransactionQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminTransactionQueryKeys.details(), id] as const,
};

export const adminTransactionsApi = {
  getAdminTransactions: async (
    params?: AdminTransactionQueryParams
  ): Promise<AdminTransactionsPageResponse> => {
    return apiClient.get<AdminTransactionsPageResponse>(
      '/api/v1/admin/transactions',
      { params }
    );
  },
};

export default adminTransactionsApi;
