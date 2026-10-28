import { useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Copy,
  Eye,
  EyeOff,
  Link as LinkIcon,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  Star,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/utils';
import { useAdminReviewDetail } from '../hooks/use-admin-reviews';

export interface ReviewDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string | null;
  onHideClick?: (reviewId: string) => void;
  onRestoreClick?: (reviewId: string) => void;
}

export function ReviewDetailModal({
  isOpen,
  onClose,
  reviewId,
  onHideClick,
  onRestoreClick,
}: ReviewDetailModalProps) {
  const titleId = useId();
  const descId = useId();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const {
    data: review,
    isLoading,
    isError,
    error,
    refetch,
  } = useAdminReviewDetail(isOpen ? reviewId : null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-slate-800 text-amber-400 shrink-0">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 id={titleId} className="text-base font-bold text-white truncate">
                Chi tiết đánh giá giao dịch
              </h3>
              <p id={descId} className="text-xs text-slate-400 truncate">
                ID: <span className="font-mono text-slate-300">{reviewId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Đóng cửa sổ chi tiết"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs text-slate-500">Đang tải thông tin đánh giá...</p>
            </div>
          )}

          {isError && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 flex flex-col items-center text-center gap-2">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <p className="text-sm font-semibold">Không thể tải chi tiết đánh giá</p>
              <p className="text-xs text-red-600">{error?.message || 'Lỗi kết nối máy chủ'}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-2 inline-flex flex-row items-center justify-center gap-2 h-9 px-4 text-sm font-medium text-red-700 bg-white border border-red-300 hover:bg-red-100 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">Thử lại</span>
              </button>
            </div>
          )}

          {review && (
            <>
              {/* Rating and Visibility Summary Banner */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-6 h-6 shrink-0 ${
                          star <= review.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-lg font-bold text-slate-900 whitespace-nowrap">{review.rating} / 5</span>
                </div>

                <div>
                  {review.isHidden ? (
                    <Badge variant="destructive" className="gap-1.5 py-1 px-3 whitespace-nowrap shrink-0">
                      <EyeOff className="w-3.5 h-3.5 shrink-0" />
                      Đã bị ẩn kiểm duyệt
                    </Badge>
                  ) : (
                    <Badge variant="success" className="gap-1.5 py-1 px-3 whitespace-nowrap shrink-0">
                      <Eye className="w-3.5 h-3.5 shrink-0" />
                      Công khai bình thường
                    </Badge>
                  )}
                </div>
              </div>

              {/* Review Comment Content */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Nội dung nhận xét
                </label>
                <div className="p-4 rounded-lg bg-slate-50/80 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {review.comment ? (
                    review.comment
                  ) : (
                    <span className="italic text-slate-400">Người đánh giá không để lại lời nhận xét dạng văn bản.</span>
                  )}
                </div>
              </div>

              {/* Participants Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reviewer Box */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                      Người đánh giá (Reviewer)
                    </span>
                    {review.reviewerId && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(review.reviewerId!, 'reviewer')}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded"
                        title="Sao chép User ID"
                      >
                        {copiedField === 'reviewer' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">
                      {review.reviewerDisplayName || 'Chưa cập nhật'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {review.reviewerEmail || '—'}
                    </div>
                  </div>
                </div>

                {/* Reviewee Box */}
                <div className="p-4 rounded-lg border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                      Người nhận đánh giá (Reviewee)
                    </span>
                    {review.revieweeId && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(review.revieweeId!, 'reviewee')}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded"
                        title="Sao chép User ID"
                      >
                        {copiedField === 'reviewee' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm">
                      {review.revieweeDisplayName || 'Chưa cập nhật'}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      {review.revieweeEmail || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction Context */}
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-slate-500" />
                    Bối cảnh giao dịch hoàn tất
                  </span>
                  <Badge variant="outline" className="text-[11px] whitespace-nowrap shrink-0">
                    {review.transactionStatus || 'COMPLETED'}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 flex items-center justify-between">
                  <span className="font-mono text-slate-500">Mã giao dịch: {review.transactionId || '—'}</span>
                  {review.transactionId && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(review.transactionId!, 'tx')}
                      className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-[11px] whitespace-nowrap shrink-0"
                    >
                      {copiedField === 'tx' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          Đã chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 shrink-0" />
                          Sao chép ID
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Moderation Audit Metadata (if hidden) */}
              {review.isHidden && (
                <div className="p-4 rounded-xl bg-red-50/60 border border-red-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-red-800 font-semibold text-xs uppercase tracking-wider">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    Nhật ký kiểm duyệt của ban quản trị
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Quản trị viên thực hiện:</span>
                      <span className="font-medium text-slate-900">
                        {review.moderatedByDisplayName || 'Ban quản trị'} (ID: {review.moderatedById || '—'})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Thời gian ẩn:</span>
                      <span className="font-medium text-slate-900">
                        {formatDateTime(review.moderatedAt)}
                      </span>
                    </div>
                  </div>

                  {review.moderationReason && (
                    <div className="pt-2 border-t border-red-200/60">
                      <span className="text-xs font-semibold text-red-900 block mb-1">
                        Lý do kiểm duyệt:
                      </span>
                      <p className="text-xs text-red-800 bg-white/80 p-2.5 rounded border border-red-200/60">
                        {review.moderationReason}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  Ngày tạo: {formatDateTime(review.createdAt)}
                </span>
                <span className="whitespace-nowrap">Cập nhật: {formatDateTime(review.updatedAt)}</span>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions - Dùng thẻ button thuần */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 gap-3">
          <div>
            {review && !review.isHidden && onHideClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onHideClick(review.id);
                }}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-9 px-3.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm"
              >
                <EyeOff className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Ẩn đánh giá này</span>
              </button>
            )}
            {review && review.isHidden && onRestoreClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRestoreClick(review.id);
                }}
                className="inline-flex flex-row items-center justify-center gap-1.5 h-9 px-3.5 text-sm font-semibold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Eye className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="whitespace-nowrap">Khôi phục hiển thị</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex flex-row items-center justify-center h-9 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span className="whitespace-nowrap">Đóng</span>
          </button>
        </div>
      </div>
    </div>
  );
}