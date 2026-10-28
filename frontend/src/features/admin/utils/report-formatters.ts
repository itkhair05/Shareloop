import type { ReportCategory, ReportStatus, ReportTargetType } from '@/types/report';

export function formatTargetType(type: ReportTargetType): { label: string; variant: 'outline' | 'warning' | 'neutral' } {
  switch (type) {
    case 'USER':
      return { label: 'Người dùng', variant: 'outline' };
    case 'LISTING':
      return { label: 'Tin đăng', variant: 'neutral' };
    case 'TRANSACTION':
      return { label: 'Giao dịch', variant: 'warning' };
    case 'REVIEW':
      return { label: 'Đánh giá', variant: 'outline' };
    default:
      return { label: type, variant: 'neutral' };
  }
}

export function formatReportCategory(cat: ReportCategory): string {
  switch (cat) {
    case 'FRAUD_OR_SCAM':
      return 'Lừa đảo / Gian lận';
    case 'HARASSMENT':
      return 'Quấy rối / Công kích';
    case 'ITEM_MISREPRESENTED':
      return 'Hàng sai lệch mô tả';
    case 'NO_SHOW_OR_UNRESPONSIVE':
      return 'Không đến / Không phản hồi';
    case 'PROHIBITED_ITEM':
      return 'Hàng cấm / Vi phạm quy định';
    case 'OTHER':
      return 'Khác';
    default:
      return cat;
  }
}

export function formatReportStatus(status: ReportStatus): { label: string; variant: 'warning' | 'outline' | 'success' | 'neutral' } {
  switch (status) {
    case 'PENDING':
      return { label: 'Chờ xử lý', variant: 'warning' };
    case 'INVESTIGATING':
      return { label: 'Đang điều tra', variant: 'outline' };
    case 'RESOLVED':
      return { label: 'Đã giải quyết', variant: 'success' };
    case 'DISMISSED':
      return { label: 'Đã bác bỏ', variant: 'neutral' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function getPermittedStatusTransitions(currentStatus: ReportStatus): ReportStatus[] {
  switch (currentStatus) {
    case 'PENDING':
      return ['INVESTIGATING', 'RESOLVED', 'DISMISSED'];
    case 'INVESTIGATING':
      return ['RESOLVED', 'DISMISSED'];
    case 'RESOLVED':
    case 'DISMISSED':
      return ['INVESTIGATING'];
    default:
      return [];
  }
}

export function getStatusLabel(status: ReportStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Chờ xử lý (PENDING)';
    case 'INVESTIGATING':
      return 'Đang điều tra (INVESTIGATING)';
    case 'RESOLVED':
      return 'Đã giải quyết (RESOLVED)';
    case 'DISMISSED':
      return 'Bác bỏ khiếu nại (DISMISSED)';
    default:
      return status;
  }
}
