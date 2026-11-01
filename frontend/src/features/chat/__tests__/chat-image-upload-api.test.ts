import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { chatApi } from '@/features/chat/api/chat-api';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const validResponse = {
  id: 'f1111111-1111-1111-1111-111111111111',
  filename: 'stored-image.jpg',
  contentType: 'image/jpeg',
  size: 2048,
  url: '/api/v1/files/stored-image.jpg',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('chatApi.uploadChatImage', () => {
  it('gửi multipart với tệp và purpose=CHAT qua API client dùng chung', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(validResponse);
    const file = new File(['jpeg-bytes'], 'anh.jpg', { type: 'image/jpeg' });

    const result = await chatApi.uploadChatImage(file);

    expect(result).toEqual(validResponse);
    expect(apiClient.post).toHaveBeenCalledTimes(1);

    const [url, body, config] = vi.mocked(apiClient.post).mock.calls[0];
    expect(url).toBe('/api/v1/files/upload');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toEqual(file);
    expect((body as FormData).get('purpose')).toBe('CHAT');
    expect(config).toBeUndefined();
  });

  it('không dùng purpose mặc định GENERAL', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(validResponse);

    await chatApi.uploadChatImage(
      new File(['png-bytes'], 'anh.png', { type: 'image/png' })
    );

    const body = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(body.getAll('purpose')).toEqual(['CHAT']);
  });

  it('trả về lỗi khi phản hồi tải lên thiếu id', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...validResponse,
      id: '',
    });

    await expect(
      chatApi.uploadChatImage(new File(['a'], 'anh.jpg', { type: 'image/jpeg' }))
    ).rejects.toThrow('Uploaded file response is missing a valid id');
  });

  it('trả về lỗi khi id tải lên không phải UUID hợp lệ', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...validResponse,
      id: 'not-a-uuid',
    });

    await expect(
      chatApi.uploadChatImage(new File(['a'], 'anh.jpg', { type: 'image/jpeg' }))
    ).rejects.toThrow('Uploaded file response is missing a valid id');
  });

  it('trả về lỗi khi máy chủ không trả về dữ liệu', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(
      undefined as unknown as typeof validResponse
    );

    await expect(
      chatApi.uploadChatImage(new File(['a'], 'anh.jpg', { type: 'image/jpeg' }))
    ).rejects.toThrow('Uploaded file response is missing a valid id');
  });
});
