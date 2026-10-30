/**
 * Google Identity Services (GSI) Helper & Script Loader
 * Encapsulates script loading, configuration verification, and button rendering.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            [key: string]: unknown;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
              locale?: string;
              click_listener?: () => void;
              [key: string]: unknown;
            }
          ) => void;
          prompt?: (momentListener?: (notification: unknown) => void) => void;
          cancel?: () => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

let scriptLoadingPromise: Promise<void> | null = null;

/**
 * Returns the configured Google Web Client ID from Vite environment variables.
 */
export function getGoogleClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof clientId === 'string' ? clientId.trim() : '';
}

/**
 * Checks if Google authentication is configured with a non-blank client ID.
 */
export function isGoogleAuthConfigured(): boolean {
  return getGoogleClientId().length > 0;
}

/**
 * Dynamically loads the official Google Identity Services script once.
 * Uses a singleton promise to avoid multiple script injections across navigation.
 */
export function loadGoogleIdentityScript(): Promise<void> {
  // If already available on window, resolve immediately
  if (typeof window !== 'undefined' && window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (scriptLoadingPromise) {
    return scriptLoadingPromise;
  }

  scriptLoadingPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }

    // Check if an existing script tag already exists in DOM
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_URL}"]`);
    if (existingScript) {
      if (window.google?.accounts?.id) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script')), { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      scriptLoadingPromise = null;
      reject(new Error('Không thể tải thư viện Google Identity Services. Vui lòng kiểm tra kết nối mạng.'));
    };

    document.head.appendChild(script);
  });

  return scriptLoadingPromise;
}

/**
 * Initializes Google Identity Services with client ID and token callback.
 */
export function initializeGoogleIdentity(options: {
  clientId: string;
  onCredentialReceived: (idToken: string) => void;
}): void {
  if (typeof window === 'undefined' || !window.google?.accounts?.id) {
    throw new Error('Google Identity Services script is not loaded');
  }

  window.google.accounts.id.initialize({
    client_id: options.clientId,
    callback: (response) => {
      if (response && response.credential) {
        options.onCredentialReceived(response.credential);
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });
}

/**
 * Renders the official Google button into a target DOM container.
 */
export function renderGoogleButton(
  container: HTMLElement,
  options: {
    mode?: 'signin' | 'signup' | 'link';
    disabled?: boolean;
    width?: number | string;
    onClickListener?: () => void;
  }
): void {
  if (typeof window === 'undefined' || !window.google?.accounts?.id) {
    return;
  }

  const textType =
    options.mode === 'signup'
      ? 'signup_with'
      : options.mode === 'link'
      ? 'continue_with'
      : 'signin_with';

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: textType,
    shape: 'rectangular',
    logo_alignment: 'left',
    width: options.width ?? '100%',
    locale: 'vi',
    click_listener: options.onClickListener,
  });
}
