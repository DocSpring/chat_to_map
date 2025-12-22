/**
 * Read Step
 *
 * Read input file with zip extraction caching.
 * This is the entry point for all pipeline operations.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { readInputFile } from '../io.js'

/**
 * Input file metadata for caching.
 */
export interface InputMetadata {
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
 * Cache entry for extracted content.
 */
interface ContentCacheEntry {
  content: string
  mtime: number
  extractedAt: number
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
 * Get the path to the cached extraction for a file.
 */
function getExtractionCachePath(metadata: InputMetadata, cacheDir: string): string {
  return join(cacheDir, 'extractions', `${metadata.baseName}-${metadata.hash}.json`)
}

/**
 * Try to read cached extracted content.
 */
export function getCachedExtraction(metadata: InputMetadata, cacheDir: string): string | null {
  const cachePath = getExtractionCachePath(metadata, cacheDir)

  if (!existsSync(cachePath)) {
    return null
  }

  try {
    const raw = readFileSync(cachePath, 'utf-8')
    const entry = JSON.parse(raw) as ContentCacheEntry

    // Validate mtime matches (file hasn't changed)
    if (entry.mtime !== metadata.mtime) {
      return null
    }

    return entry.content
  } catch {
    return null
  }
}

/**
 * Cache extracted content for future use.
 */
export function cacheExtraction(metadata: InputMetadata, content: string, cacheDir: string): void {
  const cachePath = getExtractionCachePath(metadata, cacheDir)
  const dir = join(cachePath, '..')

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const entry: ContentCacheEntry = {
    content,
    mtime: metadata.mtime,
    extractedAt: Date.now()
  }

  writeFileSync(cachePath, JSON.stringify(entry))
}

/**
 * Read an input file with caching support.
 * For zip files, caches the extracted content by filename + mtime.
 */
export async function readInputFileWithCache(
  filePath: string,
  options: { cacheDir: string; skipCache?: boolean }
): Promise<{ content: string; metadata: InputMetadata; fromCache: boolean }> {
  const metadata = await getInputMetadata(filePath)
  const isZipFile = filePath.endsWith('.zip')

  // Check cache first for zip files (unless skipped)
  if (isZipFile && !options.skipCache) {
    const cached = getCachedExtraction(metadata, options.cacheDir)
    if (cached !== null) {
      return { content: cached, metadata, fromCache: true }
    }
  }

  // Read the file (extracts zip if needed)
  const content = await readInputFile(filePath)

  // Cache zip extractions (they're expensive to re-extract)
  if (isZipFile) {
    cacheExtraction(metadata, content, options.cacheDir)
  }

  return { content, metadata, fromCache: false }
}
