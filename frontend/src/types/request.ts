import type { ListingReferenceDto } from './review';

/**
 * Listing Request Status matching com.shareloop.entity.enums.ListingRequestStatus
 */
export type ListingRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED';

/**
 * Restricted status transitions accepted by the PATCH /api/v1/listing-requests/{id}/status endpoint.
 * The backend only permits ACCEPTED or REJECTED.
 */
export type UpdateListingRequestTargetStatus = 'ACCEPTED' | 'REJECTED';

/**
 * Request payload for submitting a request for a listing.
 * POST /api/v1/listings/{listingId}/requests
 * Backend DTO: com.shareloop.dto.request.CreateListingRequestDto
 */
export interface CreateListingRequestDto {
  /** Optional message with max 1000 characters */
  message?: string | null;
}

/**
 * Request payload for updating a listing request status.
 * PATCH /api/v1/listing-requests/{requestId}/status
 * Backend DTO: com.shareloop.dto.request.UpdateListingRequestStatusRequest
 */
export interface UpdateListingRequestStatusRequest {
  status: UpdateListingRequestTargetStatus;
}

/**
 * Requester summary nested in ListingRequestResponse.
 * Backend DTO: com.shareloop.dto.request.RequesterSummaryDto
 */
export interface RequesterSummaryDto {
  id: string;
  displayName: string;
}

/**
 * Response DTO returned by Listing Request endpoints.
 * Backend DTO: com.shareloop.dto.request.ListingRequestResponse
 */
export interface ListingRequestResponse {
  id: string;
  listing: ListingReferenceDto;
  requester: RequesterSummaryDto;
  message: string | null;
  status: ListingRequestStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query parameters for fetching requests for a specific listing.
 * GET /api/v1/listings/{listingId}/requests
 */
export interface ListingRequestsQueryParams {
  status?: ListingRequestStatus;
  page?: number;
  size?: number;
}

/**
 * Query parameters for fetching the current user's submitted requests.
 * GET /api/v1/listing-requests/mine
 */
export interface MyRequestsQueryParams {
  status?: ListingRequestStatus;
  page?: number;
  size?: number;
}
