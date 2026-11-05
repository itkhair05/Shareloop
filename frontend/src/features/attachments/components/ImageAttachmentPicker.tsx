import { useId } from 'react';
import type { ChangeEvent } from 'react';
import { AlertCircle, ImagePlus, Loader2, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  MAX_ATTACHMENT_IMAGE_BYTES,
  type AttachmentUploadPurpose,
} from '@/types/attachment';
import type {
  AttachmentImageItem,
  UseImageAttachmentsResult,
} from '../hooks/use-image-attachments';

export interface ImageAttachmentPickerProps {
  purpose: AttachmentUploadPurpose;
  attachments: UseImageAttachmentsResult;
  disabled?: boolean;
}

const MAX_MEGABYTES = Math.round(MAX_ATTACHMENT_IMAGE_BYTES / (1024 * 1024));

interface AttachmentPreviewProps {
  item: AttachmentImageItem;
  index: number;
  disabled: boolean;
  onRemove: (localId: string) => void;
  onRetry: (localId: string) => void;
}

function AttachmentPreview({
  item,
  index,
  disabled,
  onRemove,
  onRetry,
}: AttachmentPreviewProps) {
  const label = index + 1;

  return (
    <li className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 sm:h-24 sm:w-24">
      <img
        src={item.previewUrl}
        alt={`Xem trước ảnh ${label}`}
        className="h-full w-full object-cover"
        decoding="async"
      />

      {item.status === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/75">
          <Loader2
            className="h-5 w-5 animate-spin text-slate-600"
            aria-hidden="true"
          />
          <span className="sr-only">Đang tải ảnh {label} lên...</span>
        </div>
      )}

      {item.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-red-50/95 px-1 text-center">
          <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
          <span className="text-[10px] font-medium leading-tight text-red-700">
            Tải lên thất bại
          </span>
          <button
            type="button"
            onClick={() => onRetry(item.localId)}
            disabled={disabled}
            aria-label={`Tải lại ảnh ${label}`}
            title={item.errorMessage ?? undefined}
            className="relative inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-red-700 underline underline-offset-2 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60 after:absolute after:-inset-1.5 after:content-['']"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            Thử lại
          </button>
          {item.errorMessage && (
            <span className="sr-only">{item.errorMessage}</span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onRemove(item.localId)}
        disabled={disabled}
        aria-label={`Xóa ảnh ${label}`}
        className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white shadow-sm transition-colors hover:bg-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-60 after:absolute after:-inset-2 after:content-['']"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Multi-image picker for review, report, and support forms.
 * Upload starts as soon as a valid image is added; the file id is only sent
 * with the form submission, so removing an image never calls a generic
 * unbind/delete endpoint.
 */
export function ImageAttachmentPicker({
  purpose,
  attachments,
  disabled = false,
}: ImageAttachmentPickerProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const {
    items,
    error,
    maxImages,
    isUploading,
    hasFailedUploads,
    canAddMore,
    addFiles,
    remove,
    retry,
  } = attachments;

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files);
    // Let the user pick the same file again after removing it.
    event.target.value = '';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700">
          Hình ảnh đính kèm{' '}
          <span className="font-normal text-slate-400">(Không bắt buộc)</span>
        </label>
        <span
          className="text-xs tabular-nums text-slate-400"
          aria-live="polite"
        >
          {items.length}/{maxImages}
        </span>
      </div>

      <ul className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <AttachmentPreview
            key={item.localId}
            item={item}
            index={index}
            disabled={disabled}
            onRemove={remove}
            onRetry={retry}
          />
        ))}

        {canAddMore && (
          <li className="shrink-0">
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={handleInputChange}
              disabled={disabled}
              aria-describedby={hintId}
              className="peer sr-only"
            />
            <label
              htmlFor={inputId}
              className={cn(
                'flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-500 transition-colors sm:h-24 sm:w-24',
                'hover:border-emerald-400 hover:bg-emerald-50/60 hover:text-emerald-700',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2',
                disabled && 'pointer-events-none cursor-not-allowed opacity-60'
              )}
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              <span className="text-[11px] font-medium">Thêm ảnh</span>
            </label>
          </li>
        )}
      </ul>

      <p id={hintId} className="text-[11px] leading-relaxed text-slate-500">
        {purpose === 'REVIEW'
          ? 'Ảnh giúp minh họa trải nghiệm của bạn.'
          : purpose === 'REPORT'
            ? 'Ảnh bằng chứng giúp quản trị viên xử lý báo cáo nhanh hơn.'
            : 'Ảnh giúp bộ phận hỗ trợ hiểu rõ vấn đề hơn.'}{' '}
        Hỗ trợ JPEG hoặc PNG, tối đa {MAX_MEGABYTES} MB mỗi ảnh và {maxImages} ảnh.
      </p>

      {isUploading && (
        <p
          role="status"
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          Đang tải ảnh lên. Vui lòng chờ trước khi gửi.
        </p>
      )}

      {!isUploading && hasFailedUploads && (
        <p role="status" className="text-[11px] font-medium text-red-700">
          Có ảnh tải lên thất bại. Vui lòng thử lại hoặc xóa ảnh đó trước khi gửi.
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-[11px] font-medium text-red-700"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          {error}
        </p>
      )}
    </div>
  );
}

export default ImageAttachmentPicker;
