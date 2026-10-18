import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { miniappManifest } from '@heybox/hb-sdk/vite';

export default defineConfig({
  base: './',
  plugins: [react(), miniappManifest()],
  build: { target: 'es2022' },
});
