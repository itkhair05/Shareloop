import type { PageResponse } from './api';

export type SupportCategory =
  | 'TRANSACTION_ISSUE'
  | 'ACCOUNT_ISSUE'
  | 'SAFETY_CONCERN'
  | 'OTHER';

export type SupportRequestStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED';

export interface CreateSupportRequestPayload {
  transactionId?: string | null;
  category: SupportCategory;
  subject: string;
  description: string;
}

export interface SupportRequestResponse {
  id: string;
  requesterId?: string;
  requesterDisplayName?: string;
  transactionId?: string | null;
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportRequestStatus;
  adminResponse?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MySupportRequestsParams {
  status?: SupportRequestStatus;
  page?: number;
  size?: number;
}

export type MySupportRequestsPage = PageResponse<SupportRequestResponse>;
