import type { PageResponse } from './api';

export type ReportTargetType = 'USER' | 'LISTING' | 'TRANSACTION' | 'REVIEW';

export type ReportCategory =
  | 'FRAUD_OR_SCAM'
  | 'HARASSMENT'
  | 'ITEM_MISREPRESENTED'
  | 'NO_SHOW_OR_UNRESPONSIVE'
  | 'PROHIBITED_ITEM'
  | 'OTHER';

export type ReportStatus =
  | 'PENDING'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'DISMISSED';

export interface CreateReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  description: string;
}

export interface ReportResponse {
  id: string;
  reporterId?: string;
  reporterDisplayName?: string;
  reporterAvatarUrl?: string | null;
  targetType: ReportTargetType;
  targetId: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyReportsParams {
  status?: ReportStatus;
  page?: number;
  size?: number;
}

export type MyReportsPage = PageResponse<ReportResponse>;
