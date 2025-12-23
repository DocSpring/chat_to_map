/**
 * E2E Test Setup
 *
 * Runs once before all test files to set up the shared cache directory.
 */

import { afterAll, beforeAll } from 'vitest'
import { setupE2ETests, teardownE2ETests } from './helpers'

beforeAll(() => {
  setupE2ETests()
})

afterAll(() => {
  teardownE2ETests()
})
