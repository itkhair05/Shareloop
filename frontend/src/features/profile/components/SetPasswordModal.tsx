import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/features/auth/api/auth-api';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/lib/api-error';

export interface SetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export function SetPasswordModal({
  isOpen,
  onClose,
  onSuccess,
}: SetPasswordModalProps) {
  const titleId = useId();
  const descId = useId();
  const newPasswordInputRef = useRef<HTMLInputElement>(null);
  const { refreshUser } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset and focus when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
      setConfirmPassword('');
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setFieldErrors({});
      setServerError(null);
      setIsSubmitting(false);

      const timer = setTimeout(() => {
        newPasswordInputRef.current?.focus();
      }, 50);

      return () => clearTimeout(timer);
    } else {
      // Clear sensitive values immediately on close
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

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

  const validate = (): boolean => {
    const errors: {
      newPassword?: string;
      confirmPassword?: string;
    } = {};

    if (!newPassword) {
      errors.newPassword = 'Mật khẩu mới không được để trống';
    } else if (newPassword.length < 8) {
      errors.newPassword = 'Mật khẩu phải từ 8 đến 100 ký tự';
    } else if (newPassword.length > 100) {
      errors.newPassword = 'Mật khẩu phải từ 8 đến 100 ký tự';
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp với mật khẩu mới';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.setPassword({
        newPassword,
      });

      // Synchronize current user state so hasPassword transitions to true
      await refreshUser();

      // Clear sensitive form state
      setNewPassword('');
      setConfirmPassword('');

      onSuccess?.(response.message || 'Thiết lập mật khẩu thành công.');
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors((prev) => ({
            ...prev,
            ...err.fieldErrors,
          }));
        }

        if (err.status === 409) {
          setServerError(
            err.message || 'Tài khoản đã có mật khẩu. Vui lòng sử dụng chức năng đổi mật khẩu.'
          );
        } else if (err.status === 429) {
          setServerError('Quá nhiều yêu cầu thiết lập mật khẩu. Vui lòng thử lại sau 1 phút.');
        } else if (err.isUnauthorized) {
          setServerError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        } else if (err.status === 403) {
          setServerError('Tài khoản của bạn đã bị khóa hoặc không có quyền thực hiện.');
        } else {
          setServerError(err.message || 'Không thể thiết lập mật khẩu. Vui lòng kiểm tra lại thông tin.');
        }
      } else {
        setServerError('Đã xảy ra lỗi không xác định khi kết nối với máy chủ.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-lg font-bold text-slate-900 tracking-tight">
                Thiết lập mật khẩu
              </h2>
              <p id={descId} className="text-xs text-slate-500 mt-0.5">
                Tạo mật khẩu đăng nhập email cho tài khoản
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Server error alert */}
        {serverError && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-start gap-2.5 animate-in fade-in duration-150"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <span className="font-semibold block">Lỗi:</span>
              <span>{serverError}</span>
            </div>
          </div>
        )}

        {/* Set Password Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* New Password */}
          <Input
            ref={newPasswordInputRef}
            id="set-new-password"
            label="Mật khẩu mới *"
            type={showNewPassword ? 'text' : 'password'}
            placeholder="Nhập mật khẩu mới (từ 8 đến 100 ký tự)"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              if (fieldErrors.newPassword) {
                setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
              }
            }}
            error={fieldErrors.newPassword}
            helperText="Mật khẩu phải từ 8 đến 100 ký tự."
            disabled={isSubmitting}
            required
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                aria-label={showNewPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'}
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            }
          />

          {/* Confirm New Password */}
          <Input
            id="set-confirm-password"
            label="Xác nhận mật khẩu mới *"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (fieldErrors.confirmPassword) {
                setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            error={fieldErrors.confirmPassword}
            disabled={isSubmitting}
            required
            autoComplete="new-password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                aria-label={showConfirmPassword ? 'Ẩn xác nhận mật khẩu' : 'Hiện xác nhận mật khẩu'}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            }
          />

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="w-full sm:w-auto shadow-xs"
            >
              Thiết lập mật khẩu
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SetPasswordModal;
