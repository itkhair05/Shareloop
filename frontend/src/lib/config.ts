/**
 * Application Configuration Module
 * Validates and normalizes runtime environment variables.
 */

interface AppConfig {
  apiBaseUrl: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function assertValidProductionApiBaseUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      'VITE_API_BASE_URL must be an absolute URL for production builds (for example https://shareloop-api.onrender.com).'
    );
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(
      'VITE_API_BASE_URL must use HTTPS for production builds. http:// URLs are only allowed in local development.'
    );
  }
  if (!parsed.hostname) {
    throw new Error('VITE_API_BASE_URL must include a valid host name for production builds.');
  }
}

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const hasConfiguredUrl = typeof envUrl === 'string' && envUrl.trim().length > 0;

  if (import.meta.env.PROD) {
    if (!hasConfiguredUrl) {
      throw new Error(
        'VITE_API_BASE_URL is required for production builds. Configure it in the Cloudflare Pages environment variables.'
      );
    }
    const normalized = normalizeApiBaseUrl(envUrl);
    assertValidProductionApiBaseUrl(normalized);
    return normalized;
  }

  if (hasConfiguredUrl) {
    return normalizeApiBaseUrl(envUrl);
  }

  // Local development fallback matching backend local dev port.
  return 'http://localhost:8080';
}

export const appConfig: AppConfig = {
  apiBaseUrl: resolveApiBaseUrl(),
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  isTest: import.meta.env.MODE === 'test',
};

export default appConfig;
