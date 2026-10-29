import type { PageResponse } from './api';
import type { ListingResponse, ListingStatus, ListingType } from './listing';

export interface AdminListingQueryParams {
  keyword?: string;
  status?: ListingStatus;
  type?: ListingType;
  categoryId?: string;
  ownerId?: string;
  page?: number;
  size?: number;
  sort?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export type AdminListingsPageResponse = PageResponse<ListingResponse>;

export type { ListingResponse, ListingStatus, ListingType };
