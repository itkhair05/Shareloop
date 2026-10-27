/**
 * Resolves safe post-login destination URL.
 * - If a valid prior destination from location.state exists (not '/login' and relative), preserves it.
 * - Otherwise:
 *   - For ADMIN role, redirects directly to '/admin'.
 *   - For regular USER, redirects to '/'.
 */
export function resolvePostLoginDestination(
  fromLocation?: { pathname?: string; search?: string },
  role?: string
): string {
  if (
    fromLocation?.pathname &&
    fromLocation.pathname.startsWith('/') &&
    fromLocation.pathname !== '/login'
  ) {
    return `${fromLocation.pathname}${fromLocation.search || ''}`;
  }
  return role === 'ADMIN' ? '/admin' : '/';
}
