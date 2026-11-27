import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    {
      name: "disable-hmr-client-ws",
      apply: "serve",
      enforce: "post",
      transform(code, id) {
        if (id.endsWith("vite/dist/client/client.mjs")) {
          const updated = code.replace(
            /const transport = normalizeModuleRunnerTransport\(\s*\(\(\) => \{[\s\S]*?\}\)\(\)\s*\);/,
            "const transport = normalizeModuleRunnerTransport({ connect() {}, disconnect() {}, send() {} });",
          );
          if (updated !== code) {
            return updated;
          }
        }
        return null;
      },
    },
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icon.svg",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "pwa-maskable-512x512.png",
        "images/*.jpg",
      ],
      manifest: {
        id: "/",
        name: "EYE-CU — Miotso Campus Guide",
        short_name: "EYE-CU",
        description:
          "Offline-ready interactive campus map, places directory, and walking guide for Central University Miotso.",
        theme_color: "#176B56",
        background_color: "#102F29",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,jpg,svg,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url, request }) =>
              sameOrigin &&
              request.method === "GET" &&
              (url.pathname.startsWith("/images/") ||
                /\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(url.pathname) ||
                url.pathname === "/manifest.webmanifest"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "campus-local-assets",
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: ({ sameOrigin, url, request }) =>
              sameOrigin &&
              request.method === "GET" &&
              !url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/__/") &&
              !url.pathname.includes("dev-sw.js") &&
              !url.pathname.includes("workbox-"),
            handler: "NetworkFirst",
            options: {
              cacheName: "app-shell-runtime",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern:
              /^https:\/\/(?:[a-c]\.tile\.openstreetmap\.org|server\.arcgisonline\.com)\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "campus-map-tiles",
              expiration: {
                maxEntries: 600,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    allowedHosts: true,
    hmr: false,
    ws: false,
  },
});
