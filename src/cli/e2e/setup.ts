/**
 * E2E Test Global Setup
 *
 * Runs once before all test files to set up the shared cache directory.
 * Uses vitest globalSetup with provide() to pass state to tests.
 */

import type { GlobalSetupContext } from 'vitest/node'
import { setupE2ETests, teardownE2ETests } from './helpers'

export default function setup({ provide }: GlobalSetupContext): () => void {
  const state = setupE2ETests()

  // Pass state to test files via provide()
  provide('e2eTestState', state)

  // Return teardown function
  return () => {
    teardownE2ETests(state)
  }
}
