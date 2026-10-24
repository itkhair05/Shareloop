import React, { useCallback, useEffect, useId, useState } from 'react';
import { AlertCircle, MessageSquare, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCreateRequest } from '../hooks/use-requests';
import { formatPrice } from '@/lib/utils';
import { ApiError } from '@/lib/api-error';
import type { ListingResponse } from '@/types/listing';
import type { ListingRequestResponse } from '@/types/request';

export interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  listing: ListingResponse;
  onSuccess?: (response: ListingRequestResponse) => void;
  onConflict?: () => void;
}

const MAX_MESSAGE_LENGTH = 1000;

export function CreateRequestModal({
  isOpen,
  onClose,
  listing,
  onSuccess,
  onConflict,
}: CreateRequestModalProps) {
  const titleId = useId();
  const descId = useId();
  const textareaId = useId();

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createRequestMutation = useCreateRequest();

  const handleClose = useCallback(() => {
    if (createRequestMutation.isPending) return;
    setMessage('');
    setErrorMessage(null);
    onClose();
  }, [createRequestMutation.isPending, onClose]);

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

  const isGiveaway = listing.listingType === 'GIVEAWAY';
  const modalTitle = isGiveaway
    ? 'Gửi yêu cầu nhận món đồ'
    : 'Gửi đề nghị mua món đồ';

  const actionButtonText = isGiveaway
    ? 'Gửi yêu cầu nhận đồ'
    : 'Gửi đề nghị mua';

  const charCount = message.length;
  const isOverLimit = charCount > MAX_MESSAGE_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOverLimit || createRequestMutation.isPending) return;

    setErrorMessage(null);

    try {
      const response = await createRequestMutation.mutateAsync({
        listingId: listing.id,
        payload: {
          message: message.trim() ? message.trim() : null,
        },
      });

      if (onSuccess) {
        onSuccess(response);
      }
      handleClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (
          err.status === 409 ||
          err.message.toLowerCase().includes('already') ||
          err.message.toLowerCase().includes('duplicate')
        ) {
          setErrorMessage('Bạn đã có một yêu cầu đang chờ phản hồi cho bài đăng này.');
          if (onConflict) {
            onConflict();
          }
        } else if (err.status === 400) {
          setErrorMessage(err.message || 'Yêu cầu không hợp lệ. Vui lòng kiểm tra lại thông tin.');
        } else if (err.status === 403) {
          setErrorMessage('Bạn không thể gửi yêu cầu cho bài đăng của chính mình.');
        } else {
          setErrorMessage(err.message || 'Đã xảy ra lỗi khi gửi yêu cầu. Vui lòng thử lại sau.');
        }
      } else {
        setErrorMessage('Không thể gửi yêu cầu vào lúc này. Vui lòng thử lại sau.');
      }
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !createRequestMutation.isPending) {
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
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
              <MessageSquare className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900 leading-snug">
                {modalTitle}
              </h2>
              <p id={descId} className="text-xs text-slate-500 mt-0.5">
                Chủ bài đăng sẽ nhận được thông báo để xem xét và phản hồi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={createRequestMutation.isPending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Listing Summary Preview */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-slate-500 font-medium truncate">Bài đăng được chọn</div>
            <div className="font-semibold text-slate-900 truncate mt-0.5">{listing.title}</div>
          </div>
          <div className="shrink-0 text-right">
            {isGiveaway ? (
              <Badge variant="success" className="font-semibold text-xs">
                Miễn phí
              </Badge>
            ) : (
              <span className="font-bold text-emerald-700 text-sm">
                {formatPrice(listing.price, listing.currency)}
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor={textareaId}
                className="text-sm font-semibold text-slate-800"
              >
                Lời nhắn gửi đến người đăng{' '}
                <span className="text-xs font-normal text-slate-500">(không bắt buộc)</span>
              </label>
              <span
                className={`text-xs ${
                  isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'
                }`}
                aria-live="polite"
              >
                {charCount}/{MAX_MESSAGE_LENGTH}
              </span>
            </div>

            <textarea
              id={textareaId}
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH + 50}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={createRequestMutation.isPending}
              placeholder={
                isGiveaway
                  ? 'Ví dụ: Chào bạn, mình rất muốn nhận món đồ này cho bé nhà mình. Mình có thể qua lấy vào chiều mai, cảm ơn bạn nhiều!'
                  : 'Ví dụ: Chào bạn, mình quan tâm đến món đồ này và muốn mua. Bạn có thể cho mình xin thời gian thuận tiện để giao dịch không?'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm leading-relaxed transition-all resize-y disabled:bg-slate-50 disabled:opacity-60"
            />
            {isOverLimit && (
              <p className="text-xs text-red-600 mt-1">
                Lời nhắn không được vượt quá {MAX_MESSAGE_LENGTH} ký tự.
              </p>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleClose}
              disabled={createRequestMutation.isPending}
              className="w-full sm:w-auto"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={createRequestMutation.isPending}
              disabled={isOverLimit || createRequestMutation.isPending}
              className="w-full sm:w-auto min-w-[140px]"
            >
              <Send className="w-4 h-4 mr-1.5" aria-hidden="true" />
              <span>{actionButtonText}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateRequestModal;
