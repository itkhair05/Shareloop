import { appConfig } from './config';

/**
 * Class name concatenation helper
 */
export function cn(...classes: (string | boolean | null | undefined | Record<string, boolean>)[]): string {
  const result: string[] = [];

  for (const item of classes) {
    if (!item) continue;
    if (typeof item === 'string') {
      result.push(item);
    } else if (typeof item === 'object') {
      for (const [key, value] of Object.entries(item)) {
        if (value) result.push(key);
      }
    }
  }

  return result.join(' ');
}

/**
 * Format timestamp safely
 */
export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Validates whether a string is a valid UUID format
 */
export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * Safely resolves an image URL to an absolute URL
 * Supports relative paths like /api/v1/files/{filename} and absolute URLs
 */
export function resolveImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${appConfig.apiBaseUrl}${cleanPath}`;
}

/**
 * Formats price with appropriate Vietnamese currency display
 */
export function formatPrice(price?: number | null, currency: string | null = 'VND'): string {
  if (price == null || isNaN(price)) return '—';
  try {
    const curr = currency || 'VND';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'VND' ? 0 : 2,
    }).format(price);
  } catch {
    return `${price.toLocaleString('vi-VN')} ${currency || '₫'}`;
  }
}
