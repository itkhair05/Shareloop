import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chatApi } from '@/features/chat/api/chat-api';
import { ChatImageLightboxProvider } from '@/features/chat/components/ChatImageLightboxProvider';
import { MessageBubble } from '@/features/chat/components/MessageBubble';
import { useChatImageLightbox } from '@/features/chat/hooks/use-chat-image-lightbox';
import {
  clearChatImageCache,
  getChatImageCacheCount,
} from '@/lib/chat-image-cache';
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
const uncachedImageUrl =
  '/api/v1/chat-images/a2222222-2222-2222-2222-222222222222';
const imageAlt = 'Ảnh đính kèm từ Nguyễn Văn A';
const triggerName = 'Xem ảnh đính kèm từ Nguyễn Văn A';
const senderName = 'Nguyễn Văn A';

const imageOnlyMessage: ChatMessageResponse = {
  id: 'msg-image-only',
  conversationId: 'c1111111-1111-1111-1111-111111111111',
  sender: {
    id: 'u1111111-1111-1111-1111-111111111111',
    displayName: senderName,
  },
  content: null,
  createdAt: '2026-11-01T09:00:00Z',
  type: 'IMAGE',
  imageUrl,
};

const textMessage: ChatMessageResponse = {
  ...imageOnlyMessage,
  id: 'msg-text',
  type: 'TEXT',
  imageUrl: null,
  content: 'Món đồ này còn không bạn?',
};

const multilineCaption = 'Mặt bàn bị xước nhẹ\nVết xước ở góc phải';

let objectUrlCounter = 0;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function imageBlob(): Blob {
  return new Blob(['image-bytes'], { type: 'image/jpeg' });
}

function renderBubble(message: ChatMessageResponse = imageOnlyMessage) {
  return renderWithProviders(
    <ChatImageLightboxProvider>
      <MessageBubble message={message} isOwn={false} />
    </ChatImageLightboxProvider>
  );
}

function DirectLightboxTrigger({
  url,
  caption = null,
}: {
  url: string;
  caption?: string | null;
}) {
  const { openLightbox } = useChatImageLightbox();

  return (
    <button
      type="button"
      onClick={(event) => {
        openLightbox({
          imageUrl: url,
          caption,
          senderName,
          trigger: event.currentTarget,
        });
      }}
    >
      Mở ảnh trực tiếp
    </button>
  );
}

function renderDirectTrigger(url: string, caption: string | null = null) {
  return renderWithProviders(
    <ChatImageLightboxProvider>
      <DirectLightboxTrigger url={url} caption={caption} />
    </ChatImageLightboxProvider>
  );
}

async function openBubbleLightbox(
  user: ReturnType<typeof userEvent.setup>,
  message: ChatMessageResponse = imageOnlyMessage
) {
  renderBubble(message);
  const trigger = await screen.findByRole('button', { name: triggerName });
  await user.click(trigger);
  const dialog = await screen.findByRole('dialog');
  return { trigger, dialog };
}

beforeEach(() => {
  vi.clearAllMocks();
  tokenStorage.clearAccessToken();
  clearChatImageCache();
  objectUrlCounter = 0;
  createObjectURL = vi.fn(() => `blob:lightbox-image-${++objectUrlCounter}`);
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  clearChatImageCache();
  document.body.style.overflow = '';
  vi.restoreAllMocks();
});

describe('ChatImageLightbox — mở và đóng', () => {
  it('mở lightbox khi bấm ảnh và dùng lại Object URL đã tải, không gọi lại API', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { dialog } = await openBubbleLightbox(user);

    const dialogImage = await within(dialog).findByAltText(imageAlt);
    expect(dialogImage).toHaveAttribute('src', 'blob:lightbox-image-1');
    expect(chatApi.getChatImage).toHaveBeenCalledTimes(1);
    expect(chatApi.getChatImage).toHaveBeenCalledWith(imageUrl);
  });

  it('mở lightbox bằng bàn phím từ nút kích hoạt có nhãn truy cập được', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    renderBubble();
    const trigger = await screen.findByRole('button', { name: triggerName });
    expect(trigger).toHaveAttribute('type', 'button');

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('đóng bằng nút và trả tiêu điểm về nút kích hoạt', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { trigger, dialog } = await openBubbleLightbox(user);
    const closeButton = within(dialog).getByRole('button', { name: 'Đóng ảnh' });

    await waitFor(() => expect(closeButton).toHaveFocus());
    await user.click(closeButton);

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('đóng bằng phím Escape và trả tiêu điểm về nút kích hoạt', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { trigger } = await openBubbleLightbox(user);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Đóng ảnh' })
      ).toHaveFocus()
    );

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('đóng khi bấm vùng nền nhưng không đóng khi bấm vào ảnh', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { dialog } = await openBubbleLightbox(user);
    const dialogImage = await within(dialog).findByAltText(imageAlt);

    await user.click(dialogImage);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    const overlay = screen.getByTestId('chat-image-lightbox-overlay');

    fireEvent.mouseDown(dialogImage);
    fireEvent.click(overlay);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });
});

describe('ChatImageLightbox — vòng đời ảnh và cache', () => {
  it('giữ tham chiếu riêng để không thu hồi Object URL khi bong bóng bị unmount', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { rerender } = renderBubble();
    const trigger = await screen.findByRole('button', { name: triggerName });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog');
    const dialogImage = await within(dialog).findByAltText(imageAlt);
    expect(dialogImage).toHaveAttribute('src', 'blob:lightbox-image-1');

    rerender(
      <ChatImageLightboxProvider>
        <p>Bong bóng đã bị gỡ</p>
      </ChatImageLightboxProvider>
    );

    await waitFor(() =>
      expect(screen.getByText('Bong bóng đã bị gỡ')).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: triggerName })).not.toBeInTheDocument();

    const stillOpenDialog = screen.getByRole('dialog');
    expect(within(stillOpenDialog).getByAltText(imageAlt)).toHaveAttribute(
      'src',
      'blob:lightbox-image-1'
    );
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(getChatImageCacheCount()).toBe(1);
  });

  it('không thu hồi Object URL ngay khi lightbox đóng mà chờ vòng đời TTL của cache', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { unmount } = renderBubble();
    const trigger = await screen.findByRole('button', { name: triggerName });
    await user.click(trigger);
    await screen.findByRole('dialog');

    await user.click(screen.getByRole('button', { name: 'Đóng ảnh' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );

    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(getChatImageCacheCount()).toBe(1);

    unmount();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(getChatImageCacheCount()).toBe(1);
  });
});

describe('ChatImageLightbox — trạng thái tải và lỗi', () => {
  it('hiển thị trạng thái đang tải rồi ảnh khi lightbox tự tải ảnh', async () => {
    const user = userEvent.setup();
    let resolveFetch!: (blob: Blob) => void;
    vi.mocked(chatApi.getChatImage).mockReturnValue(
      new Promise<Blob>((resolve) => {
        resolveFetch = resolve;
      })
    );

    renderDirectTrigger(uncachedImageUrl);
    await user.click(
      screen.getByRole('button', { name: 'Mở ảnh trực tiếp' })
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'Đang tải ảnh...'
    );

    await act(async () => {
      resolveFetch(imageBlob());
    });

    expect(await within(dialog).findByAltText(imageAlt)).toHaveAttribute(
      'src',
      'blob:lightbox-image-1'
    );
    expect(chatApi.getChatImage).toHaveBeenCalledTimes(1);
    expect(chatApi.getChatImage).toHaveBeenCalledWith(uncachedImageUrl);
  });

  it('hiển thị lỗi không có quyền và không cho thử lại với lỗi 403', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockRejectedValue(
      new ApiError({ message: 'Forbidden', status: 403, error: 'Forbidden' })
    );

    renderDirectTrigger(uncachedImageUrl);
    await user.click(
      screen.getByRole('button', { name: 'Mở ảnh trực tiếp' })
    );

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Bạn không có quyền xem ảnh này.'
    );
    expect(
      within(dialog).queryByRole('button', { name: 'Thử lại' })
    ).not.toBeInTheDocument();
  });

  it('cho phép thử lại lỗi mạng với cùng danh tính ảnh', async () => {
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

    renderDirectTrigger(uncachedImageUrl);
    await user.click(
      screen.getByRole('button', { name: 'Mở ảnh trực tiếp' })
    );

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /Không thể tải ảnh/
    );

    await user.click(within(dialog).getByRole('button', { name: 'Thử lại' }));

    expect(await within(dialog).findByAltText(imageAlt)).toHaveAttribute(
      'src',
      'blob:lightbox-image-1'
    );
    expect(chatApi.getChatImage).toHaveBeenCalledTimes(2);
    expect(chatApi.getChatImage).toHaveBeenNthCalledWith(1, uncachedImageUrl);
    expect(chatApi.getChatImage).toHaveBeenNthCalledWith(2, uncachedImageUrl);
  });
});

describe('ChatImageLightbox — nội dung và bố cục', () => {
  it('giữ nguyên chú thích nhiều dòng dưới ảnh trong lightbox', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { dialog } = await openBubbleLightbox(user, {
      ...imageOnlyMessage,
      content: multilineCaption,
    });

    await within(dialog).findByAltText(imageAlt);
    const caption = dialog.querySelector('figcaption');

    expect(caption).not.toBeNull();
    expect(caption?.textContent).toBe(multilineCaption);
    expect(caption?.className).toContain('whitespace-pre-wrap');
    expect(caption?.className).toContain('break-words');
    expect(document.querySelectorAll('figcaption')).toHaveLength(1);

    const bubbleCaption = document.querySelector(
      '[data-message-id="msg-image-only"] p'
    );
    expect(bubbleCaption?.textContent).toBe(multilineCaption);
  });

  it('không hiển thị khung chú thích rỗng cho tin nhắn chỉ có ảnh', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { dialog } = await openBubbleLightbox(user);
    await within(dialog).findByAltText(imageAlt);

    expect(dialog.querySelector('figcaption')).toBeNull();
  });

  it('giữ tỉ lệ ảnh, chặn tràn khung và dùng nền tối có vùng an toàn', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { dialog } = await openBubbleLightbox(user);
    const dialogImage = await within(dialog).findByAltText(imageAlt);
    const overlay = screen.getByTestId('chat-image-lightbox-overlay');

    expect(dialogImage.className).toContain('object-contain');
    expect(dialogImage.className).toContain('h-auto');
    expect(dialogImage.className).toContain('w-auto');
    expect(dialogImage.className).toContain('max-h-full');
    expect(dialogImage.className).toContain('max-w-full');
    expect(dialog.className).toContain('max-h-full');
    expect(overlay.className).toContain('bg-slate-950/90');
    expect(overlay.className).toContain('safe-area-inset-top');
    expect(overlay.className).toContain('safe-area-inset-bottom');
  });
});

describe('ChatImageLightbox — khả năng truy cập và hồi quy', () => {
  it('dùng ngữ nghĩa dialog, nhãn tiếng Việt và giữ tiêu điểm trong hộp thoại', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    const { dialog } = await openBubbleLightbox(user);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(`Xem ảnh đính kèm từ ${senderName}`);

    const closeButton = within(dialog).getByRole('button', { name: 'Đóng ảnh' });
    await waitFor(() => expect(closeButton).toHaveFocus());

    await user.tab();
    expect(closeButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(closeButton).toHaveFocus();
  });

  it('giữ tiêu điểm trong hộp thoại khi có nút thử lại', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockRejectedValue(
      new ApiError({
        message: 'Network',
        status: 0,
        error: 'Network Error',
        isNetworkError: true,
      })
    );

    renderDirectTrigger(uncachedImageUrl);
    await user.click(
      screen.getByRole('button', { name: 'Mở ảnh trực tiếp' })
    );

    const dialog = await screen.findByRole('dialog');
    const retryButton = await within(dialog).findByRole('button', {
      name: 'Thử lại',
    });
    const closeButton = within(dialog).getByRole('button', { name: 'Đóng ảnh' });

    await user.tab();
    expect(retryButton).toHaveFocus();

    await user.tab();
    expect(closeButton).toHaveFocus();
  });

  it('khóa cuộn trang khi mở và khôi phục khi đóng', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    document.body.style.overflow = '';

    const { dialog } = await openBubbleLightbox(user);
    expect(document.body.style.overflow).toBe('hidden');

    await user.click(within(dialog).getByRole('button', { name: 'Đóng ảnh' }));

    await waitFor(() => expect(document.body.style.overflow).toBe(''));
  });

  it('giữ nguyên tin nhắn văn bản và không mở lightbox', async () => {
    renderBubble(textMessage);

    expect(screen.getByText('Món đồ này còn không bạn?')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: triggerName })
    ).not.toBeInTheDocument();
    expect(chatApi.getChatImage).not.toHaveBeenCalled();
  });

  it('không biến chính ảnh thành điều khiển bàn phím riêng', async () => {
    const user = userEvent.setup();
    vi.mocked(chatApi.getChatImage).mockResolvedValue(imageBlob());

    renderBubble();
    const trigger = await screen.findByRole('button', { name: triggerName });
    const image = within(trigger).getByAltText(imageAlt);

    expect(image).not.toHaveAttribute('tabindex');
    expect(trigger).toContainElement(image);

    await user.click(trigger);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
