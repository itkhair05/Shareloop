import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatApi } from '@/features/chat/api/chat-api';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { useAuth } from '@/features/auth';
import { renderWithProviders } from '@/test/test-utils';
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

const sentMessage: ChatMessageResponse = {
  id: 'msg-sent',
  conversationId,
  sender: {
    id: currentUserId,
    displayName: 'Nguyễn Văn Tôi',
  },
  content: 'Chào bạn, món đồ này còn không?',
  createdAt: '2026-11-01T09:00:00Z',
};

const uploadedImage = {
  id: 'f1111111-1111-1111-1111-111111111111',
  filename: 'stored-image.jpg',
  contentType: 'image/jpeg',
  size: 10,
  url: '/api/v1/files/stored-image.jpg',
};

let createObjectUrlMock: ReturnType<typeof vi.fn>;
let revokeObjectUrlMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();

  window.HTMLElement.prototype.scrollIntoView = vi.fn();

  createObjectUrlMock = vi.fn(() => 'blob:chat-image-1');
  revokeObjectUrlMock = vi.fn();
  window.URL.createObjectURL = createObjectUrlMock as unknown as typeof URL.createObjectURL;
  window.URL.revokeObjectURL = revokeObjectUrlMock as unknown as typeof URL.revokeObjectURL;

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
  vi.mocked(chatApi.sendMessage).mockResolvedValue(sentMessage);
  vi.mocked(chatApi.uploadChatImage).mockResolvedValue(uploadedImage);
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
const pngFile = () => new File(['png-bytes'], 'anh-moi.png', { type: 'image/png' });

describe('Chọn ảnh đính kèm', () => {
  it('chấp nhận ảnh JPEG và hiển thị bản xem trước cục bộ', async () => {
    const textarea = await openComposer();
    const file = jpegFile();

    chooseImage(file);

    const preview = await screen.findByAltText('Xem trước ảnh đính kèm');
    expect(preview).toHaveAttribute('src', 'blob:chat-image-1');
    expect(createObjectUrlMock).toHaveBeenCalledWith(file);
    expect(screen.getByText('anh-dep.jpg')).toBeInTheDocument();
    expect(textarea).toHaveAttribute(
      'placeholder',
      'Thêm chú thích cho ảnh (không bắt buộc)...'
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
  });

  it('chấp nhận ảnh PNG', async () => {
    await openComposer();
    const file = pngFile();

    chooseImage(file);

    expect(await screen.findByAltText('Xem trước ảnh đính kèm')).toHaveAttribute(
      'src',
      'blob:chat-image-1'
    );
    expect(screen.getByText('anh-moi.png')).toBeInTheDocument();
  });

  it('từ chối định dạng không phải JPEG/PNG và không tạo bản xem trước', async () => {
    await openComposer();

    chooseImage(new File(['pdf'], 'tai-lieu.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chỉ hỗ trợ ảnh JPEG và PNG.'
    );
    expect(createObjectUrlMock).not.toHaveBeenCalled();
    expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument();
  });

  it('từ chối tệp giả mạo phần mở rộng .jpg khi MIME không hợp lệ', async () => {
    await openComposer();

    chooseImage(new File(['unknown'], 'gia-mao.jpg', { type: '' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chỉ hỗ trợ ảnh JPEG và PNG.'
    );
    expect(createObjectUrlMock).not.toHaveBeenCalled();
  });

  it('từ chối ảnh lớn hơn 5 MB', async () => {
    await openComposer();
    const largeFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'qua-lon.jpg', {
      type: 'image/jpeg',
    });

    chooseImage(largeFile);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ảnh không được vượt quá 5 MB.'
    );
    expect(createObjectUrlMock).not.toHaveBeenCalled();
    expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument();
  });

  it('từ chối tệp rỗng', async () => {
    await openComposer();

    chooseImage(new File([], 'rong.png', { type: 'image/png' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tệp ảnh không hợp lệ.');
    expect(createObjectUrlMock).not.toHaveBeenCalled();
  });

  it('cho phép chọn lại cùng một tệp sau khi đã xóa ảnh', async () => {
    await openComposer();
    createObjectUrlMock.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const file = jpegFile();

    const input = chooseImage(file);
    expect(await screen.findByAltText('Xem trước ảnh đính kèm')).toHaveAttribute(
      'src',
      'blob:first'
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Xóa ảnh đính kèm' }));
    expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument();
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByAltText('Xem trước ảnh đính kèm')).toHaveAttribute(
      'src',
      'blob:second'
    );
    expect(createObjectUrlMock).toHaveBeenCalledTimes(2);
  });
});

describe('Vòng đời bản xem trước', () => {
  it('xóa ảnh sẽ gỡ bản xem trước và giải phóng object URL', async () => {
    await openComposer();
    const user = userEvent.setup();
    const input = chooseImage(jpegFile());

    const removeButton = await screen.findByRole('button', { name: 'Xóa ảnh đính kèm' });
    await user.click(removeButton);

    expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:chat-image-1');
    expect(input.value).toBe('');
  });

  it('thay ảnh mới sẽ giải phóng object URL của ảnh trước', async () => {
    await openComposer();
    createObjectUrlMock.mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');

    chooseImage(jpegFile());
    expect(await screen.findByAltText('Xem trước ảnh đính kèm')).toHaveAttribute(
      'src',
      'blob:first'
    );

    chooseImage(pngFile());

    expect(await screen.findByAltText('Xem trước ảnh đính kèm')).toHaveAttribute(
      'src',
      'blob:second'
    );
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:first');
    expect(screen.getByText('anh-moi.png')).toBeInTheDocument();
    expect(screen.queryByText('anh-dep.jpg')).not.toBeInTheDocument();
  });

  it('giải phóng object URL khi component bị gỡ khỏi giao diện', async () => {
    const { unmount } = renderWithProviders(<ChatWindow conversationId={conversationId} />);
    await screen.findByPlaceholderText('Nhập tin nhắn...');

    chooseImage(jpegFile());
    await screen.findByAltText('Xem trước ảnh đính kèm');

    unmount();

    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:chat-image-1');
  });
});

describe('Tương thích với ô soạn tin nhắn', () => {
  it('vẫn gửi được tin nhắn chỉ có văn bản', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();

    await user.type(textarea, 'Chào bạn, món đồ này còn không?');
    await user.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));

    expect(chatApi.sendMessage).toHaveBeenCalledWith(conversationId, {
      content: 'Chào bạn, món đồ này còn không?',
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('chấp nhận bố cục chỉ có ảnh và gửi được tin nhắn ảnh', async () => {
    await openComposer();
    const user = userEvent.setup();
    const file = jpegFile();

    chooseImage(file);

    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' });
    expect(sendButton).toBeEnabled();

    await user.click(sendButton);

    expect(chatApi.uploadChatImage).toHaveBeenCalledWith(file);
    expect(chatApi.sendMessage).toHaveBeenCalledWith(conversationId, {
      imageId: uploadedImage.id,
    });
    await waitFor(() =>
      expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument()
    );
    expect(screen.getByText('Đã gửi ảnh thành công.')).toBeInTheDocument();
  });

  it('chấp nhận bố cục ảnh kèm chú thích', async () => {
    const textarea = await openComposer();
    const user = userEvent.setup();

    chooseImage(pngFile());
    await screen.findByAltText('Xem trước ảnh đính kèm');
    await user.type(textarea, 'Ảnh chụp lúc chiều nhé');

    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' });
    expect(sendButton).toBeEnabled();

    await user.click(sendButton);

    expect(chatApi.sendMessage).toHaveBeenCalledWith(conversationId, {
      content: 'Ảnh chụp lúc chiều nhé',
      imageId: uploadedImage.id,
    });
    await waitFor(() => expect(textarea).toHaveValue(''));
    expect(screen.queryByAltText('Xem trước ảnh đính kèm')).not.toBeInTheDocument();
  });

  it('không cho gửi khi không có cả văn bản lẫn ảnh', async () => {
    await openComposer();
    const user = userEvent.setup();
    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' });

    expect(sendButton).toBeDisabled();

    chooseImage(jpegFile());
    expect(sendButton).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Xóa ảnh đính kèm' }));

    expect(sendButton).toBeDisabled();
    expect(chatApi.sendMessage).not.toHaveBeenCalled();
  });

  it('giữ nguyên hành vi Enter để gửi và Shift+Enter không gửi', async () => {
    await openComposer();
    const textarea = await screen.findByPlaceholderText('Nhập tin nhắn...');
    const user = userEvent.setup();

    await user.type(textarea, 'Gửi bằng phím Enter');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(chatApi.sendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    await waitFor(() =>
      expect(chatApi.sendMessage).toHaveBeenCalledWith(conversationId, {
        content: 'Gửi bằng phím Enter',
      })
    );
  });

  it('giữ nguyên giới hạn 2.000 ký tự và bộ đếm ký tự', async () => {
    const textarea = await openComposer();

    expect((textarea as HTMLTextAreaElement).maxLength).toBe(2000);
    expect(screen.getByText('0 / 2.000')).toBeInTheDocument();
    expect(screen.getByText('Enter để gửi · Shift+Enter để xuống dòng')).toBeInTheDocument();
  });

  it('dùng input tệp ẩn chỉ cho một ảnh JPEG/PNG và nút đính kèm mở hộp chọn tệp', async () => {
    await openComposer();
    const user = userEvent.setup();
    const input = screen.getByLabelText('Chọn ảnh đính kèm');

    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png');
    expect(input).not.toHaveAttribute('multiple');
    expect(input).toHaveClass('hidden');

    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await user.click(screen.getByRole('button', { name: 'Đính kèm ảnh' }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
