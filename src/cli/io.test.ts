import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readInputFile } from './io'

const TEST_DIR = './tmp/test-io'

describe('readInputFile', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true })
  })

  describe('plain text files', () => {
    it('reads a plain text file', async () => {
      const filePath = join(TEST_DIR, 'chat.txt')
      await writeFile(filePath, 'Hello, world!')

      const content = await readInputFile(filePath)

      expect(content).toBe('Hello, world!')
    })

    it('reads a direct Telegram result.json file', async () => {
      const filePath = join(TEST_DIR, 'result.json')
      await writeFile(filePath, '{"messages":[]}')

      const content = await readInputFile(filePath)

      expect(content).toBe('{"messages":[]}')
    })
  })

  describe('zip files', () => {
    it('reads a .txt file from a zip archive', async () => {
      const JSZip = await import('jszip')
      const zip = new JSZip.default()
      zip.file('WhatsApp Chat.txt', 'Chat content from zip')

      const zipContent = await zip.generateAsync({ type: 'uint8array' })
      const filePath = join(TEST_DIR, 'export.zip')
      await writeFile(filePath, zipContent)

      const content = await readInputFile(filePath)

      expect(content).toBe('Chat content from zip')
    })

    it('reads _chat.txt from a zip archive', async () => {
      const JSZip = await import('jszip')
      const zip = new JSZip.default()
      zip.file('_chat.txt', 'Chat via _chat.txt')

      const zipContent = await zip.generateAsync({ type: 'uint8array' })
      const filePath = join(TEST_DIR, 'export.zip')
      await writeFile(filePath, zipContent)

      const content = await readInputFile(filePath)

      expect(content).toBe('Chat via _chat.txt')
    })

    it('reads result.json from a Telegram zip archive', async () => {
      const JSZip = await import('jszip')
      const zip = new JSZip.default()
      zip.file('ChatExport/result.json', '{"messages":[]}')

      const zipContent = await zip.generateAsync({ type: 'uint8array' })
      const filePath = join(TEST_DIR, 'telegram.zip')
      await writeFile(filePath, zipContent)

      const content = await readInputFile(filePath)

      expect(content).toBe('{"messages":[]}')
    })

    it('throws when no supported chat file is found in zip', async () => {
      const JSZip = await import('jszip')
      const zip = new JSZip.default()
      zip.file('readme.md', 'Not a chat file')

      const zipContent = await zip.generateAsync({ type: 'uint8array' })
      const filePath = join(TEST_DIR, 'bad.zip')
      await writeFile(filePath, zipContent)

      await expect(readInputFile(filePath)).rejects.toThrow('No chat file found')
    })
  })

  describe('directory input', () => {
    it('reads a single .txt file from a directory', async () => {
      const subDir = join(TEST_DIR, 'imessage-export')
      await mkdir(subDir, { recursive: true })
      await writeFile(join(subDir, 'messages.txt'), 'iMessage content')

      const content = await readInputFile(subDir)

      expect(content).toBe('iMessage content')
    })

    it('reads result.json from a Telegram export directory', async () => {
      const subDir = join(TEST_DIR, 'telegram-export')
      await mkdir(subDir, { recursive: true })
      await writeFile(join(subDir, 'result.json'), '{"messages":[]}')

      const content = await readInputFile(subDir)

      expect(content).toBe('{"messages":[]}')
    })

    it('prefers Telegram result.json over text files in a directory', async () => {
      const subDir = join(TEST_DIR, 'telegram-export-with-files')
      await mkdir(subDir, { recursive: true })
      await writeFile(join(subDir, 'result.json'), '{"messages":[]}')
      await writeFile(join(subDir, 'captions.txt'), 'caption attachment')

      const content = await readInputFile(subDir)

      expect(content).toBe('{"messages":[]}')
    })

    it('concatenates multiple .txt files from a directory', async () => {
      const subDir = join(TEST_DIR, 'multi-export')
      await mkdir(subDir, { recursive: true })
      await writeFile(join(subDir, 'chat1.txt'), 'First chat')
      await writeFile(join(subDir, 'chat2.txt'), 'Second chat')

      const content = await readInputFile(subDir)

      // Files are sorted alphabetically, then joined with newlines
      expect(content).toBe('First chat\nSecond chat')
    })

    it('throws when directory contains no supported chat files', async () => {
      const subDir = join(TEST_DIR, 'empty-export')
      await mkdir(subDir, { recursive: true })
      await writeFile(join(subDir, 'readme.md'), 'Not a txt file')

      await expect(readInputFile(subDir)).rejects.toThrow('No .txt or result.json files found')
    })

    it('throws when directory is empty', async () => {
      const subDir = join(TEST_DIR, 'empty-dir')
      await mkdir(subDir, { recursive: true })

      await expect(readInputFile(subDir)).rejects.toThrow('No .txt or result.json files found')
    })

    it('ignores non-.txt files in directory', async () => {
      const subDir = join(TEST_DIR, 'mixed-export')
      await mkdir(subDir, { recursive: true })
      await writeFile(join(subDir, 'messages.txt'), 'Real chat')
      await writeFile(join(subDir, 'readme.md'), 'Not a chat')
      await writeFile(join(subDir, 'config.json'), '{}')

      const content = await readInputFile(subDir)

      expect(content).toBe('Real chat')
    })

    it('sorts files alphabetically before concatenating', async () => {
      const subDir = join(TEST_DIR, 'sorted-export')
      await mkdir(subDir, { recursive: true })
      // Write in non-alphabetical order
      await writeFile(join(subDir, 'z_last.txt'), 'Last content')
      await writeFile(join(subDir, 'a_first.txt'), 'First content')
      await writeFile(join(subDir, 'm_middle.txt'), 'Middle content')

      const content = await readInputFile(subDir)

      expect(content).toBe('First content\nMiddle content\nLast content')
    })
  })
})
