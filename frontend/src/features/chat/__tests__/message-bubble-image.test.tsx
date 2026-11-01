import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatApi } from '@/features/chat/api/chat-api';
import { ChatImageLightboxProvider } from '@/features/chat/components/ChatImageLightboxProvider';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { clearChatImageCache } from '@/lib/chat-image-cache';
import { ApiError } from '@/lib/api-error';
import { tokenStorage } from '@/lib/token-storage';
import { renderWithProviders } from '@/test/test-utils';
import type { ChatMessageResponse } from '@/types/chat';

vi.mock('@/features/chat/api/chat-api', () => ({
  chatApi: {
    getChatImage: vi.fn(),
  },
  chatKeys: {},
}));

const imageUrl = '/api/v1/chat-images/f1111111-1111-1111-1111-111111111111';
const imageAlt = 'Ảnh đính kèm từ Nguyễn Văn A';

const imageOnlyMessage: ChatMessageResponse = {
  id: 'msg-image-only',
  conversationId: 'c1111111-1111-1111-1111-111111111111',
  sender: {
    id: 'u1111111-1111-1111-1111-111111111111',
    displayName: 'Nguyễn Văn A',
  },
  content: null,
  createdAt: '2026-11-01T09:00:00Z',
  type: 'IMAGE',
  imageUrl,
};

const textMessage: ChatMessageResponse = {
  id: 'msg-text',
  conversationId: 'c1111111-1111-1111-1111-111111111111',
  sender: {
    id: 'u1111111-1111-1111-1111-111111111111',
    displayName: 'Nguyễn Văn A',
  },
  content: 'Món đồ này còn không bạn?',
  createdAt: '2026-11-01T09:00:00Z',
  type: 'TEXT',
};

let objectUrlCounter = 0;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function imageBlob(): Blob {
  return new Blob(['image-bytes'], { type: 'image/jpeg' });
}

function renderBubble(
  message: ChatMessageResponse,
  isOwn = false,
  extra?: Parameters<typeof MessageBubble>[0]
) {
  return renderWithProviders(
    <ChatImageLightboxProvider>
      <MessageBubble message={message} isOwn={isOwn} {...extra} />
    </ChatImageLightboxProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tokenStorage.clearAccessToken();
  clearChatImageCache();
  objectUrlCounter = 0;
  createObjectURL = vi.fn(() => `blob:bubble-image-${++objectUrlCounter}`);
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  clearChatImageCache();
  vi.restoreAllMocks();
});

describe('MessageBubble — ảnh riêng tư', () => {
  it('giữ nguyên cách hiển thị tin nhắn chỉ có văn bản và không tải ảnh', () => {
    renderBubble(textMessage);

    expect(screen.getByText('Món đồ này còn không bạn?')).toBeInTheDocument();
    expect(chatApi.getChatImage).not.toHaveBeenCalled();
    expect(screen.queryByAltText(imageAlt)).not.toBeInTheDocument();
  });

  it('hiển thị khung chờ rồi ảnh đã tải bằng Object URL', async () => {
    let resolveFetch!: (blob: Blob) => void;
    vi.mocked(chatApi.getChatImage).mockReturnValue(
      new Promise<Blob>((resolve) => {
        resolveFetch = resolve;
      })
    );

    renderBubble(imageOnlyMessage);

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải ảnh...');
    expect(screen.queryByAltText(imageAlt)).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(imageBlob());
    });

    const image = await screen.findByAltText(imageAlt);

    expect(chatApi.getChatImage).toHaveBeenCalledWith(imageUrl);
    expect(image).toHaveAttribute('src', 'blob:bubble-image-1');
    expect(image.className).toContain('max-h-[320px]');
    expect(image.className).toContain('object-contain');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('giới hạn kích thước ảnh trong khung trò chuyện', async () => {
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    renderBubble(imageOnlyMessage);

    const image = await screen.findByAltText(imageAlt);
    const bubble = image.parentElement?.parentElement;

    expect(bubble?.className).toContain('max-w-[min(320px,100%)]');
    expect(bubble?.className).toContain('overflow-hidden');
    expect(image.className).toContain('max-w-full');
  });

  it('hiển thị ảnh kèm chú thích mà không lặp nội dung', async () => {
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    renderBubble({
      ...imageOnlyMessage,
      content: 'Mặt bàn bị xước nhẹ',
    });

    await screen.findByAltText(imageAlt);
    expect(screen.getByText('Mặt bàn bị xước nhẹ')).toBeInTheDocument();
    expect(screen.getAllByText('Mặt bàn bị xước nhẹ')).toHaveLength(1);
  });

  it('coi chú thích chỉ có khoảng trắng là tin nhắn chỉ có ảnh', async () => {
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { container } = renderBubble({
      ...imageOnlyMessage,
      content: '   ',
    });

    await screen.findByAltText(imageAlt);
    expect(container.querySelector('p')).toBeNull();
  });

  it('hiển thị thông báo không có quyền và không cho thử lại với lỗi 403', async () => {
    vi.mocked(chatApi.getChatImage).mockRejectedValue(
      new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' })
    );

    renderBubble(imageOnlyMessage);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bạn không có quyền xem ảnh này.');
    expect(
      screen.queryByRole('button', { name: 'Thử lại' })
    ).not.toBeInTheDocument();
    expect(screen.queryByAltText(imageAlt)).not.toBeInTheDocument();
  });

  it('hiển thị ảnh không còn khả dụng và không cho thử lại với lỗi 404', async () => {
    vi.mocked(chatApi.getChatImage).mockRejectedValue(
      new ApiError({ message: 'Not Found', status: 404, error: 'Not Found' })
    );

    renderBubble(imageOnlyMessage);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ảnh không còn khả dụng.'
    );
    expect(
      screen.queryByRole('button', { name: 'Thử lại' })
    ).not.toBeInTheDocument();
  });

  it('hiển thị lỗi phiên đăng nhập và không cho thử lại với lỗi 401', async () => {
    vi.mocked(chatApi.getChatImage).mockRejectedValue(
      new ApiError({ message: 'Unauthorized', status: 401, error: 'Unauthorized' })
    );

    renderBubble(imageOnlyMessage);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Phiên đăng nhập đã hết hạn/
    );
    expect(
      screen.queryByRole('button', { name: 'Thử lại' })
    ).not.toBeInTheDocument();
  });

  it('cho phép thử lại lỗi mạng và dùng lại cùng danh tính ảnh', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage)
      .mockRejectedValueOnce(
        new ApiError({
          message: 'Network',
          status: 0,
          error: 'Network Error',
          isNetworkError: true,
        })
      )
      .mockResolvedValueOnce(imageBlob());

    renderBubble(imageOnlyMessage);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Không thể tải ảnh/);

    await user.click(screen.getByRole('button', { name: 'Thử lại' }));

    const image = await screen.findByAltText(imageAlt);
    expect(image).toHaveAttribute('src', 'blob:bubble-image-1');
    expect(chatApi.getChatImage).toHaveBeenCalledTimes(2);
    expect(chatApi.getChatImage).toHaveBeenNthCalledWith(1, imageUrl);
    expect(chatApi.getChatImage).toHaveBeenNthCalledWith(2, imageUrl);
  });

  it('gộp tải ảnh khi nhiều bong bóng cùng hiển thị một ảnh', async () => {
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { container } = renderWithProviders(
      <ChatImageLightboxProvider>
        <MessageBubble message={{ ...imageOnlyMessage, id: 'msg-1' }} isOwn={false} />
        <MessageBubble message={{ ...imageOnlyMessage, id: 'msg-2' }} isOwn={true} />
      </ChatImageLightboxProvider>
    );

    await screen.findAllByAltText(imageAlt);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(chatApi.getChatImage).toHaveBeenCalledTimes(1);
    expect(images[0].getAttribute('src')).toBe(images[1].getAttribute('src'));
  });

  it('không tải lại ảnh khi bong bóng được render lại trong lúc polling', async () => {
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { rerender } = renderBubble(imageOnlyMessage);
    const firstImage = await screen.findByAltText(imageAlt);

    rerender(
      <ChatImageLightboxProvider>
        <MessageBubble
          message={{ ...imageOnlyMessage, content: null }}
          isOwn={false}
        />
      </ChatImageLightboxProvider>
    );

    await waitFor(() =>
      expect(screen.getByAltText(imageAlt)).toHaveAttribute(
        'src',
        firstImage.getAttribute('src') ?? ''
      )
    );
    expect(chatApi.getChatImage).toHaveBeenCalledTimes(1);
  });

  it('giữ căn lề trái phải cho bong bóng ảnh', async () => {
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { container, unmount } = renderBubble(imageOnlyMessage, true);
    await screen.findByAltText(imageAlt);

    const ownWrapper = container.querySelector('[data-message-id="msg-image-only"]');
    expect(ownWrapper?.className).toContain('justify-end');

    unmount();

    const { container: incomingContainer } = renderBubble(
      { ...imageOnlyMessage, id: 'msg-image-incoming' },
      false
    );
    await screen.findByAltText(imageAlt);

    const incomingWrapper = incomingContainer.querySelector(
      '[data-message-id="msg-image-incoming"]'
    );
    expect(incomingWrapper?.className).toContain('justify-start');
  });
});
