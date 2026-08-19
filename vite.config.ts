import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/dasha-roma-wedding/',
  plugins: [react()],
});
