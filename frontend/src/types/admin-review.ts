import type { PageResponse } from './api';

export interface AdminReviewResponse {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  isHidden: boolean;

  // Reviewer details
  reviewerId?: string;
  reviewerDisplayName?: string;
  reviewerEmail?: string;

  // Reviewee details
  revieweeId?: string;
  revieweeDisplayName?: string;
  revieweeEmail?: string;

  // Transaction details
  transactionId?: string;
  transactionStatus?: string;

  // Moderation audit details
  moderatedById?: string | null;
  moderatedByDisplayName?: string | null;
  moderatedAt?: string | null;
  moderationReason?: string | null;
}

export interface AdminReviewsQueryParams {
  isHidden?: boolean;
  rating?: number;
  search?: string;
  page?: number;
  size?: number;
  sortBy?: 'createdAt' | 'rating' | 'isHidden';
  sortDirection?: 'asc' | 'desc';
}

export interface ModerateReviewRequest {
  reason: string;
}

export type AdminReviewsPageResponse = PageResponse<AdminReviewResponse>;
