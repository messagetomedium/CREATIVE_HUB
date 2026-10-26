import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
const envDir = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, 'VITE_');
  // Fail before emitting a bundle if someone accidentally supplies a private/legacy key.
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (key && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))
    throw new Error('Only a Supabase publishable key is allowed in the browser configuration.');
  return {
    envDir,
    base: env.VITE_BASE_PATH ?? '/',
    plugins: [react()],
    server: { strictPort: true },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'phaser', test: /node_modules\/phaser/ },
              { name: 'supabase', test: /node_modules\/@supabase/ },
            ],
          },
        },
      },
    },
  };
});
