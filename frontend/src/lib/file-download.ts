/**
 * Shared helpers for browser file downloads backed by Blob payloads
 * (CSV exports, PDF documents, ...).
 */

const FILENAME_STAR_PATTERN = /filename\*\s*=\s*([^;]+)/i;
const FILENAME_PATTERN = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i;

function sanitizeFilename(raw: string): string | null {
  const stripped = raw.trim().replace(/^"+|"+$/g, '');
  const basename = stripped.split(/[\\/]/).pop() ?? '';
  const cleaned = Array.from(basename)
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 0x1f && code !== 0x7f;
    })
    .join('')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') return null;
  return cleaned.slice(0, 255);
}

function decodeExtendedFilename(raw: string): string | null {
  const value = raw.trim();
  const extended = /^[^']*'[^']*'(.*)$/.exec(value);
  const encoded = extended ? extended[1] : value;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

/**
 * Extracts and sanitizes the filename from a Content-Disposition header value.
 * Returns null when the header is missing or carries no usable filename.
 */
export function parseContentDispositionFilename(
  header: string | null | undefined
): string | null {
  if (!header) return null;

  const extendedValue = FILENAME_STAR_PATTERN.exec(header)?.[1];
  if (extendedValue) {
    const decoded = decodeExtendedFilename(extendedValue);
    if (decoded) {
      const safe = sanitizeFilename(decoded);
      if (safe) return safe;
    }
  }

  const match = FILENAME_PATTERN.exec(header);
  const value = match?.[1] ?? match?.[2];
  return value ? sanitizeFilename(value) : null;
}

/**
 * Triggers a browser download for a Blob via a temporary object URL.
 * The object URL is revoked after the click is dispatched.
 */
export function downloadBlobFile(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
