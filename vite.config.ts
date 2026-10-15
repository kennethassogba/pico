import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/pico/',
  plugins: [react(), tailwindcss(), cloudflare({ experimental: { newConfig: true }, inspectorPort: false })],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5174, strictPort: true, watch: { ignored: ['**/output/**'] } },
});
