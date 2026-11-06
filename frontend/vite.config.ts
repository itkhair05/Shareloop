import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const PRODUCTION_BUILD_ERROR_PREFIX = '[ShareLoop]';

function assertProductionApiBaseUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(
      `${PRODUCTION_BUILD_ERROR_PREFIX} VITE_API_BASE_URL is required for production builds. ` +
        'Set it in the Cloudflare Pages project environment (for example https://shareloop-api.onrender.com).'
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `${PRODUCTION_BUILD_ERROR_PREFIX} VITE_API_BASE_URL must be an absolute URL. Received: ${value}`
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      `${PRODUCTION_BUILD_ERROR_PREFIX} VITE_API_BASE_URL must use HTTPS for production builds. Received: ${value}`
    );
  }

  return value.replace(/\/+$/, '');
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configuredApiBaseUrl = env.VITE_API_BASE_URL?.trim();

  if (mode === 'production') {
    assertProductionApiBaseUrl(configuredApiBaseUrl);
  }

  const devProxyTarget = configuredApiBaseUrl && configuredApiBaseUrl.length > 0
    ? configuredApiBaseUrl.replace(/\/+$/, '')
    : 'http://localhost:8080';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  };
});
