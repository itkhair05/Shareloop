/**
 * Listing Types matching the ShareLoop Spring Boot backend DTOs
 * Source of truth:
 * - com.shareloop.entity.enums.ListingType
 * - com.shareloop.entity.enums.ListingStatus
 * - com.shareloop.dto.listing.OwnerSummaryDto
 * - com.shareloop.dto.listing.CategorySummaryDto
 * - com.shareloop.dto.listing.ListingImageDto
 * - com.shareloop.dto.listing.ListingSummaryResponse
 * - com.shareloop.dto.listing.ListingResponse
 * - com.shareloop.dto.listing.CreateListingRequest
 * - com.shareloop.dto.listing.UpdateListingRequest
 */

export type ListingType = 'GIVEAWAY' | 'SALE' | 'WANTED';

export type ListingStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'RESERVED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REMOVED';

export interface OwnerSummaryDto {
  id: string;
  displayName: string;
}

export type OwnerSummary = OwnerSummaryDto;

export interface CategorySummaryDto {
  id: string;
  name: string;
  slug: string;
}

export type CategorySummary = CategorySummaryDto;

export interface ListingImageDto {
  id?: string;
  imageUrl: string;
  sortOrder?: number;
}

export type ListingImage = ListingImageDto;

/**
 * Summary DTO used in paginated listing feeds (GET /api/v1/listings, GET /api/v1/listings/mine)
 */
export interface ListingSummaryResponse {
  id: string;
  owner: OwnerSummaryDto;
  category: CategorySummaryDto;
  listingType: ListingType;
  title: string;
  price: number | null;
  currency: string | null;
  status: ListingStatus;
  city: string | null;
  country: string | null;
  primaryImageUrl: string | null;
  createdAt: string;
}

/**
 * Backward compatibility alias for ListingSummaryResponse
 */
export type ListingSummary = ListingSummaryResponse;

/**
 * Full detail DTO returned for a single listing (GET /api/v1/listings/{id})
 */
export interface ListingResponse {
  id: string;
  owner: OwnerSummaryDto;
  category: CategorySummaryDto;
  listingType: ListingType;
  title: string;
  description: string;
  price: number | null;
  currency: string | null;
  status: ListingStatus;
  neighborhood: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  images: ListingImageDto[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

/**
 * Backward compatibility alias for ListingResponse
 */
export type ListingDetail = ListingResponse;

/**
 * Query parameters for public listings browsing (GET /api/v1/listings)
 * Note: Backend hardcodes sorting to createdAt DESC, id DESC. No sorting query parameters are supported.
 */
export interface ListingQueryParams {
  keyword?: string;
  type?: ListingType;
  categoryId?: string;
  city?: string;
  status?: ListingStatus;
  page?: number;
  size?: number;
}

/**
 * Request payload for creating a new listing (POST /api/v1/listings)
 */
export interface CreateListingRequest {
  listingType: ListingType;
  title: string;
  description: string;
  categoryId: string;
  price?: number | null;
  currency?: string | null;
  neighborhood?: string | null;
  city: string;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  images?: ListingImageDto[];
}

/**
 * Request payload for updating an existing listing (PUT /api/v1/listings/{id})
 */
export interface UpdateListingRequest {
  listingType?: ListingType;
  title?: string;
  description?: string;
  categoryId?: string;
  price?: number | null;
  currency?: string | null;
  status?: ListingStatus;
  neighborhood?: string | null;
  city?: string;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
  images?: ListingImageDto[];
}
