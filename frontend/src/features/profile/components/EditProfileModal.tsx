import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, Phone, User, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateProfile } from '../hooks/use-update-profile';
import { ApiError } from '@/lib/api-error';
import type { UserProfile } from '@/types/auth';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSuccess?: (updatedUser: UserProfile) => void;
}

const PHONE_REGEX = /^0[0-9]{9}$/;

export function EditProfileModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: EditProfileModalProps) {
  const titleId = useId();
  const descId = useId();
  const displayNameInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ displayName?: string; phoneNumber?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const updateProfileMutation = useUpdateProfile();
  const isSubmitting = updateProfileMutation.isPending;

  // Sync form inputs when modal opens or user prop changes
  useEffect(() => {
    if (isOpen) {
      setDisplayName(user.displayName ?? '');
      setPhoneNumber(user.phoneNumber ?? '');
      setFieldErrors({});
      setServerError(null);

      // Focus display name on modal open
      const timer = setTimeout(() => {
        displayNameInputRef.current?.focus();
        displayNameInputRef.current?.select();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isOpen, user]);

  // Handle escape key to close
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

  // Lock body scroll while open
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

  // Determine if inputs have changed
  const originalName = (user.displayName ?? '').trim();
  const originalPhone = (user.phoneNumber ?? '').trim();
  const currentTrimmedName = displayName.trim();
  const currentTrimmedPhone = phoneNumber.trim();

  const isDirty =
    currentTrimmedName !== originalName ||
    currentTrimmedPhone !== originalPhone;

  // Client validation
  const validate = (): boolean => {
    const errors: { displayName?: string; phoneNumber?: string } = {};

    if (!currentTrimmedName) {
      errors.displayName = 'Tên hiển thị không được để trống';
    } else if (currentTrimmedName.length < 2) {
      errors.displayName = 'Tên hiển thị phải có ít nhất 2 ký tự';
    } else if (currentTrimmedName.length > 100) {
      errors.displayName = 'Tên hiển thị không được vượt quá 100 ký tự';
    }

    if (currentTrimmedPhone) {
      if (!PHONE_REGEX.test(currentTrimmedPhone)) {
        errors.phoneNumber = 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0';
      }
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

    if (!isDirty) {
      onClose();
      return;
    }

    try {
      const updated = await updateProfileMutation.mutateAsync({
        displayName: currentTrimmedName,
        phoneNumber: currentTrimmedPhone ? currentTrimmedPhone : null,
      });

      onSuccess?.(updated);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors((prev) => ({
            ...prev,
            ...err.fieldErrors,
          }));
        }
        setServerError(
          err.message || 'Không thể cập nhật hồ sơ. Vui lòng kiểm tra lại thông tin.'
        );
      } else {
        setServerError('Đã xảy ra lỗi không xác định khi kết nối với máy chủ.');
      }
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
        className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-slate-900 tracking-tight">
              Chỉnh sửa hồ sơ
            </h2>
            <p id={descId} className="text-sm text-slate-500 mt-1">
              Cập nhật thông tin tài khoản hiển thị trên ShareLoop.
            </p>
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
            className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-start gap-2.5 animate-in fade-in duration-150"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <span className="font-semibold block">Lỗi cập nhật:</span>
              <span>{serverError}</span>
            </div>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email (Read-only reference) */}
          <div className="w-full space-y-1.5">
            <label className="block text-sm font-medium text-slate-500">
              Địa chỉ Email
            </label>
            <input
              type="text"
              readOnly
              disabled
              value={user.email}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-500 cursor-not-allowed select-none"
              aria-label="Địa chỉ email (không thể thay đổi)"
            />
            <p className="text-xs text-slate-400">
              Email đăng nhập không thể thay đổi tại đây.
            </p>
          </div>

          {/* Display Name */}
          <Input
            ref={displayNameInputRef}
            id="edit-profile-display-name"
            label="Tên hiển thị *"
            placeholder="Nhập tên hiển thị của bạn"
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (fieldErrors.displayName) {
                setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
              }
            }}
            error={fieldErrors.displayName}
            helperText="Từ 2 đến 100 ký tự. Tên này hiển thị công khai trên tin đăng và đánh giá."
            disabled={isSubmitting}
            rightElement={<User className="w-4 h-4 text-slate-400" aria-hidden="true" />}
            required
            autoComplete="name"
          />

          {/* Phone Number */}
          <Input
            id="edit-profile-phone-number"
            label="Số điện thoại"
            placeholder="0912345678"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              if (fieldErrors.phoneNumber) {
                setFieldErrors((prev) => ({ ...prev, phoneNumber: undefined }));
              }
            }}
            error={fieldErrors.phoneNumber}
            helperText="Ví dụ: 0912345678 (gồm đúng 10 chữ số). Để trống nếu muốn xóa số điện thoại."
            disabled={isSubmitting}
            rightElement={<Phone className="w-4 h-4 text-slate-400" aria-hidden="true" />}
            autoComplete="tel"
          />

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
              disabled={isSubmitting || !isDirty}
              className="w-full sm:w-auto shadow-xs"
            >
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditProfileModal;
