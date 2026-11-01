import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { chatApi } from '@/features/chat/api/chat-api';
import { ApiError } from '@/lib/api-error';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const privateImageUrl = '/api/v1/chat-images/f1111111-1111-1111-1111-111111111111';

function imageBlob(type = 'image/jpeg'): Blob {
  return new Blob(['image-bytes'], { type });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('chatApi.getChatImage', () => {
  it('tải ảnh riêng tư qua API client dùng chung với responseType=blob', async () => {
    const blob = imageBlob('image/png');
    vi.mocked(apiClient.get).mockResolvedValue(blob);

    const result = await chatApi.getChatImage(privateImageUrl);

    expect(result).toBe(blob);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith(privateImageUrl, {
      responseType: 'blob',
      signal: undefined,
    });
  });

  it('chuyển tiếp AbortSignal cho API client', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(imageBlob());
    const controller = new AbortController();

    await chatApi.getChatImage(privateImageUrl, controller.signal);

    expect(apiClient.get).toHaveBeenCalledWith(privateImageUrl, {
      responseType: 'blob',
      signal: controller.signal,
    });
  });

  it('từ chối endpoint tệp công khai thay vì bỏ qua kiểm tra quyền', async () => {
    await expect(
      chatApi.getChatImage('/api/v1/files/stored-image.jpg')
    ).rejects.toThrow('Unsupported chat image URL');

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('từ chối URL bên ngoài', async () => {
    await expect(
      chatApi.getChatImage('https://example.com/anh.jpg')
    ).rejects.toThrow('Unsupported chat image URL');

    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('từ chối phản hồi không phải Blob', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      id: 'f1111111-1111-1111-1111-111111111111',
    } as unknown as Blob);

    await expect(chatApi.getChatImage(privateImageUrl)).rejects.toThrow(
      'Chat image response is not a valid image'
    );
  });

  it('từ chối Blob rỗng', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(new Blob([], { type: 'image/jpeg' }));

    await expect(chatApi.getChatImage(privateImageUrl)).rejects.toThrow(
      'Chat image response is not a valid image'
    );
  });

  it('từ chối Blob không phải ảnh', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      new Blob(['<html></html>'], { type: 'text/html' })
    );

    await expect(chatApi.getChatImage(privateImageUrl)).rejects.toThrow(
      'Chat image response is not a valid image'
    );
  });

  it('giữ nguyên lỗi phân quyền của backend', async () => {
    const forbidden = new ApiError({
      message: 'Forbidden',
      status: 403,
      error: 'Forbidden',
    });
    vi.mocked(apiClient.get).mockRejectedValue(forbidden);

    await expect(chatApi.getChatImage(privateImageUrl)).rejects.toBe(forbidden);
  });
});
