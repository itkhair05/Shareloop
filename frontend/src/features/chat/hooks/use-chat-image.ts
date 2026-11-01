import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/context';
import { ApiError } from '@/lib/api-error';
import {
  acquireChatImage,
  ChatImageCacheClearedError,
  isChatImageAbortError,
  type ChatImageLease,
} from '@/lib/chat-image-cache';
import { chatApi } from '../api/chat-api';

export type ChatImageStatus = 'idle' | 'loading' | 'ready' | 'error';

export type ChatImageErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'unavailable'
  | 'network'
  | 'invalid'
  | 'session'
  | 'unknown';

export interface ChatImageState {
  status: ChatImageStatus;
  objectUrl: string | null;
  errorKind: ChatImageErrorKind | null;
  canRetry: boolean;
  retry: () => void;
}

type ResolvedChatImageState = Omit<ChatImageState, 'retry'>;

const IDLE_STATE: ResolvedChatImageState = {
  status: 'idle',
  objectUrl: null,
  errorKind: null,
  canRetry: false,
};

const LOADING_STATE: ResolvedChatImageState = {
  status: 'loading',
  objectUrl: null,
  errorKind: null,
  canRetry: false,
};

function classifyChatImageError(error: unknown): {
  errorKind: ChatImageErrorKind;
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
  state: ResolvedChatImageState;
}

/**
 * Load a private chat image through the authenticated API client and expose
 * a cache-owned Object URL with explicit loading, error, and retry states.
 */
export function useChatImage(imageUrl?: string | null): ChatImageState {
  const { user } = useAuth();
  const sessionId = user?.id ?? 'anonymous';
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadedImageState | null>(null);

  const requestKey = imageUrl
    ? `${sessionId}::${imageUrl}::${attempt}`
    : null;

  useEffect(() => {
    if (!imageUrl || requestKey === null) {
      return;
    }

    let active = true;
    let lease: ChatImageLease | null = null;
    const controller = new AbortController();

    acquireChatImage(
      sessionId,
      imageUrl,
      () => chatApi.getChatImage(imageUrl),
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
        if (!active || isChatImageAbortError(error)) {
          return;
        }

        if (error instanceof ChatImageCacheClearedError) {
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

        const { errorKind, canRetry } = classifyChatImageError(error);
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

  let current: ResolvedChatImageState = IDLE_STATE;
  if (requestKey !== null) {
    current =
      loaded?.requestKey === requestKey ? loaded.state : LOADING_STATE;
  }

  return { ...current, retry };
}
