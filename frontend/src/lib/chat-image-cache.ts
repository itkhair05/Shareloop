/**
 * Chat-specific aliases for the shared private image cache.
 *
 * All private image surfaces (chat, review, report, support) share one bounded,
 * session-scoped cache so a single logout clears every Object URL at once.
 */

export {
  PRIVATE_IMAGE_CACHE_TTL_MS as CHAT_IMAGE_CACHE_TTL_MS,
  MAX_CACHED_PRIVATE_IMAGES as MAX_CACHED_CHAT_IMAGES,
  MAX_CACHED_PRIVATE_IMAGE_BYTES as MAX_CACHED_CHAT_IMAGE_BYTES,
  PrivateImageAbortError as ChatImageAbortError,
  PrivateImageCacheClearedError as ChatImageCacheClearedError,
  isPrivateImageAbortError as isChatImageAbortError,
  acquirePrivateImage as acquireChatImage,
  clearPrivateImageCache as clearChatImageCache,
  getPrivateImageCacheCount as getChatImageCacheCount,
  getPrivateImageCacheBytes as getChatImageCacheBytes,
} from './private-image-cache';

export type {
  PrivateImageLease as ChatImageLease,
  AcquirePrivateImageOptions as AcquireChatImageOptions,
  PrivateImageFetcher as ChatImageFetcher,
} from './private-image-cache';
