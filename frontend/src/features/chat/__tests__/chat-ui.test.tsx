import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { chatApi } from '@/features/chat/api/chat-api';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { StartChatModal } from '@/features/chat/components/StartChatModal';
import { MessagesPage } from '@/features/chat/pages/MessagesPage';
import { ListingDetailPage } from '@/features/listings/pages/ListingDetailPage';
import { listingApi } from '@/features/listings/api/listing-api';
import { requestApi } from '@/features/requests/api/request-api';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
import type {
  ConversationResponse,
  ChatMessageResponse,
} from '@/types/chat';
import type { PageResponse } from '@/types/api';
import type { UserProfile } from '@/types/auth';
import type { ListingResponse } from '@/types/listing';

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

vi.mock('@/features/listings/api/listing-api', () => ({
  listingApi: {
    getListingById: vi.fn(),
    getListings: vi.fn(),
  },
  listingKeys: {
    all: ['listings'] as const,
    detail: (id: string) => ['listings', 'detail', id] as const,
  },
}));

vi.mock('@/features/requests/api/request-api', () => ({
  requestApi: {
    getMyRequests: vi.fn(),
    getRequestsForListing: vi.fn(),
    createRequest: vi.fn(),
  },
  requestKeys: {
    all: ['requests'] as const,
    mineLists: () => ['requests', 'mine'] as const,
    mine: (params?: unknown) => ['requests', 'mine', params] as const,
    listingLists: () => ['requests', 'listing'] as const,
    listing: (listingId: string, params?: unknown) => ['requests', 'listing', listingId, params] as const,
  },
}));

vi.mock('@/features/reviews/api/review-api', () => ({
  reviewApi: {
    getUserRatingSummary: vi.fn().mockResolvedValue({
      userId: 'owner-uuid-1',
      averageRating: 5.0,
      totalReviews: 2,
      fiveStarCount: 2,
      fourStarCount: 0,
      threeStarCount: 0,
      twoStarCount: 0,
      oneStarCount: 0,
    }),
    getUserReviews: vi.fn().mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 5,
      number: 0,
      first: true,
      last: true,
      empty: true,
    }),
  },
  reviewKeys: {
    all: ['reviews'] as const,
    ratingSummaries: () => ['reviews', 'rating-summary'] as const,
    ratingSummary: (userId: string) => ['reviews', 'rating-summary', userId] as const,
    userReviewsAll: () => ['reviews', 'user-reviews'] as const,
    userReviews: (userId: string, params?: unknown) => ['reviews', 'user-reviews', userId, params] as const,
    transactionReviewsAll: () => ['reviews', 'transaction-reviews'] as const,
    transactionReviews: (transactionId: string) => ['reviews', 'transaction-reviews', transactionId] as const,
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
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const mockOtherUser = {
  id: '00000000-0000-0000-0000-000000000002',
  displayName: 'Trần Thị Bạn',
  avatarUrl: null,
};

const mockOtherUser2 = {
  id: '00000000-0000-0000-0000-000000000003',
  displayName: 'Lê Văn Chi',
  avatarUrl: null,
};

const mockConversation1: ConversationResponse = {
  id: 'c1111111-1111-1111-1111-111111111111',
  listing: {
    id: 'a1111111-1111-1111-1111-111111111111',
    title: 'Bàn học sinh gỗ thông',
    listingType: 'GIVEAWAY',
    status: 'ACTIVE',
    price: null,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: '00000000-0000-0000-0000-000000000002',
      displayName: 'Trần Thị Bạn',
    },
  },
  otherParticipant: mockOtherUser,
  lastMessagePreview: 'Món đồ vẫn còn bạn nhé',
  lastMessageAt: '2026-10-26T14:30:00Z',
  listingRequestId: null,
  createdAt: '2026-10-26T10:00:00Z',
  updatedAt: '2026-10-26T14:30:00Z',
};

const mockConversationNoMessage: ConversationResponse = {
  id: 'c2222222-2222-2222-2222-222222222222',
  listing: {
    id: 'a2222222-2222-2222-2222-222222222222',
    title: 'Ghế xoay văn phòng',
    listingType: 'SALE',
    status: 'ACTIVE',
    price: 300000,
    currency: 'VND',
    city: 'Hà Nội',
    owner: {
      id: '00000000-0000-0000-0000-000000000003',
      displayName: 'Lê Văn Chi',
    },
  },
  otherParticipant: mockOtherUser2,
  lastMessagePreview: null,
  lastMessageAt: null,
  listingRequestId: null,
  createdAt: '2026-10-26T09:00:00Z',
  updatedAt: '2026-10-26T09:00:00Z',
};

const mockConversationsPage: PageResponse<ConversationResponse> = {
  content: [mockConversation1, mockConversationNoMessage],
  totalElements: 2,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const mockMessage1: ChatMessageResponse = {
  id: 'msg-1',
  conversationId: mockConversation1.id,
  sender: {
    id: '00000000-0000-0000-0000-000000000001',
    displayName: 'Nguyễn Văn Tôi',
  },
  content: 'Chào bạn, món đồ này còn không ạ?',
  createdAt: '2026-10-26T14:00:00Z',
};

const mockMessage2: ChatMessageResponse = {
  id: 'msg-2',
  conversationId: mockConversation1.id,
  sender: mockOtherUser,
  content: 'Món đồ vẫn còn bạn nhé',
  createdAt: '2026-10-26T14:30:00Z',
};

// Backend returns newest first: [mockMessage2, mockMessage1]
const mockMessagesPageDesc: PageResponse<ChatMessageResponse> = {
  content: [mockMessage2, mockMessage1],
  totalElements: 2,
  totalPages: 1,
  size: 50,
  number: 0,
  first: true,
  last: true,
  empty: false,
};

const mockListingDetail: ListingResponse = {
  id: 'a1111111-1111-1111-1111-111111111111',
  title: 'Bàn học sinh gỗ thông',
  description: 'Bàn còn rất mới dùng tốt',
  listingType: 'GIVEAWAY',
  status: 'ACTIVE',
  price: null,
  currency: 'VND',
  category: { id: 'cat-1', name: 'Đồ nội thất', slug: 'noi-that' },
  owner: { id: '00000000-0000-0000-0000-000000000002', displayName: 'Trần Thị Bạn' },
  images: [],
  neighborhood: 'Cầu Giấy',
  city: 'Hà Nội',
  stateProvince: null,
  country: 'Việt Nam',
  postalCode: null,
  expiresAt: null,
  createdAt: '2026-10-26T08:00:00Z',
  updatedAt: '2026-10-26T08:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('MessageBubble', () => {
  it('renders outgoing message aligned to right with emerald styling', () => {
    const { container } = renderWithProviders(
      <MessageBubble message={mockMessage1} isOwn={true} />
    );

    expect(screen.getByText('Chào bạn, món đồ này còn không ạ?')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('justify-end');
    expect(screen.queryByTitle('Nguyễn Văn Tôi')).not.toBeInTheDocument();
  });

  it('renders incoming message aligned to left with sender name and avatar', () => {
    const { container } = renderWithProviders(
      <MessageBubble message={mockMessage2} isOwn={false} />
    );

    expect(screen.getByText('Món đồ vẫn còn bạn nhé')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('justify-start');
    expect(screen.getByTitle('Trần Thị Bạn')).toBeInTheDocument();
  });
});

describe('ConversationList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatApi.getUserConversations).mockReset();
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
    vi.mocked(chatApi.getUserConversations).mockResolvedValue(mockConversationsPage);
  });

  it('renders conversation items with participant name, listing context, preview, and timestamp', async () => {
    renderWithProviders(<ConversationList />);

    expect(await screen.findByText('Trần Thị Bạn')).toBeInTheDocument();
    expect(screen.getByText('Lê Văn Chi')).toBeInTheDocument();
    expect(screen.getByText('Bàn học sinh gỗ thông')).toBeInTheDocument();
    expect(screen.getByText('Món đồ vẫn còn bạn nhé')).toBeInTheDocument();
    expect(screen.getByText('Ghế xoay văn phòng')).toBeInTheDocument();
    expect(screen.getByText('Chưa có tin nhắn nào')).toBeInTheDocument();
  });

  it('highlights the selected conversation', async () => {
    renderWithProviders(
      <ConversationList selectedConversationId={mockConversation1.id} />
    );

    const link = await screen.findByRole('link', {
      name: /cuộc trò chuyện với trần thị bạn về bàn học sinh gỗ thông/i,
    });
    expect(link).toHaveAttribute('aria-current', 'true');
    expect(link).toHaveClass('border-l-4');
  });

  it('renders empty state when user has no conversations', async () => {
    vi.mocked(chatApi.getUserConversations).mockResolvedValueOnce({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
      first: true,
      last: true,
      empty: true,
    });

    renderWithProviders(<ConversationList />);

    expect(
      await screen.findByText('Bạn chưa có cuộc trò chuyện nào')
    ).toBeInTheDocument();
  });

  it('renders error state with retry button on query failure', async () => {
    vi.mocked(chatApi.getUserConversations).mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();

    renderWithProviders(<ConversationList />);

    expect(
      await screen.findByText('Không thể tải danh sách cuộc trò chuyện')
    ).toBeInTheDocument();

    vi.mocked(chatApi.getUserConversations).mockResolvedValueOnce(mockConversationsPage);
    const retryBtn = screen.getByRole('button', { name: /thử lại/i });
    await user.click(retryBtn);

    expect(await screen.findByText('Bàn học sinh gỗ thông')).toBeInTheDocument();
  });
});

describe('ChatWindow & Message History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatApi.getConversationDetails).mockReset();
    vi.mocked(chatApi.getMessageHistory).mockReset();
    vi.mocked(chatApi.sendMessage).mockReset();

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

    vi.mocked(chatApi.getConversationDetails).mockResolvedValue(mockConversation1);
    vi.mocked(chatApi.getMessageHistory).mockResolvedValue(mockMessagesPageDesc);
  });

  it('renders conversation header and reverses DESC messages into chronological order (oldest first)', async () => {
    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    expect(await screen.findByRole('heading', { level: 2, name: 'Trần Thị Bạn' })).toBeInTheDocument();
    expect(screen.getByText('Bàn học sinh gỗ thông')).toBeInTheDocument();

    // Verify messages are rendered
    const msg1 = await screen.findByText('Chào bạn, món đồ này còn không ạ?');
    const msg2 = screen.getByText('Món đồ vẫn còn bạn nhé');

    expect(msg1).toBeInTheDocument();
    expect(msg2).toBeInTheDocument();

    // Verify msg1 (older) appears before msg2 (newer) in DOM order
    expect(msg1.compareDocumentPosition(msg2)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('submits a message successfully and clears the composer input', async () => {
    const user = userEvent.setup();
    const newMsg: ChatMessageResponse = {
      id: 'msg-3',
      conversationId: mockConversation1.id,
      sender: {
        id: '00000000-0000-0000-0000-000000000001',
        displayName: 'Nguyễn Văn Tôi',
      },
      content: 'Chiều nay mình ghé lấy được không?',
      createdAt: '2026-10-26T15:00:00Z',
    };
    vi.mocked(chatApi.sendMessage).mockResolvedValueOnce(newMsg);

    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    const textarea = await screen.findByPlaceholderText('Nhập tin nhắn...');
    expect(screen.getByText('Enter để gửi · Shift+Enter để xuống dòng')).toBeInTheDocument();
    await user.type(textarea, 'Chiều nay mình ghé lấy được không?');
    expect(textarea).toHaveValue('Chiều nay mình ghé lấy được không?');

    const sendBtn = screen.getByRole('button', { name: /gửi tin nhắn/i });
    await user.click(sendBtn);

    expect(chatApi.sendMessage).toHaveBeenCalledWith(mockConversation1.id, {
      content: 'Chiều nay mình ghé lấy được không?',
    });

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
    expect(textarea).not.toHaveFocus();
  });

  it('preserves draft and shows Vietnamese error feedback when sending fails', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce({ response: { status: 500 } });

    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    const textarea = await screen.findByPlaceholderText(/nhập tin nhắn/i);
    await user.type(textarea, 'Tin nhắn quan trọng');

    const sendBtn = screen.getByRole('button', { name: /gửi tin nhắn/i });
    await user.click(sendBtn);

    expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/không thể gửi tin nhắn/i)
    ).toBeInTheDocument();
    // Composer draft is retained for retry
    expect(textarea).toHaveValue('Tin nhắn quan trọng');
  });

  it('prevents sending empty or whitespace-only messages', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    const textarea = await screen.findByPlaceholderText(/nhập tin nhắn/i);
    await user.type(textarea, '   ');

    const sendBtn = screen.getByRole('button', { name: /gửi tin nhắn/i });
    expect(sendBtn).toBeDisabled();

    await user.click(sendBtn);
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
  });

  it('loads and merges older message pages without duplicate IDs or order inversion', async () => {
    const user = userEvent.setup();
    const page0: PageResponse<ChatMessageResponse> = {
      content: [mockMessage2, mockMessage1],
      totalElements: 3,
      totalPages: 2,
      size: 50,
      number: 0,
      first: true,
      last: false,
      empty: false,
    };
    vi.mocked(chatApi.getMessageHistory).mockResolvedValueOnce(page0);

    const mockOlderMessage: ChatMessageResponse = {
      id: 'msg-0',
      conversationId: mockConversation1.id,
      sender: mockOtherUser,
      content: 'Tin nhắn cũ nhất từ hôm qua',
      createdAt: '2026-10-25T10:00:00Z',
    };
    const page1: PageResponse<ChatMessageResponse> = {
      content: [mockOlderMessage],
      totalElements: 3,
      totalPages: 2,
      size: 50,
      number: 1,
      first: false,
      last: true,
      empty: false,
    };
    vi.mocked(chatApi.getMessageHistory).mockResolvedValueOnce(page1);

    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    // Load older messages button is visible
    const loadOlderBtn = await screen.findByRole('button', { name: /tải thêm tin nhắn cũ hơn/i });
    expect(loadOlderBtn).toBeInTheDocument();

    await user.click(loadOlderBtn);

    expect(chatApi.getMessageHistory).toHaveBeenCalledWith(mockConversation1.id, {
      page: 1,
      size: 50,
    });

    // Older message appears in DOM
    const olderMsg = await screen.findByText('Tin nhắn cũ nhất từ hôm qua');
    const msg1 = screen.getByText('Chào bạn, món đồ này còn không ạ?');

    // Older message precedes msg1 in DOM (chronological order)
    expect(olderMsg.compareDocumentPosition(msg1)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('handles ambiguous network failure with honest Vietnamese explanation and refetches history', async () => {
    const user = userEvent.setup();
    const networkErr = new Error('Network Error');
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(networkErr);

    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    const textarea = await screen.findByPlaceholderText(/nhập tin nhắn/i);
    await user.type(textarea, 'Có thể đã gửi hoặc chưa?');

    const sendBtn = screen.getByRole('button', { name: /gửi tin nhắn/i });
    await user.click(sendBtn);

    // Shows ambiguous explanation warning rather than claiming definite failure
    expect(
      await screen.findByText(/không thể xác nhận kết nối với máy chủ/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/tin nhắn có thể đã được gửi hoặc chưa/i)).toBeInTheDocument();

    // Draft is preserved for user safety
    expect(textarea).toHaveValue('Có thể đã gửi hoặc chưa?');

    // Refetches messages to check if message was persisted
    expect(chatApi.getMessageHistory).toHaveBeenCalled();
  });

  it('handles 400 bad request error with specific limit feedback', async () => {
    const user = userEvent.setup();
    const badRequestErr = {
      response: {
        status: 400,
        data: { message: 'Message exceeds character limit' },
      },
    };
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(badRequestErr);

    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    const textarea = await screen.findByPlaceholderText(/nhập tin nhắn/i);
    await user.type(textarea, 'Nội dung quá dài');

    const sendBtn = screen.getByRole('button', { name: /gửi tin nhắn/i });
    await user.click(sendBtn);

    expect(
      await screen.findByText(/nội dung tin nhắn không hợp lệ hoặc đã vượt quá giới hạn 2\.000 ký tự/i)
    ).toBeInTheDocument();
  });

  it('scroll behavior: auto-scrolls on initial load', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    renderWithProviders(<ChatWindow conversationId={mockConversation1.id} />);

    await screen.findByRole('heading', { level: 2, name: 'Trần Thị Bạn' });
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });
});

describe('StartChatModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatApi.getOrCreateConversation).mockReset();
  });

  it('renders modal, accepts optional initial message, and submits to create conversation', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getOrCreateConversation).mockResolvedValueOnce(mockConversation1);
    const handleClose = vi.fn();

    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <StartChatModal
              isOpen={true}
              onClose={handleClose}
              listingId="a1111111-1111-1111-1111-111111111111"
              listingTitle="Bàn học sinh gỗ thông"
              ownerName="Trần Thị Bạn"
            />
          }
        />
        <Route path="/messages/:conversationId" element={<div>Trang Chat Mới</div>} />
      </Routes>,
      { initialEntries: ['/'] }
    );

    expect(screen.getByText(/nhắn tin cho người đăng/i)).toBeInTheDocument();
    expect(screen.getByText('Bàn học sinh gỗ thông')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/xin chào, tôi quan tâm/i);
    await user.type(textarea, 'Chào bạn, tôi muốn trao đổi về món đồ.');

    const submitBtn = screen.getByRole('button', { name: /bắt đầu trò chuyện/i });
    expect(submitBtn.className).toContain('[&>span]:flex');
    expect(submitBtn.className).toContain('[&>span]:flex-row');
    await user.click(submitBtn);

    expect(chatApi.getOrCreateConversation).toHaveBeenCalledWith(
      'a1111111-1111-1111-1111-111111111111',
      {
        initialMessage: 'Chào bạn, tôi muốn trao đổi về món đồ.',
        listingRequestId: null,
      }
    );

    expect(handleClose).toHaveBeenCalled();
    expect(await screen.findByText('Trang Chat Mới')).toBeInTheDocument();
  });

  it('displays error feedback when conversation creation fails and keeps input', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getOrCreateConversation).mockRejectedValueOnce(new Error('Server error'));

    renderWithProviders(
      <StartChatModal
        isOpen={true}
        onClose={vi.fn()}
        listingId="a1111111-1111-1111-1111-111111111111"
        listingTitle="Bàn học sinh gỗ thông"
        ownerName="Trần Thị Bạn"
      />
    );

    const textarea = screen.getByPlaceholderText(/xin chào, tôi quan tâm/i);
    await user.type(textarea, 'Xin chào');

    const submitBtn = screen.getByRole('button', { name: /bắt đầu trò chuyện/i });
    await user.click(submitBtn);

    expect(
      await screen.findByText(/không thể bắt đầu cuộc trò chuyện/i)
    ).toBeInTheDocument();
    expect(textarea).toHaveValue('Xin chào');
  });
});

describe('ListingDetailPage Chat Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listingApi.getListingById).mockReset();
    vi.mocked(requestApi.getMyRequests).mockReset();
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

    vi.mocked(listingApi.getListingById).mockResolvedValue(mockListingDetail);
    vi.mocked(requestApi.getMyRequests).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 100,
      number: 0,
      first: true,
      last: true,
      empty: true,
    });
  });

  it('renders "Nhắn tin cho người đăng" button for non-owner user', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/listings/:id" element={<ListingDetailPage />} />
      </Routes>,
      { initialEntries: ['/listings/a1111111-1111-1111-1111-111111111111'] }
    );

    expect(
      await screen.findByRole('button', { name: /nhắn tin cho người đăng/i })
    ).toBeInTheDocument();
  });

  it('hides "Nhắn tin cho người đăng" button when current user is the listing owner', async () => {
    // Current user is the owner
    vi.mocked(useAuth).mockReturnValue({
      user: {
        ...mockCurrentUser,
        id: '00000000-0000-0000-0000-000000000002', // Matches mockListingDetail.owner.id
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      clearError: vi.fn(),
      refreshUser: vi.fn(),
    });

    renderWithProviders(
      <Routes>
        <Route path="/listings/:id" element={<ListingDetailPage />} />
      </Routes>,
      { initialEntries: ['/listings/a1111111-1111-1111-1111-111111111111'] }
    );

    expect(await screen.findByText('Bạn là người đăng bài này')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /nhắn tin cho người đăng/i })
    ).not.toBeInTheDocument();
  });
});

describe('MessagesPage Responsive Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chatApi.getUserConversations).mockReset();
    vi.mocked(chatApi.getConversationDetails).mockReset();
    vi.mocked(chatApi.getMessageHistory).mockReset();

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

    vi.mocked(chatApi.getUserConversations).mockResolvedValue(mockConversationsPage);
    vi.mocked(chatApi.getConversationDetails).mockResolvedValue(mockConversation1);
    vi.mocked(chatApi.getMessageHistory).mockResolvedValue(mockMessagesPageDesc);
  });

  it('renders placeholder on /messages when no conversation is selected', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/messages" element={<MessagesPage />} />
      </Routes>,
      { initialEntries: ['/messages'] }
    );

    expect(
      await screen.findByText('Hộp thư trao đổi ShareLoop')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/chọn một cuộc trò chuyện từ danh sách bên trái/i)
    ).toBeInTheDocument();
  });

  it('renders chat window when conversationId param is present', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/messages/:conversationId" element={<MessagesPage />} />
      </Routes>,
      { initialEntries: [`/messages/${mockConversation1.id}`] }
    );

    // Header has the participant's name
    expect(await screen.findByRole('heading', { level: 2, name: 'Trần Thị Bạn' })).toBeInTheDocument();
    expect(screen.getAllByText('Bàn học sinh gỗ thông').length).toBeGreaterThanOrEqual(1);
  });
});
