// 仅用于无宿主的本地布局/离线玩法预览；生产构建仍使用官方 Manifest 插件。
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({ base: './', cacheDir: 'node_modules/.vite-web', plugins: [react()], server: { host: '127.0.0.1', port: 4173, strictPort: true } });
