import { useEffect, useId, useState } from 'react';
import { EyeOff, AlertTriangle, X } from 'lucide-react';

export interface HideReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  reviewId: string | null;
  isLoading?: boolean;
}

export function HideReviewDialog({
  isOpen,
  onClose,
  onConfirm,
  reviewId,
  isLoading = false,
}: HideReviewDialogProps) {
  const titleId = useId();
  const descId = useId();
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleClose = () => {
    setReason('');
    setValidationError(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setValidationError('Vui lòng nhập lý do kiểm duyệt ẩn đánh giá.');
      return;
    }
    if (trimmed.length > 500) {
      setValidationError('Lý do kiểm duyệt không được vượt quá 500 ký tự.');
      return;
    }
    setValidationError(null);
    onConfirm(trimmed);
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
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
              <EyeOff className="w-5 h-5 text-red-400" />
            </div>
            <h3 id={titleId} className="text-base font-bold text-white">
              Ẩn kiểm duyệt đánh giá
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Tác động hệ thống:</strong> Đánh giá này sẽ bị ẩn ngay lập tức khỏi hồ sơ công khai của người dùng và <em>tự động loại trừ khỏi điểm trung bình cũng như tổng số lượng đánh giá sao</em>.
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="moderation-reason"
                className="text-xs font-semibold text-slate-700 block"
              >
                Lý do kiểm duyệt <span className="text-red-500">*</span>
              </label>
              <textarea
                id="moderation-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isLoading}
                placeholder="Ví dụ: Sử dụng từ ngữ thô tục, công kích cá nhân, thông tin gian dối vi phạm quy chuẩn cộng đồng..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none transition-colors disabled:bg-slate-100"
                maxLength={500}
                required
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>{validationError ? <span className="text-red-600 font-medium">{validationError}</span> : 'Bắt buộc từ 1 đến 500 ký tự'}</span>
                <span>{reason.trim().length} / 500</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 font-mono">
              Review ID: {reviewId}
            </div>
          </div>

          {/* Footer - Dùng thẻ button thuần để triệt tiêu lỗi rớt dòng */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-row flex-nowrap items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="inline-flex flex-row items-center justify-center h-10 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="whitespace-nowrap">Hủy bỏ</span>
            </button>
            <button
              type="submit"
              disabled={isLoading || !reason.trim()}
              className="inline-flex flex-row items-center justify-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <svg className="animate-spin w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <EyeOff className="w-4 h-4 shrink-0" />
              )}
              <span className="whitespace-nowrap">
                {isLoading ? 'Đang xử lý...' : 'Xác nhận ẩn đánh giá'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default HideReviewDialog;