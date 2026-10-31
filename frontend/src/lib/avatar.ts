/**
 * Avatar and initials utility functions for ShareLoop frontend.
 */

/**
 * Extracts initials from a display name supporting Vietnamese and Unicode characters.
 *
 * Rules:
 * - Returns null if name is null, undefined, empty, or whitespace-only.
 * - Trims leading and trailing whitespace and collapses multiple consecutive spaces.
 * - Single-word names return the uppercase first character.
 * - Multi-word names return the uppercase first character of the first word and
 *   the uppercase first character of the last word.
 *
 * Examples:
 * - "Nguyễn Văn An" -> "NA"
 * - "Trần Minh" -> "TM"
 * - "Khải" -> "K"
 * - "  Nguyễn   Văn An  " -> "NA"
 * - "đặng văn lâm" -> "ĐL"
 */
export function getInitials(name?: string | null): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;

  if (words.length === 1) {
    const chars = Array.from(words[0]);
    return chars.length > 0 ? chars[0].toUpperCase() : null;
  }

  const firstChar = Array.from(words[0])[0];
  const lastChar = Array.from(words[words.length - 1])[0];

  if (!firstChar || !lastChar) return null;

  return (firstChar + lastChar).toUpperCase();
}
