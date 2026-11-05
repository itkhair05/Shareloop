import type { PageResponse } from './api';
import type { AttachmentImage } from './attachment';
import type { ReportCategory, ReportStatus, ReportTargetType } from './report';

export interface AdminReportResponse {
  id: string;
  reporterId?: string;
  reporterDisplayName?: string;
  reporterEmail?: string;
  reporterAvatarUrl?: string | null;
  targetType: ReportTargetType;
  targetId: string;
  targetUserDisplayName?: string | null;
  targetUserAvatarUrl?: string | null;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  images?: AttachmentImage[];
  resolutionNotes?: string | null;
  resolvedById?: string | null;
  resolvedByDisplayName?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminReportsQueryParams {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  category?: ReportCategory;
  page?: number;
  size?: number;
}

export interface UpdateReportAdminRequest {
  status: ReportStatus;
  resolutionNotes?: string;
}

export type AdminReportsPageResponse = PageResponse<AdminReportResponse>;
