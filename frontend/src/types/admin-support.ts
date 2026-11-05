import type { SupportCategory, SupportRequestStatus } from './support';
import type { PageResponse } from './api';
import type { AttachmentImage } from './attachment';

export interface AdminSupportRequestResponse {
  id: string;
  requesterId?: string;
  requesterDisplayName?: string;
  requesterEmail?: string;
  transactionId?: string | null;
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportRequestStatus;
  images?: AttachmentImage[];
  adminResponse?: string | null;
  adminNotes?: string | null;
  resolvedById?: string | null;
  resolvedByDisplayName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSupportRequestsQueryParams {
  status?: SupportRequestStatus;
  category?: SupportCategory;
  page?: number;
  size?: number;
}

export interface UpdateSupportRequestAdminRequest {
  status?: SupportRequestStatus;
  adminResponse?: string;
  adminNotes?: string;
}

export type AdminSupportRequestsPageResponse = PageResponse<AdminSupportRequestResponse>;
