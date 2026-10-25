import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    // Test files share one database, so they run one after another.
    fileParallelism: false,
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/db/seed.ts', 'src/db/migrate-cli.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
