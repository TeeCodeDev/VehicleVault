import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Plugin } from 'vite';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

/**
 * Gives every build its own service worker. sw.js names its cache after __BUILD_ID__, which is a hash of what
 * the build produced (the page that names the JS bundle, the manifest and the worker itself). A changed build
 * therefore ships a byte-different worker: browsers install it on their own, it drops the caches of earlier
 * builds, and nobody has to unregister the service worker by hand after a rebuild.
 */
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'vehiclevault-stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const source = fs.readFileSync(swPath, 'utf-8');
      const hash = crypto.createHash('sha1').update(source);
      for (const name of ['index.html', 'manifest.json']) {
        const file = path.join(outDir, name);
        if (fs.existsSync(file)) hash.update(fs.readFileSync(file));
      }
      fs.writeFileSync(swPath, source.replaceAll('__BUILD_ID__', hash.digest('hex').slice(0, 10)));
    },
  };
}

export default defineConfig({
  plugins: [react(), stampServiceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3084',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3084',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
