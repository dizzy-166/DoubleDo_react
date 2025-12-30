import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 👇 Прокси для ВСЕХ запросов к Supabase
      '/supabase-rest': {
        target: 'https://ydetmjryjpnrpcmoxvre.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/supabase-rest/, ''),
        secure: true,
        headers: {
          'apikey': 'ваш_anon_ключ_здесь', // Ваш реальный anon key
          'Authorization': `Bearer ваш_anon_ключ_здесь`
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxying request:', req.method, req.url);
          });
        }
      },
      // 👇 Отдельный прокси для auth (важно!)
      '/supabase-auth': {
        target: 'https://ydetmjryjpnrpcmoxvre.supabase.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/supabase-auth/, ''),
        secure: true,
        headers: {
          'apikey': 'ваш_anon_ключ_здесь',
          'X-Client-Info': 'supabase-js/2.39.0'
        },
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Auth proxy:', req.method, req.url);
          });
        }
      }
    }
  }
});