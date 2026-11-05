import { apiClient } from '@/lib/api-client';
import { isValidUuid } from '@/lib/utils';
import type { FileUploadResponse } from '@/types/file';
import type { AttachmentUploadPurpose } from '@/types/attachment';

/**
 * Private image URLs exposed by the Phase C backend. Only these endpoints are
 * fetched through the authenticated client; public file URLs are rejected so
 * access checks cannot be bypassed.
 */
const PRIVATE_IMAGE_URL_PATTERNS: RegExp[] = [
  /^\/api\/v1\/review-images\/[0-9a-fA-F-]{36}$/,
  /^\/api\/v1\/reports\/attachments\/[0-9a-fA-F-]{36}$/,
  /^\/api\/v1\/support-requests\/attachments\/[0-9a-fA-F-]{36}$/,
];

export function isSupportedPrivateImageUrl(imageUrl: string): boolean {
  return PRIVATE_IMAGE_URL_PATTERNS.some((pattern) => pattern.test(imageUrl));
}

export const attachmentApi = {
  /**
   * Upload a domain attachment image.
   * POST /api/v1/files/upload (multipart, purpose=REVIEW|REPORT|SUPPORT)
   *
   * Uploading does not attach the file to any record; the returned id must be
   * included in the create payload as `imageIds`.
   */
  async uploadAttachmentImage(
    file: File,
    purpose: AttachmentUploadPurpose,
    signal?: AbortSignal
  ): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);

    const response = await apiClient.post<FileUploadResponse, FormData>(
      '/api/v1/files/upload',
      formData,
      { signal }
    );

    if (!response || !isValidUuid(response.id)) {
      throw new Error('Uploaded file response is missing a valid id');
    }

    return response;
  },

  /**
   * Download a private attachment image through the authenticated API client.
   * GET /api/v1/review-images/{id}
   * GET /api/v1/reports/attachments/{id}
   * GET /api/v1/support-requests/attachments/{id}
   */
  async getPrivateAttachmentImage(imageUrl: string, signal?: AbortSignal): Promise<Blob> {
    if (typeof imageUrl !== 'string' || !isSupportedPrivateImageUrl(imageUrl)) {
      throw new Error('Unsupported private image URL');
    }

    const blob = await apiClient.get<Blob>(imageUrl, {
      responseType: 'blob',
      signal,
    });

    if (!(blob instanceof Blob) || blob.size === 0 || !blob.type.startsWith('image/')) {
      throw new Error('Private image response is not a valid image');
    }

    return blob;
  },
};

export default attachmentApi;
