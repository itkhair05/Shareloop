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
});
