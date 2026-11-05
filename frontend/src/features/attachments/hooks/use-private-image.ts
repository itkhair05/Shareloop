import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context';
import { ApiError } from '@/lib/api-error';
import {
  acquirePrivateImage,
  isPrivateImageAbortError,
  PrivateImageCacheClearedError,
  type PrivateImageLease,
} from '@/lib/private-image-cache';
import { attachmentApi } from '../api/attachment-api';

export type PrivateImageStatus = 'idle' | 'loading' | 'ready' | 'error';

export type PrivateImageErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'unavailable'
  | 'network'
  | 'invalid'
  | 'session'
  | 'unknown';

export interface PrivateImageState {
  status: PrivateImageStatus;
  objectUrl: string | null;
  errorKind: PrivateImageErrorKind | null;
  canRetry: boolean;
  retry: () => void;
}

export function getPrivateImageErrorMessage(errorKind: PrivateImageErrorKind): string {
  switch (errorKind) {
    case 'forbidden':
      return 'Bạn không có quyền xem ảnh này.';
    case 'unavailable':
      return 'Ảnh không còn khả dụng.';
    case 'unauthorized':
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    case 'network':
      return 'Không thể tải ảnh. Kiểm tra kết nối và thử lại.';
    case 'invalid':
      return 'Ảnh không hợp lệ hoặc không thể hiển thị.';
    case 'session':
      return 'Phiên làm việc đã thay đổi. Vui lòng thử lại.';
    default:
      return 'Không thể tải ảnh. Vui lòng thử lại.';
  }
}

type ResolvedPrivateImageState = Omit<PrivateImageState, 'retry'>;

const IDLE_STATE: ResolvedPrivateImageState = {
  status: 'idle',
  objectUrl: null,
  errorKind: null,
  canRetry: false,
};

const LOADING_STATE: ResolvedPrivateImageState = {
  status: 'loading',
  objectUrl: null,
  errorKind: null,
  canRetry: false,
};

function classifyPrivateImageError(error: unknown): {
  errorKind: PrivateImageErrorKind;
  canRetry: boolean;
} {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { errorKind: 'unauthorized', canRetry: false };
    }
    if (error.status === 403) {
      return { errorKind: 'forbidden', canRetry: false };
    }
    if (error.status === 404) {
      return { errorKind: 'unavailable', canRetry: false };
    }
    if (
      error.isNetworkError ||
      error.isTimeout ||
      error.status === 0 ||
      error.status === 408 ||
      error.status >= 500
    ) {
      return { errorKind: 'network', canRetry: true };
    }
    return { errorKind: 'unknown', canRetry: true };
  }

  if (error instanceof Error) {
    return { errorKind: 'invalid', canRetry: true };
  }

  return { errorKind: 'unknown', canRetry: true };
}

interface LoadedImageState {
  requestKey: string;
  state: ResolvedPrivateImageState;
}

/**
 * Load a private attachment image through the authenticated API client and
 * expose a cache-owned Object URL with explicit loading, error, and retry
 * states. The cache is session-scoped and never persisted.
 */
export function usePrivateImage(imageUrl?: string | null): PrivateImageState {
  const { user } = useAuth();
  const sessionId = user?.id ?? 'anonymous';
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedImageState | null>(null);

  const requestKey = imageUrl ? `${sessionId}::${imageUrl}::${attempt}` : null;

  useEffect(() => {
    if (!imageUrl || requestKey === null) {
      return;
    }

    let active = true;
    let lease: PrivateImageLease | null = null;
    const controller = new AbortController();

    acquirePrivateImage(
      sessionId,
      imageUrl,
      () => attachmentApi.getPrivateAttachmentImage(imageUrl, controller.signal),
      { signal: controller.signal }
    )
      .then((nextLease) => {
        if (!active) {
          nextLease.release();
          return;
        }

        lease = nextLease;
        setLoaded({
          requestKey,
          state: {
            status: 'ready',
            objectUrl: nextLease.objectUrl,
            errorKind: null,
            canRetry: false,
          },
        });
      })
      .catch((error: unknown) => {
        if (!active || isPrivateImageAbortError(error)) {
          return;
        }

        if (error instanceof PrivateImageCacheClearedError) {
          setLoaded({
            requestKey,
            state: {
              status: 'error',
              objectUrl: null,
              errorKind: 'session',
              canRetry: true,
            },
          });
          return;
        }

        const { errorKind, canRetry } = classifyPrivateImageError(error);
        setLoaded({
          requestKey,
          state: {
            status: 'error',
            objectUrl: null,
            errorKind,
            canRetry,
          },
        });
      });

    return () => {
      active = false;
      controller.abort();
      lease?.release();
      lease = null;
    };
  }, [imageUrl, sessionId, requestKey]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  let current: ResolvedPrivateImageState = IDLE_STATE;
  if (requestKey !== null) {
    current = loaded?.requestKey === requestKey ? loaded.state : LOADING_STATE;
  }

  return { ...current, retry };
}
