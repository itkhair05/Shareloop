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
   * Custom width in px or percentage
   */
  width?: number | string;
}

export function GoogleSignInButton({
  mode = 'signin',
  onSuccess,
  onError,
  disabled = false,
  className = '',
  width = 384,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isConfigured = isGoogleAuthConfigured();

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
            width,
            onClickListener: () => {
              if (disabled || isProcessing) {
                return;
              }
            },
          });
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Lỗi tải thư viện Google';
        setScriptError(message);
        if (onError && err instanceof Error) {
          onError(err);
        }
      });
  }, [isConfigured, handleCredentialReceived, mode, disabled, isProcessing, width, onError]);

  useEffect(() => {
    initGoogle();
  }, [initGoogle]);

  // If Google Web Client ID is not configured in environment
  if (!isConfigured) {
    return (
      <div
        className={`p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 text-xs text-center flex items-center justify-center gap-2 ${className}`}
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
        className={`p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs flex items-center justify-between gap-2 ${className}`}
        role="alert"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" aria-hidden="true" />
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
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {/* Target container for Google Identity Services rendered button */}
      <div
        ref={containerRef}
        data-testid="google-signin-container"
        className={`w-full flex items-center justify-center min-h-[44px] ${
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
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" aria-hidden="true" />
          <span>Đang xác thực với Google...</span>
        </div>
      )}

      {/* Initial script loading spinner placeholder */}
      {!isScriptLoaded && !scriptError && (
        <div
          className="w-full h-11 border border-slate-200 rounded-md bg-slate-50 flex items-center justify-center gap-2 text-xs text-slate-500 animate-pulse"
          aria-busy="true"
        >
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-hidden="true" />
          <span>Đang tải dịch vụ Google...</span>
        </div>
      )}
    </div>
  );
}
