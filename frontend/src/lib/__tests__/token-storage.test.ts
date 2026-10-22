import { describe, it, expect, beforeEach } from 'vitest';
import { tokenStorage } from '../token-storage';

describe('tokenStorage', () => {
  beforeEach(() => {
    tokenStorage.clearAccessToken();
  });

  it('initially has no token', () => {
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.hasToken()).toBe(false);
  });

  it('stores and retrieves an access token', () => {
    tokenStorage.setAccessToken('sample-jwt-token-123');
    expect(tokenStorage.getAccessToken()).toBe('sample-jwt-token-123');
    expect(tokenStorage.hasToken()).toBe(true);
  });

  it('clears an access token', () => {
    tokenStorage.setAccessToken('sample-jwt-token-123');
    expect(tokenStorage.hasToken()).toBe(true);

    tokenStorage.clearAccessToken();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.hasToken()).toBe(false);
  });
});
