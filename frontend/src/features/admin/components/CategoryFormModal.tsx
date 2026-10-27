import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, Check, FolderTree, RefreshCw, X } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { useCreateCategory, useUpdateCategory } from '@/features/categories';
import { slugifyVietnamese, isValidCategorySlug } from '@/features/categories/utils/slugify';
import type { CategoryDetailResponse, CategoryResponse } from '@/types/category';
import { ApiError } from '@/lib/api-error';

export interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryToEdit?: CategoryDetailResponse | null;
  onSuccess?: (category: CategoryResponse) => void;
}

const MAX_NAME_LENGTH = 100;
const MAX_SLUG_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;

export function CategoryFormModal({
  isOpen,
  onClose,
  categoryToEdit,
  onSuccess,
}: CategoryFormModalProps) {
  const isEditing = Boolean(categoryToEdit);
  const titleId = useId();
  const descId = useId();

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();

  const isSubmitting = createCategoryMutation.isPending || updateCategoryMutation.isPending;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isAutoSlug, setIsAutoSlug] = useState(true);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset or pre-fill form fields when modal opens or categoryToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setSlug(categoryToEdit.slug);
        setDescription(categoryToEdit.description || '');
        setIsActive(categoryToEdit.isActive);
        setIsAutoSlug(false);
      } else {
        setName('');
        setSlug('');
        setDescription('');
        setIsActive(true);
        setIsAutoSlug(true);
      }
      setErrorMessage(null);
      setFieldErrors({});
    }
  }, [isOpen, categoryToEdit]);

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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (fieldErrors.name) {
      setFieldErrors((prev) => ({ ...prev, name: '' }));
    }
    if (isAutoSlug) {
      const generatedSlug = slugifyVietnamese(val);
      setSlug(generatedSlug);
      if (fieldErrors.slug) {
        setFieldErrors((prev) => ({ ...prev, slug: '' }));
      }
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().trim();
    setSlug(val);
    setIsAutoSlug(false);
    if (fieldErrors.slug) {
      setFieldErrors((prev) => ({ ...prev, slug: '' }));
    }
  };

  const handleRegenerateSlug = () => {
    const generated = slugifyVietnamese(name);
    setSlug(generated);
    setIsAutoSlug(true);
    if (fieldErrors.slug) {
      setFieldErrors((prev) => ({ ...prev, slug: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const errors: Record<string, string> = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      errors.name = 'Vui lòng nhập tên danh mục';
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      errors.name = `Tên danh mục không được vượt quá ${MAX_NAME_LENGTH} ký tự`;
    }

    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      errors.slug = 'Vui lòng nhập đường dẫn định danh (slug)';
    } else if (trimmedSlug.length > MAX_SLUG_LENGTH) {
      errors.slug = `Đường dẫn không được vượt quá ${MAX_SLUG_LENGTH} ký tự`;
    } else if (!isValidCategorySlug(trimmedSlug)) {
      errors.slug = 'Đường dẫn phải viết thường, chỉ gồm chữ cái, chữ số và dấu gạch nối (ví dụ: do-dien-tu)';
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = `Mô tả không được vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự`;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      let savedCategory: CategoryResponse;

      if (isEditing && categoryToEdit) {
        savedCategory = await updateCategoryMutation.mutateAsync({
          id: categoryToEdit.id,
          payload: {
            name: trimmedName,
            slug: trimmedSlug,
            description: description.trim() || null,
            isActive,
          },
        });
      } else {
        savedCategory = await createCategoryMutation.mutateAsync({
          name: trimmedName,
          slug: trimmedSlug,
          description: description.trim() || null,
          isActive,
        });
      }

      onSuccess?.(savedCategory);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrorMessage('Đường dẫn định danh (slug) này đã tồn tại trong hệ thống. Vui lòng chọn một slug khác.');
          setFieldErrors((prev) => ({ ...prev, slug: 'Slug đã được sử dụng' }));
        } else if (err.status === 400 && err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
          setErrorMessage('Vui lòng kiểm tra lại các trường thông tin không hợp lệ.');
        } else {
          setErrorMessage(err.message || 'Đã có lỗi xảy ra từ máy chủ khi lưu danh mục.');
        }
      } else {
        setErrorMessage('Không thể lưu thông tin danh mục. Vui lòng kiểm tra kết nối mạng và thử lại.');
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      role="presentation"
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
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-bold text-slate-900">
                {isEditing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
              </h2>
              <p id={descId} className="text-xs text-slate-500">
                {isEditing
                  ? 'Cập nhật tên, slug, mô tả hoặc trạng thái của danh mục hiện có'
                  : 'Tạo danh mục mới để phân loại các sản phẩm chia sẻ trong cộng đồng'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Name Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="category-name" className="text-sm font-semibold text-slate-700">
                Tên danh mục <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {name.length}/{MAX_NAME_LENGTH}
              </span>
            </div>
            <Input
              id="category-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Ví dụ: Đồ gia dụng & Nhà bếp"
              error={fieldErrors.name}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Slug Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="category-slug" className="text-sm font-semibold text-slate-700">
                Đường dẫn định danh (Slug) <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                {!isAutoSlug && name && (
                  <button
                    type="button"
                    onClick={handleRegenerateSlug}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                    title="Tạo lại slug tự động từ tên danh mục"
                  >
                    <RefreshCw className="w-3 h-3 shrink-0" />
                    <span className="whitespace-nowrap">Đồng bộ từ tên</span>
                  </button>
                )}
                <span className="text-[11px] font-mono text-slate-400">
                  {slug.length}/{MAX_SLUG_LENGTH}
                </span>
              </div>
            </div>
            <Input
              id="category-slug"
              type="text"
              value={slug}
              onChange={handleSlugChange}
              maxLength={MAX_SLUG_LENGTH}
              placeholder="do-gia-dung-nha-bep"
              error={fieldErrors.slug}
              helperText={
                !fieldErrors.slug
                  ? 'Chuỗi ký tự viết thường phân tách bằng dấu gạch ngang (kebab-case) dùng trong URL.'
                  : undefined
              }
              disabled={isSubmitting}
              className="font-mono text-xs"
            />
          </div>

          {/* Description Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="category-description" className="text-sm font-semibold text-slate-700">
                Mô tả danh mục
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                {description.length}/{MAX_DESCRIPTION_LENGTH}
              </span>
            </div>
            <textarea
              id="category-description"
              rows={3}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => ({ ...prev, description: '' }));
                }
              }}
              maxLength={MAX_DESCRIPTION_LENGTH}
              placeholder="Nhập mô tả các mặt hàng, tiêu chí phân loại cho danh mục này..."
              disabled={isSubmitting}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-emerald-500 focus:ring-emerald-400 text-slate-900 resize-y"
            />
            {fieldErrors.description && (
              <p className="text-xs text-red-600 font-medium mt-1">{fieldErrors.description}</p>
            )}
          </div>

          {/* Active Status Checkbox */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer"
              />
              <div>
                <span className="text-sm font-semibold text-slate-800">
                  Kích hoạt danh mục này
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Danh mục đang hoạt động sẽ xuất hiện trên thanh điều hướng và cho phép thành viên đăng bài. Nếu bỏ chọn, danh mục sẽ tạm ngưng hiển thị công khai.
                </p>
              </div>
            </label>
          </div>

          {/* Footer Actions - ĐÃ THAY BẰNG THẺ BUTTON THUẦN */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 flex-nowrap">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex flex-row items-center justify-center h-10 px-5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex flex-row items-center justify-center gap-2 h-10 px-5 min-w-[120px] text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer shrink-0 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="whitespace-nowrap">Đang lưu...</span>
                </>
              ) : (
                <>
                  {isEditing ? (
                    <Check className="w-4 h-4 shrink-0" />
                  ) : (
                    <FolderTree className="w-4 h-4 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">{isEditing ? 'Lưu thay đổi' : 'Tạo danh mục'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryFormModal;