import { useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle2, Clock, ExternalLink, MessageSquare, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDateTime } from '@/lib/utils';
import { AttachmentGallery } from '@/features/attachments';
import type { SupportRequestResponse } from '@/types/support';
import { SUPPORT_CATEGORY_LABELS, SUPPORT_STATUS_CONFIG } from './SupportRequestCard';

export interface SupportRequestDetailModalProps {
  request: SupportRequestResponse | null;
  onClose: () => void;
}

export function SupportRequestDetailModal({ request, onClose }: SupportRequestDetailModalProps) {
  const titleId = useId();
  const descId = useId();

  // Escape key handler
  useEffect(() => {
    if (!request) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (request) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [request]);

  if (!request) return null;

  const statusInfo = SUPPORT_STATUS_CONFIG[request.status];
  const categoryLabel = SUPPORT_CATEGORY_LABELS[request.category];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
          <div className="space-y-1 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {categoryLabel}
              </span>
              <Badge variant={statusInfo.variant} withDot className="text-xs">
                {statusInfo.label}
              </Badge>
              <span className="text-xs text-slate-400">Mã: #{request.id.substring(0, 8)}</span>
            </div>
            <h2 id={titleId} className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {request.subject}
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
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 p-3 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>Gửi lúc: {formatDateTime(request.createdAt)}</span>
            </div>
            {request.resolvedAt && (
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                <span>Hoàn tất lúc: {formatDateTime(request.resolvedAt)}</span>
              </div>
            )}
            {request.transactionId && (
              <Link
                to={`/transactions/${request.transactionId}`}
                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold transition-colors ml-auto"
              >
                <span>Xem giao dịch liên quan</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Nội dung yêu cầu của bạn
            </h3>
            <div
              id={descId}
              className="p-4 rounded-2xl bg-white border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-line"
            >
              {request.description}
            </div>
          </div>

          {request.images && request.images.length > 0 && (
            <AttachmentGallery
              images={request.images}
              label="Hình ảnh bạn đã gửi kèm"
            />
          )}

          {/* Admin Public Response */}
          {request.adminResponse ? (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                <span>Phản hồi từ Quản trị viên</span>
              </h3>
              <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 text-sm text-emerald-950 leading-relaxed whitespace-pre-line shadow-2xs">
                {request.adminResponse}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 leading-relaxed">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Yêu cầu của bạn đang được Ban quản trị xem xét. Khi có thông tin mới hoặc câu trả lời, hệ thống sẽ gửi thông báo đến tài khoản của bạn.
              </span>
            </div>
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

export default SupportRequestDetailModal;
