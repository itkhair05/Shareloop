import { useEffect, useId } from 'react';
import { Calendar, CheckCircle2, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { AttachmentGallery } from '@/features/attachments';
import type { ReportResponse } from '@/types/report';
import {
  REPORT_CATEGORY_LABELS,
  REPORT_STATUS_CONFIG,
  REPORT_TARGET_TYPE_LABELS,
} from './ReportCard';

export interface ReportDetailModalProps {
  report: ReportResponse | null;
  onClose: () => void;
}

const STATUS_EXPLANATIONS: Record<string, string> = {
  PENDING:
    'Báo cáo đã được gửi tới Ban quản trị và đang xếp hàng chờ kiểm duyệt.',
  INVESTIGATING:
    'Quản trị viên đang xem xét lịch sử tin nhắn, tin đăng hoặc các bằng chứng liên quan.',
  RESOLVED:
    'Ban quản trị đã hoàn tất xử lý và áp dụng biện pháp phù hợp theo Quy chuẩn cộng đồng ShareLoop.',
  DISMISSED:
    'Báo cáo đã được xem xét và khép lại (do không đủ căn cứ vi phạm hoặc vấn đề đã được giải tỏa).',
};

export function ReportDetailModal({ report, onClose }: ReportDetailModalProps) {
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!report) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [report, onClose]);

  useEffect(() => {
    if (report) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [report]);

  if (!report) return null;

  const statusInfo = REPORT_STATUS_CONFIG[report.status];
  const targetLabel = REPORT_TARGET_TYPE_LABELS[report.targetType];
  const categoryLabel = REPORT_CATEGORY_LABELS[report.category];
  const explanation = STATUS_EXPLANATIONS[report.status];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-red-50/20">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {targetLabel}
              </span>
              <Badge variant={statusInfo.variant} withDot className="text-xs">
                {statusInfo.label}
              </Badge>
              <span className="text-xs text-slate-400">Mã: #{report.id.substring(0, 8)}</span>
            </div>
            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              Báo cáo vi phạm {targetLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Metadata Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600">
            <div>
              <span className="text-slate-400 block">Lý do vi phạm:</span>
              <strong className="font-semibold text-slate-800 text-sm">{categoryLabel}</strong>
            </div>
            <div>
              <span className="text-slate-400 block">Mã đối tượng vi phạm:</span>
              <code className="text-[11px] font-mono text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded">
                {report.targetId}
              </code>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>Gửi lúc: {formatDateTime(report.createdAt)}</span>
            </div>
            {report.resolvedAt && (
              <div className="flex items-center gap-1.5 pt-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                <span>Cập nhật: {formatDateTime(report.resolvedAt)}</span>
              </div>
            )}
          </div>

          {/* Status Explanation Card */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs text-emerald-900 flex items-start gap-3 leading-relaxed">
            <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="font-semibold block mb-0.5">Tiến trình xử lý:</strong>
              <span>{explanation}</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Nội dung mô tả bạn đã gửi
            </h3>
            <div
              id={descId}
              className="p-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-line"
            >
              {report.description}
            </div>
          </div>

          {report.images && report.images.length > 0 && (
            <AttachmentGallery
              images={report.images}
              label="Hình ảnh bằng chứng bạn đã gửi"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/30">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReportDetailModal;
