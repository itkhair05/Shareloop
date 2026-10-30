import { useEffect, useRef, useState, useCallback } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import {
  getGoogleClientId,
  isGoogleAuthConfigured,
  loadGoogleIdentityScript,
  initializeGoogleIdentity,
  renderGoogleButton,
} from '../utils/google-identity';

export interface GoogleSignInButtonProps {
  /**
   * Mode of authentication
   * 'signin' -> "Đăng nhập bằng Google"
   * 'signup' -> "Đăng ký bằng Google"
   * 'link'   -> "Liên kết với Google"
   */
  mode?: 'signin' | 'signup' | 'link';
  /**
   * Callback invoked with verified Google ID token string
   */
  onSuccess: (idToken: string) => void | Promise<void>;
  /**
   * Callback invoked if script or client error occurs
   */
  onError?: (error: Error) => void;
  /**
   * Whether the button is disabled or in a parent loading state
   */
  disabled?: boolean;
  /**
   * Optional custom CSS class
   */
  className?: string;
  /**
   * Custom width in px or percentage.
   * - If a number is provided, Google button uses that fixed width (px).
   * - If a string like '100%' is provided, the width is measured from the
   *   container element and kept in sync via ResizeObserver.
   */
  width?: number | string;
}

/**
 * Minimum width Google Identity Services allows for the rendered button.
 * Reference: https://developers.google.com/identity/gsi/web/reference/js-reference
 */
const GOOGLE_MIN_WIDTH = 200;

export function GoogleSignInButton({
  mode = 'signin',
  onSuccess,
  onError,
  disabled = false,
  className = '',
  width = '100%',
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isConfigured = isGoogleAuthConfigured();

  /**
   * Resolve the actual pixel width to pass to Google.
   * Google only accepts a numeric px value for its `width` option.
   */
  const resolveWidth = useCallback((): number => {
    if (typeof width === 'number') {
      return width;
    }
    const measured = containerRef.current?.offsetWidth ?? 0;
    return measured > 0 ? measured : GOOGLE_MIN_WIDTH;
  }, [width]);

  const handleCredentialReceived = useCallback(
    async (idToken: string) => {
      if (disabled || isProcessing) {
        return;
      }
      setIsProcessing(true);
      try {
        await onSuccess(idToken);
      } catch (err) {
        if (onError && err instanceof Error) {
          onError(err);
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [disabled, isProcessing, onSuccess, onError]
  );

  const initGoogle = useCallback(() => {
    if (!isConfigured) {
      return;
    }

    loadGoogleIdentityScript()
      .then(() => {
        setScriptError(null);
        setIsScriptLoaded(true);
        const clientId = getGoogleClientId();
        initializeGoogleIdentity({
          clientId,
          onCredentialReceived: handleCredentialReceived,
        });

        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          renderGoogleButton(containerRef.current, {
            mode,
            disabled: disabled || isProcessing,
            width: resolveWidth(),
            onClickListener: () => {
              if (disabled || isProcessing) {
                return;
              }
            },
          });
        }
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : 'Lỗi tải thư viện Google';
        setScriptError(message);
        if (onError && err instanceof Error) {
          onError(err);
        }
      });
  }, [
    isConfigured,
    handleCredentialReceived,
    mode,
    disabled,
    isProcessing,
    resolveWidth,
    onError,
  ]);

  useEffect(() => {
    initGoogle();
  }, [initGoogle]);

  /**
   * Re-render the Google button whenever the container width changes
   * (e.g. responsive layout, sidebar collapse, orientation change).
   * The Google SDK renders an iframe with a fixed px width, so we have
   * to explicitly re-mount it when the layout changes.
   */
  useEffect(() => {
    if (!isScriptLoaded || !isConfigured) return;
    const container = containerRef.current;
    if (!container) return;

    let lastWidth = container.offsetWidth || 0;
    let rafId: number | null = null;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const newWidth = Math.round(entry.contentRect.width);
      // Skip tiny fluctuations (scrollbar appearance, sub-pixel rounding, etc.)
      if (Math.abs(newWidth - lastWidth) < 10) return;
      lastWidth = newWidth;

      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!container.isConnected) return;
        container.innerHTML = '';
        renderGoogleButton(container, {
          mode,
          disabled: disabled || isProcessing,
          width:
            typeof width === 'number'
              ? width
              : Math.max(newWidth, GOOGLE_MIN_WIDTH),
          onClickListener: () => {
            if (disabled || isProcessing) {
              return;
            }
          },
        });
      });
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [
    isScriptLoaded,
    isConfigured,
    mode,
    disabled,
    isProcessing,
    width,
  ]);

  // If Google Web Client ID is not configured in environment
  if (!isConfigured) {
    return (
      <div
        className={`p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs text-center flex items-center justify-center gap-2 w-full ${className}`}
        role="note"
      >
        <span>Đăng nhập Google hiện chưa khả dụng.</span>
      </div>
    );
  }

  // If script failed to load (network error / adblocker)
  if (scriptError) {
    return (
      <div
        className={`p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs flex items-center justify-between gap-2 w-full ${className}`}
        role="alert"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertCircle
            className="w-4 h-4 text-red-500 shrink-0"
            aria-hidden="true"
          />
          <span className="truncate">{scriptError}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            setScriptError(null);
            initGoogle();
          }}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 shrink-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          <span>Thử lại</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full ${className}`}
    >
      {/*
        Target container for Google Identity Services rendered button.
        - `w-full` makes the wrapper stretch.
        - `[&>div]:w-full` forces the SDK-generated wrapper <div> to fill.
        - `[&_iframe]:w-full` forces the actual iframe (the clickable button)
          to fill, so it visually matches the email/password inputs.
      */}
      <div
        ref={containerRef}
        data-testid="google-signin-container"
        className={`w-full flex items-center justify-center min-h-[44px] [&>div]:w-full [&_iframe]:w-full ${
          disabled || isProcessing ? 'opacity-50 pointer-events-none' : ''
        }`}
      />

      {/* Processing overlay with spinner */}
      {isProcessing && (
        <div
          className="absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-md flex items-center justify-center gap-2 text-xs font-medium text-slate-700 shadow-xs z-10"
          role="status"
          aria-live="polite"
        >
          <Loader2
            className="w-4 h-4 animate-spin text-emerald-600"
            aria-hidden="true"
          />
          <span>Đang xác thực với Google...</span>
        </div>
      )}

      {/* Initial script loading spinner placeholder */}
      {!isScriptLoaded && !scriptError && (
        <div
          className="w-full h-11 border border-slate-200 rounded-md bg-slate-50 flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse"
          aria-busy="true"
        >
          <Loader2
            className="w-4 h-4 animate-spin text-slate-400"
            aria-hidden="true"
          />
          <span>Đang tải dịch vụ Google...</span>
        </div>
      )}
    </div>
  );
}
export default GoogleSignInButton;