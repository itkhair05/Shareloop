import React, { useCallback, useEffect, useId, useState } from 'react';
import { AlertCircle, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/common/Avatar';
import { useCreateReview } from '../hooks/use-reviews';
import { ApiError } from '@/lib/api-error';
import type { ReviewResponse } from '@/types/review';
import type { TransactionResponse } from '@/types/transaction';
import { cn } from '@/lib/utils';

export interface CreateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionResponse;
  onSuccess?: (response: ReviewResponse) => void;
}

const MAX_COMMENT_LENGTH = 1000;

const ratingLabels: Record<number, string> = {
  1: 'Rất không hài lòng (1 sao)',
  2: 'Chưa hài lòng (2 sao)',
  3: 'Bình thường (3 sao)',
  4: 'Hài lòng (4 sao)',
  5: 'Rất tuyệt vời (5 sao)',
};

export function CreateReviewModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}: CreateReviewModalProps) {
  const titleId = useId();
  const descId = useId();
  const textareaId = useId();

  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createReviewMutation = useCreateReview();

  // Determine partner (reviewee) based on current user's role
  const isOwner = transaction.myRole === 'OWNER';
  const partner = isOwner ? transaction.requester : transaction.owner;
  const partnerName = partner.displayName;
  const partnerId = partner.id;

  const handleClose = useCallback(() => {
    if (createReviewMutation.isPending) return;
    setRating(0);
    setHoverRating(0);
    setComment('');
    setErrorMessage(null);
    onClose();
  }, [createReviewMutation.isPending, onClose]);

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

  if (!isOpen) return null;

  const charCount = comment.length;
  const isOverLimit = charCount > MAX_COMMENT_LENGTH;
  const activeRating = hoverRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating < 1 || rating > 5) {
      setErrorMessage('Vui lòng chọn số sao đánh giá (từ 1 đến 5 sao).');
      return;
    }

    if (isOverLimit || createReviewMutation.isPending) return;

    // Backend rule: if comment is provided, it cannot be blank whitespace
    const trimmedComment = comment.trim();
    if (comment.length > 0 && trimmedComment.length === 0) {
      setErrorMessage('Nhận xét không được chỉ chứa khoảng trắng.');
      return;
    }

    setErrorMessage(null);

    try {
      const response = await createReviewMutation.mutateAsync({
        transactionId: transaction.id,
        payload: {
          rating,
          comment: trimmedComment ? trimmedComment : null,
        },
        revieweeId: partnerId,
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
          setErrorMessage('Bạn đã gửi đánh giá cho giao dịch này rồi.');
        } else if (err.status === 400) {
          setErrorMessage(
            err.message || 'Thông tin đánh giá không hợp lệ. Vui lòng kiểm tra lại.'
          );
        } else if (err.status === 403) {
          setErrorMessage('Chỉ người tham gia giao dịch mới có quyền gửi đánh giá.');
        } else {
          setErrorMessage(err.message || 'Đã xảy ra lỗi khi gửi đánh giá. Vui lòng thử lại sau.');
        }
      } else {
        setErrorMessage('Không thể gửi đánh giá vào lúc này. Vui lòng thử lại sau.');
      }
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !createReviewMutation.isPending) {
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
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900 leading-snug">
                Đánh giá giao dịch
              </h2>
              <p id={descId} className="text-xs text-slate-500 mt-0.5">
                Món đồ: <span className="font-medium text-slate-700">{transaction.listing.title}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={createReviewMutation.isPending}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Partner Info Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3">
            <Avatar
              avatarUrl={partner.avatarUrl}
              name={partnerName}
              size="sm"
              alt={`Ảnh đại diện của ${partnerName}`}
              className="shrink-0 shadow-xs"
            />
            <div className="text-xs text-slate-600 space-y-0.5 min-w-0">
              <p>
                Bạn đang đánh giá trải nghiệm trao đổi với:{' '}
                <strong className="text-slate-900 font-semibold">{partnerName}</strong>.
              </p>
              <p className="text-slate-500">
                Đánh giá của bạn sẽ giúp cộng đồng ShareLoop tin cậy và gắn kết hơn.
              </p>
            </div>
          </div>

          {/* Star Rating Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Mức độ hài lòng <span className="text-red-500">* (Bắt buộc)</span>
            </label>
            <div
              role="group"
              aria-label="Đánh giá số sao"
              className="flex items-center gap-1.5"
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = star <= activeRating;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      setRating(star);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    disabled={createReviewMutation.isPending}
                    aria-label={`${star} sao`}
                    aria-pressed={rating === star}
                    className="p-1.5 rounded-lg hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Star
                      className={cn(
                        'w-7 h-7 transition-transform active:scale-95',
                        isFilled
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200 fill-slate-100 hover:text-amber-300'
                      )}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
              {activeRating > 0 && (
                <span className="text-xs font-medium text-amber-700 ml-2 animate-in fade-in">
                  {ratingLabels[activeRating]}
                </span>
              )}
            </div>
          </div>

          {/* Comment Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor={textareaId}
                className="block text-xs font-semibold text-slate-700"
              >
                Nhận xét chi tiết <span className="text-slate-400 font-normal">(Không bắt buộc)</span>
              </label>
              <span
                className={cn(
                  'text-xs',
                  isOverLimit ? 'text-red-600 font-bold' : 'text-slate-400'
                )}
              >
                {charCount}/{MAX_COMMENT_LENGTH}
              </span>
            </div>
            <textarea
              id={textareaId}
              rows={4}
              maxLength={MAX_COMMENT_LENGTH + 50}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              disabled={createReviewMutation.isPending}
              placeholder="Chia sẻ cảm nhận của bạn về sự đúng hẹn, tình trạng món đồ, và thái độ trao đổi..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm leading-relaxed transition-all resize-y disabled:bg-slate-50 disabled:opacity-60"
            />
            {isOverLimit && (
              <p className="text-xs text-red-600 mt-1">
                Nhận xét không được vượt quá {MAX_COMMENT_LENGTH} ký tự.
              </p>
            )}
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5 animate-in fade-in"
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
              disabled={createReviewMutation.isPending}
              className="w-full sm:w-auto"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={createReviewMutation.isPending}
              disabled={isOverLimit || createReviewMutation.isPending}
              className="w-full sm:w-auto min-w-[140px] flex flex-row items-center justify-center gap-2 [&>span]:flex [&>span]:flex-row [&>span]:items-center [&>span]:gap-1.5"
            >
              <span>Gửi đánh giá</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateReviewModal;
