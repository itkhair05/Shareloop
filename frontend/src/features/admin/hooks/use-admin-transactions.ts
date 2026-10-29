import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminTransactionsApi, adminTransactionQueryKeys } from '../api/admin-transactions-api';
import { transactionApi } from '@/features/transactions/api/transaction-api';
import type { AdminTransactionQueryParams } from '@/types/admin-transaction';
import type { CancelTransactionRequest } from '@/types/transaction';

export function useAdminTransactions(params: AdminTransactionQueryParams = {}) {
  return useQuery({
    queryKey: adminTransactionQueryKeys.list(params),
    queryFn: () => adminTransactionsApi.getAdminTransactions(params),
  });
}

export function useAdminTransactionDetail(id: string | null) {
  return useQuery({
    queryKey: adminTransactionQueryKeys.detail(id || ''),
    queryFn: () => transactionApi.getTransactionDetails(id!),
    enabled: !!id,
  });
}

export function useAdminCancelTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: CancelTransactionRequest;
    }) => transactionApi.cancelTransaction(id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: adminTransactionQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: adminTransactionQueryKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}
