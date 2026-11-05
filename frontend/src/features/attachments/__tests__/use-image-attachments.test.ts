import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useImageAttachments } from '../hooks/use-image-attachments';
import { attachmentApi } from '../api/attachment-api';
import { ApiError } from '@/lib/api-error';
import type { FileUploadResponse } from '@/types/file';

vi.mock('../api/attachment-api', () => ({
  attachmentApi: {
    uploadAttachmentImage: vi.fn(),
    getPrivateAttachmentImage: vi.fn(),
  },
}));

const FILE_ID_A = '11111111-1111-4111-8111-111111111111';
const FILE_ID_B = '22222222-2222-4222-8222-222222222222';

let objectUrlCounter = 0;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function imageFile(
  name = 'evidence.jpg',
  size = 1024,
  type = 'image/jpeg',
  lastModified = 1
): File {
  return new File([new Uint8Array(size)], name, { type, lastModified });
}

function uploadResponse(id: string, filename = 'evidence.jpg'): FileUploadResponse {
  return {
    id,
    filename,
    contentType: 'image/jpeg',
    size: 1024,
    url: `/api/v1/files/${id}`,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  objectUrlCounter = 0;
  createObjectURL = vi.fn(() => `blob:attachment-${++objectUrlCounter}`);
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useImageAttachments — tải ảnh đính kèm', () => {
  it('tải ảnh với đúng purpose và trả về imageIds khi hoàn tất', async () => {
    vi.mocked(attachmentApi.uploadAttachmentImage)
      .mockResolvedValueOnce(uploadResponse(FILE_ID_A, 'a.jpg'))
      .mockResolvedValueOnce(uploadResponse(FILE_ID_B, 'b.jpg'));

    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'REVIEW' })
    );

    const files = [imageFile('a.jpg'), imageFile('b.jpg', 2048, 'image/png')];

    act(() => {
      result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.items.every((item) => item.status === 'ready')).toBe(true);
    });

    expect(attachmentApi.uploadAttachmentImage).toHaveBeenCalledTimes(2);
    expect(attachmentApi.uploadAttachmentImage).toHaveBeenNthCalledWith(
      1,
      files[0],
      'REVIEW',
      expect.any(AbortSignal)
    );
    expect(attachmentApi.uploadAttachmentImage).toHaveBeenNthCalledWith(
      2,
      files[1],
      'REVIEW',
      expect.any(AbortSignal)
    );
    expect(result.current.getImageIds()).toEqual([FILE_ID_A, FILE_ID_B]);
    expect(result.current.canSubmit).toBe(true);
  });

  it('giữ trạng thái có thể gửi khi không có ảnh nào', () => {
    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'REPORT' })
    );

    expect(result.current.items).toHaveLength(0);
    expect(result.current.getImageIds()).toEqual([]);
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.canAddMore).toBe(true);
  });

  it('giới hạn số ảnh theo purpose và báo lỗi tiếng Việt', async () => {
    vi.mocked(attachmentApi.uploadAttachmentImage).mockResolvedValue(
      uploadResponse(FILE_ID_A)
    );

    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'REVIEW' })
    );

    const files = [
      imageFile('1.jpg'),
      imageFile('2.jpg'),
      imageFile('3.jpg'),
      imageFile('4.jpg'),
    ];

    act(() => {
      result.current.addFiles(files);
    });

    await waitFor(() => {
      expect(result.current.items.every((item) => item.status === 'ready')).toBe(true);
    });

    expect(result.current.items).toHaveLength(3);
    expect(result.current.maxImages).toBe(3);
    expect(result.current.error).toContain('tối đa 3 ảnh');
    expect(attachmentApi.uploadAttachmentImage).toHaveBeenCalledTimes(3);
  });

  it('từ chối định dạng không phải JPEG/PNG', () => {
    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'REPORT' })
    );

    act(() => {
      result.current.addFiles([imageFile('notes.txt', 10, 'text/plain')]);
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.error).toBe('Chỉ hỗ trợ ảnh JPEG hoặc PNG.');
    expect(attachmentApi.uploadAttachmentImage).not.toHaveBeenCalled();
  });

  it('từ chối ảnh vượt quá 5 MB', () => {
    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'SUPPORT' })
    );

    act(() => {
      result.current.addFiles([
        imageFile('huge.jpg', 5 * 1024 * 1024 + 1),
      ]);
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.error).toBe('Ảnh không được vượt quá 5 MB.');
    expect(attachmentApi.uploadAttachmentImage).not.toHaveBeenCalled();
  });

  it('bỏ qua ảnh trùng tệp đã chọn', async () => {
    vi.mocked(attachmentApi.uploadAttachmentImage).mockResolvedValue(
      uploadResponse(FILE_ID_A)
    );

    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'SUPPORT' })
    );

    const file = imageFile('same.jpg');

    act(() => {
      result.current.addFiles([file]);
    });
    act(() => {
      result.current.addFiles([file]);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('ready');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.error).toBe('Ảnh này đã được chọn.');
    expect(attachmentApi.uploadAttachmentImage).toHaveBeenCalledTimes(1);
  });

  it('chặn gửi trong khi ảnh đang tải lên', async () => {
    let resolveUpload!: (value: FileUploadResponse) => void;
    vi.mocked(attachmentApi.uploadAttachmentImage).mockReturnValueOnce(
      new Promise<FileUploadResponse>((resolve) => {
        resolveUpload = resolve;
      })
    );

    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'REPORT' })
    );

    act(() => {
      result.current.addFiles([imageFile('pending.jpg')]);
    });

    expect(result.current.isUploading).toBe(true);
    expect(result.current.canSubmit).toBe(false);

    await act(async () => {
      resolveUpload(uploadResponse(FILE_ID_A));
    });

    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
    });
    expect(result.current.canSubmit).toBe(true);
  });

  it('xóa ảnh khỏi danh sách và thu hồi URL xem trước', async () => {
    vi.mocked(attachmentApi.uploadAttachmentImage).mockResolvedValue(
      uploadResponse(FILE_ID_A)
    );

    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'REVIEW' })
    );

    act(() => {
      result.current.addFiles([imageFile('remove.jpg')]);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('ready');
    });

    const previewUrl = result.current.items[0].previewUrl;
    const localId = result.current.items[0].localId;

    act(() => {
      result.current.remove(localId);
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.getImageIds()).toEqual([]);
    expect(revokeObjectURL).toHaveBeenCalledWith(previewUrl);
  });

  it('hiển thị lỗi tải lên và cho phép thử lại thành công', async () => {
    vi.mocked(attachmentApi.uploadAttachmentImage)
      .mockRejectedValueOnce(
        new ApiError({
          message: 'Server error',
          status: 500,
          error: 'Internal Server Error',
        })
      )
      .mockResolvedValueOnce(uploadResponse(FILE_ID_A));

    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'REVIEW' })
    );

    act(() => {
      result.current.addFiles([imageFile('retry.jpg')]);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('error');
    });
    expect(result.current.items[0].errorMessage).toBe(
      'Không thể tải ảnh lên. Kiểm tra kết nối và thử lại.'
    );
    expect(result.current.canSubmit).toBe(false);

    act(() => {
      result.current.retry(result.current.items[0].localId);
    });

    await waitFor(() => {
      expect(result.current.items[0]?.status).toBe('ready');
    });
    expect(result.current.getImageIds()).toEqual([FILE_ID_A]);
    expect(result.current.canSubmit).toBe(true);
  });

  it('xóa toàn bộ ảnh và thu hồi mọi URL xem trước', async () => {
    vi.mocked(attachmentApi.uploadAttachmentImage).mockResolvedValue(
      uploadResponse(FILE_ID_A)
    );

    const { result } = renderHook(() =>
      useImageAttachments({ purpose: 'SUPPORT' })
    );

    act(() => {
      result.current.addFiles([imageFile('1.jpg'), imageFile('2.jpg')]);
    });

    await waitFor(() => {
      expect(result.current.items.every((item) => item.status === 'ready')).toBe(true);
    });

    const previews = result.current.items.map((item) => item.previewUrl);

    act(() => {
      result.current.clear();
    });

    expect(result.current.items).toHaveLength(0);
    expect(result.current.error).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    for (const preview of previews) {
      expect(revokeObjectURL).toHaveBeenCalledWith(preview);
    }
  });
});
