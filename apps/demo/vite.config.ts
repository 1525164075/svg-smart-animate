import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig(({ command }) => {
  const useLocal = command === 'serve' && process.env.SSA_LOCAL_CORE !== '0';
  return {
    resolve: useLocal
      ? {
          alias: {
            '@marcodai/svg-smart-animate-core': resolve(__dirname, '../../packages/core/src/index.ts')
          }
        }
      : undefined,
    server: {
      port: 5173
    }
  };
});
