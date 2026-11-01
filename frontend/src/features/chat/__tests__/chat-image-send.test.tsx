import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatApi, chatKeys } from '@/features/chat/api/chat-api';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { useAuth } from '@/features/auth';
import { renderWithProviders, createTestQueryClient } from '@/test/test-utils';
import { ApiError } from '@/lib/api-error';
import type { ChatMessageResponse, ConversationResponse } from '@/types/chat';
import type { PageResponse } from '@/types/api';
import type { UserProfile } from '@/types/auth';

vi.mock('@/features/chat/api/chat-api', () => ({
  chatApi: {
    getUserConversations: vi.fn(),
    getConversationDetails: vi.fn(),
    getMessageHistory: vi.fn(),
    sendMessage: vi.fn(),
    getOrCreateConversation: vi.fn(),
    uploadChatImage: vi.fn(),
    getChatImage: vi.fn(),
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

vi.mock('@/features/auth', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/features/auth');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

const conversationId = 'c1111111-1111-1111-1111-111111111111';
const currentUserId = '00000000-0000-0000-0000-000000000001';

const mockCurrentUser: UserProfile = {
  id: currentUserId,
  displayName: 'Nguyễn Văn Tôi',
  email: 'toi@shareloop.org',
  role: 'USER',
  status: 'ACTIVE',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
};

const mockConversation: ConversationResponse = {
  id: conversationId,
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
  otherParticipant: {
    id: '00000000-0000-0000-0000-000000000002',
    displayName: 'Trần Thị Bạn',
    avatarUrl: null,
  },
  lastMessagePreview: null,
  lastMessageAt: null,
  listingRequestId: null,
  createdAt: '2026-10-26T10:00:00Z',
  updatedAt: '2026-10-26T10:00:00Z',
};

const emptyMessagesPage: PageResponse<ChatMessageResponse> = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  size: 50,
  number: 0,
  first: true,
  last: true,
  empty: true,
};

const uploadedImage = {
  id: 'f1111111-1111-1111-1111-111111111111',
  filename: 'stored-image.jpg',
  contentType: 'image/jpeg',
  size: 10,
  url: '/api/v1/files/stored-image.jpg',
};

const sentImageMessage: ChatMessageResponse = {
  id: 'msg-image',
  conversationId,
  sender: {
    id: currentUserId,
    displayName: 'Nguyễn Văn Tôi',
  },
  content: null,
  createdAt: '2026-11-01T09:00:00Z',
  type: 'IMAGE',
  imageUrl: `/api/v1/chat-images/${uploadedImage.id}`,
};

function pageWith(message: ChatMessageResponse): PageResponse<ChatMessageResponse> {
  return {
    content: [message],
    totalElements: 1,
    totalPages: 1,
    size: 50,
    number: 0,
    first: true,
    last: true,
    empty: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.URL.createObjectURL = vi.fn(() => 'blob:chat-image-1') as unknown as typeof URL.createObjectURL;
  window.URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;

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

  vi.mocked(chatApi.getConversationDetails).mockResolvedValue(mockConversation);
  vi.mocked(chatApi.getMessageHistory).mockResolvedValue(emptyMessagesPage);
  vi.mocked(chatApi.sendMessage).mockResolvedValue(sentImageMessage);
  vi.mocked(chatApi.uploadChatImage).mockResolvedValue(uploadedImage);
  vi.mocked(chatApi.getChatImage).mockResolvedValue(
    new Blob(['chat-image-bytes'], { type: 'image/jpeg' })
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openComposer() {
  renderWithProviders(<ChatWindow conversationId={conversationId} />);
  return screen.findByPlaceholderText('Nhập tin nhắn...');
}

function chooseImage(file: File) {
  const input = screen.getByLabelText('Chọn ảnh đính kèm') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
  return input;
}

const jpegFile = () => new File(['jpeg-bytes'], 'anh-dep.jpg', { type: 'image/jpeg' });

describe('Tải ảnh lên khi gửi', () => {
  it('tải ảnh với purpose=CHAT rồi mới gửi tin nhắn bằng imageId', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();
    const file = jpegFile();

    chooseImage(file);
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(chatApi.uploadChatImage).toHaveBeenCalledWith(file);
    expect(chatApi.sendMessage).toHaveBeenCalledWith(conversationId, {
      imageId: uploadedImage.id,
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
    expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument();
    expect(screen.getByText('Đã gửi ảnh thành công.')).toBeInTheDocument();
  });

  it('giữ nguyên chú thích đã trim khi gửi ảnh kèm chú thích', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();

    chooseImage(jpegFile());
    await screen.findByAltText('Xem trước ảnh đính kèm');
    await user.type(textarea, '  Mặt bàn bị xước nhẹ  ');
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(chatApi.sendMessage).toHaveBeenCalledWith(conversationId, {
      content: 'Mặt bàn bị xước nhẹ',
      imageId: uploadedImage.id,
    });
  });

  it('không tải ảnh ngay khi người dùng mới chọn tệp', async () => {
    await openComposer();

    chooseImage(jpegFile());
    await screen.findByAltText('Xem trước ảnh đính kèm');

    expect(chatApi.uploadChatImage).not.toHaveBeenCalled();
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
  });

  it('hiển thị trạng thái đang tải ảnh và khóa nút gửi trong khi chờ', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();
    let resolveUpload!: (value: typeof uploadedImage) => void;
    vi.mocked(chatApi.uploadChatImage).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );

    chooseImage(jpegFile());
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(screen.getByText('Đang tải ảnh lên...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi tin nhắn' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xóa ảnh đính kèm' })).toBeDisabled();
    expect(textarea).toBeDisabled();

    resolveUpload(uploadedImage);

    await waitFor(() => expect(chatApi.sendMessage).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument()
    );
  });

  it('vô hiệu hóa các query chat sau khi gửi ảnh thành công', async () => {
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    renderWithProviders(<ChatWindow conversationId={conversationId} />, { queryClient });
    await screen.findByPlaceholderText('Nhập tin nhắn...');
    const user = userEvent.setup();

    chooseImage(jpegFile());
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    await waitFor(() =>
      expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument()
    );

    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual([
      ...chatKeys.messages(),
      conversationId,
    ]);
    expect(invalidatedKeys).toContainEqual(chatKeys.conversationDetail(conversationId));
    expect(invalidatedKeys).toContainEqual(chatKeys.conversations());
  });
});

describe('Lỗi tải ảnh', () => {
  it('không gọi API gửi tin nhắn, giữ ảnh và chú thích, cho phép thử lại', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();
    vi.mocked(chatApi.uploadChatImage).mockRejectedValueOnce({
      response: { status: 500 },
    });

    chooseImage(jpegFile());
    await user.type(textarea, 'Ảnh bị lỗi mạng');
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Không thể tải ảnh lên/
    );
    expect(chatApi.uploadChatImage).toHaveBeenCalledTimes(1);
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByAltText('Xem trước ảnh đính kèm')).toBeInTheDocument();
    expect(textarea).toHaveValue('Ảnh bị lỗi mạng');

    vi.mocked(chatApi.uploadChatImage).mockResolvedValueOnce(uploadedImage);
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    await waitFor(() => expect(chatApi.uploadChatImage).toHaveBeenCalledTimes(2));
    expect(chatApi.sendMessage).toHaveBeenCalledWith(conversationId, {
      content: 'Ảnh bị lỗi mạng',
      imageId: uploadedImage.id,
    });
    await waitFor(() =>
      expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument()
    );
  });

  it('báo lỗi kết nối rõ ràng khi tải ảnh thất bại do mạng', async () => {
    await openComposer();
    const user = userEvent.setup();
    vi.mocked(chatApi.uploadChatImage).mockRejectedValueOnce(
      new ApiError({
        message: 'Network',
        status: 0,
        error: 'Network Error',
        isNetworkError: true,
      })
    );

    chooseImage(jpegFile());
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /ảnh chưa được tải lên/i
    );
    expect(screen.getByAltText('Xem trước ảnh đính kèm')).toBeInTheDocument();
  });

  it('chặn gửi khi phản hồi tải lên không có imageId hợp lệ', async () => {
    await openComposer();
    const user = userEvent.setup();
    vi.mocked(chatApi.uploadChatImage).mockResolvedValueOnce({
      ...uploadedImage,
      id: 'not-a-uuid',
    });

    chooseImage(jpegFile());
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Không thể tải ảnh lên/
    );
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByAltText('Xem trước ảnh đính kèm')).toBeInTheDocument();
  });
});

describe('Lỗi gửi tin nhắn sau khi tải ảnh', () => {
  it('giữ ảnh, chú thích và imageId để lần thử lại không tải ảnh lần nữa', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce({
      response: { status: 500 },
    });

    chooseImage(jpegFile());
    await user.type(textarea, 'Gửi kèm chú thích');
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Không thể gửi tin nhắn do lỗi hệ thống/
    );
    expect(chatApi.uploadChatImage).toHaveBeenCalledTimes(1);
    expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
    expect(screen.getByAltText('Xem trước ảnh đính kèm')).toBeInTheDocument();
    expect(textarea).toHaveValue('Gửi kèm chú thích');

    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    await waitFor(() => expect(chatApi.sendMessage).toHaveBeenCalledTimes(2));
    expect(chatApi.uploadChatImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(chatApi.sendMessage).mock.calls[1][1]).toEqual({
      content: 'Gửi kèm chú thích',
      imageId: uploadedImage.id,
    });
    await waitFor(() =>
      expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument()
    );
    expect(textarea).toHaveValue('');
  });

  it('không gửi trùng khi mạng gián đoạn nhưng lịch sử đã có ảnh', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();
    let sentInHistory = false;
    vi.mocked(chatApi.getMessageHistory).mockImplementation(async () =>
      sentInHistory ? pageWith(sentImageMessage) : emptyMessagesPage
    );
    vi.mocked(chatApi.sendMessage).mockImplementationOnce(async () => {
      sentInHistory = true;
      throw new ApiError({
        message: 'Network',
        status: 0,
        error: 'Network Error',
        isNetworkError: true,
      });
    });

    chooseImage(jpegFile());
    await user.type(textarea, 'Ảnh đã gửi được chưa?');
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(await screen.findByText('Đã gửi ảnh thành công.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument();
    expect(textarea).toHaveValue('');
    expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('giữ ảnh và imageId khi kết quả mơ hồ và lịch sử chưa có tin nhắn', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();
    vi.mocked(chatApi.sendMessage).mockRejectedValueOnce(
      new ApiError({
        message: 'Timeout',
        status: 408,
        error: 'Request Timeout',
        isTimeout: true,
      })
    );

    chooseImage(jpegFile());
    await user.type(textarea, 'Chú thích cần giữ lại');
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Tin nhắn ảnh có thể đã được gửi hoặc chưa/
    );
    expect(screen.getByAltText('Xem trước ảnh đính kèm')).toBeInTheDocument();
    expect(textarea).toHaveValue('Chú thích cần giữ lại');

    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    await waitFor(() => expect(chatApi.sendMessage).toHaveBeenCalledTimes(2));
    expect(chatApi.uploadChatImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(chatApi.sendMessage).mock.calls[1][1]).toEqual({
      content: 'Chú thích cần giữ lại',
      imageId: uploadedImage.id,
    });
  });
});

describe('Chống gửi trùng', () => {
  it('bỏ qua các lần submit/Enter lặp lại trong khi đang tải ảnh', async () => {
    const textarea = await openComposer();
    let resolveUpload!: (value: typeof uploadedImage) => void;
    vi.mocked(chatApi.uploadChatImage).mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );

    chooseImage(jpegFile());
    const form = textarea.closest('form') as HTMLFormElement;

    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(chatApi.uploadChatImage).toHaveBeenCalledTimes(1);

    resolveUpload(uploadedImage);

    await waitFor(() => expect(chatApi.sendMessage).toHaveBeenCalledTimes(1));
    expect(chatApi.uploadChatImage).toHaveBeenCalledTimes(1);
  });
});
