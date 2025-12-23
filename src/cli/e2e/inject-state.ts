/**
 * E2E Test State Injection
 *
 * This setupFile runs in each test file's context and injects
 * the shared state from globalSetup into the testState variable.
 */

import { beforeAll, inject } from 'vitest'
import type { E2ETestState } from './helpers'
import { setTestState } from './helpers'

declare module 'vitest' {
  export interface ProvidedContext {
    e2eTestState: E2ETestState
  }
}

beforeAll(() => {
  const state = inject('e2eTestState')
  setTestState(state)
})
