/**
 * CLI File I/O
 *
 * File reading and writing utilities for the CLI.
 */

import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Find .txt files in a directory (non-recursive).
 */
async function findTxtFilesInDir(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath)
  const txtFiles: string[] = []

  for (const entry of entries) {
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
 * - .zip files (WhatsApp exports)
 * - Directories containing .txt files (iMessage exports, extracted WhatsApp)
 * - Direct .txt file paths
 */
export async function readInputFile(path: string): Promise<string> {
  const stats = await stat(path)

  // Handle directory input
  if (stats.isDirectory()) {
    const txtFiles = await findTxtFilesInDir(path)

    if (txtFiles.length === 0) {
      throw new Error(`No .txt files found in directory: ${path}`)
    }

    // If multiple files, concatenate them (common for iMessage exports)
    if (txtFiles.length > 1) {
      const contents: string[] = []
      for (const file of txtFiles) {
        const content = await readFile(file, 'utf-8')
        contents.push(content)
      }
      return contents.join('\n')
    }

    // Single file
    const singleFile = txtFiles[0]
    if (!singleFile) {
      throw new Error(`No .txt files found in directory: ${path}`)
    }
    return readFile(singleFile, 'utf-8')
  }

  // Check if it's a zip file
  if (path.endsWith('.zip')) {
    const JSZip = await import('jszip')
    const zipBuffer = await readFile(path)
    const zip = await JSZip.default.loadAsync(new Uint8Array(zipBuffer))

    // Find the chat file in the zip
    const chatFile = Object.keys(zip.files).find(
      (name) => name.endsWith('.txt') || name === '_chat.txt'
    )

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
  await mkdir(dir, { recursive: true })
}
