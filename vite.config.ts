import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { publicPrerender } from './build/prerender-public';
import { seoPlugin } from './build/seo';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const configured = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID'].every((key) => Boolean(env[`VITE_FIREBASE_${key}`]?.trim()));
  return {
  plugins: [react(), publicPrerender({ configured }), seoPlugin(mode === 'production' && env.VITE_SITE_INDEXING === 'true'), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'icons/*.png'],
    manifest: {
      id: '/', name: 'Kynlift', short_name: 'Kynlift', lang: 'it',
      description: 'Il tuo allenamento, serie per serie.',
      theme_color: '#101014', background_color: '#101014',
      display: 'standalone', start_url: '/', scope: '/', orientation: 'portrait-primary',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      navigateFallback: '/app.html',
      navigateFallbackAllowlist: [/^\/(?:schede|catalogo|progressi|impostazioni)(?:\?.*)?$/, /^\/allenamento(?:\/(?:sessione|scheda\/[^/?]+))?(?:\?.*)?$/, /^\/storico\/[^/?]+(?:\?.*)?$/],
      cleanupOutdatedCaches: true,
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    },
    devOptions: { enabled: false },
  })],
  build: { chunkSizeWarningLimit: 750, rollupOptions: { output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] } } } },
  };
});
