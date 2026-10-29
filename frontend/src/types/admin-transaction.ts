import type { PageResponse } from './api';
import type { TransactionStatus } from './transaction';

export interface TransactionUserSummary {
  id: string;
  displayName: string;
}

export interface AdminTransactionResponse {
  id: string;
  listingId: string;
  listingTitle: string;
  listingRequestId: string | null;
  ownerId: string;
  ownerDisplayName: string;
  owner?: TransactionUserSummary;
  requesterId: string;
  requesterDisplayName: string;
  requester?: TransactionUserSummary;
  status: TransactionStatus;
  ownerCompleted: boolean;
  requesterCompleted: boolean;
  ownerCompletedAt: string | null;
  requesterCompletedAt: string | null;
  cancelledById: string | null;
  cancelledByDisplayName: string | null;
  cancelledBy?: TransactionUserSummary | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTransactionQueryParams {
  status?: TransactionStatus;
  search?: string;
  page?: number;
  size?: number;
}

export type AdminTransactionsPageResponse = PageResponse<AdminTransactionResponse>;
