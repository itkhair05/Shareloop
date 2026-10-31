import { useEffect, useId, useState } from 'react';
import { AlertCircle, AlertTriangle, Ban, Loader2, X } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/Button';
import type { AdminTransactionResponse } from '@/types/admin-transaction';
import { useAdminCancelTransaction } from '../hooks/use-admin-transactions';

export interface CancelTransactionDialogProps {
  transaction: AdminTransactionResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CancelTransactionDialog({
  transaction,
  isOpen,
  onClose,
  onSuccess,
}: CancelTransactionDialogProps) {
  const reasonInputId = useId();
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelMutation = useAdminCancelTransaction();



  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !cancelMutation.isPending) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, cancelMutation.isPending]);

  if (!isOpen || !transaction) return null;

  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length > 0 && trimmedReason.length <= 500;
  const isSubmitDisabled = cancelMutation.isPending || !isReasonValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitDisabled) return;

    setErrorMessage(null);

    try {
      await cancelMutation.mutateAsync({
        id: transaction.id,
        payload: {
          reason: trimmedReason,
        },
      });

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể hủy giao dịch. Vui lòng thử lại sau.';
      setErrorMessage(msg);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-transaction-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-red-50/40">
          <div className="flex items-center gap-2.5 text-red-700">
            <div className="p-2 rounded-lg bg-red-100 text-red-700">
              <Ban className="w-5 h-5 shrink-0" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="cancel-transaction-title"
                className="text-base font-bold text-slate-900"
              >
                Hủy giao dịch (Can thiệp Quản trị)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Can thiệp hành chính vào quy trình trao đổi giữa hai thành viên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={cancelMutation.isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Warning Banner */}
          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 flex gap-2.5 text-amber-900 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-950">
                Lưu ý quan trọng:
              </p>
              <p className="text-amber-800 leading-relaxed">
                Hành động này sẽ chuyển trạng thái giao dịch sang <strong>ĐÃ HỦY</strong>,
                hủy yêu cầu bài đăng liên kết và khôi phục bài đăng sang <strong>HOẠT ĐỘNG</strong> (nếu đang giữ chỗ).
                Hành động này <strong>không thể hoàn tác</strong>.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-xs flex gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Transaction Summary Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-slate-500">Mã giao dịch:</span>
              <span className="font-mono font-semibold text-slate-800">
                {transaction.id}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-slate-500">Bài đăng:</span>
              <span className="font-medium text-slate-800 max-w-[260px] truncate" title={transaction.listingTitle}>
                {transaction.listingTitle}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-slate-500">Người tặng:</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <Avatar
                  avatarUrl={transaction.ownerAvatarUrl ?? transaction.owner?.avatarUrl}
                  name={transaction.ownerDisplayName}
                  size="xs"
                  alt={`Ảnh đại diện của ${transaction.ownerDisplayName}`}
                />
                <span>{transaction.ownerDisplayName}</span>
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span className="text-slate-500">Người nhận:</span>
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                <Avatar
                  avatarUrl={transaction.requesterAvatarUrl ?? transaction.requester?.avatarUrl}
                  name={transaction.requesterDisplayName}
                  size="xs"
                  alt={`Ảnh đại diện của ${transaction.requesterDisplayName}`}
                />
                <span>{transaction.requesterDisplayName}</span>
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label
                htmlFor={reasonInputId}
                className="block text-xs font-semibold text-slate-800"
              >
                Lý do can thiệp hủy giao dịch <span className="text-red-500">*</span>
              </label>
              <span
                className={`text-[11px] font-mono ${
                  reason.length > 500 ? 'text-red-600 font-bold' : 'text-slate-400'
                }`}
              >
                {reason.length}/500 ký tự
              </span>
            </div>
            <textarea
              id={reasonInputId}
              rows={4}
              required
              disabled={cancelMutation.isPending}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập lý do chi tiết cho việc hủy giao dịch (bắt buộc đối với quản trị viên, tối đa 500 ký tự)..."
              className="w-full text-xs text-slate-900 border border-slate-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 placeholder:text-slate-400 transition-colors"
            />
            {reason.trim().length === 0 && (
              <p className="text-[11px] text-slate-500">
                Vui lòng cung cấp lý do để ghi nhận nhật ký quản trị và thông báo cho người dùng.
              </p>
            )}
          </div>

          {/* Footer Controls */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={cancelMutation.isPending}
              className="text-xs"
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitDisabled}
              className="text-xs gap-1.5"
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Ban className="w-3.5 h-3.5" />
                  <span>Xác nhận hủy giao dịch</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CancelTransactionDialog;
