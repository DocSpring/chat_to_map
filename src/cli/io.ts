/**
 * CLI File I/O
 *
 * File reading and writing utilities for the CLI.
 */

import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

function isTelegramResultJson(name: string): boolean {
  return name === 'result.json' || name.endsWith('/result.json')
}

/**
 * Find supported chat files in a directory (non-recursive).
 */
async function findChatFilesInDir(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath)
  const txtFiles: string[] = []

  for (const entry of entries) {
    if (entry === 'result.json') {
      return [join(dirPath, entry)]
    }

    if (entry.endsWith('.txt')) {
      txtFiles.push(join(dirPath, entry))
    }
  }

  return txtFiles.sort()
}

/**
 * Read an input file, handling zip archives and directories.
 *
 * Supports:
 * - .zip files (WhatsApp and Telegram exports)
 * - Directories containing result.json or .txt files
 * - Direct file paths
 */
export async function readInputFile(path: string): Promise<string> {
  const stats = await stat(path)

  // Handle directory input
  if (stats.isDirectory()) {
    const chatFiles = await findChatFilesInDir(path)

    if (chatFiles.length === 0) {
      throw new Error(`No .txt or result.json files found in directory: ${path}`)
    }

    // If multiple files, concatenate them (common for iMessage exports)
    if (chatFiles.length > 1) {
      const contents: string[] = []
      for (const file of chatFiles) {
        const content = await readFile(file, 'utf-8')
        contents.push(content)
      }
      return contents.join('\n')
    }

    // Single file
    const singleFile = chatFiles[0]
    if (!singleFile) {
      throw new Error(`No .txt or result.json files found in directory: ${path}`)
    }
    return readFile(singleFile, 'utf-8')
  }

  // Check if it's a zip file
  if (path.endsWith('.zip')) {
    const JSZip = await import('jszip')
    const zipBuffer = await readFile(path)
    const zip = await JSZip.default.loadAsync(new Uint8Array(zipBuffer))

    const fileNames = Object.keys(zip.files)

    // Find the chat file in the zip
    const chatFile =
      fileNames.find(isTelegramResultJson) ??
      fileNames.find((name) => name === '_chat.txt') ??
      fileNames.find((name) => name.endsWith('.txt'))

    if (!chatFile) {
      throw new Error('No chat file found in zip archive')
    }

    const file = zip.files[chatFile]
    if (!file) {
      throw new Error('Could not read chat file from zip')
    }

    const content = await file.async('string')
    return content
  }

  // Plain text file
  return readFile(path, 'utf-8')
}

/**
 * Ensure a directory exists.
 */
export async function ensureDir(dir: string): Promise<void> {
  if (dir.startsWith('--')) {
    throw new Error(`ensureDir called with flag-like path: "${dir}"`)
  }
  await mkdir(dir, { recursive: true })
}
