import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

type BuildInfo = {
  environment: 'development' | 'production';
  revision: string;
  version: string;
};

const productPackage = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
) as { version: string };

function createBuildInfo(command: 'build' | 'serve'): BuildInfo {
  const revision = process.env.BUILD_REVISION?.trim() || 'local';
  return {
    environment: command === 'build' && revision !== 'local' ? 'production' : 'development',
    revision,
    version: productPackage.version,
  };
}

function buildInfoManifest(buildInfo: BuildInfo): Plugin {
  return {
    apply: 'build',
    generateBundle() {
      this.emitFile({
        fileName: 'version.json',
        source: `${JSON.stringify(buildInfo, null, 2)}\n`,
        type: 'asset',
      });
    },
    name: 'build-info-manifest',
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const buildInfo = createBuildInfo(command);

  return {
    define: {
      __APP_BUILD_INFO__: JSON.stringify(buildInfo),
    },
    plugins: [react(), tailwindcss(), buildInfoManifest(buildInfo)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': {
          changeOrigin: true,
          secure: false,
          target: 'http://127.0.0.1:8080',
        },
      },
    },
  };
});
