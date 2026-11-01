import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  acquireChatImage,
  ChatImageAbortError,
  ChatImageCacheClearedError,
  CHAT_IMAGE_CACHE_TTL_MS,
  clearChatImageCache,
  getChatImageCacheBytes,
  getChatImageCacheCount,
  MAX_CACHED_CHAT_IMAGE_BYTES,
  MAX_CACHED_CHAT_IMAGES,
} from '../chat-image-cache';

const SESSION = 'user-1111';
const URL_A = '/api/v1/chat-images/a1111111-1111-1111-1111-111111111111';
const URL_B = '/api/v1/chat-images/b1111111-1111-1111-1111-111111111111';

let objectUrlCounter = 0;
let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;

function fakeBlob(size = 1024, type = 'image/jpeg'): Blob {
  return { size, type } as Blob;
}

function deferredFetcher() {
  let resolve!: (blob: Blob) => void;
  let reject!: (error: unknown) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Blob>((res, rej) => {
        resolve = res;
        reject = rej;
      })
  );
  return { fetcher, resolve: (blob: Blob) => resolve(blob), reject: (e: unknown) => reject(e) };
}

beforeEach(() => {
  vi.useFakeTimers();
  objectUrlCounter = 0;
  createObjectURL = vi.fn(() => `blob:chat-image-${++objectUrlCounter}`);
  revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  clearChatImageCache();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

afterEach(() => {
  clearChatImageCache();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('chat image cache — tải và chia sẻ', () => {
  it('gộp các yêu cầu đồng thời cho cùng một ảnh vào một lần tải', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());

    const [first, second] = await Promise.all([
      acquireChatImage(SESSION, URL_A, fetcher),
      acquireChatImage(SESSION, URL_A, fetcher),
    ]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(first.objectUrl).toBe(second.objectUrl);
    expect(getChatImageCacheCount()).toBe(1);
  });

  it('tái sử dụng Object URL đã lưu cho lần gắn kết tiếp theo', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());

    const first = await acquireChatImage(SESSION, URL_A, fetcher);
    first.release();

    vi.advanceTimersByTime(CHAT_IMAGE_CACHE_TTL_MS - 1);
    const second = await acquireChatImage(SESSION, URL_A, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second.objectUrl).toBe(first.objectUrl);

    second.release();
  });

  it('chỉ thu hồi Object URL khi mọi consumer đã giải phóng', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());

    const first = await acquireChatImage(SESSION, URL_A, fetcher);
    const second = await acquireChatImage(SESSION, URL_A, fetcher);

    first.release();
    vi.advanceTimersByTime(CHAT_IMAGE_CACHE_TTL_MS);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    second.release();
    vi.advanceTimersByTime(CHAT_IMAGE_CACHE_TTL_MS);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(first.objectUrl);
    expect(getChatImageCacheCount()).toBe(0);
  });

  it('giải phóng nhiều lần chỉ giảm tham chiếu một lần', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());
    const lease = await acquireChatImage(SESSION, URL_A, fetcher);

    lease.release();
    lease.release();
    vi.advanceTimersByTime(CHAT_IMAGE_CACHE_TTL_MS);

    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('giữ ảnh trong bộ nhớ đệm tối đa TTL sau khi không còn ai dùng', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());
    const lease = await acquireChatImage(SESSION, URL_A, fetcher);

    lease.release();
    expect(getChatImageCacheCount()).toBe(1);

    vi.advanceTimersByTime(CHAT_IMAGE_CACHE_TTL_MS);

    expect(getChatImageCacheCount()).toBe(0);
    expect(getChatImageCacheBytes()).toBe(0);
  });
});

describe('chat image cache — giới hạn bộ nhớ', () => {
  it('loại bỏ mục ít dùng nhất khi vượt số lượng tối đa', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());
    const leases = [];

    for (let index = 0; index < MAX_CACHED_CHAT_IMAGES; index += 1) {
      const lease = await acquireChatImage(
        SESSION,
        `/api/v1/chat-images/${String(index).padStart(8, '0')}-1111-1111-1111-111111111111`,
        fetcher
      );
      leases.push(lease);
      vi.advanceTimersByTime(1);
    }

    for (const lease of leases) {
      lease.release();
      vi.advanceTimersByTime(1);
    }

    const oldestUrl = leases[0].objectUrl;
    await acquireChatImage(SESSION, URL_A, fetcher);

    expect(getChatImageCacheCount()).toBe(MAX_CACHED_CHAT_IMAGES);
    expect(revokeObjectURL).toHaveBeenCalledWith(oldestUrl);
  });

  it('loại bỏ mục cũ khi vượt tổng dung lượng tối đa', async () => {
    const oversized = Math.ceil(MAX_CACHED_CHAT_IMAGE_BYTES / 2) + 1;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(fakeBlob(oversized))
      .mockResolvedValueOnce(fakeBlob(oversized));

    const first = await acquireChatImage(SESSION, URL_A, fetcher);
    first.release();
    vi.advanceTimersByTime(1);

    const second = await acquireChatImage(SESSION, URL_B, fetcher);

    expect(getChatImageCacheCount()).toBe(1);
    expect(getChatImageCacheBytes()).toBe(oversized);
    expect(revokeObjectURL).toHaveBeenCalledWith(first.objectUrl);

    second.release();
  });

  it('không thu hồi Object URL đang được component khác sử dụng khi vượt giới hạn', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());
    const activeLeases = [];

    for (let index = 0; index < MAX_CACHED_CHAT_IMAGES; index += 1) {
      activeLeases.push(
        await acquireChatImage(
          SESSION,
          `/api/v1/chat-images/${String(index).padStart(8, '0')}-1111-1111-1111-111111111111`,
          fetcher
        )
      );
    }

    const overflow = await acquireChatImage(SESSION, URL_A, fetcher);

    expect(getChatImageCacheCount()).toBe(MAX_CACHED_CHAT_IMAGES + 1);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    for (const lease of activeLeases) lease.release();
    overflow.release();
  });
});

describe('chat image cache — phiên đăng nhập', () => {
  it('không tái sử dụng ảnh giữa hai phiên người dùng', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(fakeBlob())
      .mockResolvedValueOnce(fakeBlob());

    const firstUser = await acquireChatImage('user-a', URL_A, fetcher);
    const secondUser = await acquireChatImage('user-b', URL_A, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(firstUser.objectUrl).not.toBe(secondUser.objectUrl);

    firstUser.release();
    secondUser.release();
  });

  it('xóa toàn bộ bộ nhớ đệm và thu hồi Object URL khi đăng xuất', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());
    const first = await acquireChatImage(SESSION, URL_A, fetcher);
    const second = await acquireChatImage(SESSION, URL_A, fetcher);
    first.release();
    second.release();

    const withImage = await acquireChatImage(SESSION, URL_B, fetcher);

    clearChatImageCache();

    expect(getChatImageCacheCount()).toBe(0);
    expect(getChatImageCacheBytes()).toBe(0);
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith(first.objectUrl);
    expect(revokeObjectURL).toHaveBeenCalledWith(withImage.objectUrl);

    const refetched = await acquireChatImage(SESSION, URL_A, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    refetched.release();
  });

  it('hủy kết quả tải đang chạy khi bộ nhớ đệm bị xóa', async () => {
    const { fetcher, resolve } = deferredFetcher();

    const pending = acquireChatImage(SESSION, URL_A, fetcher);
    clearChatImageCache();
    resolve(fakeBlob());

    await expect(pending).rejects.toBeInstanceOf(ChatImageCacheClearedError);
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(getChatImageCacheCount()).toBe(0);
  });
});

describe('chat image cache — AbortSignal', () => {
  it('không bắt đầu tải khi tín hiệu đã bị hủy', async () => {
    const fetcher = vi.fn().mockResolvedValue(fakeBlob());
    const controller = new AbortController();
    controller.abort();

    await expect(
      acquireChatImage(SESSION, URL_A, fetcher, { signal: controller.signal })
    ).rejects.toBeInstanceOf(ChatImageAbortError);

    expect(fetcher).not.toHaveBeenCalled();
  });

  it('không cấp lease cho consumer đã hủy trước khi tải xong', async () => {
    const { fetcher, resolve } = deferredFetcher();
    const controller = new AbortController();

    const pending = acquireChatImage(SESSION, URL_A, fetcher, {
      signal: controller.signal,
    });
    controller.abort();
    resolve(fakeBlob());

    await expect(pending).rejects.toBeInstanceOf(ChatImageAbortError);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(getChatImageCacheCount()).toBe(1);
  });
});
