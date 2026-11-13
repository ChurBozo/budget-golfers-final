import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A3: the website runs on its own port (5000); the API runs on 3000.
export default defineConfig({
  plugins: [react()],
  server: { port: 5000, strictPort: true },
  preview: { port: 5000, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.js',
    css: false,
  },
});
