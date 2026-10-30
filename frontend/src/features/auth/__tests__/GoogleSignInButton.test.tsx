import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import * as googleIdentity from '../utils/google-identity';

describe('GoogleSignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders disabled note when Google client ID is not configured', () => {
    vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(false);

    render(<GoogleSignInButton onSuccess={vi.fn()} />);

    expect(
      screen.getByText(/đăng nhập google hiện chưa khả dụng/i)
    ).toBeInTheDocument();
  });

  it('loads Google script and renders container when client ID is configured', async () => {
    vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
    vi.spyOn(googleIdentity, 'getGoogleClientId').mockReturnValue('mock-client-id.apps.googleusercontent.com');
    const loadScriptSpy = vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);
    const initSpy = vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation(vi.fn());
    const renderButtonSpy = vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());

    render(<GoogleSignInButton onSuccess={vi.fn()} mode="signin" />);

    await waitFor(() => {
      expect(loadScriptSpy).toHaveBeenCalled();
      expect(initSpy).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'mock-client-id.apps.googleusercontent.com' })
      );
      expect(renderButtonSpy).toHaveBeenCalled();
      expect(screen.getByTestId('google-signin-container')).toBeInTheDocument();
    });
  });

  it('renders error alert with retry button when script fails to load', async () => {
    vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
    vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockRejectedValue(
      new Error('Mạng không ổn định')
    );

    render(<GoogleSignInButton onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/mạng không ổn định/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /thử lại/i })).toBeInTheDocument();
    });
  });

  it('calls onSuccess when credential callback is triggered', async () => {
    const onSuccessMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
    vi.spyOn(googleIdentity, 'getGoogleClientId').mockReturnValue('mock-client-id');
    vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);

    let capturedCallback: ((idToken: string) => void) | undefined;
    vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation((options) => {
      capturedCallback = options.onCredentialReceived;
    });
    vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());

    render(<GoogleSignInButton onSuccess={onSuccessMock} />);

    await waitFor(() => {
      expect(capturedCallback).toBeDefined();
    });

    // Simulate receiving token from Google
    await act(async () => {
      capturedCallback!('mock-google-id-token-xyz');
    });

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledWith('mock-google-id-token-xyz');
    });
  });

  it('prevents multiple submissions when disabled or processing', async () => {
    const onSuccessMock = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200))
    );
    vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
    vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);

    let capturedCallback: ((idToken: string) => void) | undefined;
    vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation((options) => {
      capturedCallback = options.onCredentialReceived;
    });
    vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());

    render(<GoogleSignInButton onSuccess={onSuccessMock} disabled={true} />);

    await waitFor(() => {
      expect(capturedCallback).toBeDefined();
    });

    // Trigger callback while disabled
    capturedCallback!('mock-token');

    // Should NOT call onSuccess because button is disabled
    expect(onSuccessMock).not.toHaveBeenCalled();
  });

  describe('Responsive Width & ResizeObserver Handling', () => {
    it('clamps fixed numeric width to Google allowed range [200, 400]', async () => {
      vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
      vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);
      vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation(vi.fn());
      const renderSpy = vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());

      // Test width below minimum (150 -> 200)
      const { unmount } = render(<GoogleSignInButton onSuccess={vi.fn()} width={150} />);
      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ width: 200 })
        );
      });
      unmount();

      // Test width above maximum (500 -> 400)
      render(<GoogleSignInButton onSuccess={vi.fn()} width={500} />);
      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ width: 400 })
        );
      });
    });

    it('measures container width and clamps responsive width within [200, 400]', async () => {
      vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
      vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);
      vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation(vi.fn());
      const renderSpy = vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());

      // Mock getBoundingClientRect on container element to simulate 281px (iPhone SE available width)
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        width: 281,
        height: 44,
        top: 0,
        left: 0,
        bottom: 44,
        right: 281,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      render(<GoogleSignInButton onSuccess={vi.fn()} width="100%" />);

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ width: 281 })
        );
      });
    });

    it('re-renders with new width when ResizeObserver reports container resize', async () => {
      vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
      vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);
      vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation(vi.fn());
      const renderSpy = vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());

      const { container } = render(<GoogleSignInButton onSuccess={vi.fn()} width="100%" />);

      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalled();
      });

      const initialCalls = renderSpy.mock.calls.length;

      // Access the mock ResizeObserver instance created during render
      const instances = (window.ResizeObserver as unknown as { instances: Array<{ trigger: (entries: unknown[]) => void }> }).instances;
      const latestObserver = instances[instances.length - 1];
      expect(latestObserver).toBeDefined();

      // Simulate resizing container from 281px to 360px
      await act(async () => {
        latestObserver.trigger([
          {
            target: container.querySelector('[data-testid="google-signin-container"]')!,
            contentRect: { width: 360, height: 44 } as DOMRectReadOnly,
          },
        ]);
        // Allow requestAnimationFrame to run
        await new Promise((r) => setTimeout(r, 50));
      });

      await waitFor(() => {
        expect(renderSpy.mock.calls.length).toBeGreaterThan(initialCalls);
        const lastCall = renderSpy.mock.calls[renderSpy.mock.calls.length - 1];
        expect(lastCall[1]).toEqual(expect.objectContaining({ width: 360 }));
      });
    });

    it('disconnects ResizeObserver cleanly when unmounted', async () => {
      vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
      vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);
      vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation(vi.fn());
      vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());

      const disconnectSpy = vi.fn();
      const originalRO = window.ResizeObserver;
      class CustomROMock {
        static instances: CustomROMock[] = [];
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = disconnectSpy;
      }
      window.ResizeObserver = CustomROMock as unknown as typeof ResizeObserver;

      const { unmount } = render(<GoogleSignInButton onSuccess={vi.fn()} width="100%" />);

      await waitFor(() => {
        expect(CustomROMock.instances).toBeDefined();
      });

      unmount();
      expect(disconnectSpy).toHaveBeenCalled();

      window.ResizeObserver = originalRO;
    });
  });
});

