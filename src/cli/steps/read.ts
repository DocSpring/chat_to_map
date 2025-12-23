/**
 * Read Step
 *
 * Read input file and get metadata.
 * Caching of extracted content is handled by PipelineCache (chat.txt stage).
 */

import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { readInputFile } from '../io'

/**
 * Input file metadata.
 */
interface InputMetadata {
  /** Original file path */
  readonly path: string
  /** Base name without extension */
  readonly baseName: string
  /** File modification time in milliseconds */
  readonly mtime: number
  /** Short hash for uniqueness (8 chars) */
  readonly hash: string
}

/**
 * Generate a short hash from filename and mtime.
 */
function generateShortHash(filename: string, mtime: number): string {
  const input = `${filename}:${mtime}`
  return createHash('sha256').update(input).digest('hex').slice(0, 8)
}

/**
 * Sanitize a filename for use as a directory name.
 */
function sanitizeForDirectory(name: string): string {
  return name
    .replace(/\.zip$/i, '')
    .replace(/\.txt$/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)
}

/**
 * Get input file metadata.
 */
export async function getInputMetadata(filePath: string): Promise<InputMetadata> {
  const stats = await stat(filePath)
  const name = basename(filePath)
  const baseName = sanitizeForDirectory(name)
  const mtime = stats.mtimeMs
  const hash = generateShortHash(name, mtime)

  return { path: filePath, baseName, mtime, hash }
}

/**
 * Read an input file (extracts zip if needed).
 * Returns the content and metadata.
 */
export async function readInputFileWithMetadata(
  filePath: string
): Promise<{ content: string; metadata: InputMetadata }> {
  const metadata = await getInputMetadata(filePath)
  const content = await readInputFile(filePath)
  return { content, metadata }
}
