import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Copied files import these as production does; the package carries byte-for-byte copies
// (PARITY.json, `vendored`). tsconfig `paths` and tsup.config.ts map the same specifiers.
const vendored = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@hey/scoring/verification-words': vendored('./src/vendor/scoring/verification-words.ts'),
      '@hey/config/zod-messages': vendored('./src/vendor/config/zod-messages.ts'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
