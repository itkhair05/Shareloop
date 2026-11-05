import React, { useCallback, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCreateReport } from '../hooks/use-reports';
import {
  ImageAttachmentPicker,
  useImageAttachments,
} from '@/features/attachments';
import type { ReportCategory, ReportResponse, ReportTargetType } from '@/types/report';
import { ApiError } from '@/lib/api-error';

export interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle?: string;
  onSuccess?: (response: ReportResponse) => void;
}

const CATEGORY_CONFIG: Record<ReportCategory, { label: string; description: string }> = {
  FRAUD_OR_SCAM: {
    label: 'Lừa đảo / Gian lận',
    description: 'Yêu cầu chuyển cọc, hành vi trục lợi hoặc thông tin giả mạo',
  },
  HARASSMENT: {
    label: 'Quấy rối / Khiếm nhã',
    description: 'Ngôn từ xúc phạm, đe dọa hoặc làm phiền không văn minh',
  },
  ITEM_MISREPRESENTED: {
    label: 'Món đồ sai lệch thực tế',
    description: 'Hàng giả, hàng hỏng hóc nặng khác xa so với ảnh và mô tả',
  },
  NO_SHOW_OR_UNRESPONSIVE: {
    label: 'Bùng hẹn / Không phản hồi',
    description: 'Không đến điểm hẹn bàn giao đã thỏa thuận, biến mất không báo trước',
  },
  PROHIBITED_ITEM: {
    label: 'Đồ dùng bị cấm / Hạn chế',
    description: 'Vật phẩm cấm lưu hành, nguy hiểm, vũ khí hoặc chất kích thích',
  },
  OTHER: {
    label: 'Lý do khác',
    description: 'Các vi phạm quy chuẩn cộng đồng khác chưa được liệt kê',
  },
};

const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  USER: 'người dùng',
  LISTING: 'tin đăng',
  TRANSACTION: 'giao dịch',
  REVIEW: 'đánh giá',
};

const MAX_DESCRIPTION_LENGTH = 2000;

export function CreateReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
  onSuccess,
}: CreateReportModalProps) {
  const navigate = useNavigate();
  const titleId = useId();
  const descId = useId();

  const [category, setCategory] = useState<ReportCategory>('FRAUD_OR_SCAM');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicateActiveReport, setIsDuplicateActiveReport] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<ReportResponse | null>(null);

  const createMutation = useCreateReport();
  const attachments = useImageAttachments({ purpose: 'REPORT' });
  const clearAttachments = attachments.clear;

  useEffect(() => {
    if (isOpen) {
      setCategory('FRAUD_OR_SCAM');
      setDescription('');
      setErrorMessage(null);
      setIsDuplicateActiveReport(false);
      setSubmittedReport(null);
      clearAttachments();
    }
  }, [isOpen, targetType, targetId, clearAttachments]);

  const handleClose = useCallback(() => {
    if (createMutation.isPending) return;
    clearAttachments();
    onClose();
  }, [clearAttachments, createMutation.isPending, onClose]);

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

  // Lock body scroll
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

  const isDescriptionBlank = !description.trim();
  const isDescriptionOver = description.length > MAX_DESCRIPTION_LENGTH;
  const targetLabel = TARGET_TYPE_LABELS[targetType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsDuplicateActiveReport(false);

    if (isDescriptionBlank) {
      setErrorMessage('Vui lòng nhập lý do và mô tả chi tiết vi phạm.');
      return;
    }
    if (isDescriptionOver) {
      setErrorMessage(`Mô tả không được vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự.`);
      return;
    }
    if (!attachments.canSubmit) {
      setErrorMessage(
        'Vui lòng chờ ảnh tải lên hoàn tất hoặc xử lý ảnh tải lên thất bại trước khi gửi.'
      );
      return;
    }

    try {
      const imageIds = attachments.getImageIds();
      const response = await createMutation.mutateAsync({
        targetType,
        targetId,
        category,
        description: description.trim(),
        ...(imageIds.length > 0 ? { imageIds } : {}),
      });

      setSubmittedReport(response);
      onSuccess?.(response);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setIsDuplicateActiveReport(true);
          setErrorMessage(
            `Bạn đã gửi một báo cáo đang chờ xử lý cho ${targetLabel} này. Ban quản trị đang trong quá trình điều tra và sẽ sớm phản hồi.`
          );
        } else if (err.isForbidden) {
          setErrorMessage(`Bạn không có quyền báo cáo ${targetLabel} này.`);
        } else if (err.isNotFound) {
          setErrorMessage(`Không tìm thấy ${targetLabel} cần báo cáo (có thể đã bị xóa hoặc gỡ bỏ).`);
        } else if (err.isValidationError) {
          setErrorMessage(
            'Thông tin báo cáo chưa hợp lệ. Vui lòng kiểm tra lại nội dung và ảnh đính kèm.'
          );
        } else {
          setErrorMessage('Không thể gửi báo cáo vi phạm. Vui lòng thử lại sau.');
        }
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định khi gửi báo cáo.');
      }
    }
  };

  const handleGoToMyReports = () => {
    handleClose();
    navigate('/profile?tab=reports');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div
        className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-red-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shadow-2xs">
              <ShieldAlert className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900">
                Báo cáo vi phạm {targetLabel}
              </h2>
              <p id={descId} className="text-xs text-slate-500">
                Giúp ShareLoop duy trì cộng đồng an toàn và tin cậy
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content: Success State */}
        {submittedReport ? (
          <div className="p-8 text-center space-y-5 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">
                Đã tiếp nhận báo cáo
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Cảm ơn bạn đã phản ánh. Ban quản trị sẽ nhanh chóng xác minh nội dung và xử lý theo quy định cộng đồng.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 text-slate-600">
              <div>
                <strong>Đối tượng báo cáo:</strong>{' '}
                <span className="capitalize">{targetLabel}</span> {targetTitle ? `("${targetTitle}")` : ''}
              </div>
              <div>
                <strong>Hạng mục:</strong> {CATEGORY_CONFIG[submittedReport.category].label}
              </div>
              <div>
                <strong>Trạng thái:</strong>{' '}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Chờ xử lý
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleClose}
                className="w-full sm:w-auto"
              >
                Đóng
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleGoToMyReports}
                className="w-full sm:w-auto"
              >
                Xem báo cáo của tôi
              </Button>
            </div>
          </div>
        ) : (
          /* Content: Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {errorMessage && (
              <div
                role="alert"
                className={`p-4 rounded-2xl border flex items-start gap-3 text-sm animate-in fade-in ${
                  isDuplicateActiveReport
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {isDuplicateActiveReport ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="leading-relaxed font-medium">{errorMessage}</div>
              </div>
            )}

            {targetTitle && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <span className="text-slate-500">Đối tượng báo cáo:</span>{' '}
                <strong className="font-semibold text-slate-900">{targetTitle}</strong>
              </div>
            )}

            {/* Category selection */}
            <div className="space-y-2">
              <label htmlFor="report-category-select" className="block text-sm font-bold text-slate-800">
                Lý do báo cáo vi phạm <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                <select
                  id="report-category-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReportCategory)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  {(Object.keys(CATEGORY_CONFIG) as ReportCategory[]).map((catKey) => (
                    <option key={catKey} value={catKey}>
                      {CATEGORY_CONFIG[catKey].label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 italic pl-1">
                  {CATEGORY_CONFIG[category].description}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                <label htmlFor="report-description">
                  Mô tả chi tiết bằng chứng <span className="text-red-500">*</span>
                </label>
                <span className={`text-xs ${isDescriptionOver ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                  {description.length}/{MAX_DESCRIPTION_LENGTH}
                </span>
              </div>
              <textarea
                id="report-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vui lòng nêu rõ hành vi vi phạm, trích dẫn nội dung tin nhắn bất thường hoặc bằng chứng cụ thể để ban quản trị đối chiếu..."
                maxLength={MAX_DESCRIPTION_LENGTH}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y"
                required
              />
            </div>

            <ImageAttachmentPicker
              purpose="REPORT"
              attachments={attachments}
              disabled={createMutation.isPending}
            />

            <p className="text-xs text-slate-400 leading-relaxed">
              Lưu ý: Báo cáo sai sự thật hoặc quấy rối thành viên khác có thể dẫn đến việc tài khoản của bạn bị hạn chế.
            </p>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleClose}
                disabled={createMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="md"
                isLoading={createMutation.isPending}
                disabled={
                  isDescriptionBlank ||
                  isDescriptionOver ||
                  !attachments.canSubmit ||
                  createMutation.isPending
                }
              >
                Gửi báo cáo
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default CreateReportModal;
