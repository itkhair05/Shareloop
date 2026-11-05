import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attachmentApi, isSupportedPrivateImageUrl } from '../api/attachment-api';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const FILE_ID = '11111111-1111-4111-8111-111111111111';

const uploadResponse = {
  id: FILE_ID,
  filename: 'bằng-chứng.jpg',
  contentType: 'image/jpeg',
  size: 2048,
  url: `/api/v1/files/${FILE_ID}`,
};

function makeFile(): File {
  return new File([new Uint8Array(8)], 'bằng-chứng.jpg', {
    type: 'image/jpeg',
  });
}

describe('attachmentApi — tải lên và tải ảnh riêng tư', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gửi tệp kèm purpose qua multipart tới /api/v1/files/upload', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(uploadResponse);

    const file = makeFile();
    const result = await attachmentApi.uploadAttachmentImage(file, 'REPORT');

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const [url, body] = vi.mocked(apiClient.post).mock.calls[0];

    expect(url).toBe('/api/v1/files/upload');
    expect(body).toBeInstanceOf(FormData);
    const formData = body as FormData;
    expect(formData.get('file')).toBe(file);
    expect(formData.get('purpose')).toBe('REPORT');
    expect(result).toEqual(uploadResponse);
  });

  it('từ chối phản hồi tải lên thiếu id hợp lệ', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      ...uploadResponse,
      id: 'not-a-uuid',
    });

    await expect(
      attachmentApi.uploadAttachmentImage(makeFile(), 'REVIEW')
    ).rejects.toThrow('Uploaded file response is missing a valid id');
  });

  it.each([
    '/api/v1/review-images/' + FILE_ID,
    '/api/v1/reports/attachments/' + FILE_ID,
    '/api/v1/support-requests/attachments/' + FILE_ID,
  ])('tải ảnh riêng tư qua apiClient với responseType blob: %s', async (url) => {
    const blob = new Blob(['ảnh'], { type: 'image/png' });
    vi.mocked(apiClient.get).mockResolvedValue(blob);

    const signal = new AbortController().signal;
    const result = await attachmentApi.getPrivateAttachmentImage(url, signal);

    expect(apiClient.get).toHaveBeenCalledWith(url, {
      responseType: 'blob',
      signal,
    });
    expect(result).toBe(blob);
  });

  it.each([
    '/api/v1/files/' + FILE_ID,
    'https://cdn.example.com/private.jpg',
    '/api/v1/review-images/not-a-uuid',
    '/api/v1/reports/attachments/' + FILE_ID + '/extra',
    '',
  ])('từ chối URL không nằm trong danh sách riêng tư: %s', async (url) => {
    await expect(
      attachmentApi.getPrivateAttachmentImage(url)
    ).rejects.toThrow('Unsupported private image URL');
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it('từ chối phản hồi không phải ảnh hoặc rỗng', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(
      new Blob(['not-an-image'], { type: 'text/html' })
    );

    await expect(
      attachmentApi.getPrivateAttachmentImage('/api/v1/review-images/' + FILE_ID)
    ).rejects.toThrow('Private image response is not a valid image');

    vi.mocked(apiClient.get).mockResolvedValue(new Blob([], { type: 'image/png' }));

    await expect(
      attachmentApi.getPrivateAttachmentImage('/api/v1/review-images/' + FILE_ID)
    ).rejects.toThrow('Private image response is not a valid image');
  });
});

describe('isSupportedPrivateImageUrl', () => {
  it('chỉ chấp nhận ba endpoint ảnh riêng tư của Phase C', () => {
    expect(isSupportedPrivateImageUrl('/api/v1/review-images/' + FILE_ID)).toBe(true);
    expect(isSupportedPrivateImageUrl('/api/v1/reports/attachments/' + FILE_ID)).toBe(true);
    expect(isSupportedPrivateImageUrl('/api/v1/support-requests/attachments/' + FILE_ID)).toBe(true);
    expect(isSupportedPrivateImageUrl('/api/v1/files/' + FILE_ID)).toBe(false);
    expect(isSupportedPrivateImageUrl('blob:http://localhost/fake')).toBe(false);
  });
});
