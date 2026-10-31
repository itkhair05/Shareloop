import { describe, expect, it } from 'vitest';
import { resolveImageUrl } from '../utils';
import { appConfig } from '../config';

describe('resolveImageUrl', () => {
  const relativeFile = '/api/v1/files/97f8bae0-ee18-44f9-b85b-89ea02beca28.jpg';

  it('prefixes relative backend file paths with the configured API base URL', () => {
    expect(resolveImageUrl(relativeFile)).toBe(`${appConfig.apiBaseUrl}${relativeFile}`);
    expect(resolveImageUrl('api/v1/files/image.jpg')).toBe(
      `${appConfig.apiBaseUrl}/api/v1/files/image.jpg`
    );
  });

  it('preserves absolute backend URLs without double-prefixing the API base URL', () => {
    const absoluteUrl = `${appConfig.apiBaseUrl}${relativeFile}`;
    const resolved = resolveImageUrl(absoluteUrl);

    expect(resolved).toBe(absoluteUrl);
    expect(resolved?.split(appConfig.apiBaseUrl)).toHaveLength(2);
  });

  it('preserves absolute Google avatar URLs', () => {
    const googleUrl = 'https://lh3.googleusercontent.com/a/ACg8ocJ-test-avatar=s96-c';
    expect(resolveImageUrl(googleUrl)).toBe(googleUrl);
  });

  it('preserves blob preview URLs', () => {
    const blobUrl = 'blob:http://localhost:5173/2f9a6e10-9d33-4a91-9d8a-1f1b9c8d7e6f';
    expect(resolveImageUrl(blobUrl)).toBe(blobUrl);
  });

  it('preserves data URLs', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
    expect(resolveImageUrl(dataUrl)).toBe(dataUrl);
  });

  it('returns null for missing or blank values', () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl(undefined)).toBeNull();
    expect(resolveImageUrl('')).toBeNull();
    expect(resolveImageUrl('   ')).toBeNull();
  });
});
