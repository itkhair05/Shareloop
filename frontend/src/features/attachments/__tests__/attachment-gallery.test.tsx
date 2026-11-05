import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentGallery } from '../components/AttachmentGallery';
import { attachmentApi } from '../api/attachment-api';
import { ApiError } from '@/lib/api-error';
import { clearPrivateImageCache } from '@/lib/private-image-cache';
import { renderWithProviders } from '@/test/test-utils';
import type { AttachmentImage } from '@/types/attachment';

vi.mock('../api/attachment-api', () => ({
  attachmentApi: {
    uploadAttachmentImage: vi.fn(),
    getPrivateAttachmentImage: vi.fn(),
  },
}));

const IMAGE_A: AttachmentImage = {
  id: '11111111-1111-4111-8111-111111111111',
  url: '/api/v1/review-images/11111111-1111-4111-8111-111111111111',
};

const IMAGE_B: AttachmentImage = {
  id: '22222222-2222-4222-8222-222222222222',
  url: '/api/v1/reports/attachments/22222222-2222-4222-8222-222222222222',
};

let objectUrlCounter = 0;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function imageBlob(): Blob {
  return new Blob(['private-image'], { type: 'image/jpeg' });
}

beforeEach(() => {
  vi.clearAllMocks();
  clearPrivateImageCache();
  objectUrlCounter = 0;
  createObjectURL = vi.fn(() => `blob:private-${++objectUrlCounter}`);
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
});

afterEach(() => {
  clearPrivateImageCache();
  vi.restoreAllMocks();
});

describe('AttachmentGallery — hiển thị ảnh riêng tư', () => {
  it('không hiển thị gì khi không có ảnh', () => {
    const { container } = renderWithProviders(<AttachmentGallery images={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tải ảnh qua API có xác thực và chỉ hiển thị blob URL', async () => {
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockResolvedValue(
      imageBlob()
    );

    const { container } = renderWithProviders(<AttachmentGallery images={[IMAGE_A]} />);

    const image = await screen.findByAltText('Hình ảnh đính kèm 1');

    expect(attachmentApi.getPrivateAttachmentImage).toHaveBeenCalledWith(
      IMAGE_A.url,
      expect.any(AbortSignal)
    );
    expect(image.getAttribute('src')).toMatch(/^blob:/);
    expect(image.getAttribute('src')).not.toBe(IMAGE_A.url);
    expect(container.innerHTML).not.toContain(IMAGE_A.url);
  });

  it('hiển thị lỗi quyền truy cập bằng tiếng Việt', async () => {
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockRejectedValue(
      new ApiError({
        message: 'Forbidden',
        status: 403,
        error: 'Forbidden',
      })
    );

    renderWithProviders(<AttachmentGallery images={[IMAGE_A]} />);

    expect(
      await screen.findByText('Bạn không có quyền xem ảnh này.')
    ).toBeInTheDocument();
  });

  it('hiển thị lỗi ảnh không còn khả dụng', async () => {
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockRejectedValue(
      new ApiError({
        message: 'Not found',
        status: 404,
        error: 'Not Found',
      })
    );

    renderWithProviders(<AttachmentGallery images={[IMAGE_A]} />);

    expect(
      await screen.findByText('Ảnh không còn khả dụng.')
    ).toBeInTheDocument();
  });

  it('mở lightbox, điều hướng ảnh và đóng bằng Escape', async () => {
    const user = userEvent.setup();
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockResolvedValue(
      imageBlob()
    );

    renderWithProviders(
      <AttachmentGallery images={[IMAGE_A, IMAGE_B]} label="Hình ảnh bằng chứng" />
    );

    const firstThumb = await screen.findByRole('button', {
      name: 'Xem ảnh đính kèm 1',
    });

    await user.click(firstThumb);

    const dialog = screen.getByRole('dialog', {
      name: /xem ảnh đính kèm/i,
    });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Ảnh 1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ảnh sau' }));
    expect(screen.getByText('Ảnh 2 / 2')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /xem ảnh đính kèm/i })
      ).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(firstThumb).toHaveFocus();
    });
  });

  it('thu hồi Object URL khi bộ nhớ đệm bị xóa', async () => {
    vi.mocked(attachmentApi.getPrivateAttachmentImage).mockResolvedValue(
      imageBlob()
    );

    renderWithProviders(<AttachmentGallery images={[IMAGE_A]} />);

    await screen.findByAltText('Hình ảnh đính kèm 1');

    expect(revokeObjectURL).not.toHaveBeenCalled();
    clearPrivateImageCache();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-1');
  });
});
