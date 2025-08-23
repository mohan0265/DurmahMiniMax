// Client/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// DEV CSP: allow ws:// and http:// so local WebSocket works in development
const DEV_CSP =
  "default-src 'self' http: https: ws: wss: data: blob; " +
  "connect-src 'self' http: https: ws: wss: data: blob; " +
  "img-src 'self' http: https: data: blob; " +
  "media-src 'self' http: https: data: blob; " +
  "font-src 'self' http: https: data:; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' http: https:; " +
  "style-src 'self' 'unsafe-inline' http: https:";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const baseConfig = {
    plugins: [react()],
    server: {
      port: 5174,
      strictPort: true,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
          ws: true, // keep WebSocket proxying
        }
      },
      headers: {
        'Content-Security-Policy': DEV_CSP,
        'Permissions-Policy': 'microphone=(self)',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY'
      }
    },
    preview: {
      port: 4174,
      strictPort: true,
      headers: {
        'Content-Security-Policy': DEV_CSP,
        'Permissions-Policy': 'microphone=(self)'
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            motion: ['framer-motion'],
            icons: ['lucide-react'],
            supabase: ['@supabase/supabase-js']
          }
        }
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.1.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'framer-motion',
        'lucide-react',
        'react-hot-toast',
        'clsx'
      ]
    }
  };

  // Widget library build (kept intact)
  if (mode === 'widget') {
    return {
      ...baseConfig,
      build: {
        lib: {
          entry: resolve(__dirname, 'src/widget.tsx'),
          name: 'DurmahWidget',
          formats: ['es', 'umd'],
          fileName: (format) => `durmah-widget.${format}.js`
        },
        rollupOptions: {
          external: ['react', 'react-dom'],
          output: {
            globals: {
              react: 'React',
              'react-dom': 'ReactDOM'
            },
            assetFileNames: (assetInfo) => {
              if (assetInfo.name?.endsWith('.css')) return 'durmah-widget.css';
              return assetInfo.name;
            }
          }
        },
        sourcemap: true,
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: mode === 'production',
            drop_debugger: true
          },
          mangle: {
            keep_classnames: true,
            keep_fnames: true
          }
        },
        cssCodeSplit: false
      },
      define: {
        ...baseConfig.define,
        __IS_WIDGET_BUILD__: true
      }
    };
  }

  return baseConfig;
});
