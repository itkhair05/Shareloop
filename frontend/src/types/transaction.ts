import type { ListingReferenceDto } from './review';

/**
 * Transaction Status matching com.shareloop.entity.enums.TransactionStatus
 */
export type TransactionStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

/**
 * Transaction Participant Role Filter matching com.shareloop.service.TransactionService
 */
export type TransactionRoleFilter = 'owner' | 'requester';

/**
 * Participant Role calculated in TransactionResponse for the current user
 */
export type TransactionMyRole = 'OWNER' | 'REQUESTER' | 'ADMIN' | 'OTHER' | string;

/**
 * User summary DTO returned inside TransactionResponse (owner, requester, cancelledBy)
 * Backend DTO: com.shareloop.dto.chat.UserSummaryDto
 */
export interface TransactionUserSummaryDto {
  id: string;
  displayName: string;
}

/**
 * Request payload for cancelling an ongoing transaction.
 * POST /api/v1/transactions/{id}/cancel
 * Backend DTO: com.shareloop.dto.transaction.CancelTransactionRequest
 */
export interface CancelTransactionRequest {
  /** Optional cancellation reason (max 500 characters; mandatory for ADMIN) */
  reason?: string | null;
}

/**
 * Query parameters for listing user transactions.
 * GET /api/v1/transactions
 */
export interface TransactionQueryParams {
  status?: TransactionStatus;
  role?: TransactionRoleFilter | string;
  page?: number;
  size?: number;
}

/**
 * Response DTO returned by Transaction endpoints.
 * Backend DTO: com.shareloop.dto.transaction.TransactionResponse
 */
export interface TransactionResponse {
  id: string;
  listing: ListingReferenceDto;
  listingRequestId: string | null;
  owner: TransactionUserSummaryDto;
  requester: TransactionUserSummaryDto;
  status: TransactionStatus;
  ownerCompleted: boolean;
  requesterCompleted: boolean;
  ownerCompletedAt: string | null;
  requesterCompletedAt: string | null;
  myRole: TransactionMyRole;
  myCompleted: boolean | null;
  cancelledBy: TransactionUserSummaryDto | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}
