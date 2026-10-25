import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/db/seed.ts', 'src/db/migrate-cli.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  // The shared package is TypeScript source, so bundle it in. Real npm packages stay external.
  noExternal: ['@vv/shared'],
  splitting: true,
  sourcemap: true,
});
