import { Calendar, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import type { ReportCategory, ReportResponse, ReportStatus, ReportTargetType } from '@/types/report';

export interface ReportCardProps {
  report: ReportResponse;
  onSelect: (report: ReportResponse) => void;
}

export const REPORT_STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; variant: 'warning' | 'default' | 'success' | 'neutral' }
> = {
  PENDING: { label: 'Chờ xử lý', variant: 'warning' },
  INVESTIGATING: { label: 'Đang điều tra', variant: 'default' },
  RESOLVED: { label: 'Đã xử lý', variant: 'success' },
  DISMISSED: { label: 'Đã bác bỏ', variant: 'neutral' },
};

export const REPORT_TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  USER: 'Người dùng',
  LISTING: 'Tin đăng',
  TRANSACTION: 'Giao dịch',
  REVIEW: 'Đánh giá',
};

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  FRAUD_OR_SCAM: 'Lừa đảo / Gian lận',
  HARASSMENT: 'Quấy rối / Khiếm nhã',
  ITEM_MISREPRESENTED: 'Sai lệch thực tế',
  NO_SHOW_OR_UNRESPONSIVE: 'Bùng hẹn',
  PROHIBITED_ITEM: 'Đồ dùng bị cấm',
  OTHER: 'Lý do khác',
};

export function ReportCard({ report, onSelect }: ReportCardProps) {
  const statusInfo = REPORT_STATUS_CONFIG[report.status];
  const targetLabel = REPORT_TARGET_TYPE_LABELS[report.targetType];
  const categoryLabel = REPORT_CATEGORY_LABELS[report.category];

  return (
    <article
      onClick={() => onSelect(report)}
      className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-red-300 transition-all cursor-pointer space-y-3 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {targetLabel}
            </span>
            <Badge variant={statusInfo.variant} withDot className="text-[11px]">
              {statusInfo.label}
            </Badge>
            <span className="text-[11px] text-slate-500 font-medium">
              Mục: {categoryLabel}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 group-hover:text-red-700 transition-colors line-clamp-1">
            Báo cáo {targetLabel} #{report.targetId.substring(0, 8)}
          </h3>
        </div>
        <ChevronRight
          className="w-5 h-5 text-slate-400 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
          aria-hidden="true"
        />
      </div>

      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
        {report.description}
      </p>

      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
          {formatDateTime(report.createdAt)}
        </span>
        <span>Mã báo cáo: #{report.id.substring(0, 8)}</span>
      </div>
    </article>
  );
}

export default ReportCard;
