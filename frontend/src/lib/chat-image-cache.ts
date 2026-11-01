/**
 * In-memory cache for private chat image responses.
 *
 * Blobs are downloaded with the authenticated API client and exposed to the UI
 * only through Object URLs owned by this module. The cache is session-scoped
 * (the authenticated user id is part of every key), bounded by both entry count
 * and total bytes, and evicts idle entries after a short TTL.
 *
 * Nothing is persisted to localStorage, sessionStorage, or IndexedDB.
 */

export const CHAT_IMAGE_CACHE_TTL_MS = 60_000;
export const MAX_CACHED_CHAT_IMAGES = 12;
export const MAX_CACHED_CHAT_IMAGE_BYTES = 40 * 1024 * 1024; // 40 MiB

export interface ChatImageLease {
  objectUrl: string;
  size: number;
  /** Idempotent: decrements the reference count and releases the Object URL when idle. */
  release: () => void;
}

export interface AcquireChatImageOptions {
  signal?: AbortSignal;
}

export type ChatImageFetcher = () => Promise<Blob>;

export class ChatImageAbortError extends Error {
  constructor() {
    super('Chat image request was aborted');
    this.name = 'ChatImageAbortError';
  }
}

export class ChatImageCacheClearedError extends Error {
  constructor() {
    super('Chat image cache was cleared');
    this.name = 'ChatImageCacheClearedError';
  }
}

export function isChatImageAbortError(error: unknown): boolean {
  return (
    error instanceof ChatImageAbortError ||
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError')
  );
}

interface CacheEntry {
  objectUrl: string;
  size: number;
  refCount: number;
  lastUsedAt: number;
  evictionTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

/**
 * Incremented whenever the cache is cleared. A fetch that started under a
 * previous generation must not insert its result into the new session.
 */
let generation = 0;

function makeKey(sessionId: string, imageUrl: string): string {
  return `${sessionId}::${imageUrl}`;
}

function clearTimer(entry: CacheEntry): void {
  if (entry.evictionTimer !== null) {
    clearTimeout(entry.evictionTimer);
    entry.evictionTimer = null;
  }
}

function totalCachedBytes(): number {
  let total = 0;
  for (const entry of entries.values()) {
    total += entry.size;
  }
  return total;
}

function removeEntry(key: string, entry: CacheEntry): void {
  if (entries.get(key) === entry) {
    entries.delete(key);
  }
  clearTimer(entry);
  URL.revokeObjectURL(entry.objectUrl);
}

function findIdleVictim(protectedKey?: string): string | null {
  let victimKey: string | null = null;
  let victimUsedAt = Number.POSITIVE_INFINITY;

  for (const [key, entry] of entries.entries()) {
    if (entry.refCount > 0) continue;
    if (protectedKey !== undefined && key === protectedKey) continue;
    if (entry.lastUsedAt < victimUsedAt) {
      victimKey = key;
      victimUsedAt = entry.lastUsedAt;
    }
  }

  return victimKey;
}

function enforceBounds(protectedKey?: string): void {
  while (
    entries.size > MAX_CACHED_CHAT_IMAGES ||
    totalCachedBytes() > MAX_CACHED_CHAT_IMAGE_BYTES
  ) {
    const victimKey = findIdleVictim(protectedKey);
    if (victimKey === null) {
      // Every remaining entry is still mounted; allow a temporary overrun
      // instead of revoking an Object URL that is in use.
      return;
    }
    const victim = entries.get(victimKey);
    if (victim) {
      removeEntry(victimKey, victim);
    }
  }
}

function scheduleIdleEviction(key: string, entry: CacheEntry): void {
  clearTimer(entry);
  entry.evictionTimer = setTimeout(() => {
    entry.evictionTimer = null;
    if (entries.get(key) === entry && entry.refCount === 0) {
      removeEntry(key, entry);
    }
  }, CHAT_IMAGE_CACHE_TTL_MS);
}

function takeLease(key: string, entry: CacheEntry): ChatImageLease {
  entry.refCount += 1;
  entry.lastUsedAt = Date.now();
  clearTimer(entry);

  let released = false;

  return {
    objectUrl: entry.objectUrl,
    size: entry.size,
    release() {
      if (released) return;
      released = true;

      if (entries.get(key) !== entry) {
        return;
      }

      entry.refCount = Math.max(0, entry.refCount - 1);
      entry.lastUsedAt = Date.now();

      if (entry.refCount === 0) {
        scheduleIdleEviction(key, entry);
        enforceBounds();
      }
    },
  };
}

/**
 * Acquire a lease for a private chat image.
 *
 * Concurrent hires for the same session and image share one network request.
 * The returned lease must be released by the consumer (normally on unmount).
 */
export function acquireChatImage(
  sessionId: string,
  imageUrl: string,
  fetcher: ChatImageFetcher,
  options: AcquireChatImageOptions = {}
): Promise<ChatImageLease> {
  const key = makeKey(sessionId, imageUrl);
  const { signal } = options;

  if (signal?.aborted) {
    return Promise.reject(new ChatImageAbortError());
  }

  const cached = entries.get(key);
  if (cached) {
    return Promise.resolve(takeLease(key, cached));
  }

  let pending = inflight.get(key);

  if (!pending) {
    const requestGeneration = generation;
    const requestPromise = fetcher().then((blob) => {
      if (requestGeneration !== generation) {
        throw new ChatImageCacheClearedError();
      }

      const entry: CacheEntry = {
        objectUrl: URL.createObjectURL(blob),
        size: blob.size,
        refCount: 0,
        lastUsedAt: Date.now(),
        evictionTimer: null,
      };

      entries.set(key, entry);
      scheduleIdleEviction(key, entry);
      enforceBounds(key);
      return entry;
    });

    const tracked: Promise<CacheEntry> = requestPromise.finally(() => {
      if (inflight.get(key) === tracked) {
        inflight.delete(key);
      }
    });

    inflight.set(key, tracked);
    pending = tracked;
  }

  return pending.then((entry) => {
    if (signal?.aborted) {
      throw new ChatImageAbortError();
    }

    // The entry may have been cleared (logout/session change) between the
    // download finishing and this consumer resuming.
    if (entries.get(key) !== entry) {
      throw new ChatImageCacheClearedError();
    }

    return takeLease(key, entry);
  });
}

/**
 * Revoke every cached Object URL and invalidate in-flight downloads.
 * Call on logout or whenever the authenticated user changes.
 */
export function clearChatImageCache(): void {
  generation += 1;

  for (const [key, entry] of entries.entries()) {
    clearTimer(entry);
    URL.revokeObjectURL(entry.objectUrl);
    entries.delete(key);
  }

  entries.clear();
  inflight.clear();
}

export function getChatImageCacheCount(): number {
  return entries.size;
}

export function getChatImageCacheBytes(): number {
  return totalCachedBytes();
}
