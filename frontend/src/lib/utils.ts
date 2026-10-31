import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { appConfig } from './config';

/**
 * Kết hợp các class CSS một cách thông minh, tự động xử lý xung đột Tailwind.
 * Sử dụng clsx để xử lý logic điều kiện, và tailwind-merge để ghi đè class đúng cách.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  if (/^(https?|blob|data):/i.test(trimmed)) {
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