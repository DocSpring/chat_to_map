/**
 * Pipeline Context
 *
 * Shared context for all pipeline steps including caches and logger.
 */

import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { FilesystemCache } from '../../cache/filesystem'
import { PipelineCache } from '../../cache/pipeline'
import type { Logger } from '../logger'
import { readInputFileWithMetadata } from './read'

/**
 * Options for initializing the pipeline context.
 */
interface InitContextOptions {
  /** Skip cache and regenerate all results */
  readonly noCache?: boolean | undefined
  /** Custom cache directory (overrides env var and default) */
  readonly cacheDir?: string | undefined
}

/**
 * Pipeline context passed to all steps.
 */
export interface PipelineContext {
  /** Original input path */
  readonly input: string
  /** Extracted content (from zip or txt) */
  readonly content: string
  /** Whether content was read from cache */
  readonly contentFromCache: boolean
  /** Pipeline cache for step outputs */
  readonly pipelineCache: PipelineCache
  /** API cache for external service responses */
  readonly apiCache: FilesystemCache
  /** Logger for output */
  readonly logger: Logger
  /** Cache directory */
  readonly cacheDir: string
  /** Skip cache and regenerate all results */
  readonly noCache: boolean
}

/**
 * Initialize pipeline context for an input file.
 *
 * This is the entry point for all pipeline operations:
 * 1. Reads input file (with zip extraction caching)
 * 2. Creates/finds pipeline run based on content hash
 * 3. Initializes API cache
 */
/**
 * Get the cache directory: CLI arg > env var > default.
 */
export function getCacheDir(override?: string): string {
  return override ?? process.env.CHAT_TO_MAP_CACHE_DIR ?? join(homedir(), '.cache', 'chat-to-map')
}

export async function initContext(
  input: string,
  logger: Logger,
  options?: InitContextOptions
): Promise<PipelineContext> {
  const cacheDir = getCacheDir(options?.cacheDir)
  const noCache = options?.noCache ?? false

  // Initialize caches
  const pipelineCache = new PipelineCache(cacheDir)
  const apiCache = new FilesystemCache(cacheDir)

  // Check if we have cached chat.txt content (uses SHA256 of input file bytes)
  let content: string
  let fromCache = false

  const cachedContent = noCache ? null : pipelineCache.getCachedChatContent(input)
  if (cachedContent) {
    content = cachedContent.content
    fromCache = true
    logger.log(`\n📂 Cache: ${basename(cachedContent.runDir)}`)
  } else {
    // Read and extract the input file
    const { content: extractedContent } = await readInputFileWithMetadata(input)
    content = extractedContent

    // Create new pipeline run using file hash and cache chat.txt
    const run = pipelineCache.initRunFromFile(input)
    pipelineCache.setStage('chat', content)
    if (noCache) {
      logger.log(`\n📂 Cache: ${basename(run.runDir)} (--no-cache: regenerating)`)
    } else {
      logger.log(`\n📂 Cache: ${basename(run.runDir)}`)
    }
  }

  return {
    input,
    content,
    contentFromCache: fromCache,
    pipelineCache,
    apiCache,
    logger,
    cacheDir,
    noCache
  }
}
