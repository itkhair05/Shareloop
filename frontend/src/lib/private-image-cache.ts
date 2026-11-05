/**
 * In-memory cache for private image responses (chat, review, report, support).
 *
 * Blobs are downloaded with the authenticated API client and exposed to the UI
 * only through Object URLs owned by this module. The cache is session-scoped
 * (the authenticated user id is part of every key), bounded by both entry count
 * and total bytes, and evicts idle entries after a short TTL.
 *
 * Nothing is persisted to localStorage, sessionStorage, or IndexedDB.
 */

export const PRIVATE_IMAGE_CACHE_TTL_MS = 60_000;
export const MAX_CACHED_PRIVATE_IMAGES = 12;
export const MAX_CACHED_PRIVATE_IMAGE_BYTES = 40 * 1024 * 1024; // 40 MiB

export interface PrivateImageLease {
  objectUrl: string;
  size: number;
  /** Idempotent: decrements the reference count and releases the Object URL when idle. */
  release: () => void;
}

export interface AcquirePrivateImageOptions {
  signal?: AbortSignal;
}

export type PrivateImageFetcher = () => Promise<Blob>;

export class PrivateImageAbortError extends Error {
  constructor() {
    super('Private image request was aborted');
    this.name = 'PrivateImageAbortError';
  }
}

export class PrivateImageCacheClearedError extends Error {
  constructor() {
    super('Private image cache was cleared');
    this.name = 'PrivateImageCacheClearedError';
  }
}

export function isPrivateImageAbortError(error: unknown): boolean {
  return (
    error instanceof PrivateImageAbortError ||
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
    entries.size > MAX_CACHED_PRIVATE_IMAGES ||
    totalCachedBytes() > MAX_CACHED_PRIVATE_IMAGE_BYTES
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
  }, PRIVATE_IMAGE_CACHE_TTL_MS);
}

function takeLease(key: string, entry: CacheEntry): PrivateImageLease {
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
 * Acquire a lease for a private image.
 *
 * Concurrent hires for the same session and image share one network request.
 * The returned lease must be released by the consumer (normally on unmount).
 */
export function acquirePrivateImage(
  sessionId: string,
  imageUrl: string,
  fetcher: PrivateImageFetcher,
  options: AcquirePrivateImageOptions = {}
): Promise<PrivateImageLease> {
  const key = makeKey(sessionId, imageUrl);
  const { signal } = options;

  if (signal?.aborted) {
    return Promise.reject(new PrivateImageAbortError());
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
        throw new PrivateImageCacheClearedError();
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
      throw new PrivateImageAbortError();
    }

    // The entry may have been cleared (logout/session change) between the
    // download finishing and this consumer resuming.
    if (entries.get(key) !== entry) {
      throw new PrivateImageCacheClearedError();
    }

    return takeLease(key, entry);
  });
}

/**
 * Revoke every cached Object URL and invalidate in-flight downloads.
 * Call on logout or whenever the authenticated user changes.
 */
export function clearPrivateImageCache(): void {
  generation += 1;

  for (const [key, entry] of entries.entries()) {
    clearTimer(entry);
    URL.revokeObjectURL(entry.objectUrl);
    entries.delete(key);
  }

  entries.clear();
  inflight.clear();
}

export function getPrivateImageCacheCount(): number {
  return entries.size;
}

export function getPrivateImageCacheBytes(): number {
  return totalCachedBytes();
}
