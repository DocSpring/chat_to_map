/**
 * Cached Pipeline
 *
 * Wraps pipeline steps with PipelineCache for idempotent execution.
 * Each step checks cache before running, saves results after.
 */

import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { FilesystemCache } from '../cache/filesystem.js'
import { PipelineCache } from '../cache/pipeline.js'
import {
  classifyMessages,
  extractCandidatesByHeuristics,
  filterActivities,
  geocodeActivities,
  parseChatWithStats,
  VERSION
} from '../index.js'
import { scrapeAndEnrichCandidates } from '../scraper/enrich.js'
import type {
  CandidateMessage,
  ClassifiedActivity,
  ClassifierConfig,
  GeocodedActivity,
  GeocoderConfig,
  ParsedMessage
} from '../types.js'
import type { CLIArgs } from './args.js'
import { readInputFile } from './io.js'
import type { Logger } from './logger.js'
import { resolveContext, resolveModelConfig } from './model.js'
import { runExport } from './pipeline.js'

interface CachedPipelineResult {
  messages: ParsedMessage[]
  candidates: CandidateMessage[]
  classifications: ClassifiedActivity[]
  geocoded: GeocodedActivity[]
  fromCache: {
    messages: boolean
    candidates: boolean
    classifications: boolean
    geocoded: boolean
  }
}

interface StepContext {
  args: CLIArgs
  logger: Logger
  pipelineCache: PipelineCache
  apiCache: FilesystemCache
}

/** Step 1: Parse messages from chat content */
function runParseStep(
  ctx: StepContext,
  content: string
): { messages: ParsedMessage[]; fromCache: boolean } {
  const { args, logger, pipelineCache } = ctx

  if (pipelineCache.hasStage('messages')) {
    const messages = pipelineCache.getStage<ParsedMessage[]>('messages') ?? []
    logger.log('\n📝 Parsing messages... 📦 cached')
    logger.success(`${messages.length.toLocaleString()} messages`)
    return { messages, fromCache: true }
  }

  logger.log('\n📝 Parsing messages...')
  const result = parseChatWithStats(content)
  const messages = args.maxMessages
    ? [...result.messages.slice(0, args.maxMessages)]
    : [...result.messages]
  pipelineCache.setStage('messages', messages)
  logger.success(
    `${result.messageCount.toLocaleString()} messages from ${result.senders.length} senders`
  )
  return { messages, fromCache: false }
}

/** Step 2: Extract candidate messages */
function runCandidatesStep(
  ctx: StepContext,
  messages: ParsedMessage[]
): { candidates: CandidateMessage[]; fromCache: boolean } {
  const { args, logger, pipelineCache } = ctx

  if (pipelineCache.hasStage('candidates.heuristics')) {
    const candidates = pipelineCache.getStage<CandidateMessage[]>('candidates.heuristics') ?? []
    logger.log('\n🔍 Extracting candidates... 📦 cached')
    logger.success(`${candidates.length} candidates`)
    return { candidates, fromCache: true }
  }

  logger.log('\n🔍 Extracting candidates...')
  const result = extractCandidatesByHeuristics(messages, {
    minConfidence: args.minConfidence
  })
  const candidates = [...result.candidates]
  pipelineCache.setStage('candidates.heuristics', candidates)
  logger.success(
    `Regex: ${result.regexMatches}, URL: ${result.urlMatches}, Total: ${result.totalUnique}`
  )
  return { candidates, fromCache: false }
}

/** Step 3: Scrape URLs and enrich candidates */
async function runScrapeStep(
  ctx: StepContext,
  candidates: CandidateMessage[]
): Promise<CandidateMessage[]> {
  const { args, logger, pipelineCache, apiCache } = ctx

  if (pipelineCache.hasStage('scraped_urls')) {
    const cached = pipelineCache.getStage<CandidateMessage[]>('scraped_urls')
    logger.log('\n🔗 Scraping URLs... 📦 cached')
    return cached ?? candidates
  }

  const enriched = await scrapeAndEnrichCandidates(candidates, {
    timeout: args.scrapeTimeout,
    concurrency: args.scrapeConcurrency,
    cache: apiCache,
    onScrapeStart: ({ urlCount }) => {
      if (urlCount > 0) {
        logger.log(`\n🔗 Scraping ${urlCount} URLs...`)
      } else {
        logger.log('\n🔗 No URLs to scrape')
      }
    },
    onUrlScraped: ({ url, success, current, total }) => {
      if (args.verbose) {
        const status = success ? '✓' : '✗'
        const domain = new URL(url).hostname.replace('www.', '')
        logger.log(`   [${current}/${total}] ${status} ${domain}`)
      }
    }
  })
  pipelineCache.setStage('scraped_urls', enriched)
  return enriched
}

/** Step 4: Classify candidates with AI */
async function runClassifyStep(
  ctx: StepContext,
  candidates: CandidateMessage[]
): Promise<{ classifications: ClassifiedActivity[]; fromCache: boolean }> {
  const { args, logger, pipelineCache, apiCache } = ctx

  if (pipelineCache.hasStage('classifications')) {
    const classifications = pipelineCache.getStage<ClassifiedActivity[]>('classifications') ?? []
    logger.log('\n🤖 Classifying... 📦 cached')
    logger.success(`${classifications.length} activities`)
    return { classifications, fromCache: true }
  }

  const { provider, apiModel: model, apiKey } = resolveModelConfig()
  const { homeCountry, timezone } = resolveContext(args.homeCountry, args.timezone)
  const batchSize = 10
  const totalBatches = Math.ceil(candidates.length / batchSize)

  logger.log(`\n🤖 Classifying ${candidates.length} candidates with ${model}...`)
  logger.log(`   Processing in ${totalBatches} batches of ${batchSize}`)

  const config: ClassifierConfig = {
    provider,
    apiKey,
    model,
    homeCountry,
    timezone,
    batchSize,
    onBatchStart: (info) => {
      const batchNum = info.batchIndex + 1
      logger.log(
        `   [${batchNum}/${info.totalBatches}] Sending ${info.candidateCount} candidates...`
      )
    },
    onBatchComplete: (info) => {
      const batchNum = info.batchIndex + 1
      logger.log(
        `   [${batchNum}/${info.totalBatches}] ✓ ${info.activityCount} activities (${info.durationMs}ms)`
      )
    },
    onCacheCheck: (info) => {
      if (args.verbose && info.hit) {
        logger.log(`   [${info.batchIndex + 1}] 📦 API cache hit`)
      }
    }
  }

  const result = await classifyMessages(candidates, config, apiCache)
  if (!result.ok) {
    throw new Error(`Classification failed: ${result.error.message}`)
  }

  const classifications = filterActivities(result.value)
  const errands = result.value.filter((s) => !s.isActivity || s.activityScore < 0.5)
  pipelineCache.setStage('classifications', classifications)

  logger.log('')
  logger.success(`Activities: ${classifications.length}`)
  logger.success(`Errands (filtered): ${errands.length}`)

  return { classifications, fromCache: false }
}

/** Step 5: Geocode activities */
async function runGeocodeStep(
  ctx: StepContext,
  classifications: ClassifiedActivity[]
): Promise<{ geocoded: GeocodedActivity[]; fromCache: boolean }> {
  const { args, logger, pipelineCache } = ctx

  if (pipelineCache.hasStage('geocodings')) {
    const geocoded = pipelineCache.getStage<GeocodedActivity[]>('geocodings') ?? []
    logger.log('\n📍 Geocoding... 📦 cached')
    const mapped = geocoded.filter((g) => g.latitude !== undefined).length
    logger.success(`${mapped}/${geocoded.length} geocoded`)
    return { geocoded, fromCache: true }
  }

  if (args.skipGeocoding) {
    logger.log('\n📍 Skipping geocoding (--skip-geocoding)')
    const geocoded = classifications.map((s) => ({ ...s }))
    pipelineCache.setStage('geocodings', geocoded)
    return { geocoded, fromCache: false }
  }

  logger.log('\n📍 Geocoding locations...')
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    logger.error('GOOGLE_MAPS_API_KEY not set, skipping geocoding')
    const geocoded = classifications.map((s) => ({ ...s }))
    pipelineCache.setStage('geocodings', geocoded)
    return { geocoded, fromCache: false }
  }

  const config: GeocoderConfig = {
    apiKey,
    regionBias: args.region,
    defaultCountry: args.region === 'NZ' ? 'New Zealand' : undefined
  }
  const geocoded = await geocodeActivities(classifications, config)
  const mapped = geocoded.filter((g) => g.latitude !== undefined).length
  logger.success(`Successfully geocoded: ${mapped}/${classifications.length}`)
  pipelineCache.setStage('geocodings', geocoded)

  return { geocoded, fromCache: false }
}

/**
 * Run the full pipeline with caching support.
 * Each step is cached and reused on subsequent runs with the same input.
 */
export async function runCachedPipeline(
  args: CLIArgs,
  logger: Logger
): Promise<CachedPipelineResult | null> {
  if (!args.input) {
    throw new Error('No input file specified')
  }

  logger.log(`\nChatToMap v${VERSION}`)
  logger.log(`\n📁 Reading: ${args.input}`)

  // Read input content and initialize caches
  const content = await readInputFile(args.input)
  const cacheDir = join(homedir(), '.cache', 'chat-to-map')
  const pipelineCache = new PipelineCache(cacheDir)
  const apiCache = new FilesystemCache(cacheDir)

  // Find or create pipeline run
  const run = pipelineCache.getOrCreateRun(args.input, content)
  logger.log(`\n📂 Pipeline cache: ${basename(run.runDir)}`)

  const ctx: StepContext = { args, logger, pipelineCache, apiCache }

  // Step 1: Parse
  const { messages, fromCache: messagesFromCache } = runParseStep(ctx, content)

  if (args.dryRun) {
    logger.log('\n📊 Dry run complete. No API calls made.')
    return null
  }

  // Step 2: Candidates
  const { candidates, fromCache: candidatesFromCache } = runCandidatesStep(ctx, messages)

  if (candidates.length === 0) {
    logger.log('\n⚠️  No candidates found. Nothing to process.')
    return null
  }

  // Step 3: Scrape
  const enrichedCandidates = await runScrapeStep(ctx, candidates)

  // Step 4: Classify
  const { classifications, fromCache: classificationsFromCache } = await runClassifyStep(
    ctx,
    enrichedCandidates
  )

  if (classifications.length === 0) {
    logger.log('\n⚠️  No activities found after classification.')
    return null
  }

  // Step 5: Geocode
  const { geocoded, fromCache: geocodedFromCache } = await runGeocodeStep(ctx, classifications)

  return {
    messages,
    candidates,
    classifications,
    geocoded,
    fromCache: {
      messages: messagesFromCache,
      candidates: candidatesFromCache,
      classifications: classificationsFromCache,
      geocoded: geocodedFromCache
    }
  }
}

/**
 * Run the full cached analyze command.
 */
export async function cmdAnalyzeCached(args: CLIArgs, logger: Logger): Promise<void> {
  const result = await runCachedPipeline(args, logger)

  if (!result) {
    return
  }

  // Export results
  await runExport(result.geocoded, args, logger, args.input)

  const mapPath = join(args.outputDir, 'map.html')
  logger.log(`\n✨ Done! Open ${mapPath} to view your activity map.`)

  // Show cache summary
  const cached = Object.values(result.fromCache).filter(Boolean).length
  if (cached > 0) {
    logger.log(`   (${cached}/4 pipeline stages loaded from cache)`)
  }
}
