import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  getChatImageErrorMessage,
  useChatImage,
} from '../hooks/use-chat-image';
import {
  ChatImageLightboxContext,
  type ChatImageLightboxRequest,
} from '../hooks/use-chat-image-lightbox';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ChatImageLightboxDialogProps {
  request: ChatImageLightboxRequest;
  onClose: () => void;
}

function ChatImageLightboxDialog({
  request,
  onClose,
}: ChatImageLightboxDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const backdropPressedRef = useRef(false);
  const { status, objectUrl, errorKind, canRetry, retry } = useChatImage(
    request.imageUrl
  );

  const caption =
    request.caption && request.caption.trim().length > 0
      ? request.caption
      : null;

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
        onClose();
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
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/90 p-4 pt-[max(1rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:p-8"
      data-testid="chat-image-lightbox-overlay"
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
        aria-describedby={caption ? descriptionId : undefined}
        tabIndex={-1}
        className="relative flex h-full max-h-full w-full max-w-5xl flex-col gap-3 outline-none"
      >
        <h2 id={titleId} className="sr-only">
          Xem ảnh đính kèm từ {request.senderName}
        </h2>

        <div className="flex w-full shrink-0 items-center justify-end">
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

        <figure className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3">
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            {status === 'ready' && objectUrl ? (
              <img
                src={objectUrl}
                alt={`Ảnh đính kèm từ ${request.senderName}`}
                className="block h-auto max-h-full w-auto max-w-full object-contain"
                decoding="async"
              />
            ) : status === 'error' && errorKind ? (
              <div
                role="alert"
                className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-slate-900/80 px-6 py-6 text-center"
              >
                <AlertCircle
                  className="h-6 w-6 text-rose-400"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-slate-100">
                  {getChatImageErrorMessage(errorKind)}
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
          </div>

          {caption && (
            <figcaption
              id={descriptionId}
              className={cn(
                'max-h-[20vh] w-full shrink-0 overflow-y-auto px-2 text-center text-sm leading-relaxed text-slate-100',
                'whitespace-pre-wrap break-words'
              )}
            >
              {caption}
            </figcaption>
          )}
        </figure>
      </div>
    </div>
  );
}

export interface ChatImageLightboxProviderProps {
  children: ReactNode;
}

export function ChatImageLightboxProvider({
  children,
}: ChatImageLightboxProviderProps) {
  const [request, setRequest] = useState<ChatImageLightboxRequest | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openLightbox = useCallback((next: ChatImageLightboxRequest) => {
    triggerRef.current = next.trigger;
    setRequest(next);
  }, []);

  const closeLightbox = useCallback(() => {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    setRequest(null);

    if (!trigger || !trigger.isConnected) return;

    // Wait for the dialog to unmount before moving focus back.
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

  return (
    <ChatImageLightboxContext.Provider value={{ openLightbox }}>
      {children}
      {request !== null &&
        createPortal(
          <ChatImageLightboxDialog
            request={request}
            onClose={closeLightbox}
          />,
          document.body
        )}
    </ChatImageLightboxContext.Provider>
  );
}

export default ChatImageLightboxProvider;
