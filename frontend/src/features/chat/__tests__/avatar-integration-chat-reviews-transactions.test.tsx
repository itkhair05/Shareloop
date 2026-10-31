import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test/test-utils';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { chatApi } from '@/features/chat/api/chat-api';
import { UserReviewsList } from '@/features/reviews/components/UserReviewsList';
import { CreateReviewModal } from '@/features/reviews/components/CreateReviewModal';
import { TransactionsPage } from '@/features/transactions/pages/TransactionsPage';
import { TransactionDetailPage } from '@/features/transactions/pages/TransactionDetailPage';
import { transactionApi } from '@/features/transactions/api/transaction-api';
import { useAuth } from '@/features/auth';
import type { ConversationResponse, ChatMessageResponse } from '@/types/chat';
import type { ReviewResponse } from '@/types/review';
import type { TransactionResponse } from '@/types/transaction';
import type { UserProfile } from '@/types/auth';

vi.mock('@/features/chat/api/chat-api', () => ({
  chatApi: {
    getUserConversations: vi.fn(),
    getConversationDetails: vi.fn(),
    getMessageHistory: vi.fn(),
    sendMessage: vi.fn(),
    getOrCreateConversation: vi.fn(),
  },
  chatKeys: {
    all: ['chat'] as const,
    conversations: () => ['chat', 'conversations'] as const,
    conversationList: (params?: unknown) => ['chat', 'conversations', 'list', params] as const,
    conversationDetails: () => ['chat', 'conversations', 'detail'] as const,
    conversationDetail: (id: string) => ['chat', 'conversations', 'detail', id] as const,
    messages: () => ['chat', 'messages'] as const,
    messageList: (conversationId: string, params?: unknown) =>
      ['chat', 'messages', conversationId, params] as const,
  },
}));

vi.mock('@/features/reviews/api/review-api', () => ({
  reviewApi: {
    createReview: vi.fn(),
    getTransactionReviews: vi.fn().mockResolvedValue([]),
    getUserRatingSummary: vi.fn(),
    getUserReviews: vi.fn(),
  },
  reviewKeys: {
    all: ['reviews'] as const,
    ratingSummaries: () => ['reviews', 'rating-summary'] as const,
    ratingSummary: (userId: string) => ['reviews', 'rating-summary', userId] as const,
    userReviewsAll: () => ['reviews', 'user-reviews'] as const,
    userReviews: (userId: string, params?: unknown) =>
      ['reviews', 'user-reviews', userId, params] as const,
    transactionReviewsAll: () => ['reviews', 'transaction-reviews'] as const,
    transactionReviews: (transactionId: string) =>
      ['reviews', 'transaction-reviews', transactionId] as const,
  },
}));

vi.mock('@/features/transactions/api/transaction-api', () => ({
  transactionApi: {
    getUserTransactions: vi.fn(),
    getTransactionDetails: vi.fn(),
    getListingTransaction: vi.fn(),
    completeTransaction: vi.fn(),
    cancelTransaction: vi.fn(),
  },
  transactionKeys: {
    all: ['transactions'] as const,
    lists: () => ['transactions', 'list'] as const,
    list: (params: unknown) => ['transactions', 'list', params] as const,
    details: () => ['transactions', 'detail'] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
    listings: () => ['transactions', 'listing'] as const,
    listing: (listingId: string) => ['transactions', 'listing', listingId] as const,
  },
}));

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const mockCurrentUser: UserProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  displayName: 'Nguyễn Văn Tôi',
  email: 'toi@shareloop.org',
  role: 'USER',
  status: 'ACTIVE',
  avatarUrl: '/api/v1/files/my-avatar.jpg',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const mockParticipantCustomAvatar = {
  id: '00000000-0000-0000-0000-000000000002',
  displayName: 'Trần Thị Bạn',
  avatarUrl: '/api/v1/files/custom-avatar-123.jpg',
};

const mockParticipantGoogleAvatar = {
  id: '00000000-0000-0000-0000-000000000003',
  displayName: 'Lê Văn Chi',
  avatarUrl: 'https://lh3.googleusercontent.com/a/google-avatar-456',
};

const mockParticipantNoAvatar = {
  id: '00000000-0000-0000-0000-000000000004',
  displayName: 'Phạm Đức Dũng',
  avatarUrl: null,
};

describe('ShareLoop — Phase 1C.12.7.3.3: Chat, Reviews & Transactions Avatar Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      user: mockCurrentUser,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  // ==========================================
  // DOMAIN 1: CHAT AVATAR INTEGRATION
  // ==========================================
  describe('A. Chat Domain Avatar Integration', () => {
    const mockConversations: ConversationResponse[] = [
      {
        id: 'c1111111-1111-1111-1111-111111111111',
        listing: {
          id: 'l1111111-1111-1111-1111-111111111111',
          title: 'Bàn làm việc thông minh',
          listingType: 'GIVEAWAY',
          status: 'ACTIVE',
          price: null,
          currency: 'VND',
          city: 'Hà Nội',
          owner: {
            id: mockParticipantCustomAvatar.id,
            displayName: mockParticipantCustomAvatar.displayName,
          },
        },
        otherParticipant: mockParticipantCustomAvatar,
        lastMessagePreview: 'Món đồ vẫn còn bạn nhé',
        lastMessageAt: '2026-10-30T10:00:00Z',
        listingRequestId: null,
        createdAt: '2026-10-30T09:00:00Z',
        updatedAt: '2026-10-30T10:00:00Z',
      },
      {
        id: 'c2222222-2222-2222-2222-222222222222',
        listing: {
          id: 'l2222222-2222-2222-2222-222222222222',
          title: 'Ghế xoay văn phòng Hòa Phát',
          listingType: 'SALE',
          status: 'ACTIVE',
          price: 300000,
          currency: 'VND',
          city: 'Đà Nẵng',
          owner: {
            id: mockParticipantGoogleAvatar.id,
            displayName: mockParticipantGoogleAvatar.displayName,
          },
        },
        otherParticipant: mockParticipantGoogleAvatar,
        lastMessagePreview: 'Bạn ghé lấy được lúc nào?',
        lastMessageAt: '2026-10-30T11:00:00Z',
        listingRequestId: null,
        createdAt: '2026-10-30T08:00:00Z',
        updatedAt: '2026-10-30T11:00:00Z',
      },
      {
        id: 'c3333333-3333-3333-3333-333333333333',
        listing: {
          id: 'l3333333-3333-3333-3333-333333333333',
          title: 'Tủ sách 3 tầng mini',
          listingType: 'GIVEAWAY',
          status: 'ACTIVE',
          price: null,
          currency: 'VND',
          city: 'Hồ Chí Minh',
          owner: {
            id: mockParticipantNoAvatar.id,
            displayName: mockParticipantNoAvatar.displayName,
          },
        },
        otherParticipant: mockParticipantNoAvatar,
        lastMessagePreview: null,
        lastMessageAt: null,
        listingRequestId: null,
        createdAt: '2026-10-30T07:00:00Z',
        updatedAt: '2026-10-30T07:00:00Z',
      },
    ];

    it('ConversationList renders custom avatar, Google avatar, and initials fallback for different participants', async () => {
      vi.mocked(chatApi.getUserConversations).mockResolvedValueOnce({
        content: mockConversations,
        totalElements: 3,
        totalPages: 1,
        size: 20,
        number: 0,
        first: true,
        last: true,
        empty: false,
      });

      renderWithProviders(<ConversationList />);

      // Participant 1 (custom avatar) -> img with custom avatar URL
      const customAvatarImg = await screen.findByRole('img', {
        name: /Ảnh đại diện của Trần Thị Bạn/i,
      });
      expect(customAvatarImg).toHaveAttribute('src', expect.stringContaining('custom-avatar-123.jpg'));

      // Participant 2 (Google avatar) -> img with Google URL and no-referrer policy
      const googleAvatarImg = screen.getByRole('img', {
        name: /Ảnh đại diện của Lê Văn Chi/i,
      });
      expect(googleAvatarImg).toHaveAttribute(
        'src',
        'https://lh3.googleusercontent.com/a/google-avatar-456'
      );
      expect(googleAvatarImg).toHaveAttribute('referrerpolicy', 'no-referrer');

      // Participant 3 (no avatar) -> initials fallback element with accessible label
      const initialsFallback = screen.getByRole('img', {
        name: /Ảnh đại diện của Phạm Đức Dũng/i,
      });
      expect(initialsFallback).toHaveTextContent('PD'); // Initials of Phạm Đức Dũng
    });

    it('ChatWindow active header displays participant avatar according to hierarchy', async () => {
      vi.mocked(chatApi.getConversationDetails).mockResolvedValueOnce(mockConversations[0]);
      vi.mocked(chatApi.getMessageHistory).mockResolvedValueOnce({
        content: [],
        totalElements: 0,
        totalPages: 1,
        size: 50,
        number: 0,
        first: true,
        last: true,
        empty: true,
      });

      renderWithProviders(
        <ChatWindow conversationId={mockConversations[0].id} />
      );

      const headerAvatar = await screen.findByRole('img', {
        name: /Ảnh đại diện của Trần Thị Bạn/i,
      });
      expect(headerAvatar).toBeInTheDocument();
      expect(headerAvatar).toHaveAttribute('src', expect.stringContaining('custom-avatar-123.jpg'));
    });

    it('MessageBubble displays sender avatar for incoming message, and respects showAvatar=false for consecutive messages', () => {
      const msg: ChatMessageResponse = {
        id: 'msg-test-1',
        conversationId: 'c1111111-1111-1111-1111-111111111111',
        sender: mockParticipantCustomAvatar,
        content: 'Tin nhắn đầu tiên',
        createdAt: '2026-10-30T10:01:00Z',
      };

      // Case 1: showAvatar=true (default or last message of consecutive group)
      const { rerender } = renderWithProviders(
        <MessageBubble message={msg} isOwn={false} showAvatar={true} showSenderName={true} />
      );

      const avatarImg = screen.getByRole('img', {
        name: /Ảnh đại diện của Trần Thị Bạn/i,
      });
      expect(avatarImg).toBeInTheDocument();
      expect(screen.getByText('Trần Thị Bạn')).toBeInTheDocument();

      // Case 2: showAvatar=false, showSenderName=false (earlier message of consecutive group)
      rerender(
        <MessageBubble message={msg} isOwn={false} showAvatar={false} showSenderName={false} />
      );

      expect(screen.queryByRole('img', { name: /Ảnh đại diện của Trần Thị Bạn/i })).not.toBeInTheDocument();
      expect(screen.queryByText('Trần Thị Bạn')).not.toBeInTheDocument();
    });

    it('ChatWindow groups consecutive messages from the same sender so avatar is not duplicated', async () => {
      const msg1: ChatMessageResponse = {
        id: 'msg-consec-1',
        conversationId: mockConversations[0].id,
        sender: mockParticipantCustomAvatar,
        content: 'Tin nhắn 1 từ bạn',
        createdAt: '2026-10-30T10:00:00Z',
      };
      const msg2: ChatMessageResponse = {
        id: 'msg-consec-2',
        conversationId: mockConversations[0].id,
        sender: mockParticipantCustomAvatar,
        content: 'Tin nhắn 2 từ bạn (liên tiếp)',
        createdAt: '2026-10-30T10:01:00Z',
      };
      const msg3: ChatMessageResponse = {
        id: 'msg-consec-3',
        conversationId: mockConversations[0].id,
        sender: {
          id: mockCurrentUser.id,
          displayName: mockCurrentUser.displayName,
        },
        content: 'Tôi trả lời lại',
        createdAt: '2026-10-30T10:02:00Z',
      };

      vi.mocked(chatApi.getConversationDetails).mockResolvedValueOnce(mockConversations[0]);
      vi.mocked(chatApi.getMessageHistory).mockResolvedValueOnce({
        content: [msg3, msg2, msg1],
        totalElements: 3,
        totalPages: 1,
        size: 50,
        number: 0,
        first: true,
        last: true,
        empty: false,
      });

      renderWithProviders(
        <ChatWindow conversationId={mockConversations[0].id} />
      );

      await waitFor(() => {
        expect(screen.getByText('Tin nhắn 1 từ bạn')).toBeInTheDocument();
        expect(screen.getByText('Tin nhắn 2 từ bạn (liên tiếp)')).toBeInTheDocument();
      });

      // Exactly 2 participant avatars in total: 1 in the header + 1 for msg2 (the last message of the consecutive group)
      // msg1 avatar is suppressed to avoid consecutive duplication
      const participantAvatars = screen.getAllByRole('img', {
        name: /Ảnh đại diện của Trần Thị Bạn/i,
      });
      expect(participantAvatars).toHaveLength(2);
    });
  });

  // ==========================================
  // DOMAIN 2: REVIEWS AVATAR INTEGRATION
  // ==========================================
  describe('B. Reviews Domain Avatar Integration', () => {
    const mockReviewsWithAvatars: ReviewResponse[] = [
      {
        id: 'rev-1',
        transactionId: 'tx-1',
        listing: {
          id: 'list-1',
          title: 'Đèn bàn học sinh',
          listingType: 'GIVEAWAY',
          status: 'COMPLETED',
          price: null,
          currency: null,
          city: 'Hà Nội',
          owner: { id: mockCurrentUser.id, displayName: mockCurrentUser.displayName },
        },
        reviewer: {
          id: mockParticipantCustomAvatar.id,
          displayName: mockParticipantCustomAvatar.displayName,
          avatarUrl: mockParticipantCustomAvatar.avatarUrl,
        },
        reviewee: {
          id: mockCurrentUser.id,
          displayName: mockCurrentUser.displayName,
          avatarUrl: mockCurrentUser.avatarUrl,
        },
        rating: 5,
        comment: 'Người cho rất thân thiện và chu đáo!',
        createdAt: '2026-10-25T14:00:00Z',
      },
      {
        id: 'rev-2',
        transactionId: 'tx-2',
        listing: null,
        reviewer: {
          id: mockParticipantNoAvatar.id,
          displayName: mockParticipantNoAvatar.displayName,
          avatarUrl: null,
        },
        reviewee: {
          id: mockCurrentUser.id,
          displayName: mockCurrentUser.displayName,
        },
        rating: 4,
        comment: null,
        createdAt: '2026-10-26T16:00:00Z',
      },
    ];

    it('UserReviewsList renders reviewer avatar and links to public profile', () => {
      renderWithProviders(
        <UserReviewsList
          reviews={mockReviewsWithAvatars}
          totalElements={2}
          totalPages={1}
          currentPage={0}
          onPageChange={vi.fn()}
        />
      );

      // Reviewer 1 (custom avatar)
      const reviewer1Avatar = screen.getByRole('img', {
        name: /Ảnh đại diện của Trần Thị Bạn/i,
      });
      expect(reviewer1Avatar).toHaveAttribute('src', expect.stringContaining('custom-avatar-123.jpg'));

      // Link to profile
      const reviewer1Link = screen.getByRole('link', {
        name: /Hồ sơ của Trần Thị Bạn/i,
      });
      expect(reviewer1Link).toHaveAttribute('href', `/users/${mockParticipantCustomAvatar.id}`);

      // Reviewer 2 (initials fallback)
      const reviewer2Avatar = screen.getByRole('img', {
        name: /Ảnh đại diện của Phạm Đức Dũng/i,
      });
      expect(reviewer2Avatar).toHaveTextContent('PD');
    });

    it('CreateReviewModal displays partner (reviewee) avatar in partner info banner', () => {
      const mockTx: TransactionResponse = {
        id: 'tx-review-test',
        listing: {
          id: 'listing-1',
          title: 'Bộ ấm chén Bát Tràng',
          listingType: 'GIVEAWAY',
          status: 'COMPLETED',
          price: null,
          currency: 'VND',
          city: 'Hà Nội',
          owner: {
            id: mockCurrentUser.id,
            displayName: mockCurrentUser.displayName,
          },
        },
        listingRequestId: null,
        owner: {
          id: mockCurrentUser.id,
          displayName: mockCurrentUser.displayName,
          avatarUrl: mockCurrentUser.avatarUrl,
        },
        requester: {
          id: mockParticipantGoogleAvatar.id,
          displayName: mockParticipantGoogleAvatar.displayName,
          avatarUrl: mockParticipantGoogleAvatar.avatarUrl,
        },
        status: 'COMPLETED',
        ownerCompleted: true,
        requesterCompleted: true,
        ownerCompletedAt: '2026-10-28T10:00:00Z',
        requesterCompletedAt: '2026-10-28T10:05:00Z',
        myRole: 'OWNER',
        myCompleted: true,
        cancelledBy: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: '2026-10-28T09:00:00Z',
        updatedAt: '2026-10-28T10:05:00Z',
      };

      renderWithProviders(
        <CreateReviewModal
          isOpen={true}
          onClose={vi.fn()}
          transaction={mockTx}
        />
      );

      // Current user is OWNER, partner being reviewed is requester (Lê Văn Chi with Google avatar)
      const partnerAvatar = screen.getByRole('img', {
        name: /Ảnh đại diện của Lê Văn Chi/i,
      });
      expect(partnerAvatar).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/google-avatar-456');
      expect(partnerAvatar).toHaveAttribute('referrerpolicy', 'no-referrer');
      expect(screen.getByText(/Bạn đang đánh giá trải nghiệm trao đổi với:/i)).toBeInTheDocument();
    });
  });

  // ==========================================
  // DOMAIN 3: TRANSACTIONS AVATAR INTEGRATION
  // ==========================================
  describe('C. Transactions Domain Avatar Integration', () => {
    const mockTxActive: TransactionResponse = {
      id: '11111111-1111-1111-1111-111111111111',
      listing: {
        id: 'l1',
        title: 'Nồi chiên Lock&Lock',
        listingType: 'GIVEAWAY',
        status: 'RESERVED',
        price: null,
        currency: 'VND',
        city: 'Hà Nội',
        owner: { id: mockParticipantCustomAvatar.id, displayName: mockParticipantCustomAvatar.displayName },
      },
      listingRequestId: 'req-1',
      owner: {
        id: mockParticipantCustomAvatar.id,
        displayName: mockParticipantCustomAvatar.displayName,
        avatarUrl: mockParticipantCustomAvatar.avatarUrl,
      },
      requester: {
        id: mockParticipantGoogleAvatar.id,
        displayName: mockParticipantGoogleAvatar.displayName,
        avatarUrl: mockParticipantGoogleAvatar.avatarUrl,
      },
      status: 'IN_PROGRESS',
      ownerCompleted: true,
      requesterCompleted: false,
      ownerCompletedAt: '2026-10-29T10:00:00Z',
      requesterCompletedAt: null,
      myRole: 'OWNER',
      myCompleted: true,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: '2026-10-29T08:00:00Z',
      updatedAt: '2026-10-29T10:00:00Z',
    };

    const mockTxCancelledWithUser: TransactionResponse = {
      ...mockTxActive,
      id: '22222222-2222-2222-2222-222222222222',
      status: 'CANCELLED',
      cancelledBy: {
        id: mockParticipantNoAvatar.id,
        displayName: mockParticipantNoAvatar.displayName,
        avatarUrl: null,
      },
      cancellationReason: 'Không sắp xếp được thời gian đến nhận',
      cancelledAt: '2026-10-29T11:00:00Z',
    };

    it('TransactionsPage displays Owner and Requester avatars in handoff step progress cards', async () => {
      vi.mocked(transactionApi.getUserTransactions).mockResolvedValueOnce({
        content: [mockTxActive],
        totalElements: 1,
        totalPages: 1,
        size: 10,
        number: 0,
        first: true,
        last: true,
        empty: false,
      });

      renderWithProviders(
        <Routes>
          <Route path="/transactions" element={<TransactionsPage />} />
        </Routes>,
        { initialEntries: ['/transactions'] }
      );

      // Owner avatar (custom)
      const ownerAvatar = await screen.findByRole('img', {
        name: /Ảnh đại diện của Trần Thị Bạn/i,
      });
      expect(ownerAvatar).toHaveAttribute('src', expect.stringContaining('custom-avatar-123.jpg'));

      // Requester avatar (Google)
      const requesterAvatar = screen.getByRole('img', {
        name: /Ảnh đại diện của Lê Văn Chi/i,
      });
      expect(requesterAvatar).toHaveAttribute('src', 'https://lh3.googleusercontent.com/a/google-avatar-456');
    });

    it('TransactionsPage displays cancelledBy avatar when transaction is cancelled', async () => {
      vi.mocked(transactionApi.getUserTransactions).mockResolvedValueOnce({
        content: [mockTxCancelledWithUser],
        totalElements: 1,
        totalPages: 1,
        size: 10,
        number: 0,
        first: true,
        last: true,
        empty: false,
      });

      renderWithProviders(
        <Routes>
          <Route path="/transactions" element={<TransactionsPage />} />
        </Routes>,
        { initialEntries: ['/transactions'] }
      );

      // Cancelled by participant (initials fallback: Phạm Đức Dũng -> PD)
      const cancelledByAvatar = await screen.findByRole('img', {
        name: /Ảnh đại diện của Phạm Đức Dũng/i,
      });
      expect(cancelledByAvatar).toHaveTextContent('PD');
      expect(screen.getByText(/bởi Phạm Đức Dũng/)).toBeInTheDocument();
    });

    it('TransactionDetailPage displays participant avatars in handoff sections and cancelledBy in cancellation banner', async () => {
      vi.mocked(transactionApi.getTransactionDetails).mockResolvedValueOnce(mockTxCancelledWithUser);

      renderWithProviders(
        <Routes>
          <Route path="/transactions/:id" element={<TransactionDetailPage />} />
        </Routes>,
        { initialEntries: [`/transactions/${mockTxCancelledWithUser.id}`] }
      );

      // Owner avatar
      const ownerAvatar = await screen.findByRole('img', {
        name: /Ảnh đại diện của Trần Thị Bạn/i,
      });
      expect(ownerAvatar).toBeInTheDocument();

      // Requester avatar
      const requesterAvatar = screen.getByRole('img', {
        name: /Ảnh đại diện của Lê Văn Chi/i,
      });
      expect(requesterAvatar).toBeInTheDocument();

      // CancelledBy avatar in banner
      const cancelledByAvatar = screen.getByRole('img', {
        name: /Ảnh đại diện của Phạm Đức Dũng/i,
      });
      expect(cancelledByAvatar).toHaveTextContent('PD');
      expect(screen.getByText('Giao dịch đã bị hủy bởi Phạm Đức Dũng')).toBeInTheDocument();
    });
  });
});
