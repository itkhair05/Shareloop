import type { PageResponse } from './api';
import type { AttachmentImage } from './attachment';

export interface AdminReviewResponse {
  id: string;
  rating: number;
  comment: string | null;
  images?: AttachmentImage[];
  createdAt: string;
  updatedAt: string;
  isHidden: boolean;

  // Reviewer details
  reviewerId?: string;
  reviewerDisplayName?: string;
  reviewerEmail?: string;
  reviewerAvatarUrl?: string | null;

  // Reviewee details
  revieweeId?: string;
  revieweeDisplayName?: string;
  revieweeEmail?: string;
  revieweeAvatarUrl?: string | null;

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
