import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CLIArgs } from '../args.js'
import { cmdValidate } from './validate.js'

const TEST_DIR = './tmp/test-validate'

// Create a mock logger that captures output
function createMockLogger() {
  return {
    log: vi.fn(),
    verbose: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    progress: vi.fn()
  }
}

function createArgs(overrides: Partial<CLIArgs> = {}): CLIArgs {
  return {
    command: 'validate',
    input: '',
    outputDir: './chat-to-map/output',
    formats: [],
    minConfidence: 0.5,
    skipGeocoding: false,
    quiet: false,
    verbose: false,
    dryRun: false,
    debug: false,
    maxResults: 10,
    maxMessages: undefined,
    method: 'both',
    jsonOutput: undefined,
    homeCountry: undefined,
    timezone: undefined,
    scrapeConcurrency: 5,
    scrapeTimeout: 4000,
    ...overrides
  }
}

describe('cmdValidate', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  it('throws when no input specified', async () => {
    const logger = createMockLogger()
    const args = createArgs({ input: '' })

    await expect(cmdValidate(args, logger)).rejects.toThrow('No input file specified')
  })

  describe('WhatsApp iOS format', () => {
    it('validates a valid WhatsApp iOS export', async () => {
      const filePath = join(TEST_DIR, 'chat.txt')
      const content = `[1/15/25, 10:30:00 AM] John: Hello
[1/15/25, 10:31:00 AM] Jane: Hi there!
[1/15/25, 10:32:00 AM] John: How are you?`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath })

      await cmdValidate(args, logger)

      expect(logger.success).toHaveBeenCalledWith('✓ Valid WhatsApp export')
      expect(logger.log).toHaveBeenCalledWith('   3 messages')
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('2 participants: John, Jane'))
    })
  })

  describe('iMessage format', () => {
    it('validates a valid iMessage export', async () => {
      const filePath = join(TEST_DIR, 'imessage.txt')
      const content = `Jan 15, 2025  10:30:00 AM
John Doe
Hello world

Jan 15, 2025  10:31:00 AM
Jane Smith
Hi there!`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath })

      await cmdValidate(args, logger)

      expect(logger.success).toHaveBeenCalledWith('✓ Valid iMessage export')
      expect(logger.log).toHaveBeenCalledWith('   2 messages')
      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('2 participants: John Doe, Jane Smith')
      )
    })
  })

  describe('directory input', () => {
    it('validates a directory with iMessage export', async () => {
      const subDir = join(TEST_DIR, 'imessage-export')
      await mkdir(subDir, { recursive: true })
      const content = `Jan 15, 2025  10:30:00 AM
Me
Test message`
      await writeFile(join(subDir, 'messages.txt'), content)

      const logger = createMockLogger()
      const args = createArgs({ input: subDir })

      await cmdValidate(args, logger)

      expect(logger.success).toHaveBeenCalledWith('✓ Valid iMessage export')
    })
  })

  describe('participant formatting', () => {
    it('shows all participants when 5 or fewer', async () => {
      const filePath = join(TEST_DIR, 'chat.txt')
      const content = `[1/15/25, 10:30:00 AM] Alice: Hi
[1/15/25, 10:31:00 AM] Bob: Hello
[1/15/25, 10:32:00 AM] Charlie: Hey
[1/15/25, 10:33:00 AM] Diana: Howdy
[1/15/25, 10:34:00 AM] Eve: Greetings`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath })

      await cmdValidate(args, logger)

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('5 participants: Alice, Bob, Charlie, Diana, Eve')
      )
    })

    it('shows "and N others" when more than 5 participants', async () => {
      const filePath = join(TEST_DIR, 'chat.txt')
      const content = `[1/15/25, 10:30:00 AM] Alice: Hi
[1/15/25, 10:31:00 AM] Bob: Hello
[1/15/25, 10:32:00 AM] Charlie: Hey
[1/15/25, 10:33:00 AM] Diana: Howdy
[1/15/25, 10:34:00 AM] Eve: Greetings
[1/15/25, 10:35:00 AM] Frank: Yo
[1/15/25, 10:36:00 AM] Grace: Hi all`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath })

      await cmdValidate(args, logger)

      expect(logger.log).toHaveBeenCalledWith(
        expect.stringContaining('7 participants: Alice, Bob, Charlie, Diana, Eve, and 2 others')
      )
    })
  })

  describe('URL counting', () => {
    it('shows URL count when messages contain URLs', async () => {
      const filePath = join(TEST_DIR, 'chat.txt')
      const content = `[1/15/25, 10:30:00 AM] John: Check this https://example.com
[1/15/25, 10:31:00 AM] Jane: And this https://test.com`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath })

      await cmdValidate(args, logger)

      expect(logger.log).toHaveBeenCalledWith('   2 messages contain URLs')
    })

    it('does not show URL count when no URLs', async () => {
      const filePath = join(TEST_DIR, 'chat.txt')
      const content = `[1/15/25, 10:30:00 AM] John: Hello
[1/15/25, 10:31:00 AM] Jane: Hi`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath })

      await cmdValidate(args, logger)

      // Check that URL count message was NOT logged
      const urlCountCall = logger.log.mock.calls.find((call: string[]) =>
        call[0]?.includes('contain URLs')
      )
      expect(urlCountCall).toBeUndefined()
    })
  })

  describe('verbose mode', () => {
    it('shows format detection info in verbose mode', async () => {
      const filePath = join(TEST_DIR, 'chat.txt')
      const content = `[1/15/25, 10:30:00 AM] John: Hello`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath, verbose: true })

      await cmdValidate(args, logger)

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Format auto-detected'))
    })

    it('shows imessage-exporter note for iMessage in verbose mode', async () => {
      const filePath = join(TEST_DIR, 'imessage.txt')
      const content = `Jan 15, 2025  10:30:00 AM
John Doe
Hello world`
      await writeFile(filePath, content)

      const logger = createMockLogger()
      const args = createArgs({ input: filePath, verbose: true })

      await cmdValidate(args, logger)

      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('imessage-exporter'))
    })
  })
})
