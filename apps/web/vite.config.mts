/// <reference types='vitest' />
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

// Content-Security-Policy for the built site, injected as a <meta> tag so it ships with the
// static build regardless of host. Build-only: Vite's dev server relies on inline scripts for
// HMR. frame-ancestors can't be set from a <meta> tag - that one belongs in the static host's
// response headers (see the deploy checklist).
//   - style-src 'unsafe-inline': the CMS brand-theme <style> tag and Radix/FullCalendar inline styles.
//   - img-src https: admins may point images at any external https URL; DiceBear avatars, R2.
//   - Stripe.js, Cloudflare Turnstile, and the Google Maps embed on /contact need their own origins.
const buildContentSecurityPolicy = (apiUrl: string): string => {
  const api = new URL(apiUrl);
  const realtime = `${api.protocol === 'https:' ? 'wss:' : 'ws:'}//${api.host}`;
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", 'https://js.stripe.com', 'https://*.js.stripe.com', 'https://challenges.cloudflare.com'],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", api.origin, realtime, 'https://api.stripe.com', 'https://challenges.cloudflare.com'],
    'frame-src': [
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://hooks.stripe.com',
      'https://challenges.cloudflare.com',
      'https://www.google.com',
    ],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
};

const contentSecurityPolicy = (apiUrl: string): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: buildContentSecurityPolicy(apiUrl) },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, import.meta.dirname, 'VITE_'), ...process.env };
  const apiUrl = env['VITE_API_URL'] || 'http://localhost:3000';

  return {
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/web',
    server: {
      port: 5173,
      host: 'localhost',
    },
    preview: {
      port: 5173,
      host: 'localhost',
    },
    plugins: [react(), tailwindcss(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md']), contentSecurityPolicy(apiUrl)],
    // Uncomment this if you are using workers.
    // worker: {
    //   plugins: () => [ nxViteTsPaths() ],
    // },
    build: {
      outDir: '../../dist/apps/web',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
