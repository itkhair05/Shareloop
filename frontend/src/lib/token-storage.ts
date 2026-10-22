/**
 * Safe Token Storage Abstraction
 *
 * Provides a decoupled extension point for authentication tokens.
 * Backend uses Bearer token authorization header: `Authorization: Bearer <token>`.
 * Does not implement speculative auth flows; serves as the foundation for Phase 2.
 */

const STORAGE_KEY = 'shareloop_access_token';

class TokenStorage {
  private inMemoryToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        this.inMemoryToken = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        this.inMemoryToken = null;
      }
    }
  }

  getAccessToken(): string | null {
    return this.inMemoryToken;
  }

  setAccessToken(token: string): void {
    this.inMemoryToken = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, token);
      } catch {
        // Handle private browsing or quota limits safely
      }
    }
  }

  clearAccessToken(): void {
    this.inMemoryToken = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Safe no-op
      }
    }
  }

  hasToken(): boolean {
    return Boolean(this.inMemoryToken);
  }
}

export const tokenStorage = new TokenStorage();
export default tokenStorage;
