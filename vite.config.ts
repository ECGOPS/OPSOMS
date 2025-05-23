import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';
import { securityConfig } from './src/config/security';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      cors: securityConfig.cors,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.googleapis.com https://*.gstatic.com https://*.gpteng.co; style-src 'self' 'unsafe-inline' https://*.google.com https://*.googleapis.com https://*.gstatic.com; img-src 'self' data: https: blob: https://*.google.com https://*.googleapis.com https://*.gstatic.com; connect-src 'self' https: wss: https://*.google.com https://*.googleapis.com https://www.google.com; font-src 'self' data: https: https://*.google.com https://*.gstatic.com; object-src 'none'; media-src 'self'; frame-src 'self' https://www.google.com https://www.google.com/maps/ https://*.googleapis.com https://*.gstatic.com; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-site'
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'ecg-images/ecg-logo.png'],
        manifest: {
          name: 'ECG Outage Management System',
          short_name: 'ECG OMS',
          description: 'Outage Management System for ECG',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/ecg-images/ecg-logo.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/ecg-images/ecg-logo.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/ecg-images/ecg-logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ],
          start_url: '/',
          orientation: 'portrait',
          scope: '/',
          id: '/',
          prefer_related_applications: false
        },
        workbox: {
          cleanupOutdatedCaches: true,
          sourcemap: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.(png|jpg|jpeg|svg|gif)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html'
        },
        strategies: 'generateSW',
        injectRegister: 'auto',
        minify: true
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
