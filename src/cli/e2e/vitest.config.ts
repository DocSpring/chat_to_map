import { defineConfig } from 'vitest/config'
import { BaseSequencer, type TestSpecification } from 'vitest/node'

class PipelineSequencer extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    // Sort by filename (numbered: 1-parse, 2-scan, etc.)
    return [...files].sort((a, b) => (a?.moduleId ?? '').localeCompare(b?.moduleId ?? ''))
  }
}

export default defineConfig({
  test: {
    fileParallelism: false,
    globalSetup: ['./src/cli/e2e/setup.ts'],
    setupFiles: ['./src/cli/e2e/inject-state.ts'],
    sequence: {
      sequencer: PipelineSequencer
    }
  }
})
