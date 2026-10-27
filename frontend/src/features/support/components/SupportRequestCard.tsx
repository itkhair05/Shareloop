import { Calendar, ChevronRight, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import type { SupportCategory, SupportRequestResponse, SupportRequestStatus } from '@/types/support';

export interface SupportRequestCardProps {
  request: SupportRequestResponse;
  onSelect: (request: SupportRequestResponse) => void;
}

export const SUPPORT_STATUS_CONFIG: Record<
  SupportRequestStatus,
  { label: string; variant: 'warning' | 'default' | 'success' | 'neutral' }
> = {
  PENDING: { label: 'Chờ xử lý', variant: 'warning' },
  IN_PROGRESS: { label: 'Đang xử lý', variant: 'default' },
  RESOLVED: { label: 'Đã giải quyết', variant: 'success' },
  CLOSED: { label: 'Đã đóng', variant: 'neutral' },
};

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  TRANSACTION_ISSUE: 'Giao dịch',
  ACCOUNT_ISSUE: 'Tài khoản',
  SAFETY_CONCERN: 'An toàn',
  OTHER: 'Khác',
};

export function SupportRequestCard({ request, onSelect }: SupportRequestCardProps) {
  const statusInfo = SUPPORT_STATUS_CONFIG[request.status];
  const categoryLabel = SUPPORT_CATEGORY_LABELS[request.category];

  return (
    <article
      onClick={() => onSelect(request)}
      className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-emerald-300 transition-all cursor-pointer space-y-3 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {categoryLabel}
            </span>
            <Badge variant={statusInfo.variant} withDot className="text-[11px]">
              {statusInfo.label}
            </Badge>
            {request.transactionId && (
              <span className="text-[10px] font-medium text-slate-500">
                GD #{request.transactionId.substring(0, 8)}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
            {request.subject}
          </h3>
        </div>
        <ChevronRight
          className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
          aria-hidden="true"
        />
      </div>

      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
        {request.description}
      </p>

      {request.adminResponse && (
        <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="line-clamp-1">
            <strong className="font-semibold">Phản hồi từ Admin:</strong> {request.adminResponse}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          {formatDateTime(request.createdAt)}
        </span>
        <span className="text-slate-400">Mã: #{request.id.substring(0, 8)}</span>
      </div>
    </article>
  );
}

export default SupportRequestCard;
