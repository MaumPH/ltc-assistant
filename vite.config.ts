import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// GitHub Pages 배포 시 저장소 이름을 VITE_BASE_PATH 환경변수로 주입
// 예: VITE_BASE_PATH=/ltc-assistant/
// 로컬 개발 및 루트 배포 시에는 '/' 사용
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH || '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});
