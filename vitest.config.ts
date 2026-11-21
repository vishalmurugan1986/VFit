import { defineConfig } from 'vitest/config'

// Unit tests cover the pure logic in src/lib (units, dates, strength maths, backups...).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
