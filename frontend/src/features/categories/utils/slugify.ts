/**
 * Vietnamese slug generation and format validation utilities
 * Matching backend slug format: ^[a-z0-9]+(-[a-z0-9]+)*$
 */

/**
 * Converts Vietnamese text to a clean kebab-case URL-friendly slug.
 * Handles diacritics, đ/Đ, punctuation, whitespace, and consecutive hyphens.
 */
export function slugifyVietnamese(text: string): string {
  if (!text) return '';

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphen
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 100);
}

/**
 * Validates slug format against backend regular expression constraint:
 * Must be lowercase alphanumeric with single hyphens in between (max 100 chars).
 */
export function isValidCategorySlug(slug: string): boolean {
  if (!slug || slug.trim().length === 0 || slug.length > 100) {
    return false;
  }
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug.trim());
}
