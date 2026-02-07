import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    include: ['src/**/*.test.{js,mjs,cjs}', 'packages/**/*.test.{js,mjs,cjs}'],
  },
});
