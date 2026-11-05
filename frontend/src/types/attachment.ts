/**
 * Shared attachment types for the domain image-attachment surfaces
 * (review, moderation report, support request).
 *
 * Mirrors com.shareloop.dto.attachment.AttachmentResponse.
 */
export interface AttachmentImage {
  id: string;
  url: string;
}

/** Purpose values accepted by POST /api/v1/files/upload for domain attachments. */
export type AttachmentUploadPurpose = 'REVIEW' | 'REPORT' | 'SUPPORT';

/** Maximum number of images allowed per domain record (backend-enforced). */
export const ATTACHMENT_IMAGE_LIMITS: Record<AttachmentUploadPurpose, number> = {
  REVIEW: 3,
  REPORT: 5,
  SUPPORT: 5,
};

/** Client-side guard matching the backend multipart size limit (5 MiB). */
export const MAX_ATTACHMENT_IMAGE_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_ATTACHMENT_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;

export function getAttachmentImageLimit(purpose: AttachmentUploadPurpose): number {
  return ATTACHMENT_IMAGE_LIMITS[purpose];
}
