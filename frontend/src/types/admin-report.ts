import type { PageResponse } from './api';
import type { ReportCategory, ReportStatus, ReportTargetType } from './report';

export interface AdminReportResponse {
  id: string;
  reporterId?: string;
  reporterDisplayName?: string;
  reporterEmail?: string;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
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
