import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';
import { securityConfig } from './src/config/security';
import fs from 'fs';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Check if .env file exists and its format
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envLines = envContent.split('\n');
    envLines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const hasVitePrefix = line.startsWith('VITE_');
        const hasEquals = line.includes('=');
        if (!hasVitePrefix || !hasEquals) {
          console.warn(`Warning: Environment variable "${line.split('=')[0]}" is not properly formatted. It should start with VITE_ and contain a value.`);
        }
      }
    });
  }

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
        'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.googleapis.com https://*.gstatic.com https://*.googletagmanager.com; style-src 'self' 'unsafe-inline' https://*.google.com https://*.googleapis.com https://*.gstatic.com; img-src 'self' data: https: blob: https://*.google.com https://*.googleapis.com https://*.gstatic.com; connect-src 'self' https: wss: data: https://*.google.com https://*.googleapis.com https://www.google.com; font-src 'self' data: https: https://*.google.com https://*.gstatic.com; object-src 'none'; media-src 'self' https://*.firebasestorage.googleapis.com https://*.firebasestorage.app https://firebasestorage.googleapis.com; frame-src 'self' https://www.google.com https://www.google.com/maps/ https://*.googleapis.com https://*.gstatic.com; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Resource-Policy': 'same-site'
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['ecg-images/ecg-logo.png'],
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
          enabled: false,
          type: 'module',
          navigateFallback: 'index.html'
        },
        strategies: 'generateSW',
        injectRegister: false,
        minify: true,
        includeManifestIcons: false,
        injectManifest: {
          injectionPoint: undefined
        },
        mode: 'production'
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      exclude: ['crypto'],
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: ['crypto'],
      },
    },
  };
});
