import React, { useCallback, useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, HelpCircle, LifeBuoy, X } from 'lucide-react';
import { useCreateSupportRequest } from '../hooks/use-support';
import type { SupportCategory, SupportRequestResponse } from '@/types/support';
import { ApiError } from '@/lib/api-error';

export interface CreateSupportRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTransactionId?: string | null;
  defaultCategory?: SupportCategory;
  onSuccess?: (response: SupportRequestResponse) => void;
}

const CATEGORY_OPTIONS: { value: SupportCategory; label: string; description: string }[] = [
  {
    value: 'TRANSACTION_ISSUE',
    label: 'Vấn đề về giao dịch',
    description: 'Tranh chấp, đối tác không đến hẹn, đồ dùng nhận được không đúng thỏa thuận',
  },
  {
    value: 'ACCOUNT_ISSUE',
    label: 'Vấn đề về tài khoản',
    description: 'Đăng nhập, thông tin tài khoản, cập nhật hồ sơ hoặc xác thực',
  },
  {
    value: 'SAFETY_CONCERN',
    label: 'Mối lo ngại an toàn',
    description: 'Hành vi đáng ngờ, nguy cơ lừa đảo, an toàn cá nhân khi giao lưu',
  },
  {
    value: 'OTHER',
    label: 'Vấn đề khác',
    description: 'Thắc mắc chung, góp ý nền tảng hoặc yêu cầu hỗ trợ khác',
  },
];

const MAX_SUBJECT_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export function CreateSupportRequestModal({
  isOpen,
  onClose,
  defaultTransactionId,
  defaultCategory = 'OTHER',
  onSuccess,
}: CreateSupportRequestModalProps) {
  const navigate = useNavigate();
  const titleId = useId();
  const descId = useId();

  const [category, setCategory] = useState<SupportCategory>(
    defaultTransactionId ? 'TRANSACTION_ISSUE' : defaultCategory
  );
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdRequest, setCreatedRequest] = useState<SupportRequestResponse | null>(null);

  const createMutation = useCreateSupportRequest();

  // Reset or initialize when modal opens
  useEffect(() => {
    if (isOpen) {
      setCategory(defaultTransactionId ? 'TRANSACTION_ISSUE' : defaultCategory);
      setSubject('');
      setDescription('');
      setErrorMessage(null);
      setCreatedRequest(null);
    }
  }, [isOpen, defaultTransactionId, defaultCategory]);

  const handleClose = useCallback(() => {
    if (createMutation.isPending) return;
    onClose();
  }, [createMutation.isPending, onClose]);

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

  const isSubjectBlank = !subject.trim();
  const isDescriptionBlank = !description.trim();
  const isSubjectOver = subject.length > MAX_SUBJECT_LENGTH;
  const isDescriptionOver = description.length > MAX_DESCRIPTION_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isSubjectBlank) {
      setErrorMessage('Vui lòng nhập tiêu đề yêu cầu.');
      return;
    }
    if (isSubjectOver) {
      setErrorMessage(`Tiêu đề không được vượt quá ${MAX_SUBJECT_LENGTH} ký tự.`);
      return;
    }
    if (isDescriptionBlank) {
      setErrorMessage('Vui lòng nhập nội dung mô tả chi tiết.');
      return;
    }
    if (isDescriptionOver) {
      setErrorMessage(`Nội dung mô tả không được vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự.`);
      return;
    }

    try {
      const response = await createMutation.mutateAsync({
        transactionId: defaultTransactionId || null,
        category,
        subject: subject.trim(),
        description: description.trim(),
      });

      setCreatedRequest(response);
      onSuccess?.(response);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isForbidden) {
          setErrorMessage('Bạn không có quyền gửi yêu cầu hỗ trợ cho giao dịch này.');
        } else if (err.isValidationError && err.fieldErrors) {
          const firstErr = Object.values(err.fieldErrors)[0];
          setErrorMessage(firstErr || 'Thông tin gửi lên không hợp lệ.');
        } else {
          setErrorMessage(err.message || 'Không thể gửi yêu cầu hỗ trợ. Vui lòng thử lại sau.');
        }
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định. Vui lòng thử lại.');
      }
    }
  };

  const handleGoToMyRequests = () => {
    handleClose();
    navigate('/profile?tab=support');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        // Đóng modal khi click ra ngoài vùng trắng
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Modal Container: Giới hạn chiều cao tối đa và dùng flex-col */}
      <div 
        className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER: Cố định trên cùng */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs shrink-0">
              <LifeBuoy className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-base sm:text-lg font-bold text-slate-900">
                Gửi yêu cầu hỗ trợ
              </h2>
              <p id={descId} className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">
                Đội ngũ Quản trị viên ShareLoop sẽ phản hồi sớm nhất
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={createMutation.isPending}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* BODY: Phần nội dung có thể cuộn (flex-1 overflow-y-auto) */}
        <div className="flex-1 overflow-y-auto">
          {/* Content: Success State */}
          {createdRequest ? (
            <div className="p-6 sm:p-8 text-center space-y-5 animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                  Gửi yêu cầu thành công!
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Yêu cầu của bạn với mã{' '}
                  <strong className="font-semibold text-slate-900">
                    #{createdRequest.id.substring(0, 8)}
                  </strong>{' '}
                  đã được chuyển tới Quản trị viên. Bạn sẽ nhận được thông báo in-app ngay khi có phản hồi.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1 text-slate-600">
                <div>
                  <strong>Tiêu đề:</strong> {createdRequest.subject}
                </div>
                <div>
                  <strong>Trạng thái:</strong>{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    Chờ xử lý
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Content: Form */
            <form id="create-support-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
              {errorMessage && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3 text-sm animate-in fade-in"
                >
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="leading-relaxed font-medium">{errorMessage}</div>
                </div>
              )}

              {defaultTransactionId && (
                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-2.5 text-xs text-emerald-900">
                  <HelpCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>
                    Yêu cầu này sẽ được gắn kèm thông tin giao dịch{' '}
                    <strong className="font-semibold text-emerald-950">
                      #{defaultTransactionId}
                    </strong>
                  </span>
                </div>
              )}

              {/* Category selection */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-800">
                  Danh mục hỗ trợ <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CATEGORY_OPTIONS.map((opt) => {
                    const isSelected = category === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCategory(opt.value)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <span className={`text-sm font-semibold block ${isSelected ? 'text-emerald-900' : 'text-slate-800'}`}>
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-slate-500 mt-1 leading-snug">
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                  <label htmlFor="support-subject">
                    Tiêu đề yêu cầu <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${isSubjectOver ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                    {subject.length}/{MAX_SUBJECT_LENGTH}
                  </span>
                </div>
                <input
                  id="support-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Tóm tắt ngắn gọn vấn đề bạn gặp phải (ví dụ: Không thể tải ảnh đại diện)"
                  maxLength={MAX_SUBJECT_LENGTH}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                  <label htmlFor="support-description">
                    Mô tả chi tiết <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${isDescriptionOver ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                    {description.length}/{MAX_DESCRIPTION_LENGTH}
                  </span>
                </div>
                <textarea
                  id="support-description"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Vui lòng cung cấp chi tiết sự việc, thời gian xảy ra, các bước bạn đã thử và mong muốn hỗ trợ từ ban quản trị..."
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-y"
                  required
                />
              </div>
            </form>
          )}
        </div>

        {/* FOOTER: Cố định dưới cùng, chứa các nút bấm */}
        <div className="p-4 sm:px-6 border-t border-slate-100 bg-slate-50/30 shrink-0 flex flex-col sm:flex-row items-center justify-end gap-3">
          {createdRequest ? (
            /* Footer cho Success State */
            <>
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto inline-flex flex-row items-center justify-center h-10 px-5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleGoToMyRequests}
                className="w-full sm:w-auto inline-flex flex-row items-center justify-center h-10 px-5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm"
              >
                Xem yêu cầu của tôi
              </button>
            </>
          ) : (
            /* Footer cho Form State */
            <>
              <button
                type="button"
                onClick={handleClose}
                disabled={createMutation.isPending}
                className="w-full sm:w-auto inline-flex flex-row items-center justify-center h-10 px-5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy
              </button>
              <button
                type="submit"
                form="create-support-form"
                disabled={isSubjectBlank || isDescriptionBlank || isSubjectOver || isDescriptionOver || createMutation.isPending}
                className="w-full sm:w-auto inline-flex flex-row items-center justify-center gap-2 h-10 px-5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending && (
                  <svg className="animate-spin w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{createMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateSupportRequestModal;