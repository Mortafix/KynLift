import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  envDir: false,
  envPrefix: 'AUTH_UI_TEST_',
  plugins: [react(), {
    name: 'auth-ui-without-firebase',
    resolveId(id) {
      if (id === 'firebase' || id.startsWith('firebase/')) {
        throw new Error('Il test del form deve usare AuthContext senza inizializzare Firebase.');
      }
    },
  }],
  server: { fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] } },
});
