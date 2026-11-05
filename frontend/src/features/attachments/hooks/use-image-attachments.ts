import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '@/lib/api-error';
import {
  ACCEPTED_ATTACHMENT_IMAGE_TYPES,
  MAX_ATTACHMENT_IMAGE_BYTES,
  getAttachmentImageLimit,
  type AttachmentUploadPurpose,
} from '@/types/attachment';
import { attachmentApi } from '../api/attachment-api';

export type AttachmentImageUploadStatus = 'uploading' | 'ready' | 'error';

export interface AttachmentImageItem {
  localId: string;
  file: File;
  previewUrl: string;
  status: AttachmentImageUploadStatus;
  imageId: string | null;
  errorMessage: string | null;
}

export interface UseImageAttachmentsOptions {
  purpose: AttachmentUploadPurpose;
  maxImages?: number;
}

export interface UseImageAttachmentsResult {
  items: AttachmentImageItem[];
  /** Validation error for the latest picker interaction. */
  error: string | null;
  maxImages: number;
  isUploading: boolean;
  hasFailedUploads: boolean;
  /** False while an upload is in progress or a failed image still needs action. */
  canSubmit: boolean;
  canAddMore: boolean;
  addFiles: (files: FileList | File[] | null | undefined) => void;
  remove: (localId: string) => void;
  retry: (localId: string) => void;
  clear: () => void;
  getImageIds: () => string[];
}

function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fileSignature(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}::${file.type}`;
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function getAttachmentUploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (error.status === 403) {
      return 'Bạn không có quyền tải ảnh lên.';
    }
    if (error.status === 413) {
      return `Ảnh không được vượt quá ${formatMegabytes(MAX_ATTACHMENT_IMAGE_BYTES)}.`;
    }
    if (error.status === 415) {
      return 'Định dạng ảnh không được hỗ trợ.';
    }
  }

  return 'Không thể tải ảnh lên. Kiểm tra kết nối và thử lại.';
}

export function useImageAttachments({
  purpose,
  maxImages,
}: UseImageAttachmentsOptions): UseImageAttachmentsResult {
  const limit = maxImages ?? getAttachmentImageLimit(purpose);
  const [items, setItems] = useState<AttachmentImageItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = useRef<AttachmentImageItem[]>([]);
  const controllersRef = useRef(new Map<string, AbortController>());
  const mountedRef = useRef(true);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    mountedRef.current = true;
    const controllers = controllersRef.current;
    return () => {
      mountedRef.current = false;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
      itemsRef.current = [];
    };
  }, []);

  const updateItem = useCallback(
    (localId: string, patch: Partial<AttachmentImageItem>) => {
      if (!mountedRef.current) return;
      setItems((current) =>
        current.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const startUpload = useCallback(
    (localId: string, file: File) => {
      const controller = new AbortController();
      controllersRef.current.set(localId, controller);

      attachmentApi
        .uploadAttachmentImage(file, purpose, controller.signal)
        .then((response) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          updateItem(localId, {
            status: 'ready',
            imageId: response.id,
            errorMessage: null,
          });
        })
        .catch((uploadError: unknown) => {
          if (!mountedRef.current || controller.signal.aborted) return;
          updateItem(localId, {
            status: 'error',
            imageId: null,
            errorMessage: getAttachmentUploadErrorMessage(uploadError),
          });
        })
        .finally(() => {
          if (controllersRef.current.get(localId) === controller) {
            controllersRef.current.delete(localId);
          }
        });
    },
    [purpose, updateItem]
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!files) return;
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      setError(null);

      const messages = new Set<string>();
      const accepted: AttachmentImageItem[] = [];
      const signatures = new Set(itemsRef.current.map((item) => fileSignature(item.file)));
      const availableSlots = limit - itemsRef.current.length;
      let slotsUsed = 0;

      for (const file of incoming) {
        if (slotsUsed >= availableSlots) {
          messages.add(`Chỉ được đính kèm tối đa ${limit} ảnh.`);
          break;
        }

        if (!(ACCEPTED_ATTACHMENT_IMAGE_TYPES as readonly string[]).includes(file.type)) {
          messages.add('Chỉ hỗ trợ ảnh JPEG hoặc PNG.');
          continue;
        }

        if (file.size === 0) {
          messages.add('Tệp ảnh không hợp lệ.');
          continue;
        }

        if (file.size > MAX_ATTACHMENT_IMAGE_BYTES) {
          messages.add(
            `Ảnh không được vượt quá ${formatMegabytes(MAX_ATTACHMENT_IMAGE_BYTES)}.`
          );
          continue;
        }

        const signature = fileSignature(file);
        if (signatures.has(signature)) {
          messages.add('Ảnh này đã được chọn.');
          continue;
        }

        signatures.add(signature);
        slotsUsed += 1;
        accepted.push({
          localId: createLocalId(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          imageId: null,
          errorMessage: null,
        });
      }

      if (messages.size > 0) {
        setError(Array.from(messages).join(' '));
      }

      if (accepted.length === 0) {
        return;
      }

      setItems((current) => [...current, ...accepted]);
      for (const item of accepted) {
        startUpload(item.localId, item.file);
      }
    },
    [limit, startUpload]
  );

  const remove = useCallback((localId: string) => {
    const controller = controllersRef.current.get(localId);
    if (controller) {
      controller.abort();
      controllersRef.current.delete(localId);
    }

    setItems((current) => {
      const target = current.find((item) => item.localId === localId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((item) => item.localId !== localId);
    });
  }, []);

  const retry = useCallback(
    (localId: string) => {
      const target = itemsRef.current.find((item) => item.localId === localId);
      if (!target || target.status !== 'error') return;

      updateItem(localId, {
        status: 'uploading',
        imageId: null,
        errorMessage: null,
      });
      startUpload(localId, target.file);
    },
    [startUpload, updateItem]
  );

  const clear = useCallback(() => {
    for (const controller of controllersRef.current.values()) {
      controller.abort();
    }
    controllersRef.current.clear();

    for (const item of itemsRef.current) {
      URL.revokeObjectURL(item.previewUrl);
    }

    setItems([]);
    setError(null);
  }, []);

  const getImageIds = useCallback(
    () =>
      itemsRef.current
        .filter((item) => item.status === 'ready' && item.imageId !== null)
        .map((item) => item.imageId as string),
    []
  );

  const isUploading = items.some((item) => item.status === 'uploading');
  const hasFailedUploads = items.some((item) => item.status === 'error');
  const canSubmit = !isUploading && !hasFailedUploads;
  const canAddMore = items.length < limit;

  return useMemo(
    () => ({
      items,
      error,
      maxImages: limit,
      isUploading,
      hasFailedUploads,
      canSubmit,
      canAddMore,
      addFiles,
      remove,
      retry,
      clear,
      getImageIds,
    }),
    [
      items,
      error,
      limit,
      isUploading,
      hasFailedUploads,
      canSubmit,
      canAddMore,
      addFiles,
      remove,
      retry,
      clear,
      getImageIds,
    ]
  );
}
