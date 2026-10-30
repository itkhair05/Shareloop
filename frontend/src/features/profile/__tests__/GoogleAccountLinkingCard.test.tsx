import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { GoogleAccountLinkingCard } from '../components/GoogleAccountLinkingCard';
import { authApi } from '@/features/auth/api/auth-api';
import { ApiError } from '@/lib/api-error';
import { renderWithProviders } from '@/test/test-utils';
import * as googleIdentity from '@/features/auth/utils/google-identity';
import type { GoogleAccountStatusResponse } from '@/types/auth';

vi.mock('@/features/auth/api/auth-api', () => ({
  authApi: {
    getGoogleAccountStatus: vi.fn(),
    linkGoogleAccount: vi.fn(),
  },
}));

describe('GoogleAccountLinkingCard', () => {
  let capturedCallback: ((idToken: string) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedCallback = undefined;

    vi.spyOn(googleIdentity, 'isGoogleAuthConfigured').mockReturnValue(true);
    vi.spyOn(googleIdentity, 'getGoogleClientId').mockReturnValue('mock-client-id');
    vi.spyOn(googleIdentity, 'loadGoogleIdentityScript').mockResolvedValue(undefined);
    vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation((options) => {
      capturedCallback = options.onCredentialReceived;
    });
    vi.spyOn(googleIdentity, 'renderGoogleButton').mockImplementation(vi.fn());
  });

  it('renders unlinked status and link button when Google is not linked', async () => {
    const unlinkedStatus: GoogleAccountStatusResponse = {
      linked: false,
      provider: 'GOOGLE',
      email: null,
      linkedAt: null,
    };
    vi.mocked(authApi.getGoogleAccountStatus).mockResolvedValueOnce(unlinkedStatus);

    renderWithProviders(<GoogleAccountLinkingCard />);

    await waitFor(() => {
      expect(screen.getByText(/liên kết tài khoản mạng xã hội/i)).toBeInTheDocument();
      expect(screen.getByText(/chưa liên kết/i)).toBeInTheDocument();
      expect(
        screen.getByText(/liên kết tài khoản google để đăng nhập an toàn/i)
      ).toBeInTheDocument();
    });
  });

  it('renders linked status and safe metadata when Google is linked, without unlink button', async () => {
    const linkedStatus: GoogleAccountStatusResponse = {
      linked: true,
      provider: 'GOOGLE',
      email: 'user.linked@gmail.com',
      linkedAt: '2026-10-30T08:30:00Z',
    };
    vi.mocked(authApi.getGoogleAccountStatus).mockResolvedValueOnce(linkedStatus);

    renderWithProviders(<GoogleAccountLinkingCard />);

    await waitFor(() => {
      expect(screen.getByText(/đã liên kết/i)).toBeInTheDocument();
      expect(screen.getByText('user.linked@gmail.com')).toBeInTheDocument();
      expect(screen.getByText(/liên kết vào:/i)).toBeInTheDocument();
      expect(screen.getByText(/bảo mật liên kết đang hoạt động/i)).toBeInTheDocument();
      // Verifies no unlink button is present
      expect(screen.queryByRole('button', { name: /hủy liên kết/i })).not.toBeInTheDocument();
    });
  });

  it('successfully links Google account and refreshes status', async () => {
    const unlinkedStatus: GoogleAccountStatusResponse = {
      linked: false,
      provider: 'GOOGLE',
      email: null,
      linkedAt: null,
    };
    const newlyLinkedStatus: GoogleAccountStatusResponse = {
      linked: true,
      provider: 'GOOGLE',
      email: 'newlink@gmail.com',
      linkedAt: '2026-10-30T10:00:00Z',
    };

    vi.mocked(authApi.getGoogleAccountStatus).mockResolvedValueOnce(unlinkedStatus);
    vi.mocked(authApi.linkGoogleAccount).mockResolvedValueOnce(newlyLinkedStatus);

    renderWithProviders(<GoogleAccountLinkingCard />);

    await waitFor(() => {
      expect(screen.getByText(/chưa liên kết/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(capturedCallback).toBeDefined();
    });

    await act(async () => {
      capturedCallback!('id-token-for-linking');
    });

    await waitFor(() => {
      expect(authApi.linkGoogleAccount).toHaveBeenCalledWith({ idToken: 'id-token-for-linking' });
      expect(
        screen.getByText(/liên kết tài khoản google thành công!/i)
      ).toBeInTheDocument();
    });
  });

  it('handles HTTP 409 when Google identity is already linked to another account', async () => {
    const unlinkedStatus: GoogleAccountStatusResponse = {
      linked: false,
      provider: 'GOOGLE',
      email: null,
      linkedAt: null,
    };
    vi.mocked(authApi.getGoogleAccountStatus).mockResolvedValueOnce(unlinkedStatus);
    vi.mocked(authApi.linkGoogleAccount).mockRejectedValueOnce(
      new ApiError({
        status: 409,
        error: 'Conflict',
        message: 'This Google account is already linked to another ShareLoop account.',
      })
    );

    renderWithProviders(<GoogleAccountLinkingCard />);

    await waitFor(() => {
      expect(capturedCallback).toBeDefined();
    });

    await act(async () => {
      capturedCallback!('id-token-in-use');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/tài khoản google này đã được liên kết với một tài khoản shareloop khác/i)
      ).toBeInTheDocument();
    });
  });

  it('handles HTTP 409 when current user is already linked to Google', async () => {
    const unlinkedStatus: GoogleAccountStatusResponse = {
      linked: false,
      provider: 'GOOGLE',
      email: null,
      linkedAt: null,
    };
    vi.mocked(authApi.getGoogleAccountStatus).mockResolvedValueOnce(unlinkedStatus);
    vi.mocked(authApi.linkGoogleAccount).mockRejectedValueOnce(
      new ApiError({
        status: 409,
        error: 'Conflict',
        message: 'Your ShareLoop account is already linked to a Google account.',
      })
    );

    renderWithProviders(<GoogleAccountLinkingCard />);

    await waitFor(() => {
      expect(capturedCallback).toBeDefined();
    });

    await act(async () => {
      capturedCallback!('id-token-already-linked');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/tài khoản shareloop của bạn đã được liên kết với một tài khoản google/i)
      ).toBeInTheDocument();
    });
  });

  it('handles HTTP 429 rate limit error when linking Google account', async () => {
    const unlinkedStatus: GoogleAccountStatusResponse = {
      linked: false,
      provider: 'GOOGLE',
      email: null,
      linkedAt: null,
    };
    vi.mocked(authApi.getGoogleAccountStatus).mockResolvedValueOnce(unlinkedStatus);
    vi.mocked(authApi.linkGoogleAccount).mockRejectedValueOnce(
      new ApiError({
        status: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
      })
    );

    renderWithProviders(<GoogleAccountLinkingCard />);

    await waitFor(() => {
      expect(capturedCallback).toBeDefined();
    });

    await act(async () => {
      capturedCallback!('id-token-throttled');
    });

    await waitFor(() => {
      expect(
        screen.getByText(/quá nhiều yêu cầu liên kết/i)
      ).toBeInTheDocument();
    });
  });
});
