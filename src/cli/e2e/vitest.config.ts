import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    fileParallelism: false,
    setupFiles: ['./src/cli/e2e/setup.ts']
  }
})
