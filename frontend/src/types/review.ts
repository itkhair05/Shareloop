import type { ListingStatus, ListingType, OwnerSummaryDto } from './listing';

/**
 * Review and Rating Types matching the ShareLoop Spring Boot backend DTOs
 * Source of truth:
 * - com.shareloop.dto.review.UserRatingSummaryResponse
 * - com.shareloop.dto.review.ReviewResponse
 * - com.shareloop.dto.request.ListingReferenceDto
 * - com.shareloop.dto.chat.UserSummaryDto
 */

export interface UserSummaryDto {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface ListingReferenceDto {
  id: string;
  title: string;
  listingType: ListingType;
  status: ListingStatus;
  price: number | null;
  currency: string | null;
  city: string | null;
  owner: OwnerSummaryDto;
}

export interface UserRatingSummaryResponse {
  userId: string;
  averageRating: number | null;
  totalReviews: number;
  starBreakdown: Record<number, number>;
}

export interface ReviewResponse {
  id: string;
  transactionId: string;
  listing: ListingReferenceDto | null;
  reviewer: UserSummaryDto;
  reviewee: UserSummaryDto;
  rating: number; // 1 to 5
  comment: string | null;
  createdAt: string;
}

export interface UserReviewsQueryParams {
  page?: number;
  size?: number;
}

export interface CreateReviewRequest {
  rating: number; // 1 to 5
  comment?: string | null;
}
