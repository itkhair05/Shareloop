import React, { useCallback, useEffect, useId, useState } from 'react';
import { AlertCircle, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCancelTransaction } from '../hooks/use-transactions';
import { ApiError } from '@/lib/api-error';
import type { TransactionResponse } from '@/types/transaction';

export interface CancelTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionResponse;
  isAdmin?: boolean;
  onSuccess?: (response: TransactionResponse) => void;
}

const MAX_REASON_LENGTH = 500;

export function CancelTransactionModal({
  isOpen,
  onClose,
  transaction,
  isAdmin = false,
  onSuccess,
}: CancelTransactionModalProps) {
  const titleId = useId();
  const descId = useId();
  const textareaId = useId();

  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelMutation = useCancelTransaction();

  const handleClose = useCallback(() => {
    if (cancelMutation.isPending) return;
    setReason('');
    setErrorMessage(null);
    onClose();
  }, [cancelMutation.isPending, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Lock body scroll while dialog is open
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

  if (!isOpen) return null;

  const charCount = reason.length;
  const isOverLimit = charCount > MAX_REASON_LENGTH;
  const isReasonEmpty = !reason.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin && isReasonEmpty) {
      setErrorMessage('Quản trị viên bắt buộc phải nhập lý do hủy giao dịch.');
      return;
    }
    if (isOverLimit || cancelMutation.isPending) {
      return;
    }

    setErrorMessage(null);

    try {
      const response = await cancelMutation.mutateAsync({
        id: transaction.id,
        payload: {
          reason: reason.trim() ? reason.trim() : null,
        },
      });

      if (onSuccess) {
        onSuccess(response);
      }
      handleClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setErrorMessage(
            err.message || 'Không thể hủy giao dịch này. Vui lòng kiểm tra lại trạng thái.'
          );
        } else if (err.status === 403) {
          setErrorMessage('Bạn không có quyền hủy giao dịch này.');
        } else if (err.status === 404) {
          setErrorMessage('Giao dịch không tồn tại.');
        } else {
          setErrorMessage(err.message || 'Đã xảy ra lỗi khi hủy giao dịch. Vui lòng thử lại sau.');
        }
      } else {
        setErrorMessage('Không thể hủy giao dịch vào lúc này. Vui lòng thử lại sau.');
      }
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !cancelMutation.isPending) {
          handleClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
              <AlertTriangle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900 leading-snug">
                Hủy giao dịch
              </h2>
              <p id={descId} className="text-xs text-slate-500 mt-0.5">
                Món đồ: {transaction.listing.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={cancelMutation.isPending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Impact Warning Notice */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1.5 leading-relaxed">
          <p className="font-semibold text-amber-950">Lưu ý khi hủy giao dịch:</p>
          <ul className="list-disc list-inside space-y-1 text-amber-900">
            <li>Giao dịch này và yêu cầu nhận đồ liên kết sẽ chuyển sang trạng thái đã hủy.</li>
            <li>Bài đăng sẽ được tự động khôi phục về trạng thái hiển thị công khai để người khác có thể yêu cầu.</li>
          </ul>
        </div>

        {/* Reason Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor={textareaId}
                className="block text-xs font-semibold text-slate-700"
              >
                Lý do hủy giao dịch {isAdmin ? <span className="text-red-500">* (Bắt buộc)</span> : <span className="text-slate-400 font-normal">(Không bắt buộc)</span>}
              </label>
              <span
                className={`text-xs ${
                  isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'
                }`}
              >
                {charCount}/{MAX_REASON_LENGTH}
              </span>
            </div>
            <textarea
              id={textareaId}
              rows={3}
              maxLength={MAX_REASON_LENGTH + 50}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={cancelMutation.isPending}
              placeholder={
                isAdmin
                  ? 'Vui lòng nhập lý do hủy giao dịch từ ban quản trị...'
                  : 'Ví dụ: Người nhận không đến lấy đúng hẹn, hai bên đổi ý, v.v.'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm leading-relaxed transition-all resize-y disabled:bg-slate-50 disabled:opacity-60"
            />
            {isOverLimit && (
              <p className="text-xs text-red-600 mt-1">
                Lý do không được vượt quá {MAX_REASON_LENGTH} ký tự.
              </p>
            )}
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleClose}
              disabled={cancelMutation.isPending}
              className="w-full sm:w-auto"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="md"
              isLoading={cancelMutation.isPending}
              disabled={isOverLimit || cancelMutation.isPending}
              className="w-full sm:w-auto min-w-[140px]"
            >
              <span>Xác nhận hủy giao dịch</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
