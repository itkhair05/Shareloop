/**
 * Listing Types matching backend models
 */

export type ListingType = 'GIVEAWAY' | 'SALE' | 'WANTED';

export type ListingStatus = 'ACTIVE' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REMOVED';

export interface ListingSummary {
  id: string;
  title: string;
  type: ListingType;
  price?: number | null;
  currency?: string | null;
  status: ListingStatus;
  city?: string | null;
  primaryImageUrl?: string | null;
  createdAt: string;
}
