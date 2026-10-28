import type { SupportCategory, SupportRequestStatus } from '@/types/support';

export function formatSupportStatus(status: SupportRequestStatus): {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'neutral';
} {
  switch (status) {
    case 'PENDING':
      return { label: 'Chờ xử lý', variant: 'warning' };
    case 'IN_PROGRESS':
      return { label: 'Đang xử lý', variant: 'outline' };
    case 'RESOLVED':
      return { label: 'Đã giải quyết', variant: 'success' };
    case 'CLOSED':
      return { label: 'Đã đóng', variant: 'neutral' };
    default:
      return { label: status, variant: 'neutral' };
  }
}

export function formatSupportCategory(category: SupportCategory): {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'outline' | 'neutral';
} {
  switch (category) {
    case 'TRANSACTION_ISSUE':
      return { label: 'Sự cố giao dịch', variant: 'warning' };
    case 'ACCOUNT_ISSUE':
      return { label: 'Vấn đề tài khoản', variant: 'outline' };
    case 'SAFETY_CONCERN':
      return { label: 'Mối ngại an toàn / Gian lận', variant: 'destructive' };
    case 'OTHER':
      return { label: 'Yêu cầu khác', variant: 'neutral' };
    default:
      return { label: category, variant: 'neutral' };
  }
}
