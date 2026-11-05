import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { AttachmentImage } from '@/types/attachment';
import {
  getPrivateImageErrorMessage,
  usePrivateImage,
} from '../hooks/use-private-image';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface GalleryThumbnailProps {
  image: AttachmentImage;
  index: number;
  onOpen: (index: number) => void;
}

function GalleryThumbnail({ image, index, onOpen }: GalleryThumbnailProps) {
  const label = index + 1;
  const { status, objectUrl, errorKind, canRetry, retry } =
    usePrivateImage(image.url);

  return (
    <li className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:h-24 sm:w-24">
      {status === 'ready' && objectUrl ? (
        <button
          type="button"
          onClick={() => onOpen(index)}
          aria-label={`Xem ảnh đính kèm ${label}`}
          aria-haspopup="dialog"
          className="group block h-full w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset"
        >
          <img
            src={objectUrl}
            alt={`Hình ảnh đính kèm ${label}`}
            className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
            decoding="async"
          />
        </button>
      ) : status === 'error' && errorKind ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-1.5 text-center">
          <AlertCircle className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <p className="text-[10px] leading-tight text-slate-600">
            {getPrivateImageErrorMessage(errorKind)}
          </p>
          {canRetry && (
            <button
              type="button"
              onClick={retry}
              className="text-[10px] font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Thử lại
            </button>
          )}
        </div>
      ) : (
        <div
          role="status"
          className="flex h-full w-full items-center justify-center"
        >
          <Loader2
            className="h-4 w-4 animate-spin text-slate-400"
            aria-hidden="true"
          />
          <span className="sr-only">Đang tải ảnh {label}...</span>
        </div>
      )}
    </li>
  );
}

interface AttachmentLightboxDialogProps {
  images: AttachmentImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

function AttachmentLightboxDialog({
  images,
  index,
  onIndexChange,
  onClose,
}: AttachmentLightboxDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backdropPressedRef = useRef(false);

  const current = images[index];
  const label = index + 1;
  const total = images.length;
  const { status, objectUrl, errorKind, canRetry, retry } = usePrivateImage(
    current?.url
  );

  const goPrevious = useCallback(() => {
    onIndexChange((index - 1 + total) % total);
  }, [index, onIndexChange, total]);

  const goNext = useCallback(() => {
    onIndexChange((index + 1) % total);
  }, [index, onIndexChange, total]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      if (window.scrollY !== scrollY) {
        window.scrollTo(0, scrollY);
      }
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        // Keep the parent detail/create modal open.
        event.stopPropagation();
        onClose();
        return;
      }

      if (total > 1 && event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
        return;
      }

      if (total > 1 && event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );

      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrevious, onClose, total]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/90 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:p-8"
      data-testid="attachment-lightbox-overlay"
      onMouseDown={(event) => {
        backdropPressedRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        const pressedOnBackdrop = backdropPressedRef.current;
        backdropPressedRef.current = false;

        if (pressedOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative flex h-full max-h-full w-full max-w-5xl flex-col gap-3 outline-none"
      >
        <h2 id={titleId} className="sr-only">
          Xem ảnh đính kèm
        </h2>

        <div className="flex w-full shrink-0 items-center justify-between gap-3">
          <p
            id={descriptionId}
            className="text-sm font-medium text-slate-200 tabular-nums"
          >
            Ảnh {label} / {total}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng ảnh"
            className="-mr-1 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
          {status === 'ready' && objectUrl ? (
            <img
              src={objectUrl}
              alt={`Hình ảnh đính kèm ${label}`}
              className="block h-auto max-h-full w-auto max-w-full object-contain"
              decoding="async"
            />
          ) : status === 'error' && errorKind ? (
            <div
              role="alert"
              className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-slate-900/80 px-6 py-6 text-center"
            >
              <AlertCircle className="h-6 w-6 text-rose-400" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-slate-100">
                {getPrivateImageErrorMessage(errorKind)}
              </p>
              {canRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retry}
                  className="border-white/30 bg-white/10 text-white hover:bg-white/20"
                >
                  Thử lại
                </Button>
              )}
            </div>
          ) : (
            <div
              role="status"
              className="flex flex-col items-center justify-center gap-2 text-slate-200"
            >
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="text-sm">Đang tải ảnh...</span>
            </div>
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={goPrevious}
                aria-label="Ảnh trước"
                className="absolute left-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-white transition-colors hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Ảnh sau"
                className="absolute right-0 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-slate-900/60 text-white transition-colors hover:bg-slate-900/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/90"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export interface AttachmentGalleryProps {
  images: AttachmentImage[];
  /** Accessible name for the thumbnail list, e.g. "Hình ảnh đính kèm". */
  label?: string;
  className?: string;
}

/**
 * Read-only gallery for private attachment images. Every thumbnail is fetched
 * through the authenticated API client, so hidden review images and restricted
 * report/support evidence never render from a public URL.
 */
export function AttachmentGallery({
  images,
  label = 'Hình ảnh đính kèm',
  className,
}: AttachmentGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openAt = useCallback((index: number) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setActiveIndex(index);
  }, []);

  const close = useCallback(() => {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    setActiveIndex(null);

    if (!trigger || !trigger.isConnected) return;

    const restoreFocus = () => {
      if (trigger.isConnected) {
        trigger.focus();
      }
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(restoreFocus);
    } else {
      setTimeout(restoreFocus, 0);
    }
  }, []);

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-semibold text-slate-700">
        {label}{' '}
        <span className="font-normal text-slate-400">({images.length})</span>
      </p>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {images.map((image, index) => (
          <GalleryThumbnail
            key={image.id}
            image={image}
            index={index}
            onOpen={openAt}
          />
        ))}
      </ul>

      {activeIndex !== null &&
        createPortal(
          <AttachmentLightboxDialog
            images={images}
            index={activeIndex}
            onIndexChange={setActiveIndex}
            onClose={close}
          />,
          document.body
        )}
    </div>
  );
}

export default AttachmentGallery;
